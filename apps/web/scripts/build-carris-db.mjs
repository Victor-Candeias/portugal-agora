// Gera apps/web/public/data/carris.sqlite com os dados "praticamente estáticos"
// da Carris Metropolitana (linhas, paragens, rotas, patterns, operadores e horários via GTFS).
// Corre em Node no momento do build/CI — nunca em runtime no browser.
// Ver WEB-010/011/012/016 (.maestru/tracks/mobile/).
//
// CARRIS_GTFS_ZIP=/caminho/gtfs.zip evita voltar a descarregar o GTFS (~90 MB) em desenvolvimento.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
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
// Janela do calendário de horários (o .sqlite é regenerado diariamente no CI).
const SCHEDULE_WINDOW_DAYS = 60

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

async function loadGtfsZip() {
  const localZip = process.env.CARRIS_GTFS_ZIP
  if (localZip) {
    console.log(`→ a ler GTFS local (${localZip})...`)
    return JSZip.loadAsync(fs.readFileSync(localZip))
  }
  console.log('→ a obter GTFS (/v2/gtfs)...')
  return JSZip.loadAsync(await fetchArrayBuffer(`${BASE_V2}/gtfs`))
}

async function loadOperators(zip) {
  const agencyFile = zip.file('agency.txt')
  const routesFile = zip.file('routes.txt')
  if (!agencyFile || !routesFile) {
    console.warn('  aviso: agency.txt/routes.txt não encontrados no GTFS — operadores ficam vazios.')
    return { agencies: [], routeAgency: new Map(), routeLine: new Map() }
  }

  const agencies = parseCsv(await agencyFile.async('string'))
  const routes = parseCsv(await routesFile.async('string'))
  const routeAgency = new Map(routes.map(r => [r.route_id, r.agency_id]))
  const routeLine = new Map(routes.map(r => [r.route_id, r.route_short_name]))
  return { agencies, routeAgency, routeLine }
}

// IDs do GTFS vêm prefixados com o plano/operador (ex. `[LA77N]1001_0_1`); a API usa `1001_0_1`.
function stripGtfsPrefix(id) {
  return id.replace(/^(\[[^\]]*\])+/, '')
}

function gtfsTimeToSeconds(t) {
  const [h, m, s] = t.split(':').map(Number)
  return h * 3600 + m * 60 + (s || 0)
}

function yyyymmdd(date) {
  return Number(date.toISOString().slice(0, 10).replaceAll('-', ''))
}

/** CSV com o 1.º valor absoluto e os seguintes como diferença ao anterior (valores ordenados). */
function deltaEncode(values) {
  return values.map((v, i) => (i === 0 ? v : v - values[i - 1])).join(',')
}

/**
 * Horários programados (WEB-012) a partir do GTFS — a API não tem /v2/schedules nem /v2/trips.
 *
 * O stop_times.txt tem ~860 MB / 11 M linhas, por isso é lido em streaming e comprimido:
 * - `stop_sequences`/`sequence_stops`: sequências de paragens distintas (lookup por paragem);
 * - `trip_profiles`: pattern + sequência + tempos entre paragens consecutivas (s), deduplicados
 *   (~270 k viagens partilham poucos milhares de perfis);
 * - `profile_departures`: horas de partida da 1.ª paragem (s desde a meia-noite do dia de
 *   serviço, podem passar de 24h) por perfil e serviço, em CSV delta-encoded;
 * - `services`/`service_dates`: calendário de ontem a +SCHEDULE_WINDOW_DAYS dias.
 * As viagens são lidas por ordem (o stop_times vem agrupado por trip_id).
 */
