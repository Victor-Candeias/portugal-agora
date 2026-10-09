import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { TmlAlert } from '@portugal-hoje/core'
import { useTmlAlerts } from '../../hooks/useTransportes'
import { SinglePointMap } from '../PointsMap'
import { Badge, Card, ChipRow, EmptyText, ErrorView, LinkText, LoadingView, uiStyles } from '../ui'
import { CAUSE_LABEL, EFFECT_LABEL, effectColors, formatDate } from './labels'
import { styles as shared } from './shared'

export function AlertasTmlTab() {
  const { data: alerts = [], isLoading, isError, error, refetch, isFetching } = useTmlAlerts()
  const [effect, setEffect] = useState<string | null>(null)

  const effects = useMemo(() => [...new Set(alerts.map(a => a.effect))].sort(), [alerts])
  const filtered = useMemo(() => (effect ? alerts.filter(a => a.effect === effect) : alerts), [alerts, effect])

  if (isLoading) return <LoadingView color="#2563eb" />
  if (isError) return <ErrorView error={error} onRetry={() => refetch()} />

  return (
    <View>
      <View style={shared.metaRow}>
        <Text style={shared.meta}>{filtered.length} alertas ativos · TML Lisboa/Setúbal</Text>
        <LinkText label={isFetching ? 'A atualizar…' : '↻ Atualizar'} onPress={() => refetch()} />
      </View>
      <ChipRow
        options={effects.map(e => ({ value: e, label: EFFECT_LABEL[e] ?? e }))}
        value={effect}
        onChange={setEffect}
        color="#1e293b"
      />
      {filtered.map(a => (
        <TmlAlertCard key={a._id} alert={a} />
      ))}
      {filtered.length === 0 && <EmptyText>Sem alertas ativos.</EmptyText>}
    </View>
  )
}

function TmlAlertCard({ alert: a }: { alert: TmlAlert }) {
  const [showMap, setShowMap] = useState(false)
  return (
    <Card>
      <View style={styles.header}>
        <Text style={[uiStyles.strong, styles.flex]}>{a.title}</Text>
        <Badge label={EFFECT_LABEL[a.effect] ?? a.effect} {...effectColors(a.effect)} />
      </View>
      {a.description ? <Text style={styles.description}>{a.description}</Text> : null}
      <View style={uiStyles.actions}>
        <Text style={shared.meta}>{CAUSE_LABEL[a.cause] ?? a.cause}</Text>
        <Text style={shared.meta}>
          🕒 {formatDate(a.active_period_start_date)} – {formatDate(a.active_period_end_date)}
        </Text>
        {a.coordinates && <LinkText label={showMap ? 'Ocultar mapa' : '🗺️ Mapa'} onPress={() => setShowMap(v => !v)} />}
      </View>
      {showMap && a.coordinates && (
        <SinglePointMap latitude={a.coordinates[0]} longitude={a.coordinates[1]} label={a.title} style={uiStyles.cardMap} />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  description: { fontSize: 12, color: '#64748b', lineHeight: 17 },
})
