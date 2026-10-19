// Série intradiária ENTSO-E (WEB-057) para o build-energy-db.mjs. Resultados da prova de dados,
// parâmetros e decisões em .maestru/specs/mobile/web-051-spec.md e web-057-spec.md.
//
// - Produção real por tipo (A75/A16), carga real (A65/A16) e fluxos físicos com Espanha (A11),
//   agregados a horas UTC em MW (média ponderada pela duração; aceita PT15M/PT30M/PT60M).
// - curveType A03: um ponto vale até ao ponto seguinte (o último até ao fim do Period).
// - Uma hora sem dados é omitida (nunca zero); uma hora com parte dos PSR em falta fica
//   `incomplete`. Os PSR esperados são os que aparecem na janela pedida.
// - O token (secret `TRANSPARENCT_ENTSOE_TOKEN`) vai no cabeçalho `SECURITY_TOKEN` e é retirado
//   das mensagens de erro.
import {
  ENERGY_CONTRACT_VERSION,
  ENTSOE_MAX_AGE_MINUTES,
  ENTSOE_PSR_TAXONOMY,
  mapEnergyCode,
  parseResolutionMinutes,
  roundEnergyValue,
  summarizeEnergy,
  taxonomyTag,
} from '../../../packages/core/src/utils/energy.ts'

export const ENTSOE_API_URL = 'https://web-api.tp.entsoe.eu/api'
export const ENTSOE_TOKEN_ENV = 'TRANSPARENCT_ENTSOE_TOKEN'
export const PT_EIC = '10YPT-REN------W'
export const ES_EIC = '10YES-REE------0'
/** Dias pedidos no backfill diário (7 d publicados + margem para o dia de Lisboa e revisões). */
export const ENTSOE_WINDOW_DAYS = 8
/** Dias pedidos nas execuções horárias (juntam-se à série de 7 d já publicada). */
export const ENTSOE_INCREMENTAL_DAYS = 2
/** Intervalo entre backfills completos (as execuções horárias só revêm as últimas 48 h). */
export const ENTSOE_BACKFILL_EVERY_HOURS = 20
const HOUR_MS = 3600000
/** A API é lenta (8–90 s por pedido) e responde 599 a pedidos em paralelo: um de cada vez. */
const REQUEST_TIMEOUT_MS = 180000
/** Orçamento total da recolha; depois disso os pedidos opcionais são saltados. */
const COLLECT_BUDGET_MS = 10 * 60000
const MIN_INTERVALS = 24
const AREA = 'PT_CONTINENTAL'
export const ENTSOE_SOURCE = 'ENTSOE'
const SOURCE_NAME = 'ENTSO-E Transparency Platform — produção real por tipo, carga e fluxos físicos'
const SOURCE_URL = 'https://transparency.entsoe.eu/'
export const ENTSOE_FILES = ['intraday-latest.json', 'timeseries-24h.json', 'timeseries-7d.json']

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export class EntsoeAuthError extends Error {
  constructor(status) {
    super(`ENTSO-E recusou o token (HTTP ${status})`)
    this.name = 'EntsoeAuthError'
    this.status = status
  }
}

/** Retira o token de qualquer mensagem (logs, status.json). */
export function sanitizeEntsoe(message, token) {
  let text = String(message ?? '')
  if (token) text = text.split(token).join('***')
  return text.replace(/securityToken=[^&\s]+/gi, 'securityToken=***')
}

