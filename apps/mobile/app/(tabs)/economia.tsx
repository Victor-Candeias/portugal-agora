import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useEconomicIndicators, useInterestRates } from '../../hooks/useApi'

export default function Economia() {
  const { data: indData, isLoading: indLoading } = useEconomicIndicators()
  const { data: ratesData, isLoading: ratesLoading } = useInterestRates()

  const indicators = indData?.data ?? []
  const rates = ratesData?.data ?? []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>📊 Economia</Text>
      <Text style={styles.subtitle}>INE · Banco de Portugal</Text>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Taxas de Juro</Text>
      </View>
      {ratesLoading && <ActivityIndicator color="#f59e0b" />}
      <View style={styles.grid}>
        {rates.map(rate => (
          <View key={rate.type} style={styles.rateCard}>
            <Text style={styles.rateType}>{rate.type.replace(/_/g, ' ').toUpperCase()}</Text>
            <Text style={styles.rateValue}>{rate.rate.toFixed(2)}%</Text>
            <Text style={styles.ratePeriod}>{rate.period}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Indicadores INE</Text>
      </View>
      {indLoading && <ActivityIndicator color="#f59e0b" />}
      {indicators.map(ind => (
        <View key={ind.id} style={styles.indicatorRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.indicatorName}>{ind.name}</Text>
            <Text style={styles.indicatorPeriod}>{ind.period}</Text>
          </View>
          <Text style={styles.indicatorValue}>
            {ind.unit === '%' ? `${ind.value}%` : `${ind.value.toLocaleString('pt-PT')} ${ind.unit}`}
          </Text>
        </View>
      ))}

      {indicators.length === 0 && !indLoading && (
        <Text style={styles.empty}>Dados não disponíveis</Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: 2 },
  sectionHeader: { marginTop: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  rateCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    width: '47%',
    elevation: 2,
  },
  rateType: { fontSize: 10, color: '#64748b', fontWeight: '700', letterSpacing: 0.5 },
  rateValue: { fontSize: 24, fontWeight: '700', color: '#f59e0b', marginVertical: 4 },
  ratePeriod: { fontSize: 11, color: '#94a3b8' },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    elevation: 1,
  },
  indicatorName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  indicatorPeriod: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  indicatorValue: { fontSize: 18, fontWeight: '700', color: '#374151' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontSize: 14 },
})
