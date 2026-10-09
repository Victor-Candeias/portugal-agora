import type { FuelType } from '../types/index.js'

export function formatPrice(eur: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(eur)
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100)
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
}

export const FUEL_LABELS: Record<FuelType, string> = {
  gasoline_95: 'Gasolina 95',
  gasoline_98: 'Gasolina 98',
  diesel: 'Gasóleo',
  diesel_plus: 'Gasóleo +',
  lpg: 'GPL',
  adblue: 'AdBlue',
}

export const FUEL_COLORS: Record<FuelType, string> = {
  gasoline_95: '#22c55e',
  gasoline_98: '#3b82f6',
  diesel: '#f59e0b',
  diesel_plus: '#f97316',
  lpg: '#a855f7',
  adblue: '#06b6d4',
}

export const SEVERITY_COLORS = {
  low: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  extreme: '#ef4444',
} as const

export const FIRE_RISK_LABELS = {
  reduced: 'Reduzido',
  moderate: 'Moderado',
  high: 'Elevado',
  very_high: 'Muito Elevado',
  extreme: 'Máximo',
} as const

export const FIRE_RISK_COLORS = {
  reduced: '#22c55e',
  moderate: '#f59e0b',
  high: '#f97316',
  very_high: '#ef4444',
  extreme: '#7f1d1d',
} as const

const ptNumber = (value: number, digits = 1) =>
  new Intl.NumberFormat('pt-PT', { maximumFractionDigits: digits }).format(value)

// Indicadores de /ine/latest e /ine/stats (Eurostat) → rótulo PT + formatação (MOB-008).
// `short` é a versão compacta para os eixos dos gráficos (WEB-030).
export const INE_INDICATORS: Record<string, { label: string; format: (value: number) => string; short: (value: number) => string }> = {
  population: { label: 'População residente', format: (v) => ptNumber(v, 0), short: (v) => `${ptNumber(v / 1e6, 2)} M` },
  gdp: { label: 'PIB', format: (v) => `${ptNumber(v / 1000, 1)} mil M€`, short: (v) => `${ptNumber(v / 1000, 0)} mil M€` },
  gdp_per_capita: { label: 'PIB per capita', format: (v) => `${ptNumber(v, 0)} €`, short: (v) => `${ptNumber(v / 1000, 1)} mil €` },
  inflation: { label: 'Inflação (IHPC)', format: (v) => `${ptNumber(v)}%`, short: (v) => `${ptNumber(v)}%` },
  unemployment_rate: { label: 'Taxa de desemprego', format: (v) => `${ptNumber(v)}%`, short: (v) => `${ptNumber(v)}%` },
  birth_rate: { label: 'Natalidade', format: (v) => `${ptNumber(v)} ‰`, short: (v) => `${ptNumber(v)} ‰` },
  death_rate: { label: 'Mortalidade', format: (v) => `${ptNumber(v)} ‰`, short: (v) => `${ptNumber(v)} ‰` },
}

/** Valor de um indicador INE com a formatação PT; indicadores desconhecidos usam número simples. */
export function formatIneValue(indicator: string, value: number, variant: 'full' | 'short' = 'full'): string {
  const meta = INE_INDICATORS[indicator]
  if (!meta) return ptNumber(value, 2)
  return variant === 'short' ? meta.short(value) : meta.format(value)
}

export type IneRange = '10' | '20' | '30' | 'all'

const INE_RANGES: { value: IneRange; label: string; years: number | null }[] = [
  { value: '10', label: '10 anos', years: 10 },
  { value: '20', label: '20 anos', years: 20 },
  { value: '30', label: '30 anos', years: 30 },
  { value: 'all', label: 'Tudo', years: null },
]

/** Intervalos de anos que fazem sentido para um indicador (sem os que já cobrem a série toda). */
export function ineRangeOptions(years: { count: number }): { value: IneRange; label: string }[] {
  return INE_RANGES
    .filter(r => r.years === null || r.years < years.count)
    .map(({ value, label }) => ({ value, label }))
}

/** Primeiro ano de um intervalo, terminando no último ano com dados. */
export function ineRangeStart(range: IneRange, years: { from: number; to: number }): number {
  const span = INE_RANGES.find(r => r.value === range)?.years
  return span ? Math.max(years.from, years.to - span + 1) : years.from
}

/** Último valor, mínimo e máximo de uma série anual (`null` se vazia). */
export function summarizeIneSeries<T extends { year: number; value: number }>(points: T[]): { last: T; min: T; max: T } | null {
  if (points.length === 0) return null
  let min = points[0]
  let max = points[0]
  for (const p of points) {
    if (p.value < min.value) min = p
    if (p.value > max.value) max = p
  }
  return { last: points[points.length - 1], min, max }
}

// Rótulos curtos das taxas de /bdp/rates e /bdp/lending-rates (o `label_pt` da API fica como descrição).
export const BDP_RATE_LABELS: Record<string, string> = {
  ecb_deposit: 'BCE · Depósito',
  ecb_mro: 'BCE · Refinanciamento',
  ecb_marginal_lending: 'BCE · Cedência marginal',
  estr: '€STR',
  tba: 'TBA (BdP)',
  housing_loans: 'Crédito à habitação',
  consumer_loans: 'Crédito ao consumo',
  other_loans: 'Outros empréstimos',
  all_loans: 'Todos os empréstimos',
  term_deposits: 'Depósitos a prazo (≤1 ano)',
}

/** Taxa em percentagem, ex.: `2,50%`, `2,439%`. */
export function formatRate(value: number): string {
  return `${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value)}%`
}

/** Período de referência de uma taxa do BdP: mês por extenso nas mensais, data curta nas diárias. */
export function formatBdpPeriod(rate: { ref_date: string; frequency: string }): string {
  if (rate.frequency === 'monthly') {
    return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date(rate.ref_date))
  }
  return formatDate(rate.ref_date)
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
