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
