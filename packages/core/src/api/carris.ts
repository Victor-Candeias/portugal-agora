// Carris Metropolitana — cliente agnóstico de plataforma (MOB-002).
//
// Dados estáticos (linhas, paragens, patterns, operadores, horários GTFS) vêm do `.sqlite` gerado em build/CI
// (apps/web/scripts/build-carris-db.mjs, WEB-010/011/012/016), consultado via `QueryAll` injetado
// pela app. Dados dinâmicos (veículos, chegadas, municípios) vêm da API oficial, que tem
// `Access-Control-Allow-Origin: *` — `fetch` direto tanto no browser como no nativo.
import type { QueryAll } from '../sqlite.js'
import { getStaticDbMeta } from '../sqlite.js'
import { haversineDistance } from '../utils/index.js'

export const CARRIS_BASE_V1 = 'https://api.carrismetropolitana.pt/v1'
export const CARRIS_BASE_V2 = 'https://api.carrismetropolitana.pt/v2'

export interface CMLine {
  id: string
  short_name: string
  long_name: string
  color: string
  text_color: string
  municipality_ids: string[]
  pattern_ids: string[]
  route_ids: string[]
  operator_id: string | null
}

export interface CMOperator {
  id: string
  name: string
  website: string | null
  timezone: string | null
}

export interface CMStop {
  id: string
  long_name: string
  short_name: string | null
  lat: number
  lon: number
  municipality_id: string
  municipality_name: string
  locality_name: string
  line_ids: string[]
  wheelchair_boarding: boolean
  facilities: string[]
  operational_status: string
}

export interface CMVehicle {
  id: string
  line_id: string
  pattern_id: string
  route_id: string
  trip_id: string
  lat: number
  lon: number
  bearing: number
  speed: number
  stop_id: string
  current_status: string
  timestamp: number
  agency_id: string
  wheelchair_accessible: boolean
  propulsion: string
}

export interface CMRealtime {
  line_id: string
  headsign: string
  pattern_id: string
  route_id?: string
  trip_id?: string
  stop_sequence?: number
  scheduled_arrival: string
  scheduled_arrival_unix: number
  estimated_arrival: string | null
  estimated_arrival_unix: number | null
  observed_arrival: string | null
  observed_arrival_unix: number | null
  vehicle_id: string
}

export interface CMMunicipality {
  id: string
  name: string
  district_id?: string
  district_name?: string
}

export interface CMPattern {
  id: string
  line_id: string
  direction_id: number
  headsign: string
  color: string
  municipality_ids: string[]
  path: { stop_id: string; stop_sequence: number; distance: number }[]
}

export type CMNearbyStop = CMStop & { distKm: number }

/** Partida programada (GTFS, WEB-012). */
export interface CMScheduledDeparture {
  line_id: string
  pattern_id: string
  headsign: string
  /** Segundos desde a meia-noite (hora de Lisboa) do dia pedido; ≥ 86400 = madrugada do dia seguinte. */
  seconds: number
  /** HH:MM (0–23h). */
  time: string
}

const LISBON_TZ = 'Europe/Lisbon'
const lisbonFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LISBON_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

/** Dia de serviço (YYYYMMDD) e segundos desde a meia-noite, na hora de Lisboa. */
export function lisbonServiceDay(at: Date = new Date()): { date: number; seconds: number } {
  const p = Object.fromEntries(lisbonFormatter.formatToParts(at).map(x => [x.type, x.value]))
  return {
    date: Number(`${p.year}${p.month}${p.day}`),
    seconds: Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second),
  }
}

