---
maestru: "0.4"
type: work-spec
id: web-026-spec
title: "Comunicados da ANPC — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-026
owner: developer
created: 2026-10-09
---

# Comunicados da ANPC — Implementation Plan

## Overview

O ecrã Proteção Civil (web e mobile) mostra as ocorrências e o resumo da ANPC, mas não os comunicados. Este plano acrescenta os comunicados de `GET /v1/anpc/warnings` (API Aberta, via fogos.pt), do mais recente para o mais antigo.

**Decisões** (testes de 2026-10-09)
- **Ordenação no cliente.** A rota devolve os comunicados por ordem de publicação, os mais antigos primeiro (desde 2022), e nem sempre por ordem (`27-06-2026` aparece depois de `18-09-2026`). `?sort=` é ignorado. O core lê a data do `label` (`HH:mm DD-MM-AAAA`, hora de Portugal) para `date` (`AAAA-MM-DDTHH:mm`) e ordena por essa data, do mais recente para o mais antigo. Os que não tiverem data reconhecida ficam no fim.
- **Paginação.** A resposta é `meta` (`page`, `limit`, `total`, `pages`) + `data`. O limite por omissão é 50 e o máximo aceite é 200 (`limit=500` devolve 400). O core pede `limit=200` e lê as páginas seguintes, se as houver. Hoje há 39 comunicados, numa só página.
- **Apresentação.** Mostra os 5 mais recentes com a data, e "Ver mais" acrescenta 5 de cada vez. O texto é mostrado tal como vem, com quebras de linha e emojis.
- **`/anpc/incidents/active`.** Devolve as mesmas ocorrências que `/anpc/incidents`, incluindo as de estado "Conclusão", que vêm com `active: true`. Não evita, por isso, o filtro no cliente (ativas vs. concluídas). A única diferença é o `count`: `/anpc/incidents` devolveu `count: 1` com 5 ocorrências e `/active` devolveu `count: 5`. As apps não usam o `count`. `getActiveIncidents()` fica no core, mas as apps continuam a usar `/anpc/incidents`.
- **`/anpc/risk`** veio vazio. O risco de incêndio continua a vir do RCM do IPMA.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/anpc.ts` | `AnpcWarning`, `AnpcWarningsPage`, `AnpcWarningItem`, `AnpcWarningsResponse`; `getWarnings()` (todas as páginas, ordenado), `getActiveIncidents()`; `parseAnpcWarningLabel`, `sortAnpcWarnings`, `formatAnpcWarningDate` |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/hooks/useANPC.ts` | `useAnpcWarnings()` (staleTime 15 min) |
| Modify | `apps/web/src/pages/ProtecaoCivil.tsx` | Cartão "Comunicados da Proteção Civil" depois do estado; "Atualizar" também recarrega os comunicados |

### Phase 3: Mobile

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/hooks/useAnpc.ts` | `useAnpcWarnings()` |
| Modify | `apps/mobile/app/protecao-civil.tsx` | `WarningsCard` depois do risco de incêndio; o refresh também recarrega os comunicados |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/anpc.ts` | Modify | Cliente e ordenação dos comunicados; rota `/anpc/incidents/active` |
| `apps/web/src/hooks/useANPC.ts` | Modify | Hook dos comunicados |
| `apps/web/src/pages/ProtecaoCivil.tsx` | Modify | Cartão de comunicados |
| `apps/mobile/hooks/useAnpc.ts` | Modify | Hook dos comunicados |
| `apps/mobile/app/protecao-civil.tsx` | Modify | Cartão de comunicados |
| `README.md` | Modify | Tabela de ecrãs |
