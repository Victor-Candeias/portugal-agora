#!/usr/bin/env node
// Build local do APK de release (MOB-018): `pnpm build:apk` (em apps/mobile).
//  1. Incrementa a versão no app.json: patch do `version` (1.0.0 → 1.0.1) e `android.versionCode` (+1).
//     `--no-bump` reconstrói a versão atual. Se o build falhar, o app.json volta ao que era.
//  2. Assina com a keystore de release: usa as variáveis ANDROID_KEYSTORE_* do ambiente ou, se não
//     existirem, o ficheiro KEY=VALOR em ANDROID_KEYSTORE_PROPERTIES
//     (por omissão ~/.keystores/portugal-hoje-release.properties). Sem nenhum, assina com a debug keystore.
//  3. `expo prebuild` (passa a versão para o android/) + `gradlew assembleRelease`.
//     O APK sai com o nome da app e a versão (plugin withApkName) em android/app/build/outputs/apk/release/.
// Requer JDK 17 em JAVA_HOME.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const appJsonPath = join(root, 'app.json')
const isWindows = process.platform === 'win32'
const bump = !process.argv.includes('--no-bump')

const SIGNING_VARS = ['ANDROID_KEYSTORE_PATH', 'ANDROID_KEYSTORE_PASSWORD', 'ANDROID_KEY_ALIAS', 'ANDROID_KEY_PASSWORD']

// Igual ao plugins/withApkName.js.
const apkBaseName = appName => appName.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')

function bumpPatch(version) {
  const parts = version.split('.').map(Number)
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n) || n < 0)) {
    throw new Error(`Versão inválida no app.json: "${version}" (esperado X.Y.Z)`)
  }
  parts[2] += 1
  return parts.join('.')
}

function loadSigningEnv() {
  if (SIGNING_VARS.every(v => process.env[v])) return 'variáveis de ambiente'
  const file = process.env.ANDROID_KEYSTORE_PROPERTIES
    ?? join(homedir(), '.keystores', 'portugal-hoje-release.properties')
  if (!existsSync(file)) return null
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match && SIGNING_VARS.includes(match[1]) && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
  return SIGNING_VARS.every(v => process.env[v]) ? file : null
}

function run(command, args, cwd) {
  const line = [command, ...args].join(' ')
  console.log(`\n> ${line}`)
  const result = isWindows
    ? spawnSync(line, { cwd, stdio: 'inherit', shell: true })
    : spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`Falhou: ${line}`)
}

// O `expo prebuild` apaga o android/ (e o local.properties). Sem `cmake.dir` o Gradle usa o CMake 3.22 e o
// ninja dos módulos nativos fica em ciclo ("build.ninja still dirty"); usa-se o CMake mais recente do SDK.
function ensureLocalProperties() {
  const file = join(root, 'android', 'local.properties')
  if (existsSync(file)) return
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
    ?? (isWindows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(homedir(), 'Android', 'Sdk'))
  const cmakeRoot = join(sdk, 'cmake')
  const versionKey = v => v.split('.').map(n => n.padStart(6, '0')).join('.')
  const cmake = process.env.ANDROID_CMAKE_DIR
    ?? (existsSync(cmakeRoot)
      ? readdirSync(cmakeRoot).filter(v => /^\d+(\.\d+)*$/.test(v)).sort((a, b) => versionKey(a).localeCompare(versionKey(b))).map(v => join(cmakeRoot, v)).pop()
      : undefined)
  const escape = p => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:')
  const lines = [`sdk.dir=${escape(sdk)}`]
  if (cmake) lines.push(`cmake.dir=${escape(cmake)}`)
  writeFileSync(file, `${lines.join('\n')}\n`)
  console.log(`local.properties: sdk.dir=${sdk}${cmake ? `, cmake.dir=${cmake}` : ''}`)
}

const original = readFileSync(appJsonPath, 'utf8')
const appJson = JSON.parse(original)
const expo = appJson.expo
expo.android ??= {}

if (bump) {
  expo.version = bumpPatch(expo.version)
  expo.android.versionCode = (expo.android.versionCode ?? 1) + 1
  writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`)
}
console.log(`${expo.name} ${expo.version} (versionCode ${expo.android.versionCode})${bump ? ' — versão incrementada' : ''}`)

const signing = loadSigningEnv()
console.log(signing ? `Assinatura de release: ${signing}` : 'AVISO: sem keystore de release — o APK fica assinado com a debug keystore.')

try {
  // O daemon do Gradle de um build anterior bloqueia ficheiros em android/ e o prebuild falha (EBUSY).
  const gradlewPath = join(root, 'android', isWindows ? 'gradlew.bat' : 'gradlew')
  if (existsSync(gradlewPath)) run(isWindows ? `"${gradlewPath}"` : gradlewPath, ['--stop'], join(root, 'android'))
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], root)
  ensureLocalProperties()
  // Caminho absoluto: o cmd.exe pode não procurar executáveis na pasta atual (NoDefaultCurrentDirectoryInExePath).
  const gradlew = join(root, 'android', isWindows ? 'gradlew.bat' : 'gradlew')
  run(isWindows ? `"${gradlew}"` : gradlew, ['assembleRelease'], join(root, 'android'))
} catch (error) {
  if (bump) {
    writeFileSync(appJsonPath, original)
    console.error('\nBuild falhou: app.json reposto na versão anterior.')
  }
  console.error(error.message)
  process.exit(1)
}

const apkPath = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', `${apkBaseName(expo.name)}-${expo.version}.apk`)
console.log(existsSync(apkPath) ? `\nAPK: ${apkPath}` : `\nAVISO: não encontrei ${apkPath}`)
