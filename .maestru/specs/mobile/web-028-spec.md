---
maestru: "0.4"
type: work-spec
id: web-028-spec
title: "Web: página Economia — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-028
owner: developer
created: 2026-10-09
---

# Web: página Economia — Implementation Plan

## Overview

No web, a página Economia era um `ComingSoon` e o Início tinha o cartão "Economia" em "Em breve". O mobile já mostra estes dados desde o MOB-008. Este plano porta a tab Economia do mobile para o web, usando o core: taxas BCE/€STR/TBA (`/bdp/rates`), taxas de crédito e depósitos (`/bdp/lending-rates`) e indicadores INE/Eurostat (`/ine/latest`).

**Decisões**
- **Cliente:** o web ainda não tinha uma instância do `ApiAbertaClient`. Passa a ter `apiClient` em `src/lib/clients.ts`, com `VITE_APIABERTA_KEY`. Sem chave, o cliente lança `ApiError(401)` com uma mensagem clara, como no mobile. A API responde com `Access-Control-Allow-Origin` (testado com `Origin: http://localhost:5173`), por isso não precisa de proxy.
- **Rótulos e formatação no core:** os rótulos curtos das taxas (`BDP_RATE_LABELS`), `formatRate` e `formatBdpPeriod` saem de `apps/mobile/app/(tabs)/economia.tsx` para `packages/core/src/utils`. O web e o mobile usam a mesma fonte. Os rótulos dos indicadores (`INE_INDICATORS`) já estavam no core.
- **Início (web):** o `ComingSoonCard` da Economia dá lugar a um cartão com a taxa BCE (facilidade de depósito), a data e a €STR, como o cartão "Taxa BCE" do mobile. "Em breve" fica só com o EV (WEB-029).
- **Hook antigo `useEconomy`:** já não existia (foi removido no MOB-008). Os hooks novos ficam em `src/hooks/useEconomia.ts`, com os mesmos nomes e `staleTime` do mobile.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/utils/index.ts` | `BDP_RATE_LABELS`, `formatRate`, `formatBdpPeriod` |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/lib/clients.ts` | `apiClient = new ApiAbertaClient({ apiKey: VITE_APIABERTA_KEY })` |
| Create | `apps/web/src/hooks/useEconomia.ts` | `useBdpRates`, `useBdpLendingRates`, `useIneLatest` |
| Modify | `apps/web/src/pages/Economia.tsx` | Grelha das taxas de referência, lista de crédito/depósitos, indicadores INE e botão Atualizar |
| Modify | `apps/web/src/pages/Dashboard.tsx` | Cartão "Economia · Taxa BCE" no lugar do `ComingSoonCard` |

### Phase 3: Mobile e documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/app/(tabs)/economia.tsx` | Usa os rótulos e formatadores do core (sem mudança visual) |
| Modify | `README.md` | Economia deixa de estar "por fazer" no web; resumo no Início |

## Validação

- [x] Smoke test em Node contra a API real: as 10 taxas e os 7 indicadores, com rótulo e formatação PT
- [x] Web: `tsc -b`, `vite build` e `oxlint`
- [x] Mobile: `tsc --noEmit` e `oxlint`

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/utils/index.ts` | Modify | Rótulos e formatação das taxas do BdP |
| `apps/web/src/lib/clients.ts` | Modify | Instância do `ApiAbertaClient` |
| `apps/web/src/hooks/useEconomia.ts` | Create | Hooks BdP/INE |
| `apps/web/src/pages/Economia.tsx` | Modify | Página Economia |
| `apps/web/src/pages/Dashboard.tsx` | Modify | Cartão Taxa BCE |
| `apps/mobile/app/(tabs)/economia.tsx` | Modify | Usa o core |
| `README.md` | Modify | Documentação |
