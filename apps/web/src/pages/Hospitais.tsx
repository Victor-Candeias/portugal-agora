import { useState, useMemo, useEffect } from 'react'
import { MapPin, Phone, Mail, Activity, ChevronDown, Navigation } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { useHospitaisValencias } from '@/hooks/useHospitais'

const PAGE_SIZE = 20
const DEFAULT_DISTRITO = 'Lisboa'

const TIPO_COLOR: Record<string, string> = {
  'Serviço de Urgência Básica':                           'bg-blue-100 text-blue-800',
  'Serviço de Urgência Médico-cirúrgico':                 'bg-purple-100 text-purple-800',
  'Serviço de Urgência Polivalente':                      'bg-orange-100 text-orange-800',
  'Serviço de Urgência Polivalente com Centro de Trauma': 'bg-red-100 text-red-800',
}

function tipoLabel(tipo: string) {
  return tipo
    .replace('Serviço de Urgência ', '')
    .replace(' com Centro de Trauma', ' +Trauma')
}

type UserLocation = {
  latitude: number
  longitude: number
}

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

export function Hospitais() {
  const { data: hospitals = [], isLoading, isError } = useHospitaisValencias()

  const [distrito, setDistrito] = useState(DEFAULT_DISTRITO)
  const [municipio, setMunicipio] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle')

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
        setDistrito('')
        setMunicipio('')
        resetPage()
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  }

  const distritos = useMemo(
    () => [...new Set(hospitals.map(h => h.distrito).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals],
  )

  const municipios = useMemo(
    () => [...new Set(
      hospitals
        .filter(h => !distrito || h.distrito === distrito)
        .map(h => h.municipio)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals, distrito],
  )

  const filtered = useMemo(() =>
    hospitals.filter(h =>
      (!distrito  || h.distrito  === distrito) &&
      (!municipio || h.municipio === municipio) &&
      (!search    || h.nome.toLowerCase().includes(search.toLowerCase()) ||
                     h.localidade.toLowerCase().includes(search.toLowerCase())),
    ), [hospitals, distrito, municipio, search])

  const sortedFiltered = useMemo(() => {
    if (!userLocation) return filtered
    return [...filtered].sort((a, b) => {
      const da = a.lat !== 0 ? distanceKm(userLocation, a) : Infinity
      const db = b.lat !== 0 ? distanceKm(userLocation, b) : Infinity
      return da - db
    })
  }, [filtered, userLocation])

  const totalPages = Math.ceil(sortedFiltered.length / PAGE_SIZE)
  const paginated = sortedFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetPage() { setPage(1) }

  const hasFilter = !!(distrito || municipio || search)
  const showList = !!(distrito || search || userLocation)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏥 Hospitais SNS</h1>
          <p className="text-slate-500 text-sm mt-1">Transparência SNS · Ministério da Saúde</p>
        </div>
        <a
          href="https://transparencia.sns.gov.pt"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Activity size={13} /> transparencia.sns.gov.pt
        </a>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {userLocation ? 'A mostrar hospitais mais próximos da sua localização.' : 'Permita a localização para ver os hospitais mais próximos.'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {locationStatus === 'loading' && 'A pedir acesso à localização...'}
            {locationStatus === 'denied' && 'Localização não autorizada. A usar Lisboa (todos os municípios) por defeito.'}
            {locationStatus === 'unsupported' && 'Este dispositivo não suporta localização no browser.'}
            {locationStatus === 'granted' && 'Pode alterar distrito/município manualmente.'}
            {locationStatus === 'idle' && 'A localização é usada apenas para ordenar hospitais por distância.'}
          </p>
        </div>
        <button
          onClick={requestLocation}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Navigation size={14} />
          Usar localização
        </button>
      </Card>

      <Card>
        <CardTitle>Filtros</CardTitle>

        <div className="space-y-3 mb-5">
          {/* Pesquisa por nome */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Pesquisar hospital</label>
            <input
              type="text"
              placeholder="Nome do hospital ou localidade…"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>

          {/* Distrito */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Distrito</label>
            <div className="relative">
              <select
                value={distrito}
                onChange={e => { setUserLocation(null); setDistrito(e.target.value); setMunicipio(''); resetPage() }}
                disabled={isLoading}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white appearance-none pr-8 disabled:opacity-50 disabled:cursor-wait"
              >
                <option value="">{isLoading ? 'A carregar distritos…' : 'Selecione um distrito'}</option>
                {distritos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Município — só aparece quando distrito selecionado */}
          {distrito && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Município</label>
              <div className="relative">
                <select
                  value={municipio}
                  onChange={e => { setUserLocation(null); setMunicipio(e.target.value); resetPage() }}
                  disabled={isLoading}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white appearance-none pr-8 disabled:opacity-50 disabled:cursor-wait"
                >
                  <option value="">Selecione um município</option>
                  {municipios.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {hasFilter && (
            <button
              onClick={() => { setUserLocation(null); setDistrito(''); setMunicipio(''); setSearch(''); resetPage() }}
              className="text-xs text-slate-400 hover:text-slate-700 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {isLoading && <LoadingBox />}
        {isError   && <ErrorBox message="Erro ao carregar hospitais SNS." />}

        {!isLoading && !isError && !showList && (
          <p className="text-slate-400 text-sm text-center py-8">Selecione um distrito ou pesquise por nome para ver os hospitais.</p>
        )}

        {!isLoading && !isError && showList && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-400">
                {sortedFiltered.length} serviço{sortedFiltered.length !== 1 ? 's' : ''} encontrado{sortedFiltered.length !== 1 ? 's' : ''}
                {totalPages > 1 && ` · página ${page} de ${totalPages}`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginated.map(h => (
                <div key={h.nome} className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-slate-900 text-sm leading-snug">{h.nome}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${TIPO_COLOR[h.tipo_de_urgencia] ?? 'bg-slate-100 text-slate-700'}`}>
                      {tipoLabel(h.tipo_de_urgencia)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <MapPin size={11} />
                    {h.endereco}, {h.localidade} {h.codigo_postal}
                  </p>
                  {h.distrito && (
                    <p className="text-xs text-slate-400 mb-2 pl-4">
                      {h.municipio}{h.distrito ? ` · ${h.distrito}` : ''}
                    </p>
                  )}
                  {userLocation && h.lat !== 0 && (
                    <p className="text-xs text-green-700 font-medium mb-2 pl-4">
                      {distanceKm(userLocation, h).toFixed(1)} km de distância
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mb-2">
                    {h.valencias.map(v => (
                      <span key={v.nome} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {v.nome}
                      </span>
                    ))}
                    {h.saude24 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Saúde 24
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {h.telefone && (
                      <a href={`tel:${h.telefone}`} className="flex items-center gap-1 hover:text-blue-600">
                        <Phone size={11} /> {h.telefone}
                      </a>
                    )}
                    {h.email && (
                      <a href={`mailto:${h.email}`} className="flex items-center gap-1 hover:text-blue-600 max-w-[180px] truncate">
                        <Mail size={11} /> {h.email}
                      </a>
                    )}
                    {h.lat !== 0 && (
                      <a
                        href={`https://www.google.com/maps?q=${h.lat},${h.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
                      >
                        <MapPin size={11} /> Mapa
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {sortedFiltered.length === 0 && (
                <p className="col-span-2 text-slate-400 text-sm text-center py-8">Nenhum resultado encontrado.</p>
              )}
            </div>

            {/* Pagination */}
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </Card>
    </div>
  )
}
