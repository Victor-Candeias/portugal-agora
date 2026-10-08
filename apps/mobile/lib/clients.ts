// Clientes do `@portugal-hoje/core` assentes nos `.sqlite` estáticos, configurados para o nativo
// (MOB-003): expo-sqlite como `QueryAll` (ver lib/staticDb.ts) e APIs em tempo real com `fetch`
// direto (sem proxy CORS). Equivalente a apps/web/src/lib/clients.ts.
import { createCarrisClient, createMetroPortoClient, createPublicServicesClient } from '@portugal-hoje/core'
import { carrisDb, metroPortoDb, publicServicesDb } from './staticDb'

export const carrisClient = createCarrisClient({ queryAll: carrisDb.queryAll })

export const metroPortoClient = createMetroPortoClient({ queryAll: metroPortoDb.queryAll })

export const publicServicesClient = createPublicServicesClient({ queryAll: publicServicesDb.queryAll })
