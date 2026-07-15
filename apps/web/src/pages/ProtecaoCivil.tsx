import { useState } from 'react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { SinglePointMap } from '@/components/SinglePointMap'
import { useAnpcIncidents, useAnpcSummary } from '@/hooks/useANPC'

const PAGE_SIZE = 20

const TYPE_EMOJI: Record<string, string> = {
  'Mato':                   '🔥',
  'Povoamento Florestal':   '🌲',
  'Agrícola':               '🌾',
  'Urbano ou Industrial':   '🏭',
  'Habitação':              '🏠',
  'Veículos':               '🚗',
  'Outros':                 '⚠️',
}

function getEmoji(type: string) {
  return TYPE_EMOJI[type] ?? '🚒'
}

const STATUS_COLOR: Record<string, string> = {
  'Despacho de 1º Alerta':  'bg-yellow-100 text-yellow-800',
  'Despacho de 2º Alerta':  'bg-orange-100 text-orange-800',
  'Despacho de 3º Alerta':  'bg-red-100 text-red-800',
  'Conclusão':              'bg-slate-100 text-slate-600',
  'Em Curso':               'bg-red-100 text-red-700',
}

function getStatusColor(status: string) {
  for (const [key, cls] of Object.entries(STATUS_COLOR)) {
    if (status.includes(key.split(' ')[2] ?? key)) return cls
  }
  return STATUS_COLOR[status] ?? 'bg-slate-100 text-slate-600'
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
}

