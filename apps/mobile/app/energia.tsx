import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  ENERGY_CLASSIFICATION_COLORS,
  ENERGY_CLASSIFICATION_LABELS,
  ENERGY_CONSUMPTION_COLOR,
  ENERGY_NOW_QUESTION,
  ENERGY_VERDICT_STYLES,
  energyHourlySlots,
  energyMix,
  energyNowInfo,
  energyQualityInfo,
  formatEnergy,
  formatEnergyDate,
  formatLisbonDateTime,
  formatSharePct,
  renewableToConsumptionPct,
  type EnergyDaily,
  type EnergyDay,
  type EnergyTimeseries,
} from '@portugal-hoje/core'
import { useEnergy, useEnergyIntraday } from '../hooks/useEnergy'
import { Card, COLORS, ErrorView, LinkText, LoadingView, Notice, ScreenHeader, SectionTitle, uiStyles } from '../components/ui'

// Painel de energia elétrica: indicador «agora» e gráfico de 24 h com a série horária ENTSO-E (WEB-058)
// e balanço diário oficial da REN (WEB-056). O diário é sempre «último dia disponível», nunca «agora».
// Não entra no Android Auto.
export default function EnergiaScreen() {
  const energy = useEnergy()
  const intraday = useEnergyIntraday('24h')
  const result = energy.data
  const daily = result?.data
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const day = daily ? daily.days.find(d => d.date === selectedDate) ?? daily.days[daily.days.length - 1] : null
  const quality = daily ? energyQualityInfo(daily) : null

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="🔌 Energia elétrica"
        subtitle="Portugal continental · produção horária ENTSO-E (~1 h de atraso) · balanço diário REN"
        onRefresh={() => {
          void energy.refetch()
          void intraday.refetch()
        }}
        refreshing={energy.isFetching || intraday.isFetching}
      />

      {intraday.data ? (
        <>
          <NowCard series={intraday.data.data} offline={intraday.data.offline} savedAt={intraday.data.savedAt} />
          <IntradayCard series={intraday.data.data} />
        </>
      ) : (
        intraday.isError && (
          <Notice>
            ⏱️ Série horária (ENTSO-E) indisponível: não é possível dizer o que acontece «agora». Mostram-se só os últimos dados
            disponíveis do balanço diário da REN.
          </Notice>
        )
      )}

      {energy.isLoading && <LoadingView />}
      {energy.isError && <ErrorView error={energy.error} onRetry={() => void energy.refetch()} />}

      {result && daily && day && (
        <>
          {result.offline && (
            <Notice>
              📴 Sem ligação: a mostrar os dados guardados em {formatLisbonDateTime(new Date(result.savedAt).toISOString())}.
            </Notice>
          )}
          {quality?.stale && (
            <Notice>⏳ Dados desatualizados: o último dia disponível é {quality.latestDate} (terminou há {quality.delay}).</Notice>
          )}

          <SectionTitle>
            {formatEnergyDate(day.date)}
            {day === daily.days[daily.days.length - 1] ? ' · último dia disponível' : ''}
          </SectionTitle>
          <DayCards day={day} />
          <MixCard day={day} />
          <HistoryCard daily={daily} selectedDate={day.date} onSelect={setSelectedDate} />
          <QualityCard daily={daily} />
        </>
      )}
    </ScrollView>
  )
}

function NowCard({ series, offline, savedAt }: { series: EnergyTimeseries; offline: boolean; savedAt: number }) {
  const info = energyNowInfo(series)
  const style = ENERGY_VERDICT_STYLES[info.verdict]
  const p = info.interval
  return (
    <Card>
      <Text style={styles.statTitle}>{info.label.toUpperCase()}</Text>
      <Text style={styles.question}>{ENERGY_NOW_QUESTION}</Text>
      <View style={[styles.verdict, { backgroundColor: style.background }]} accessibilityLiveRegion="polite">
        <Text style={[styles.verdictText, { color: style.color }]}>{info.verdict}</Text>
      </View>
      <Text style={styles.statDetail}>{style.description}</Text>
      {p && (
        <View style={styles.totals}>
          <Total label="Renovável" value={formatEnergy(p.renewable, p.unit, 0)} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
          <Total label="Não renovável" value={formatEnergy(p.nonRenewable, p.unit, 0)} color={ENERGY_CLASSIFICATION_COLORS.non_renewable} />
          <Total label="Armazenam." value={formatEnergy(p.storage, p.unit, 0)} color={ENERGY_CLASSIFICATION_COLORS.storage} />
          <Total label="Consumo" value={formatEnergy(p.consumption, p.unit, 0)} color={ENERGY_CONSUMPTION_COLOR} />
        </View>
      )}
      <Text style={[uiStyles.small, styles.note]}>
        Observação: {info.observed} (Lisboa, média horária{p && p.quality !== 'complete' ? `, incompleta ${formatSharePct(p.coveragePct)}` : ''}) ·
        Atualizado às {info.updatedAt} · Atraso {info.delay} · Fonte: {info.source}
      </Text>
      {offline && (
        <Text style={[uiStyles.small, styles.note]}>
          📴 Sem ligação: dados guardados em {formatLisbonDateTime(new Date(savedAt).toISOString())}.
        </Text>
      )}
    </Card>
  )
}

