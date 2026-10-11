import { useEffect, useState } from 'react'
import { ScrollView, View, Text, TextInput, StyleSheet } from 'react-native'
import { formatPrice, type EvTariff } from '@portugal-hoje/core'
import { useCheapestEvTariffs, useEvTariffs } from '../../hooks/useEv'
import { EvChargers } from '../../components/EvChargers'
import {
  Badge,
  Card,
  ChipRow,
  EmptyText,
  ErrorView,
  LoadingView,
  Notice,
  ScreenHeader,
  SectionTitle,
  SegmentedTabs,
  uiStyles,
} from '../../components/ui'

const COLOR = '#f59e0b'
// Quantidades típicas: carga parcial (5–20), bateria média (30–60) e grande (75–100). "Outro" aceita até MAX_KWH.
const KWH_PRESETS = ['5', '10', '20', '30', '40', '50', '60', '75', '100'] as const
const MAX_KWH = 200
const DEFAULT_KWH = 30

function parseKwh(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) && value > 0 && value <= MAX_KWH ? value : null
}

// Postos perto de mim (Open Charge Map, WEB-040) e tarifas CEME (API Aberta, MOB-008).
type EvTab = 'chargers' | 'tariffs'
const TABS: { value: EvTab; label: string }[] = [
  { value: 'chargers', label: 'Postos perto de mim' },
  { value: 'tariffs', label: 'Tarifas CEME' },
]

const PERIOD_LABELS: Record<string, string> = {
  vazio: 'Bi-horária',
  fora_vazio: 'fora de vazio',
  simples: 'Simples',
}

const formatEur = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)

const formatKwh = (value: number) =>
  `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(value)} kWh`

export default function EV() {
  const [tab, setTab] = useState<EvTab>('chargers')
  const [kwhInput, setKwhInput] = useState(String(DEFAULT_KWH))
  const [kwh, setKwh] = useState(DEFAULT_KWH)
  const tariffs = useEvTariffs()
  const cheapest = useCheapestEvTariffs(kwh)

  // Espera que o utilizador pare de escrever antes de pedir o custo à API.
  useEffect(() => {
    const value = parseKwh(kwhInput)
    if (value === null) return
    const timer = setTimeout(() => setKwh(value), 400)
    return () => clearTimeout(timer)
  }, [kwhInput])

  const selectPreset = (value: string) => {
    setKwhInput(value)
    setKwh(Number(value))
  }

  const inputInvalid = kwhInput.trim() !== '' && parseKwh(kwhInput) === null
  const selectedPreset = (KWH_PRESETS as readonly string[]).includes(kwhInput.trim()) ? kwhInput.trim() : null

  const refresh = () => {
    void tariffs.refetch()
    void cheapest.refetch()
  }

  const period = cheapest.data?.meta.current_period
  const fixed = tariffs.data?.data.filter(t => t.tariff_type === 'fixed') ?? []
  const indexed = tariffs.data?.data.filter(t => t.tariff_type === 'indexed') ?? []

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      <ScreenHeader
        title="⚡ Carregamento EV"
        subtitle={tab === 'chargers' ? 'Postos de carregamento · Open Charge Map' : 'Tarifas dos comercializadores (CEME)'}
        onRefresh={tab === 'tariffs' ? refresh : undefined}
        refreshing={tab === 'tariffs' && (tariffs.isFetching || cheapest.isFetching)}
      />

      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'chargers' && <EvChargers />}

      {tab === 'tariffs' && (
      <>
      <Card>
        <SectionTitle>Simulador de carregamento</SectionTitle>
        <Text style={[uiStyles.small, styles.hint]}>
          Custo de energia por CEME{period ? `, tarifa atual (${PERIOD_LABELS[period] ?? period})` : ''}.
        </Text>
        <ChipRow
          options={KWH_PRESETS.map(v => ({ value: v as string, label: `${v} kWh` }))}
          value={selectedPreset}
          onChange={v => v && selectPreset(v)}
          allLabel={null}
          color={COLOR}
        />
        <View style={[uiStyles.row, styles.customRow]}>
          <Text style={uiStyles.small}>Outro:</Text>
          <TextInput
            value={kwhInput}
            onChangeText={setKwhInput}
            keyboardType="decimal-pad"
            maxLength={6}
            placeholder={String(DEFAULT_KWH)}
            placeholderTextColor="#94a3b8"
            style={[styles.kwhInput, inputInvalid && styles.kwhInputInvalid]}
            accessibilityLabel="Energia a carregar (kWh)"
          />
          <Text style={uiStyles.small}>kWh</Text>
        </View>
        {inputInvalid && <Text style={styles.inputError}>Indique um valor entre 1 e {MAX_KWH} kWh.</Text>}
        <Text style={[uiStyles.small, styles.hint]}>A simular {formatKwh(kwh)}.</Text>
        {cheapest.isLoading && <LoadingView color={COLOR} />}
        {cheapest.isError && <ErrorView error={cheapest.error} onRetry={() => void cheapest.refetch()} />}
        {cheapest.data?.data.map((c, i) => (
          <View key={c.ceme} style={styles.costRow}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={styles.costInfo}>
              <Text style={uiStyles.strong} numberOfLines={1}>{c.ceme}</Text>
              <Text style={uiStyles.small}>
                {formatPrice(c.price_per_kwh_eur)}/kWh
                {c.activation_fee_eur > 0 ? ` + ativação ${formatEur(c.activation_fee_eur)}` : ''}
              </Text>
            </View>
            <Text style={[styles.costTotal, i === 0 && { color: '#16a34a' }]}>{formatEur(c.total_cost_eur)}</Text>
          </View>
        ))}
      </Card>

      <Notice>
        Valores sem a tarifa do operador do posto (OPC) nem a tarifa de acesso às redes (EGME). Fonte: API Aberta.
      </Notice>

      {tariffs.isLoading && <LoadingView color={COLOR} />}
      {tariffs.isError && <ErrorView error={tariffs.error} onRetry={() => void tariffs.refetch()} />}
      {tariffs.data && tariffs.data.data.length === 0 && <EmptyText>Sem tarifas disponíveis</EmptyText>}

      {fixed.length > 0 && (
        <>
          <Text style={styles.groupTitle}>Tarifas fixas</Text>
          {fixed.map(t => <TariffCard key={t.ceme} tariff={t} />)}
        </>
      )}
      {indexed.length > 0 && (
        <>
          <Text style={styles.groupTitle}>Tarifas indexadas (OMIE)</Text>
          {indexed.map(t => <TariffCard key={t.ceme} tariff={t} />)}
        </>
      )}
      </>
      )}
    </ScrollView>
  )
}

