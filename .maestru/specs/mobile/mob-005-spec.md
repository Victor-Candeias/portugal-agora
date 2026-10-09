---
maestru: "0.4"
type: work-spec
id: mob-005-spec
title: "Mobile: ecrãs em falta — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-005
owner: developer
created: 2026-10-09
---

# Mobile: ecrãs em falta — Implementation Plan

## Overview

Paridade funcional da app mobile com o web: os 6 ecrãs que só existiam no web (Proteção Civil, Hospitais, Transportes, Metro do Porto, Serviços Públicos, Código Postal) passam a existir no Android. Usam os clientes do `@portugal-hoje/core` (MOB-002), a camada SQLite nativa (MOB-003) e o `PointsMap` (MOB-004). A navegação passa a ser *stack* sobre *tabs*, porque 12 secções não cabem numa barra de tabs.

**Decisões**
- **Navegação:** a raiz (`app/_layout.tsx`) é um `Stack` (`expo-router`). As 6 tabs atuais ficam num grupo `(tabs)` com `_layout.tsx` próprio (`Tabs` de `expo-router/js-tabs`, porque em SDK 57 o `Tabs` de `expo-router` está deprecated). Os 6 ecrãs novos são rotas *stack* (`/protecao-civil`, `/hospitais`, …), abertas a partir de uma grelha "Todas as secções" no Início. O botão Voltar do Android regressa ao Início.
- **Hospitais:** o mapa CP → distrito/município é o mesmo `apps/web/public/cp-distrito.json` (estático, sem gerador), importado como JSON e empacotado na app. Assim há uma só fonte, funciona offline e não há pedido extra.
- **Comboios CP:** `fetch` direto ao comboios.live (sem proxy CORS, que só o browser precisa).
- **Risco de incêndio:** `GET /civil-protection/fire-risk` da API Aberta exige uma chave válida (`EXPO_PUBLIC_APIABERTA_KEY`; com `demo` dá 401). O ecrã mostra o risco quando há chave e, sem ela, um aviso "indisponível", sem bloquear as ocorrências (`/anpc/*` funciona sem chave).
- **Início:** o cartão/aviso ANPC passa a usar `/anpc/summary` (como o banner do web), que funciona sem chave, e abre o ecrã Proteção Civil.
- **Listas longas:** em vez da paginação do web, listas dentro do `ScrollView` do ecrã, com "Mostrar mais" (`ShowMore`, blocos de 20) e os filtros no topo. "Mapa" por cartão abre um `SinglePointMap` *inline*, como no web.
- **Mapa de veículos Carris:** `PointsMap` com os veículos filtrados (máx. 300 marcadores, para não pesar no MapLibre), em vez do mapa Leaflet do web.

## Implementation

### Phase 1: Infraestrutura

#### Step 1.1: Clientes e hooks

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/lib/clients.ts` | + `snsClient` (`loadPostalCodeMap` → JSON empacotado), `comboiosClient`/`tmlClient`/`codigoPostalClient` (fetch direto), `anpcClient` (`EXPO_PUBLIC_APIABERTA_KEY`) |
| Create | `apps/mobile/hooks/useAnpc.ts` | `useAnpcIncidents`, `useAnpcSummary`, `useFireRisk` |
| Create | `apps/mobile/hooks/useHospitais.ts` | `useHospitals` |
| Create | `apps/mobile/hooks/useTransportes.ts` | `useTrains`, `useTrainStations`, `useTmlAlerts` |
| Create | `apps/mobile/hooks/useCarris.ts` | Linhas, operadores, paragens, padrões, veículos, chegadas, horários, alertas (mesmas query keys/`staleTime` do web) |
| Create | `apps/mobile/hooks/useMetroPorto.ts` | Meta, estações, linhas da estação, próximas partidas |
| Create | `apps/mobile/hooks/usePublicServices.ts` | Meta, lista |
| Create | `apps/mobile/hooks/useCodigoPostal.ts` | Pesquisa por CP (só com formato válido) |
| Create | `apps/mobile/hooks/useUserLocation.ts` | Permissão `expo-location` + posição; `fallback` opcional (Lisboa) e `request()` para repetir |

#### Step 1.2: Componentes partilhados

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/components/ui.tsx` | `ScreenHeader`, `Card`, `SectionTitle`, `Chip`/`ChipRow` (horizontal), `SegmentedTabs`, `SearchInput`, `LoadingView`, `ErrorView` (mensagem do erro, incluindo `StaticDbUnavailableError`), `EmptyText`, `Notice`, `Badge`, `LinkText`, `ShowMore`, `formatDistance` |
| Create | `apps/mobile/components/transportes/labels.ts` | Cores de serviço, rótulos de causa/efeito/estado, formatação de datas/horas |
| Create | `apps/mobile/components/transportes/shared.tsx` | `StatCard`, `DetailGrid`, `LinePill` |
| Create | `apps/mobile/components/transportes/Comboios.tsx` | Separador Comboios CP |
| Create | `apps/mobile/components/transportes/Carris.tsx` | Separador Carris (Veículos, Linhas, Perto, Alertas) |
| Create | `apps/mobile/components/transportes/AlertasTml.tsx` | Separador Alertas TML |

