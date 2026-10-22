// Indicadores de urgência hospitalar do SNS (WEB-067): contrato dos JSON publicados no GitHub Pages
// (`data/sns/series.json`, `metadata.json`, `status.json`), normalização dos registos do dataset
// `atividade-sindrome-gripal-csh` (Portal da Transparência do SNS, ACSS) e funções puras para as apps.
// Sem imports em runtime: o coletor (apps/web/scripts/build-sns-urgencias.mjs) importa este ficheiro
// diretamente em Node (type stripping).
//
// `periodo` é uma data civil (`AAAA-MM-DD`) e nunca é convertida de/para fusos horários: as contas
// de dias fazem-se em UTC sobre o texto da data.

export const SNS_URGENCIAS_CONTRACT_VERSION = 1 as const
export const SNS_URGENCIAS_DATASET = 'atividade-sindrome-gripal-csh'
export const SNS_URGENCIAS_DATASET_TITLE = 'Atividade do Síndrome Gripal nos Cuidados de Saúde Hospitalares'
export const SNS_URGENCIAS_PUBLISHER = 'ACSS'
export const SNS_TRANSPARENCIA_PORTAL_URL = 'https://transparencia.sns.gov.pt/'
export const SNS_URGENCIAS_DATASET_URL = `https://transparencia.sns.gov.pt/explore/dataset/${SNS_URGENCIAS_DATASET}/`
export const SNS_URGENCIAS_API_URL = `https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets/${SNS_URGENCIAS_DATASET}`

/** Dias de histórico publicados. */
export const SNS_URGENCIAS_HISTORY_DAYS = 90
export const SNS_URGENCIAS_RANGES = [7, 30, 90] as const
export type SnsUrgenciasRange = (typeof SNS_URGENCIAS_RANGES)[number]
/** O dataset sai com ~2 dias de atraso; acima disto a página avisa do atraso. */
export const SNS_URGENCIAS_MAX_DELAY_DAYS = 4
/** O coletor corre 1×/dia; uma sincronização mais antiga que isto é «possivelmente desatualizada». */
export const SNS_URGENCIAS_MAX_SYNC_AGE_HOURS = 36

// ── Avisos e atribuição (iguais no web e no mobile) ─────────────────────────

export const SNS_URGENCIAS_NOT_REAL_TIME = 'Dados estatísticos publicados pelo SNS. Não representam a espera atual num hospital.'
export const SNS_URGENCIAS_EMERGENCY_NOTICE =
  'Em situação de emergência, ligue 112. Para orientação em situações não emergentes, contacte SNS 24 — 808 24 24 24.'
export const SNS_EMERGENCY_PHONE = '112'
export const SNS24_PHONE = '808242424'
export const SNS24_PHONE_LABEL = '808 24 24 24'
export const SNS_URGENCIAS_WAIT_TIME_WARNING =
  'Não é tempo real: é a média diária de uma região inteira, publicada com cerca de 2 dias de atraso. Não indica quanto vai esperar hoje em nenhum hospital.'
export const SNS_URGENCIAS_ATTRIBUTION =
  `Fonte: Portal da Transparência do SNS (${SNS_URGENCIAS_PUBLISHER}) — «${SNS_URGENCIAS_DATASET_TITLE}».`
export const SNS_URGENCIAS_TRANSFORMATIONS =
  `Dados filtrados aos últimos ${SNS_URGENCIAS_HISTORY_DAYS} dias e reorganizados por região e indicador pelo Portugal-Hoje; os valores publicados não foram alterados. Dias sem registo aparecem como «sem dados».`
export const SNS_URGENCIAS_LICENSE = {
  name: 'Sem licença explícita no dataset — reutilização ao abrigo da Lei n.º 26/2016',
  url: SNS_TRANSPARENCIA_PORTAL_URL,
  conditions: [
    'Indicar a fonte (Portal da Transparência do SNS).',
    'Preservar a integridade e o contexto da informação.',
    'Identificar as transformações feitas aos dados.',
  ],
}

