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

## Funcionalidades

| Ecrã | Dados |
|---|---|
| ⛽ Combustível | Preços DGEG — ordenados por custo, filtro por distrito/tipo |
| 🌤️ Tempo | Previsão 5 dias IPMA + observação em tempo real |
| ⚡ EV | Postos MOBI.E com estado livre/ocupado em tempo real |
| 🔥 Proteção Civil | Alertas ANPC + mapa de risco de incêndio por distrito |
| 📊 Economia | Indicadores INE + taxas BdP (Euribor, BCE) |

## Build para produção

```bash
# Web
pnpm build:web        # dist/ pronto para deploy (Vercel, Netlify, ...)

# Mobile
cd apps/mobile
npx expo run:android --variant release  # build nativo local (requer JDK 17 + Android SDK)
```

### Mobile com EAS Build

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
