import { useEffect, useState } from 'react'
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from 'react-native'
import * as Location from 'expo-location'
import { useTourismPoints } from '../../hooks/useApi'

const CATEGORY_LABEL: Record<string, string> = {
  'health-wellness': 'Saúde e Bem-Estar',
  'accommodation': 'Alojamento',
  'nature': 'Natureza',
  'culture': 'Cultural',
  'beaches-golf': 'Praias e Golfe',
  'wine-tourism': 'Enoturismo',
}

// Coordenadas de Lisboa usadas como fallback caso a localização não seja concedida.
const FALLBACK_COORDS = { latitude: 38.716, longitude: -9.139 }

export default function Turismo() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'loading' | 'granted' | 'denied'>('loading')

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        setLocationStatus('denied')
        setCoords(FALLBACK_COORDS)
        return
      }
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setLocationStatus('granted')
      } catch {
        setLocationStatus('denied')
        setCoords(FALLBACK_COORDS)
      }
    })()
  }, [])

  const { data: points = [], isLoading, refetch } = useTourismPoints(coords?.latitude, coords?.longitude)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🏖️ Turismo</Text>
          <Text style={styles.subtitle}>
            SIGTUR · Turismo de Portugal · 25km {locationStatus === 'denied' ? '(perto de Lisboa)' : 'perto de ti'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {locationStatus === 'denied' && (
        <Text style={styles.notice}>Sem permissão de localização — a mostrar pontos perto de Lisboa.</Text>
      )}

      {(isLoading || locationStatus === 'loading') && <ActivityIndicator color="#7c3aed" style={{ marginTop: 20 }} />}

      {locationStatus !== 'loading' && !isLoading && points.length === 0 && (
        <Text style={styles.empty}>Sem pontos de interesse encontrados na zona.</Text>
      )}

      {points.map(point => (
        <View key={point.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.name} numberOfLines={2}>{point.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{CATEGORY_LABEL[point.category] ?? point.category}</Text>
            </View>
          </View>
          {point.address && <Text style={styles.address}>📍 {point.address}{point.municipality ? `, ${point.municipality}` : ''}</Text>}
          <View style={styles.actions}>
            {point.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${point.phone}`)}>
                <Text style={styles.actionText}>📞 {point.phone}</Text>
              </TouchableOpacity>
            )}
            {point.email && (
              <TouchableOpacity onPress={() => Linking.openURL(`mailto:${point.email}`)}>
                <Text style={styles.actionText}>✉️ Email</Text>
              </TouchableOpacity>
            )}
            {point.website && (
              <TouchableOpacity onPress={() => Linking.openURL(point.website!)}>
                <Text style={styles.actionText}>🌐 Site</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`)}
            >
              <Text style={styles.actionText}>🧭 Direções</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
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
  empty: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 24 },
  notice: { color: '#b45309', backgroundColor: '#fffbeb', fontSize: 12, padding: 10, borderRadius: 8, marginBottom: 12 },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 6 },
  name: { flex: 1, fontWeight: '700', fontSize: 14, color: '#0f172a' },
  badge: { backgroundColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { color: '#7c3aed', fontSize: 11, fontWeight: '700' },
  address: { fontSize: 12, color: '#64748b', marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  actionText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
})
