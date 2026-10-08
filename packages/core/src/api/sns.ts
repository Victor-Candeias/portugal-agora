// SNS — Portal da Transparência (urgências hospitalares). Cliente agnóstico de plataforma (MOB-002).
// A API (Opendatasoft) tem CORS aberto: `fetch` direto no browser e no nativo.
export const SNS_BASE_URL = 'https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets'

export interface Valencia {
  regiao: string
  natureza_juridica: string
  entidade_grupo_hospitalar: string
  unidade_hospitalar: string
  localizacao_geografica: { lon: number; lat: number }
  endereco: string
  codigo_postal: string
  localidade: string
  telefone: number | null
  email: string | null
  nome_do_servico_de_urgencia: string
  tipo_de_urgencia: string
  nome_da_valencia: string
  intervalo_idades: string
  acesso_por_via_saude_24: string
}

export interface Hospital {
  nome: string
  tipo_de_urgencia: string
  regiao: string
  distrito: string
  municipio: string
  localidade: string
  endereco: string
  codigo_postal: string
  telefone: string | null
  email: string | null
  lat: number
  lng: number
  valencias: { nome: string; idades: string }[]
  saude24: boolean
}

export interface Atendimento {
  tempo: string        // "2026-04"
  periodoformat2: string // "2026/04/01"
  regiao: string
  instituicao: string
  localizacao_geografica: { lon: number; lat: number }
  urgencias_geral: number
  urgencias_pediatricas: number | null
  urgencia_obstetricia: number | null
  urgencia_psiquiatrica: number | null
  total_urgencias: number
}

/** Mapa código postal → distrito/município (ficheiro `cp-distrito.json` servido pela app). */
export type PostalCodeGeoMap = Record<string, { distrito: string; municipio: string }>

export interface SnsClientOptions {
  baseUrl?: string
  /**
   * Carrega o mapa CP → distrito/município. Cada app decide de onde o obtém (asset estático no
   * web, URL publicado/asset empacotado no nativo). Sem loader, distrito/município ficam vazios.
   */
  loadPostalCodeMap?: () => Promise<PostalCodeGeoMap>
}

/** Agrupa as valências por serviço de urgência, enriquecendo com distrito/município. */
export function groupValenciasByHospital(raw: Valencia[], cpMap: PostalCodeGeoMap = {}): Hospital[] {
  const map = new Map<string, Hospital>()
  for (const v of raw) {
    const key = v.nome_do_servico_de_urgencia
    let h = map.get(key)
    if (!h) {
      const geo = cpMap[v.codigo_postal] ?? { distrito: '', municipio: '' }
      h = {
        nome: v.nome_do_servico_de_urgencia,
        tipo_de_urgencia: v.tipo_de_urgencia,
        regiao: v.regiao,
        distrito: geo.distrito,
        municipio: geo.municipio,
        localidade: v.localidade,
        endereco: v.endereco,
        codigo_postal: v.codigo_postal,
        telefone: v.telefone ? String(Math.round(v.telefone)) : null,
        email: v.email ?? null,
        lat: v.localizacao_geografica?.lat ?? 0,
        lng: v.localizacao_geografica?.lon ?? 0,
        valencias: [],
        saude24: false,
      }
      map.set(key, h)
    }
    if (!h.valencias.some(x => x.nome === v.nome_da_valencia)) {
      h.valencias.push({ nome: v.nome_da_valencia, idades: v.intervalo_idades })
    }
    if (v.acesso_por_via_saude_24 === 'Sim') h.saude24 = true
  }
  return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
}

export function createSnsClient(options: SnsClientOptions = {}) {
  const baseUrl = options.baseUrl ?? SNS_BASE_URL

  async function fetchAll<T>(dataset: string, params: Record<string, string>): Promise<T[]> {
    const PAGE = 100
    const all: T[] = []
    let offset = 0

    while (true) {
      const qs = new URLSearchParams({ ...params, limit: String(PAGE), offset: String(offset) }).toString()
      const res = await fetch(`${baseUrl}/${dataset}/records?${qs}`)
      if (!res.ok) throw new Error(`SNS API erro ${res.status}`)
      const json = (await res.json()) as { results?: T[]; total_count: number }
      const results: T[] = json.results ?? []
      all.push(...results)
      if (all.length >= json.total_count || results.length < PAGE) break
      offset += PAGE
    }

    return all
  }

  return {
    /** Todos os hospitais agrupados por serviço de urgência, ordenados por nome. */
    async getHospitals(): Promise<Hospital[]> {
      const [raw, cpMap] = await Promise.all([
        fetchAll<Valencia>('caracterizacao-das-valencias-de-urgencia', { limit: '9999' }),
        options.loadPostalCodeMap ? options.loadPostalCodeMap() : Promise.resolve<PostalCodeGeoMap>({}),
      ])
      return groupValenciasByHospital(raw, cpMap)
    },

    /** Atendimentos dos últimos `months` meses (por omissão 12, ≈400 registos). */
    getAtendimentos(months = 12, now: Date = new Date()): Promise<Atendimento[]> {
      const d = new Date(now)
      d.setMonth(d.getMonth() - months)
      const cutoff = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return fetchAll<Atendimento>(
        'atendimentos-por-tipo-de-urgencia-hospitalar-link',
        { limit: '9999', order_by: 'tempo asc', where: `tempo>="${cutoff}"` },
      )
    },
  }
}

export type SnsClient = ReturnType<typeof createSnsClient>