// ── Indicadores e regiões ──────────────────────────────────────────────────

export interface SnsIndicatorInfo {
  shortLabel: string
  /** Definição (resumo da descrição do dataset). */
  description: string
  /** Casas decimais a mostrar. */
  decimals: number
  /** Indicador que pode ser confundido com espera em tempo real: mostrar `SNS_URGENCIAS_WAIT_TIME_WARNING`. */
  notRealTime?: boolean
}

/** Informação de apresentação dos indicadores conhecidos; os indicadores e unidades vêm sempre dos dados. */
export const SNS_URGENCIAS_INDICATOR_INFO: Record<string, SnsIndicatorInfo> = {
  'Número estimado de episódios de urgência': {
    shortLabel: 'Episódios de urgência',
    description:
      'Soma dos episódios dos serviços de urgência (variável 531). Nos serviços que não reportam num dia, os episódios são estimados a partir da população da área de influência.',
    decimals: 0,
  },
  'Taxa de episódios de urgência com diagnóstico de infeção respiratória': {
    shortLabel: 'Infeção respiratória',
    description:
      'Percentagem de episódios de urgência com gripe, síndrome gripal ou outras infeções respiratórias (variável 527). Só conta os serviços que codificam diagnósticos.',
    decimals: 2,
  },
  'Taxa diária de atendimentos urgentes com prioridade verde ou azul': {
    shortLabel: 'Prioridade verde ou azul',
    description:
      'Episódios com prioridade de Manchester verde, azul ou branca por 100 000 residentes na área de influência das urgências (variável 515).',
    decimals: 2,
  },
  'Tempo médio de espera entre a triagem e a primeira observação médica': {
    shortLabel: 'Tempo médio entre triagem e médico',
    description:
      'Média diária do tempo entre a triagem de Manchester e a primeira observação médica (variável 405). Só conta os serviços que reportam dados da triagem.',
    decimals: 0,
    notRealTime: true,
  },
}

export function snsIndicatorInfo(indicador: string): SnsIndicatorInfo {
  return SNS_URGENCIAS_INDICATOR_INFO[indicador] ?? { shortLabel: indicador, description: '', decimals: 2 }
}

/** Ordem de apresentação das regiões conhecidas; as outras vão para o fim, por ordem alfabética. */
export const SNS_URGENCIAS_REGION_ORDER = [
  'Portugal Continental',
  'ARS Norte',
  'ARS Centro',
  'ARS Lisboa e Vale do Tejo',
  'ARS Alentejo',
  'ARS Algarve',
]

export function compareSnsRegions(a: string, b: string): number {
  const ia = SNS_URGENCIAS_REGION_ORDER.indexOf(a)
  const ib = SNS_URGENCIAS_REGION_ORDER.indexOf(b)
  if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || 0
  return a.localeCompare(b, 'pt')
}

export function compareSnsIndicators(a: string, b: string): number {
  const known = Object.keys(SNS_URGENCIAS_INDICATOR_INFO)
  const ia = known.indexOf(a)
  const ib = known.indexOf(b)
  if (ia !== ib) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || 0
  return a.localeCompare(b, 'pt')
}

// ── Contrato ───────────────────────────────────────────────────────────────

/** Uma observação. Chave lógica: `(sourceDataset, ars, indicador, periodo)`. */
export interface SnsEmergencyObservation {
  sourceDataset: string
  ars: string
  indicador: string
  /** Data civil `AAAA-MM-DD`, sem hora nem fuso. */
  periodo: string
  valor: number
  unidade: string
}

/** Série compacta de uma região e indicador em `series.json`. */
export interface SnsUrgenciasSeriesEntry {
  ars: string
  indicador: string
  unidade: string
  /** `[periodo, valor]` por ordem cronológica; dias sem registo são omitidos. */
  points: [string, number][]
}

