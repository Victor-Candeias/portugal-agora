---
maestru: "0.4"
type: work-spec
id: web-038-spec
title: "Código Postal: moradas.dev — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-038
owner: developer
created: 2026-10-09
---

# Código Postal: moradas.dev — Implementation Plan

## Overview

A pesquisa de códigos postais devolvia HTTP 429: sem chave, o geoapi.pt só permite 5 pedidos por dia por IP. A fonte passa a ser a moradas.dev (`GET /cp/{cp7}`), que é gratuita, não pede chave e tem CORS `*`. A resposta é convertida para o tipo `CpInfo` que já existia, por isso as páginas quase não mudam.

**Decisões** (testes de 2026-10-09)
- **Mapeamento:** `cp7`/`cp4`/`cp3` → `CP`/`CP4`/`CP3`; `distrito`/`concelho`/`localidade` → `Distrito`/`Concelho`/`Localidade`; `Designação Postal` e `municipio` usam a localidade e o concelho. `arterias[]` (`street`/`troco`/`porta`/`cliente`) → `partes[]` (`Artéria`/`Troço`/`Porta`/`Cliente`), com `null` → `''`. `Local` passa a opcional, porque não existe na moradas.dev. O `art_id` não é guardado.
- **"Ver no mapa": opção a).** A moradas.dev não devolve coordenadas, por isso o `centro` é obtido geocodificando a localidade com o Open-Meteo (`count=10`, `countryCode=PT`). Fica o primeiro resultado com `admin2` igual ao concelho (sem acentos nem maiúsculas). Há localidades com o mesmo nome em concelhos diferentes: "Ribamar" existe na Lourinhã e em Mafra, e o CP 2640-001 é o de Mafra. Se a localidade não for encontrada (ex.: "Ameiras de Baixo"), usa o concelho. Se nada for encontrado ou a geocodificação falhar, o `centro` fica `null` e o botão do mapa não aparece, que é a opção b) como fallback. O novo campo `centroPrecisao` (`localidade`/`concelho`) é mostrado por baixo do mapa como "Localização aproximada (…)".
- **Erros:** `CodigoPostalError` com `status`, `retryAfter` e `hint`.
  - **404** `{"error":"CP7 not found"}` → "Código postal não encontrado.". O `X-Moradas-Hint`, em inglês e exposto por CORS, fica em `hint` mas não é mostrado.
  - **429** → "Demasiadas pesquisas seguidas. Tente novamente dentro de N s/min." quando o `Retry-After` é legível. No browser, o `Retry-After` não está em `Access-Control-Expose-Headers`, por isso a mensagem diz "daqui a pouco".
  - `shouldRetryCodigoPostal` é usado como `retry` do React Query nas duas apps e não repete 404 nem 429.
- **Fora de âmbito:** `/suggest`, `/resolve` e `/cp/{cp4}`.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/codigoPostal.ts` | moradas.dev + conversão para `CpInfo`, geocodificação Open-Meteo, `centroPrecisao`, `CodigoPostalError`, `shouldRetryCodigoPostal` |

### Phase 2: Apps

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/hooks/useCodigoPostal.ts` | `retry: shouldRetryCodigoPostal` |
| Modify | `apps/mobile/hooks/useCodigoPostal.ts` | `retry: shouldRetryCodigoPostal` |
| Modify | `apps/web/src/pages/CodigoPostal.tsx` | Fonte "moradas.dev" + nota "Localização aproximada" |
| Modify | `apps/mobile/app/codigo-postal.tsx` | Fonte "moradas.dev" + nota "Localização aproximada" |
| Modify | `README.md` | Fontes de dados e tabela de ecrãs |

## Validação

- [x] Smoke test em Node: 1000-001 (Lisboa), 2640-001 (Ribamar, Mafra), 7570-104 (sem artérias, centro do concelho), 4000-322 (Porto), 9999-999 (404 com hint) e 429 simulado, com e sem `Retry-After`
- [x] Web: `tsc -b`, `vite build` e `oxlint`
- [x] Mobile: `tsc --noEmit` e `oxlint`

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/codigoPostal.ts` | Modify | Nova fonte, coordenadas e erros |
| `apps/web/src/hooks/useCodigoPostal.ts` | Modify | Sem repetir 404/429 |
| `apps/mobile/hooks/useCodigoPostal.ts` | Modify | Sem repetir 404/429 |
| `apps/web/src/pages/CodigoPostal.tsx` | Modify | Fonte e nota do mapa |
| `apps/mobile/app/codigo-postal.tsx` | Modify | Fonte e nota do mapa |
| `README.md` | Modify | Documentação |
