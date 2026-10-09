import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  baseContractUrl, formatBaseDate, formatContractValue, parseBaseParty, type BaseParty,
} from '@portugal-hoje/core'
import { useBaseContract } from '../../hooks/useContratos'
import { Card, COLORS, ErrorView, LinkText, LoadingView, SectionTitle, uiStyles } from '../../components/ui'

// Detalhe de um contrato do BASE (WEB-031).
export default function ContratoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: c, isLoading, isError, error, refetch } = useBaseContract(typeof id === 'string' ? id : undefined)

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content}>
      {isLoading && <LoadingView />}
      {isError && <ErrorView error={error} onRetry={() => refetch()} />}

      {c && (
        <>
          <Card>
            <Text style={styles.number}>Contrato n.º {c.id}</Text>
            <Text style={styles.description}>{c.description || 'Sem descrição'}</Text>
            <Field label="Preço contratual">
              <Text style={styles.value}>{formatContractValue(c.value)}</Text>
            </Field>
            <View style={styles.row}>
              <Field label="Data de celebração" style={styles.half}>
                <Text style={styles.fieldValue}>{formatBaseDate(c.date)}</Text>
              </Field>
              <Field label="Procedimento" style={styles.half}>
                <Text style={styles.fieldValue}>{c.type || '—'}</Text>
              </Field>
            </View>
          </Card>

          <PartyCard title="Entidade adjudicante" party={parseBaseParty(c.contractingEntity)} />
          <PartyCard title="Adjudicatário" party={parseBaseParty(c.awarded)} />

          <View style={uiStyles.actions}>
            <LinkText label="🔗 Ver no portal BASE" onPress={() => Linking.openURL(baseContractUrl(c.id))} />
          </View>
          <Text style={styles.source}>Fonte: BASE.gov.pt (IMPIC), via API Aberta · sincronizado diariamente.</Text>
        </>
      )}
    </ScrollView>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function PartyCard({ title, party }: { title: string; party: BaseParty | null }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {party ? (
        <>
          <Text style={styles.partyName}>{party.name}</Text>
          {party.nif ? <Text style={styles.nif}>NIF {party.nif}</Text> : null}
          <View style={uiStyles.actions}>
            <LinkText
              label={`🔍 Ver contratos ${party.nif ? 'deste NIF' : 'com este nome'}`}
              onPress={() => router.push({ pathname: '/contratos', params: { q: party.nif ?? party.name } } as never)}
            />
          </View>
        </>
      ) : (
        <Text style={styles.nif}>Não indicado</Text>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  number: { fontSize: 11, fontWeight: '600', color: COLORS.muted, textTransform: 'uppercase' },
  description: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 4, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  field: { marginTop: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.faint, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  value: { fontSize: 24, fontWeight: '700', color: COLORS.primary, marginTop: 2 },
  partyName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  nif: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  source: { fontSize: 11, color: COLORS.faint, marginTop: 10 },
})
