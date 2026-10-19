// Gera os dados de energia elétrica (WEB-053) a partir da REN Data Hub:
//   apps/web/public/data/energy/daily.json   — últimos 30 dias (GWh, quota renovável ponderada)
//   apps/web/public/data/energy/latest.json  — último dia disponível (`freshness: latest_available`)
//   apps/web/public/data/energy.sqlite       — energy_observation + energy_balance + meta
// Fonte canónica: `ElectricityConsumptionSupplyDaily` (balanço diário oficial, GWh inteiros), ver
// .maestru/specs/mobile/web-050-spec.md. Regras de cálculo e contrato no core (energy.ts), importado
// diretamente em Node (type stripping, Node ≥ 22.18).
//
// Corre em Node no build/CI, nunca no browser (a REN não tem CORS). Se a recolha ou a validação
// falharem, republica os ficheiros já publicados no GitHub Pages (último dataset válido); se também
// isso falhar, não escreve nada e sai com 0 para não partir o `build:db` das outras secções.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import {
  ENERGY_CONTRACT_VERSION,
  REN_DAILY_MAX_AGE_MINUTES,
  REN_DAILY_TAXONOMY,
  addCalendarDays,
  aggregateEnergy,
  lisbonDate,
  lisbonDayBoundsUtc,
  mapEnergyCode,
  roundEnergyValue,
  summarizeEnergy,
  taxonomyTag,
} from '../../../packages/core/src/utils/energy.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../public/data')

export const REN_BASE_URL = 'https://servicebus.ren.pt/datahubapi/electricity/'
export const REN_OPERATION = 'ElectricityConsumptionSupplyDaily'
export const DEFAULT_FALLBACK_BASE_URL = 'https://victor-candeias.github.io/portugal-agora/data/'
export const DAYS = 30
/** Dias mais recentes que podem ainda não estar publicados (a REN publica o dia D em D+1). */
const MAX_UNPUBLISHED_RECENT_DAYS = 2
/** Mínimo de dias válidos para publicar um dataset novo. */
const MIN_VALID_DAYS = 7
const MAX_JSON_BYTES = 200 * 1024
const REQUEST_TIMEOUT_MS = 30000
const CONCURRENCY = 4
const AREA = 'PT_CONTINENTAL'
const SOURCE = 'REN'
const SOURCE_NAME = 'REN Data Hub — Balanço energético diário'
const SOURCE_URL = 'https://datahub.ren.pt/'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export class RenNoDataError extends Error {
  constructor(date) {
    super(`REN sem dados para ${date}`)
    this.name = 'RenNoDataError'
    this.date = date
  }
}

/** Um dia da REN; 404 → `RenNoDataError`; outros erros repetem até 3 vezes. */
export async function fetchRenDay(date, { fetchImpl = fetch, retries = 3, retryDelayMs = 2000 } = {}) {
  const url = `${REN_BASE_URL}${REN_OPERATION}?culture=pt-PT&date=${date}`
  let lastError
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'portugal-agora-build (github.com/Victor-Candeias/portugal-agora)' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const text = await res.text()
      if (res.status === 404) throw new RenNoDataError(date)
      if (!res.ok) throw new Error(`REN respondeu ${res.status} para ${date}`)
      let json
      try {
        json = JSON.parse(text.replace(/^\uFEFF/, ''))
      } catch {
        throw new Error(`REN devolveu conteúdo que não é JSON para ${date}: ${text.slice(0, 80)}`)
      }
      return json
    } catch (err) {
      if (err instanceof RenNoDataError) throw err
      lastError = err
      if (attempt < retries) await sleep(retryDelayMs * attempt)
    }
  }
  throw lastError
}

/**
 * Valida e normaliza a resposta de um dia (GWh). Lança erro se o formato for inesperado; avisos
 * (soma vs total oficial, códigos novos, negativos) ficam em `warnings` e tornam o dia `incomplete`
 * quando afetam o resultado.
 */
