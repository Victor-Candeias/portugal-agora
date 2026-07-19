// Hooks React Query para o Metro do Porto, consultando o `.sqlite` estático (WASM) gerado em
// build/CI a partir do GTFS oficial (ver metroPortoDb.ts, scripts/build-metro-porto-db.mjs,
// WEB-022). Sem pedidos de rede em runtime além do fetch inicial do ficheiro `.sqlite`
// (feito uma única vez e memorizado por `getMetroPortoDb`).
import { useQuery } from '@tanstack/react-query'
import { metroPortoQueryAll, getMetroPortoDbMeta } from '@/lib/metroPortoDb'

export interface MetroStation {
  station_id: string
  station_name: string
  latitude: number | null
  longitude: number | null
  parent_station_id: string | null
}

export interface MetroLine {
  line_id: string
  short_name: string
  long_name: string | null
  color: string | null
  text_color: string | null
}

export interface MetroDeparture {
  departure_seconds: number
  destination: string | null
  line_id: string
  short_name: string
  color: string | null
}

const WEEKDAY_COLUMNS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** Segundos desde a meia-noite local, no formato usado em metro_stop_times. */
export function secondsSinceMidnight(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
}

/**
 * Calcula os `service_id` válidos para uma data, cruzando `metro_calendar` (dia da semana +
 * intervalo de validade) com as exceções de `metro_calendar_dates` (1 = adiciona, 2 = remove),
 * tal como recomendado em `.Docs/metro porto.txt`.
 */
async function getActiveServiceIds(date: Date): Promise<string[]> {
  const dateStr = toYYYYMMDD(date)
  const weekdayCol = WEEKDAY_COLUMNS[date.getDay()]

  const [calendarRows, exceptionRows] = await Promise.all([
    metroPortoQueryAll<{ service_id: string }>(
      `SELECT service_id FROM metro_calendar WHERE ${weekdayCol} = 1 AND start_date <= ? AND end_date >= ?`,
      [dateStr, dateStr],
    ),
    metroPortoQueryAll<{ service_id: string; exception_type: number }>(
      'SELECT service_id, exception_type FROM metro_calendar_dates WHERE service_date = ?',
      [dateStr],
    ),
  ])

  const serviceIds = new Set(calendarRows.map(r => r.service_id))
  for (const ex of exceptionRows) {
    if (ex.exception_type === 1) serviceIds.add(ex.service_id)
    else if (ex.exception_type === 2) serviceIds.delete(ex.service_id)
  }
  return [...serviceIds]
}

export function useMetroPortoMeta() {
  return useQuery({
    queryKey: ['metro-porto', 'meta'],
    queryFn: getMetroPortoDbMeta,
    staleTime: Infinity,
  })
}

export function useMetroStations() {
  return useQuery({
    queryKey: ['metro-porto', 'stations'],
    queryFn: () => metroPortoQueryAll<MetroStation>(
      'SELECT station_id, station_name, latitude, longitude, parent_station_id FROM metro_stations ORDER BY station_name',
    ),
    staleTime: Infinity,
  })
}

export function useMetroStationLines(stationId?: string) {
  return useQuery({
    queryKey: ['metro-porto', 'station-lines', stationId],
    queryFn: () => metroPortoQueryAll<MetroLine>(
      `SELECT l.line_id, l.short_name, l.long_name, l.color, l.text_color
       FROM metro_station_lines sl
       INNER JOIN metro_lines l ON l.line_id = sl.line_id
       WHERE sl.station_id = ?
       ORDER BY l.short_name`,
      [stationId ?? ''],
    ),
    enabled: !!stationId,
    staleTime: Infinity,
  })
}

const DEPARTURES_LIMIT = 20

/** Próximas partidas de uma estação, a partir da hora atual, respeitando o calendário GTFS. */
export function useMetroNextDepartures(stationId?: string) {
  return useQuery({
    queryKey: ['metro-porto', 'next-departures', stationId],
    queryFn: async () => {
      const now = new Date()
      const serviceIds = await getActiveServiceIds(now)
      if (serviceIds.length === 0) return [] as MetroDeparture[]

      const placeholders = serviceIds.map(() => '?').join(', ')
      return metroPortoQueryAll<MetroDeparture>(
        `SELECT st.departure_seconds, t.destination, t.line_id, l.short_name, l.color
         FROM metro_stop_times st
         INNER JOIN metro_trips t ON t.trip_id = st.trip_id
         INNER JOIN metro_lines l ON l.line_id = t.line_id
         WHERE st.station_id = ?
           AND st.departure_seconds >= ?
           AND t.service_id IN (${placeholders})
         ORDER BY st.departure_seconds
         LIMIT ${DEPARTURES_LIMIT}`,
        [stationId ?? '', secondsSinceMidnight(now), ...serviceIds],
      )
    },
    enabled: !!stationId,
    // A "próxima partida" depende da hora atual — refresca com regularidade, mas não a cada render.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/** Formata segundos desde a meia-noite como "HH:MM" (suporta >= 24h, GTFS de serviços noturnos). */
export function formatDepartureTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600) % 24
  const m = Math.floor((totalSeconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
