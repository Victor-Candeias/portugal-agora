---
maestru: "0.4"
type: work-spec
id: web-057-spec
title: "WEB-057 Spec — Pipeline intradiário ENTSO-E"
template: implementation-plan-v1
work-item: mobile/WEB-057
owner: developer
created: 2026-10-19
---

# WEB-057 Spec — Pipeline intradiário ENTSO-E

## Overview

O pipeline de energia passa a publicar uma série **intradiária horária** da ENTSO-E (produção real por tipo, carga e trocas com Espanha, em MW), além do balanço diário da REN (WEB-053), que fica intacto. Serve o indicador «agora» e o gráfico de 24 h (WEB-058), a análise de 7 dias (WEB-059) e a monitorização e reconciliação (WEB-060). Os parâmetros, a latência e o mapeamento PSR estão em `web-051-spec`.

## Implementation

### Phase 1: Contrato e taxonomia no core

#### Step 1.1: Taxonomia `entsoe-psr@1`

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/utils/energy.ts` | `ENTSOE_PSR_TAXONOMY` (B01–B20, B25; tabela da web-051-spec); nova tecnologia `other_renewable` (B15) com label e cor; `ENTSOE_MAX_AGE_MINUTES = 180` |
| Modify | `packages/core/src/utils/energy.ts` | `EnergyDatasetMeta.freshness: 'latest_available' \| 'near_real_time'`; `EnergyIntradayLatest`, `EnergyIntradayRange`, `EnergyTimeseries.backfillUtc?` |

#### Step 1.2: Schemas e cliente

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/energy.ts` | `energyIntradayLatestSchema` e `energyTimeseriesSchema`; `freshness` passa a enum; `getIntradayLatest()`, `getIntradayTimeseries('24h'\|'7d')`; `loadEnergyIntradayCached` (cache de 10 min) |

O `latest.json` e o `daily.json` (REN) não mudam: as APKs já instaladas continuam a validá-los.

- [x] `tsc -b` no web e `tsc --noEmit` no mobile sem erros

### Phase 2: Recolha ENTSO-E

#### Step 2.1: Módulo `energy-entsoe.mjs`

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/scripts/energy-entsoe.mjs` | Pedidos, parse XML (regex, sem dependências), expansão A01/A03, médias horárias UTC, intervalos, merge e datasets |

**Pedidos:**
- consultas A75/A16, A65/A16 e A11 nos dois sentidos com Espanha;
- token no cabeçalho `SECURITY_TOKEN`; um pedido de cada vez, porque em paralelo a API responde **599**;
- timeout de 180 s e até 3 tentativas;
- códigos de resposta:
  - **999** («No matching data»): repete, porque aparece por instantes com a API sob carga; se persistir, devolve `null`;
  - **401/403**: `EntsoeAuthError`, sem repetir;
  - **429/5xx/599** e erros de rede: repetem;
- orçamento total de 10 min: depois disso a carga e os fluxos são saltados, com aviso.

**Expansão e agregação:**
- **A03:** cada ponto vale até ao ponto seguinte; o último vale até ao fim do `Period`.
- **A01:** cada ponto vale uma resolução.
- Os segmentos são somados por hora UTC, ponderados pela duração, e só contam as horas cobertas a 100%. PT15M, PT30M e PT60M são tratados da mesma forma.
- Uma hora com mais de 60 min de dados (sobreposição) é descartada.

**Produção:**
- Só entram as séries `inBiddingZone_Domain = 10YPT-REN------W`.
- As séries `outBiddingZone_Domain` (bombagem e consumos das unidades) são ignoradas.

**Horas:**

| Situação | Resultado |
|----------|-----------|
| Todos os PSR esperados (os que aparecem na janela), sem desconhecidos ≠ 0, produção > 0 | `complete` |
| Parte dos PSR em falta | `incomplete`, com `coveragePct` = PSR presentes / esperados |
| Nenhum PSR | omitida (nunca zero) |

Carga e fluxos em falta ficam a `null`.

**Validação:**
- pelo menos 24 horas e pelo menos 1 hora completa;
- caso contrário a recolha falha e o pipeline republica.

#### Step 2.2: Integração no pipeline

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/scripts/build-energy-db.mjs` | `buildEnergy` = `buildRenEnergy` (sem alterações) + `buildEntsoeEnergy`; o resultado é `{ ren, entsoe }` |
| Modify | `apps/web/package.json` | `build:energy` e `build:db` com `node --env-file-if-exists=.env` (token local em `apps/web/.env`) |

