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

## Pré-requisitos

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Chave da API Aberta — [registar em app.apiaberta.pt](https://app.apiaberta.pt)

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
npx expo start        # QR code para Expo Go
```

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
npx eas build         # EAS Build → App Store + Google Play
```
