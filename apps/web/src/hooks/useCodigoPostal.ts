import { useQuery } from '@tanstack/react-query'

export interface CpParte {
  Artéria: string
  Local: string
  Troço: string
  Porta: string
  Cliente: string
}

export interface CpInfo {
  CP: string
  CP4: string
  CP3: string
  Distrito: string
  Concelho: string
  Localidade: string
  'Designação Postal': string
  municipio: string
  partes: CpParte[]
  ruas: string[]
  centro: [number, number] | null
}

export function useCodigoPostal(cp: string) {
  const normalized = cp.trim().toUpperCase()
  const valid = /^\d{4}-\d{3}$/.test(normalized)

  return useQuery<CpInfo>({
    queryKey: ['cp', normalized],
    queryFn: async () => {
      const res = await fetch(`https://geoapi.pt/cp/${normalized}?json=1`)
      if (res.status === 404) throw new Error('Código postal não encontrado.')
      if (!res.ok) throw new Error(`Erro ao pesquisar código postal (HTTP ${res.status})`)
      return res.json()
    },
    enabled: valid,
    staleTime: 7 * 24 * 60 * 60 * 1000,
    retry: 1,
  })
}
