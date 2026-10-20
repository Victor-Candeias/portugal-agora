// ANACOM — cobertura potencial da rede móvel por operadora e tecnologia (WEB-065), a partir do
// serviço ArcGIS público `CoberturaQoS_Pub`. Validação da fonte em .maestru/specs/mobile/web-064-spec.md.
//
// As camadas são raster (grelha de 100 m): o `query` devolve 400, por isso usa-se o `identify`.
// O servidor reflete o `Origin` no CORS, pelo que web e mobile fazem `fetch` direto, sem proxy.
// Termos da ANACOM: uso informativo, pessoal e não comercial, com atribuição e sem modificações.

export const ANACOM_COVERAGE_SERVICE_URL =
  'https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer'

/** Mapa oficial, para a atribuição. */
export const ANACOM_MAP_URL = 'https://geo.anacom.pt/'

export const ANACOM_ATTRIBUTION = 'Fonte: ANACOM · © ANACOM'

export const ANACOM_COVERAGE_DISCLAIMER =
  'Cobertura prevista, não medição real. Pode variar em interiores e consoante o equipamento.'

export const ANACOM_5G_NOTICE = '5G: dados provisórios.'

export type MobileTechnology = '2G' | '4G' | '5G'

export const MOBILE_TECHNOLOGIES: readonly MobileTechnology[] = ['2G', '4G', '5G']

export const MOBILE_TECHNOLOGY_LABELS: Record<MobileTechnology, string> = {
  '2G': '2G (voz)',
  '4G': '4G',
  '5G': '5G',
}

export type MobileOperator = 'DIGI' | 'MEO' | 'NOS' | 'Vodafone'

export const MOBILE_OPERATORS: readonly MobileOperator[] = ['DIGI', 'MEO', 'NOS', 'Vodafone']

/**
 * «Global PT» é o agregado nacional (o melhor valor entre as operadoras em cada célula), não uma
 * operadora. Mostra-se à parte e não entra na comparação.
 */
export const ANACOM_AGGREGATE = 'Global PT'

export type CoverageSubject = MobileOperator | typeof ANACOM_AGGREGATE

/** IDs das camadas no `MapServer` (grupo «Rede Móvel», id 162). */
export const ANACOM_COVERAGE_LAYERS: Record<CoverageSubject, Record<MobileTechnology, number>> = {
  'Global PT': { '2G': 164, '4G': 167, '5G': 168 },
  DIGI: { '2G': 170, '4G': 171, '5G': 172 },
  MEO: { '2G': 174, '4G': 176, '5G': 177 },
  NOS: { '2G': 179, '4G': 180, '5G': 181 },
  Vodafone: { '2G': 183, '4G': 186, '5G': 187 },
}

/** Nome do grupo de cada operadora no catálogo, quando difere do nome usado na app. */
const CATALOG_GROUP_NAMES: Partial<Record<CoverageSubject, string>> = { Vodafone: 'VODAFONE' }

/** Extensão das camadas (WGS84), incluindo Açores e Madeira. Fora dela não há dados. */
export const ANACOM_COVERAGE_EXTENT = { west: -31.27, south: 30.03, east: -6.19, north: 42.16 } as const

/**
 * Estado normalizado da cobertura num ponto:
 * - `covered`: há uma classe de cobertura;
 * - `not_covered`: a operadora tem dados ali e a classe é «Não disponível» (valor 0);
 * - `unknown`: sem dados (`NoData`, fora da grelha ou valor inesperado);
 * - `source_unavailable`: erro HTTP, timeout ou erro do ArcGIS.
 */
export type CoverageStatus = 'covered' | 'not_covered' | 'unknown' | 'source_unavailable'

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  covered: 'Com cobertura',
  not_covered: 'Sem cobertura',
  unknown: 'Sem dados',
  source_unavailable: 'Fonte indisponível',
}

export interface CoverageClass {
  /** Classe potencial tal como na legenda da ANACOM (ex.: `≥ 100 Mbps`, `Boa`). Nunca Mbps exatos. */
  label: string
  /** Ordem dentro da tecnologia: maior é melhor. */
  rank: number
  /** Cor da legenda oficial. */
  color: string
}

