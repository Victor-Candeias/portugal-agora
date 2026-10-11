import { useEffect, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import {
  EV_BATTERY_PRESETS_KWH,
  estimateEvCharge,
  estimateEvChargeTimes,
  formatChargeDuration,
  formatChargeTimeCalc,
  formatEvConnector,
  formatEvCostCalc,
  formatPowerKw,
  formatPrice,
  parseDecimal,
  type EvChargeSettings,
  type EvChargeTime,
  type EvChargeTimeGroup,
  type EvConnector,
} from '@portugal-hoje/core'
import { useCheapestEvTariffs } from '../hooks/useEv'
import { ChipRow, COLORS, ErrorView, LinkText, LoadingView, uiStyles } from './ui'

// Custo (WEB-043) e tempo previsto (WEB-044) de carregar a bateria de X% a Y% num posto, com o tempo em AC e DC
// em separado e o cálculo de cada valor (WEB-046).
const COLOR = '#f59e0b'
const TOP_N = 5

const PERIOD_LABELS: Record<string, string> = {
  vazio: 'vazio',
  fora_vazio: 'fora de vazio',
  simples: 'simples',
}

const BATTERY_OPTIONS = EV_BATTERY_PRESETS_KWH.map(v => ({ value: String(v), label: `${v} kWh` }))

const formatEur = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)

const formatNumber = (value: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)

interface Props {
  settings: EvChargeSettings
  onChange: (patch: Partial<EvChargeSettings>) => void
  connectors: EvConnector[]
}

export function EvChargeCost({ settings, onChange, connectors }: Props) {
  const estimate = estimateEvCharge(settings)
  const [kwh, setKwh] = useState(estimate.ok ? estimate.energyKwh : 0)
  const [showAll, setShowAll] = useState(false)

  // Espera que o utilizador pare de escrever antes de pedir o custo à API.
  const energy = estimate.ok ? estimate.energyKwh : null
  useEffect(() => {
    if (energy === null) return
    const timer = setTimeout(() => setKwh(energy), 400)
    return () => clearTimeout(timer)
  }, [energy])

  const cheapest = useCheapestEvTariffs(kwh)
  const costs = cheapest.data?.data ?? []
  const shown = showAll ? costs : costs.slice(0, TOP_N)
  const period = cheapest.data?.meta.current_period
  const battery = parseDecimal(settings.batteryKwh)
  const selectedBattery = BATTERY_OPTIONS.find(o => Number(o.value) === battery)?.value ?? null
  const times = estimate.ok ? estimateEvChargeTimes(estimate, connectors, settings) : null

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Custo e tempo do carregamento</Text>
      <ChipRow
        options={BATTERY_OPTIONS}
        value={selectedBattery}
        onChange={v => v && onChange({ batteryKwh: v })}
        allLabel={null}
        color={COLOR}
      />
      <View style={styles.fields}>
        <NumberField label="Bateria" unit="kWh" value={settings.batteryKwh} onChange={v => onChange({ batteryKwh: v })} />
        <NumberField label="De" unit="%" value={settings.fromPct} onChange={v => onChange({ fromPct: v })} />
        <NumberField label="Até" unit="%" value={settings.toPct} onChange={v => onChange({ toPct: v })} />
      </View>

      {'error' in estimate && <Text style={styles.error}>{estimate.error}</Text>}
      {estimate.ok && (
        <Text style={[uiStyles.small, styles.summary]}>
          A carregar <Text style={styles.energy}>{formatNumber(estimate.energyKwh)} kWh</Text> (
          {formatNumber(estimate.fromPct)}% → {formatNumber(estimate.toPct)}% de {formatNumber(estimate.batteryKwh)} kWh)
        </Text>
      )}

      <View style={styles.section}>
        <Text style={styles.subtitle}>⏱️ Tempo previsto</Text>
        <Text style={[uiStyles.small, styles.carHint]}>O carro aceita até:</Text>
        <View style={styles.fields}>
          <NumberField label="AC" unit="kW" value={settings.acMaxKw} onChange={v => onChange({ acMaxKw: v })} />
          <NumberField label="DC" unit="kW" value={settings.dcMaxKw} onChange={v => onChange({ dcMaxKw: v })} />
        </View>
        {times && 'error' in times && <Text style={styles.error}>{times.error}</Text>}
        {times?.ok && (
          <>
            <TimeGroup group={times.ac} />
            <TimeGroup group={times.dc} />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>💶 Custo por CEME</Text>
        {cheapest.isLoading && <LoadingView color={COLOR} />}
        {cheapest.isError && <ErrorView error={cheapest.error} onRetry={() => void cheapest.refetch()} />}
        {cheapest.data && costs.length === 0 && <Text style={uiStyles.small}>Sem tarifas disponíveis.</Text>}
        {shown.map((c, i) => (
          <View key={c.ceme} style={styles.costRow}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={styles.flex}>
              <Text style={styles.ceme} numberOfLines={1}>{c.ceme}</Text>
              <Text style={styles.price}>
                {cheapest.data
                  ? formatEvCostCalc(cheapest.data.meta.kwh_requested, c)
                  : `${formatPrice(c.price_per_kwh_eur)}/kWh`}
              </Text>
            </View>
            <Text style={[styles.total, i === 0 && styles.cheapest]}>{formatEur(c.total_cost_eur)}</Text>
          </View>
        ))}
        {costs.length > TOP_N && (
          <LinkText
            label={showAll ? 'Ver menos' : `Ver todos os CEME (${costs.length})`}
            onPress={() => setShowAll(v => !v)}
          />
        )}
      </View>

      <Text style={styles.note}>
        Tempo estimado com a menor potência entre a tomada e o carro (AC com ~10% de perdas; DC mais lento acima de
        80%). Pode variar com a temperatura, a partilha de potência e o carro. Custo: energia ao preço de cada CEME
        {period ? ` (período ${PERIOD_LABELS[period] ?? period})` : ''}, sem a tarifa do operador do posto (OPC), a tarifa
        de acesso às redes (EGME) nem as perdas no carregamento. O preço CEME por kWh é o mesmo em AC e em DC.
      </Text>
    </View>
  )
}

function TimeGroup({ group }: { group: EvChargeTimeGroup }) {
  const missing = group.unknownPower > 0
    ? `Tomadas ${group.current} sem potência indicada.`
    : `Este posto não tem tomadas ${group.current}.`
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>
        {group.current === 'AC' ? '🔌 AC (corrente alternada)' : '⚡ DC (carregamento rápido)'}
      </Text>
      {group.carOnly ? (
        <>
          <Text style={styles.calc}>{missing} Com o máximo do carro ({formatPowerKw(group.carMaxKw)}):</Text>
          <TimeRow time={group.carOnly} label={`Carregador ${group.current} · ${formatPowerKw(group.carMaxKw)}`} />
        </>
      ) : (
        group.times.map(t => {
          const label = t.connector ? formatEvConnector(t.connector) : group.current
          return <TimeRow key={label} time={t} label={label} />
        })
      )}
      {!group.carOnly && group.unknownPower > 0 && (
        <Text style={styles.calc}>
          {group.unknownPower} tipo{group.unknownPower !== 1 ? 's' : ''} de tomada {group.current} sem potência indicada.
        </Text>
      )}
    </View>
  )
}

