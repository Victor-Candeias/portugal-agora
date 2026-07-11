import { useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useFuelPrices } from '../../hooks/useApi'
import { formatPrice, FUEL_LABELS, FUEL_COLORS, type FuelType } from '@portugal-hoje/core'

const FUEL_TYPES: FuelType[] = ['gasoline_95', 'gasoline_98', 'diesel', 'diesel_plus', 'lpg']

export default function Combustivel() {
  const [fuelType, setFuelType] = useState<FuelType>('gasoline_95')
  const { data, isLoading, isError } = useFuelPrices(fuelType)

  const stations = data?.data ?? []
  const minPrice = stations[0]?.price_eur

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⛽ Preços de Combustível</Text>
      <Text style={styles.subtitle}>Dados DGEG · Atualização diária</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
        {FUEL_TYPES.map(ft => (
          <TouchableOpacity
            key={ft}
            onPress={() => setFuelType(ft)}
            style={[
              styles.typeBtn,
              fuelType === ft && { backgroundColor: FUEL_COLORS[ft] },
            ]}
          >
            <Text style={[styles.typeBtnText, fuelType === ft && { color: 'white' }]}>
              {FUEL_LABELS[ft]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {stations.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mais barato</Text>
            <Text style={[styles.statValue, { color: '#16a34a' }]}>{formatPrice(minPrice)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Encontrados</Text>
            <Text style={styles.statValue}>{stations.length}</Text>
          </View>
        </View>
      )}

      {isLoading && <ActivityIndicator color="#16a34a" style={{ marginTop: 32 }} />}
      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Erro ao carregar dados. Verifique a ligação.</Text>
        </View>
      )}

      {stations.map((s, i) => (
        <View key={`${s.station_id}-${i}`} style={styles.stationRow}>
          <View style={[styles.rank, { backgroundColor: i === 0 ? '#16a34a' : i < 3 ? '#65a30d' : '#94a3b8' }]}>
            <Text style={styles.rankText}>{i + 1}</Text>
          </View>
          <View style={styles.stationInfo}>
            <Text style={styles.stationName} numberOfLines={1}>{s.station_name}</Text>
            <Text style={styles.stationLocation}>📍 {s.municipality}, {s.district}</Text>
          </View>
          <View style={styles.priceBox}>
            <Text style={[styles.price, i === 0 && { color: '#16a34a' }]}>
              {formatPrice(s.price_eur)}
            </Text>
            {i > 0 && minPrice && (
              <Text style={styles.priceDiff}>+{formatPrice(s.price_eur - minPrice)}</Text>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: 2 },
  typeRow: { marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12 },
  errorText: { color: '#dc2626', fontSize: 14 },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: { color: 'white', fontWeight: '700', fontSize: 13 },
  stationInfo: { flex: 1 },
  stationName: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  stationLocation: { fontSize: 12, color: '#64748b', marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  priceDiff: { fontSize: 11, color: '#ef4444', marginTop: 1 },
})
