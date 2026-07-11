import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useDistricts, useMunicipalities } from '@/hooks/useGeo'
import { useOpenMeteoGeocode, useOpenMeteoForecast } from '@/hooks/useOpenMeteo'

function windDirLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

export function Tempo() {
  const [districtId, setDistrictId] = useState<number | undefined>(undefined)
  const [municipalityId, setMunicipalityId] = useState<number | undefined>(undefined)
  const [municipalityName, setMunicipalityName] = useState<string | undefined>(undefined)

  const { data: districts } = useDistricts()
  const { data: municipalities } = useMunicipalities(districtId)

  const { data: geoResult, isLoading: isGeocoding, isError: isGeoError } =
    useOpenMeteoGeocode(municipalityName)

  const { data: forecasts, isLoading: isForecastLoading, isError: isForecastError } =
    useOpenMeteoForecast(geoResult?.latitude, geoResult?.longitude)

  const isLoading = isGeocoding || isForecastLoading
  const isError = isGeoError || isForecastError

  const chartData = (forecasts ?? []).map(f => ({
    date: new Date(f.date).toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric' }),
    min: f.tMin,
    max: f.tMax,
  }))

  function handleDistrictChange(id: number) {
    setDistrictId(id)
    setMunicipalityId(undefined)
    setMunicipalityName(undefined)
  }

  function handleMunicipalityChange(id: number, name: string) {
    setMunicipalityId(id)
    setMunicipalityName(name)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🌤️ Meteorologia</h1>
        <p className="text-slate-500 text-sm mt-1">Open-Meteo · Previsão 7 dias · Todos os municípios</p>
      </div>

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

      {!municipalityName && (
        <p className="text-slate-400 text-sm text-center py-8">
          Seleciona um distrito e município para ver a previsão.
        </p>
      )}

      {municipalityName && isLoading && <LoadingBox />}
      {municipalityName && isError && <ErrorBox message="Erro ao carregar dados meteorológicos." />}

      {forecasts && forecasts.length > 0 && geoResult && (
        <>
          {/* Today highlight */}
          <Card className="bg-gradient-to-br from-sky-500 to-blue-600 text-white border-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sky-100 text-sm font-medium mb-1">{municipalityName} · Hoje</p>
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
            <CardTitle>Previsão detalhada — {municipalityName}</CardTitle>
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
