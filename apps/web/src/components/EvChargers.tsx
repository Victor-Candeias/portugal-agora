import { useEffect, useState } from 'react'
import { MapPin, Navigation, Zap, ExternalLink, RefreshCw } from 'lucide-react'
import {
  EV_CHARGER_MIN_POWER_OPTIONS,
  EV_CHARGER_RADII_KM,
  OPEN_CHARGE_MAP_ATTRIBUTION,
  formatDate,
  formatEvConnector,
  formatPowerKw,
  type EvCharger,
  type EvChargerStatus,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { SinglePointMap } from '@/components/SinglePointMap'
import { useEvChargers } from '@/hooks/useEv'

// Postos de carregamento perto do utilizador via Open Charge Map (WEB-040).
const PAGE_SIZE = 20
const LISBON = { latitude: 38.7223, longitude: -9.1393 }

type Coords = { latitude: number; longitude: number }
type LocationStatus = 'loading' | 'granted' | 'denied' | 'unsupported'

const STATUS_CLASS: Record<EvChargerStatus, string> = {
  operational: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  unavailable: 'bg-red-100 text-red-700',
  planned: 'bg-blue-100 text-blue-800',
  unknown: 'bg-slate-100 text-slate-600',
}

const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)

function chipClass(active: boolean) {
  return `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
    active ? 'bg-amber-500 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
  }`
}

export function EvChargers() {
  const [userLocation, setUserLocation] = useState<Coords | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading')
  const [radiusKm, setRadiusKm] = useState<number>(10)
  const [minPower, setMinPower] = useState<string>('')
  const [page, setPage] = useState(1)
  const [mapId, setMapId] = useState<number | null>(null)

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

  // Sem localização, mostra os postos à volta de Lisboa.
  const center = locationStatus === 'loading' ? null : userLocation ?? LISBON
  const params = center ? { ...center, radiusKm, minPowerKw: minPower ? Number(minPower) : undefined } : null
  const { data: chargers = [], isLoading, isError, error, isFetching, refetch } = useEvChargers(params)

  function resetPage() {
    setPage(1)
    setMapId(null)
  }

  const totalPages = Math.ceil(chargers.length / PAGE_SIZE)
  const paginated = chargers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const fastCount = chargers.filter(c => c.hasDc).length

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Postos de carregamento perto de mim</CardTitle>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching || !params}
            className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 disabled:opacity-50"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Raio</p>
            <div className="flex flex-wrap gap-2">
              {EV_CHARGER_RADII_KM.map(r => (
                <button key={r} type="button" onClick={() => { setRadiusKm(r); resetPage() }} className={chipClass(radiusKm === r)}>
                  {r} km
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Potência mínima</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMinPower(''); resetPage() }} className={chipClass(minPower === '')}>
                Todas
              </button>
              {EV_CHARGER_MIN_POWER_OPTIONS.map(o => (
                <button key={o.value} type="button" onClick={() => { setMinPower(o.value); resetPage() }} className={chipClass(minPower === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4 text-xs">
          {locationStatus === 'granted' && (
            <span className="flex items-center gap-1 text-green-700">
              <Navigation size={12} /> Ordenado por distância a partir da tua localização
            </span>
          )}
          {(locationStatus === 'denied' || locationStatus === 'unsupported') && (
            <>
              <span className="text-slate-500">Sem localização: a mostrar postos à volta de Lisboa.</span>
              <button type="button" onClick={requestLocation} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium">
                <Navigation size={12} /> Usar a minha localização
              </button>
            </>
          )}
          {locationStatus === 'loading' && <span className="text-slate-400">A obter localização…</span>}
        </div>

        {(isLoading || locationStatus === 'loading') && <LoadingBox />}
        {isError && <ErrorBox message={(error as Error).message} />}

        {params && !isLoading && !isError && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {chargers.length} posto{chargers.length !== 1 ? 's' : ''} num raio de {radiusKm} km
              {fastCount > 0 && ` · ${fastCount} com carregamento rápido (DC)`}
              {chargers.length >= 100 && ' · a mostrar os 100 mais próximos'}
              {totalPages > 1 && ` · página ${page} de ${totalPages}`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginated.map(c => (
                <ChargerCard
                  key={c.id}
                  charger={c}
                  showMap={mapId === c.id}
                  onToggleMap={() => setMapId(mapId === c.id ? null : c.id)}
                />
              ))}
              {chargers.length === 0 && (
                <p className="col-span-2 text-slate-400 text-sm text-center py-8">
                  Nenhum posto encontrado. Experimente aumentar o raio ou baixar a potência mínima.
                </p>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); setMapId(null) }} />
          </>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        Dados: <a href="https://openchargemap.org" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">{OPEN_CHARGE_MAP_ATTRIBUTION}</a>.
        O estado de cada posto é o declarado na comunidade, não é em tempo real.
      </p>
    </div>
  )
}

function ChargerCard({ charger: c, showMap, onToggleMap }: { charger: EvCharger; showMap: boolean; onToggleMap: () => void }) {
  return (
    <div className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-snug flex items-center gap-1.5">
            <Zap size={14} className={`flex-shrink-0 ${c.hasDc ? 'text-amber-500' : 'text-slate-400'}`} /> {c.name}
          </p>
          {c.operator && <p className="text-xs text-slate-500 mt-0.5">{c.operator}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-orange-600 font-medium whitespace-nowrap">{formatDistance(c.distanceKm)}</span>
          {c.maxPowerKw != null && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-amber-100 text-amber-800">
              até {formatPowerKw(c.maxPowerKw)}
            </span>
          )}
        </div>
      </div>

      {(c.address || c.town) && (
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-2">
          <MapPin size={11} className="flex-shrink-0" />
          {[c.address, c.town].filter(Boolean).join(', ')}
        </p>
      )}

      {c.connectors.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {c.connectors.map(conn => (
            <span key={formatEvConnector(conn)} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {formatEvConnector(conn)}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[c.status]}`}>{c.statusLabel}</span>
        {c.access && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.access}</span>}
        {c.points != null && <span className="text-[10px] text-slate-500">{c.points} ponto{c.points !== 1 ? 's' : ''}</span>}
      </div>

      {c.usageCost && <p className="text-xs text-slate-500 mb-1">💶 {c.usageCost}</p>}
      {c.comments && <p className="text-xs text-slate-400 mb-1 line-clamp-2">{c.comments}</p>}

      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap mt-2">
        {c.lastVerified && <span className="text-slate-400">Verificado em {formatDate(c.lastVerified)}</span>}
        <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-blue-600">
          <ExternalLink size={11} /> Open Charge Map
        </a>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
        >
          <Navigation size={11} /> Direções
        </a>
        <button
          type="button"
          onClick={onToggleMap}
          className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
        >
          <MapPin size={11} /> {showMap ? 'Ocultar mapa' : 'Mapa'}
        </button>
      </div>

      {showMap && (
        <SinglePointMap
          lat={c.latitude}
          lon={c.longitude}
          label={c.name}
          className="mt-3 w-full h-56 rounded-xl border border-slate-200 overflow-hidden"
        />
      )}
    </div>
  )
}
