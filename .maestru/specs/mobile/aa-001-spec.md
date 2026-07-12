---
maestru: "0.4"
type: work-spec
id: aa-001-spec
title: "Android Auto App — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/AA-001
owner: developer
created: 2026-07-12
---

# Android Auto App — Implementation Plan

## Overview

App nativa Kotlin para Android Auto que expõe as principais secções do Portugal Hoje usando a Car App Library. Acede ao GPS do dispositivo para funcionalidades de localização (postos de combustível e hospitais mais próximos).

**Secções:**
- 🔥 Proteção Civil — lista de ocorrências ativas
- ⛽ Combustível — postos próximos via GPS
- 🏥 Hospitais — urgências próximas via GPS
- 🌤️ Tempo — previsão para a cidade IPMA mais próxima
- 🚆 Transportes — comboios CP com atrasos

**Stack:** Kotlin · Car App Library 1.4+ · OkHttp · Gson · Coroutines · Fused Location Provider

## Implementation

### Fase 1 — Estrutura do projeto
- Criar `apps/android-auto/` com projeto Gradle (Kotlin DSL)
- Configurar `AndroidManifest.xml` com `CarAppService`, permissões de localização e `automotive_app_desc`
- Adicionar dependências: `car-app`, `okhttp`, `gson`, `coroutines`, `play-services-location`

### Fase 2 — Serviço base + navegação
- `PortugalHojeCarAppService` — entry point do Android Auto
- `PortugalHojeSession` — arranque da navegação
- `MainMenuScreen` — ecrã inicial com 5 opções (ListTemplate)

### Fase 3 — Ecrãs de conteúdo
- `ProtecaoCivilScreen` — ListTemplate com ocorrências ANPC
- `CombustivelScreen` — PlaceListMapTemplate com postos próximos (GPS)
- `HospitaisScreen` — PlaceListMapTemplate com urgências próximas (GPS)
- `TempoScreen` — PaneTemplate com previsão IPMA da cidade mais próxima
- `TransportesScreen` — ListTemplate com comboios e atrasos

### Fase 4 — GPS e localização
- `LocationHelper` — obtém localização atual via Fused Location Provider
- Cálculo de distância via fórmula de Haversine
- Fallback para Lisboa se GPS indisponível

### Fase 5 — APIs
- `AnpcApi` — https://api.apiaberta.pt/v1/anpc/incidents
- `DgegApi` — https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/ListarPostos
- `SnsApi` — transparencia.sns.gov.pt
- `IpmaApi` — https://api.ipma.pt
- `ComboiosApi` — https://comboios.live/api/vehicles

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/android-auto/build.gradle.kts` | create | Root Gradle config |
| `apps/android-auto/app/build.gradle.kts` | create | App dependencies |
| `apps/android-auto/app/src/main/AndroidManifest.xml` | create | CarAppService + permissões GPS |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/PortugalHojeCarAppService.kt` | create | Entry point Android Auto |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/PortugalHojeSession.kt` | create | Session principal |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/MainMenuScreen.kt` | create | Menu principal 5 secções |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/ProtecaoCivilScreen.kt` | create | Ocorrências ANPC |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/CombustivelScreen.kt` | create | Postos combustível próximos |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/HospitaisScreen.kt` | create | Urgências próximas |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/TempoScreen.kt` | create | Previsão IPMA |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/TransportesScreen.kt` | create | Comboios CP |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/utils/LocationHelper.kt` | create | GPS + cálculo distância |
