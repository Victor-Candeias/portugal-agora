// Validação local do NIF português (WEB-033): formato, prefixo e dígito de controlo MOD 11.
// Não faz pedidos de rede. A rota da API Aberta `/nif/validate/:nif` aceita prefixos inexistentes
// (ex.: 0, 4) e classifica mal alguns tipos (ex.: 7x como "Forças armadas"), por isso não é usada.

export type NifInvalidReason = 'format' | 'prefix' | 'checksum'

export type NifValidation =
  | { nif: string; valid: true; type: string }
  | { nif: string; valid: false; reason: NifInvalidReason; message: string }

// Prefixos atribuídos pela AT. Os de 2 dígitos têm prioridade sobre os de 1.
const NIF_PREFIXES: Record<string, string> = {
  '1': 'Pessoa singular',
  '2': 'Pessoa singular',
  '3': 'Pessoa singular',
  '45': 'Pessoa singular não residente',
  '5': 'Pessoa coletiva',
  '6': 'Organismo da Administração Pública',
  '70': 'Herança indivisa',
  '71': 'Pessoa coletiva não residente',
  '72': 'Fundo de investimento',
  '74': 'Herança indivisa',
  '75': 'Herança indivisa',
  '77': 'Atribuição oficiosa',
  '78': 'Atribuição oficiosa a não residente',
  '79': 'Regime excecional',
  '8': 'Empresário em nome individual (extinto)',
  '90': 'Condomínio, sociedade irregular ou herança indivisa',
  '91': 'Condomínio, sociedade irregular ou herança indivisa',
  '98': 'Não residente sem estabelecimento estável',
  '99': 'Sociedade civil sem personalidade jurídica',
}

const INVALID_MESSAGES: Record<NifInvalidReason, string> = {
  format: 'O NIF tem de ter 9 dígitos.',
  prefix: 'Prefixo não atribuído pela Autoridade Tributária.',
  checksum: 'Dígito de controlo inválido.',
}

/** Remove espaços, pontos, hífenes e o prefixo de país "PT". */
export function normalizeNif(input: string): string {
  return input.replace(/^\s*PT/i, '').replace(/[\s.-]/g, '')
}

/** Tipo de entidade pelo prefixo, ou `null` se o prefixo não existir. */
export function nifType(nif: string): string | null {
  return NIF_PREFIXES[nif.slice(0, 2)] ?? NIF_PREFIXES[nif.slice(0, 1)] ?? null
}

/** Dígito de controlo MOD 11 para os 8 primeiros dígitos. */
export function nifCheckDigit(first8: string): number {
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(first8[i]) * (9 - i)
  const check = 11 - (sum % 11)
  return check >= 10 ? 0 : check
}

export function validateNif(input: string): NifValidation {
  const nif = normalizeNif(input)
  const invalid = (reason: NifInvalidReason): NifValidation => ({ nif, valid: false, reason, message: INVALID_MESSAGES[reason] })

  if (!/^\d{9}$/.test(nif)) return invalid('format')
  const type = nifType(nif)
  if (!type) return invalid('prefix')
  if (nifCheckDigit(nif.slice(0, 8)) !== Number(nif[8])) return invalid('checksum')
  return { nif, valid: true, type }
}
