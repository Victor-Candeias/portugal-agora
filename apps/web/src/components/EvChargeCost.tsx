import { useEffect, useState } from 'react'
import {
  EV_BATTERY_PRESETS_KWH,
  MAX_EV_BATTERY_KWH,
  MAX_EV_CAR_AC_KW,
  MAX_EV_CAR_DC_KW,
  estimateEvCharge,
  estimateEvChargeTimes,
  formatChargeDuration,
  formatChargeTimeCalc,
  formatEvConnector,
  formatEvCostCalc,
  formatPowerKw,
  formatPrice,
  parseDecimal,
  type EvChargeSettings,
  type EvChargeTime,
  type EvChargeTimeGroup,
  type EvConnector,
} from '@portugal-hoje/core'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useCheapestEvTariffs } from '@/hooks/useEv'

// Custo (WEB-043) e tempo previsto (WEB-044) de carregar a bateria de X% a Y% num posto, com o tempo em AC e DC
// em separado e o cálculo de cada valor (WEB-046).
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
  connectors: EvConnector[]
}

export function EvChargeCost({ settings, onChange, connectors }: Props) {
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
  const times = estimate.ok ? estimateEvChargeTimes(estimate, connectors, settings) : null

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2">Custo e tempo do carregamento</p>

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

      <div className="mt-3 border-t border-amber-100 pt-2">
        <p className="text-xs font-semibold text-slate-700 mb-1.5">⏱️ Tempo previsto</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          <span className="text-slate-500">O carro aceita até:</span>
          <NumberField label="AC" unit="kW" value={settings.acMaxKw} max={MAX_EV_CAR_AC_KW} onChange={v => onChange({ acMaxKw: v })} />
          <NumberField label="DC" unit="kW" value={settings.dcMaxKw} max={MAX_EV_CAR_DC_KW} onChange={v => onChange({ dcMaxKw: v })} />
        </div>
        {times && 'error' in times && <p className="text-xs text-red-600 mt-2">{times.error}</p>}
        {times?.ok && (
          <div className="mt-2 space-y-2">
            <TimeGroup group={times.ac} />
            <TimeGroup group={times.dc} />
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-amber-100 pt-2">
        <p className="text-xs font-semibold text-slate-700 mb-1">💶 Custo por CEME</p>
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
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {cheapest.data
                      ? formatEvCostCalc(cheapest.data.meta.kwh_requested, c)
                      : `${formatPrice(c.price_per_kwh_eur)}/kWh`}
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
        Tempo estimado com a menor potência entre a tomada e o carro (AC com ~10% de perdas; DC mais lento acima de 80%).
        Pode variar com a temperatura, a partilha de potência e o carro. Custo: energia ao preço de cada CEME
        {period ? ` (período ${PERIOD_LABELS[period] ?? period})` : ''}, sem a tarifa do operador do posto (OPC), a tarifa de
        acesso às redes (EGME) nem as perdas no carregamento. O preço CEME por kWh é o mesmo em AC e em DC.
      </p>
    </div>
  )
}

function TimeGroup({ group }: { group: EvChargeTimeGroup }) {
  const missing = group.unknownPower > 0
    ? `Tomadas ${group.current} sem potência indicada.`
    : `Este posto não tem tomadas ${group.current}.`
  return (
    <div className="rounded-md bg-white/70 border border-amber-100 px-2 py-1.5">
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
        {group.current === 'AC' ? '🔌 AC (corrente alternada)' : '⚡ DC (carregamento rápido)'}
      </p>
      {group.carOnly ? (
        <>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {missing} Com o máximo do carro ({formatPowerKw(group.carMaxKw)}):
          </p>
          <TimeRow time={group.carOnly} label={`Carregador ${group.current} · ${formatPowerKw(group.carMaxKw)}`} />
        </>
      ) : (
        <ul className="divide-y divide-amber-50">
          {group.times.map(t => {
            const label = t.connector ? formatEvConnector(t.connector) : group.current
            return (
              <li key={label}>
                <TimeRow time={t} label={label} />
              </li>
            )
          })}
        </ul>
      )}
      {!group.carOnly && group.unknownPower > 0 && (
        <p className="text-[11px] text-slate-400 mt-0.5">
          {group.unknownPower} tipo{group.unknownPower !== 1 ? 's' : ''} de tomada {group.current} sem potência indicada.
        </p>
      )}
    </div>
  )
}

function TimeRow({ time, label }: { time: EvChargeTime; label: string }) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-600 min-w-0 truncate">
          {label}
          {time.limitedByCar && <span className="text-slate-400"> · carro limita a {formatPowerKw(time.effectiveKw)}</span>}
        </span>
        <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatChargeDuration(time.minutes)}</span>
      </div>
      <p className="text-[11px] text-slate-400 tabular-nums">{formatChargeTimeCalc(time)}</p>
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
