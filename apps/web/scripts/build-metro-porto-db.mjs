// Gera apps/web/public/data/metro-porto.sqlite a partir do GTFS oficial do Metro do Porto,
// publicado no portal Open Data do Porto (opendata.porto.digital, organização "metro-do-porto").
// Corre em Node no momento do build/CI — nunca em runtime no browser.
// Ver .Docs/metro porto.txt e WEB-022 (.maestru/tracks/mobile/).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import JSZip from 'jszip'
import Papa from 'papaparse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../public/data')
const OUT_FILE = path.join(OUT_DIR, 'metro-porto.sqlite')

// Dataset CKAN "Horários, paragens e rotas da Metro do Porto" (organização metro-do-porto).
const CKAN_PACKAGE_URL = 'https://opendata.porto.digital/api/3/action/package_show?id=15f22603-a216-492a-ab1c-40b1d8aa2f08'

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function fetchArrayBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.arrayBuffer()
}

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data
}

/**
 * O portal Open Data do Porto já teve recursos GTFS "mais recentes" publicados vazios
 * (0 bytes) — ver nota em WEB-022. Por isso percorremos os recursos ZIP por ordem
 * decrescente de criação e usamos o primeiro que descarrega com conteúdo real, em vez de
 * confiar cegamente no rótulo "Mais Recente".
 */
async function fetchLatestGtfsZip() {
  console.log('→ a consultar catálogo CKAN (opendata.porto.digital)...')
  const pkg = await fetchJson(CKAN_PACKAGE_URL)
  const resources = (pkg.result?.resources ?? [])
    .filter(r => r.format === 'ZIP' || r.format === 'GTFS')
    .filter(r => !!r.url)
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())

  for (const resource of resources) {
    console.log(`  a tentar "${resource.name}" (${resource.created})...`)
    try {
      const buffer = await fetchArrayBuffer(resource.url)
      if (buffer.byteLength === 0) {
        console.warn('    vazio (0 bytes) — a ignorar.')
        continue
      }
      const zip = await JSZip.loadAsync(buffer)
      const hasCoreFiles = ['routes.txt', 'stops.txt', 'trips.txt', 'stop_times.txt']
        .every(name => zip.file(new RegExp(`(^|/)${name}$`)).length > 0)
      if (!hasCoreFiles) {
        console.warn('    ZIP sem os ficheiros GTFS essenciais — a ignorar.')
        continue
      }
      console.log(`  ✔ descarregado e validado (${(buffer.byteLength / 1024).toFixed(0)} KB).`)
      return { zip, resource }
    } catch (err) {
      console.warn(`    falhou: ${err.message}`)
    }
  }
  throw new Error('Nenhum recurso GTFS do Metro do Porto pôde ser descarregado.')
}

/** Converte "HH:MM:SS" (GTFS permite horas >= 24 para serviços noturnos) em segundos. */
function timeToSeconds(value) {
  if (!value) return null
  const [h, m, s] = value.split(':').map(Number)
  if ([h, m, s].some(Number.isNaN)) return null
  return h * 3600 + m * 60 + s
}

