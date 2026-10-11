// Concelhos da API Aberta (`/geo/municipalities`, WEB-042): cache persistente da lista, pesquisa,
// formatação e enquadramento da fronteira (GeoJSON) no mapa. Sem dependências de plataforma: o
// armazenamento (localStorage no web, expo-sqlite/kv-store no mobile) é injetado.
import type { GeoBoundary, GeoMunicipality } from './client.js'

export const MUNICIPALITIES_CACHE_KEY = 'apiaberta:geo:municipalities:v1'
// A lista de concelhos quase não muda: 30 dias de cache.
export const MUNICIPALITIES_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Subconjunto de `localStorage` / AsyncStorage (síncrono ou assíncrono). */
export interface KeyValueStorage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
}

interface MunicipalitiesCacheEntry {
  savedAt: number
  data: GeoMunicipality[]
}

async function readCache(storage: KeyValueStorage): Promise<MunicipalitiesCacheEntry | null> {
  try {
    const raw = await storage.getItem(MUNICIPALITIES_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as MunicipalitiesCacheEntry
    return typeof entry?.savedAt === 'number' && Array.isArray(entry.data) && entry.data.length > 0 ? entry : null
  } catch {
    return null
  }
}

/**
 * Lista ordenada dos concelhos: a cache com menos de 30 dias evita o pedido; senão pede à API e grava.
 * Se a API falhar, usa a cache expirada (se existir).
 */
export async function loadMunicipalitiesCached(options: {
  fetchAll: () => Promise<GeoMunicipality[]>
  storage?: KeyValueStorage | null
  now?: () => number
}): Promise<GeoMunicipality[]> {
  const { fetchAll, storage, now = Date.now } = options
  const cached = storage ? await readCache(storage) : null
  if (cached && now() - cached.savedAt < MUNICIPALITIES_CACHE_TTL_MS) return cached.data

  let fresh: GeoMunicipality[]
  try {
    fresh = sortMunicipalities(await fetchAll())
  } catch (err) {
    if (cached) return cached.data
    throw err
  }
  if (storage && fresh.length > 0) {
    try {
      await storage.setItem(MUNICIPALITIES_CACHE_KEY, JSON.stringify({ savedAt: now(), data: fresh }))
    } catch {
      // Sem espaço/armazenamento indisponível: segue sem cache.
    }
  }
  return fresh
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function sortMunicipalities(list: GeoMunicipality[]): GeoMunicipality[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
}

/**
 * Distrito do concelho ou, nas ilhas (a API devolve `district` vazio), a região autónoma pelo código
 * INE: 31–32 → Madeira, 41–49 → Açores.
 */
export function municipalityDistrict(m: Pick<GeoMunicipality, 'district' | 'codigoine'>): string {
  if (m.district) return m.district
  if (/^3[12]/.test(m.codigoine)) return 'Madeira'
  if (/^4[1-9]/.test(m.codigoine)) return 'Açores'
  return ''
}

/** Distritos/regiões presentes na lista, por ordem alfabética. */
export function municipalityDistricts(list: GeoMunicipality[]): string[] {
  return [...new Set(list.map(municipalityDistrict).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'))
}

/** Pesquisa sem acentos pelo nome (ou código INE) e filtro opcional por distrito/região. */
export function filterMunicipalities(
  list: GeoMunicipality[],
  { query, district }: { query?: string; district?: string | null } = {},
): GeoMunicipality[] {
  const q = fold(query ?? '')
  return list.filter(m =>
    (!district || municipalityDistrict(m) === district) &&
    (!q || fold(m.name).includes(q) || m.codigoine === q),
  )
}

/** Área em hectares → "100,2 km²". */
export function formatAreaKm2(areaHa: number | null | undefined): string | null {
  if (typeof areaHa !== 'number' || !Number.isFinite(areaHa)) return null
  const km2 = areaHa / 100
  return `${km2.toLocaleString('pt-PT', { maximumFractionDigits: km2 < 100 ? 1 : 0 })} km²`
}

/** "241330100" → "241 330 100" (outros formatos ficam como vieram). */
export function formatPtPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length === 9 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : phone.trim()
}

/** Limites `[oeste, sul, este, norte]` da fronteira, ou `null` se não tiver coordenadas válidas. */
export function boundaryBounds(boundary: GeoBoundary | null | undefined): [number, number, number, number] | null {
  if (!boundary?.geometry) return null
  const polygons = boundary.geometry.type === 'Polygon' ? [boundary.geometry.coordinates] : boundary.geometry.coordinates
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
        west = Math.min(west, lng)
        east = Math.max(east, lng)
        south = Math.min(south, lat)
        north = Math.max(north, lat)
      }
    }
  }
  return Number.isFinite(west) ? [west, south, east, north] : null
}
