import { useEffect, useMemo, useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, FlatList, SafeAreaView,
} from 'react-native'
import { useFuelPrices, useDistricts, useMunicipalities } from '../../hooks/useApi'
import { useUserLocation } from '../../hooks/useUserLocation'
import { ChipRow, SegmentedTabs, formatDistance } from '../../components/ui'
import {
  formatPrice, haversineDistance, FUEL_LABELS, FUEL_COLORS, type DgegStation, type FuelType,
} from '@portugal-hoje/core'

const FUEL_TYPES: FuelType[] = ['gasoline_95', 'gasoline_98', 'diesel', 'diesel_plus', 'lpg']

type SortBy = 'price' | 'distance'
const SORT_TABS: { value: SortBy; label: string }[] = [
  { value: 'price', label: '💶 Preço' },
  { value: 'distance', label: '🧭 Distância' },
]

const RADIUS_OPTIONS = [10, 25, 50]
const DEFAULT_RADIUS_KM = 25
const MAX_SHOWN = 50

type StationRow = DgegStation & { distKm: number | null }

function hasCoords(s: DgegStation) {
  return Number.isFinite(s.Latitude) && Number.isFinite(s.Longitude) && !(s.Latitude === 0 && s.Longitude === 0)
}

const byDistance = (a: StationRow, b: StationRow) => (a.distKm ?? Infinity) - (b.distKm ?? Infinity)
const byPrice = (a: StationRow, b: StationRow) => a.price_eur - b.price_eur

type PickerItem = { Id: number; Descritivo: string }

