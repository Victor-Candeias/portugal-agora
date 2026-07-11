import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { MapPin, Phone, Mail, Activity, ChevronDown } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useHospitaisValencias, useHospitaisAtendimentos } from '@/hooks/useHospitais'

const TIPO_COLOR: Record<string, string> = {
  'Serviço de Urgência Básica':                           'bg-blue-100 text-blue-800',
  'Serviço de Urgência Médico-cirúrgico':                 'bg-purple-100 text-purple-800',
  'Serviço de Urgência Polivalente':                      'bg-orange-100 text-orange-800',
  'Serviço de Urgência Polivalente com Centro de Trauma': 'bg-red-100 text-red-800',
}

const REGIAO_COLORS: Record<string, string> = {
  'Região de Saúde do Norte':    '#3b82f6',
  'Região de Saúde do Centro':   '#22c55e',
  'Região de Saúde LVT':         '#f97316',
  'Região de Saúde do Alentejo': '#eab308',
  'Região de Saúde do Algarve':  '#a855f7',
  'ARS Norte':                   '#3b82f6',
  'ARS Centro':                  '#22c55e',
  'ARS Lisboa e Vale do Tejo':   '#f97316',
  'ARS Alentejo':                '#eab308',
  'ARS Algarve':                 '#a855f7',
  'IASAÚDE Madeira':             '#ec4899',
  'SRS Açores':                  '#06b6d4',
}

/** "2026-04" → "abr. 26" */
function formatPeriodo(tempo: string) {
  const [year, month] = tempo.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}

function formatNum(n: number) {
  return n.toLocaleString('pt-PT')
}

function tipoLabel(tipo: string) {
  return tipo
    .replace('Serviço de Urgência ', '')
    .replace(' com Centro de Trauma', ' +Trauma')
}

// ── Filtros em cascata (Região → Localidade) ─────────────────────────────

interface FiltrosProps {
  regioes: string[]
  localidades: string[]
  tipos: string[]
  regiao: string
  localidade: string
  tipo: string
  search: string
  onRegiao: (v: string) => void
  onLocalidade: (v: string) => void
  onTipo: (v: string) => void
  onSearch: (v: string) => void
  onClear: () => void
  count: number
}

