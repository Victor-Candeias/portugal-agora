---
maestru: "0.4"
type: work-spec
id: web-059-spec
title: "WEB-059 Spec — análise 24h/7d/30d e CSV"
template: implementation-plan-v1
work-item: mobile/WEB-059
owner: developer
created: 2026-10-19
---

# WEB-059 Spec — análise 24h/7d/30d e CSV

## Overview

Cartão «Análise» no web e no mobile com seletor de intervalo:

| Intervalo | Fonte | Granularidade |
|---|---|---|
| 24 horas | ENTSO-E, `timeseries-24h.json` | MW horário |
| 7 dias | ENTSO-E, `timeseries-7d.json`, carregado só quando é escolhido | MW horário |
| 30 dias | REN, `daily.json` | GWh por dia civil de Lisboa |

O cartão mostra os totais do período, a produção por classificação, o consumo face à produção, o saldo de trocas e permite exportar em CSV. Cada gráfico usa uma única unidade (MW **ou** GWh) e a origem dos dados está sempre identificada.

## Implementation

### Core (`packages/core/src/utils/energy.ts`)

- `energyRangeSummary(points)`: totais em GWh com `toEnergyMwh`, que converte MW × duração; MWh e GWh já são energia.
  - Entram apenas os intervalos **completos**, a mesma base para produção, consumo e trocas.
  - A quota renovável é **ponderada pela energia**.
  - Conta os intervalos em que a renovável supera a não renovável e devolve o saldo importador/exportador.
  - `balanceMissing` conta os intervalos completos sem consumo ou sem trocas.
- `energyCsv(points, meta)`: separador `;` e vírgula decimal (Excel pt-PT), uma linha por intervalo.
  - Colunas: UTC, hora de Lisboa, resolução, unidade, qualidade, cobertura, classificações, consumo e trocas, uma coluna `tec_*` por tecnologia e a fonte.
  - Os valores em falta ficam vazios, nunca zero.
- `energyCsvFileName`, `ENERGY_RANGE_LABELS`, `ENERGY_RANGE_INFO` (fonte e unidade por intervalo) e `ENERGY_NOT_INCLUDED_NOTE`.

### Web (`Energia.tsx`)

- O `AnalysisCard` substitui o gráfico de 24 h do WEB-058.
  - Abre em 24 h; abre em 30 d se não houver série horária.
  - Os separadores 24h/7d ficam desativados quando não há série ENTSO-E.
- Dois gráficos recharts:
  - produção (renovável e não renovável em `Area`, armazenamento em `Line`);
  - consumo face à produção, em `Line`, com o saldo em `Bar` (positivo = importador, negativo = exportador).
- Os intervalos incompletos ficam em branco.
- CSV: `Blob` com BOM UTF-8 e `<a download>`.

### Mobile (`app/energia.tsx`)

- Mesmo cartão, com gráficos feitos com `View`:
  - 24 h: barras lado a lado;
  - 7 d (168 horas) e 30 d: barras empilhadas, identificadas como tal;
  - saldo de trocas em barras centradas no zero (▲ importador, ▼ exportador).
- O `Total` passou a aceitar `style` para a grelha 2×4.
- CSV: `Share.share({ title, message })` do React Native.
  - **Avaliação da dependência:** partilhar um *ficheiro* no Android obrigaria a juntar `expo-sharing`, um módulo nativo novo que exige refazer a APK. A partilha como texto não precisa de dependências; o CSV de 7 dias tem cerca de 45 KB, bem abaixo do limite do *intent*.

### Âmbito excluído (documentado na UI)

- **Preços de mercado:** os termos de reutilização da ENTSO-E não foram confirmados (WEB-051) e o endpoint REN `ElectricityMarketPricesDaily` responde 404.
- **Potência instalada e comparações anuais:** não foram validadas nem estão no pipeline.

### Desempenho

- A série de 7 dias (~82 KB) só é pedida quando se escolhe 7d e fica em cache 10 min.
- O gráfico de 7 dias no mobile usa cerca de 170 colunas `View` empilhadas.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/utils/energy.ts` | modify | `energyRangeSummary`, `energyCsv`, `energyCsvFileName`, labels e nota |
| `apps/web/src/pages/Energia.tsx` | modify | `AnalysisCard` / `AnalysisBody` (recharts), download do CSV |
| `apps/mobile/app/energia.tsx` | modify | `AnalysisCard` / `AnalysisBody` (com `View`), partilha do CSV |

## Validation

- `oxlint`, build web (`tsc -b` + vite) e typecheck mobile: OK.
- Teste com dados reais:
  - os totais de 30 d coincidem com o `total` do REN (2201 / 581 GWh, 70,7%, consumo 4272);
  - o dia 18/10 da ENTSO-E dá 106,8 / 16,1 / 122 GWh, igual à reconciliação do WEB-051;
  - CSV de 24 h com 24 linhas e cerca de 6,5 KB.
- Screenshots no `vite dev` (Edge headless) dos 3 intervalos.
- O mobile não foi verificado no emulador; foi validado só com o typecheck.