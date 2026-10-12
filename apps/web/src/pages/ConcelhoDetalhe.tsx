import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { formatAreaKm2, formatPtPhone, municipalityDistrict } from '@portugal-hoje/core'
import { BoundaryMap } from '@/components/BoundaryMap'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox, Spinner } from '@/components/Feedback'
import { useMunicipalities, useMunicipality, useMunicipalityParishes } from '@/hooks/useConcelhos'

// Ficha do concelho (WEB-042): mostra logo os dados da lista em cache e junta a fronteira quando chega.
// As freguesias (WEB-049) vêm da geoapi.pt; a seleção é partilhada entre a lista e o mapa.
export function ConcelhoDetalhe() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const list = useMunicipalities()
  const detail = useMunicipality(slug)
  const m = detail.data ?? list.data?.find(x => x.slug === slug)
  const parishes = useMunicipalityParishes(m?.codigoine)
  const parishList = parishes.data?.parishes
  // A seleção fica associada ao concelho, para não passar para outro ao mudar de ficha.
  const [selection, setSelection] = useState<{ slug?: string; code: string } | null>(null)
  const selectedCode = selection && selection.slug === slug ? selection.code : null
  const selected = parishList?.find(p => p.code === selectedCode) ?? null
  const selectParish = (code: string | null) => setSelection(code ? { slug, code } : null)

  function back() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/concelhos')
  }

  const phone = formatPtPhone(m?.phone)
  const area = formatAreaKm2(m?.area_ha)

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={back}
        className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
      >
        <ArrowLeft size={16} /> Concelhos
      </button>

      {!m && (detail.isLoading || list.isLoading) && <LoadingBox />}
      {!m && detail.isError && <ErrorBox message={(detail.error as Error).message} />}

      {m && (
        <>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{m.name}</h1>
            <p className="text-slate-500 text-sm mt-1">{m.district ? 'Distrito' : 'Região'}: {municipalityDistrict(m) || '—'}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardTitle>Câmara Municipal</CardTitle>
              <div className="space-y-4">
                {phone && (
                  <Field label="Telefone">
                    <a href={`tel:${m.phone?.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline tabular-nums">
                      <Phone size={14} /> {phone}
                    </a>
                  </Field>
                )}
                {m.email && (
                  <Field label="Email">
                    <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline break-all">
                      <Mail size={14} /> {m.email}
                    </a>
                  </Field>
                )}
                {m.postal_code && <Field label="Código postal">{m.postal_code}</Field>}
                {m.website && (
                  <Field label="Site">
                    <a href={m.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{m.website}</a>
                  </Field>
                )}
                {!phone && !m.email && !m.postal_code && !m.website && (
                  <p className="text-sm text-slate-400">Sem contactos disponíveis.</p>
                )}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <Field label="Área">{area ?? '—'}</Field>
                  <Field label="Código INE"><span className="tabular-nums">{m.codigoine}</span></Field>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                  {parishList?.length ? 'Limites do concelho e das freguesias' : 'Limites do concelho'}
                </h2>
                {selected && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-orange-700">
                      {selected.name}
                      {formatAreaKm2(selected.area_ha) && (
                        <span className="font-normal text-slate-500"> · {formatAreaKm2(selected.area_ha)}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectParish(null)}
                      className="text-green-700 hover:text-green-800 font-medium"
                    >
                      Ver concelho
                    </button>
                  </div>
                )}
              </div>
              {detail.data?.geojson ? (
                <>
                  <BoundaryMap
                    boundary={detail.data.geojson}
                    parishes={parishList}
                    selectedParish={selectedCode}
                    onSelectParish={selectParish}
                  />
                  {!!parishList?.length && (
                    <p className="text-xs text-slate-400 mt-2">Clique numa freguesia para a destacar.</p>
                  )}
                </>
              ) : detail.isLoading ? (
                <div className="h-80 flex items-center justify-center"><Spinner /></div>
              ) : (
                <p className="text-sm text-slate-400">
                  {detail.isError ? `Não foi possível carregar o mapa: ${(detail.error as Error).message}` : 'Mapa não disponível.'}
                </p>
              )}
            </Card>
          </div>

          <Card>
            <CardTitle>Freguesias{parishList ? ` (${parishList.length})` : ''}</CardTitle>
            {parishList ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {parishList.map(p => {
                  const isSelected = p.code === selectedCode
                  return (
                    <li key={p.code}>
                      <button
                        type="button"
                        onClick={() => selectParish(isSelected ? null : p.code)}
                        aria-pressed={isSelected}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                          isSelected
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-slate-200 hover:border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <span className={`block text-sm font-medium ${isSelected ? 'text-orange-800' : 'text-slate-800'}`}>{p.name}</span>
                        <span className="block text-xs text-slate-500 tabular-nums">{formatAreaKm2(p.area_ha) ?? '—'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : parishes.isLoading ? (
              <div className="py-6 flex items-center justify-center"><Spinner /></div>
            ) : (
              <p className="text-sm text-slate-400">
                {parishes.isError
                  ? `Não foi possível carregar as freguesias: ${(parishes.error as Error).message}`
                  : 'Freguesias não disponíveis.'}
              </p>
            )}
          </Card>

          <p className="text-xs text-slate-400">
            Fonte: API Aberta (/geo/municipalities); freguesias: geoapi.pt (CAOP, DGT), limites simplificados.
          </p>
        </>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm font-semibold text-slate-800">{children}</div>
    </div>
  )
}
