---
maestru: "0.4"
type: work-spec
id: web-065-spec
title: "WEB-065 Spec — Cliente ANACOM no core"
template: implementation-plan-v1
work-item: mobile/WEB-065
owner: developer
created: 2026-10-20
---

# WEB-065 Spec — Cliente ANACOM no core

## Overview

Cliente ANACOM partilhado pelo web e pelo mobile, sem backend, seguindo o padrão de `packages/core/src/api/icnf.ts` (ArcGIS direto, CORS aberto). Depende das conclusões do WEB-064.

**Decisões**
- **Acesso.** `identify` no `MapServer`, com `layers=all:<ids da tecnologia>`: um pedido traz as 5 operadoras. O `query` não funciona em raster.
- **Estados.**

  | Valor da fonte | Estado |
  |---|---|
  | `NoData` / sem resultado | `unknown` |
  | Classe «Não disponível» | `not_covered`, só se o WEB-064 o confirmar; senão `unknown` |
  | Erro HTTP, timeout ou `error` ArcGIS | `source_unavailable` |
  | Restantes classes | `covered` |
- **Velocidade.** Classe potencial (`≥ 100 Mbps`), nunca um número exato. No 2G, a classe qualitativa.
- **Data.** Extraída do nome do atributo `Raster.Data da informação: AAAATn` e formatada como «n.º trimestre AAAA».
- **Ordenação.** Por classe dentro da mesma tecnologia, com os empates assinalados. Sem ranking se houver operadoras `unknown` ou `source_unavailable`.
- **5G.** `provisional: true`.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/api/anacom.ts` | Tipos `MobileOperator` (`Global PT`, `DIGI`, `MEO`, `NOS`, `Vodafone`), `MobileTechnology` (`2G`, `4G`, `5G`), `CoverageStatus`, `OperatorCoverage`, `MobileCoverageResult` |
| | | `ANACOM_COVERAGE_LAYERS` (catálogo) e `getMobileCoverageCatalog()` (valida contra `?f=pjson`) |
| | | `getMobileCoverageAtPoint(lat, lon, tech, signal?)` |
| | | `parseCoverageClass`, `parseReferenceQuarter`, `rankOperators` |
| | | `anacomExportUrl(layerId)` (modelo com `{bbox-epsg-3857}`) |
| | | `ANACOM_COVERAGE_DISCLAIMER` |
| Modify | `packages/core/src/index.ts` | Exportar `anacom` |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/anacom.ts` | Create | Cliente, catálogo e normalização |
| `packages/core/src/index.ts` | Modify | Export |
| `README.md` | Modify | Fonte de dados ANACOM (licença e atribuição) |
