---
maestru: "0.4"
type: work-spec
id: web-067-spec
title: "WEB-067 Spec — Indicadores de urgência hospitalar do SNS (web)"
template: implementation-plan-v1
work-item: mobile/WEB-067
owner: developer
created: 2026-10-22
---

# WEB-067 Spec — Indicadores de urgência hospitalar do SNS (web)

## Overview

Indicadores diários agregados por região do dataset `atividade-sindrome-gripal-csh` (Portal da Transparência do SNS, ACSS), recolhidos no build e publicados no GitHub Pages como `data/sns/*.json`, com uma página web `/sns-urgencias`. O core fica reutilizável pelo mobile (MOB-021).

**Decisões**
- **Contrato publicado (versão 1).** Em `public/data/sns/`:
  - `series.json`: série compacta por `(ars, indicador)`, com `unidade` e `points: [periodo, valor][]`. 90 dias × 21 séries ≈ 40 KB, contra ≈ 360 KB do formato da API. O core expande-a para `SnsEmergencyObservation[]`.
  - `metadata.json`: indicadores e regiões (vindos dos dados), unidades, regiões com dados por indicador, última observação por indicador e global, `sourceLastModified`/`sourceDataProcessed`, fonte, URLs e condições de reutilização.
  - `status.json`: `status` (`fresh`/`republished`/`failed`), `lastSuccessfulSyncAt`, `lastAttemptAt`, `latestPeriod`, `possiblyStale` e `error`.
- **Chave lógica.** `(sourceDataset, ars, indicador, periodo)`; o `id` da API não é usado (tem nomes antigos dos indicadores). Registos duplicados ficam com o último e são contados como aviso.
- **`periodo`.** Data civil `YYYY-MM-DD`, tratada como texto (aritmética de dias em UTC, sem fusos). Valores em falta, não numéricos ou datas inválidas são rejeitados (nunca zero).
- **Lacunas.** `snsSeriesWithGaps` devolve um ponto por dia do intervalo, com `valor: null` nos dias sem registo. O gráfico não liga as lacunas (`connectNulls={false}`) e a tabela mostra «sem dados».
- **Intervalo.** 7, 30 ou 90 dias contados a partir da última observação do dataset (não de hoje). O atraso é um estado separado.
- **Estados.** Atraso se a última observação tiver mais de 4 dias (o normal é 2). «Possivelmente desatualizado» se `status` for `republished` ou `failed`, ou se a última sincronização tiver mais de 36 h. «Fonte indisponível» se o `series.json` não carregar.
- **Coletor.** `scripts/build-sns-urgencias.mjs` faz um pedido a `/exports/json` com `select` e `where periodo >= date'…'` (90 dias), e outro aos metadados do dataset (`modified`, `data_processed`). Timeout de 30 s; até 3 tentativas só em falhas transitórias (rede, timeout, 5xx e 429, respeitando `Retry-After` até 60 s). Esquema validado: campos obrigatórios; mais de 5% de registos inválidos, nenhum registo ou menos de 7 dias distintos anulam a recolha. Escrita atómica (pasta temporária e `rename`).
- **Falhas.** Republica `series.json` e `metadata.json` do Pages (`SNS_FALLBACK_BASE_URL`) com `status: 'republished'`, `possiblyStale: true` e o `lastSuccessfulSyncAt` anterior. Sem nada publicado, escreve só o `status.json` com `failed`. Nunca sai com erro, para não partir o `build:db`.
- **Deploy.** `build:db` inclui `build:sns`. Na execução horária, `SNS_REUSE_PUBLISHED=true` republica os três ficheiros tal como estão; se não conseguir, faz a recolha completa.
- **Testes.** `node --test` (type stripping do Node ≥ 22.18) em `packages/core/test/`, fora de `src/` para não entrarem no `tsc` da web e do mobile.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Create | `packages/core/src/utils/snsUrgencias.ts` | Tipos do contrato, `SnsEmergencyObservation`, constantes (dataset, URLs, avisos, atribuição, informação dos indicadores), normalização, expansão/compactação da série, `filterSnsSeries`, `snsLatestObservation`, `snsSeriesWithGaps`, `snsDataState`. Sem imports relativos (o coletor importa-o diretamente em Node) |
| Create | `packages/core/src/api/snsUrgencias.ts` | Esquemas zod, `SnsUrgenciasDataError`, `shouldRetrySnsUrgencias`, `createSnsUrgenciasClient({ baseUrl, fetch? })` com `getSeries`, `getObservations`, `getMetadata`, `getStatus` |
| Modify | `packages/core/src/index.ts` | Exportar os dois módulos |
| Create | `packages/core/test/snsUrgencias.test.ts` | Normalização, lacunas, última observação, filtro e estados |
| Modify | `packages/core/package.json` | Script `test` |

