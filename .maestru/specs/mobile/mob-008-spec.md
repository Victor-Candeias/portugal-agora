---
maestru: "0.4"
type: work-spec
id: mob-008-spec
title: "Mobile: rotas da API Aberta — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-008
owner: developer
created: 2026-10-09
---

# Mobile: rotas da API Aberta — Implementation Plan

## Overview

O `ApiAbertaClient` (`packages/core/src/api/client.ts`) chamava rotas que já não existem na API Aberta (404 com chave válida; sem chave, 401). As rotas atuais foram tiradas do código dos conectores (`github.com/apiaberta/connector-*`) e confirmadas contra a API real a 2026-10-09.

**Decisões**
- **Tempo:** previsão de 3 dias por capital de distrito via `/ipma/forecasts` (um só pedido para todas as cidades, com seletor no ecrã). A API Aberta não tem observações, por isso o cartão "Agora" usa o Open-Meteo (`current`), que o web já usa no Tempo e que não precisa de chave. A tabela WMO passa do web para o core, para haver uma só fonte.
- **EV:** o serviço `/ev` da API Aberta é de **tarifas de carregamento** (CEME), não de postos, e a MOBI.E não tem API aberta. A tab EV passa a mostrar as tarifas (`/ev/tariffs`) e um simulador do custo por kWh (`/ev/tariffs/cheapest`). O mapa de postos fica de fora.
- **Economia:** taxas BCE/€STR/TBA (`/bdp/rates`), taxas de crédito e depósitos (`/bdp/lending-rates`) e indicadores INE/Eurostat (`/ine/latest`, rótulos e formatação em PT no core). No Início, o cartão "Euribor 3M", que não existe na API, passa a ser "Taxa BCE" (facilidade de depósito).
- **Risco de incêndio:** a API Aberta não tem esta rota. Passa a usar o RCM do IPMA em open-data (`rcm-d0.json`, por concelho, sem chave), agregado por distrito com o nível máximo. Os focos NASA FIRMS ficam de fora, porque são deteções e não risco.
- **Alertas da Proteção Civil (`/civil-protection/alerts`):** já não eram usados depois do MOB-005 (o Início usa `/anpc/summary`). São removidos, sem substituto.
- **Chave em falta:** o cliente lança `ApiError(401)` com uma mensagem clara em vez de enviar `demo`. O `ErrorView` mostra-a.
- **Limpeza:** são removidos os métodos e tipos zod antigos do core, os hooks web não usados (`useAlerts`, `useEconomy`, `useEV`, `useWeather`) e `apps/web/src/lib/api.ts`. O `.env.example` da raiz deixa de ter a chave real.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/client.ts` | Remove weather/ev/civil-protection/statistics/finance; + `getIpmaForecasts`, `getIpmaForecast`, `getEvTariffs`, `getCheapestEvTariffs`, `getBdpRates`, `getBdpLendingRates`, `getIneLatest`; tipos das respostas; erro claro sem chave |
| Create | `packages/core/src/api/ipma.ts` | `ipmaClient.getFireRiskByDistrict(day)` (RCM open-data → por distrito), `RCM_LEVELS` |
| Create | `packages/core/src/api/openMeteo.ts` | `WMO_CODES`/`getWmoDescription`, `openMeteoClient.getCurrent(lat,lng)` |
| Modify | `packages/core/src/utils/index.ts` | `INE_INDICATORS` (rótulo PT + formatação) |
| Modify | `packages/core/src/types/index.ts` | Remove schemas Weather/EV/CivilProtection/Economy não usados |
| Modify | `packages/core/src/index.ts` | Exporta `ipma` e `openMeteo` |

### Phase 2: Mobile

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/lib/api.ts` | Sem `demo`: chave vazia → erro claro |
| Modify | `apps/mobile/hooks/useApi.ts` | Remove hooks das rotas antigas |
| Create | `apps/mobile/hooks/useTempo.ts` | `useIpmaForecasts`, `useCurrentWeather` |
| Create | `apps/mobile/hooks/useEv.ts` | `useEvTariffs`, `useCheapestEvTariffs` |
| Create | `apps/mobile/hooks/useEconomia.ts` | `useBdpRates`, `useBdpLendingRates`, `useIneLatest` |
| Modify | `apps/mobile/hooks/useAnpc.ts` | `useFireRisk` → IPMA RCM |
| Modify | `apps/mobile/app/(tabs)/tempo.tsx` | Seletor de cidade, "Agora" (Open-Meteo), previsão IPMA |
| Modify | `apps/mobile/app/(tabs)/ev.tsx` | Tarifas CEME + simulador de custo |
| Modify | `apps/mobile/app/(tabs)/economia.tsx` | BdP + INE |
| Modify | `apps/mobile/app/(tabs)/index.tsx` | Cartões Tempo (IPMA) e Taxa BCE |
| Modify | `apps/mobile/app/protecao-civil.tsx` | Cartão de risco de incêndio com RCM por distrito |
| Modify | `apps/mobile/lib/sections.ts` | Descrições EV/Economia |

