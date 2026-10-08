// Camada SQLite nativa para os `.sqlite` estáticos (Carris, Metro do Porto, Serviços Públicos) — MOB-003.
//
// Equivalente mobile de apps/web/src/lib/*Db.ts (sql.js): implementa o contrato `QueryAll` do
// `@portugal-hoje/core` com expo-sqlite. Os ficheiros são gerados no CI (`pnpm --filter web build:db`)
// e publicados no GitHub Pages; aqui são descarregados para o armazenamento da app e consultados
// localmente, funcionando offline depois do primeiro download.
//
// Atualização (sem bloquear consultas):
// 1. Ao abrir, se não houver ficheiro local, descarrega-o (bloqueante; sem rede → StaticDbUnavailableError).
// 2. Depois, em segundo plano e no máximo a cada UPDATE_CHECK_INTERVAL_MS, faz HEAD ao ficheiro
//    publicado; se o ETag mudou, descarrega para um ficheiro temporário, valida-o (abre e lê a
//    tabela `meta`) e só o guarda como pendente se `generated_at` for mais recente.
// 3. O pendente substitui o atual na próxima abertura (arranque da app) ou em `reload()`, nunca
//    com uma ligação aberta sobre o ficheiro.
import { Directory, File, Paths } from 'expo-file-system'
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'
import { getStaticDbMeta, type SqlParam, type StaticDbMeta } from '@portugal-hoje/core'

const DEFAULT_STATIC_DATA_URL = 'https://victor-candeias.github.io/portugal-agora/data/'

export const STATIC_DATA_BASE_URL = (process.env.EXPO_PUBLIC_STATIC_DATA_URL || DEFAULT_STATIC_DATA_URL).replace(
  /\/?$/,
  '/',
)

/** Intervalo mínimo entre verificações de atualização (o CI publica uma vez por dia). */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export type StaticDbName = 'carris' | 'metro-porto' | 'public-services'

/** Erro lançado quando o `.sqlite` ainda não foi descarregado e não há rede para o obter. */
export class StaticDbUnavailableError extends Error {
  readonly dbName: StaticDbName

  constructor(dbName: StaticDbName, label: string, cause?: unknown) {
    super(
      `Os dados de ${label} ainda não estão disponíveis neste dispositivo. ` +
        'Liga-te à internet para os descarregar — só é preciso uma vez, depois funcionam offline.',
      { cause },
    )
    this.name = 'StaticDbUnavailableError'
    this.dbName = dbName
  }
}

interface FileVersion {
  etag: string | null
  generatedAt: string | null
}

interface StaticDbState {
  current?: FileVersion
  pending?: FileVersion
  lastCheckedAt?: number
}

export interface StaticDbLocalInfo {
  /** Há um ficheiro local (ou pendente) utilizável offline. */
  downloaded: boolean
  /** `meta.generated_at` do ficheiro em uso. */
  generatedAt: string | null
  /** Há uma versão mais recente já descarregada, aplicada no próximo arranque ou em `reload()`. */
  updatePending: boolean
  lastCheckedAt: number | null
}

export interface StaticDb {
  readonly name: StaticDbName
  readonly url: string
  /** Implementa `QueryAll` do core: SELECT com parâmetros posicionais, linhas como objetos. */
  queryAll<T = Record<string, unknown>>(sql: string, params?: SqlParam[]): Promise<T[]>
  /** Tabela `meta` (`generated_at`, `source`) do ficheiro em uso. */
  getMeta(): Promise<StaticDbMeta>
  /** Estado local (sem rede nem abrir a BD). */
  getLocalInfo(): StaticDbLocalInfo
  /**
   * Procura uma versão mais recente e, se existir, deixa-a pendente. Devolve `true` se ficou uma
   * atualização pendente. `force` ignora o intervalo mínimo. Lança erro se a rede falhar.
   */
  checkForUpdate(options?: { force?: boolean }): Promise<boolean>
  /** Fecha a ligação (após as consultas em curso) e reabre, aplicando uma atualização pendente. */
  reload(): Promise<void>
}

function dataDirectory(): Directory {
  return new Directory(Paths.document, 'static-db')
}

function isNewer(candidate: string | null, reference: string | null | undefined): boolean {
  if (!candidate) return false
  if (!reference) return true
  // `generated_at` é sempre `Date.toISOString()` (scripts/build-*-db.mjs) → comparação lexical é cronológica.
  return candidate > reference
}

