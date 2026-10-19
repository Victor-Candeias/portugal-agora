// Energia elétrica (WEB-052): taxonomia versionada e regras de cálculo partilhadas pelo pipeline
// (apps/web/scripts/build-energy-db.mjs), pelo web e pelo mobile. Regras do relatório
// Documents/relatorio_energia_portugal.md (secções 3, 4, 8, 11 e 12) e da prova de dados REN
// (web-050-spec).
//
// O script de build importa este ficheiro diretamente em Node (type stripping): manter só sintaxe
// TypeScript apagável (sem enums, namespaces nem parameter properties) e sem imports em runtime.

// ── Taxonomia ──────────────────────────────────────────────────────────────

/**
 * `storage`: produção a partir de armazenamento (turbinamento de água bombeada, baterias). Conta na
 * produção total, mas não é renovável nem não renovável (a REN separa-a em `PRODUCAO_ARMAZENAMENTO`).
 */
export type EnergyClassification = 'renewable' | 'non_renewable' | 'storage' | 'unknown'

export type EnergyTechnology =
  | 'wind'
  | 'solar'
  | 'hydro'
  | 'biomass'
  | 'wave'
  | 'geothermal'
  | 'natural_gas'
  | 'coal'
  | 'oil'
  | 'nuclear'
  | 'other_thermal'
  | 'other_renewable'
  | 'storage'

export const ENERGY_TECHNOLOGY_CLASSIFICATION: Record<EnergyTechnology, EnergyClassification> = {
  wind: 'renewable',
  solar: 'renewable',
  hydro: 'renewable',
  biomass: 'renewable',
  wave: 'renewable',
  geothermal: 'renewable',
  natural_gas: 'non_renewable',
  coal: 'non_renewable',
  oil: 'non_renewable',
  nuclear: 'non_renewable',
  other_thermal: 'non_renewable',
  other_renewable: 'renewable',
  storage: 'storage',
}

export const ENERGY_TECHNOLOGY_LABELS: Record<EnergyTechnology, string> = {
  wind: 'Eólica',
  solar: 'Solar',
  hydro: 'Hídrica',
  biomass: 'Biomassa',
  wave: 'Ondas',
  geothermal: 'Geotérmica',
  natural_gas: 'Gás natural',
  coal: 'Carvão',
  oil: 'Petróleo',
  nuclear: 'Nuclear',
  other_thermal: 'Outra térmica',
  other_renewable: 'Outra renovável',
  storage: 'Armazenamento',
}

export const ENERGY_CLASSIFICATION_LABELS: Record<EnergyClassification, string> = {
  renewable: 'Renovável',
  non_renewable: 'Não renovável',
  storage: 'Armazenamento',
  unknown: 'Desconhecida',
}

/** Campos do balanço (não são produção por tecnologia). */
export type EnergyBalanceField = 'consumption' | 'imports' | 'exports' | 'net_imports' | 'storage_consumption'

export interface EnergyTaxonomy {
  /** `ren-daily`, `entsoe-psr`, … */
  id: string
  version: number
  /** Código da fonte → tecnologia interna. */
  technologies: Record<string, EnergyTechnology>
  /** Código da fonte → campo do balanço. */
  balance: Record<string, EnergyBalanceField>
  /** Subcomponentes já incluídos noutros códigos ou totais usados só para validar (não somar). */
  ignored: readonly string[]
}

/**
 * Tipos de `ElectricityConsumptionSupplyDaily` (REN Data Hub), valores em GWh. Ver web-050-spec:
 * `HIDRICA` exclui o turbinamento de água bombeada (que está em `PRODUCAO_ARMAZENAMENTO`) e pode
 * ser negativa.
 */
export const REN_DAILY_TAXONOMY: EnergyTaxonomy = {
  id: 'ren-daily',
  version: 1,
  technologies: {
    EOLICA: 'wind',
    SOLAR: 'solar',
    HIDRICA: 'hydro',
    BIOMASSA: 'biomass',
    ONDAS: 'wave',
    GAS_NATURAL: 'natural_gas',
    CARVAO: 'coal',
    OUTRA_TERMICA: 'other_thermal',
    PRODUCAO_ARMAZENAMENTO: 'storage',
  },
  balance: {
    CONSUMO: 'consumption',
    IMPORTACAO: 'imports',
    EXPORTACAO: 'exports',
    SALDO_IMPORTADOR: 'net_imports',
    CONSUMO_ARMAZENAMENTO: 'storage_consumption',
  },
  ignored: [
    'PRODUCAO_TOTAL',
    'PRODUCAO_RENOVAVEL',
    'PRODUCAO_NAO_RENOVAVEL',
    'PRODUCAO_BOMBAGEM',
    'CONSUMO_BOMBAGEM',
    'CONSUMO_BATERIAS',
    'INJECAO_BATERIAS',
    'CORRIGIDO_TEMPERATURA',
    'BIOMASSA_COGERACAO',
    'BIOMASSA_OUTROS',
    'GAS_NATURAL_CICLO_COMBINADO',
    'GAS_NATURAL_COGERACAO',
    'OUTRA_TERMICA_COGERACAO',
    'OUTRA_TERMICA_OUTROS',
  ],
}

