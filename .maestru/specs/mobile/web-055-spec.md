---
maestru: "0.4"
type: work-spec
id: web-055-spec
title: "WEB-055 Spec — Cliente de dados de energia no core + cache"
template: implementation-plan-v1
work-item: mobile/WEB-055
owner: developer
created: 2026-10-19
---

# WEB-055 Spec — Cliente de dados de energia no core + cache

## Overview

As apps (web e mobile) leem os JSON publicados pelo pipeline do WEB-053 através de um cliente partilhado no core. Esse cliente valida o contrato com zod, tem erros tipados e usa uma cache persistente que permite mostrar o último dataset sem rede. O ecrã do WEB-056 usa só os hooks `useEnergy` e `useEnergyLatest`.

**Decisão: só JSON, sem `energy.sqlite`.** As apps não reutilizam o `staticDb`. O `daily.json` (cerca de 15 KB) já tem tudo o que a UI precisa: o último dia, os 30 dias e o total ponderado.

## Implementation

### Phase 1: Core

#### Step 1.1: `api/energy.ts`

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/api/energy.ts` | Schemas zod do contrato (`energyDailySchema`, `energyLatestSchema`), `EnergyDataError` (com `kind` `network`/`http`/`invalid` e `status`), `shouldRetryEnergy`, `createEnergyClient({ baseUrl, fetch })` e cache `loadEnergyCached`/`loadEnergyDailyCached`/`loadEnergyLatestCached` |
| Modify | `packages/core/src/index.ts` | `export * from './api/energy.js'` |

- **`createEnergyClient`:**
  - `baseUrl` é a pasta `data/` publicada.
  - Os pedidos levam `cache: 'no-cache'`, que revalida o ETag do Pages.
  - Erros: 404 dá a mensagem «ainda não publicados»; JSON inválido ou fora do contrato dá `invalid`, que não é repetido.
- **`getEnergyTimeseries(range)`:** sai do `daily.json`. `24h` é o último dia (no MVP só há resolução diária); `7d` e `30d` são os últimos 7 e 30 dias. Quando houver intradiário (WEB-057), passa a ler um ficheiro próprio.
- **Cache:** recebe um `KeyValueStorage` injetado, com a chave `energy:v1:<daily|latest>`.
  - Cache com menos de 30 min (`ENERGY_CACHE_FRESH_MS`): não faz pedido.
  - Cache expirada: pede à rede. Se a rede falhar, devolve a cache com `offline: true` e o erro.
  - Sem cache e sem rede: o erro propaga-se.
  - A cache também é validada com zod; uma cache corrompida é ignorada.
  - O resultado é `{ data, savedAt, offline, error }`. A antiguidade dos dados mostra-se com `energyFreshness(data.latest.intervalEndUtc)` e `savedAt`.

### Phase 2: Apps

#### Step 2.1: Clientes e hooks

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/lib/clients.ts` | `energyClient` com `baseUrl` igual a `${import.meta.env.BASE_URL}data/` |
| Create | `apps/web/src/hooks/useEnergy.ts` | `useEnergy` (daily) e `useEnergyLatest`, com cache em `localStorage` (null se indisponível), `staleTime` 30 min e `retry: shouldRetryEnergy` |
| Modify | `apps/mobile/lib/clients.ts` | `energyClient` com `STATIC_DATA_BASE_URL` (Pages, ou `EXPO_PUBLIC_STATIC_DATA_URL`) |
| Create | `apps/mobile/hooks/useEnergy.ts` | Os mesmos hooks, com `expo-sqlite/kv-store` (API confirmada na documentação do Expo v57) |

- [x] `tsc -b` no web e `tsc --noEmit` no mobile sem erros.
- [x] oxlint sem avisos.
- [x] Smoke test fora do repo, com os JSON reais gerados no WEB-053 e fetch simulado:
  - URL e `no-cache` corretos; 30 dias; `latest` igual ao último dia; séries de 7d e 24h.
  - Erros `network`, `http` 404 e `invalid` (HTML e contrato errado), e a política de retry.
  - Cache: fresca não faz pedido; expirada e offline devolve a cópia com `offline`; expirada e online atualiza; corrompida é ignorada; funciona sem storage.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/energy.ts` | Create | Cliente, validação, erros e cache |
| `packages/core/src/index.ts` | Modify | Exportar o cliente |
| `apps/web/src/lib/clients.ts` | Modify | Instância web |
| `apps/web/src/hooks/useEnergy.ts` | Create | Hooks web |
| `apps/mobile/lib/clients.ts` | Modify | Instância mobile |
| `apps/mobile/hooks/useEnergy.ts` | Create | Hooks mobile |
