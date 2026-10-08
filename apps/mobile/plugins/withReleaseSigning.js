// Config plugin (MOB-007): assinatura de release e versionCode a partir de variáveis de ambiente,
// para que o `android/` gerado por `expo prebuild` (não versionado) produza um AAB pronto para o
// Google Play. Mesmas variáveis do apps/android-auto (MOB-006). Sem ANDROID_KEYSTORE_PATH o release
// continua assinado com a debug keystore (builds locais).
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// portugal-hoje: release signing (withReleaseSigning)'

const RELEASE_SIGNING_CONFIG = `
        ${MARKER}
        release {
            if (System.getenv('ANDROID_KEYSTORE_PATH')) {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }`

function withReleaseSigning(config) {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE)
  if (Number.isInteger(versionCode) && versionCode > 0) {
    config.android = { ...config.android, versionCode }
  }

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: só suporta android/app/build.gradle em Groovy')
    }
    let gradle = cfg.modResults.contents
    if (gradle.includes(MARKER)) return cfg

    const signingConfigs = /signingConfigs\s*\{/
    const releaseSigning = /(release\s*\{[^}]*?)signingConfig\s+signingConfigs\.debug/
    if (!signingConfigs.test(gradle) || !releaseSigning.test(gradle)) {
      throw new Error('withReleaseSigning: estrutura inesperada em android/app/build.gradle')
    }

    gradle = gradle.replace(signingConfigs, (m) => `${m}${RELEASE_SIGNING_CONFIG}`)
    gradle = gradle.replace(
      releaseSigning,
      "$1signingConfig System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug",
    )
    cfg.modResults.contents = gradle
    return cfg
  })
}

module.exports = withReleaseSigning
