import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  FIRE_RISK_COLORS,
  FIRE_RISK_LABELS,
  formatAnpcWarningDate,
  formatDate,
  type AnpcIncident,
} from '@portugal-hoje/core'
import { useAnpcIncidents, useAnpcSummary, useAnpcWarnings, useFireRisk } from '../hooks/useAnpc'
import { PointsMap, SinglePointMap, type MapPoint } from '../components/PointsMap'
import {
  Badge,
  Card,
  Chip,
  ChipRow,
  EmptyText,
  ErrorView,
  LinkText,
  LoadingView,
  SectionTitle,
  ScreenHeader,
  ShowMore,
  uiStyles,
} from '../components/ui'

const PAGE_SIZE = 20
const WARNINGS_STEP = 5

const TYPE_EMOJI: Record<string, string> = {
  'Mato': '🔥',
  'Povoamento Florestal': '🌲',
  'Agrícola': '🌾',
  'Urbano ou Industrial': '🏭',
  'Habitação': '🏠',
  'Veículos': '🚗',
  'Outros': '⚠️',
}

const getEmoji = (type: string) => TYPE_EMOJI[type] ?? '🚒'

function statusColors(status: string): { color: string; background: string } {
  if (status.includes('Conclusão')) return { color: '#475569', background: '#f1f5f9' }
  if (status.includes('3º')) return { color: '#991b1b', background: '#fee2e2' }
  if (status.includes('2º')) return { color: '#9a3412', background: '#ffedd5' }
  if (status.includes('1º')) return { color: '#854d0e', background: '#fef9c3' }
  if (status.includes('Em Curso')) return { color: '#b91c1c', background: '#fee2e2' }
  return { color: '#475569', background: '#f1f5f9' }
}