/** `series.json`. */
export interface SnsUrgenciasSeries {
  version: typeof SNS_URGENCIAS_CONTRACT_VERSION
  sourceDataset: string
  fetchedAtUtc: string
  generatedAtUtc: string
  /** Primeiro dia pedido (inclusive). */
  fromDate: string
  /** Última observação do conjunto. */
  toDate: string
  series: SnsUrgenciasSeriesEntry[]
}

export interface SnsUrgenciasIndicatorMeta {
  indicador: string
  unidade: string
  /** Regiões com pelo menos uma observação deste indicador. */
  regions: string[]
  latestPeriod: string
}

/** `metadata.json`. */
export interface SnsUrgenciasMetadata {
  version: typeof SNS_URGENCIAS_CONTRACT_VERSION
  sourceDataset: string
  sourceName: string
  publisher: string
  portalUrl: string
  datasetUrl: string
  apiUrl: string
  license: { name: string; url: string; conditions: string[] }
  attribution: string
  transformations: string
  /** `modified` dos metadados do dataset (última alteração na fonte). */
  sourceLastModified: string | null
  /** `data_processed` dos metadados do dataset. */
  sourceDataProcessed: string | null
  fetchedAtUtc: string
  generatedAtUtc: string
  historyDays: number
  fromDate: string
  toDate: string
  latestPeriod: string
  observations: number
  indicators: SnsUrgenciasIndicatorMeta[]
  regions: string[]
}

export type SnsUrgenciasSyncStatus = 'fresh' | 'republished' | 'failed'

/** `status.json`. */
export interface SnsUrgenciasStatus {
  version: typeof SNS_URGENCIAS_CONTRACT_VERSION
  generatedAtUtc: string
  /** `fresh`: recolhido nesta execução; `republished`: a recolha falhou e mantém-se o último conjunto; `failed`: sem dados. */
  status: SnsUrgenciasSyncStatus
  lastAttemptAt: string
  lastSuccessfulSyncAt: string | null
  latestPeriod: string | null
  possiblyStale: boolean
  error: string | null
}

// ── Datas (texto `AAAA-MM-DD`, sem fusos) ──────────────────────────────────

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isSnsDate(value: string): boolean {
  const m = DATE_RE.exec(value)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === value
}

export function addSnsDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Dias de `from` a `to` (`to - from`). */
export function snsDaysBetween(from: string, to: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((ms(to) - ms(from)) / 86400000)
}

function lastSundayAt1Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1)
}

/** Dia civil de Lisboa no instante `ms` (sem `Intl` com fuso, que o Hermes não garante). */
export function snsLisbonToday(ms: number = Date.now()): string {
  const year = new Date(ms).getUTCFullYear()
  const offset = ms >= lastSundayAt1Utc(year, 2) && ms < lastSundayAt1Utc(year, 9) ? 60 : 0
  return new Date(ms + offset * 60000).toISOString().slice(0, 10)
}

/**
 * `{ fromDate, toDate }` dos últimos `days` dias até `toDate` (inclusive), sem começar antes de
 * `minDate` (o primeiro dia recolhido), para não mostrar como lacunas dias que nunca foram pedidos.
 */
export function snsRangeBounds(toDate: string, days: number, minDate?: string): { fromDate: string; toDate: string } {
  const fromDate = addSnsDays(toDate, -(days - 1))
  return { fromDate: minDate && minDate > fromDate ? minDate : fromDate, toDate }
}

// ── Normalização ───────────────────────────────────────────────────────────

export type SnsRejectReason = 'missing-field' | 'invalid-date' | 'invalid-value'

export type SnsNormalizeResult =
  | { ok: true; observation: SnsEmergencyObservation }
  | { ok: false; reason: SnsRejectReason }

const cleanText = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t.length > 0 ? t : null
}

