// Cliente dos dados de energia publicados pelo pipeline (WEB-053, WEB-057) no GitHub Pages:
// `energy/daily.json` e `energy/latest.json` (REN, diário), `energy/intraday-latest.json` e
// `energy/timeseries-24h.json`/`timeseries-7d.json` (ENTSO-E, horário em MW). Contrato em
// utils/energy.ts. As apps só releem os ficheiros publicados
// (o refresh não cria dados novos). Sem dependências de plataforma: `fetch`, a URL base e o
// armazenamento da cache (localStorage no web, expo-sqlite/kv-store no mobile) são injetados.
import { z } from 'zod'
import type { KeyValueStorage } from './geo.js'
import {
  ENERGY_CONTRACT_VERSION,
  type EnergyDaily,
  type EnergyIntradayLatest,
  type EnergyIntradayRange,
  type EnergyLatest,
  type EnergyRange,
  type EnergyTimeseries,
} from '../utils/energy.js'

// ── Validação do contrato (os tipos do contrato estão em utils/energy.ts) ───

const energyIntervalSchema = z.object({
  intervalStartUtc: z.string(),
  intervalEndUtc: z.string(),
  resolutionMinutes: z.number().positive(),
  unit: z.enum(['MW', 'MWh', 'GWh']),
  quality: z.enum(['complete', 'incomplete']),
  coveragePct: z.number(),
  renewable: z.number(),
  nonRenewable: z.number(),
  storage: z.number(),
  unknown: z.number(),
  production: z.number(),
  renewableSharePct: z.number().nullable(),
  renewableExceedsNonRenewable: z.boolean().nullable(),
  technology: z.record(z.number()),
  consumption: z.number().nullable(),
  imports: z.number().nullable(),
  exports: z.number().nullable(),
})

const energyDaySchema = energyIntervalSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const energyMetaSchema = z.object({
  version: z.literal(ENERGY_CONTRACT_VERSION),
  area: z.literal('PT_CONTINENTAL'),
  source: z.string(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  taxonomy: z.string(),
  fetchedAtUtc: z.string(),
  generatedAtUtc: z.string(),
  freshness: z.enum(['latest_available', 'near_real_time']),
  maxAgeMinutes: z.number().positive(),
})

export const energyLatestSchema = energyMetaSchema.extend({
  latest: energyDaySchema,
})

export const energyDailySchema = energyMetaSchema.extend({
  days: z.array(energyDaySchema).min(1),
  total: energyIntervalSchema,
})

/** `intraday-latest.json` (ENTSO-E, MW). */
export const energyIntradayLatestSchema = energyMetaSchema.extend({
  latest: energyIntervalSchema,
})

/** `timeseries-24h.json` / `timeseries-7d.json` (ENTSO-E, MW horários; horas sem dados omitidas). */
export const energyTimeseriesSchema = energyMetaSchema.extend({
  range: z.enum(['24h', '7d', '30d']),
  points: z.array(energyIntervalSchema),
  backfillUtc: z.string().optional(),
})

// ── Erros ─────────────────────────────────────────────────────────────────

/** `network`: sem ligação/timeout; `http`: resposta ≠ 2xx; `invalid`: não segue o contrato. */
export type EnergyDataErrorKind = 'network' | 'http' | 'invalid'

export class EnergyDataError extends Error {
  readonly kind: EnergyDataErrorKind
  readonly status: number | null

  constructor(kind: EnergyDataErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'EnergyDataError'
    this.kind = kind
    this.status = status
  }
}

/** Para o `retry` do React Query: não repete respostas inválidas nem 404. */
export function shouldRetryEnergy(failureCount: number, error: unknown): boolean {
  if (error instanceof EnergyDataError && (error.kind === 'invalid' || error.status === 404)) return false
  return failureCount < 2
}

// ── Cliente ───────────────────────────────────────────────────────────────

export const ENERGY_RANGE_DAYS: Record<EnergyRange, number> = { '24h': 1, '7d': 7, '30d': 30 }

/**
 * Série de um período a partir do `daily.json`. No MVP só há dados diários: `24h` é o último dia
 * disponível (um ponto), `7d`/`30d` os últimos 7/30 dias.
 */
export function energyTimeseriesFromDaily(daily: EnergyDaily, range: EnergyRange): EnergyTimeseries {
  const { days, total: _total, ...meta } = daily
  return { ...meta, range, points: days.slice(-ENERGY_RANGE_DAYS[range]) }
}

export interface EnergyClientOptions {
  /** Pasta `data/` publicada (com ou sem `/` final), p. ex. `https://…/portugal-agora/data/`. */
  baseUrl: string
  fetch?: typeof fetch
}

export function createEnergyClient(options: EnergyClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/?$/, '/')
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init))

  async function get<T>(file: string, schema: z.ZodTypeAny): Promise<T> {
    let res: Response
    try {
      // `no-cache`: revalida sempre (ETag do Pages) para não mostrar um dia antigo da cache HTTP.
      res = await doFetch(`${baseUrl}energy/${file}`, { cache: 'no-cache', headers: { Accept: 'application/json' } })
    } catch {
      throw new EnergyDataError('network', 'Sem ligação para obter os dados de energia.')
    }
    if (!res.ok) {
      throw new EnergyDataError(
        'http',
        res.status === 404 ? 'Os dados de energia ainda não foram publicados.' : `Erro ao obter os dados de energia (HTTP ${res.status}).`,
        res.status,
      )
    }
    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new EnergyDataError('invalid', 'Os dados de energia publicados não são JSON válido.', res.status)
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) throw new EnergyDataError('invalid', 'Os dados de energia publicados têm um formato inesperado.', res.status)
    return parsed.data as T
  }

  const getEnergyDaily = () => get<EnergyDaily>('daily.json', energyDailySchema)

  return {
    /** Último dia disponível (`latest.json`, < 1 KB). */
    getLatestEnergy: () => get<EnergyLatest>('latest.json', energyLatestSchema),
    /** Últimos 30 dias e total do período (`daily.json`). */
    getEnergyDaily,
    async getEnergyTimeseries(range: EnergyRange): Promise<EnergyTimeseries> {
      return energyTimeseriesFromDaily(await getEnergyDaily(), range)
    },
    /** Última hora completa ENTSO-E (`intraday-latest.json`). */
    getIntradayLatest: () => get<EnergyIntradayLatest>('intraday-latest.json', energyIntradayLatestSchema),
    /** Série horária ENTSO-E das últimas 24 h ou 7 dias (`timeseries-24h.json` / `timeseries-7d.json`). */
    getIntradayTimeseries: (range: EnergyIntradayRange) =>
      get<EnergyTimeseries>(`timeseries-${range}.json`, energyTimeseriesSchema),
  }
}