const isConcluded = (inc: AnpcIncident) => inc.status.includes('Conclusão')

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export default function ProtecaoCivil() {
  const incidents = useAnpcIncidents()
  const summary = useAnpcSummary()
  const fireRisk = useFireRisk()
  const warnings = useAnpcWarnings()

  const [district, setDistrict] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [showConcluded, setShowConcluded] = useState(false)
  const [shown, setShown] = useState(PAGE_SIZE)
  const [showOverviewMap, setShowOverviewMap] = useState(false)

  const all = useMemo(() => incidents.data?.data ?? [], [incidents.data])
  const active = useMemo(() => all.filter(inc => !isConcluded(inc)), [all])
  const concludedCount = all.length - active.length

  const visible = useMemo(
    () =>
      (showConcluded ? all : active)
        .filter(inc => !district || inc.location.district === district)
        .filter(inc => !type || inc.type === type),
    [all, active, showConcluded, district, type],
  )

  const mapPoints = useMemo<MapPoint[]>(
    () =>
      visible
        .filter(inc => inc.location.lat && inc.location.lng)
        .map(inc => ({
          id: inc.id,
          latitude: inc.location.lat,
          longitude: inc.location.lng,
          label: `${getEmoji(inc.type)} ${inc.type}`,
          description: inc.location.address,
        })),
    [visible],
  )

  const asOfIso = summary.data?.as_of ?? incidents.data?.as_of
  const asOf = asOfIso ? ` · atualizado às ${formatTime(asOfIso)}` : ''

  function resetPaging() {
    setShown(PAGE_SIZE)
  }

  const listTitle = district
    ? `${visible.length} ocorrência${visible.length !== 1 ? 's' : ''} em ${district}`
    : type
      ? `${visible.length} ocorrência${visible.length !== 1 ? 's' : ''} · ${type}`
      : showConcluded
        ? `${visible.length} ocorrências (incluindo concluídas)`
        : `${active.length} ocorrências ativas agora`

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="🔥 Proteção Civil"
        subtitle={`Ocorrências ANPC em tempo real${asOf}`}
        onRefresh={() => {
          void incidents.refetch()
          void summary.refetch()
          void fireRisk.refetch()
          void warnings.refetch()
        }}
        refreshing={incidents.isFetching}
      />

      {incidents.isLoading && <LoadingView color="#ea580c" />}
      {incidents.isError && <ErrorView error={incidents.error} onRetry={() => incidents.refetch()} />}

      {incidents.isSuccess && (
        <Card style={active.length > 0 ? styles.bannerActive : styles.bannerCalm}>
          <View style={uiStyles.row}>
            <Text style={styles.bannerEmoji}>{active.length > 0 ? '🚒' : '✅'}</Text>
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>
                {active.length > 0
                  ? `${active.length} ocorrência${active.length > 1 ? 's' : ''} ativa${active.length > 1 ? 's' : ''}`
                  : 'Sem ocorrências ativas'}
              </Text>
              <Text style={uiStyles.small}>
                {active.length > 0 ? 'Consulte a lista abaixo.' : 'Situação normal em todo o país.'}
              </Text>
            </View>
          </View>
          {concludedCount > 0 && (
            <View style={styles.bannerAction}>
              <Chip
                label={`${showConcluded ? '✓ ' : ''}${concludedCount} concluída${concludedCount > 1 ? 's' : ''}`}
                selected={showConcluded}
                onPress={() => {
                  setShowConcluded(v => !v)
                  resetPaging()
                }}
                color="#475569"
              />
            </View>
          )}
        </Card>
      )}

      <FireRiskCard query={fireRisk} />

      <WarningsCard query={warnings} />

      {(summary.data?.by_district?.length ?? 0) > 0 && (
        <Card>
          <SectionTitle>Ocorrências por distrito</SectionTitle>
          <ChipRow
            options={summary.data!.by_district.map(d => ({ value: d.district, label: `${d.district} · ${d.count}` }))}
            value={district}
            onChange={v => {
              setDistrict(v)
              setType(null)
              resetPaging()
            }}
            color="#ea580c"
          />
        </Card>
      )}

      {(summary.data?.by_type?.length ?? 0) > 0 && (
        <Card>
          <SectionTitle>Por tipo de ocorrência</SectionTitle>
          <ChipRow
            options={summary.data!.by_type.map(t => ({ value: t.type, label: `${getEmoji(t.type)} ${t.type} · ${t.count}` }))}
            value={type}
            onChange={v => {
              setType(v)
              setDistrict(null)
              resetPaging()
            }}
            color="#334155"
          />
        </Card>
      )}

      {all.length > 0 && (
        <Card>
          <SectionTitle
            action={
              mapPoints.length > 0 ? (
                <LinkText
                  label={showOverviewMap ? 'Ocultar mapa' : '🗺️ Ver no mapa'}
                  onPress={() => setShowOverviewMap(v => !v)}
                />
              ) : undefined
            }
          >
            {listTitle}
          </SectionTitle>
          {showOverviewMap && <PointsMap points={mapPoints} height={280} style={uiStyles.map} />}
          {visible.length === 0 && <EmptyText>Sem ocorrências com estes filtros.</EmptyText>}
          {visible.slice(0, shown).map(inc => (
            <IncidentRow key={inc.id} incident={inc} />
          ))}
          <ShowMore shown={shown} total={visible.length} onPress={() => setShown(s => s + PAGE_SIZE)} />
        </Card>
      )}
    </ScrollView>
  )
}

