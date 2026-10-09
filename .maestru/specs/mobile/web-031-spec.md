---
maestru: "0.4"
type: work-spec
id: web-031-spec
title: "Contratos Públicos (BASE) — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-031
owner: developer
created: 2026-10-09
---

# Contratos Públicos (BASE) — Implementation Plan

## Overview

Nova secção "Contratos Públicos" (web e mobile) com os contratos do BASE.gov.pt da API Aberta: lista dos mais recentes, pesquisa por texto/entidade/NIF e ecrã de detalhe. O cliente e os tipos ficam no core; a entrada vai para a navegação do web, para o Início do web (cartão) e para a grelha de secções do mobile.

**Comportamento da API (testado em 2026-10-09)**
- `GET /base/contracts?page=&limit=` devolve `{ total, page, limit, pages, data }`, do contrato mais recente para o mais antigo (~2,18 M registos).
- `GET /base/contracts/search?q=&page=&limit=` devolve `{ query, total, page, limit, data }`, **sem `pages`**. Sem `q`, responde 400. Pesquisa na descrição, na entidade e no adjudicatário, incluindo o NIF (ex.: `500297177` → 3370 contratos).
- `GET /base/contracts/lookup/:id`: um id inexistente devolve **200** com `{ error: "Contract not found" }`.
- `limit` ≤ 100 (acima disso dá 400). As páginas profundas respondem em menos de 3 s.
- `contractingEntity`/`awarded` vêm no formato `NIF - Nome`. Sem NIF vem `- - Nome`, e a entidade pode vir vazia.
- O OpenAPI (`/docs/json`) não descreve estas rotas (só `/v1/base/{*}`).

**Decisões**
- **Core:** `searchBaseContracts()` calcula `pages` (`ceil(total/limit)`) e `getBaseContract()` converte `{ error }` num `ApiError(404, 'Contrato não encontrado')`. O `limit` fica limitado a 100.
- **Partes:** `parseBaseParty()` separa NIF e nome (aceita NIF estrangeiro com letras, `- - Nome` e campo vazio → `null`).
- **Pesquisa:** uma só caixa ("texto, entidade ou NIF"), porque a API não tem filtros por campo. São precisos pelo menos 3 caracteres (`normalizeBaseQuery`). No detalhe, "Ver contratos deste NIF" abre a pesquisa por esse NIF (ou pelo nome, se não houver NIF).
- **Datas:** `formatBaseDate()` converte `AAAA-MM-DD` → `DD/MM/AAAA` sem `Date`, para não mudar de dia com o fuso horário.
- **Web:** rotas `/contratos` (com `?q=&page=` no URL, para o Voltar regressar à mesma pesquisa/página) e `/contratos/:id`. Paginação com o `Pagination` existente e `keepPreviousData`. O detalhe usa o contrato da lista em cache como `placeholderData`. O cartão do Início usa a mesma query da 1.ª página.
- **Mobile:** `app/contratos/index.tsx` (lista com `useInfiniteQuery` e "Mostrar mais"; aceita `?q=`) e `app/contratos/[id].tsx` (detalhe e link para o portal BASE com `Linking`). Entrada em `lib/sections.ts` e `Stack.Screen` no `_layout.tsx`.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/api/base.ts` | `BaseContract`, `BaseContractsPage`, `BaseParty`, `BASE_CONTRACTS_MAX_LIMIT`, `parseBaseParty`, `formatContractValue`, `formatBaseDate`, `baseContractUrl`, `normalizeBaseQuery` |
| Modify | `packages/core/src/api/client.ts` | `getBaseContracts()`, `searchBaseContracts()`, `getBaseContract()` |
| Modify | `packages/core/src/index.ts` | Exportar `api/base` |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/src/hooks/useContratos.ts` | `useBaseContracts(query, page)`, `useBaseContract(id)` |
| Create | `apps/web/src/pages/Contratos.tsx` | Pesquisa, lista e paginação (estado no URL) |
| Create | `apps/web/src/pages/ContratoDetalhe.tsx` | Detalhe, partes com "Ver contratos deste NIF", link para o BASE |
| Modify | `apps/web/src/main.tsx` | Rotas `contratos` e `contratos/:id` |
| Modify | `apps/web/src/components/Layout.tsx` | Entrada "Contratos" na navegação |
| Modify | `apps/web/src/pages/Dashboard.tsx` | Cartão "Contratos Públicos · BASE" (total e contrato mais recente) |

### Phase 3: Mobile e documentação

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/hooks/useContratos.ts` | `useBaseContracts(query)` (infinita), `useBaseContract(id)` |
| Create | `apps/mobile/app/contratos/index.tsx` | Pesquisa, lista e "Mostrar mais" |
| Create | `apps/mobile/app/contratos/[id].tsx` | Detalhe |
| Modify | `apps/mobile/app/_layout.tsx` | `Stack.Screen` `contratos/index` e `contratos/[id]` |
| Modify | `apps/mobile/lib/sections.ts` | Secção "Contratos Públicos" |
| Modify | `README.md` | Fonte de dados, navegação no mobile e funcionalidade |

## Validação

- [x] Smoke test em Node contra a API real: lista (`pages`), pesquisa por NIF na página 2 (`pages` calculado), pesquisa sem resultados, `limit` 500 → 100, lookup e id inexistente (404), `parseBaseParty` e formatação
- [x] Web: `tsc -b`, `vite build` e `oxlint` (sem novos avisos)
- [x] Web: `vite preview` + Chrome headless (CDP), 17 verificações: cartão no Início, link na navegação, 25 recentes, aviso de < 3 caracteres, pesquisa por NIF, página 2, detalhe (NIF, link BASE), Voltar mantém `q` e `page`, "Ver contratos deste NIF", Limpar, id inexistente e pesquisa sem resultados; sem erros JS
- [x] Mobile: `tsc --noEmit` e `oxlint`

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/base.ts` | Create | Tipos e formatação BASE |
| `packages/core/src/api/client.ts` | Modify | Rotas `/base/contracts*` |
| `packages/core/src/index.ts` | Modify | Exportação |
| `apps/web/src/hooks/useContratos.ts` | Create | Hooks |
| `apps/web/src/pages/Contratos.tsx` | Create | Lista e pesquisa (web) |
| `apps/web/src/pages/ContratoDetalhe.tsx` | Create | Detalhe (web) |
| `apps/web/src/main.tsx` | Modify | Rotas |
| `apps/web/src/components/Layout.tsx` | Modify | Navegação |
| `apps/web/src/pages/Dashboard.tsx` | Modify | Cartão no Início |
| `apps/mobile/hooks/useContratos.ts` | Create | Hooks |
| `apps/mobile/app/contratos/index.tsx` | Create | Lista e pesquisa (mobile) |
| `apps/mobile/app/contratos/[id].tsx` | Create | Detalhe (mobile) |
| `apps/mobile/app/_layout.tsx` | Modify | Rotas da stack |
| `apps/mobile/lib/sections.ts` | Modify | Grelha do Início |
| `README.md` | Modify | Documentação |
