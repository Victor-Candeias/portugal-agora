import { useState, type ReactNode } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import {
  SNS24_PHONE,
  SNS24_PHONE_LABEL,
  SNS_EMERGENCY_PHONE,
  SNS_URGENCIAS_EMERGENCY_NOTICE,
  SNS_URGENCIAS_NOT_REAL_TIME,
  SNS_URGENCIAS_RANGES,
  SNS_URGENCIAS_WAIT_TIME_WARNING,
  compareSnsIndicators,
  compareSnsRegions,
  formatLisbonDateTime,
  formatSnsDate,
  formatSnsValue,
  snsDataState,
  snsIndicatorInfo,
  snsLatestObservation,
  snsRangeBounds,
  snsSeriesWithGaps,
  snsUnitLabel,
  type SnsEmergencyObservation,
  type SnsUrgenciasMetadata,
  type SnsUrgenciasRange,
  type SnsUrgenciasStatus,
} from '@portugal-hoje/core'
import { useSnsUrgenciasMetadata, useSnsUrgenciasObservations, useSnsUrgenciasStatus } from '../hooks/useSnsUrgencias'
import { SnsLineChart } from '../components/SnsLineChart'
import { Card, ChipRow, COLORS, LinkText, LoadingView, Notice, ScreenHeader, SectionTitle, uiStyles } from '../components/ui'

const DEFAULT_REGION = 'Portugal Continental'
const CHART_COLOR = '#dc2626'

function openUrl(url: string) {
  Linking.openURL(url).catch(() => undefined)
}

// Indicadores agregados de urgência hospitalar do SNS (MOB-021, versão mobile do WEB-067): dados
// estatísticos diários por região, publicados com atraso — nunca a espera atual num hospital.
// Toda a lógica (lacunas, estados, formatação, avisos) vem do `@portugal-hoje/core`.
export default function SnsUrgenciasScreen() {
  const observations = useSnsUrgenciasObservations()
  const metadata = useSnsUrgenciasMetadata()
  const status = useSnsUrgenciasStatus()
  const refetch = () => {
    void observations.refetch()
    void metadata.refetch()
    void status.refetch()
  }
  const loading = observations.isLoading || metadata.isLoading
  const failed = !loading && (!observations.data || !metadata.data)
  const error = observations.error ?? metadata.error

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="🏥 Urgências do SNS"
        subtitle="Indicadores diários de urgência hospitalar por região · Portal da Transparência do SNS"
        onRefresh={refetch}
        refreshing={observations.isFetching || metadata.isFetching}
      />

      <EmergencyNotice />

      {loading && <LoadingView />}
      {failed && (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>
            ⚠️ Os indicadores de urgência do SNS não estão disponíveis de momento. A fonte pode estar indisponível ou os dados ainda não
            foram publicados.
          </Text>
          {error instanceof Error && <Text style={styles.errorDetail}>{error.message}</Text>}
          <TouchableOpacity onPress={refetch} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      )}
      {observations.data && metadata.data && (
        <Dashboard observations={observations.data} metadata={metadata.data} status={status.data ?? null} />
      )}
    </ScrollView>
  )
}

