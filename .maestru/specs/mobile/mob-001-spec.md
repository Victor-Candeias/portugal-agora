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
- Metro: Expo SDK 52+ configura monorepos automaticamente e o SDK 54+ suporta o modo isolado do pnpm → **sem `metro.config.js`** (docs.expo.dev/guides/monorepos).

### Fase 2 — EAS
- `app.json`: remover `extra.eas.projectId: "portugal-hoje"` (inválido — tem de ser o UUID criado por `eas init`).
- `eas.json`: perfis `preview` (APK, distribuição interna) e `production` (AAB, `autoIncrement` com `appVersionSource: remote`) + `submit.production`.
- Perfil `development` **não** incluído: `developmentClient` exige `expo-dev-client`, que não está instalado (adicionar com `npx expo install expo-dev-client`).

### Fase 3 — Ambiente
- JDK 17 obrigatório: com JDK 25 o lint do AGP 8.3.2 falha (`IllegalArgumentException: 25.0.2`). Validado: com Temurin 17 o `assembleRelease` do `apps/android-auto` passa, incluindo `lintVitalRelease`.
- Android SDK com API 36.

### Fase 4 — Qualidade
- Script `typecheck` (`tsc --noEmit`) no `apps/mobile`.
- Lint: pendente — exige nova devDependency (ex. `oxlint`, como no web) e atualização do `pnpm-lock.yaml`.

### Bloqueios no ambiente de desenvolvimento (2026-10-08)
- O `node.exe` não consegue abrir ligações de rede (`EACCES` no connect; DNS e `curl` funcionam), provavelmente por política de firewall/endpoint → sem `pnpm install`. Por isso ficou por validar: correr `typecheck`, resolução do `@portugal-hoje/core` pelo Metro, `expo run:android` no emulador (AVDs disponíveis: `Pixel_10a`, …) e adicionar o lint.
- `eas init` exige conta Expo (login interativo).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/package-lock.json` | delete | Lockfile único (pnpm) |
| `apps/mobile/eas.json` | create | Perfis EAS `preview`/`production` |
| `apps/mobile/app.json` | modify | Remover projectId inválido |
| `apps/mobile/package.json` | modify | Script `typecheck` |
| `README.md` | modify | Pré-requisitos JDK 17/SDK, pnpm-only, EAS |
