import { useMemo, useState } from 'react'
import { ExternalLink, Search, X } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { usePrrProjects, usePrrSummary, usePt2030Summary } from '@/hooks/useFundos'
import {
  countPrrProjectsByComponent,
  filterPrrProjects,
  formatPt2030Budget,
  groupPrrProjects,
  type PrrComponent,
  type PrrProject,
} from '@portugal-hoje/core'

const NO_COMPONENTS: PrrComponent[] = []
const NO_PROJECTS: PrrProject[] = []

// Fundos PRR / PT2030 (WEB-032): resumo do PRR por componente, investimentos com pesquisa e resumo do PT2030.
export function Fundos() {
  const [query, setQuery] = useState('')
  const [component, setComponent] = useState<string | null>(null)

  const summary = usePrrSummary()
  const projects = usePrrProjects()
  const pt2030 = usePt2030Summary()

  const components = summary.data?.components ?? NO_COMPONENTS
  const allProjects = projects.data ?? NO_PROJECTS
  const counts = useMemo(() => countPrrProjectsByComponent(allProjects), [allProjects])
  const groups = useMemo(
    () => groupPrrProjects(filterPrrProjects(allProjects, { q: query, component }), components),
    [allProjects, components, query, component],
  )
  const shown = groups.reduce((n, g) => n + g.projects.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🇪🇺 Fundos PRR / PT2030</h1>
        <p className="text-slate-500 text-sm mt-1">Plano de Recuperação e Resiliência e Portugal 2030 · Fonte: transparencia.gov.pt via API Aberta</p>
      </div>

      {/* Resumo PRR + PT2030 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>PRR</CardTitle>
          {summary.isLoading && <LoadingBox />}
          {summary.isError && <ErrorBox message={(summary.error as Error).message} />}
          {summary.data && (
            <>
              <p className="font-semibold text-slate-900">{summary.data.plan}</p>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Stat label="Execução" value={summary.data.execution_period.replace('-', '–')} />
                <Stat label="Componentes" value={String(summary.data.total_components)} />
                <Stat label="Investimentos" value={String(summary.data.total_investments)} />
              </div>
              <SourceLink href={summary.data.source} />
            </>
          )}
        </Card>
        <Card>
          <CardTitle>PT2030</CardTitle>
          {pt2030.isLoading && <LoadingBox />}
          {pt2030.isError && <ErrorBox message={(pt2030.error as Error).message} />}
          {pt2030.data && (
            <>
              <p className="font-semibold text-slate-900">{pt2030.data.plan}</p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Stat label="Período" value={pt2030.data.execution_period.replace('-', '–')} />
                <Stat label="Orçamento" value={formatPt2030Budget(pt2030.data.total_budget)} />
              </div>
              <p className="text-xs text-slate-400 mt-3">A API Aberta só tem o resumo do PT2030 (sem lista de projetos).</p>
              <SourceLink href={pt2030.data.source} />
            </>
          )}
        </Card>
      </div>

      {/* Investimentos PRR */}
      <Card>
        <CardTitle>Investimentos do PRR {allProjects.length > 0 ? `(${shown} de ${allProjects.length})` : ''}</CardTitle>

        <div className="relative max-w-md mb-3">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar investimentos (ex.: saúde, habitação)"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              aria-label="Limpar pesquisa"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {components.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <ComponentChip label="Todas" selected={component === null} onClick={() => setComponent(null)} />
            {components.map(c => (
              <ComponentChip
                key={c.id}
                label={`${c.id} · ${c.name}${counts[c.id] ? ` (${counts[c.id]})` : ''}`}
                selected={component === c.id}
                onClick={() => setComponent(component === c.id ? null : c.id)}
              />
            ))}
          </div>
        )}

        {projects.isLoading && <LoadingBox />}
        {projects.isError && <ErrorBox message={(projects.error as Error).message} />}
        {projects.data && shown === 0 && (
          <p className="text-slate-500 text-sm py-6 text-center">Nenhum investimento encontrado.</p>
        )}
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g.component.id}>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">
                <span className="text-green-700 font-mono mr-1.5">{g.component.id}</span>
                {g.component.name}
                <span className="text-slate-400 font-normal"> · {g.projects.length}</span>
              </h3>
              <ul className="divide-y divide-slate-100">
                {g.projects.map((p, i) => (
                  <li key={`${p.parent_id}-${i}`} className="py-2 text-sm text-slate-700">{p.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {projects.data && (
          <p className="text-xs text-slate-400 mt-4">Os nomes vêm da fonte sem acentos. A fonte não inclui montantes por investimento.</p>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function SourceLink({ href }: { href: string }) {
  if (!/^https?:\/\//.test(href)) return null
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3">
      <ExternalLink size={12} /> {href.replace(/^https?:\/\//, '')}
    </a>
  )
}

function ComponentChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        selected ? 'bg-green-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}
