import { useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { formatAreaKm2, formatPtPhone, municipalityDistrict } from '@portugal-hoje/core'
import { BoundaryMap } from '../../components/BoundaryMap'
import { Card, COLORS, ErrorView, LinkText, LoadingView, SectionTitle, uiStyles } from '../../components/ui'
import { useMunicipalities, useMunicipality, useMunicipalityParishes } from '../../hooks/useConcelhos'

// Ficha do concelho (WEB-042): mostra logo os dados da lista em cache e junta a fronteira quando chega.
// As freguesias (WEB-049) vêm da geoapi.pt; a seleção é partilhada entre a lista e o mapa.
export default function ConcelhoDetalhe() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const s = typeof slug === 'string' ? slug : undefined
  const list = useMunicipalities()
  const detail = useMunicipality(s)
  const m = detail.data ?? list.data?.find(x => x.slug === s)
  const parishes = useMunicipalityParishes(m?.codigoine)
  const parishList = parishes.data?.parishes
  // A seleção fica associada ao concelho, para não passar para outro ao mudar de ficha.
  const [selection, setSelection] = useState<{ slug?: string; code: string } | null>(null)
  const selectedCode = selection && selection.slug === s ? selection.code : null
  const selected = parishList?.find(p => p.code === selectedCode) ?? null
  const selectParish = (code: string | null) => setSelection(code ? { slug: s, code } : null)

  const phone = formatPtPhone(m?.phone)
  const area = formatAreaKm2(m?.area_ha)

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      {!m && (detail.isLoading || list.isLoading) && <LoadingView />}
      {!m && detail.isError && <ErrorView error={detail.error} onRetry={() => detail.refetch()} />}

      {m && (
        <>
          <Card>
            <Text style={styles.name}>{m.name}</Text>
            <Text style={styles.district}>{m.district ? 'Distrito' : 'Região'}: {municipalityDistrict(m) || '—'}</Text>
            <View style={styles.row}>
              <Field label="Área" value={area ?? '—'} />
              <Field label="Código INE" value={m.codigoine} />
            </View>
          </Card>

          <Card>
            <SectionTitle>🏛️ Câmara Municipal</SectionTitle>
            {phone && (
              <View style={styles.contact}>
                <Text style={styles.fieldLabel}>Telefone</Text>
                <LinkText label={`📞 ${phone}`} onPress={() => Linking.openURL(`tel:${m.phone?.replace(/\s/g, '')}`)} />
              </View>
            )}
            {m.email && (
              <View style={styles.contact}>
                <Text style={styles.fieldLabel}>Email</Text>
                <LinkText label={`✉️ ${m.email}`} onPress={() => Linking.openURL(`mailto:${m.email}`)} />
              </View>
            )}
            {m.postal_code && (
              <View style={styles.contact}>
                <Text style={styles.fieldLabel}>Código postal</Text>
                <Text style={styles.fieldValue}>{m.postal_code}</Text>
              </View>
            )}
            {m.website && (
              <View style={styles.contact}>
                <Text style={styles.fieldLabel}>Site</Text>
                <LinkText label={m.website} onPress={() => Linking.openURL(m.website!)} />
              </View>
            )}
            {!phone && !m.email && !m.postal_code && !m.website && (
              <Text style={styles.muted}>Sem contactos disponíveis.</Text>
            )}
          </Card>

          <Card>
            <SectionTitle>🗺️ {parishList?.length ? 'Limites do concelho e das freguesias' : 'Limites do concelho'}</SectionTitle>
            {selected && (
              <View style={styles.selectedRow}>
                <Text style={styles.selectedName} numberOfLines={2}>
                  {selected.name}
                  {formatAreaKm2(selected.area_ha) ? <Text style={styles.selectedArea}> · {formatAreaKm2(selected.area_ha)}</Text> : null}
                </Text>
                <LinkText label="Ver concelho" onPress={() => selectParish(null)} />
              </View>
            )}
            {detail.data?.geojson ? (
              <>
                <BoundaryMap
                  boundary={detail.data.geojson}
                  parishes={parishList}
                  selectedParish={selectedCode}
                  onSelectParish={selectParish}
                />
                {!!parishList?.length && <Text style={styles.hint}>Toque numa freguesia para a destacar.</Text>}
              </>
            ) : detail.isLoading ? (
              <LoadingView />
            ) : detail.isError ? (
              <ErrorView error={detail.error} onRetry={() => detail.refetch()} />
            ) : (
              <Text style={styles.muted}>Mapa não disponível.</Text>
            )}
          </Card>

          <Card>
            <SectionTitle>🏘️ Freguesias{parishList ? ` (${parishList.length})` : ''}</SectionTitle>
            {parishList ? (
              parishList.map(p => {
                const isSelected = p.code === selectedCode
                return (
                  <Pressable
                    key={p.code}
                    onPress={() => selectParish(isSelected ? null : p.code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={({ pressed }) => [styles.parish, isSelected && styles.parishSelected, pressed && styles.parishPressed]}
                  >
                    <Text style={[styles.parishName, isSelected && styles.parishNameSelected]}>{p.name}</Text>
                    <Text style={styles.parishArea}>{formatAreaKm2(p.area_ha) ?? '—'}</Text>
                  </Pressable>
                )
              })
            ) : parishes.isLoading ? (
              <LoadingView />
            ) : parishes.isError ? (
              <ErrorView error={parishes.error} onRetry={() => parishes.refetch()} />
            ) : (
              <Text style={styles.muted}>Freguesias não disponíveis.</Text>
            )}
          </Card>

          <Text style={styles.source}>
            Fonte: API Aberta (/geo/municipalities); freguesias: geoapi.pt (CAOP, DGT), limites simplificados.
          </Text>
        </>
      )}
    </ScrollView>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  district: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.faint, textTransform: 'uppercase', marginBottom: 2 },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  contact: { marginBottom: 10 },
  muted: { fontSize: 13, color: COLORS.faint },
  hint: { fontSize: 11, color: COLORS.faint, marginTop: 6 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  selectedName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#c2410c' },
  selectedArea: { fontWeight: '400', color: COLORS.muted },
  parish: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  parishSelected: { borderColor: '#fdba74', backgroundColor: '#fff7ed' },
  parishPressed: { opacity: 0.7 },
  parishName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1e293b' },
  parishNameSelected: { color: '#9a3412', fontWeight: '700' },
  parishArea: { fontSize: 12, color: COLORS.muted, fontVariant: ['tabular-nums'] },
  source: { fontSize: 11, color: COLORS.faint, marginTop: 4 },
})
