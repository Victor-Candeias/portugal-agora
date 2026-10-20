import { useState, type FormEvent } from 'react'
import { Navigation, Search, RefreshCw } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox, Spinner } from '@/components/Feedback'
import { CoverageMap } from '@/components/CoverageMap'
import { useCoverageCatalog, useMobileCoverage, usePlaceSearch } from '@/hooks/useCoverage'
import {
  ANACOM_5G_NOTICE,
  ANACOM_AGGREGATE,
  ANACOM_ATTRIBUTION,
  ANACOM_COVERAGE_DISCLAIMER,
  ANACOM_COVERAGE_LAYERS,
  ANACOM_MAP_URL,
  COVERAGE_LEGEND,
  COVERAGE_STATUS_LABELS,
  MOBILE_OPERATORS,
  MOBILE_TECHNOLOGIES,
  MOBILE_TECHNOLOGY_LABELS,
  formatReferenceQuarter,
  type CoverageStatus,
  type CoverageSubject,
  type MobileCoverageResult,
  type MobileTechnology,
  type OperatorCoverage,
  type RankedOperator,
} from '@portugal-hoje/core'

type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable' | 'unsupported'

interface SelectedPoint {
  lat: number
  lon: number
  label: string
}

// Cada estado tem ícone e texto próprios: a informação não depende só da cor.
const STATUS_STYLE: Record<CoverageStatus, { icon: string; className: string }> = {
  covered: { icon: '✅', className: 'bg-green-50 text-green-800 border-green-200' },
  not_covered: { icon: '🚫', className: 'bg-red-50 text-red-800 border-red-200' },
  unknown: { icon: '❔', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  source_unavailable: { icon: '⚠️', className: 'bg-amber-50 text-amber-800 border-amber-300' },
}

const MAP_SUBJECTS: CoverageSubject[] = [ANACOM_AGGREGATE, ...MOBILE_OPERATORS]

function subjectLabel(subject: CoverageSubject): string {
  return subject === ANACOM_AGGREGATE ? 'Melhor entre operadoras (Global PT)' : subject
}

function StatusChip({ status }: { status: CoverageStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${s.className}`}>
      <span aria-hidden="true">{s.icon}</span>
      {COVERAGE_STATUS_LABELS[status]}
    </span>
  )
}

function ClassCell({ row, provisional }: { row: OperatorCoverage; provisional: boolean }) {
  if (!row.coverageClass) return <span className="text-slate-400">—</span>
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className="inline-block w-3 h-3 rounded-sm border border-slate-300"
        style={{ backgroundColor: row.coverageClass.color }}
        aria-hidden="true"
      />
      <span className="font-medium text-slate-900">{row.coverageClass.label}</span>
      {provisional && <span className="text-[10px] font-semibold uppercase text-purple-700 bg-purple-50 border border-purple-200 rounded px-1">provisório</span>}
    </span>
  )
}

function CoverageResults({
  data,
  point,
  onRetry,
  retrying,
}: {
  data: MobileCoverageResult
  point: SelectedPoint
  onRetry: () => void
  retrying: boolean
}) {
  const reference = formatReferenceQuarter(data.referenceQuarter)
  const sourceDown = [data.aggregate, ...data.operators].some(o => o.status === 'source_unavailable')
  const rows: Array<OperatorCoverage | RankedOperator> = data.ranking ?? data.operators
  const techLabel = MOBILE_TECHNOLOGY_LABELS[data.technology]

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        📍 {point.label} · {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
      </p>

      {data.outsideCoverageArea && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          ❔ Este ponto está fora da área com dados da ANACOM (Portugal continental, Açores e Madeira).
        </div>
      )}

      {sourceDown && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>⚠️ A ANACOM não respondeu a tempo. Os dados deste ponto não estão disponíveis de momento.</span>
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            <RefreshCw size={12} className={retrying ? 'animate-spin' : ''} /> Tentar de novo
          </button>
        </div>
      )}

      {!data.outsideCoverageArea && !sourceDown && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{techLabel} · melhor entre operadoras</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusChip status={data.aggregate.status} />
            <ClassCell row={data.aggregate} provisional={data.provisional} />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="caption-bottom pt-2 text-left text-xs text-slate-500">
            Classe de velocidade potencial (máxima de download prevista), não velocidade medida.{' '}
            Fonte: <a href={ANACOM_MAP_URL} target="_blank" rel="noopener noreferrer" className="underline">ANACOM</a>
            {reference ? ` · dados do ${reference}` : ''}.
          </caption>
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
              <th scope="col" className="py-2 pr-3">Posição</th>
              <th scope="col" className="py-2 pr-3">Operadora</th>
              <th scope="col" className="py-2 pr-3">Estado</th>
              <th scope="col" className="py-2">{data.technology === '2G' ? 'Qualidade (voz)' : 'Classe potencial'}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const ranked = 'position' in row ? row : null
              return (
                <tr key={row.operator} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 tabular-nums text-slate-700 whitespace-nowrap">
                    {ranked ? `${ranked.position}.º${ranked.tied ? ' (empate)' : ''}` : '—'}
                  </td>
                  <th scope="row" className="py-2 pr-3 text-left font-semibold text-slate-900">{row.operator}</th>
                  <td className="py-2 pr-3"><StatusChip status={row.status} /></td>
                  <td className="py-2"><ClassCell row={row} provisional={data.provisional} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!data.ranking && !data.outsideCoverageArea && !sourceDown && (
        <p className="text-xs text-slate-500">Sem ordenação: há operadoras sem dados neste ponto, por isso não se compara.</p>
      )}
    </div>
  )
}

export function Cobertura() {
  const [technology, setTechnology] = useState<MobileTechnology>('4G')
  const [point, setPoint] = useState<SelectedPoint | null>(null)
  const [focusKey, setFocusKey] = useState(0)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [mapSubject, setMapSubject] = useState<CoverageSubject>(ANACOM_AGGREGATE)
  const [opacity, setOpacity] = useState(0.7)

  const coverage = useMobileCoverage(technology, point)
  const catalog = useCoverageCatalog()
  const places = usePlaceSearch(searchTerm)

  function focusOn(next: SelectedPoint) {
    setPoint(next)
    setFocusKey(k => k + 1)
  }

  // A localização só é pedida ao clicar, e só é usada no browser para consultar a ANACOM.
  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported')
      return
    }
    setLocationStatus('loading')
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocationStatus('granted')
        focusOn({ lat: position.coords.latitude, lon: position.coords.longitude, label: 'A sua localização' })
      },
      error => setLocationStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    setSearchTerm(searchInput)
  }

  const legend = COVERAGE_LEGEND[technology]
  const catalogIssues = catalog.data && !catalog.data.ok ? catalog.data.issues : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📶 Cobertura móvel</h1>
        <p className="text-slate-500 text-sm mt-1">Qual é a melhor cobertura móvel neste local? Dados oficiais da ANACOM, por operadora.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1" role="note">
        <p>ℹ️ {ANACOM_COVERAGE_DISCLAIMER}</p>
        {technology === '5G' && <p>🧪 {ANACOM_5G_NOTICE}</p>}
        <p className="text-xs text-amber-800">
          {ANACOM_ATTRIBUTION} ·{' '}
          <a href={ANACOM_MAP_URL} target="_blank" rel="noopener noreferrer" className="underline">mapa oficial em geo.anacom.pt</a>
        </p>
      </div>

      {catalogIssues.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠️ O catálogo de camadas da ANACOM mudou e alguns resultados podem estar errados:{' '}
          {catalogIssues.map(i => `${subjectLabel(i.operator)} ${i.technology} (camada ${i.layerId})`).join(', ')}.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardTitle>Local</CardTitle>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locationStatus === 'loading'}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <Navigation size={14} /> Usar a minha localização
                </button>
                <p className="text-xs text-slate-500 flex-1 min-w-48">
                  {locationStatus === 'idle' && 'A localização só é pedida se clicar, e serve apenas para consultar a ANACOM.'}
                  {locationStatus === 'loading' && 'A pedir acesso à localização...'}
                  {locationStatus === 'granted' && 'Localização obtida.'}
                  {locationStatus === 'denied' && 'Localização não autorizada. Pesquise uma localidade ou clique no mapa.'}
                  {locationStatus === 'unavailable' && 'Não foi possível obter a localização. Pesquise uma localidade ou clique no mapa.'}
                  {locationStatus === 'unsupported' && 'Este browser não suporta localização. Pesquise uma localidade ou clique no mapa.'}
                </p>
              </div>

              <form onSubmit={handleSearch} className="flex gap-2" role="search">
                <label htmlFor="coverage-place" className="sr-only">Pesquisar localidade</label>
                <input
                  id="coverage-place"
                  type="search"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Pesquisar localidade (ex.: Mértola)"
                  className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-900"
                >
                  <Search size={14} /> Pesquisar
                </button>
              </form>

              {searchTerm.trim().length >= 2 && (
                <div className="text-sm">
                  {places.isLoading && <Spinner size={18} />}
                  {places.isError && <p className="text-xs text-red-600">Não foi possível pesquisar localidades.</p>}
                  {places.data && places.data.length === 0 && <p className="text-xs text-slate-500">Nenhuma localidade encontrada.</p>}
                  {places.data && places.data.length > 0 && (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {places.data.map(p => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              focusOn({ lat: p.latitude, lon: p.longitude, label: p.context ? `${p.name}, ${p.context}` : p.name })
                              setSearchTerm('')
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-900">{p.name}</span>
                            {p.context && <span className="text-xs text-slate-500"> · {p.context}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500">Ou clique no mapa para escolher um ponto.</p>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <CardTitle>Comparação de operadoras</CardTitle>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Tecnologia">
                {MOBILE_TECHNOLOGIES.map(t => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={technology === t}
                    onClick={() => setTechnology(t)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      technology === t ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {MOBILE_TECHNOLOGY_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {!point && <p className="text-sm text-slate-500">Escolha um local: use a sua localização, pesquise uma localidade ou clique no mapa.</p>}
            {point && coverage.isLoading && <LoadingBox />}
            {point && coverage.isError && <ErrorBox message="Não foi possível consultar a cobertura neste ponto." />}
            {point && coverage.data && (
              <CoverageResults
                data={coverage.data}
                point={point}
                onRetry={() => coverage.refetch()}
                retrying={coverage.isFetching}
              />
            )}
          </Card>
        </div>

        <Card className="min-w-0">
          <CardTitle>Mapa de cobertura</CardTitle>
          <div className="flex flex-wrap items-end gap-4 mb-3">
            <div>
              <label htmlFor="coverage-layer" className="block text-xs font-medium text-slate-500 mb-1">Camada ({MOBILE_TECHNOLOGY_LABELS[technology]})</label>
              <select
                id="coverage-layer"
                value={mapSubject}
                onChange={e => setMapSubject(e.target.value as CoverageSubject)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white"
              >
                {MAP_SUBJECTS.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="coverage-opacity" className="block text-xs font-medium text-slate-500 mb-1">
                Opacidade: {Math.round(opacity * 100)}%
              </label>
              <input
                id="coverage-opacity"
                type="range"
                min={0.2}
                max={1}
                step={0.1}
                value={opacity}
                onChange={e => setOpacity(Number(e.target.value))}
                className="w-36 accent-green-600"
              />
            </div>
          </div>

          <CoverageMap
            layerId={ANACOM_COVERAGE_LAYERS[mapSubject][technology]}
            opacity={opacity}
            point={point}
            focusKey={focusKey}
            onPick={(lat, lon) => setPoint({ lat, lon, label: 'Ponto escolhido no mapa' })}
          />

          <div className="mt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Legenda · {subjectLabel(mapSubject)} · {MOBILE_TECHNOLOGY_LABELS[technology]}{technology === '5G' ? ' (provisório)' : ''}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
              {legend.map(c => (
                <li key={c.label} className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-sm border border-slate-300" style={{ backgroundColor: c.color }} aria-hidden="true" />
                  {c.label}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm border border-dashed border-slate-400 bg-white" aria-hidden="true" />
                Sem cor: não disponível ou sem dados
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  )
}
