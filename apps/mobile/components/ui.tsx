// Componentes partilhados pelos ecrãs (MOB-005), no mesmo estilo visual das tabs existentes
// (cartões brancos, verde #16a34a como cor da app, cinzentos slate).
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

export const COLORS = {
  primary: '#16a34a',
  link: '#2563eb',
  text: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#e2e8f0',
  background: '#f8fafc',
} as const

export function ScreenHeader({
  title,
  subtitle,
  onRefresh,
  refreshing,
}: {
  title: string
  subtitle?: string
  onRefresh?: () => void
  refreshing?: boolean
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} disabled={refreshing}>
          <Text style={styles.refreshText}>{refreshing ? 'A atualizar…' : 'Atualizar'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  )
}

export function Chip({
  label,
  selected,
  onPress,
  color = COLORS.primary,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  color?: string
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

/** Linha horizontal de chips com "Todos" (valor `null`) — substitui os `<select>` do web. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  allLabel = 'Todos',
  color,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
  allLabel?: string | null
  color?: string
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {allLabel !== null && <Chip label={allLabel} selected={value === null} onPress={() => onChange(null)} color={color} />}
      {options.map(o => (
        <Chip
          key={o.value}
          label={o.label}
          selected={value === o.value}
          onPress={() => onChange(value === o.value && allLabel !== null ? null : o.value)}
          color={color}
        />
      ))}
    </ScrollView>
  )
}

/** Separadores (tabs internas de um ecrã). */
export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.segmented}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t.value}
          onPress={() => onChange(t.value)}
          style={[styles.segment, value === t.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === t.value && styles.segmentTextActive]} numberOfLines={1}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export function SearchInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.faint}
      style={styles.input}
      autoCorrect={false}
      clearButtonMode="while-editing"
    />
  )
}

export function LoadingView({ color = COLORS.primary }: { color?: string }) {
  return <ActivityIndicator color={color} style={styles.loading} />
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Erro desconhecido.'
  return (
    <View style={styles.error}>
      <Text style={styles.errorTitle}>Não foi possível carregar os dados</Text>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.errorRetry}>Tentar novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>
}

export function Notice({ children }: { children: ReactNode }) {
  return <Text style={styles.notice}>{children}</Text>
}

export function Badge({ label, color, background }: { label: string; color: string; background: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={6}>
      <Text style={styles.link}>{label}</Text>
    </TouchableOpacity>
  )
}

/** Botão "Mostrar mais" para listas que crescem por páginas. */
export function ShowMore({ shown, total, onPress }: { shown: number; total: number; onPress: () => void }) {
  if (shown >= total) return null
  return (
    <TouchableOpacity onPress={onPress} style={styles.showMore}>
      <Text style={styles.showMoreText}>Mostrar mais ({total - shown} restantes)</Text>
    </TouchableOpacity>
  )
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

export const uiStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  map: { marginBottom: 12 },
  cardMap: { marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  label: { fontSize: 12, color: COLORS.muted },
  small: { fontSize: 12, color: COLORS.muted },
  strong: { fontSize: 14, fontWeight: '700', color: COLORS.text },
})

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  refreshBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { color: 'white', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: 'white', borderRadius: 10, padding: 14, marginBottom: 10, elevation: 2 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  chipRow: { gap: 8, paddingBottom: 10 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 240,
  },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '600' },
  chipTextSelected: { color: 'white' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: 'white', elevation: 1 },
  segmentText: { fontSize: 12, fontWeight: '600', color: COLORS.muted },
  segmentTextActive: { color: COLORS.text },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 10,
  },
  loading: { marginTop: 20, marginBottom: 20 },
  error: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 14, marginBottom: 10 },
  errorTitle: { color: '#991b1b', fontWeight: '700', fontSize: 13 },
  errorText: { color: '#b91c1c', fontSize: 12, marginTop: 4 },
  errorRetry: { color: COLORS.link, fontWeight: '600', fontSize: 12, marginTop: 8 },
  empty: { color: COLORS.faint, fontSize: 14, textAlign: 'center', marginTop: 24, marginBottom: 24 },
  notice: { color: '#b45309', backgroundColor: '#fffbeb', fontSize: 12, padding: 10, borderRadius: 8, marginBottom: 12 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', maxWidth: 200 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  link: { fontSize: 12, color: COLORS.link, fontWeight: '600' },
  showMore: { alignItems: 'center', paddingVertical: 12 },
  showMoreText: { color: COLORS.link, fontWeight: '600', fontSize: 13 },
})
