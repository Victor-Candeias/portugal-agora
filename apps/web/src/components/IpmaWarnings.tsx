import {
  formatWarningTime,
  WARNING_LEVEL_COLORS,
  WARNING_LEVEL_LABELS,
  type IpmaWarning,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { Spinner } from '@/components/Feedback'

// Lista de avisos meteorológicos do IPMA (WEB-025), usada na página Tempo.
export function IpmaWarnings({
  warnings,
  regionLabel,
  isLoading,
  isError,
}: {
  warnings: IpmaWarning[]
  regionLabel: string
  isLoading: boolean
  isError: boolean
}) {
  return (
    <Card>
      <CardTitle>⚠️ Avisos meteorológicos · {regionLabel}</CardTitle>
      {isLoading && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}
      {isError && <p className="text-sm text-red-600">Não foi possível carregar os avisos do IPMA.</p>}
      {!isLoading && !isError && warnings.length === 0 && (
        <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          ✅ Sem avisos meteorológicos ativos para {regionLabel}.
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {warnings.map(w => {
            const colors = WARNING_LEVEL_COLORS[w.level]
            return (
              <li key={w.id} className="py-3 flex gap-3">
                <span
                  className="mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                  style={{ color: colors.color, backgroundColor: colors.background }}
                >
                  {WARNING_LEVEL_LABELS[w.level]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {w.type} <span className="font-normal text-slate-500">· {w.areaName}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatWarningTime(w.startTime)} → {formatWarningTime(w.endTime)}
                  </p>
                  {w.text && <p className="text-sm text-slate-600 mt-1">{w.text}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-slate-400 mt-3">Fonte: IPMA (open-data)</p>
    </Card>
  )
}