export function createStaticDb(name: StaticDbName, label: string): StaticDb {
  const fileName = `${name}.sqlite`
  const pendingName = `${name}.next.sqlite`
  const downloadName = `${name}.download.sqlite`
  const url = `${STATIC_DATA_BASE_URL}${fileName}`

  let dbPromise: Promise<SQLiteDatabase> | null = null
  let updatePromise: Promise<boolean> | null = null
  const inFlight = new Set<Promise<unknown>>()

  const dir = () => dataDirectory()
  const currentFile = () => new File(dir(), fileName)
  const pendingFile = () => new File(dir(), pendingName)
  const stateFile = () => new File(dir(), `${name}.state.json`)

  function readState(): StaticDbState {
    try {
      const file = stateFile()
      return file.exists ? (JSON.parse(file.textSync()) as StaticDbState) : {}
    } catch {
      return {}
    }
  }

  function writeState(state: StaticDbState): void {
    stateFile().write(JSON.stringify(state))
  }

  function deleteIfExists(file: File): void {
    if (file.exists) file.delete()
  }

  /** Abre um ficheiro só para validar que é SQLite e ler a `meta`. */
  async function readMetaFromFile(file: File): Promise<StaticDbMeta> {
    const db = await openDatabaseAsync(file.name, { useNewConnection: true }, dir().uri)
    try {
      return await getStaticDbMeta(sql => db.getAllAsync(sql))
    } finally {
      await db.closeAsync()
    }
  }

  async function fetchEtag(): Promise<string | null> {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) throw new Error(`Falha ao verificar ${url}: ${res.status}`)
    return res.headers.get('etag')
  }

  /**
   * Descarrega para um temporário e valida-o (é SQLite e tem `meta.generated_at`). Se `accept`
   * devolver `true`, move-o para `destination`; caso contrário descarta-o.
   */
  async function downloadValidated(
    etag: string | null,
    destination: File,
    accept: (version: FileVersion) => boolean = () => true,
  ): Promise<{ version: FileVersion; accepted: boolean }> {
    const tmp = new File(dir(), downloadName)
    deleteIfExists(tmp)
    try {
      await File.downloadFileAsync(url, tmp, { idempotent: true })
      const meta = await readMetaFromFile(tmp)
      if (!meta.generated_at) throw new Error(`${url} não tem meta.generated_at`)
      const version = { etag, generatedAt: meta.generated_at }
      const accepted = accept(version)
      if (accepted) tmp.moveSync(destination, { overwrite: true })
      return { version, accepted }
    } finally {
      deleteIfExists(new File(dir(), downloadName))
    }
  }

  /** Substitui o ficheiro atual pelo pendente. Só pode correr sem ligação aberta. */
  function promotePending(): void {
    const pending = pendingFile()
    if (!pending.exists) return
    for (const suffix of ['-wal', '-shm', '-journal']) deleteIfExists(new File(dir(), fileName + suffix))
    pending.moveSync(currentFile(), { overwrite: true })
    const state = readState()
    writeState({ ...state, current: state.pending ?? { etag: null, generatedAt: null }, pending: undefined })
  }

  async function open(): Promise<SQLiteDatabase> {
    dir().create({ intermediates: true, idempotent: true })
    promotePending()

    if (!currentFile().exists) {
      try {
        const etag = await fetchEtag().catch(() => null)
        const { version } = await downloadValidated(etag, currentFile())
        writeState({ current: version, lastCheckedAt: Date.now() })
      } catch (error) {
        throw new StaticDbUnavailableError(name, label, error)
      }
    }

    const db = await openDatabaseAsync(fileName, { useNewConnection: true }, dir().uri)
    checkForUpdate().catch(error => console.warn(`[staticDb:${name}] verificação de atualização falhou`, error))
    return db
  }

  function getDb(): Promise<SQLiteDatabase> {
    if (!dbPromise) {
      const promise: Promise<SQLiteDatabase> = open().catch(error => {
        if (dbPromise === promise) dbPromise = null
        throw error
      })
      dbPromise = promise
    }
    return dbPromise
  }

  async function queryAll<T = Record<string, unknown>>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    const db = await getDb()
    const query = db.getAllAsync<T>(sql, params)
    inFlight.add(query)
    try {
      return await query
    } finally {
      inFlight.delete(query)
    }
  }

  function checkForUpdate(options: { force?: boolean } = {}): Promise<boolean> {
    if (updatePromise) return updatePromise
    const promise = (async () => {
      const state = readState()
      if (!options.force && state.lastCheckedAt && Date.now() - state.lastCheckedAt < UPDATE_CHECK_INTERVAL_MS) {
        return !!state.pending
      }
      const latest = state.pending ?? state.current
      const etag = await fetchEtag()
      if (etag && latest?.etag === etag) {
        writeState({ ...state, lastCheckedAt: Date.now() })
        return !!state.pending
      }
      const { version, accepted } = await downloadValidated(etag, pendingFile(), v =>
        isNewer(v.generatedAt, latest?.generatedAt),
      )
      if (accepted) {
        writeState({ ...state, pending: version, lastCheckedAt: Date.now() })
        return true
      }
      // Mesmo conteúdo (ex.: novo deploy do Pages sem dados novos): memoriza o ETag para não repetir o download.
      const key = state.pending ? 'pending' : 'current'
      writeState({ ...state, [key]: { generatedAt: latest?.generatedAt ?? null, etag }, lastCheckedAt: Date.now() })
      return !!state.pending
    })().finally(() => {
      updatePromise = null
    })
    updatePromise = promise
    return promise
  }

  function reload(): Promise<void> {
    const previous = dbPromise
    const next: Promise<SQLiteDatabase> = (async () => {
      const db = await previous?.catch(() => null)
      if (db) {
        await Promise.allSettled([...inFlight])
        await db.closeAsync()
      }
      return open()
    })().catch(error => {
      if (dbPromise === next) dbPromise = null
      throw error
    })
    dbPromise = next
    return next.then(() => undefined)
  }

  function getLocalInfo(): StaticDbLocalInfo {
    const state = readState()
    const hasCurrent = currentFile().exists
    const hasPending = pendingFile().exists
    return {
      downloaded: hasCurrent || hasPending,
      generatedAt: (hasCurrent ? state.current?.generatedAt : state.pending?.generatedAt) ?? null,
      updatePending: hasCurrent && hasPending,
      lastCheckedAt: state.lastCheckedAt ?? null,
    }
  }

  return {
    name,
    url,
    queryAll,
    getMeta: () => getStaticDbMeta(queryAll),
    getLocalInfo,
    checkForUpdate,
    reload,
  }
}

export const carrisDb = createStaticDb('carris', 'Carris')
export const metroPortoDb = createStaticDb('metro-porto', 'Metro do Porto')
export const publicServicesDb = createStaticDb('public-services', 'Serviços Públicos')
