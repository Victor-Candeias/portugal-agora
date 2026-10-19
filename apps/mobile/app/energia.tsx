import { useState } from 'react'
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import {
  ENERGY_CLASSIFICATION_COLORS,
  ENERGY_CLASSIFICATION_LABELS,
  ENERGY_CONSUMPTION_COLOR,
  ENERGY_NOT_INCLUDED_NOTE,
  ENERGY_NOW_QUESTION,
  ENERGY_RANGE_INFO,
  ENERGY_RANGE_LABELS,
  ENERGY_VERDICT_STYLES,
  energyCsv,
  energyCsvFileName,
  energyHourlySlots,
  energyMix,
  energyNowInfo,
  energyRangeSummary,
  energyQualityInfo,
  energyStatusInfo,
  formatEnergy,
  formatEnergyDate,
  formatLisbonDateTime,
  formatSharePct,
  renewableToConsumptionPct,
  type EnergyDaily,
  type EnergyDatasetMeta,
  type EnergyInterval,
  type EnergyDay,
  type EnergyRange,
  type EnergyStatus,
  type EnergyTimeseries,
} from '@portugal-hoje/core'
import { useEnergy, useEnergyIntraday, useEnergyStatus } from '../hooks/useEnergy'
import { Card, COLORS, ErrorView, LinkText, LoadingView, Notice, ScreenHeader, SectionTitle, uiStyles } from '../components/ui'

// Painel de energia elétrica: indicador «agora» com a série horária ENTSO-E (WEB-058), análise 24h/7d/30d
// com CSV (WEB-059), balanço diário oficial da REN (WEB-056) e estado das fontes/reconciliação (WEB-060). O diário é sempre «último dia disponível», nunca «agora».
// Não entra no Android Auto.
export default function EnergiaScreen() {
  const energy = useEnergy()
  const intraday = useEnergyIntraday('24h')
  const status = useEnergyStatus()
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
          void status.refetch()
        }}
        refreshing={energy.isFetching || intraday.isFetching}
      />

      {intraday.data ? (
        <>
          <NowCard series={intraday.data.data} offline={intraday.data.offline} savedAt={intraday.data.savedAt} />
        </>
      ) : (
        intraday.isError && (
          <Notice>
            ⏱️ Série horária (ENTSO-E) indisponível: não é possível dizer o que acontece «agora». Mostram-se só os últimos dados
            disponíveis do balanço diário da REN.
          </Notice>
        )
      )}

      {(intraday.data || daily) && <AnalysisCard series24={intraday.data?.data} daily={daily} />}

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

      {status.data && <SourcesCard status={status.data} />}
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

type AnalysisDataset = EnergyDatasetMeta & { points: EnergyInterval[] }

function AnalysisCard({ series24, daily }: { series24: EnergyTimeseries | undefined; daily: EnergyDaily | undefined }) {
  const [chosen, setChosen] = useState<EnergyRange | null>(null)
  const range: EnergyRange = chosen ?? (series24 ? '24h' : '30d')
  const series7d = useEnergyIntraday('7d', range === '7d')
  const dataset: AnalysisDataset | null =
    range === '24h' ? series24 ?? null : range === '7d' ? series7d.data?.data ?? null : daily ? { ...daily, points: daily.days } : null
  const available: Record<EnergyRange, boolean> = { '24h': !!series24, '7d': !!series24, '30d': !!daily }

  const share = () => {
    if (!dataset) return
    // Partilha como texto (Share do React Native): evita juntar expo-sharing (módulo nativo) só para isto.
    void Share.share({ title: energyCsvFileName(dataset.source, range), message: energyCsv(dataset.points, dataset) })
  }

  return (
    <Card>
      <SectionTitle>Análise · {ENERGY_RANGE_LABELS[range]}</SectionTitle>
      <View style={styles.rangeRow}>
        {(Object.keys(ENERGY_RANGE_LABELS) as EnergyRange[]).map(r => (
          <Pressable
            key={r}
            onPress={() => setChosen(r)}
            disabled={!available[r]}
            style={[styles.rangeButton, r === range && styles.rangeButtonActive, !available[r] && styles.disabled]}
            accessibilityRole="tab"
            accessibilityState={{ selected: r === range, disabled: !available[r] }}
          >
            <Text style={[styles.rangeText, r === range && styles.rangeTextActive]}>{ENERGY_RANGE_LABELS[r]}</Text>
          </Pressable>
        ))}
        <Pressable onPress={share} disabled={!dataset} style={[styles.rangeButton, !dataset && styles.disabled]} accessibilityLabel="Partilhar CSV">
          <Text style={styles.rangeText}>📤 CSV</Text>
        </Pressable>
      </View>
      <Text style={[uiStyles.small, styles.hint]}>
        {ENERGY_RANGE_INFO[range].source} · {ENERGY_RANGE_INFO[range].detail}
      </Text>
      {range === '7d' && series7d.isLoading && <Text style={uiStyles.small}>A carregar 7 dias…</Text>}
      {range === '7d' && series7d.isError && <Text style={uiStyles.small}>Série de 7 dias indisponível.</Text>}
      {dataset && <AnalysisBody dataset={dataset} range={range} />}
    </Card>
  )
}