function FireRiskCard({ query }: { query: ReturnType<typeof useFireRisk> }) {
  const risks = useMemo(
    () => [...(query.data?.data ?? [])].sort((a, b) => a.district.localeCompare(b.district, 'pt')),
    [query.data],
  )
  return (
    <Card>
      <SectionTitle>🌡️ Risco de incêndio por distrito</SectionTitle>
      {query.data?.date && (
        <Text style={[uiStyles.small, styles.riskSource]}>
          IPMA · {formatDate(query.data.date)} · nível máximo dos concelhos de cada distrito
        </Text>
      )}
      {query.isLoading && <LoadingView color="#ea580c" />}
      {query.isError && <ErrorView error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && risks.length === 0 && <Text style={uiStyles.small}>Sem dados de risco para hoje.</Text>}
      {risks.length > 0 && (
        <View style={styles.riskGrid}>
          {risks.map(r => (
            <View key={r.district} style={styles.riskItem}>
              <View style={[styles.riskDot, { backgroundColor: FIRE_RISK_COLORS[r.level] }]} />
              <Text style={styles.riskDistrict} numberOfLines={1}>{r.district}</Text>
              <Text style={[styles.riskLevel, { color: FIRE_RISK_COLORS[r.level] }]}>
                {FIRE_RISK_LABELS[r.level]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  )
}

// Comunicados da ANPC via API Aberta (WEB-026), do mais recente para o mais antigo.
function WarningsCard({ query }: { query: ReturnType<typeof useAnpcWarnings> }) {
  const [shown, setShown] = useState(WARNINGS_STEP)
  const items = query.data?.data ?? []
  return (
    <Card>
      <SectionTitle>📢 Comunicados da Proteção Civil</SectionTitle>
      {query.isLoading && <LoadingView color="#ea580c" />}
      {query.isError && <ErrorView error={query.error} onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && <EmptyText>Sem comunicados.</EmptyText>}
      {items.slice(0, shown).map(w => (
        <View key={w.id} style={styles.warning}>
          <Text style={uiStyles.small}>🕒 {formatAnpcWarningDate(w)}</Text>
          <Text style={styles.warningText}>{w.text}</Text>
        </View>
      ))}
      <ShowMore shown={shown} total={items.length} onPress={() => setShown(s => s + WARNINGS_STEP)} />
      <Text style={[uiStyles.small, styles.warningSource]}>Fonte: ANEPC via fogos.pt (API Aberta)</Text>
    </Card>
  )
}

function IncidentRow({ incident: inc }: { incident: AnpcIncident }) {
  const [showMap, setShowMap] = useState(false)
  const colors = statusColors(inc.status)
  const hasCoords = Boolean(inc.location.lat && inc.location.lng)
  return (
    <View style={styles.incident}>
      <View style={styles.incidentRow}>
        <Text style={styles.incidentEmoji}>{getEmoji(inc.type)}</Text>
        <View style={styles.flex}>
          <View style={styles.incidentTitleRow}>
            <Text style={uiStyles.strong}>{inc.type}</Text>
            <Badge label={inc.status} {...colors} />
          </View>
          <Text style={uiStyles.small}>📍 {inc.location.address}</Text>
          <View style={styles.resources}>
            <Text style={uiStyles.small}>🕒 {formatTime(inc.datetime)}</Text>
            {inc.resources.ground > 0 && <Text style={uiStyles.small}>🚒 {inc.resources.ground} terrestres</Text>}
            {inc.resources.aerial > 0 && <Text style={uiStyles.small}>🚁 {inc.resources.aerial} aéreos</Text>}
            {inc.resources.water > 0 && <Text style={uiStyles.small}>💧 {inc.resources.water} água</Text>}
          </View>
          {hasCoords && (
            <View style={uiStyles.actions}>
              <LinkText label={showMap ? 'Ocultar mapa' : '🗺️ Ver mapa'} onPress={() => setShowMap(v => !v)} />
            </View>
          )}
        </View>
      </View>
      {showMap && (
        <SinglePointMap
          latitude={inc.location.lat}
          longitude={inc.location.lng}
          label={`${inc.type} · ${inc.location.address}`}
          style={uiStyles.cardMap}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bannerActive: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fdba74' },
  bannerCalm: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac' },
  bannerEmoji: { fontSize: 32 },
  bannerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  bannerAction: { marginTop: 10, flexDirection: 'row' },
  riskGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  riskSource: { marginBottom: 8 },
  riskItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  riskDistrict: { flex: 1, fontSize: 12, color: '#334155' },
  riskLevel: { fontSize: 11, fontWeight: '700' },
  warning: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  warningText: { fontSize: 13, color: '#334155', marginTop: 4, lineHeight: 18 },
  warningSource: { marginTop: 8, color: '#94a3b8' },
  incident: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  incidentRow: { flexDirection: 'row', gap: 10 },
  incidentEmoji: { fontSize: 22 },
  incidentTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 },
  resources: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
})
