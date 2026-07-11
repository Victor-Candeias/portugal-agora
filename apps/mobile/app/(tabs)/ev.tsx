import { ScrollView, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useEvStations } from '../../hooks/useApi'
import type { EvStation } from '@portugal-hoje/core'

export default function EV() {
  const { data, isLoading, refetch } = useEvStations(38.716, -9.139)
  const stations = data?.data ?? []
  const available = stations.filter(s => s.connectors.some(c => c.status === 'available')).length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>⚡ Carregamento EV</Text>
          <Text style={styles.subtitle}>Rede MOBI.E · Lisboa 5km</Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>{stations.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Livres</Text>
          <Text style={[styles.statValue, { color: '#16a34a' }]}>{available}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Ocupados</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>{stations.length - available}</Text>
        </View>
      </View>

      {isLoading && <ActivityIndicator color="#7c3aed" style={{ marginTop: 20 }} />}

      {stations.map(station => {
        const hasAvailable = station.connectors.some(c => c.status === 'available')
        const availCount = station.connectors.filter(c => c.status === 'available').length
        return (
          <View
            key={station.id}
            style={[styles.stationCard, { borderLeftColor: hasAvailable ? '#16a34a' : '#ef4444', borderLeftWidth: 4 }]}
          >
            <View style={styles.stationHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stationName} numberOfLines={1}>{station.name}</Text>
                {station.operator && <Text style={styles.operator}>{station.operator}</Text>}
                <Text style={styles.address} numberOfLines={2}>📍 {station.address}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: hasAvailable ? '#16a34a' : '#ef4444' }]}>
                <Text style={styles.badgeText}>
                  {hasAvailable ? `${availCount} livre${availCount > 1 ? 's' : ''}` : 'Ocupado'}
                </Text>
              </View>
            </View>
            <View style={styles.connectors}>
              {station.connectors.map((c, i) => (
                <View key={i} style={styles.connector}>
                  <View style={[styles.connectorDot, {
                    backgroundColor: c.status === 'available' ? '#22c55e' : c.status === 'occupied' ? '#ef4444' : '#94a3b8'
                  }]} />
                  <Text style={styles.connectorText}>{c.type} {c.power_kw}kW</Text>
                </View>
              ))}
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  refreshBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { color: 'white', fontWeight: '600', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  stationCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  stationHeader: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  stationName: { fontWeight: '700', fontSize: 14, color: '#0f172a' },
  operator: { fontSize: 12, color: '#7c3aed', marginTop: 2 },
  address: { fontSize: 12, color: '#64748b', marginTop: 3 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  connectors: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  connector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectorDot: { width: 8, height: 8, borderRadius: 4 },
  connectorText: { fontSize: 12, color: '#374151', fontWeight: '500' },
})