/**
 * Códigos PSR da ENTSO-E (A75, produção real por tipo; ver web-051-spec), valores em MW. Os
 * resíduos (B17) e «Other» (B20) contam como não renováveis (conservador: em PT a REN publica-os
 * como `OUTRA_TERMICA`). O consumo das unidades (séries `outBiddingZone_Domain`, p. ex. bombagem)
 * não é produção e é filtrado no pipeline antes da taxonomia.
 */
export const ENTSOE_PSR_TAXONOMY: EnergyTaxonomy = {
  id: 'entsoe-psr',
  version: 1,
  technologies: {
    B01: 'biomass',
    B02: 'coal',
    B03: 'other_thermal',
    B04: 'natural_gas',
    B05: 'coal',
    B06: 'oil',
    B07: 'oil',
    B08: 'other_thermal',
    B09: 'geothermal',
    B10: 'storage',
    B11: 'hydro',
    B12: 'hydro',
    B13: 'wave',
    B14: 'nuclear',
    B15: 'other_renewable',
    B16: 'solar',
    B17: 'other_thermal',
    B18: 'wind',
    B19: 'wind',
    B20: 'other_thermal',
    B25: 'storage',
  },
  balance: {},
  ignored: [],
}

/** `ren-daily@1` */
export function taxonomyTag(taxonomy: EnergyTaxonomy): string {
  return `${taxonomy.id}@${taxonomy.version}`
}

export type EnergyCodeMapping =
  | { kind: 'technology'; technology: EnergyTechnology; classification: EnergyClassification }
  | { kind: 'balance'; field: EnergyBalanceField }
  | { kind: 'ignored' }
  /** Código novo: nunca é tratado como não renovável por omissão. */
  | { kind: 'unknown'; technology: string; classification: 'unknown' }

export function mapEnergyCode(taxonomy: EnergyTaxonomy, code: string): EnergyCodeMapping {
  const technology = taxonomy.technologies[code]
  if (technology) {
    return { kind: 'technology', technology, classification: ENERGY_TECHNOLOGY_CLASSIFICATION[technology] }
  }
  const field = taxonomy.balance[code]
  if (field) return { kind: 'balance', field }
  if (taxonomy.ignored.includes(code)) return { kind: 'ignored' }
  return { kind: 'unknown', technology: `unknown:${code}`, classification: 'unknown' }
}

export function technologyLabel(technology: string): string {
  if (technology in ENERGY_TECHNOLOGY_LABELS) return ENERGY_TECHNOLOGY_LABELS[technology as EnergyTechnology]
  return technology.startsWith('unknown:') ? `Desconhecida (${technology.slice(8)})` : technology
}

export function classifyTechnology(technology: string): EnergyClassification {
  return technology in ENERGY_TECHNOLOGY_CLASSIFICATION
    ? ENERGY_TECHNOLOGY_CLASSIFICATION[technology as EnergyTechnology]
    : 'unknown'
}

// ── Resumo de um intervalo ─────────────────────────────────────────────────

export type EnergyQuality = 'complete' | 'incomplete'

export interface EnergyValue {
  technology: string
  classification: EnergyClassification
  /** MW ou MWh/GWh (todas as parcelas na mesma unidade). `null` = em falta (≠ 0). */
  value: number | null
}

export interface EnergySummary {
  renewable: number
  nonRenewable: number
  storage: number
  unknown: number
  /** renovável + não renovável + armazenamento + desconhecida */
  total: number
  /** Quota renovável da produção (0–100); `null` se o total não for positivo. */
  renewableSharePct: number | null
  /** renovável − não renovável */
  difference: number
  /** `null` se os dados não estiverem completos. */
  renewableExceedsNonRenewable: boolean | null
  quality: EnergyQuality
  /** Tecnologias com valor em falta (null/NaN). */
  missing: string[]
  /** Tecnologias com valor negativo (mantido como reportado, ex.: hídrica líquida da REN). */
  negative: string[]
}

