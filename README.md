# Portugal Hoje 🇵🇹

Aplicação web e mobile que agrega dados públicos portugueses via [API Aberta](https://api.apiaberta.pt).

## Estrutura

```
portugal-hoje/
├── apps/
│   ├── web/      # React + Vite + Tailwind (browser / PWA)
│   └── mobile/   # React Native + Expo (iOS / Android, inclui Android Auto em modules/car-app)
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
# OPEN_CHARGE_MAP_KEY=...   (postos de carregamento EV — chave em openchargemap.org/site/profile/applications)

# Mobile (Expo lê apps/mobile/.env ou apps/mobile/.env.local)
cp apps/mobile/.env.example apps/mobile/.env
# Editar apps/mobile/.env:
# EXPO_PUBLIC_APIABERTA_KEY=ak_...
# OPEN_CHARGE_MAP_KEY=...   (passa para a app via apps/mobile/app.config.js → extra.openChargeMapKey)
```

Sem chave, os pedidos à API Aberta falham logo com "Chave da API Aberta em falta" (não é enviado
nenhum valor `demo`). O mesmo para os postos de carregamento sem `OPEN_CHARGE_MAP_KEY`.

### Fontes de dados

| Dados | Fonte | Chave |
|---|---|---|
| Combustível, ANPC | API Aberta — `/fuel/*`, `/anpc/*` (os seletores de distrito/concelho usam a DGEG) | sim |
| Previsão do tempo (35 locais: capitais de distrito, outras cidades e ilhas; 5 dias) | IPMA open-data — `cities/daily/{globalIdLocal}.json` (um pedido por cidade) e `distrits-islands.json` (locais); a rota `/ipma/forecasts` da API Aberta só tem 3 dias | não |
| Tempo atual | Open-Meteo (`api.open-meteo.com`) | não |
| Risco de incêndio rural | IPMA open-data — RCM por concelho (`rcm-d0.json`), agregado por distrito | não |
| Avisos meteorológicos (amarelo/laranja/vermelho) | IPMA open-data — `warnings_www.json` (a rota `/ipma/warnings` da API Aberta não traz o nível nem todas as regiões) | não |
| Tarifas de carregamento EV (CEME) | API Aberta — `/ev/tariffs`, `/ev/tariffs/cheapest` | sim |
| Postos de carregamento EV perto de mim | Open Charge Map — `api.openchargemap.io/v3/poi` (raio 5–50 km, sem limite prático de postos, filtro de potência mínima; CC BY 4.0) + OpenStreetMap via Overpass (`overpass-api.de` e mirrors; ODbL), juntos sem repetidos pelo código Mobi.E ou pela distância (<25 m) | OCM sim (`OPEN_CHARGE_MAP_KEY`); Overpass não |
| Taxas BCE/€STR/TBA e crédito/depósitos | API Aberta — `/bdp/rates`, `/bdp/lending-rates` | sim |
| Indicadores de Portugal | API Aberta — `/ine/latest`, `/ine/indicators`, `/ine/stats` (Eurostat; sem `from` a série só começa em 2000) | sim |
| Focos de calor por satélite (VIIRS/MODIS, Portugal continental, até 7 dias) | API Aberta — `/nasafirms/hotspots` (NASA FIRMS) | sim |
| Contratos públicos (BASE.gov.pt, ~2,2 M contratos, sincronizados diariamente) | API Aberta — `/base/contracts`, `/base/contracts/search?q=` (`q` obrigatório; sem `pages` na resposta), `/base/contracts/lookup/:id` (id inexistente → 200 com `{ error }`); `limit` ≤ 100 | sim |
| Código postal (CP7 → distrito/concelho/localidade/artérias) | moradas.dev — `/cp/{cp7}` (o geoapi.pt sem chave só permite 5 pedidos/dia); coordenadas aproximadas via Open-Meteo geocoding | não |
| Nome e morada de empresas pelo NIF | VIES (Comissão Europeia) — `ec.europa.eu/taxation_customs/vies/rest-api/ms/PT/vat/{nif}`; só NIFs de empresas/entidades; sem CORS (mobile direto, web via proxy do Vite só em dev) | não |
| Concelhos (contactos da câmara, área, limites) | API Aberta — `/geo/municipalities?limit=400` (lista em cache persistente 30 dias: `localStorage` no web, `expo-sqlite/kv-store` no mobile) e `/geo/municipalities/{slug}` (fronteira GeoJSON). As ilhas vêm sem distrito: a região sai do código INE | sim |

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
Carris, TML), Metro do Porto, Serviços Públicos, Código Postal, Concelhos (`app/concelhos/index.tsx` e a ficha `app/concelhos/[slug].tsx`), Validar NIF (`app/nif.tsx`), Fundos PRR / PT2030 (`app/fundos.tsx`) e Contratos Públicos (`app/contratos/index.tsx`
e o detalhe `app/contratos/[id].tsx`) — são rotas da stack e abrem
a partir da grelha "Todas as secções" do Início (`apps/mobile/lib/sections.ts`), com botão Voltar. O
risco de incêndio da Proteção Civil vem do RCM do IPMA (open-data, sem chave).