**Execuções:**
- **Incremental (horária):** pede só as **últimas 48 h** (8 a 46 s por pedido) e junta-as aos pontos de `timeseries-7d.json` já publicados. As horas novas substituem as antigas, o que cobre as revisões.
- **Backfill:** **8 dias** (janela de 7 d mais margem). Corre quando não há série publicada ou quando o `backfillUtc` publicado tem mais de 20 h. É a reconciliação diária das revisões.

**Ficheiros publicados** (em `energy/`, escrita atómica, limite de 200 KB cada):

| Ficheiro | Conteúdo | Tamanho |
|----------|----------|---------|
| `intraday-latest.json` | Última hora `complete` | 0,9 KB |
| `timeseries-24h.json` | Horas das últimas 24 h, a contar da última hora com dados | 12 KB |
| `timeseries-7d.json` | Horas dos últimos 7 dias, com `backfillUtc` | 82 KB |

Metadados: `source: ENTSOE`, `taxonomy: entsoe-psr@1`, `freshness: near_real_time`, `maxAgeMinutes: 180`.

**Falhas:**
- Token em falta ou recusado, ou recolha falhada: republica os três ficheiros publicados no Pages.
- Sem nada publicado: não escreve nada.
- O REN nunca é afetado.
- O token é retirado das mensagens (`***`).

- [x] Smoke test com os XML reais da sonda e com XML sintético (A03 PT15M, PSR desconhecido, consumo `out`, 401, 999 transitório, 503 com 3 tentativas, token fora do URL, merge, backfill)
- [x] Execução real: backfill de 8 d em 38 s (192 h completas), incremental de 2 d em 25 s, token inválido e sem token republicam
- [x] Os 3 ficheiros validam com os schemas zod do core

### Phase 3: Workflow

| Action | File | Details |
|--------|------|---------|
| Modify | `.github/workflows/deploy.yml` | Cron `20 * * * *` (horário) além do `0 13 * * *`; env `TRANSPARENCT_ENTSOE_TOKEN` do secret no passo `build:db` |
| Modify | `.env.example` | `TRANSPARENCT_ENTSOE_TOKEN` (sem valor real) |

**Execução horária:**
- descarrega os `carris.sqlite`, `metro-porto.sqlite` e `public-services.sqlite` publicados (com verificação do cabeçalho SQLite) e só corre `build:energy`;
- se um download falhar, corre `build:db` completo.

O secret tem o mesmo nome do `.env` (convenção do repositório), em vez do `ENTSOE_TOKEN` do relatório.

- [x] O Vite só expõe `VITE_`/`OPEN_CHARGE_MAP_`: o token não aparece no `dist/`

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/utils/energy.ts` | Modify | Taxonomia `entsoe-psr@1`, `other_renewable`, max age, tipos intradiários |
| `packages/core/src/api/energy.ts` | Modify | Schemas e cliente intradiário, cache |
| `apps/web/scripts/energy-entsoe.mjs` | Create | Recolha, parse e agregação ENTSO-E |
| `apps/web/scripts/build-energy-db.mjs` | Modify | Integração (incremental/backfill/republicação) |
| `apps/web/package.json` | Modify | `build:energy`, `--env-file-if-exists` |
| `.github/workflows/deploy.yml` | Modify | Secret e cron horário |
| `.env.example` | Modify | Variável do token |
