import { NavLink, Outlet } from 'react-router-dom'
import { Fuel, CloudSun, Zap, ShieldAlert, BarChart3, Flag } from 'lucide-react'
import { useAnpcSummary } from '@/hooks/useANPC'

const NAV = [
  { to: '/',            label: 'Início',         icon: Flag },
  { to: '/combustivel', label: 'Combustível',    icon: Fuel },
  { to: '/tempo',       label: 'Tempo',          icon: CloudSun },
  { to: '/protecao',    label: 'Proteção Civil', icon: ShieldAlert },
  { to: '/ev',          label: 'EV',             icon: Zap },
  { to: '/economia',    label: 'Economia',       icon: BarChart3 },
]

export function Layout() {
  const { data: summary } = useAnpcSummary()
  const total = summary?.total_active ?? 0

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top alert banner */}
      {total > 0 && (
        <div className="bg-orange-600 text-white text-sm px-4 py-2 text-center font-medium">
          🚒 {total} ocorrência{total > 1 ? 's' : ''} ativa{total > 1 ? 's' : ''} em Portugal — <a href="/protecao" className="underline">ver detalhes</a>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-2">
          <span className="text-2xl">🇵🇹</span>
          <span className="font-bold text-lg text-green-700">Portugal Hoje</span>
        </div>
      </header>

      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 flex">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2 sm:px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-green-600 text-green-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`
              }
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
              {to === '/protecao' && total > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {total}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-400 text-center py-3">
        Dados: API Aberta · DGEG · IPMA · ANPC
      </footer>
    </div>
  )
}
