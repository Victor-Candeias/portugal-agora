import { useQuery } from '@tanstack/react-query'

const BASE = 'https://api.ipma.pt/open-data'

// Mapeamento de cidades IPMA (globalIdLocal → nome)
export const IPMA_CITIES = [
  { id: 1010500, name: 'Aveiro',           district: 'Aveiro' },
  { id: 1020500, name: 'Beja',             district: 'Beja' },
  { id: 1030300, name: 'Braga',            district: 'Braga' },
  { id: 1040200, name: 'Bragança',         district: 'Bragança' },
  { id: 1050200, name: 'Castelo Branco',   district: 'Castelo Branco' },
  { id: 1060300, name: 'Coimbra',          district: 'Coimbra' },
  { id: 1070500, name: 'Évora',            district: 'Évora' },
  { id: 1080500, name: 'Faro',             district: 'Faro' },
  { id: 1090700, name: 'Guarda',           district: 'Guarda' },
  { id: 1100900, name: 'Leiria',           district: 'Leiria' },
  { id: 1110600, name: 'Lisboa',           district: 'Lisboa' },
  { id: 1121400, name: 'Setúbal',          district: 'Setúbal' },
  { id: 1131200, name: 'Porto',            district: 'Porto' },
  { id: 1141600, name: 'Viana do Castelo', district: 'Viana do Castelo' },
  { id: 1151200, name: 'Vila Real',        district: 'Vila Real' },
  { id: 1160900, name: 'Viseu',            district: 'Viseu' },
  { id: 1182300, name: 'Santarém',         district: 'Santarém' },
  { id: 1171400, name: 'Portalegre',       district: 'Portalegre' },
] as const

// Descrições dos tipos de tempo (idWeatherType → texto PT + emoji)
const WEATHER_TYPES: Record<number, { desc: string; emoji: string }> = {
  1:  { desc: 'Céu limpo',                       emoji: '☀️' },
  2:  { desc: 'Céu pouco nublado',               emoji: '🌤️' },
  3:  { desc: 'Céu parcialmente nublado',        emoji: '⛅' },
  4:  { desc: 'Céu muito nublado',               emoji: '☁️' },
  5:  { desc: 'Céu nublado (nuvens altas)',       emoji: '☁️' },
  6:  { desc: 'Aguaceiros',                       emoji: '🌧️' },
  7:  { desc: 'Aguaceiros fracos',                emoji: '🌦️' },
  8:  { desc: 'Aguaceiros fortes',                emoji: '🌧️' },
  9:  { desc: 'Chuva',                            emoji: '🌧️' },
  10: { desc: 'Chuva fraca ou chuvisco',          emoji: '🌦️' },
  11: { desc: 'Chuva forte',                      emoji: '⛈️' },
  12: { desc: 'Aguaceiros e trovoada',            emoji: '⛈️' },
  13: { desc: 'Trovoada',                         emoji: '🌩️' },
  14: { desc: 'Chuva e neve',                     emoji: '🌨️' },
  15: { desc: 'Neve',                             emoji: '❄️' },
  16: { desc: 'Granizo',                          emoji: '🌨️' },
  17: { desc: 'Neblina',                          emoji: '🌫️' },
  18: { desc: 'Nevoeiro',                         emoji: '🌫️' },
  24: { desc: 'Aguaceiros e granizo',             emoji: '🌨️' },
  25: { desc: 'Aguaceiros e trovoada',            emoji: '⛈️' },
  26: { desc: 'Neve e granizo',                   emoji: '❄️' },
  27: { desc: 'Aguaceiros e neve',                emoji: '🌨️' },
}

export function getWeatherType(id: number) {
  return WEATHER_TYPES[id] ?? { desc: 'Sem informação', emoji: '🌤️' }
}

export interface IpmaForecastDay {
  date: string
  tMin: number
  tMax: number
  precipitaProb: number
  idWeatherType: number
  desc: string
  emoji: string
  predWindDir: string
  classWindSpeed: number
}

async function fetchForecast(cityId: number): Promise<IpmaForecastDay[]> {
  const url = `${BASE}/forecast/meteorology/cities/daily/${cityId}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`IPMA: ${res.status}`)
  const json = await res.json()
  return (json.data ?? []).map((item: any) => {
    const wt = getWeatherType(item.idWeatherType)
    return {
      date: item.forecastDate,
      tMin: parseFloat(item.tMin),
      tMax: parseFloat(item.tMax),
      precipitaProb: parseFloat(item.precipitaProb),
      idWeatherType: item.idWeatherType,
      desc: wt.desc,
      emoji: wt.emoji,
      predWindDir: item.predWindDir,
      classWindSpeed: item.classWindSpeed,
    } as IpmaForecastDay
  })
}

export function useIpmaForecast(cityId: number) {
  return useQuery({
    queryKey: ['ipma', 'forecast', cityId],
    queryFn: () => fetchForecast(cityId),
    staleTime: 60 * 60 * 1000,
  })
}
