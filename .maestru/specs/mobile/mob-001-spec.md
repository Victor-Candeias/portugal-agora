---
maestru: "0.4"
type: work-spec
id: mob-001-spec
title: "Mobile: setup de build Android — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-001
owner: developer
created: 2026-10-08
---

# Mobile: setup de build Android — Implementation Plan

## Overview

Preparar `apps/mobile` (Expo SDK 57 / RN 0.86) para builds Android locais e via EAS: lockfile único (pnpm), configuração EAS válida, ambiente JDK 17 documentado e validação de tipos. Base para MOB-003, MOB-004 e MOB-007.

## Implementation

### Fase 1 — Monorepo / dependências
- Remover `apps/mobile/package-lock.json`: o `pnpm-lock.yaml` da raiz já inclui o importer `apps/mobile`; dois lockfiles geram instalações divergentes.
- Metro: a configuração automática de monorepo do Expo resolve o workspace, mas **não** mapeia os imports ESM `./x.js` do `packages/core` para `.ts` (`Unable to resolve module ./types/index.js`). Solução: `apps/mobile/metro.config.js` com `resolver.resolveRequest` que, só para código em `packages/`, tenta primeiro o import sem `.js` (resolvido pelas `sourceExts`).

### Fase 2 — EAS
- `app.json`: remover `extra.eas.projectId: "portugal-hoje"` (inválido — tem de ser o UUID criado por `eas init`).
- `eas.json`: perfis `development` (APK com `developmentClient`), `preview` (APK, distribuição interna) e `production` (AAB, `autoIncrement` com `appVersionSource: remote`) + `submit.production`.
- `expo-dev-client@~57.0.19` adicionado; scripts `android`/`ios` passam a `expo run:*` (alteração do `expo prebuild`).

### Fase 3 — Ambiente
- JDK 17 obrigatório: com JDK 25 o lint do AGP 8.3.2 falha (`IllegalArgumentException: 25.0.2`). Validado: com Temurin 17 o `assembleRelease` do `apps/android-auto` passa, incluindo `lintVitalRelease`.
- Android SDK com API 36.
- Windows: o CMake 3.22.1 (por omissão) falha nos módulos C++ (`react-native-screens`, `react-native-worklets`) com `ninja: error: manifest 'build.ninja' still dirty after 100 tries` (caminhos longos do pnpm). Solução: instalar `cmake/3.31.6` no SDK e definir `cmake.dir` em `android/local.properties`.

### Fase 4 — Qualidade
- Script `typecheck` (`tsc --noEmit`) no `apps/mobile` — corrigidos 2 erros: `fuelData?.data[0]` → `fuelData?.[0]` / `Nome` (o hook devolve `DgegStation[]`) e `useWeatherObservation` em falta em `hooks/useApi.ts`.
- Script `lint` (`oxlint`, config `.oxlintrc.json` alinhada com o web); removidos 2 imports não usados.

### Validação (2026-10-08)
- `pnpm install --frozen-lockfile` OK (Node em `C:\tools\nodejs` — o `node.exe` de `C:\Program Files\nodejs` não tem acesso à rede nesta máquina).
- `pnpm typecheck` e `pnpm lint` sem erros; `expo export --platform android` gera o bundle.
- `gradlew assembleDebug` (JDK 17, x86_64) OK; app instalada e a correr no emulador `Pixel_10a` com Metro — dashboard carrega preços DGEG via `@portugal-hoje/core`.

### Pendente
- `eas init` exige conta Expo (login interativo) para gravar o `projectId` real.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/package-lock.json` | delete | Lockfile único (pnpm) |
| `apps/mobile/eas.json` | create | Perfis EAS `development`/`preview`/`production` |
| `apps/mobile/app.json` | modify | Remover projectId inválido |
| `apps/mobile/package.json` | modify | Scripts `typecheck`/`lint`/`run:*`; `expo-dev-client`, `oxlint` |
| `apps/mobile/metro.config.js` | create | Resolver imports `.js` → `.ts` do `packages/core` |
| `apps/mobile/.oxlintrc.json` | create | Config do lint |
| `apps/mobile/hooks/useApi.ts` | modify | `useWeatherObservation` |
| `apps/mobile/app/(tabs)/index.tsx`, `ev.tsx` | modify | Erros de tipos / imports não usados |
| `pnpm-lock.yaml` | modify | Novas dependências |
| `README.md` | modify | Pré-requisitos JDK 17/SDK/CMake, pnpm-only, EAS, lint |