export function roundEnergyValue(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Quota renovável (0–100, 2 casas) ou `null` se `total` não for positivo. */
export function energySharePct(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null
  return roundEnergyValue(Math.min(100, Math.max(0, (100 * part) / total)), 2)
}

/**
 * Soma por classificação. `complete` exige: nenhuma parcela em falta, nenhuma desconhecida
 * (≠ 0) e total positivo. Valores negativos são mantidos (não se corta a zero).
 */
export function summarizeEnergy(values: readonly EnergyValue[]): EnergySummary {
  let renewable = 0
  let nonRenewable = 0
  let storage = 0
  let unknown = 0
  const missing: string[] = []
  const negative: string[] = []
  for (const item of values) {
    if (item.value === null || !Number.isFinite(item.value)) {
      missing.push(item.technology)
      continue
    }
    if (item.value < 0) negative.push(item.technology)
    if (item.classification === 'renewable') renewable += item.value
    else if (item.classification === 'non_renewable') nonRenewable += item.value
    else if (item.classification === 'storage') storage += item.value
    else unknown += item.value
  }
  const total = renewable + nonRenewable + storage + unknown
  const complete = missing.length === 0 && unknown === 0 && total > 0
  return {
    renewable,
    nonRenewable,
    storage,
    unknown,
    total,
    renewableSharePct: energySharePct(renewable, total),
    difference: renewable - nonRenewable,
    renewableExceedsNonRenewable: complete ? renewable > nonRenewable : null,
    quality: complete ? 'complete' : 'incomplete',
    missing,
    negative,
  }
}

// ── Potência → energia ────────────────────────────────────────────────────

export type EnergyUnit = 'MW' | 'MWh' | 'GWh'

/** `PT15M` → 15, `PT1H`/`PT60M` → 60, `P1D` → 1440. `null` se não reconhecer. */
export function parseResolutionMinutes(resolution: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(resolution.trim())
  if (!match || resolution.trim() === 'P' || resolution.trim() === 'PT') return null
  const minutes = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
  return minutes > 0 ? minutes : null
}

/**
 * Energia em MWh de um intervalo. MW (potência média) → MW × horas; MWh e GWh já são energia e
 * não se multiplicam outra vez pela duração.
 */
export function toEnergyMwh(value: number, unit: EnergyUnit, resolutionMinutes: number): number {
  if (unit === 'MWh') return value
  if (unit === 'GWh') return value * 1000
  if (!(resolutionMinutes > 0)) throw new Error(`Resolução inválida: ${resolutionMinutes}`)
  return value * (resolutionMinutes / 60)
}

// ── Agregação 24h / 7d / 30d ───────────────────────────────────────────────

export interface EnergyObservation {
  intervalStartUtc: string
  intervalEndUtc: string
  technology: string
  classification: EnergyClassification
  /** `null` = em falta. */
  energyMwh: number | null
}

export interface EnergyAggregate extends EnergySummary {
  /** Totais em MWh por tecnologia. */
  technologyMwh: Record<string, number>
  /** Percentagem do período coberta por intervalos com dados (0–100). */
  coveragePct: number
  /** Observações duplicadas descartadas (mesmo intervalo e tecnologia). */
  duplicates: number
  /** Observações descartadas por se sobreporem parcialmente a outra da mesma tecnologia. */
  overlaps: number
}

/**
 * Soma a energia (MWh) das observações contidas em [fromUtc, toUtc[. A quota renovável sai das
 * somas de energia (ponderada), nunca da média de percentagens. Duplicados exatos contam uma vez
 * (fica a última) e sobreposições parciais da mesma tecnologia são descartadas. `complete` exige
 * cobertura de 100%.
 */
export function aggregateEnergy(
  observations: readonly EnergyObservation[],
  window: { fromUtc: string; toUtc: string },
): EnergyAggregate {
  const from = Date.parse(window.fromUtc)
  const to = Date.parse(window.toUtc)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw new Error(`Janela inválida: ${window.fromUtc} → ${window.toUtc}`)
  }
  const unique = new Map<string, { start: number; end: number; obs: EnergyObservation }>()
  let duplicates = 0
  for (const obs of observations) {
    const start = Date.parse(obs.intervalStartUtc)
    const end = Date.parse(obs.intervalEndUtc)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    if (start < from || end > to) continue
    const key = `${obs.technology}|${start}|${end}`
    if (unique.has(key)) duplicates++
    unique.set(key, { start, end, obs })
  }

  const byTechnology = new Map<string, { start: number; end: number; obs: EnergyObservation }[]>()
  for (const item of unique.values()) {
    const list = byTechnology.get(item.obs.technology) ?? []
    list.push(item)
    byTechnology.set(item.obs.technology, list)
  }
  let overlaps = 0
  const kept: { start: number; end: number; obs: EnergyObservation }[] = []
  for (const list of byTechnology.values()) {
    list.sort((a, b) => a.start - b.start || a.end - b.end)
    let lastEnd = -Infinity
    for (const item of list) {
      if (item.start < lastEnd) {
        overlaps++
        continue
      }
      kept.push(item)
      lastEnd = item.end
    }
  }

  const technologyMwh: Record<string, number> = {}
  const classificationOf = new Map<string, EnergyClassification>()
  const missingTech = new Set<string>()
  for (const { obs } of kept) {
    classificationOf.set(obs.technology, obs.classification)
    if (obs.energyMwh === null || !Number.isFinite(obs.energyMwh)) {
      missingTech.add(obs.technology)
      continue
    }
    technologyMwh[obs.technology] = (technologyMwh[obs.technology] ?? 0) + obs.energyMwh
  }

  const values: EnergyValue[] = [...classificationOf.entries()].map(([technology, classification]) => ({
    technology,
    classification,
    value: missingTech.has(technology) ? null : technologyMwh[technology] ?? 0,
  }))
  const summary = summarizeEnergy(values)
  // Cobertura: união dos intervalos com algum valor (em falta não conta).
  const covered = mergeIntervals(
    kept.filter(k => k.obs.energyMwh !== null && Number.isFinite(k.obs.energyMwh)).map(k => [k.start, k.end] as const),
  ).reduce((sum, [s, e]) => sum + (e - s), 0)
  const coveragePct = roundEnergyValue(Math.min(100, (100 * covered) / (to - from)), 2)
  const complete = summary.quality === 'complete' && coveragePct >= 100
  return {
    ...summary,
    renewableExceedsNonRenewable: complete ? summary.renewableExceedsNonRenewable : null,
    quality: complete ? 'complete' : 'incomplete',
    technologyMwh,
    coveragePct,
    duplicates,
    overlaps,
  }
}

