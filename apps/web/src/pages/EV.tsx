import { ComingSoon } from '@/components/ComingSoon'

export function EV() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">⚡ Carregamento EV</h1>
        <p className="text-slate-500 text-sm mt-1">Rede MOBI.E</p>
      </div>
      <ComingSoon
        feature="Carregamento EV — MOBI.E"
        source="mobi.e"
        planned="Phase 2 — API Aberta"
      />
    </div>
  )
}
