import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { formatAreaKm2, formatPtPhone, municipalityDistrict } from '@portugal-hoje/core'
import { BoundaryMap } from '../../components/BoundaryMap'
import { Card, COLORS, ErrorView, LinkText, LoadingView, SectionTitle, uiStyles } from '../../components/ui'
import { useMunicipalities, useMunicipality } from '../../hooks/useConcelhos'

// Ficha do concelho (WEB-042): mostra logo os dados da lista em cache e junta a fronteira quando chega.
export default function ConcelhoDetalhe() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const s = typeof slug === 'string' ? slug : undefined
  const list = useMunicipalities()
  const detail = useMunicipality(s)
  const m = detail.data ?? list.data?.find(x => x.slug === s)

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
            <SectionTitle>🗺️ Limites do concelho</SectionTitle>
            {detail.data?.geojson ? (
              <BoundaryMap boundary={detail.data.geojson} />
            ) : detail.isLoading ? (
              <LoadingView />
            ) : detail.isError ? (
              <ErrorView error={detail.error} onRetry={() => detail.refetch()} />
            ) : (
              <Text style={styles.muted}>Mapa não disponível.</Text>
            )}
          </Card>

          <Text style={styles.source}>Fonte: API Aberta (/geo/municipalities).</Text>
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
  source: { fontSize: 11, color: COLORS.faint, marginTop: 4 },
})
