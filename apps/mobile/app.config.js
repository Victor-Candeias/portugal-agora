// Config dinâmica sobre o app.json: expõe a chave do Open Charge Map (WEB-040) em
// `extra.openChargeMapKey` (lida com expo-constants). O Expo carrega o apps/mobile/.env para
// process.env antes de avaliar este ficheiro, tanto no `expo start` como no build Gradle.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    openChargeMapKey: process.env.OPEN_CHARGE_MAP_KEY ?? '',
  },
})
