---
maestru: "0.4"
type: work-spec
id: mob-013-spec
title: "Android Auto: secções EV, Turismo e Serviços Públicos — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-013
owner: developer
created: 2026-10-09
---

# Android Auto: secções EV, Turismo e Serviços Públicos — Implementation Plan

## Overview

Três novas secções no menu do Android Auto (`MainMenuScreen`), espelhando o que o mobile já mostra
(`apps/mobile/app/(tabs)/ev.tsx`, `turismo.tsx`, `servicos-publicos.tsx`) com as mesmas fontes de
dados do `packages/core`, reimplementadas em Kotlin (OkHttp + Gson, como as restantes APIs do AA).

| Secção | Fonte | Template |
|--------|-------|----------|
| ⚡ Carregamento EV | API Aberta `GET /v1/ev/tariffs/cheapest?kwh=N` (não exige chave; envia `X-API-Key` se existir) | `ListTemplate` com 10/20/30/50 kWh (custo mais barato de cada) → `ListTemplate` com o ranking por CEME. Uma só chamada (`kwh=30`); os totais por kWh são calculados localmente (`preço×kWh + ativação`) |
| 🏖️ Turismo | SIGTUR (`geo.turismodeportugal.pt`, 8 layers), ICNF (`sigservices.icnf.pt`, 4 layers) e UNESCO (17 sítios estáticos), raio de 25 km | `ListTemplate` de categorias com contagem → `PlaceListMapTemplate` com os pontos mais próximos |
| 👮 Serviços Públicos | `public-services.sqlite` publicado no GitHub Pages (WEB-023), descarregado para `filesDir` e lido com `android.database.sqlite` | `PlaceListMapTemplate` com as esquadras/postos mais próximos |

Decisões:
- **ICNF**: as camadas são polígonos/linhas (250–400 KB por pedido). Pede-se com
  `maxAllowableOffset=0.01&geometryPrecision=4` (2–7 KB) e usa-se o centro do bounding box, como em `icnf.ts`.
- **Turismo** carrega todas as layers em paralelo (como o mobile) e só mostra categorias com resultados;
  uma layer que falhe é ignorada para não esconder as restantes.
- **Serviços Públicos**: o `.sqlite` (≈385 KB) é guardado localmente e reutilizado offline; é
  re-descarregado no máximo 1×/dia (o CI publica 1×/dia). Sem ficheiro local e sem rede → mensagem de erro.
- Localização: `LocationHelper` com fallback para Lisboa; `setCurrentLocationEnabled` só com permissão (MOB-012).
- Linhas de `PlaceListMapTemplate` usam `distanceText` (`DistanceSpan` obrigatório, MOB-012).
- O número de linhas respeita o limite do host (`ConstraintManager`, Car API ≥ 2; senão 6), com teto de 20:
  o DHU devolve 1000 para `PLACE_LIST` e um template com ~950 linhas (6,5 MB) excede o Binder
  (`TransactionTooLargeException` → ANR no host).
- **EV em dois níveis** (lista de kWh → ranking) em vez de uma ação que altera o mesmo ecrã: cada
  mudança de conteúdo que não seja "refresh" consome a quota de passos do host.

## Implementation

### Fase 1 — APIs
- `EvApi` — `getCheapest(kwh)` → `EvCheapestResponse(data: List<EvChargeCost>, meta)`.
- `TourismApi` — layers SIGTUR/ICNF + lista UNESCO; `getPoints(lat, lng, radiusKm)` → `List<TourismPoint>`.
- `PublicServicesApi` — download/cache do `.sqlite` e `getAll()` → `List<PublicService>` com coordenadas.

### Fase 2 — Ecrãs
- `EvScreen`, `TurismoScreen` (categorias), `TurismoCategoriaScreen` (mapa), `ServicosPublicosScreen`.
- `MainMenuScreen` — 3 novas entradas.
- `utils/ListLimit.kt` — limite de itens por lista via `ConstraintManager`.

### Fase 3 — Validação
- `assembleDebug`, instalar no telemóvel e verificar cada ecrã no DHU sem crashes (`adb logcat -b crash`).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/api/EvApi.kt` | create | Tarifas EV (API Aberta) |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/api/TourismApi.kt` | create | SIGTUR + ICNF + UNESCO |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/api/PublicServicesApi.kt` | create | SQLite estático de Serviços Públicos |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/EvScreen.kt` | create | Ranking de custo por CEME |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/TurismoScreen.kt` | create | Categorias de turismo + mapa por categoria |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/ServicosPublicosScreen.kt` | create | Polícias mais próximas |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/MainMenuScreen.kt` | modify | Novas entradas no menu |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/utils/ListLimit.kt` | create | Limite de itens do host |
| `apps/android-auto/README.md` | modify | Lista de secções |
| `.maestru/specs/mobile/aa-001-spec.md` | modify | Referência às novas secções |
