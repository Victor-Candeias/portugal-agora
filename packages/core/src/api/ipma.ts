// IPMA open-data (sem chave) — risco de incêndio rural (RCM) por concelho, agregado por distrito (MOB-008).
// A API Aberta não tem rota de risco de incêndio.
import type { FIRE_RISK_LABELS } from '../utils/index.js'

export const IPMA_OPEN_DATA_URL = 'https://api.ipma.pt/open-data'

export type FireRiskLevel = keyof typeof FIRE_RISK_LABELS

// RCM do IPMA: 1 Reduzido … 5 Máximo
export const RCM_LEVELS: Record<number, FireRiskLevel> = {
  1: 'reduced',
  2: 'moderate',
  3: 'high',
  4: 'very_high',
  5: 'extreme',
}

// Dois primeiros dígitos do DICO → distrito / região autónoma
const DISTRICT_BY_DICO_PREFIX: Record<string, string> = {
  '01': 'Aveiro',
  '02': 'Beja',
  '03': 'Braga',
  '04': 'Bragança',
  '05': 'Castelo Branco',
  '06': 'Coimbra',
  '07': 'Évora',
  '08': 'Faro',
  '09': 'Guarda',
  '10': 'Leiria',
  '11': 'Lisboa',
  '12': 'Portalegre',
  '13': 'Porto',
  '14': 'Santarém',
  '15': 'Setúbal',
  '16': 'Viana do Castelo',
  '17': 'Vila Real',
  '18': 'Viseu',
  '31': 'Madeira',
  '32': 'Madeira',
}

function districtFromDico(dico: string): string | undefined {
  const prefix = dico.slice(0, 2)
  if (prefix.startsWith('4')) return 'Açores'
  return DISTRICT_BY_DICO_PREFIX[prefix]
}

interface RcmFile {
  dataPrev: string
  dataRun: string
  fileDate: string
  local: Record<string, { data: { rcm: number }; dico: string; latitude: number; longitude: number }>
}

export interface DistrictFireRisk {
  district: string
  level: FireRiskLevel
  rcm: number
  municipalities: number
}

export interface FireRiskByDistrict {
  date: string
  data: DistrictFireRisk[]
}

export function createIpmaClient(baseUrl: string = IPMA_OPEN_DATA_URL) {
  return {
    /** day 0 = hoje, 1 = amanhã. Nível do distrito = máximo dos seus concelhos. */
    async getFireRiskByDistrict(day: 0 | 1 = 0): Promise<FireRiskByDistrict> {
      const res = await fetch(`${baseUrl}/forecast/meteorology/rcm/rcm-d${day}.json`)
      if (!res.ok) throw new Error(`IPMA RCM: ${res.status}`)
      const file = (await res.json()) as RcmFile

      const byDistrict = new Map<string, { rcm: number; municipalities: number }>()
      for (const entry of Object.values(file.local ?? {})) {
        const district = districtFromDico(String(entry.dico ?? ''))
        const rcm = entry.data?.rcm
        if (!district || !RCM_LEVELS[rcm]) continue
        const current = byDistrict.get(district)
        byDistrict.set(district, {
          rcm: Math.max(current?.rcm ?? 0, rcm),
          municipalities: (current?.municipalities ?? 0) + 1,
        })
      }

      const data = [...byDistrict.entries()]
        .map(([district, v]) => ({ district, level: RCM_LEVELS[v.rcm], ...v }))
        .sort((a, b) => b.rcm - a.rcm || a.district.localeCompare(b.district, 'pt'))

      return { date: file.dataPrev, data }
    },
  }
}

export const ipmaClient = createIpmaClient()