function toIntFlag(value) {
  return value === '1' ? 1 : 0
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  if (fs.existsSync(OUT_FILE)) fs.rmSync(OUT_FILE)

  const { zip, resource } = await fetchLatestGtfsZip()

  // Diferentes publicações do GTFS variam na estrutura do ZIP: por vezes os .txt estão na
  // raiz, por vezes dentro de uma subpasta (ex. "Horarios GTFS_09.09.2024/routes.txt").
  // Por isso procuramos pelo nome do ficheiro (basename), não pelo caminho completo.
  function findEntry(name) {
    return zip.file(new RegExp(`(^|/)${name}$`))[0] ?? null
  }

  async function readCsv(name) {
    const file = findEntry(name)
    if (!file) {
      console.warn(`  aviso: ${name} não encontrado no GTFS.`)
      return []
    }
    return parseCsv(await file.async('string'))
  }

  console.log('→ a extrair ficheiros GTFS...')
  const [routes, stops, trips, stopTimes, calendar, calendarDates] = await Promise.all([
    readCsv('routes.txt'),
    readCsv('stops.txt'),
    readCsv('trips.txt'),
    readCsv('stop_times.txt'),
    readCsv('calendar.txt'),
    readCsv('calendar_dates.txt'),
  ])
  console.log(`  routes=${routes.length} stops=${stops.length} trips=${trips.length} stop_times=${stopTimes.length} calendar=${calendar.length} calendar_dates=${calendarDates.length}`)

  const db = new Database(OUT_FILE)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE metro_stations (
      station_id TEXT PRIMARY KEY,
      station_name TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      parent_station_id TEXT
    );

    CREATE TABLE metro_lines (
      line_id TEXT PRIMARY KEY,
      short_name TEXT,
      long_name TEXT,
      color TEXT,
      text_color TEXT
    );

    CREATE TABLE metro_trips (
      trip_id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      destination TEXT,
      direction_id INTEGER,
      shape_id TEXT
    );

    CREATE TABLE metro_stop_times (
      trip_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      arrival_seconds INTEGER,
      departure_seconds INTEGER,
      stop_sequence INTEGER,
      PRIMARY KEY (trip_id, stop_sequence)
    );

    CREATE TABLE metro_calendar (
      service_id TEXT PRIMARY KEY,
      monday INTEGER,
      tuesday INTEGER,
      wednesday INTEGER,
      thursday INTEGER,
      friday INTEGER,
      saturday INTEGER,
      sunday INTEGER,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE metro_calendar_dates (
      service_id TEXT NOT NULL,
      service_date TEXT NOT NULL,
      exception_type INTEGER NOT NULL,
      PRIMARY KEY (service_id, service_date)
    );

    CREATE TABLE metro_station_lines (
      station_id TEXT NOT NULL,
      line_id TEXT NOT NULL,
      PRIMARY KEY (station_id, line_id)
    );

    CREATE INDEX idx_stop_times_station_departure ON metro_stop_times(station_id, departure_seconds);
    CREATE INDEX idx_trips_line ON metro_trips(line_id);
    CREATE INDEX idx_trips_service ON metro_trips(service_id);
    CREATE INDEX idx_calendar_dates_date ON metro_calendar_dates(service_date);
  `)

  // ── Linhas (routes.txt) ──────────────────────────────────────────────
  const insertLine = db.prepare(
    'INSERT OR REPLACE INTO metro_lines (line_id, short_name, long_name, color, text_color) VALUES (?, ?, ?, ?, ?)',
  )
  db.transaction(() => {
    for (const r of routes) {
      insertLine.run(r.route_id, r.route_short_name, r.route_long_name || null, r.route_color || null, r.route_text_color || null)
    }
  })()
  console.log(`  ${routes.length} linha(s) guardada(s).`)

  // ── Estações (stops.txt) ─────────────────────────────────────────────
  const insertStation = db.prepare(
    'INSERT OR REPLACE INTO metro_stations (station_id, station_name, latitude, longitude, parent_station_id) VALUES (?, ?, ?, ?, ?)',
  )
  db.transaction(() => {
    for (const s of stops) {
      insertStation.run(
        s.stop_id, s.stop_name,
        s.stop_lat ? parseFloat(s.stop_lat) : null,
        s.stop_lon ? parseFloat(s.stop_lon) : null,
        s.parent_station || null,
      )
    }
  })()
  console.log(`  ${stops.length} estação(ões) guardada(s).`)

  // ── Viagens (trips.txt) ──────────────────────────────────────────────
  const insertTrip = db.prepare(
    'INSERT OR REPLACE INTO metro_trips (trip_id, line_id, service_id, destination, direction_id, shape_id) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const tripLine = new Map()
  db.transaction(() => {
    for (const t of trips) {
      insertTrip.run(
        t.trip_id, t.route_id, t.service_id, t.trip_headsign || null,
        t.direction_id !== '' && t.direction_id != null ? Number(t.direction_id) : null,
        t.shape_id || null,
      )
      tripLine.set(t.trip_id, t.route_id)
    }
  })()
  console.log(`  ${trips.length} viagem(ns) guardada(s).`)

  // ── Horários (stop_times.txt), convertidos para segundos ────────────
  const insertStopTime = db.prepare(
    'INSERT OR REPLACE INTO metro_stop_times (trip_id, station_id, arrival_seconds, departure_seconds, stop_sequence) VALUES (?, ?, ?, ?, ?)',
  )
  const stationLines = new Map() // station_id -> Set<line_id>
  db.transaction(() => {
    for (const st of stopTimes) {
      insertStopTime.run(
        st.trip_id, st.stop_id,
        timeToSeconds(st.arrival_time), timeToSeconds(st.departure_time),
        Number(st.stop_sequence),
      )
      const lineId = tripLine.get(st.trip_id)
      if (lineId) {
        if (!stationLines.has(st.stop_id)) stationLines.set(st.stop_id, new Set())
        stationLines.get(st.stop_id).add(lineId)
      }
    }
  })()
  console.log(`  ${stopTimes.length} horário(s) guardado(s).`)

  // ── Estação × Linha (pré-calculado) ─────────────────────────────────
  const insertStationLine = db.prepare('INSERT OR IGNORE INTO metro_station_lines (station_id, line_id) VALUES (?, ?)')
  db.transaction(() => {
    for (const [stationId, lineIds] of stationLines) {
      for (const lineId of lineIds) insertStationLine.run(stationId, lineId)
    }
  })()
  console.log(`  ${[...stationLines.values()].reduce((n, s) => n + s.size, 0)} associação(ões) estação/linha guardada(s).`)

  // ── Calendário (calendar.txt / calendar_dates.txt) ──────────────────
  const insertCalendar = db.prepare(`
    INSERT OR REPLACE INTO metro_calendar
      (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  db.transaction(() => {
    for (const c of calendar) {
      insertCalendar.run(
        c.service_id,
        toIntFlag(c.monday), toIntFlag(c.tuesday), toIntFlag(c.wednesday), toIntFlag(c.thursday),
        toIntFlag(c.friday), toIntFlag(c.saturday), toIntFlag(c.sunday),
        c.start_date, c.end_date,
      )
    }
  })()
  console.log(`  ${calendar.length} serviço(s) de calendário guardado(s).`)

  const insertCalendarDate = db.prepare(
    'INSERT OR REPLACE INTO metro_calendar_dates (service_id, service_date, exception_type) VALUES (?, ?, ?)',
  )
  db.transaction(() => {
    for (const cd of calendarDates) {
      insertCalendarDate.run(cd.service_id, cd.date, Number(cd.exception_type))
    }
  })()
  console.log(`  ${calendarDates.length} exceção(ões) de calendário guardada(s).`)

  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('generated_at', new Date().toISOString())
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('source', `opendata.porto.digital: ${resource.name}`)
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('gtfs_resource_created', resource.created)

  db.exec('VACUUM')
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()

  const stats = fs.statSync(OUT_FILE)
  console.log(`✔ ${OUT_FILE} gerado (${(stats.size / 1024 / 1024).toFixed(2)} MB), a partir de "${resource.name}".`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