const SPEED_CLASSES: Array<CoverageClass & { min: number }> = [
  { min: 1000, label: '≥ 1000 Mbps', rank: 6, color: '#DF73FF' },
  { min: 300, label: '≥ 300 Mbps', rank: 5, color: '#1CC1DA' },
  { min: 100, label: '≥ 100 Mbps', rank: 4, color: '#7ED500' },
  { min: 30, label: '≥ 30 Mbps', rank: 3, color: '#FFFF00' },
  { min: 2, label: '≥ 2 Mbps', rank: 2, color: '#FFAA00' },
  { min: Number.MIN_VALUE, label: '> 0 Mbps', rank: 1, color: '#E60000' },
]

const VOICE_CLASSES: Record<number, CoverageClass> = {
  4: { label: 'Muito Boa', rank: 4, color: '#1CC1DA' },
  3: { label: 'Boa', rank: 3, color: '#7ED500' },
  2: { label: 'Aceitável', rank: 2, color: '#FFFF00' },
  1: { label: 'Limitada', rank: 1, color: '#E60000' },
}

const stripMin = ({ label, rank, color }: CoverageClass): CoverageClass => ({ label, rank, color })

/** Legenda por tecnologia, da melhor para a pior classe (sem «Não disponível», que é transparente). */
export const COVERAGE_LEGEND: Record<MobileTechnology, CoverageClass[]> = {
  '2G': [4, 3, 2, 1].map(v => VOICE_CLASSES[v]),
  // A legenda oficial do 4G vai só até «≥ 300 Mbps».
  '4G': SPEED_CLASSES.slice(1).map(stripMin),
  '5G': SPEED_CLASSES.map(stripMin),
}

export interface ParsedCoverage {
  status: Exclude<CoverageStatus, 'source_unavailable'>
  coverageClass: CoverageClass | null
}

/** Traduz o `Pixel Value` do `identify` (texto, ex. `"300.000000"`, `"4"` ou `"NoData"`). */
export function parseCoverageClass(technology: MobileTechnology, raw: unknown): ParsedCoverage {
  const unknown: ParsedCoverage = { status: 'unknown', coverageClass: null }
  if (raw === null || raw === undefined) return unknown
  const text = String(raw).trim()
  if (text === '' || /^nodata$/i.test(text)) return unknown
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return unknown
  if (value === 0) return { status: 'not_covered', coverageClass: null }

  if (technology === '2G') {
    const cls = Number.isInteger(value) ? VOICE_CLASSES[value] : undefined
    return cls ? { status: 'covered', coverageClass: cls } : unknown
  }
  const cls = SPEED_CLASSES.find(c => value >= c.min)
  return cls ? { status: 'covered', coverageClass: stripMin(cls) } : unknown
}

const REFERENCE_ATTRIBUTE = /data da informa[çc][ãa]o:\s*(\d{4})\s*T\s*([1-4])/i

/** Trimestre de referência (`2026T2`) a partir do nome do atributo `Raster.Data da informação: 2026T2`. */
export function parseReferenceQuarter(attributes: Record<string, unknown> | null | undefined): string | null {
  for (const key of Object.keys(attributes ?? {})) {
    const m = REFERENCE_ATTRIBUTE.exec(key)
    if (m) return `${m[1]}T${m[2]}`
  }
  return null
}

/** `2026T2` → `2.º trimestre de 2026`. */
export function formatReferenceQuarter(quarter: string | null | undefined): string | null {
  const m = /^(\d{4})T([1-4])$/.exec(quarter ?? '')
  return m ? `${m[2]}.º trimestre de ${m[1]}` : null
}

export interface OperatorCoverage {
  operator: CoverageSubject
  layerId: number
  status: CoverageStatus
  coverageClass: CoverageClass | null
}

export interface RankedOperator extends OperatorCoverage {
  /** Posição (1 = melhor); operadoras empatadas partilham a posição. */
  position: number
  tied: boolean
}

export interface MobileCoverageResult {
  technology: MobileTechnology
  /** Coordenadas arredondadas a 5 casas decimais (~1 m). */
  latitude: number
  longitude: number
  /** Linha «Global PT»: melhor valor entre operadoras. */
  aggregate: OperatorCoverage
  operators: OperatorCoverage[]
  /** `null` quando há operadoras sem dados ou com a fonte indisponível (não há ranking com dados incompletos). */
  ranking: RankedOperator[] | null
  /** Trimestre de referência (`2026T2`), se a fonte o indicar. */
  referenceQuarter: string | null
  /** O 5G está marcado como «dados provisórios» na fonte. */
  provisional: boolean
  outsideCoverageArea: boolean
  source: 'ANACOM'
}

