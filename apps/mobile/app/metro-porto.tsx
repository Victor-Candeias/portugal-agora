import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { formatDepartureTime, secondsSinceMidnight, type MetroStation } from '@portugal-hoje/core'
import { useMetroNextDepartures, useMetroPortoMeta, useMetroStationLines, useMetroStations } from '../hooks/useMetroPorto'
import { PointsMap, SinglePointMap, type MapPoint } from '../components/PointsMap'
import {
  Card,
  COLORS,
  EmptyText,
  ErrorView,
  LinkText,
  LoadingView,
  ScreenHeader,
  SearchInput,
  SectionTitle,
  ShowMore,
  uiStyles,
} from '../components/ui'

const PAGE_SIZE = 20
const PURPLE = '#7c3aed'

function contrastColor(hex: string | null): string {
  if (!hex) return '#0f172a'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0f172a' : '#ffffff'
}

function LineBadge({ label, color }: { label: string; color: string | null }) {
  return (
    <View style={[styles.lineBadge, { backgroundColor: color ? `#${color}` : '#e2e8f0' }]}>
      <Text style={[styles.lineBadgeText, { color: contrastColor(color) }]}>{label}</Text>
    </View>
  )
}

export default function MetroPorto() {
  const { data: stations = [], isLoading, isError, error, refetch } = useMetroStations()
  const { data: meta } = useMetroPortoMeta()
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showOverview, setShowOverview] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? stations.filter(s => s.station_name.toLowerCase().includes(q)) : stations
  }, [stations, search])

  const mapPoints = useMemo<MapPoint[]>(
    () =>
      filtered
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({ id: s.station_id, latitude: s.latitude!, longitude: s.longitude!, label: s.station_name })),
    [filtered],
  )

  const updated = meta?.generated_at ? ` · atualizado em ${new Date(meta.generated_at).toLocaleDateString('pt-PT')}` : ''

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="🚇 Metro do Porto" subtitle={`Estações e próximas partidas · dados GTFS oficiais${updated}`} />

      <SearchInput
        value={search}
        onChangeText={text => {
          setSearch(text)
          setShown(PAGE_SIZE)
          setExpanded(null)
        }}
        placeholder="Nome da estação…"
      />

      {isLoading && <LoadingView color={PURPLE} />}
      {isError && <ErrorView error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <>
          <SectionTitle
            action={
              mapPoints.length > 0 ? (
                <LinkText label={showOverview ? 'Ocultar mapa' : '🗺️ Ver no mapa'} onPress={() => setShowOverview(v => !v)} />
              ) : undefined
            }
          >
            {filtered.length} estaç{filtered.length !== 1 ? 'ões' : 'ão'} encontrada{filtered.length !== 1 ? 's' : ''}
          </SectionTitle>
          {showOverview && <PointsMap points={mapPoints} height={300} color={PURPLE} style={uiStyles.map} />}
          {filtered.slice(0, shown).map(station => (
            <MetroStationCard
              key={station.station_id}
              station={station}
              expanded={expanded === station.station_id}
              onToggle={() => setExpanded(expanded === station.station_id ? null : station.station_id)}
            />
          ))}
          {filtered.length === 0 && <EmptyText>Nenhuma estação encontrada.</EmptyText>}
          <ShowMore shown={shown} total={filtered.length} onPress={() => setShown(s => s + PAGE_SIZE)} />
        </>
      )}
    </ScrollView>
  )
}

function MetroStationCard({ station, expanded, onToggle }: { station: MetroStation; expanded: boolean; onToggle: () => void }) {
  const [showMap, setShowMap] = useState(false)
  const stationId = expanded ? station.station_id : undefined
  const { data: lines = [] } = useMetroStationLines(stationId)
  const { data: departures = [], isLoading: loadingDepartures } = useMetroNextDepartures(stationId)
  const hasCoords = station.latitude != null && station.longitude != null
  const nowSeconds = secondsSinceMidnight(new Date())

  return (
    <Card>
      <TouchableOpacity style={styles.header} onPress={onToggle}>
        <Text style={[uiStyles.strong, styles.flex]}>🚊 {station.station_name}</Text>
        <Text style={styles.toggle}>{expanded ? 'Fechar' : 'Ver partidas'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {lines.length > 0 && (
            <View style={styles.lines}>
              {lines.map(l => (
                <LineBadge key={l.line_id} label={l.short_name} color={l.color} />
              ))}
            </View>
          )}
          <Text style={styles.sectionLabel}>🕒 Próximas partidas</Text>
          {loadingDepartures && <Text style={uiStyles.small}>A carregar horários…</Text>}
          {!loadingDepartures && departures.length === 0 && (
            <Text style={uiStyles.small}>Sem mais partidas previstas hoje nesta estação.</Text>
          )}
          {departures.slice(0, 8).map((dep, i) => (
            <View key={`${dep.line_id}-${dep.departure_seconds}-${i}`} style={styles.departure}>
              <LineBadge label={dep.short_name} color={dep.color} />
              <Text style={styles.time}>{formatDepartureTime(dep.departure_seconds)}</Text>
              <Text style={[uiStyles.small, styles.flex]} numberOfLines={1}>→ {dep.destination ?? '—'}</Text>
              {dep.departure_seconds - nowSeconds < 300 && <Text style={styles.soon}>a chegar</Text>}
            </View>
          ))}
          {hasCoords && (
            <View style={uiStyles.actions}>
              <LinkText label={showMap ? '🗺️ Ocultar mapa' : '🗺️ Mapa'} onPress={() => setShowMap(v => !v)} />
            </View>
          )}
          {showMap && hasCoords && (
            <SinglePointMap
              latitude={station.latitude!}
              longitude={station.longitude!}
              label={station.station_name}
              style={uiStyles.cardMap}
            />
          )}
        </View>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggle: { fontSize: 12, fontWeight: '600', color: PURPLE },
  body: { marginTop: 10, gap: 6 },
  lines: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  lineBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  lineBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  departure: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 12, fontWeight: '600', color: '#334155', fontVariant: ['tabular-nums'] },
  soon: { fontSize: 11, fontWeight: '600', color: '#16a34a' },
})
