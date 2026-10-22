// Gera os indicadores de urgência hospitalar do SNS (WEB-067) a partir do dataset
// `atividade-sindrome-gripal-csh` do Portal da Transparência do SNS (ACSS):
//   apps/web/public/data/sns/series.json   — últimos 90 dias, série compacta por região e indicador
//   apps/web/public/data/sns/metadata.json — indicadores, regiões, unidades, última observação, fonte e licença
//   apps/web/public/data/sns/status.json   — última sincronização com sucesso, última tentativa e erro
// Contrato e normalização no core (utils/snsUrgencias.ts), importado diretamente em Node (type
// stripping, Node ≥ 22.18).
//
// Corre no build/CI (deploy diário). Com `SNS_REUSE_PUBLISHED=true` (deploy de hora a hora) só
// republica os ficheiros já publicados no GitHub Pages; se não conseguir, faz a recolha completa.
// Se a recolha ou a validação falharem, republica o último conjunto válido do Pages e marca-o como
// possivelmente desatualizado; se também isso falhar, escreve só o `status.json` com `failed`.
// Nunca sai com erro, para não partir o `build:db` das outras secções.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  SNS_TRANSPARENCIA_PORTAL_URL,
  SNS_URGENCIAS_API_URL,
  SNS_URGENCIAS_ATTRIBUTION,
  SNS_URGENCIAS_CONTRACT_VERSION,
  SNS_URGENCIAS_DATASET,
  SNS_URGENCIAS_DATASET_TITLE,
  SNS_URGENCIAS_DATASET_URL,
  SNS_URGENCIAS_HISTORY_DAYS,
  SNS_URGENCIAS_INDICATOR_INFO,
  SNS_URGENCIAS_LICENSE,
  SNS_URGENCIAS_PUBLISHER,
  SNS_URGENCIAS_REGION_ORDER,
  SNS_URGENCIAS_TRANSFORMATIONS,
  addSnsDays,
  compactSnsObservations,
  describeSnsObservations,
  normalizeSnsEmergencyRecords,
  snsLisbonToday,
} from '../../../packages/core/src/utils/snsUrgencias.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../public/data')

export const DEFAULT_FALLBACK_BASE_URL = 'https://victor-candeias.github.io/portugal-agora/data/'
export const SNS_FILES = ['series.json', 'metadata.json', 'status.json']
const REQUIRED_FIELDS = ['periodo', 'ars', 'indicador', 'valor', 'unidade']
const REQUEST_TIMEOUT_MS = 30000
const MAX_ATTEMPTS = 3
const MAX_RETRY_AFTER_MS = 60000
/** Acima desta fração de registos inválidos a recolha é anulada (mudança de esquema provável). */
const MAX_INVALID_RATIO = 0.05
/** Mínimo de dias distintos para publicar um conjunto novo. */
const MIN_DISTINCT_DAYS = 7
const MAX_JSON_BYTES = 300 * 1024
const STATUS_ERROR_MAX_CHARS = 300
const USER_AGENT = 'portugal-agora-build (github.com/Victor-Candeias/portugal-agora)'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export class SnsHttpError extends Error {
  constructor(url, status) {
    super(`${url} respondeu HTTP ${status}`)
    this.name = 'SnsHttpError'
    this.status = status
    this.transient = status === 408 || status === 429 || status >= 500
  }
}

/** Espera pedida pelo `Retry-After` (segundos ou data HTTP), limitada a `MAX_RETRY_AFTER_MS`. */
function retryAfterMs(res) {
  const header = res.headers?.get?.('retry-after')
  if (!header) return null
  const seconds = Number(header)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - Date.now()
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), MAX_RETRY_AFTER_MS) : null
}

/**
 * GET com timeout e até `MAX_ATTEMPTS` tentativas só em falhas transitórias (rede, timeout, 408, 429
 * e 5xx). Outros HTTP e respostas que não são JSON falham logo.
 */
export async function fetchJsonWithRetry(url, { fetchImpl = fetch, retryDelayMs = 2000 } = {}) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res
    try {
      res = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (err) {
      const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      lastError = new Error(timeout ? `timeout (${REQUEST_TIMEOUT_MS / 1000} s) em ${url}` : `falha de rede em ${url}: ${err?.message ?? err}`)
      if (attempt < MAX_ATTEMPTS) await sleep(retryDelayMs * attempt)
      continue
    }
    if (!res.ok) {
      lastError = new SnsHttpError(url, res.status)
      if (!lastError.transient) throw lastError
      if (attempt < MAX_ATTEMPTS) await sleep(retryAfterMs(res) ?? retryDelayMs * attempt)
      continue
    }
    const text = await res.text()
    try {
      return JSON.parse(text.replace(/^\uFEFF/, ''))
    } catch {
      throw new Error(`${url} devolveu conteúdo que não é JSON: ${text.slice(0, 80)}`)
    }
  }
  throw lastError
}

