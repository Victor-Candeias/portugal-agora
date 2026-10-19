import { useState } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ENERGY_CLASSIFICATION_COLORS,
  ENERGY_CLASSIFICATION_LABELS,
  ENERGY_CONSUMPTION_COLOR,
  ENERGY_NOW_QUESTION,
  ENERGY_VERDICT_STYLES,
  energyHourlySlots,
  energyMix,
  energyNowInfo,
  energyQualityInfo,
  formatEnergy,
  formatEnergyDate,
  formatLisbonDateTime,
  formatSharePct,
  renewableToConsumptionPct,
  type EnergyDaily,
  type EnergyDay,
  type EnergyInterval,
  type EnergyTimeseries,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useEnergy, useEnergyIntraday } from '@/hooks/useEnergy'

// Painel de energia elétrica: indicador «agora» e gráfico de 24 h com a série horária ENTSO-E (WEB-058)
// e balanço diário oficial da REN (WEB-056). O diário é sempre «último dia disponível», nunca «agora».
export function Energia() {
  const energy = useEnergy()
  const intraday = useEnergyIntraday('24h')
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
          <IntradayCard series={intraday.data.data} />
        </>
      ) : (
        intraday.isError && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 text-slate-600 px-4 py-3 text-sm">
            ⏱️ A série horária (ENTSO-E) não está disponível de momento: não é possível dizer o que acontece «agora».
            Mostram-se só os últimos dados disponíveis do balanço diário da REN.
          </div>
        )
      )}

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

function IntradayCard({ series }: { series: EnergyTimeseries }) {
  const slots = energyHourlySlots(series.points)
  // Horas incompletas (faltam tecnologias) não entram nas linhas de produção: seriam valores por defeito.
  const data = slots.map(s => {
    const complete = s.point?.quality === 'complete'
    return {
      label: s.label,
      time: s.time,
      renewable: complete ? s.point!.renewable : null,
      nonRenewable: complete ? s.point!.nonRenewable : null,
      storage: complete ? s.point!.storage : null,
      consumption: s.point?.consumption ?? null,
    }
  })
  const missing = slots.filter(s => !s.point).length
  const incomplete = slots.filter(s => s.point && s.point.quality !== 'complete').length
  if (data.length === 0) return null
  return (
    <Card>
      <CardTitle>Últimas 24 horas · produção horária</CardTitle>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={16} />
          <YAxis tick={{ fontSize: 11 }} width={52} />
          <Tooltip
            formatter={(v, name) => [v === null || v === undefined ? 'sem dados' : formatEnergy(Number(v), 'MW', 0), name]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined
              return p ? `${p.label} (Lisboa)` : ''
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            type="monotone"
            dataKey="renewable"
            name={ENERGY_CLASSIFICATION_LABELS.renewable}
            stroke={ENERGY_CLASSIFICATION_COLORS.renewable}
            fill={ENERGY_CLASSIFICATION_COLORS.renewable}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="nonRenewable"
            name={ENERGY_CLASSIFICATION_LABELS.non_renewable}
            stroke={ENERGY_CLASSIFICATION_COLORS.non_renewable}
            fill={ENERGY_CLASSIFICATION_COLORS.non_renewable}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Line type="monotone" dataKey="storage" name={ENERGY_CLASSIFICATION_LABELS.storage} stroke={ENERGY_CLASSIFICATION_COLORS.storage} strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="consumption" name="Consumo" stroke={ENERGY_CONSUMPTION_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 mt-2">
        MW, média de cada hora (hora de Lisboa). Séries separadas, não empilhadas; o armazenamento (bombagem e baterias) não é
        renovável nem não renovável. A diferença para o consumo é coberta pelo saldo de trocas com Espanha.
        {missing + incomplete > 0 && ` ${missing + incomplete} hora(s) sem dados ou incompletas ficam em branco.`}
        {' '}Fonte: {series.sourceName}.
      </p>
    </Card>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-500 w-28 shrink-0">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}
