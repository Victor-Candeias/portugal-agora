// Alertas TML (Transportes Metropolitanos de Lisboa) — cliente agnóstico de plataforma (MOB-002).
export const TML_BASE_URL = 'https://go.tmlmobilidade.pt/hub/api/v1'

export interface TmlAlert {
  _id: string
  active_period_start_date: number
  active_period_end_date: number
  agency_id: string
  cause: string
  effect: string
  title: string
  description: string
  coordinates: [number, number] | null
  municipality_ids: string[]
  reference_type: string
  references: { parent_id: string; child_ids: string[] }[]
  info_url: string | null
}

export interface TmlClientOptions {
  baseUrl?: string
}

export function createTmlClient(options: TmlClientOptions = {}) {
  const baseUrl = options.baseUrl ?? TML_BASE_URL

  return {
    /** Alertas da rede, mais recentes primeiro. */
    async getAlerts(): Promise<TmlAlert[]> {
      const res = await fetch(`${baseUrl}/alerts`)
      if (!res.ok) throw new Error('Erro ao carregar alertas TML')
      const data = (await res.json()) as { data: TmlAlert[] }
      return data.data.sort((a, b) => b.active_period_start_date - a.active_period_start_date)
    },
  }
}

export type TmlClient = ReturnType<typeof createTmlClient>

export const tmlClient = createTmlClient()
