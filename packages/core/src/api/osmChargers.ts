// OpenStreetMap — postos de carregamento EV (`amenity=charging_station`) via Overpass API (WEB-047).
// Complementa o Open Charge Map, que não tem muitos postos Mobi.E (ex.: LSB-01317 da EMEL). Dados ODbL
// (© OpenStreetMap contributors), por isso a atribuição tem de ser mostrada.
import { haversineDistance } from '../utils/index.js'
import { ApiError } from './client.js'
import {
  extractMobieRefs,
  type EvCharger,
  type EvConnector,
  type NearbyEvChargersParams,
} from './openChargeMap.js'

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors (ODbL)'

/** Mirrors públicos com CORS, tentados por esta ordem (o principal fica muitas vezes ocupado: 429/504). */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const

export interface OsmChargersClientOptions {
  endpoints?: readonly string[]
  /** Só no nativo: o `overpass-api.de` responde 406 ao User-Agent por omissão do OkHttp. */
  userAgent?: string
  /** Tempo máximo por mirror (ms). */
  timeoutMs?: number
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const SOCKETS: Record<string, { type: string; current: 'AC' | 'DC' }> = {
  type2: { type: 'Type 2', current: 'AC' },
  type2_cable: { type: 'Type 2 (cabo)', current: 'AC' },
  type2_combo: { type: 'CCS2', current: 'DC' },
  chademo: { type: 'CHAdeMO', current: 'DC' },
  type1: { type: 'Type 1', current: 'AC' },
  type1_combo: { type: 'CCS1', current: 'DC' },
  schuko: { type: 'Schuko', current: 'AC' },
  tesla_supercharger: { type: 'Tesla Supercharger', current: 'DC' },
  tesla_destination: { type: 'Tesla', current: 'AC' },
  cee_blue: { type: 'CEE azul', current: 'AC' },
  cee_red_16a: { type: 'CEE 5 pinos', current: 'AC' },
  cee_red_32a: { type: 'CEE 5 pinos', current: 'AC' },
}

const SOCKET_KEY_RE = /^socket:([a-z0-9_]+)$/

/** `"22 kW"`, `"7,4 kW"`, `"22000 W"`, `"50 kW;22 kW"` → maior potência em kW. */
export function parseOsmPowerKw(value: string | undefined): number | null {
  if (!value) return null
  let max: number | null = null
  for (const part of value.split(';')) {
    const m = part.trim().match(/^([\d.,]+)\s*(kva|kw|w)?/i)
    if (!m) continue
    let kw = Number(m[1].replace(',', '.'))
    const unit = m[2]?.toLowerCase()
    if (unit === 'w' || (!unit && kw > 1000)) kw /= 1000
    if (Number.isFinite(kw) && kw > 0) max = max === null ? kw : Math.max(max, kw)
  }
  return max
}

function osmConnectors(tags: Record<string, string>): EvConnector[] {
  const connectors: EvConnector[] = []
  for (const [key, value] of Object.entries(tags)) {
    const m = key.match(SOCKET_KEY_RE)
    if (!m || value === 'no' || value === '0') continue
    const known = SOCKETS[m[1]]
    const count = Number.parseInt(value, 10)
    connectors.push({
      type: known?.type ?? m[1],
      powerKw: parseOsmPowerKw(tags[`socket:${m[1]}:output`]),
      current: known?.current ?? null,
      quantity: Number.isFinite(count) && count > 0 ? count : 1,
    })
  }
  return connectors.sort((a, b) => (b.powerKw ?? 0) - (a.powerKw ?? 0))
}

function osmAccess(tags: Record<string, string>): { label: string; isPublic: boolean } | null {
  const access = tags.access
  if (access === 'private' || access === 'no') return { label: 'Privado · acesso restrito', isPublic: false }
  if (access === 'customers' || access === 'destination') return { label: 'Privado · clientes e visitantes', isPublic: false }
  if (access && !['yes', 'public', 'permissive'].includes(access)) return null
  const cardOrApp = ['authentication:membership_card', 'authentication:app', 'payment:app', 'payment:membership_card']
    .some(k => tags[k] === 'yes')
  if (!access && !cardOrApp) return null
  return { label: cardOrApp ? 'Público · cartão/app' : 'Público', isPublic: true }
}

export function normalizeOsmCharger(el: OsmElement, from?: { latitude: number; longitude: number }): EvCharger | null {
  const latitude = el.lat ?? el.center?.lat
  const longitude = el.lon ?? el.center?.lon
  const tags = el.tags ?? {}
  if (latitude == null || longitude == null || tags.amenity !== 'charging_station') return null

  const connectors = osmConnectors(tags)
  const powers = connectors.map(c => c.powerKw).filter((p): p is number => p != null)
  const operator = tags.operator?.trim() || tags.brand?.trim() || null
  const access = osmAccess(tags)
  const capacity = Number.parseInt(tags.capacity ?? '', 10)
  const street = [tags['addr:street'], tags['addr:housenumber']].map(s => s?.trim()).filter(Boolean).join(' ')
  const town = [tags['addr:postcode'], tags['addr:city']].map(s => s?.trim()).filter(Boolean).join(' ')
  // No OSM muitos postos Mobi.E só têm o código como nome (ex.: "LSB-01317"); aí mostra-se o operador.
  const ownName = tags.name?.trim()
  const name = ownName && !/^[A-Z]{2,4}-\d{4,6}$/i.test(ownName) ? ownName : null

  return {
    id: `osm:${el.type}/${el.id}`,
    source: 'osm',
    refs: extractMobieRefs([tags.ref, tags.name].filter(Boolean).join(' ')),
    name: name || operator || 'Posto de carregamento',
    address: street || null,
    town: town || null,
    latitude,
    longitude,
    distanceKm: from ? haversineDistance(from.latitude, from.longitude, latitude, longitude) : 0,
    operator,
    operatorWebsite: tags.website?.trim() || null,
    access: access?.label ?? null,
    isPublic: access?.isPublic ?? null,
    usageCost: tags.charge?.trim() || (tags.fee === 'no' ? 'Gratuito' : null),
    // O OSM não tem o estado do posto.
    status: 'unknown',
    statusLabel: 'Estado desconhecido',
    points: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    maxPowerKw: powers.length > 0 ? Math.max(...powers) : null,
    hasDc: connectors.some(c => c.current === 'DC'),
    connectors,
    comments: tags.description?.trim() || null,
    lastVerified: tags.check_date ?? tags['survey:date'] ?? null,
    url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  }
}

/** Distância abaixo da qual dois postos sem código Mobi.E comum são o mesmo (km). */
const SAME_PLACE_KM = 0.025
// ~25 m em latitude, para descartar depressa os pares longe.
const SAME_PLACE_DEG = 0.0003

/**
 * Junta os postos de duas fontes sem repetir: os de `primary` (Open Charge Map) ficam sempre; um de
 * `extra` (OpenStreetMap) é ignorado se partilhar um código Mobi.E com um da `primary` ou, quando um
 * deles não tem código, se estiver a menos de 25 m. Postos com códigos diferentes nunca se juntam.
 * Se o repetido da `primary` não tiver tomadas, recebe as do `extra`.
 */
export function mergeEvChargers(primary: EvCharger[], extra: EvCharger[]): EvCharger[] {
  const byRef = new Map<string, number>()
  primary.forEach((c, i) => c.refs.forEach(r => byRef.set(r, i)))
  const merged = [...primary]

  for (const x of extra) {
    let match = x.refs.map(r => byRef.get(r)).find((i): i is number => i !== undefined)
    if (match === undefined) {
      match = primary.findIndex(
        p =>
          (p.refs.length === 0 || x.refs.length === 0) &&
          Math.abs(p.latitude - x.latitude) < SAME_PLACE_DEG &&
          haversineDistance(p.latitude, p.longitude, x.latitude, x.longitude) < SAME_PLACE_KM,
      )
      if (match === -1) match = undefined
    }
    if (match === undefined) {
      merged.push(x)
      continue
    }
    const p = merged[match]
    if (p.connectors.length === 0 && x.connectors.length > 0) {
      merged[match] = { ...p, connectors: x.connectors, maxPowerKw: x.maxPowerKw, hasDc: x.hasDc }
    }
  }
  return merged.sort((a, b) => a.distanceKm - b.distanceKm)
}

function overpassQuery(p: NearbyEvChargersParams): string {
  const around = `(around:${Math.round((p.radiusKm ?? 10) * 1000)},${p.latitude.toFixed(5)},${p.longitude.toFixed(5)})`
  return `[out:json][timeout:25];(node["amenity"="charging_station"]${around};way["amenity"="charging_station"]${around};);out center tags;`
}

export function createOsmChargersClient(options: OsmChargersClientOptions = {}) {
  const endpoints = options.endpoints ?? OVERPASS_ENDPOINTS
  const timeoutMs = options.timeoutMs ?? 20_000

  async function fetchElements(query: string, signal?: AbortSignal): Promise<OsmElement[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }
    if (options.userAgent) headers['User-Agent'] = options.userAgent
    let lastError: unknown = null
    for (const endpoint of endpoints) {
      if (signal?.aborted) break
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort)
      const timer = setTimeout(abort, timeoutMs)
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        })
        if (!res.ok) throw new ApiError(res.status, `OpenStreetMap (Overpass) respondeu ${res.status}`)
        const json = (await res.json()) as { elements?: OsmElement[]; remark?: string }
        // Um timeout do Overpass vem como 200 com `remark` e sem elementos.
        if (!json.elements || (json.elements.length === 0 && json.remark?.includes('error'))) {
          throw new ApiError(504, 'OpenStreetMap (Overpass) sem resposta')
        }
        return json.elements
      } catch (error) {
        lastError = error
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abort)
      }
    }
    if (lastError instanceof ApiError) throw lastError
    throw new ApiError(503, 'OpenStreetMap (Overpass) indisponível de momento')
  }

  /** Postos do OSM num raio, do mais perto para o mais longe. Sem potência conhecida, ficam de fora do filtro de potência. */
  async function getNearbyChargers(params: NearbyEvChargersParams, signal?: AbortSignal): Promise<EvCharger[]> {
    const elements = await fetchElements(overpassQuery(params), signal)
    const from = { latitude: params.latitude, longitude: params.longitude }
    const minPower = params.minPowerKw && params.minPowerKw > 0 ? params.minPowerKw : null
    return elements
      .map(el => normalizeOsmCharger(el, from))
      .filter((c): c is EvCharger => c !== null)
      .filter(c => minPower === null || (c.maxPowerKw != null && c.maxPowerKw >= minPower))
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }

  return { getNearbyChargers }
}
