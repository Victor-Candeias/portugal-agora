// Clientes do `@portugal-hoje/core` configurados para o nativo: expo-sqlite como `QueryAll` dos
// `.sqlite` estáticos (MOB-003, ver lib/staticDb.ts) e APIs em tempo real com `fetch` direto (sem
// proxy CORS, que só o browser precisa). Equivalente a apps/web/src/lib/clients.ts.
import {
  createAnpcClient,
  createCarrisClient,
  createCodigoPostalClient,
  createComboiosClient,
  createMetroPortoClient,
  createPublicServicesClient,
  createSnsClient,
  createTmlClient,
  type PostalCodeGeoMap,
} from '@portugal-hoje/core'
// Mapa CP → distrito/município dos hospitais: o mesmo ficheiro estático servido pelo web,
// empacotado na app (funciona offline, sem pedido extra).
import postalCodeGeoMap from '../../web/public/cp-distrito.json'
import { carrisDb, metroPortoDb, publicServicesDb } from './staticDb'

export const carrisClient = createCarrisClient({ queryAll: carrisDb.queryAll })

export const metroPortoClient = createMetroPortoClient({ queryAll: metroPortoDb.queryAll })

export const publicServicesClient = createPublicServicesClient({ queryAll: publicServicesDb.queryAll })

export const snsClient = createSnsClient({
  loadPostalCodeMap: () => Promise.resolve(postalCodeGeoMap as PostalCodeGeoMap),
})

export const comboiosClient = createComboiosClient()

export const tmlClient = createTmlClient()

export const codigoPostalClient = createCodigoPostalClient()

export const anpcClient = createAnpcClient({ apiKey: process.env.EXPO_PUBLIC_APIABERTA_KEY ?? '' })
