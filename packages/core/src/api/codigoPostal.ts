// Código Postal (moradas.dev) — cliente agnóstico de plataforma (MOB-002, WEB-038).
// moradas.dev: gratuito, sem chave, CORS `*`. Não devolve coordenadas: o `centro` é aproximado
// geocodificando a localidade (ou o concelho) com o Open-Meteo geocoding.
export const MORADAS_BASE_URL = 'https://moradas.dev'
export const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export interface CpParte {
  Artéria: string
  /** Não existe na moradas.dev (vinha do geoapi.pt). */
  Local?: string
  Troço: string
  Porta: string
  Cliente: string
}

/** Precisão do `centro`: geocodificação da localidade ou, na falta desta, do concelho. */
export type CpCentroPrecisao = 'localidade' | 'concelho'

export interface CpInfo {
  CP: string
  CP4: string
  CP3: string
  Distrito: string
  Concelho: string
  Localidade: string
  /** A moradas.dev não tem designação postal própria: é a localidade. */
  'Designação Postal': string
  municipio: string
  partes: CpParte[]
  ruas: string[]
  /** `[lat, lng]` aproximado (ver `centroPrecisao`), ou `null` se a geocodificação falhar. */
  centro: [number, number] | null
  centroPrecisao: CpCentroPrecisao | null
}

interface MoradasArteria {
  art_id?: number
  street: string | null
  troco: string | null
  porta: string | null
  cliente: string | null
}

interface MoradasCp7 {
  cp7: string
  cp4: string
  cp3: string
  distrito: string
  concelho: string
  localidade: string
  arterias: MoradasArteria[] | null
}

interface GeocodingResult {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  admin2?: string
}

export class CodigoPostalError extends Error {
  readonly status: number
  /** Segundos indicados em `Retry-After` (429), se o cabeçalho for legível. */
  readonly retryAfter: number | null
  /** Motivo dado pela moradas.dev no cabeçalho `X-Moradas-Hint` (em inglês). */
  readonly hint: string | null

  constructor(status: number, message: string, extra: { retryAfter?: number | null; hint?: string | null } = {}) {
    super(message)
    this.name = 'CodigoPostalError'
    this.status = status
    this.retryAfter = extra.retryAfter ?? null
    this.hint = extra.hint ?? null
  }
}

/** Para o `retry` do React Query: não repete 404 nem 429 (evita pedidos em ciclo). */
export function shouldRetryCodigoPostal(failureCount: number, error: unknown): boolean {
  if (error instanceof CodigoPostalError && (error.status === 404 || error.status === 429)) return false
  return failureCount < 1
}

export function normalizePostalCode(cp: string): string {
  return cp.trim().toUpperCase()
}

/** Valida o formato `NNNN-NNN` (após normalização). */
export function isValidPostalCode(cp: string): boolean {
  return /^\d{4}-\d{3}$/.test(normalizePostalCode(cp))
}

const normalizeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds))
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000))
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} s`
  const minutes = Math.ceil(seconds / 60)
  return minutes < 90 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`
}

function toCpInfo(data: MoradasCp7): CpInfo {
  const partes: CpParte[] = (data.arterias ?? [])
    .filter(a => a.street)
    .map(a => ({
      Artéria: a.street ?? '',
      Troço: a.troco ?? '',
      Porta: a.porta ?? '',
      Cliente: a.cliente ?? '',
    }))
  return {
    CP: data.cp7,
    CP4: data.cp4,
    CP3: data.cp3,
    Distrito: data.distrito,
    Concelho: data.concelho,
    Localidade: data.localidade,
    'Designação Postal': data.localidade,
    municipio: data.concelho,
    partes,
    ruas: [...new Set(partes.map(p => p.Artéria))],
    centro: null,
    centroPrecisao: null,
  }
}

export interface CodigoPostalClientOptions {
  baseUrl?: string
  geocodingUrl?: string
}

export function createCodigoPostalClient(options: CodigoPostalClientOptions = {}) {
  const baseUrl = options.baseUrl ?? MORADAS_BASE_URL
  const geocodingUrl = options.geocodingUrl ?? OPEN_METEO_GEOCODING_URL

  async function geocode(name: string, concelho: string): Promise<[number, number] | null> {
    const url = new URL(geocodingUrl)
    url.searchParams.set('name', name)
    url.searchParams.set('count', '10')
    url.searchParams.set('language', 'pt')
    url.searchParams.set('format', 'json')
    url.searchParams.set('countryCode', 'PT')
    const res = await fetch(url.toString())
    if (!res.ok) return null
    const json = (await res.json()) as { results?: GeocodingResult[] }
    // Há localidades com o mesmo nome em concelhos diferentes (ex.: Ribamar, em Mafra e na Lourinhã).
    const target = normalizeName(concelho)
    const match = (json.results ?? []).find(r => r.admin2 && normalizeName(r.admin2) === target)
    return match ? [match.latitude, match.longitude] : null
  }

  async function locate(info: CpInfo): Promise<Pick<CpInfo, 'centro' | 'centroPrecisao'>> {
    try {
      const byLocalidade = await geocode(info.Localidade, info.Concelho)
      if (byLocalidade) return { centro: byLocalidade, centroPrecisao: 'localidade' }
      if (normalizeName(info.Localidade) !== normalizeName(info.Concelho)) {
        const byConcelho = await geocode(info.Concelho, info.Concelho)
        if (byConcelho) return { centro: byConcelho, centroPrecisao: 'concelho' }
      }
    } catch {
      // Sem coordenadas, as apps escondem o mapa.
    }
    return { centro: null, centroPrecisao: null }
  }

  return {
    async lookup(cp: string): Promise<CpInfo> {
      const normalized = normalizePostalCode(cp)
      const res = await fetch(`${baseUrl}/cp/${encodeURIComponent(normalized)}`)
      if (res.status === 404) {
        throw new CodigoPostalError(404, 'Código postal não encontrado.', { hint: res.headers.get('X-Moradas-Hint') })
      }
      if (res.status === 429) {
        const retryAfter = parseRetryAfter(res.headers.get('Retry-After'))
        const wait = retryAfter != null ? ` dentro de ${formatWait(retryAfter)}` : ' daqui a pouco'
        throw new CodigoPostalError(429, `Demasiadas pesquisas seguidas. Tente novamente${wait}.`, { retryAfter })
      }
      if (!res.ok) throw new CodigoPostalError(res.status, `Erro ao pesquisar código postal (HTTP ${res.status})`)
      const info = toCpInfo((await res.json()) as MoradasCp7)
      return { ...info, ...(await locate(info)) }
    },
  }
}

export type CodigoPostalClient = ReturnType<typeof createCodigoPostalClient>

export const codigoPostalClient = createCodigoPostalClient()