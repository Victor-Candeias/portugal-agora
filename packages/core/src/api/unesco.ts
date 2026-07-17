// UNESCO — Património Mundial em Portugal.
//
// A API oficial (whc.unesco.org/en/list/xml/) não expõe cabeçalhos CORS (bloqueada no browser)
// e devolve os ~1248 sítios do mundo inteiro sem filtro por país. Como a lista portuguesa é
// pequena (17 sítios) e extremamente estável (a UNESCO só a atualiza raramente, em sessões de
// comité), optou-se por um dataset estático curado, embutido na app — sem dependência de rede
// nem risco de CORS/rate-limit, ao contrário do OpenStreetMap Overpass (testado e descartado:
// resposta lenta de 8-12s e rate-limit 429 ao fim de poucos pedidos no servidor público) ou da
// Agenda Cultural de Lisboa (agendalx.pt inacessível; dados.cm-lisboa.pt protegido por
// Cloudflare bot-challenge).
//
// Coordenadas e anos de classificação verificados a partir de informação pública (whc.unesco.org).
import type { TourismPoint, TourismPointsParams } from './sigtur.js'

interface UnescoSite {
  slug: string
  name: string
  municipality: string
  yearInscribed: number
  latitude: number
  longitude: number
}

export const UNESCO_SITES: UnescoSite[] = [
  { slug: 'angra-do-heroismo', name: 'Centro Histórico de Angra do Heroísmo', municipality: 'Angra do Heroísmo', yearInscribed: 1983, latitude: 38.6553, longitude: -27.2183 },
  { slug: 'mosteiro-jeronimos-torre-belem', name: 'Mosteiro dos Jerónimos e Torre de Belém, Lisboa', municipality: 'Lisboa', yearInscribed: 1983, latitude: 38.6979, longitude: -9.2065 },
  { slug: 'convento-cristo-tomar', name: 'Convento de Cristo, Tomar', municipality: 'Tomar', yearInscribed: 1983, latitude: 39.6031, longitude: -8.4103 },
  { slug: 'mosteiro-batalha', name: 'Mosteiro da Batalha', municipality: 'Batalha', yearInscribed: 1983, latitude: 39.6608, longitude: -8.8258 },
  { slug: 'centro-historico-evora', name: 'Centro Histórico de Évora', municipality: 'Évora', yearInscribed: 1986, latitude: 38.5714, longitude: -7.9086 },
  { slug: 'mosteiro-alcobaca', name: 'Mosteiro de Alcobaça', municipality: 'Alcobaça', yearInscribed: 1989, latitude: 39.5522, longitude: -8.9803 },
  { slug: 'paisagem-cultural-sintra', name: 'Paisagem Cultural de Sintra', municipality: 'Sintra', yearInscribed: 1995, latitude: 38.7876, longitude: -9.3904 },
  { slug: 'centro-historico-porto', name: 'Centro Histórico do Porto, Ponte Dom Luís I e Mosteiro da Serra do Pilar', municipality: 'Porto', yearInscribed: 1996, latitude: 41.1409, longitude: -8.6118 },
  { slug: 'vale-do-coa', name: 'Sítios de Arte Rupestre Pré-histórica do Vale do Côa', municipality: 'Vila Nova de Foz Côa', yearInscribed: 1998, latitude: 41.0722, longitude: -7.0392 },
  { slug: 'laurissilva-madeira', name: 'Floresta Laurissilva da Madeira', municipality: 'Madeira', yearInscribed: 1999, latitude: 32.75, longitude: -17.0 },
  { slug: 'alto-douro-vinhateiro', name: 'Alto Douro Vinhateiro', municipality: 'Peso da Régua', yearInscribed: 2001, latitude: 41.1621, longitude: -7.7864 },
  { slug: 'centro-historico-guimaraes', name: 'Centro Histórico de Guimarães', municipality: 'Guimarães', yearInscribed: 2001, latitude: 41.4425, longitude: -8.2918 },
  { slug: 'paisagem-vinha-pico', name: 'Paisagem da Cultura da Vinha da Ilha do Pico', municipality: 'Ilha do Pico', yearInscribed: 2004, latitude: 38.47, longitude: -28.34 },
  { slug: 'universidade-coimbra', name: 'Universidade de Coimbra – Alta e Sofia', municipality: 'Coimbra', yearInscribed: 2013, latitude: 40.2083, longitude: -8.4257 },
  { slug: 'fronteira-elvas', name: 'Fronteira de Elvas e suas Fortificações', municipality: 'Elvas', yearInscribed: 2012, latitude: 38.8817, longitude: -7.1614 },
  { slug: 'paco-real-mafra', name: 'Paço Real de Mafra — Palácio, Basílica, Convento, Jardim do Cerco e Tapada', municipality: 'Mafra', yearInscribed: 2019, latitude: 38.9394, longitude: -9.3306 },
  { slug: 'bom-jesus-braga', name: 'Santuário do Bom Jesus do Monte, Braga', municipality: 'Braga', yearInscribed: 2019, latitude: 41.5442, longitude: -8.3781 },
]

function normalizeSite(site: UnescoSite): TourismPoint {
  return {
    id: `unesco:${site.slug}`,
    externalId: site.slug,
    name: site.name,
    category: 'unesco',
    subcategory: `Património Mundial (${site.yearInscribed})`,
    municipality: site.municipality,
    latitude: site.latitude,
    longitude: site.longitude,
    website: `https://whc.unesco.org/en/list/?search=${encodeURIComponent(site.name)}`,
    source: {
      provider: 'UNESCO',
      system: 'UNESCO',
      service: 'static',
      layerId: 0,
      objectId: site.slug,
    },
  }
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const toRad = (value: number) => value * Math.PI / 180
  const earthRadiusKm = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export const unescoClient = {
  /** Devolve os sítios de Património Mundial da UNESCO em Portugal (dataset estático). */
  async getTourismPoints(params: TourismPointsParams = {}): Promise<TourismPoint[]> {
    if (params.category && params.category !== 'unesco') return []

    let sites = UNESCO_SITES

    if (params.bbox) {
      const [minLng, minLat, maxLng, maxLat] = params.bbox
      sites = sites.filter(s => s.longitude >= minLng && s.longitude <= maxLng && s.latitude >= minLat && s.latitude <= maxLat)
    } else if (params.nearby) {
      const { latitude, longitude, radiusKm } = params.nearby
      sites = sites.filter(s => distanceKm({ latitude, longitude }, s) <= radiusKm)
    }

    return sites.map(normalizeSite)
  },

  getCategories(): string[] {
    return ['unesco']
  },
}
