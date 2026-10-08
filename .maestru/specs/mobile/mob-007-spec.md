---
maestru: "0.4"
type: work-spec
id: mob-007-spec
title: "Mobile: CI de build Android + Google Play — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-007
owner: developer
created: 2026-10-08
---

# Mobile: CI de build Android + Google Play — Implementation Plan

## Overview

Pipeline GitHub Actions que gera o AAB/APK de release do `apps/mobile` e o publica (opcionalmente) numa faixa de teste do Google Play, mais os artefactos de conformidade (política de privacidade, respostas Data Safety / classificação de conteúdo). As contas externas (Google Play Console, service account) são passos manuais do owner.

## Implementation

### Fase 1 — Build sem EAS
- Decisão: **`expo prebuild` + Gradle** no runner, em vez de EAS Build — não exige conta Expo nem `eas init`, não consome quota EAS e reutiliza o ambiente validado no MOB-001 (JDK 17, SDK 36). O `eas.json` mantém-se para quem quiser usar EAS (README marca-o como opcional).
- `android/` continua gerado (não versionado); a configuração de release entra por config plugin local `apps/mobile/plugins/withReleaseSigning.js` (registado no `app.json`):
  - `signingConfigs.release` lido de `ANDROID_KEYSTORE_PATH` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` (mesmas variáveis do `apps/android-auto`, MOB-006); sem keystore o release cai na debug keystore (builds locais continuam a funcionar).
  - `versionCode` a partir de `ANDROID_VERSION_CODE` (no CI = `github.run_number`, sempre crescente).
  - Idempotente (marcador) e falha explicitamente se o template do `build.gradle` mudar.

### Fase 2 — Workflow `.github/workflows/android.yml`
- Gatilhos: `workflow_dispatch` (inputs `track` = none/internal/alpha/beta e `status` = draft/completed) e tags `mobile-v*`.
- Passos: pnpm 10 + Node 22 + Temurin 17 → `pnpm install --frozen-lockfile` → `typecheck` + `lint` → keystore de `ANDROID_KEYSTORE_BASE64` para `$RUNNER_TEMP` → `expo prebuild --platform android --clean` → `gradle/actions/setup-gradle` (cache) → `./gradlew bundleRelease assembleRelease` → artefactos (AAB + APK).
- Publicação com `r0adkll/upload-google-play@v1` só quando `track != none`; antes valida que existem keystore e `PLAY_SERVICE_ACCOUNT_JSON` (o Play rejeita builds com a debug key).
- `EXPO_PUBLIC_APIABERTA_KEY` vem do secret `APIABERTA_KEY`.

### Fase 3 — Conformidade Google Play
- Política de privacidade estática em `apps/web/public/privacidade.html` → `https://victor-candeias.github.io/portugal-agora/privacidade.html` (deploy pelo workflow do web).
- **Data Safety** (respostas propostas):
  - Recolhe dados? **Sim** — Localização aproximada e precisa (`ACCESS_COARSE/FINE_LOCATION`, só em primeiro plano), enviada no momento da pesquisa de pontos de interesse (SIGTUR/ICNF). Não é partilhada para outros fins, não é guardada, tratamento efémero, **opcional** (a app usa uma localização predefinida se recusada), finalidade **Funcionalidade da app**.
  - Sem contas, sem analítica, sem publicidade, sem identificadores. Dados encriptados em trânsito: **Sim** (HTTPS). Pedido de eliminação: não aplicável (nada é guardado).
- **Classificação de conteúdo** (questionário IARC): categoria "Referência, notícias ou educação"/utilitário; sem violência, sexo, linguagem, drogas, jogo, interação entre utilizadores, partilha de localização com outros utilizadores ou compras → classificação esperada PEGI 3 / Everyone.
- Público-alvo: 18+ (evita requisitos da política Families).

### Fase 4 — Chave API Aberta embutida
- `EXPO_PUBLIC_*` fica em claro no bundle JS do APK — qualquer pessoa a pode extrair. Não há servidor no projeto (ver WEB-010), por isso um proxy próprio implicaria hosting novo.
- Decisão: usar uma **chave dedicada à app Android** (distinta da do web), com limites de pedidos na API Aberta, e rodá-la (novo secret + novo build) se houver abuso. Proxy só se o abuso se tornar real.

### Validação (2026-10-09)
- `expo prebuild --platform android` com `ANDROID_VERSION_CODE=42` → `versionCode 42`, `signingConfigs.release` e `buildTypes.release` com escolha condicional.
- `gradlew :app:signingReport` (JDK 17) com keystore temporária → variante `release` assinada com a keystore de release.
- `pnpm typecheck` e `pnpm lint` sem erros.

### Pendente (manual, owner)
- Criar conta Google Play Console (pessoal: verificação de identidade), criar a app `pt.portugalhoje.app` e ativar Play App Signing.
- Gerar a upload keystore e configurar os secrets (`ANDROID_KEYSTORE_*`, `APIABERTA_KEY`, `PLAY_SERVICE_ACCOUNT_JSON`); service account no Google Cloud com acesso à app na Play Console.
- Primeiro upload do AAB manualmente na Play Console (a API não cria apps).
- Listagem: ícone 512×512, feature graphic 1024×500, ≥2 screenshots de telemóvel, descrições curta/longa.
- Preencher Data Safety, classificação de conteúdo, público-alvo e URL da política de privacidade com os valores acima.
- Teste fechado com ≥12 testers durante 14 dias antes de pedir acesso a produção (contas pessoais novas).
- Avaliar bloquear `android.permission.SYSTEM_ALERT_WINDOW` (adicionada pelo prebuild ao manifest principal) via `android.blockedPermissions` antes de produção.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/android.yml` | create | Build AAB/APK + publicação opcional no Google Play |
| `apps/mobile/plugins/withReleaseSigning.js` | create | Assinatura de release e `versionCode` por variáveis de ambiente |
| `apps/mobile/app.json` | modify | Registar o config plugin |
| `apps/web/public/privacidade.html` | create | Política de privacidade pública |
| `README.md` | modify | CI Android, secrets, upload key, política de privacidade |
