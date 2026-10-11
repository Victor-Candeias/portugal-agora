import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { filterMunicipalities, formatAreaKm2, municipalityDistrict, municipalityDistricts, type GeoMunicipality } from '@portugal-hoje/core'
import { useMunicipalities } from '../../hooks/useConcelhos'
import {
  Card, ChipRow, COLORS, EmptyText, ErrorView, LoadingView, ScreenHeader, SearchInput, uiStyles,
} from '../../components/ui'

// Lista dos 308 concelhos (API Aberta /geo, WEB-042), com pesquisa e filtro por distrito/ilha.
export default function Concelhos() {
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState<string | null>(null)
  const { data, isLoading, isError, error, refetch } = useMunicipalities()

  const districts = useMemo(() => municipalityDistricts(data ?? []).map(d => ({ value: d, label: d })), [data])
  const filtered = useMemo(() => filterMunicipalities(data ?? [], { query, district }), [data, query, district])

  return (
    <FlatList
      style={uiStyles.container}
      contentContainerStyle={uiStyles.content}
      keyboardShouldPersistTaps="handled"
      data={filtered}
      keyExtractor={m => m.slug}
      renderItem={({ item }) => <MunicipalityRow municipality={item} />}
      initialNumToRender={20}
      ListHeaderComponent={
        <>
          <ScreenHeader title="🏛️ Concelhos" subtitle="Contactos da câmara, área e limites no mapa · Fonte: API Aberta" />
          <SearchInput value={query} onChangeText={setQuery} placeholder="Pesquisar concelho" />
          {districts.length > 0 && <ChipRow options={districts} value={district} onChange={setDistrict} />}
          {isLoading && <LoadingView />}
          {isError && <ErrorView error={error} onRetry={() => refetch()} />}
          {data && <Text style={styles.count}>{filtered.length} concelho{filtered.length === 1 ? '' : 's'}</Text>}
        </>
      }
      ListEmptyComponent={data ? <EmptyText>Nenhum concelho encontrado.</EmptyText> : null}
    />
  )
}

function MunicipalityRow({ municipality: m }: { municipality: GeoMunicipality }) {
  const area = formatAreaKm2(m.area_ha)
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/concelhos/${m.slug}` as never)}>
      <Card style={styles.row}>
        <Text style={styles.name}>{m.name}</Text>
        <Text style={styles.meta}>{municipalityDistrict(m)}{area ? ` · ${area}` : ''}</Text>
      </Card>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  count: { fontSize: 12, color: COLORS.muted, marginBottom: 8 },
  row: { paddingVertical: 12 },
  name: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
})
