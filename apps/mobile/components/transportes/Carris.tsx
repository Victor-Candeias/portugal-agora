import { useMemo, useState } from 'react'
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import {
  isAlertActive,
  lisbonServiceDay,
  type CMAlert,
  type CMLine,
  type CMNearbyStop,
  type CMScheduledDeparture,
  type CMStop,
  type CMVehicle,
} from '@portugal-hoje/core'
import {
  useCarrisAlerts,
  useCarrisLinePatterns,
  useCarrisLines,
  useCarrisLinesMap,
  useCarrisOperators,
  useCarrisStops,
  useCarrisVehicles,
  useLineSchedule,
  useNearbyStops,
  useStopRealtime,
  useStopSchedule,
} from '../../hooks/useCarris'
import { useUserLocation } from '../../hooks/useUserLocation'
import { PointsMap, SinglePointMap, type MapPoint } from '../PointsMap'
import {
  Badge,
  Card,
  ChipRow,
  COLORS,
  EmptyText,
  ErrorView,
  LinkText,
  LoadingView,
  SearchInput,
  SegmentedTabs,
  ShowMore,
  formatDistance,
  uiStyles,
} from '../ui'
import { CAUSE_LABEL, EFFECT_LABEL, VEHICLE_STATUS_LABEL, byNumeric, effectColors, formatClock, formatDate, formatDateTime } from './labels'
import { DetailGrid, LinePill, StatCard, styles as shared } from './shared'

const PAGE_SIZE = 20
// O MapLibre aguenta bem algumas centenas de marcadores em vista; acima disso o mapa fica lento.
const MAX_MAP_VEHICLES = 300

type CarrisSubTab = 'vehicles' | 'lines' | 'nearby' | 'alerts'

const SUBTABS: { value: CarrisSubTab; label: string }[] = [
  { value: 'vehicles', label: 'Veículos' },
  { value: 'lines', label: 'Linhas' },
  { value: 'nearby', label: 'Perto' },
  { value: 'alerts', label: 'Alertas' },
]

export function CarrisTab() {
  const [sub, setSub] = useState<CarrisSubTab>('vehicles')
  const [detailLineId, setDetailLineId] = useState<string | null>(null)

  return (
    <View>
      <SegmentedTabs tabs={SUBTABS} value={sub} onChange={setSub} />
      {sub === 'vehicles' && <VehiclesSubTab onShowLine={setDetailLineId} />}
      {sub === 'lines' && <LinesSubTab />}
      {sub === 'nearby' && <NearbyStopsSubTab onShowLine={setDetailLineId} />}
      {sub === 'alerts' && <AlertsSubTab />}
      <LineInfoModal lineId={detailLineId} onClose={() => setDetailLineId(null)} />
    </View>
  )
}

// ── Veículos ──────────────────────────────────────────────────────────────

