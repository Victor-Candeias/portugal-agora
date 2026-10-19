---
maestru: "0.4"
type: work-spec
id: web-060-spec
title: "WEB-060 Spec"
template: implementation-plan-v1
work-item: mobile/WEB-060
owner: developer
created: 2026-10-19
---

# WEB-060 Spec

## Overview

Fase 4 do relatório de energia: monitorização do pipeline, avisos de desatualização, reconciliação automática REN × ENTSO-E e documentação das fontes. Fecha a revisão dos critérios de aceitação da secção 15.

**Decisão — `status.json` em vez de alterar o `meta`:** o estado do pipeline vai num ficheiro próprio, `energy/status.json`, escrito em todas as execuções (mesmo quando as duas fontes falham). Assim, o contrato `EnergyDaily`/`EnergyTimeseries` fica intacto e os ficheiros republicados continuam iguais aos publicados.

**Achado — o renovável não é comparável dia a dia:** com 6 dias reais (13 a 18/10), a produção total, o não renovável e o consumo coincidem a menos de 2,6%. O renovável difere 6–10%: a REN desconta o consumo da bombagem na hídrica (18/10: hídrica −3 GWh, armazenamento 15), enquanto a ENTSO-E publica a hídrica bruta (3,8) e a turbinagem das albufeiras com bombagem à parte (9,3). A soma hídrica + armazenamento bate certo. Por isso, o `ok` usa produção, não renovável e consumo, e o renovável fica como métrica informativa. Isto corrige a leitura do WEB-051, que comparou o renovável de um só dia.

## Implementation

**Core (`utils/energy.ts`, sem imports em runtime):**
- Tipos `EnergyRunStatus`, `EnergySourceStatus`, `EnergyReconciliationMetric`/`Day` e `EnergyStatus`, mais `ENERGY_RUN_STATUS_LABELS`.
- `ENERGY_RECONCILIATION_TOLERANCE` = máx(1 GWh; 5%), porque a REN arredonda a GWh inteiros. `ENERGY_RECONCILIATION_NOTE` explica a regra do renovável.
- `energyReconciliation(days, points)`: só entram os dias REN completos cobertos por todas as horas ENTSO-E completas do dia civil de Lisboa (`lisbonDayBoundsUtc`: 23 ou 25 h nas mudanças de hora). Os dias parciais ficam de fora, porque uma hora em falta não é uma divergência das fontes.
- `energyStatusInfo(status, now)` e `formatReconciliationMetric` para as duas UIs. Uma fonte está `ok` se a recolha foi `fresh` e o último período está dentro do `maxAgeMinutes`.

**Core (`api/energy.ts`):** `energyStatusSchema` e `getStatus()` (`status.json`).

**Pipeline (`build-energy-db.mjs`):**
- `republishPublished` devolve o `daily` republicado, para a reconciliação também correr quando a REN falha.
- `buildEnergyStatus({ren, entsoe})`:
  - por fonte: estado, última tentativa, recolha dos dados em uso, último período, períodos completos e erro;
  - o erro tem os espaços normalizados e é truncado a 300 caracteres; o token já vem retirado por `sanitizeEntsoe`;
  - reconciliação dos dias comuns.
- `reportEnergyStatus`:
  - log de cada dia reconciliado;
  - no GitHub Actions, `::warning title=Energia::` para as fontes diferentes de `fresh` e para as divergências (com `%`, CR e LF codificados);
  - tabela no `GITHUB_STEP_SUMMARY`.
- A escrita do `status.json` e do resumo nunca parte o build.

**Apps:**
- `useEnergyStatus()` sem cache persistente, com `retry: shouldRetryEnergy`: com 404 ou offline o cartão não aparece.
- Cartão «Estado das fontes» no web e no mobile:
  - semáforo por fonte e aviso quando a última recolha não atualizou todas as fontes;
  - recolha, último período e atraso, períodos completos e erro;
  - tabela da reconciliação (mais recente primeiro), com os dias divergentes destacados e a nota do renovável.
- O botão «Atualizar» também relê o estado.

**Documentação:**
- README:
  - fontes REN e ENTSO-E;
  - termos de reutilização da ENTSO-E por confirmar, por isso só agregados e sem preços;
  - tabela com a frequência, a granularidade, a latência e as limitações;
  - a série horária, o `status.json` e os avisos do CI;
  - o secret `TRANSPARENCT_ENTSOE_TOKEN` (o relatório chama-lhe `ENTSOE_TOKEN`);
  - linha «🔌 Energia» nas funcionalidades.
