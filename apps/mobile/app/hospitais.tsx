import { useEffect, useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { haversineDistance, type Hospital } from '@portugal-hoje/core'
import { useHospitals } from '../hooks/useHospitais'
import { useUserLocation, type Coords } from '../hooks/useUserLocation'
import { SinglePointMap } from '../components/PointsMap'
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
const DEFAULT_DISTRITO = 'Lisboa'

const TIPO_COLORS: Record<string, { color: string; background: string }> = {
  'Serviço de Urgência Básica': { color: '#1e40af', background: '#dbeafe' },
  'Serviço de Urgência Médico-cirúrgico': { color: '#6b21a8', background: '#f3e8ff' },
  'Serviço de Urgência Polivalente': { color: '#9a3412', background: '#ffedd5' },
  'Serviço de Urgência Polivalente com Centro de Trauma': { color: '#991b1b', background: '#fee2e2' },
}

function tipoLabel(tipo: string) {
  return tipo.replace('Serviço de Urgência ', '').replace(' com Centro de Trauma', ' +Trauma')
}

function distanceTo(from: Coords, h: Hospital) {
  return h.lat !== 0 ? haversineDistance(from.latitude, from.longitude, h.lat, h.lng) : Infinity
}

export default function Hospitais() {
  const { data: hospitals = [], isLoading, isError, error, refetch } = useHospitals()
  const location = useUserLocation()

  const [useLocation, setUseLocation] = useState(false)
  const [distrito, setDistrito] = useState<string | null>(DEFAULT_DISTRITO)
  const [municipio, setMunicipio] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)

  // Com localização: ordenar por distância em todo o país. Sem ela: Lisboa por omissão (como no web).
  useEffect(() => {
    if (location.status === 'granted') {
      setUseLocation(true)
      setDistrito(null)
      setMunicipio(null)
      setShown(PAGE_SIZE)
    }
  }, [location.status])

  const userCoords = useLocation ? location.coords : null

  const distritos = useMemo(
    () => [...new Set(hospitals.map(h => h.distrito).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals],
  )

  const municipios = useMemo(
    () =>
      [...new Set(hospitals.filter(h => !distrito || h.distrito === distrito).map(h => h.municipio).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals, distrito],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = hospitals.filter(
      h =>
        (!distrito || h.distrito === distrito) &&
        (!municipio || h.municipio === municipio) &&
        (!q || h.nome.toLowerCase().includes(q) || h.localidade.toLowerCase().includes(q)),
    )
    if (!userCoords) return list
    return list
      .map(h => ({ h, d: distanceTo(userCoords, h) }))
      .sort((a, b) => a.d - b.d)
      .map(x => x.h)
  }, [hospitals, distrito, municipio, search, userCoords])

  const showList = Boolean(distrito || search.trim() || userCoords)
  const hasFilter = Boolean(distrito || municipio || search)

  function onFilterChange() {
    setUseLocation(false)
    setShown(PAGE_SIZE)
  }

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="🏥 Hospitais SNS" subtitle="Urgências · Transparência SNS · Ministério da Saúde" />

      <Card>
        <Text style={styles.locationTitle}>
          {userCoords
            ? 'A mostrar as urgências mais próximas da sua localização.'
            : 'Permita a localização para ver as urgências mais próximas.'}
        </Text>
        <Text style={uiStyles.small}>
          {location.status === 'loading' && 'A pedir acesso à localização…'}
          {location.status === 'denied' && 'Localização não autorizada. A usar Lisboa por omissão.'}
          {location.status === 'granted' &&
            (userCoords ? 'Pode alterar distrito/município manualmente.' : 'Filtro manual ativo.')}
        </Text>
        <TouchableOpacity
          style={styles.locationBtn}
          onPress={() => {
            if (location.status === 'granted') {
              setUseLocation(true)
              setDistrito(null)
              setMunicipio(null)
              setShown(PAGE_SIZE)
            } else {
              void location.request()
            }
          }}
        >
          <Text style={styles.locationBtnText}>🧭 Usar a minha localização</Text>
        </TouchableOpacity>
      </Card>

      <Card>
        <SectionTitle
          action={
            hasFilter ? (
              <LinkText
                label="Limpar filtros"
                onPress={() => {
                  setDistrito(null)
                  setMunicipio(null)
                  setSearch('')
                  onFilterChange()
                }}
              />
            ) : undefined
          }
        >
          Filtros
        </SectionTitle>
        <SearchInput
          value={search}
          onChangeText={text => {
            setSearch(text)
            setShown(PAGE_SIZE)
          }}
          placeholder="Nome do hospital ou localidade…"
        />
        <Text style={uiStyles.label}>Distrito</Text>
        <ChipRow
          options={distritos.map(d => ({ value: d, label: d }))}
          value={distrito}
          onChange={v => {
            setDistrito(v)
            setMunicipio(null)
            onFilterChange()
          }}
          color="#dc2626"
        />
        {distrito && (
          <>
            <Text style={uiStyles.label}>Município</Text>
            <ChipRow
              options={municipios.map(m => ({ value: m, label: m }))}
              value={municipio}
              onChange={v => {
                setMunicipio(v)
                onFilterChange()
              }}
              color="#dc2626"
            />
          </>
        )}
      </Card>

      {isLoading && <LoadingView color="#dc2626" />}
      {isError && <ErrorView error={error} onRetry={() => refetch()} />}

      {!isLoading && !isError && !showList && (
        <EmptyText>Selecione um distrito ou pesquise por nome para ver os hospitais.</EmptyText>
      )}

      {!isLoading && !isError && showList && (
        <>
          <Text style={styles.count}>
            {filtered.length} serviço{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </Text>
          {filtered.slice(0, shown).map(h => (
            <HospitalCard key={h.nome} hospital={h} userCoords={userCoords} />
          ))}
          {filtered.length === 0 && <EmptyText>Nenhum resultado encontrado.</EmptyText>}
          <ShowMore shown={shown} total={filtered.length} onPress={() => setShown(s => s + PAGE_SIZE)} />
        </>
      )}

      <TouchableOpacity onPress={() => Linking.openURL('https://transparencia.sns.gov.pt')}>
        <Text style={styles.source}>Fonte: transparencia.sns.gov.pt</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function HospitalCard({ hospital: h, userCoords }: { hospital: Hospital; userCoords: Coords | null }) {
  const [showMap, setShowMap] = useState(false)
  const hasCoords = h.lat !== 0
  const tipo = TIPO_COLORS[h.tipo_de_urgencia] ?? { color: '#334155', background: '#f1f5f9' }
  return (
    <Card>
      <View style={styles.cardHeader}>
        <Text style={[uiStyles.strong, styles.flex]}>{h.nome}</Text>
        <Badge label={tipoLabel(h.tipo_de_urgencia)} {...tipo} />
      </View>
      <Text style={uiStyles.small}>
        📍 {h.endereco}, {h.localidade} {h.codigo_postal}
      </Text>
      {h.distrito ? (
        <Text style={styles.district}>
          {h.municipio} · {h.distrito}
        </Text>
      ) : null}
      {userCoords && hasCoords && (
        <Text style={styles.distance}>{formatDistance(distanceTo(userCoords, h))} de distância</Text>
      )}
      <View style={styles.tags}>
        {h.valencias.map(v => (
          <Badge key={v.nome} label={v.nome} color="#475569" background="#f1f5f9" />
        ))}
        {h.saude24 && <Badge label="Saúde 24" color="#15803d" background="#dcfce7" />}
      </View>
      <View style={uiStyles.actions}>
        {h.telefone && <LinkText label={`📞 ${h.telefone}`} onPress={() => Linking.openURL(`tel:${h.telefone}`)} />}
        {h.email && <LinkText label="✉️ Email" onPress={() => Linking.openURL(`mailto:${h.email}`)} />}
        {hasCoords && (
          <>
            <LinkText label={showMap ? '🗺️ Ocultar mapa' : '🗺️ Mapa'} onPress={() => setShowMap(v => !v)} />
            <LinkText label="🧭 Direções" onPress={() => openDirections(h.lat, h.lng)} />
          </>
        )}
      </View>
      {showMap && hasCoords && (
        <SinglePointMap latitude={h.lat} longitude={h.lng} label={h.nome} style={uiStyles.cardMap} />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  locationTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  locationBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  locationBtnText: { color: 'white', fontWeight: '600', fontSize: 13 },
  count: { fontSize: 12, color: COLORS.faint, marginBottom: 8 },
  cardHeader: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 6 },
  district: { fontSize: 11, color: COLORS.faint, marginTop: 2 },
  distance: { fontSize: 12, color: '#15803d', fontWeight: '600', marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  source: { fontSize: 11, color: COLORS.link, textAlign: 'center', marginTop: 12 },
})
