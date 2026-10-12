// Freguesias de um concelho (limites, área e centroide) via geoapi.pt (WEB-049), com dados da CAOP
// (DGT). O `json.geoapi.pt` é gratuito, sem chave e com CORS `*`. A geoapi.pt identifica o concelho
// pelo nome (homónimos com nome próprio: "Calheta de São Jorge", "Lagoa (Açores)"), por isso o
// concelho da API Aberta é associado pelo código INE através do índice `/municipios/freguesias`.
// A geometria é simplificada (Douglas-Peucker) para caber na cache persistente (~20–100 KB/concelho).
import type { GeoBoundary } from './client.js'
import type { KeyValueStorage } from './geo.js'

export const GEOAPI_BASE_URL = 'https://json.geoapi.pt'
export const GEOAPI_INDEX_CACHE_KEY = 'geoapi:municipios:v1'
export const GEOAPI_PARISHES_CACHE_PREFIX = 'geoapi:freguesias:v1:'
// Os limites das freguesias quase não mudam: 30 dias de cache.
export const PARISHES_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
/** Tolerância da simplificação em graus (~20 m): invisível à escala de um concelho. */
export const PARISH_SIMPLIFY_TOLERANCE = 0.0002
const COORD_FACTOR = 1e5

type BoundaryGeometry = GeoBoundary['geometry']
type Position = number[]
type Ring = Position[]
type PolygonCoords = Ring[]

export interface GeoApiMunicipalityIndexEntry {
  /** Nome usado pela geoapi.pt (difere da API Aberta nos homónimos). */
  name: string
  codigoine: string
}

export interface MunicipalityParish {
  /** Código DICOFRE (6 dígitos). */
  code: string
  name: string
  area_ha: number | null
  /** Centroide `[lng, lat]`. */
  center: [number, number] | null
  boundary: GeoBoundary
}

export interface MunicipalityParishes {
  codigoine: string
  /** Nome do concelho na geoapi.pt. */
  name: string
  parishes: MunicipalityParish[]
}

export interface ParishFeatureCollection {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    id: string
    properties: { code: string; name: string }
    geometry: BoundaryGeometry
  }>
}

interface GeoApiParishFeature {
  type: 'Feature'
  properties: {
    dtmnfr?: string
    codigoine?: string
    freguesia?: string
    nome?: string
    area_ha?: number
    Area_T_ha?: number
    centros?: { centroide?: number[] }
  } | null
  geometry: BoundaryGeometry | null
}

interface GeoApiMunicipalityParishesResponse {
  nome: string
  codigoine: string
  geojsons?: { freguesias?: GeoApiParishFeature[] }
}

export class GeoApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GeoApiError'
    this.status = status
  }
}

/** Para o `retry` do React Query: não repete 404 nem 429. */
export function shouldRetryGeoApi(failureCount: number, error: unknown): boolean {
  if (error instanceof GeoApiError && (error.status === 404 || error.status === 429)) return false
  return failureCount < 1
}

// ── Simplificação ────────────────────────────────────────────────────────────

function douglasPeucker(points: Ring, tolerance: number): Ring {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const tol2 = tolerance * tolerance
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [x1, y1] = points[a]
    const [x2, y2] = points[b]
    const dx = x2 - x1
    const dy = y2 - y1
    const len2 = dx * dx + dy * dy
    let maxDist = -1
    let maxIndex = -1
    for (let i = a + 1; i < b; i++) {
      const [x, y] = points[i]
      const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0
      const ex = x1 + t * dx - x
      const ey = y1 + t * dy - y
      const d = ex * ex + ey * ey
      if (d > maxDist) {
        maxDist = d
        maxIndex = i
      }
    }
    if (maxDist > tol2) {
      keep[maxIndex] = 1
      stack.push([a, maxIndex], [maxIndex, b])
    }
  }
  return points.filter((_, i) => keep[i])
}

const roundRing = (ring: Ring): Ring =>
  ring.map(([lng, lat]) => [Math.round(lng * COORD_FACTOR) / COORD_FACTOR, Math.round(lat * COORD_FACTOR) / COORD_FACTOR])

