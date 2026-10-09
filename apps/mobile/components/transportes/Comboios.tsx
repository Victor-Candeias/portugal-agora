import { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { Station, Train } from '@portugal-hoje/core'
import { useTrains, useTrainStations } from '../../hooks/useTransportes'
import { PointsMap, SinglePointMap, type MapPoint } from '../PointsMap'
import { Card, ChipRow, EmptyText, ErrorView, LinkText, LoadingView, ShowMore, uiStyles } from '../ui'
import { SERVICE_COLORS, TRAIN_STATUS_LABEL, formatClock, formatDateTime } from './labels'
import { DetailGrid, StatCard, styles as shared } from './shared'

const PAGE_SIZE = 20

const delayMin = (s: number) => Math.round(s / 60)

function delayLabel(s: number) {
  const m = delayMin(s)
  if (m <= 0) return m < -1 ? `${Math.abs(m)} min adiantado` : 'Pontual'
  return `+${m} min`
}

function delayColors(s: number) {
  const m = delayMin(s)
  if (m <= 1) return { color: '#15803d', backgroundColor: '#f0fdf4' }
  if (m <= 5) return { color: '#a16207', backgroundColor: '#fefce8' }
  if (m <= 15) return { color: '#c2410c', backgroundColor: '#fff7ed' }
  return { color: '#b91c1c', backgroundColor: '#fef2f2' }
}

const trainKey = (t: Train) => `${t.trainNumber}-${t.runDate}`

function stationName(code: string | undefined, stations: Map<string, Station>) {
  if (!code) return '—'
  return stations.get(code)?.designation ?? code
}

export function ComboiosTab() {
  const { data: trains = [], isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useTrains()
  const { data: stationList = [] } = useTrainStations()
  const [service, setService] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  const services = useMemo(() => [...new Set(trains.map(t => t.service.designation))].sort(), [trains])
  const filtered = useMemo(
    () => (service ? trains.filter(t => t.service.designation === service) : trains),
    [trains, service],
  )
  const stations = useMemo(() => new Map(stationList.map(s => [s.code, s])), [stationList])
  const mapPoints = useMemo<MapPoint[]>(
    () =>
      filtered
        .filter(t => Number(t.latitude) && Number(t.longitude))
        .map(t => ({
          id: trainKey(t),
          latitude: Number(t.latitude),
          longitude: Number(t.longitude),
          label: `Comboio ${t.trainNumber} · ${t.service.designation}`,
          description: `${t.origin.designation} → ${t.destination.designation} · ${delayLabel(t.delay)}`,
        })),
    [filtered],
  )

  if (isLoading) return <LoadingView color="#2563eb" />
  if (isError) return <ErrorView error={error} onRetry={() => refetch()} />

  const delayed = filtered.filter(t => delayMin(t.delay) > 1).length
  const onTime = filtered.length - delayed
  const maxDelay = filtered[0]

  return (
    <View>
      <View style={shared.metaRow}>
        <Text style={shared.meta}>
          {filtered.length} comboios · {dataUpdatedAt ? formatClock(dataUpdatedAt, true) : '—'} · atualiza a cada 60 s
        </Text>
        <LinkText label={isFetching ? 'A atualizar…' : '↻ Atualizar'} onPress={() => refetch()} />
      </View>

      <View style={shared.stats}>
        <StatCard label="Com atraso" value={String(delayed)} color="#dc2626" />
        <StatCard label="Pontuais" value={String(onTime)} color="#16a34a" />
        <StatCard label="Maior atraso" value={maxDelay ? `${delayMin(maxDelay.delay)}m` : '—'} color="#ea580c" />
      </View>

      <ChipRow
        options={services.map(s => ({ value: s, label: s }))}
        value={service}
        onChange={v => {
          setService(v)
          setShown(PAGE_SIZE)
          setSelected(null)
        }}
        color={service ? SERVICE_COLORS[service] ?? '#64748b' : '#1e293b'}
      />

      {mapPoints.length > 0 && (
        <View style={shared.mapToggle}>
          <LinkText label={showMap ? 'Ocultar mapa' : `🗺️ Ver ${mapPoints.length} comboios no mapa`} onPress={() => setShowMap(v => !v)} />
        </View>
      )}
      {showMap && <PointsMap points={mapPoints} height={300} color="#2563eb" style={uiStyles.map} />}

      {filtered.slice(0, shown).map(t => {
        const key = trainKey(t)
        const isSelected = selected === key
        const serviceColor = SERVICE_COLORS[t.service.designation] ?? '#64748b'
        return (
          <Card key={key} style={isSelected ? styles.selected : undefined}>
            <TouchableOpacity onPress={() => setSelected(isSelected ? null : key)} style={styles.row}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{t.trainNumber}</Text>
                <View style={[styles.service, { backgroundColor: serviceColor }]}>
                  <Text style={styles.serviceText} numberOfLines={1}>
                    {t.service.designation.replace('Urbano de ', '').replace('Urbano do ', '')}
                  </Text>
                </View>
              </View>
              <View style={styles.flex}>
                <Text style={styles.route} numberOfLines={2}>
                  {t.origin.designation} → {t.destination.designation}
                </Text>
                <Text style={shared.meta}>
                  {TRAIN_STATUS_LABEL[t.status] ?? t.status}
                  {t.lastStationPlatform ? ` · Plataforma ${t.lastStationPlatform}` : ''}
                  {t.hasDisruptions ? ' · ⚠️ Perturbações' : ''}
                </Text>
              </View>
              <View style={[styles.delay, { backgroundColor: delayColors(t.delay).backgroundColor }]}>
                <Text style={[styles.delayText, { color: delayColors(t.delay).color }]}>{delayLabel(t.delay)}</Text>
              </View>
            </TouchableOpacity>
            {isSelected && <TrainDetails train={t} stations={stations} />}
          </Card>
        )
      })}
      {filtered.length === 0 && <EmptyText>Sem comboios em circulação.</EmptyText>}
      <ShowMore shown={shown} total={filtered.length} onPress={() => setShown(s => s + PAGE_SIZE)} />
    </View>
  )
}

function TrainDetails({ train, stations }: { train: Train; stations: Map<string, Station> }) {
  const [showMap, setShowMap] = useState(false)
  const lastStation = stationName(train.lastStation, stations)
  const currentStop = stationName(train.gtfs?.stopId?.replaceAll('_', '-'), stations)
  const lat = Number(train.latitude)
  const lng = Number(train.longitude)
  const hasCoords = Boolean(lat && lng)

  return (
    <View style={shared.details}>
      <DetailGrid
        items={[
          ['Estado', TRAIN_STATUS_LABEL[train.status] ?? train.status],
          ['Atraso', delayLabel(train.delay)],
          ['Atualizado', formatDateTime(train.timestamp)],
          ['Última estação', lastStation],
          ['Plataforma', train.lastStationPlatform || '—'],
          ['Sequência', train.gtfs?.stopSequence != null ? String(train.gtfs.stopSequence) : '—'],
        ]}
      />
      <View style={shared.infoBox}>
        <Text style={shared.infoTitle}>Percurso</Text>
        <Text style={shared.infoText}>
          {train.origin.designation} → {train.destination.designation}
        </Text>
        {train.gtfs?.tripId ? <Text style={shared.infoMeta}>Trip ID: {train.gtfs.tripId}</Text> : null}
        {currentStop !== '—' && <Text style={shared.infoMeta}>Próxima/paragem GTFS: {currentStop}</Text>}
      </View>
      <View style={uiStyles.actions}>
        <Text style={shared.meta}>🧭 Direção {Math.round(train.bearing || 0)}°</Text>
        <Text style={shared.meta}>{train.skippedStops?.length ?? 0} paragens saltadas</Text>
        {train.hasDisruptions && <Text style={styles.disruption}>⚠️ Com perturbações</Text>}
        {hasCoords && <LinkText label={showMap ? 'Ocultar mapa' : '🗺️ Ver no mapa'} onPress={() => setShowMap(v => !v)} />}
      </View>
      {showMap && hasCoords && (
        <SinglePointMap
          latitude={lat}
          longitude={lng}
          label={`Comboio ${train.trainNumber} · ${train.origin.designation} → ${train.destination.designation}`}
          style={uiStyles.cardMap}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selected: { borderWidth: 1, borderColor: '#bfdbfe' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { alignItems: 'center', minWidth: 60 },
  numberText: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  service: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2, maxWidth: 80 },
  serviceText: { color: 'white', fontSize: 10, fontWeight: '600' },
  route: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  delay: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  delayText: { fontSize: 12, fontWeight: '700' },
  disruption: { fontSize: 11, color: '#dc2626', fontWeight: '700' },
})
