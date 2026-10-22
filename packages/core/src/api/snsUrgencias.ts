// Cliente dos indicadores de urgência hospitalar do SNS publicados pelo coletor (WEB-067) no GitHub
// Pages: `sns/series.json`, `sns/metadata.json` e `sns/status.json`. Contrato e funções puras em
// utils/snsUrgencias.ts. Sem dependências de plataforma: `fetch` e a URL base são injetados (o mobile
// usa `STATIC_DATA_BASE_URL`, MOB-021).
import { z } from 'zod'
import {
  SNS_URGENCIAS_CONTRACT_VERSION,
  expandSnsSeries,
  type SnsEmergencyObservation,
  type SnsUrgenciasMetadata,
  type SnsUrgenciasSeries,
  type SnsUrgenciasStatus,
} from '../utils/snsUrgencias.js'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const snsUrgenciasSeriesSchema = z.object({
  version: z.literal(SNS_URGENCIAS_CONTRACT_VERSION),
  sourceDataset: z.string(),
  fetchedAtUtc: z.string(),
  generatedAtUtc: z.string(),
  fromDate: dateSchema,
  toDate: dateSchema,
  series: z.array(
    z.object({
      ars: z.string(),
      indicador: z.string(),
      unidade: z.string(),
      points: z.array(z.tuple([dateSchema, z.number()])),
    }),
  ),
})

export const snsUrgenciasMetadataSchema = z.object({
  version: z.literal(SNS_URGENCIAS_CONTRACT_VERSION),
  sourceDataset: z.string(),
  sourceName: z.string(),
  publisher: z.string(),
  portalUrl: z.string(),
  datasetUrl: z.string(),
  apiUrl: z.string(),
  license: z.object({ name: z.string(), url: z.string(), conditions: z.array(z.string()) }),
  attribution: z.string(),
  transformations: z.string(),
  sourceLastModified: z.string().nullable(),
  sourceDataProcessed: z.string().nullable(),
  fetchedAtUtc: z.string(),
  generatedAtUtc: z.string(),
  historyDays: z.number().int().positive(),
  fromDate: dateSchema,
  toDate: dateSchema,
  latestPeriod: dateSchema,
  observations: z.number().int().nonnegative(),
  indicators: z.array(
    z.object({ indicador: z.string(), unidade: z.string(), regions: z.array(z.string()), latestPeriod: dateSchema }),
  ),
  regions: z.array(z.string()),
})

export const snsUrgenciasStatusSchema = z.object({
  version: z.literal(SNS_URGENCIAS_CONTRACT_VERSION),
  generatedAtUtc: z.string(),
  status: z.enum(['fresh', 'republished', 'failed']),
  lastAttemptAt: z.string(),
  lastSuccessfulSyncAt: z.string().nullable(),
  latestPeriod: dateSchema.nullable(),
  possiblyStale: z.boolean(),
  error: z.string().nullable(),
})

/** `network`: sem ligação/timeout; `http`: resposta ≠ 2xx; `invalid`: não segue o contrato. */
export type SnsUrgenciasDataErrorKind = 'network' | 'http' | 'invalid'

export class SnsUrgenciasDataError extends Error {
  readonly kind: SnsUrgenciasDataErrorKind
  readonly status: number | null

  constructor(kind: SnsUrgenciasDataErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'SnsUrgenciasDataError'
    this.kind = kind
    this.status = status
  }
}

/** Para o `retry` do React Query: não repete respostas inválidas nem 404. */
export function shouldRetrySnsUrgencias(failureCount: number, error: unknown): boolean {
  if (error instanceof SnsUrgenciasDataError && (error.kind === 'invalid' || error.status === 404)) return false
  return failureCount < 2
}

export interface SnsUrgenciasClientOptions {
  /** Pasta `data/` publicada (com ou sem `/` final), p. ex. `https://…/portugal-agora/data/`. */
  baseUrl: string
  fetch?: typeof fetch
}

export function createSnsUrgenciasClient(options: SnsUrgenciasClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/?$/, '/')
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init))

  async function get<T>(file: string, schema: z.ZodTypeAny): Promise<T> {
    let res: Response
    try {
      res = await doFetch(`${baseUrl}sns/${file}`, { cache: 'no-cache', headers: { Accept: 'application/json' } })
    } catch {
      throw new SnsUrgenciasDataError('network', 'Sem ligação para obter os indicadores do SNS.')
    }
    if (!res.ok) {
      throw new SnsUrgenciasDataError(
        'http',
        res.status === 404
          ? 'Os indicadores de urgência do SNS ainda não foram publicados.'
          : `Erro ao obter os indicadores do SNS (HTTP ${res.status}).`,
        res.status,
      )
    }
    let json: unknown
    try {
      json = await res.json()
    } catch {
      throw new SnsUrgenciasDataError('invalid', 'Os indicadores do SNS publicados não são JSON válido.', res.status)
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) throw new SnsUrgenciasDataError('invalid', 'Os indicadores do SNS publicados têm um formato inesperado.', res.status)
    return parsed.data as T
  }

  const getSeries = () => get<SnsUrgenciasSeries>('series.json', snsUrgenciasSeriesSchema)

  return {
    /** Série compacta dos últimos 90 dias (`series.json`). */
    getSeries,
    /** `series.json` expandido em observações (`SnsEmergencyObservation`). */
    async getObservations(): Promise<SnsEmergencyObservation[]> {
      return expandSnsSeries(await getSeries())
    },
    /** Indicadores, regiões, unidades, fonte e licença (`metadata.json`). */
    getMetadata: () => get<SnsUrgenciasMetadata>('metadata.json', snsUrgenciasMetadataSchema),
    /** Estado da última sincronização (`status.json`). */
    getStatus: () => get<SnsUrgenciasStatus>('status.json', snsUrgenciasStatusSchema),
  }
}

export type SnsUrgenciasClient = ReturnType<typeof createSnsUrgenciasClient>
