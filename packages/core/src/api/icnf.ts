// ICNF — Instituto da Conservação da Natureza e das Florestas — dados consumidos via serviços
// ArcGIS REST (mesmo padrão de packages/core/src/api/sigtur.ts).
//
// Host real (confirmado via catálogo ArcGIS Online, item "Planos de Ordenamento das Áreas
// Protegidas (POAP)", owner admin.esri) e testado com pedidos reais (HTTP 200, dados válidos):
import type { TourismPoint, TourismPointsParams } from './sigtur.js'

const ARCGIS_BASE = 'https://sigservices.icnf.pt/server/rest/services/BDG'

// Ao contrário do SIGTUR, este servidor devolve `Access-Control-Allow-Origin` para qualquer
// origem (reflete o `Origin` do pedido), pelo que não é necessário JSONP nem proxy — a app web
// pode usar `fetch` diretamente, tal como a app mobile.
export type IcnfGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'MultiLineString'; coordinates: [number, number][][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] }

export interface IcnfGeoJsonResponse {
  features: Array<{
    type: 'Feature'
    geometry: IcnfGeometry | null
    properties: Record<string, unknown>
  }>
}

export interface IcnfLayerConfig {
  /** Identificador interno usado como categoria/subcategoria da app. */
  category: string
  subcategory?: string
  /** Nome do serviço ArcGIS dentro da pasta BDG, ex. "RNAP". */
  service: string
  layerId: number
}

// Layers validadas manualmente no catálogo real (sigservices.icnf.pt/server/rest/services/BDG).
export const ICNF_LAYERS: IcnfLayerConfig[] = [
  {
    // Rede Nacional de Áreas Protegidas: Parques Nacionais/Naturais, Reservas Naturais,
    // Paisagens Protegidas, Monumentos Naturais e Áreas Protegidas Privadas.
    category: 'protected-areas',
    service: 'RNAP',
    layerId: 0,
  },
  {
    // Rede Natura 2000 — Zonas de Proteção Especial (aves).
    category: 'natura-2000',
    subcategory: 'ZPE',
    service: 'RN2000',
    layerId: 0,
  },
  {
    // Rede Natura 2000 — Sítios de Importância Comunitária (habitats/espécies).
    category: 'natura-2000',
    subcategory: 'SIC',
    service: 'RN2000',
    layerId: 1,
  },
  {
    // Percursos pedestres na natureza (trilhos).
    category: 'trails',
    service: 'percursos_pedestres',
    layerId: 0,
  },
]

function layerUrl(layer: IcnfLayerConfig): string {
  return `${ARCGIS_BASE}/${layer.service}/FeatureServer/${layer.layerId}`
}

export interface IcnfQueryParams {
  where?: string
  geometry?: string
  geometryType?: 'esriGeometryEnvelope' | 'esriGeometryPoint'
  distanceKm?: number
  resultOffset?: number
  resultRecordCount?: number
}

async function queryLayer(layer: IcnfLayerConfig, params: IcnfQueryParams = {}): Promise<IcnfGeoJsonResponse> {
  const url = new URL(`${layerUrl(layer)}/query`)
  url.searchParams.set('where', params.where ?? '1=1')
  url.searchParams.set('outFields', '*')
  url.searchParams.set('returnGeometry', 'true')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('f', 'geojson')
  url.searchParams.set('resultOffset', String(params.resultOffset ?? 0))
  url.searchParams.set('resultRecordCount', String(params.resultRecordCount ?? 2000))

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

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`ICNF ArcGIS error: ${res.status}`)
  return res.json() as Promise<IcnfGeoJsonResponse>
}

/**
 * Áreas protegidas, sítios da Rede Natura 2000 e percursos pedestres são polígonos/linhas, não
 * pontos — para reutilizar o mesmo modelo de "ponto de interesse" da app (`TourismPoint`),
 * calcula-se o centro do bounding box da geometria como localização representativa do marcador.
 */
function boundingBoxCenter(geometry: IcnfGeometry): [number, number] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity

  function visit(coords: unknown): void {
    const arr = coords as unknown[]
    if (typeof arr[0] === 'number') {
      const [lng, lat] = arr as [number, number]
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      return
    }
    for (const item of arr) visit(item)
  }

  visit(geometry.coordinates)
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
}

function firstDefined(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  }
  return undefined
}

function normalizeFeature(
  feature: IcnfGeoJsonResponse['features'][number],
  layer: IcnfLayerConfig,
): TourismPoint | null {
  const { properties, geometry } = feature
  if (!geometry) return null

  const [longitude, latitude] = boundingBoxCenter(geometry)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

  const objectId = firstDefined(properties, ['id', 'OBJECTID', 'FID']) ?? ''
  // Nomes de campos variam por layer: RNAP usa nome_ap, RN2000 usa site_name, trilhos usa nome.
  const name = firstDefined(properties, ['nome_ap', 'site_name', 'nome']) ?? 'Sem nome'
  // Subcategoria: classificação da área protegida (RNAP), tipo de sítio Natura 2000 (fixo por
  // layer), ou tipo de percurso pedestre.
  const subcategory = layer.subcategory ?? firstDefined(properties, ['classifica', 'tipo'])

  const areaHa = firstDefined(properties, ['area_ha', 'area__ha_'])
  const lengthKm = firstDefined(properties, ['compr_km'])
  const detail = areaHa
    ? `Área: ${Number(areaHa).toLocaleString('pt-PT', { maximumFractionDigits: 0 })} ha`
    : lengthKm
      ? `Percurso: ${Number(lengthKm).toFixed(1)} km`
      : undefined

  return {
    id: `arcgis:icnf:${layer.service}:${layer.layerId}:${objectId}`,
    externalId: objectId,
    name,
    category: layer.category,
    subcategory,
    // Reutiliza o campo `address` para mostrar a dimensão (área/comprimento) na lista, já que
    // estas geometrias não têm morada — mantém compatibilidade com o UI existente do SIGTUR.
    address: detail,
    latitude,
    longitude,
    source: {
      provider: 'ICNF',
      system: 'ICNF',
      service: layer.service,
      layerId: layer.layerId,
      objectId,
    },
  }
}

export const icnfClient = {
  /** Consulta e normaliza áreas protegidas, sítios Natura 2000 e percursos pedestres do ICNF. */
  async getTourismPoints(params: TourismPointsParams = {}): Promise<TourismPoint[]> {
    const layers = params.category
      ? ICNF_LAYERS.filter(l => l.category === params.category)
      : ICNF_LAYERS

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
    return [...new Set(ICNF_LAYERS.map(l => l.category))]
  },
}
