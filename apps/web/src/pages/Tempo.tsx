import { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Navigation } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useDistricts, useMunicipalities } from '@/hooks/useGeo'
import { useOpenMeteoGeocode, useOpenMeteoForecast } from '@/hooks/useOpenMeteo'

const DEFAULT_DISTRICT_ID = 11 // Lisboa
const DEFAULT_MUNICIPALITY_NAME = 'Lisboa'

function windDirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

type UserLocation = {
  latitude: number
  longitude: number
}

export function Tempo() {
  const [districtId, setDistrictId] = useState<number | undefined>(DEFAULT_DISTRICT_ID)
  const [municipalityId, setMunicipalityId] = useState<number | undefined>(undefined)
  const [municipalityName, setMunicipalityName] = useState<string | undefined>(undefined)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'>('idle')

  const { data: districts } = useDistricts()
  const { data: municipalities } = useMunicipalities(districtId)

  // Sem localização: escolhe Lisboa (distrito + município) por defeito assim que a lista carregar.
  useEffect(() => {
    if (!userLocation && districtId === DEFAULT_DISTRICT_ID && !municipalityId && municipalities) {
      const lisboa = municipalities.find(m => m.Descritivo === DEFAULT_MUNICIPALITY_NAME)
      if (lisboa) {
        setMunicipalityId(lisboa.Id)
        setMunicipalityName(lisboa.Descritivo)
      }
    }
  }, [municipalities, userLocation, districtId, municipalityId])

  useEffect(() => {
    requestLocation()
  }, [])

  const { data: geoResult, isLoading: isGeocoding, isError: isGeoError } =
    useOpenMeteoGeocode(!userLocation ? municipalityName : undefined)

  const lat = userLocation?.latitude ?? geoResult?.latitude
  const lng = userLocation?.longitude ?? geoResult?.longitude

  const { data: forecasts, isLoading: isForecastLoading, isError: isForecastError } =
    useOpenMeteoForecast(lat, lng)

  const isLoading = (!userLocation && isGeocoding) || isForecastLoading
  const isError = (!userLocation && isGeoError) || isForecastError
  const displayName = userLocation ? 'A sua localização' : municipalityName

  const chartData = (forecasts ?? []).map(f => ({
    date: new Date(f.date).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' }),
    min: f.tMin,
    max: f.tMax,
  }))

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
        setMunicipalityId(undefined)
        setMunicipalityName(undefined)
      },
      () => setLocationStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    )
  }

  function handleDistrictChange(id: number) {
    setUserLocation(null)
    setDistrictId(id)
    setMunicipalityId(undefined)
    setMunicipalityName(undefined)
  }

  function handleMunicipalityChange(id: number, name: string) {
    setUserLocation(null)
    setMunicipalityId(id)
    setMunicipalityName(name)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🌤️ Meteorologia</h1>
        <p className="text-slate-500 text-sm mt-1">Open-Meteo · Previsão 7 dias · Todos os municípios</p>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {userLocation ? 'A mostrar a previsão para a sua localização.' : 'Permita a localização para ver a previsão do sítio onde está.'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {locationStatus === 'loading' && 'A pedir acesso à localização...'}
            {locationStatus === 'denied' && 'Localização não autorizada. A usar Lisboa por defeito.'}
            {locationStatus === 'unsupported' && 'Este dispositivo não suporta localização no browser.'}
            {locationStatus === 'granted' && 'Pode alterar distrito/município manualmente.'}
            {locationStatus === 'idle' && 'A localização é usada apenas para saber a sua previsão.'}
          </p>
        </div>
        <button
          onClick={requestLocation}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          <Navigation size={14} />
          Usar localização
        </button>
      </Card>

      {/* Location selectors */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-2">Distrito</label>
            <select
              value={districtId ?? ''}
              onChange={e => handleDistrictChange(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-full"
            >
              <option value="">Selecionar distrito…</option>
              {(districts ?? []).map(d => (
                <option key={d.Id} value={d.Id}>{d.Descritivo}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-2">Município</label>
            <select
              value={municipalityId ?? ''}
              onChange={e => {
                const id = Number(e.target.value)
                const name = municipalities?.find(m => m.Id === id)?.Descritivo
                handleMunicipalityChange(id, name ?? '')
              }}
              disabled={!districtId || !municipalities}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-full disabled:opacity-40"
            >
              <option value="">Selecionar município…</option>
              {(municipalities ?? []).map(m => (
                <option key={m.Id} value={m.Id}>{m.Descritivo}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {!userLocation && !municipalityName && (
        <p className="text-slate-400 text-sm text-center py-8">
          Seleciona um distrito e município para ver a previsão.
        </p>
      )}

      {(userLocation || municipalityName) && isLoading && <LoadingBox />}
      {(userLocation || municipalityName) && isError && <ErrorBox message="Erro ao carregar dados meteorológicos." />}

      {forecasts && forecasts.length > 0 && lat !== undefined && lng !== undefined && (
        <>
          {/* Today highlight */}
          <Card className="bg-gradient-to-br from-sky-500 to-blue-600 text-white border-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sky-100 text-sm font-medium mb-1">{displayName} · Hoje</p>
                <p className="text-7xl font-bold leading-none">{forecasts[0].tMax}°</p>
                <p className="text-sky-100 mt-2">{forecasts[0].desc}</p>
              </div>
              <div className="text-right space-y-2 text-sm">
                <p className="text-5xl">{forecasts[0].emoji}</p>
                <p className="text-sky-100">Mín {forecasts[0].tMin}°</p>
                <p className="text-sky-100">💧 {forecasts[0].precipitaProb}%</p>
                <p className="text-sky-100">
                  💨 {forecasts[0].windSpeedMax} km/h {windDirLabel(forecasts[0].windDirection)}
                </p>
              </div>
            </div>
          </Card>

          {/* 7-day cards */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {forecasts.map((f, i) => (
              <Card key={f.date} className={`text-center p-3 ${i === 0 ? 'ring-2 ring-sky-400' : ''}`}>
                <p className="text-xs text-slate-500 font-medium">
                  {i === 0 ? 'Hoje' : new Date(f.date).toLocaleDateString('pt-PT', { weekday: 'short' })}
                </p>
                <p className="text-3xl my-2">{f.emoji}</p>
                <p className="text-sm font-bold text-orange-500">{f.tMax}°</p>
                <p className="text-xs text-sky-500">{f.tMin}°</p>
                <p className="text-xs text-slate-400 mt-1">💧{f.precipitaProb}%</p>
              </Card>
            ))}
          </div>

          {/* Temperature chart */}
          <Card>
            <CardTitle>Temperatura (°C) — próximos 7 dias</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="max" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="min" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="°" />
                <Tooltip formatter={(v: any) => [`${v}°C`]} />
                <Area type="monotone" dataKey="max" stroke="#f97316" fill="url(#max)" strokeWidth={2} name="Máx" />
                <Area type="monotone" dataKey="min" stroke="#38bdf8" fill="url(#min)" strokeWidth={2} name="Mín" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Detailed list */}
          <Card>
            <CardTitle>Previsão detalhada — {displayName}</CardTitle>
            <div className="divide-y divide-slate-100">
              {forecasts.map((f, i) => (
                <div key={f.date} className="flex items-center gap-4 py-3">
                  <p className="text-sm font-medium text-slate-700 w-24">
                    {i === 0 ? 'Hoje' : new Date(f.date).toLocaleDateString('pt-PT', { weekday: 'long' })}
                  </p>
                  <p className="text-2xl w-8">{f.emoji}</p>
                  <p className="text-sm text-slate-600 flex-1">{f.desc}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      <span className="text-orange-500">{f.tMax}°</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="text-sky-500">{f.tMin}°</span>
                    </p>
                    <p className="text-xs text-slate-400">
                      💧 {f.precipitaProb}% · 💨 {f.windSpeedMax} km/h
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