Fora do Início, todos os headers têm à direita o botão "🏠 Início"
(`apps/mobile/components/HomeHeaderButton.tsx`). No web, o header (`apps/web/src/components/Layout.tsx`)
tem o mesmo botão e o logótipo também leva ao Início.

### Android Auto no mobile

A app mobile (`pt.portugalhoje.app`) também funciona no Android Auto (categoria POI). O Android Auto
não mostra UI React Native, só templates da Car App Library, por isso o ecrã do carro é nativo (Kotlin)
no módulo Expo local `apps/mobile/modules/car-app`, incluído por autolinking (sem editar o `android/`
gerado). O manifest do módulo declara o `CarAppService`, a meta-data `com.google.android.gms.car.application`
e a permissão `MAP_TEMPLATES`, que o Gradle funde no manifest da app.

- Secções: Proteção Civil, Combustível, Hospitais SNS, Tempo, Transportes CP, Carregamento EV, Turismo e
  Serviços Públicos; nos ecrãs com mapa, tocar num item abre o detalhe e **Navegar** entrega o destino
  ao Google Maps/Waze.
- Chave da API Aberta: a mesma `EXPO_PUBLIC_APIABERTA_KEY` do bundle (do ambiente ou de `apps/mobile/.env`),
  injetada em `BuildConfig.APIABERTA_KEY` do módulo.
- `HostValidator`: aceita qualquer host se a app for debuggable; em release só os hosts oficiais da Google.
- Testar (instalação local, sem Play Store): instalar o APK, abrir a app uma vez para dar a permissão de
  localização; no Android Auto ativar o modo programador (tocar 10× em **Versão**), **Fontes desconhecidas**
  e **Iniciar servidor da unidade principal**; no PC
  `adb forward tcp:5277 tcp:5277` e `%ANDROID_HOME%\extras\google\auto\desktop-head-unit.exe`.

## Funcionalidades

Os ecrãs abaixo existem no web e no mobile.

