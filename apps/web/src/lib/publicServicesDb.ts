// Camada de acesso ao `.sqlite` estático de Serviços Públicos (WEB-023).
//
// Mesmo padrão de metroPortoDb.ts/staticDb.ts: dados gerados em build/CI
// (scripts/build-public-services-db.mjs, a partir do OpenStreetMap Overpass API) e servidos
// como asset estático em `/data/public-services.sqlite`, consultado no browser via SQLite
// compilado para WebAssembly (sql.js), sem pedidos de rede repetidos.
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const DB_URL = `${import.meta.env.BASE_URL}data/public-services.sqlite`

let dbPromise: Promise<SqlJsDatabase> | null = null

async function loadDb(): Promise<SqlJsDatabase> {
  const [SQL, fileBuffer] = await Promise.all([
    initSqlJs({ locateFile: () => sqlWasmUrl }),
    fetch(DB_URL).then(res => {
      if (!res.ok) throw new Error(`Falha ao carregar ${DB_URL}: ${res.status}`)
      return res.arrayBuffer()
    }),
  ])
  return new SQL.Database(new Uint8Array(fileBuffer))
}

/** Devolve (e memoriza) a instância da BD SQLite de Serviços Públicos carregada em WASM. */
export function getPublicServicesDb(): Promise<SqlJsDatabase> {
  if (!dbPromise) dbPromise = loadDb()
  return dbPromise
}

/** Corre uma query SELECT e devolve as linhas como objetos tipados. */
export async function publicServicesQueryAll<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  const db = await getPublicServicesDb()
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    return rows
  } finally {
    stmt.free()
  }
}

export interface PublicServicesDbMeta {
  generated_at: string | null
  source: string | null
}

export async function getPublicServicesDbMeta(): Promise<PublicServicesDbMeta> {
  const rows = await publicServicesQueryAll<{ key: string; value: string }>('SELECT key, value FROM meta')
  const map = new Map(rows.map(r => [r.key, r.value]))
  return { generated_at: map.get('generated_at') ?? null, source: map.get('source') ?? null }
}
