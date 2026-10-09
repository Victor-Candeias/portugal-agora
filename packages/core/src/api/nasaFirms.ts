// NASA FIRMS (focos de calor por satélite, VIIRS/MODIS) via API Aberta — `GET /nasafirms/hotspots` (WEB-027).
// Os pedidos estão no `ApiAbertaClient` (client.ts); aqui ficam os tipos e a formatação, sem dependências de plataforma.

/** Foco de calor tal como vem de `/nasafirms/hotspots` (Portugal continental, até 7 dias). */
export interface NasaFirmsHotspot {
  latitude: number
  longitude: number
  /** Temperatura de brilho (K). */
  brightness: number
  /** Data de aquisição, `AAAA-MM-DD` (UTC). */
  acq_date: string
  /** Hora de aquisição, `HHMM` (UTC). */
  acq_time: string
  /** `Aqua`/`Terra` (MODIS) ou `N` (VIIRS S-NPP). */
  satellite: string
  instrument: string
  /** MODIS: 0–100; VIIRS: `l`/`n`/`h` (pode faltar). */
  confidence?: number | string
  /** Potência radiativa do fogo (MW). */
  frp?: number
  daynight?: 'D' | 'N'
  /** `VIIRS_SNPP` ou `MODIS`. */
  source: string
}

export interface NasaFirmsHotspotsPage {
  meta: { service: string; days: number; source: string; page: number; limit: number; total: number; pages: number }
  data: NasaFirmsHotspot[]
}

export interface NasaFirmsHotspotItem extends NasaFirmsHotspot {
  id: string
  /** Instante de aquisição em ISO (UTC), ou `null` se a data/hora não forem reconhecidas. */
  acquiredAt: string | null
}

export interface NasaFirmsHotspotsResponse {
  days: number
  total: number
  /** Focos do mais recente para o mais antigo. */
  data: NasaFirmsHotspotItem[]
}

export interface NasaFirmsMeta {
  service: string
  version: string
  source: string
  description: string
  bbox: string
  total_hotspots: number
  by_source: Record<string, number>
  update_frequency: string
  docs: string
}

/** A API aceita `days` entre 1 e 7 (fora disso devolve 400). */
export const NASA_FIRMS_MAX_DAYS = 7

export const NASA_FIRMS_DAY_OPTIONS = [1, 2, 3, 7] as const

/** Limites de Portugal continental (a cobertura do conector), para enquadrar os mapas. */
export const PORTUGAL_MAINLAND_BOUNDS = { west: -9.6, south: 36.9, east: -6.1, north: 42.2 } as const

export function clampFirmsDays(days: number): number {
  return Math.min(NASA_FIRMS_MAX_DAYS, Math.max(1, Math.round(days) || 1))
}

/** `no último dia` / `nos últimos N dias`. */
export function firmsDaysLabel(days: number): string {
  return days === 1 ? 'no último dia' : `nos últimos ${days} dias`
}

export function firmsAcquiredAt(h: Pick<NasaFirmsHotspot, 'acq_date' | 'acq_time'>): string | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(h.acq_date ?? '')
  const time = /^(\d{1,4})$/.exec(String(h.acq_time ?? '').trim())
  if (!date || !time) return null
  const hhmm = time[1].padStart(4, '0')
  return `${h.acq_date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`
}

// Último domingo do mês às 01:00 UTC (início/fim da hora de verão na UE).
function lastSundayUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return Date.UTC(year, month, lastDay.getUTCDate() - lastDay.getUTCDay(), 1)
}

/** Diferença (min) entre a hora de Portugal continental e UTC: 60 na hora de verão, 0 no resto do ano. */
export function lisbonOffsetMinutes(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear()
  return utcMs >= lastSundayUtc(year, 2) && utcMs < lastSundayUtc(year, 9) ? 60 : 0
}

