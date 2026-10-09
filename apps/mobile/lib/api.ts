import { ApiAbertaClient } from '@portugal-hoje/core'

// Sem chave, o cliente falha cada pedido com uma mensagem clara (MOB-008).
const apiKey = process.env.EXPO_PUBLIC_APIABERTA_KEY ?? ''

export const apiClient = new ApiAbertaClient({ apiKey })