export function parseRenDay(date, json) {
  if (!Array.isArray(json) || json.length === 0) throw new Error(`Resposta inesperada da REN para ${date}`)
  const values = new Map()
  for (const item of json) {
    if (!item || typeof item.type !== 'string' || !('daily_Accumulation' in item)) {
      throw new Error(`Item inesperado na REN para ${date}: ${JSON.stringify(item).slice(0, 80)}`)
    }
    const v = item.daily_Accumulation
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v))) {
      throw new Error(`Valor inválido na REN para ${date}/${item.type}: ${v}`)
    }
    if (values.has(item.type)) throw new Error(`Tipo duplicado na REN para ${date}: ${item.type}`)
    values.set(item.type, v)
  }

  const warnings = []
  const technology = {}
  const classifications = {}
  const balance = {}
  for (const [code, value] of values) {
    const mapping = mapEnergyCode(REN_DAILY_TAXONOMY, code)
    if (mapping.kind === 'technology' || mapping.kind === 'unknown') {
      if (mapping.kind === 'unknown') warnings.push(`código desconhecido ${code}=${value}`)
      technology[mapping.technology] = value
      classifications[mapping.technology] = mapping.classification
    } else if (mapping.kind === 'balance') {
      balance[mapping.field] = value
    }
  }
  if (Object.keys(technology).length === 0) throw new Error(`REN sem tecnologias para ${date}`)

  const summary = summarizeEnergy(
    Object.entries(technology).map(([tech, value]) => ({ technology: tech, classification: classifications[tech], value })),
  )
  for (const tech of summary.negative) if (tech !== 'hydro') warnings.push(`valor negativo ${tech}=${technology[tech]}`)

  // Os valores vêm arredondados a 1 GWh: a soma pode diferir do total oficial em ±0,5 por parcela.
  let consistent = true
  const check = (code, actual, count) => {
    const official = values.get(code)
    if (typeof official !== 'number') return
    const tolerance = 0.5 * count + 0.5
    if (Math.abs(official - actual) > tolerance) {
      consistent = false
      warnings.push(`${code}=${official} difere da soma ${actual} (tolerância ${tolerance})`)
    }
  }
  const countOf = cls => Object.values(classifications).filter(c => c === cls).length
  check('PRODUCAO_RENOVAVEL', summary.renewable, countOf('renewable'))
  check('PRODUCAO_NAO_RENOVAVEL', summary.nonRenewable, countOf('non_renewable'))
  check('PRODUCAO_TOTAL', summary.total, Object.keys(technology).length)

  const bounds = lisbonDayBoundsUtc(date)
  const complete = summary.quality === 'complete' && consistent
  return {
    day: {
      date,
      intervalStartUtc: bounds.intervalStartUtc,
      intervalEndUtc: bounds.intervalEndUtc,
      resolutionMinutes: bounds.minutes,
      unit: 'GWh',
      quality: complete ? 'complete' : 'incomplete',
      coveragePct: 100,
      renewable: summary.renewable,
      nonRenewable: summary.nonRenewable,
      storage: summary.storage,
      unknown: summary.unknown,
      production: summary.total,
      renewableSharePct: summary.renewableSharePct,
      renewableExceedsNonRenewable: complete ? summary.renewableExceedsNonRenewable : null,
      technology: Object.fromEntries(Object.entries(technology).filter(([, v]) => v !== null)),
      consumption: balance.consumption ?? null,
      imports: balance.imports ?? null,
      exports: balance.exports ?? null,
    },
    classifications,
    balance,
    warnings,
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i], i)
      }
    }),
  )
  return results
}

/**
 * Pede os últimos `DAYS` dias publicados (de ontem para trás, hora de Lisboa). Os dias mais
 * recentes podem ainda não existir (404); um 404 mais antigo fica como dia em falta.
 */
