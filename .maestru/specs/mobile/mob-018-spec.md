---
maestru: "0.4"
type: work-spec
id: mob-018-spec
title: "MOB-018 Spec — APK com o nome da app e versão incrementada"
template: implementation-plan-v1
work-item: mobile/MOB-018
owner: developer
created: 2026-10-11
---

# MOB-018 Spec — APK com o nome da app e versão incrementada

## Overview

O APK de release era gerado como `app-release.apk` e copiado à mão para `Portugal-Hoje-<versão>.apk`. A versão estava fixa em 1.0.0 (versionCode 1). Pedido: gerar sempre o APK com o nome da app e incrementar a versão em cada build, com assinatura de release para poder atualizar a app instalada no telemóvel.

## Implementation

1. Config plugin `plugins/withApkName.js`: acrescenta ao `android/app/build.gradle` um `applicationVariants.all { outputs.all { outputFileName = ... } }` (AGP 8). O APK sai como `<expo.name sem espaços>-<versionName>.apk`, ex.: `Portugal-Hoje-1.0.2.apk`; os builds que não são release levam o sufixo `-<buildType>`. Funciona também num `gradlew assembleRelease` manual depois do prebuild.
2. `app.json`: `android.versionCode` explícito, a par do `version`.
3. Script `scripts/build-apk.mjs` (`pnpm build:apk`):
   - incrementa o patch do `version` e o `versionCode` (o `--no-bump` não incrementa) e repõe o `app.json` se o build falhar;
   - carrega as variáveis `ANDROID_KEYSTORE_*` de `~/.keystores/portugal-hoje-release.properties` (ou de `ANDROID_KEYSTORE_PROPERTIES`) se não estiverem no ambiente;
   - `gradlew --stop`: um daemon antigo bloqueia ficheiros e o prebuild falha com EBUSY;
   - `expo prebuild`, que apaga o `android/`, e depois recria o `local.properties` com `sdk.dir` e `cmake.dir`, o CMake mais recente do SDK; com o 3.22 o ninja falha com "build.ninja still dirty";
   - `gradlew assembleRelease` e mostra o caminho do APK.
4. CI (`.github/workflows/android.yml`): o artefacto passa a `apk/release/*.apk`. O `ANDROID_VERSION_CODE` do CI continua a sobrepor o `versionCode`.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/plugins/withApkName.js` | create | Nome do APK com o nome da app e a versão |
| `apps/mobile/scripts/build-apk.mjs` | create | Build local: incrementa versão, assina, prebuild e Gradle |
| `apps/mobile/app.json` | modify | Plugin `withApkName`; `android.versionCode` |
| `apps/mobile/package.json` | modify | Script `build:apk` |
| `.github/workflows/android.yml` | modify | Artefacto APK com o novo nome |
| `README.md` | modify | Secção "APK de release local" |
