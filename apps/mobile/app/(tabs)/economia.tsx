import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { BDP_RATE_LABELS, formatBdpPeriod, formatRate, INE_INDICATORS, type BdpRate } from '@portugal-hoje/core'
import { useBdpLendingRates, useBdpRates, useIneLatest } from '../../hooks/useEconomia'
import { Card, EmptyText, ErrorView, LoadingView, ScreenHeader, SectionTitle, uiStyles } from '../../components/ui'

const COLOR = '#6366f1'

export default function Economia() {
  const rates = useBdpRates()
  const lending = useBdpLendingRates()
  const ine = useIneLatest()

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
          {ine.data.data.map(ind => {
            const meta = INE_INDICATORS[ind.indicator]
            return (
              <View key={ind.indicator} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{meta?.label ?? ind.label}</Text>
                  <Text style={uiStyles.small}>{ind.year}</Text>
                </View>
                <Text style={styles.rowValue}>
                  {meta ? meta.format(ind.value) : ind.value.toLocaleString('pt-PT')}
                </Text>
              </View>
            )
          })}
        </Card>
      )}
    </ScrollView>
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
})