// Anéis com menos de 4 pontos depois de simplificados (ilhéus, buracos minúsculos) são descartados,
// exceto o exterior do polígono principal, que fica como veio.
function simplifyPolygon(polygon: PolygonCoords, tolerance: number, keepOuter: boolean): PolygonCoords | null {
  if (!polygon.length) return null
  let outer = roundRing(douglasPeucker(polygon[0], tolerance))
  if (outer.length < 4) {
    if (!keepOuter) return null
    outer = roundRing(polygon[0])
  }
  const holes = polygon
    .slice(1)
    .map(ring => roundRing(douglasPeucker(ring, tolerance)))
    .filter(ring => ring.length >= 4)
  return [outer, ...holes]
}

/** Simplifica a fronteira (Douglas-Peucker por anel) e arredonda as coordenadas a 5 casas (~1 m). */
export function simplifyBoundary(boundary: GeoBoundary, tolerance = PARISH_SIMPLIFY_TOLERANCE): GeoBoundary {
  const g = boundary.geometry
  if (g.type === 'Polygon') {
    return { ...boundary, geometry: { type: 'Polygon', coordinates: simplifyPolygon(g.coordinates, tolerance, true)! } }
  }
  const main = g.coordinates.reduce((best, p, i, all) => (p[0]?.length > (all[best]?.[0]?.length ?? 0) ? i : best), 0)
  const polygons = g.coordinates
    .map((p, i) => simplifyPolygon(p, tolerance, i === main))
    .filter((p): p is PolygonCoords => p !== null)
  return { ...boundary, geometry: { type: 'MultiPolygon', coordinates: polygons } }
}

// ── Conversão ────────────────────────────────────────────────────────────────

const polygonsOf = (g: BoundaryGeometry): PolygonCoords[] => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

/**
 * Converte as features da geoapi.pt em freguesias ordenadas por nome. Features com o mesmo código
 * (partes separadas da mesma freguesia) são juntadas num MultiPolygon.
 */
export function toMunicipalityParishes(features: GeoApiParishFeature[], tolerance = PARISH_SIMPLIFY_TOLERANCE): MunicipalityParish[] {
  const byCode = new Map<string, { name: string; area: number | null; center: [number, number] | null; polygons: PolygonCoords[] }>()
  for (const f of features) {
    const p = f.properties ?? {}
    const code = p.dtmnfr ?? p.codigoine
    const name = p.freguesia ?? p.nome
    if (!code || !name || !f.geometry) continue
    const area = typeof p.area_ha === 'number' ? p.area_ha : typeof p.Area_T_ha === 'number' ? p.Area_T_ha : null
    const c = p.centros?.centroide
    const center: [number, number] | null =
      Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [c[0], c[1]] : null
    const entry = byCode.get(code)
    if (entry) {
      entry.polygons.push(...polygonsOf(f.geometry))
      if (entry.area != null && area != null) entry.area += area
    } else {
      byCode.set(code, { name, area, center, polygons: polygonsOf(f.geometry) })
    }
  }
  return [...byCode.entries()]
    .map(([code, e]) => ({
      code,
      name: e.name,
      area_ha: e.area,
      center: e.center,
      boundary: simplifyBoundary(
        {
          type: 'Feature',
          properties: null,
          geometry: e.polygons.length === 1
            ? { type: 'Polygon', coordinates: e.polygons[0] }
            : { type: 'MultiPolygon', coordinates: e.polygons },
        },
        tolerance,
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/** FeatureCollection das freguesias para os mapas (`id` e `properties.code` = código DICOFRE). */
export function parishesFeatureCollection(parishes: MunicipalityParish[]): ParishFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: parishes.map(p => ({
      type: 'Feature',
      id: p.code,
      properties: { code: p.code, name: p.name },
      geometry: p.boundary.geometry,
    })),
  }
}

// ── Cliente ──────────────────────────────────────────────────────────────────

export interface GeoApiClientOptions {
  baseUrl?: string
}

export function createGeoApiClient(options: GeoApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? GEOAPI_BASE_URL

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } })
    if (res.status === 404) throw new GeoApiError(404, 'Concelho não encontrado na geoapi.pt.')
    if (res.status === 429) throw new GeoApiError(429, 'Demasiados pedidos à geoapi.pt. Tente mais tarde.')
    if (!res.ok) throw new GeoApiError(res.status, `Erro ao obter as freguesias (HTTP ${res.status})`)
    return (await res.json()) as T
  }

  return {
    /** Os 308 concelhos com o nome da geoapi.pt e o código INE (~92 KB). */
    async getMunicipalityIndex(): Promise<GeoApiMunicipalityIndexEntry[]> {
      const data = await get<Array<{ nome?: string; codigoine?: string }>>('/municipios/freguesias')
      return (Array.isArray(data) ? data : [])
        .filter(m => m.nome && m.codigoine)
        .map(m => ({ name: m.nome!, codigoine: m.codigoine! }))
    },

    /** Freguesias do concelho com o nome da geoapi.pt (ver `getMunicipalityIndex`). */
    async getMunicipalityParishes(name: string): Promise<MunicipalityParish[]> {
      const data = await get<GeoApiMunicipalityParishesResponse>(`/municipio/${encodeURIComponent(name)}/freguesias`)
      return toMunicipalityParishes(data.geojsons?.freguesias ?? [])
    },
  }
}

