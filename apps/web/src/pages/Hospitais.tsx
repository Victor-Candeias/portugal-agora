import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { MapPin, Phone, Mail, Activity } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useHospitaisValencias, useHospitaisAtendimentos } from '@/hooks/useHospitais'

const TIPO_COLOR: Record<string, string> = {
  'Serviço de Urgência Básica':                          'bg-blue-100 text-blue-800',
  'Serviço de Urgência Médico-cirúrgico':                'bg-purple-100 text-purple-800',
  'Serviço de Urgência Polivalente':                     'bg-orange-100 text-orange-800',
  'Serviço de Urgência Polivalente com Centro de Trauma':'bg-red-100 text-red-800',
}

const REGIAO_COLORS: Record<string, string> = {
  // Nomes usados no dataset de atendimentos
  'Região de Saúde do Norte':   '#3b82f6',
  'Região de Saúde do Centro':  '#22c55e',
  'Região de Saúde LVT':        '#f97316',
  'Região de Saúde do Alentejo':'#eab308',
  'Região de Saúde do Algarve': '#a855f7',
  // Nomes usados no dataset de valências
  'ARS Norte':                  '#3b82f6',
  'ARS Centro':                 '#22c55e',
  'ARS Lisboa e Vale do Tejo':  '#f97316',
  'ARS Alentejo':               '#eab308',
  'ARS Algarve':                '#a855f7',
  'IASAÚDE Madeira':            '#ec4899',
  'SRS Açores':                 '#06b6d4',
}

function formatPeriodo(tempo: string) {
  const d = new Date(tempo)
  return d.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' })
}

function formatNum(n: number) {
  return n.toLocaleString('pt-PT')
}

// ── Section 1: Lista de urgências ──────────────────────────────────────────

