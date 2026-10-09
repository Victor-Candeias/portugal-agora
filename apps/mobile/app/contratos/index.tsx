import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import {
  formatBaseDate, formatContractValue, normalizeBaseQuery, parseBaseParty, type BaseContract,
} from '@portugal-hoje/core'
import { useBaseContracts } from '../../hooks/useContratos'
import { Card, COLORS, EmptyText, ErrorView, LoadingView, ScreenHeader, SectionTitle, uiStyles } from '../../components/ui'

// Contratos públicos do BASE.gov.pt via API Aberta (WEB-031). `?q=` abre já com uma pesquisa
// (ex.: "Ver contratos deste NIF" no detalhe).
export default function Contratos() {
  const params = useLocalSearchParams<{ q?: string }>()
  const initial = typeof params.q === 'string' ? params.q : ''
  const [input, setInput] = useState(initial)
  const [query, setQuery] = useState<string | null>(normalizeBaseQuery(initial))

  const { data, isLoading, isError, error, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useBaseContracts(query)

  const inputQuery = normalizeBaseQuery(input)
  const inputTooShort = input.trim().length > 0 && !inputQuery
  const contracts = data?.pages.flatMap(p => p.data) ?? []
  const total = data?.pages[0]?.total ?? 0

  function submit() {
    if (inputQuery) setQuery(inputQuery)
  }

  function clear() {
    setInput('')
    setQuery(null)
  }

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="📑 Contratos Públicos"
        subtitle="Contratos celebrados por entidades públicas · Fonte: BASE.gov.pt (via API Aberta)"
        onRefresh={() => refetch()}
        refreshing={isRefetching && !isFetchingNextPage}
      />

      <Card>
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Texto, entidade ou NIF"
              placeholderTextColor={COLORS.faint}
              returnKeyType="search"
              autoCorrect={false}
              onSubmitEditing={submit}
              style={styles.input}
            />
            {input.length > 0 && (
              <TouchableOpacity onPress={clear} style={styles.clear} hitSlop={8}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={submit} disabled={!inputQuery} style={[styles.button, !inputQuery && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>🔍 Pesquisar</Text>
          </TouchableOpacity>
        </View>
        {inputTooShort && <Text style={styles.hint}>Escreva pelo menos 3 caracteres.</Text>}
      </Card>

      <SectionTitle>
        {query ? `Resultados para “${query}”` : 'Contratos mais recentes'}
        {data ? ` · ${total.toLocaleString('pt-PT')}` : ''}
      </SectionTitle>

      {isLoading && <LoadingView />}
      {isError && <ErrorView error={error} onRetry={() => refetch()} />}
      {data && contracts.length === 0 && <EmptyText>Nenhum contrato encontrado.</EmptyText>}

      {contracts.map(c => (
        <ContractRow key={c.id} contract={c} />
      ))}

      {hasNextPage && (
        <TouchableOpacity onPress={() => fetchNextPage()} disabled={isFetchingNextPage} style={styles.more}>
          <Text style={styles.moreText}>
            {isFetchingNextPage ? 'A carregar…' : `Mostrar mais (${(total - contracts.length).toLocaleString('pt-PT')} restantes)`}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

function ContractRow({ contract: c }: { contract: BaseContract }) {
  const entity = parseBaseParty(c.contractingEntity)
  const awarded = parseBaseParty(c.awarded)
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/contratos/${encodeURIComponent(c.id)}` as never)}>
      <Card>
        <Text style={styles.description} numberOfLines={3}>{c.description || 'Sem descrição'}</Text>
        <Text style={styles.party} numberOfLines={1}>
          <Text style={styles.partyLabel}>Entidade: </Text>{entity?.name ?? '—'}
        </Text>
        <Text style={styles.party} numberOfLines={1}>
          <Text style={styles.partyLabel}>Adjudicatário: </Text>{awarded?.name ?? '—'}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.value}>{formatContractValue(c.value)}</Text>
          <Text style={styles.date}>{formatBaseDate(c.date)}</Text>
        </View>
        {c.type ? <Text style={styles.type} numberOfLines={1}>{c.type}</Text> : null}
      </Card>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  form: { flexDirection: 'row', gap: 8 },
  inputWrap: { flex: 1, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 32,
    fontSize: 14,
    color: COLORS.text,
  },
  clear: { position: 'absolute', right: 10 },
  clearText: { color: COLORS.faint, fontSize: 14 },
  button: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: 8 },
  description: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  party: { fontSize: 12, color: COLORS.muted, marginTop: 1 },
  partyLabel: { color: COLORS.faint },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 },
  value: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  date: { fontSize: 12, color: COLORS.muted },
  type: {
    alignSelf: 'flex-start',
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  more: { alignItems: 'center', paddingVertical: 12 },
  moreText: { color: COLORS.link, fontWeight: '600', fontSize: 13 },
})
