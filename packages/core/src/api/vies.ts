// VIES (Comissão Europeia, sem chave): nome e morada de entidades registadas para IVA (WEB-041).
// A API não tem cabeçalhos CORS: o mobile faz `fetch` direto e o web usa o proxy do Vite em dev.
// Só é consultada para NIFs de empresas/entidades (`isCompanyNif`), nunca de pessoas singulares.
import { normalizeNif } from '../utils/nif.js'

export const VIES_BASE_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api'

/** Formulário oficial do VIES, para quando não é possível consultar a API (ex.: web sem proxy). */
export const VIES_WEB_URL = 'https://ec.europa.eu/taxation_customs/vies/#/vat-validation'

// Pessoas coletivas, Administração Pública, não residentes coletivos, fundos, condomínios e
// sociedades irregulares/civis. Ficam de fora as pessoas singulares, as heranças, as atribuições
// oficiosas e os ENI.
const COMPANY_NIF_PREFIXES = ['5', '6', '71', '72', '90', '91', '98', '99']

export function isCompanyNif(input: string): boolean {
  const nif = normalizeNif(input)
  return /^\d{9}$/.test(nif) && COMPANY_NIF_PREFIXES.some(p => nif.startsWith(p))
}

export type ViesLookup =
  | { nif: string; status: 'registered'; name: string; address: string[]; checkedAt: string }
  | { nif: string; status: 'not-registered'; checkedAt: string }

const VIES_ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: 'O VIES não aceitou este NIF.',
  MS_UNAVAILABLE: 'O serviço português do VIES está indisponível. Tente mais tarde.',
  MS_MAX_CONCURRENT_REQ: 'O VIES está com demasiados pedidos. Tente daqui a pouco.',
  GLOBAL_MAX_CONCURRENT_REQ: 'O VIES está com demasiados pedidos. Tente daqui a pouco.',
  SERVICE_UNAVAILABLE: 'O VIES está indisponível. Tente mais tarde.',
  TIMEOUT: 'O VIES não respondeu a tempo. Tente mais tarde.',
}

export class ViesError extends Error {
  readonly code: string

  constructor(code: string, message: string = VIES_ERROR_MESSAGES[code] ?? `VIES: ${code}`) {
    super(message)
    this.name = 'ViesError'
    this.code = code
  }
}

interface RawViesResponse {
  isValid?: boolean
  userError?: string
  requestDate?: string
  name?: string
  address?: string
  vatNumber?: string
}

// O VIES usa "---" quando o campo não está disponível.
const clean = (v?: string) => (v && v.trim() !== '---' ? v.trim() : '')

export function parseViesResponse(raw: RawViesResponse, nif: string): ViesLookup {
  const checkedAt = raw.requestDate ?? new Date().toISOString()
  const code = raw.userError ?? (raw.isValid ? 'VALID' : 'INVALID')
  if (code === 'VALID' && raw.isValid) {
    return {
      nif,
      status: 'registered',
      name: clean(raw.name),
      address: clean(raw.address)
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean),
      checkedAt,
    }
  }
  if (code === 'INVALID') return { nif, status: 'not-registered', checkedAt }
  throw new ViesError(code)
}

export function createViesClient(options: { baseUrl?: string } = {}) {
  const baseUrl = options.baseUrl ?? VIES_BASE_URL
  return {
    /** Consulta o VIES para um NIF português (só faz sentido com `isCompanyNif(nif)`). */
    async lookup(input: string): Promise<ViesLookup> {
      const nif = normalizeNif(input)
      const res = await fetch(`${baseUrl}/ms/PT/vat/${encodeURIComponent(nif)}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new ViesError(`HTTP_${res.status}`, `VIES: erro ${res.status}. Tente mais tarde.`)
      return parseViesResponse((await res.json()) as RawViesResponse, nif)
    },
  }
}

export type ViesClient = ReturnType<typeof createViesClient>
