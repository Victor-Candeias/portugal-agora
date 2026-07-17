import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Phone, Globe, Compass, Mail, Navigation } from 'lucide-react'
import { tourismClient } from '@portugal-hoje/core'
import '@/lib/sigtur'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { SinglePointMap } from '@/components/SinglePointMap'

const PAGE_SIZE = 20

const CATEGORY_LABEL: Record<string, string> = {
  'health-wellness': 'Saúde e Bem-Estar',
  'accommodation': 'Alojamento',
  'nature': 'Natureza',
  'culture': 'Cultural',
  'beaches-golf': 'Praias e Golfe',
  'wine-tourism': 'Enoturismo',
  'monuments': 'Monumentos',
  'protected-areas': 'Áreas Protegidas',
  'natura-2000': 'Rede Natura 2000',
  'trails': 'Percursos Pedestres',
}

const NEARBY_RADIUS_KM = 25

type UserLocation = { latitude: number; longitude: number }

function distanceKm(from: UserLocation, to: { lat: number; lng: number }) {
  const toRad = (value: number) => value * Math.PI / 180
  const earthRadiusKm = 6371
  const dLat = toRad(to.lat - from.latitude)
  const dLon = toRad(to.lng - from.longitude)
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.lat)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function useTourismPoints(category?: string, nearby?: UserLocation) {
  return useQuery({
    queryKey: [
      'tourism', 'points', category ?? 'all',
      nearby ? `${nearby.latitude.toFixed(3)},${nearby.longitude.toFixed(3)}` : 'nationwide',
    ],
    queryFn: () => tourismClient.getTourismPoints({
      category,
      nearby: nearby ? { ...nearby, radiusKm: NEARBY_RADIUS_KM } : undefined,
    }),
    staleTime: 24 * 60 * 60 * 1000,
  })
}

export function Turismo() {
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [mapPoint, setMapPoint] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [nearbyEnabled, setNearbyEnabled] = useState(false)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle')
  const [page, setPage] = useState(1)

  function resetPage() { setPage(1) }

  const nearby = nearbyEnabled && userLocation ? userLocation : undefined
  const { data: points = [], isLoading, isError } = useTourismPoints(category || undefined, nearby)

  const categories = useMemo(
    () => tourismClient.getCategories(),
    [],
  )

  function requestNearby() {
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
        setNearbyEnabled(true)
        resetPage()
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  }

  const filtered = useMemo(() => {
    const bySearch = points.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
                 (p.municipality ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    if (nearby) {
      return [...bySearch].sort((a, b) =>
        distanceKm(nearby, { lat: a.latitude, lng: a.longitude }) -
        distanceKm(nearby, { lat: b.latitude, lng: b.longitude }),
      )
    }
    return bySearch
  }, [points, search, nearby])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏖️ Turismo</h1>
          <p className="text-slate-500 text-sm mt-1">SIGTUR · Turismo de Portugal · ICNF</p>
        </div>
        <a
          href="https://sigtur.turismodeportugal.pt/"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Compass size={13} /> sigtur.turismodeportugal.pt
        </a>
      </div>

      <Card>
        <CardTitle>Filtros</CardTitle>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pesquisar</label>
            <input
              type="text"
              placeholder="Nome ou município…"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); resetPage() }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Todas as categorias</option>
              {categories.map(c => (
                <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
              ))}
            </select>
          </div>

          <div>
            {!nearbyEnabled ? (
              <button
                type="button"
                onClick={requestNearby}
                disabled={locationStatus === 'loading'}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-50"
              >
                <Navigation size={13} />
                {locationStatus === 'loading' ? 'A obter localização…' : 'Perto de mim'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setNearbyEnabled(false); resetPage() }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
              >
                <Navigation size={13} />
                A mostrar num raio de {NEARBY_RADIUS_KM} km · Ver todos
              </button>
            )}
            {locationStatus === 'denied' && (
              <p className="text-xs text-red-500 mt-1">Não foi possível obter a localização. Verifica as permissões do browser.</p>
            )}
            {locationStatus === 'unsupported' && (
              <p className="text-xs text-red-500 mt-1">O browser não suporta geolocalização.</p>
            )}
          </div>
        </div>

        {isLoading && <LoadingBox />}
        {isError && <ErrorBox message="Erro ao carregar dados do SIGTUR." />}

        {!isLoading && !isError && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {filtered.length} ponto{filtered.length !== 1 ? 's' : ''} de interesse encontrado{filtered.length !== 1 ? 's' : ''}
              {nearby ? ' perto de ti' : ''}
              {totalPages > 1 && ` · página ${page} de ${totalPages}`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginated.map(point => {
                const showMap = mapPoint === point.id
                return (
                  <div key={point.id} className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-semibold text-slate-900 text-sm leading-snug">{point.name}</p>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-purple-100 text-purple-800">
                          {CATEGORY_LABEL[point.category] ?? point.category}
                        </span>
                        {nearby && (
                          <span className="text-xs text-orange-600 font-medium whitespace-nowrap">
                            {distanceKm(nearby, { lat: point.latitude, lng: point.longitude }).toFixed(1)} km
                          </span>
                        )}
                      </div>
                    </div>

                    {point.address && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                        <MapPin size={11} />
                        {point.address}{point.municipality ? `, ${point.municipality}` : ''}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      {point.phone && (
                        <a href={`tel:${point.phone}`} className="flex items-center gap-1 hover:text-blue-600">
                          <Phone size={11} /> {point.phone}
                        </a>
                      )}
                      {point.website && (
                        <a href={point.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-blue-600">
                          <Globe size={11} /> Site
                        </a>
                      )}
                      {point.email && (
                        <a href={`mailto:${point.email}`} className="flex items-center gap-1 hover:text-blue-600 max-w-[180px] truncate">
                          <Mail size={11} /> {point.email}
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setMapPoint(showMap ? null : point.id)}
                        className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
                      >
                        <MapPin size={11} /> {showMap ? 'Ocultar mapa' : 'Mapa'}
                      </button>
                    </div>

                    {showMap && (
                      <SinglePointMap
                        lat={point.latitude}
                        lon={point.longitude}
                        label={point.name}
                        className="mt-3 w-full h-56 rounded-xl border border-slate-200 overflow-hidden"
                      />
                    )}
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <p className="col-span-2 text-slate-400 text-sm text-center py-8">Nenhum resultado encontrado.</p>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); setMapPoint(null) }} />
          </>
        )}
      </Card>
    </div>
  )
}
