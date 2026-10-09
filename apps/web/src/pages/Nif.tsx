import { useRef, useState } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { Card } from '@/components/Card'
import { validateNif } from '@portugal-hoje/core'

// Validação local (MOD 11), sem pedidos de rede (WEB-033).
export function Nif() {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const digits = input.replace(/\D/g, '')
  const result = digits.length === 9 ? validateNif(digits) : null

  function handleClear() {
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🪪 Validar NIF</h1>
        <p className="text-slate-500 text-sm mt-1">
          Verifica o formato, o prefixo e o dígito de controlo de um NIF português · Validação local, sem envio de dados
        </p>
      </div>

      <Card>
        <label htmlFor="nif" className="block text-xs font-medium text-slate-500 mb-1">NIF (9 dígitos)</label>
        <div className="relative max-w-xs">
          <input
            id="nif"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="123456789"
            value={input}
            onChange={e => setInput(e.target.value.replace(/\D/g, '').slice(0, 9))}
            maxLength={9}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 pr-8"
          />
          {input && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
              aria-label="Limpar"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {result?.valid === true && (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 p-3">
            <CheckCircle2 className="text-green-600 flex-shrink-0" size={22} />
            <div>
              <p className="font-semibold text-green-800">NIF válido</p>
              <p className="text-sm text-green-700">{result.type}</p>
            </div>
          </div>
        )}
        {result?.valid === false && (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
            <XCircle className="text-red-600 flex-shrink-0" size={22} />
            <div>
              <p className="font-semibold text-red-800">NIF inválido</p>
              <p className="text-sm text-red-700">{result.message}</p>
            </div>
          </div>
        )}
        {!result && (
          <p className="mt-3 text-xs text-slate-400">
            {digits.length === 0 ? 'Escreva os 9 dígitos do NIF.' : `Faltam ${9 - digits.length} dígito${9 - digits.length > 1 ? 's' : ''}.`}
          </p>
        )}
      </Card>

      <p className="text-xs text-slate-400">
        Um NIF válido significa só que o número está bem formado. Não confirma que está atribuído nem a quem.
      </p>
    </div>
  )
}
