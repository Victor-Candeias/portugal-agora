---
maestru: "0.4"
type: work-spec
id: mob-004-spec
title: "Mobile: componente de mapa nativo — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-004
owner: developer
created: 2026-10-09
---

# Mobile: componente de mapa nativo — Implementation Plan

## Overview

Componente de mapa nativo reutilizável para a app mobile, equivalente ao `SinglePointMap` (Leaflet) do web: um ponto ou uma lista de pontos, com "🧭 Direções" a abrir o Google Maps nativo. Desbloqueia o MOB-005, cujos ecrãs (Proteção Civil, Hospitais, Transportes, …) só precisam de usar `components/PointsMap.tsx`.

**Decisão:** MapLibre (`@maplibre/maplibre-react-native`) com mosaicos raster do OpenStreetMap em vez de `react-native-maps`/`expo-maps`. Estes dois usam Google Maps no Android e exigem uma chave da Maps SDK criada na Google Cloud Console (com o SHA-1 do certificado), o que contraria a regra do projeto de desenvolvimento só local, sem serviços cloud. O OSM já é a fonte dos mapas do web e não precisa de chave.

## Implementation

### Phase 1: Dependência

#### Step 1.1: MapLibre React Native

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/package.json`, `pnpm-lock.yaml` | `@maplibre/maplibre-react-native@^11.5.0` (Fabric/codegen; peers `expo >=54`, `react-native >=0.80`) — instalado com pnpm 10 |
| Modify | `apps/mobile/app.json` | Config plugin `@maplibre/maplibre-react-native` (só grava propriedades Gradle `org.maplibre.reactnative.*`; sem opções = valores por omissão) |

- [x] `expo prebuild -p android` + `gradlew assembleDebug` (JDK 17, x86_64)

### Phase 2: Componente

#### Step 2.1: Utilitários

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/lib/maps.ts` | `OSM_STYLE` (estilo MapLibre com a fonte raster `tile.openstreetmap.org` e atribuição), tipo `MapPoint`, `directionsUrl`/`openDirections` (URL universal `google.com/maps/dir/?api=1` — no Android abre a app Google Maps, senão o browser), `viewForPoints` (um ponto ou pontos coincidentes → centro + zoom 15; vários → `bounds`) |

#### Step 2.2: `PointsMap` / `SinglePointMap`

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/components/PointsMap.tsx` | `PointsMap({ points, height, initialSelectedId, color, style })`: `Map` + `Camera` declarativa (memoizada pelos pontos; `bounds` com padding 40) + `Marker` por ponto; tocar num marcador mostra um cartão com nome, descrição, "🧭 Direções" e ✕. Sem pontos válidos → mensagem "Sem localização disponível". `SinglePointMap({ latitude, longitude, label, description })` = `PointsMap` com um ponto já selecionado |

- [x] Mosaicos OSM e enquadramento por `bounds` de ~200 pontos
- [x] Toque num marcador → cartão com nome/categoria e "Direções"
- [x] `SinglePointMap` centrado (zoom 15) com o ponto selecionado
- [x] "Direções" abre `com.google.android.apps.maps/.MapsActivity`

### Phase 3: Utilização

#### Step 3.1: Turismo

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/app/(tabs)/turismo.tsx` | Mapa geral com todos os pontos no topo da lista; em cada cartão "🗺️ Mapa"/"Ocultar mapa" mostra um `SinglePointMap` (como no web); "Direções" passa a usar `openDirections` |

### Phase 4: Documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `README.md` | Secção "Mapas no mobile" |

## Validação

`pnpm typecheck` e `pnpm lint` no mobile; `expo prebuild -p android` + `gradlew assembleDebug` (JDK 17, x86_64); cenários acima no emulador `Pixel_10a` com Metro, no ecrã Turismo.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/lib/maps.ts` | create | Estilo OSM, direções, enquadramento |
| `apps/mobile/components/PointsMap.tsx` | create | Componentes `PointsMap` e `SinglePointMap` |
| `apps/mobile/app/(tabs)/turismo.tsx` | modify | Mapa geral + mapa por cartão |
| `apps/mobile/app.json` | modify | Config plugin do MapLibre |
| `apps/mobile/package.json` | modify | `@maplibre/maplibre-react-native` |
| `pnpm-lock.yaml` | modify | Lockfile |
| `README.md` | modify | Documentação |