export function ProtecaoCivil() {
  const { data: incidents, isLoading: incLoading, isError: incError, error: incErr, refetch } = useAnpcIncidents()
  const { data: summary, isLoading: sumLoading } = useAnpcSummary()

  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [showConcluded, setShowConcluded] = useState(false)
  const [page, setPage] = useState(1)
  const [mapIncidentId, setMapIncidentId] = useState<string | null>(null)

  const asOf = incidents?.as_of ? formatTime(incidents.as_of) : ''

  const allIncidents = incidents?.data ?? []
  const activeIncidents = allIncidents.filter(inc => !inc.status.includes('Conclusão'))
  const concludedIncidents = allIncidents.filter(inc => inc.status.includes('Conclusão'))

  const baseIncidents = showConcluded ? allIncidents : activeIncidents

  const visibleIncidents = baseIncidents
    .filter(inc => !selectedDistrict || inc.location.district === selectedDistrict)
    .filter(inc => !selectedType || inc.type === selectedType)

  const totalPages      = Math.ceil(visibleIncidents.length / PAGE_SIZE)
  const pageIncidents   = visibleIncidents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function resetPage() { setPage(1) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🔥 Proteção Civil</h1>
          <p className="text-slate-500 text-sm mt-1">
            Ocorrências ANPC em tempo real {asOf && `· atualizado às ${asOf}`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-sm bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {/* Status banner */}
      {!incLoading && !incError && (
        <Card className={activeIncidents.length > 0 ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{activeIncidents.length > 0 ? '🚒' : '✅'}</span>
            <div>
              <p className="font-bold text-lg text-slate-900">
                {activeIncidents.length > 0
                  ? `${activeIncidents.length} ocorrência${activeIncidents.length > 1 ? 's' : ''} ativa${activeIncidents.length > 1 ? 's' : ''}`
                  : 'Sem ocorrências ativas'}
              </p>
              <p className="text-sm text-slate-600">
                {activeIncidents.length > 0 ? 'Consulte a lista abaixo.' : 'Situação normal em todo o país.'}
              </p>
            </div>
            {concludedIncidents.length > 0 && (
              <button
                onClick={() => { setShowConcluded(v => !v); resetPage() }}
                className={`ml-auto text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  showConcluded
                    ? 'bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {showConcluded ? '✓ ' : ''}{concludedIncidents.length} concluída{concludedIncidents.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Summary by district */}
      {(summary?.by_district?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Ocorrências por distrito</CardTitle>
            {selectedDistrict && (
              <button
                onClick={() => setSelectedDistrict(null)}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium underline"
              >
                Mostrar todos
              </button>
            )}
          </div>
          {sumLoading && <LoadingBox />}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {summary!.by_district.map(d => {
              const isSelected = selectedDistrict === d.district
              return (
                <button
                  key={d.district}
                  onClick={() => { setSelectedDistrict(isSelected ? null : d.district); setSelectedType(null); resetPage() }}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 transition-colors text-left w-full border ${
                    isSelected
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                  }`}
                >
                  <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                    {d.district}
                  </span>
                  <span className={`text-sm font-bold rounded-full w-7 h-7 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-white text-orange-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {d.count}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Summary by type */}
      {(summary?.by_type?.length ?? 0) > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Por tipo de ocorrência</CardTitle>
            {selectedType && (
              <button
                onClick={() => setSelectedType(null)}
                className="text-xs text-slate-600 hover:text-slate-800 font-medium underline"
              >
                Mostrar todos
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {summary!.by_type.map(t => {
              const isSelected = selectedType === t.type
              return (
                <button
                  key={t.type}
                  onClick={() => { setSelectedType(isSelected ? null : t.type); setSelectedDistrict(null); resetPage() }}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-colors ${
                    isSelected
                      ? 'bg-slate-700 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{getEmoji(t.type)}</span>
                  <span className={`text-sm ${isSelected ? 'text-white' : 'text-slate-700'}`}>{t.type}</span>
                  <span className={`text-sm font-bold ${isSelected ? 'text-slate-200' : 'text-slate-900'}`}>{t.count}</span>
                </button>
              )
            })}
          </div>
        </Card>
      )}

      {/* Incidents list */}
      {incLoading && <LoadingBox />}
      {incError && <ErrorBox message={(incErr as Error).message} />}

      {(incidents?.data?.length ?? 0) > 0 && (
        <Card>
          <CardTitle>
            {selectedDistrict
              ? `${visibleIncidents.length} ocorrência${visibleIncidents.length !== 1 ? 's' : ''} em ${selectedDistrict}`
              : selectedType
              ? `${visibleIncidents.length} ocorrência${visibleIncidents.length !== 1 ? 's' : ''} · ${selectedType}`
              : showConcluded
              ? `${visibleIncidents.length} ocorrências (incluindo concluídas)`
              : `${activeIncidents.length} ocorrências ativas agora`}
          </CardTitle>
          <div className="divide-y divide-slate-100">
            {pageIncidents.map(inc => {
              const showMap = mapIncidentId === inc.id
              return (
              <div key={inc.id} className="py-4">
                <div className="flex gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">{getEmoji(inc.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900 text-sm">{inc.type}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(inc.status)}`}>
                        {inc.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      📍 {inc.location.address}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                      <span>🕒 {formatTime(inc.datetime)}</span>
                      {inc.resources.ground > 0 && <span>🚒 {inc.resources.ground} terrestres</span>}
                      {inc.resources.aerial > 0 && <span>🚁 {inc.resources.aerial} aéreos</span>}
                      {inc.resources.water > 0 && <span>💧 {inc.resources.water} água</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMapIncidentId(showMap ? null : inc.id)}
                    className="text-xs text-orange-600 hover:text-orange-700 font-medium flex-shrink-0 mt-1"
                  >
                    {showMap ? 'Ocultar mapa' : 'Ver mapa'}
                  </button>
                </div>
                {showMap && (
                  <SinglePointMap
                    lat={inc.location.lat}
                    lon={inc.location.lng}
                    label={`${inc.type} · ${inc.location.address}`}
                    className="mt-3 w-full h-56 rounded-xl border border-slate-200 overflow-hidden"
                  />
                )}
              </div>
              )
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPage={p => { setPage(p); setMapIncidentId(null) }} />
        </Card>
      )}
    </div>
  )
}
