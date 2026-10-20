---
maestru: "0.4"
type: work-spec
id: mob-020-spec
title: "MOB-020 Spec — Cobertura móvel no mobile"
template: implementation-plan-v1
work-item: mobile/MOB-020
owner: developer
created: 2026-10-20
---

# MOB-020 Spec — Cobertura móvel no mobile

## Overview

Ecrã mobile «📶 Cobertura móvel» (`/cobertura`) sobre o cliente do WEB-065. Expo 57: ler a documentação v57 antes de programar (`apps/mobile/AGENTS.md`). Só build local, sem serviços online.

**Decisões**
- **Localização.** `useUserLocation` (expo-location, com Lisboa como alternativa) e toque no mapa para mudar o ponto.
- **Dados.** O mesmo hook do web (React Query com tecnologia e coordenadas na chave).
- **Mapa.** `@maplibre/maplibre-react-native` 11.5, com uma fonte raster cujos `tiles` são o `export` da ANACOM (`bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`, `tileSize` 256), por cima do `OSM_STYLE`, com marcador no ponto, opacidade ajustável e legenda.
- **UI.** Chips 2G/4G/5G e cartões por operadora com estado, classe, «5G provisório», fonte e data. Os avisos são os mesmos do web.

## Implementation

### Phase 1: Mobile

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/hooks/useCoverage.ts` | `useMobileCoverage(tech, point)` e `useCoverageCatalog()` |
| Create | `apps/mobile/components/CoverageMap.tsx` | MapLibre com fonte raster ANACOM, toque para escolher o ponto, legenda e opacidade |
| Create | `apps/mobile/app/cobertura.tsx` | Ecrã: localização, chips, cartões, mapa e avisos |
| Modify | `apps/mobile/lib/sections.ts` | `{ href: '/cobertura', title: 'Cobertura móvel', emoji: '📶', … }` |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/hooks/useCoverage.ts` | Create | Hooks |
| `apps/mobile/components/CoverageMap.tsx` | Create | Mapa |
| `apps/mobile/app/cobertura.tsx` | Create | Ecrã |
| `apps/mobile/lib/sections.ts` | Modify | Secção no menu |
| `README.md` | Modify | Tabela de ecrãs |
