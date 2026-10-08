const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

const packagesDir = path.resolve(__dirname, '../../packages') + path.sep

// packages/core usa imports ESM com extensão `.js` (ex.: './types/index.js') que apontam para
// ficheiros `.ts`. O Metro não faz esse mapeamento, por isso removemos a extensão e deixamos
// o Metro resolver com as `sourceExts` (.ts, .tsx, ...). Só se aplica a código em packages/.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath.startsWith(packagesDir) &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js')
  ) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform)
    } catch {
      // fallback para o ficheiro `.js` original
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
