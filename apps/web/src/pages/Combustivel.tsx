import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useFuelPrices } from '@/hooks/useFuel'
import { useDistricts, useMunicipalities } from '@/hooks/useGeo'
import { formatPrice, FUEL_LABELS, FUEL_COLORS, type FuelType } from '@portugal-hoje/core'

const FUEL_TYPES: FuelType[] = ['gasoline_95', 'gasoline_98', 'diesel', 'diesel_plus', 'lpg']

export function Combustivel() {
  const [fuelType, setFuelType] = useState<FuelType>('gasoline_95')
  const [districtId, setDistrictId] = useState<number | undefined>(11) // Lisboa por defeito
  const [districtName, setDistrictName] = useState<string>('Lisboa')
  const [municipalityId, setMunicipalityId] = useState<number | undefined>(undefined)

  const { data: districts, isLoading: loadingDistricts } = useDistricts()
  const { data: municipalities } = useMunicipalities(districtId)
  const { data: stations = [], isLoading, isError, error } = useFuelPrices(fuelType, districtId, municipalityId)

  const minPrice = stations[0]?.price_eur
  const maxPrice = stations[stations.length - 1]?.price_eur
  const avgPrice = stations.length
    ? stations.reduce((s, x) => s + x.price_eur, 0) / stations.length
    : null

  function handleDistrictChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value ? Number(e.target.value) : undefined
    const name = e.target.options[e.target.selectedIndex].text
    setDistrictId(id)
    setDistrictName(id ? name : '')
    setMunicipalityId(undefined)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">⛽ Preços de Combustível</h1>
        <p className="text-slate-500 text-sm mt-1">Dados DGEG · Atualização diária</p>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {FUEL_TYPES.map(ft => (
                <button
                  key={ft}
                  onClick={() => setFuelType(ft)}
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
          <div className="flex gap-3">
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
                  onChange={e => setMunicipalityId(e.target.value ? Number(e.target.value) : undefined)}
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
          {stations.length > 0 ? ` (${stations.length})` : ''}
        </CardTitle>
        {isLoading && <LoadingBox />}
        {isError && <ErrorBox message={(error as Error).message} />}
        {!isLoading && !isError && (
          <div className="divide-y divide-slate-100">
            {stations.length === 0 && (
              <p className="text-slate-500 text-sm py-6 text-center">Nenhum resultado encontrado.</p>
            )}
            {stations.map((s, i) => (
              <div key={s.Id} className="flex items-center py-3 gap-3">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: i === 0 ? '#16a34a' : i === 1 ? '#65a30d' : '#94a3b8' }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 text-sm truncate">{s.Nome}</p>
                  <p className="text-xs text-slate-400">{s.Marca}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin size={11} />
                    {s.Morada} · {s.Municipio}, {s.Distrito}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 min-w-[90px]">
                  <p
                    className="text-lg font-bold tabular-nums"
                    style={{ color: i === 0 ? '#16a34a' : '#0f172a' }}
                  >
                    {formatPrice(s.price_eur)}
                  </p>
                  {minPrice && i > 0 && (
                    <p className="text-xs text-red-500 tabular-nums">
                      +{formatPrice(s.price_eur - minPrice)}
                    </p>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${s.Latitude},${s.Longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                  title="Navegar"
                >
                  <Navigation size={14} className="text-slate-600" />
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
