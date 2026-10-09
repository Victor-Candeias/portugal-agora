import { useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { PUBLIC_SERVICE_CATEGORIES, haversineDistance, type PublicService } from '@portugal-hoje/core'
import { usePublicServices, usePublicServicesMeta } from '../hooks/usePublicServices'
import { useUserLocation, type Coords } from '../hooks/useUserLocation'
import { PointsMap, SinglePointMap, type MapPoint } from '../components/PointsMap'
import { openDirections } from '../lib/maps'
import {
  Badge,
  Card,
  ChipRow,
  COLORS,
  EmptyText,
  ErrorView,
  LinkText,
  LoadingView,
  ScreenHeader,
  SearchInput,
  SectionTitle,
  ShowMore,
  formatDistance,
  uiStyles,
} from '../components/ui'

const PAGE_SIZE = 20
// Pontos no mapa de conjunto (os mais próximos / primeiros da lista filtrada).
const MAX_MAP_POINTS = 100

type Category = (typeof PUBLIC_SERVICE_CATEGORIES)[number]['value']

const CATEGORY_COLORS: Record<string, { color: string; background: string }> = {
  police_psp: { color: '#1e40af', background: '#dbeafe' },
  police_gnr: { color: '#166534', background: '#dcfce7' },
  police_municipal: { color: '#6b21a8', background: '#f3e8ff' },
  police_maritime: { color: '#155e75', background: '#cffafe' },
  police_other: { color: '#334155', background: '#f1f5f9' },
}

function distanceTo(from: Coords, s: PublicService) {
  return s.latitude != null && s.longitude != null
    ? haversineDistance(from.latitude, from.longitude, s.latitude, s.longitude)
    : Infinity
}

export default function ServicosPublicos() {
  const { data: services = [], isLoading, isError, error, refetch } = usePublicServices()
  const { data: meta } = usePublicServicesMeta()
  const location = useUserLocation()

  const [category, setCategory] = useState<Category | null>(null)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [showOverview, setShowOverview] = useState(false)

  const coords = location.status === 'granted' ? location.coords : null

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = services.filter(
      s =>
        (!category || s.category === category) &&
        (!q || s.name.toLowerCase().includes(q) || (s.locality ?? '').toLowerCase().includes(q)),
    )
    if (!coords) return list
    return list
      .map(s => ({ s, d: distanceTo(coords, s) }))
      .sort((a, b) => a.d - b.d)
      .map(x => x.s)
  }, [services, category, search, coords])

  const mapPoints = useMemo<MapPoint[]>(
    () =>
      sorted
        .filter(s => s.latitude != null && s.longitude != null)
        .slice(0, MAX_MAP_POINTS)
        .map(s => ({
          id: s.id,
          latitude: s.latitude!,
          longitude: s.longitude!,
          label: s.name,
          description: [s.subcategory, s.locality].filter(Boolean).join(' · '),
        })),
    [sorted],
  )

  const updated = meta?.generated_at ? ` · atualizado em ${new Date(meta.generated_at).toLocaleDateString('pt-PT')}` : ''

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="🚓 Serviços Públicos" subtitle={`Esquadras PSP e postos GNR · dados OpenStreetMap${updated}`} />

      <Card>
        <SectionTitle>Pesquisar</SectionTitle>
        <SearchInput
          value={search}
          onChangeText={text => {
            setSearch(text)
            setShown(PAGE_SIZE)
          }}
          placeholder="Nome ou localidade…"
        />
        <Text style={uiStyles.label}>Categoria</Text>
        <ChipRow
          options={PUBLIC_SERVICE_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          value={category}
          onChange={v => {
            setCategory(v)
            setShown(PAGE_SIZE)
          }}
          allLabel="Todas"
          color="#2563eb"
        />
        {location.status === 'granted' && (
          <Text style={styles.located}>🧭 Ordenado por distância a partir da tua localização</Text>
        )}
        {location.status === 'denied' && (
          <LinkText label="🧭 Usar a minha localização" onPress={() => void location.request()} />
        )}
        {location.status === 'loading' && <Text style={uiStyles.small}>A obter localização…</Text>}
      </Card>

      {isLoading && <LoadingView color="#2563eb" />}
      {isError && <ErrorView error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <>
          <SectionTitle
            action={
              mapPoints.length > 0 ? (
                <LinkText label={showOverview ? 'Ocultar mapa' : '🗺️ Ver no mapa'} onPress={() => setShowOverview(v => !v)} />
              ) : undefined
            }
          >
            {sorted.length} loca{sorted.length !== 1 ? 'is' : 'l'} encontrado{sorted.length !== 1 ? 's' : ''}
          </SectionTitle>
          {showOverview && (
            <>
              <PointsMap points={mapPoints} height={300} color="#2563eb" style={uiStyles.map} />
              {sorted.length > MAX_MAP_POINTS && (
                <Text style={styles.mapNote}>
                  Mapa com os {MAX_MAP_POINTS} {coords ? 'mais próximos' : 'primeiros'} de {sorted.length}.
                </Text>
              )}
            </>
          )}
          {sorted.slice(0, shown).map(s => (
            <PublicServiceCard key={s.id} service={s} distance={coords ? distanceTo(coords, s) : null} />
          ))}
          {sorted.length === 0 && <EmptyText>Nenhum local encontrado.</EmptyText>}
          <ShowMore shown={shown} total={sorted.length} onPress={() => setShown(n => n + PAGE_SIZE)} />
        </>
      )}
    </ScrollView>
  )
}

