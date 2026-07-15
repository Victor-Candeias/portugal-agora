// Camada de acesso ao `.sqlite` estático da Carris (WEB-010/011/016).
//
// Dados praticamente estáticos (linhas, paragens, patterns, operadores) são
// gerados em build/CI (scripts/build-carris-db.mjs) e servidos como asset
// estático em `/data/carris.sqlite`. Aqui carregamos esse ficheiro no browser
// via SQLite compilado para WebAssembly (sql.js) e consultamo-lo localmente —
// sem pedidos de rede repetidos, com suporte a offline após o primeiro load.
//
// Dados dinâmicos (chegadas, veículos, alertas) NÃO passam por aqui — continuam
// a ser pedidos em tempo real às APIs oficiais (ver useCarris.ts).
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const DB_URL = `${import.meta.env.BASE_URL}data/carris.sqlite`

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

/** Devolve (e memoriza) a instância da BD SQLite carregada em WASM. */
export function getStaticDb(): Promise<SqlJsDatabase> {
  if (!dbPromise) dbPromise = loadDb()
  return dbPromise
}

/** Corre uma query SELECT e devolve as linhas como objetos tipados. */
export async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | null)[] = [],
): Promise<T[]> {
  const db = await getStaticDb()
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

export interface DbMeta {
  generated_at: string | null
  source: string | null
}

export async function getStaticDbMeta(): Promise<DbMeta> {
  const rows = await queryAll<{ key: string; value: string }>('SELECT key, value FROM meta')
  const map = new Map(rows.map(r => [r.key, r.value]))
  return { generated_at: map.get('generated_at') ?? null, source: map.get('source') ?? null }
}
