// Open Charge Map — postos de carregamento EV perto de um ponto (WEB-040). Cliente agnóstico de
// plataforma: a chave (`OPEN_CHARGE_MAP_KEY`) é injetada por cada app. Dados CC BY 4.0
// (Open Charge Map Contributors), por isso a atribuição tem de ser mostrada.
import { haversineDistance } from '../utils/index.js'
import { ApiError } from './client.js'

export const OPEN_CHARGE_MAP_BASE_URL = 'https://api.openchargemap.io/v3'
export const OPEN_CHARGE_MAP_ATTRIBUTION = 'Open Charge Map Contributors (CC BY 4.0)'

export const EV_CHARGER_RADII_KM = [5, 10, 25, 50] as const
export const EV_CHARGER_MIN_POWER_OPTIONS = [
  { value: '22', label: '≥ 22 kW' },
  { value: '50', label: '≥ 50 kW' },
  { value: '150', label: '≥ 150 kW' },
] as const

export type EvChargerStatus = 'operational' | 'partial' | 'unavailable' | 'planned' | 'unknown'

export interface EvConnector {
  /** Rótulo curto (ex.: `Type 2`, `CCS2`, `CHAdeMO`). */
  type: string
  powerKw: number | null
  current: 'AC' | 'DC' | null
  quantity: number
}

export interface EvCharger {
  id: number
  name: string
  address: string | null
  town: string | null
  latitude: number
  longitude: number
  /** Distância (km) ao ponto pedido. */
  distanceKm: number
  operator: string | null
  operatorWebsite: string | null
  /** Tipo de acesso em português (ex.: "Público · cartão/app"). */
  access: string | null
  isPublic: boolean | null
  /** Texto livre do Open Charge Map, tal como vem (ex.: "Mobi.E compatible card or App"). */
  usageCost: string | null
  status: EvChargerStatus
  statusLabel: string
  /** Número de pontos de carregamento (`NumberOfPoints`), se declarado. */
  points: number | null
  maxPowerKw: number | null
  hasDc: boolean
  connectors: EvConnector[]
  comments: string | null
  /** Última verificação ou atualização de estado (ISO). */
  lastVerified: string | null
  url: string
}

export interface NearbyEvChargersParams {
  latitude: number
  longitude: number
  radiusKm?: number
  maxResults?: number
  /** Só postos com pelo menos uma tomada com esta potência (kW). */
  minPowerKw?: number
}

export interface OpenChargeMapClientOptions {
  apiKey: string
  baseUrl?: string
  /** Só no nativo: o browser não deixa definir o `User-Agent`. */
  userAgent?: string
}

// Subconjunto da resposta de `/poi` com `compact=false&verbose=false` (campos nulos omitidos).
interface OcmTitled {
  ID?: number
  Title?: string
}

interface OcmConnection {
  ConnectionTypeID?: number
  ConnectionType?: OcmTitled
  CurrentTypeID?: number
  PowerKW?: number
  Quantity?: number
}

export interface OcmPoi {
  ID: number
  AddressInfo?: {
    Title?: string
    AddressLine1?: string
    AddressLine2?: string
    Town?: string
    Postcode?: string
    Latitude?: number
    Longitude?: number
    Distance?: number
  }
  OperatorInfo?: OcmTitled & { WebsiteURL?: string }
  UsageTypeID?: number
  UsageCost?: string
  StatusTypeID?: number
  StatusType?: OcmTitled & { IsOperational?: boolean }
  NumberOfPoints?: number
  Connections?: OcmConnection[]
  GeneralComments?: string
  DateLastVerified?: string
  DateLastStatusUpdate?: string
}

const CONNECTION_LABELS: Record<number, string> = {
  1: 'Type 1',
  2: 'CHAdeMO',
  13: 'Europlug',
  17: 'CEE 5 pinos',
  25: 'Type 2',
  27: 'Tesla Supercharger',
  28: 'Schuko',
  30: 'Tesla',
  32: 'CCS1',
  33: 'CCS2',
  1036: 'Type 2 (cabo)',
}

