// Fundos PRR / PT2030 da API Aberta (WEB-032). Fonte: transparencia.gov.pt.
// Testado a 2026-10-09: os nomes vêm sem acentos; `/prr/projects` só tem investimentos (61), sem montantes;
// a pesquisa `q` do servidor não encontra termos com acentos ("saúde"); `/pt2030/projects` dá 404.
// Por isso as apps pedem a lista toda (é pequena) e pesquisam no cliente com `filterPrrProjects`.

export const PRR_PROJECTS_MAX_LIMIT = 100

export interface PrrComponent {
  id: string
  name: string
}

export interface PrrSummary {
  plan: string
  execution_period: string
  total_components: number
  total_investments: number
  source: string
  components: PrrComponent[]
}

export interface PrrProject {
  /** Código da componente (ex.: `C01`); não é único por investimento. */
  id: string
  name: string
  section: string
  parent_id: string
}

export interface PrrProjectsPage {
  query: string | null
  component: string | null
  page: number
  limit: number
  total: number
  source: string
  data: PrrProject[]
}

export interface Pt2030Summary {
  plan: string
  description?: string
  execution_period: string
  total_budget: string
  source: string
  note?: string
}

export interface PrrComponentGroup {
  component: PrrComponent
  projects: PrrProject[]
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Filtra por componente e por texto, sem distinguir maiúsculas nem acentos. */
export function filterPrrProjects(
  projects: PrrProject[],
  filters: { q?: string; component?: string | null },
): PrrProject[] {
  const terms = normalizeText(filters.q ?? '').split(/\s+/).filter(Boolean)
  return projects.filter(p => {
    if (filters.component && p.parent_id !== filters.component) return false
    if (!terms.length) return true
    const name = normalizeText(p.name)
    return terms.every(t => name.includes(t))
  })
}

/** Agrupa os investimentos pelas componentes do resumo, pela ordem do resumo (sem grupos vazios). */
export function groupPrrProjects(projects: PrrProject[], components: PrrComponent[]): PrrComponentGroup[] {
  const known = new Set(components.map(c => c.id))
  const groups = components.map(component => ({
    component,
    projects: projects.filter(p => p.parent_id === component.id),
  }))
  const orphans = projects.filter(p => !known.has(p.parent_id))
  if (orphans.length) groups.push({ component: { id: '—', name: 'Outros' }, projects: orphans })
  return groups.filter(g => g.projects.length > 0)
}

/** Número de investimentos por componente. */
export function countPrrProjectsByComponent(projects: PrrProject[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const p of projects) counts[p.parent_id] = (counts[p.parent_id] ?? 0) + 1
  return counts
}

/** "EUR 23.4 billion" → "23,4 mil milhões €". Outros formatos ficam como vêm. */
export function formatPt2030Budget(budget: string): string {
  const match = /^\s*EUR\s*([\d.,]+)\s*billion\s*$/i.exec(budget)
  if (!match) return budget
  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value)) return budget
  return `${value.toLocaleString('pt-PT', { maximumFractionDigits: 2 })} mil milhões €`
}
