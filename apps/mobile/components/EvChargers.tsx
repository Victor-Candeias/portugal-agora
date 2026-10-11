import { useMemo, useState } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import {
  EV_CHARGER_MIN_POWER_OPTIONS,
  EV_CHARGER_RADII_KM,
  OPEN_CHARGE_MAP_ATTRIBUTION,
  OSM_ATTRIBUTION,
  formatDate,
  formatEvConnector,
  formatPowerKw,
  type EvCharger,
  type EvChargerStatus,
  type EvChargeSettings,
} from '@portugal-hoje/core'
import { useEvChargeSettings, useEvChargers } from '../hooks/useEv'
import { LISBON_COORDS, useUserLocation } from '../hooks/useUserLocation'
import { EvChargeCost } from './EvChargeCost'
import { PointsMap, SinglePointMap, type MapPoint } from './PointsMap'
import { openDirections } from '../lib/maps'
import {
  Badge,
  Card,
  ChipRow,
  COLORS,
  EmptyText,
  ErrorView,
  LinkText,
  LoadingView,
  Notice,
  SectionTitle,
  ShowMore,
  formatDistance,
  uiStyles,
} from './ui'

// Postos de carregamento perto do utilizador via Open Charge Map (WEB-040) e OpenStreetMap (WEB-047).
const COLOR = '#f59e0b'
const PAGE_SIZE = 20
// Os marcadores são views React: com centenas de postos o mapa fica lento.
const MAP_MAX_POINTS = 200

const RADIUS_OPTIONS = EV_CHARGER_RADII_KM.map(r => ({ value: String(r), label: `${r} km` }))

const STATUS_COLORS: Record<EvChargerStatus, { color: string; background: string }> = {
  operational: { color: '#166534', background: '#dcfce7' },
  partial: { color: '#92400e', background: '#fef3c7' },
  unavailable: { color: '#b91c1c', background: '#fee2e2' },
  planned: { color: '#1e40af', background: '#dbeafe' },
  unknown: { color: '#475569', background: '#f1f5f9' },
}

