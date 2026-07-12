import { useState, useRef } from 'react'
import { MapPin, Search, X } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useCodigoPostal } from '@/hooks/useCodigoPostal'

function formatInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 7)
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return digits
}

export function CodigoPostal() {
  const [input, setInput]   = useState('')
  const [query, setQuery]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const valid = /^\d{4}-\d{3}$/.test(query)
  const { data, isLoading, isError, error } = useCodigoPostal(query)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(formatInput(e.target.value))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (/^\d{4}-\d{3}$/.test(input)) setQuery(input)
  }

  function handleClear() {
    setInput('')
    setQuery('')
    inputRef.current?.focus()
  }

  const lat = data?.centro?.[0]
  const lng = data?.centro?.[1]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">📮 Código Postal</h1>
        <p className="text-slate-500 text-sm mt-1">Pesquise informação por código postal · Fonte: geoapi.pt</p>
      </div>

      {/* Search form */}
      <Card>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              placeholder="xxxx-xxx"
              value={input}
              onChange={handleChange}
              maxLength={8}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
            />
            {input && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!/^\d{4}-\d{3}$/.test(input)}
            className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Search size={15} /> Pesquisar
          </button>
        </form>
      </Card>

      {/* Results */}
      {isLoading && <LoadingBox />}
      {isError && <ErrorBox message={(error as Error).message} />}

      {data && valid && (
        <div className="space-y-4">
          {/* Main info card */}
          <Card>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-3xl font-bold font-mono text-slate-900 tracking-wider">{data.CP}</p>
                <p className="text-lg font-semibold text-slate-700 mt-1">{data['Designação Postal']}</p>
              </div>
              {lat && lng && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium flex-shrink-0 border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-50 transition-colors"
                >
                  <MapPin size={14} /> Ver no mapa
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Distrito</p>
                <p className="text-sm font-semibold text-slate-800">{data.Distrito || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Concelho</p>
                <p className="text-sm font-semibold text-slate-800">{data.Concelho || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">Localidade</p>
                <p className="text-sm font-semibold text-slate-800">{data.Localidade || '—'}</p>
              </div>
            </div>
          </Card>

          {/* Streets */}
          {data.partes.length > 0 && (
            <Card>
              <CardTitle>Artérias ({data.partes.length})</CardTitle>
              <div className="divide-y divide-slate-100">
                {data.partes.map((p, i) => (
                  <div key={i} className="py-2.5">
                    <p className="text-sm font-medium text-slate-800">{p['Artéria']}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-slate-400">
                      {p.Troço   && <span>Troço: {p.Troço}</span>}
                      {p.Local   && <span>Local: {p.Local}</span>}
                      {p.Porta   && <span>Porta: {p.Porta}</span>}
                      {p.Cliente && <span>Cliente: {p.Cliente}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Placeholder when no search yet */}
      {!query && !isLoading && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-3">📮</p>
          <p className="text-sm">Insira um código postal no formato <span className="font-mono">xxxx-xxx</span></p>
        </div>
      )}
    </div>
  )
}
