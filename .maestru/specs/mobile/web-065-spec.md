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
| Modify | `packages/core/src/api/openMeteo.ts` | `searchPtPlaces` (pesquisa de localidade para o WEB-066) |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/anacom.ts` | Create | Cliente, catálogo e normalização |
| `packages/core/src/index.ts` | Modify | Export |
| `packages/core/src/api/openMeteo.ts` | Modify | `searchPtPlaces` |
| `README.md` | Modify | Fonte de dados ANACOM (licença e atribuição) |

## Notas de implementação (2026-10-20)

- **«Global PT».** É o agregado nacional, não uma operadora (WEB-064). Vem em `MobileCoverageResult.aggregate` e fica fora de `operators` e do ranking. `MobileOperator` = `DIGI`, `MEO`, `NOS`, `Vodafone`; `CoverageSubject` acrescenta `Global PT`.
- **Estados.** O valor `0` («Não disponível») dá `not_covered`. `NoData`, valores inesperados e pontos fora de `ANACOM_COVERAGE_EXTENT` dão `unknown`; nestes pontos não se faz o pedido e `outsideCoverageArea` fica `true`.
- **Classes.** O 4G e o 5G usam limiares, e as classes vêm com a cor da legenda oficial (`COVERAGE_LEGEND`).
- **Ranking.** `rankOperators` dá a posição com empates (1, 1, 1, 4). Inclui as operadoras `not_covered` e devolve `null` se houver `unknown` ou `source_unavailable`.
- **Pedidos.** Timeout de 15 s, combinado com o `signal` de quem chama, sem `AbortSignal.any`, por compatibilidade com o React Native.
  - Erros HTTP, timeouts e erros do ArcGIS dão `source_unavailable`.
  - O cancelamento pedido por quem chama é propagado.
- **Coordenadas.** Arredondadas a 5 casas decimais e nunca registadas em logs.
- **Catálogo.** `getMobileCoverageCatalog()` confirma o id, o prefixo do nome (`2G`/`4G`/`5G`) e o grupo pai de cada camada.
- **Pesquisa de localidade.** `searchPtPlaces(query)` em `openMeteo.ts` (geocoding do Open-Meteo, `countryCode=PT`), para o WEB-066.
- **Validação.**
  - Testes ao vivo: Lisboa, Montesinho, Corvo, oceano, Madrid, fonte inexistente, timeout, cancelamento e catálogo.
  - `tsc -b` no web e `tsc --noEmit` no mobile sem erros.