#### Step 1.3: Navegação

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/lib/sections.ts` | Lista das 11 secções além do Início (rota, título, emoji, cor, descrição) |
| Modify | `apps/mobile/app/_layout.tsx` | `Stack` com `(tabs)` sem header e os 6 ecrãs novos com título |
| Create | `apps/mobile/app/(tabs)/_layout.tsx` | `Tabs` (`expo-router/js-tabs`) com as 6 tabs existentes, sem alterações de títulos/ícones |
| Modify | `apps/mobile/app/(tabs)/index.tsx` | Aviso ANPC (summary) clicável → Proteção Civil; cartão "Ocorrências ANPC"; grelha "Todas as secções" |
| Modify | `apps/mobile/app.json` | Texto da permissão de localização genérico (turismo, hospitais, paragens, esquadras) |

- [x] As 6 tabs continuam a funcionar; a grelha abre todos os 11 destinos; Voltar regressa (verificado por typecheck e `expo export -p android`; falta testar no emulador)

### Phase 2: Ecrãs

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/app/protecao-civil.tsx` | Estado (ativas/concluídas), filtros por distrito e por tipo (chips do summary), risco de incêndio por distrito, lista com recursos e mapa por ocorrência, mapa geral |
| Create | `apps/mobile/app/hospitais.tsx` | GPS → ordenado por distância (sem permissão: distrito Lisboa); pesquisa, chips distrito/município; cartão com tipo de urgência, valências, Saúde 24, telefone/email, mapa e direções |
| Create | `apps/mobile/app/transportes.tsx` | Separadores **Comboios CP** (resumo, filtro por serviço, detalhe + mapa), **Carris** (Veículos com filtros operador/carreira + mapa, Linhas com município + percursos/partidas de hoje, Paragens perto com chegadas em tempo real + horários programados, Alertas) e **Alertas TML** |
| Create | `apps/mobile/app/metro-porto.tsx` | Pesquisa, estação → linhas, próximas partidas (refresh 60 s) e mapa; data dos dados |
| Create | `apps/mobile/app/servicos-publicos.tsx` | Categoria + pesquisa, ordenado por distância (GPS), cartão com contactos/horário/mapa; data dos dados |
| Create | `apps/mobile/app/codigo-postal.tsx` | Input com máscara `NNNN-NNN`, distrito/concelho/localidade, mapa e artérias |

- [x] Cada ecrã compila e empacota (`expo export -p android`); os erros (rede, `.sqlite` por descarregar) aparecem como mensagem via `ErrorView`. Falta o smoke test no emulador.

### Phase 3: Documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `README.md` | Navegação mobile e ecrãs disponíveis |

## Validação

`pnpm typecheck` e `pnpm lint` no mobile; `expo export -p android` (bundle Metro, apanha imports/resolução, incluindo o JSON do web); smoke test dos clientes em Node contra as APIs reais.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/lib/clients.ts` | Modify | Clientes SNS, CP, TML, Código Postal, ANPC |
| `apps/mobile/hooks/useAnpc.ts` | Create | Hooks ANPC + risco de incêndio |
| `apps/mobile/hooks/useHospitais.ts` | Create | Hook SNS |
| `apps/mobile/hooks/useTransportes.ts` | Create | Hooks comboios/TML |
| `apps/mobile/hooks/useCarris.ts` | Create | Hooks Carris |
| `apps/mobile/hooks/useMetroPorto.ts` | Create | Hooks Metro do Porto |
| `apps/mobile/hooks/usePublicServices.ts` | Create | Hooks Serviços Públicos |
| `apps/mobile/hooks/useCodigoPostal.ts` | Create | Hook Código Postal |
| `apps/mobile/hooks/useUserLocation.ts` | Create | Localização com fallback |
| `apps/mobile/components/ui.tsx` | Create | Componentes partilhados |
| `apps/mobile/components/transportes/labels.ts` | Create | Rótulos e formatação de Transportes |
| `apps/mobile/components/transportes/shared.tsx` | Create | Componentes partilhados de Transportes |
| `apps/mobile/components/transportes/Comboios.tsx` | Create | Separador Comboios CP |
| `apps/mobile/components/transportes/Carris.tsx` | Create | Separador Carris |
| `apps/mobile/components/transportes/AlertasTml.tsx` | Create | Separador Alertas TML |
| `apps/mobile/lib/sections.ts` | Create | Catálogo de secções |
| `apps/mobile/app/_layout.tsx` | Modify | Stack raiz |
| `apps/mobile/app/(tabs)/_layout.tsx` | Create | Tabs |
| `apps/mobile/app/(tabs)/index.tsx` | Modify | Grelha de secções + ANPC |
| `apps/mobile/app/protecao-civil.tsx` | Create | Ecrã Proteção Civil |
| `apps/mobile/app/hospitais.tsx` | Create | Ecrã Hospitais |
| `apps/mobile/app/transportes.tsx` | Create | Ecrã Transportes |
| `apps/mobile/app/metro-porto.tsx` | Create | Ecrã Metro do Porto |
| `apps/mobile/app/servicos-publicos.tsx` | Create | Ecrã Serviços Públicos |
| `apps/mobile/app/codigo-postal.tsx` | Create | Ecrã Código Postal |
| `apps/mobile/app.json` | Modify | Texto da permissão de localização |
| `README.md` | Modify | Documentação |
