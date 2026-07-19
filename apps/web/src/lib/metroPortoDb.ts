// Camada de acesso ao `.sqlite` estático do Metro do Porto (WEB-022).
//
// Mesmo padrão de `staticDb.ts` (Carris, WEB-010/011/016): dados praticamente estáticos
// (estações, linhas, viagens, horários, calendário) são gerados em build/CI
// (scripts/build-metro-porto-db.mjs, a partir do GTFS oficial publicado em
// opendata.porto.digital) e servidos como asset estático em `/data/metro-porto.sqlite`.
// Aqui carregamos esse ficheiro no browser via SQLite compilado para WebAssembly (sql.js)
// e consultamo-lo localmente, sem pedidos de rede repetidos.
//
// Base de dados separada da Carris (ficheiro `.sqlite` distinto) para não misturar os dois
// domínios de dados e para que cada um possa evoluir/atualizar-se independentemente.
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const DB_URL = `${import.meta.env.BASE_URL}data/metro-porto.sqlite`

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

/** Devolve (e memoriza) a instância da BD SQLite do Metro do Porto carregada em WASM. */
export function getMetroPortoDb(): Promise<SqlJsDatabase> {
  if (!dbPromise) dbPromise = loadDb()
  return dbPromise
}

/** Corre uma query SELECT e devolve as linhas como objetos tipados. */
export async function metroPortoQueryAll<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  const db = await getMetroPortoDb()
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

export interface MetroPortoDbMeta {
  generated_at: string | null
  source: string | null
}

export async function getMetroPortoDbMeta(): Promise<MetroPortoDbMeta> {
  const rows = await metroPortoQueryAll<{ key: string; value: string }>('SELECT key, value FROM meta')
  const map = new Map(rows.map(r => [r.key, r.value]))
  return { generated_at: map.get('generated_at') ?? null, source: map.get('source') ?? null }
}
