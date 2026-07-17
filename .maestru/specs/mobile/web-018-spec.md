---
maestru: "0.4"
type: work-spec
id: web-018-spec
title: "Turismo SIGTUR - Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-018
owner: developer
created: 2026-07-17
---

# Turismo SIGTUR - Implementation Plan

## Overview

Integrar dados do SIGTUR/TravelBI (Turismo de Portugal) via ArcGIS REST Feature Services,
seguindo o padrão client-only já existente (sem backend próprio). Fonte: `.Docs/Turismo.txt`.
Começar apenas com a layer já validada (Turismo Saúde e Bem-Estar) e disponibilizar uma
tab mobile + página web com lista e mapa dos pontos de interesse.

## Implementation

1. Cliente ArcGIS REST em `packages/core` (`sigtur.ts`) com query por layer, normalização de
   campos e suporte a bbox/proximidade.
2. Tipos zod `TourismPointSchema` em `packages/core/src/types/index.ts`.
3. Hook `useTourismPoints` em `apps/mobile/hooks/useApi.ts` (React Query, staleTime alto).
4. Tab mobile `apps/mobile/app/(tabs)/turismo.tsx` (padrão de `ev.tsx`) + registo em `_layout.tsx`.
5. Página web `apps/web/src/pages/Turismo.tsx` com mapa Leaflet (padrão de `Hospitais.tsx`) +
   registo de rota/menu em `main.tsx`/`Layout.tsx`.
6. Validar build/lint web e typecheck mobile.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/sigtur.ts` | create | Cliente ArcGIS REST + normalização |
| `packages/core/src/types/index.ts` | edit | Schema `TourismPoint` |
| `packages/core/src/index.ts` | edit | Exportar novo cliente/tipos |
| `apps/mobile/hooks/useApi.ts` | edit | Hook `useTourismPoints` |
| `apps/mobile/app/(tabs)/turismo.tsx` | create | Tab mobile |
| `apps/mobile/app/(tabs)/_layout.tsx` | edit | Registar tab |
| `apps/web/src/pages/Turismo.tsx` | create | Página web com mapa |
| `apps/web/src/main.tsx` | edit | Rota |
| `apps/web/src/components/Layout.tsx` | edit | Menu |
