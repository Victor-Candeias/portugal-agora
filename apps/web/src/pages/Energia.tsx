import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ENERGY_CLASSIFICATION_COLORS,
  ENERGY_CLASSIFICATION_LABELS,
  ENERGY_CONSUMPTION_COLOR,
  energyMix,
  energyQualityInfo,
  formatEnergy,
  formatEnergyDate,
  formatLisbonDateTime,
  formatSharePct,
  renewableToConsumptionPct,
  type EnergyDaily,
  type EnergyDay,
  type EnergyInterval,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useEnergy } from '@/hooks/useEnergy'

// Painel diário de energia elétrica (WEB-056): balanço diário oficial da REN publicado pelo pipeline
// (WEB-053). São dados do último dia disponível — nunca «agora» nem «tempo real».
export function Energia() {
  const energy = useEnergy()
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
            Portugal continental · balanço diário oficial da REN · últimos dados disponíveis (não é tempo real)
          </p>
        </div>
        <button
          onClick={() => void energy.refetch()}
          disabled={energy.isFetching}
          className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shrink-0"
        >
          {energy.isFetching ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

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
