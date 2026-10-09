// ANPC / Proteção Civil (ocorrências via API Aberta) — cliente agnóstico de plataforma (MOB-002).
// A API key é injetada por cada app (web: VITE_APIABERTA_KEY, mobile: EXPO_PUBLIC_APIABERTA_KEY).
export const ANPC_BASE_URL = 'https://api.apiaberta.pt/v1'

export interface AnpcIncident {
  id: string
  date: string
  datetime: string
  type: string
  type_code: string
  status: string
  active: boolean
  location: {
    district: string
    freguesia: string
    address: string
    region: string
    subregion: string
    lat: number
    lng: number
  }
  resources: {
    ground: number
    aerial: number
    water: number
  }
}

export interface AnpcSummary {
  total_active: number
  as_of: string
  by_district: { district: string; count: number }[]
  by_type: { type: string; count: number }[]
}

export interface AnpcIncidentsResponse {
  count: number
  as_of: string
  data: AnpcIncident[]
}

/** Comunicado da ANPC/ANEPC (via fogos.pt), tal como vem de `GET /anpc/warnings`. */
export interface AnpcWarning {
  id: string
  text: string
  /** Data de publicação no formato `HH:mm DD-MM-AAAA` (hora de Portugal). */
  label: string
  source: string
}

export interface AnpcWarningsPage {
  meta: { page: number; limit: number; total: number; pages: number }
  data: AnpcWarning[]
}

export interface AnpcWarningItem extends AnpcWarning {
  /** `AAAA-MM-DDTHH:mm` (hora de Portugal) extraído do `label`, ou `null` se não for reconhecido. */
  date: string | null
}

export interface AnpcWarningsResponse {
  total: number
  /** Comunicados do mais recente para o mais antigo. */
  data: AnpcWarningItem[]
}

// Limite máximo aceite pela API Aberta (500 devolve 400).
const WARNINGS_PAGE_LIMIT = 200

export function parseAnpcWarningLabel(label: string): string | null {
  const m = /(\d{1,2}):(\d{2})\s+(\d{1,2})-(\d{1,2})-(\d{4})/.exec(label)
  if (!m) return null
  const [, hh, mm, dd, mo, yyyy] = m
  return `${yyyy}-${mo.padStart(2, '0')}-${dd.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm}`
}

/** `DD/MM/AAAA HHhmm` a partir do `date` de um comunicado (ou o `label` original). */
export function formatAnpcWarningDate(warning: AnpcWarningItem): string {
  const m = warning.date && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(warning.date)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}h${m[5]}` : warning.label
}

export function sortAnpcWarnings(warnings: AnpcWarning[]): AnpcWarningItem[] {
  return warnings
    .map(w => ({ ...w, date: parseAnpcWarningLabel(w.label) }))
    .sort((a, b) => {
      if (a.date === b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date < b.date ? 1 : -1
    })
}

export interface AnpcClientOptions {
  apiKey: string
  baseUrl?: string
}

export function createAnpcClient(options: AnpcClientOptions) {
  const baseUrl = options.baseUrl ?? ANPC_BASE_URL

  async function apiFetch<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'X-API-Key': options.apiKey },
    })
    if (!res.ok) throw new Error(`ANPC API: ${res.status}`)
    return res.json() as Promise<T>
  }

  // A API devolve os comunicados por ordem de publicação (mais antigos primeiro) e paginados:
  // lê todas as páginas e ordena do mais recente para o mais antigo (WEB-026).
  async function getWarnings(): Promise<AnpcWarningsResponse> {
    const first = await apiFetch<AnpcWarningsPage>(`/anpc/warnings?limit=${WARNINGS_PAGE_LIMIT}&page=1`)
    const all = [...(first.data ?? [])]
    for (let page = 2; page <= (first.meta?.pages ?? 1); page++) {
      const next = await apiFetch<AnpcWarningsPage>(`/anpc/warnings?limit=${WARNINGS_PAGE_LIMIT}&page=${page}`)
      all.push(...(next.data ?? []))
    }
    return { total: first.meta?.total ?? all.length, data: sortAnpcWarnings(all) }
  }

  return {
    getIncidents: () => apiFetch<AnpcIncidentsResponse>('/anpc/incidents'),
    // Hoje devolve o mesmo que `/anpc/incidents` (inclui as "Conclusão", com `active: true`), mas com `count` correto.
    getActiveIncidents: () => apiFetch<AnpcIncidentsResponse>('/anpc/incidents/active'),
    getSummary: () => apiFetch<AnpcSummary>('/anpc/summary'),
    getWarnings,
  }
}

export type AnpcClient = ReturnType<typeof createAnpcClient>
