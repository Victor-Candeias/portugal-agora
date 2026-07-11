import { useState, useMemo } from 'react'
import { MapPin, Phone, Mail, Activity, ChevronDown } from 'lucide-react'
import { Card, CardTitle } from '@/components/Card'
import { LoadingBox, ErrorBox } from '@/components/Feedback'
import { useHospitaisValencias } from '@/hooks/useHospitais'

const TIPO_COLOR: Record<string, string> = {
  'Serviço de Urgência Básica':                           'bg-blue-100 text-blue-800',
  'Serviço de Urgência Médico-cirúrgico':                 'bg-purple-100 text-purple-800',
  'Serviço de Urgência Polivalente':                      'bg-orange-100 text-orange-800',
  'Serviço de Urgência Polivalente com Centro de Trauma': 'bg-red-100 text-red-800',
}

function tipoLabel(tipo: string) {
  return tipo
    .replace('Serviço de Urgência ', '')
    .replace(' com Centro de Trauma', ' +Trauma')
}

export function Hospitais() {
  const { data: hospitals = [], isLoading, isError } = useHospitaisValencias()

  const [distrito, setDistrito] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [search, setSearch] = useState('')

  const distritos = useMemo(
    () => [...new Set(hospitals.map(h => h.distrito).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals],
  )

  const municipios = useMemo(
    () => [...new Set(
      hospitals
        .filter(h => !distrito || h.distrito === distrito)
        .map(h => h.municipio)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b, 'pt')),
    [hospitals, distrito],
  )

  const filtered = useMemo(() =>
    hospitals.filter(h =>
      (!distrito  || h.distrito  === distrito) &&
      (!municipio || h.municipio === municipio) &&
      (!search    || h.nome.toLowerCase().includes(search.toLowerCase()) ||
                     h.localidade.toLowerCase().includes(search.toLowerCase())),
    ), [hospitals, distrito, municipio, search])

  const hasFilter = !!(distrito || municipio || search)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🏥 Hospitais SNS</h1>
          <p className="text-slate-500 text-sm mt-1">Transparência SNS · Ministério da Saúde</p>
        </div>
        <a
          href="https://transparencia.sns.gov.pt"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Activity size={13} /> transparencia.sns.gov.pt
        </a>
      </div>

      <Card>
        <CardTitle>Filtros</CardTitle>

        <div className="space-y-3 mb-5">
          {/* Pesquisa */}
          <input
            type="text"
            placeholder="Pesquisar por nome ou localidade…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          />

          {/* Distrito */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Distrito</label>
            <div className="relative">
              <select
                value={distrito}
                onChange={e => { setDistrito(e.target.value); setMunicipio('') }}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white appearance-none pr-8"
              >
                <option value="">Selecione um distrito</option>
                {distritos.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Município — só aparece quando distrito selecionado */}
          {distrito && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Município</label>
              <div className="relative">
                <select
                  value={municipio}
                  onChange={e => setMunicipio(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white appearance-none pr-8"
                >
                  <option value="">Todos os municípios</option>
                  {municipios.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {hasFilter && (
            <button
              onClick={() => { setDistrito(''); setMunicipio(''); setSearch('') }}
              className="text-xs text-slate-400 hover:text-slate-700 underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {isLoading && <LoadingBox />}
        {isError   && <ErrorBox message="Erro ao carregar hospitais SNS." />}

        {!isLoading && !isError && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {filtered.length} serviço{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[640px] overflow-y-auto pr-1">
              {filtered.map(h => (
                <div key={h.nome} className="border border-slate-100 rounded-lg p-4 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-slate-900 text-sm leading-snug">{h.nome}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${TIPO_COLOR[h.tipo_de_urgencia] ?? 'bg-slate-100 text-slate-700'}`}>
                      {tipoLabel(h.tipo_de_urgencia)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 flex items-center gap-1 mb-1">
                    <MapPin size={11} />
                    {h.endereco}, {h.localidade} {h.codigo_postal}
                  </p>
                  {h.distrito && (
                    <p className="text-xs text-slate-400 mb-2 pl-4">
                      {h.municipio}{h.distrito ? ` · ${h.distrito}` : ''}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mb-2">
                    {h.valencias.map(v => (
                      <span key={v.nome} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {v.nome}
                      </span>
                    ))}
                    {h.saude24 && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Saúde 24
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    {h.telefone && (
                      <a href={`tel:${h.telefone}`} className="flex items-center gap-1 hover:text-blue-600">
                        <Phone size={11} /> {h.telefone}
                      </a>
                    )}
                    {h.email && (
                      <a href={`mailto:${h.email}`} className="flex items-center gap-1 hover:text-blue-600 max-w-[180px] truncate">
                        <Mail size={11} /> {h.email}
                      </a>
                    )}
                    {h.lat !== 0 && (
                      <a
                        href={`https://www.google.com/maps?q=${h.lat},${h.lng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
                      >
                        <MapPin size={11} /> Mapa
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="col-span-2 text-slate-400 text-sm text-center py-8">Nenhum resultado encontrado.</p>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
