---
maestru: "0.4"
type: work-spec
id: mob-002-spec
title: "Mobile: mover lógica partilhável do web para packages/core — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-002
owner: developer
created: 2026-10-08
---

# Mobile: mover lógica partilhável do web para packages/core — Implementation Plan

## Overview

A lógica de dados das secções que só existiam no web (Carris, Hospitais/SNS, Comboios CP, alertas TML, Metro do Porto, Serviços Públicos, Código Postal, ANPC) vivia em hooks de `apps/web/src/hooks`, presa a `import.meta.env`, proxies Vite/corsproxy e ao sql.js. Passa para `packages/core` como clientes agnósticos de plataforma com configuração injetável, para o mobile (MOB-003/MOB-005) os poder reutilizar sem duplicação. O web mantém o mesmo comportamento.

## Implementation

### Phase 1: Contrato SQLite agnóstico

#### Step 1.1: `QueryAll` + meta

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/sqlite.ts` | `SqlParam`, `QueryAll` (executor SELECT genérico), `StaticDbMeta` e `getStaticDbMeta(queryAll)` (tabela `meta` comum aos `.sqlite`) |

Web: sql.js (`apps/web/src/lib/*Db.ts`). Mobile: expo-sqlite (MOB-003) só tem de implementar `QueryAll`.

- [x] `getStaticDbMeta` deixa de estar triplicado nos três `lib/*Db.ts` do web

### Phase 2: Clientes no core

#### Step 2.1: Fábricas `create*Client(options)`

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/api/carris.ts` | Tipos `CM*`; `createCarrisClient({ queryAll, baseUrlV1?, baseUrlV2? })` (linhas, operadores, patterns, paragens via SQL; municípios, veículos, chegadas via API); `findNearbyStops` (usa `haversineDistance` de utils) |
| Create | `packages/core/src/api/sns.ts` | Tipos SNS; `createSnsClient({ baseUrl?, loadPostalCodeMap? })` com paginação; `groupValenciasByHospital` puro |
| Create | `packages/core/src/api/comboios.ts` | `createComboiosClient({ baseUrl? })`; omissão = `https://comboios.live` direto (nativo) |
| Create | `packages/core/src/api/tml.ts` | `createTmlClient` + instância `tmlClient` |
| Create | `packages/core/src/api/metroPorto.ts` | `createMetroPortoClient({ queryAll })` (calendário GTFS + exceções, próximas partidas), `secondsSinceMidnight`, `formatDepartureTime`, `toGtfsDate` |
| Create | `packages/core/src/api/publicServices.ts` | `createPublicServicesClient({ queryAll })`, `PUBLIC_SERVICE_CATEGORIES` |
| Create | `packages/core/src/api/codigoPostal.ts` | `createCodigoPostalClient`, `normalizePostalCode`, `isValidPostalCode` |
| Create | `packages/core/src/api/anpc.ts` | `createAnpcClient({ apiKey, baseUrl? })` |
| Modify | `packages/core/src/index.ts` | Exporta os novos módulos |

Regras: sem `import.meta`, `window` ou `document`; código compatível com `strict` (o typecheck do mobile valida o core).

- [x] `tsc --noEmit` no mobile (strict) passa com o core novo

### Phase 3: Web como consumidor fino

#### Step 3.1: Configuração web num único ponto

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/src/lib/clients.ts` | Instancia os clientes: sql.js como `QueryAll`, `cp-distrito.json` via `BASE_URL`, proxy comboios (`/api/comboios` em dev, corsproxy.io em prod), `VITE_APIABERTA_KEY` |
| Modify | `apps/web/src/lib/staticDb.ts`, `metroPortoDb.ts`, `publicServicesDb.ts` | Removido `get*DbMeta` (passa para o core); usam `SqlParam` |

#### Step 3.2: Hooks finos

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/hooks/use{Carris,Hospitais,Transportes,MetroPorto,PublicServices,CodigoPostal,ANPC}.ts` | Só `useQuery` (mesmas `queryKey`, `staleTime`, `refetchInterval`, `retry`) sobre os clientes; re-exportam tipos/constantes do core para não alterar imports das páginas |

- [x] `tsc -b`, `oxlint` e `vite build` do web passam
- [x] Páginas não alteradas (imports de tipos mantidos via re-export)

### Phase 4: Verificação em runtime

| Action | File | Details |
|--------|------|---------|
| Run | — | Smoke test Node (type stripping) dos clientes do core: SQL com better-sqlite3 em memória com o schema real dos `scripts/build-*-db.mjs`; APIs reais com `fetch` direto (Carris, comboios.live sem proxy, TML, SNS + `cp-distrito.json`, geoapi.pt, ANPC) |

- [x] Todos os checks OK (incl. exceções do calendário GTFS do Metro e ordenações)

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/sqlite.ts` | Create | Contrato `QueryAll` + meta dos `.sqlite` |
| `packages/core/src/api/carris.ts` | Create | Cliente Carris Metropolitana |
| `packages/core/src/api/sns.ts` | Create | Cliente SNS (hospitais/urgências) |
| `packages/core/src/api/comboios.ts` | Create | Cliente comboios.live |
| `packages/core/src/api/tml.ts` | Create | Cliente alertas TML |
| `packages/core/src/api/metroPorto.ts` | Create | Cliente Metro do Porto (GTFS SQLite) |
| `packages/core/src/api/publicServices.ts` | Create | Cliente Serviços Públicos (SQLite) |
| `packages/core/src/api/codigoPostal.ts` | Create | Cliente geoapi.pt |
| `packages/core/src/api/anpc.ts` | Create | Cliente ANPC (API Aberta) |
| `packages/core/src/index.ts` | Modify | Exports |
| `apps/web/src/lib/clients.ts` | Create | Configuração web dos clientes |
| `apps/web/src/lib/staticDb.ts` | Modify | Remove meta duplicada |
| `apps/web/src/lib/metroPortoDb.ts` | Modify | Remove meta duplicada |
| `apps/web/src/lib/publicServicesDb.ts` | Modify | Remove meta duplicada |
| `apps/web/src/hooks/useCarris.ts` | Modify | Hook fino |
| `apps/web/src/hooks/useHospitais.ts` | Modify | Hook fino |
| `apps/web/src/hooks/useTransportes.ts` | Modify | Hook fino |
| `apps/web/src/hooks/useMetroPorto.ts` | Modify | Hook fino |
| `apps/web/src/hooks/usePublicServices.ts` | Modify | Hook fino |
| `apps/web/src/hooks/useCodigoPostal.ts` | Modify | Hook fino |
| `apps/web/src/hooks/useANPC.ts` | Modify | Hook fino |
| `README.md` | Modify | Documenta a injeção de configuração no core |
