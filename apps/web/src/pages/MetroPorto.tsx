import { useMemo, useState } from 'react'
import { MapPin, TrainFront, Clock3 } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { SinglePointMap } from '@/components/SinglePointMap'
import {
  useMetroStations, useMetroStationLines, useMetroNextDepartures, useMetroPortoMeta,
  formatDepartureTime, secondsSinceMidnight,
  type MetroStation,
} from '@/hooks/useMetroPorto'

const PAGE_SIZE = 20

function contrastColor(hex: string | null): string {
  if (!hex) return '#0f172a'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#0f172a' : '#ffffff'
}

export function MetroPorto() {
  const { data: stations = [], isLoading, isError } = useMetroStations()
  const { data: meta } = useMetroPortoMeta()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedStation, setExpandedStation] = useState<string | null>(null)
  const [showMap, setShowMap] = useState(false)

  function resetPage() { setPage(1) }

  const filtered = useMemo(
    () => stations.filter(s => !search || s.station_name.toLowerCase().includes(search.toLowerCase())),
    [stations, search],
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚇 Metro do Porto</h1>
          <p className="text-slate-500 text-sm mt-1">
            Estações e próximas partidas · dados GTFS oficiais
            {meta?.generated_at && ` · atualizado em ${new Date(meta.generated_at).toLocaleDateString('pt-PT')}`}
          </p>
        </div>
      </div>

      <Card>
        <CardTitle>Estações</CardTitle>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Pesquisar</label>
          <input
            type="text"
            placeholder="Nome da estação…"
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage() }}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>

        {isLoading && <LoadingBox />}
        {isError && <ErrorBox message="Erro ao carregar dados do Metro do Porto." />}

        {!isLoading && !isError && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {filtered.length} estação{filtered.length !== 1 ? 'ões' : ''} encontrada{filtered.length !== 1 ? 's' : ''}
              {totalPages > 1 && ` · página ${page} de ${totalPages}`}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginated.map(station => (
                <MetroStationCard
                  key={station.station_id}
                  station={station}
                  expanded={expandedStation === station.station_id}
                  showMap={showMap && expandedStation === station.station_id}
                  onToggle={() => {
                    const next = expandedStation === station.station_id ? null : station.station_id
                    setExpandedStation(next)
                    if (!next) setShowMap(false)
                  }}
                  onToggleMap={() => setShowMap(!showMap)}
                />
              ))}
              {filtered.length === 0 && (
                <p className="col-span-2 text-slate-400 text-sm text-center py-8">Nenhuma estação encontrada.</p>
              )}
            </div>

            <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); setExpandedStation(null); setShowMap(false) }} />
          </>
        )}
      </Card>
    </div>
  )
}

interface MetroStationCardProps {
  station: MetroStation
  expanded: boolean
  showMap: boolean
  onToggle: () => void
  onToggleMap: () => void
}

function MetroStationCard({ station, expanded, showMap, onToggle, onToggleMap }: MetroStationCardProps) {
  const { data: lines = [] } = useMetroStationLines(expanded ? station.station_id : undefined)
  const { data: departures = [], isLoading: isLoadingDepartures } = useMetroNextDepartures(expanded ? station.station_id : undefined)

  return (
    <div className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-slate-900 text-sm leading-snug flex items-center gap-1.5">
          <TrainFront size={14} className="text-purple-600 flex-shrink-0" /> {station.station_name}
        </p>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 flex-shrink-0"
        >
          {expanded ? 'Fechar' : 'Ver partidas'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-3">
          {lines.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lines.map(line => (
                <span
                  key={line.line_id}
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: line.color ? `#${line.color}` : '#e2e8f0', color: contrastColor(line.color) }}
                >
                  {line.short_name}
                </span>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <Clock3 size={11} /> Próximas partidas
            </p>
            {isLoadingDepartures && <p className="text-xs text-slate-400">A carregar horários…</p>}
            {!isLoadingDepartures && departures.length === 0 && (
              <p className="text-xs text-slate-400">Sem mais partidas previstas hoje nesta estação.</p>
            )}
            {!isLoadingDepartures && departures.length > 0 && (
              <ul className="space-y-1">
                {departures.slice(0, 8).map((dep, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <span
                      className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                      style={{ backgroundColor: dep.color ? `#${dep.color}` : '#e2e8f0', color: contrastColor(dep.color) }}
                    >
                      {dep.short_name}
                    </span>
                    <span className="font-mono">{formatDepartureTime(dep.departure_seconds)}</span>
                    <span className="text-slate-400">→ {dep.destination ?? '—'}</span>
                    {dep.departure_seconds - secondsSinceMidnight(new Date()) < 300 && (
                      <span className="text-green-600 font-medium">a chegar</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {station.latitude && station.longitude && (
            <button
              type="button"
              onClick={onToggleMap}
              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              <MapPin size={11} /> {showMap ? 'Ocultar mapa' : 'Mapa'}
            </button>
          )}

          {showMap && station.latitude && station.longitude && (
            <SinglePointMap
              lat={station.latitude}
              lon={station.longitude}
              label={station.station_name}
              className="w-full h-56 rounded-xl border border-slate-200 overflow-hidden"
            />
          )}
        </div>
      )}
    </div>
  )
}
