import { Link } from 'react-router-dom'
import { Fuel, CloudSun, Zap, BarChart3 } from 'lucide-react'
import { Card } from '@/components/Card'
import { LoadingBox } from '@/components/Feedback'
import { useFuelPrices } from '@/hooks/useFuel'
import { useIpmaForecast } from '@/hooks/useIPMA'
import { useAnpcSummary } from '@/hooks/useANPC'
import { formatPrice, FUEL_LABELS, type FuelType } from '@portugal-hoje/core'

const LIVE_FUEL_TYPES: FuelType[] = ['gasoline_95', 'gasoline_98', 'diesel']
const LISBOA_ID = 1110600

function ComingSoonCard({
  to, icon: Icon, title, source,
}: { to: string; icon: React.ElementType; title: string; source: string }) {
  return (
    <Link to={to} className="block">
      <Card className="h-full opacity-60 hover:opacity-80 transition-opacity">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2 rounded-lg bg-slate-200">
            <Icon size={20} className="text-slate-500" />
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Em breve</span>
        </div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-sm text-slate-400 mt-1">{source}</p>
      </Card>
    </Link>
  )
}

export function Dashboard() {
  const { data: fuel95 } = useFuelPrices('gasoline_95', 11)
  const { data: fuel98 } = useFuelPrices('gasoline_98', 11)
  const { data: diesel }  = useFuelPrices('diesel', 11)
  const { data: forecasts } = useIpmaForecast(LISBOA_ID)
  const { data: anpcSummary } = useAnpcSummary()

  const fuelMap: Partial<Record<FuelType, typeof fuel95>> = {
    gasoline_95: fuel95,
    gasoline_98: fuel98,
    diesel: diesel,
  }

  const today = forecasts?.[0]
  const totalIncidents = anpcSummary?.total_active ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bom dia, Portugal 🇵🇹</h1>
        <p className="text-slate-500 text-sm mt-1">Dados em tempo real · Lisboa</p>
      </div>

      {/* Live section */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block"></span>
          Disponível agora
        </h2>

        {/* Weather */}
        {today && (
          <Link to="/tempo" className="block mb-4">
            <Card className="hover:shadow-md transition-shadow bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{today.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <CloudSun size={12} /> Tempo · Lisboa
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {today.tMax}° <span className="text-sky-500 text-lg">{today.tMin}°</span>
                    </p>
                    <p className="text-sm text-slate-600">{today.desc}</p>
                  </div>
                </div>
                <p className="text-xs text-sky-600 font-medium">💧 {today.precipitaProb}%</p>
              </div>
            </Card>
          </Link>
        )}

        {/* ANPC */}
        <Link to="/protecao" className="block mb-4">
          <Card className={`hover:shadow-md transition-shadow ${totalIncidents > 0 ? 'bg-orange-50 border-orange-300' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{totalIncidents > 0 ? '🚒' : '✅'}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proteção Civil · ANPC</p>
                  <p className="font-bold text-slate-900">
                    {totalIncidents > 0
                      ? `${totalIncidents} ocorrência${totalIncidents > 1 ? 's' : ''} ativa${totalIncidents > 1 ? 's' : ''}`
                      : 'Sem ocorrências ativas'}
                  </p>
                </div>
              </div>
              {totalIncidents > 0 && (
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full">Ver detalhes →</span>
              )}
            </div>
          </Card>
        </Link>

        {/* Fuel */}
        {!fuel95 && !fuel98 && !diesel && <LoadingBox />}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LIVE_FUEL_TYPES.map(ft => {
            const stations = fuelMap[ft]
            const cheapest = stations?.[0]
            return (
              <Link key={ft} to="/combustivel">
                <Card className="hover:shadow-md transition-shadow border-l-4 border-l-green-500 h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <Fuel size={16} className="text-green-600" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{FUEL_LABELS[ft]}</p>
                  </div>
                  {cheapest ? (
                    <>
                      <p className="text-3xl font-bold text-green-700 tabular-nums">{formatPrice(cheapest.price_eur)}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">↓ {cheapest.Nome}</p>
                      <p className="text-xs text-slate-400">{cheapest.Municipio}</p>
                    </>
                  ) : (
                    <p className="text-slate-400 text-sm">A carregar...</p>
                  )}
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Coming soon */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
          <span className="w-2 h-2 bg-amber-400 rounded-full inline-block"></span>
          Em breve
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <ComingSoonCard to="/ev"       icon={Zap}       title="Carregamento EV" source="MOBI.E" />
          <ComingSoonCard to="/economia" icon={BarChart3} title="Economia"        source="INE · BdP" />
        </div>
      </div>
    </div>
  )
}
