import { useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ENERGY_CLASSIFICATION_COLORS,
  ENERGY_CLASSIFICATION_LABELS,
  ENERGY_CONSUMPTION_COLOR,
  ENERGY_NOT_INCLUDED_NOTE,
  ENERGY_NOW_QUESTION,
  ENERGY_RANGE_INFO,
  ENERGY_RANGE_LABELS,
  ENERGY_VERDICT_STYLES,
  energyCsv,
  energyCsvFileName,
  energyHourlySlots,
  energyMix,
  energyNowInfo,
  energyRangeSummary,
  energyQualityInfo,
  energyStatusInfo,
  formatEnergy,
  formatEnergyDate,
  formatLisbonDateTime,
  formatSharePct,
  renewableToConsumptionPct,
  type EnergyDaily,
  type EnergyDatasetMeta,
  type EnergyDay,
  type EnergyInterval,
  type EnergyRange,
  type EnergyStatus,
  type EnergyTimeseries,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useEnergy, useEnergyIntraday, useEnergyStatus } from '@/hooks/useEnergy'

// Painel de energia elétrica: indicador «agora» com a série horária ENTSO-E (WEB-058), análise 24h/7d/30d
// com CSV (WEB-059), balanço diário oficial da REN (WEB-056) e estado das fontes/reconciliação (WEB-060). O diário é sempre «último dia disponível», nunca «agora».
export function Energia() {
  const energy = useEnergy()
  const intraday = useEnergyIntraday('24h')
  const status = useEnergyStatus()
  const result = energy.data
  const daily = result?.data
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const day = daily ? daily.days.find(d => d.date === selectedDate) ?? daily.days[daily.days.length - 1] : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🔌 Energia elétrica</h1>
          <p className="text-slate-500 text-sm mt-1">
            Portugal continental · produção horária ENTSO-E (quase tempo real, ~1 h de atraso) · balanço diário oficial da REN
          </p>
        </div>
        <button
          onClick={() => {
            void energy.refetch()
            void intraday.refetch()
            void status.refetch()
          }}
          disabled={energy.isFetching || intraday.isFetching}
          className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shrink-0"
        >
          {energy.isFetching || intraday.isFetching ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      {intraday.data ? (
        <>
          <NowCard series={intraday.data.data} offline={intraday.data.offline} savedAt={intraday.data.savedAt} />
        </>
      ) : (
        intraday.isError && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 text-slate-600 px-4 py-3 text-sm">
            ⏱️ A série horária (ENTSO-E) não está disponível de momento: não é possível dizer o que acontece «agora».
            Mostram-se só os últimos dados disponíveis do balanço diário da REN.
          </div>
        )
      )}

      {(intraday.data || daily) && <AnalysisCard series24={intraday.data?.data} daily={daily} />}

      {energy.isLoading && <LoadingBox />}
      {energy.isError && <ErrorBox message={(energy.error as Error).message} />}

      {result && daily && day && (
        <>
          <StatusNotices daily={daily} offline={result.offline} savedAt={result.savedAt} />
          <EnergyCards day={day} isLatest={day === daily.days[daily.days.length - 1]} source={daily.source} />
          <MixCard day={day} />
          <HistoryCard daily={daily} selectedDate={day.date} onSelect={setSelectedDate} />
          <QualityCard daily={daily} />
        </>
      )}

      {status.data && <SourcesCard status={status.data} />}
    </div>
  )
}