/** `202610190000` (UTC, formato da API). */
export function entsoePeriod(ms) {
  return new Date(ms).toISOString().slice(0, 16).replace(/[-T:]/g, '')
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const tag = (xml, name) => new RegExp(`<${escapeRe(name)}(?:\\s[^>]*)?>([^<]*)</${escapeRe(name)}>`).exec(xml)?.[1]?.trim()

/** `<Reason><code>` e `<text>` de um `Acknowledgement_MarketDocument`, ou `null`. */
export function entsoeAcknowledgement(xml) {
  if (!/<Acknowledgement_MarketDocument/.test(xml)) return null
  const reason = /<Reason>([\s\S]*?)<\/Reason>/.exec(xml)?.[1] ?? ''
  return { code: tag(reason, 'code') ?? '', text: tag(reason, 'text') ?? '' }
}

/**
 * Pede um documento à API. Devolve o XML, ou `null` se a ENTSO-E responder «No matching data»
 * (código 999) em todas as tentativas (o 999 também aparece por instantes com a API sob carga).
 * 401/403 → `EntsoeAuthError` (sem repetir); 429/5xx/599/rede repetem até `retries`.
 */
export async function fetchEntsoeDocument(params, {
  token,
  fetchImpl = fetch,
  retries = 3,
  retryDelayMs = 5000,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  const url = `${ENTSOE_API_URL}?${new URLSearchParams(params)}`
  let lastError
  let noData = false
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: {
          SECURITY_TOKEN: token,
          Accept: 'application/xml',
          'User-Agent': 'portugal-agora-build (github.com/Victor-Candeias/portugal-agora)',
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const text = await res.text()
      if (res.status === 401 || res.status === 403) throw new EntsoeAuthError(res.status)
      const ack = entsoeAcknowledgement(text)
      if (ack?.code === '999') {
        const err = new Error('ENTSO-E sem dados (999)')
        err.noData = true
        throw err
      }
      if (res.status === 429 || res.status >= 500) throw new Error(`ENTSO-E respondeu ${res.status}`)
      if (!res.ok || ack) {
        const err = new Error(`ENTSO-E respondeu ${res.status}${ack ? ` (${ack.code}: ${ack.text.slice(0, 120)})` : ''}`)
        err.permanent = true
        throw err
      }
      if (!/<(GL|Publication)_MarketDocument/.test(text)) {
        const err = new Error(`ENTSO-E devolveu um documento inesperado: ${text.slice(0, 80)}`)
        err.permanent = true
        throw err
      }
      return text
    } catch (err) {
      if (err instanceof EntsoeAuthError || err.permanent) throw err
      noData = err.noData === true
      lastError = err
      if (attempt < retries) await sleep(retryDelayMs * attempt)
    }
  }
  if (noData) return null
  throw lastError
}

/**
 * Séries de um documento: `{ psrType, inDomain, outDomain, curveType, periods: [{ startMs, endMs,
 * resolutionMinutes, points: [{ position, value }] }] }`. Em A75 `inDomain` vem de
 * `inBiddingZone_Domain` (produção) e `outDomain` de `outBiddingZone_Domain` (consumo das unidades).
 */
export function parseEntsoeDocument(xml) {
  const series = []
  for (const [, ts] of xml.matchAll(/<TimeSeries>([\s\S]*?)<\/TimeSeries>/g)) {
    const periods = []
    for (const [, period] of ts.matchAll(/<Period>([\s\S]*?)<\/Period>/g)) {
      const startMs = Date.parse(tag(period, 'start') ?? '')
      const endMs = Date.parse(tag(period, 'end') ?? '')
      const resolutionMinutes = parseResolutionMinutes(tag(period, 'resolution') ?? '')
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || !resolutionMinutes) {
        throw new Error('ENTSO-E: Period com início, fim ou resolução inválidos')
      }
      const points = []
      for (const [, point] of period.matchAll(/<Point>([\s\S]*?)<\/Point>/g)) {
        const position = Number(tag(point, 'position'))
        const value = Number(tag(point, 'quantity') ?? tag(point, 'price.amount'))
        if (!Number.isInteger(position) || position < 1 || !Number.isFinite(value)) {
          throw new Error('ENTSO-E: Point com posição ou valor inválidos')
        }
        points.push({ position, value })
      }
      points.sort((a, b) => a.position - b.position)
      periods.push({ startMs, endMs, resolutionMinutes, points })
    }
    series.push({
      psrType: tag(ts, 'psrType') ?? null,
      inDomain: tag(ts, 'inBiddingZone_Domain.mRID') ?? tag(ts, 'in_Domain.mRID') ?? null,
      outDomain: tag(ts, 'outBiddingZone_Domain.mRID') ?? tag(ts, 'out_Domain.mRID') ?? null,
      curveType: tag(ts, 'curveType') ?? 'A01',
      periods,
    })
  }
  return series
}

