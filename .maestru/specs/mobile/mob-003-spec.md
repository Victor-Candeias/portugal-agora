---
maestru: "0.4"
type: work-spec
id: mob-003-spec
title: "Mobile: camada SQLite nativa (expo-sqlite) + download/cache dos .sqlite — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-003
owner: developer
created: 2026-10-08
---

# Mobile: camada SQLite nativa (expo-sqlite) + download/cache dos .sqlite — Implementation Plan

## Overview

Camada SQLite nativa para os `.sqlite` estáticos (Carris, Metro do Porto, Serviços Públicos), equivalente ao sql.js do web: implementa o contrato `QueryAll` do `@portugal-hoje/core` (MOB-002) com `expo-sqlite`, descarrega os ficheiros publicados no GitHub Pages para o armazenamento da app e mantém-nos atualizados com base na tabela `meta` (`generated_at`). Funciona offline após o primeiro download. Desbloqueia o MOB-005, que só precisa de usar `lib/clients.ts`.

## Implementation

### Phase 1: Dependências

#### Step 1.1: Módulos Expo SDK 57

| Action | File | Details |
|--------|------|---------|
| Modify | `apps/mobile/package.json`, `pnpm-lock.yaml` | `expo-sqlite@~57.0.0`, `expo-file-system@~57.0.0` (versões de `bundledNativeModules.json`; instalado com pnpm 10, como no CI) |

Sem config plugin: as opções por omissão do `expo-sqlite` chegam; os módulos são ligados por autolinking (pasta `android/` gerada, não versionada).

- [x] `pnpm install` / `assembleDebug` com os módulos novos

### Phase 2: Camada `staticDb`

#### Step 2.1: `createStaticDb(name, label)`

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/lib/staticDb.ts` | `queryAll` (implementa `QueryAll`), `getMeta` (`getStaticDbMeta` do core), `getLocalInfo`, `checkForUpdate`, `reload`; instâncias `carrisDb`, `metroPortoDb`, `publicServicesDb`; `StaticDbUnavailableError` |

Ficheiros em `Paths.document/static-db/` (não em cache, que o SO pode limpar): `<nome>.sqlite` (em uso), `<nome>.next.sqlite` (pendente), `<nome>.download.sqlite` (temporário) e `<nome>.state.json` (`current`/`pending` com `etag` + `generatedAt`, `lastCheckedAt`). Origem: `EXPO_PUBLIC_STATIC_DATA_URL`, por omissão `https://victor-candeias.github.io/portugal-agora/data/`.

Fluxo:
1. **Abrir** — promove o pendente (apagando `-wal`/`-shm`/`-journal` do anterior; o expo-sqlite abre em WAL); se não houver ficheiro, descarrega-o (bloqueante); sem rede → `StaticDbUnavailableError` com mensagem para o utilizador e a promessa é reposta, para a próxima consulta voltar a tentar.
2. **Verificar** (segundo plano, no máximo a cada 6 h; `force` ignora o intervalo) — `HEAD` ao ficheiro publicado; ETag igual → nada a fazer; diferente → descarrega para o temporário, valida (abre e lê `meta.generated_at`) e só o move para pendente se `generated_at` for mais recente. Caso contrário memoriza o ETag (cada deploy do Pages muda o ETag).
3. **Aplicar** — no próximo arranque ou em `reload()`, que espera pelas consultas em curso, fecha a ligação e reabre. O ficheiro nunca é substituído com uma ligação aberta.

- [x] Primeiro download, consultas e `meta` (717 linhas, 12702 paragens, 85 estações, 948 serviços)
- [x] Offline com cache após reinício da app
- [x] Primeira utilização sem rede → `StaticDbUnavailableError`, sem ficheiros parciais; nova tentativa com rede funciona sem reiniciar
- [x] ETag igual → `checkForUpdate` devolve `false` sem descarregar
- [x] Versão mais recente → pendente → `reload()` aplica-a; consulta em curso durante o `reload()` conclui

#### Step 2.2: Clientes nativos

| Action | File | Details |
|--------|------|---------|
| Create | `apps/mobile/lib/clients.ts` | `carrisClient`, `metroPortoClient`, `publicServicesClient` (fábricas do core com o `queryAll` nativo; APIs em tempo real com `fetch` direto) |

### Phase 3: Documentação

| Action | File | Details |
|--------|------|---------|
| Modify | `README.md` | Secção "Dados estáticos no mobile" |
| Modify | `apps/mobile/.env.example` | `EXPO_PUBLIC_STATIC_DATA_URL` (opcional) |

## Validação

`pnpm typecheck` e `pnpm lint` no mobile; `gradlew assembleDebug` (JDK 17, x86_64) e cenários acima no emulador `Pixel_10a`, com um ecrã de diagnóstico temporário (não versionado).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/lib/staticDb.ts` | create | Camada expo-sqlite + download/cache/atualização |
| `apps/mobile/lib/clients.ts` | create | Clientes do core assentes nos `.sqlite` |
| `apps/mobile/package.json` | modify | `expo-sqlite`, `expo-file-system` |
| `pnpm-lock.yaml` | modify | Lockfile |
| `apps/mobile/.env.example` | modify | `EXPO_PUBLIC_STATIC_DATA_URL` |
| `README.md` | modify | Documentação da camada |