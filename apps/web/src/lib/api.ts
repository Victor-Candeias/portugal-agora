import { ApiAbertaClient } from '@portugal-hoje/core'

const apiKey = import.meta.env.VITE_APIABERTA_KEY ?? 'demo'

export const apiClient = new ApiAbertaClient({ apiKey })