/**
 * Segmentos `{ startMs, endMs, value }` de uma série. A03: cada ponto vale até à posição do ponto
 * seguinte (o último até ao fim do Period); A01: cada ponto vale uma resolução.
 */
export function expandSeries(series) {
  const segments = []
  for (const { startMs, endMs, resolutionMinutes, points } of series.periods) {
    const step = resolutionMinutes * 60000
    const count = Math.round((endMs - startMs) / step)
    for (let i = 0; i < points.length; i++) {
      const { position, value } = points[i]
      if (position > count) continue
      const until = series.curveType === 'A03' ? Math.min(points[i + 1]?.position ?? count + 1, count + 1) : position + 1
      segments.push({ startMs: startMs + (position - 1) * step, endMs: startMs + (until - 1) * step, value })
    }
  }
  return segments
}

/**
 * Média horária (UTC) ponderada pela duração. Só devolve as horas cobertas a 100%; uma hora com
 * sobreposição (mais de 60 min de dados) é descartada.
 */
export function hourlyMeans(segments) {
  const acc = new Map()
  for (const { startMs, endMs, value } of segments) {
    for (let hour = Math.floor(startMs / HOUR_MS) * HOUR_MS; hour < endMs; hour += HOUR_MS) {
      const overlap = Math.min(endMs, hour + HOUR_MS) - Math.max(startMs, hour)
      if (overlap <= 0) continue
      const entry = acc.get(hour) ?? { sum: 0, covered: 0 }
      entry.sum += value * overlap
      entry.covered += overlap
      acc.set(hour, entry)
    }
  }
  const out = new Map()
  for (const [hour, { sum, covered }] of acc) if (Math.abs(covered - HOUR_MS) < 1) out.set(hour, sum / HOUR_MS)
  return out
}

/** Horas por PSR de produção (só séries `inBiddingZone_Domain` de Portugal). */
export function generationByPsr(series) {
  const byPsr = new Map()
  for (const s of series) {
    if (!s.psrType || s.inDomain !== PT_EIC) continue
    const list = byPsr.get(s.psrType) ?? []
    list.push(...expandSeries(s))
    byPsr.set(s.psrType, list)
  }
  return new Map([...byPsr].map(([psr, segments]) => [psr, hourlyMeans(segments)]))
}

/** Uma série horária (carga ou fluxo) a partir de todas as séries do documento. */
export function hourlySeries(series) {
  return hourlyMeans(series.flatMap(expandSeries))
}

const mw = v => roundEnergyValue(v, 1)

/**
 * Intervalos horários (`EnergyInterval` em MW) por ordem crescente, de `fromMs` a `toMs`. Uma hora
 * só é `complete` se todos os PSR esperados tiverem valor, sem PSR desconhecidos ≠ 0 e com produção
 * positiva. Horas sem nenhum PSR são omitidas.
 */
