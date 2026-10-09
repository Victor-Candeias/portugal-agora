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

/**
 * Distrito de uma cidade IPMA a partir do `globalIdLocal` (ex.: 1081505 Sagres → Faro).
 * 1.º dígito: 1 continente, 2 Madeira, 3 Açores; dígitos 2–3: código do distrito (como no DICO).
 */
export function districtFromIpmaCityId(cityId: number | string): string | undefined {
  const id = String(cityId)
  if (id.startsWith('2')) return 'Madeira'
  if (id.startsWith('3')) return 'Açores'
  return DISTRICT_BY_DICO_PREFIX[id.slice(1, 3)]
}

// ── Avisos meteorológicos (WEB-025) ─────────────────────────────────────────
// A rota /ipma/warnings da API Aberta não tem o nível do aviso e só tem 3 regiões, por isso
// usa-se o ficheiro open-data do IPMA (25 áreas × 8 tipos, sem chave, com CORS).

export type WarningLevel = 'green' | 'yellow' | 'orange' | 'red'

export const WARNING_LEVEL_LABELS: Record<WarningLevel, string> = {
  green: 'Verde',
  yellow: 'Amarelo',
  orange: 'Laranja',
  red: 'Vermelho',
}

export const WARNING_LEVEL_COLORS: Record<WarningLevel, { color: string; background: string; accent: string }> = {
  green: { color: '#166534', background: '#dcfce7', accent: '#16a34a' },
  yellow: { color: '#854d0e', background: '#fef9c3', accent: '#eab308' },
  orange: { color: '#9a3412', background: '#ffedd5', accent: '#f97316' },
  red: { color: '#991b1b', background: '#fee2e2', accent: '#dc2626' },
}

const WARNING_LEVEL_RANK: Record<WarningLevel, number> = { green: 0, yellow: 1, orange: 2, red: 3 }

/** Áreas de aviso do IPMA (`idAreaAviso`) → nome e distrito/região autónoma. */
export const IPMA_WARNING_AREAS: Record<string, { name: string; district: string }> = {
  AVR: { name: 'Aveiro', district: 'Aveiro' },
  BJA: { name: 'Beja', district: 'Beja' },
  BRG: { name: 'Braga', district: 'Braga' },
  BGC: { name: 'Bragança', district: 'Bragança' },
  CBO: { name: 'Castelo Branco', district: 'Castelo Branco' },
  CBR: { name: 'Coimbra', district: 'Coimbra' },
  EVR: { name: 'Évora', district: 'Évora' },
  FAR: { name: 'Faro', district: 'Faro' },
  GDA: { name: 'Guarda', district: 'Guarda' },
  LRA: { name: 'Leiria', district: 'Leiria' },
  LSB: { name: 'Lisboa', district: 'Lisboa' },
  PTG: { name: 'Portalegre', district: 'Portalegre' },
  PTO: { name: 'Porto', district: 'Porto' },
  STM: { name: 'Santarém', district: 'Santarém' },
  STB: { name: 'Setúbal', district: 'Setúbal' },
  VCT: { name: 'Viana do Castelo', district: 'Viana do Castelo' },
  VRL: { name: 'Vila Real', district: 'Vila Real' },
  VIS: { name: 'Viseu', district: 'Viseu' },
  MCN: { name: 'Madeira — Costa Norte', district: 'Madeira' },
  MCS: { name: 'Madeira — Costa Sul', district: 'Madeira' },
  MRM: { name: 'Madeira — Regiões Montanhosas', district: 'Madeira' },
  MPS: { name: 'Madeira — Porto Santo', district: 'Madeira' },
  AOC: { name: 'Açores — Grupo Ocidental', district: 'Açores' },
  ACE: { name: 'Açores — Grupo Central', district: 'Açores' },
  AOR: { name: 'Açores — Grupo Oriental', district: 'Açores' },
}

interface RawWarning {
  text: string
  awarenessTypeName: string
  idAreaAviso: string
  startTime: string
  endTime: string
  awarenessLevelID: string
}

export interface IpmaWarning {
  id: string
  type: string
  text: string
  level: WarningLevel
  /** Hora local de Portugal, sem fuso (ex.: `2026-10-09T12:05:00`). */
  startTime: string
  endTime: string
  area: string
  areaName: string
  district: string
}

function isWarningLevel(level: string): level is WarningLevel {
  return level in WARNING_LEVEL_RANK
}

/** Avisos ativos ou futuros (nível ≠ verde), do mais grave para o menos grave. */
export function parseIpmaWarnings(raw: RawWarning[], now: Date = new Date()): IpmaWarning[] {
  return raw
    .filter(w => isWarningLevel(w.awarenessLevelID) && w.awarenessLevelID !== 'green')
    .filter(w => new Date(w.endTime).getTime() > now.getTime())
    .map(w => {
      const area = IPMA_WARNING_AREAS[w.idAreaAviso]
      return {
        id: `${w.idAreaAviso}-${w.awarenessTypeName}-${w.startTime}`,
        type: w.awarenessTypeName,
        text: (w.text ?? '').trim(),
        level: w.awarenessLevelID as WarningLevel,
        startTime: w.startTime,
        endTime: w.endTime,
        area: w.idAreaAviso,
        areaName: area?.name ?? w.idAreaAviso,
        district: area?.district ?? w.idAreaAviso,
      }
    })
    .sort(
      (a, b) =>
        WARNING_LEVEL_RANK[b.level] - WARNING_LEVEL_RANK[a.level] ||
        a.startTime.localeCompare(b.startTime) ||
        a.areaName.localeCompare(b.areaName, 'pt'),
    )
}

const normalizeName = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

/** Avisos de um distrito (comparação sem acentos nem maiúsculas). Sem distrito devolve todos. */
export function filterWarningsByDistrict(warnings: IpmaWarning[], district?: string | null): IpmaWarning[] {
  if (!district) return warnings
  const target = normalizeName(district)
  return warnings.filter(w => normalizeName(w.district) === target)
}

/** `2026-10-09T12:05:00` → `09/10 12h05` (sem conversão de fuso: o IPMA já dá a hora local). */
export function formatWarningTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]} ${m[4]}h${m[5]}` : iso
}

/** Nível mais grave de uma lista de avisos (`green` se estiver vazia). */
export function maxWarningLevel(warnings: IpmaWarning[]): WarningLevel {
  return warnings.reduce<WarningLevel>(
    (max, w) => (WARNING_LEVEL_RANK[w.level] > WARNING_LEVEL_RANK[max] ? w.level : max),
    'green',
  )
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

    /** Avisos meteorológicos ativos ou futuros (amarelo/laranja/vermelho) de todas as áreas. */
    async getWarnings(): Promise<IpmaWarning[]> {
      const res = await fetch(`${baseUrl}/forecast/warnings/warnings_www.json`)
      if (!res.ok) throw new Error(`IPMA avisos: ${res.status}`)
      return parseIpmaWarnings((await res.json()) as RawWarning[])
    },
  }
}

export const ipmaClient = createIpmaClient()