- Comentário no `deploy.yml`.

## Impacted Files

| Action | File | Change |
|---|---|---|
| Modify | `packages/core/src/utils/energy.ts` | tipos do estado, `energyReconciliation`, `energyStatusInfo`, `formatReconciliationMetric` |
| Modify | `packages/core/src/api/energy.ts` | `energyStatusSchema`, `getStatus()` |
| Modify | `apps/web/scripts/build-energy-db.mjs` | `status.json`, `buildEnergyStatus`, `reportEnergyStatus`, daily republicado |
| Modify | `apps/web/src/hooks/useEnergy.ts`, `apps/mobile/hooks/useEnergy.ts` | `useEnergyStatus` |
| Modify | `apps/web/src/pages/Energia.tsx`, `apps/mobile/app/energia.tsx` | cartão «Estado das fontes» |
| Modify | `.github/workflows/deploy.yml` | comentário (sem mudar o comportamento) |
| Modify | `README.md` | fontes, limitações, `status.json`, secret, funcionalidades |
| Modify | `Documents/relatorio_energia_portugal.md` | critérios da secção 15 marcados como revistos |

## Validation

- **Smoke test com dados reais** (`daily.json` REN até 18/10 e `timeseries-7d.json` ENTSO-E de 12 a 19/10):
  - 6 dias reconciliados, todos `ok`: produção +0,2% a +1,6%, não renovável +0,7% a +4%, consumo −0,2% a +0,8%;
  - o `status.json` valida no `energyStatusSchema` (2,9 KB);
  - com as duas fontes `failed`, o estado continua válido.
- **Avisos:**
  - +3 GWh no não renovável de 17/10 → `ok=false` e `::warning` com `%25`;
  - uma hora em falta → o dia sai da reconciliação.
- **CI simulado** (`GITHUB_ACTIONS`/`GITHUB_STEP_SUMMARY`): tabela das fontes e da reconciliação.
- **Validação técnica:** `oxlint` sem avisos, `pnpm --filter web build` OK, `typecheck` do mobile OK.
- **Visual (Edge headless, web):**
  - cartão com a ENTSO-E «republicada» (aviso, erro e semáforo laranja) e a reconciliação dos 6 dias;
  - corrigido o «−0%» para «0%».
  - O mobile foi validado só com o typecheck, sem emulador.

**Critérios da secção 15:**
- **Fonte, unidade e período em cada métrica:**
  - cartões e mix com «último dia disponível · REN» e GWh;
  - «Agora» com observação, atualização, atraso e fonte;
  - análise com a fonte e a resolução de cada intervalo (`ENERGY_RANGE_INFO`).
- **Taxonomia validada:**
  - `ren-daily@1` (soma das tecnologias contra os totais oficiais no WEB-053) e `entsoe-psr@1` (WEB-057);
  - a reconciliação confirma a produção, o não renovável e o consumo.
- **Consumo ≠ produção:** séries e cartões separados, e a quota do consumo marcada como não sendo a quota do abastecimento.
- **24h só com intradiário real:** os intervalos de 24h e 7d ficam desativados sem a série ENTSO-E (WEB-059), e o «Agora» só existe com a série.
- **7d/30d:**
  - MW × horas completas → GWh (`toEnergyMwh`), e o 30d em GWh diários REN;
  - os totais de 30d coincidem com o REN (WEB-059).
- **SIM/NÃO:** `energyVerdict` só responde com um intervalo completo, ≤ 60 min e dentro do `maxAgeMinutes`; caso contrário, «INDETERMINADO» ou «DADOS DESATUALIZADOS».
- **Sem segredos no bundle:** o token não aparece em nenhum ficheiro do `apps/web/dist`. O Vite só expõe `VITE_` e `OPEN_CHARGE_MAP_`.
- **Último dataset válido:** a REN e a ENTSO-E republicam o que está publicado no Pages. A antiguidade aparece nos avisos de desatualização e no cartão de estado.
- **Dados fictícios:** as apps não mostram dados fictícios. O JSON do relatório (secção 8) está marcado como fictício.