const ANALYSIS_HEIGHT = 130
const EXCHANGE_HEIGHT = 80

function AnalysisBody({ dataset, range }: { dataset: AnalysisDataset; range: EnergyRange }) {
  const hourly = range !== '30d'
  const unit = dataset.points[0]?.unit ?? 'MW'
  const slots = hourly
    ? energyHourlySlots(dataset.points).map(s => ({ key: s.intervalStartUtc, tick: range === '24h' ? s.time : s.label.slice(0, 5), label: s.label, point: s.point }))
    : dataset.points.map(p => {
        const label = formatEnergyDate((p as EnergyDay).date)
        return { key: p.intervalStartUtc, tick: label.slice(0, 5), label, point: p as EnergyInterval | null }
      })
  // 24 h: barras lado a lado; 7 d e 30 d: empilhadas (muitos intervalos para o ecrã).
  const stacked = range !== '24h'
  const hi =
    Math.max(
      1,
      ...slots.map(({ point: p }) =>
        p ? Math.max(stacked ? p.renewable + p.nonRenewable + p.storage : Math.max(p.renewable, p.nonRenewable, p.storage), p.consumption ?? 0) : 0,
      ),
    ) * 1.05
  const y = (v: number) => (Math.max(0, v) / hi) * ANALYSIS_HEIGHT
  const nets = slots.map(({ point: p }) => (p && p.imports !== null && p.exports !== null ? p.imports - p.exports : null))
  const netHi = Math.max(1, ...nets.map(n => Math.abs(n ?? 0)))
  const summary = energyRangeSummary(dataset.points)
  const gaps = slots.filter(s => s.point?.quality !== 'complete').length
  const per = hourly ? 'horas' : 'dias'
  const [completeWord, gapWord] = hourly ? ['completas', 'incompletas ou sem dados'] : ['completos', 'incompletos ou sem dados']
  const middle = slots[Math.floor(slots.length / 2)]

  return (
    <>
      <View style={styles.summaryGrid}>
        <Total label="Renovável" value={formatEnergy(summary.renewableGWh, 'GWh')} style={styles.summaryItem} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Total label="Não renovável" value={formatEnergy(summary.nonRenewableGWh, 'GWh')} style={styles.summaryItem} color={ENERGY_CLASSIFICATION_COLORS.non_renewable} />
        <Total label="Quota (ponderada)" value={formatSharePct(summary.renewableSharePct)} style={styles.summaryItem} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Total label={`${per[0].toUpperCase()}${per.slice(1)} + renovável`} value={`${summary.renewableAbove} de ${summary.complete}`} style={styles.summaryItem} color={ENERGY_CLASSIFICATION_COLORS.renewable} />
        <Total label="Produção" value={formatEnergy(summary.productionGWh, 'GWh')} style={styles.summaryItem} color={COLORS.text} />
        <Total label="Consumo" value={formatEnergy(summary.consumptionGWh, 'GWh')} style={styles.summaryItem} color={ENERGY_CONSUMPTION_COLOR} />
        <Total
          label={summary.netImportsGWh !== null && summary.netImportsGWh < 0 ? 'Saldo exportador' : 'Saldo importador'}
          value={formatEnergy(summary.netImportsGWh === null ? null : Math.abs(summary.netImportsGWh), 'GWh')}
          color="#0369a1"
          style={styles.summaryItem}
        />
        <Total label="Import. / export." value={`${formatEnergy(summary.importsGWh, 'GWh', 0)} / ${formatEnergy(summary.exportsGWh, 'GWh', 0)}`} style={styles.summaryItem} color="#0369a1" />
      </View>

      <Text style={styles.chartTitle}>Produção por classificação ({unit}{stacked ? ', empilhada' : ''})</Text>
      <View style={[styles.chart, { height: ANALYSIS_HEIGHT, gap: stacked ? 0 : 1 }]}>
        {slots.map(({ key, label, point: p }) => {
          // Intervalos incompletos ficam em branco (valores por defeito); o consumo mostra-se se existir.
          const ok = p?.quality === 'complete'
          return (
            <View
              key={key}
              style={stacked ? styles.stackSlot : styles.hourSlot}
              accessibilityLabel={
                ok ? `${label}: renovável ${formatEnergy(p.renewable, unit, 0)}, não renovável ${formatEnergy(p.nonRenewable, unit, 0)}` : `${label}: sem dados completos`
              }
            >
              {ok &&
                (stacked ? (
                  <>
                    <View style={[styles.bar, { bottom: 0, height: y(p.renewable), backgroundColor: ENERGY_CLASSIFICATION_COLORS.renewable }]} />
                    <View style={[styles.bar, { bottom: y(p.renewable), height: y(p.nonRenewable), backgroundColor: ENERGY_CLASSIFICATION_COLORS.non_renewable }]} />
                    <View
                      style={[styles.bar, { bottom: y(p.renewable) + y(p.nonRenewable), height: y(p.storage), backgroundColor: ENERGY_CLASSIFICATION_COLORS.storage }]}
                    />
                  </>
                ) : (
                  <>
                    <View style={[styles.hourBar, { height: y(p.renewable), backgroundColor: ENERGY_CLASSIFICATION_COLORS.renewable }]} />
                    <View style={[styles.hourBar, { height: y(p.nonRenewable), backgroundColor: ENERGY_CLASSIFICATION_COLORS.non_renewable }]} />
                    <View style={[styles.hourBar, { height: y(p.storage), backgroundColor: ENERGY_CLASSIFICATION_COLORS.storage }]} />
                  </>
                ))}
              {p?.consumption != null && <View style={[styles.consumption, { bottom: y(p.consumption) - 1 }]} />}
            </View>
          )
        })}
      </View>
      <View style={styles.xAxis}>
        <Text style={uiStyles.small}>{slots[0]?.tick}</Text>
        {slots.length > 2 && <Text style={uiStyles.small}>{middle.tick}</Text>}
        <Text style={uiStyles.small}>{slots[slots.length - 1]?.tick}</Text>
      </View>
      <View style={styles.legend}>
        <Legend color={ENERGY_CLASSIFICATION_COLORS.renewable} label="Renovável" />
        <Legend color={ENERGY_CLASSIFICATION_COLORS.non_renewable} label="Não renovável" />
        <Legend color={ENERGY_CLASSIFICATION_COLORS.storage} label="Armazenamento" />
        <Legend color={ENERGY_CONSUMPTION_COLOR} label="Consumo" line />
      </View>

      <Text style={styles.chartTitle}>Saldo de trocas ({unit}): ▲ importador · ▼ exportador</Text>
      <View style={[styles.chart, { height: EXCHANGE_HEIGHT, gap: stacked ? 0 : 1 }]}>
        <View style={styles.zeroLine} />
        {slots.map(({ key }, i) => {
          const n = nets[i]
          const h = n === null ? 0 : (Math.abs(n) / netHi) * (EXCHANGE_HEIGHT / 2)
          return (
            <View key={key} style={styles.stackSlot}>
              {n !== null && (
                <View
                  style={[
                    styles.bar,
                    n >= 0 ? { bottom: EXCHANGE_HEIGHT / 2, height: h, backgroundColor: '#0369a1' } : { bottom: EXCHANGE_HEIGHT / 2 - h, height: h, backgroundColor: '#ea580c' },
                  ]}
                />
              )}
            </View>
          )
        })}
      </View>
      <Text style={[uiStyles.small, styles.note]}>
        Totais em GWh só com {per} {completeWord} ({summary.complete} de {slots.length}
        {gaps > 0 ? `; ${gaps} ${gapWord} em branco` : ''}
        {summary.balanceMissing > 0 ? `; ${summary.balanceMissing} sem consumo ou trocas fora desses totais` : ''}). Consumo e produção não coincidem: a
        diferença é o saldo de trocas com Espanha. O armazenamento não é renovável nem não renovável. Fonte: {dataset.sourceName}.
      </Text>
      <Text style={[uiStyles.small, styles.note]}>{ENERGY_NOT_INCLUDED_NOTE}</Text>
    </>
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

function Total({ label, value, color, style }: { label: string; value: string; color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.total, style]}>
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

function SourcesCard({ status }: { status: EnergyStatus }) {
  const info = energyStatusInfo(status)
  return (
    <Card>
      <SectionTitle>Estado das fontes</SectionTitle>
      {info.problems && <Notice>⚠️ A última recolha não atualizou todas as fontes: os dados podem estar atrasados.</Notice>}
      {info.sources.map(s => (
        <View key={s.source} style={styles.sourceBlock}>
          <Text style={styles.sourceName}>
            {s.ok ? '🟢' : s.status === 'failed' ? '🔴' : '🟠'} {s.name}
          </Text>
          <Text style={[uiStyles.small, styles.note]}>
            {s.statusLabel}
            {s.status === 'fresh' && s.stale ? ' · dados fora do prazo' : ''}
          </Text>
          <Row label="Recolhido em" value={s.fetchedAt} />
          <Row label="Último período" value={`${s.latestEnd} (há ${s.delay})`} />
          <Row label="Períodos" value={s.completeness} />
          {s.error && <Row label="Erro" value={s.error} />}
        </View>
      ))}
      {info.reconciliation.length > 0 && (
        <>
          <Text style={styles.chartTitle}>
            Reconciliação REN → ENTSO-E · {info.divergentDays ? `${info.divergentDays} dia(s) com divergência` : 'sem divergências'}
          </Text>
          <Text style={[uiStyles.small, styles.hint]}>Tolerância {info.tolerance}.</Text>
          {info.reconciliation.map(r => (
            <View key={r.date} style={[styles.sourceBlock, !r.ok && styles.divergent]}>
              <Text style={styles.sourceName}>
                {r.ok ? '✔' : '⚠'} {r.date}
              </Text>
              <Row label="Produção" value={r.production} />
              <Row label="Não renovável" value={r.nonRenewable} />
              <Row label="Consumo" value={r.consumption} />
              <Row label="Renovável*" value={r.renewable} />
            </View>
          ))}
          <Text style={[uiStyles.small, styles.note]}>* {info.note}</Text>
        </>
      )}
      <Text style={[uiStyles.small, styles.note]}>Verificado em {info.checkedAt} (Lisboa), na última execução da recolha.</Text>
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
  stackSlot: { flex: 1, position: 'relative' },
  zeroLine: { position: 'absolute', left: 0, right: 0, top: EXCHANGE_HEIGHT / 2, height: 1, backgroundColor: '#cbd5e1' },
  summaryItem: { flex: 0, width: '50%' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, marginBottom: 10 },
  chartTitle: { fontSize: 12, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 4 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  rangeButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  rangeButtonActive: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  rangeText: { fontSize: 13, color: '#334155' },
  rangeTextActive: { color: 'white', fontWeight: '700' },
  disabled: { opacity: 0.4 },
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
  sourceBlock: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingVertical: 8 },
  sourceName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  divergent: { backgroundColor: '#fffbeb' },
})