### Phase 3: Web, configuração e documentação

| Action | File | Details |
|--------|------|---------|
| Delete | `apps/web/src/hooks/{useAlerts,useEconomy,useEV,useWeather}.ts`, `apps/web/src/lib/api.ts` | Sem uso |
| Modify | `apps/web/src/hooks/useOpenMeteo.ts` | WMO vem do core |
| Modify | `.env.example` | Chave de exemplo em vez da real |
| Modify | `README.md` | Rotas e fontes, variáveis `.env` por app, tabela de funcionalidades |

## Validação

- Smoke test em Node contra as APIs reais, com a chave de `apps/mobile/.env`, para todos os métodos novos.
- Mobile: `typecheck`, `lint` e `expo export -p android`.
- Web: `build` e `lint`.

- [x] Smoke test dos clientes contra as APIs reais
- [x] Mobile: typecheck, lint e export Android
- [x] Web: build e lint

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/client.ts` | Modify | Rotas atuais da API Aberta |
| `packages/core/src/api/ipma.ts` | Create | Risco de incêndio (RCM IPMA) |
| `packages/core/src/api/openMeteo.ts` | Create | Tempo atual + códigos WMO |
| `packages/core/src/utils/index.ts` | Modify | Indicadores INE |
| `packages/core/src/types/index.ts` | Modify | Remove tipos antigos |
| `packages/core/src/index.ts` | Modify | Exports |
| `apps/mobile/lib/api.ts` | Modify | Chave sem `demo` |
| `apps/mobile/hooks/useApi.ts` | Modify | Remove hooks antigos |
| `apps/mobile/hooks/useTempo.ts` | Create | Hooks Tempo |
| `apps/mobile/hooks/useEv.ts` | Create | Hooks EV |
| `apps/mobile/hooks/useEconomia.ts` | Create | Hooks Economia |
| `apps/mobile/hooks/useAnpc.ts` | Modify | Risco de incêndio IPMA |
| `apps/mobile/app/(tabs)/tempo.tsx` | Modify | Ecrã Tempo |
| `apps/mobile/app/(tabs)/ev.tsx` | Modify | Ecrã EV |
| `apps/mobile/app/(tabs)/economia.tsx` | Modify | Ecrã Economia |
| `apps/mobile/app/(tabs)/index.tsx` | Modify | Início |
| `apps/mobile/app/protecao-civil.tsx` | Modify | Risco de incêndio |
| `apps/mobile/lib/sections.ts` | Modify | Descrições |
| `apps/web/src/hooks/useAlerts.ts` | Delete | Sem uso |
| `apps/web/src/hooks/useEconomy.ts` | Delete | Sem uso |
| `apps/web/src/hooks/useEV.ts` | Delete | Sem uso |
| `apps/web/src/hooks/useWeather.ts` | Delete | Sem uso |
| `apps/web/src/lib/api.ts` | Delete | Sem uso |
| `apps/web/src/hooks/useOpenMeteo.ts` | Modify | WMO do core |
| `.env.example` | Modify | Remove chave real |
| `README.md` | Modify | Documentação |
