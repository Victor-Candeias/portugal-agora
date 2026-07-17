// SIGTUR / TravelBI (Turismo de Portugal) — dados consumidos via serviços ArcGIS REST.
// Ver .Docs/Turismo.txt para o desenho da integração.
//
// Nota: o host documentado em .Docs/Turismo.txt (servergeo.sgeconomia.gov.pt) está
// atualmente inacessível (TLS connection reset, confirmado fora deste ambiente).
// O host real e funcional, confirmado via catálogo ArcGIS Online (item
// "SigTur_Indicadores", owner service.desk.tdp) e testado com pedidos reais, é:
const ARCGIS_BASE = 'https://geo.turismodeportugal.pt/server/rest/services/TDP'

// O servidor só devolve cabeçalhos CORS para origens oficiais (ex. sigtur.turismodeportugal.pt),
// pelo que apps web (browser) não conseguem usar `fetch` diretamente nem via proxies de
// terceiros (corsproxy.io passou a exigir plano pago; alternativas gratuitas como
// allorigins/codetabs não conseguem alcançar este servidor a partir de infraestrutura cloud).
// A solução robusta e nativa dos servidores ArcGIS REST é JSONP (parâmetro `callback`),
// que contorna CORS por completo (pedido feito via <script>, não via fetch/XHR).
// Apps nativas (mobile) não são sujeitas a CORS, por isso usam `fetch` diretamente.
export type SigturTransport = (url: URL) => Promise<ArcGisGeoJsonResponse>

async function defaultFetchTransport(url: URL): Promise<ArcGisGeoJsonResponse> {
  url.searchParams.set('f', 'geojson')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`SIGTUR ArcGIS error: ${res.status}`)
  return res.json() as Promise<ArcGisGeoJsonResponse>
}

let transport: SigturTransport = defaultFetchTransport

/**
 * Permite a uma app (ex. web) substituir o mecanismo de pedido usado para consultar o ArcGIS
 * (por omissão, `fetch` direto — usado pela app mobile, que não está sujeita a CORS).
 * A app web usa isto para fazer os pedidos via JSONP (ver apps/web/src/lib/sigtur.ts).
 */
export function configureSigturTransport(fn: SigturTransport): void {
  transport = fn
}

export interface SigturLayerConfig {
  /** Identificador interno usado como categoria/subcategoria da app. */
  category: string
  subcategory?: string
  /** Nome do serviço ArcGIS, ex. "SIGTUR_TurismoSaudeBemEstar". */
  service: string
  layerId: number
  /** Alguns datasets (ex. OpenData_*) só existem como MapServer, não FeatureServer. */
  serverType?: 'FeatureServer' | 'MapServer'
}

// Layers validadas manualmente no catálogo real (geo.turismodeportugal.pt/server/rest/services/TDP).
// Novas layers podem ser adicionadas progressivamente (ver Fase 9 de .Docs/Turismo.txt).
export const SIGTUR_LAYERS: SigturLayerConfig[] = [
  {
    category: 'health-wellness',
    subcategory: 'thermal-spa',
    service: 'SIGTUR_TurismoSaudeBemEstar',
    layerId: 27,
  },
  {
    category: 'accommodation',
    service: 'SIGTUR_AlojamentosTuristicos',
    layerId: 2, // "ET Existentes" (Empreendimentos Turísticos existentes)
  },
  {
    category: 'nature',
    subcategory: 'mountain-biking',
    service: 'SIGTUR_TurismoNatureza',
    layerId: 9, // "Centros BTT"
  },
  {
    category: 'culture',
    subcategory: 'historic-villages',
    service: 'OpenData_AldeiasHistoricas',
    layerId: 1, // "Aldeias Históricas"
    serverType: 'MapServer',
  },
  {
    category: 'beaches-golf',
    subcategory: 'beach',
    service: 'OpenData_PraiasBA',
    layerId: 30, // "Praias com Bandeira Azul"
    serverType: 'MapServer',
  },
  {
    category: 'beaches-golf',
    subcategory: 'golf',
    service: 'SIGTUR_Golfe',
    layerId: 1, // "Campos de Golfe"
  },
  {
    category: 'wine-tourism',
    service: 'SIGTUR_Light_Enoturismo',
    layerId: 1, // "Unidades de Enoturismo"
  },
]

function layerUrl(layer: SigturLayerConfig): string {
  return `${ARCGIS_BASE}/${layer.service}/${layer.serverType ?? 'FeatureServer'}/${layer.layerId}`
}

export interface ArcGisQueryParams {
  where?: string
  geometry?: string
  geometryType?: 'esriGeometryEnvelope' | 'esriGeometryPoint'
  distanceKm?: number
  resultOffset?: number
  resultRecordCount?: number
}

export interface ArcGisGeoJsonResponse {
  features: Array<{
    type: 'Feature'
    geometry: { type: string; coordinates: [number, number] } | null
    properties: Record<string, unknown>
  }>
}