function NowCard({ series, offline, savedAt }: { series: EnergyTimeseries; offline: boolean; savedAt: number }) {
  const info = energyNowInfo(series)
  const style = ENERGY_VERDICT_STYLES[info.verdict]
  const p = info.interval
  return (
    <Card>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{info.label}</p>
      <p className="text-sm text-slate-700 mt-1">{ENERGY_NOW_QUESTION}</p>
      <div className="flex flex-wrap items-center gap-4 mt-3">
        <span
          className="text-3xl font-extrabold px-4 py-2 rounded-xl"
          style={{ color: style.color, backgroundColor: style.background }}
          aria-live="polite"
        >
          {info.verdict}
        </span>
        <p className="text-sm text-slate-600 flex-1 min-w-48">{style.description}</p>
      </div>
      {p && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Renovável</p>
            <p className="font-bold tabular-nums" style={{ color: ENERGY_CLASSIFICATION_COLORS.renewable }}>{formatEnergy(p.renewable, p.unit, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Não renovável</p>
            <p className="font-bold tabular-nums" style={{ color: ENERGY_CLASSIFICATION_COLORS.non_renewable }}>{formatEnergy(p.nonRenewable, p.unit, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Armazenamento (bombagem e baterias)</p>
            <p className="font-bold tabular-nums" style={{ color: ENERGY_CLASSIFICATION_COLORS.storage }}>{formatEnergy(p.storage, p.unit, 0)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Quota renovável da produção</p>
            <p className="font-bold tabular-nums text-green-700">{formatSharePct(p.renewableSharePct)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Consumo</p>
            <p className="font-bold tabular-nums text-slate-900">{formatEnergy(p.consumption, p.unit, 0)}</p>
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">
        Observação: {info.observed} (hora de Lisboa, média horária{p && p.quality !== 'complete' ? `, incompleta ${formatSharePct(p.coveragePct)}` : ''}) ·
        Atualizado às {info.updatedAt} · Atraso {info.delay} · Fonte:{' '}
        <a href={info.sourceUrl} target="_blank" rel="noreferrer" className="text-green-700 underline">{info.source}</a>
      </p>
      {offline && (
        <p className="text-xs text-amber-700 mt-1">📴 Sem ligação: dados guardados neste dispositivo em {formatLisbonDateTime(new Date(savedAt).toISOString())}.</p>
      )}
    </Card>
  )
}

type AnalysisDataset = EnergyDatasetMeta & { points: EnergyInterval[] }

function AnalysisCard({ series24, daily }: { series24: EnergyTimeseries | undefined; daily: EnergyDaily | undefined }) {
  const [chosen, setChosen] = useState<EnergyRange | null>(null)
  const range: EnergyRange = chosen ?? (series24 ? '24h' : '30d')
  const series7d = useEnergyIntraday('7d', range === '7d')
  const dataset: AnalysisDataset | null =
    range === '24h' ? series24 ?? null : range === '7d' ? series7d.data?.data ?? null : daily ? { ...daily, points: daily.days } : null
  const available: Record<EnergyRange, boolean> = { '24h': !!series24, '7d': !!series24, '30d': !!daily }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <CardTitle>Análise · {ENERGY_RANGE_LABELS[range]}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="tablist" aria-label="Intervalo">
            {(Object.keys(ENERGY_RANGE_LABELS) as EnergyRange[]).map(r => (
              <button
                key={r}
                role="tab"
                aria-selected={r === range}
                disabled={!available[r]}
                onClick={() => setChosen(r)}
                className={`text-sm px-3 py-1 disabled:opacity-40 ${r === range ? 'bg-green-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {ENERGY_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <button
            onClick={() => dataset && downloadCsv(dataset, range)}
            disabled={!dataset}
            className="text-sm border border-slate-300 text-slate-700 px-3 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-40"
          >
            ⬇️ CSV
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        {ENERGY_RANGE_INFO[range].source} · {ENERGY_RANGE_INFO[range].detail}
      </p>
      {range === '7d' && series7d.isLoading && <p className="text-sm text-slate-500">A carregar 7 dias…</p>}
      {range === '7d' && series7d.isError && <p className="text-sm text-red-700">Série de 7 dias indisponível: {(series7d.error as Error).message}</p>}
      {dataset && <AnalysisBody dataset={dataset} range={range} />}
    </Card>
  )
}

function downloadCsv(dataset: AnalysisDataset, range: EnergyRange) {
  // BOM para o Excel reconhecer UTF-8.
  const blob = new Blob(['\uFEFF', energyCsv(dataset.points, dataset)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = energyCsvFileName(dataset.source, range)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function AnalysisBody({ dataset, range }: { dataset: AnalysisDataset; range: EnergyRange }) {
  const hourly = range !== '30d'
  const unit = dataset.points[0]?.unit ?? 'MW'
  const slots = hourly
    ? energyHourlySlots(dataset.points).map(s => ({ tick: range === '24h' ? s.time : s.label.slice(0, 5), label: `${s.label} (Lisboa)`, point: s.point }))
    : dataset.points.map(p => ({ tick: formatEnergyDate((p as EnergyDay).date).slice(0, 5), label: formatEnergyDate((p as EnergyDay).date), point: p }))
  // Intervalos incompletos (faltam tecnologias) ficam em branco: seriam valores por defeito.
  const data = slots.map(({ tick, label, point }) => {
    const ok = point?.quality === 'complete'
    return {
      tick,
      label,
      renewable: ok ? point.renewable : null,
      nonRenewable: ok ? point.nonRenewable : null,
      storage: ok ? point.storage : null,
      production: ok ? point.production : null,
      consumption: point?.consumption ?? null,
      net: point && point.imports !== null && point.exports !== null ? point.imports - point.exports : null,
    }
  })
  const summary = energyRangeSummary(dataset.points)
  const gaps = slots.filter(s => s.point?.quality !== 'complete').length
  const per = hourly ? 'horas' : 'dias'
  const [completeWord, gapWord] = hourly ? ['completas', 'sem dados ou incompletas ficam'] : ['completos', 'sem dados ou incompletos ficam']
  const tooltip = (
    <Tooltip
      formatter={(v, name) => [v === null || v === undefined ? 'sem dados' : formatEnergy(Number(v), unit, hourly ? 0 : 1), name]}
      labelFormatter={(_, payload) => (payload?.[0]?.payload as (typeof data)[number] | undefined)?.label ?? ''}
    />
  )
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <Summary label="Renovável" value={formatEnergy(summary.renewableGWh, 'GWh')} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Summary label="Não renovável" value={formatEnergy(summary.nonRenewableGWh, 'GWh')} color={ENERGY_CLASSIFICATION_COLORS.non_renewable} />
        <Summary label="Quota renovável (ponderada)" value={formatSharePct(summary.renewableSharePct)} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Summary label={`${per[0].toUpperCase()}${per.slice(1)} com mais renovável`} value={`${summary.renewableAbove} de ${summary.complete}`} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Summary label="Produção" value={formatEnergy(summary.productionGWh, 'GWh')} color="#334155" />
        <Summary label="Consumo" value={formatEnergy(summary.consumptionGWh, 'GWh')} color={ENERGY_CONSUMPTION_COLOR} />
        <Summary
          label={summary.netImportsGWh !== null && summary.netImportsGWh < 0 ? 'Saldo exportador' : 'Saldo importador'}
          value={formatEnergy(summary.netImportsGWh === null ? null : Math.abs(summary.netImportsGWh), 'GWh')}
          color="#0369a1"
        />
        <Summary label="Importação / exportação" value={`${formatEnergy(summary.importsGWh, 'GWh', 0)} / ${formatEnergy(summary.exportsGWh, 'GWh', 0)}`} color="#0369a1" />
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mb-1">Produção por classificação ({unit})</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="tick" tick={{ fontSize: 11 }} minTickGap={16} />
          <YAxis tick={{ fontSize: 11 }} width={52} />
          {tooltip}
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="renewable" name={ENERGY_CLASSIFICATION_LABELS.renewable} stroke={ENERGY_CLASSIFICATION_COLORS.renewable} fill={ENERGY_CLASSIFICATION_COLORS.renewable} fillOpacity={0.15} strokeWidth={2} />
          <Area type="monotone" dataKey="nonRenewable" name={ENERGY_CLASSIFICATION_LABELS.non_renewable} stroke={ENERGY_CLASSIFICATION_COLORS.non_renewable} fill={ENERGY_CLASSIFICATION_COLORS.non_renewable} fillOpacity={0.15} strokeWidth={2} />
          <Line type="monotone" dataKey="storage" name={ENERGY_CLASSIFICATION_LABELS.storage} stroke={ENERGY_CLASSIFICATION_COLORS.storage} strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-1">Consumo vs produção e saldo de trocas ({unit})</h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="tick" tick={{ fontSize: 11 }} minTickGap={16} />
          <YAxis tick={{ fontSize: 11 }} width={52} />
          {tooltip}
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="net" name="Saldo de trocas (+ importador, − exportador)" fill="#0369a1" fillOpacity={0.6} />
          <Line type="monotone" dataKey="production" name="Produção nacional" stroke="#334155" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="consumption" name="Consumo" stroke={ENERGY_CONSUMPTION_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="text-xs text-slate-500 mt-2">
        Totais em GWh só com {per} {completeWord} ({summary.complete} de {slots.length}
        {gaps > 0 ? `; ${gaps} ${gapWord} em branco` : ''}
        {summary.balanceMissing > 0 ? `; ${summary.balanceMissing} sem consumo ou trocas fora desses totais` : ''}). Consumo e produção não
        coincidem: a diferença é o saldo de trocas com Espanha (e perdas/consumo da bombagem). O armazenamento não é renovável nem não
        renovável. Fonte: {dataset.sourceName}.
      </p>
      <p className="text-xs text-slate-400 mt-1">{ENERGY_NOT_INCLUDED_NOTE}</p>
    </>
  )
}

function Summary({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-bold tabular-nums" style={{ color }}>{value}</p>
    </div>
  )
}
function StatusNotices({ daily, offline, savedAt }: { daily: EnergyDaily; offline: boolean; savedAt: number }) {
  const quality = energyQualityInfo(daily)
  return (
    <>
      {offline && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          📴 Sem ligação: a mostrar os dados guardados neste dispositivo em {formatLisbonDateTime(new Date(savedAt).toISOString())}.
        </div>
      )}
      {quality?.stale && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          ⏳ Dados desatualizados: o último dia disponível é {quality.latestDate} (terminou há {quality.delay}).
        </div>
      )}
    </>
  )
}

function StatCard({ title, value, detail, color, footer }: {
  title: string
  value: string
  detail?: string
  color: string
  footer: string
}) {
  return (
    <Card>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold my-1 tabular-nums" style={{ color }}>{value}</p>
      {detail && <p className="text-xs text-slate-600">{detail}</p>}
      <p className="text-xs text-slate-400 mt-1">{footer}</p>
    </Card>
  )
}

function EnergyCards({ day, isLatest, source }: { day: EnergyDay; isLatest: boolean; source: string }) {
  const footer = `${formatEnergyDate(day.date)}${isLatest ? ' (último dia disponível)' : ''} · ${source}`
  const toConsumption = renewableToConsumptionPct(day)
  const net = day.imports !== null && day.exports !== null ? day.imports - day.exports : null
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Produção e consumo do dia</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          title="Produção renovável"
          value={formatEnergy(day.renewable, day.unit)}
          color={ENERGY_CLASSIFICATION_COLORS.renewable}
          footer={footer}
        />
        <StatCard
          title="Produção não renovável"
          value={formatEnergy(day.nonRenewable, day.unit)}
          detail={day.storage ? `+ ${formatEnergy(day.storage, day.unit)} de armazenamento (bombagem e baterias)` : undefined}
          color={ENERGY_CLASSIFICATION_COLORS.non_renewable}
          footer={footer}
        />
        <StatCard
          title="Quota renovável da produção"
          value={formatSharePct(day.renewableSharePct)}
          detail={
            day.renewableExceedsNonRenewable === null
              ? 'Dados incompletos: sem comparação'
              : day.renewableExceedsNonRenewable
                ? 'Renovável acima da não renovável neste dia'
                : 'Renovável abaixo da não renovável neste dia'
          }
          color={ENERGY_CLASSIFICATION_COLORS.renewable}
          footer={`Da produção nacional (${formatEnergy(day.production, day.unit)}) · ${footer}`}
        />
        <StatCard
          title="Consumo"
          value={formatEnergy(day.consumption, day.unit)}
          detail={
            toConsumption !== null
              ? `Produção renovável = ${formatSharePct(toConsumption)} do consumo (não é a quota renovável do abastecimento: há importação de origem mista)`
              : undefined
          }
          color={ENERGY_CONSUMPTION_COLOR}
          footer={footer}
        />
        {(day.imports !== null || day.exports !== null) && (
          <StatCard
            title="Importação / exportação"
            value={`${formatEnergy(day.imports, day.unit)} / ${formatEnergy(day.exports, day.unit)}`}
            detail={net !== null ? `Saldo ${net >= 0 ? 'importador' : 'exportador'}: ${formatEnergy(Math.abs(net), day.unit)}` : undefined}
            color="#0369a1"
            footer={footer}
          />
        )}
      </div>
    </section>
  )
}

function MixCard({ day }: { day: EnergyDay }) {
  const mix = energyMix(day)
  const positive = mix.filter(m => m.value > 0)
  const positiveTotal = positive.reduce((s, m) => s + m.value, 0)
  return (
    <Card>
      <CardTitle>Mix de produção · {formatEnergyDate(day.date)}</CardTitle>
      {positiveTotal > 0 && (
        <div className="flex h-8 w-full overflow-hidden rounded-lg" role="img" aria-label="Mix de produção por tecnologia">
          {positive.map(m => (
            <div
              key={m.technology}
              style={{ width: `${(100 * m.value) / positiveTotal}%`, backgroundColor: m.color }}
              title={`${m.label}: ${formatEnergy(m.value, day.unit)}`}
            />
          ))}
        </div>
      )}
      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {mix.map(m => (
          <li key={m.technology} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: m.color }} />
            <span className="flex-1 text-slate-700">
              {m.label} <span className="text-xs text-slate-400">({ENERGY_CLASSIFICATION_LABELS[m.classification].toLowerCase()})</span>
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">{formatEnergy(m.value, day.unit)}</span>
            <span className="w-14 text-right text-xs text-slate-500 tabular-nums">{formatSharePct(m.sharePct)}</span>
          </li>
        ))}
      </ul>
      {mix.some(m => m.value < 0) && (
        <p className="text-xs text-slate-500 mt-3">
          Valores negativos: a REN publica a hídrica sem a turbinagem de bombagem (contada em armazenamento), por isso pode ficar abaixo de zero.
        </p>
      )}
    </Card>
  )
}

function HistoryCard({ daily, selectedDate, onSelect }: {
  daily: EnergyDaily
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const unit = daily.total.unit
  const data = daily.days.map(d => ({
    date: d.date,
    label: formatEnergyDate(d.date).slice(0, 5),
    renewable: d.renewable,
    nonRenewable: d.nonRenewable,
    storage: d.storage,
    consumption: d.consumption,
    share: d.renewableSharePct,
  }))
  return (
    <Card>
      <CardTitle>Últimos {daily.days.length} dias</CardTitle>
      <TotalSummary total={daily.total} days={daily.days.length} />
      <p className="text-xs text-slate-500 mb-2">Clique num dia para ver os valores e o mix desse dia.</p>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          onClick={state => {
            const index = Number(state?.activeTooltipIndex)
            if (Number.isInteger(index) && data[index]) onSelect(data[index].date)
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip
            formatter={(v, name) => [name === 'Quota renovável' ? formatSharePct(Number(v)) : formatEnergy(Number(v), unit), name]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined
              return p ? `${formatEnergyDate(p.date)} · quota renovável ${formatSharePct(p.share)}` : ''
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="renewable" name={ENERGY_CLASSIFICATION_LABELS.renewable} stackId="p" fill={ENERGY_CLASSIFICATION_COLORS.renewable} cursor="pointer" />
          <Bar dataKey="nonRenewable" name={ENERGY_CLASSIFICATION_LABELS.non_renewable} stackId="p" fill={ENERGY_CLASSIFICATION_COLORS.non_renewable} cursor="pointer" />
          <Bar dataKey="storage" name={ENERGY_CLASSIFICATION_LABELS.storage} stackId="p" fill={ENERGY_CLASSIFICATION_COLORS.storage} cursor="pointer" />
          <Line type="monotone" dataKey="consumption" name="Consumo" stroke={ENERGY_CONSUMPTION_COLOR} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-2">
        {unit} por dia. Dia selecionado: <span className="font-semibold">{formatEnergyDate(selectedDate)}</span>.
      </p>
    </Card>
  )
}

function TotalSummary({ total, days }: { total: EnergyInterval; days: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
      <div>
        <p className="text-xs text-slate-500">Renovável ({days} dias)</p>
        <p className="font-bold text-green-700 tabular-nums">{formatEnergy(total.renewable, total.unit, 0)}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Não renovável</p>
        <p className="font-bold text-slate-600 tabular-nums">{formatEnergy(total.nonRenewable, total.unit, 0)}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Quota renovável (ponderada)</p>
        <p className="font-bold text-green-700 tabular-nums">{formatSharePct(total.renewableSharePct)}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Consumo</p>
        <p className="font-bold text-slate-900 tabular-nums">{formatEnergy(total.consumption, total.unit, 0)}</p>
      </div>
    </div>
  )
}

function QualityCard({ daily }: { daily: EnergyDaily }) {
  const q = energyQualityInfo(daily)
  if (!q) return null
  const gaps = [...q.missingDates.map(d => `${formatEnergyDate(d)} (sem dados)`), ...q.incompleteDates.map(d => `${formatEnergyDate(d)} (incompleto)`)]
  return (
    <Card>
      <CardTitle>Qualidade dos dados</CardTitle>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Row label="Estado" value={`${q.label}${q.stale ? ' · desatualizados' : ''}`} />
        <Row label="Período" value={q.period} />
        <Row label="Recolhido em" value={`${q.fetchedAt} (hora de Lisboa)`} />
        <Row label="Atraso" value={`${q.delay} desde o fim do último dia`} />
        <Row label="Lacunas" value={gaps.length ? gaps.join(', ') : 'Nenhuma'} />
        <Row label="Resolução" value="Diária (dia civil de Lisboa), valores em GWh inteiros" />
      </dl>
      <p className="text-xs text-slate-500 mt-3">
        Fonte:{' '}
        <a href={q.sourceUrl} target="_blank" rel="noreferrer" className="text-green-700 underline">{q.source}</a>.
        A REN publica cada dia no dia seguinte. A quota renovável é da produção nacional (inclui exportação; exclui importação).
      </p>
    </Card>
  )
}

function SourcesCard({ status }: { status: EnergyStatus }) {
  const info = energyStatusInfo(status)
  return (
    <Card>
      <CardTitle>Estado das fontes</CardTitle>
      {info.problems && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-sm mb-3">
          ⚠️ A última recolha não atualizou todas as fontes: os dados abaixo podem estar atrasados.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {info.sources.map(s => (
          <div key={s.source} className="rounded-lg border border-slate-200 p-3 text-sm space-y-1">
            <p className="font-semibold text-slate-800">
              {s.ok ? '🟢' : s.status === 'failed' ? '🔴' : '🟠'} {s.name}
            </p>
            <p className={s.ok ? 'text-slate-600' : 'text-amber-800'}>
              {s.statusLabel}
              {s.status === 'fresh' && s.stale ? ' · dados fora do prazo' : ''}
            </p>
            <dl className="space-y-1">
              <Row label="Recolhido em" value={s.fetchedAt} />
              <Row label="Último período" value={`${s.latestEnd} (há ${s.delay})`} />
              <Row label="Períodos" value={s.completeness} />
              {s.error && <Row label="Erro" value={s.error} />}
            </dl>
          </div>
        ))}
      </div>
      {info.reconciliation.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">
            Reconciliação diária REN → ENTSO-E{' '}
            <span className="font-normal text-slate-500">
              (tolerância {info.tolerance}; {info.divergentDays ? `${info.divergentDays} dia(s) com divergência` : 'sem divergências'})
            </span>
          </p>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-1 pr-3 font-medium">Dia</th>
                  <th className="py-1 pr-3 font-medium">Produção</th>
                  <th className="py-1 pr-3 font-medium">Não renovável</th>
                  <th className="py-1 pr-3 font-medium">Consumo</th>
                  <th className="py-1 pr-3 font-medium">Renovável*</th>
                  <th className="py-1 font-medium" aria-label="Resultado" />
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {info.reconciliation.map(r => (
                  <tr key={r.date} className={`border-t border-slate-100${r.ok ? '' : ' bg-amber-50'}`}>
                    <td className="py-1 pr-3 whitespace-nowrap">{r.date}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{r.production}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{r.nonRenewable}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{r.consumption}</td>
                    <td className="py-1 pr-3 whitespace-nowrap text-slate-500">{r.renewable}</td>
                    <td className="py-1">{r.ok ? '✔' : '⚠'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">* {info.note}</p>
        </div>
      )}
      <p className="text-xs text-slate-500 mt-3">Verificado em {info.checkedAt} (hora de Lisboa), na última execução da recolha.</p>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500 w-28 shrink-0">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}
