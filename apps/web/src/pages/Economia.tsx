import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  BDP_RATE_LABELS, formatBdpPeriod, formatIneValue, formatRate, INE_INDICATORS, ineRangeOptions, ineRangeStart,
  summarizeIneSeries, type BdpRate, type IneRange,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useBdpLendingRates, useBdpRates, useIneIndicators, useIneLatest, useIneSeries } from '@/hooks/useEconomia'

const INE_COLOR = '#6366f1'

// Taxas BdP/BCE e indicadores INE/Eurostat via API Aberta (WEB-028), como a tab Economia do mobile (MOB-008).
// Cada indicador abre o gráfico da série histórica com seletor de intervalo de anos (WEB-030).
export function Economia() {
  const rates = useBdpRates()
  const lending = useBdpLendingRates()
  const ine = useIneLatest()
  const indicators = useIneIndicators()
  const [selected, setSelected] = useState<string | null>(null)

  const refreshing = rates.isFetching || lending.isFetching || ine.isFetching

  function refresh() {
    void rates.refetch()
    void lending.refetch()
    void ine.refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📊 Economia</h1>
          <p className="text-slate-500 text-sm mt-1">Banco de Portugal · BCE · INE/Eurostat</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
        >
          {refreshing ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Taxas de referência</h2>
        {rates.isLoading && <LoadingBox />}
        {rates.isError && <ErrorBox message={(rates.error as Error).message} />}
        {rates.data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {rates.data.data.map(r => <RateCard key={r.key} rate={r} />)}
          </div>
        )}
        {rates.data && <p className="text-xs text-slate-400 mt-2">Fonte: {rates.data.source}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Crédito e depósitos (novas operações)</h2>
        {lending.isLoading && <LoadingBox />}
        {lending.isError && <ErrorBox message={(lending.error as Error).message} />}
        {lending.data && (
          <Card>
            <ul className="divide-y divide-slate-100">
              {lending.data.data.map(r => (
                <li key={r.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{BDP_RATE_LABELS[r.key] ?? r.label_pt}</p>
                    <p className="text-xs text-slate-500">{formatBdpPeriod(r)}</p>
                  </div>
                  <p className="text-base font-bold text-slate-700 tabular-nums">{formatRate(r.value)}</p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mt-3">Fonte: {lending.data.source}</p>
          </Card>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Indicadores de Portugal</h2>
        {ine.isLoading && <LoadingBox />}
        {ine.isError && <ErrorBox message={(ine.error as Error).message} />}
        {ine.data && ine.data.data.length === 0 && <p className="text-sm text-slate-500">Dados não disponíveis.</p>}
        {ine.data && ine.data.data.length > 0 && (
          <Card>
            <CardTitle>{ine.data.source}</CardTitle>
            <p className="text-xs text-slate-500 -mt-2 mb-2">Clique num indicador para ver a série histórica.</p>
            <ul className="divide-y divide-slate-100">
              {ine.data.data.map(ind => {
                const meta = INE_INDICATORS[ind.indicator]
                const open = selected === ind.indicator
                return (
                  <li key={ind.indicator}>
                    <button
                      onClick={() => setSelected(open ? null : ind.indicator)}
                      aria-expanded={open}
                      className={`w-full flex items-center justify-between gap-3 py-3 px-2 -mx-2 rounded-lg text-left transition-colors ${
                        open ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{meta?.label ?? ind.label}</p>
                        <p className="text-xs text-slate-500">{ind.year}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-base font-bold text-slate-700 tabular-nums">
                          {formatIneValue(ind.indicator, ind.value)}
                        </p>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    {open && (
                      <IneSeriesPanel
                        key={ind.indicator}
                        indicator={ind.indicator}
                        indicators={indicators}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

type RangeChoice = IneRange | 'custom'

function IneSeriesPanel({ indicator, indicators }: {
  indicator: string
  indicators: ReturnType<typeof useIneIndicators>
}) {
  const settled = indicators.isSuccess || indicators.isError
  const info = indicators.data?.data.find(i => i.indicator === indicator)
  const series = useIneSeries(settled ? indicator : null, info?.years.from)
  const [range, setRange] = useState<RangeChoice>('20')
  const [custom, setCustom] = useState<{ from: number; to: number } | null>(null)

  if (!settled || series.isLoading) return <LoadingBox />
  if (series.isError) return <div className="pb-3"><ErrorBox message={(series.error as Error).message} /></div>
  const points = series.data?.data ?? []
  if (points.length === 0) return <p className="text-sm text-slate-500 pb-3">Sem série histórica para este indicador.</p>

  const years = { from: points[0].year, to: points[points.length - 1].year, count: points.length }
  const options = ineRangeOptions(years)
  const preset: IneRange = options.some(o => o.value === range) ? range as IneRange : 'all'
  const from = range === 'custom' && custom ? custom.from : ineRangeStart(preset, years)
  const to = range === 'custom' && custom ? custom.to : years.to
  const visible = points.filter(p => p.year >= from && p.year <= to)
  const summary = summarizeIneSeries(visible)
  const allYears = points.map(p => p.year)

  function setYears(next: { from: number; to: number }) {
    setCustom({ from: Math.min(next.from, next.to), to: Math.max(next.from, next.to) })
    setRange('custom')
  }

  return (
    <div className="pb-4 pt-1">
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex flex-wrap gap-2">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => setRange(o.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                range === o.value || (range !== 'custom' && preset === o.value)
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          De
          <select
            value={from}
            onChange={e => setYears({ from: Number(e.target.value), to })}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          Até
          <select
            value={to}
            onChange={e => setYears({ from, to: Number(e.target.value) })}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
          >
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={visible} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`ine-${indicator}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={INE_COLOR} stopOpacity={0.3} />
              <stop offset="95%" stopColor={INE_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="year" tick={{ fontSize: 11 }} minTickGap={16} />
          <YAxis
            tick={{ fontSize: 11 }}
            width={72}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => formatIneValue(indicator, v, 'short')}
          />
          <Tooltip
            formatter={(v) => [formatIneValue(indicator, Number(v)), INE_INDICATORS[indicator]?.label ?? indicator]}
            labelFormatter={(y) => `Ano ${y}`}
          />
          {summary && summary.min.value < 0 && <ReferenceLine y={0} stroke="#94a3b8" />}
          <Area type="monotone" dataKey="value" stroke={INE_COLOR} fill={`url(#ine-${indicator})`} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>

      {summary && (
        <p className="text-xs text-slate-500 mt-2">
          {from}–{to} · mínimo {formatIneValue(indicator, summary.min.value)} ({summary.min.year}) · máximo{' '}
          {formatIneValue(indicator, summary.max.value)} ({summary.max.year})
        </p>
      )}
      {series.data && (
        <p className="text-xs text-slate-400 mt-1">Fonte: {series.data.source} ({series.data.source_dataset})</p>
      )}
    </div>
  )
}

function RateCard({ rate }: { rate: BdpRate }) {
  return (
    <Card>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate">
        {BDP_RATE_LABELS[rate.key] ?? rate.label_pt}
      </p>
      <p className="text-2xl font-bold text-indigo-600 my-1 tabular-nums">{formatRate(rate.value)}</p>
      <p className="text-xs text-slate-400 line-clamp-2">{rate.label_pt}</p>
      <p className="text-xs text-slate-500 mt-1">{formatBdpPeriod(rate)}</p>
    </Card>
  )
}