export function buildEntsoeIntervals({ generation, load, imports, exports }, { fromMs, toMs }) {
  const expected = [...generation.keys()].sort()
  const intervals = []
  for (let hour = Math.ceil(fromMs / HOUR_MS) * HOUR_MS; hour + HOUR_MS <= toMs; hour += HOUR_MS) {
    const present = expected.filter(psr => generation.get(psr).has(hour))
    if (present.length === 0) continue
    const technology = {}
    const classifications = {}
    for (const psr of present) {
      const mapping = mapEnergyCode(ENTSOE_PSR_TAXONOMY, psr)
      if (mapping.kind !== 'technology' && mapping.kind !== 'unknown') continue
      technology[mapping.technology] = (technology[mapping.technology] ?? 0) + generation.get(psr).get(hour)
      classifications[mapping.technology] = mapping.classification
    }
    const missing = expected.filter(psr => !generation.get(psr).has(hour))
    const summary = summarizeEnergy([
      ...Object.entries(technology).map(([tech, value]) => ({ technology: tech, classification: classifications[tech], value })),
      ...missing.map(psr => ({ technology: psr, classification: 'unknown', value: null })),
    ])
    const complete = summary.quality === 'complete'
    intervals.push({
      intervalStartUtc: new Date(hour).toISOString(),
      intervalEndUtc: new Date(hour + HOUR_MS).toISOString(),
      resolutionMinutes: 60,
      unit: 'MW',
      quality: complete ? 'complete' : 'incomplete',
      coveragePct: roundEnergyValue((100 * present.length) / expected.length, 2),
      renewable: mw(summary.renewable),
      nonRenewable: mw(summary.nonRenewable),
      storage: mw(summary.storage),
      unknown: mw(summary.unknown),
      production: mw(summary.total),
      renewableSharePct: summary.renewableSharePct,
      renewableExceedsNonRenewable: complete ? summary.renewableExceedsNonRenewable : null,
      technology: Object.fromEntries(Object.entries(technology).map(([tech, value]) => [tech, mw(value)])),
      consumption: load.has(hour) ? mw(load.get(hour)) : null,
      imports: imports.has(hour) ? mw(imports.get(hour)) : null,
      exports: exports.has(hour) ? mw(exports.get(hour)) : null,
    })
  }
  return intervals
}

/**
 * Recolhe A75, A65 e os fluxos ES↔PT dos últimos `days` dias até à hora atual, um pedido de cada
 * vez. A produção é obrigatória; carga e fluxos em falta ficam a `null` (avisos em `warnings`).
 */
export async function collectEntsoe({
  token,
  days = ENTSOE_WINDOW_DAYS,
  now = Date.now(),
  fetchImpl = fetch,
  retryDelayMs = 5000,
  budgetMs = COLLECT_BUDGET_MS,
  log = console,
} = {}) {
  const startedAt = Date.now()
  const toMs = Math.floor(now / HOUR_MS) * HOUR_MS
  const fromMs = toMs - days * 24 * HOUR_MS
  const period = { periodStart: entsoePeriod(fromMs), periodEnd: entsoePeriod(toMs) }
  const opts = { token, fetchImpl, retryDelayMs }
  const queries = {
    generation: { documentType: 'A75', processType: 'A16', in_Domain: PT_EIC, ...period },
    load: { documentType: 'A65', processType: 'A16', outBiddingZone_Domain: PT_EIC, ...period },
    imports: { documentType: 'A11', in_Domain: PT_EIC, out_Domain: ES_EIC, ...period },
    exports: { documentType: 'A11', in_Domain: ES_EIC, out_Domain: PT_EIC, ...period },
  }
  const warnings = []
  const docs = {}
  for (const [name, params] of Object.entries(queries)) {
    docs[name] = []
    if (name !== 'generation' && Date.now() - startedAt > budgetMs) {
      warnings.push(`${name}: saltado (recolha excedeu ${Math.round(budgetMs / 60000)} min)`)
      continue
    }
    try {
      const xml = await fetchEntsoeDocument(params, opts)
      if (xml !== null) docs[name] = parseEntsoeDocument(xml)
      else if (name !== 'generation') warnings.push(`${name}: sem dados`)
    } catch (err) {
      if (name === 'generation' || err instanceof EntsoeAuthError) throw err
      warnings.push(`${name}: ${sanitizeEntsoe(err.message, token)}`)
    }
  }
  const generation = generationByPsr(docs.generation)
  if (generation.size === 0) throw new Error('ENTSO-E sem produção por tipo para Portugal na janela pedida')
  const unknownPsr = [...generation.keys()].filter(psr => !(psr in ENTSOE_PSR_TAXONOMY.technologies))
  if (unknownPsr.length > 0) warnings.push(`PSR desconhecidos: ${unknownPsr.join(', ')}`)
  const intervals = buildEntsoeIntervals(
    {
      generation,
      load: hourlySeries(docs.load),
      imports: hourlySeries(docs.imports),
      exports: hourlySeries(docs.exports),
    },
    { fromMs, toMs },
  )
  if (intervals.length < MIN_INTERVALS) throw new Error(`Só ${intervals.length} hora(s) da ENTSO-E (mínimo ${MIN_INTERVALS})`)
  if (!intervals.some(i => i.quality === 'complete')) throw new Error('ENTSO-E sem nenhuma hora completa')
  for (const w of warnings) log.warn(`  ⚠ ENTSO-E ${w}`)
  return { intervals, warnings, fromMs, toMs }
}

