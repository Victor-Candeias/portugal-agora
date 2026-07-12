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
- 🌤️ Tempo — previsão para o distrito atual
- 🚆 Transportes — comboios CP com atrasos

**Stack:** Kotlin · Car App Library 1.4+ · Retrofit · Coroutines · Hilt (DI)

## Implementation

### Fase 1 — Estrutura do projeto
- Criar `apps/android-auto/` com projeto Gradle (Kotlin DSL)
- Configurar `AndroidManifest.xml` com `CarAppService` e permissões de localização
- Adicionar dependências: `car-app`, `retrofit`, `hilt`, `coroutines`

### Fase 2 — Serviço base + navegação
- `PortugalHojeCarAppService` — entry point do Android Auto
- `MainMenuScreen` — ecrã inicial com 5 opções (ListTemplate)
- Sistema de navegação entre ecrãs (ScreenManager)

### Fase 3 — Ecrãs de conteúdo
- `ProtecaoCivilScreen` — ListTemplate com ocorrências ANPC
- `CombustivelScreen` — PlaceListMapTemplate com postos próximos (GPS)
- `HospitaisScreen` — PlaceListMapTemplate com urgências próximas (GPS)
- `TempoScreen` — PaneTemplate com previsão IPMA do distrito atual
- `TransportesScreen` — ListTemplate com comboios e atrasos

### Fase 4 — GPS e localização
- `LocationManager` — obtém localização atual via GPS/network
- Cálculo de distância para ordenar postos e hospitais por proximidade
- Fallback para Lisboa se GPS indisponível

### Fase 5 — APIs (Retrofit)
- `AnpcApiService` — https://api.apiaberta.pt/v1/anpc/incidents
- `CombustivelApiService` — DGEG via mesma lógica do site
- `HospitaisApiService` — transparencia.sns.gov.pt
- `IpmaApiService` — https://api.ipma.pt
- `ComboiosApiService` — https://comboios.live/api/vehicles

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/android-auto/build.gradle.kts` | create | Root Gradle config |
| `apps/android-auto/app/build.gradle.kts` | create | App dependencies |
| `apps/android-auto/app/src/main/AndroidManifest.xml` | create | CarAppService + permissões GPS |
| `apps/android-auto/app/src/.../PortugalHojeCarAppService.kt` | create | Entry point Android Auto |
| `apps/android-auto/app/src/.../MainMenuScreen.kt` | create | Menu principal 5 secções |
| `apps/android-auto/app/src/.../ProtecaoCivilScreen.kt` | create | Ocorrências ANPC |
| `apps/android-auto/app/src/.../CombustivelScreen.kt` | create | Postos combustível próximos |
| `apps/android-auto/app/src/.../HospitaisScreen.kt` | create | Urgências próximas |
| `apps/android-auto/app/src/.../TempoScreen.kt` | create | Previsão IPMA |
| `apps/android-auto/app/src/.../TransportesScreen.kt` | create | Comboios CP |
| `apps/android-auto/app/src/.../LocationManager.kt` | create | GPS + cálculo distância |
