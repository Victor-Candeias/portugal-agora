import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { filterMunicipalities, formatAreaKm2, municipalityDistrict, municipalityDistricts } from '@portugal-hoje/core'
import { Card } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useMunicipalities } from '@/hooks/useConcelhos'

// Lista dos 308 concelhos (API Aberta /geo, WEB-042). Pesquisa e distrito ficam no URL (`?q=&d=`)
// para o Voltar da ficha regressar à mesma lista.
export function Concelhos() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const district = params.get('d') ?? ''
  const { data, isLoading, isError, error } = useMunicipalities()

  const districts = useMemo(() => municipalityDistricts(data ?? []), [data])
  const filtered = useMemo(() => filterMunicipalities(data ?? [], { query, district }), [data, query, district])

  function update(next: { q?: string; d?: string }) {
    const q = next.q ?? query
    const d = next.d ?? district
    setParams({ ...(q ? { q } : {}), ...(d ? { d } : {}) }, { replace: true })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🏛️ Concelhos</h1>
        <p className="text-slate-500 text-sm mt-1">
          Os 308 concelhos de Portugal · Contactos da câmara, área e limites no mapa · Fonte: API Aberta
        </p>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="search"
              value={query}
              onChange={e => update({ q: e.target.value })}
              placeholder="Pesquisar concelho"
              aria-label="Pesquisar concelho"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
            />
            {query && (
              <button
                type="button"
                onClick={() => update({ q: '' })}
                aria-label="Limpar pesquisa"
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            value={district}
            onChange={e => update({ d: e.target.value })}
            aria-label="Distrito"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Todos os distritos e regiões</option>
            {districts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </Card>

      {isLoading && <LoadingBox />}
      {isError && <ErrorBox message={(error as Error).message} />}

      {data && (
        <>
          <p className="text-xs text-slate-500">
            {filtered.length} concelho{filtered.length === 1 ? '' : 's'}
          </p>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Nenhum concelho encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(m => (
                <Link
                  key={m.slug}
                  to={`/concelhos/${m.slug}`}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 hover:border-green-400 hover:shadow transition"
                >
                  <p className="font-semibold text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {municipalityDistrict(m)}
                    {formatAreaKm2(m.area_ha) ? ` · ${formatAreaKm2(m.area_ha)}` : ''}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
