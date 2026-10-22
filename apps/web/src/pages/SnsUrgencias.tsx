import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  SNS24_PHONE,
  SNS24_PHONE_LABEL,
  SNS_EMERGENCY_PHONE,
  SNS_URGENCIAS_EMERGENCY_NOTICE,
  SNS_URGENCIAS_NOT_REAL_TIME,
  SNS_URGENCIAS_RANGES,
  SNS_URGENCIAS_WAIT_TIME_WARNING,
  compareSnsIndicators,
  compareSnsRegions,
  formatLisbonDateTime,
  formatSnsDate,
  formatSnsValue,
  snsDataState,
  snsIndicatorInfo,
  snsLatestObservation,
  snsRangeBounds,
  snsSeriesWithGaps,
  snsUnitLabel,
  type SnsEmergencyObservation,
  type SnsUrgenciasMetadata,
  type SnsUrgenciasRange,
  type SnsUrgenciasStatus,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox } from '@/components/Feedback'
import { useSnsUrgenciasMetadata, useSnsUrgenciasObservations, useSnsUrgenciasStatus } from '@/hooks/useSnsUrgencias'

const DEFAULT_REGION = 'Portugal Continental'

// Indicadores agregados de urgência hospitalar do SNS (WEB-067): dados estatísticos diários por região,
// publicados com atraso — nunca a espera atual num hospital.
export function SnsUrgencias() {
  const observations = useSnsUrgenciasObservations()
  const metadata = useSnsUrgenciasMetadata()
  const status = useSnsUrgenciasStatus()
  const refetch = () => {
    void observations.refetch()
    void metadata.refetch()
    void status.refetch()
  }
  const loading = observations.isLoading || metadata.isLoading
  const failed = !loading && (!observations.data || !metadata.data)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏥 Urgências do SNS</h1>
          <p className="text-slate-500 text-sm mt-1">
            Indicadores diários de urgência hospitalar por região · Portal da Transparência do SNS
          </p>
        </div>
        <button
          onClick={refetch}
          disabled={observations.isFetching || metadata.isFetching}
          className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 shrink-0"
        >
          {observations.isFetching || metadata.isFetching ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      <EmergencyNotice />

      {loading && <LoadingBox />}
      {failed && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm space-y-2">
          <p>
            ⚠️ Os indicadores de urgência do SNS não estão disponíveis de momento. A fonte pode estar indisponível ou os dados
            ainda não foram publicados.
          </p>
          <button
            onClick={refetch}
            className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {observations.data && metadata.data && (
        <Dashboard observations={observations.data} metadata={metadata.data} status={status.data ?? null} />
      )}
    </div>
  )
}

function EmergencyNotice() {
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 text-sm space-y-1">
      <p className="font-semibold">ℹ️ {SNS_URGENCIAS_NOT_REAL_TIME}</p>
      <p>
        {SNS_URGENCIAS_EMERGENCY_NOTICE}{' '}
        <span className="whitespace-nowrap">
          <a href={`tel:${SNS_EMERGENCY_PHONE}`} className="font-semibold underline">
            Ligar 112
          </a>
          {' · '}
          <a href={`tel:${SNS24_PHONE}`} className="font-semibold underline">
            Ligar SNS 24 ({SNS24_PHONE_LABEL})
          </a>
        </span>
      </p>
    </div>
  )
}

interface DashboardProps {
  observations: SnsEmergencyObservation[]
  metadata: SnsUrgenciasMetadata
  status: SnsUrgenciasStatus | null
}

