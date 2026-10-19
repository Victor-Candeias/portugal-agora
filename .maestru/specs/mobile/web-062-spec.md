---
maestru: "0.4"
type: work-spec
id: web-062-spec
title: "WEB-062 Spec"
template: implementation-plan-v1
work-item: mobile/WEB-062
owner: developer
created: 2026-10-19
---

# WEB-062 Spec

# WEB-062 Spec

## Overview

Corrigir as duas diferenças de paridade web/mobile do WEB-062:
1. O Início do mobile passa a ter os resumos "CEME mais barato" e "Contratos Públicos" que o Dashboard web já tinha.
2. NIF/VIES no web publicado — **opção a**: manter o link para o portal VIES e documentar a limitação como definitiva (sem proxy nem serviço intermédio; coerente com "só local, sem cloud" e com não enviar NIFs a terceiros).

## Implementation

| Passo | Ação |
|-------|------|
| 1 | `apps/mobile/app/(tabs)/index.tsx`: `useCheapestEvTariffs(30)` → cartão "⚡ CEME mais barato" (preço/kWh, CEME, custo de 30 kWh, fonte ERSE/OMIE sem OPC/EGME) → `/ev` |
| 2 | Mesmo ecrã: `useBaseContracts(null)` (mesma query/cache da 1.ª página do ecrã Contratos) → cartão "📑 Contratos Públicos" (total + mais recente: descrição/adjudicatário, valor, data) → `/contratos` |
| 3 | `SummaryCard` ganha `subtitleLines` opcional para limitar subtítulos longos |
| 4 | "Estado dos dados" do Início passa a listar "Tarifas CEME" e "Contratos BASE" |
| 5 | `apps/web/src/pages/Nif.tsx`: texto da limitação passa a explicar o motivo (sem CORS, sem intermediários) e mantém o link para o VIES |
| 6 | `README.md`: retirar "no web" dos resumos do Início; documentar a decisão do VIES |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/app/(tabs)/index.tsx` | modify | Cartões CEME e Contratos + "Estado dos dados" |
| `apps/web/src/pages/Nif.tsx` | modify | Texto da limitação do VIES no web publicado |
| `README.md` | modify | Resumos do Início em ambas as apps; decisão VIES |

## Validation

- `pnpm run typecheck` em `apps/mobile` — ok
- `oxlint` em `apps/mobile/app` e `apps/web/src/pages/Nif.tsx` — ok
- `pnpm run build` em `apps/web` — ok
- Sem emulador disponível: validação visual do mobile fica por fazer no dispositivo.
