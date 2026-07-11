import { ApiAbertaClient } from '@portugal-hoje/core'

const apiKey = process.env.EXPO_PUBLIC_APIABERTA_KEY ?? 'demo'

export const apiClient = new ApiAbertaClient({ apiKey })
