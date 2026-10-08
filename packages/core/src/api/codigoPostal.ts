// Código Postal (geoapi.pt) — cliente agnóstico de plataforma (MOB-002). CORS aberto.
export const GEOAPI_BASE_URL = 'https://geoapi.pt'

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

export function normalizePostalCode(cp: string): string {
  return cp.trim().toUpperCase()
}

/** Valida o formato `NNNN-NNN` (após normalização). */
export function isValidPostalCode(cp: string): boolean {
  return /^\d{4}-\d{3}$/.test(normalizePostalCode(cp))
}

export interface CodigoPostalClientOptions {
  baseUrl?: string
}

export function createCodigoPostalClient(options: CodigoPostalClientOptions = {}) {
  const baseUrl = options.baseUrl ?? GEOAPI_BASE_URL

  return {
    async lookup(cp: string): Promise<CpInfo> {
      const normalized = normalizePostalCode(cp)
      const res = await fetch(`${baseUrl}/cp/${normalized}?json=1`)
      if (res.status === 404) throw new Error('Código postal não encontrado.')
      if (!res.ok) throw new Error(`Erro ao pesquisar código postal (HTTP ${res.status})`)
      return res.json() as Promise<CpInfo>
    },
  }
}

export type CodigoPostalClient = ReturnType<typeof createCodigoPostalClient>

export const codigoPostalClient = createCodigoPostalClient()