export type GeoApiClient = ReturnType<typeof createGeoApiClient>

export const geoApiClient = createGeoApiClient()

// ── Cache persistente ────────────────────────────────────────────────────────

interface CacheEntry<T> {
  savedAt: number
  data: T
}

async function readEntry<T>(storage: KeyValueStorage, key: string, isValid: (data: unknown) => boolean): Promise<CacheEntry<T> | null> {
  try {
    const raw = await storage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    return typeof entry?.savedAt === 'number' && isValid(entry.data) ? entry : null
  } catch {
    return null
  }
}

async function loadCached<T>(options: {
  key: string
  storage: KeyValueStorage | null | undefined
  now: () => number
  isValid: (data: unknown) => boolean
  fetch: () => Promise<T>
}): Promise<T> {
  const { key, storage, now, isValid } = options
  const cached = storage ? await readEntry<T>(storage, key, isValid) : null
  if (cached && now() - cached.savedAt < PARISHES_CACHE_TTL_MS) return cached.data

  let fresh: T
  try {
    fresh = await options.fetch()
  } catch (err) {
    if (cached) return cached.data
    throw err
  }
  if (storage && isValid(fresh)) {
    try {
      await storage.setItem(key, JSON.stringify({ savedAt: now(), data: fresh }))
    } catch {
      // Sem espaço/armazenamento indisponível: segue sem cache.
    }
  }
  return fresh
}

const isNonEmptyArray = (data: unknown) => Array.isArray(data) && data.length > 0
const isParishes = (data: unknown) => isNonEmptyArray((data as MunicipalityParishes | null)?.parishes)

/**
 * Freguesias do concelho com o código INE `codigoine` (o da API Aberta). A cache com menos de 30 dias
 * evita o pedido; se a geoapi.pt falhar, usa a cache expirada (se existir).
 */
export async function loadMunicipalityParishesCached(options: {
  codigoine: string
  client?: GeoApiClient
  storage?: KeyValueStorage | null
  now?: () => number
}): Promise<MunicipalityParishes> {
  const { codigoine, client = geoApiClient, storage, now = Date.now } = options
  return loadCached<MunicipalityParishes>({
    key: `${GEOAPI_PARISHES_CACHE_PREFIX}${codigoine}`,
    storage,
    now,
    isValid: isParishes,
    fetch: async () => {
      const index = await loadCached<GeoApiMunicipalityIndexEntry[]>({
        key: GEOAPI_INDEX_CACHE_KEY,
        storage,
        now,
        isValid: isNonEmptyArray,
        fetch: () => client.getMunicipalityIndex(),
      })
      const entry = index.find(m => m.codigoine === codigoine)
      if (!entry) throw new GeoApiError(404, 'Concelho não encontrado na geoapi.pt.')
      const parishes = await client.getMunicipalityParishes(entry.name)
      if (!parishes.length) throw new GeoApiError(404, 'Sem freguesias para este concelho na geoapi.pt.')
      return { codigoine, name: entry.name, parishes }
    },
  })
}
