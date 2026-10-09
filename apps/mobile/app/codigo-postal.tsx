import { useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { isValidPostalCode } from '@portugal-hoje/core'
import { useCodigoPostal } from '../hooks/useCodigoPostal'
import { SinglePointMap } from '../components/PointsMap'
import { Card, COLORS, ErrorView, LinkText, LoadingView, ScreenHeader, SectionTitle, uiStyles } from '../components/ui'

/** Máscara NNNN-NNN enquanto se escreve (só dígitos, máx. 7). */
function formatInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 7)
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits
}

export default function CodigoPostal() {
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [showMap, setShowMap] = useState(false)

  const { data, isLoading, isError, error, refetch } = useCodigoPostal(query)
  const valid = isValidPostalCode(query)
  const canSubmit = isValidPostalCode(input)

  function submit() {
    if (!canSubmit) return
    setQuery(input)
    setShowMap(false)
  }

  function clear() {
    setInput('')
    setQuery('')
    setShowMap(false)
  }

  const lat = data?.centro?.[0]
  const lng = data?.centro?.[1]
  const hasCoords = lat != null && lng != null

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="📮 Código Postal" subtitle="Pesquise informação por código postal · Fonte: geoapi.pt" />

      <Card>
        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <TextInput
              value={input}
              onChangeText={text => setInput(formatInput(text))}
              placeholder="xxxx-xxx"
              placeholderTextColor={COLORS.faint}
              keyboardType="number-pad"
              maxLength={8}
              returnKeyType="search"
              onSubmitEditing={submit}
              style={styles.input}
            />
            {input.length > 0 && (
              <TouchableOpacity onPress={clear} style={styles.clear} hitSlop={8}>
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={submit} disabled={!canSubmit} style={[styles.button, !canSubmit && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>🔍 Pesquisar</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {isLoading && <LoadingView />}
      {isError && <ErrorView error={error} onRetry={() => refetch()} />}

      {data && valid && (
        <>
          <Card>
            <Text style={styles.cp}>{data.CP}</Text>
            <Text style={styles.designation}>{data['Designação Postal']}</Text>
            <View style={styles.grid}>
              <Field label="Distrito" value={data.Distrito} />
              <Field label="Concelho" value={data.Concelho} />
              <Field label="Localidade" value={data.Localidade} />
            </View>
            {hasCoords && (
              <View style={uiStyles.actions}>
                <LinkText label={showMap ? '🗺️ Ocultar mapa' : '🗺️ Ver no mapa'} onPress={() => setShowMap(v => !v)} />
              </View>
            )}
            {showMap && hasCoords && (
              <SinglePointMap
                latitude={lat}
                longitude={lng}
                label={`${data.CP} · ${data['Designação Postal']}`}
                height={260}
                style={uiStyles.cardMap}
              />
            )}
          </Card>

          {data.partes.length > 0 && (
            <Card>
              <SectionTitle>Artérias ({data.partes.length})</SectionTitle>
              {data.partes.map((p, i) => (
                <View key={i} style={styles.street}>
                  <Text style={styles.streetName}>{p['Artéria']}</Text>
                  <View style={styles.streetMeta}>
                    {p.Troço ? <Text style={styles.meta}>Troço: {p.Troço}</Text> : null}
                    {p.Local ? <Text style={styles.meta}>Local: {p.Local}</Text> : null}
                    {p.Porta ? <Text style={styles.meta}>Porta: {p.Porta}</Text> : null}
                    {p.Cliente ? <Text style={styles.meta}>Cliente: {p.Cliente}</Text> : null}
                  </View>
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      {!query && !isLoading && (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>📮</Text>
          <Text style={styles.placeholderText}>Insira um código postal no formato xxxx-xxx</Text>
        </View>
      )}
    </ScrollView>
  )
}

function Field({ label, value }: { label: string; value: string | undefined }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
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
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: 'monospace',
    color: COLORS.text,
  },
  clear: { position: 'absolute', right: 10 },
  clearText: { color: COLORS.faint, fontSize: 14 },
  button: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  cp: { fontSize: 28, fontWeight: '700', color: COLORS.text, fontFamily: 'monospace', letterSpacing: 2 },
  designation: { fontSize: 16, fontWeight: '600', color: '#334155', marginTop: 2, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  field: { width: '50%' },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: COLORS.faint, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  street: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  streetName: { fontSize: 13, fontWeight: '500', color: '#1e293b' },
  streetMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginTop: 2 },
  meta: { fontSize: 11, color: COLORS.faint },
  placeholder: { alignItems: 'center', paddingVertical: 48 },
  placeholderEmoji: { fontSize: 44, marginBottom: 8 },
  placeholderText: { fontSize: 13, color: COLORS.faint },
})
