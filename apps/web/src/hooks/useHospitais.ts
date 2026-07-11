import { useQuery } from '@tanstack/react-query'

const BASE = 'https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets'

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

async function snsFetch<T>(dataset: string, params: Record<string, string>): Promise<T[]> {
  const PAGE = 100
  const all: T[] = []
  let offset = 0

  while (true) {
    const qs = new URLSearchParams({ ...params, limit: String(PAGE), offset: String(offset) }).toString()
    const res = await fetch(`${BASE}/${dataset}/records?${qs}`)
    if (!res.ok) throw new Error(`SNS API erro ${res.status}`)
    const json = await res.json()
    const results: T[] = json.results ?? []
    all.push(...results)
    if (all.length >= json.total_count || results.length < PAGE) break
    offset += PAGE
  }

  return all
}

/** Devolve todos os hospitais agrupados por serviço de urgência */
export function useHospitaisValencias() {
  return useQuery({
    queryKey: ['sns', 'valencias'],
    queryFn: async () => {
      const [raw, cpMap] = await Promise.all([
        snsFetch<Valencia>('caracterizacao-das-valencias-de-urgencia', { limit: '9999' }),
        fetch(`${import.meta.env.BASE_URL}cp-distrito.json`)
          .then(r => r.json()) as Promise<Record<string, { distrito: string; municipio: string }>>,
      ])
      const map = new Map<string, Hospital>()
      for (const v of raw) {
        const key = v.nome_do_servico_de_urgencia
        if (!map.has(key)) {
          const geo = cpMap[v.codigo_postal] ?? { distrito: '', municipio: '' }
          map.set(key, {
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
          })
        }
        const h = map.get(key)!
        if (!h.valencias.some(x => x.nome === v.nome_da_valencia)) {
          h.valencias.push({ nome: v.nome_da_valencia, idades: v.intervalo_idades })
        }
        if (v.acesso_por_via_saude_24 === 'Sim') h.saude24 = true
      }
      return [...map.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    },
    staleTime: 24 * 60 * 60 * 1000,
  })
}

/** Últimos 12 meses de atendimentos (≈400 registos) */
export function useHospitaisAtendimentos() {
  return useQuery({
    queryKey: ['sns', 'atendimentos', 'recent'],
    queryFn: async () => {
      const cutoff = (() => {
        const d = new Date()
        d.setFullYear(d.getFullYear() - 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })()
      return snsFetch<Atendimento>(
        'atendimentos-por-tipo-de-urgencia-hospitalar-link',
        { limit: '9999', order_by: 'tempo asc', where: `tempo>="${cutoff}"` },
      )
    },
    staleTime: 24 * 60 * 60 * 1000,
  })
}
