// Energia de um carregamento de bateria (de X% a Y%) para o custo por posto (WEB-043) e tempo
// previsto em cada tipo de tomada do posto (WEB-044). O custo vem do simulador CEME da API Aberta
// (`/ev/tariffs/cheapest?kwh=`).
import type { EvConnector } from '../api/openChargeMap.js'

/** Bateria útil média dos EV vendidos em Portugal (~60 kWh). */
export const DEFAULT_EV_BATTERY_KWH = 60
export const DEFAULT_EV_CHARGE_FROM_PCT = 10
export const DEFAULT_EV_CHARGE_TO_PCT = 80
/** Carregador de bordo AC mais comum (trifásico 16 A). */
export const DEFAULT_EV_CAR_AC_KW = 11
/** Potência DC máxima típica de um EV médio. */
export const DEFAULT_EV_CAR_DC_KW = 120
export const MAX_EV_BATTERY_KWH = 200
export const MAX_EV_CAR_AC_KW = 43
export const MAX_EV_CAR_DC_KW = 500
export const EV_BATTERY_PRESETS_KWH = [40, 60, 77, 100] as const
// v2 (WEB-044): novos campos e carga por omissão até 80%.
export const EV_CHARGE_STORAGE_KEY = 'portugal-hoje:ev-charge-settings:v2'

/** Valores tal como escritos pelo utilizador (aceitam vírgula decimal). */
export interface EvChargeSettings {
  batteryKwh: string
  fromPct: string
  toPct: string
  /** Potência máxima que o carro aceita em AC (kW). */
  acMaxKw: string
  /** Potência máxima que o carro aceita em DC (kW). */
  dcMaxKw: string
}

export const DEFAULT_EV_CHARGE_SETTINGS: EvChargeSettings = {
  batteryKwh: String(DEFAULT_EV_BATTERY_KWH),
  fromPct: String(DEFAULT_EV_CHARGE_FROM_PCT),
  toPct: String(DEFAULT_EV_CHARGE_TO_PCT),
  acMaxKw: String(DEFAULT_EV_CAR_AC_KW),
  dcMaxKw: String(DEFAULT_EV_CAR_DC_KW),
}

export type EvChargeEstimate =
  | { ok: true; batteryKwh: number; fromPct: number; toPct: number; energyKwh: number }
  | { ok: false; error: string }

/** `"12,5"` → 12.5; vazio ou inválido → null. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

/** Energia (kWh, arredondada a 0,1) para levar a bateria de `fromPct` a `toPct`. */
export function estimateEvCharge(settings: EvChargeSettings): EvChargeEstimate {
  const batteryKwh = parseDecimal(settings.batteryKwh)
  const fromPct = parseDecimal(settings.fromPct)
  const toPct = parseDecimal(settings.toPct)
  if (batteryKwh === null || batteryKwh <= 0 || batteryKwh > MAX_EV_BATTERY_KWH) {
    return { ok: false, error: `A bateria tem de ter entre 1 e ${MAX_EV_BATTERY_KWH} kWh.` }
  }
  if (fromPct === null || toPct === null || fromPct < 0 || toPct > 100) {
    return { ok: false, error: 'As percentagens têm de estar entre 0 e 100%.' }
  }
  if (fromPct >= toPct) {
    return { ok: false, error: 'A percentagem final tem de ser maior do que a inicial.' }
  }
  const energyKwh = Math.round(batteryKwh * (toPct - fromPct) * 10 / 100) / 10
  if (energyKwh <= 0) return { ok: false, error: 'A energia a carregar é demasiado pequena.' }
  return { ok: true, batteryKwh, fromPct, toPct, energyKwh }
}

// ── Tempo previsto (WEB-044) ──────────────────────────────────────────────

/** Fração da potência que chega à bateria em AC (perdas do carregador de bordo). */
const AC_EFFICIENCY = 0.9
/** Potência média em DC até 80%, face ao máximo (a curva não é plana). */
const DC_AVERAGE_FACTOR = 0.85
/** Acima de 80% o carro reduz muito a potência em DC. */
const DC_TAPER_FROM_PCT = 80
const DC_TAPER_FACTOR = 0.4