/** `/exports/json` com os registos desde `fromDate` (inclusive), sem paginação. */
export function snsExportUrl(fromDate) {
  const params = new URLSearchParams({
    select: REQUIRED_FIELDS.join(','),
    where: `periodo >= date'${fromDate}'`,
    order_by: 'periodo',
  })
  return `${SNS_URGENCIAS_API_URL}/exports/json?${params}`
}

/** Valida a forma da resposta antes de normalizar; lança erro se o esquema mudou. */
export function validateSnsExport(records) {
  if (!Array.isArray(records)) throw new Error('A resposta do SNS não é uma lista de registos')
  if (records.length === 0) throw new Error('O SNS não devolveu registos para o período pedido')
  for (const field of REQUIRED_FIELDS) {
    const missing = records.filter(r => !r || typeof r !== 'object' || !(field in r)).length
    if (missing === records.length) throw new Error(`Campo «${field}» ausente em todos os registos (mudança de esquema?)`)
  }
}

/** Recolhe e valida os últimos `SNS_URGENCIAS_HISTORY_DAYS` dias. */
export async function collectSnsUrgencias({ now = Date.now(), fetchImpl = fetch, retryDelayMs = 2000, log = console } = {}) {
  const fromDate = addSnsDays(snsLisbonToday(now), -SNS_URGENCIAS_HISTORY_DAYS)
  const [records, datasetMeta] = await Promise.all([
    fetchJsonWithRetry(snsExportUrl(fromDate), { fetchImpl, retryDelayMs }),
    fetchJsonWithRetry(SNS_URGENCIAS_API_URL, { fetchImpl, retryDelayMs }).catch(err => {
      log.warn(`  ⚠ SNS: metadados do dataset indisponíveis (${err.message}); segue sem a data de alteração da fonte.`)
      return null
    }),
  ])
  validateSnsExport(records)
  const summary = normalizeSnsEmergencyRecords(records)
  if (summary.rejectedCount > 0) {
    log.warn(`  ⚠ SNS: ${summary.rejectedCount} registo(s) rejeitado(s) ${JSON.stringify(summary.rejected)}`)
  }
  if (summary.rejectedCount / records.length > MAX_INVALID_RATIO) {
    throw new Error(`${summary.rejectedCount} de ${records.length} registos inválidos (mudança de esquema?)`)
  }
  if (summary.duplicates > 0) log.warn(`  ⚠ SNS: ${summary.duplicates} registo(s) duplicado(s) pela chave lógica; ficou o último.`)
  const days = new Set(summary.observations.map(o => o.periodo))
  if (days.size < MIN_DISTINCT_DAYS) throw new Error(`Só ${days.size} dia(s) com dados (mínimo ${MIN_DISTINCT_DAYS})`)

  const described = describeSnsObservations(summary.observations)
  const unknownIndicators = described.indicators.map(i => i.indicador).filter(i => !(i in SNS_URGENCIAS_INDICATOR_INFO))
  const unknownRegions = described.regions.filter(r => !SNS_URGENCIAS_REGION_ORDER.includes(r))
  if (unknownIndicators.length) log.warn(`  ⚠ SNS: indicador(es) novo(s), publicados sem descrição: ${unknownIndicators.join('; ')}`)
  if (unknownRegions.length) log.warn(`  ⚠ SNS: região(ões) nova(s): ${unknownRegions.join('; ')}`)

  const metas = datasetMeta?.metas?.default ?? {}
  return {
    fromDate,
    observations: summary.observations,
    records: records.length,
    sourceLastModified: typeof metas.modified === 'string' ? metas.modified : null,
    sourceDataProcessed: typeof metas.data_processed === 'string' ? metas.data_processed : null,
  }
}

