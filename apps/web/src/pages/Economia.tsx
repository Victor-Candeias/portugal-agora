import { ComingSoon } from '@/components/ComingSoon'

export function Economia() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📊 Economia</h1>
        <p className="text-slate-500 text-sm mt-1">INE · Banco de Portugal</p>
      </div>
      <ComingSoon
        feature="Indicadores Económicos — INE + BdP"
        source="ine.pt · bportugal.pt"
        planned="Phase 2 — API Aberta"
      />
    </div>
  )
}
