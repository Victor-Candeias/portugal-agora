// Contratos públicos do BASE.gov.pt via API Aberta — `/base/contracts` (WEB-031).
// Os pedidos estão no `ApiAbertaClient` (client.ts); aqui ficam os tipos e a formatação, sem dependências de plataforma.

/** Contrato tal como vem de `/base/contracts`, `/search` e `/lookup/:id`. */
export interface BaseContract {
  id: string
  description: string
  /** `NIF - Nome` da entidade adjudicante (pode vir vazio). */
  contractingEntity: string
  /** `NIF - Nome` do adjudicatário (`- - Nome` quando não há NIF). */
  awarded: string
  /** Preço contratual (€). */
  value: number
  /** Data de celebração, `AAAA-MM-DD`. */
  date: string
  /** Tipo de procedimento (ex.: `Ajuste Direto Regime Geral`). */
  type: string
}

/** Página de contratos. Na pesquisa a API não devolve `pages`; o cliente calcula-o. */
export interface BaseContractsPage {
  total: number
  page: number
  limit: number
  pages: number
  data: BaseContract[]
}

/** Máximo aceite pela API em `limit`. */
export const BASE_CONTRACTS_MAX_LIMIT = 100

export interface BaseParty {
  /** NIF (ou identificador estrangeiro), `null` se não vier. */
  nif: string | null
  name: string
}

/** Separa `NIF - Nome` (formato do BASE) em NIF e nome. Devolve `null` se o campo vier vazio. */
export function parseBaseParty(raw: string | null | undefined): BaseParty | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  const match = /^(\S+)\s+-\s+(.+)$/.exec(value)
  if (!match) return { nif: null, name: value }
  const id = match[1]
  // Sem NIF, o BASE escreve `- - Nome`.
  const name = match[2].replace(/^-\s+/, '').trim()
  const nif = /\d/.test(id) ? id : null
  return { nif, name: name || value }
}

export function formatContractValue(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`, sem passar por `Date` (evita mudar de dia com o fuso horário). */
export function formatBaseDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date
}

/** Página do contrato no portal BASE. */
export function baseContractUrl(id: string): string {
  return `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${encodeURIComponent(id)}`
}

/** Pesquisa válida para `/base/contracts/search` (o `q` é obrigatório; pede-se pelo menos 3 caracteres). */
export function normalizeBaseQuery(q: string): string | null {
  const value = q.trim().replace(/\s+/g, ' ')
  return value.length >= 3 ? value : null
}