export type EnergyClient = ReturnType<typeof createEnergyClient>

// ── Cache persistente ─────────────────────────────────────────────────────

export const ENERGY_CACHE_PREFIX = 'energy:v1:'
/** Abaixo disto a cache é usada sem pedido (o pipeline publica uma vez por dia). */
export const ENERGY_CACHE_FRESH_MS = 30 * 60 * 1000

export interface EnergyCached<T> {
  data: T
  /** Quando o dataset foi obtido da rede (ms). */
  savedAt: number
  /** `true` se a rede falhou e se mostra a última cópia guardada. */
  offline: boolean
  /** Erro da rede quando `offline`. */
  error: EnergyDataError | null
}

/**
 * Lê `key` da rede com cache persistente: cache com menos de `freshMs` evita o pedido; se a rede
 * falhar devolve a cache (mesmo expirada) com `offline: true`; sem cache propaga o erro.
 */
export async function loadEnergyCached<T>(options: {
  key: string
  fetch: () => Promise<T>
  storage?: KeyValueStorage | null
  schema: z.ZodTypeAny
  now?: () => number
  freshMs?: number
}): Promise<EnergyCached<T>> {
  const { storage, schema, now = Date.now, freshMs = ENERGY_CACHE_FRESH_MS } = options
  const key = `${ENERGY_CACHE_PREFIX}${options.key}`
  let cached: { savedAt: number; data: T } | null = null
  if (storage) {
    try {
      const raw = await storage.getItem(key)
      const entry = raw ? (JSON.parse(raw) as { savedAt?: unknown; data?: unknown }) : null
      const parsed = entry ? schema.safeParse(entry.data) : null
      if (parsed?.success && typeof entry?.savedAt === 'number') cached = { savedAt: entry.savedAt, data: parsed.data as T }
    } catch {
      cached = null
    }
  }
  if (cached && now() - cached.savedAt < freshMs) return { ...cached, offline: false, error: null }

  let data: T
  try {
    data = await options.fetch()
  } catch (err) {
    const error = err instanceof EnergyDataError ? err : new EnergyDataError('network', String(err))
    if (cached) return { ...cached, offline: true, error }
    throw error
  }
  const savedAt = now()
  if (storage) {
    try {
      await storage.setItem(key, JSON.stringify({ savedAt, data }))
    } catch {
      // Sem espaço/armazenamento indisponível: segue sem cache.
    }
  }
  return { data, savedAt, offline: false, error: null }
}

/** `daily.json` com cache persistente (ver `loadEnergyCached`). */
export function loadEnergyDailyCached(client: EnergyClient, storage?: KeyValueStorage | null, now?: () => number) {
  return loadEnergyCached<EnergyDaily>({ key: 'daily', fetch: client.getEnergyDaily, storage, schema: energyDailySchema, now })
}

/** `latest.json` com cache persistente (ver `loadEnergyCached`). */
export function loadEnergyLatestCached(client: EnergyClient, storage?: KeyValueStorage | null, now?: () => number) {
  return loadEnergyCached<EnergyLatest>({ key: 'latest', fetch: client.getLatestEnergy, storage, schema: energyLatestSchema, now })
}

/** Cache do intradiário abaixo disto não faz pedido (o pipeline publica de hora a hora). */
export const ENERGY_INTRADAY_CACHE_FRESH_MS = 10 * 60 * 1000

/** `timeseries-24h.json` / `timeseries-7d.json` com cache persistente (ver `loadEnergyCached`). */
export function loadEnergyIntradayCached(
  client: EnergyClient,
  range: EnergyIntradayRange,
  storage?: KeyValueStorage | null,
  now?: () => number,
) {
  return loadEnergyCached<EnergyTimeseries>({
    key: `intraday-${range}`,
    fetch: () => client.getIntradayTimeseries(range),
    storage,
    schema: energyTimeseriesSchema,
    now,
    freshMs: ENERGY_INTRADAY_CACHE_FRESH_MS,
  })
}
