import { useState, useMemo, useEffect } from 'react'
import { Shield, MapPin, Phone, Mail, Navigation, Clock3 } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { SinglePointMap } from '@/components/SinglePointMap'
import {
  usePublicServices, usePublicServicesMeta, PUBLIC_SERVICE_CATEGORIES,
  type PublicService,
} from '@/hooks/usePublicServices'

const PAGE_SIZE = 20

const CATEGORY_COLOR: Record<string, string> = {
  police_psp: 'bg-blue-100 text-blue-800',
  police_gnr: 'bg-green-100 text-green-800',
  police_municipal: 'bg-purple-100 text-purple-800',
  police_maritime: 'bg-cyan-100 text-cyan-800',
  police_other: 'bg-slate-100 text-slate-700',
}

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

export function ServicosPublicos() {
  const { data: services = [], isLoading, isError } = usePublicServices()
  const { data: meta } = usePublicServicesMeta()

  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [mapService, setMapService] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle')

  useEffect(() => { requestLocation() }, [])

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      position => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        setLocationStatus('granted')
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  }

  function resetPage() { setPage(1) }

  const filtered = useMemo(() => services.filter(s =>
    (!category || s.category === category) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.locality ?? '').toLowerCase().includes(search.toLowerCase())),
  ), [services, category, search])

  const sorted = useMemo(() => {
    if (!userLocation) return filtered
    return [...filtered].sort((a, b) => {
      const da = a.latitude != null && a.longitude != null ? distanceKm(userLocation, { lat: a.latitude, lng: a.longitude }) : Infinity
      const db = b.latitude != null && b.longitude != null ? distanceKm(userLocation, { lat: b.latitude, lng: b.longitude }) : Infinity
      return da - db
    })
  }, [filtered, userLocation])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚓 Serviços Públicos</h1>
          <p className="text-slate-500 text-sm mt-1">
            Esquadras PSP e postos GNR · dados OpenStreetMap
            {meta?.generated_at && ` · atualizado em ${new Date(meta.generated_at).toLocaleDateString('pt-PT')}`}
          </p>
        </div>
      </div>

      <Card>
        <CardTitle>Pesquisar</CardTitle>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); resetPage() }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todas</option>
              {PUBLIC_SERVICE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Nome ou localidade</label>
            <input
              type="text"
              placeholder="Pesquisar…"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs">
          {locationStatus === 'granted' && (
            <span className="flex items-center gap-1 text-green-700">
              <Navigation size={12} /> Ordenado por distância a partir da tua localização
            </span>
          )}
          {(locationStatus === 'denied' || locationStatus === 'unsupported') && (
            <button type="button" onClick={requestLocation} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
              <Navigation size={12} /> Usar a minha localização
            </button>
          )}
          {locationStatus === 'loading' && <span className="text-slate-400">A obter localização…</span>}
        </div>

        {isLoading && <LoadingBox />}
        {isError && <ErrorBox message="Erro ao carregar serviços públicos." />}

        {!isLoading && !isError && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {filtered.length} local{filtered.length !== 1 ? 'ais' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
              {totalPages > 1 && ` · página ${page} de ${totalPages}`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginated.map(service => (
                <PublicServiceCard
                  key={service.id}
                  service={service}
                  distanceLabel={userLocation && service.latitude != null && service.longitude != null
                    ? `${distanceKm(userLocation, { lat: service.latitude, lng: service.longitude }).toFixed(1)} km`
                    : null}
                  showMap={mapService === service.id}
                  onToggleMap={() => setMapService(mapService === service.id ? null : service.id)}
                />
              ))}
              {filtered.length === 0 && (
                <p className="col-span-2 text-slate-400 text-sm text-center py-8">Nenhum local encontrado.</p>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); setMapService(null) }} />
          </>
        )}
      </Card>
    </div>
  )
}

interface PublicServiceCardProps {
  service: PublicService
  distanceLabel: string | null
  showMap: boolean
  onToggleMap: () => void
}

function PublicServiceCard({ service, distanceLabel, showMap, onToggleMap }: PublicServiceCardProps) {
  const hasCoords = service.latitude != null && service.longitude != null

  return (
    <div className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-slate-900 text-sm leading-snug flex items-center gap-1.5">
          <Shield size={14} className="text-blue-600 flex-shrink-0" /> {service.name}
        </p>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${CATEGORY_COLOR[service.category] ?? 'bg-slate-100 text-slate-700'}`}>
            {service.subcategory}
          </span>
          {distanceLabel && <span className="text-xs text-orange-600 font-medium whitespace-nowrap">{distanceLabel}</span>}
        </div>
      </div>

      {service.address && (
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
          <MapPin size={11} />
          {service.address}{service.locality ? `, ${service.locality}` : ''}
        </p>
      )}

      {service.opening_hours && (
        <p className="text-xs text-slate-400 flex items-center gap-1 mb-2">
          <Clock3 size={11} /> {service.opening_hours}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        {service.phone && (
          <a href={`tel:${service.phone}`} className="flex items-center gap-1 hover:text-blue-600">
            <Phone size={11} /> {service.phone}
          </a>
        )}
        {service.email && (
          <a href={`mailto:${service.email}`} className="flex items-center gap-1 hover:text-blue-600 max-w-[180px] truncate">
            <Mail size={11} /> {service.email}
          </a>
        )}
        {!service.address && !service.phone && !service.email && !service.opening_hours && (
          <span className="text-slate-400">Sem informação de contacto disponível (OpenStreetMap).</span>
        )}
        {hasCoords && (
          <button
            type="button"
            onClick={onToggleMap}
            className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
          >
            <MapPin size={11} /> {showMap ? 'Ocultar mapa' : 'Mapa'}
          </button>
        )}
      </div>

      {showMap && hasCoords && (
        <SinglePointMap
          lat={service.latitude!}
          lon={service.longitude!}
          label={service.name}
          className="mt-3 w-full h-56 rounded-xl border border-slate-200 overflow-hidden"
        />
      )}
    </div>
  )
}
