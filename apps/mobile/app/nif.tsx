import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { validateNif } from '@portugal-hoje/core'
import { Card, COLORS, ScreenHeader, uiStyles } from '../components/ui'

// Validação local (MOD 11), sem pedidos de rede (WEB-033).
export default function Nif() {
  const [input, setInput] = useState('')
  const result = input.length === 9 ? validateNif(input) : null
  const missing = 9 - input.length

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="🪪 Validar NIF"
        subtitle="Formato, prefixo e dígito de controlo · Validação local, sem envio de dados"
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

      <Text style={styles.note}>
        Um NIF válido significa só que o número está bem formado. Não confirma que está atribuído nem a quem.
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
  note: { fontSize: 11, color: COLORS.faint, marginTop: 4 },
})