function PublicServiceCard({ service: s, distance }: { service: PublicService; distance: number | null }) {
  const [showMap, setShowMap] = useState(false)
  const hasCoords = s.latitude != null && s.longitude != null
  const colors = CATEGORY_COLORS[s.category] ?? CATEGORY_COLORS.police_other
  return (
    <Card>
      <View style={styles.header}>
        <Text style={[uiStyles.strong, styles.flex]}>🛡️ {s.name}</Text>
        <View style={styles.headerRight}>
          {s.subcategory ? <Badge label={s.subcategory} {...colors} /> : null}
          {distance != null && Number.isFinite(distance) && <Text style={styles.distance}>{formatDistance(distance)}</Text>}
        </View>
      </View>
      {s.address && (
        <Text style={uiStyles.small}>
          📍 {s.address}
          {s.locality ? `, ${s.locality}` : ''}
        </Text>
      )}
      {s.opening_hours && <Text style={styles.hours}>🕒 {s.opening_hours}</Text>}
      <View style={uiStyles.actions}>
        {s.phone && <LinkText label={`📞 ${s.phone}`} onPress={() => Linking.openURL(`tel:${s.phone}`)} />}
        {s.email && <LinkText label="✉️ Email" onPress={() => Linking.openURL(`mailto:${s.email}`)} />}
        {s.website && <LinkText label="🌐 Site" onPress={() => Linking.openURL(s.website!)} />}
        {!s.address && !s.phone && !s.email && !s.opening_hours && (
          <Text style={styles.noInfo}>Sem informação de contacto disponível (OpenStreetMap).</Text>
        )}
        {hasCoords && (
          <>
            <LinkText label={showMap ? '🗺️ Ocultar mapa' : '🗺️ Mapa'} onPress={() => setShowMap(v => !v)} />
            <LinkText label="🧭 Direções" onPress={() => openDirections(s.latitude!, s.longitude!)} />
          </>
        )}
      </View>
      {showMap && hasCoords && (
        <SinglePointMap latitude={s.latitude!} longitude={s.longitude!} label={s.name} style={uiStyles.cardMap} />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  distance: { fontSize: 12, fontWeight: '600', color: '#ea580c' },
  hours: { fontSize: 12, color: COLORS.faint, marginTop: 4 },
  noInfo: { fontSize: 12, color: COLORS.faint },
  located: { fontSize: 12, color: '#15803d', fontWeight: '600' },
  mapNote: { fontSize: 11, color: COLORS.faint, marginTop: -6, marginBottom: 10 },
})
