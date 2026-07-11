interface Props {
  feature: string
  source: string
  planned?: string
}

export function ComingSoon({ feature, source, planned }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="text-6xl mb-4">🚧</span>
      <h2 className="text-xl font-bold text-slate-700 mb-2">{feature}</h2>
      <p className="text-slate-500 text-sm max-w-sm">
        Esta secção irá integrar dados de <strong>{source}</strong>.
        O conector está em desenvolvimento e ficará disponível em breve.
      </p>
      {planned && (
        <span className="mt-4 text-xs bg-amber-100 text-amber-700 font-semibold px-3 py-1.5 rounded-full">
          Previsto: {planned}
        </span>
      )}
    </div>
  )
}