/** Monta `series.json` e `metadata.json` (contrato em utils/snsUrgencias.ts). */
export function buildSnsDatasets({ observations, fromDate, sourceLastModified, sourceDataProcessed, fetchedAtUtc, generatedAtUtc }) {
  const described = describeSnsObservations(observations)
  const series = {
    version: SNS_URGENCIAS_CONTRACT_VERSION,
    sourceDataset: SNS_URGENCIAS_DATASET,
    fetchedAtUtc,
    generatedAtUtc,
    fromDate,
    toDate: described.latestPeriod,
    series: compactSnsObservations(observations),
  }
  const metadata = {
    version: SNS_URGENCIAS_CONTRACT_VERSION,
    sourceDataset: SNS_URGENCIAS_DATASET,
    sourceName: `Portal da Transparência do SNS — ${SNS_URGENCIAS_DATASET_TITLE}`,
    publisher: SNS_URGENCIAS_PUBLISHER,
    portalUrl: SNS_TRANSPARENCIA_PORTAL_URL,
    datasetUrl: SNS_URGENCIAS_DATASET_URL,
    apiUrl: SNS_URGENCIAS_API_URL,
    license: SNS_URGENCIAS_LICENSE,
    attribution: SNS_URGENCIAS_ATTRIBUTION,
    transformations: SNS_URGENCIAS_TRANSFORMATIONS,
    sourceLastModified,
    sourceDataProcessed,
    fetchedAtUtc,
    generatedAtUtc,
    historyDays: SNS_URGENCIAS_HISTORY_DAYS,
    fromDate,
    toDate: described.latestPeriod,
    latestPeriod: described.latestPeriod,
    observations: observations.length,
    indicators: described.indicators,
    regions: described.regions,
  }
  return { series, metadata }
}

export function buildSnsStatus({ status, now = Date.now(), lastSuccessfulSyncAt, latestPeriod, error }) {
  return {
    version: SNS_URGENCIAS_CONTRACT_VERSION,
    generatedAtUtc: new Date().toISOString(),
    status,
    lastAttemptAt: new Date(now).toISOString(),
    lastSuccessfulSyncAt: lastSuccessfulSyncAt ?? null,
    latestPeriod: latestPeriod ?? null,
    possiblyStale: status !== 'fresh',
    error: error ? String(error.message ?? error).replace(/\s+/g, ' ').slice(0, STATUS_ERROR_MAX_CHARS) : null,
  }
}

function serialize(name, value) {
  const text = JSON.stringify(value)
  const bytes = Buffer.byteLength(text)
  if (bytes > MAX_JSON_BYTES) throw new Error(`${name} demasiado grande (${bytes} B > ${MAX_JSON_BYTES} B)`)
  return text
}

