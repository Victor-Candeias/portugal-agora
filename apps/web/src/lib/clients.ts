// Instâncias dos clientes do `@portugal-hoje/core` configuradas para o browser (MOB-002).
// Aqui fica tudo o que é específico do web: `import.meta.env`, proxies CORS, assets servidos
// por BASE_URL e o motor SQLite em WASM (sql.js). Os hooks em src/hooks só usam estes clientes.
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
import { queryAll as carrisQueryAll } from '@/lib/staticDb'
import { metroPortoQueryAll } from '@/lib/metroPortoDb'
import { publicServicesQueryAll } from '@/lib/publicServicesDb'

export const carrisClient = createCarrisClient({ queryAll: carrisQueryAll })

export const metroPortoClient = createMetroPortoClient({ queryAll: metroPortoQueryAll })

export const publicServicesClient = createPublicServicesClient({ queryAll: publicServicesQueryAll })

export const snsClient = createSnsClient({
  loadPostalCodeMap: () =>
    fetch(`${import.meta.env.BASE_URL}cp-distrito.json`).then(r => r.json() as Promise<PostalCodeGeoMap>),
})

// comboios.live não tem cabeçalhos CORS.
// Dev: proxied via Vite (/api/comboios → https://comboios.live)
// Prod: via corsproxy.io
export const comboiosClient = createComboiosClient({
  baseUrl: import.meta.env.DEV ? '/api/comboios' : 'https://corsproxy.io/?url=https://comboios.live',
})

export const tmlClient = createTmlClient()

export const codigoPostalClient = createCodigoPostalClient()

export const anpcClient = createAnpcClient({ apiKey: import.meta.env.VITE_APIABERTA_KEY ?? '' })