function mergeIntervals(intervals: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [s, e] of sorted) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  return merged
}

// ── Atualidade e veredicto ────────────────────────────────────────────────

export const ENERGY_LATEST_LABEL = 'Últimos dados disponíveis'

/** Balanço diário REN: o dia D sai em D+1; 48 h depois do fim do dia toleram o cron diário. */
export const REN_DAILY_MAX_AGE_MINUTES = 2880

/**
 * ENTSO-E intradiário: publica a hora H cerca de 65 min depois do fim; com recolha horária (cron
 * a :20) e o atraso do cron/deploy, a idade normal chega a ~140 min (web-051-spec).
 */
export const ENTSOE_MAX_AGE_MINUTES = 180

/** Resolução máxima (min) com que se responde «agora». Séries diárias nunca respondem. */
export const ENERGY_VERDICT_MAX_RESOLUTION_MINUTES = 60

export type EnergyVerdict = 'SIM' | 'NÃO' | 'IGUAL' | 'INDETERMINADO' | 'DADOS DESATUALIZADOS'

export interface EnergyFreshness {
  /** Minutos desde o fim do intervalo; `null` se a data for inválida. */
  ageMinutes: number | null
  stale: boolean
  label: typeof ENERGY_LATEST_LABEL
}

export function energyFreshness(intervalEndUtc: string, maxAgeMinutes: number, nowMs: number = Date.now()): EnergyFreshness {
  const end = Date.parse(intervalEndUtc)
  if (!Number.isFinite(end)) return { ageMinutes: null, stale: true, label: ENERGY_LATEST_LABEL }
  const ageMinutes = Math.floor((nowMs - end) / 60000)
  // Fim no futuro (relógio ou dados errados) também é suspeito.
  const stale = ageMinutes < 0 || ageMinutes > maxAgeMinutes
  return { ageMinutes, stale, label: ENERGY_LATEST_LABEL }
}

export interface EnergyVerdictInput {
  intervalEndUtc: string
  resolutionMinutes: number
  quality: EnergyQuality
  renewable: number
  nonRenewable: number
}

/**
 * «Portugal está a produzir mais eletricidade renovável do que não renovável agora?»
 * Só responde SIM/NÃO/IGUAL com dados completos, recentes e intradiários (≤ 60 min).
 */
export function energyVerdict(input: EnergyVerdictInput, maxAgeMinutes: number, nowMs: number = Date.now()): EnergyVerdict {
  if (energyFreshness(input.intervalEndUtc, maxAgeMinutes, nowMs).stale) return 'DADOS DESATUALIZADOS'
  if (input.quality !== 'complete') return 'INDETERMINADO'
  if (!(input.resolutionMinutes > 0) || input.resolutionMinutes > ENERGY_VERDICT_MAX_RESOLUTION_MINUTES) return 'INDETERMINADO'
  if (!Number.isFinite(input.renewable) || !Number.isFinite(input.nonRenewable)) return 'INDETERMINADO'
  if (input.renewable > input.nonRenewable) return 'SIM'
  if (input.renewable < input.nonRenewable) return 'NÃO'
  return 'IGUAL'
}

/** `45 min`, `3 h 10 min`, `2 dias` */
export function formatEnergyDelay(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  if (minutes < 60) return `${Math.round(minutes)} min`
  if (minutes < 48 * 60) {
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return m > 0 ? `${h} h ${m} min` : `${h} h`
  }
  return `${Math.floor(minutes / 1440)} dias`
}

/** `80 GWh`, `1 234,5 MW` (pt-PT). */
export function formatEnergy(value: number | null | undefined, unit: EnergyUnit, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits }).format(value)} ${unit}`
}

/** `76,3%` */
export function formatSharePct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)}%`
}

// ── Hora de Lisboa (DST) ──────────────────────────────────────────────────

export const ENERGY_TIME_ZONE = 'Europe/Lisbon'

/** Último domingo do mês às 01:00 UTC (regra da hora de verão da UE). */
function lastSundayAt1Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1)
}

/**
 * Diferença (min) entre a hora de Lisboa e UTC no instante `ms`: 60 entre o último domingo de
 * março e o último domingo de outubro (01:00 UTC), 0 no resto do ano. Igual ao `nasaFirms.ts`,
 * repetido aqui porque este módulo não pode ter imports em runtime; sem `Intl` com fuso (Hermes).
 */
function lisbonOffsetMinutesAt(ms: number): number {
  const year = new Date(ms).getUTCFullYear()
  return ms >= lastSundayAt1Utc(year, 2) && ms < lastSundayAt1Utc(year, 9) ? 60 : 0
}

/** Dia civil de Lisboa (`AAAA-MM-DD`) no instante `ms`. */
export function lisbonDate(ms: number = Date.now()): string {
  return new Date(ms + lisbonOffsetMinutesAt(ms) * 60000).toISOString().slice(0, 10)
}

