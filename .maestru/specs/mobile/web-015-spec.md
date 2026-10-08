---
maestru: "0.4"
type: work-spec
id: web-015-spec
title: "WEB-015 Spec — Alertas da rede Carris"
template: implementation-plan-v1
work-item: mobile/WEB-015
owner: developer
created: 2026-10-08
---

# WEB-015 Spec — Alertas da rede Carris

## Overview

Alertas da rede Carris Metropolitana (desvios, obras, interrupções) a partir de `GET https://api.carrismetropolitana.pt/v2/alerts`, com fetch direto (CORS `*`), atualizado a cada 5 min com React Query e sem persistência (dado dinâmico).

Estes alertas são diferentes dos da aba "Alertas TML" (`go.tmlmobilidade.pt/hub/api/v1/alerts`, `useTmlAlerts`), que se mantém sem alterações.

**Formato da API (2026-10):** array GTFS-RT em JSON, sem campo de ID. Campos: `active_period[{start,end}]` (unix s), `cause`, `effect`, `header_text`/`description_text` (`translation[{language,text}]`), `informed_entity[{agency_id, route_id, stop_id?}]` e `image.localized_image[{url}]` (opcional). `route_id` = `[AGENCY]{line}_{n}` → `line_id` = `{line}` (verificado: os 207 line_ids dos alertas existem todos na tabela `lines` do `.sqlite`).

## Implementation

### Core (`packages/core/src/api/carris.ts`)

- Tipo normalizado `CMAlert` (`id` derivado de início:fim:título, `header`, `description`, `cause`, `effect`, `start`/`end` ou `null`, `line_ids`, `stop_ids`, `image_url`).
- `getAlerts()` — normaliza (tradução `pt` ou a primeira), remove os que já terminaram e duplicados, ordena com os ativos primeiro e depois por início desc.
- `isAlertActive(alert, nowSeconds)` — exportado para a UI distinguir ativos de programados.

### Web

- `useCarrisAlerts()` (`apps/web/src/hooks/useCarris.ts`) — `staleTime` e `refetchInterval` de 5 min, sem `gcTime` infinito nem persistência.
- `Transportes.tsx` — nova sub-tab **Alertas** na aba Carris Metropolitana (`CarrisAlertsSubTab`): filtro por linha (prefixo), chips por efeito (reaproveita `EFFECT_LABEL`/`EFFECT_COLOR`/`CAUSE_LABEL`, a que se acrescentou `OTHER_CAUSE`), badge "Programado" para alertas futuros, linhas afetadas com a cor da linha, nº de paragens afetadas, período e link para a imagem quando existe.

### Validação

- `getAlerts` contra a API real: 98 alertas (83 ativos, 15 programados), todos com linhas e 19 com imagem.
- `pnpm build` + `pnpm lint` (web), `pnpm typecheck` (mobile).

### Follow-ups possíveis (fora do âmbito)

- Mostrar os alertas de uma linha no detalhe da linha / de uma paragem nas chegadas (`line_ids`/`stop_ids` já disponíveis).
- Ecrã de alertas na app mobile (o core já expõe `getAlerts`).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/carris.ts` | Edit | Tipos, normalização, `getAlerts`, `isAlertActive` |
| `apps/web/src/hooks/useCarris.ts` | Edit | Hook `useCarrisAlerts` (refetch de 5 min) |
| `apps/web/src/pages/Transportes.tsx` | Edit | Sub-tab "Alertas" na aba Carris |
