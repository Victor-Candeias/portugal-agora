import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Search, X } from 'lucide-react'
import {
  formatBaseDate, formatContractValue, normalizeBaseQuery, parseBaseParty, type BaseContract,
} from '@portugal-hoje/core'
import { Card } from '@/components/Card'
import { ErrorBox, LoadingBox, Spinner } from '@/components/Feedback'
import { Pagination } from '@/components/Pagination'
import { useBaseContracts } from '@/hooks/useContratos'

// Contratos públicos do BASE.gov.pt via API Aberta (WEB-031). A pesquisa e a página ficam no URL
// (`?q=&page=`) para o Voltar do detalhe regressar à mesma lista.
export function Contratos() {
  const [params, setParams] = useSearchParams()
  const urlQuery = params.get('q') ?? ''
  const query = normalizeBaseQuery(urlQuery)
  const page = Math.max(1, Math.floor(Number(params.get('page'))) || 1)

  const [input, setInput] = useState(urlQuery)
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery)
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery)
    setInput(urlQuery)
  }

  const { data, isLoading, isError, error, isFetching, isPlaceholderData } = useBaseContracts(query, page)

  const inputQuery = normalizeBaseQuery(input)
  const inputTooShort = input.trim().length > 0 && !inputQuery

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (inputQuery) setParams({ q: inputQuery })
  }

  function clear() {
    setInput('')
    setParams({})
  }

  function goToPage(p: number) {
    setParams(query ? { q: query, page: String(p) } : { page: String(p) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📑 Contratos Públicos</h1>
        <p className="text-slate-500 text-sm mt-1">Contratos celebrados por entidades públicas · Fonte: BASE.gov.pt (via API Aberta)</p>
      </div>

      <Card>
        <form onSubmit={submit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pesquisar por texto, entidade ou NIF"
              aria-label="Pesquisar contratos"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
            />
            {input && (
              <button
                type="button"
                onClick={clear}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!inputQuery}
            className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Search size={15} /> Pesquisar
          </button>
        </form>
        {inputTooShort && <p className="text-xs text-slate-500 mt-2">Escreva pelo menos 3 caracteres.</p>}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-700">
          {query ? <>Resultados para “{query}”</> : 'Contratos mais recentes'}
          {data && (
            <span className="font-normal text-slate-500">
              {' '}· {data.total.toLocaleString('pt-PT')} contrato{data.total === 1 ? '' : 's'}
            </span>
          )}
        </h2>
        {isFetching && !isLoading && <Spinner size={16} />}
      </div>

      {isLoading && <LoadingBox />}
      {isError && <ErrorBox message={(error as Error).message} />}

      {data && data.data.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-3">📑</p>
          <p className="text-sm">Nenhum contrato encontrado.</p>
        </div>
      )}

      {data && data.data.length > 0 && (
        <>
          <ul className={`space-y-3 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
            {data.data.map(c => (
              <li key={c.id}>
                <ContractRow contract={c} />
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.pages} onPage={goToPage} />
        </>
      )}
    </div>
  )
}

function ContractRow({ contract: c }: { contract: BaseContract }) {
  const entity = parseBaseParty(c.contractingEntity)
  const awarded = parseBaseParty(c.awarded)
  return (
    <Link to={`/contratos/${encodeURIComponent(c.id)}`} className="block">
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 line-clamp-2 break-words">
              <FileText size={14} className="inline -mt-0.5 mr-1 text-slate-400" />
              {c.description || 'Sem descrição'}
            </p>
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
              <p className="truncate"><span className="text-slate-400">Entidade:</span> {entity?.name ?? '—'}</p>
              <p className="truncate"><span className="text-slate-400">Adjudicatário:</span> {awarded?.name ?? '—'}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-base font-bold text-slate-900 tabular-nums">{formatContractValue(c.value)}</p>
            <p className="text-xs text-slate-500 tabular-nums">{formatBaseDate(c.date)}</p>
          </div>
        </div>
        {c.type && (
          <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{c.type}</span>
        )}
      </Card>
    </Link>
  )
}
