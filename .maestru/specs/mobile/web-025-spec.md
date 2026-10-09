---
maestru: "0.4"
type: work-spec
id: web-025-spec
title: "Avisos meteorológicos IPMA — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-025
owner: developer
created: 2026-10-09
---

# Avisos meteorológicos IPMA — Implementation Plan

## Overview

O web e o mobile mostram previsões, mas não os avisos meteorológicos do IPMA. Este plano acrescenta os avisos ativos (amarelo/laranja/vermelho) à página/tab Tempo, filtrados pela região selecionada, e um cartão resumo no Início das duas apps.

**Decisões**
- **Fonte: open-data do IPMA, não a API Aberta.** Testes de 2026-10-09:
  - `GET /v1/ipma/warnings` da API Aberta devolveu 152 entradas, mas só com 3 códigos de região (`BRG`, `MCS`, `AOR`), e `?region=LSB` devolveu 0. Também não traz o nível do aviso e tinha dados mais antigos do que o IPMA.
  - O ficheiro `https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json` tem as 25 áreas × 8 tipos, com `awarenessLevelID` (green/yellow/orange/red), não precisa de chave e responde com `Access-Control-Allow-Origin: *`. O core já usa este open-data para o risco de incêndio (RCM).
  - `getIpmaWarnings()` e os tipos ficam também no `ApiAbertaClient` (pedido no work-item), mas as apps ainda não os usam. Quando a rota tiver regiões e níveis corretos, basta trocar o `queryFn`.
- **Avisos ativos** = nível ≠ `green` e `endTime` ainda no futuro, o que inclui os que começam mais tarde. Ordenação: nível (vermelho → amarelo) e depois início.
- **Regiões:** os códigos de área (`LSB`, `PTO`, …) mapeiam para um nome e um distrito. As áreas da Madeira (`MCN`, `MCS`, `MRM`, `MPS`) e dos Açores (`AOC`, `ACE`, `AOR`) agrupam-se em "Madeira"/"Açores". A comparação com o distrito ignora acentos e maiúsculas.
- **Web (Tempo):** filtra pelo distrito escolhido. Com a localização ativa não há distrito, por isso mostra os avisos do país inteiro.
- **Mobile (Tempo):** filtra pelo distrito da cidade IPMA escolhida, derivado do `globalIdLocal` (1.º dígito: 1 continente, 2 Madeira, 3 Açores; dígitos 2–3: código do distrito, como no DICO). Assim Sagres → Faro, Sines → Setúbal e Penhas Douradas → Guarda.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/ipma.ts` | `IPMA_WARNING_AREAS`, `WARNING_LEVEL_LABELS`/`WARNING_LEVEL_COLORS`, `IpmaWarning`, `ipmaClient.getWarnings()`, `filterWarningsByDistrict()`, `districtFromIpmaCityId()` |
| Modify | `packages/core/src/api/client.ts` | `ApiAbertaIpmaWarning` + `getIpmaWarnings({ region? })` |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/hooks/useIPMA.ts` | `useIpmaWarnings()` |
| Create | `apps/web/src/components/IpmaWarnings.tsx` | Cartão com a lista de avisos (nível, tipo, área, período, texto) |
| Modify | `apps/web/src/pages/Tempo.tsx` | Avisos do distrito selecionado (ou do país, com localização) |
| Modify | `apps/web/src/pages/Dashboard.tsx` | Cartão resumo "Avisos IPMA" |

### Phase 3: Mobile

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/hooks/useTempo.ts` | `useIpmaWarnings()` |
| Modify | `apps/mobile/app/(tabs)/tempo.tsx` | Cartão de avisos do distrito da cidade escolhida |
| Modify | `apps/mobile/app/(tabs)/index.tsx` | Cartão resumo "Avisos IPMA" + estado dos dados |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/ipma.ts` | Modify | Cliente e mapeamentos dos avisos |
| `packages/core/src/api/client.ts` | Modify | Rota `/ipma/warnings` da API Aberta |
| `apps/web/src/hooks/useIPMA.ts` | Modify | Hook dos avisos |
| `apps/web/src/components/IpmaWarnings.tsx` | Create | Lista de avisos |
| `apps/web/src/pages/Tempo.tsx` | Modify | Avisos na página Tempo |
| `apps/web/src/pages/Dashboard.tsx` | Modify | Resumo no Início |
| `apps/mobile/hooks/useTempo.ts` | Modify | Hook dos avisos |
| `apps/mobile/app/(tabs)/tempo.tsx` | Modify | Avisos na tab Tempo |
| `apps/mobile/app/(tabs)/index.tsx` | Modify | Resumo no Início |
| `README.md` | Modify | Fonte dos avisos e tabela de funcionalidades |