const USAGE_LABELS: Record<number, { label: string; isPublic: boolean }> = {
  1: { label: 'Público', isPublic: true },
  4: { label: 'Público · cartão/app', isPublic: true },
  5: { label: 'Público · pagamento no local', isPublic: true },
  7: { label: 'Público · aviso prévio', isPublic: true },
  2: { label: 'Privado · acesso restrito', isPublic: false },
  3: { label: 'Privado · aviso prévio', isPublic: false },
  6: { label: 'Privado · clientes e visitantes', isPublic: false },
}

const STATUS_LABELS: Record<EvChargerStatus, string> = {
  operational: 'Operacional',
  partial: 'Parcialmente operacional',
  unavailable: 'Indisponível',
  planned: 'Planeado',
  unknown: 'Estado desconhecido',
}

// 200/210: removido ou duplicado.
const REMOVED_STATUS_IDS = new Set([200, 210])

function chargerStatus(id: number | undefined): EvChargerStatus {
  switch (id) {
    case 10:
    case 20:
    case 50:
      return 'operational'
    case 75:
      return 'partial'
    case 30:
    case 100:
      return 'unavailable'
    case 150:
      return 'planned'
    default:
      return 'unknown'
  }
}

function connectorLabel(c: OcmConnection): string {
  const id = c.ConnectionTypeID ?? c.ConnectionType?.ID
  if (id != null && CONNECTION_LABELS[id]) return CONNECTION_LABELS[id]
  const title = c.ConnectionType?.Title?.trim()
  return title && id !== 0 ? title : 'Desconhecido'
}

// 10/20: AC mono/trifásico; 30: DC.
function connectorCurrent(id: number | undefined): 'AC' | 'DC' | null {
  if (id === 30) return 'DC'
  if (id === 10 || id === 20) return 'AC'
  return null
}

/** Agrupa as tomadas iguais (tipo + potência + AC/DC), da mais potente para a menos potente. */
function groupConnectors(connections: OcmConnection[]): EvConnector[] {
  const groups = new Map<string, EvConnector>()
  for (const c of connections) {
    const type = connectorLabel(c)
    const powerKw = c.PowerKW != null && c.PowerKW > 0 ? c.PowerKW : null
    const current = connectorCurrent(c.CurrentTypeID)
    const key = `${type}|${powerKw}|${current}`
    const quantity = c.Quantity != null && c.Quantity > 0 ? c.Quantity : 1
    const existing = groups.get(key)
    if (existing) existing.quantity += quantity
    else groups.set(key, { type, powerKw, current, quantity })
  }
  return [...groups.values()].sort((a, b) => (b.powerKw ?? 0) - (a.powerKw ?? 0))
}

// "(Unknown Operator)", "(Business Owner at Location)", … não são operadores reais.
function operatorName(title: string | undefined): string | null {
  const t = title?.trim()
  return t && !t.startsWith('(') ? t : null
}

