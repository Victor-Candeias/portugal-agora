---
maestru: "0.4"
type: work-spec
id: web-064-spec
title: "WEB-064 Spec — Validação da fonte ANACOM"
template: implementation-plan-v1
work-item: mobile/WEB-064
owner: developer
created: 2026-10-20
---

# WEB-064 Spec — Validação da fonte ANACOM

## Overview

Validar a fonte ANACOM `CoberturaQoS_Pub` (https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer) antes de escrever código no core.

**Testes feitos a 2026-10-20 (ponto de partida)**
- **Serviço.** Capacidades `Query,Map,Data`, coordenadas WGS84 (4326), `maxRecordCount` 4000, fonte «ANACOM».
- **Camadas da rede móvel** (grupo 162). São do tipo `Raster Layer`, com os campos `OBJECTID` e `Value`:
  - Global PT 163 → 164 (2G), 167 (4G), 168 (5G);
  - DIGI 169 → 170, 171, 172;
  - MEO 173 → 174, 176, 177;
  - NOS 178 → 179, 180, 181;
  - Vodafone 182 → 183, 186, 187.
- **`query` por ponto.** Erro 400 nas camadas raster.
- **`identify`.** Funciona. Em Lisboa (38.72, -9.14), com `tolerance=1`, `mapExtent=-9.2,38.7,-9.1,38.75` e `imageDisplay=800,600,96`, devolveu `UniqueValue.Pixel Value` (ex.: `1000`, `300`, `100`) e o atributo `Raster.Data da informação: 2026T2`. No oceano (-12, 38.72) devolveu `NoData`.
- **Legenda.**
  - 4G e 5G: ≥1000, ≥300, ≥100, ≥30, ≥2, >0 Mbps, «Não disponível»;
  - 2G: Muito Boa, Boa, Aceitável, Limitada, «Não disponível»;
  - o 5G está marcado como «dados provisórios».
- **`export`.** `f=image`, `format=png32`, `transparent=true`, `layers=show:<id>`, `imageSR=3857`: HTTP 200 `image/png`.
- **WMS.** `GetCapabilities` devolve 400.
- **CORS.** `Access-Control-Allow-Origin` reflete a origem; não é preciso proxy.

**Por confirmar**
- O valor de cada classe, sobretudo «> 0 Mbps», «Não disponível» e as classes do 2G.
- Que a `tolerance` não mistura células vizinhas.
- A semântica de `NoData` e de «Não disponível».
- A licença e a atribuição.

## Implementation

### Phase 1: Metadados e legenda

| Action | File | Details |
|--------|------|---------|
| Inspect | `MapServer?f=pjson`, `/{id}?f=pjson`, `/legend?f=pjson` | Guardar o `drawingInfo.renderer` (`uniqueValueInfos`) de uma camada 2G, 4G e 5G e preencher a tabela valor → classe |

### Phase 2: Pontos de teste

| Action | File | Details |
|--------|------|---------|
| Validate | `identify` vs. geo.anacom.pt | 10 a 20 pontos: Lisboa, Porto, interior (Trás-os-Montes, Alentejo), fronteira de célula, Açores, Madeira, oceano e Espanha. Registar o resultado esperado de cada um |
| Tune | parâmetros `identify` | `tolerance` 0 ou 1 e `mapExtent` pequeno à volta do ponto; documentar a configuração final |

### Phase 3: Licença

| Action | File | Details |
|--------|------|---------|
| Review | termos ANACOM / dados.gov.pt | Reutilização dos dados e das imagens `export`, atribuição e cache. Decisão: avançar ou não com o mapa |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `.maestru/specs/mobile/web-064-spec.md` | Modify | Registar a tabela de classes, os pontos de teste e a decisão sobre a licença |