async function queryLayer(layer: SigturLayerConfig, params: ArcGisQueryParams = {}): Promise<ArcGisGeoJsonResponse> {
  const url = new URL(`${layerUrl(layer)}/query`)
  url.searchParams.set('where', params.where ?? '1=1')
  url.searchParams.set('outFields', '*')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('resultOffset', String(params.resultOffset ?? 0))
  url.searchParams.set('resultRecordCount', String(params.resultRecordCount ?? 1000))

  if (params.geometry) {
    url.searchParams.set('geometry', params.geometry)
    url.searchParams.set('geometryType', params.geometryType ?? 'esriGeometryEnvelope')
    url.searchParams.set('inSR', '4326')
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects')
    if (params.distanceKm) {
      url.searchParams.set('distance', String(params.distanceKm))
      url.searchParams.set('units', 'esriSRUnit_Kilometer')
    }
  }

  return transport(url)
}

/** Mapeamento de campos de origem (variam por layer) → modelo normalizado. */
function firstDefined(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return undefined
}

export interface TourismPoint {
  id: string
  externalId: string
  name: string
  category: string
  subcategory?: string
  municipality?: string
  address?: string
  postalCode?: string
  phone?: string
  email?: string
  website?: string
  latitude: number
  longitude: number
  source: {
    provider: 'Turismo de Portugal'
    system: 'SIGTUR'
    service: string
    layerId: number
    objectId: string
  }
}

/** O campo Website vem como HTML (`<a href="...">Label</a>`) — extrai só o URL. */
function extractHref(value: string | undefined): string | undefined {
  if (!value) return undefined
  const match = value.match(/href=["']([^"']+)["']/i)
  const url = (match ? match[1] : value).trim()
  return url || undefined
}

function normalizeFeature(
  feature: ArcGisGeoJsonResponse['features'][number],
  layer: SigturLayerConfig,
): TourismPoint | null {
  const { properties, geometry } = feature
  if (!geometry || geometry.type !== 'Point') return null

  const objectId = firstDefined(properties, ['OBJECTID', 'FID', 'objectid']) ?? ''
  const name = firstDefined(properties, [
    'Denominacao', 'Denominação', 'NOME', 'DENOMINACAO', 'DESIGNACAO', 'QUINTA', 'Name',
  ]) ?? 'Sem nome'
  const [longitude, latitude] = geometry.coordinates

  return {
    id: `arcgis:${layer.service}:${layer.layerId}:${objectId}`,
    externalId: objectId,
    name,
    category: layer.category,
    subcategory: layer.subcategory,
    municipality: firstDefined(properties, ['Concelho', 'CONCELHO', 'MUNICIPIO']),
    address: firstDefined(properties, ['Endereco', 'MORADA', 'ENDERECO', 'Endereco_ent_gest']),
    postalCode: firstDefined(properties, ['CodigoPostal', 'COD_POSTAL', 'CP', 'Codigo_postal']),
    phone: firstDefined(properties, ['Telefone', 'TELEFONE', 'CONTACTO']),
    email: firstDefined(properties, ['Email', 'EMAIL', 'E_mail']),
    website: extractHref(firstDefined(properties, ['Website', 'WEBSITE', 'URL', 'SITE', 'Link', 'LINK'])),
    latitude,
    longitude,
    source: {
      provider: 'Turismo de Portugal',
      system: 'SIGTUR',
      service: layer.service,
      layerId: layer.layerId,
      objectId,
    },
  }
}

export interface TourismPointsParams {
  category?: string
  /** [minLng, minLat, maxLng, maxLat] */
  bbox?: [number, number, number, number]
  nearby?: { latitude: number; longitude: number; radiusKm: number }
}

export const sigturClient = {
  /** Consulta e normaliza pontos de interesse turístico em todas (ou numa) das layers configuradas. */
  async getTourismPoints(params: TourismPointsParams = {}): Promise<TourismPoint[]> {
    const layers = params.category
      ? SIGTUR_LAYERS.filter(l => l.category === params.category)
      : SIGTUR_LAYERS

    const geometry = params.bbox
      ? params.bbox.join(',')
      : params.nearby
        ? `${params.nearby.longitude},${params.nearby.latitude}`
        : undefined
    const geometryType = params.bbox ? 'esriGeometryEnvelope' : params.nearby ? 'esriGeometryPoint' : undefined

    const results = await Promise.all(
      layers.map(async layer => {
        const response = await queryLayer(layer, {
          geometry,
          geometryType,
          distanceKm: params.nearby?.radiusKm,
        })
        return response.features
          .map(feature => normalizeFeature(feature, layer))
          .filter((point): point is TourismPoint => point !== null)
      }),
    )

    return results.flat()
  },

  getCategories(): string[] {
    return [...new Set(SIGTUR_LAYERS.map(l => l.category))]
  },
}
