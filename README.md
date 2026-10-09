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
# Web
cp .env.example apps/web/.env.local
# Editar apps/web/.env.local:
# VITE_APIABERTA_KEY=ak_...

# Mobile
cp apps/mobile/.env.example apps/mobile/.env.local
# Editar apps/mobile/.env.local:
# EXPO_PUBLIC_APIABERTA_KEY=ak_...
```

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
risco de incêndio da Proteção Civil exige `EXPO_PUBLIC_APIABERTA_KEY`; sem chave, o ecrã mostra-o como
indisponível e as ocorrências ANPC continuam a funcionar.

## Funcionalidades

Os ecrãs abaixo existem no web e no mobile.

| Ecrã | Dados |
|---|---|
| ⛽ Combustível | Preços DGEG — ordenados por custo, filtro por distrito/tipo |
| 🌤️ Tempo | Previsão 5 dias IPMA + observação em tempo real |
| ⚡ EV | Postos MOBI.E com estado livre/ocupado em tempo real |
| 🔥 Proteção Civil | Ocorrências ANPC + risco de incêndio por distrito |
| 📊 Economia | Indicadores INE + taxas BdP (Euribor, BCE) |
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
