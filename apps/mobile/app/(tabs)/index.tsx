import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useFuelPrices } from '../../hooks/useApi'
import { useWeatherForecast } from '../../hooks/useApi'
import { useCivilProtectionAlerts } from '../../hooks/useApi'
import { useInterestRates } from '../../hooks/useApi'
import { formatPrice } from '@portugal-hoje/core'

function SummaryCard({
  emoji,
  title,
  value,
  subtitle,
  color = '#16a34a',
}: {
  emoji: string
  title: string
  value: string
  subtitle?: string
  color?: string
}) {
  return (
    <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}>
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </View>
  )
}

export default function Dashboard() {
  const { data: fuelData } = useFuelPrices('gasoline_95')
  const { data: weatherData } = useWeatherForecast('1110600')
  const { data: alertsData } = useCivilProtectionAlerts()
  const { data: ratesData } = useInterestRates()

  const cheapest = fuelData?.data[0]
  const today = weatherData?.data[0]
  const alerts = alertsData?.data ?? []
  const euribor = ratesData?.data.find(r => r.type.includes('3m') || r.type.includes('3M'))

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {alerts.some(a => a.severity === 'high' || a.severity === 'extreme') && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>
            ⚠️ {alerts[0].title} — {alerts[0].district}
          </Text>
        </View>
      )}

      <Text style={styles.greeting}>Bom dia, Portugal 🇵🇹</Text>
      <Text style={styles.subGreeting}>Dados em tempo real · Lisboa</Text>

      <View style={styles.grid}>
        <SummaryCard
          emoji="⛽"
          title="Gasolina 95"
          value={cheapest ? formatPrice(cheapest.price_eur) : '—'}
          subtitle={cheapest?.station_name ?? 'A carregar...'}
          color="#16a34a"
        />
        <SummaryCard
          emoji="🌤️"
          title="Tempo"
          value={today ? `${today.temp_max}°C` : '—'}
          subtitle={today?.description ?? 'A carregar...'}
          color="#0ea5e9"
        />
        <SummaryCard
          emoji="⚡"
          title="Euribor 3M"
          value={euribor ? `${euribor.rate.toFixed(2)}%` : '—'}
          subtitle="Banco de Portugal"
          color="#f59e0b"
        />
        <SummaryCard
          emoji="🔥"
          title="Alertas ANPC"
          value={alerts.length > 0 ? `${alerts.length} alertas` : 'Sem alertas'}
          color={alerts.length > 0 ? '#ef4444' : '#16a34a'}
        />
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Estado dos dados</Text>
        {[
          { label: 'Combustível', ok: !!fuelData },
          { label: 'Meteorologia', ok: !!weatherData },
          { label: 'ANPC', ok: !!alertsData },
          { label: 'Banco de Portugal', ok: !!ratesData },
        ].map(({ label, ok }) => (
          <View key={label} style={styles.statusRow}>
            <Text>{ok ? '✅' : '⏳'}</Text>
            <Text style={styles.statusLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  alertBanner: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  alertText: { color: 'white', fontWeight: '600', fontSize: 14 },
  greeting: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subGreeting: { fontSize: 13, color: '#64748b', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 14,
    width: '47%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardEmoji: { fontSize: 24, marginBottom: 6 },
  cardTitle: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  cardSubtitle: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusTitle: { fontWeight: '600', color: '#374151', marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusLabel: { color: '#374151', fontSize: 14 },
})
