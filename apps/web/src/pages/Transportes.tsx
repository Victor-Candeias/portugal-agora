import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Train as TrainIcon, AlertTriangle, RefreshCw, MapPin, Clock, ChevronDown, ExternalLink, Navigation, Bus } from 'lucide-react'
import { Card } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { useTrains, useStations, useTmlAlerts } from '@/hooks/useTransportes'
import type { Station, Train, TmlAlert } from '@/hooks/useTransportes'
import {
  useCarrisVehicles, useCarrisLines, useCarrisLinesMap,
  useCarrisStops, useNearbyStops, useStopRealtime,
} from '@/hooks/useCarris'
import type { CMVehicle, CMStop, CMRealtime } from '@/hooks/useCarris'
import 'leaflet/dist/leaflet.css'

// ── Helpers ───────────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, string> = {
  'Alfa Pendular':     '#dc2626',
  'Intercidades':      '#ea580c',
  'InterRegional':     '#d97706',
  'Regional':          '#16a34a',
  'Urbano de Lisboa':  '#2563eb',
  'Urbano do Porto':   '#7c3aed',
  'Urbano de Coimbra': '#0891b2',
  'Fertagus':          '#0d9488',
  'Histórico':         '#78716c',
}

const CAUSE_LABEL: Record<string, string> = {
  CONSTRUCTION:   '🏗️ Obras',
  ROAD_ISSUE:     '🚧 Problema na estrada',
  WEATHER:        '🌩️ Mau tempo',
  DEMONSTRATION:  '📢 Manifestação',
  NETWORK_UPDATE: '🔄 Atualização de rede',
}

const EFFECT_COLOR: Record<string, string> = {
  SIGNIFICANT_DELAYS:   'bg-red-100 text-red-800',
  DETOUR:               'bg-orange-100 text-orange-800',
  REDUCED_SERVICE:      'bg-yellow-100 text-yellow-800',
  MODIFIED_SERVICE:     'bg-blue-100 text-blue-800',
  ADDITIONAL_SERVICE:   'bg-green-100 text-green-800',
  STOP_MOVED:           'bg-purple-100 text-purple-800',
  ACCESSIBILITY_ISSUE:  'bg-slate-100 text-slate-700',
}

const EFFECT_LABEL: Record<string, string> = {
  SIGNIFICANT_DELAYS:  'Atrasos',
  DETOUR:              'Desvio',
  REDUCED_SERVICE:     'Serviço reduzido',
  MODIFIED_SERVICE:    'Serviço alterado',
  ADDITIONAL_SERVICE:  'Serviço adicional',
  STOP_MOVED:          'Paragem movida',
  ACCESSIBILITY_ISSUE: 'Acessibilidade',
}

const STATUS_LABEL: Record<string, string> = {
  IN_TRANSIT:  'Em trânsito',
  AT_STATION:  'Na estação',
  AT_ORIGIN:   'Na origem',
  NEAR_NEXT:   'A chegar',
}

function delayMin(s: number) { return Math.round(s / 60) }

function delayLabel(s: number) {
  const m = delayMin(s)
  if (m <= 0) return m < -1 ? `${Math.abs(m)} min adiantado` : 'Pontual'
  return `+${m} min`
}