const INTRADAY_HEIGHT = 130

function IntradayCard({ series }: { series: EnergyTimeseries }) {
  const slots = energyHourlySlots(series.points)
  if (slots.length === 0) return null
  const hi = Math.max(1, ...slots.map(s => (s.point ? Math.max(s.point.renewable, s.point.nonRenewable, s.point.storage, s.point.consumption ?? 0) : 0))) * 1.05
  const y = (v: number) => (Math.max(0, v) / hi) * INTRADAY_HEIGHT
  const gaps = slots.filter(s => !s.point || s.point.quality !== 'complete').length
  return (
    <Card>
      <SectionTitle>Últimas 24 horas · produção horária</SectionTitle>
      <View style={[styles.chart, { height: INTRADAY_HEIGHT }]}>
        {slots.map(s => {
          // Horas incompletas ficam em branco (valores por defeito); o consumo mostra-se se existir.
          const complete = s.point?.quality === 'complete'
          return (
            <View
              key={s.intervalStartUtc}
              style={styles.hourSlot}
              accessibilityLabel={
                complete
                  ? `${s.label}: renovável ${formatEnergy(s.point!.renewable, 'MW', 0)}, não renovável ${formatEnergy(s.point!.nonRenewable, 'MW', 0)}`
                  : `${s.label}: sem dados completos`
              }
            >
              {complete && (
                <>
                  <View style={[styles.hourBar, { height: y(s.point!.renewable), backgroundColor: ENERGY_CLASSIFICATION_COLORS.renewable }]} />
                  <View style={[styles.hourBar, { height: y(s.point!.nonRenewable), backgroundColor: ENERGY_CLASSIFICATION_COLORS.non_renewable }]} />
                  <View style={[styles.hourBar, { height: y(s.point!.storage), backgroundColor: ENERGY_CLASSIFICATION_COLORS.storage }]} />
                </>
              )}
              {s.point?.consumption != null && <View style={[styles.consumption, { bottom: y(s.point.consumption) - 1 }]} />}
            </View>
          )
        })}
      </View>
      <View style={styles.xAxis}>
        <Text style={uiStyles.small}>{slots[0].time}</Text>
        {slots.length > 2 && <Text style={uiStyles.small}>{slots[Math.floor(slots.length / 2)].time}</Text>}
        <Text style={uiStyles.small}>{slots[slots.length - 1].time}</Text>
      </View>
      <View style={styles.legend}>
        <Legend color={ENERGY_CLASSIFICATION_COLORS.renewable} label="Renovável" />
        <Legend color={ENERGY_CLASSIFICATION_COLORS.non_renewable} label="Não renovável" />
        <Legend color={ENERGY_CLASSIFICATION_COLORS.storage} label="Armazenamento" />
        <Legend color={ENERGY_CONSUMPTION_COLOR} label="Consumo" line />
      </View>
      <Text style={uiStyles.small}>
        MW, média de cada hora (Lisboa), lado a lado. O armazenamento (bombagem e baterias) não é renovável nem não renovável.{gaps > 0 ? ` ${gaps} hora(s) sem dados completos em branco.` : ''} Fonte: {series.sourceName}.
      </Text>
    </Card>
  )
}

function Stat({ title, value, detail, color }: { title: string; value: string; detail?: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {detail ? <Text style={styles.statDetail}>{detail}</Text> : null}
    </View>
  )
}

