---
maestru: "0.4"
type: work-spec
id: mob-016-spec
title: "MOB-016 Spec — Combustível: posto no mapa e direções"
template: implementation-plan-v1
work-item: mobile/MOB-016
owner: developer
created: 2026-10-11
---

# MOB-016 Spec — Combustível: posto no mapa e direções

## Overview

Na tab Combustível do mobile, cada posto da lista passa a ter as ações **Ver no mapa** (mapa nativo MapLibre/OSM com o posto e a minha posição) e **Como chegar** (percurso de carro no Google Maps desde a minha localização até ao posto). Reutiliza o `PointsMap` (MOB-004) e o `openDirections` de `lib/maps.ts`.

## Implementation

1. `lib/maps.ts`: `directionsUrl`/`openDirections` aceitam opções `{ origin?, travelMode? }`. Sem opções o URL é o mesmo de antes, por isso Hospitais, Serviços Públicos e EV não mudam. `MapPoint.noDirections` esconde "Direções" num ponto.
2. `components/PointsMap.tsx`: nova prop `directions` (opções passadas ao "Direções" do balão); respeita `noDirections`.
3. `app/(tabs)/combustivel.tsx`: a linha do posto passa a ser o componente `StationItem`, tocável. Tocar expande a linha (só uma aberta de cada vez) com:
   - "🗺️ Ver no mapa" / "Ocultar mapa": `PointsMap` com o posto (selecionado, preço e distância no balão) e o marcador verde "Estou aqui" quando há localização;
   - "🧭 Como chegar": `https://www.google.com/maps/dir/?api=1&origin=<lat,lng>&destination=<lat,lng>&travelmode=driving`. Sem localização, omite `origin` e o Google Maps usa a posição atual do telemóvel.
   - Postos sem coordenadas DGEG mostram uma nota em vez das ações.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/lib/maps.ts` | modify | Opções `origin`/`travelMode` nas direções; `MapPoint.noDirections` |
| `apps/mobile/components/PointsMap.tsx` | modify | Prop `directions`; esconder "Direções" em pontos `noDirections` |
| `apps/mobile/app/(tabs)/combustivel.tsx` | modify | `StationItem` expansível com "Ver no mapa" e "Como chegar" |
