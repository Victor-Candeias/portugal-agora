import { BDP_RATE_LABELS, formatBdpPeriod, formatRate, INE_INDICATORS, type BdpRate } from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useBdpLendingRates, useBdpRates, useIneLatest } from '@/hooks/useEconomia'

// Taxas BdP/BCE e indicadores INE/Eurostat via API Aberta (WEB-028), como a tab Economia do mobile (MOB-008).
export function Economia() {
  const rates = useBdpRates()
  const lending = useBdpLendingRates()
  const ine = useIneLatest()

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
            <ul className="divide-y divide-slate-100">
              {ine.data.data.map(ind => {
                const meta = INE_INDICATORS[ind.indicator]
                return (
                  <li key={ind.indicator} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{meta?.label ?? ind.label}</p>
                      <p className="text-xs text-slate-500">{ind.year}</p>
                    </div>
                    <p className="text-base font-bold text-slate-700 tabular-nums">
                      {meta ? meta.format(ind.value) : ind.value.toLocaleString('pt-PT')}
                    </p>
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