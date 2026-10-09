import { useState } from 'react'
import { Pressable, ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import {
  BDP_RATE_LABELS, formatBdpPeriod, formatIneValue, formatRate, INE_INDICATORS, ineRangeOptions, ineRangeStart,
  summarizeIneSeries, type BdpRate, type IneRange, type IneSeriesPoint,
} from '@portugal-hoje/core'
import { useBdpLendingRates, useBdpRates, useIneIndicators, useIneLatest, useIneSeries } from '../../hooks/useEconomia'
import { Card, ChipRow, EmptyText, ErrorView, LoadingView, ScreenHeader, SectionTitle, uiStyles } from '../../components/ui'

const COLOR = '#6366f1'

export default function Economia() {
  const rates = useBdpRates()
  const lending = useBdpLendingRates()
  const ine = useIneLatest()
  const indicators = useIneIndicators()
  const [selected, setSelected] = useState<string | null>(null)

  const refresh = () => {
    void rates.refetch()
    void lending.refetch()
    void ine.refetch()
  }

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="📊 Economia"
        subtitle="Banco de Portugal · BCE · INE/Eurostat"
        onRefresh={refresh}
        refreshing={rates.isFetching || lending.isFetching || ine.isFetching}
      />

      <Text style={styles.groupTitle}>Taxas de referência</Text>
      {rates.isLoading && <LoadingView color={COLOR} />}
      {rates.isError && <ErrorView error={rates.error} onRetry={() => void rates.refetch()} />}
      <View style={styles.grid}>
        {rates.data?.data.map(r => <RateCard key={r.key} rate={r} />)}
      </View>

      <Text style={styles.groupTitle}>Crédito e depósitos (novas operações)</Text>
      {lending.isLoading && <LoadingView color={COLOR} />}
      {lending.isError && <ErrorView error={lending.error} onRetry={() => void lending.refetch()} />}
      {lending.data && (
        <Card>
          {lending.data.data.map(r => (
            <View key={r.key} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{BDP_RATE_LABELS[r.key] ?? r.label_pt}</Text>
                <Text style={uiStyles.small}>{formatBdpPeriod(r)}</Text>
              </View>
              <Text style={styles.rowValue}>{formatRate(r.value)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Text style={styles.groupTitle}>Indicadores de Portugal</Text>
      {ine.isLoading && <LoadingView color={COLOR} />}
      {ine.isError && <ErrorView error={ine.error} onRetry={() => void ine.refetch()} />}
      {ine.data && ine.data.data.length === 0 && <EmptyText>Dados não disponíveis</EmptyText>}
      {ine.data && ine.data.data.length > 0 && (
        <Card>
          <SectionTitle>{ine.data.source}</SectionTitle>
          <Text style={[uiStyles.small, styles.hint]}>Toque num indicador para ver a série histórica.</Text>
          {ine.data.data.map(ind => {
            const meta = INE_INDICATORS[ind.indicator]
            const open = selected === ind.indicator
            return (
              <View key={ind.indicator}>
                <TouchableOpacity
                  style={[styles.row, open && styles.rowOpen]}
                  onPress={() => setSelected(open ? null : ind.indicator)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{meta?.label ?? ind.label}</Text>
                    <Text style={uiStyles.small}>{ind.year}</Text>
                  </View>
                  <Text style={styles.rowValue}>{formatIneValue(ind.indicator, ind.value)}</Text>
                  <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
                </TouchableOpacity>
                {open && <IneSeriesPanel key={ind.indicator} indicator={ind.indicator} indicators={indicators} />}
              </View>
            )
          })}
        </Card>
      )}
    </ScrollView>
  )
}

// Série histórica de um indicador com seletor de intervalo de anos (WEB-030).
// Gráfico de barras feito com Views, para não precisar de uma biblioteca nativa de gráficos.
function IneSeriesPanel({ indicator, indicators }: {
  indicator: string
  indicators: ReturnType<typeof useIneIndicators>
}) {
  const settled = indicators.isSuccess || indicators.isError
  const info = indicators.data?.data.find(i => i.indicator === indicator)
  const series = useIneSeries(settled ? indicator : null, info?.years.from)
  const [range, setRange] = useState<IneRange>('20')
  const [pickedYear, setPickedYear] = useState<number | null>(null)

  if (!settled || series.isLoading) return <LoadingView color={COLOR} />
  if (series.isError) return <ErrorView error={series.error} onRetry={() => void series.refetch()} />
  const points = series.data?.data ?? []
  if (points.length === 0) return <EmptyText>Sem série histórica para este indicador</EmptyText>

  const years = { from: points[0].year, to: points[points.length - 1].year, count: points.length }
  const options = ineRangeOptions(years)
  const preset: IneRange = options.some(o => o.value === range) ? range : 'all'
  const from = ineRangeStart(preset, years)
  const visible = points.filter(p => p.year >= from)
  const summary = summarizeIneSeries(visible)
  const picked = visible.find(p => p.year === pickedYear) ?? summary?.last

  return (
    <View style={styles.panel}>
      <ChipRow
        options={options}
        value={preset}
        onChange={v => v && setRange(v)}
        allLabel={null}
        color={COLOR}
      />
      {picked && (
        <Text style={styles.picked}>
          {picked.year}: <Text style={styles.pickedValue}>{formatIneValue(indicator, picked.value)}</Text>
        </Text>
      )}
      <BarChart points={visible} selectedYear={picked?.year ?? null} onSelect={setPickedYear} />
      {summary && (
        <Text style={[uiStyles.small, styles.summary]}>
          Mínimo {formatIneValue(indicator, summary.min.value)} ({summary.min.year}) · máximo{' '}
          {formatIneValue(indicator, summary.max.value)} ({summary.max.year})
        </Text>
      )}
      {series.data && (
        <Text style={uiStyles.small}>Fonte: {series.data.source} ({series.data.source_dataset})</Text>
      )}
    </View>
  )
}

const CHART_HEIGHT = 140

function BarChart({ points, selectedYear, onSelect }: {
  points: IneSeriesPoint[]
  selectedYear: number | null
  onSelect: (year: number) => void
}) {
  const values = points.map(p => p.value)
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1
  if (lo < 0) {
    lo -= pad
    hi = Math.max(hi, 0) + pad
  } else {
    lo = Math.max(0, lo - pad)
    hi += pad
  }
  // As barras partem do zero quando ele está no eixo; senão, do fundo do gráfico.
  const base = lo <= 0 && hi >= 0 ? 0 : lo
  const y = (v: number) => ((v - lo) / (hi - lo)) * CHART_HEIGHT
  const middle = points[Math.floor(points.length / 2)]

  return (
    <View>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {base > lo && <View style={[styles.zeroLine, { bottom: y(0) }]} />}
        {points.map(p => {
          const selected = p.year === selectedYear
          return (
            <Pressable
              key={p.year}
              style={styles.barSlot}
              onPress={() => onSelect(p.year)}
              accessibilityLabel={`${p.year}`}
            >
              <View
                style={[
                  styles.bar,
                  {
                    bottom: y(Math.min(p.value, base)),
                    height: Math.max(1, Math.abs(y(p.value) - y(base))),
                    backgroundColor: selected ? COLOR : p.value < 0 ? '#fca5a5' : '#c7d2fe',
                  },
                ]}
              />
            </Pressable>
          )
        })}
      </View>
      <View style={styles.xAxis}>
        <Text style={uiStyles.small}>{points[0].year}</Text>
        {points.length > 2 && <Text style={uiStyles.small}>{middle.year}</Text>}
        <Text style={uiStyles.small}>{points[points.length - 1].year}</Text>
      </View>
    </View>
  )
}

function RateCard({ rate }: { rate: BdpRate }) {
  return (
    <View style={styles.rateCard}>
      <Text style={styles.rateType} numberOfLines={1}>{BDP_RATE_LABELS[rate.key] ?? rate.label_pt}</Text>
      <Text style={styles.rateValue}>{formatRate(rate.value)}</Text>
      <Text style={styles.rateDesc} numberOfLines={2}>{rate.label_pt}</Text>
      <Text style={styles.ratePeriod}>{formatBdpPeriod(rate)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  groupTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  rateCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    width: '47%',
    elevation: 2,
  },
  rateType: { fontSize: 11, color: '#64748b', fontWeight: '700', letterSpacing: 0.3 },
  rateValue: { fontSize: 22, fontWeight: '700', color: COLOR, marginVertical: 4 },
  rateDesc: { fontSize: 10, color: '#94a3b8' },
  ratePeriod: { fontSize: 11, color: '#64748b', marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  rowValue: { fontSize: 16, fontWeight: '700', color: '#374151' },
  rowOpen: { backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 6, marginHorizontal: -6 },
  chevron: { fontSize: 14, color: '#94a3b8', width: 14, textAlign: 'center' },
  hint: { marginBottom: 4 },
  panel: { paddingTop: 10, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 8 },
  picked: { fontSize: 13, color: '#64748b' },
  pickedValue: { fontSize: 16, fontWeight: '700', color: COLOR },
  chart: { flexDirection: 'row', alignItems: 'stretch', gap: 1, position: 'relative' },
  barSlot: { flex: 1, position: 'relative' },
  bar: { position: 'absolute', left: 0, right: 0, borderRadius: 1 },
  zeroLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#94a3b8' },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  summary: { marginTop: 2 },
})