/**
 * Normaliza um registo da API (`periodo`, `ars`, `indicador`, `valor`, `unidade`). O `id` da API é
 * ignorado (o histórico usa nomes antigos dos indicadores). `periodo` aceita `AAAA-MM-DD` ou um ISO
 * que comece por essa data, de onde se tira só a data, sem converter fusos. `valor` em falta ou não
 * numérico rejeita o registo: nunca é tratado como zero.
 */
export function normalizeSnsEmergencyRecord(raw: unknown, sourceDataset: string = SNS_URGENCIAS_DATASET): SnsNormalizeResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'missing-field' }
  const r = raw as Record<string, unknown>
  const ars = cleanText(r.ars)
  const indicador = cleanText(r.indicador)
  const unidade = cleanText(r.unidade)
  if (!ars || !indicador || !unidade || r.periodo == null || r.valor == null) return { ok: false, reason: 'missing-field' }

  const rawDate = typeof r.periodo === 'string' ? r.periodo.trim() : ''
  const periodo = /^(\d{4}-\d{2}-\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(rawDate)?.[1]
  if (!periodo || !isSnsDate(periodo)) return { ok: false, reason: 'invalid-date' }

  let valor: number
  if (typeof r.valor === 'number') valor = r.valor
  else if (typeof r.valor === 'string' && /^-?\d+(\.\d+)?$/.test(r.valor.trim())) valor = Number(r.valor.trim())
  else return { ok: false, reason: 'invalid-value' }
  if (!Number.isFinite(valor)) return { ok: false, reason: 'invalid-value' }

  return { ok: true, observation: { sourceDataset, ars, indicador, periodo, valor, unidade } }
}

export function snsObservationKey(o: Pick<SnsEmergencyObservation, 'sourceDataset' | 'ars' | 'indicador' | 'periodo'>): string {
  return `${o.sourceDataset}\u0000${o.ars}\u0000${o.indicador}\u0000${o.periodo}`
}

export function compareSnsObservations(a: SnsEmergencyObservation, b: SnsEmergencyObservation): number {
  if (a.periodo !== b.periodo) return a.periodo < b.periodo ? -1 : 1
  return compareSnsRegions(a.ars, b.ars) || compareSnsIndicators(a.indicador, b.indicador)
}

export interface SnsNormalizeSummary {
  observations: SnsEmergencyObservation[]
  /** Registos rejeitados por motivo. */
  rejected: Record<SnsRejectReason, number>
  rejectedCount: number
  /** Registos com a mesma chave lógica de outro (fica o último). */
  duplicates: number
}

/** Normaliza, remove duplicados pela chave lógica (fica o último) e ordena por data, região e indicador. */
export function normalizeSnsEmergencyRecords(raws: readonly unknown[], sourceDataset: string = SNS_URGENCIAS_DATASET): SnsNormalizeSummary {
  const rejected: Record<SnsRejectReason, number> = { 'missing-field': 0, 'invalid-date': 0, 'invalid-value': 0 }
  const byKey = new Map<string, SnsEmergencyObservation>()
  let duplicates = 0
  for (const raw of raws) {
    const result = normalizeSnsEmergencyRecord(raw, sourceDataset)
    if ('reason' in result) {
      rejected[result.reason]++
      continue
    }
    const key = snsObservationKey(result.observation)
    if (byKey.has(key)) {
      duplicates++
      byKey.delete(key)
    }
    byKey.set(key, result.observation)
  }
  const observations = [...byKey.values()].sort(compareSnsObservations)
  const rejectedCount = rejected['missing-field'] + rejected['invalid-date'] + rejected['invalid-value']
  return { observations, rejected, rejectedCount, duplicates }
}

// ── Série compacta (series.json) ───────────────────────────────────────────