const STATUS_ORDER: Record<CoverageStatus, number> = { covered: 2, not_covered: 1, unknown: 0, source_unavailable: 0 }

function coverageScore(c: OperatorCoverage): number {
  return c.status === 'covered' ? 10 + (c.coverageClass?.rank ?? 0) : STATUS_ORDER[c.status]
}

/**
 * Ordena as operadoras pela classe potencial (dentro da mesma tecnologia). Os empates ficam na
 * mesma posição. Sem ranking (`null`) se alguma operadora estiver `unknown` ou `source_unavailable`.
 */
export function rankOperators(operators: OperatorCoverage[]): RankedOperator[] | null {
  if (operators.length === 0) return null
  if (operators.some(o => o.status === 'unknown' || o.status === 'source_unavailable')) return null
  const sorted = [...operators].sort((a, b) => coverageScore(b) - coverageScore(a))
  return sorted.map(o => {
    const score = coverageScore(o)
    return {
      ...o,
      position: sorted.findIndex(x => coverageScore(x) === score) + 1,
      tied: sorted.filter(x => coverageScore(x) === score).length > 1,
    }
  })
}

export function roundCoordinate(value: number, decimals = 5): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function isInsideAnacomExtent(latitude: number, longitude: number): boolean {
  const { west, south, east, north } = ANACOM_COVERAGE_EXTENT
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east
}

export interface AnacomRequestOptions {
  signal?: AbortSignal
  /** Por omissão 15 s. */
  timeoutMs?: number
  baseUrl?: string
}

const DEFAULT_TIMEOUT_MS = 15_000

// Combina o `signal` de quem chama (ex.: React Query) com um timeout, sem `AbortSignal.any`
// (não existe em todos os runtimes do React Native).
async function fetchJson(url: string, options: AnacomRequestOptions): Promise<unknown> {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onAbort)
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`ANACOM: HTTP ${res.status}`)
    const json = (await res.json()) as { error?: { message?: string } }
    if (json && typeof json === 'object' && json.error) throw new Error(`ANACOM: ${json.error.message ?? 'erro ArcGIS'}`)
    return json
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

interface IdentifyResponse {
  results?: Array<{ layerId: number; attributes?: Record<string, unknown> }>
}

function pixelValue(attributes: Record<string, unknown> | undefined): unknown {
  if (!attributes) return null
  return attributes['UniqueValue.Pixel Value'] ?? attributes['Pixel Value'] ?? null
}

const SUBJECTS: CoverageSubject[] = [ANACOM_AGGREGATE, ...MOBILE_OPERATORS]

function buildResult(
  technology: MobileTechnology,
  latitude: number,
  longitude: number,
  rows: OperatorCoverage[],
  referenceQuarter: string | null,
  outsideCoverageArea: boolean,
): MobileCoverageResult {
  const [aggregate, ...operators] = rows
  return {
    technology,
    latitude,
    longitude,
    aggregate,
    operators,
    ranking: rankOperators(operators),
    referenceQuarter,
    provisional: technology === '5G',
    outsideCoverageArea,
    source: 'ANACOM',
  }
}

/**
 * Cobertura potencial de todas as operadoras num ponto, para uma tecnologia: um único `identify`
 * com as 5 camadas. Erros e timeouts dão `source_unavailable` em vez de exceção; só o
 * cancelamento pedido por quem chama é propagado.
 */