function EmergencyNotice() {
  return (
    <View style={styles.emergency}>
      <Text style={styles.emergencyTitle}>ℹ️ {SNS_URGENCIAS_NOT_REAL_TIME}</Text>
      <Text style={styles.emergencyText}>{SNS_URGENCIAS_EMERGENCY_NOTICE}</Text>
      <View style={styles.callRow}>
        <TouchableOpacity
          onPress={() => openUrl(`tel:${SNS_EMERGENCY_PHONE}`)}
          style={[styles.callBtn, styles.callBtn112]}
          accessibilityRole="button"
          accessibilityLabel="Ligar 112"
        >
          <Text style={styles.callBtnText}>📞 Ligar 112</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => openUrl(`tel:${SNS24_PHONE}`)}
          style={[styles.callBtn, styles.callBtnSns24]}
          accessibilityRole="button"
          accessibilityLabel={`Ligar SNS 24, ${SNS24_PHONE_LABEL}`}
        >
          <Text style={styles.callBtnText}>📞 SNS 24 ({SNS24_PHONE_LABEL})</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

interface DashboardProps {
  observations: SnsEmergencyObservation[]
  metadata: SnsUrgenciasMetadata
  status: SnsUrgenciasStatus | null
}

function Dashboard({ observations, metadata, status }: DashboardProps) {
  const regions = [...metadata.regions].sort(compareSnsRegions)
  const indicators = [...metadata.indicators].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador))
  const [region, setRegion] = useState(regions.includes(DEFAULT_REGION) ? DEFAULT_REGION : regions[0] ?? '')
  const [indicador, setIndicador] = useState(indicators[0]?.indicador ?? '')
  const [range, setRange] = useState<SnsUrgenciasRange>(30)
  const state = snsDataState({ latestPeriod: metadata.latestPeriod, status })
  const lastSync = status?.lastSuccessfulSyncAt ?? metadata.fetchedAtUtc

  return (
    <>
      <Card>
        <Row label="Última observação">
          {formatSnsDate(metadata.latestPeriod)}
          {state.delayDays !== null && (
            <Text style={styles.rowMuted}> (há {state.delayDays} {state.delayDays === 1 ? 'dia' : 'dias'})</Text>
          )}
        </Row>
        <Row label="Última sincronização">{formatLisbonDateTime(lastSync)}</Row>
      </Card>
      {state.delayed && (
        <Notice>
          🕒 A última observação publicada pelo SNS tem {state.delayDays} dias, mais do que o habitual (cerca de 2 dias). A fonte pode
          estar atrasada.
        </Notice>
      )}
      {state.possiblyStale && (
        <Notice>
          ⚠️ Possivelmente desatualizado: a última recolha {status?.status === 'fresh' ? 'é antiga' : 'falhou'} e mostram-se os últimos
          dados obtidos com sucesso.
        </Notice>
      )}

      <SectionTitle>Região</SectionTitle>
      <ChipRow
        options={regions.map(r => ({ value: r, label: r }))}
        value={region}
        onChange={v => v && setRegion(v)}
        allLabel={null}
        color={CHART_COLOR}
      />

      <Card>
        <SectionTitle>Última observação · {region}</SectionTitle>
        {indicators.map((i, k) => {
          const info = snsIndicatorInfo(i.indicador)
          const latest = snsLatestObservation(observations, { indicador: i.indicador, ars: region })
          return (
            <View key={i.indicador} style={[styles.latestItem, k > 0 && styles.latestDivider]}>
              <View style={styles.latestRow}>
                <Text style={styles.latestLabel}>{info.shortLabel}</Text>
                <Text style={[styles.latestValue, !latest && styles.missing]}>
                  {formatSnsValue(latest?.valor, i.unidade, i.indicador)}
                </Text>
              </View>
              <Text style={uiStyles.small}>{latest ? `Dia ${formatSnsDate(latest.periodo)}` : `Sem dados publicados para ${region}`}</Text>
              {info.notRealTime && <Text style={styles.waitWarning}>⏱️ {SNS_URGENCIAS_WAIT_TIME_WARNING}</Text>}
            </View>
          )
        })}
      </Card>

      <SeriesCard
        observations={observations}
        metadata={metadata}
        region={region}
        indicador={indicador}
        onIndicador={setIndicador}
        range={range}
        onRange={setRange}
      />

      <MethodologyCard metadata={metadata} />
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Text style={styles.row}>
      <Text style={styles.rowLabel}>{label}: </Text>
      <Text style={styles.rowValue}>{children}</Text>
    </Text>
  )
}

function SeriesCard({
  observations,
  metadata,
  region,
  indicador,
  onIndicador,
  range,
  onRange,
}: {
  observations: SnsEmergencyObservation[]
  metadata: SnsUrgenciasMetadata
  region: string
  indicador: string
  onIndicador: (indicador: string) => void
  range: SnsUrgenciasRange
  onRange: (range: SnsUrgenciasRange) => void
}) {
  const [showValues, setShowValues] = useState(false)
  const indicators = [...metadata.indicators].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador))
  const meta = indicators.find(i => i.indicador === indicador)
  const info = snsIndicatorInfo(indicador)
  const unidade = meta?.unidade ?? ''
  const bounds = snsRangeBounds(metadata.toDate, range, metadata.fromDate)
  const available = meta?.regions.includes(region) ?? false
  const points = available ? snsSeriesWithGaps(observations, { indicador, ars: region, ...bounds }) : []
  const gaps = points.filter(p => p.missing).length
  const tickDecimals = Math.min(info.decimals, 1)

  return (
    <Card>
      <SectionTitle>Evolução diária</SectionTitle>
      <ChipRow
        options={indicators.map(i => ({ value: i.indicador, label: snsIndicatorInfo(i.indicador).shortLabel }))}
        value={indicador}
        onChange={v => v && onIndicador(v)}
        allLabel={null}
        color={CHART_COLOR}
      />
      <ChipRow
        options={SNS_URGENCIAS_RANGES.map(r => ({ value: String(r), label: `${r} dias` }))}
        value={String(range)}
        onChange={v => v && onRange(Number(v) as SnsUrgenciasRange)}
        allLabel={null}
        color={CHART_COLOR}
      />

      <Text style={styles.seriesTitle}>
        {indicador} — {region}
      </Text>
      <Text style={[uiStyles.small, styles.seriesSubtitle]}>
        {formatSnsDate(bounds.fromDate)} a {formatSnsDate(bounds.toDate)} · unidade: {unidade ? snsUnitLabel(unidade) : '—'}
        {gaps > 0 && ` · ${gaps} ${gaps === 1 ? 'dia' : 'dias'} sem dados`}
      </Text>
      {info.notRealTime && <Text style={styles.waitWarning}>⏱️ {SNS_URGENCIAS_WAIT_TIME_WARNING}</Text>}

      {available ? (
        <>
          <SnsLineChart
            points={points.map(p => ({ label: formatSnsDate(p.periodo).slice(0, 5), value: p.valor }))}
            color={CHART_COLOR}
            showDots={range === 7}
            formatTick={v => v.toLocaleString('pt-PT', { maximumFractionDigits: tickDecimals })}
            accessibilityLabel={`Gráfico de ${info.shortLabel} em ${region}, de ${formatSnsDate(bounds.fromDate)} a ${formatSnsDate(bounds.toDate)}. Os valores estão na lista abaixo.`}
          />
          {gaps > 0 && <Text style={uiStyles.small}>Zonas sombreadas: dias sem dados publicados (não são zero).</Text>}
          <TouchableOpacity onPress={() => setShowValues(v => !v)} style={styles.toggle}>
            <Text style={styles.toggleText}>{showValues ? 'Esconder os valores' : `Ver os valores (${points.length} dias)`}</Text>
          </TouchableOpacity>
          {showValues &&
            [...points].reverse().map(p => (
              <View key={p.periodo} style={styles.valueRow}>
                <Text style={styles.valueDate}>{formatSnsDate(p.periodo)}</Text>
                <Text style={[styles.valueText, p.missing && styles.missing]}>{formatSnsValue(p.valor, unidade, indicador)}</Text>
              </View>
            ))}
        </>
      ) : (
        <Text style={styles.noData}>Sem dados: o SNS não publica este indicador para {region}.</Text>
      )}
    </Card>
  )
}

