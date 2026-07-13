import { useQuery } from '@tanstack/react-query'
import JSZip from 'jszip'
import Papa from 'papaparse'
import { transit_realtime } from 'gtfs-realtime-bindings'

// ── Endpoints ─────────────────────────────────────────────────────────────

const BASE = import.meta.env.DEV
  ? '/api/carris'
  : 'https://corsproxy.io/?url=https://gateway.carris.pt/gateway/gtfs/api/v2.11'

const GTFS_ZIP_URL = `${BASE}/GTFS`
const GTFS_RT_URL  = `${BASE}/GTFS/realtime/vehiclepositions`

// ── Types ─────────────────────────────────────────────────────────────────

export interface CarrisRoute {
  route_id: string
  route_short_name: string
  route_long_name: string
  route_type: string
  route_color: string
  route_text_color: string
}

export interface CarrisStop {
  stop_id: string
  stop_name: string
  stop_lat: string
  stop_lon: string
}

export interface CarrisTrip {
  route_id: string
  trip_id: string
  trip_headsign: string
  direction_id: string
}

export interface CarrisVehicle {
  id: string
  label: string
  tripId: string
  routeId: string
  directionId: number
  lat: number
  lon: number
  bearing: number
  speed: number
  stopId: string
  currentStopSequence: number
  timestamp: number
}

// ── GTFS Static ───────────────────────────────────────────────────────────

interface GtfsStatic {
  routes: CarrisRoute[]
  stops: CarrisStop[]
  trips: CarrisTrip[]
}

async function fetchGtfsStatic(): Promise<GtfsStatic> {
  const res = await fetch(GTFS_ZIP_URL)
  if (!res.ok) throw new Error(`Erro ao descarregar GTFS Carris (HTTP ${res.status})`)

  const buffer = await res.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)

  async function parseCsv<T>(filename: string): Promise<T[]> {
    const file = zip.file(filename)
    if (!file) return []
    const text = await file.async('text')
    const { data } = Papa.parse<T>(text, { header: true, skipEmptyLines: true })
    return data
  }

  const [routes, stops, trips] = await Promise.all([
    parseCsv<CarrisRoute>('routes.txt'),
    parseCsv<CarrisStop>('stops.txt'),
    parseCsv<CarrisTrip>('trips.txt'),
  ])

  return { routes, stops, trips }
}

export function useCarrisGtfs() {
  return useQuery({
    queryKey: ['carris', 'gtfs-static'],
    queryFn: fetchGtfsStatic,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// ── GTFS-Realtime vehicle positions ──────────────────────────────────────

async function fetchVehiclePositions(): Promise<CarrisVehicle[]> {
  const res = await fetch(GTFS_RT_URL)
  if (!res.ok) throw new Error(`Erro ao obter posições Carris (HTTP ${res.status})`)

  const buffer = await res.arrayBuffer()
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer))

  const vehicles: CarrisVehicle[] = []

  for (const entity of feed.entity ?? []) {
    const vp = entity.vehicle
    if (!vp?.position) continue

    const routeId  = vp.trip?.routeId  ?? ''
    const tripId   = vp.trip?.tripId   ?? ''
    const dirId    = vp.trip?.directionId ?? 0
    const stopId   = vp.stopId         ?? ''
    const seq      = vp.currentStopSequence ?? 0
    const ts       = typeof vp.timestamp === 'object'
      ? Number((vp.timestamp as unknown as { low: number }).low) * 1000
      : Number(vp.timestamp ?? 0) * 1000

    vehicles.push({
      id:                  entity.id,
      label:               vp.vehicle?.label ?? entity.id,
      tripId,
      routeId,
      directionId:         typeof dirId === 'number' ? dirId : Number(dirId),
      lat:                 vp.position.latitude,
      lon:                 vp.position.longitude,
      bearing:             vp.position.bearing ?? 0,
      speed:               vp.position.speed   ?? 0,
      stopId,
      currentStopSequence: typeof seq === 'number' ? seq : Number(seq),
      timestamp:           ts,
    })
  }

  return vehicles
}

export function useCarrisVehicles() {
  return useQuery({
    queryKey: ['carris', 'vehicles'],
    queryFn: fetchVehiclePositions,
    staleTime: 20 * 1000,
    refetchInterval: 30 * 1000,
    retry: 1,
  })
}
