---
maestru: "0.4"
type: work-spec
id: web-066-spec
title: "WEB-066 Spec — Cobertura móvel na web"
template: implementation-plan-v1
work-item: mobile/WEB-066
owner: developer
created: 2026-10-20
---

# WEB-066 Spec — Cobertura móvel na web

## Overview

Página web «📶 Cobertura móvel» (`/cobertura`) sobre o cliente do WEB-065.

**Decisões**
- **Localização.** `navigator.geolocation`, só ao clicar (padrão de `Combustivel.tsx`), e clique no mapa. Sem pedir a localização ao abrir a página.
- **Dados.** React Query com a chave `['coverage', tech, lat, lon]`, coordenadas com 5 casas decimais e `staleTime` de 24 h.
- **Mapa.** Leaflet (canvas), com camada de imagens personalizada para o `export` da ANACOM (operadora/tecnologia escolhida), marcador no ponto, opacidade ajustável e legenda das classes. Enquadrado em Portugal.
- **Comparação.** Tabela com operadora, estado, classe potencial, «5G provisório», fonte e data. Os empates aparecem como empates.
- **Avisos.** «Cobertura prevista, não medição real. Pode variar em interiores e consoante o equipamento.» e «Fonte: ANACOM, dados de AAAATn».

## Implementation

### Phase 1: Web

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/src/hooks/useCoverage.ts` | `useMobileCoverage(tech, point)` e `useCoverageCatalog()` |
| Create | `apps/web/src/components/CoverageMap.tsx` | Leaflet, sobreposição do `export`, clique para escolher o ponto, legenda e opacidade |
| Create | `apps/web/src/pages/Cobertura.tsx` | Localização, filtros 2G/4G/5G, tabela, mapa e avisos |
| Modify | `apps/web/src/main.tsx` | `<Route path="cobertura" …>` |
| Modify | `apps/web/src/components/Layout.tsx` | Entrada no menu |
| Modify | `apps/web/src/pages/Dashboard.tsx` | Atalho, se o Dashboard listar secções |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/src/hooks/useCoverage.ts` | Create | Hooks |
| `apps/web/src/components/CoverageMap.tsx` | Create | Mapa |
| `apps/web/src/pages/Cobertura.tsx` | Create | Página |
| `apps/web/src/main.tsx` | Modify | Rota |
| `apps/web/src/components/Layout.tsx` | Modify | Menu |
| `apps/web/src/pages/Dashboard.tsx` | Modify | Atalho |
| `README.md` | Modify | Tabela de ecrãs |

## Implementation Notes (2026-10-20)

- **Dashboard sem atalho.** O `Dashboard.tsx` não tem lista nem grelha de secções (só cartões de resumo), por isso não se alterou. O acesso faz-se pelo menu lateral («Cobertura móvel», ícone `Signal`). O rodapé passou a citar «ANACOM».
- **Escolha do ponto.** GPS só ao clicar (estados: recusado / indisponível / sem suporte, com mensagem), pesquisa de localidade via `searchPtPlaces` (core, Open-Meteo geocoding) e clique no mapa. O mapa só se centra quando muda o `focusKey` (GPS ou pesquisa), não em cada clique.
- **Mapa.** `L.TileLayer.extend({ getTileUrl })` substitui `{bbox-epsg-3857}` pelo bbox do mosaico (z/x/y → metros EPSG:3857) no URL de `anacomExportUrl(layerId)`. A camada só se recria quando muda a operadora ou tecnologia; a opacidade usa `setOpacity`. Fica limitada ao `ANACOM_COVERAGE_EXTENT`. O ponto escolhido é um `circleMarker`, porque o ícone por omissão do `L.marker` parte-se no build do Vite.
- **Cache.** Chave `['coverage', tech, lat5, lon5]` com `staleTime` de 24 h; 0 se algum resultado for `source_unavailable`. `retry: false`, porque o cliente já converte erros em `source_unavailable` e a página oferece «Tentar de novo».
- **Verificação (vite preview + Chrome headless):**
  - Mértola 4G: MEO = NOS ≥ 300 (1.º empate), DIGI = Vodafone ≥ 100 (3.º empate).
  - Mértola 5G: selo «provisório»; DIGI «Sem cobertura» em 4.º.
  - Clique a leste (Espanha): «fora da área», sem pedidos `identify`.
  - Pedidos `identify` bloqueados: «Fonte indisponível» + «Tentar de novo».
  - GPS recusado: mensagem; a pesquisa e o clique continuam disponíveis.
  - Mosaicos `export`: 24/24 com HTTP 200. Sem erros na consola.