export async function collectRenDays({ now = Date.now(), fetchImpl = fetch, retryDelayMs = 2000, log = console } = {}) {
  const yesterday = addCalendarDays(lisbonDate(now), -1)
  const dates = Array.from({ length: DAYS + MAX_UNPUBLISHED_RECENT_DAYS }, (_, i) => addCalendarDays(yesterday, -i))
  const results = await mapLimit(dates, CONCURRENCY, async date => {
    try {
      return { date, parsed: parseRenDay(date, await fetchRenDay(date, { fetchImpl, retryDelayMs })) }
    } catch (err) {
      if (err instanceof RenNoDataError) return { date, missing: true }
      throw err
    }
  })
  // Descarta os dias recentes ainda por publicar e fica com a janela de DAYS dias a partir do mais recente.
  let start = 0
  while (start < MAX_UNPUBLISHED_RECENT_DAYS && results[start]?.missing) start++
  const window = results.slice(start, start + DAYS)
  const missing = window.filter(r => r.missing).map(r => r.date)
  if (missing.length > 0) log.warn(`  ⚠ REN sem dados para ${missing.length} dia(s): ${missing.join(', ')}`)
  const parsed = window.filter(r => r.parsed).map(r => r.parsed)
  for (const p of parsed) for (const w of p.warnings) log.warn(`  ⚠ ${p.day.date}: ${w}`)
  if (parsed.length < MIN_VALID_DAYS) throw new Error(`Só ${parsed.length} dia(s) válidos da REN (mínimo ${MIN_VALID_DAYS})`)
  const firstDate = window[window.length - 1].date
  const lastDate = window[0].date
  return { parsed: parsed.reverse(), firstDate, lastDate, missing }
}

/** Monta os JSON do contrato (`EnergyDaily`, `EnergyLatest`) a partir dos dias válidos. */
export function buildEnergyDatasets({ parsed, firstDate, lastDate, fetchedAtUtc, generatedAtUtc }) {
  const meta = {
    version: ENERGY_CONTRACT_VERSION,
    area: AREA,
    source: SOURCE,
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    taxonomy: taxonomyTag(REN_DAILY_TAXONOMY),
    fetchedAtUtc,
    generatedAtUtc,
    freshness: 'latest_available',
    maxAgeMinutes: REN_DAILY_MAX_AGE_MINUTES,
  }
  const days = parsed.map(p => p.day)
  const observations = parsed.flatMap(p =>
    Object.entries(p.day.technology).map(([technology, gwh]) => ({
      intervalStartUtc: p.day.intervalStartUtc,
      intervalEndUtc: p.day.intervalEndUtc,
      technology,
      classification: p.classifications[technology],
      energyMwh: gwh * 1000,
    })),
  )
  const windowStart = lisbonDayBoundsUtc(firstDate).intervalStartUtc
  const windowEnd = lisbonDayBoundsUtc(lastDate).intervalEndUtc
  const agg = aggregateEnergy(observations, { fromUtc: windowStart, toUtc: windowEnd })
  const sumOf = key => (days.every(d => d[key] !== null) ? days.reduce((s, d) => s + d[key], 0) : null)
  const allDaysComplete = days.every(d => d.quality === 'complete')
  const totalComplete = agg.quality === 'complete' && allDaysComplete
  const gwh = mwh => roundEnergyValue(mwh / 1000, 3)
  const total = {
    intervalStartUtc: windowStart,
    intervalEndUtc: windowEnd,
    resolutionMinutes: (Date.parse(windowEnd) - Date.parse(windowStart)) / 60000,
    unit: 'GWh',
    quality: totalComplete ? 'complete' : 'incomplete',
    coveragePct: agg.coveragePct,
    renewable: gwh(agg.renewable),
    nonRenewable: gwh(agg.nonRenewable),
    storage: gwh(agg.storage),
    unknown: gwh(agg.unknown),
    production: gwh(agg.total),
    renewableSharePct: agg.renewableSharePct,
    renewableExceedsNonRenewable: totalComplete ? agg.renewableExceedsNonRenewable : null,
    technology: Object.fromEntries(Object.entries(agg.technologyMwh).map(([t, v]) => [t, gwh(v)])),
    consumption: sumOf('consumption'),
    imports: sumOf('imports'),
    exports: sumOf('exports'),
  }
  const daily = { ...meta, days, total }
  const latest = { ...meta, latest: days[days.length - 1] }
  return { daily, latest, observations }
}