### Phase 2: Coletor e deploy

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/scripts/build-sns-urgencias.mjs` | Recolha, validação, escrita atómica, republicação e reutilização |
| Modify | `apps/web/package.json` | `build:sns` e `build:db` |
| Modify | `apps/web/.gitignore` | `public/data/sns/` |
| Modify | `.github/workflows/deploy.yml` | Recolha diária, reutilização na horária |

### Phase 3: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/lib/clients.ts` | `snsUrgenciasClient` |
| Create | `apps/web/src/hooks/useSnsUrgencias.ts` | React Query para série, metadados e estado |
| Create | `apps/web/src/pages/SnsUrgencias.tsx` | Avisos, filtros, cartão, gráfico, tabela, estados, metodologia e atribuição |
| Modify | `apps/web/src/main.tsx` | Rota `sns-urgencias` |
| Modify | `apps/web/src/components/Layout.tsx` | Entrada no menu e «SNS» no rodapé |
| Modify | `README.md` | Fonte de dados e secção `data/sns/*.json` |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/utils/snsUrgencias.ts` | Create | Contrato e funções puras |
| `packages/core/src/api/snsUrgencias.ts` | Create | Cliente dos JSON publicados |
| `packages/core/src/index.ts` | Modify | Exports |
| `packages/core/test/snsUrgencias.test.ts` | Create | Testes |
| `packages/core/package.json` | Modify | Script `test` |
| `apps/web/scripts/build-sns-urgencias.mjs` | Create | Coletor |
| `apps/web/package.json` | Modify | Scripts |
| `apps/web/.gitignore` | Modify | Dados gerados |
| `.github/workflows/deploy.yml` | Modify | Deploy |
| `apps/web/src/lib/clients.ts` | Modify | Cliente |
| `apps/web/src/hooks/useSnsUrgencias.ts` | Create | Hooks |
| `apps/web/src/pages/SnsUrgencias.tsx` | Create | Página |
| `apps/web/src/main.tsx` | Modify | Rota |
| `apps/web/src/components/Layout.tsx` | Modify | Menu |
| `README.md` | Modify | Documentação |
## Implementation Notes (2026-10-22)

- Primeira recolha real: 1848 observações (4 indicadores × 6 regiões; o Algarve só tem episódios), de 2026-07-25 a 2026-10-20; `series.json` ~43 KB, `metadata.json` ~2,5 KB, `status.json` `fresh`.
- Testado com `fetch` simulado: API em baixo + publicado → `republished` (mantém `lastSuccessfulSyncAt`); API em baixo sem publicado → `failed` só com `status.json`; `SNS_REUSE_PUBLISHED=true` copia os 3 ficheiros tal como estão e, sem publicado, recolhe de novo; esquema inválido → `failed`.
- `snsRangeBounds(toDate, days, minDate?)` ganhou `minDate`: o intervalo de 90 dias não começa antes do primeiro dia recolhido, para não mostrar como lacunas dias que nunca foram pedidos.
- `normalizeSnsEmergencyRecords` usa `'reason' in result` em vez de `!result.ok`: o `tsconfig` da web não estreitava a união discriminada.
- Testes do core com `node --test test/*.test.ts` (type stripping do Node ≥ 22.18); ficam fora de `src/` porque o `tsc` da web inclui `packages/core/src`. `utils/snsUrgencias.ts` não tem imports relativos para poder ser importado pelo coletor em Node.
- A página usa o `HashRouter` existente (`#/sns-urgencias`). Verificada no `vite preview` com Playwright: avisos e links `tel:`, cartões com «sem dados» no Algarve, gráfico com lacunas, tabela com caption, menu e rodapé, sem erros na consola.
- Sem atalho no Dashboard nem linha na tabela de ecrãs do README (é «web e mobile»; o mobile vem no MOB-021).
- `maestru sql UPDATE`/`INSERT INTO work_item_specs` falham no Windows (caminho resolvido como `C:\.maestru\...`); o estado e a ligação da spec foram editados à mão.
