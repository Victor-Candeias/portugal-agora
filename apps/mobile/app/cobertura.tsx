import { useEffect, useRef, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import {
  ANACOM_5G_NOTICE,
  ANACOM_AGGREGATE,
  ANACOM_ATTRIBUTION,
  ANACOM_COVERAGE_DISCLAIMER,
  ANACOM_COVERAGE_LAYERS,
  ANACOM_MAP_URL,
  COVERAGE_LEGEND,
  COVERAGE_STATUS_LABELS,
  MOBILE_OPERATORS,
  MOBILE_TECHNOLOGIES,
  MOBILE_TECHNOLOGY_LABELS,
  formatReferenceQuarter,
  type CoverageStatus,
  type CoverageSubject,
  type MobileCoverageResult,
  type MobileTechnology,
  type OperatorCoverage,
  type RankedOperator,
} from '@portugal-hoje/core'
import { useCoverageCatalog, useMobileCoverage } from '../hooks/useCoverage'
import { LISBON_COORDS, useUserLocation } from '../hooks/useUserLocation'
import { CoverageMap } from '../components/CoverageMap'
import { Card, ChipRow, COLORS, ErrorView, LoadingView, Notice, ScreenHeader, SectionTitle, uiStyles } from '../components/ui'

const ACCENT = '#0891b2'

interface SelectedPoint {
  lat: number
  lon: number
  label: string
}

// Cada estado tem ícone e texto próprios: a informação não depende só da cor (como no web).
const STATUS_STYLE: Record<CoverageStatus, { icon: string; color: string; background: string }> = {
  covered: { icon: '✅', color: '#166534', background: '#dcfce7' },
  not_covered: { icon: '🚫', color: '#991b1b', background: '#fee2e2' },
  unknown: { icon: '❔', color: '#334155', background: '#f1f5f9' },
  source_unavailable: { icon: '⚠️', color: '#92400e', background: '#fef3c7' },
}

const MAP_SUBJECTS: CoverageSubject[] = [ANACOM_AGGREGATE, ...MOBILE_OPERATORS]
const OPACITIES = [0.4, 0.55, 0.7, 0.85, 1]

function subjectLabel(subject: CoverageSubject): string {
  return subject === ANACOM_AGGREGATE ? 'Melhor entre operadoras (Global PT)' : subject
}

function StatusBadge({ status }: { status: CoverageStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <View style={[styles.badge, { backgroundColor: s.background }]}>
      <Text style={[styles.badgeText, { color: s.color }]}>
        {s.icon} {COVERAGE_STATUS_LABELS[status]}
      </Text>
    </View>
  )
}

function CoverageClassView({ row, provisional }: { row: OperatorCoverage; provisional: boolean }) {
  if (!row.coverageClass) return <Text style={styles.noClass}>—</Text>
  return (
    <View style={uiStyles.row}>
      <View style={[styles.swatch, { backgroundColor: row.coverageClass.color }]} />
      <Text style={styles.classLabel}>{row.coverageClass.label}</Text>
      {provisional && <Text style={styles.provisional}>PROVISÓRIO</Text>}
    </View>
  )
}

function CoverageResults({
  data,
  point,
  onRetry,
  retrying,
}: {
  data: MobileCoverageResult
  point: SelectedPoint
  onRetry: () => void
  retrying: boolean
}) {
  const reference = formatReferenceQuarter(data.referenceQuarter)
  const sourceDown = [data.aggregate, ...data.operators].some(o => o.status === 'source_unavailable')
  const rows: Array<OperatorCoverage | RankedOperator> = data.ranking ?? data.operators
  const techLabel = MOBILE_TECHNOLOGY_LABELS[data.technology]
  const classTitle = data.technology === '2G' ? 'Qualidade (voz)' : 'Classe potencial'
  const source = `Fonte: ANACOM${reference ? ` · dados do ${reference}` : ''}`

  return (
    <View>
      <Text style={styles.pointText}>
        📍 {point.label} · {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
      </Text>

      {data.outsideCoverageArea && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            ❔ Este ponto está fora da área com dados da ANACOM (Portugal continental, Açores e Madeira).
          </Text>
        </View>
      )}

      {sourceDown && (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            ⚠️ A ANACOM não respondeu a tempo. Os dados deste ponto não estão disponíveis de momento.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRetry} disabled={retrying}>
            <Text style={styles.retryText}>{retrying ? 'A tentar…' : '↻ Tentar de novo'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!data.outsideCoverageArea && !sourceDown && (
        <View style={styles.aggregate}>
          <Text style={styles.aggregateTitle}>{techLabel.toUpperCase()} · MELHOR ENTRE OPERADORAS</Text>
          <View style={styles.aggregateRow}>
            <StatusBadge status={data.aggregate.status} />
            <CoverageClassView row={data.aggregate} provisional={data.provisional} />
          </View>
        </View>
      )}

      {rows.map(row => {
        const ranked = 'position' in row ? row : null
        return (
          <View key={row.operator} style={styles.operatorCard}>
            <View style={styles.operatorHeader}>
              <Text style={styles.operatorName}>{row.operator}</Text>
              {ranked && (
                <Text style={styles.position}>
                  {ranked.position}.º{ranked.tied ? ' (empate)' : ''}
                </Text>
              )}
            </View>
            <StatusBadge status={row.status} />
            <Text style={[uiStyles.label, styles.classTitle]}>{classTitle}</Text>
            <CoverageClassView row={row} provisional={data.provisional} />
            <Text style={styles.operatorSource}>{source}</Text>
          </View>
        )
      })}

      {!data.ranking && !data.outsideCoverageArea && !sourceDown && (
        <Text style={uiStyles.small}>Sem ordenação: há operadoras sem dados neste ponto, por isso não se compara.</Text>
      )}

      <Text style={styles.caption}>
        Classe de velocidade potencial (máxima de download prevista), não velocidade medida.
      </Text>
    </View>
  )
}

export default function Cobertura() {
  const location = useUserLocation(LISBON_COORDS)
  const [technology, setTechnology] = useState<MobileTechnology>('4G')
  const [manualPoint, setManualPoint] = useState<SelectedPoint | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [mapSubject, setMapSubject] = useState<CoverageSubject>(ANACOM_AGGREGATE)
  const [opacity, setOpacity] = useState(0.7)

  const manualRef = useRef(manualPoint)
  manualRef.current = manualPoint
  // Só um pedido feito pelo botão substitui o ponto escolhido à mão (e só se a permissão for dada).
  const fromButtonRef = useRef(false)

  useEffect(() => {
    if (location.status === 'loading' || !location.coords) return
    const fromButton = fromButtonRef.current
    fromButtonRef.current = false
    if (fromButton && location.status === 'granted') {
      setManualPoint(null)
      setFocusKey(k => k + 1)
    } else if (!manualRef.current) {
      setFocusKey(k => k + 1)
    }
  }, [location.status, location.coords])

  const autoPoint: SelectedPoint | null = location.coords
    ? {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
        label: location.status === 'granted' ? 'A sua localização' : 'Lisboa (por omissão)',
      }
    : null
  const point = manualPoint ?? autoPoint

  const coverage = useMobileCoverage(technology, point)
  const catalog = useCoverageCatalog()
  const catalogIssues = catalog.data && !catalog.data.ok ? catalog.data.issues : []
  const legend = COVERAGE_LEGEND[technology]

  function requestMyLocation() {
    fromButtonRef.current = true
    void location.request()
  }

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="📶 Cobertura móvel"
        subtitle="Qual é a melhor cobertura móvel neste local? Dados oficiais da ANACOM, por operadora."
      />

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>ℹ️ {ANACOM_COVERAGE_DISCLAIMER}</Text>
        {technology === '5G' && <Text style={styles.disclaimerText}>🧪 {ANACOM_5G_NOTICE}</Text>}
        <TouchableOpacity onPress={() => Linking.openURL(ANACOM_MAP_URL)}>
          <Text style={styles.disclaimerLink}>{ANACOM_ATTRIBUTION} · mapa oficial em geo.anacom.pt</Text>
        </TouchableOpacity>
      </View>

      {catalogIssues.length > 0 && (
        <Notice>
          ⚠️ O catálogo de camadas da ANACOM mudou e alguns resultados podem estar errados:{' '}
          {catalogIssues.map(i => `${subjectLabel(i.operator)} ${i.technology} (camada ${i.layerId})`).join(', ')}.
        </Notice>
      )}

      <Card>
        <SectionTitle>Local</SectionTitle>
        <Text style={uiStyles.small}>
          {location.status === 'loading' && 'A obter a localização…'}
          {location.status === 'granted' &&
            (manualPoint ? 'A mostrar o ponto escolhido no mapa.' : 'A usar a sua localização.')}
          {location.status === 'denied' &&
            (manualPoint
              ? 'Localização não autorizada. A mostrar o ponto escolhido no mapa.'
              : 'Localização não autorizada ou indisponível. A usar Lisboa; toque no mapa para escolher outro ponto.')}
        </Text>
        <TouchableOpacity
          style={[styles.locationBtn, location.status === 'loading' && styles.disabled]}
          onPress={requestMyLocation}
          disabled={location.status === 'loading'}
        >
          <Text style={styles.locationBtnText}>🧭 Usar a minha localização</Text>
        </TouchableOpacity>
        <Text style={[uiStyles.small, styles.hint]}>
          A localização serve apenas para consultar a ANACOM. Também pode tocar no mapa para escolher um ponto.
        </Text>
      </Card>

      <Card>
        <SectionTitle>Tecnologia</SectionTitle>
        <ChipRow
          options={MOBILE_TECHNOLOGIES.map(t => ({ value: t, label: MOBILE_TECHNOLOGY_LABELS[t] }))}
          value={technology}
          onChange={v => v && setTechnology(v)}
          allLabel={null}
          color={ACCENT}
        />

        <Text style={uiStyles.label}>Camada do mapa ({MOBILE_TECHNOLOGY_LABELS[technology]})</Text>
        <ChipRow
          options={MAP_SUBJECTS.map(s => ({ value: s, label: s === ANACOM_AGGREGATE ? 'Global PT' : s }))}
          value={mapSubject}
          onChange={v => v && setMapSubject(v)}
          allLabel={null}
          color={ACCENT}
        />

        <Text style={uiStyles.label}>Opacidade: {Math.round(opacity * 100)}%</Text>
        <ChipRow
          options={OPACITIES.map(o => ({ value: String(o), label: `${Math.round(o * 100)}%` }))}
          value={String(opacity)}
          onChange={v => v && setOpacity(Number(v))}
          allLabel={null}
          color={ACCENT}
        />

        <CoverageMap
          layerId={ANACOM_COVERAGE_LAYERS[mapSubject][technology]}
          opacity={opacity}
          point={point}
          focusKey={focusKey}
          onPick={(lat, lon) => setManualPoint({ lat, lon, label: 'Ponto escolhido no mapa' })}
        />

        <Text style={styles.legendTitle}>
          Legenda · {subjectLabel(mapSubject)} · {MOBILE_TECHNOLOGY_LABELS[technology]}
          {technology === '5G' ? ' (provisório)' : ''}
        </Text>
        <View style={styles.legend}>
          {legend.map(c => (
            <View key={c.label} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <Text style={styles.legendText}>{c.label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.swatch, styles.swatchEmpty]} />
            <Text style={styles.legendText}>Sem cor: não disponível ou sem dados</Text>
          </View>
        </View>
      </Card>

      <Card>
        <SectionTitle>Comparação de operadoras</SectionTitle>
        {!point && <Text style={uiStyles.small}>Escolha um local: use a sua localização ou toque no mapa.</Text>}
        {point && coverage.isLoading && <LoadingView color={ACCENT} />}
        {point && coverage.isError && <ErrorView error={coverage.error} onRetry={() => coverage.refetch()} />}
        {point && coverage.data && (
          <CoverageResults
            data={coverage.data}
            point={point}
            onRetry={() => coverage.refetch()}
            retrying={coverage.isFetching}
          />
        )}
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  disclaimer: { backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 },
  disclaimerText: { fontSize: 12, color: '#78350f' },
  disclaimerLink: { fontSize: 11, color: '#92400e', textDecorationLine: 'underline', marginTop: 2 },
  locationBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  locationBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.6 },
  hint: { marginTop: 8 },
  legendTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, marginTop: 10, marginBottom: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, color: '#334155' },
  swatch: { width: 12, height: 12, borderRadius: 2, borderWidth: 1, borderColor: '#cbd5e1' },
  swatchEmpty: { backgroundColor: 'white', borderStyle: 'dashed', borderColor: COLORS.faint },
  pointText: { fontSize: 11, color: COLORS.muted, marginBottom: 10 },
  infoBox: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, marginBottom: 10 },
  infoText: { fontSize: 12, color: '#334155' },
  warnBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 8, padding: 10, marginBottom: 10 },
  warnText: { fontSize: 12, color: '#78350f' },
  retryBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#d97706', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  retryText: { color: 'white', fontWeight: '600', fontSize: 12 },
  aggregate: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, marginBottom: 10 },
  aggregateTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted },
  aggregateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  operatorCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, marginBottom: 8, gap: 4 },
  operatorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  operatorName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  position: { fontSize: 12, fontWeight: '600', color: '#334155' },
  classTitle: { marginTop: 4 },
  operatorSource: { fontSize: 10, color: COLORS.faint, marginTop: 4 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  noClass: { fontSize: 13, color: COLORS.faint },
  classLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  provisional: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7e22ce',
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  caption: { fontSize: 11, color: COLORS.muted, marginTop: 8 },
})
