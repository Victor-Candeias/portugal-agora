---
maestru: "0.4"
type: work-spec
id: mob-015-spec
title: "Mobile: Android Auto na app mobile — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-015
owner: developer
created: 2026-10-10
---

# Mobile: Android Auto na app mobile — Implementation Plan

## Overview

A app mobile (`pt.portugalhoje.app`) passa a funcionar no Android Auto (MOB-015). O Android Auto só
renderiza templates da Car App Library (não UI React Native), por isso o ecrã do carro é nativo em
Kotlin, num módulo Expo local ligado por autolinking — a pasta `android/` continua gerada pelo prebuild.

## Implementation

### Phase 1: Módulo Expo local `car-app`

#### Step 1.1: Código Kotlin do carro

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/modules/car-app/android/src/main/java/pt/portugalhoje/car/**` | Cópia do Kotlin de `apps/android-auto` (serviço, sessão, 10 ecrãs, APIs, utils), pacote `pt.portugalhoje.auto` → `pt.portugalhoje.car`; sem a `MainActivity` WebView |
| Modify | `.../PortugalHojeCarAppService.kt` | `HostValidator`: `ALLOW_ALL` se `ApplicationInfo.FLAG_DEBUGGABLE` (o `BuildConfig.DEBUG` de uma biblioteca não reflete o build da app); senão allowlist oficial |

#### Step 1.2: Build e manifest do módulo

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/modules/car-app/expo-module.config.json` | `platforms: ["android"]`, sem módulos JS — só para autolinking incluir o projeto Gradle |
| Create | `apps/mobile/modules/car-app/android/build.gradle` | `expo-module-gradle-plugin`, namespace `pt.portugalhoje.car`, deps `androidx.car.app` 1.4.0, OkHttp, Gson, coroutines, play-services-location, lifecycle; `BuildConfig.APIABERTA_KEY` de `EXPO_PUBLIC_APIABERTA_KEY` (ambiente ou `apps/mobile/.env`) |
| Create | `apps/mobile/modules/car-app/android/src/main/AndroidManifest.xml` | `CarAppService` (categoria POI), meta-data `com.google.android.gms.car.application` + `minCarApiLevel`, permissões (INTERNET, localização, `MAP_TEMPLATES`) — fundidos no manifest da app |
| Create | `apps/mobile/modules/car-app/android/src/main/res/xml/automotive_app_desc.xml` | `<uses name="template" />` |
| Create | `apps/mobile/modules/car-app/android/proguard-rules.pro` | Keep rules Gson (consumer rules) |
| Modify | `apps/mobile/.gitignore` | Ignorar `modules/*/android/build` |

- [x] `expo-modules-autolinking resolve` lista `car-app`
- [x] `assembleRelease` (JDK 17) compila; manifest final tem o serviço POI, a meta-data e `MAP_TEMPLATES`

### Phase 2: Validação no telemóvel + DHU

| Action | File | Details |
|--------|------|---------|
| Run | — | `adb install -r app-release.apk` no Moto G35 (Android 16) + DHU 2.0 via `adb forward tcp:5277` |

- [x] "Portugal Hoje" aparece no lançador do Android Auto (release, HostValidator restrito)
- [x] 8 secções carregam dados: Proteção Civil, Combustível, Hospitais, Tempo, Transportes CP, EV, Turismo, Serviços Públicos
- [x] Detalhe do local + **Navegar** abre o Google Maps com rota
- [x] UI React Native no telemóvel continua a funcionar

### Phase 3: Documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `README.md` | Secção "Android Auto no mobile" e estrutura |

### Notas / follow-up

- `apps/android-auto` (`pt.portugalhoje.auto`) mantém-se no repositório; removê-la é decisão do owner.
- O `.sqlite` dos Serviços Públicos é descarregado à parte pelo código do carro (`filesDir/public-services.sqlite`),
  independente do `static-db/` do JS.
- Lógica de dados duplicada entre `packages/core` (TS) e o Kotlin do carro.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/modules/car-app/expo-module.config.json` | Create | Autolinking do módulo |
| `apps/mobile/modules/car-app/android/build.gradle` | Create | Build da biblioteca + chave da API |
| `apps/mobile/modules/car-app/android/proguard-rules.pro` | Create | Keep rules Gson |
| `apps/mobile/modules/car-app/android/src/main/AndroidManifest.xml` | Create | Serviço Android Auto + meta-data |
| `apps/mobile/modules/car-app/android/src/main/res/xml/automotive_app_desc.xml` | Create | Descritor automotive |
| `apps/mobile/modules/car-app/android/src/main/java/pt/portugalhoje/car/**` | Create | Ecrãs e APIs do carro |
| `apps/mobile/.gitignore` | Modify | Ignorar build do módulo |
| `README.md` | Modify | Documentação |