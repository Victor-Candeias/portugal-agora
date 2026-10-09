import { useState } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { formatDate, type IpmaDailyForecast } from '@portugal-hoje/core'
import { DEFAULT_CITY_ID, useCurrentWeather, useIpmaForecasts } from '../../hooks/useTempo'
import { Card, ChipRow, ErrorView, LoadingView, ScreenHeader, SectionTitle, uiStyles } from '../../components/ui'

const LISBOA = { name: 'Lisboa', latitude: 38.766, longitude: -9.1286 }

// Classe de intensidade do vento do IPMA (classWindSpeed)
const WIND_CLASS: Record<string, string> = { '1': 'fraco', '2': 'moderado', '3': 'forte', '4': 'muito forte' }

export function ipmaEmoji(description: string): string {
  const d = description.toLowerCase()
  if (d.includes('trovoada')) return '⛈️'
  if (d.includes('neve')) return '❄️'
  if (d.includes('granizo')) return '🌨️'
  if (d.includes('aguaceiros') || d.includes('chuvisco')) return '🌦️'
  if (d.includes('chuva')) return '🌧️'
  if (d.includes('nevoeiro') || d.includes('neblina')) return '🌫️'
  if (d.includes('limpo')) return '☀️'
  if (d.includes('pouco nublado')) return '🌤️'
  if (d.includes('parcialmente') || d.includes('períodos')) return '⛅'
  if (d.includes('nublado')) return '☁️'
  return '🌤️'
}

export default function Tempo() {
  const forecasts = useIpmaForecasts()
  const [cityId, setCityId] = useState<string>(String(DEFAULT_CITY_ID))

  const cities = forecasts.data ?? []
  const city = cities.find(c => String(c.cityId) === cityId)
  const place = city
    ? { name: city.cityName, latitude: city.latitude, longitude: city.longitude }
    : LISBOA
  const current = useCurrentWeather(place.latitude, place.longitude)

  const refresh = () => {
    void forecasts.refetch()
    void current.refetch()
  }

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="🌤️ Meteorologia"
        subtitle={`Previsão IPMA · ${place.name}`}
        onRefresh={refresh}
        refreshing={forecasts.isFetching || current.isFetching}
      />

      {cities.length > 0 && (
        <ChipRow
          options={cities.map(c => ({ value: String(c.cityId), label: c.cityName }))}
          value={cityId}
          onChange={v => v && setCityId(v)}
          allLabel={null}
          color="#0ea5e9"
        />
      )}

      {current.data && (
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Agora · {place.name}</Text>
          <View style={styles.currentMain}>
            <Text style={styles.currentTemp}>{current.data.temperature}°C</Text>
            <Text style={styles.currentEmoji}>{current.data.emoji}</Text>
          </View>
          <Text style={styles.currentDesc}>
            {current.data.desc} · sensação {current.data.apparentTemperature}°C
          </Text>
          <View style={styles.currentDetails}>
            <Text style={styles.currentDetail}>💧 {current.data.humidity}%</Text>
            <Text style={styles.currentDetail}>💨 {current.data.windSpeed} km/h</Text>
            <Text style={styles.currentDetail}>🌧️ {current.data.precipitation} mm</Text>
          </View>
          <Text style={styles.currentSource}>Open-Meteo</Text>
        </View>
      )}

      {forecasts.isLoading && <LoadingView color="#0ea5e9" />}
      {forecasts.isError && <ErrorView error={forecasts.error} onRetry={() => void forecasts.refetch()} />}

      {city && city.forecasts.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow}>
            {city.forecasts.map(f => (
              <View key={f.date} style={styles.dayCard}>
                <Text style={styles.dayDate}>{formatDate(f.date)}</Text>
                <Text style={styles.dayEmoji}>{ipmaEmoji(f.description)}</Text>
                <Text style={styles.dayMax}>{f.tMax}°</Text>
                <Text style={styles.dayMin}>{f.tMin}°</Text>
                <Text style={styles.dayRain}>💧{f.precipProb}%</Text>
              </View>
            ))}
          </ScrollView>

          <Card>
            <SectionTitle>Previsão</SectionTitle>
            {city.forecasts.map(f => (
              <ForecastRow key={f.date} forecast={f} />
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  )
}

function ForecastRow({ forecast: f }: { forecast: IpmaDailyForecast }) {
  const wind = WIND_CLASS[String(f.windSpeed)]
  return (
    <View style={styles.forecastRow}>
      <Text style={styles.forecastDate}>{formatDate(f.date)}</Text>
      <Text style={styles.forecastEmoji}>{ipmaEmoji(f.description)}</Text>
      <View style={styles.forecastInfo}>
        <Text style={styles.forecastDesc} numberOfLines={2}>{f.description}</Text>
        <Text style={uiStyles.small}>
          💧 {f.precipProb}% · 💨 {f.windDir}{wind ? ` ${wind}` : ''}
        </Text>
      </View>
      <Text style={styles.forecastTemp}>
        <Text style={{ color: '#f97316' }}>{f.tMax}°</Text>
        {'  '}
        <Text style={{ color: '#0ea5e9' }}>{f.tMin}°</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  currentCard: {
    backgroundColor: '#0ea5e9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  currentLabel: { color: '#e0f2fe', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  currentMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  currentTemp: { color: 'white', fontSize: 56, fontWeight: '700' },
  currentEmoji: { fontSize: 48 },
  currentDesc: { color: 'white', fontSize: 14, fontWeight: '600' },
  currentDetails: { flexDirection: 'row', gap: 16, marginTop: 8 },
  currentDetail: { color: '#e0f2fe', fontSize: 14 },
  currentSource: { color: '#bae6fd', fontSize: 10, marginTop: 8, textAlign: 'right' },
  daysRow: { marginBottom: 16 },
  dayCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 10,
    width: 80,
    elevation: 2,
  },
  dayDate: { fontSize: 10, color: '#64748b', fontWeight: '600', marginBottom: 6 },
  dayEmoji: { fontSize: 28, marginBottom: 4 },
  dayMax: { fontSize: 15, fontWeight: '700', color: '#f97316' },
  dayMin: { fontSize: 13, color: '#0ea5e9' },
  dayRain: { fontSize: 11, color: '#0ea5e9', marginTop: 4 },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  forecastDate: { width: 70, fontSize: 12, color: '#475569', fontWeight: '500' },
  forecastEmoji: { fontSize: 22, width: 30 },
  forecastInfo: { flex: 1 },
  forecastDesc: { fontSize: 13, color: '#374151' },
  forecastTemp: { fontSize: 13, fontWeight: '600' },
})