function shiftServiceDate(date: number, days: number): number {
  const d = new Date(Date.UTC(Math.floor(date / 10000), (Math.floor(date / 100) % 100) - 1, (date % 100) + days))
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** Inverso do `deltaEncode` do build: 1.º valor absoluto, seguintes como diferença ao anterior. */
function deltaDecode(csv: string): number[] {
  if (!csv) return []
  let acc = 0
  return csv.split(',').map((v, i) => (acc = i === 0 ? Number(v) : acc + Number(v)))
}

export function formatScheduleTime(seconds: number): string {
  const h = Math.floor(seconds / 3600) % 24
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Converte horas GTFS (relativas ao dia de serviço, podem passar de 24h) para o dia pedido:
 * viagens do próprio dia mantêm-se; as do dia anterior só contam a partir das 24h.
 */
function toDayDepartures(
  rows: { line_id: string; pattern_id: string; headsign: string; date: number; offset: number; start_times: string }[],
  date: number,
): CMScheduledDeparture[] {
  const result: CMScheduledDeparture[] = []
  for (const r of rows) {
    const shift = r.date === date ? 0 : -86400
    for (const start of deltaDecode(r.start_times)) {
      const seconds = start + r.offset + shift
      if (seconds < 0) continue
      result.push({ line_id: r.line_id, pattern_id: r.pattern_id, headsign: r.headsign, seconds, time: formatScheduleTime(seconds) })
    }
  }
  return result.sort((a, b) => a.seconds - b.seconds)
}

export interface CarrisClientOptions {
  /** Executor SQL sobre o `.sqlite` estático da Carris (sql.js no web, expo-sqlite no nativo). */
  queryAll: QueryAll
  baseUrlV1?: string
  baseUrlV2?: string
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Carris API error ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

function groupByLine<T extends { line_id: string }>(rows: T[], key: keyof T): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const r of rows) {
    const arr = map.get(r.line_id) ?? []
    arr.push(String(r[key]))
    map.set(r.line_id, arr)
  }
  return map
}

/** Paragens ativas num raio (km) de um ponto, ordenadas por distância (máx. 20). */
export function findNearbyStops(stops: CMStop[], lat: number, lon: number, radiusKm = 0.5): CMNearbyStop[] {
  return stops
    .filter(s => s.operational_status === 'ACTIVE')
    .map(s => ({ ...s, distKm: haversineDistance(lat, lon, s.lat, s.lon) }))
    .filter(s => s.distKm <= radiusKm)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 20)
}

