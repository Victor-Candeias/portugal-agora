// Config plugin (MOB-018): o Gradle gera o APK já com o nome da app e a versão,
// ex.: "Portugal-Hoje-1.0.1.apk" (release) ou "Portugal-Hoje-1.0.1-debug.apk".
// O nome vem de `expo.name` (app.json) e a versão do versionName do build.gradle.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// portugal-hoje: nome do APK (withApkName)'

function apkBaseName(appName) {
  return appName.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
}

function withApkName(config) {
  const baseName = apkBaseName(config.name ?? 'app')

  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withApkName: só suporta android/app/build.gradle em Groovy')
    }
    if (cfg.modResults.contents.includes(MARKER)) return cfg

    cfg.modResults.contents += `
${MARKER}
android {
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            def suffix = variant.buildType.name == 'release' ? '' : "-\${variant.buildType.name}"
            output.outputFileName = "${baseName}-\${variant.versionName}\${suffix}.apk"
        }
    }
}
`
    return cfg
  })
}

module.exports = withApkName
