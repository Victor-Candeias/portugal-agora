---
maestru: "0.4"
type: work-spec
id: web-042-spec
title: "WEB-042 Spec — Ficha do concelho (API Aberta /geo)"
template: implementation-plan-v1
work-item: mobile/WEB-042
owner: developer
created: 2026-10-11
---

# WEB-042 Spec — Ficha do concelho (API Aberta /geo)

## Overview

Secção "Concelhos" (lista e ficha) no web e no mobile, com os dados de `/geo/municipalities` da API Aberta. A lista fica em cache persistente durante 30 dias. A ficha mostra os contactos da câmara, a área e a fronteira do concelho num mapa (Leaflet no web, MapLibre no mobile).

## Implementation

1. **Core (`packages/core/src/api/client.ts`):**
   - `GeoMunicipality` passa a incluir `area_ha`, `email`, `phone`, `postal_code` e `website`.
   - Novo `getMunicipality(slug)` → `/geo/municipalities/{slug}` (`GeoMunicipalityDetail` com `geojson`).
   - `getMunicipalities()` devolve `{ total, data }`.
2. **Core (`packages/core/src/api/geo.ts`):**
   - `GeoBoundary` (Feature Polygon/MultiPolygon) e `boundaryBounds()` → `[oeste, sul, este, norte]`.
   - `loadMunicipalitiesCached({ fetchAll, storage, now? })` com `KeyValueStorage` (getItem/setItem, síncrono ou assíncrono):
     - cache válida (30 dias, `MUNICIPALITIES_CACHE_TTL_MS`) → devolve-a;
     - senão pede à API e grava;
     - se a API falhar e houver cache expirada, devolve-a.
   - `municipalityDistrict(m)`: os 30 concelhos das ilhas vêm com `district` vazio, por isso a região sai do código INE (31–32 → Madeira, 41–49 → Açores).
   - `sortMunicipalities`, `filterMunicipalities(list, { query, district })` (sem acentos, também pelo código INE), `municipalityDistricts`, `formatAreaKm2` (ha → km², pt-PT) e `formatPtPhone`.
3. **Web:**
   - `hooks/useConcelhos.ts`:
     - `useMunicipalities()` com `localStorage` e `staleTime` de 30 dias;
     - `useMunicipality(slug)` com `staleTime` de 7 dias.
   - `components/BoundaryMap.tsx`: Leaflet `L.geoJSON` com `fitBounds`.
   - Páginas:
     - `Concelhos.tsx` (`/concelhos`): pesquisa, `<select>` de distrito e grelha;
     - `ConcelhoDetalhe.tsx` (`/concelhos/:slug`): ficha e mapa.
   - Rotas em `main.tsx` e entrada "Concelhos" no `Layout.tsx`.
4. **Mobile:**
   - `hooks/useConcelhos.ts`: igual ao web, mas com `expo-sqlite/kv-store`.
   - `components/BoundaryMap.tsx`: `Map` + `Camera` com bounds, e `GeoJSONSource` com camadas `fill` e `line`.
   - Ecrãs:
     - `app/concelhos/index.tsx`: pesquisa, `ChipRow` de distritos e lista;
     - `app/concelhos/[slug].tsx`: ficha com `tel:` e `mailto:` e o mapa.
   - `Stack.Screen` em `_layout.tsx` e entrada em `lib/sections.ts`.
5. A ficha mostra logo os dados da lista em cache e completa com o detalhe (mapa) quando este chega.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/client.ts` | modify | Tipos `/geo` completos e `getMunicipality(slug)` |
| `packages/core/src/api/geo.ts` | create | Cache persistente, filtros, formatação e limites do GeoJSON |
| `packages/core/src/index.ts` | modify | Exportar `geo.ts` |
| `apps/web/src/hooks/useConcelhos.ts` | create | Hooks React Query e `localStorage` |
| `apps/web/src/components/BoundaryMap.tsx` | create | Fronteira no Leaflet |
| `apps/web/src/pages/Concelhos.tsx` | create | Lista |
| `apps/web/src/pages/ConcelhoDetalhe.tsx` | create | Ficha |
| `apps/web/src/main.tsx`, `apps/web/src/components/Layout.tsx` | modify | Rotas e navegação |
| `apps/mobile/hooks/useConcelhos.ts` | create | Hooks React Query e kv-store |
| `apps/mobile/components/BoundaryMap.tsx` | create | Fronteira no MapLibre |
| `apps/mobile/app/concelhos/index.tsx` | create | Lista |
| `apps/mobile/app/concelhos/[slug].tsx` | create | Ficha |
| `apps/mobile/app/_layout.tsx`, `apps/mobile/lib/sections.ts` | modify | Stack e grelha do Início |
| `README.md` | modify | Fontes de dados e Funcionalidades |