| Ecrã | Dados |
|---|---|
| ⛽ Combustível | Preços DGEG por distrito/município e tipo. Com localização: seletor Preço/Distância, raio de 10/25/50 km/Todos e distância a cada posto. Custo de atestar o depósito em cada posto e nos resumos (por omissão 50 L, editável de 1 a 200 L e guardado no dispositivo) |
| 🌤️ Tempo | Previsão IPMA a 5 dias por cidade + tempo atual (Open-Meteo) + avisos meteorológicos IPMA do distrito (resumo no Início) |
| ⚡ EV | Tab "Postos perto de mim": postos de carregamento (Open Charge Map + OpenStreetMap, sem repetidos) ordenados por distância, com raio, potência mínima, tomadas, estado, mapa e direções (fallback Lisboa sem localização). Em cada posto, "Custo e tempo" calcula o preço de carregar a bateria de X% a Y% por CEME e o tempo previsto em AC e em DC em separado (por tipo de tomada, ou com o máximo do carro se o posto não tiver esse tipo), limitado pela potência máxima AC/DC do carro, mostrando o cálculo de cada tempo e de cada custo (por omissão 60 kWh, 10% → 80%, 11 kW AC, 120 kW DC; editáveis e guardados no dispositivo). Tab "Tarifas CEME": tarifas dos CEME (filtro fixa/indexada OMIE) + simulador do custo por carregamento (resumo "CEME mais barato" no Início, no web) | tarifas dos CEME (filtro fixa/indexada OMIE) + simulador do custo por carregamento (resumo "CEME mais barato" no Início, no web) |
| 🔥 Proteção Civil | Ocorrências ANPC + comunicados ANPC (`/anpc/warnings`, mais recentes primeiro) + risco de incêndio por distrito (RCM IPMA) + mapa de focos de calor por satélite (NASA FIRMS, 1–7 dias) |
| 📊 Economia | Taxas BCE/€STR/TBA, crédito e depósitos (BdP) + indicadores INE/Eurostat, cada um com gráfico da série histórica e seletor de intervalo de anos (resumo "Taxa BCE" no Início) |
| 🏖️ Turismo | Pontos de interesse perto de ti |
| 🏥 Hospitais | Urgências SNS, ordenadas por distância |
| 🚆 Transportes | Comboios CP, Carris (veículos, linhas, paragens, alertas) e alertas TML |
| 🚇 Metro do Porto | Estações, linhas e próximas partidas |
| 🚓 Serviços Públicos | Esquadras e postos policiais (PSP, GNR, Polícia Municipal, Marítima) |
| 📮 Código Postal | Distrito/concelho/localidade, artérias (moradas.dev) e mapa aproximado da localidade (Open-Meteo geocoding) |
| 🏛️ Concelhos | Os 308 concelhos (API Aberta), com pesquisa e filtro por distrito/região. A ficha mostra os contactos da câmara (telefone, email, código postal), a área, o código INE e os limites do concelho no mapa |
| 🪪 Validar NIF | Validação local (`validateNif` no core): 9 dígitos, prefixo atribuído pela AT e dígito de controlo MOD 11, com o tipo de entidade. Para empresas e outras entidades, mostra o nome e a morada do VIES (no web, só em dev, por causa do proxy). Os NIFs de pessoas singulares não são enviados |
| 📑 Contratos Públicos | Contratos do BASE.gov.pt: mais recentes, pesquisa por texto/entidade/NIF e detalhe (preço, data, procedimento, entidade adjudicante e adjudicatário, link para o portal BASE) (resumo no Início, no web) |
| 🇪🇺 Fundos PRR / PT2030 | Resumo do PRR (período, 9 componentes, 61 investimentos), investimentos agrupados por componente com filtro e pesquisa sem acentos (no cliente), e resumo do PT2030 (período e orçamento). Fonte: transparencia.gov.pt via API Aberta |

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
cd apps/mobile
pnpm build:apk            # ou: node scripts/build-apk.mjs   (--no-bump para não mudar a versão)
# → android/app/build/outputs/apk/release/Portugal-Hoje-<versão>.apk
```

O `build:apk` (`apps/mobile/scripts/build-apk.mjs`, MOB-018):

- Incrementa a versão no `app.json` em cada build: patch do `version` (1.0.1 → 1.0.2) e `android.versionCode` +1. Assim o APK instala-se por cima do anterior, sem perder dados. Se o build falhar, o `app.json` é reposto. Fazer commit do `app.json` com a nova versão.
- Assina com a keystore de release. Usa as variáveis `ANDROID_KEYSTORE_PATH` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` ou, se não estiverem definidas, o ficheiro `KEY=VALOR` em `ANDROID_KEYSTORE_PROPERTIES` (por omissão `~/.keystores/portugal-hoje-release.properties`, fora do repositório). Sem nenhum, assina com a debug keystore e o APK não atualiza uma app instalada com a de release.
- Corre `expo prebuild`, que apaga e recria o `android/`, e volta a criar o `android/local.properties`. O `cmake.dir` aponta para o CMake mais recente do SDK; com o 3.22 o ninja falha com "build.ninja still dirty". Depois corre `gradlew assembleRelease`. O build completo demora ~20 min.
- O nome do APK (`<nome da app>-<versão>.apk`) vem do config plugin `plugins/withApkName.js`, por isso também se aplica a um `gradlew assembleRelease` manual.

Instalar no telemóvel ligado por USB: `adb install -r <apk>`.

### Mobile no CI (GitHub Actions) e Google Play

`.github/workflows/android.yml` (manual em *Actions → Android (mobile) → Run workflow*, ou ao fazer push de uma tag `mobile-v*`) faz `expo prebuild` + Gradle, sem conta Expo, e publica o AAB e o APK como artefactos. O `versionCode` é o número da execução (`ANDROID_VERSION_CODE`).

A assinatura de release vem do config plugin `apps/mobile/plugins/withReleaseSigning.js`, que lê as mesmas variáveis do `apps/android-auto` (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); sem elas o release usa a debug keystore.

Secrets do repositório:

| Secret | Uso |
|---|---|
| `APIABERTA_KEY` | `EXPO_PUBLIC_APIABERTA_KEY` embutida no bundle |
| `OPEN_CHARGE_MAP_KEY` | chave do Open Charge Map (postos EV), embutida no APK (`extra.openChargeMapKey`) e no bundle do Pages |
| `ANDROID_KEYSTORE_BASE64` | upload keystore em base64 (`base64 -w0 upload.jks`) |
| `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | credenciais da upload key |
| `PLAY_SERVICE_ACCOUNT_JSON` | service account com acesso à app na Play Console (só para publicar) |

Criar a upload key (uma vez, guardar fora do repositório):

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Para publicar, escolher a faixa (`internal`, `alpha`, `beta`) no *Run workflow*; enquanto a app nunca tiver sido revista pelo Google o estado tem de ser `draft`. O primeiro AAB tem de ser carregado manualmente na Play Console (a API não cria a app). Política de privacidade: https://victor-candeias.github.io/portugal-agora/privacidade.html (`apps/web/public/privacidade.html`).
