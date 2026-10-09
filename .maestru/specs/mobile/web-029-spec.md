---
maestru: "0.4"
type: work-spec
id: web-029-spec
title: "Web: página EV — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-029
owner: developer
created: 2026-10-09
---

# Web: página EV — Implementation Plan

## Overview

No web, a página EV era um `ComingSoon` com a fonte "MOBI.E", que não tem API aberta, e o Início tinha o cartão "Carregamento EV" em "Em breve". O mobile já mostra as tarifas CEME e o simulador desde o MOB-008. Este plano porta a tab EV do mobile para o web, usando o core: tarifas CEME (`/ev/tariffs`) e custo por carregamento (`/ev/tariffs/cheapest?kwh=`).

**Decisões**
- **Hooks:** `src/hooks/useEv.ts` com `useEvTariffs` e `useCheapestEvTariffs`, com os mesmos nomes, chaves e `staleTime` (15 min) do mobile, sobre o `apiClient` do WEB-028.
- **Filtro fixa/indexada:** feito no cliente (Todas / Fixas / Indexadas (OMIE)) sobre um único pedido a `/ev/tariffs`. Evita um pedido por filtro.
- **Simulador:** atalhos de 10/20/30/50 kWh, como no mobile, e um campo "Outro" (1–200 kWh) com debounce de 400 ms antes de pedir à API.
- **Tarifas indexadas:** a API devolve `period_type: null`. O web mostra o selo "Indexada" e o preço OMIE quando vier (`current_omie_eur_kwh` / `meta.current_omie_price_kwh`). O simulador não as inclui (nota da própria API).
- **Fonte:** passa de MOBI.E para ERSE/OMIE (tarifários dos CEME e preço OMIE, via API Aberta), com a nota de que não inclui OPC nem EGME.
- **Início (web):** o `ComingSoonCard` do EV dá lugar a um cartão "Carregamento EV · CEME mais barato" (preço/kWh e custo de 30 kWh). Como era o último cartão, saem a secção "Em breve" e o `ComingSoonCard`.
- **`/ev/spot`:** não é usado (404 no teste de 2026-10-09).

## Implementation

### Phase 1: Web

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/src/hooks/useEv.ts` | `useEvTariffs`, `useCheapestEvTariffs` |
| Modify | `apps/web/src/pages/EV.tsx` | Simulador (atalhos + campo kWh), lista ordenada por custo, filtro fixa/indexada, cartões das tarifas e botão Atualizar |
| Modify | `apps/web/src/pages/Dashboard.tsx` | Cartão "Carregamento EV" no lugar do `ComingSoonCard`; remove "Em breve" |

### Phase 2: Documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `README.md` | EV deixa de estar "por fazer" no web; filtro e resumo no Início |

## Validação

- [x] Smoke test em Node contra a API real: 8 tarifas (7 fixas + 1 indexada), 7 custos para 30 kWh, CORS com `Origin: http://localhost:5173`
- [x] Web: `tsc -b`, `vite build` e `oxlint`
- [x] `vite preview` + Chrome headless: `/#/ev` mostra o simulador e as tarifas; `/#/` mostra o cartão EV

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/hooks/useEv.ts` | Create | Hooks EV |
| `apps/web/src/pages/EV.tsx` | Modify | Página EV |
| `apps/web/src/pages/Dashboard.tsx` | Modify | Cartão EV no Início |
| `README.md` | Modify | Documentação |