function Filtros({
  regioes, localidades, tipos,
  regiao, localidade, tipo, search,
  onRegiao, onLocalidade, onTipo, onSearch, onClear,
  count,
}: FiltrosProps) {
  const hasFilter = !!(regiao || localidade || tipo || search)
  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        <input
          type="text"
          placeholder="Pesquisar hospital…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-40"
        />
        <select
          value={tipo}
          onChange={e => onTipo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{tipoLabel(t)}</option>)}
        </select>
        {hasFilter && (
          <button
            onClick={onClear}
            className="text-xs text-slate-400 hover:text-slate-700 underline px-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Cascading region → locality */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1">Região</label>
          <div className="relative">
            <select
              value={regiao}
              onChange={e => { onRegiao(e.target.value); onLocalidade('') }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white appearance-none pr-8"
            >
              <option value="">Todas as regiões</option>
              {regioes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Localidade {!regiao && <span className="text-slate-300">(selecione região primeiro)</span>}
          </label>
          <div className="relative">
            <select
              value={localidade}
              onChange={e => onLocalidade(e.target.value)}
              disabled={!regiao}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white appearance-none pr-8 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="">Todas as localidades</option>
              {localidades.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">{count} serviço{count !== 1 ? 's' : ''} encontrado{count !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Secção 1: Lista de urgências ──────────────────────────────────────────

function ListaUrgencias() {
  const { data: hospitals = [], isLoading, isError } = useHospitaisValencias()
  const [regiao, setRegiao] = useState('')
  const [localidade, setLocalidade] = useState('')
  const [tipo, setTipo] = useState('')
  const [search, setSearch] = useState('')

  const regioes = useMemo(
    () => [...new Set(hospitals.map(h => h.regiao))].sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals],
  )
  const localidades = useMemo(
    () => [...new Set(
      hospitals.filter(h => !regiao || h.regiao === regiao).map(h => h.localidade),
    )].sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals, regiao],
  )
  const tipos = useMemo(
    () => [...new Set(hospitals.map(h => h.tipo_de_urgencia))].sort(),
    [hospitals],
  )

  const filtered = useMemo(() =>
    hospitals.filter(h =>
      (!regiao     || h.regiao     === regiao) &&
      (!localidade || h.localidade === localidade) &&
      (!tipo       || h.tipo_de_urgencia === tipo) &&
      (!search     || h.nome.toLowerCase().includes(search.toLowerCase()) ||
                      h.localidade.toLowerCase().includes(search.toLowerCase())),
    ), [hospitals, regiao, localidade, tipo, search])

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar hospitais SNS." />

  return (
    <Card>
      <CardTitle>Urgências SNS</CardTitle>
      <Filtros
        regioes={regioes} localidades={localidades} tipos={tipos}
        regiao={regiao} localidade={localidade} tipo={tipo} search={search}
        onRegiao={setRegiao} onLocalidade={setLocalidade}
        onTipo={setTipo} onSearch={setSearch}
        onClear={() => { setRegiao(''); setLocalidade(''); setTipo(''); setSearch('') }}
        count={filtered.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
        {filtered.map(h => (
          <div key={h.nome} className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-slate-900 text-sm leading-snug">{h.nome}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${TIPO_COLOR[h.tipo_de_urgencia] ?? 'bg-slate-100 text-slate-700'}`}>
                {tipoLabel(h.tipo_de_urgencia)}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
              <MapPin size={11} />
              {h.endereco}, {h.localidade} {h.codigo_postal}
            </p>

            <div className="flex flex-wrap gap-1 mb-2">
              {h.valencias.map(v => (
                <span key={v.nome} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {v.nome}
                </span>
              ))}
              {h.saude24 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Saúde 24
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              {h.telefone && (
                <a href={`tel:${h.telefone}`} className="flex items-center gap-1 hover:text-blue-600">
                  <Phone size={11} /> {h.telefone}
                </a>
              )}
              {h.email && (
                <a href={`mailto:${h.email}`} className="flex items-center gap-1 hover:text-blue-600 max-w-[180px] truncate">
                  <Mail size={11} /> {h.email}
                </a>
              )}
              {h.lat !== 0 && (
                <a
                  href={`https://www.google.com/maps?q=${h.lat},${h.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
                >
                  <MapPin size={11} /> Mapa
                </a>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-2 text-slate-400 text-sm text-center py-8">Nenhum resultado encontrado.</p>
        )}
      </div>
    </Card>
  )
}

// ── Secção 2: Ranking mensal ──────────────────────────────────────────────

function RankingMensal() {
  const { data: all = [], isLoading, isError } = useHospitaisAtendimentos()

  const { latestLabel, ranking } = useMemo(() => {
    if (!all.length) return { latestLabel: '', ranking: [] }
    const latest = all[all.length - 1].tempo
    const latestData = all.filter(d => d.tempo === latest)
    const label = formatPeriodo(latest)
    const sorted = [...latestData].sort((a, b) => (b.total_urgencias ?? 0) - (a.total_urgencias ?? 0))
    return { latestLabel: label, ranking: sorted.slice(0, 15) }
  }, [all])

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar dados de afluência." />

  const chartData = ranking.map(d => ({
    name: d.instituicao
      .replace(/Unidade Local de Saúde d[aeo] /g, 'ULS ')
      .replace(/, ?E\.P\.E\.?$/, ''),
    total: d.total_urgencias,
    geral: d.urgencias_geral,
    pediatrica: d.urgencias_pediatricas ?? 0,
  }))

  return (
    <Card>
      <CardTitle>Ranking de afluência — {latestLabel}</CardTitle>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => formatNum(v)} />
          <Legend />
          <Bar dataKey="total"     name="Total"      fill="#f97316" radius={[0, 4, 4, 0]} />
          <Bar dataKey="geral"     name="Geral"      fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="pediatrica"name="Pediátrica" fill="#22c55e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 divide-y divide-slate-100">
        {ranking.map((d, i) => (
          <div key={d.instituicao} className="flex items-center gap-3 py-2.5">
            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white flex-shrink-0 ${i === 0 ? 'bg-orange-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-300'}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{d.instituicao}</p>
              <p className="text-xs text-slate-400">{d.regiao}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-slate-900">{formatNum(d.total_urgencias)}</p>
              <p className="text-xs text-slate-400">total</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Secção 3: Evolução por região ─────────────────────────────────────────

function EvolucaoPorRegiao() {
  const { data: all = [], isLoading, isError } = useHospitaisAtendimentos()

  const { regioes, chartData } = useMemo(() => {
    if (!all.length) return { regioes: [] as string[], chartData: [] as Record<string, unknown>[] }

    const periodos = [...new Set(all.map(d => d.tempo))].sort()
    const regioesList = [...new Set(all.map(d => d.regiao))].sort()

    const byPeriodo = periodos.map(tempo => {
      const row: Record<string, unknown> = { label: formatPeriodo(tempo) }
      for (const r of regioesList) {
        const total = all
          .filter(d => d.tempo === tempo && d.regiao === r)
          .reduce((s, d) => s + (d.total_urgencias ?? 0), 0)
        if (total > 0) row[r] = total
      }
      return row
    })

    return { regioes: regioesList, chartData: byPeriodo }
  }, [all])

  if (isLoading) return <LoadingBox />
  if (isError)   return <ErrorBox message="Erro ao carregar evolução regional." />

  return (
    <Card>
      <CardTitle>Evolução mensal de urgências por região (últimos 12 meses)</CardTitle>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => formatNum(v)} />
          <Legend />
          {regioes.map(r => (
            <Line
              key={r}
              type="monotone"
              dataKey={r}
              name={r.replace('Região de Saúde ', '').replace('d', '').trim()}
              stroke={REGIAO_COLORS[r] ?? '#94a3b8'}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {chartData.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {regioes.map(r => {
            const val = chartData[chartData.length - 1][r] as number | undefined
            return val ? (
              <div key={r} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: REGIAO_COLORS[r] ?? '#94a3b8' }} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 truncate">{r.replace('Região de Saúde ', '')}</p>
                  <p className="text-sm font-bold text-slate-900">{formatNum(val)}</p>
                </div>
              </div>
            ) : null
          })}
        </div>
      )}
    </Card>
  )
}

// ── Página principal ──────────────────────────────────────────────────────

const SECTIONS = ['Urgências SNS', 'Ranking Mensal', 'Evolução Regional'] as const
type Section = typeof SECTIONS[number]

export function Hospitais() {
  const [active, setActive] = useState<Section>('Urgências SNS')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏥 Hospitais SNS</h1>
          <p className="text-slate-500 text-sm mt-1">Transparência SNS · Ministério da Saúde</p>
        </div>
        <a
          href="https://transparencia.sns.gov.pt"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Activity size={13} /> transparencia.sns.gov.pt
        </a>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {SECTIONS.map(s => (
          <button
            key={s}
            onClick={() => setActive(s)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              active === s
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {active === 'Urgências SNS'     && <ListaUrgencias />}
      {active === 'Ranking Mensal'    && <RankingMensal />}
      {active === 'Evolução Regional' && <EvolucaoPorRegiao />}
    </div>
  )
}