const DC_CONNECTOR_TYPES = new Set(['CCS1', 'CCS2', 'CHAdeMO', 'Tesla Supercharger'])

export interface EvChargeTime {
  connector: EvConnector
  current: 'AC' | 'DC'
  /** Potência usada no cálculo: a menor entre a da tomada e a do carro (kW). */
  effectiveKw: number
  limitedByCar: boolean
  minutes: number
}

export type EvChargeTimes =
  | { ok: true; times: EvChargeTime[]; unknownPower: number }
  | { ok: false; error: string }

function connectorCurrent(c: EvConnector): 'AC' | 'DC' {
  return c.current ?? (DC_CONNECTOR_TYPES.has(c.type) ? 'DC' : 'AC')
}

/** Tempo previsto em cada tipo de tomada, do mais rápido para o mais lento. */
export function estimateEvChargeTimes(
  estimate: Extract<EvChargeEstimate, { ok: true }>,
  connectors: EvConnector[],
  settings: Pick<EvChargeSettings, 'acMaxKw' | 'dcMaxKw'>,
): EvChargeTimes {
  const acMax = parseDecimal(settings.acMaxKw)
  const dcMax = parseDecimal(settings.dcMaxKw)
  if (acMax === null || acMax <= 0 || acMax > MAX_EV_CAR_AC_KW) {
    return { ok: false, error: `A potência AC do carro tem de estar entre 1 e ${MAX_EV_CAR_AC_KW} kW.` }
  }
  if (dcMax === null || dcMax <= 0 || dcMax > MAX_EV_CAR_DC_KW) {
    return { ok: false, error: `A potência DC do carro tem de estar entre 1 e ${MAX_EV_CAR_DC_KW} kW.` }
  }

  const { batteryKwh, fromPct, toPct } = estimate
  const kwhBetween = (a: number, b: number) => Math.max(0, b - a) * batteryKwh / 100
  const times: EvChargeTime[] = []
  let unknownPower = 0
  for (const connector of connectors) {
    if (connector.powerKw == null) {
      unknownPower += 1
      continue
    }
    const current = connectorCurrent(connector)
    const carMax = current === 'DC' ? dcMax : acMax
    const effectiveKw = Math.min(connector.powerKw, carMax)
    let hours: number
    if (current === 'AC') {
      hours = estimate.energyKwh / (effectiveKw * AC_EFFICIENCY)
    } else {
      const fastKwh = kwhBetween(fromPct, Math.min(toPct, DC_TAPER_FROM_PCT))
      const slowKwh = kwhBetween(Math.max(fromPct, DC_TAPER_FROM_PCT), toPct)
      hours = fastKwh / (effectiveKw * DC_AVERAGE_FACTOR) + slowKwh / (effectiveKw * DC_TAPER_FACTOR)
    }
    times.push({ connector, current, effectiveKw, limitedByCar: carMax < connector.powerKw, minutes: hours * 60 })
  }
  times.sort((a, b) => a.minutes - b.minutes)
  return { ok: true, times, unknownPower }
}

/** `~45 min`, `~1h 20min`, `~5h` (arredondado a 5 minutos). */
export function formatChargeDuration(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5)
  if (rounded < 60) return `~${rounded} min`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return m === 0 ? `~${h}h` : `~${h}h ${String(m).padStart(2, '0')}min`
}

/** Lê definições guardadas (JSON), com os valores por omissão para o que faltar ou for inválido. */
export function parseEvChargeSettings(json: string | null | undefined): EvChargeSettings {
  if (!json) return DEFAULT_EV_CHARGE_SETTINGS
  try {
    const raw = JSON.parse(json) as Partial<Record<keyof EvChargeSettings, unknown>>
    const pick = (key: keyof EvChargeSettings) =>
      typeof raw[key] === 'string' ? (raw[key] as string) : DEFAULT_EV_CHARGE_SETTINGS[key]
    return {
      batteryKwh: pick('batteryKwh'),
      fromPct: pick('fromPct'),
      toPct: pick('toPct'),
      acMaxKw: pick('acMaxKw'),
      dcMaxKw: pick('dcMaxKw'),
    }
  } catch {
    return DEFAULT_EV_CHARGE_SETTINGS
  }
}
