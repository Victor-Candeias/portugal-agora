import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Search } from 'lucide-react'
import {
  baseContractUrl, formatBaseDate, formatContractValue, parseBaseParty, type BaseParty,
} from '@portugal-hoje/core'
import { Card, CardTitle } from '@/components/Card'
import { ErrorBox, LoadingBox } from '@/components/Feedback'
import { useBaseContract } from '@/hooks/useContratos'

// Detalhe de um contrato do BASE (WEB-031).
export function ContratoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: c, isLoading, isError, error } = useBaseContract(id)

  // Volta à lista anterior (com a pesquisa e a página) se a app já tiver histórico.
  function back() {
    if (location.key !== 'default') navigate(-1)
    else navigate('/contratos')
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={back}
        className="flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800"
      >
        <ArrowLeft size={16} /> Contratos Públicos
      </button>

      {isLoading && <LoadingBox />}
      {isError && <ErrorBox message={(error as Error).message} />}

      {c && (
        <>
          <Card>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contrato n.º {c.id}</p>
            <h1 className="text-xl font-bold text-slate-900 mt-1 whitespace-pre-line break-words">{c.description || 'Sem descrição'}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
              <Field label="Preço contratual">
                <span className="text-2xl font-bold text-green-700 tabular-nums">{formatContractValue(c.value)}</span>
              </Field>
              <Field label="Data de celebração">
                <span className="tabular-nums">{formatBaseDate(c.date)}</span>
              </Field>
              <Field label="Tipo de procedimento">{c.type || '—'}</Field>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PartyCard title="Entidade adjudicante" party={parseBaseParty(c.contractingEntity)} />
            <PartyCard title="Adjudicatário" party={parseBaseParty(c.awarded)} />
          </div>

          <a
            href={baseContractUrl(c.id)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
          >
            Ver no portal BASE <ExternalLink size={14} />
          </a>
          <p className="text-xs text-slate-400">Fonte: BASE.gov.pt (IMPIC), via API Aberta · sincronizado diariamente.</p>
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

function PartyCard({ title, party }: { title: string; party: BaseParty | null }) {
  return (
    <Card className="h-full">
      <CardTitle>{title}</CardTitle>
      {party ? (
        <>
          <p className="text-sm font-semibold text-slate-900 break-words">{party.name}</p>
          {party.nif && <p className="text-xs text-slate-500 mt-0.5 tabular-nums">NIF {party.nif}</p>}
          <Link
            to={`/contratos?q=${encodeURIComponent(party.nif ?? party.name)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline mt-3"
          >
            <Search size={12} /> Ver contratos {party.nif ? 'deste NIF' : 'com este nome'}
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-400">Não indicado</p>
      )}
    </Card>
  )
}
