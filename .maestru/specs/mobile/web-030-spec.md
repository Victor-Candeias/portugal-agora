---
maestru: "0.4"
type: work-spec
id: web-030-spec
title: "Economia: séries históricas INE/Eurostat — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/WEB-030
owner: developer
created: 2026-10-09
---

# Economia: séries históricas INE/Eurostat — Implementation Plan

## Overview

A Economia (web e mobile) só mostrava o último valor de cada indicador INE/Eurostat (`/ine/latest`). Este plano junta ao core `/ine/indicators` (indicadores e anos com dados) e `/ine/stats` (séries anuais). Em cada indicador, a lista abre um gráfico da série histórica com seletor de intervalo de anos.

**Decisões**
- **`from` obrigatório na prática:** sem `from`, `/ine/stats` só devolve dados a partir de 2000 (testado em 2026-10-09; a população tem dados desde 1960). Os hooks pedem a série a partir do `years.from` de `/ine/indicators`. Se essa lista falhar, o pedido segue sem `from` (desde 2000).
- **Um pedido por indicador:** a série completa fica em cache (24 h) e o intervalo de anos é recortado no ecrã. Mudar o intervalo não faz novo pedido.
- **Intervalos:** 10 / 20 / 30 anos e Tudo (`ineRangeOptions`, `ineRangeStart` no core). Escondem-se os intervalos que já cobrem a série toda (ex.: o desemprego só tem 17 anos). Por omissão: 20 anos, ou Tudo. No web há também os seletores De/Até (intervalo livre).
- **Formatação:** `INE_INDICATORS` ganha `short` (versão compacta para eixos: `10,75 M`, `309 mil M€`, `28,6 mil €`). `formatIneValue()` trata também os indicadores sem rótulo PT. `summarizeIneSeries()` dá o último valor, o mínimo e o máximo do intervalo.
- **Web:** `recharts` (`AreaChart`, já usado no Tempo), com linha do zero quando há valores negativos (ex.: inflação de 2009).
- **Mobile:** sem biblioteca de gráficos. Adicionar `react-native-svg` obrigava a refazer o development build, por isso o gráfico de barras é feito com `View`s (barras abaixo do zero a vermelho). Tocar numa barra mostra o ano e o valor; por omissão, mostra o último.
- **Abrir um indicador:** tocar/clicar na linha expande o painel por baixo dela; voltar a tocar fecha-o. Só fica um aberto de cada vez.

## Implementation

### Phase 1: Core

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/api/client.ts` | `IneIndicatorInfo`, `IneSeries`, `IneSeriesPoint`; `getIneIndicators()`, `getIneStats({ indicator, from, to })` |
| Modify | `packages/core/src/utils/index.ts` | `INE_INDICATORS[].short`, `formatIneValue`, `IneRange`, `ineRangeOptions`, `ineRangeStart`, `summarizeIneSeries` |

### Phase 2: Web

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/web/src/hooks/useEconomia.ts` | `useIneIndicators`, `useIneSeries` |
| Modify | `apps/web/src/pages/Economia.tsx` | Linhas dos indicadores clicáveis + `IneSeriesPanel` (intervalos, De/Até, `AreaChart`, mínimo/máximo, fonte) |

### Phase 3: Mobile e documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/hooks/useEconomia.ts` | `useIneIndicators`, `useIneSeries` |
| Modify | `apps/mobile/app/(tabs)/economia.tsx` | Linhas tocáveis + painel com `ChipRow` dos intervalos e gráfico de barras com `View`s |
| Modify | `README.md` | Rotas `/ine/indicators` e `/ine/stats`; gráfico na Economia |

## Validação

- [x] Smoke test em Node contra a API real: `/ine/indicators` (7 indicadores), `/ine/stats` com `from`/`to`, sem `from` (começa em 2000) e indicador inválido (404)
- [x] Web: `tsc -b`, `vite build` e `oxlint`
- [x] Web: `vite preview` + Chrome headless (CDP): ao abrir PIB per capita, desemprego (só 10 anos/Tudo), população e inflação aparece o gráfico; Tudo e De 2008 mudam o intervalo e o mínimo/máximo
- [x] Mobile: `tsc --noEmit` e `oxlint`

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/client.ts` | Modify | Rotas e tipos INE |
| `packages/core/src/utils/index.ts` | Modify | Formatação e intervalos |
| `apps/web/src/hooks/useEconomia.ts` | Modify | Hooks |
| `apps/web/src/pages/Economia.tsx` | Modify | Gráfico (web) |
| `apps/mobile/hooks/useEconomia.ts` | Modify | Hooks |
| `apps/mobile/app/(tabs)/economia.tsx` | Modify | Gráfico (mobile) |
| `README.md` | Modify | Documentação |