function writeSqlite(file, { parsed, fetchedAtUtc, generatedAtUtc }) {
  const db = new Database(file)
  try {
    db.pragma('journal_mode = DELETE')
    db.exec(`
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE energy_observation (
        source TEXT NOT NULL,
        area TEXT NOT NULL,
        interval_start_utc TEXT NOT NULL,
        interval_end_utc TEXT NOT NULL,
        technology TEXT NOT NULL,
        classification TEXT NOT NULL CHECK(classification IN ('renewable','non_renewable','storage','unknown')),
        power_mw REAL,
        energy_mwh REAL,
        quality TEXT NOT NULL DEFAULT 'reported',
        fetched_at_utc TEXT NOT NULL,
        PRIMARY KEY(source, area, interval_start_utc, interval_end_utc, technology)
      );
      CREATE INDEX idx_energy_time ON energy_observation(area, interval_start_utc);
      CREATE TABLE energy_balance (
        source TEXT NOT NULL,
        area TEXT NOT NULL,
        interval_start_utc TEXT NOT NULL,
        interval_end_utc TEXT NOT NULL,
        consumption_mwh REAL,
        imports_mwh REAL,
        exports_mwh REAL,
        net_imports_mwh REAL,
        storage_consumption_mwh REAL,
        fetched_at_utc TEXT NOT NULL,
        PRIMARY KEY(source, area, interval_start_utc, interval_end_utc)
      );
    `)
    const insertObs = db.prepare(`
      INSERT INTO energy_observation
        (source, area, interval_start_utc, interval_end_utc, technology, classification, power_mw, energy_mwh, quality, fetched_at_utc)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `)
    const insertBalance = db.prepare(`
      INSERT INTO energy_balance
        (source, area, interval_start_utc, interval_end_utc, consumption_mwh, imports_mwh, exports_mwh,
         net_imports_mwh, storage_consumption_mwh, fetched_at_utc)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const mwh = v => (v === null || v === undefined ? null : v * 1000)
    db.transaction(() => {
      for (const { day, classifications, balance } of parsed) {
        for (const [technology, gwh] of Object.entries(day.technology)) {
          insertObs.run(SOURCE, AREA, day.intervalStartUtc, day.intervalEndUtc, technology, classifications[technology],
            mwh(gwh), day.quality === 'complete' ? 'reported' : 'incomplete', fetchedAtUtc)
        }
        insertBalance.run(SOURCE, AREA, day.intervalStartUtc, day.intervalEndUtc, mwh(balance.consumption),
          mwh(balance.imports), mwh(balance.exports), mwh(balance.net_imports), mwh(balance.storage_consumption), fetchedAtUtc)
      }
    })()
    const setMeta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
    setMeta.run('generated_at', generatedAtUtc)
    setMeta.run('source', `${SOURCE_NAME} (${REN_BASE_URL}${REN_OPERATION})`)
    setMeta.run('taxonomy', taxonomyTag(REN_DAILY_TAXONOMY))
    db.exec('VACUUM')
    const integrity = db.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new Error(`SQLite integrity_check: ${integrity}`)
  } finally {
    db.close()
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
  const energyDir = path.join(outDir, 'energy')
  const tmpDir = path.join(outDir, '.energy.tmp')
  fs.rmSync(tmpDir, { recursive: true, force: true })
  fs.mkdirSync(tmpDir, { recursive: true })
  try {
    for (const [name, write] of Object.entries(files)) write(path.join(tmpDir, name))
    fs.mkdirSync(energyDir, { recursive: true })
    for (const name of Object.keys(files)) {
      const target = name === 'energy.sqlite' ? path.join(outDir, name) : path.join(energyDir, name)
      fs.renameSync(path.join(tmpDir, name), target)
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function validatePublished(name, json) {
  if (json?.version !== ENERGY_CONTRACT_VERSION || json.source !== SOURCE) throw new Error(`${name} publicado com contrato inesperado`)
  if (name === 'daily.json' && (!Array.isArray(json.days) || json.days.length === 0)) throw new Error('daily.json publicado sem dias')
  if (name === 'latest.json' && !json.latest?.date) throw new Error('latest.json publicado sem dia')
}

/** Último dataset válido: descarrega os ficheiros já publicados no Pages e volta a escrevê-los. */
export async function republishPublished({ outDir, fallbackBaseUrl, fetchImpl = fetch }) {
  const base = fallbackBaseUrl.replace(/\/?$/, '/')
  const get = async url => {
    const res = await fetchImpl(url, { cache: 'no-cache', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`${url} respondeu ${res.status}`)
    return res
  }
  const contents = {}
  for (const name of ['daily.json', 'latest.json']) {
    const json = await (await get(`${base}energy/${name}`)).json()
    validatePublished(name, json)
    contents[name] = file => fs.writeFileSync(file, serialize(name, json))
  }
  const sqlite = Buffer.from(await (await get(`${base}energy.sqlite`)).arrayBuffer())
  if (sqlite.subarray(0, 16).toString('latin1') !== 'SQLite format 3\u0000') throw new Error('energy.sqlite publicado inválido')
  contents['energy.sqlite'] = file => fs.writeFileSync(file, sqlite)
  writeOutputs(outDir, contents)
}

export async function buildEnergy({
  outDir = PUBLIC_DATA_DIR,
  now = Date.now(),
  fetchImpl = fetch,
  fallbackBaseUrl = process.env.ENERGY_FALLBACK_BASE_URL || DEFAULT_FALLBACK_BASE_URL,
  retryDelayMs = 2000,
  log = console,
} = {}) {
  log.log('→ energia: a consultar a REN Data Hub (balanço diário, últimos 30 dias)...')
  try {
    const fetchedAtUtc = new Date(now).toISOString()
    const collected = await collectRenDays({ now, fetchImpl, retryDelayMs, log })
    const generatedAtUtc = new Date().toISOString()
    const { daily, latest } = buildEnergyDatasets({ ...collected, fetchedAtUtc, generatedAtUtc })
    const dailyText = serialize('daily.json', daily)
    const latestText = serialize('latest.json', latest)
    writeOutputs(outDir, {
      'daily.json': file => fs.writeFileSync(file, dailyText),
      'latest.json': file => fs.writeFileSync(file, latestText),
      'energy.sqlite': file => writeSqlite(file, { parsed: collected.parsed, fetchedAtUtc, generatedAtUtc }),
    })
    log.log(`✔ energia: ${daily.days.length} dia(s) de ${collected.firstDate} a ${collected.lastDate} ` +
      `(último ${latest.latest.date}: renovável ${latest.latest.renewable} GWh, não renovável ${latest.latest.nonRenewable} GWh, ` +
      `${latest.latest.renewableSharePct}%; daily.json ${(Buffer.byteLength(dailyText) / 1024).toFixed(1)} KB).`)
    return { status: 'fresh', daily, latest }
  } catch (err) {
    log.warn(`⚠ energia: recolha REN falhou (${err.message}); a republicar o último dataset publicado...`)
    try {
      await republishPublished({ outDir, fallbackBaseUrl, fetchImpl })
      log.warn(`⚠ energia: republicado o dataset de ${fallbackBaseUrl}`)
      return { status: 'republished', error: err }
    } catch (fallbackErr) {
      log.warn(`⚠ energia: sem dados de energia neste build (${fallbackErr.message}).`)
      return { status: 'failed', error: err, fallbackError: fallbackErr }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // Uma falha nos dados de energia nunca parte o build das outras secções.
  buildEnergy().catch(err => {
    console.warn(`⚠ energia: erro inesperado (${err.message}).`)
  })
}
