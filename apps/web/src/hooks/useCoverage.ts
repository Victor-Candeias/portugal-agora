import { useQuery } from '@tanstack/react-query'
import {
  getMobileCoverageAtPoint,
  getMobileCoverageCatalog,
  roundCoordinate,
  searchPtPlaces,
  type MobileCoverageResult,
  type MobileTechnology,
} from '@portugal-hoje/core'

// Lógica de dados em packages/core/src/api/anacom.ts (WEB-065): fetch direto à ANACOM (CORS aberto).
const DAY = 24 * 60 * 60 * 1000

export interface CoveragePoint {
  lat: number
  lon: number
}

function hasSourceFailure(data: MobileCoverageResult | undefined): boolean {
  return !!data && [data.aggregate, ...data.operators].some(o => o.status === 'source_unavailable')
}

/** Cobertura das operadoras num ponto. Os dados são trimestrais: cache de 24 h, exceto se a fonte falhou. */
export function useMobileCoverage(technology: MobileTechnology, point: CoveragePoint | null) {
  const lat = point ? roundCoordinate(point.lat) : null
  const lon = point ? roundCoordinate(point.lon) : null
  return useQuery({
    queryKey: ['coverage', technology, lat, lon],
    queryFn: ({ signal }) => getMobileCoverageAtPoint(lat!, lon!, technology, { signal }),
    enabled: lat !== null && lon !== null,
    staleTime: query => (hasSourceFailure(query.state.data) ? 0 : DAY),
    retry: false,
  })
}

/** Confirma o catálogo de camadas da ANACOM (avisa se uma camada mudar ou desaparecer). */
export function useCoverageCatalog() {
  return useQuery({
    queryKey: ['coverage', 'catalog'],
    queryFn: ({ signal }) => getMobileCoverageCatalog({ signal }),
    staleTime: DAY,
    retry: 1,
  })
}

export function usePlaceSearch(term: string) {
  const query = term.trim()
  return useQuery({
    queryKey: ['places', query.toLowerCase()],
    queryFn: ({ signal }) => searchPtPlaces(query, { signal }),
    enabled: query.length >= 2,
    staleTime: 7 * DAY,
    retry: 1,
  })
}