export function EvChargers() {
  // Sem permissão de localização, mostra os postos à volta de Lisboa.
  const location = useUserLocation(LISBON_COORDS)
  const [radius, setRadius] = useState('10')
  const [minPower, setMinPower] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [showOverview, setShowOverview] = useState(false)
  const [chargeSettings, updateChargeSettings] = useEvChargeSettings()

  const coords = location.status === 'loading' ? null : location.coords
  const params = coords
    ? { ...coords, radiusKm: Number(radius), minPowerKw: minPower ? Number(minPower) : undefined }
    : null
  const { data: chargers = [], isLoading, isError, error, isFetching, refetch, sources, ocmError } = useEvChargers(params)

  const mapPoints = useMemo<MapPoint[]>(
    () =>
      chargers.slice(0, MAP_MAX_POINTS).map(c => ({
        id: c.id,
        latitude: c.latitude,
        longitude: c.longitude,
        label: c.name,
        description: [c.maxPowerKw != null ? `até ${formatPowerKw(c.maxPowerKw)}` : null, c.operator]
          .filter(Boolean)
          .join(' · '),
      })),
    [chargers],
  )

  const resetList = () => setShown(PAGE_SIZE)
  const fastCount = chargers.filter(c => c.hasDc).length
  const osmCount = chargers.filter(c => c.source === 'osm').length
  const summary = [
    fastCount > 0 ? `${fastCount} com carregamento rápido (DC)` : null,
    osmCount > 0 ? `${osmCount} só no OpenStreetMap` : null,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <Card>
        <SectionTitle
          action={<LinkText label={isFetching ? 'A atualizar…' : '↻ Atualizar'} onPress={() => params && void refetch()} />}
        >
          Postos perto de mim
        </SectionTitle>
        <Text style={uiStyles.label}>Raio</Text>
        <ChipRow
          options={RADIUS_OPTIONS}
          value={radius}
          onChange={v => {
            if (v) setRadius(v)
            resetList()
          }}
          allLabel={null}
          color={COLOR}
        />
        <Text style={uiStyles.label}>Potência mínima</Text>
        <ChipRow
          options={EV_CHARGER_MIN_POWER_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          value={minPower}
          onChange={v => {
            setMinPower(v)
            resetList()
          }}
          allLabel="Todas"
          color={COLOR}
        />
        {location.status === 'granted' && (
          <Text style={styles.located}>🧭 Ordenado por distância a partir da tua localização</Text>
        )}
        {location.status === 'denied' && (
          <>
            <Text style={uiStyles.small}>Sem localização: a mostrar postos à volta de Lisboa.</Text>
            <LinkText label="🧭 Usar a minha localização" onPress={() => void location.request()} />
          </>
        )}
        {location.status === 'loading' && <Text style={uiStyles.small}>A obter localização…</Text>}
      </Card>

      {(isLoading || location.status === 'loading') && <LoadingView color={COLOR} />}
      {isError && <ErrorView error={error} onRetry={() => void refetch()} />}

      {params && !isLoading && !isError && (
        <>
          <SectionTitle
            action={
              mapPoints.length > 0 ? (
                <LinkText label={showOverview ? 'Ocultar mapa' : '🗺️ Ver no mapa'} onPress={() => setShowOverview(v => !v)} />
              ) : undefined
            }
          >
            {chargers.length} posto{chargers.length !== 1 ? 's' : ''} até {radius} km
          </SectionTitle>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
          {sources.osm === 'loading' && <Text style={styles.sourceInfo}>A procurar mais postos no OpenStreetMap…</Text>}
          {sources.osm === 'error' && (
            <Text style={styles.sourceWarning}>
              OpenStreetMap indisponível de momento: só postos do Open Charge Map. Toca em Atualizar para tentar outra vez.
            </Text>
          )}
          {sources.ocm === 'error' && (
            <Text style={styles.sourceWarning}>
              Open Charge Map indisponível ({(ocmError as Error | null)?.message}): só postos do OpenStreetMap.
            </Text>
          )}
          {showOverview && <PointsMap points={mapPoints} height={300} color={COLOR} style={uiStyles.map} />}
          {showOverview && chargers.length > MAP_MAX_POINTS && (
            <Text style={styles.sourceInfo}>Mapa com os {MAP_MAX_POINTS} postos mais próximos.</Text>
          )}
          {chargers.slice(0, shown).map(c => (
            <ChargerCard
              key={c.id}
              charger={c}
              chargeSettings={chargeSettings}
              onChargeSettingsChange={updateChargeSettings}
            />
          ))}
          {chargers.length === 0 && (
            <EmptyText>Nenhum posto encontrado. Experimente aumentar o raio ou baixar a potência mínima.</EmptyText>
          )}
          <ShowMore shown={shown} total={chargers.length} onPress={() => setShown(n => n + PAGE_SIZE)} />
        </>
      )}

      <Notice>
        Dados: {OPEN_CHARGE_MAP_ATTRIBUTION} e {OSM_ATTRIBUTION}. O estado de cada posto é o declarado na comunidade, não é
        em tempo real; os postos do OpenStreetMap não indicam estado.
      </Notice>
    </>
  )
}

function ChargerCard({
  charger: c,
  chargeSettings,
  onChargeSettingsChange,
}: {
  charger: EvCharger
  chargeSettings: EvChargeSettings
  onChargeSettingsChange: (patch: Partial<EvChargeSettings>) => void
}) {
  const [showMap, setShowMap] = useState(false)
  const [showCost, setShowCost] = useState(false)
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={uiStyles.strong}>{c.hasDc ? '⚡' : '🔌'} {c.name}</Text>
          {c.operator ? <Text style={uiStyles.small}>{c.operator}</Text> : null}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.distance}>{formatDistance(c.distanceKm)}</Text>
          {c.maxPowerKw != null && (
            <Badge label={`até ${formatPowerKw(c.maxPowerKw)}`} color="#92400e" background="#fef3c7" />
          )}
        </View>
      </View>

      {c.address || c.town ? (
        <Text style={uiStyles.small}>📍 {[c.address, c.town].filter(Boolean).join(', ')}</Text>
      ) : null}

      {c.connectors.length > 0 && (
        <View style={styles.connectors}>
          {c.connectors.map(conn => (
            <Text key={formatEvConnector(conn)} style={styles.connector}>{formatEvConnector(conn)}</Text>
          ))}
        </View>
      )}

      <View style={styles.badges}>
        <Badge label={c.statusLabel} {...STATUS_COLORS[c.status]} />
        {c.access ? <Badge label={c.access} color="#475569" background="#f1f5f9" /> : null}
        {c.points != null && <Text style={styles.points}>{c.points} ponto{c.points !== 1 ? 's' : ''}</Text>}
      </View>

      {c.usageCost ? <Text style={styles.detail}>💶 {c.usageCost}</Text> : null}
      {c.comments ? <Text style={styles.detail} numberOfLines={2}>{c.comments}</Text> : null}
      {c.lastVerified ? <Text style={styles.verified}>Verificado em {formatDate(c.lastVerified)}</Text> : null}

      <View style={uiStyles.actions}>
        <LinkText label={showCost ? '💶 Ocultar custo e tempo' : '💶 Custo e tempo'} onPress={() => setShowCost(v => !v)} />
        <LinkText label={showMap ? '🗺️ Ocultar mapa' : '🗺️ Mapa'} onPress={() => setShowMap(v => !v)} />
        <LinkText label="🧭 Direções" onPress={() => openDirections(c.latitude, c.longitude)} />
        <LinkText
          label={c.source === 'osm' ? '🔗 OpenStreetMap' : '🔗 Open Charge Map'}
          onPress={() => void Linking.openURL(c.url)}
        />
      </View>
      {showCost && <EvChargeCost settings={chargeSettings} onChange={onChargeSettingsChange} connectors={c.connectors} />}
      {showMap && <SinglePointMap latitude={c.latitude} longitude={c.longitude} label={c.name} style={uiStyles.cardMap} />}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  distance: { fontSize: 12, fontWeight: '600', color: '#ea580c' },
  located: { fontSize: 12, color: '#15803d', fontWeight: '600' },
  summary: { fontSize: 12, color: COLORS.faint, marginTop: -6, marginBottom: 10 },
  sourceInfo: { fontSize: 12, color: COLORS.faint, marginBottom: 10 },
  sourceWarning: { fontSize: 12, color: '#b45309', marginBottom: 10 },
  connectors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  connector: {
    fontSize: 11,
    color: '#334155',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  points: { fontSize: 11, color: COLORS.faint },
  detail: { fontSize: 12, color: '#475569', marginTop: 6 },
  verified: { fontSize: 11, color: COLORS.faint, marginTop: 4 },
})
