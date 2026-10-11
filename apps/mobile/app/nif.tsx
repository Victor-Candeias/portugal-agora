import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { isCompanyNif, validateNif } from '@portugal-hoje/core'
import { Card, COLORS, ErrorView, LoadingView, ScreenHeader, SectionTitle, uiStyles } from '../components/ui'
import { useViesLookup } from '../hooks/useVies'

// Validação local (MOD 11), sem pedidos de rede (WEB-033). Para empresas, nome e morada no VIES (WEB-041).
export default function Nif() {
  const [input, setInput] = useState('')
  const result = input.length === 9 ? validateNif(input) : null
  const missing = 9 - input.length
  const companyNif = result?.valid === true && isCompanyNif(result.nif) ? result.nif : null
  const vies = useViesLookup(companyNif)

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="🪪 Validar NIF"
        subtitle="Formato, prefixo e dígito de controlo · Empresas: nome e morada no VIES"
      />

      <Card>
        <Text style={styles.label}>NIF (9 dígitos)</Text>
        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={text => setInput(text.replace(/\D/g, '').slice(0, 9))}
            placeholder="123456789"
            placeholderTextColor={COLORS.faint}
            keyboardType="number-pad"
            maxLength={9}
            style={styles.input}
          />
          {input.length > 0 && (
            <TouchableOpacity onPress={() => setInput('')} style={styles.clear} hitSlop={8} accessibilityLabel="Limpar">
              <Text style={styles.clearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {result?.valid === true && (
          <View style={[styles.result, styles.resultOk]}>
            <Text style={styles.resultIcon}>✅</Text>
            <View style={styles.resultBody}>
              <Text style={[styles.resultTitle, { color: '#166534' }]}>NIF válido</Text>
              <Text style={[styles.resultText, { color: '#15803d' }]}>{result.type}</Text>
            </View>
          </View>
        )}
        {result?.valid === false && (
          <View style={[styles.result, styles.resultError]}>
            <Text style={styles.resultIcon}>❌</Text>
            <View style={styles.resultBody}>
              <Text style={[styles.resultTitle, { color: '#991b1b' }]}>NIF inválido</Text>
              <Text style={[styles.resultText, { color: '#b91c1c' }]}>{result.message}</Text>
            </View>
          </View>
        )}
        {!result && (
          <Text style={styles.hint}>
            {input.length === 0 ? 'Escreva os 9 dígitos do NIF.' : `Faltam ${missing} dígito${missing > 1 ? 's' : ''}.`}
          </Text>
        )}
      </Card>

      {companyNif && (
        <Card>
          <SectionTitle>🏢 Empresa (VIES)</SectionTitle>
          {vies.isLoading && <LoadingView />}
          {vies.isError && <ErrorView error={vies.error} onRetry={() => void vies.refetch()} />}
          {vies.data?.status === 'registered' && (
            <View>
              <Text style={styles.companyName}>{vies.data.name || 'Nome não disponível'}</Text>
              {vies.data.address.map((line, i) => (
                <Text key={i} style={styles.companyAddress}>{line}</Text>
              ))}
            </View>
          )}
          {vies.data?.status === 'not-registered' && (
            <Text style={styles.companyAddress}>
              Não está registado no VIES (sem IVA intracomunitário). O NIF pode estar correto na mesma.
            </Text>
          )}
          {vies.data && (
            <Text style={styles.source}>
              Fonte: VIES, Comissão Europeia · consultado a {new Date(vies.data.checkedAt).toLocaleString('pt-PT')}
            </Text>
          )}
        </Card>
      )}

      <Text style={styles.note}>
        Um NIF válido significa só que o número está bem formado. Não confirma que está atribuído nem a quem.
        Só os NIFs de empresas e outras entidades são consultados no VIES. Os de pessoas singulares não saem do
        telemóvel.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: COLORS.muted, marginBottom: 6 },
  inputWrap: { justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 32,
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: 'monospace',
    color: COLORS.text,
  },
  clear: { position: 'absolute', right: 10 },
  clearText: { color: COLORS.faint, fontSize: 14 },
  result: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 12 },
  resultOk: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  resultError: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  resultIcon: { fontSize: 20 },
  resultBody: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '700' },
  resultText: { fontSize: 13, marginTop: 2 },
  hint: { fontSize: 12, color: COLORS.faint, marginTop: 10 },
  companyName: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  companyAddress: { fontSize: 13, color: COLORS.muted },
  source: { fontSize: 11, color: COLORS.faint, marginTop: 10 },
  note: { fontSize: 11, color: COLORS.faint, marginTop: 4 },
})
