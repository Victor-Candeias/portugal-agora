import { StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../ui'

export function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  )
}

export function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <View style={styles.grid}>
      {items.map(([label, value]) => (
        <View key={label} style={styles.gridItem}>
          <View style={styles.gridInner}>
            <Text style={styles.gridLabel}>{label}</Text>
            <Text style={styles.gridValue}>{value || '—'}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}

/** Pastilha com o número/nome da carreira na cor da linha. */
export function LinePill({ label, color, textColor = 'white' }: { label: string; color: string; textColor?: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  )
}

export const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 },
  meta: { fontSize: 11, color: COLORS.faint },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: 'white', borderRadius: 10, paddingVertical: 10, alignItems: 'center', elevation: 2 },
  statLabel: { fontSize: 11, color: COLORS.muted },
  statValue: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  mapToggle: { marginBottom: 10 },
  details: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  gridItem: { width: '50%', padding: 3 },
  gridInner: { backgroundColor: COLORS.background, borderRadius: 8, padding: 8 },
  gridLabel: { fontSize: 10, fontWeight: '700', color: COLORS.faint, textTransform: 'uppercase' },
  gridValue: { fontSize: 13, fontWeight: '500', color: '#1e293b', marginTop: 2 },
  infoBox: { backgroundColor: '#eff6ff', borderRadius: 8, padding: 10 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#172554' },
  infoText: { fontSize: 13, color: '#172554', marginTop: 2 },
  infoMeta: { fontSize: 11, color: '#1d4ed8', marginTop: 2 },
  pill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
})
