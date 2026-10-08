// Contrato agnóstico de plataforma para consultar os `.sqlite` estáticos (Carris, Metro do
// Porto, Serviços Públicos) gerados em build/CI. Cada app injeta a sua implementação:
// - web: sql.js (SQLite em WebAssembly), ver apps/web/src/lib/*Db.ts
// - mobile: expo-sqlite (MOB-003)
// O core só conhece as queries e o mapeamento de linhas, nunca o motor SQLite.
export type SqlParam = string | number | null

export type QueryAll = <T = Record<string, unknown>>(sql: string, params?: SqlParam[]) => Promise<T[]>

export interface StaticDbMeta {
  generated_at: string | null
  source: string | null
}

/** Lê a tabela `meta` (key/value) comum a todos os `.sqlite` estáticos. */
export async function getStaticDbMeta(queryAll: QueryAll): Promise<StaticDbMeta> {
  const rows = await queryAll<{ key: string; value: string }>('SELECT key, value FROM meta')
  const map = new Map(rows.map(r => [r.key, r.value]))
  return { generated_at: map.get('generated_at') ?? null, source: map.get('source') ?? null }
}
