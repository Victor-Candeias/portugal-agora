---
maestru: "0.4"
type: work-spec
id: web-041-spec
title: "WEB-041 Spec — NIF de empresas via VIES"
template: implementation-plan-v1
work-item: mobile/WEB-041
owner: developer
created: 2026-10-11
---

# WEB-041 Spec — NIF de empresas via VIES

## Overview

O validador de NIF passa a mostrar o nome e a morada das empresas, a partir da API REST do VIES (Comissão Europeia, sem chave). A consulta só é feita depois de a validação local passar e quando o prefixo é de pessoa coletiva/entidade, para não enviar nem mostrar dados de particulares.

## Implementation

1. **Core (`packages/core/src/api/vies.ts`):**
   - `VIES_BASE_URL` = `https://ec.europa.eu/taxation_customs/vies/rest-api`.
   - `isCompanyNif(nif)`: prefixos 5, 6, 71, 72, 90, 91, 98 e 99. Ficam de fora as pessoas singulares (1–3, 45), as heranças (70, 74, 75), as atribuições oficiosas (77–79) e os ENI extintos (8).
   - `parseViesResponse(raw)`:
     - `VALID` → `{ status: 'registered', name, address: string[], checkedAt }`;
     - `INVALID` → `{ status: 'not-registered', checkedAt }`;
     - outros `userError` → `ViesError` com uma mensagem PT. O `---` passa a vazio e a morada é dividida por linhas.
   - `createViesClient({ baseUrl? })` com `lookup(nif)` → `GET {baseUrl}/ms/PT/vat/{nif}`.
2. **Web:**
   - Proxy `/api/vies` → `https://ec.europa.eu/taxation_customs/vies/rest-api` no `vite.config.ts`.
   - `viesClient` em `lib/clients.ts`: só em dev; `null` em produção, onde não há proxy.
   - Hook `useViesLookup`.
   - `Nif.tsx` mostra o cartão "Empresa (VIES)" com loading, registado, não registado e erro. Sem cliente, mostra um link para o VIES.
3. **Mobile:** `viesClient` (`fetch` direto) em `lib/clients.ts`, hook `hooks/useVies.ts` e o mesmo cartão em `app/nif.tsx`.
4. Cache de 24 h e uma nova tentativa (`retry: 1`).
5. README: fonte de dados e descrição do ecrã.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/vies.ts` | create | Cliente VIES, `isCompanyNif`, parsing e erros |
| `packages/core/src/index.ts` | modify | Exporta `vies` |
| `apps/web/vite.config.ts` | modify | Proxy `/api/vies` |
| `apps/web/src/lib/clients.ts` | modify | `viesClient` (dev) |
| `apps/web/src/hooks/useVies.ts` | create | `useViesLookup` |
| `apps/web/src/pages/Nif.tsx` | modify | Cartão "Empresa (VIES)" |
| `apps/mobile/lib/clients.ts` | modify | `viesClient` |
| `apps/mobile/hooks/useVies.ts` | create | `useViesLookup` |
| `apps/mobile/app/nif.tsx` | modify | Cartão "Empresa (VIES)" |
| `README.md` | modify | Fonte VIES e ecrã NIF |
