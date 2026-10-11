// Energia de um carregamento de bateria (de X% a Y%) para o custo por posto (WEB-043).
// O custo vem do simulador CEME da API Aberta (`/ev/tariffs/cheapest?kwh=`).

/** Bateria útil média dos EV vendidos em Portugal (~60 kWh). */
export const DEFAULT_EV_BATTERY_KWH = 60
export const DEFAULT_EV_CHARGE_FROM_PCT = 10
export const DEFAULT_EV_CHARGE_TO_PCT = 90
export const MAX_EV_BATTERY_KWH = 200
export const EV_BATTERY_PRESETS_KWH = [40, 60, 77, 100] as const
export const EV_CHARGE_STORAGE_KEY = 'portugal-hoje:ev-charge-settings'

/** Valores tal como escritos pelo utilizador (aceitam vírgula decimal). */
export interface EvChargeSettings {
  batteryKwh: string
  fromPct: string
  toPct: string
}

export const DEFAULT_EV_CHARGE_SETTINGS: EvChargeSettings = {
  batteryKwh: String(DEFAULT_EV_BATTERY_KWH),
  fromPct: String(DEFAULT_EV_CHARGE_FROM_PCT),
  toPct: String(DEFAULT_EV_CHARGE_TO_PCT),
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

/** Lê definições guardadas (JSON), com os valores por omissão para o que faltar ou for inválido. */
export function parseEvChargeSettings(json: string | null | undefined): EvChargeSettings {
  if (!json) return DEFAULT_EV_CHARGE_SETTINGS
  try {
    const raw = JSON.parse(json) as Partial<Record<keyof EvChargeSettings, unknown>>
    const pick = (key: keyof EvChargeSettings) =>
      typeof raw[key] === 'string' ? (raw[key] as string) : DEFAULT_EV_CHARGE_SETTINGS[key]
    return { batteryKwh: pick('batteryKwh'), fromPct: pick('fromPct'), toPct: pick('toPct') }
  } catch {
    return DEFAULT_EV_CHARGE_SETTINGS
  }
}