function delayColor(s: number) {
  const m = delayMin(s)
  if (m <= 1)  return 'text-green-700 bg-green-50'
  if (m <= 5)  return 'text-yellow-700 bg-yellow-50'
  if (m <= 15) return 'text-orange-700 bg-orange-50'
  return 'text-red-700 bg-red-50'
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function trainKey(t: Train) {
  return `${t.trainNumber}-${t.runDate}`
}

function stationName(code: string | undefined, stations: Map<string, Station>) {
  if (!code) return '—'
  return stations.get(code)?.designation ?? code
}

function detailItem(label: string, value: React.ReactNode) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

function TrainDetails({ train, stations }: { train: Train; stations: Map<string, Station> }) {
  const lastStation = stationName(train.lastStation, stations)
  const currentStop = stationName(train.gtfs?.stopId?.replaceAll('_', '-'), stations)
  const mapUrl = `https://www.google.com/maps?q=${train.latitude},${train.longitude}`

  return (
    <div className="mt-4 border-t border-slate-100 pt-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {detailItem('Estado', STATUS_LABEL[train.status] ?? train.status)}
        {detailItem('Atraso', delayLabel(train.delay))}
        {detailItem('Atualizado', formatDateTime(train.timestamp))}
        {detailItem('Última estação', lastStation)}
        {detailItem('Plataforma', train.lastStationPlatform || '—')}
        {detailItem('Sequência', train.gtfs?.stopSequence ?? '—')}
      </div>

      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-950">
        <p className="font-semibold">Percurso</p>
        <p className="mt-1">{train.origin.designation} → {train.destination.designation}</p>
        {train.gtfs?.tripId && (
          <p className="mt-1 text-xs text-blue-700">Trip ID: {train.gtfs.tripId}</p>
        )}
        {currentStop !== '—' && (
          <p className="mt-1 text-xs text-blue-700">Próxima/paragem GTFS: {currentStop}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Navigation size={12} />
          Direção {Math.round(train.bearing || 0)}°
        </span>
        <span>{train.skippedStops?.length ?? 0} paragens saltadas</span>
        {train.hasDisruptions && <span className="font-semibold text-red-600">⚠️ Com perturbações</span>}
        {train.latitude && train.longitude && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
          >
            Ver no mapa <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Comboios tab ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20

function ComboiosTab() {
  const { data: trains = [], isLoading, isError, refetch, dataUpdatedAt } = useTrains()
  const { data: stationList = [] } = useStations()
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null)

  const services = useMemo(
    () => [...new Set(trains.map(t => t.service.designation))].sort(),
    [trains],
  )

  const filtered = useMemo(
    () => serviceFilter ? trains.filter(t => t.service.designation === serviceFilter) : trains,
    [trains, serviceFilter],
  )

  const stations = useMemo(
    () => new Map(stationList.map(s => [s.code, s])),
    [stationList],
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // reset page when filter changes
  const handleServiceFilter = (s: string | null) => { setServiceFilter(s); setPage(1); setSelectedTrain(null) }

  const delayed    = filtered.filter(t => delayMin(t.delay) > 1).length
  const onTime     = filtered.filter(t => delayMin(t.delay) <= 1).length
  const maxDelay   = filtered[0]

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar comboios CP." />

  return (
    <div className="space-y-4">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {filtered.length} comboios · atualizado às {updatedAt} · atualiza a cada 60s
        </p>
        <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-3">
          <p className="text-xs text-slate-500 mb-1">Com atraso</p>
          <p className="text-2xl font-bold text-red-600">{delayed}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-slate-500 mb-1">Pontuais</p>
          <p className="text-2xl font-bold text-green-600">{onTime}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-slate-500 mb-1">Maior atraso</p>
          <p className="text-2xl font-bold text-orange-600">
            {maxDelay ? `${delayMin(maxDelay.delay)}m` : '—'}
          </p>
        </Card>
      </div>

      {/* Service filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleServiceFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !serviceFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        {services.map(s => (
          <button
            key={s}
            onClick={() => handleServiceFilter(serviceFilter === s ? null : s)}
            style={serviceFilter === s ? { backgroundColor: SERVICE_COLORS[s] ?? '#64748b' } : {}}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              serviceFilter === s ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Train list */}
      <div className="space-y-2">
        {paginated.map(t => {
          const key = trainKey(t)
          const isSelected = selectedTrain === key

          return (
          <Card key={key} className={`p-4 transition-colors ${isSelected ? 'border-blue-200 bg-blue-50/30' : ''}`}>
            <button
              type="button"
              onClick={() => setSelectedTrain(isSelected ? null : key)}
              aria-expanded={isSelected}
              className="w-full text-left"
            >
              <div className="flex items-center gap-3">
              {/* Train number + service */}
              <div className="flex-shrink-0 text-center min-w-[56px]">
                <p className="text-lg font-bold text-slate-900">{t.trainNumber}</p>
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: SERVICE_COLORS[t.service.designation] ?? '#64748b' }}
                >
                  {t.service.designation.replace('Urbano de ', '').replace('Urbano do ', '')}
                </span>
              </div>

              {/* Route */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {t.origin.designation} → {t.destination.designation}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {STATUS_LABEL[t.status] ?? t.status}
                  {t.lastStationPlatform && ` · Plataforma ${t.lastStationPlatform}`}
                  {t.hasDisruptions && ' · ⚠️ Perturbações'}
                </p>
              </div>

              {/* Delay badge */}
              <div className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold ${delayColor(t.delay)}`}>
                {delayLabel(t.delay)}
              </div>

              <ChevronDown
                size={18}
                className={`flex-shrink-0 text-slate-400 transition-transform ${isSelected ? 'rotate-180' : ''}`}
              />
            </div>
            </button>

            {isSelected && <TrainDetails train={t} stations={stations} />}
          </Card>
          )
        })}
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}

// ── Alertas TML tab ───────────────────────────────────────────────────────

function AlertasTmlTab() {
  const { data: alerts = [], isLoading, isError, refetch } = useTmlAlerts()
  const [effectFilter, setEffectFilter] = useState<string | null>(null)

  const effects = useMemo(
    () => [...new Set(alerts.map(a => a.effect))].sort(),
    [alerts],
  )

  const filtered = useMemo(
    () => effectFilter ? alerts.filter(a => a.effect === effectFilter) : alerts,
    [alerts, effectFilter],
  )

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar alertas TML." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{filtered.length} alertas ativos · TML Lisboa/Setúbal</p>
        <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Effect filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEffectFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            !effectFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos
        </button>
        {effects.map(e => (
          <button
            key={e}
            onClick={() => setEffectFilter(effectFilter === e ? null : e)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              effectFilter === e
                ? (EFFECT_COLOR[e] ?? 'bg-slate-200 text-slate-800')
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {EFFECT_LABEL[e] ?? e}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {filtered.map(a => (
          <Card key={a._id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="font-semibold text-slate-900 text-sm leading-snug">{a.title}</p>
              <div className="flex flex-col gap-1 flex-shrink-0 items-end">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${EFFECT_COLOR[a.effect] ?? 'bg-slate-100 text-slate-700'}`}>
                  {EFFECT_LABEL[a.effect] ?? a.effect}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-2 leading-relaxed">{a.description}</p>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>{CAUSE_LABEL[a.cause] ?? a.cause}</span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {formatDate(a.active_period_start_date)} – {formatDate(a.active_period_end_date)}
              </span>
              {a.coordinates && (
                <a
                  href={`https://www.google.com/maps?q=${a.coordinates[0]},${a.coordinates[1]}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium ml-auto"
                >
                  <MapPin size={11} /> Mapa
                </a>
              )}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">Sem alertas ativos.</p>
        )}
      </div>
    </div>
  )
}

// ── Carris Metropolitana tab ──────────────────────────────────────────────

// Sub-tab type
type CarrisSubTab = 'Veículos' | 'Linhas' | 'Paragens perto'

// ── Leaflet map for CM vehicles ───────────────────────────────────────────

function useCMMap(vehicles: CMVehicle[], linesMap: Map<string, { color: string }>) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<import('leaflet').Marker[]>([])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return
      const map = L.map(mapRef.current).setView([38.72, -9.14], 11)
      mapInstanceRef.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)
    })
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || vehicles.length === 0) return
    import('leaflet').then((L) => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      vehicles.forEach(v => {
        const color = linesMap.get(v.line_id)?.color ?? '#2563eb'
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#fff;border-radius:50%;
            width:26px;height:26px;display:flex;align-items:center;justify-content:center;
            font-size:10px;font-weight:700;border:2px solid #fff;
            box-shadow:0 1px 3px rgba(0,0,0,.4)">${v.line_id}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })

        const ts = v.timestamp
          ? new Date(v.timestamp * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
          : '—'

        const marker = L.marker([v.lat, v.lon], { icon })
          .bindPopup(`<b>Linha ${v.line_id}</b><br/>ID: ${v.id}<br/>Vel.: ${Math.round(v.speed * 3.6)} km/h<br/>${ts}`)
          .addTo(map)
        markersRef.current.push(marker)
      })
    })
  }, [vehicles, linesMap])

  return mapRef
}

// ── Veículos sub-tab ──────────────────────────────────────────────────────

function VehiclesSubTab() {
  const [lineFilter, setLineFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const { data: allVehicles = [], isLoading, isError, refetch, dataUpdatedAt } = useCarrisVehicles()
  const linesMap = useCarrisLinesMap()

  const filtered = useMemo(
    () => lineFilter ? allVehicles.filter(v => v.line_id === lineFilter) : allVehicles,
    [allVehicles, lineFilter],
  )

  const activeLines = useMemo(() => {
    const ids = [...new Set(allVehicles.map(v => v.line_id).filter(Boolean))]
    return ids.sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }))
  }, [allVehicles])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleLineFilter = (id: string | null) => { setLineFilter(id); setPage(1) }

  const mapRef = useCMMap(filtered.slice(0, 500), linesMap)

  const updatedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar veículos Carris Metropolitana." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {allVehicles.length} veículos · {filtered.length} exibidos{updatedAt && ` · ${updatedAt}`} · 30s
        </p>
        <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-3">
          <p className="text-xs text-slate-500 mb-1">Veículos ativos</p>
          <p className="text-2xl font-bold text-blue-600">{allVehicles.length}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-slate-500 mb-1">Linhas ativas</p>
          <p className="text-2xl font-bold text-green-600">{activeLines.length}</p>
        </Card>
        <Card className="text-center py-3">
          <p className="text-xs text-slate-500 mb-1">Filtrados</p>
          <p className="text-2xl font-bold text-slate-700">{filtered.length}</p>
        </Card>
      </div>

      {/* Line chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => handleLineFilter(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            !lineFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todas
        </button>
        {activeLines.map(lid => {
          const line = linesMap.get(lid)
          return (
            <button
              key={lid}
              onClick={() => handleLineFilter(lineFilter === lid ? null : lid)}
              className="px-2.5 py-1 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ backgroundColor: lineFilter === lid ? (line?.color ?? '#2563eb') : (line?.color ?? '#64748b') }}
            >
              {lid}
            </button>
          )
        })}
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full h-72 rounded-xl border border-slate-200 overflow-hidden" />

      {/* Vehicle list */}
      <div className="space-y-2">
        {paginated.map(v => {
          const line = linesMap.get(v.line_id)
          const ts = v.timestamp
            ? new Date(v.timestamp * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : '—'
          return (
            <Card key={v.id} className="p-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex-shrink-0 rounded-lg px-2 py-1 text-center min-w-[44px]"
                  style={{ backgroundColor: line?.color ?? '#64748b' }}
                >
                  <p className="text-sm font-bold text-white">{v.line_id}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 truncate">{v.trip_id || '—'}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {Math.round(v.speed * 3.6)} km/h · {v.current_status.replace('_', ' ')} · {v.propulsion}
                    {v.wheelchair_accessible && ' · ♿'}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[10px] text-slate-400">{ts}</p>
                  <a
                    href={`https://www.google.com/maps?q=${v.lat},${v.lon}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-end gap-1 text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <MapPin size={10} /> Mapa
                  </a>
                </div>
              </div>
            </Card>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">Sem veículos ativos.</p>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}

// ── Linhas sub-tab ────────────────────────────────────────────────────────

function LinesSubTab() {
  const [muniFilter, setMuniFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const { data: lines = [], isLoading, isError } = useCarrisLines(muniFilter)
  const { data: allLines = [] } = useCarrisLines(null)
  const { data: stops = [] } = useCarrisStops()

  // Build municipality id→name map from stops
  const muniNames = useMemo(() => {
    const map = new Map<string, string>()
    stops.forEach(s => { if (s.municipality_id) map.set(s.municipality_id, s.municipality_name) })
    return map
  }, [stops])

  const munis = useMemo(() => {
    const ids = new Set<string>()
    allLines.forEach(l => l.municipality_ids.forEach(mid => ids.add(mid)))
    return [...ids].sort((a, b) => (muniNames.get(a) ?? a).localeCompare(muniNames.get(b) ?? b, 'pt'))
  }, [allLines, muniNames])

  const totalPages = Math.ceil(lines.length / PAGE_SIZE)
  const paginated  = lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar linhas Carris Metropolitana." />

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{lines.length} linhas</p>

      {/* Municipality filter */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => { setMuniFilter(null); setPage(1) }}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            !muniFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos os municípios
        </button>
        {munis.map(mid => (
          <button
            key={mid}
            onClick={() => { setMuniFilter(muniFilter === mid ? null : mid); setPage(1) }}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              muniFilter === mid ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {muniNames.get(mid) ?? mid}
          </button>
        ))}
      </div>

      {/* Lines list */}
      <div className="space-y-2">
        {paginated.map(l => (
          <Card key={l.id} className="p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex-shrink-0 rounded-lg px-2 py-1 text-center min-w-[52px]"
                style={{ backgroundColor: l.color }}
              >
                <p className="text-sm font-bold" style={{ color: l.text_color }}>{l.short_name}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 truncate">{l.long_name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {l.municipality_ids.length} município{l.municipality_ids.length !== 1 ? 's' : ''} ·{' '}
                  {l.pattern_ids.length} percurso{l.pattern_ids.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {lines.length === 0 && (
          <p className="text-slate-400 text-sm text-center py-8">Sem linhas.</p>
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  )
}

// ── Realtime arrivals for a stop ──────────────────────────────────────────

function StopArrivals({ stop }: { stop: CMStop }) {
  const { data: arrivals = [], isLoading } = useStopRealtime(stop.id)
  const linesMap = useCarrisLinesMap()

  function formatArrival(unix: number | null) {
    if (!unix) return '—'
    return new Date(unix * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{stop.long_name}</p>
      {isLoading && <p className="text-xs text-slate-400">A carregar chegadas…</p>}
      {!isLoading && arrivals.length === 0 && (
        <p className="text-xs text-slate-400">Sem chegadas previstas.</p>
      )}
      {arrivals.slice(0, 5).map((a, idx) => {
        const line = linesMap.get(a.line_id)
        const planned = formatArrival(a.scheduled_arrival_unix)
        const estimated = formatArrival(a.estimated_arrival_unix ?? a.observed_arrival_unix)
        const isLate = a.estimated_arrival_unix && a.scheduled_arrival_unix &&
          (a.estimated_arrival_unix - a.scheduled_arrival_unix) > 60
        return (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span
              className="px-1.5 py-0.5 rounded text-white font-bold flex-shrink-0"
              style={{ backgroundColor: line?.color ?? '#64748b' }}
            >
              {a.line_id}
            </span>
            <span className="flex-1 truncate text-slate-700">{a.headsign}</span>
            <span className="flex-shrink-0 tabular-nums text-slate-500">{planned}</span>
            {estimated !== planned && (
              <span className={`flex-shrink-0 tabular-nums font-semibold ${isLate ? 'text-red-600' : 'text-green-600'}`}>
                {estimated}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Paragens perto sub-tab ────────────────────────────────────────────────

function NearbyStopsSubTab() {
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'denied' | 'ok'>('idle')
  const [selectedStop, setSelectedStop] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const { isLoading: stopsLoading } = useCarrisStops()

  const nearbyStops = useNearbyStops(userPos?.lat ?? null, userPos?.lon ?? null)

  const totalPages = Math.ceil(nearbyStops.length / PAGE_SIZE)
  const paginated  = nearbyStops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function requestLocation() {
    if (!navigator.geolocation) { setLocationStatus('denied'); return }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocationStatus('ok') },
      ()  => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="space-y-4">
      {locationStatus !== 'ok' && (
        <Card className="text-center py-6">
          <p className="text-slate-500 text-sm mb-3">Encontra paragens próximas da tua localização.</p>
          <button
            onClick={requestLocation}
            disabled={locationStatus === 'loading'}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <MapPin size={16} />
            {locationStatus === 'loading' ? 'A obter localização…' : 'Usar localização'}
          </button>
          {locationStatus === 'denied' && (
            <p className="text-xs text-red-500 mt-2">Localização negada ou não disponível.</p>
          )}
        </Card>
      )}

      {locationStatus === 'ok' && stopsLoading && <LoadingBox />}

      {locationStatus === 'ok' && !stopsLoading && (
        <>
          <p className="text-xs text-slate-400">
            {nearbyStops.length} paragens num raio de 500 m
          </p>
          <div className="space-y-2">
            {paginated.map(s => (
              <Card key={s.id} className="p-3">
                <button
                  type="button"
                  onClick={() => setSelectedStop(selectedStop === s.id ? null : s.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.long_name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {s.municipality_name} · {s.locality_name} · {(s as CMStop & { distKm: number }).distKm.toFixed(0) === '0' ? '<1' : ((s as CMStop & { distKm: number }).distKm * 1000).toFixed(0)} m
                        {s.wheelchair_boarding && ' · ♿'}
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-slate-400 transition-transform ${selectedStop === s.id ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
                {selectedStop === s.id && <StopArrivals stop={s} />}
              </Card>
            ))}
            {nearbyStops.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-8">Sem paragens próximas encontradas.</p>
            )}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}

// ── Carris Metropolitana main tab ─────────────────────────────────────────

const CARRIS_SUBTABS: CarrisSubTab[] = ['Veículos', 'Linhas', 'Paragens perto']

function CarrisTab() {
  const [sub, setSub] = useState<CarrisSubTab>('Veículos')

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {CARRIS_SUBTABS.map(t => (
          <button
            key={t}
            onClick={() => setSub(t)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              sub === t
                ? 'border-blue-500 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {sub === 'Veículos'       && <VehiclesSubTab />}
      {sub === 'Linhas'         && <LinesSubTab />}
      {sub === 'Paragens perto' && <NearbyStopsSubTab />}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

const TABS = ['Comboios CP', 'Carris', 'Alertas TML'] as const
type Tab = typeof TABS[number]

export function Transportes() {
  const [active, setActive] = useState<Tab>('Comboios CP')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🚆 Transportes</h1>
        <p className="text-slate-500 text-sm mt-1">Comboios CP em tempo real · Carris GTFS · Alertas TML Lisboa/Setúbal</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              active === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {t === 'Comboios CP' && <TrainIcon size={15} />}
            {t === 'Carris'      && <Bus size={15} />}
            {t === 'Alertas TML' && <AlertTriangle size={15} />}
            {t}
          </button>
        ))}
      </div>

      {active === 'Comboios CP' && <ComboiosTab />}
      {active === 'Carris'      && <CarrisTab />}
      {active === 'Alertas TML' && <AlertasTmlTab />}
    </div>
  )
}
