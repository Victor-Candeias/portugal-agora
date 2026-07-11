import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useWeatherForecast, useWeatherObservation } from '../../hooks/useApi'
import { formatDate } from '@portugal-hoje/core'

const DEFAULT_MUN = '1110600'

function getEmoji(desc: string): string {
  const d = desc.toLowerCase()
  if (d.includes('sol')) return '☀️'
  if (d.includes('chuva')) return '🌧️'
  if (d.includes('nublado')) return '☁️'
  if (d.includes('trovoada')) return '⛈️'
  return '🌤️'
}

export default function Tempo() {
  const { data: forecastData, isLoading } = useWeatherForecast(DEFAULT_MUN)
  const { data: obsData } = useWeatherObservation(38.716, -9.139)

  const forecasts = forecastData?.data ?? []
  const obs = obsData?.data

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🌤️ Meteorologia</Text>
      <Text style={styles.subtitle}>Previsões IPMA · Lisboa</Text>

      {obs && (
        <View style={styles.currentCard}>
          <Text style={styles.currentLabel}>Agora · {obs.station}</Text>
          <Text style={styles.currentTemp}>{obs.temperature}°C</Text>
          <View style={styles.currentDetails}>
            <Text style={styles.currentDetail}>💧 {obs.humidity}%</Text>
            <Text style={styles.currentDetail}>💨 {obs.wind_speed} km/h</Text>
            <Text style={styles.currentDetail}>🌧️ {obs.precipitation} mm</Text>
          </View>
        </View>
      )}

      {isLoading && <ActivityIndicator color="#0ea5e9" style={{ marginTop: 20 }} />}

      {forecasts.length > 0 && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysRow}>
            {forecasts.map(f => (
              <View key={f.date} style={styles.dayCard}>
                <Text style={styles.dayDate}>{formatDate(f.date)}</Text>
                <Text style={styles.dayEmoji}>{getEmoji(f.description)}</Text>
                <Text style={styles.dayMax}>{f.temp_max}°</Text>
                <Text style={styles.dayMin}>{f.temp_min}°</Text>
                <Text style={styles.dayRain}>💧{f.precipitation_prob}%</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.card}>
            {forecasts.map(f => (
              <View key={f.date} style={styles.forecastRow}>
                <Text style={styles.forecastDate}>{formatDate(f.date)}</Text>
                <Text style={styles.forecastEmoji}>{getEmoji(f.description)}</Text>
                <Text style={styles.forecastDesc} numberOfLines={1}>{f.description}</Text>
                <Text style={styles.forecastTemp}>
                  <Text style={{ color: '#f97316' }}>{f.temp_max}°</Text>
                  {'  '}
                  <Text style={{ color: '#0ea5e9' }}>{f.temp_min}°</Text>
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: 2 },
  currentCard: {
    backgroundColor: '#0ea5e9',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  currentLabel: { color: '#bae6fd', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  currentTemp: { color: 'white', fontSize: 56, fontWeight: '700' },
  currentDetails: { flexDirection: 'row', gap: 16, marginTop: 8 },
  currentDetail: { color: '#e0f2fe', fontSize: 14 },
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
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  forecastDate: { width: 60, fontSize: 12, color: '#475569', fontWeight: '500' },
  forecastEmoji: { fontSize: 22, width: 30 },
  forecastDesc: { flex: 1, fontSize: 13, color: '#374151' },
  forecastTemp: { fontSize: 13, fontWeight: '600' },
})
