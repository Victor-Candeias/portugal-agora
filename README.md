# Portugal Hoje 🇵🇹

Aplicação web e mobile que agrega dados públicos portugueses via [API Aberta](https://api.apiaberta.pt).

## Estrutura

```
portugal-hoje/
├── apps/
│   ├── web/      # React + Vite + Tailwind (browser / PWA)
│   └── mobile/   # React Native + Expo (iOS / Android)
├── packages/
│   └── core/     # Lógica partilhada: API client, tipos, utils
└── pnpm-workspace.yaml
```

O `packages/core` é agnóstico de plataforma (sem `import.meta`, `window` ou `document`): cada
cliente recebe a configuração por injeção (`create*Client({ ... })` — API key, base URLs/proxy,
executor SQL `QueryAll` para os `.sqlite` estáticos). A app web configura-os em
`apps/web/src/lib/clients.ts` (sql.js/WASM, proxy CORS do comboios.live); os hooks React Query de
cada app são apenas camadas finas sobre esses clientes. No nativo usa-se `fetch` direto (sem proxy).

## Pré-requisitos

- Node.js 20+
- pnpm (`npm install -g pnpm`) — o monorepo usa **só** `pnpm-lock.yaml` (não usar `npm install` nas apps)
- Chave da API Aberta — [registar em app.apiaberta.pt](https://app.apiaberta.pt)
- Para builds Android (mobile e android-auto): **JDK 17** (`JAVA_HOME` a apontar para ele — o JDK 25
  faz falhar o lint do Android Gradle Plugin) e Android SDK (`ANDROID_HOME`) com API 36
- Mobile no Windows: **CMake 3.31.6** no Android SDK (`sdkmanager "cmake/3.31.6"`) e, em
  `apps/mobile/android/local.properties` (gerado, não versionado), `cmake.dir=<ANDROID_HOME>\\cmake\\3.31.6`.
  O CMake 3.22.1 por omissão falha nos módulos C++ (`ninja: manifest 'build.ninja' still dirty`)
  devido aos caminhos longos do pnpm.

## Instalação

```bash
git clone ...
cd portugal-hoje
pnpm install
```

## Configuração

```bash
# Web (Vite lê apps/web/.env ou apps/web/.env.local)
cp .env.example apps/web/.env.local
# Editar apps/web/.env.local:
# VITE_APIABERTA_KEY=ak_...

# Mobile (Expo lê apps/mobile/.env ou apps/mobile/.env.local)
cp apps/mobile/.env.example apps/mobile/.env
# Editar apps/mobile/.env:
# EXPO_PUBLIC_APIABERTA_KEY=ak_...
```

Sem chave, os pedidos à API Aberta falham logo com "Chave da API Aberta em falta" (não é enviado
nenhum valor `demo`).

### Fontes de dados

| Dados | Fonte | Chave |
|---|---|---|
| Combustível, distritos/concelhos, ANPC | API Aberta — `/fuel/*`, `/geo/*`, `/anpc/*` | sim |
| Previsão do tempo (capitais de distrito, ~3 dias) | API Aberta — `/ipma/forecasts` | sim |
| Tempo atual | Open-Meteo (`api.open-meteo.com`) | não |
| Risco de incêndio rural | IPMA open-data — RCM por concelho (`rcm-d0.json`), agregado por distrito | não |
| Avisos meteorológicos (amarelo/laranja/vermelho) | IPMA open-data — `warnings_www.json` (a rota `/ipma/warnings` da API Aberta não traz o nível nem todas as regiões) | não |
| Tarifas de carregamento EV (CEME) | API Aberta — `/ev/tariffs`, `/ev/tariffs/cheapest` | sim |
| Taxas BCE/€STR/TBA e crédito/depósitos | API Aberta — `/bdp/rates`, `/bdp/lending-rates` | sim |
| Indicadores de Portugal | API Aberta — `/ine/latest` (Eurostat) | sim |

A lista das rotas da API Aberta está na especificação OpenAPI em `https://api.apiaberta.pt/docs/json`.

## Desenvolvimento

```bash
# Web
pnpm dev:web          # http://localhost:5173

# Mobile
cd apps/mobile
pnpm android          # expo run:android — development build no emulador/dispositivo (expo-dev-client)
pnpm start            # Metro (para um development build já instalado)
pnpm typecheck        # tsc --noEmit
pnpm lint             # oxlint
```

O `apps/mobile/metro.config.js` faz o Metro resolver os imports `./x.js` do `packages/core` para os
ficheiros `.ts` correspondentes.

### Dados estáticos no mobile (`.sqlite`)

Os `.sqlite` da Carris, Metro do Porto e Serviços Públicos (gerados no CI e publicados no GitHub
Pages) são consultados no nativo com `expo-sqlite` — `apps/mobile/lib/staticDb.ts` implementa o
`QueryAll` do core e `apps/mobile/lib/clients.ts` instancia os clientes. Na primeira utilização cada
ficheiro é descarregado para `Paths.document/static-db/` (é preciso rede uma vez; sem rede a consulta
falha com `StaticDbUnavailableError`, com mensagem para o utilizador) e depois funciona offline. Em
segundo plano, no máximo a cada 6 h, verifica o ETag do ficheiro publicado; uma versão com
`meta.generated_at` mais recente fica pendente e é aplicada no próximo arranque (ou em `reload()`).
A origem pode ser alterada com `EXPO_PUBLIC_STATIC_DATA_URL` (por omissão
`https://victor-candeias.github.io/portugal-agora/data/`).

### Mapas no mobile

`apps/mobile/components/PointsMap.tsx` (`PointsMap` para uma lista de pontos, `SinglePointMap` para um
só) usa o MapLibre (`@maplibre/maplibre-react-native`) com os mosaicos do OpenStreetMap — os mesmos do
Leaflet no web — pelo que **não é precisa chave Google Maps** nem conta Google Cloud. Tocar num
marcador mostra o nome e "🧭 Direções", que abre o Google Maps nativo (ou o browser) com o URL
universal de direções (`apps/mobile/lib/maps.ts`). Como é um módulo nativo, depois de o instalar é
preciso refazer o development build (`pnpm android`).

### Navegação no mobile

A raiz (`apps/mobile/app/_layout.tsx`) é um `Stack`. As tabs (Início, Combustível, Tempo, EV, Economia,
Turismo) ficam no grupo `app/(tabs)/`. Os restantes ecrãs — Proteção Civil, Hospitais, Transportes (CP,
Carris, TML), Metro do Porto, Serviços Públicos e Código Postal — são rotas da stack (`app/*.tsx`) e abrem
a partir da grelha "Todas as secções" do Início (`apps/mobile/lib/sections.ts`), com botão Voltar. O
risco de incêndio da Proteção Civil vem do RCM do IPMA (open-data, sem chave).

## Funcionalidades

Os ecrãs abaixo existem no web e no mobile, exceto EV e Economia, que no web ainda estão por fazer.

| Ecrã | Dados |
|---|---|
| ⛽ Combustível | Preços DGEG — ordenados por custo, filtro por distrito/tipo |
| 🌤️ Tempo | Previsão IPMA por capital de distrito + tempo atual (Open-Meteo) + avisos meteorológicos IPMA do distrito (resumo no Início) |
| ⚡ EV | Tarifas de carregamento dos CEME + simulador do custo por carregamento |
| 🔥 Proteção Civil | Ocorrências ANPC + risco de incêndio por distrito (RCM IPMA) |
| 📊 Economia | Taxas BCE/€STR/TBA, crédito e depósitos (BdP) + indicadores INE/Eurostat |
| 🏖️ Turismo | Pontos de interesse perto de ti |
| 🏥 Hospitais | Urgências SNS, ordenadas por distância |
| 🚆 Transportes | Comboios CP, Carris (veículos, linhas, paragens, alertas) e alertas TML |
| 🚇 Metro do Porto | Estações, linhas e próximas partidas |
| 🚓 Serviços Públicos | Esquadras e postos policiais (PSP, GNR, Polícia Municipal, Marítima) |
| 📮 Código Postal | Distrito/concelho/localidade, artérias e mapa (geoapi.pt) |

## Build para produção

```bash
# Web
pnpm build:web        # dist/ pronto para deploy (Vercel, Netlify, ...)

# Mobile
cd apps/mobile
npx expo run:android --variant release  # build nativo local (requer JDK 17 + Android SDK)
```

### Mobile com EAS Build (opcional)

Perfis em `apps/mobile/eas.json`:

| Perfil | Saída | Uso |
|---|---|---|
| `development` | APK com `expo-dev-client` (distribuição interna) | desenvolvimento com Metro |
| `preview` | APK (distribuição interna) | testar em dispositivos |
| `production` | AAB, `versionCode` incrementado remotamente | Google Play |

Primeira vez (requer conta Expo):

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli init       # cria o projeto EAS e grava extra.eas.projectId no app.json
```

Builds:

```bash
npx eas-cli build -p android --profile development
npx eas-cli build -p android --profile preview
npx eas-cli build -p android --profile production
```

### APK de release local (Windows)

Ícone, ícone adaptativo e splash vêm de `apps/mobile/assets/Portugal_Agora.png` (`icon.png`,
`android-icon-foreground.png` com a imagem a 68% para caber nas máscaras do Android, `splash-icon.png`
com o plugin `expo-splash-screen`). O fundo é `#01163a`.

```powershell
$env:JAVA_HOME = "<JDK 17>"
# ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD definidos
cd apps/mobile
npx expo prebuild --platform android --no-install   # recriar android/local.properties (cmake.dir) se for apagado
cd android; .\gradlew.bat assembleRelease
# app/build/outputs/apk/release/app-release.apk → copiado para "<nome da app>-<versão>.apk" na mesma pasta
```

### Mobile no CI (GitHub Actions) e Google Play

`.github/workflows/android.yml` (manual em *Actions → Android (mobile) → Run workflow*, ou ao fazer push de uma tag `mobile-v*`) faz `expo prebuild` + Gradle, sem conta Expo, e publica o AAB e o APK como artefactos. O `versionCode` é o número da execução (`ANDROID_VERSION_CODE`).

A assinatura de release vem do config plugin `apps/mobile/plugins/withReleaseSigning.js`, que lê as mesmas variáveis do `apps/android-auto` (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); sem elas o release usa a debug keystore.

Secrets do repositório:

| Secret | Uso |
|---|---|
| `APIABERTA_KEY` | `EXPO_PUBLIC_APIABERTA_KEY` embutida no bundle |
| `ANDROID_KEYSTORE_BASE64` | upload keystore em base64 (`base64 -w0 upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | credenciais da upload key |
| `PLAY_SERVICE_ACCOUNT_JSON` | service account com acesso à app na Play Console (só para publicar) |

Criar a upload key (uma vez, guardar fora do repositório):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Para publicar, escolher a faixa (`internal`, `alpha`, `beta`) no *Run workflow*; enquanto a app nunca tiver sido revista pelo Google o estado tem de ser `draft`. O primeiro AAB tem de ser carregado manualmente na Play Console (a API não cria a app). Política de privacidade: https://victor-candeias.github.io/portugal-agora/privacidade.html (`apps/web/public/privacidade.html`).
