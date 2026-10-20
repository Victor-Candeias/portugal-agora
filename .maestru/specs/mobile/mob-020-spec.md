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

## Implementation Notes (2026-10-20)

- **Rota.** `app/cobertura.tsx` registada na stack raiz (`app/_layout.tsx`, título «Cobertura móvel»). Aparece na grelha do Início pela entrada `/cobertura` do `lib/sections.ts`.
- **Localização.** `useUserLocation(LISBON_COORDS)` pede a permissão ao abrir. Um toque no mapa fixa um ponto manual, que só é substituído pelo botão «Usar a minha localização» e só se a permissão for concedida. Se a localização for recusada, o ponto manual mantém-se; sem ponto manual, usa-se Lisboa («Lisboa (por omissão)»). O mapa só se centra quando muda o `focusKey` (GPS ou alternativa), não em cada toque, e espera pelo `onDidFinishLoadingMap` antes do `easeTo`.
- **Mapa.** `RasterSource` com `tiles: [anacomExportUrl(layerId)]` (o MapLibre Native substitui `{bbox-epsg-3857}`), `tileSize` 256 e `maxzoom` 18. Uma `Layer` raster com `raster-opacity`. A fonte e a camada têm `key`/`id` por `layerId`, por isso são recriadas ao mudar de operadora ou tecnologia. A câmara arranca com `PORTUGAL_MAINLAND_BOUNDS`.
- **UI.** Chips para a tecnologia (2G voz/4G/5G), para a camada do mapa (Global PT/DIGI/MEO/NOS/Vodafone) e para a opacidade (40–100 %), porque o projeto não tem slider. Há um cartão «melhor entre operadoras» e um cartão por operadora com a posição (empates), o estado (ícone e texto), a classe potencial, o selo «provisório» no 5G e «Fonte: ANACOM · dados do N.º trimestre». Os avisos são os do web: cobertura prevista, 5G provisório, atribuição com link para geo.anacom.pt, catálogo alterado, fora da área, e fonte indisponível com «Tentar de novo».
- **Hooks.** `useMobileCoverage` e `useCoverageCatalog` iguais aos do web, sem a pesquisa de localidades.
- **Verificação (APK release local, emulador Pixel_10a):**
  - Localização recusada: Lisboa 4G com MEO = NOS = Vodafone ≥ 300 (1.º, empate) e DIGI ≥ 100 (4.º), dados do 2.º trimestre de 2026. A camada raster aparece sobre o OSM.
  - Toque no rio: «Ponto escolhido no mapa», «Sem dados» e «Sem ordenação». Um novo pedido de localização recusado mantém o ponto manual.
  - 5G, camada MEO e opacidade de 100 %: a sobreposição muda e a legenda mostra «5G (provisório)».
  - GPS concedido (posição simulada em Mértola): «A sua localização», o mapa centra-se e o 5G dá MEO = NOS = Vodafone ≥ 1000 provisório (1.º, empate) e DIGI «Sem cobertura» (4.º).
  - «Cobertura móvel · Operadoras · ANACOM» aparece na grelha do Início.