/**
 * Junta as horas acabadas de recolher às publicadas antes de `fromMs` (execução horária
 * incremental). As horas da janela nova substituem as antigas (revisões).
 */
export function mergeEntsoeIntervals(previous, fresh, fromMs) {
  const kept = (previous ?? []).filter(i => Date.parse(i.intervalStartUtc) < fromMs)
  return [...kept, ...fresh].sort((a, b) => Date.parse(a.intervalStartUtc) - Date.parse(b.intervalStartUtc))
}

/** `true` se o backfill completo (8 dias) já tiver mais de `ENTSOE_BACKFILL_EVERY_HOURS`. */
export function entsoeNeedsBackfill(published7d, now = Date.now()) {
  const last = Date.parse(published7d?.backfillUtc ?? '')
  return !Array.isArray(published7d?.points) || !Number.isFinite(last) || now - last >= ENTSOE_BACKFILL_EVERY_HOURS * HOUR_MS
}

/**
 * Ficheiros publicados: `intraday-latest.json` (última hora completa), `timeseries-24h.json` e
 * `timeseries-7d.json` (horas que começam nas últimas 24 h / 7 dias a contar do fim da última hora
 * com dados; horas sem dados omitidas). `backfillUtc`: último backfill completo.
 */
export function buildEntsoeDatasets({ intervals, fetchedAtUtc, generatedAtUtc, backfillUtc }) {
  const meta = {
    version: ENERGY_CONTRACT_VERSION,
    area: AREA,
    source: ENTSOE_SOURCE,
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    taxonomy: taxonomyTag(ENTSOE_PSR_TAXONOMY),
    fetchedAtUtc,
    generatedAtUtc,
    freshness: 'near_real_time',
    maxAgeMinutes: ENTSOE_MAX_AGE_MINUTES,
  }
  const lastEnd = Date.parse(intervals[intervals.length - 1].intervalEndUtc)
  const since = hours => intervals.filter(i => Date.parse(i.intervalStartUtc) >= lastEnd - hours * HOUR_MS)
  const latest = [...intervals].reverse().find(i => i.quality === 'complete') ?? intervals[intervals.length - 1]
  return {
    'intraday-latest.json': { ...meta, latest },
    'timeseries-24h.json': { ...meta, range: '24h', points: since(24) },
    'timeseries-7d.json': { ...meta, range: '7d', ...(backfillUtc ? { backfillUtc } : {}), points: since(7 * 24) },
  }
}
/** Valida um ficheiro intradiário já publicado antes de o republicar. */
export function validatePublishedEntsoe(name, json) {
  if (json?.version !== ENERGY_CONTRACT_VERSION || json.source !== ENTSOE_SOURCE) throw new Error(`${name} publicado com contrato inesperado`)
  if (name === 'intraday-latest.json' && !json.latest?.intervalEndUtc) throw new Error(`${name} publicado sem intervalo`)
  if (name !== 'intraday-latest.json' && !Array.isArray(json.points)) throw new Error(`${name} publicado sem pontos`)
}
