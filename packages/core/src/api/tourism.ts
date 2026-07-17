// Cliente combinado de "pontos de interesse turístico", agregando as várias fontes de dados
// já integradas (SIGTUR/TravelBI para turismo genérico, ICNF para natureza/áreas protegidas).
// Os componentes de UI (apps/web, apps/mobile) devem usar este cliente em vez de chamar
// sigturClient/icnfClient diretamente, para que novas fontes fiquem automaticamente
// disponíveis em toda a app sem alterações adicionais.
import { sigturClient, type TourismPoint, type TourismPointsParams } from './sigtur.js'
import { icnfClient } from './icnf.js'

export const tourismClient = {
  async getTourismPoints(params: TourismPointsParams = {}): Promise<TourismPoint[]> {
    const [sigturPoints, icnfPoints] = await Promise.all([
      sigturClient.getTourismPoints(params),
      icnfClient.getTourismPoints(params),
    ])
    return [...sigturPoints, ...icnfPoints]
  },

  getCategories(): string[] {
    return [...new Set([...sigturClient.getCategories(), ...icnfClient.getCategories()])]
  },
}