function ListaUrgencias() {
  const { data: hospitals = [], isLoading, isError } = useHospitaisValencias()
  const [regiao, setRegiao] = useState('')
  const [tipo, setTipo] = useState('')
  const [search, setSearch] = useState('')

  const regioes = useMemo(() => [...new Set(hospitals.map(h => h.regiao))].sort(), [hospitals])
  const tipos = useMemo(() => [...new Set(hospitals.map(h => h.tipo_de_urgencia))].sort(), [hospitals])

  const filtered = useMemo(() =>
    hospitals.filter(h =>
      (!regiao || h.regiao === regiao) &&
      (!tipo || h.tipo_de_urgencia === tipo) &&
      (!search || h.nome.toLowerCase().includes(search.toLowerCase()) ||
        h.localidade.toLowerCase().includes(search.toLowerCase()))
    ), [hospitals, regiao, tipo, search])

  if (isLoading) return <LoadingBox />
  if (isError) return <ErrorBox message="Erro ao carregar hospitais SNS." />

  return (
    <Card>
      <CardTitle>Urgências SNS — {filtered.length} serviços</CardTitle>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Pesquisar hospital ou localidade…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-48"
        />
        <select
          value={regiao}
          onChange={e => setRegiao(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">Todas as regiões</option>
          {regioes.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">Todos os tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {(regiao || tipo || search) && (
          <button
            onClick={() => { setRegiao(''); setTipo(''); setSearch('') }}
            className="text-xs text-slate-500 hover:text-slate-700 underline px-1"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Hospital grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
        {filtered.map(h => (
          <div key={h.nome} className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold text-slate-900 text-sm leading-snug">{h.nome}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${TIPO_COLOR[h.tipo_de_urgencia] ?? 'bg-slate-100 text-slate-700'}`}>
                {h.tipo_de_urgencia.replace('Serviço de Urgência ', '').replace(' com Centro de Trauma', ' +Trauma')}
              </span>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
              <MapPin size={11} />
              {h.endereco}, {h.localidade} {h.codigo_postal}
            </p>

            {/* Valências */}
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

            {/* Contacts + map */}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {h.telefone && (
                <a href={`tel:${h.telefone}`} className="flex items-center gap-1 hover:text-blue-600">
                  <Phone size={11} /> {h.telefone}
                </a>
              )}
              {h.email && (
                <a href={`mailto:${h.email}`} className="flex items-center gap-1 hover:text-blue-600 truncate">
                  <Mail size={11} /> {h.email}
                </a>
              )}
              <a
                href={`https://www.google.com/maps?q=${h.lat},${h.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
              >
                <MapPin size={11} /> Mapa
              </a>
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

// ── Section 2: Ranking mensal ──────────────────────────────────────────────

function RankingMensal() {
  const { data: all = [], isLoading, isError } = useHospitaisAtendimentos()

  const { latestLabel, ranking } = useMemo(() => {
    if (!all.length) return { latestLabel: '', ranking: [] }
    const latest = all[all.length - 1].tempo
    const latestData = all.filter(d => d.tempo === latest)
    const label = new Date(latest).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
    const sorted = [...latestData].sort((a, b) => (b.total_urgencias ?? 0) - (a.total_urgencias ?? 0))
    return { latestLabel: label, ranking: sorted.slice(0, 15) }
  }, [all])

  if (isLoading) return <LoadingBox />
  if (isError) return <ErrorBox message="Erro ao carregar dados de afluência." />

  const chartData = ranking.map(d => ({
    name: d.instituicao.replace(/Unidade Local de Saúde d[aeo] /g, 'ULS ').replace(/, E\.P\.E\.$/, ''),
    total: d.total_urgencias,
    geral: d.urgencias_geral,
    pediatrica: d.urgencias_pediatricas ?? 0,
  }))

  return (
    <Card>
      <CardTitle>Ranking de afluência — {latestLabel}</CardTitle>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={v => (v / 1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v: number) => formatNum(v)} />
          <Legend />
          <Bar dataKey="total" name="Total" fill="#f97316" radius={[0, 4, 4, 0]} />
          <Bar dataKey="geral" name="Geral" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          <Bar dataKey="pediatrica" name="Pediátrica" fill="#22c55e" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <div className="mt-4 divide-y divide-slate-100">
        {ranking.map((d, i) => (
          <div key={d.instituicao} className="flex items-center gap-3 py-2.5">
            <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center text-white flex-shrink-0 ${i === 0 ? 'bg-orange-500' : i < 3 ? 'bg-orange-400' : 'bg-slate-400'}`}>
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

// ── Section 3: Evolução por região ────────────────────────────────────────

function EvolucaoPorRegiao() {
  const { data: all = [], isLoading, isError } = useHospitaisAtendimentos()

  const { regioes, chartData } = useMemo(() => {
    if (!all.length) return { regioes: [], chartData: [] }

    const periodos = [...new Set(all.map(d => d.tempo))].sort()
    const regioesList = [...new Set(all.map(d => d.regiao))].sort()

    const byPeriodo = periodos.map(tempo => {
      const row: Record<string, unknown> = { label: formatPeriodo(tempo) }
      for (const r of regioesList) {
        const total = all
          .filter(d => d.tempo === tempo && d.regiao === r)
          .reduce((s, d) => s + (d.total_urgencias ?? 0), 0)
        row[r] = total || null
      }
      return row
    })

    return { regioes: regioesList, chartData: byPeriodo }
  }, [all])

  if (isLoading) return <LoadingBox />
  if (isError) return <ErrorBox message="Erro ao carregar evolução regional." />

  return (
    <Card>
      <CardTitle>Evolução mensal de urgências por região</CardTitle>
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
              name={r.replace('Região de Saúde d', '').replace('Região de Saúde LVT', 'LVT')}
              stroke={REGIAO_COLORS[r] ?? '#94a3b8'}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Totals table for latest month */}
      {chartData.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {regioes.map(r => {
            const latest = chartData[chartData.length - 1]
            const val = latest[r] as number | null
            return val ? (
              <div key={r} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: REGIAO_COLORS[r] ?? '#94a3b8' }} />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 truncate">{r.replace('Região de Saúde d', '').replace('Região de Saúde LVT', 'LVT')}</p>
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

// ── Main page ──────────────────────────────────────────────────────────────

const SECTIONS = ['Urgências SNS', 'Ranking Mensal', 'Evolução Regional'] as const
type Section = typeof SECTIONS[number]

export function Hospitais() {
  const [active, setActive] = useState<Section>('Urgências SNS')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏥 Hospitais SNS</h1>
          <p className="text-slate-500 text-sm mt-1">Transparência SNS · Dados oficiais do Ministério da Saúde</p>
        </div>
        <a
          href="https://transparencia.sns.gov.pt"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Activity size={13} /> transparencia.sns.gov.pt
        </a>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 border-b border-slate-200 pb-0">
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

      {active === 'Urgências SNS'    && <ListaUrgencias />}
      {active === 'Ranking Mensal'   && <RankingMensal />}
      {active === 'Evolução Regional'&& <EvolucaoPorRegiao />}
    </div>
  )
}