/** Escreve os ficheiros numa pasta temporária e só depois substitui os publicados. */
function writeOutputs(outDir, files) {
  const snsDir = path.join(outDir, 'sns')
  const tmpDir = path.join(outDir, '.sns.tmp')
  const texts = Object.entries(files).map(([name, json]) => [name, serialize(name, json)])
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  try {
    for (const [name, text] of texts) fs.writeFileSync(path.join(tmpDir, name), text)
    fs.mkdirSync(snsDir, { recursive: true })
    for (const [name] of texts) fs.renameSync(path.join(tmpDir, name), path.join(snsDir, name))
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
  return Object.fromEntries(texts.map(([name, text]) => [name, Buffer.byteLength(text)]))
}

function validatePublished(name, json) {
  if (json?.version !== SNS_URGENCIAS_CONTRACT_VERSION) throw new Error(`${name} publicado com versão inesperada`)
  if (name === 'series.json' && (json.sourceDataset !== SNS_URGENCIAS_DATASET || !Array.isArray(json.series) || json.series.length === 0)) {
    throw new Error('series.json publicado sem séries')
  }
  if (name === 'metadata.json' && (json.sourceDataset !== SNS_URGENCIAS_DATASET || !json.latestPeriod || !Array.isArray(json.indicators))) {
    throw new Error('metadata.json publicado sem indicadores')
  }
  if (name === 'status.json' && typeof json.status !== 'string') throw new Error('status.json publicado inválido')
}

/** Ficheiros já publicados no Pages (validados). O `status.json` é opcional, salvo se `requireStatus`. */
export async function fetchPublishedSns({ fallbackBaseUrl, fetchImpl = fetch, requireStatus = false }) {
  const base = fallbackBaseUrl.replace(/\/?$/, '/')
  const get = async name => {
    const res = await fetchImpl(`${base}sns/${name}`, { cache: 'no-cache', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`${base}sns/${name} respondeu ${res.status}`)
    const json = await res.json()
    validatePublished(name, json)
    return json
  }
  const published = { 'series.json': await get('series.json'), 'metadata.json': await get('metadata.json') }
  try {
    published['status.json'] = await get('status.json')
  } catch (err) {
    if (requireStatus) throw err
  }
  return published
}

export async function buildSnsUrgencias({
  outDir = PUBLIC_DATA_DIR,
  now = Date.now(),
  fetchImpl = fetch,
  fallbackBaseUrl = process.env.SNS_FALLBACK_BASE_URL || DEFAULT_FALLBACK_BASE_URL,
  reusePublished = process.env.SNS_REUSE_PUBLISHED === 'true',
  retryDelayMs = 2000,
  log = console,
} = {}) {
  if (reusePublished) {
    try {
      const published = await fetchPublishedSns({ fallbackBaseUrl, fetchImpl, requireStatus: true })
      writeOutputs(outDir, published)
      log.log(`✔ SNS: reutilizados os indicadores publicados (última observação ${published['metadata.json'].latestPeriod}).`)
      return { status: 'reused', statusJson: published['status.json'] }
    } catch (err) {
      log.warn(`⚠ SNS: não foi possível reutilizar o publicado (${err.message}); a recolher de novo...`)
    }
  }

  log.log(`→ SNS: a consultar o Portal da Transparência (${SNS_URGENCIAS_DATASET}, últimos ${SNS_URGENCIAS_HISTORY_DAYS} dias)...`)
  let error
  try {
    const fetchedAtUtc = new Date(now).toISOString()
    const collected = await collectSnsUrgencias({ now, fetchImpl, retryDelayMs, log })
    const { series, metadata } = buildSnsDatasets({ ...collected, fetchedAtUtc, generatedAtUtc: new Date().toISOString() })
    const status = buildSnsStatus({ status: 'fresh', now, lastSuccessfulSyncAt: fetchedAtUtc, latestPeriod: metadata.latestPeriod })
    const sizes = writeOutputs(outDir, { 'series.json': series, 'metadata.json': metadata, 'status.json': status })
    log.log(`✔ SNS: ${metadata.observations} observação(ões) de ${collected.records} registo(s), ${metadata.indicators.length} indicador(es), ` +
      `${metadata.regions.length} região(ões), de ${metadata.fromDate} a ${metadata.latestPeriod}; ` +
      `series.json ${(sizes['series.json'] / 1024).toFixed(1)} KB.`)
    reportSnsStatus(status, { log })
    return { status: 'fresh', series, metadata, statusJson: status }
  } catch (err) {
    error = err
  }

  log.warn(`⚠ SNS: recolha falhou (${error.message}); a republicar o último conjunto publicado...`)
  try {
    const published = await fetchPublishedSns({ fallbackBaseUrl, fetchImpl })
    const metadata = published['metadata.json']
    const status = buildSnsStatus({
      status: 'republished',
      now,
      lastSuccessfulSyncAt: published['status.json']?.lastSuccessfulSyncAt ?? metadata.fetchedAtUtc,
      latestPeriod: metadata.latestPeriod,
      error,
    })
    writeOutputs(outDir, { 'series.json': published['series.json'], 'metadata.json': metadata, 'status.json': status })
    log.warn(`⚠ SNS: republicado o conjunto de ${fallbackBaseUrl} (última observação ${metadata.latestPeriod}).`)
    reportSnsStatus(status, { log })
    return { status: 'republished', error, statusJson: status }
  } catch (fallbackErr) {
    log.warn(`⚠ SNS: sem indicadores publicados neste build (${fallbackErr.message}).`)
    const status = buildSnsStatus({ status: 'failed', now, lastSuccessfulSyncAt: null, latestPeriod: null, error })
    try {
      fs.rmSync(path.join(outDir, 'sns'), { recursive: true, force: true })
      writeOutputs(outDir, { 'status.json': status })
    } catch (writeErr) {
      log.warn(`⚠ SNS: status.json não escrito (${writeErr.message}).`)
    }
    reportSnsStatus(status, { log })
    return { status: 'failed', error, fallbackError: fallbackErr, statusJson: status }
  }
}

/** No GitHub Actions: `::warning` se a recolha não foi `fresh` e uma linha no resumo do job. */
export function reportSnsStatus(status, { log = console, env = process.env } = {}) {
  if (env.GITHUB_ACTIONS !== 'true') return
  if (status.status !== 'fresh') {
    const w = `SNS ${status.status}${status.error ? ` (${status.error})` : ''}`
    log.log(`::warning title=SNS urgências::${w.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`)
  }
  if (env.GITHUB_STEP_SUMMARY) {
    const cell = v => String(v ?? '—').replace(/\|/g, '\\|')
    const lines = [
      '### SNS — urgências hospitalares',
      '',
      '| Estado | Última sincronização | Última observação | Erro |',
      '|---|---|---|---|',
      `| ${status.status} | ${cell(status.lastSuccessfulSyncAt)} | ${cell(status.latestPeriod)} | ${cell(status.error)} |`,
      '',
    ]
    try {
      fs.appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n')
    } catch (err) {
      log.warn(`⚠ SNS: resumo do job não escrito (${err.message}).`)
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Uma falha nos indicadores do SNS nunca parte o build das outras secções.
  buildSnsUrgencias().catch(err => {
    console.warn(`⚠ SNS: erro inesperado (${err.message}).`)
  })
}
