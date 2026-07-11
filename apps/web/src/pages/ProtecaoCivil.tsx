import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useAnpcIncidents, useAnpcSummary } from '@/hooks/useANPC'

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

  const total = incidents?.count ?? 0
  const asOf = incidents?.as_of ? formatTime(incidents.as_of) : ''

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
        <Card className={total > 0 ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-300'}>
          <div className="flex items-center gap-3">
            <span className="text-4xl">{total > 0 ? '🚒' : '✅'}</span>
            <div>
              <p className="font-bold text-lg text-slate-900">
                {total > 0 ? `${total} ocorrência${total > 1 ? 's' : ''} ativa${total > 1 ? 's' : ''}` : 'Sem ocorrências ativas'}
              </p>
              <p className="text-sm text-slate-600">
                {total > 0 ? 'Consulte a lista abaixo.' : 'Situação normal em todo o país.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Summary by district */}
      {(summary?.by_district?.length ?? 0) > 0 && (
        <Card>
          <CardTitle>Ocorrências por distrito</CardTitle>
          {sumLoading && <LoadingBox />}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {summary!.by_district.map(d => (
              <div
                key={d.district}
                className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2"
              >
                <span className="text-sm font-medium text-slate-700">{d.district}</span>
                <span className="text-sm font-bold text-orange-700 bg-orange-100 rounded-full w-7 h-7 flex items-center justify-center">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Summary by type */}
      {(summary?.by_type?.length ?? 0) > 0 && (
        <Card>
          <CardTitle>Por tipo de ocorrência</CardTitle>
          <div className="flex flex-wrap gap-2">
            {summary!.by_type.map(t => (
              <div key={t.type} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <span>{getEmoji(t.type)}</span>
                <span className="text-sm text-slate-700">{t.type}</span>
                <span className="text-sm font-bold text-slate-900">{t.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Incidents list */}
      {incLoading && <LoadingBox />}
      {incError && <ErrorBox message={(incErr as Error).message} />}

      {(incidents?.data?.length ?? 0) > 0 && (
        <Card>
          <CardTitle>{incidents!.count} ocorrências ativas agora</CardTitle>
          <div className="divide-y divide-slate-100">
            {incidents!.data.map(inc => (
              <div key={inc.id} className="py-4 flex gap-3">
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
                <a
                  href={`https://www.google.com/maps?q=${inc.location.lat},${inc.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium flex-shrink-0 mt-1"
                >
                  Ver mapa
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
