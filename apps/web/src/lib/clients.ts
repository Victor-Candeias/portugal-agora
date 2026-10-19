// Instâncias dos clientes do `@portugal-hoje/core` configuradas para o browser (MOB-002).
// Aqui fica tudo o que é específico do web: `import.meta.env`, proxies CORS, assets servidos
// por BASE_URL e o motor SQLite em WASM (sql.js). Os hooks em src/hooks só usam estes clientes.
import {
  ApiAbertaClient,
  createAnpcClient,
  createCarrisClient,
  createCodigoPostalClient,
  createComboiosClient,
  createEnergyClient,
  createMetroPortoClient,
  createOpenChargeMapClient,
  createOsmChargersClient,
  createPublicServicesClient,
  createSnsClient,
  createTmlClient,
  createViesClient,
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

// Postos de carregamento EV (WEB-040). Exposta pelo `envPrefix` do vite.config.ts.
export const openChargeMapClient = createOpenChargeMapClient({ apiKey: import.meta.env.OPEN_CHARGE_MAP_KEY ?? '' })

// Postos EV do OpenStreetMap via Overpass (WEB-047). Os mirrors têm CORS; o browser envia o seu User-Agent.
export const osmChargersClient = createOsmChargersClient()

// Sem chave, o cliente falha cada pedido com uma mensagem clara (MOB-008).
export const apiClient = new ApiAbertaClient({ apiKey: import.meta.env.VITE_APIABERTA_KEY ?? '' })

// VIES sem cabeçalhos CORS (WEB-041). Dev: proxy do Vite (/api/vies). Prod (GitHub Pages): sem proxy,
// por isso `null` e a página NIF mostra um link para o formulário do VIES.
export const viesClient = import.meta.env.DEV ? createViesClient({ baseUrl: '/api/vies' }) : null

// Energia (WEB-055): JSON gerados por scripts/build-energy-db.mjs e servidos pelo próprio site.
export const energyClient = createEnergyClient({ baseUrl: `${import.meta.env.BASE_URL}data/` })