function DayCards({ day }: { day: EnergyDay }) {
  const toConsumption = renewableToConsumptionPct(day)
  const net = day.imports !== null && day.exports !== null ? day.imports - day.exports : null
  return (
    <View style={styles.grid}>
      <Stat title="PRODUÇÃO RENOVÁVEL" value={formatEnergy(day.renewable, day.unit)} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
      <Stat
        title="NÃO RENOVÁVEL"
        value={formatEnergy(day.nonRenewable, day.unit)}
        detail={day.storage ? `+ ${formatEnergy(day.storage, day.unit)} de armazenamento` : undefined}
        color={ENERGY_CLASSIFICATION_COLORS.non_renewable}
      />
      <Stat
        title="QUOTA RENOVÁVEL"
        value={formatSharePct(day.renewableSharePct)}
        detail={`da produção (${formatEnergy(day.production, day.unit)})${
          day.renewableExceedsNonRenewable === null ? ' · dados incompletos' : day.renewableExceedsNonRenewable ? ' · acima da não renovável' : ' · abaixo da não renovável'
        }`}
        color={ENERGY_CLASSIFICATION_COLORS.renewable}
      />
      <Stat
        title="CONSUMO"
        value={formatEnergy(day.consumption, day.unit)}
        detail={toConsumption !== null ? `Renovável = ${formatSharePct(toConsumption)} do consumo` : undefined}
        color={ENERGY_CONSUMPTION_COLOR}
      />
      {(day.imports !== null || day.exports !== null) && (
        <Stat
          title="IMPORTAÇÃO / EXPORTAÇÃO"
          value={`${formatEnergy(day.imports, day.unit)} / ${formatEnergy(day.exports, day.unit)}`}
          detail={net !== null ? `Saldo ${net >= 0 ? 'importador' : 'exportador'}: ${formatEnergy(Math.abs(net), day.unit)}` : undefined}
          color="#0369a1"
        />
      )}
      <Text style={[uiStyles.small, styles.note]}>
        Fonte: REN, dia civil de Lisboa. «Renovável ÷ consumo» pode passar 100% quando há exportação; a quota renovável é da produção nacional.
      </Text>
    </View>
  )
}

function MixCard({ day }: { day: EnergyDay }) {
  const mix = energyMix(day)
  const positive = mix.filter(m => m.value > 0)
  const positiveTotal = positive.reduce((s, m) => s + m.value, 0)
  return (
    <Card>
      <SectionTitle>Mix de produção</SectionTitle>
      {positiveTotal > 0 && (
        <View style={styles.mixBar} accessibilityLabel="Mix de produção por tecnologia">
          {positive.map(m => (
            <View key={m.technology} style={{ flex: m.value / positiveTotal, backgroundColor: m.color }} />
          ))}
        </View>
      )}
      {mix.map(m => (
        <View key={m.technology} style={styles.mixRow}>
          <View style={[styles.swatch, { backgroundColor: m.color }]} />
          <Text style={styles.mixLabel} numberOfLines={1}>
            {m.label} <Text style={uiStyles.small}>({ENERGY_CLASSIFICATION_LABELS[m.classification].toLowerCase()})</Text>
          </Text>
          <Text style={styles.mixValue}>{formatEnergy(m.value, day.unit)}</Text>
          <Text style={styles.mixShare}>{formatSharePct(m.sharePct)}</Text>
        </View>
      ))}
      {mix.some(m => m.value < 0) && (
        <Text style={[uiStyles.small, styles.note]}>
          Valores negativos: a REN publica a hídrica sem a turbinagem de bombagem (contada em armazenamento).
        </Text>
      )}
    </Card>
  )
}

const CHART_HEIGHT = 150

function HistoryCard({ daily, selectedDate, onSelect }: {
  daily: EnergyDaily
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const { days, total } = daily
  const hi = Math.max(1, ...days.map(d => Math.max(d.renewable + d.nonRenewable + d.storage, d.consumption ?? 0))) * 1.05
  const y = (v: number) => (Math.max(0, v) / hi) * CHART_HEIGHT
  const middle = days[Math.floor(days.length / 2)]
  return (
    <Card>
      <SectionTitle>Últimos {days.length} dias</SectionTitle>
      <View style={styles.totals}>
        <Total label="Renovável" value={formatEnergy(total.renewable, total.unit, 0)} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Total label="Não renovável" value={formatEnergy(total.nonRenewable, total.unit, 0)} color={ENERGY_CLASSIFICATION_COLORS.non_renewable} />
        <Total label="Quota ponderada" value={formatSharePct(total.renewableSharePct)} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
      </View>
      <Text style={[uiStyles.small, styles.hint]}>Toque num dia para ver os valores e o mix desse dia.</Text>
      <View style={[styles.chart, { height: CHART_HEIGHT }]}>
        {days.map(d => {
          const selected = d.date === selectedDate
          const renewable = y(d.renewable)
          const nonRenewable = y(d.nonRenewable)
          const storage = y(d.storage)
          return (
            <Pressable
              key={d.date}
              style={[styles.barSlot, selected && styles.barSlotSelected]}
              onPress={() => onSelect(d.date)}
              accessibilityLabel={`${formatEnergyDate(d.date)}: quota renovável ${formatSharePct(d.renewableSharePct)}`}
            >
              <View style={[styles.bar, { bottom: 0, height: renewable, backgroundColor: ENERGY_CLASSIFICATION_COLORS.renewable }]} />
              <View style={[styles.bar, { bottom: renewable, height: nonRenewable, backgroundColor: ENERGY_CLASSIFICATION_COLORS.non_renewable }]} />
              <View style={[styles.bar, { bottom: renewable + nonRenewable, height: storage, backgroundColor: ENERGY_CLASSIFICATION_COLORS.storage }]} />
              {d.consumption !== null && (
                <View style={[styles.consumption, { bottom: y(d.consumption) - 1 }]} />
              )}
            </Pressable>
          )
        })}
      </View>
      <View style={styles.xAxis}>
        <Text style={uiStyles.small}>{formatEnergyDate(days[0].date).slice(0, 5)}</Text>
        {days.length > 2 && <Text style={uiStyles.small}>{formatEnergyDate(middle.date).slice(0, 5)}</Text>}
        <Text style={uiStyles.small}>{formatEnergyDate(days[days.length - 1].date).slice(0, 5)}</Text>
      </View>
      <View style={styles.legend}>
        <Legend color={ENERGY_CLASSIFICATION_COLORS.renewable} label="Renovável" />
        <Legend color={ENERGY_CLASSIFICATION_COLORS.non_renewable} label="Não renovável" />
        <Legend color={ENERGY_CLASSIFICATION_COLORS.storage} label="Armazenamento" />
        <Legend color={ENERGY_CONSUMPTION_COLOR} label="Consumo" line />
      </View>
      <Text style={uiStyles.small}>{total.unit} por dia.</Text>
    </Card>
  )
}

function Total({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={uiStyles.small}>{label}</Text>
      <Text style={[styles.totalValue, { color }]}>{value}</Text>
    </View>
  )
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <View style={uiStyles.row}>
      <View style={[line ? styles.legendLine : styles.swatch, { backgroundColor: color }]} />
      <Text style={uiStyles.small}>{label}</Text>
    </View>
  )
}

