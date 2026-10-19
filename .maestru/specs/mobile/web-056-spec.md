---
maestru: "0.4"
type: work-spec
id: web-056-spec
title: "WEB-056 Spec — Página/ecrã Energia (MVP diário, web e mobile)"
template: implementation-plan-v1
work-item: mobile/WEB-056
owner: developer
created: 2026-10-19
---

# WEB-056 Spec — Página/ecrã Energia (MVP diário, web e mobile)

## Overview

Nova secção **Energia** no web (menu lateral) e no mobile (grelha do Início, ecrã da stack raiz). Mostra o balanço diário oficial da REN publicado pelo WEB-053 e lido pelos hooks do WEB-055 (`useEnergy`). Não aparece no Android Auto.

As duas apps têm o mesmo conteúdo:

1. Cartões do dia selecionado (por omissão, o último dia disponível).
2. Mix de produção por tecnologia.
3. Histórico de 30 dias, com o total ponderado.
4. Bloco «Qualidade dos dados».

A lógica de apresentação fica no core, para não ser duplicada.

**Decisão: gráficos mobile com `View`s, sem `react-native-svg`.** O padrão do WEB-030 (Economia) chega para barras empilhadas, com o consumo como marcador horizontal por dia. Assim não entra nenhuma dependência nativa nova: o APK não muda de módulos nativos e o `expo export` valida o bundle.

**Regras de texto:**
- Nunca «agora» nem «tempo real». O texto é sempre «Últimos dados disponíveis» e o dia civil de Lisboa.
- A quota renovável é a da **produção nacional**.
- «Renovável ÷ consumo» aparece à parte, com uma nota: pode passar de 100% e não é a quota do abastecimento, porque há importação de origem mista.
- O `energyVerdict` não é usado: com dados diários dá sempre INDETERMINADO.

## Implementation

### Phase 1: Core — apresentação

#### Step 1.1: helpers em `utils/energy.ts`

| Action | File | Details |
|--------|------|---------|
| Modify | `packages/core/src/utils/energy.ts` | `ENERGY_CLASSIFICATION_COLORS`, `ENERGY_TECHNOLOGY_COLORS`, `ENERGY_CONSUMPTION_COLOR`, `technologyColor`, `energyMix`, `energyMissingDates`, `energyQualityInfo` |

- **`energyMix`:**
  - Omite as tecnologias a zero e ordena por classificação e depois por valor.
  - Os valores negativos (a hídrica sem a bombagem) ficam na lista, mas as barras empilhadas usam só os positivos.
- **`energyQualityInfo`:** devolve período, hora de recolha (Lisboa), atraso desde o fim do último dia, `stale` (por `maxAgeMinutes`), dias em falta, dias incompletos e fonte.
- O ficheiro continua a ser TypeScript «erasable» sem imports de runtime, porque o `build-energy-db.mjs` o importa diretamente.

### Phase 2: Web

#### Step 2.1: página e navegação

| Action | File | Details |
|--------|------|---------|
| Create | `apps/web/src/pages/Energia.tsx` | Cabeçalho com «Atualizar», avisos (offline/cache, desatualizados), 5 cartões, mix (barra empilhada e legenda), `ComposedChart` do recharts (barras empilhadas e linha de consumo; clicar escolhe o dia), qualidade |
| Modify | `apps/web/src/main.tsx` | Rota `energia` |
| Modify | `apps/web/src/components/Layout.tsx` | Entrada «Energia» (`PlugZap`) no `NAV`; «REN» nas fontes do rodapé |

### Phase 3: Mobile

#### Step 3.1: ecrã e navegação

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/app/energia.tsx` | O mesmo conteúdo do web: cartões em grelha 2×N, mix (barra de `View`s em `flex` e lista), 30 barras empilhadas com `Pressable` (tocar escolhe o dia) e marcador de consumo, legenda, qualidade com link para a REN |
| Modify | `apps/mobile/app/_layout.tsx` | `Stack.Screen name="energia"` |
| Modify | `apps/mobile/lib/sections.ts` | Entrada 🔌 «Energia» depois das 5 tabs |

### Checklist

- [x] Estados: a carregar, erro sem cache, sem rede com cache (`offline`), dados desatualizados
- [x] Cada cartão mostra a unidade, o dia e a fonte
- [x] Quota da produção separada de «renovável ÷ consumo»
- [x] Total de 30 dias com a quota ponderada (`daily.total`)
- [x] `tsc -b` e `vite build` (web); typecheck (mobile); oxlint; `expo export -p android`
- [x] Render no browser (Edge headless sobre o `vite preview`) com os dados reais gerados localmente
- [x] Emulador Android (Pixel_10a, build de debug com `EXPO_PUBLIC_STATIC_DATA_URL` a apontar para o `vite preview` em `10.0.2.2`): cartões, mix, 30 dias, toque num dia e qualidade

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/utils/energy.ts` | Modify | Helpers de apresentação (cores, mix, qualidade) |
| `apps/web/src/pages/Energia.tsx` | Create | Página Energia (web) |
| `apps/web/src/main.tsx` | Modify | Rota `energia` |
| `apps/web/src/components/Layout.tsx` | Modify | Entrada no menu lateral e fonte REN no rodapé |
| `apps/mobile/app/energia.tsx` | Create | Ecrã Energia (mobile) |
| `apps/mobile/app/_layout.tsx` | Modify | Registo do ecrã na stack |
| `apps/mobile/lib/sections.ts` | Modify | Entrada na grelha do Início |