function TimeRow({ time, label }: { time: EvChargeTime; label: string }) {
  return (
    <View style={styles.timeRow}>
      <View style={styles.flex}>
        <Text style={styles.connector} numberOfLines={1}>{label}</Text>
        {time.limitedByCar && <Text style={styles.price}>carro limita a {formatPowerKw(time.effectiveKw)}</Text>}
        <Text style={styles.calc}>{formatChargeTimeCalc(time)}</Text>
      </View>
      <Text style={styles.duration}>{formatChargeDuration(time.minutes)}</Text>
    </View>
  )
}

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <View style={uiStyles.row}>
      <Text style={uiStyles.small}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        maxLength={5}
        style={styles.input}
        accessibilityLabel={`${label} (${unit})`}
      />
      <Text style={uiStyles.small}>{unit}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
  section: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#fef3c7' },
  carHint: { marginBottom: 6 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  input: {
    minWidth: 52,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: 'white',
    textAlign: 'center',
  },
  error: { fontSize: 12, color: '#dc2626', marginTop: 8 },
  summary: { marginTop: 8, marginBottom: 4 },
  energy: { fontWeight: '700', color: COLORS.text },
  group: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fef3c7',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  groupTitle: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  calc: { fontSize: 11, color: COLORS.faint, marginTop: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  connector: { fontSize: 12, color: '#334155' },
  duration: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
  },
  rank: { width: 16, fontSize: 12, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
  flex: { flex: 1 },
  ceme: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  price: { fontSize: 11, color: COLORS.muted },
  total: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cheapest: { color: '#16a34a' },
  note: { fontSize: 11, color: COLORS.faint, marginTop: 8 },
})
