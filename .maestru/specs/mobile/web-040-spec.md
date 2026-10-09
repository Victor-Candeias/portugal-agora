---
maestru: "0.4"
type: work-spec
id: web-040-spec
title: "EV: postos Open Charge Map — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-040
owner: developer
created: 2026-10-09
---

# EV: postos Open Charge Map — Implementation Plan

## Overview

A página EV passa a ter dois separadores: **Postos perto de mim** (novo, com Open Charge Map) e **Tarifas CEME** (o conteúdo do WEB-029, sem alterações). Os postos são pedidos em tempo real à API do Open Charge Map, com centro na localização do utilizador (ou em Lisboa, se não for concedida), raio de 5, 10, 25 ou 50 km e potência mínima opcional.

**Decisões**
- **Pedidos em tempo real, sem SQLite estático.** A API responde em menos de 1 s, tem CORS e aceita `distance` e `minpowerkw`. Um `.sqlite` gerado no deploy do Pages só ficava atualizado quando o deploy manual corresse, e o desenvolvimento é só local.
- **Chave:** é a mesma variável `OPEN_CHARGE_MAP_KEY` nas duas apps, e fica embutida no bundle, como a da API Aberta.
  - **Web:** `envPrefix: ['VITE_', 'OPEN_CHARGE_MAP_']` no `vite.config.ts` expõe `import.meta.env.OPEN_CHARGE_MAP_KEY`.
  - **Mobile:** o novo `app.config.js` põe a chave em `extra.openChargeMapKey`, que se lê com `expo-constants`. O Expo CLI e o script do `expo-constants` no Gradle (`@expo/env`.load) carregam o `.env`.
  - **CI:** o `deploy.yml` e o `android.yml` passam o secret `OPEN_CHARGE_MAP_KEY`.
- **Identificação:** no mobile vai o `User-Agent` (`PortugalHoje/1.0`). O browser não deixa definir este cabeçalho, e o Firefox exigiria preflight, por isso o web não o envia. Em ambas as apps vai `client=portugal-hoje` na query.
- **Parâmetros:** `countrycode=PT`, `verbose=false` (sem campos nulos) e `compact=false`. Assim chegam os nomes do operador, das tomadas e do estado sem descarregar o `referencedata`, que tem 488 KB.
- **Normalização (`EvCharger`):** o estado é `operational`/`partial`/`unavailable`/`planned`/`unknown`, e os removidos (200/210) são excluídos. As tomadas são agrupadas por tipo, potência e AC/DC, com rótulos curtos (Type 2, CCS2, CHAdeMO…), e há uma potência máxima por posto. O tipo de acesso e o custo ficam em português (o `UsageCost` é mostrado tal como vem). A distância vem de `AddressInfo.Distance`, e o `haversine` é o fallback.
- **Erros:** sem chave, o pedido falha antes de chegar à rede. Um 401/403 dá a mensagem "chave inválida". O `retry` não se repete com 401/403.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/api/openChargeMap.ts` | `createOpenChargeMapClient`, `getNearbyChargers`, `normalizeOcmPoi`, tipos `EvCharger`/`EvConnector`, opções de raio e potência |
| Modify | `packages/core/src/index.ts` | Exportar o módulo |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/vite.config.ts` | `envPrefix` com `OPEN_CHARGE_MAP_` |
| Modify | `apps/web/src/lib/clients.ts` | `openChargeMapClient` |
| Modify | `apps/web/src/hooks/useEv.ts` | `useEvChargers` |
| Create | `apps/web/src/components/EvChargers.tsx` | Localização, filtros, lista, mapa por posto e direções |
| Modify | `apps/web/src/pages/EV.tsx` | Separadores Postos/Tarifas |

### Phase 3: Mobile

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/app.config.js` | `extra.openChargeMapKey` a partir de `OPEN_CHARGE_MAP_KEY` |
| Modify | `apps/mobile/lib/clients.ts` | `openChargeMapClient` (com `User-Agent`) |
| Modify | `apps/mobile/hooks/useEv.ts` | `useEvChargers` |
| Create | `apps/mobile/components/EvChargers.tsx` | Localização, chips de raio e potência, lista, mapa de conjunto e por posto, direções |
| Modify | `apps/mobile/app/(tabs)/ev.tsx` | `SegmentedTabs` Postos/Tarifas |
| Modify | `apps/mobile/.env.example` | `OPEN_CHARGE_MAP_KEY` |

### Phase 4: CI e documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `.github/workflows/deploy.yml` | `OPEN_CHARGE_MAP_KEY` no build |
| Modify | `.github/workflows/android.yml` | `OPEN_CHARGE_MAP_KEY` no build |
| Modify | `.env.example` | `OPEN_CHARGE_MAP_KEY` |
| Modify | `README.md` | Fonte de dados, ecrã EV, chave |

## Validação

- [x] Smoke test em Node do cliente do core contra a API real (Lisboa 10 km: 100 postos; Porto ≥ 150 kW: 24; Ponta Delgada: 7; sem chave → 401 sem pedido; chave errada → 403 sem retry)
- [x] Web: `tsc -b`, `vite build` e `oxlint` (sem avisos novos; chave presente no bundle)
- [x] Mobile: `tsc --noEmit` e `oxlint`; `expo config` resolve `extra.openChargeMapKey` (36 caracteres)
- [x] APK de release assinado, com `openChargeMapKey` preenchida em `assets/app.config` (`Portugal-Hoje-1.0.0.apk`, `apksigner verify` OK com a `portugal-hoje-release.jks`; o build Gradle precisa do `cmake.dir` 3.31.6 no `android/local.properties` depois de um prebuild que limpe o `android/`)

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/openChargeMap.ts` | Create | Cliente e normalização do Open Charge Map |
| `packages/core/src/index.ts` | Modify | Export |
| `apps/web/vite.config.ts` | Modify | Expor `OPEN_CHARGE_MAP_KEY` |
| `apps/web/src/lib/clients.ts` | Modify | Cliente |
| `apps/web/src/hooks/useEv.ts` | Modify | Hook |
| `apps/web/src/components/EvChargers.tsx` | Create | UI dos postos |
| `apps/web/src/pages/EV.tsx` | Modify | Separadores |
| `apps/mobile/app.config.js` | Create | Chave em `extra` |
| `apps/mobile/lib/clients.ts` | Modify | Cliente |
| `apps/mobile/hooks/useEv.ts` | Modify | Hook |
| `apps/mobile/components/EvChargers.tsx` | Create | UI dos postos |
| `apps/mobile/app/(tabs)/ev.tsx` | Modify | Separadores |
| `apps/mobile/.env.example`, `.env.example` | Modify | Variável documentada |
| `.github/workflows/deploy.yml`, `.github/workflows/android.yml` | Modify | Secret no build |
| `README.md` | Modify | Documentação |