function TariffCard({ tariff: t }: { tariff: EvTariff }) {
  const biHoraria = t.price_vazio_eur_kwh !== undefined && t.price_vazio_eur_kwh !== t.price_normal_eur_kwh
  return (
    <Card>
      <View style={uiStyles.row}>
        <Text style={[uiStyles.strong, styles.costInfo]} numberOfLines={1}>{t.ceme}</Text>
        <Badge label={PERIOD_LABELS[t.period_type] ?? t.period_type} color="#92400e" background="#fef3c7" />
      </View>
      {t.notes ? <Text style={[uiStyles.small, styles.notes]}>{t.notes}</Text> : null}
      <View style={styles.prices}>
        {t.current_price_eur_kwh != null && (
          <Price label="Agora" value={`${formatPrice(t.current_price_eur_kwh)}/kWh`} highlight />
        )}
        {biHoraria && (
          <>
            <Price label="Vazio" value={formatPrice(t.price_vazio_eur_kwh!)} />
            {t.price_normal_eur_kwh !== undefined && <Price label="Fora vazio" value={formatPrice(t.price_normal_eur_kwh)} />}
          </>
        )}
        {t.activation_fee_eur > 0 && <Price label="Ativação" value={formatEur(t.activation_fee_eur)} />}
      </View>
      {t.note ? <Text style={[uiStyles.small, styles.notes]}>{t.note}</Text> : null}
    </Card>
  )
}

function Price({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View>
      <Text style={uiStyles.label}>{label}</Text>
      <Text style={[styles.priceValue, highlight && { color: COLOR }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hint: { marginBottom: 8 },
  customRow: { marginTop: 4, marginBottom: 6 },
  kwhInput: {
    width: 80,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: 'white',
  },
  kwhInputInvalid: { borderColor: '#fca5a5' },
  inputError: { fontSize: 12, color: '#dc2626', marginBottom: 6 },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  rank: { width: 20, fontSize: 13, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
  costInfo: { flex: 1 },
  costTotal: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  groupTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: 8, marginBottom: 8 },
  notes: { marginTop: 4 },
  prices: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  priceValue: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginTop: 2 },
})
