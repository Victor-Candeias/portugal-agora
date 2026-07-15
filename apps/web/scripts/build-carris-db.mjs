// Gera apps/web/public/data/carris.sqlite com os dados "praticamente estáticos"
// da Carris Metropolitana (linhas, paragens, rotas, patterns, operadores via GTFS).
// Corre em Node no momento do build/CI — nunca em runtime no browser.
// Ver WEB-010/011/016 (.maestru/tracks/mobile/).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import JSZip from 'jszip'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../public/data')
const OUT_FILE = path.join(OUT_DIR, 'carris.sqlite')

const BASE_V1 = 'https://api.carrismetropolitana.pt/v1'
const BASE_V2 = 'https://api.carrismetropolitana.pt/v2'
const PATTERN_CONCURRENCY = 6

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJson(url, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url)
    if (res.ok) return res.json()
    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after')) || 0
      const backoffMs = Math.max(retryAfter * 1000, 500 * 2 ** attempt)
      await sleep(backoffMs)
      continue
    }
    throw new Error(`${res.status} ${url}`)
  }
  throw new Error(`too many retries: ${url}`)
}

async function fetchArrayBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.arrayBuffer()
}

/** Corre `items` através de `worker` com um limite de concorrência. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return results
}

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data
}

async function loadOperators() {
  console.log('→ a obter GTFS (agency.txt + routes.txt) para operadores...')
  const zipBuffer = await fetchArrayBuffer(`${BASE_V2}/gtfs`)
  const zip = await JSZip.loadAsync(zipBuffer)

  const agencyFile = zip.file('agency.txt')
  const routesFile = zip.file('routes.txt')
  if (!agencyFile || !routesFile) {
    console.warn('  aviso: agency.txt/routes.txt não encontrados no GTFS — operadores ficam vazios.')
    return { agencies: [], routeAgency: new Map() }
  }

  const agencies = parseCsv(await agencyFile.async('string'))
  const routes = parseCsv(await routesFile.async('string'))
  const routeAgency = new Map(routes.map(r => [r.route_id, r.agency_id]))
  return { agencies, routeAgency }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  if (fs.existsSync(OUT_FILE)) fs.rmSync(OUT_FILE)

  const db = new Database(OUT_FILE)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE operators (
      id TEXT PRIMARY KEY,
      name TEXT,
      website TEXT,
      timezone TEXT
    );

    CREATE TABLE lines (
      id TEXT PRIMARY KEY,
      short_name TEXT,
      long_name TEXT,
      color TEXT,
      text_color TEXT,
      operator_id TEXT
    );
    CREATE TABLE line_municipalities (line_id TEXT, municipality_id TEXT);
    CREATE TABLE line_routes (line_id TEXT, route_id TEXT);
    CREATE TABLE line_patterns (line_id TEXT, pattern_id TEXT);
    CREATE INDEX idx_line_municipalities ON line_municipalities(line_id);
    CREATE INDEX idx_line_routes ON line_routes(line_id);
    CREATE INDEX idx_line_patterns ON line_patterns(line_id);

    CREATE TABLE stops (
      id TEXT PRIMARY KEY,
      long_name TEXT,
      short_name TEXT,
      lat REAL,
      lon REAL,
      municipality_id TEXT,
      municipality_name TEXT,
      locality_name TEXT,
      wheelchair_boarding INTEGER,
      facilities TEXT,
      operational_status TEXT
    );
    CREATE TABLE stop_lines (stop_id TEXT, line_id TEXT);
    CREATE INDEX idx_stop_lines_stop ON stop_lines(stop_id);
    CREATE INDEX idx_stop_lines_line ON stop_lines(line_id);

    CREATE TABLE patterns (
      id TEXT PRIMARY KEY,
      line_id TEXT,
      direction_id INTEGER,
      headsign TEXT,
      color TEXT
    );
    CREATE TABLE pattern_path (
      pattern_id TEXT,
      stop_id TEXT,
      stop_sequence INTEGER,
      distance REAL
    );
    CREATE INDEX idx_pattern_path_pattern ON pattern_path(pattern_id);
  `)

  // ── Operadores (GTFS) ────────────────────────────────────────────────
  const { agencies, routeAgency } = await loadOperators()
  const insertOperator = db.prepare(
    'INSERT OR REPLACE INTO operators (id, name, website, timezone) VALUES (?, ?, ?, ?)',
  )
  const insertOperators = db.transaction(rows => rows.forEach(a => {
    insertOperator.run(a.agency_id ?? a.agency_name, a.agency_name, a.agency_url, a.agency_timezone)
  }))
  insertOperators(agencies)
  console.log(`  ${agencies.length} operador(es) guardados.`)

  // ── Linhas ───────────────────────────────────────────────────────────
  console.log('→ a obter linhas (/v2/lines)...')
  const lines = await fetchJson(`${BASE_V2}/lines`)
  const insertLine = db.prepare(
    'INSERT OR REPLACE INTO lines (id, short_name, long_name, color, text_color, operator_id) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const insertLineMuni = db.prepare('INSERT INTO line_municipalities (line_id, municipality_id) VALUES (?, ?)')
  const insertLineRoute = db.prepare('INSERT INTO line_routes (line_id, route_id) VALUES (?, ?)')
  const insertLinePattern = db.prepare('INSERT INTO line_patterns (line_id, pattern_id) VALUES (?, ?)')

  const insertLines = db.transaction(rows => {
    for (const l of rows) {
      const operatorId = l.route_ids.map(rid => routeAgency.get(rid)).find(Boolean) ?? null
      insertLine.run(l.id, l.short_name, l.long_name, l.color, l.text_color, operatorId)
      for (const m of l.municipality_ids) insertLineMuni.run(l.id, m)
      for (const r of l.route_ids) insertLineRoute.run(l.id, r)
      for (const p of l.pattern_ids) insertLinePattern.run(l.id, p)
    }
  })
  insertLines(lines)
  console.log(`  ${lines.length} linhas guardadas.`)

  // ── Paragens (v1 — mais rica: operational_status, facilities) ───────
  console.log('→ a obter paragens (/v1/stops)...')
  const stops = await fetchJson(`${BASE_V1}/stops`)
  const insertStop = db.prepare(`
    INSERT OR REPLACE INTO stops
      (id, long_name, short_name, lat, lon, municipality_id, municipality_name, locality_name, wheelchair_boarding, facilities, operational_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertStopLine = db.prepare('INSERT INTO stop_lines (stop_id, line_id) VALUES (?, ?)')
  const insertStops = db.transaction(rows => {
    for (const s of rows) {
      insertStop.run(
        s.id, s.name, s.short_name, parseFloat(s.lat), parseFloat(s.lon),
        s.municipality_id, s.municipality_name, s.locality,
        s.wheelchair_boarding === '1' ? 1 : 0,
        JSON.stringify(s.facilities ?? []), s.operational_status,
      )
      for (const lineId of s.lines ?? []) insertStopLine.run(s.id, lineId)
    }
  })
  insertStops(stops)
  console.log(`  ${stops.length} paragens guardadas.`)

  // ── Patterns (um pedido por pattern, com concorrência limitada) ─────
  const patternIds = [...new Set(lines.flatMap(l => l.pattern_ids))]
  console.log(`→ a obter ${patternIds.length} patterns (/v2/patterns/{id}, concorrência=${PATTERN_CONCURRENCY})...`)

  const insertPattern = db.prepare(
    'INSERT OR REPLACE INTO patterns (id, line_id, direction_id, headsign, color) VALUES (?, ?, ?, ?, ?)',
  )
  const insertPatternPath = db.prepare(
    'INSERT INTO pattern_path (pattern_id, stop_id, stop_sequence, distance) VALUES (?, ?, ?, ?)',
  )

  let done = 0
  await mapWithConcurrency(patternIds, PATTERN_CONCURRENCY, async patternId => {
    try {
      const results = await fetchJson(`${BASE_V2}/patterns/${patternId}`)
      const insertOne = db.transaction(patterns => {
        for (const p of patterns) {
          insertPattern.run(p.id, p.line_id, p.direction_id, p.headsign, p.color)
          for (const step of p.path ?? []) {
            insertPatternPath.run(p.id, step.stop_id, step.stop_sequence, step.distance)
          }
        }
      })
      insertOne(results)
    } catch (err) {
      console.warn(`  aviso: falhou pattern ${patternId}: ${err.message}`)
    }
    done += 1
    if (done % 200 === 0) console.log(`  ${done}/${patternIds.length} patterns processados...`)
  })
  console.log(`  ${patternIds.length} patterns processados.`)

  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('generated_at', new Date().toISOString())
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('source', 'api.carrismetropolitana.pt v1/v2 + gtfs')

  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()

  const stats = fs.statSync(OUT_FILE)
  console.log(`✔ ${OUT_FILE} gerado (${(stats.size / 1024 / 1024).toFixed(2)} MB).`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
