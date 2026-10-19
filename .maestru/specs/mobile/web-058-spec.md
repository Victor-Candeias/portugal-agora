---
maestru: "0.4"
type: work-spec
id: web-058-spec
title: "WEB-058 Spec — indicador agora + gráfico 24h"
template: implementation-plan-v1
work-item: mobile/WEB-058
owner: developer
created: 2026-10-19
---

# WEB-058 Spec — indicador agora + gráfico 24h

## Overview

Indicador «Portugal está a produzir mais eletricidade renovável do que não renovável agora?» e gráfico de 24 h, no web e no mobile, a partir da série horária ENTSO-E publicada pelo WEB-057 (`energy/timeseries-24h.json`, MW, 60 min). O balanço diário REN (WEB-056) não muda e continua a funcionar sem o intradiário (404, falha ou offline sem cache).

## Implementation

### Core (`packages/core/src/utils/energy.ts`)

- `energyNowInfo(dataset, now)` escolhe a última hora **completa** (se não houver nenhuma, a última com dados) e devolve:
  - o veredicto `energyVerdict`;
  - a observação `dd/mm HH:mm–HH:mm` (Lisboa);
  - `updatedAt` (`fetchedAtUtc`, `HH:mm`);
  - o atraso desde o fim do intervalo;
  - o `label`: «Agora» só com `near_real_time` e dentro do `maxAgeMinutes` (180); caso contrário, «Últimos dados disponíveis».
- Sem pontos, devolve `INDETERMINADO`.
- `ENERGY_VERDICT_STYLES`: cor, fundo e explicação de cada veredicto. `ENERGY_NOW_QUESTION`.
- `energyHourlySlots(points)`: eixo contínuo à resolução da série. As horas em falta ficam `point: null` (lacuna, nunca zero).
- `formatLisbonTime`.

### Hooks

- `useEnergyIntraday(range)`, no web e no mobile:
  - usa `loadEnergyIntradayCached`, com cache de 10 min (localStorage / kv-store);
  - `retry` com `shouldRetryEnergy`;
  - no web, `refetchInterval` de 10 min.

### UI

- **Cartão «Agora»**:
  - pergunta e veredicto em destaque;
  - renovável, não renovável, armazenamento, quota da produção e consumo (MW);
  - linha «Observação … · Atualizado às HH:mm · Atraso N min · Fonte»;
  - aviso «Sem ligação» quando a cópia vem da cache.
- **Gráfico de 24 h (MW)**:
  - séries **separadas, não empilhadas**: renovável, não renovável, armazenamento e consumo;
  - as horas incompletas e as que faltam ficam em branco;
  - no web usa recharts (`Area`/`Line`); no mobile, barras lado a lado feitas com `View`, sem biblioteca nova.
- **Armazenamento visível**: a bombagem pode passar os 2 GW à noite (a 19/10 às 20 h estava nos 2348 MW). Sem este valor, «SIM» com uma quota de 39% pareceria contraditório.
- **Sem série publicada**: mostra o aviso «não é possível dizer o que acontece agora» e o painel diário continua visível.
- **Botão Atualizar**: relê os artefactos diário e intradiário.
- Não entra no Android Auto.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/utils/energy.ts` | modify | `energyNowInfo`, `energyHourlySlots`, estilos dos veredictos, `formatLisbonTime` |
| `apps/web/src/hooks/useEnergy.ts` | modify | `useEnergyIntraday` |
| `apps/mobile/hooks/useEnergy.ts` | modify | `useEnergyIntraday` |
| `apps/web/src/pages/Energia.tsx` | modify | `NowCard` e `IntradayCard` (recharts), subtítulo |
| `apps/mobile/app/energia.tsx` | modify | `NowCard` e `IntradayCard` (com `View`), subtítulo |

## Validation

- `oxlint`, `pnpm build` (web, `tsc -b`) e `pnpm typecheck` (mobile): OK.
- Teste rápido com dados reais (19/10 19:00Z):
  - 30 min depois: `SIM` / «Agora» / atraso de 30 min;
  - 5 h depois: `DADOS DESATUALIZADOS` / «Últimos dados disponíveis»;
  - hora removida: o eixo continua com 24 posições e 1 lacuna;
  - sem pontos: `INDETERMINADO`.
- Teste visual no `vite dev` com Edge headless: cartão e gráfico com os JSON reais. Sem os ficheiros intradiários aparece o aviso e o painel diário fica intacto.