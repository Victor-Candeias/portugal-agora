---
maestru: "0.4"
type: work-spec
id: web-047-spec
title: "WEB-047 Spec — postos EV do OpenStreetMap + Open Charge Map"
template: implementation-plan-v1
work-item: mobile/WEB-047
owner: developer
created: 2026-10-11
---

# WEB-047 Spec — postos EV do OpenStreetMap + Open Charge Map

## Overview

"Postos perto de mim" (WEB-040) passa a juntar duas fontes: o **Open Charge Map** (como até agora) e o **OpenStreetMap** (`amenity=charging_station`, via Overpass API). O pedido ao OCM deixa de estar limitado a 100 resultados.

**Decisões**
- **Duas consultas independentes** (React Query), juntadas no hook. O OCM responde em menos de 1 s e o Overpass demora entre 1 e 13 s, por isso a lista aparece logo com o OCM e completa-se quando o OSM chega. Se uma das fontes falhar, mostram-se os postos da outra com um aviso. Só há erro se as duas falharem.
- **Repetidos:** o OCM é a fonte principal, porque tem estado, tipo de acesso e verificação. Um posto do OSM é ignorado se:
  1. tiver um código Mobi.E (`ref`, ex.: `LSB-01317`; `LSB-00379;LSB-00380`) igual a um código no título de um posto do OCM (ex.: `LSB-00379/380 - Colombo`); ou
  2. um dos dois não tiver código e estiverem a menos de 25 m um do outro.

  Dois postos com códigos diferentes nunca se juntam, mesmo lado a lado (ex.: LSB-01065 e LSB-01317 estão a ~37 m). O código não é mostrado à parte: só serve para esta comparação.
- **Overpass:** `POST` com `node` e `way` (`out center tags`), `timeout:25`. Tenta os mirrors por ordem, com 20 s cada: `overpass-api.de` → `overpass.private.coffee` → `maps.mail.ru`. Todos têm CORS. O `overpass-api.de` responde 406 ao User-Agent por omissão do OkHttp, por isso o mobile envia `PortugalHoje/1.0`. O browser usa o seu.
- **Normalização OSM → `EvCharger`:**
  - tomadas a partir de `socket:<tipo>` e `socket:<tipo>:output`: `type2`, `type2_cable`, `type2_combo` (CCS2), `chademo`, `type1`, `type1_combo`, `schuko` e `tesla_supercharger`, com AC/DC pelo tipo;
  - `capacity` é o número de pontos;
  - `access` e `authentication:*`/`payment:app` dão o tipo de acesso;
  - estado "desconhecido", porque o OSM não tem estado;
  - `check_date`/`survey:date` é a data da verificação;
  - a ligação é para `openstreetmap.org/<tipo>/<id>`.
- **Potência mínima:** o OCM filtra no servidor. No OSM filtra-se no cliente pela potência máxima, e os postos sem potência ficam de fora.
- **`EvCharger.id`** passa a texto (`ocm:<ID>` / `osm:node/<id>`), com `source` (`ocm`/`osm`).
- **Limite:** `maxresults=5000` no OCM (Portugal inteiro tem ~3700 postos). Num raio de 50 km em Lisboa são 1180 postos (4,2 MB). Deixa de aparecer o texto "a mostrar os 100 mais próximos".
- **Mapa de conjunto (mobile):** os marcadores são views React, por isso o mapa mostra só os 200 mais próximos, com uma nota.
- **Atribuição:** Open Charge Map (CC BY 4.0) e © OpenStreetMap contributors (ODbL).

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/openChargeMap.ts` | `id` em texto, `source`, `maxresults` 5000 |
| Create | `packages/core/src/api/osmChargers.ts` | `createOsmChargersClient`, `normalizeOsmCharger`, `mergeEvChargers`, `OSM_ATTRIBUTION` |
| Modify | `packages/core/src/index.ts` | Export |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/lib/clients.ts` | `osmChargersClient` |
| Modify | `apps/web/src/hooks/useEv.ts` | `useEvChargers` com duas consultas e junção |
| Modify | `apps/web/src/components/EvChargers.tsx` | Avisos por fonte, ligação OCM/OSM, atribuição |

### Phase 3: Mobile

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/lib/clients.ts` | `osmChargersClient` com `User-Agent` |
| Modify | `apps/mobile/hooks/useEv.ts` | Igual ao web |
| Modify | `apps/mobile/components/EvChargers.tsx` | Igual ao web; mapa de conjunto com os 200 mais próximos |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/openChargeMap.ts` | Modify | Sem limite de 100; `id` em texto; `source` |
| `packages/core/src/api/osmChargers.ts` | Create | Cliente Overpass, normalização e junção |
| `packages/core/src/index.ts` | Modify | Export |
| `apps/web/src/lib/clients.ts` | Modify | Cliente OSM |
| `apps/web/src/hooks/useEv.ts` | Modify | Duas fontes |
| `apps/web/src/components/EvChargers.tsx` | Modify | UI |
| `apps/mobile/lib/clients.ts` | Modify | Cliente OSM |
| `apps/mobile/hooks/useEv.ts` | Modify | Duas fontes |
| `apps/mobile/components/EvChargers.tsx` | Modify | UI |
| `README.md` | Modify | Fontes de dados e ecrã EV |
