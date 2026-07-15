import { useEffect, useMemo, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { SinglePointMap } from '@/components/SinglePointMap'
import { useFuelPrices } from '@/hooks/useFuel'
import { useDistricts, useMunicipalities } from '@/hooks/useGeo'
import { formatPrice, FUEL_LABELS, FUEL_COLORS, type FuelType } from '@portugal-hoje/core'

const FUEL_TYPES: FuelType[] = ['gasoline_95', 'gasoline_98', 'diesel', 'diesel_plus', 'lpg']
const PAGE_SIZE = 20

type UserLocation = {
  latitude: number
  longitude: number
}

function distanceKm(from: UserLocation, to: { Latitude: number; Longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180
  const earthRadiusKm = 6371
  const dLat = toRad(to.Latitude - from.latitude)
  const dLon = toRad(to.Longitude - from.longitude)
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.Latitude)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function Combustivel() {
  const [fuelType, setFuelType] = useState<FuelType>('gasoline_95')
  const [districtId, setDistrictId] = useState<number | undefined>(11) // Lisboa por defeito
  const [districtName, setDistrictName] = useState<string>('Lisboa')
  const [municipalityId, setMunicipalityId] = useState<number | undefined>(undefined)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [page, setPage] = useState(1)
  const [mapStationId, setMapStationId] = useState<number | null>(null)

  const { data: districts, isLoading: loadingDistricts } = useDistricts()
  const { data: municipalities } = useMunicipalities(districtId)
  const { data: stations = [], isLoading, isError, error } = useFuelPrices(fuelType, districtId, municipalityId)

  const sortedStations = useMemo(() => {
    if (!userLocation) return stations
    return [...stations].sort(
      (a, b) => distanceKm(userLocation, a) - distanceKm(userLocation, b),
    )
  }, [stations, userLocation])

  const minPrice = sortedStations.length ? Math.min(...sortedStations.map(s => s.price_eur)) : undefined
  const maxPrice = sortedStations.length ? Math.max(...sortedStations.map(s => s.price_eur)) : undefined
  const avgPrice = sortedStations.length
    ? sortedStations.reduce((s, x) => s + x.price_eur, 0) / sortedStations.length
    : null

  const totalPages   = Math.ceil(sortedStations.length / PAGE_SIZE)
  const pageStations = sortedStations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    requestLocation()
  }, [])

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }

    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      position => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationStatus('granted')
        setDistrictId(undefined)
        setDistrictName('perto de si')
        setMunicipalityId(undefined)
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  }

  function handleDistrictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value ? Number(e.target.value) : undefined
    const name = e.target.options[e.target.selectedIndex].text
    setDistrictId(id)
    setDistrictName(id ? name : '')
    setMunicipalityId(undefined)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">⛽ Preços de Combustível</h1>
        <p className="text-slate-500 text-sm mt-1">Dados DGEG · Atualização diária</p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {userLocation ? 'A mostrar postos mais próximos da sua localização.' : 'Permita a localização para ver os postos mais próximos.'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {locationStatus === 'loading' && 'A pedir acesso à localização...'}
            {locationStatus === 'denied' && 'Localização não autorizada. A usar Lisboa por defeito.'}
            {locationStatus === 'unsupported' && 'Este dispositivo não suporta localização no browser.'}
            {locationStatus === 'granted' && 'Pode alterar distrito/município manualmente.'}
            {locationStatus === 'idle' && 'A localização é usada apenas para ordenar postos por distância.'}
          </p>
        </div>
        <button
          onClick={requestLocation}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <Navigation size={14} />
          Usar localização
        </button>
      </Card>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {FUEL_TYPES.map(ft => (
                <button
                  key={ft}
                  onClick={() => { setFuelType(ft); setPage(1) }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    fuelType === ft
                      ? 'text-white shadow'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  style={fuelType === ft ? { backgroundColor: FUEL_COLORS[ft] } : {}}
                >
                  {FUEL_LABELS[ft]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Distrito</label>
              <select
                value={districtId ?? ''}
                onChange={handleDistrictChange}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                disabled={loadingDistricts}
              >
                <option value="">Todos os distritos</option>
                {(districts ?? []).map(d => (
                  <option key={d.Id} value={d.Id}>{d.Descritivo}</option>
                ))}
              </select>
            </div>
            {districtId && municipalities && municipalities.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Município</label>
                <select
                  value={municipalityId ?? ''}
                  onChange={e => { setMunicipalityId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                >
                  <option value="">Todos os municípios</option>
                  {municipalities.map(m => (
                    <option key={m.Id} value={m.Id}>{m.Descritivo}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      {avgPrice !== null && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <p className="text-xs text-slate-500 mb-1">Mais barato</p>
            <p className="text-xl font-bold text-green-700">{formatPrice(minPrice!)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-slate-500 mb-1">Média</p>
            <p className="text-xl font-bold text-slate-700">{formatPrice(avgPrice)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-slate-500 mb-1">Mais caro</p>
            <p className="text-xl font-bold text-red-600">{formatPrice(maxPrice!)}</p>
          </Card>
        </div>
      )}

      {/* List */}
      <Card>
        <CardTitle>
          Postos ordenados por preço — {FUEL_LABELS[fuelType]}
          {districtName ? ` · ${districtName}` : ''}
          {sortedStations.length > 0 ? ` (${sortedStations.length})` : ''}
        </CardTitle>
        {isLoading && <LoadingBox />}
        {isError && <ErrorBox message={(error as Error).message} />}
        {!isLoading && !isError && (
          <>
            <div className="divide-y divide-slate-100">
              {sortedStations.length === 0 && (
                <p className="text-slate-500 text-sm py-6 text-center">Nenhum resultado encontrado.</p>
              )}
              {pageStations.map((s, i) => {
                const globalIndex = (page - 1) * PAGE_SIZE + i
                const showMap = mapStationId === s.Id
                return (
                <div key={s.Id} className="py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: globalIndex === 0 ? '#16a34a' : globalIndex === 1 ? '#65a30d' : '#94a3b8' }}
                    >
                      {globalIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm truncate">{s.Nome}</p>
                      <p className="text-xs text-slate-400">{s.Marca}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={11} />
                        {s.Morada} · {s.Municipio}, {s.Distrito}
                      </p>
                      {userLocation && (
                        <p className="text-xs text-green-700 font-medium mt-0.5">
                          {distanceKm(userLocation, s).toFixed(1)} km de distância
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 min-w-[90px]">
                      <p
                        className="text-lg font-bold tabular-nums"
                        style={{ color: globalIndex === 0 ? '#16a34a' : '#0f172a' }}
                      >
                        {formatPrice(s.price_eur)}
                      </p>
                      {minPrice && globalIndex > 0 && (
                        <p className="text-xs text-red-500 tabular-nums">
                          +{formatPrice(s.price_eur - minPrice)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMapStationId(showMap ? null : s.Id)}
                      className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
                        showMap ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title="Ver no mapa"
                    >
                      <Navigation size={14} />
                    </button>
                  </div>
                  {showMap && (
                    <SinglePointMap
                      lat={s.Latitude}
                      lon={s.Longitude}
                      label={`${s.Nome} · ${s.Marca}`}
                      className="mt-2 w-full h-56 rounded-xl border border-slate-200 overflow-hidden"
                    />
                  )}
                </div>
                )
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); setMapStationId(null) }} />
          </>
        )}
      </Card>
    </div>
  )
}