async function loadSchedules(zip, routeLine) {
  const tripsFile = zip.file('trips.txt')
  const stopTimesFile = zip.file('stop_times.txt')
  const calendarFile = zip.file('calendar_dates.txt')
  if (!tripsFile || !stopTimesFile || !calendarFile) {
    console.warn('  aviso: trips/stop_times/calendar_dates em falta no GTFS — horários ficam vazios.')
    return null
  }

  const cutoff = yyyymmdd(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const horizon = yyyymmdd(new Date(Date.now() + SCHEDULE_WINDOW_DAYS * 24 * 60 * 60 * 1000))
  const serviceIds = new Map()
  const serviceDates = []
  for (const row of parseCsv(await calendarFile.async('string'))) {
    if (row.exception_type !== '1') continue
    const date = Number(row.date)
    if (date < cutoff || date > horizon) continue
    if (!serviceIds.has(row.service_id)) serviceIds.set(row.service_id, serviceIds.size + 1)
    serviceDates.push([date, serviceIds.get(row.service_id)])
  }

  const trips = new Map()
  for (const t of parseCsv(await tripsFile.async('string'))) {
    const serviceId = serviceIds.get(t.service_id)
    if (!serviceId) continue
    trips.set(t.trip_id, {
      serviceId,
      lineId: routeLine.get(t.route_id) ?? stripGtfsPrefix(t.route_id).split('_')[0],
      patternId: stripGtfsPrefix(t.pattern_id),
      headsign: t.trip_headsign,
    })
  }

  const sequences = new Map()
  const profiles = new Map()
  const departures = new Map()
  let current = null
  let stops = []
  let times = []
  let tripCount = 0
  const finishTrip = () => {
    const trip = current && trips.get(current)
    if (!trip || times.length === 0) return
    const stopsKey = stops.join(',')
    let sequence = sequences.get(stopsKey)
    if (!sequence) {
      sequence = { id: sequences.size + 1, stopIds: [...stops] }
      sequences.set(stopsKey, sequence)
    }
    const segments = times.slice(1).map((t, i) => t - times[i]).join(',')
    const key = `${trip.patternId}|${trip.headsign}|${sequence.id}|${segments}`
    let profile = profiles.get(key)
    if (!profile) {
      profile = {
        id: profiles.size + 1, lineId: trip.lineId, patternId: trip.patternId, headsign: trip.headsign,
        sequenceId: sequence.id, segments,
      }
      profiles.set(key, profile)
    }
    const depKey = `${profile.id}|${trip.serviceId}`
    const list = departures.get(depKey) ?? []
    list.push(times[0])
    departures.set(depKey, list)
    tripCount++
  }

  const rl = readline.createInterface({ input: stopTimesFile.nodeStream('nodebuffer'), crlfDelay: Infinity })
  let col = null
  for await (const line of rl) {
    if (!line) continue
    if (!col) {
      const header = line.replace(/^\uFEFF/, '').split(',')
      col = Object.fromEntries(header.map((h, i) => [h, i]))
      continue
    }
    const f = line.includes('"') ? Papa.parse(line).data[0] : line.split(',')
    const tripId = f[col.trip_id]
    if (tripId !== current) {
      finishTrip()
      current = tripId
      stops = []
      times = []
    }
    if (!trips.has(tripId)) continue
    stops.push(f[col.stop_id])
    times.push(gtfsTimeToSeconds(f[col.departure_time] || f[col.arrival_time]))
  }
  finishTrip()

  return {
    serviceIds, serviceDates, sequences: [...sequences.values()], profiles: [...profiles.values()],
    departures, tripCount,
  }
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

    CREATE TABLE services (id INTEGER PRIMARY KEY, gtfs_id TEXT);
    CREATE TABLE service_dates (
      date INTEGER,
      service_id INTEGER,
      PRIMARY KEY (date, service_id)
    ) WITHOUT ROWID;
    CREATE TABLE stop_sequences (id INTEGER PRIMARY KEY, stop_count INTEGER);
    CREATE TABLE sequence_stops (
      stop_id TEXT,
      sequence_id INTEGER,
      stop_index INTEGER,
      PRIMARY KEY (stop_id, sequence_id, stop_index)
    ) WITHOUT ROWID;
    CREATE TABLE trip_profiles (
      id INTEGER PRIMARY KEY,
      line_id TEXT,
      pattern_id TEXT,
      headsign TEXT,
      sequence_id INTEGER,
      segments TEXT
    );
    CREATE INDEX idx_trip_profiles_line ON trip_profiles(line_id);
    CREATE INDEX idx_trip_profiles_sequence ON trip_profiles(sequence_id);
    CREATE TABLE profile_departures (
      profile_id INTEGER,
      service_id INTEGER,
      start_times TEXT,
      PRIMARY KEY (profile_id, service_id)
    ) WITHOUT ROWID;
  `)

  // ── Operadores (GTFS) ────────────────────────────────────────────────
  const zip = await loadGtfsZip()
  const { agencies, routeAgency, routeLine } = await loadOperators(zip)
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

  // ── Horários programados (GTFS stop_times, WEB-012) ─────────────────
  console.log('→ a processar horários (trips/stop_times/calendar_dates do GTFS)...')
  const schedules = await loadSchedules(zip, routeLine)
  if (schedules) {
    const insertService = db.prepare('INSERT INTO services (id, gtfs_id) VALUES (?, ?)')
    const insertServiceDate = db.prepare('INSERT OR IGNORE INTO service_dates (date, service_id) VALUES (?, ?)')
    const insertSequence = db.prepare('INSERT INTO stop_sequences (id, stop_count) VALUES (?, ?)')
    const insertSequenceStop = db.prepare(
      'INSERT OR IGNORE INTO sequence_stops (stop_id, sequence_id, stop_index) VALUES (?, ?, ?)',
    )
    const insertProfile = db.prepare(
      'INSERT INTO trip_profiles (id, line_id, pattern_id, headsign, sequence_id, segments) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertDeparture = db.prepare(
      'INSERT INTO profile_departures (profile_id, service_id, start_times) VALUES (?, ?, ?)',
    )
    db.transaction(() => {
      for (const [gtfsId, id] of schedules.serviceIds) insertService.run(id, gtfsId)
      for (const [date, serviceId] of schedules.serviceDates) insertServiceDate.run(date, serviceId)
      for (const s of schedules.sequences) {
        insertSequence.run(s.id, s.stopIds.length)
        s.stopIds.forEach((stopId, i) => insertSequenceStop.run(stopId, s.id, i))
      }
      for (const p of schedules.profiles) {
        insertProfile.run(p.id, p.lineId, p.patternId, p.headsign, p.sequenceId, p.segments)
      }
      for (const [key, starts] of schedules.departures) {
        const [profileId, serviceId] = key.split('|').map(Number)
        insertDeparture.run(profileId, serviceId, deltaEncode(starts.sort((a, b) => a - b)))
      }
    })()
    console.log(
      `  ${schedules.tripCount} viagens → ${schedules.profiles.length} perfis, ` +
      `${schedules.sequences.length} sequências, ${schedules.serviceIds.size} serviços, ` +
      `${schedules.serviceDates.length} datas.`,
    )
  }

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
