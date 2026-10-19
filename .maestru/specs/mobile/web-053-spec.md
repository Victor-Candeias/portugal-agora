---
maestru: "0.4"
type: work-spec
id: web-053-spec
title: "WEB-053 Spec — Pipeline diário REN → energy.sqlite + JSON"
template: implementation-plan-v1
work-item: mobile/WEB-053
owner: developer
created: 2026-10-19
---

# WEB-053 Spec — Pipeline diário REN → energy.sqlite + JSON

## Overview

Este é o MVP diário do painel de energia. Um script Node no `build:db` recolhe da REN os últimos 30 dias publicados do balanço diário (`ElectricityConsumptionSupplyDaily`, fonte canónica escolhida no WEB-050). Classifica-os com a taxonomia do core (WEB-052) e publica no GitHub Pages ficheiros JSON leves e um `energy.sqlite`, que depois o WEB-055 e o WEB-056 consomem.

**Decisão: as apps leem só os JSON.** Os ficheiros `daily.json` (cerca de 15 KB) e `latest.json` (menos de 1 KB) seguem o contrato `EnergyDaily`/`EnergyLatest` do core. O `energy.sqlite` é publicado como arquivo e serve para consultas e para o futuro histórico (WEB-057 a WEB-060), mas as apps não o descarregam. Assim evita-se trazer 100 KB de SQLite para o mobile só para mostrar 30 linhas.

## Implementation

### Phase 1: Script de recolha e exportação

#### Step 1.1: `build-energy-db.mjs`

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/scripts/build-energy-db.mjs` | Importa `packages/core/src/utils/energy.ts` (Node type stripping). Exporta funções puras para teste: `fetchRenDay`, `parseRenDay`, `collectRenDays`, `buildEnergyDatasets`, `republishPublished` e `buildEnergy`. `main` só corre quando o script é invocado diretamente. |

- **Janela:** começa em ontem (hora de Lisboa) e recua 32 dias. Até 2 dos dias mais recentes podem dar 404, porque a REN publica o dia D em D+1. Fica-se com 30 dias a partir do mais recente publicado. Um 404 mais antigo conta como dia em falta e torna o total `incomplete`. Com menos de 7 dias válidos, o dataset não é publicado.
- **Pedidos:** 3 tentativas com backoff, timeout de 30 s, concorrência de 4 e User-Agent identificável. Um dia que continua a falhar depois das 3 tentativas (HTTP 5xx, rede, timeout ou conteúdo que não é JSON) conta como dia em falta e não anula a recolha (WEB-061). Uma resposta JSON com formato inesperado continua a anular a recolha.
- **Validação por dia:**
  - É erro se a resposta não for um array de `{type: string, daily_Accumulation: number|null}`, se vier HTML ou JSON inesperado, ou se houver tipos duplicados.
  - A soma das tecnologias é comparada com `PRODUCAO_RENOVAVEL`, `PRODUCAO_NAO_RENOVAVEL` e `PRODUCAO_TOTAL`, com tolerância de 0,5 × n + 0,5 (os valores vêm arredondados a 1 GWh). Fora da tolerância, o dia fica `incomplete`, sem veredito, e é registado um aviso.
  - Códigos desconhecidos passam a `unknown:<CODE>` (dia `incomplete`). Negativos fora da hídrica geram aviso. A hídrica negativa é normal, porque exclui a turbinagem de bombagem.
- **JSON:** os valores de cada dia vêm em GWh, como a REN os publica. O `total` sai de `aggregateEnergy` sobre todas as observações da janela, com quota ponderada pela energia e `coveragePct`, convertido para GWh. Consumo, importação e exportação só são somados se nenhum dia tiver o valor em falta. Cada ficheiro tem limite de 200 KB.
- **SQLite:** tabela `energy_observation` (esquema da secção 7 do relatório; o CHECK inclui `storage`; `energy_mwh` = GWh × 1000; `power_mw` NULL), tabela `energy_balance` (consumo, importação, exportação, saldo importador e consumo de armazenamento, em MWh) e tabela `meta` (`generated_at`, `source`, `taxonomy`). No fim corre `VACUUM` e `integrity_check`.
- **Escrita atómica:** os ficheiros são escritos em `public/data/.energy.tmp/` e depois movidos com rename para `public/data/energy/` e `public/data/energy.sqlite`.
- **Falha da REN:**
  1. A REN falha quando há menos de 7 dias válidos, por exemplo se estiver em baixo. Nesse caso, o script descarrega `energy/daily.json`, `energy/latest.json` e `energy.sqlite` de `ENERGY_FALLBACK_BASE_URL` (por omissão, o URL de dados do Pages).
  2. Valida a versão do contrato, a fonte, os dias e o cabeçalho SQLite, e republica os ficheiros.
  3. Se isto também falhar, emite um aviso, não escreve nada e sai com 0.

#### Step 1.2: Integração no build

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/package.json` | Acrescentar `&& node scripts/build-energy-db.mjs` ao fim do `build:db`. |
| Modify | `apps/web/.gitignore` | Ignorar `public/data/energy/` e `public/data/.energy.tmp/`. O `energy.sqlite` já está coberto por `public/data/*.sqlite`. |
| Modify | `README.md` | Linha da REN em «Fontes de dados» (frequência diária, latência D+1, GWh inteiros, sem licença aberta: só agregados diários com atribuição) e secção «Dados de energia». |

- [x] `node scripts/build-energy-db.mjs` contra a REN real: 30 dias (2026-09-19 a 2026-10-18), todos `complete`, `daily.json` com 15 KB, `latest.json` com 0,8 KB e `energy.sqlite` com 96 KB (240 observações e 30 balanços).
- [x] Smoke test com fetch simulado (fora do repo): erro HTTP 500, HTML, JSON inesperado, timeout, duplicados, poucos dias → republicação; fallback falhado → nada escrito e ficheiros antigos intactos; dataset publicado inválido → rejeitado; 404 recente e buraco antigo → janela correta e total `incomplete`; negativos, códigos desconhecidos, nulos e totais incoerentes → `incomplete` ou aviso; tamanho abaixo de 200 KB.
- [x] oxlint sem avisos.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/scripts/build-energy-db.mjs` | Create | Recolha, validação e exportação REN → JSON + SQLite, com fallback |
| `apps/web/package.json` | Modify | Integrar no `build:db` |
| `apps/web/.gitignore` | Modify | Não versionar os dados de energia gerados |
| `README.md` | Modify | Fonte REN, limitações e pipeline |