function MethodologyCard({ metadata }: { metadata: SnsUrgenciasMetadata }) {
  const indicators = [...metadata.indicators].sort((a, b) => compareSnsIndicators(a.indicador, b.indicador))
  return (
    <Card>
      <SectionTitle>Nota metodológica e fonte</SectionTitle>
      {indicators.map(i => {
        const info = snsIndicatorInfo(i.indicador)
        return (
          <View key={i.indicador} style={styles.methodItem}>
            <Text style={styles.methodTitle}>
              {i.indicador} <Text style={styles.rowMuted}>({snsUnitLabel(i.unidade)})</Text>
            </Text>
            {info.description ? <Text style={styles.methodText}>{info.description}</Text> : null}
          </View>
        )
      })}
      <Text style={[styles.methodText, styles.methodBlock]}>{metadata.attribution}</Text>
      <View style={uiStyles.actions}>
        <LinkText label="🔗 Dataset no Portal da Transparência" onPress={() => openUrl(metadata.datasetUrl)} />
        <LinkText label="🔗 Portal da Transparência do SNS" onPress={() => openUrl(metadata.portalUrl)} />
      </View>
      <Text style={[styles.methodText, styles.methodBlock]}>
        <Text style={styles.methodStrong}>Reutilização: </Text>
        {metadata.license.name}
      </Text>
      {metadata.license.conditions.map(c => (
        <Text key={c} style={styles.methodText}>
          • {c}
        </Text>
      ))}
      <Text style={[styles.methodText, styles.methodBlock]}>
        <Text style={styles.methodStrong}>Transformações: </Text>
        {metadata.transformations}
      </Text>
      <Text style={[uiStyles.small, styles.methodBlock]}>
        {metadata.sourceLastModified ? `Dataset atualizado pela fonte em ${formatLisbonDateTime(metadata.sourceLastModified)} · ` : ''}
        dados de {formatSnsDate(metadata.fromDate)} a {formatSnsDate(metadata.toDate)} · {metadata.observations} observações
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  emergency: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  emergencyTitle: { color: '#78350f', fontWeight: '700', fontSize: 13 },
  emergencyText: { color: '#78350f', fontSize: 13 },
  callRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  callBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  callBtn112: { backgroundColor: '#dc2626' },
  callBtnSns24: { backgroundColor: '#0369a1' },
  callBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, gap: 6 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  errorDetail: { color: '#991b1b', fontSize: 12 },
  errorBtn: { alignSelf: 'flex-start', backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  errorBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  row: { fontSize: 13, marginBottom: 2 },
  rowLabel: { color: COLORS.muted },
  rowValue: { color: COLORS.text, fontWeight: '700' },
  rowMuted: { color: COLORS.muted, fontWeight: '400' },
  latestItem: { paddingVertical: 8 },
  latestDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  latestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  latestLabel: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },
  latestValue: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  missing: { color: COLORS.faint, fontStyle: 'italic', fontWeight: '400' },
  waitWarning: {
    marginTop: 6,
    marginBottom: 6,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    color: '#78350f',
    fontSize: 12,
    fontWeight: '600',
  },
  seriesTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  seriesSubtitle: { marginBottom: 8 },
  noData: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    textAlign: 'center',
    color: COLORS.muted,
    fontSize: 13,
  },
  toggle: { paddingVertical: 10 },
  toggleText: { color: COLORS.link, fontWeight: '600', fontSize: 13 },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  valueDate: { fontSize: 13, color: '#334155' },
  valueText: { fontSize: 13, color: COLORS.text },
  methodItem: { marginBottom: 8 },
  methodTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  methodText: { fontSize: 12, color: '#475569' },
  methodStrong: { fontWeight: '700', color: '#334155' },
  methodBlock: { marginTop: 8 },
})
