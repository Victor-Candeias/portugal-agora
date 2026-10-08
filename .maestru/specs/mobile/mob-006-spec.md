---
maestru: "0.4"
type: work-spec
id: mob-006-spec
title: "Android Auto: publicação-ready — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-006
owner: developer
created: 2026-10-08
---

# Android Auto: publicação-ready — Implementation Plan

## Overview

A app `apps/android-auto` (AA-001) compilava mas **não aparecia no Android Auto**: o manifest não declarava o `CarAppService`. Além disso, não cumpria os requisitos de publicação (HostValidator aberto, assinatura com debug keystore, sem minify, targetSdk 34). Este plano torna a app visível no Android Auto e pronta para publicação.

## Implementation

### Fase 1 — Visibilidade no Android Auto
- Declarar `<service .PortugalHojeCarAppService>` com action `androidx.car.app.CarAppService` e categoria `androidx.car.app.category.POI`.
- Meta-data `com.google.android.gms.car.application` → `@xml/automotive_app_desc` (já existia) e `androidx.car.app.minCarApiLevel = 1` (todos os templates usados — List, PlaceListMap, Pane, Message — existem desde o nível 1).

### Fase 2 — Segurança
- `HostValidator`: `ALLOW_ALL_HOSTS_VALIDATOR` só em debug (`BuildConfig.DEBUG`); em release, allowlist oficial `androidx.car.app.R.array.hosts_allowlist_sample` (hosts Android Auto/Automotive assinados pela Google).

### Fase 3 — Build de release
- `compileSdk`/`targetSdk` 34 → 36; `buildToolsVersion` 36.0.0.
- Assinatura de release via variáveis de ambiente (`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`); sem elas, release sai sem assinatura (deixa de usar a debug keystore).
- `isMinifyEnabled`/`isShrinkResources` = true + regras ProGuard para os modelos Gson (`pt.portugalhoje.auto.api.**`, sem `@SerializedName`).
- Chave da API lida de `APIABERTA_KEY` (fallback `VITE_APIABERTA_KEY`).

### Fase 4 — Elegibilidade das secções (avaliação)

| Secção | Template | Encaixa na categoria POI? |
|---|---|---|
| Combustível | PlaceListMapTemplate | ✅ procurar/navegar para locais |
| Hospitais SNS | PlaceListMapTemplate | ✅ procurar/navegar para locais |
| Tempo | PaneTemplate | ⚠️ não é POI; Play tem categoria de meteorologia própria — risco de rejeição |
| Proteção Civil | ListTemplate | ⚠️ conteúdo informativo/notícias — risco de rejeição |
| Transportes CP | ListTemplate | ⚠️ não é POI — risco de rejeição |

**Decisão pendente (owner):** manter só Combustível + Hospitais na app do carro para a primeira submissão, ou submeter tudo e ajustar após revisão. Também pendente: fundir `pt.portugalhoje.auto` com `pt.portugalhoje.app` (dependente de MOB-001).

### Validação
- `assembleDebug` e `assembleRelease` (R8) compilam; manifest final contém serviço, categoria POI, meta-data e `targetSdkVersion=36`; mapping R8 sem campos de modelos renomeados.
- `lintVitalAnalyzeRelease` falha no ambiente local por causa do JDK 25 (`IllegalArgumentException: 25.0.2` no lint do AGP 8.3.2) — problema de ambiente, não de código; resolve-se com JDK 17 (MOB-001).
- Teste em DHU/carro pendente (sem dispositivo ligado).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/android-auto/app/src/main/AndroidManifest.xml` | modify | Declarar CarAppService (POI) + meta-data |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/PortugalHojeCarAppService.kt` | modify | HostValidator restrito em release |
| `apps/android-auto/app/build.gradle.kts` | modify | SDK 36, signing por env vars, minify, APIABERTA_KEY |
| `apps/android-auto/app/proguard-rules.pro` | modify | Keep rules para modelos Gson |
| `apps/android-auto/README.md` | modify | Pré-requisitos, signing, passos DHU, publicação |