function SelectModal({
  visible,
  items,
  onSelect,
  onClose,
  placeholder,
}: {
  visible: boolean
  items: PickerItem[]
  onSelect: (item: PickerItem | null) => void
  onClose: () => void
  placeholder: string
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <SafeAreaView style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>{placeholder}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={modalStyles.item} onPress={() => onSelect(null)}>
            <Text style={modalStyles.itemTextAll}>Todos</Text>
          </TouchableOpacity>
          <FlatList
            data={items}
            keyExtractor={i => String(i.Id)}
            renderItem={({ item }) => (
              <TouchableOpacity style={modalStyles.item} onPress={() => onSelect(item)}>
                <Text style={modalStyles.itemText}>{item.Descritivo}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  )
}

export default function Combustivel() {
  const [fuelType, setFuelType] = useState<FuelType>('gasoline_95')
  const [districtId, setDistrictId] = useState<number | undefined>(undefined)
  const [districtName, setDistrictName] = useState<string>('')
  const [municipalityId, setMunicipalityId] = useState<number | undefined>(undefined)
  const [municipalityName, setMunicipalityName] = useState<string>('')
  const [showDistricts, setShowDistricts] = useState(false)
  const [showMunicipalities, setShowMunicipalities] = useState(false)

  const { data: districts = [] } = useDistricts()
  const { data: municipalities = [] } = useMunicipalities(districtId)
  const { data: stations = [], isLoading, isError } = useFuelPrices(fuelType, districtId, municipalityId)

  const location = useUserLocation()
  const coords = location.coords
  const [sortBy, setSortBy] = useState<SortBy>('price')
  const [radiusKm, setRadiusKm] = useState<number | null>(DEFAULT_RADIUS_KM)

  // Por omissão: Distância com localização, Preço sem ela.
  useEffect(() => {
    if (location.status === 'granted') setSortBy('distance')
  }, [location.status])

  const effectiveSort: SortBy = coords ? sortBy : 'price'
  const radiusActive = Boolean(coords) && radiusKm !== null

  const rows = useMemo<StationRow[]>(() => {
    const withDist: StationRow[] = stations.map(s => ({
      ...s,
      distKm: coords && hasCoords(s) ? haversineDistance(coords.latitude, coords.longitude, s.Latitude, s.Longitude) : null,
    }))
    // O raio é aplicado no cliente para não renderizar os postos do país inteiro.
    const inRadius = coords && radiusKm !== null
      ? withDist.filter(s => s.distKm !== null && s.distKm <= radiusKm)
      : withDist
    return inRadius.sort(
      effectiveSort === 'distance'
        ? (a, b) => byDistance(a, b) || byPrice(a, b)
        : (a, b) => byPrice(a, b) || byDistance(a, b),
    )
  }, [stations, coords, radiusKm, effectiveSort])

  const prices = rows.map(s => s.price_eur).filter(Number.isFinite)
  const minPrice = prices.length ? Math.min(...prices) : undefined
  const nearestKm = rows.reduce<number | null>(
    (min, s) => (s.distKm !== null && (min === null || s.distKm < min) ? s.distKm : min),
    null,
  )

  function handleUseLocation() {
    setSortBy('distance')
    void location.request()
  }

  function handleSelectDistrict(item: PickerItem | null) {
    setDistrictId(item?.Id)
    setDistrictName(item?.Descritivo ?? '')
    setMunicipalityId(undefined)
    setMunicipalityName('')
    setShowDistricts(false)
  }

  function handleSelectMunicipality(item: PickerItem | null) {
    setMunicipalityId(item?.Id)
    setMunicipalityName(item?.Descritivo ?? '')
    setShowMunicipalities(false)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⛽ Preços de Combustível</Text>
      <Text style={styles.subtitle}>Dados DGEG · Atualização diária</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow}>
        {FUEL_TYPES.map(ft => (
          <TouchableOpacity
            key={ft}
            onPress={() => setFuelType(ft)}
            style={[styles.typeBtn, fuelType === ft && { backgroundColor: FUEL_COLORS[ft] }]}
          >
            <Text style={[styles.typeBtnText, fuelType === ft && { color: 'white' }]}>
              {FUEL_LABELS[ft]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.locationCard}>
        <Text style={styles.locationTitle}>
          {coords
            ? 'A usar a sua localização.'
            : 'Permita a localização para ver os postos mais perto de si.'}
        </Text>
        <Text style={styles.locationHint}>
          {location.status === 'loading' && 'A pedir acesso à localização…'}
          {location.status === 'denied' && 'Localização não autorizada. Postos ordenados por preço.'}
          {location.status === 'granted' && 'Pode combinar com o filtro de distrito/município.'}
        </Text>
        <TouchableOpacity
          style={[styles.locationBtn, location.status === 'loading' && styles.locationBtnDisabled]}
          onPress={handleUseLocation}
          disabled={location.status === 'loading'}
        >
          <Text style={styles.locationBtnText}>🧭 Usar a minha localização</Text>
        </TouchableOpacity>
      </View>

      {coords && (
        <>
          <Text style={styles.sectionLabel}>Ordenar por</Text>
          <SegmentedTabs tabs={SORT_TABS} value={sortBy} onChange={setSortBy} />
          <Text style={styles.sectionLabel}>Raio</Text>
          <ChipRow
            options={RADIUS_OPTIONS.map(r => ({ value: String(r), label: `${r} km` }))}
            value={radiusKm === null ? null : String(radiusKm)}
            onChange={v => setRadiusKm(v === null ? null : Number(v))}
          />
        </>
      )}

      {/* Filtros de localização */}
      <View style={styles.filterCol}>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowDistricts(true)}>
          <Text style={styles.filterLabel}>Distrito</Text>
          <Text style={[styles.filterValue, !districtName && styles.filterPlaceholder]}>
            {districtName || 'Todos os distritos'}
          </Text>
        </TouchableOpacity>

        {districtId !== undefined && (
          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowMunicipalities(true)}>
            <Text style={styles.filterLabel}>Município</Text>
            <Text style={[styles.filterValue, !municipalityName && styles.filterPlaceholder]}>
              {municipalityName || 'Todos os municípios'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {rows.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Mais barato</Text>
            <Text style={[styles.statValue, { color: '#16a34a' }]}>
              {minPrice !== undefined ? formatPrice(minPrice) : '—'}
            </Text>
          </View>
          {nearestKm !== null && (
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Mais próximo</Text>
              <Text style={[styles.statValue, { color: '#2563eb' }]}>{formatDistance(nearestKm)}</Text>
            </View>
          )}
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Encontrados</Text>
            <Text style={styles.statValue}>{rows.length}</Text>
          </View>
        </View>
      )}

      {isLoading && <ActivityIndicator color="#16a34a" style={{ marginTop: 32 }} />}
      {isError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Erro ao carregar dados. Verifique a ligação.</Text>
        </View>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <Text style={styles.listTitle}>
          Postos ordenados por {effectiveSort === 'distance' ? 'distância' : 'preço'}
          {radiusActive ? ` · até ${radiusKm} km` : ''}
          {rows.length > MAX_SHOWN ? ` · primeiros ${MAX_SHOWN}` : ''}
        </Text>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <Text style={styles.emptyText}>
          {radiusActive && stations.length > 0
            ? `Nenhum posto a menos de ${radiusKm} km. Aumente o raio.`
            : 'Nenhum posto encontrado.'}
        </Text>
      )}

      {rows.slice(0, MAX_SHOWN).map((s, i) => {
        const isCheapest = minPrice !== undefined && s.price_eur === minPrice
        const rankColor = effectiveSort === 'distance'
          ? (i === 0 ? '#2563eb' : i < 3 ? '#60a5fa' : '#94a3b8')
          : (i === 0 ? '#16a34a' : i < 3 ? '#65a30d' : '#94a3b8')
        return (
          <View key={`${s.Id}-${i}`} style={styles.stationRow}>
            <View style={[styles.rank, { backgroundColor: rankColor }]}>
              <Text style={styles.rankText}>{i + 1}</Text>
            </View>
            <View style={styles.stationInfo}>
              <Text style={styles.stationName} numberOfLines={1}>{s.Nome}</Text>
              <Text style={styles.stationLocation}>📍 {s.Municipio}, {s.Distrito}</Text>
              {s.distKm !== null && (
                <Text style={styles.stationDistance}>🧭 {formatDistance(s.distKm)}</Text>
              )}
            </View>
            <View style={styles.priceBox}>
              <Text style={[styles.price, isCheapest && { color: '#16a34a' }]}>
                {formatPrice(s.price_eur)}
              </Text>
              {isCheapest && effectiveSort === 'distance' && (
                <Text style={styles.cheapestTag}>mais barato</Text>
              )}
              {minPrice !== undefined && s.price_eur > minPrice && (
                <Text style={styles.priceDiff}>+{formatPrice(s.price_eur - minPrice)}</Text>
              )}
            </View>
          </View>
        )
      })}

      <SelectModal
        visible={showDistricts}
        items={districts}
        onSelect={handleSelectDistrict}
        onClose={() => setShowDistricts(false)}
        placeholder="Escolher Distrito"
      />
      <SelectModal
        visible={showMunicipalities}
        items={municipalities}
        onSelect={handleSelectMunicipality}
        onClose={() => setShowMunicipalities(false)}
        placeholder="Escolher Município"
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 16, marginTop: 2 },
  typeRow: { marginBottom: 16 },
  typeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  locationCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationTitle: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  locationHint: { fontSize: 12, color: '#64748b' },
  locationBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  locationBtnDisabled: { opacity: 0.6 },
  locationBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 },
  filterCol: { gap: 10, marginBottom: 16 },
  filterBtn: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 },
  filterValue: { fontSize: 15, fontWeight: '500', color: '#0f172a' },
  filterPlaceholder: { color: '#94a3b8' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: { fontSize: 11, color: '#64748b', fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  errorBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 12 },
  errorText: { color: '#dc2626', fontSize: 14 },
  listTitle: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginVertical: 24 },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: { color: 'white', fontWeight: '700', fontSize: 13 },
  stationInfo: { flex: 1 },
  stationName: { fontWeight: '600', color: '#0f172a', fontSize: 14 },
  stationLocation: { fontSize: 12, color: '#64748b', marginTop: 2 },
  stationDistance: { fontSize: 12, color: '#2563eb', fontWeight: '600', marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  cheapestTag: { fontSize: 10, color: '#16a34a', fontWeight: '700', marginTop: 1 },
  price: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  priceDiff: { fontSize: 11, color: '#ef4444', marginTop: 1 },
})

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  closeBtn: { fontSize: 18, color: '#94a3b8', paddingHorizontal: 4 },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  itemText: { fontSize: 15, color: '#0f172a' },
  itemTextAll: { fontSize: 15, color: '#64748b', fontStyle: 'italic' },
})