function QualityCard({ daily }: { daily: EnergyDaily }) {
  const q = energyQualityInfo(daily)
  if (!q) return null
  const gaps = [
    ...q.missingDates.map(d => `${formatEnergyDate(d)} (sem dados)`),
    ...q.incompleteDates.map(d => `${formatEnergyDate(d)} (incompleto)`),
  ]
  return (
    <Card>
      <SectionTitle>Qualidade dos dados</SectionTitle>
      <Row label="Estado" value={`${q.label}${q.stale ? ' · desatualizados' : ''}`} />
      <Row label="Período" value={q.period} />
      <Row label="Recolhido em" value={`${q.fetchedAt} (Lisboa)`} />
      <Row label="Atraso" value={`${q.delay} desde o fim do último dia`} />
      <Row label="Lacunas" value={gaps.length ? gaps.join(', ') : 'Nenhuma'} />
      <Row label="Resolução" value="Diária, GWh inteiros" />
      <Text style={[uiStyles.small, styles.note]}>Fonte: {q.source}. A REN publica cada dia no dia seguinte.</Text>
      <LinkText label="🔗 datahub.ren.pt" onPress={() => void Linking.openURL(q.sourceUrl)} />
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.qualityRow}>
      <Text style={styles.qualityLabel}>{label}</Text>
      <Text style={styles.qualityValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  stat: { backgroundColor: 'white', borderRadius: 10, padding: 14, width: '47%', flexGrow: 1, elevation: 2 },
  statTitle: { fontSize: 11, color: COLORS.muted, fontWeight: '700', letterSpacing: 0.3 },
  statValue: { fontSize: 20, fontWeight: '700', marginVertical: 4 },
  statDetail: { fontSize: 11, color: '#475569' },
  note: { marginTop: 6 },
  question: { fontSize: 14, color: '#334155', marginTop: 4, marginBottom: 10 },
  verdict: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
  verdictText: { fontSize: 26, fontWeight: '800' },
  hourSlot: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, position: 'relative' },
  hourBar: { flex: 1 },
  mixBar: { flexDirection: 'row', height: 22, borderRadius: 6, overflow: 'hidden', marginBottom: 10 },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  mixLabel: { flex: 1, fontSize: 13, color: '#334155' },
  mixValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  mixShare: { width: 52, textAlign: 'right', fontSize: 12, color: COLORS.muted },
  totals: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  total: { flex: 1 },
  totalValue: { fontSize: 15, fontWeight: '700' },
  hint: { marginBottom: 6 },
  chart: { flexDirection: 'row', alignItems: 'stretch', gap: 1, position: 'relative' },
  barSlot: { flex: 1, position: 'relative', opacity: 0.75 },
  barSlotSelected: { opacity: 1, backgroundColor: '#f1f5f9' },
  bar: { position: 'absolute', left: 0, right: 0 },
  consumption: { position: 'absolute', left: -1, right: -1, height: 2, backgroundColor: ENERGY_CONSUMPTION_COLOR },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, marginBottom: 4 },
  legendLine: { width: 14, height: 2 },
  qualityRow: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  qualityLabel: { width: 96, fontSize: 12, color: COLORS.muted },
  qualityValue: { flex: 1, fontSize: 12, color: COLORS.text },
})
