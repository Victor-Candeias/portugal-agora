import { useEffect, useState } from 'react'
import {
  EV_BATTERY_PRESETS_KWH,
  MAX_EV_BATTERY_KWH,
  estimateEvCharge,
  formatPrice,
  parseDecimal,
  type EvChargeSettings,
} from '@portugal-hoje/core'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useCheapestEvTariffs } from '@/hooks/useEv'

// Custo de carregar a bateria de X% a Y% num posto, por CEME (WEB-043).
const TOP_N = 5

const PERIOD_LABELS: Record<string, string> = {
  vazio: 'vazio',
  fora_vazio: 'fora de vazio',
  simples: 'simples',
}

const formatEur = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)

const formatNumber = (value: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)

interface Props {
  settings: EvChargeSettings
  onChange: (patch: Partial<EvChargeSettings>) => void
}

export function EvChargeCost({ settings, onChange }: Props) {
  const estimate = estimateEvCharge(settings)
  const [kwh, setKwh] = useState(estimate.ok ? estimate.energyKwh : 0)
  const [showAll, setShowAll] = useState(false)

  // Espera que o utilizador pare de escrever antes de pedir o custo à API.
  const energy = estimate.ok ? estimate.energyKwh : null
  useEffect(() => {
    if (energy === null) return
    const timer = setTimeout(() => setKwh(energy), 400)
    return () => clearTimeout(timer)
  }, [energy])

  const cheapest = useCheapestEvTariffs(kwh)
  const costs = cheapest.data?.data ?? []
  const shown = showAll ? costs : costs.slice(0, TOP_N)
  const period = cheapest.data?.meta.current_period
  const battery = parseDecimal(settings.batteryKwh)

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2">Custo do carregamento</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {EV_BATTERY_PRESETS_KWH.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ batteryKwh: String(v) })}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              battery === v ? 'bg-amber-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {v} kWh
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <NumberField
          label="Bateria"
          unit="kWh"
          value={settings.batteryKwh}
          max={MAX_EV_BATTERY_KWH}
          onChange={v => onChange({ batteryKwh: v })}
        />
        <NumberField label="De" unit="%" value={settings.fromPct} max={100} onChange={v => onChange({ fromPct: v })} />
        <NumberField label="Até" unit="%" value={settings.toPct} max={100} onChange={v => onChange({ toPct: v })} />
      </div>

      {'error' in estimate && <p className="text-xs text-red-600 mt-2">{estimate.error}</p>}
      {estimate.ok && (
        <p className="text-xs text-slate-500 mt-2">
          A carregar <strong className="text-slate-800">{formatNumber(estimate.energyKwh)} kWh</strong> ({formatNumber(estimate.fromPct)}% → {formatNumber(estimate.toPct)}% de {formatNumber(estimate.batteryKwh)} kWh)
        </p>
      )}

      <div className="mt-2">
        {cheapest.isLoading && <LoadingBox />}
        {cheapest.isError && <ErrorBox message={(cheapest.error as Error).message} />}
        {cheapest.data && costs.length === 0 && <p className="text-xs text-slate-500">Sem tarifas disponíveis.</p>}
        {shown.length > 0 && (
          <ol className="divide-y divide-amber-100">
            {shown.map((c, i) => (
              <li key={c.ceme} className="flex items-center gap-2 py-1.5">
                <span className="w-4 text-center text-xs font-bold text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{c.ceme}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatPrice(c.price_per_kwh_eur)}/kWh
                    {c.activation_fee_eur > 0 ? ` + ativação ${formatEur(c.activation_fee_eur)}` : ''}
                  </p>
                </div>
                <p className={`text-sm font-bold tabular-nums ${i === 0 ? 'text-green-600' : 'text-slate-900'}`}>
                  {formatEur(c.total_cost_eur)}
                </p>
              </li>
            ))}
          </ol>
        )}
        {costs.length > TOP_N && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="text-xs font-medium text-amber-700 hover:text-amber-800 mt-1"
          >
            {showAll ? 'Ver menos' : `Ver todos os CEME (${costs.length})`}
          </button>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-2">
        Energia ao preço de cada CEME{period ? ` (período ${PERIOD_LABELS[period] ?? period})` : ''}. Não inclui a tarifa do
        operador do posto (OPC), a tarifa de acesso às redes (EGME) nem as perdas no carregamento.
      </p>
    </div>
  )
}

function NumberField({
  label,
  unit,
  value,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: string
  max: number
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      {label}
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-16 border border-slate-200 rounded-md px-2 py-1 text-xs bg-white tabular-nums"
        aria-label={`${label} (${unit})`}
      />
      {unit}
    </label>
  )
}