function Dashboard({ observations, metadata, status }: DashboardProps) {
  const regions = [...metadata.regions].sort(compareSnsRegions)
  const indicators = [...metadata.indicators].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador))
  const [region, setRegion] = useState(regions.includes(DEFAULT_REGION) ? DEFAULT_REGION : regions[0] ?? '')
  const [indicador, setIndicador] = useState(indicators[0]?.indicador ?? '')
  const [range, setRange] = useState<SnsUrgenciasRange>(30)
  const state = snsDataState({ latestPeriod: metadata.latestPeriod, status })

  return (
    <>
      <DataStateBanner metadata={metadata} status={status} delayed={state.delayed} delayDays={state.delayDays} possiblyStale={state.possiblyStale} />

      <Card>
        <label className="block text-sm text-slate-600">
          Região
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="mt-1 block w-full sm:w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            {regions.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {indicators.map(i => {
          const info = snsIndicatorInfo(i.indicador)
          const latest = snsLatestObservation(observations, { indicador: i.indicador, ars: region })
          return (
            <Card key={i.indicador} className={info.notRealTime ? 'border-amber-300' : ''}>
              <CardTitle>{info.shortLabel}</CardTitle>
              <p className="text-3xl font-bold text-slate-900">{formatSnsValue(latest?.valor, i.unidade, i.indicador)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {latest ? `Dia ${formatSnsDate(latest.periodo)} · ${region}` : `Sem dados publicados para ${region}`}
              </p>
              {info.notRealTime && (
                <p className="mt-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-xs font-medium">
                  ⏱️ {SNS_URGENCIAS_WAIT_TIME_WARNING}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      <SeriesCard
        observations={observations}
        metadata={metadata}
        region={region}
        indicador={indicador}
        onIndicador={setIndicador}
        range={range}
        onRange={setRange}
      />

      <MethodologyCard metadata={metadata} />
    </>
  )
}

function DataStateBanner({
  metadata,
  status,
  delayed,
  delayDays,
  possiblyStale,
}: {
  metadata: SnsUrgenciasMetadata
  status: SnsUrgenciasStatus | null
  delayed: boolean
  delayDays: number | null
  possiblyStale: boolean
}) {
  const lastSync = status?.lastSuccessfulSyncAt ?? metadata.fetchedAtUtc
  return (
    <div className="space-y-2">
      <dl className="grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="inline">Última observação: </dt>
          <dd className="inline font-semibold text-slate-900">{formatSnsDate(metadata.latestPeriod)}</dd>
          {delayDays !== null && <dd className="inline text-slate-500"> (há {delayDays} {delayDays === 1 ? 'dia' : 'dias'})</dd>}
        </div>
        <div>
          <dt className="inline">Última sincronização: </dt>
          <dd className="inline font-semibold text-slate-900">{formatLisbonDateTime(lastSync)}</dd>
        </div>
      </dl>
      {delayed && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 text-sm">
          🕒 A última observação publicada pelo SNS tem {delayDays} dias, mais do que o habitual (cerca de 2 dias). A fonte pode
          estar atrasada.
        </div>
      )}
      {possiblyStale && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 text-sm">
          ⚠️ Possivelmente desatualizado: a última recolha {status?.status === 'fresh' ? 'é antiga' : 'falhou'} e mostram-se os
          últimos dados obtidos com sucesso.
        </div>
      )}
    </div>
  )
}

function SeriesCard({
  observations,
  metadata,
  region,
  indicador,
  onIndicador,
  range,
  onRange,
}: {
  observations: SnsEmergencyObservation[]
  metadata: SnsUrgenciasMetadata
  region: string
  indicador: string
  onIndicador: (indicador: string) => void
  range: SnsUrgenciasRange
  onRange: (range: SnsUrgenciasRange) => void
}) {
  const indicators = [...metadata.indicators].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador))
  const meta = indicators.find(i => i.indicador === indicador)
  const info = snsIndicatorInfo(indicador)
  const unidade = meta?.unidade ?? ''
  const bounds = snsRangeBounds(metadata.toDate, range, metadata.fromDate)
  const available = meta?.regions.includes(region) ?? false
  const points = available ? snsSeriesWithGaps(observations, { indicador, ars: region, ...bounds }) : []
  const gaps = points.filter(p => p.missing).length
  const chartData = points.map(p => ({ periodo: p.periodo, label: formatSnsDate(p.periodo).slice(0, 5), valor: p.valor }))

  return (
    <Card>
      <CardTitle>Evolução diária</CardTitle>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-sm text-slate-600">
          Indicador
          <select
            value={indicador}
            onChange={e => onIndicador(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
          >
            {indicators.map(i => (
              <option key={i.indicador} value={i.indicador}>
                {snsIndicatorInfo(i.indicador).shortLabel}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Intervalo" className="flex rounded-lg border border-slate-300 overflow-hidden">
          {SNS_URGENCIAS_RANGES.map(r => (
            <button
              key={r}
              onClick={() => onRange(r)}
              aria-pressed={range === r}
              className={`px-3 py-2 text-sm ${range === r ? 'bg-green-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {r} dias
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-slate-700 font-medium">
        {indicador} — {region}
      </p>
      <p className="text-xs text-slate-500 mb-3">
        {formatSnsDate(bounds.fromDate)} a {formatSnsDate(bounds.toDate)} · unidade: {unidade ? snsUnitLabel(unidade) : '—'}
        {gaps > 0 && ` · ${gaps} ${gaps === 1 ? 'dia' : 'dias'} sem dados`}
      </p>
      {info.notRealTime && (
        <p className="mb-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-xs font-medium">
          ⏱️ {SNS_URGENCIAS_WAIT_TIME_WARNING}
        </p>
      )}

      {available ? (
        <>
          <div className="h-72" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                <YAxis tick={{ fontSize: 11 }} width={56} domain={['auto', 'auto']} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const periodo = payload?.[0]?.payload?.periodo as string | undefined
                    return periodo ? formatSnsDate(periodo) : ''
                  }}
                  formatter={value => [formatSnsValue(typeof value === 'number' ? value : null, unidade, indicador), info.shortLabel]}
                />
                <Line type="monotone" dataKey="valor" stroke="#16a34a" strokeWidth={2} dot={range === 7} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-green-700 hover:underline">Ver os valores em tabela</summary>
            <div className="mt-2 max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <caption className="text-left text-xs text-slate-500 pb-2">
                  {indicador} — {region}, de {formatSnsDate(bounds.fromDate)} a {formatSnsDate(bounds.toDate)}
                </caption>
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th scope="col" className="py-1 pr-4 font-medium">Dia</th>
                    <th scope="col" className="py-1 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map(p => (
                    <tr key={p.periodo} className="border-b border-slate-100">
                      <th scope="row" className="py-1 pr-4 font-normal text-slate-700">{formatSnsDate(p.periodo)}</th>
                      <td className={`py-1 ${p.missing ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                        {formatSnsValue(p.valor, unidade, indicador)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="rounded-lg bg-slate-50 border border-slate-200 text-slate-600 px-4 py-6 text-sm text-center">
          Sem dados: o SNS não publica este indicador para {region}.
        </p>
      )}
    </Card>
  )
}

function MethodologyCard({ metadata }: { metadata: SnsUrgenciasMetadata }) {
  const indicators = [...metadata.indicators].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador))
  return (
    <Card>
      <CardTitle>Nota metodológica e fonte</CardTitle>
      <dl className="space-y-3 text-sm">
        {indicators.map(i => {
          const info = snsIndicatorInfo(i.indicador)
          return (
            <div key={i.indicador}>
              <dt className="font-medium text-slate-800">
                {i.indicador} <span className="font-normal text-slate-500">({snsUnitLabel(i.unidade)})</span>
              </dt>
              {info.description && <dd className="text-slate-600">{info.description}</dd>}
            </div>
          )
        })}
      </dl>
      <div className="mt-4 space-y-2 text-sm text-slate-600">
        <p>{metadata.attribution}</p>
        <p>
          <a href={metadata.datasetUrl} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">
            Ver o dataset no Portal da Transparência
          </a>
          {' · '}
          <a href={metadata.portalUrl} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">
            Portal da Transparência do SNS
          </a>
        </p>
        <p>
          <span className="font-medium text-slate-700">Reutilização:</span>{' '}
          <a href={metadata.license.url} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline">
            {metadata.license.name}
          </a>
        </p>
        {metadata.license.conditions.length > 0 && (
          <ul className="list-disc pl-5">
            {metadata.license.conditions.map(c => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        <p>
          <span className="font-medium text-slate-700">Transformações:</span> {metadata.transformations}
        </p>
        <p className="text-xs text-slate-500">
          {metadata.sourceLastModified && <>Dataset atualizado pela fonte em {formatLisbonDateTime(metadata.sourceLastModified)} · </>}
          dados de {formatSnsDate(metadata.fromDate)} a {formatSnsDate(metadata.toDate)} · {metadata.observations} observações
        </p>
      </div>
    </Card>
  )
}