export function createCarrisClient(options: CarrisClientOptions) {
  const { queryAll } = options
  const baseV1 = options.baseUrlV1 ?? CARRIS_BASE_V1
  const baseV2 = options.baseUrlV2 ?? CARRIS_BASE_V2

  return {
    getDbMeta: () => getStaticDbMeta(queryAll),

    /** Municípios (endpoint só existe na v1), ordenados por nome. */
    async getMunicipalities(): Promise<CMMunicipality[]> {
      const municipalities = await fetchJson<CMMunicipality[]>(`${baseV1}/municipalities`)
      return [...municipalities].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    },

    async getLines(municipalityFilter: string | null = null): Promise<CMLine[]> {
      const rows = await queryAll<{
        id: string; short_name: string; long_name: string; color: string
        text_color: string; operator_id: string | null
      }>('SELECT id, short_name, long_name, color, text_color, operator_id FROM lines')

      const [muniRows, routeRows, patternRows] = await Promise.all([
        queryAll<{ line_id: string; municipality_id: string }>('SELECT line_id, municipality_id FROM line_municipalities'),
        queryAll<{ line_id: string; route_id: string }>('SELECT line_id, route_id FROM line_routes'),
        queryAll<{ line_id: string; pattern_id: string }>('SELECT line_id, pattern_id FROM line_patterns'),
      ])
      const munis = groupByLine(muniRows, 'municipality_id')
      const routes = groupByLine(routeRows, 'route_id')
      const patterns = groupByLine(patternRows, 'pattern_id')

      const lines: CMLine[] = rows.map(l => ({
        ...l,
        municipality_ids: munis.get(l.id) ?? [],
        route_ids: routes.get(l.id) ?? [],
        pattern_ids: patterns.get(l.id) ?? [],
      }))
      if (!municipalityFilter) return lines
      return lines.filter(l => l.municipality_ids.includes(municipalityFilter))
    },

    getOperators(): Promise<CMOperator[]> {
      return queryAll<CMOperator>('SELECT id, name, website, timezone FROM operators')
    },

    async getLinePatterns(patternIds: string[]): Promise<CMPattern[]> {
      if (patternIds.length === 0) return []
      const placeholders = patternIds.map(() => '?').join(',')
      const rows = await queryAll<{
        id: string; line_id: string; direction_id: number; headsign: string; color: string
      }>(`SELECT id, line_id, direction_id, headsign, color FROM patterns WHERE id IN (${placeholders})`, patternIds)
      const pathRows = await queryAll<{ pattern_id: string; stop_id: string; stop_sequence: number; distance: number }>(
        `SELECT pattern_id, stop_id, stop_sequence, distance FROM pattern_path WHERE pattern_id IN (${placeholders}) ORDER BY stop_sequence`,
        patternIds,
      )
      const pathByPattern = new Map<string, CMPattern['path']>()
      for (const p of pathRows) {
        const arr = pathByPattern.get(p.pattern_id) ?? []
        arr.push({ stop_id: p.stop_id, stop_sequence: p.stop_sequence, distance: p.distance })
        pathByPattern.set(p.pattern_id, arr)
      }
      return rows.map(r => ({ ...r, municipality_ids: [], path: pathByPattern.get(r.id) ?? [] }))
    },

    async getStops(): Promise<CMStop[]> {
      const rows = await queryAll<{
        id: string; long_name: string; short_name: string | null; lat: number; lon: number
        municipality_id: string; municipality_name: string; locality_name: string
        wheelchair_boarding: number; facilities: string; operational_status: string
      }>('SELECT * FROM stops')
      const lineRows = await queryAll<{ stop_id: string; line_id: string }>('SELECT stop_id, line_id FROM stop_lines')
      const linesByStop = new Map<string, string[]>()
      for (const r of lineRows) {
        const arr = linesByStop.get(r.stop_id) ?? []
        arr.push(r.line_id)
        linesByStop.set(r.stop_id, arr)
      }
      return rows.map(s => ({
        id: s.id,
        long_name: s.long_name,
        short_name: s.short_name,
        lat: s.lat,
        lon: s.lon,
        municipality_id: s.municipality_id,
        municipality_name: s.municipality_name,
        locality_name: s.locality_name,
        line_ids: linesByStop.get(s.id) ?? [],
        wheelchair_boarding: s.wheelchair_boarding === 1,
        facilities: JSON.parse(s.facilities || '[]') as string[],
        operational_status: s.operational_status,
      }))
    },

    /**
     * Partidas programadas numa paragem para um dia de serviço (YYYYMMDD, por omissão hoje em
     * Lisboa), a partir dos horários GTFS no `.sqlite` (WEB-012). Exclui a paragem terminal.
     */
    async getStopSchedule(stopId: string, date: number = lisbonServiceDay().date): Promise<CMScheduledDeparture[]> {
      const rows = await queryAll<{
        stop_index: number; line_id: string; pattern_id: string; headsign: string
        segments: string; start_times: string; date: number
      }>(
        `SELECT ss.stop_index, p.line_id, p.pattern_id, p.headsign, p.segments, d.start_times, sd.date
         FROM sequence_stops ss
         JOIN stop_sequences sq ON sq.id = ss.sequence_id
         JOIN trip_profiles p ON p.sequence_id = ss.sequence_id
         JOIN profile_departures d ON d.profile_id = p.id
         JOIN service_dates sd ON sd.service_id = d.service_id
         WHERE ss.stop_id = ? AND sd.date IN (?, ?) AND ss.stop_index < sq.stop_count - 1`,
        [stopId, date, shiftServiceDate(date, -1)],
      )
      return toDayDepartures(rows.map(r => ({
        ...r,
        offset: r.segments ? r.segments.split(',').slice(0, r.stop_index).reduce((acc, v) => acc + Number(v), 0) : 0,
      })), date)
    },

    /** Partidas programadas de uma linha (hora na 1.ª paragem de cada percurso) num dia de serviço. */
    async getLineSchedule(lineId: string, date: number = lisbonServiceDay().date): Promise<CMScheduledDeparture[]> {
      const rows = await queryAll<{
        line_id: string; pattern_id: string; headsign: string; start_times: string; date: number
      }>(
        `SELECT p.line_id, p.pattern_id, p.headsign, d.start_times, sd.date
         FROM trip_profiles p
         JOIN profile_departures d ON d.profile_id = p.id
         JOIN service_dates sd ON sd.service_id = d.service_id
         WHERE p.line_id = ? AND sd.date IN (?, ?)`,
        [lineId, date, shiftServiceDate(date, -1)],
      )
      return toDayDepartures(rows.map(r => ({ ...r, offset: 0 })), date)
    },

    /** Veículos com posição conhecida, opcionalmente filtrados por linha. */
    async getVehicles(lineFilter: string | null = null): Promise<CMVehicle[]> {
      const vehicles = await fetchJson<CMVehicle[]>(`${baseV2}/vehicles`)
      const active = vehicles.filter(v => v.lat && v.lon)
      if (!lineFilter) return active
      return active.filter(v => v.line_id === lineFilter)
    },

    /** Chegadas em tempo real (v2 — corrige o trip_id malformado devolvido pela v1). */
    getStopRealtime(stopId: string): Promise<CMRealtime[]> {
      return fetchJson<CMRealtime[]>(`${baseV2}/arrivals/by_stop/${stopId}`)
    },
  }
}

export type CarrisClient = ReturnType<typeof createCarrisClient>