export function normalizeOcmPoi(poi: OcmPoi, from?: { latitude: number; longitude: number }): EvCharger | null {
  const a = poi.AddressInfo
  if (a?.Latitude == null || a.Longitude == null) return null
  if (poi.StatusTypeID != null && REMOVED_STATUS_IDS.has(poi.StatusTypeID)) return null

  const connectors = groupConnectors(poi.Connections ?? [])
  const powers = connectors.map(c => c.powerKw).filter((p): p is number => p != null)
  const status = chargerStatus(poi.StatusTypeID ?? poi.StatusType?.ID)
  const usage = poi.UsageTypeID != null ? USAGE_LABELS[poi.UsageTypeID] : undefined
  const distanceKm =
    a.Distance != null
      ? a.Distance
      : from
        ? haversineDistance(from.latitude, from.longitude, a.Latitude, a.Longitude)
        : 0
  const street = [a.AddressLine1, a.AddressLine2].map(s => s?.trim()).filter(Boolean).join(', ')
  const town = [a.Postcode?.trim(), a.Town?.trim()].filter(Boolean).join(' ')

  return {
    id: poi.ID,
    name: a.Title?.trim() || operatorName(poi.OperatorInfo?.Title) || 'Posto de carregamento',
    address: street || null,
    town: town || null,
    latitude: a.Latitude,
    longitude: a.Longitude,
    distanceKm,
    operator: operatorName(poi.OperatorInfo?.Title),
    operatorWebsite: poi.OperatorInfo?.WebsiteURL?.trim() || null,
    access: usage?.label ?? null,
    isPublic: usage?.isPublic ?? null,
    usageCost: poi.UsageCost?.trim() || null,
    status,
    statusLabel: STATUS_LABELS[status],
    points: poi.NumberOfPoints != null && poi.NumberOfPoints > 0 ? poi.NumberOfPoints : null,
    maxPowerKw: powers.length > 0 ? Math.max(...powers) : null,
    hasDc: connectors.some(c => c.current === 'DC'),
    connectors,
    comments: poi.GeneralComments?.trim() || null,
    lastVerified: poi.DateLastVerified ?? poi.DateLastStatusUpdate ?? null,
    url: `https://map.openchargemap.io/?id=${poi.ID}`,
  }
}

/** `22 kW`, `7,4 kW`. */
export function formatPowerKw(kw: number): string {
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(kw)} kW`
}

/** `CCS2 · 50 kW (DC) ×2` */
export function formatEvConnector(c: EvConnector): string {
  const power = c.powerKw != null ? ` · ${formatPowerKw(c.powerKw)}` : ''
  const current = c.current ? ` (${c.current})` : ''
  const qty = c.quantity > 1 ? ` ×${c.quantity}` : ''
  return `${c.type}${power}${current}${qty}`
}

/** Não vale a pena repetir pedidos com a chave em falta ou inválida. */
export function shouldRetryOpenChargeMap(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return false
  return failureCount < 2
}

export function createOpenChargeMapClient(options: OpenChargeMapClientOptions) {
  const baseUrl = options.baseUrl ?? OPEN_CHARGE_MAP_BASE_URL
  const apiKey = options.apiKey.trim()

  async function getNearbyChargers(params: NearbyEvChargersParams): Promise<EvCharger[]> {
    if (!apiKey) {
      throw new ApiError(401, 'Chave do Open Charge Map em falta (definir OPEN_CHARGE_MAP_KEY no .env)')
    }
    const url = new URL(`${baseUrl}/poi/`)
    const query: Record<string, string> = {
      output: 'json',
      countrycode: 'PT',
      latitude: params.latitude.toFixed(5),
      longitude: params.longitude.toFixed(5),
      distance: String(params.radiusKm ?? 10),
      distanceunit: 'KM',
      maxresults: String(params.maxResults ?? 100),
      compact: 'false',
      verbose: 'false',
      client: 'portugal-hoje',
    }
    if (params.minPowerKw && params.minPowerKw > 0) query.minpowerkw = String(params.minPowerKw)
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

    const headers: Record<string, string> = { 'X-API-Key': apiKey, Accept: 'application/json' }
    if (options.userAgent) headers['User-Agent'] = options.userAgent

    const res = await fetch(url.toString(), { headers })
    if (!res.ok) {
      const message =
        res.status === 401 || res.status === 403
          ? 'Chave do Open Charge Map inválida ou sem permissão (OPEN_CHARGE_MAP_KEY)'
          : `Open Charge Map respondeu ${res.status}`
      throw new ApiError(res.status, message)
    }
    const pois = (await res.json()) as OcmPoi[]
    const from = { latitude: params.latitude, longitude: params.longitude }
    return pois
      .map(p => normalizeOcmPoi(p, from))
      .filter((c): c is EvCharger => c !== null)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }

  return { getNearbyChargers }
}

export type OpenChargeMapClient = ReturnType<typeof createOpenChargeMapClient>
