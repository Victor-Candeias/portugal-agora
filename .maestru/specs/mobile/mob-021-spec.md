---
maestru: "0.4"
type: work-spec
id: mob-021-spec
title: "MOB-021 Spec — Urgências do SNS no mobile"
template: implementation-plan-v1
work-item: mobile/MOB-021
owner: developer
created: 2026-10-23
---

# MOB-021 Spec — Urgências do SNS no mobile

## Overview

Ecrã mobile «🏥 Urgências do SNS» (`/sns-urgencias`), versão nativa da página web do WEB-067. Lê os JSON publicados no Pages (`data/sns/series.json`, `metadata.json`, `status.json`) com o `createSnsUrgenciasClient` do core e `STATIC_DATA_BASE_URL`. Toda a lógica (expansão da série, lacunas, última observação, estados, formatação, avisos, atribuição) vem do core; o ecrã só apresenta. Expo 57: ler a documentação v57 antes de programar (`apps/mobile/AGENTS.md`). Só build local, sem serviços online.

**Decisões**
- **Gráfico.** `react-native-svg` (biblioteca do SDK 57, `expo install`), com um componente `SnsLineChart` próprio: um `Path` por troço contínuo, sem ligar as lacunas (equivalente ao `connectNulls={false}` do web), pontos isolados desenhados como círculos, grelha com 3 valores no eixo Y e datas de início/meio/fim no eixo X. Alternativas recusadas: `react-native-gifted-charts` (mais dependências e sem controlo explícito das lacunas) e `victory-native` (exige Skia e Reanimated).
- **Dados.** Hooks iguais aos do web (React Query, `retry: shouldRetrySnsUrgencias`, `staleTime` 30 min). Sem cache persistente: os dados são estatísticos e o ecrã mostra «fonte indisponível» com «Tentar de novo» quando o `series.json` ou o `metadata.json` não carregam; sem `status.json` não mostra a sincronização.
- **Filtros.** Chips (`ChipRow` sem «Todos») para região, indicador e intervalo (7, 30 ou 90 dias), em vez dos `<select>` do web. Região por omissão «Portugal Continental».
- **Cartões.** Um cartão por indicador com a última observação da região; sem dados (Algarve) mostra «sem dados» e «Sem dados publicados para …». O «Tempo médio» tem o aviso `SNS_URGENCIAS_WAIT_TIME_WARNING` destacado.
- **Lista de valores.** Botão «Ver os valores» que expande a lista dia a dia (mais recente primeiro), com «sem dados» nas lacunas.
- **Estados.** Última observação (com «há N dias») e última sincronização em separado; avisos de atraso (> 4 dias) e «possivelmente desatualizado» do `snsDataState`.
- **Avisos.** `SNS_URGENCIAS_NOT_REAL_TIME` e `SNS_URGENCIAS_EMERGENCY_NOTICE` no topo, com botões «Ligar 112» e «Ligar SNS 24» que abrem `tel:` (`Linking.openURL`).
- **Fonte.** Nota metodológica (definição e unidade de cada indicador), atribuição, condições de reutilização (Lei 26/2016), transformações e links para o dataset e o portal.

## Implementation

### Phase 1: Mobile

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/package.json` | `react-native-svg` via `expo install` |
| Modify | `apps/mobile/lib/clients.ts` | `snsUrgenciasClient = createSnsUrgenciasClient({ baseUrl: STATIC_DATA_BASE_URL })` |
| Create | `apps/mobile/hooks/useSnsUrgencias.ts` | `useSnsUrgenciasObservations`, `useSnsUrgenciasMetadata`, `useSnsUrgenciasStatus` |
| Create | `apps/mobile/components/SnsLineChart.tsx` | Gráfico de linhas SVG com lacunas |
| Create | `apps/mobile/app/sns-urgencias.tsx` | Ecrã: avisos, estados, filtros, cartões, gráfico, lista, metodologia e fonte |
| Modify | `apps/mobile/app/_layout.tsx` | `Stack.Screen` `sns-urgencias` («Urgências do SNS») |
| Modify | `apps/mobile/lib/sections.ts` | `{ href: '/sns-urgencias', title: 'Urgências SNS', emoji: '🚑', … }` |
| Modify | `README.md` | Tabela de ecrãs |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/package.json` | Modify | Dependência do gráfico |
| `pnpm-lock.yaml` | Modify | Lockfile |
| `apps/mobile/lib/clients.ts` | Modify | Cliente |
| `apps/mobile/hooks/useSnsUrgencias.ts` | Create | Hooks |
| `apps/mobile/components/SnsLineChart.tsx` | Create | Gráfico |
| `apps/mobile/app/sns-urgencias.tsx` | Create | Ecrã |
| `apps/mobile/app/_layout.tsx` | Modify | Rota |
| `apps/mobile/lib/sections.ts` | Modify | Secção no menu |
| `README.md` | Modify | Tabela de ecrãs |

## Implementation Notes (2026-10-23)

- Gráfico: `react-native-svg@15.15.4` (versão indicada para o SDK 57) com o componente próprio `SnsLineChart`. Um `Path` por troço contínuo e lacunas sombreadas, nunca ligadas.
- Secção 🚑 «Urgências SNS» na grelha inicial, a seguir a Hospitais. Rota `sns-urgencias` com o título «Urgências do SNS».
- `pnpm --filter mobile typecheck` e `lint`: sem erros.
- APK de release 1.0.11 (versionCode 12) assinado com a keystore de release (`apksigner verify` OK).
- Verificação manual na AVD FiaTipo3 (Android 15), porque o Pixel_10a está bloqueado por PIN. Deep link: `portugal-hoje://sns-urgencias`.
  - Avisos «não é tempo real» e 112/SNS 24. O botão «Ligar 112» abre o marcador.
  - Última observação 20/10/2026 e sincronização mostradas em separado.
  - Portugal Continental: 18 440 episódios, 6,53 %, 35,89 por 100 000 residentes e 83 min, com o aviso de tempo de espera.
  - Gráficos de 7, 30 e 90 dias e a lista «Ver os valores».
  - ARS Algarve: só há episódios. O indicador «Tempo médio» mostra «Sem dados: o SNS não publica este indicador para ARS Algarve.».
  - Nota metodológica: fonte, links, licença (Lei n.º 26/2016) e transformações.