function VehiclesSubTab({ onShowLine }: { onShowLine: (lineId: string) => void }) {
  const { data: allVehicles = [], isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useCarrisVehicles()
  const linesMap = useCarrisLinesMap()
  const { data: operatorList = [] } = useCarrisOperators()
  const operatorNames = useMemo(() => new Map(operatorList.map(o => [o.id, o.name])), [operatorList])
  const { data: stops = [] } = useCarrisStops()
  const stopsMap = useMemo(() => new Map(stops.map(s => [s.id, s])), [stops])

  const [operator, setOperator] = useState<string | null>(null)
  const [line, setLine] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  const operators = useMemo(
    () => [...new Set(allVehicles.map(v => v.agency_id).filter(Boolean))].sort(byNumeric),
    [allVehicles],
  )
  const linesForOperator = useMemo(
    () =>
      [...new Set((operator ? allVehicles.filter(v => v.agency_id === operator) : allVehicles).map(v => v.line_id).filter(Boolean))]
        .sort(byNumeric),
    [allVehicles, operator],
  )
  const activeLines = useMemo(() => new Set(allVehicles.map(v => v.line_id).filter(Boolean)).size, [allVehicles])
  const filtered = useMemo(
    () => allVehicles.filter(v => (!operator || v.agency_id === operator) && (!line || v.line_id === line)),
    [allVehicles, operator, line],
  )
  const mapPoints = useMemo<MapPoint[]>(
    () =>
      filtered.slice(0, MAX_MAP_VEHICLES).map(v => ({
        id: v.id,
        latitude: v.lat,
        longitude: v.lon,
        label: `Carreira ${v.line_id}`,
        description: `${Math.round(v.speed * 3.6)} km/h · ${v.timestamp ? formatClock(v.timestamp * 1000) : '—'}`,
      })),
    [filtered],
  )

  if (isLoading) return <LoadingView color="#2563eb" />
  if (isError) return <ErrorView error={error} onRetry={() => refetch()} />

  return (
    <View>
      <View style={shared.metaRow}>
        <Text style={shared.meta}>
          {allVehicles.length} veículos · {filtered.length} exibidos
          {dataUpdatedAt ? ` · ${formatClock(dataUpdatedAt, true)}` : ''} · 30 s
        </Text>
        <LinkText label={isFetching ? 'A atualizar…' : '↻ Atualizar'} onPress={() => refetch()} />
      </View>

      <View style={shared.stats}>
        <StatCard label="Veículos ativos" value={String(allVehicles.length)} color="#2563eb" />
        <StatCard label="Linhas ativas" value={String(activeLines)} color="#16a34a" />
        <StatCard label="Filtrados" value={String(filtered.length)} color="#334155" />
      </View>

      <Text style={uiStyles.label}>Operador</Text>
      <ChipRow
        options={operators.map(id => ({ value: id, label: operatorNames.get(id) ?? `Operador ${id}` }))}
        value={operator}
        onChange={v => {
          setOperator(v)
          setLine(null)
          setShown(PAGE_SIZE)
        }}
        allLabel="Todos os operadores"
        color="#2563eb"
      />
      <Text style={uiStyles.label}>Carreira</Text>
      <ChipRow
        options={linesForOperator.map(id => ({ value: id, label: id }))}
        value={line}
        onChange={v => {
          setLine(v)
          setShown(PAGE_SIZE)
        }}
        allLabel="Todas"
        color="#2563eb"
      />

      {mapPoints.length > 0 && (
        <View style={shared.mapToggle}>
          <LinkText
            label={
              showMap
                ? 'Ocultar mapa'
                : `🗺️ Ver ${mapPoints.length}${filtered.length > MAX_MAP_VEHICLES ? ` de ${filtered.length}` : ''} veículos no mapa`
            }
            onPress={() => setShowMap(v => !v)}
          />
        </View>
      )}
      {showMap && <PointsMap points={mapPoints} height={300} color="#2563eb" style={uiStyles.map} />}

      {filtered.slice(0, shown).map(v => {
        const l = linesMap.get(v.line_id)
        const isSelected = selected === v.id
        return (
          <Card key={v.id}>
            <TouchableOpacity style={styles.row} onPress={() => setSelected(isSelected ? null : v.id)}>
              <TouchableOpacity onPress={() => onShowLine(v.line_id)}>
                <LinePill label={v.line_id} color={l?.color ?? '#64748b'} textColor={l?.text_color ?? 'white'} />
              </TouchableOpacity>
              <View style={styles.flex}>
                <Text style={styles.small} numberOfLines={1}>{l?.long_name ?? v.trip_id ?? '—'}</Text>
                <Text style={shared.meta}>
                  {Math.round(v.speed * 3.6)} km/h · {VEHICLE_STATUS_LABEL[v.current_status] ?? v.current_status}
                  {v.propulsion ? ` · ${v.propulsion}` : ''}
                  {v.wheelchair_accessible ? ' · ♿' : ''}
                </Text>
              </View>
              <Text style={shared.meta}>{v.timestamp ? formatClock(v.timestamp * 1000, true) : '—'}</Text>
            </TouchableOpacity>
            {isSelected && (
              <VehicleDetails
                vehicle={v}
                line={l}
                operatorName={operatorNames.get(v.agency_id)}
                stop={stopsMap.get(v.stop_id)}
                onShowLine={() => onShowLine(v.line_id)}
              />
            )}
          </Card>
        )
      })}
      {filtered.length === 0 && <EmptyText>Sem veículos ativos.</EmptyText>}
      <ShowMore shown={shown} total={filtered.length} onPress={() => setShown(s => s + PAGE_SIZE)} />
    </View>
  )
}

function VehicleDetails({
  vehicle,
  line,
  operatorName,
  stop,
  onShowLine,
}: {
  vehicle: CMVehicle
  line: CMLine | undefined
  operatorName: string | undefined
  stop: CMStop | undefined
  onShowLine: () => void
}) {
  const [showMap, setShowMap] = useState(false)
  return (
    <View style={shared.details}>
      <DetailGrid
        items={[
          ['Estado', VEHICLE_STATUS_LABEL[vehicle.current_status] ?? vehicle.current_status],
          ['Velocidade', `${Math.round(vehicle.speed * 3.6)} km/h`],
          ['Direção', `${Math.round(vehicle.bearing || 0)}°`],
          ['Propulsão', vehicle.propulsion || '—'],
          ['Acessibilidade', vehicle.wheelchair_accessible ? '♿ Acessível' : '—'],
          ['Atualizado', vehicle.timestamp ? formatDateTime(vehicle.timestamp * 1000) : '—'],
        ]}
      />
      <View style={shared.infoBox}>
        <Text style={shared.infoTitle}>Carreira e percurso</Text>
        <TouchableOpacity onPress={onShowLine}>
          <Text style={[shared.infoText, styles.underline]}>
            {line?.short_name ?? vehicle.line_id}
            {line ? ` · ${line.long_name}` : ''}
          </Text>
        </TouchableOpacity>
        {operatorName && <Text style={shared.infoMeta}>Operador: {operatorName}</Text>}
        {stop && <Text style={shared.infoMeta}>Paragem atual: {stop.long_name}</Text>}
        <Text style={shared.infoMeta}>
          Route: {vehicle.route_id || '—'} · Pattern: {vehicle.pattern_id || '—'} · Trip: {vehicle.trip_id || '—'}
        </Text>
      </View>
      <View style={uiStyles.actions}>
        <Text style={shared.meta}>Matrícula/ID: {vehicle.id}</Text>
        <LinkText label={showMap ? 'Ocultar mapa' : '🗺️ Ver no mapa'} onPress={() => setShowMap(v => !v)} />
      </View>
      {showMap && (
        <SinglePointMap
          latitude={vehicle.lat}
          longitude={vehicle.lon}
          label={`Carreira ${vehicle.line_id}`}
          description={`${Math.round(vehicle.speed * 3.6)} km/h`}
          style={uiStyles.cardMap}
        />
      )}
    </View>
  )
}

// ── Linhas ────────────────────────────────────────────────────────────────

function useMunicipalityNames(stops: CMStop[]) {
  return useMemo(() => {
    const map = new Map<string, string>()
    stops.forEach(s => {
      if (s.municipality_id) map.set(s.municipality_id, s.municipality_name)
    })
    return map
  }, [stops])
}

function LinesSubTab() {
  const [muni, setMuni] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<string | null>(null)
  const { data: lines = [], isLoading, isError, error, refetch } = useCarrisLines(muni)
  const { data: allLines = [] } = useCarrisLines(null)
  const { data: stops = [] } = useCarrisStops()
  const muniNames = useMunicipalityNames(stops)

  const munis = useMemo(() => {
    const ids = new Set<string>()
    allLines.forEach(l => l.municipality_ids.forEach(mid => ids.add(mid)))
    return [...ids].sort((a, b) => (muniNames.get(a) ?? a).localeCompare(muniNames.get(b) ?? b, 'pt'))
  }, [allLines, muniNames])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? lines.filter(l => l.short_name.toLowerCase().includes(q) || l.long_name.toLowerCase().includes(q)) : lines
  }, [lines, search])

  if (isLoading) return <LoadingView color="#2563eb" />
  if (isError) return <ErrorView error={error} onRetry={() => refetch()} />

  return (
    <View>
      <Text style={[shared.meta, styles.spaced]}>{filtered.length} linhas</Text>
      <SearchInput
        value={search}
        onChangeText={text => {
          setSearch(text)
          setShown(PAGE_SIZE)
        }}
        placeholder="Número ou nome da linha…"
      />
      <ChipRow
        options={munis.map(mid => ({ value: mid, label: muniNames.get(mid) ?? mid }))}
        value={muni}
        onChange={v => {
          setMuni(v)
          setShown(PAGE_SIZE)
        }}
        allLabel="Todos os municípios"
        color="#2563eb"
      />
      {filtered.slice(0, shown).map(l => {
        const isSelected = selected === l.id
        return (
          <Card key={l.id}>
            <TouchableOpacity style={styles.row} onPress={() => setSelected(isSelected ? null : l.id)}>
              <LinePill label={l.short_name} color={l.color} textColor={l.text_color} />
              <View style={styles.flex}>
                <Text style={styles.small} numberOfLines={2}>{l.long_name}</Text>
                <Text style={shared.meta}>
                  {l.municipality_ids.length} município{l.municipality_ids.length !== 1 ? 's' : ''} · {l.pattern_ids.length} percurso
                  {l.pattern_ids.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={shared.meta}>{isSelected ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {isSelected && <LineDetails line={l} muniNames={muniNames} stops={stops} />}
          </Card>
        )
      })}
      {filtered.length === 0 && <EmptyText>Sem linhas.</EmptyText>}
      <ShowMore shown={shown} total={filtered.length} onPress={() => setShown(s => s + PAGE_SIZE)} />
    </View>
  )
}

function LineDetails({ line, muniNames, stops }: { line: CMLine; muniNames: Map<string, string>; stops: CMStop[] }) {
  const { data: patterns = [], isLoading } = useCarrisLinePatterns(line.pattern_ids)
  const { data: schedule = [], isError: scheduleError } = useLineSchedule(line.id)
  const stopsMap = useMemo(() => new Map(stops.map(s => [s.id, s])), [stops])
  const scheduleByPattern = useMemo(() => {
    const map = new Map<string, CMScheduledDeparture[]>()
    for (const d of schedule) {
      const arr = map.get(d.pattern_id) ?? []
      arr.push(d)
      map.set(d.pattern_id, arr)
    }
    return map
  }, [schedule])

  const municipalityNames = line.municipality_ids.map(mid => muniNames.get(mid) ?? mid).sort((a, b) => a.localeCompare(b, 'pt'))

  return (
    <View style={shared.details}>
      <Text style={styles.small}>
        <Text style={styles.bold}>Municípios: </Text>
        {municipalityNames.join(', ') || '—'}
      </Text>
      {isLoading && <Text style={shared.meta}>A carregar percursos…</Text>}
      {!isLoading && patterns.length === 0 && <Text style={shared.meta}>Sem percursos disponíveis.</Text>}
      {patterns.map(p => {
        const first = stopsMap.get(p.path[0]?.stop_id)
        const last = stopsMap.get(p.path[p.path.length - 1]?.stop_id)
        const departures = scheduleByPattern.get(p.id) ?? []
        return (
          <View key={p.id} style={styles.pattern}>
            <Text style={styles.patternTitle}>
              {p.direction_id === 0 ? 'Ida' : 'Volta'} · {p.headsign}
            </Text>
            <Text style={styles.small}>
              {first?.long_name ?? '—'} → {last?.long_name ?? '—'}
            </Text>
            <Text style={shared.meta}>{p.path.length} paragens</Text>
            {!scheduleError && (
              <>
                <Text style={[styles.small, styles.spacedTop]}>
                  <Text style={styles.bold}>Partidas hoje: </Text>
                  {departures.length === 0 ? 'sem horários programados' : departures.length}
                </Text>
                {departures.length > 0 && <Text style={styles.times}>{departures.map(d => d.time).join(' · ')}</Text>}
              </>
            )}
          </View>
        )
      })}
    </View>
  )
}

function LineInfoModal({ lineId, onClose }: { lineId: string | null; onClose: () => void }) {
  return (
    <Modal visible={lineId !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Carreira {lineId}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>{lineId && <LineInfo lineId={lineId} />}</ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function LineInfo({ lineId }: { lineId: string }) {
  const { data: allLines = [], isLoading: linesLoading } = useCarrisLines(null)
  const { data: stops = [], isLoading: stopsLoading } = useCarrisStops()
  const { data: operators = [] } = useCarrisOperators()
  const muniNames = useMunicipalityNames(stops)
  const line = allLines.find(l => l.id === lineId)
  const operatorName = operators.find(o => o.id === line?.operator_id)?.name

  if (linesLoading || stopsLoading) return <LoadingView color="#2563eb" />
  if (!line) return <Text style={shared.meta}>Sem informação disponível para esta carreira.</Text>
  return (
    <View>
      <View style={styles.row}>
        <LinePill label={line.short_name} color={line.color} textColor={line.text_color} />
        <Text style={[uiStyles.strong, styles.flex]}>{line.long_name}</Text>
      </View>
      {operatorName && <Text style={[shared.meta, styles.spacedTop]}>Operador: {operatorName}</Text>}
      <LineDetails line={line} muniNames={muniNames} stops={stops} />
    </View>
  )
}

// ── Paragens perto ────────────────────────────────────────────────────────

function NearbyStopsSubTab({ onShowLine }: { onShowLine: (lineId: string) => void }) {
  const location = useUserLocation()
  const { isLoading: stopsLoading, isError, error, refetch } = useCarrisStops()
  const nearby = useNearbyStops(location.coords?.latitude ?? null, location.coords?.longitude ?? null)
  const [selected, setSelected] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)
  const mapPoints = useMemo<MapPoint[]>(
    () =>
      nearby.map(s => ({
        id: s.id,
        latitude: s.lat,
        longitude: s.lon,
        label: s.long_name,
        description: `${formatDistance(s.distKm)} · ${s.locality_name}`,
      })),
    [nearby],
  )

  if (location.status !== 'granted') {
    return (
      <Card style={styles.centered}>
        <Text style={[styles.small, styles.spaced]}>Encontra paragens próximas da tua localização.</Text>
        <TouchableOpacity
          style={styles.button}
          disabled={location.status === 'loading'}
          onPress={() => void location.request()}
        >
          <Text style={styles.buttonText}>
            {location.status === 'loading' ? 'A obter localização…' : '📍 Usar localização'}
          </Text>
        </TouchableOpacity>
        {location.status === 'denied' && <Text style={styles.denied}>Localização negada ou não disponível.</Text>}
      </Card>
    )
  }

  if (stopsLoading) return <LoadingView color="#2563eb" />
  if (isError) return <ErrorView error={error} onRetry={() => refetch()} />

  return (
    <View>
      <View style={shared.metaRow}>
        <Text style={shared.meta}>{nearby.length} paragens num raio de 500 m</Text>
        {mapPoints.length > 0 && (
          <LinkText label={showMap ? 'Ocultar mapa' : '🗺️ Mapa'} onPress={() => setShowMap(v => !v)} />
        )}
      </View>
      {showMap && <PointsMap points={mapPoints} height={260} color="#2563eb" style={uiStyles.map} />}
      {nearby.map(s => {
        const isSelected = selected === s.id
        return (
          <Card key={s.id}>
            <TouchableOpacity style={styles.row} onPress={() => setSelected(isSelected ? null : s.id)}>
              <View style={styles.flex}>
                <Text style={styles.stopName} numberOfLines={2}>{s.long_name}</Text>
                <Text style={shared.meta}>{stopMeta(s)}</Text>
              </View>
              <Text style={shared.meta}>{isSelected ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {isSelected && <StopArrivals stop={s} onShowLine={onShowLine} />}
          </Card>
        )
      })}
      {nearby.length === 0 && <EmptyText>Sem paragens próximas encontradas.</EmptyText>}
    </View>
  )
}

function stopMeta(s: CMNearbyStop) {
  const parts = [s.municipality_name, s.locality_name, formatDistance(s.distKm)].filter(Boolean)
  let text = parts.join(' · ')
  if (s.wheelchair_boarding) text += ' · ♿'
  if (s.facilities.includes('train')) text += ' · 🚆'
  if (s.facilities.includes('subway')) text += ' · 🚇'
  if (s.facilities.includes('light_rail')) text += ' · 🚊'
  if (s.facilities.includes('boat')) text += ' · ⛴️'
  return text
}

function formatArrival(unix: number | null) {
  return unix ? formatClock(unix * 1000) : '—'
}

function StopArrivals({ stop, onShowLine }: { stop: CMStop; onShowLine: (lineId: string) => void }) {
  const { data: arrivals = [], isLoading } = useStopRealtime(stop.id)
  const linesMap = useCarrisLinesMap()

  return (
    <View style={shared.details}>
      <Text style={styles.sectionLabel}>Próximas chegadas (tempo real)</Text>
      {isLoading && <Text style={shared.meta}>A carregar chegadas…</Text>}
      {!isLoading && arrivals.length === 0 && <Text style={shared.meta}>Sem chegadas previstas.</Text>}
      {arrivals.slice(0, 5).map((a, idx) => {
        const line = linesMap.get(a.line_id)
        const planned = formatArrival(a.scheduled_arrival_unix)
        const estimated = formatArrival(a.estimated_arrival_unix ?? a.observed_arrival_unix)
        const isLate =
          a.estimated_arrival_unix != null &&
          a.scheduled_arrival_unix != null &&
          a.estimated_arrival_unix - a.scheduled_arrival_unix > 60
        return (
          <View key={`${a.trip_id ?? a.pattern_id}-${idx}`} style={styles.arrival}>
            <TouchableOpacity onPress={() => onShowLine(a.line_id)}>
              <LinePill label={a.line_id} color={line?.color ?? '#64748b'} textColor={line?.text_color ?? 'white'} />
            </TouchableOpacity>
            <Text style={[styles.small, styles.flex]} numberOfLines={1}>{a.headsign}</Text>
            <Text style={styles.time}>{planned}</Text>
            {estimated !== planned && (
              <Text style={[styles.time, styles.bold, { color: isLate ? '#dc2626' : '#16a34a' }]}>{estimated}</Text>
            )}
          </View>
        )
      })}
      <StopSchedule stop={stop} />
      <View style={uiStyles.actions}>
        <SinglePointMapToggle stop={stop} />
      </View>
    </View>
  )
}

function SinglePointMapToggle({ stop }: { stop: CMStop }) {
  const [show, setShow] = useState(false)
  return (
    <View style={styles.flex}>
      <LinkText label={show ? 'Ocultar mapa' : '🗺️ Ver paragem no mapa'} onPress={() => setShow(v => !v)} />
      {show && <SinglePointMap latitude={stop.lat} longitude={stop.lon} label={stop.long_name} style={uiStyles.cardMap} />}
    </View>
  )
}

function StopSchedule({ stop }: { stop: CMStop }) {
  const { data: schedule = [], isLoading, isError } = useStopSchedule(stop.id)
  const linesMap = useCarrisLinesMap()
  const nowSeconds = lisbonServiceDay().seconds
  const upcoming = schedule.filter(d => d.seconds >= nowSeconds).slice(0, 8)

  return (
    <View style={styles.schedule}>
      <Text style={styles.sectionLabel}>Horários programados (hoje)</Text>
      {isLoading && <Text style={shared.meta}>A carregar horários…</Text>}
      {isError && <Text style={shared.meta}>Horários indisponíveis.</Text>}
      {!isLoading && !isError && upcoming.length === 0 && <Text style={shared.meta}>Sem mais partidas programadas hoje.</Text>}
      {upcoming.map((d, idx) => {
        const line = linesMap.get(d.line_id)
        return (
          <View key={`${d.pattern_id}-${d.seconds}-${idx}`} style={styles.arrival}>
            <LinePill label={d.line_id} color={line?.color ?? '#64748b'} textColor={line?.text_color ?? 'white'} />
            <Text style={[styles.small, styles.flex]} numberOfLines={1}>{d.headsign}</Text>
            <Text style={styles.time}>{d.time}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ── Alertas da rede ───────────────────────────────────────────────────────

function AlertsSubTab() {
  const { data: alerts = [], isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useCarrisAlerts()
  const linesMap = useCarrisLinesMap()
  const [effect, setEffect] = useState<string | null>(null)
  const [lineQuery, setLineQuery] = useState('')

  const effects = useMemo(() => [...new Set(alerts.map(a => a.effect))].sort(), [alerts])
  const filtered = useMemo(() => {
    const q = lineQuery.trim()
    return alerts.filter(a => (!effect || a.effect === effect) && (!q || a.line_ids.some(id => id.startsWith(q))))
  }, [alerts, effect, lineQuery])

  if (isLoading) return <LoadingView color="#2563eb" />
  if (isError) return <ErrorView error={error} onRetry={() => refetch()} />

  const nowSeconds = Date.now() / 1000

  return (
    <View>
      <View style={shared.metaRow}>
        <Text style={shared.meta}>
          {filtered.length} alertas · atualizado às {formatClock(dataUpdatedAt)}
        </Text>
        <LinkText label={isFetching ? 'A atualizar…' : '↻ Atualizar'} onPress={() => refetch()} />
      </View>
      <SearchInput value={lineQuery} onChangeText={setLineQuery} placeholder="Filtrar por linha (ex.: 1728)" />
      <ChipRow
        options={effects.map(e => ({ value: e, label: EFFECT_LABEL[e] ?? e }))}
        value={effect}
        onChange={setEffect}
        color="#1e293b"
      />
      {filtered.map(a => (
        <CarrisAlertCard key={a.id} alert={a} active={isAlertActive(a, nowSeconds)} linesMap={linesMap} />
      ))}
      {filtered.length === 0 && <EmptyText>Sem alertas.</EmptyText>}
    </View>
  )
}

function CarrisAlertCard({ alert: a, active, linesMap }: { alert: CMAlert; active: boolean; linesMap: Map<string, CMLine> }) {
  return (
    <Card>
      <View style={styles.alertHeader}>
        <Text style={[uiStyles.strong, styles.flex]}>{a.header}</Text>
        <View style={styles.alertBadges}>
          <Badge label={EFFECT_LABEL[a.effect] ?? a.effect} {...effectColors(a.effect)} />
          {!active && <Badge label="Programado" color="#475569" background="#f1f5f9" />}
        </View>
      </View>
      {a.description ? <Text style={styles.description}>{a.description}</Text> : null}
      {a.line_ids.length > 0 && (
        <View style={styles.pills}>
          {a.line_ids.map(id => (
            <LinePill key={id} label={id} color={linesMap.get(id)?.color ?? '#64748b'} textColor={linesMap.get(id)?.text_color ?? 'white'} />
          ))}
        </View>
      )}
      <View style={uiStyles.actions}>
        <Text style={shared.meta}>{CAUSE_LABEL[a.cause] ?? a.cause}</Text>
        <Text style={shared.meta}>
          🕒 {a.start ? formatDate(a.start * 1000) : '—'} – {a.end ? formatDate(a.end * 1000) : 'sem fim previsto'}
        </Text>
        {a.stop_ids.length > 0 && (
          <Text style={shared.meta}>
            📍 {a.stop_ids.length} {a.stop_ids.length === 1 ? 'paragem' : 'paragens'}
          </Text>
        )}
        {a.image_url && <LinkText label="Ver imagem" onPress={() => Linking.openURL(a.image_url!)} />}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  small: { fontSize: 12, color: '#334155' },
  bold: { fontWeight: '700' },
  underline: { textDecorationLine: 'underline' },
  spaced: { marginBottom: 8 },
  spacedTop: { marginTop: 4 },
  stopName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  pattern: { backgroundColor: COLORS.background, borderRadius: 8, padding: 10 },
  patternTitle: { fontSize: 12, fontWeight: '700', color: '#334155' },
  times: { fontSize: 11, color: '#475569', marginTop: 2, lineHeight: 17, fontVariant: ['tabular-nums'] },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  arrival: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { fontSize: 12, color: COLORS.muted, fontVariant: ['tabular-nums'] },
  schedule: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 6 },
  centered: { alignItems: 'center', paddingVertical: 20 },
  button: { backgroundColor: '#2563eb', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  denied: { fontSize: 12, color: '#ef4444', marginTop: 8 },
  alertHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  alertBadges: { alignItems: 'flex-end', gap: 4 },
  description: { fontSize: 12, color: COLORS.muted, lineHeight: 17, marginBottom: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  modalClose: { fontSize: 18, color: COLORS.faint },
})