/** `DD/MM HHhmm` na hora de Portugal (a FIRMS dá a aquisição em UTC). */
export function formatFirmsAcquisition(h: Pick<NasaFirmsHotspotItem, 'acquiredAt' | 'acq_date' | 'acq_time'>): string {
  const ms = h.acquiredAt ? Date.parse(h.acquiredAt) : NaN
  if (Number.isNaN(ms)) return `${h.acq_date} ${h.acq_time}`.trim()
  const d = new Date(ms + lisbonOffsetMinutes(ms) * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)} ${pad(d.getUTCHours())}h${pad(d.getUTCMinutes())}`
}

/** `VIIRS (S-NPP)`, `MODIS (Aqua)`, … */
export function firmsSourceLabel(h: Pick<NasaFirmsHotspot, 'source' | 'instrument' | 'satellite'>): string {
  if (h.source === 'VIIRS_SNPP') return 'VIIRS (S-NPP)'
  if (h.source === 'VIIRS_NOAA20') return 'VIIRS (NOAA-20)'
  if (h.source === 'VIIRS_NOAA21') return 'VIIRS (NOAA-21)'
  if (h.source === 'MODIS' || h.instrument === 'MODIS') return h.satellite ? `MODIS (${h.satellite})` : 'MODIS'
  return h.instrument || h.source
}

const VIIRS_CONFIDENCE: Record<string, string> = { l: 'baixa', n: 'nominal', h: 'alta' }

/** Confiança da deteção (`49%` no MODIS, `nominal` no VIIRS), ou `null` se não vier. */
export function formatFirmsConfidence(confidence: NasaFirmsHotspot['confidence']): string | null {
  if (confidence === undefined || confidence === null || confidence === '') return null
  if (typeof confidence === 'number') return `${confidence}%`
  return VIIRS_CONFIDENCE[confidence.toLowerCase()] ?? confidence
}

/** Detalhe de um foco numa linha: fonte, FRP, dia/noite e confiança. */
export function describeFirmsHotspot(h: NasaFirmsHotspot): string {
  const confidence = formatFirmsConfidence(h.confidence)
  return [
    firmsSourceLabel(h),
    h.frp !== undefined ? `FRP ${h.frp} MW` : null,
    h.daynight === 'N' ? 'noite' : h.daynight === 'D' ? 'dia' : null,
    confidence ? `confiança ${confidence}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export type FirmsAge = 'recent' | 'day' | 'older'

/** Antiguidade de um foco: até 12 h, até 48 h, ou mais antigo. */
export function firmsAge(h: Pick<NasaFirmsHotspotItem, 'acquiredAt'>, now = Date.now()): FirmsAge {
  const ms = h.acquiredAt ? Date.parse(h.acquiredAt) : NaN
  if (Number.isNaN(ms)) return 'older'
  const hours = (now - ms) / 3_600_000
  return hours <= 12 ? 'recent' : hours <= 48 ? 'day' : 'older'
}

export const FIRMS_AGE_COLORS: Record<FirmsAge, string> = {
  recent: '#dc2626',
  day: '#f97316',
  older: '#eab308',
}

export const FIRMS_AGE_LABELS: Record<FirmsAge, string> = {
  recent: 'Últimas 12 h',
  day: '12–48 h',
  older: 'Mais de 48 h',
}

export function sortFirmsHotspots(hotspots: NasaFirmsHotspot[]): NasaFirmsHotspotItem[] {
  return hotspots
    .filter(h => Number.isFinite(h.latitude) && Number.isFinite(h.longitude))
    .map((h, i) => ({
      ...h,
      id: `${h.source}-${h.acq_date}-${h.acq_time}-${h.latitude}-${h.longitude}-${i}`,
      acquiredAt: firmsAcquiredAt(h),
    }))
    .sort((a, b) => {
      if (a.acquiredAt === b.acquiredAt) return 0
      if (!a.acquiredAt) return 1
      if (!b.acquiredAt) return -1
      return a.acquiredAt < b.acquiredAt ? 1 : -1
    })
}