export async function getMobileCoverageAtPoint(
  latitude: number,
  longitude: number,
  technology: MobileTechnology,
  options: AnacomRequestOptions = {},
): Promise<MobileCoverageResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Coordenadas inválidas')
  const lat = roundCoordinate(latitude)
  const lon = roundCoordinate(longitude)
  const layerIds = SUBJECTS.map(s => ANACOM_COVERAGE_LAYERS[s][technology])
  const rowsWith = (status: CoverageStatus): OperatorCoverage[] =>
    SUBJECTS.map((operator, i) => ({ operator, layerId: layerIds[i], status, coverageClass: null }))

  if (!isInsideAnacomExtent(lat, lon)) return buildResult(technology, lat, lon, rowsWith('unknown'), null, true)

  const d = 0.01
  const url = new URL(`${options.baseUrl ?? ANACOM_COVERAGE_SERVICE_URL}/identify`)
  url.searchParams.set('f', 'json')
  url.searchParams.set('geometry', `${lon},${lat}`)
  url.searchParams.set('geometryType', 'esriGeometryPoint')
  url.searchParams.set('sr', '4326')
  url.searchParams.set('layers', `all:${layerIds.join(',')}`)
  url.searchParams.set('tolerance', '0')
  url.searchParams.set('mapExtent', `${lon - d},${lat - d},${lon + d},${lat + d}`)
  url.searchParams.set('imageDisplay', '400,400,96')
  url.searchParams.set('returnGeometry', 'false')

  let json: IdentifyResponse
  try {
    json = (await fetchJson(url.toString(), options)) as IdentifyResponse
  } catch (err) {
    if (options.signal?.aborted) throw err
    return buildResult(technology, lat, lon, rowsWith('source_unavailable'), null, false)
  }

  const results = Array.isArray(json.results) ? json.results : []
  let referenceQuarter: string | null = null
  const rows = SUBJECTS.map((operator, i): OperatorCoverage => {
    const hit = results.find(r => r.layerId === layerIds[i])
    referenceQuarter ??= parseReferenceQuarter(hit?.attributes)
    const parsed = parseCoverageClass(technology, pixelValue(hit?.attributes))
    return { operator, layerId: layerIds[i], status: parsed.status, coverageClass: parsed.coverageClass }
  })
  return buildResult(technology, lat, lon, rows, referenceQuarter, false)
}

export interface CatalogIssue {
  operator: CoverageSubject
  technology: MobileTechnology
  layerId: number
  reason: 'missing' | 'unexpected-name' | 'unexpected-parent'
  /** Nome encontrado no catálogo, se a camada existir. */
  found?: string
}

export interface CoverageCatalogStatus {
  ok: boolean
  issues: CatalogIssue[]
}

interface MapServerInfo {
  layers?: Array<{ id: number; name: string; parentLayerId?: number }>
}

/**
 * Confirma o catálogo `ANACOM_COVERAGE_LAYERS` contra `MapServer?f=pjson`: se a ANACOM mudar ou
 * retirar uma camada, devolve o problema em vez de falhar em silêncio. Erros de rede propagam.
 */
export async function getMobileCoverageCatalog(options: AnacomRequestOptions = {}): Promise<CoverageCatalogStatus> {
  const info = (await fetchJson(`${options.baseUrl ?? ANACOM_COVERAGE_SERVICE_URL}?f=pjson`, options)) as MapServerInfo
  const byId = new Map((info.layers ?? []).map(l => [l.id, l]))
  const issues: CatalogIssue[] = []
  for (const operator of SUBJECTS) {
    const groupName = (CATALOG_GROUP_NAMES[operator] ?? operator).toLowerCase()
    for (const technology of MOBILE_TECHNOLOGIES) {
      const layerId = ANACOM_COVERAGE_LAYERS[operator][technology]
      const layer = byId.get(layerId)
      if (!layer) {
        issues.push({ operator, technology, layerId, reason: 'missing' })
        continue
      }
      if (!layer.name.trim().toUpperCase().startsWith(technology)) {
        issues.push({ operator, technology, layerId, reason: 'unexpected-name', found: layer.name })
        continue
      }
      const parent = layer.parentLayerId !== undefined ? byId.get(layer.parentLayerId) : undefined
      if (!parent || parent.name.trim().toLowerCase() !== groupName) {
        issues.push({ operator, technology, layerId, reason: 'unexpected-parent', found: parent?.name })
      }
    }
  }
  return { ok: issues.length === 0, issues }
}

/**
 * Modelo de URL do `export` (PNG transparente, EPSG:3857) para mosaicos de 256 px, com o
 * marcador `{bbox-epsg-3857}` (convenção do MapLibre). No Leaflet, substituir o marcador pela
 * bbox de cada mosaico.
 */
export function anacomExportUrl(layerId: number, baseUrl: string = ANACOM_COVERAGE_SERVICE_URL): string {
  return (
    `${baseUrl}/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256` +
    `&format=png32&transparent=true&f=image&layers=show:${layerId}`
  )
}
