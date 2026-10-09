---
maestru: "0.4"
type: work-spec
id: web-027-spec
title: "Focos de incêndio por satélite (NASA FIRMS) — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-027
owner: developer
created: 2026-10-09
---

# Focos de incêndio por satélite (NASA FIRMS) — Implementation Plan

## Overview

O ecrã Proteção Civil (web e mobile) passa a ter um mapa dos focos de calor detetados por satélite (VIIRS/MODIS) em Portugal continental, a partir de `GET /v1/nasafirms/hotspots` (API Aberta, conector `apiaberta/connector-nasafirms`, atualizado a cada 30 min).

**Decisões** (testes de 2026-10-09)
- **Parâmetros.** `days` aceita 1–7 (`0` e `10` devolvem 400); o core limita o valor a esse intervalo. `source` aceita `VIIRS_SNPP` ou `MODIS` (as apps não filtram). O `limit` por omissão é 100; `limit=1000` é aceite. O core pede `limit=1000` e lê as páginas seguintes, se as houver (como no WEB-026). Hoje há 48 focos em 7 dias (46 VIIRS S-NPP, 2 MODIS).
- **Resposta.** `meta` (`days`, `source`, `page`, `limit`, `total`, `pages`) + `data` com `latitude`, `longitude`, `brightness` (K), `acq_date`, `acq_time` (`HHMM`), `satellite`, `instrument`, `source`, `frp` (MW), `daynight` e, só no MODIS, `confidence` (0–100). O core ordena do mais recente para o mais antigo e gera um `id` estável.
- **Hora.** A FIRMS dá a aquisição em UTC. O core converte para a hora de Portugal continental (WET/WEST, regra da UE: último domingo de março/outubro às 01:00 UTC) sem depender do `Intl` (Hermes), e formata `DD/MM HHhmm`.
- **Filtro por dias.** Chips 1/2/3/7 dias, 7 por omissão (o valor por omissão da API). Cada valor é um pedido próprio (React Query com `days` na chave), porque `days` é aplicado pelo conector.
- **Cores.** Por antiguidade do foco: até 12 h vermelho, 12–48 h laranja, mais de 48 h amarelo, com legenda.
- **Mapa.** Enquadrado em Portugal continental (`PORTUGAL_MAINLAND_BOUNDS`), não nos pontos (um só foco daria zoom máximo). Web: Leaflet com `preferCanvas` e `circleMarker` (aguenta milhares de focos), sempre visível. Mobile: `PointsMap` (MapLibre) atrás de "🗺️ Ver no mapa", como o mapa das ocorrências, limitado aos 300 focos mais recentes (cada marcador é uma `View`).
- **Aviso.** Os focos de calor não são necessariamente incêndios confirmados: a UI diz isto em destaque e indica a fonte (NASA FIRMS via API Aberta) e a data/hora de aquisição (último foco no resumo, cada foco no popup/callout).
- **`/nasafirms/meta`.** Dá os totais por fonte; fica no core (`getNasaFirmsMeta()`), mas as apps não o usam.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/api/nasaFirms.ts` | Tipos (`NasaFirmsHotspot`, `NasaFirmsHotspotItem`, `NasaFirmsHotspotsResponse`, `NasaFirmsMeta`); `NASA_FIRMS_DAY_OPTIONS`, `PORTUGAL_MAINLAND_BOUNDS`; `sortFirmsHotspots`, `firmsAcquiredAt`, `lisbonOffsetMinutes`, `formatFirmsAcquisition`, `firmsSourceLabel`, `formatFirmsConfidence`, `describeFirmsHotspot`, `firmsAge` + `FIRMS_AGE_COLORS`/`FIRMS_AGE_LABELS` |
| Modify | `packages/core/src/api/client.ts` | `ApiAbertaClient.getNasaFirmsHotspots({ days, source })` (todas as páginas, ordenado) e `getNasaFirmsMeta()` |
| Modify | `packages/core/src/index.ts` | Exporta `nasaFirms` |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/hooks/useANPC.ts` | `useNasaFirmsHotspots(days)` (staleTime 15 min) |
| Create | `apps/web/src/components/HotspotsMap.tsx` | Leaflet (canvas), círculos coloridos por antiguidade, popup com hora e detalhe |
| Modify | `apps/web/src/pages/ProtecaoCivil.tsx` | Cartão "🛰️ Focos de calor por satélite" depois dos comunicados: dias, contagem, último foco, mapa, legenda, aviso e fonte; "Atualizar" também recarrega os focos |

### Phase 3: Mobile

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/lib/maps.ts` | `MapPoint.color` (cor do marcador não selecionado) |
| Modify | `apps/mobile/components/PointsMap.tsx` | Prop `bounds` (enquadramento fixo) e cor por ponto |
| Modify | `apps/mobile/hooks/useAnpc.ts` | `useNasaFirmsHotspots(days)` |
| Modify | `apps/mobile/app/protecao-civil.tsx` | `HotspotsCard` depois dos comunicados; o refresh também recarrega os focos |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/nasaFirms.ts` | Create | Tipos e formatação dos focos |
| `packages/core/src/api/client.ts` | Modify | Rotas `/nasafirms/hotspots` e `/nasafirms/meta` |
| `packages/core/src/index.ts` | Modify | Export |
| `apps/web/src/hooks/useANPC.ts` | Modify | Hook dos focos |
| `apps/web/src/components/HotspotsMap.tsx` | Create | Mapa Leaflet dos focos |
| `apps/web/src/pages/ProtecaoCivil.tsx` | Modify | Cartão dos focos |
| `apps/mobile/lib/maps.ts` | Modify | Cor por ponto |
| `apps/mobile/components/PointsMap.tsx` | Modify | `bounds` e cor por ponto |
| `apps/mobile/hooks/useAnpc.ts` | Modify | Hook dos focos |
| `apps/mobile/app/protecao-civil.tsx` | Modify | Cartão dos focos |
| `README.md` | Modify | Fontes de dados e tabela de ecrãs |
