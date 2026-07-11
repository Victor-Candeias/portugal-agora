import { useState, useMemo } from 'react'
import { Train as TrainIcon, AlertTriangle, RefreshCw, MapPin, Clock } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useTrains, useTmlAlerts } from '@/hooks/useTransportes'
import type { Train, TmlAlert } from '@/hooks/useTransportes'

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

// ── Comboios tab ──────────────────────────────────────────────────────────

const PAGE_SIZE = 30

function ComboiosTab() {
  const { data: trains = [], isLoading, isError, refetch, dataUpdatedAt } = useTrains()
  const [serviceFilter, setServiceFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const services = useMemo(
    () => [...new Set(trains.map(t => t.service.designation))].sort(),
    [trains],
  )

  const filtered = useMemo(
    () => serviceFilter ? trains.filter(t => t.service.designation === serviceFilter) : trains,
    [trains, serviceFilter],
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // reset page when filter changes
  const handleServiceFilter = (s: string | null) => { setServiceFilter(s); setPage(1) }

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
        {paginated.map(t => (
          <Card key={`${t.trainNumber}-${t.runDate}`} className="p-4">
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
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 flex-wrap">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                n === page ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}
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

// ── Main page ─────────────────────────────────────────────────────────────

const TABS = ['Comboios CP', 'Alertas TML'] as const
type Tab = typeof TABS[number]

export function Transportes() {
  const [active, setActive] = useState<Tab>('Comboios CP')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🚆 Transportes</h1>
        <p className="text-slate-500 text-sm mt-1">Comboios CP em tempo real · Alertas TML Lisboa/Setúbal</p>
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
            {t === 'Comboios CP' ? <TrainIcon size={15} /> : <AlertTriangle size={15} />}
            {t}
          </button>
        ))}
      </div>

      {active === 'Comboios CP' && <ComboiosTab />}
      {active === 'Alertas TML' && <AlertasTmlTab />}
    </div>
  )
}