/** Agrupa por região e indicador. Lança erro se uma série tiver mais de uma unidade (mudança de esquema). */
export function compactSnsObservations(observations: readonly SnsEmergencyObservation[]): SnsUrgenciasSeriesEntry[] {
  const map = new Map<string, SnsUrgenciasSeriesEntry>()
  for (const o of [...observations].sort(compareSnsObservations)) {
    const key = `${o.ars}\u0000${o.indicador}`
    let entry = map.get(key)
    if (!entry) {
      entry = { ars: o.ars, indicador: o.indicador, unidade: o.unidade, points: [] }
      map.set(key, entry)
    } else if (entry.unidade !== o.unidade) {
      throw new Error(`Unidades diferentes para «${o.indicador}» em ${o.ars}: «${entry.unidade}» e «${o.unidade}»`)
    }
    entry.points.push([o.periodo, o.valor])
  }
  return [...map.values()].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador) || compareSnsRegions(a.ars, b.ars))
}

/** `series.json` → observações. */
export function expandSnsSeries(series: Pick<SnsUrgenciasSeries, 'sourceDataset' | 'series'>): SnsEmergencyObservation[] {
  const out: SnsEmergencyObservation[] = []
  for (const s of series.series) {
    for (const [periodo, valor] of s.points) {
      out.push({ sourceDataset: series.sourceDataset, ars: s.ars, indicador: s.indicador, periodo, valor, unidade: s.unidade })
    }
  }
  return out.sort(compareSnsObservations)
}

/** Indicadores (com unidade, regiões e última observação) e regiões presentes nas observações. */
export function describeSnsObservations(observations: readonly SnsEmergencyObservation[]): {
  indicators: SnsUrgenciasIndicatorMeta[]
  regions: string[]
  latestPeriod: string | null
  firstPeriod: string | null
} {
  const indicators = new Map<string, SnsUrgenciasIndicatorMeta>()
  const regions = new Set<string>()
  let latestPeriod: string | null = null
  let firstPeriod: string | null = null
  for (const o of observations) {
    regions.add(o.ars)
    if (!latestPeriod || o.periodo > latestPeriod) latestPeriod = o.periodo
    if (!firstPeriod || o.periodo < firstPeriod) firstPeriod = o.periodo
    let meta = indicators.get(o.indicador)
    if (!meta) {
      meta = { indicador: o.indicador, unidade: o.unidade, regions: [], latestPeriod: o.periodo }
      indicators.set(o.indicador, meta)
    }
    if (!meta.regions.includes(o.ars)) meta.regions.push(o.ars)
    if (o.periodo > meta.latestPeriod) meta.latestPeriod = o.periodo
  }
  for (const meta of indicators.values()) meta.regions.sort(compareSnsRegions)
  return {
    indicators: [...indicators.values()].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador)),
    regions: [...regions].sort(compareSnsRegions),
    latestPeriod,
    firstPeriod,
  }
}

// ── Consultas para as apps ─────────────────────────────────────────────────

export interface SnsSeriesFilter {
  indicador: string
  ars: string
  /** Inclusive. */
  fromDate?: string
  /** Inclusive. */
  toDate?: string
}

/** Observações de um indicador e região, opcionalmente num intervalo, por ordem cronológica. */
export function filterSnsSeries(observations: readonly SnsEmergencyObservation[], filter: SnsSeriesFilter): SnsEmergencyObservation[] {
  return observations
    .filter(o =>
      o.indicador === filter.indicador &&
      o.ars === filter.ars &&
      (!filter.fromDate || o.periodo >= filter.fromDate) &&
      (!filter.toDate || o.periodo <= filter.toDate))
    .sort((a, b) => (a.periodo < b.periodo ? -1 : a.periodo > b.periodo ? 1 : 0))
}

/** Última observação (maior `periodo`) de um indicador e/ou região; `null` se não houver nenhuma. */
export function snsLatestObservation(
  observations: readonly SnsEmergencyObservation[],
  filter: { indicador?: string; ars?: string } = {},
): SnsEmergencyObservation | null {
  let latest: SnsEmergencyObservation | null = null
  for (const o of observations) {
    if (filter.indicador && o.indicador !== filter.indicador) continue
    if (filter.ars && o.ars !== filter.ars) continue
    if (!latest || o.periodo > latest.periodo) latest = o
  }
  return latest
}

