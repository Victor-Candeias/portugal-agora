import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { useFuelPrices } from '../../hooks/useApi'
import { DEFAULT_CITY_ID, useIpmaForecasts } from '../../hooks/useTempo'
import { useBdpRates } from '../../hooks/useEconomia'
import { useAnpcSummary } from '../../hooks/useAnpc'
import { SECTIONS } from '../../lib/sections'
import { formatPrice } from '@portugal-hoje/core'

// Os hrefs vêm de lib/sections.ts e coincidem com ficheiros em app/; as rotas tipadas não estão ativas.
const go = (href: string) => router.push(href as never)

function SummaryCard({
  emoji,
  title,
  value,
  subtitle,
  color = '#16a34a',
  href,
}: {
  emoji: string
  title: string
  value: string
  subtitle?: string
  color?: string
  href?: string
}) {
  return (
    <TouchableOpacity
      activeOpacity={href ? 0.7 : 1}
      disabled={!href}
      onPress={href ? () => go(href) : undefined}
      style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
    >
      <Text style={styles.cardEmoji}>{emoji}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  )
}

export default function Dashboard() {
  const { data: fuelData } = useFuelPrices('gasoline_95')
  const { data: weatherData } = useIpmaForecasts()
  const { data: anpcData } = useAnpcSummary()
  const { data: ratesData } = useBdpRates()

  const cheapest = fuelData?.[0]
  const today = weatherData?.find(c => c.cityId === DEFAULT_CITY_ID)?.forecasts[0]
  const activeIncidents = anpcData?.total_active ?? 0
  const topDistrict = anpcData?.by_district?.[0]
  const ecbDeposit = ratesData?.data.find(r => r.key === 'ecb_deposit')

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {activeIncidents > 0 && (
        <TouchableOpacity style={styles.alertBanner} activeOpacity={0.8} onPress={() => go('/protecao-civil')}>
          <Text style={styles.alertText}>
            ⚠️ {activeIncidents} {activeIncidents === 1 ? 'ocorrência ativa' : 'ocorrências ativas'}
            {topDistrict ? ` — mais em ${topDistrict.district} (${topDistrict.count})` : ''} ›
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.greeting}>Bom dia, Portugal 🇵🇹</Text>
      <Text style={styles.subGreeting}>Dados em tempo real · Lisboa</Text>

      <View style={styles.grid}>
        <SummaryCard
          emoji="⛽"
          title="Gasolina 95"
          value={cheapest ? formatPrice(cheapest.price_eur) : '—'}
          subtitle={cheapest?.Nome ?? 'A carregar...'}
          color="#16a34a"
        />
        <SummaryCard
          emoji="🌤️"
          title="Tempo"
          value={today ? `${today.tMax}°C` : '—'}
          subtitle={today ? `${today.description} · Lisboa` : 'A carregar...'}
          color="#0ea5e9"
          href="/tempo"
        />
        <SummaryCard
          emoji="🏦"
          title="Taxa BCE"
          value={ecbDeposit ? `${ecbDeposit.value.toFixed(2)}%` : '—'}
          subtitle="Facilidade de depósito"
          color="#6366f1"
          href="/economia"
        />
        <SummaryCard
          emoji="🔥"
          title="Ocorrências ANPC"
          value={!anpcData ? '—' : activeIncidents > 0 ? `${activeIncidents} ativas` : 'Sem ocorrências'}
          subtitle="Proteção Civil"
          color={activeIncidents > 0 ? '#ef4444' : '#16a34a'}
          href="/protecao-civil"
        />
      </View>

      <Text style={styles.sectionTitle}>Todas as secções</Text>
      <View style={styles.sections}>
        {SECTIONS.map(s => (
          <TouchableOpacity key={s.href} style={styles.section} activeOpacity={0.7} onPress={() => go(s.href)}>
            <View style={[styles.sectionIcon, { backgroundColor: `${s.color}1a` }]}>
              <Text style={styles.sectionEmoji}>{s.emoji}</Text>
            </View>
            <Text style={styles.sectionName} numberOfLines={1}>{s.title}</Text>
            <Text style={styles.sectionDesc} numberOfLines={1}>{s.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Estado dos dados</Text>
        {[
          { label: 'Combustível', ok: !!fuelData },
          { label: 'Meteorologia', ok: !!weatherData },
          { label: 'ANPC', ok: !!anpcData },
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  sections: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    width: '31%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  sectionEmoji: { fontSize: 20 },
  sectionName: { fontSize: 12, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
  sectionDesc: { fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 1 },
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
