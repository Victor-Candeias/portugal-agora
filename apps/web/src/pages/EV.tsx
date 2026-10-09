import { useEffect, useState } from 'react'
import { formatPrice, type EvTariff } from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useCheapestEvTariffs, useEvTariffs } from '@/hooks/useEv'

// Tarifas CEME e simulador de custo via API Aberta (WEB-029), como a tab EV do mobile (MOB-008).
const KWH_PRESETS = [10, 20, 30, 50]
const MAX_KWH = 200

type TariffFilter = 'all' | 'fixed' | 'indexed'
const FILTERS: { value: TariffFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'fixed', label: 'Fixas' },
  { value: 'indexed', label: 'Indexadas (OMIE)' },
]

const PERIOD_LABELS: Record<string, string> = {
  vazio: 'Bi-horária',
  fora_vazio: 'fora de vazio',
  simples: 'Simples',
}

const formatEur = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)

export function EV() {
  const [kwhInput, setKwhInput] = useState('30')
  const [kwh, setKwh] = useState(30)
  const [filter, setFilter] = useState<TariffFilter>('all')

  // Espera que o utilizador pare de escrever antes de pedir o custo à API.
  useEffect(() => {
    const value = Number(kwhInput)
    if (!Number.isFinite(value) || value <= 0 || value > MAX_KWH) return
    const timer = setTimeout(() => setKwh(value), 400)
    return () => clearTimeout(timer)
  }, [kwhInput])

  const tariffs = useEvTariffs()
  const cheapest = useCheapestEvTariffs(kwh)

  const refreshing = tariffs.isFetching || cheapest.isFetching

  function refresh() {
    void tariffs.refetch()
    void cheapest.refetch()
  }

  function selectPreset(value: number) {
    setKwhInput(String(value))
    setKwh(value)
  }

  const inputValue = Number(kwhInput)
  const inputInvalid = kwhInput !== '' && (!Number.isFinite(inputValue) || inputValue <= 0 || inputValue > MAX_KWH)

  const period = cheapest.data?.meta.current_period
  const all = tariffs.data?.data ?? []
  const fixed = filter !== 'indexed' ? all.filter(t => t.tariff_type === 'fixed') : []
  const indexed = filter !== 'fixed' ? all.filter(t => t.tariff_type === 'indexed') : []

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">⚡ Carregamento EV</h1>
          <p className="text-slate-500 text-sm mt-1">Tarifas dos comercializadores (CEME) · ERSE/OMIE</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-sm bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60"
        >
          {refreshing ? 'A atualizar…' : 'Atualizar'}
        </button>
      </div>

      <Card>
        <CardTitle>Simulador de carregamento</CardTitle>
        <p className="text-sm text-slate-500 mb-3">
          Custo de energia por CEME{period ? `, tarifa atual (${PERIOD_LABELS[period] ?? period})` : ''}.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {KWH_PRESETS.map(v => (
              <button
                key={v}
                onClick={() => selectPreset(v)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  kwh === v && kwhInput === String(v)
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {v} kWh
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Outro:
            <input
              type="number"
              min={1}
              max={MAX_KWH}
              step={1}
              value={kwhInput}
              onChange={e => setKwhInput(e.target.value)}
              className={`w-24 border rounded-lg px-3 py-1.5 text-sm bg-white tabular-nums ${
                inputInvalid ? 'border-red-300' : 'border-slate-200'
              }`}
              aria-label="Energia a carregar (kWh)"
            />
            kWh
          </label>
        </div>
        {inputInvalid && <p className="text-xs text-red-600 mt-2">Indique um valor entre 1 e {MAX_KWH} kWh.</p>}

        <div className="mt-4">
          {cheapest.isLoading && <LoadingBox />}
          {cheapest.isError && <ErrorBox message={(cheapest.error as Error).message} />}
          {cheapest.data && cheapest.data.data.length === 0 && (
            <p className="text-sm text-slate-500">Sem tarifas disponíveis.</p>
          )}
          {cheapest.data && cheapest.data.data.length > 0 && (
            <ol className="divide-y divide-slate-100">
              {cheapest.data.data.map((c, i) => (
                <li key={c.ceme} className="flex items-center gap-3 py-3">
                  <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.ceme}</p>
                    <p className="text-xs text-slate-500">
                      {formatPrice(c.price_per_kwh_eur)}/kWh
                      {c.activation_fee_eur > 0 ? ` + ativação ${formatEur(c.activation_fee_eur)}` : ''}
                    </p>
                  </div>
                  <p className={`text-base font-bold tabular-nums ${i === 0 ? 'text-green-600' : 'text-slate-900'}`}>
                    {formatEur(c.total_cost_eur)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          {cheapest.data && (
            <p className="text-xs text-slate-400 mt-2">
              Custo de {cheapest.data.meta.kwh_requested} kWh. As tarifas indexadas ao OMIE não entram na simulação.
            </p>
          )}
        </div>
      </Card>

      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
        Valores sem a tarifa do operador do posto (OPC) nem a tarifa de acesso às redes (EGME). Fonte: tarifários dos CEME (ERSE) e preço OMIE, via API Aberta.
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Tarifas dos CEME</h2>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-amber-500 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {tariffs.isLoading && <LoadingBox />}
        {tariffs.isError && <ErrorBox message={(tariffs.error as Error).message} />}
        {tariffs.data && fixed.length === 0 && indexed.length === 0 && (
          <p className="text-sm text-slate-500">Sem tarifas disponíveis.</p>
        )}

        {fixed.length > 0 && (
          <TariffGroup title="Tarifas fixas" tariffs={fixed} />
        )}
        {indexed.length > 0 && (
          <TariffGroup
            title="Tarifas indexadas (OMIE)"
            tariffs={indexed}
            omiePrice={tariffs.data?.meta.current_omie_price_kwh}
          />
        )}
      </section>
    </div>
  )
}

function TariffGroup({ title, tariffs, omiePrice }: { title: string; tariffs: EvTariff[]; omiePrice?: number | null }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        {title}
        {omiePrice != null && <span className="normal-case font-normal"> · OMIE agora {formatPrice(omiePrice)}/kWh</span>}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tariffs.map(t => <TariffCard key={t.ceme} tariff={t} />)}
      </div>
    </div>
  )
}

function TariffCard({ tariff: t }: { tariff: EvTariff }) {
  const biHoraria = t.price_vazio_eur_kwh !== undefined && t.price_vazio_eur_kwh !== t.price_normal_eur_kwh
  const badge = t.period_type
    ? PERIOD_LABELS[t.period_type] ?? t.period_type
    : t.tariff_type === 'indexed' ? 'Indexada' : null

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {t.source_url
            ? <a href={t.source_url} target="_blank" rel="noreferrer" className="hover:underline">{t.ceme}</a>
            : t.ceme}
        </p>
        {badge && (
          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{badge}</span>
        )}
      </div>
      {t.notes && <p className="text-xs text-slate-500 mt-1">{t.notes}</p>}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3">
        {t.current_price_eur_kwh != null && (
          <Price label="Agora" value={`${formatPrice(t.current_price_eur_kwh)}/kWh`} highlight />
        )}
        {t.current_omie_eur_kwh != null && (
          <Price label="OMIE agora" value={`${formatPrice(t.current_omie_eur_kwh)}/kWh`} />
        )}
        {biHoraria && (
          <>
            <Price label="Vazio" value={formatPrice(t.price_vazio_eur_kwh!)} />
            {t.price_normal_eur_kwh !== undefined && <Price label="Fora vazio" value={formatPrice(t.price_normal_eur_kwh)} />}
          </>
        )}
        {t.activation_fee_eur > 0 && <Price label="Ativação" value={formatEur(t.activation_fee_eur)} />}
      </div>
      {t.note && <p className="text-xs text-slate-400 mt-2">{t.note}</p>}
    </Card>
  )
}

function Price({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${highlight ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