export interface SnsSeriesPoint {
  periodo: string
  /** `null` nos dias sem registo (lacuna), nunca zero. */
  valor: number | null
  missing: boolean
}

/** Um ponto por dia de `fromDate` a `toDate` (inclusive); os dias sem observação ficam como lacuna. */
export function snsSeriesWithGaps(observations: readonly SnsEmergencyObservation[], filter: Required<SnsSeriesFilter>): SnsSeriesPoint[] {
  const byDate = new Map(filterSnsSeries(observations, filter).map(o => [o.periodo, o.valor]))
  const days = snsDaysBetween(filter.fromDate, filter.toDate)
  const points: SnsSeriesPoint[] = []
  for (let i = 0; i <= days; i++) {
    const periodo = addSnsDays(filter.fromDate, i)
    const valor = byDate.get(periodo)
    points.push(valor === undefined ? { periodo, valor: null, missing: true } : { periodo, valor, missing: false })
  }
  return points
}

export interface SnsDataState {
  /** Dias entre a última observação e hoje (Lisboa). */
  delayDays: number | null
  /** Última observação mais antiga do que o normal (`SNS_URGENCIAS_MAX_DELAY_DAYS`). */
  delayed: boolean
  /** Horas desde a última sincronização com sucesso. */
  syncAgeHours: number | null
  /** Recolha falhada/republicada ou sincronização antiga (`SNS_URGENCIAS_MAX_SYNC_AGE_HOURS`). */
  possiblyStale: boolean
}

/** Atraso dos dados e frescura da sincronização, para os avisos das apps. */
export function snsDataState(options: {
  latestPeriod: string | null
  status?: Pick<SnsUrgenciasStatus, 'status' | 'possiblyStale' | 'lastSuccessfulSyncAt'> | null
  now?: number
}): SnsDataState {
  const now = options.now ?? Date.now()
  const delayDays = options.latestPeriod ? snsDaysBetween(options.latestPeriod, snsLisbonToday(now)) : null
  const syncMs = options.status?.lastSuccessfulSyncAt ? Date.parse(options.status.lastSuccessfulSyncAt) : NaN
  const syncAgeHours = Number.isFinite(syncMs) ? Math.max(0, (now - syncMs) / 3600000) : null
  const possiblyStale =
    !!options.status &&
    (options.status.possiblyStale ||
      options.status.status !== 'fresh' ||
      syncAgeHours === null ||
      syncAgeHours > SNS_URGENCIAS_MAX_SYNC_AGE_HOURS)
  return {
    delayDays,
    delayed: delayDays !== null && delayDays > SNS_URGENCIAS_MAX_DELAY_DAYS,
    syncAgeHours,
    possiblyStale,
  }
}

// ── Formatação ─────────────────────────────────────────────────────────────

const UNIT_SUFFIX: Record<string, string> = {
  '%': '%',
  minuto: 'min',
  'episódio urgência': 'episódios',
  'epis. urg./100.000 resid.': 'por 100 000 residentes',
}

export function snsUnitLabel(unidade: string): string {
  return UNIT_SUFFIX[unidade] ?? unidade
}

/** Valor com a unidade publicada, p. ex. «6,80 %», «73 min», «17 033 episódios». */
export function formatSnsValue(valor: number | null | undefined, unidade: string, indicador?: string): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'sem dados'
  const decimals = indicador ? snsIndicatorInfo(indicador).decimals : 2
  const text = valor.toLocaleString('pt-PT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return `${text} ${snsUnitLabel(unidade)}`
}

/** `AAAA-MM-DD` → `DD/MM/AAAA` (sem passar por `Date`, para não mudar de dia com o fuso). */
export function formatSnsDate(periodo: string): string {
  const m = DATE_RE.exec(periodo)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : periodo
}
