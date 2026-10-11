import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { formatAreaKm2, formatPtPhone, municipalityDistrict } from '@portugal-hoje/core'
import { BoundaryMap } from '@/components/BoundaryMap'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox, Spinner } from '@/components/Feedback'
import { useMunicipalities, useMunicipality } from '@/hooks/useConcelhos'

// Ficha do concelho (WEB-042): mostra logo os dados da lista em cache e junta a fronteira quando chega.
export function ConcelhoDetalhe() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const list = useMunicipalities()
  const detail = useMunicipality(slug)
  const m = detail.data ?? list.data?.find(x => x.slug === slug)

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
              <CardTitle>Limites do concelho</CardTitle>
              {detail.data?.geojson ? (
                <BoundaryMap boundary={detail.data.geojson} />
              ) : detail.isLoading ? (
                <div className="h-80 flex items-center justify-center"><Spinner /></div>
              ) : (
                <p className="text-sm text-slate-400">
                  {detail.isError ? `Não foi possível carregar o mapa: ${(detail.error as Error).message}` : 'Mapa não disponível.'}
                </p>
              )}
            </Card>
          </div>

          <p className="text-xs text-slate-400">Fonte: API Aberta (/geo/municipalities).</p>
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
