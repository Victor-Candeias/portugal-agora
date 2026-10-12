---
maestru: "0.4"
type: work-spec
id: web-049-spec
title: "WEB-049 Spec — Freguesias do concelho (geoapi.pt)"
template: implementation-plan-v1
work-item: mobile/WEB-049
owner: developer
created: 2026-10-12
---

# WEB-049 Spec — Freguesias do concelho (geoapi.pt)

## Overview

A ficha do concelho (web e mobile) passa a mostrar a lista de freguesias (nome e área) e os limites de cada freguesia no mapa, sobre a fronteira do concelho. Tocar ou clicar numa freguesia, no mapa ou na lista, seleciona-a: fica destacada e o mapa enquadra-a. Voltar a tocar nela, ou no botão "Ver concelho", volta ao concelho todo.

**Decisões (2026-10-12):**

- **A lista e o mapa vêm da geoapi.pt**, num só pedido. A API Aberta `/geo/parishes` não tem geometria nem área e obrigaria a tirar o concelho do nome.
- **O concelho é associado pelo código INE e não pelo nome.** A geoapi.pt usa nomes próprios para os homónimos ("Calheta" = Madeira, "Calheta de São Jorge" = Açores, "Lagoa (Açores)"). Por isso:
  - `GET https://json.geoapi.pt/municipios/freguesias` (~92 KB, 308 concelhos com `codigoine`) dá o índice código INE → nome geoapi;
  - depois, `GET /municipio/{nome}/freguesias` traz `geojsons.freguesias`.
  - Os 308 códigos INE da API Aberta existem todos na geoapi.pt.
- **A geometria é simplificada (Douglas-Peucker, 0,0002° ≈ 20 m) e as coordenadas são arredondadas a 5 casas.** Torres Vedras passa de ~36 mil pontos (~850 KB) para ~2,4 mil (~47 KB); Odemira, o pior caso, fica com ~100 KB. Os anéis que ficam com menos de 4 pontos (ilhéus, buracos) são descartados, exceto o anel exterior do polígono principal.
- **Cache persistente de 30 dias**: o índice e as freguesias de cada concelho, em `localStorage` no web e `expo-sqlite/kv-store` no mobile. Se a geoapi.pt falhar, usa a cache expirada. Sem cache e sem rede, a ficha mostra o mesmo que antes, sem freguesias.
- **Sem etiquetas no mapa:** o estilo raster do mobile não tem glyphs. O nome aparece ao tocar/clicar (destaque e nome por cima do mapa) e, no web, também num tooltip ao passar o rato.
- **Limite de pedidos:** o limite de 5 pedidos/dia (WEB-038) é do `geoapi.pt/...?json=1`. O `json.geoapi.pt` não envia cabeçalhos `RateLimit`. Mesmo assim, um 429 dá `GeoApiError` sem novas tentativas.

## Implementation

1. **Core (`packages/core/src/api/geoapi.ts`):**
   - `createGeoApiClient({ baseUrl })`:
     - `getMunicipalityIndex()` → `[{ name, codigoine }]`;
     - `getMunicipalityParishes(name)` → `MunicipalityParish[]` (`code`, `name`, `area_ha`, `center`, `boundary`), ordenadas por nome. As features com o mesmo `dtmnfr` são juntadas num MultiPolygon.
   - `GeoApiError` (com `status`) e `shouldRetryGeoApi` (não repete 404 nem 429).
   - `simplifyBoundary(boundary, tolerance)`: Douglas-Peucker por anel, mais arredondamento.
   - `loadMunicipalityParishesCached({ codigoine, client?, storage, now? })`:
     - cache por concelho (`geoapi:freguesias:v1:{codigoine}`) e índice (`geoapi:municipios:v1`), ambos de 30 dias (`PARISHES_CACHE_TTL_MS`);
     - em caso de falha, usa a cache expirada.
   - `parishesFeatureCollection(parishes)`: `FeatureCollection` com `id` e `properties.code`/`name`, para o mapa.
   - Exportar em `packages/core/src/index.ts`.
2. **Web:**
   - `useMunicipalityParishes(codigoine)` em `hooks/useConcelhos.ts`.
   - `BoundaryMap` aceita `parishes`, `selectedParish` e `onSelectParish`:
     - camada `L.geoJSON` das freguesias com tooltip `sticky` e clique;
     - a seleção muda o estilo e enquadra a freguesia (ou o concelho, ao desselecionar).
   - Em `ConcelhoDetalhe.tsx`:
     - cartão "Freguesias (N)" com a lista clicável;
     - cabeçalho do mapa com a freguesia selecionada e "Ver concelho";
     - fonte atualizada.
3. **Mobile:**
   - `useMunicipalityParishes(codigoine)` em `hooks/useConcelhos.ts`.
   - `BoundaryMap` com `GeoJSONSource id="parishes"` e `onPress`. Camadas `fill` e `line`, e uma camada filtrada (`['==', ['get','code'], selected]`) para o destaque. A `Camera` enquadra a freguesia selecionada.
   - Em `app/concelhos/[slug].tsx`: cartão "Freguesias (N)" com `Pressable`, freguesia selecionada por cima do mapa e fonte atualizada.
4. **README:** fontes de dados e funcionalidades.
5. **Validação:**
   - smoke test do core contra a API real (Torres Vedras, Lisboa, Funchal MultiPolygon, Calheta de São Jorge 4501, Lagoa (Açores) 4201, cache, fallback offline);
   - typecheck e lint do web e do mobile; `vite build`.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/geoapi.ts` | create | Cliente geoapi.pt, simplificação, cache e FeatureCollection |
| `packages/core/src/index.ts` | modify | Exportar `geoapi.ts` |
| `apps/web/src/hooks/useConcelhos.ts` | modify | `useMunicipalityParishes` |
| `apps/web/src/components/BoundaryMap.tsx` | modify | Camada das freguesias e seleção |
| `apps/web/src/pages/ConcelhoDetalhe.tsx` | modify | Lista de freguesias e seleção |
| `apps/mobile/hooks/useConcelhos.ts` | modify | `useMunicipalityParishes` |
| `apps/mobile/components/BoundaryMap.tsx` | modify | Camadas das freguesias e `onPress` |
| `apps/mobile/app/concelhos/[slug].tsx` | modify | Lista de freguesias e seleção |
| `README.md` | modify | Fontes de dados e funcionalidades |