/** `AAAA-MM-DD` + n dias (calendário, sem fuso). */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Meia-noite de Lisboa do dia `date` em UTC (ISO). */
function lisbonMidnightUtcMs(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Data inválida: ${date}`)
  const guess = Date.UTC(y, m - 1, d)
  let utc = guess - lisbonOffsetMinutesAt(guess) * 60000
  utc = guess - lisbonOffsetMinutesAt(utc) * 60000
  return utc
}

/** Início e fim (UTC) do dia civil de Lisboa: 23 h, 24 h ou 25 h consoante a mudança de hora. */
export function lisbonDayBoundsUtc(date: string): { intervalStartUtc: string; intervalEndUtc: string; minutes: number } {
  const start = lisbonMidnightUtcMs(date)
  const end = lisbonMidnightUtcMs(addCalendarDays(date, 1))
  return {
    intervalStartUtc: new Date(start).toISOString(),
    intervalEndUtc: new Date(end).toISOString(),
    minutes: (end - start) / 60000,
  }
}

/**
 * Intervalos UTC de um dia de Lisboa com a resolução dada (ex.: 92/96/100 quartos de hora). As
 * etiquetas locais repetem-se ou saltam na mudança de hora: usar a posição do ponto, não a etiqueta.
 */
export function lisbonDayIntervalsUtc(date: string, resolutionMinutes: number): { intervalStartUtc: string; intervalEndUtc: string }[] {
  const { intervalStartUtc, minutes } = lisbonDayBoundsUtc(date)
  if (!(resolutionMinutes > 0) || minutes % resolutionMinutes !== 0) {
    throw new Error(`Resolução ${resolutionMinutes} min não divide o dia (${minutes} min)`)
  }
  const start = Date.parse(intervalStartUtc)
  return Array.from({ length: minutes / resolutionMinutes }, (_, i) => ({
    intervalStartUtc: new Date(start + i * resolutionMinutes * 60000).toISOString(),
    intervalEndUtc: new Date(start + (i + 1) * resolutionMinutes * 60000).toISOString(),
  }))
}

/** `19/10/2026, 08:35` em hora de Lisboa. */
export function formatLisbonDateTime(isoUtc: string): string {
  const ms = Date.parse(isoUtc)
  if (!Number.isFinite(ms)) return '—'
  const d = new Date(ms + lisbonOffsetMinutesAt(ms) * 60000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** `08:35` em hora de Lisboa. */
export function formatLisbonTime(isoUtc: string): string {
  const full = formatLisbonDateTime(isoUtc)
  return full === '—' ? full : full.slice(-5)
}

/** `18/10/2026` a partir de `2026-10-18` (dia civil, sem fuso). */
export function formatEnergyDate(date: string): string {
  const [y, m, d] = date.split('-')
  return y && m && d ? `${d}/${m}/${y}` : date
}

// ── Contrato JSON publicado (secção 8 do relatório) ───────────────────────

export const ENERGY_CONTRACT_VERSION = 1

/** Valores de um intervalo, todos na mesma `unit`. */
export interface EnergyInterval {
  intervalStartUtc: string
  intervalEndUtc: string
  resolutionMinutes: number
  unit: EnergyUnit
  quality: EnergyQuality
  coveragePct: number
  renewable: number
  nonRenewable: number
  storage: number
  unknown: number
  /** Produção total (renovável + não renovável + armazenamento + desconhecida). */
  production: number
  /** Quota renovável da **produção** nacional (não do consumo). */
  renewableSharePct: number | null
  renewableExceedsNonRenewable: boolean | null
  technology: Record<string, number>
  consumption: number | null
  imports: number | null
  exports: number | null
}

export interface EnergyDay extends EnergyInterval {
  /** Dia civil de Lisboa (`AAAA-MM-DD`). */
  date: string
}

export interface EnergyDatasetMeta {
  version: typeof ENERGY_CONTRACT_VERSION
  area: 'PT_CONTINENTAL'
  /** `REN`, `ENTSOE` */
  source: string
  sourceName: string
  sourceUrl: string
  /** `ren-daily@1` */
  taxonomy: string
  fetchedAtUtc: string
  generatedAtUtc: string
  /** `latest_available` nas séries diárias (nunca «agora»); `near_real_time` no intradiário ENTSO-E. */
  freshness: EnergyFreshnessKind
  maxAgeMinutes: number
}

export type EnergyFreshnessKind = 'latest_available' | 'near_real_time'

export interface EnergyLatest extends EnergyDatasetMeta {
  latest: EnergyDay
}

/** `intraday-latest.json`: última hora completa ENTSO-E (MW). */
export interface EnergyIntradayLatest extends EnergyDatasetMeta {
  latest: EnergyInterval
}

/** Ficheiros intradiários publicados (MW, horários). */
export type EnergyIntradayRange = '24h' | '7d'

export interface EnergyDaily extends EnergyDatasetMeta {
  /** Dias por ordem crescente (até 30). */
  days: EnergyDay[]
  /** Soma do período (energia, quota ponderada). */
  total: EnergyInterval
}

export type EnergyRange = '24h' | '7d' | '30d'

export interface EnergyTimeseries extends EnergyDatasetMeta {
  range: EnergyRange
  points: EnergyInterval[]
  /** Intradiário ENTSO-E: último backfill completo (as execuções horárias só revêm as últimas 48 h). */
  backfillUtc?: string
}

/** Produção renovável face ao consumo (pode passar 100% quando há exportação). */
export function renewableToConsumptionPct(interval: Pick<EnergyInterval, 'renewable' | 'consumption'>): number | null {
  if (interval.consumption === null || !(interval.consumption > 0)) return null
  return roundEnergyValue((100 * interval.renewable) / interval.consumption, 1)
}

// ── Apresentação (web e mobile, WEB-056) ──────────────────────────────────

export const ENERGY_CLASSIFICATION_COLORS: Record<EnergyClassification, string> = {
  renewable: '#16a34a',
  non_renewable: '#64748b',
  storage: '#8b5cf6',
  unknown: '#cbd5e1',
}

export const ENERGY_TECHNOLOGY_COLORS: Record<EnergyTechnology, string> = {
  wind: '#0ea5e9',
  solar: '#facc15',
  hydro: '#2563eb',
  biomass: '#65a30d',
  wave: '#06b6d4',
  geothermal: '#b45309',
  natural_gas: '#f97316',
  coal: '#334155',
  oil: '#78350f',
  nuclear: '#a855f7',
  other_thermal: '#94a3b8',
  other_renewable: '#4ade80',
  storage: '#8b5cf6',
}

export const ENERGY_CONSUMPTION_COLOR = '#0f172a'

export function technologyColor(technology: string): string {
  return ENERGY_TECHNOLOGY_COLORS[technology as EnergyTechnology] ?? ENERGY_CLASSIFICATION_COLORS.unknown
}

export interface EnergyMixEntry {
  technology: string
  label: string
  classification: EnergyClassification
  color: string
  value: number
  /** Percentagem da produção do intervalo (`null` se a produção não for positiva). */
  sharePct: number | null
}

const CLASSIFICATION_ORDER: EnergyClassification[] = ['renewable', 'non_renewable', 'storage', 'unknown']

/**
 * Mix de produção por tecnologia, agrupado por classificação (renovável, não renovável,
 * armazenamento, desconhecida) e por valor decrescente. Omite as tecnologias a zero. Valores
 * negativos (ex.: hídrica sem a bombagem) ficam na lista; nas barras empilhadas usar só os positivos.
 */
export function energyMix(interval: Pick<EnergyInterval, 'technology' | 'production'>): EnergyMixEntry[] {
  return Object.entries(interval.technology)
    .filter(([, value]) => Number.isFinite(value) && value !== 0)
    .map(([technology, value]) => {
      const classification = classifyTechnology(technology)
      return {
        technology,
        label: technologyLabel(technology),
        classification,
        color: technologyColor(technology),
        value,
        sharePct: interval.production > 0 ? roundEnergyValue((100 * value) / interval.production, 1) : null,
      }
    })
    .sort(
      (a, b) =>
        CLASSIFICATION_ORDER.indexOf(a.classification) - CLASSIFICATION_ORDER.indexOf(b.classification) || b.value - a.value,
    )
}

/** Dias sem dados entre o primeiro e o último dia publicados (lacunas). */
export function energyMissingDates(days: readonly Pick<EnergyDay, 'date'>[]): string[] {
  if (days.length === 0) return []
  const have = new Set(days.map(d => d.date))
  const missing: string[] = []
  for (let date = days[0].date; date < days[days.length - 1].date; date = addCalendarDays(date, 1)) {
    if (!have.has(date)) missing.push(date)
  }
  return missing
}

export interface EnergyQualityInfo {
  label: typeof ENERGY_LATEST_LABEL
  /** `18/10/2026` ou `19/09/2026 – 18/10/2026`. */
  period: string
  latestDate: string
  /** Hora de recolha na fonte, em Lisboa. */
  fetchedAt: string
  /** Tempo desde o fim do último dia (`1 dia`, `13 h 5 min`). */
  delay: string
  stale: boolean
  missingDates: string[]
  incompleteDates: string[]
  source: string
  sourceUrl: string
}

/** Bloco «Qualidade dos dados»: período, recolha, atraso, lacunas e fonte. */
export function energyQualityInfo(
  dataset: EnergyDatasetMeta & { days?: EnergyDay[]; latest?: EnergyDay },
  nowMs: number = Date.now(),
): EnergyQualityInfo | null {
  const days = dataset.days ?? (dataset.latest ? [dataset.latest] : [])
  if (days.length === 0) return null
  const first = days[0]
  const last = days[days.length - 1]
  const freshness = energyFreshness(last.intervalEndUtc, dataset.maxAgeMinutes, nowMs)
  return {
    label: freshness.label,
    period: first.date === last.date ? formatEnergyDate(last.date) : `${formatEnergyDate(first.date)} – ${formatEnergyDate(last.date)}`,
    latestDate: formatEnergyDate(last.date),
    fetchedAt: formatLisbonDateTime(dataset.fetchedAtUtc),
    delay: freshness.ageMinutes === null ? '—' : formatEnergyDelay(freshness.ageMinutes),
    stale: freshness.stale,
    missingDates: energyMissingDates(days),
    incompleteDates: days.filter(d => d.quality !== 'complete').map(d => d.date),
    source: dataset.sourceName,
    sourceUrl: dataset.sourceUrl,
  }
}

// ── Indicador «agora» e série intradiária (WEB-058) ───────────────────────

export const ENERGY_NOW_QUESTION = 'Portugal está a produzir mais eletricidade renovável do que não renovável agora?'

export const ENERGY_VERDICT_STYLES: Record<EnergyVerdict, { color: string; background: string; description: string }> = {
  SIM: { color: '#15803d', background: '#dcfce7', description: 'A produção renovável está acima da não renovável.' },
  NÃO: { color: '#c2410c', background: '#ffedd5', description: 'A produção não renovável está acima da renovável.' },
  IGUAL: { color: '#0369a1', background: '#e0f2fe', description: 'Produção renovável e não renovável iguais.' },
  INDETERMINADO: {
    color: '#475569',
    background: '#f1f5f9',
    description: 'Dados incompletos ou sem resolução intradiária: não é possível responder.',
  },
  'DADOS DESATUALIZADOS': {
    color: '#b45309',
    background: '#fef3c7',
    description: 'Não há observação recente: mostram-se os últimos dados disponíveis, que não são «agora».',
  },
}

export interface EnergyNowInfo {
  verdict: EnergyVerdict
  /** Última hora completa (ou a última com dados, se nenhuma estiver completa). */
  interval: EnergyInterval | null
  /** `19/10 20:00–21:00` (hora de Lisboa). */
  observed: string
  /** Hora de recolha na fonte (`HH:mm`, Lisboa). */
  updatedAt: string
  /** Minutos desde o fim do intervalo observado. */
  delayMinutes: number | null
  delay: string
  stale: boolean
  /** «Agora» só com observação recente; senão «Últimos dados disponíveis». */
  label: string
  source: string
  sourceUrl: string
}

/** Veredicto «agora» a partir de `intraday-latest.json` ou de uma série intradiária. */
export function energyNowInfo(
  dataset: EnergyDatasetMeta & { points?: EnergyInterval[]; latest?: EnergyInterval },
  nowMs: number = Date.now(),
): EnergyNowInfo {
  const points = dataset.points ?? (dataset.latest ? [dataset.latest] : [])
  const interval = [...points].reverse().find(p => p.quality === 'complete') ?? points[points.length - 1] ?? null
  const base = {
    updatedAt: formatLisbonTime(dataset.fetchedAtUtc),
    source: dataset.sourceName.split(' — ')[0],
    sourceUrl: dataset.sourceUrl,
  }
  if (!interval) {
    return { ...base, verdict: 'INDETERMINADO', interval: null, observed: '—', delayMinutes: null, delay: '—', stale: true, label: ENERGY_LATEST_LABEL }
  }
  const freshness = energyFreshness(interval.intervalEndUtc, dataset.maxAgeMinutes, nowMs)
  const verdict = energyVerdict(interval, dataset.maxAgeMinutes, nowMs)
  const start = formatLisbonDateTime(interval.intervalStartUtc)
  return {
    ...base,
    verdict,
    interval,
    observed: `${start.slice(0, 5)} ${start.slice(-5)}–${formatLisbonTime(interval.intervalEndUtc)}`,
    delayMinutes: freshness.ageMinutes,
    delay: freshness.ageMinutes === null ? '—' : formatEnergyDelay(freshness.ageMinutes),
    stale: freshness.stale,
    label: freshness.stale || dataset.freshness !== 'near_real_time' ? ENERGY_LATEST_LABEL : 'Agora',
  }
}

export interface EnergySlot {
  intervalStartUtc: string
  /** `HH:mm` (Lisboa) */
  time: string
  /** `19/10 20:00` (Lisboa) */
  label: string
  /** `null` = hora sem dados (lacuna; nunca zero). */
  point: EnergyInterval | null
}

/**
 * Eixo contínuo com a resolução da série, do primeiro ao último ponto: as horas sem dados ficam com
 * `point: null` para os gráficos mostrarem uma lacuna em vez de zero.
 */
export function energyHourlySlots(points: readonly EnergyInterval[]): EnergySlot[] {
  if (points.length === 0) return []
  const step = points[0].resolutionMinutes * 60000
  const byStart = new Map(points.map(p => [Date.parse(p.intervalStartUtc), p]))
  const first = Date.parse(points[0].intervalStartUtc)
  const last = Date.parse(points[points.length - 1].intervalStartUtc)
  const slots: EnergySlot[] = []
  for (let t = first; t <= last && slots.length < 2000; t += step) {
    const iso = new Date(t).toISOString()
    const full = formatLisbonDateTime(iso)
    slots.push({ intervalStartUtc: iso, time: full.slice(-5), label: `${full.slice(0, 5)} ${full.slice(-5)}`, point: byStart.get(t) ?? null })
  }
  return slots
}
// ── Análise 24h / 7d / 30d e CSV (WEB-059) ────────────────────────────────

export const ENERGY_RANGE_LABELS: Record<EnergyRange, string> = { '24h': '24 horas', '7d': '7 dias', '30d': '30 dias' }

/** Fonte, unidade e resolução de cada intervalo de análise (MW e GWh nunca no mesmo eixo). */
export const ENERGY_RANGE_INFO: Record<EnergyRange, { source: string; detail: string }> = {
  '24h': { source: 'ENTSO-E', detail: 'potência média horária (MW)' },
  '7d': { source: 'ENTSO-E', detail: 'potência média horária (MW)' },
  '30d': { source: 'REN', detail: 'energia por dia civil de Lisboa (GWh)' },
}

export const ENERGY_NOT_INCLUDED_NOTE =
  'Não incluídos: preços de mercado (termos de reutilização da ENTSO-E por confirmar; o endpoint de preços diários da REN não está disponível), potência instalada e comparações anuais.'

export interface EnergyRangeSummary {
  periods: number
  /** Intervalos completos: só estes entram nos totais (base comum a produção, consumo e trocas). */
  complete: number
  renewableGWh: number
  nonRenewableGWh: number
  storageGWh: number
  productionGWh: number
  /** Quota renovável ponderada pela energia (não é a média das percentagens). */
  renewableSharePct: number | null
  /** Intervalos completos com renovável > não renovável. */
  renewableAbove: number
  consumptionGWh: number | null
  importsGWh: number | null
  exportsGWh: number | null
  /** Importação − exportação (positivo = saldo importador). */
  netImportsGWh: number | null
  /** Intervalos completos sem consumo ou trocas (ficam fora desses totais). */
  balanceMissing: number
}

/** Totais de energia (GWh) de uma série, em MW (× duração) ou já em energia (MWh/GWh). */
export function energyRangeSummary(points: readonly EnergyInterval[]): EnergyRangeSummary {
  const complete = points.filter(p => p.quality === 'complete')
  const gwh = (p: EnergyInterval, v: number) => toEnergyMwh(v, p.unit, p.resolutionMinutes) / 1000
  const sum = (f: (p: EnergyInterval) => number) => complete.reduce((s, p) => s + gwh(p, f(p)), 0)
  const balance = complete.filter(p => p.consumption !== null && p.imports !== null && p.exports !== null)
  const sumBalance = (f: (p: EnergyInterval) => number) => (balance.length ? balance.reduce((s, p) => s + gwh(p, f(p)), 0) : null)
  const renewableGWh = sum(p => p.renewable)
  const productionGWh = sum(p => p.production)
  const importsGWh = sumBalance(p => p.imports ?? 0)
  const exportsGWh = sumBalance(p => p.exports ?? 0)
  return {
    periods: points.length,
    complete: complete.length,
    renewableGWh,
    nonRenewableGWh: sum(p => p.nonRenewable),
    storageGWh: sum(p => p.storage),
    productionGWh,
    renewableSharePct: energySharePct(renewableGWh, productionGWh),
    renewableAbove: complete.filter(p => p.renewable > p.nonRenewable).length,
    consumptionGWh: sumBalance(p => p.consumption ?? 0),
    importsGWh,
    exportsGWh,
    netImportsGWh: importsGWh !== null && exportsGWh !== null ? importsGWh - exportsGWh : null,
    balanceMissing: complete.length - balance.length,
  }
}

const CSV_NUMBER = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3, useGrouping: false })

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'number' ? (Number.isFinite(value) ? CSV_NUMBER.format(value) : '') : value
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * CSV (separador `;`, decimal `,`, para abrir no Excel em pt-PT) com uma linha por intervalo e uma
 * coluna por tecnologia. Valores em falta ficam vazios (nunca zero).
 */
export function energyCsv(points: readonly EnergyInterval[], meta: Pick<EnergyDatasetMeta, 'sourceName'>): string {
  const technologies = [...new Set(points.flatMap(p => Object.keys(p.technology)))].sort()
  const header = [
    'inicio_utc',
    'fim_utc',
    'inicio_lisboa',
    'resolucao_min',
    'unidade',
    'qualidade',
    'cobertura_pct',
    'renovavel',
    'nao_renovavel',
    'armazenamento',
    'desconhecida',
    'producao',
    'quota_renovavel_pct',
    'consumo',
    'importacao',
    'exportacao',
    ...technologies.map(t => `tec_${t}`),
    'fonte',
  ]
  const rows = points.map(p => [
    p.intervalStartUtc,
    p.intervalEndUtc,
    formatLisbonDateTime(p.intervalStartUtc),
    p.resolutionMinutes,
    p.unit,
    p.quality === 'complete' ? 'completo' : 'incompleto',
    p.coveragePct,
    p.renewable,
    p.nonRenewable,
    p.storage,
    p.unknown,
    p.production,
    p.renewableSharePct,
    p.consumption,
    p.imports,
    p.exports,
    ...technologies.map(t => p.technology[t]),
    meta.sourceName,
  ])
  return [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

/** `energia-ENTSOE-7d-2026-10-19.csv` */
export function energyCsvFileName(source: string, range: EnergyRange, nowMs: number = Date.now()): string {
  return `energia-${source}-${range}-${lisbonDate(nowMs)}.csv`
}