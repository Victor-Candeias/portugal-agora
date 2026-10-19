import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom'
import { Fuel, CloudSun, Zap, ShieldAlert, BarChart3, Flag, Hospital, Train, MailOpen, Palmtree, TrainFront, Shield, FileText, IdCard, Landmark, MapPinned, Menu, X, PlugZap } from 'lucide-react'
import { useAnpcSummary } from '@/hooks/useANPC'

const NAV = [
  { to: '/',             label: 'Início',         icon: Flag },
  { to: '/combustivel',  label: 'Combustível',    icon: Fuel },
  { to: '/tempo',        label: 'Tempo',          icon: CloudSun },
  { to: '/protecao',     label: 'Proteção Civil', icon: ShieldAlert },
  { to: '/hospitais',    label: 'Hospitais',      icon: Hospital },
  { to: '/transportes',  label: 'Transportes',    icon: Train },
  { to: '/metro-porto',  label: 'Metro do Porto', icon: TrainFront },
  { to: '/servicos-publicos', label: 'Serviços Públicos', icon: Shield },
  { to: '/ev',           label: 'EV',             icon: Zap },
  { to: '/economia',     label: 'Economia',       icon: BarChart3 },
  { to: '/energia',      label: 'Energia',        icon: PlugZap },
  { to: '/contratos',    label: 'Contratos',      icon: FileText },
  { to: '/fundos',       label: 'Fundos PRR',     icon: Landmark },
  { to: '/codigo-postal', label: 'Cód. Postal',   icon: MailOpen },
  { to: '/concelhos',    label: 'Concelhos',      icon: MapPinned },
  { to: '/nif',          label: 'NIF',            icon: IdCard },
  { to: '/turismo',      label: 'Turismo',        icon: Palmtree },
]

export function Layout() {
  const { data: summary } = useAnpcSummary()
  const total = summary?.total_active ?? 0
  const isHome = useLocation().pathname === '/'
  // Gaveta do menu lateral em ecrãs pequenos (WEB-048); em `lg` o menu está sempre visível.
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top alert banner */}
      {total > 0 && (
        <div className="bg-orange-600 text-white text-sm px-4 py-2 text-center font-medium">
          🚒 {total} ocorrência{total > 1 ? 's' : ''} ativa{total > 1 ? 's' : ''} em Portugal — <Link to="/protecao" className="underline">ver detalhes</Link>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              aria-controls="menu-lateral"
            >
              <Menu size={22} />
            </button>
            <Link to="/" className="flex items-center gap-2" aria-label="Portugal-Hoje — Início">
              <span className="text-2xl">🇵🇹</span>
              <span className="font-bold text-lg text-green-700">Portugal-Hoje</span>
            </Link>
          </div>
          {/* Atalho para o Início em todas as páginas exceto o próprio Início (WEB-037). */}
          {!isHome && (
            <Link
              to="/"
              className="text-sm font-semibold text-green-700 hover:text-green-800 px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
              aria-label="Ir para o Início"
            >
              🏠 Início
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Fundo escuro da gaveta em ecrãs pequenos */}
        {menuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-[1090] bg-slate-900/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Menu lateral (WEB-048): fixo em `lg`, gaveta deslizante em ecrãs pequenos */}
        <aside
          id="menu-lateral"
          className={`fixed inset-y-0 left-0 z-[1100] w-64 bg-white border-r border-slate-200 shadow-lg transition-transform duration-200 flex flex-col
            lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-56 lg:shrink-0 lg:shadow-none lg:translate-x-0
            ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="lg:hidden h-14 px-4 flex items-center justify-between border-b border-slate-200">
            <span className="font-bold text-green-700">Menu</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="p-2 -mr-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-2" aria-label="Secções">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 text-sm font-medium border-l-4 transition-colors ${
                    isActive
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {to === '/protecao' && total > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                    {total}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 py-6">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white text-xs text-slate-400 text-center py-3">
        Dados: API Aberta · DGEG · IPMA · ANPC · REN
      </footer>
    </div>
  )
}
