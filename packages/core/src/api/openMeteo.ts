// Open-Meteo (sem chave) — tempo atual e códigos WMO. A API Aberta não tem observações (MOB-008).
export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

// WMO weather interpretation codes → descrição PT + emoji
export const WMO_CODES: Record<number, { desc: string; emoji: string }> = {
  0: { desc: 'Céu limpo', emoji: '☀️' },
  1: { desc: 'Maioritariamente limpo', emoji: '🌤️' },
  2: { desc: 'Parcialmente nublado', emoji: '⛅' },
  3: { desc: 'Nublado', emoji: '☁️' },
  45: { desc: 'Nevoeiro', emoji: '🌫️' },
  48: { desc: 'Nevoeiro com geada', emoji: '🌫️' },
  51: { desc: 'Chuvisco fraco', emoji: '🌦️' },
  53: { desc: 'Chuvisco moderado', emoji: '🌦️' },
  55: { desc: 'Chuvisco forte', emoji: '🌧️' },
  61: { desc: 'Chuva fraca', emoji: '🌦️' },
  63: { desc: 'Chuva moderada', emoji: '🌧️' },
  65: { desc: 'Chuva forte', emoji: '🌧️' },
  71: { desc: 'Neve fraca', emoji: '❄️' },
  73: { desc: 'Neve moderada', emoji: '❄️' },
  75: { desc: 'Neve forte', emoji: '❄️' },
  77: { desc: 'Granizo', emoji: '🌨️' },
  80: { desc: 'Aguaceiros fracos', emoji: '🌦️' },
  81: { desc: 'Aguaceiros moderados', emoji: '🌧️' },
  82: { desc: 'Aguaceiros fortes', emoji: '🌧️' },
  85: { desc: 'Aguaceiros de neve', emoji: '🌨️' },
  86: { desc: 'Aguaceiros de neve fortes', emoji: '🌨️' },
  95: { desc: 'Trovoada', emoji: '⛈️' },
  96: { desc: 'Trovoada com granizo', emoji: '⛈️' },
  99: { desc: 'Trovoada forte com granizo', emoji: '⛈️' },
}

export function getWmoDescription(code: number) {
  return WMO_CODES[code] ?? { desc: 'Sem informação', emoji: '🌤️' }
}

export interface CurrentWeather {
  time: string
  temperature: number
  apparentTemperature: number
  humidity: number
  windSpeed: number
  windDirection: number
  precipitation: number
  weatherCode: number
  desc: string
  emoji: string
}

export function createOpenMeteoClient(baseUrl: string = OPEN_METEO_FORECAST_URL) {
  return {
    async getCurrent(lat: number, lng: number): Promise<CurrentWeather> {
      const url = new URL(baseUrl)
      url.searchParams.set('latitude', String(lat))
      url.searchParams.set('longitude', String(lng))
      url.searchParams.set(
        'current',
        [
          'temperature_2m',
          'apparent_temperature',
          'relative_humidity_2m',
          'precipitation',
          'weather_code',
          'wind_speed_10m',
          'wind_direction_10m',
        ].join(','),
      )
      url.searchParams.set('timezone', 'Europe/Lisbon')

      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`Open-Meteo: ${res.status}`)
      const c = ((await res.json()) as { current: Record<string, number | string> }).current
      const weatherCode = Number(c.weather_code)
      const wmo = getWmoDescription(weatherCode)
      return {
        time: String(c.time),
        temperature: Math.round(Number(c.temperature_2m)),
        apparentTemperature: Math.round(Number(c.apparent_temperature)),
        humidity: Number(c.relative_humidity_2m),
        windSpeed: Math.round(Number(c.wind_speed_10m)),
        windDirection: Number(c.wind_direction_10m),
        precipitation: Number(c.precipitation),
        weatherCode,
        desc: wmo.desc,
        emoji: wmo.emoji,
      }
    },
  }
}

export const openMeteoClient = createOpenMeteoClient()
