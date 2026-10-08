---
maestru: "0.4"
type: work-spec
id: web-012-spec
title: "WEB-012 Spec — Horários programados (GTFS)"
template: implementation-plan-v1
work-item: mobile/WEB-012
owner: developer
created: 2026-10-08
---

# WEB-012 Spec — Horários programados (GTFS)

## Overview

Horários programados da Carris Metropolitana consultados localmente (sql.js/WASM no web, `QueryAll` injetado no core) a partir do `carris.sqlite` gerado em build/CI — sem pedidos de rede depois do primeiro carregamento.

**Validação da API (2026-10):** `/v2/schedules`, `/v2/trips` e `/v2/schedules/by_stop` devolvem 404 → fallback GTFS obrigatório (`/v2/gtfs`, ~92 MB zip; `stop_times.txt` ~861 MB / 11,25 M linhas / ~344 k viagens, agrupadas contiguamente por `trip_id`).

**Decisão:** esquema GTFS-nativo (sequências de paragens do próprio GTFS), porque o `pattern_path` da API diverge das sequências GTFS em ~50% dos patterns. Os `pattern_id` GTFS (sem prefixo `[...]`) coincidem com os da API, o que permite agrupar por pattern na UI.

## Implementation

### Build (`apps/web/scripts/build-carris-db.mjs`)

- `loadGtfsZip()` — descarrega `/v2/gtfs` (ou usa `CARRIS_GTFS_ZIP` local, útil em dev). O zip é partilhado com `loadOperators` (que agora também devolve `route_id → line_id` via `route_short_name`).
- `loadSchedules(zip)` — `stop_times.txt` lido em streaming (JSZip `nodeStream` + `readline`), sem carregar 861 MB em memória. IDs GTFS sem prefixos (`/^(\[[^\]]*\])+/`). Índice posicional da paragem na viagem (algumas viagens começam em `stop_sequence` 0).
- Compressão:
  - `stop_sequences` / `sequence_stops` — sequências de paragens deduplicadas.
  - `trip_profiles` — (linha, pattern, headsign, sequência, `segments` = CSV de durações entre paragens consecutivas). Viagens com o mesmo perfil partilham uma linha.
  - `profile_departures` — horas de partida (segundos) por perfil × serviço, CSV delta-encoded.
  - `services` / `service_dates` — só datas de ontem a +60 dias (`SCHEDULE_WINDOW_DAYS`); `calendar_dates` só tem `exception_type=1`.
- Resultado: `carris.sqlite` 7,18 → 10,47 MB; build ~57 s.

### Core (`packages/core/src/api/carris.ts`)

- `lisbonServiceDay()` — data (`YYYYMMDD`) e segundos desde a meia-noite em Europe/Lisbon (`Intl.DateTimeFormat`, `hourCycle: h23`).
- `getStopSchedule(stopId, date)` / `getLineSchedule(lineId, date)` → `CMScheduledDeparture[]` ordenados por hora.
- Semântica de dia de serviço: viagens do dia D mantêm a hora (pode ser ≥ 24h, mostrada módulo 24 por `formatScheduleTime`); viagens do dia D-1 só entram se ≥ 86400 s, deslocadas −86400. A paragem terminal é excluída (só partidas).
- Um `.sqlite` antigo em cache sem estas tabelas faz a query falhar → UI esconde/mostra "Horários indisponíveis".

### Web

- `useStopSchedule` / `useLineSchedule` (`apps/web/src/hooks/useCarris.ts`), chave inclui o dia de serviço.
- `Transportes.tsx`:
  - `LineDetails` — "Partidas hoje" por pattern (primeira paragem do pattern).
  - `StopSchedule` (dentro de `StopArrivals`) — próximas 8 partidas programadas de hoje na paragem.

### Validação

- Comparação com força bruta sobre o GTFS bruto: paragem 120305 (411 partidas), paragem 030001 (0), linha 1728 (8) — coincidem. Queries ~3 ms.
- `pnpm build` + `pnpm lint` (web), `pnpm typecheck` (mobile).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/web/scripts/build-carris-db.mjs` | Edit | Download GTFS partilhado, streaming de `stop_times`, novas tabelas de horários |
| `packages/core/src/api/carris.ts` | Edit | Tipos, helpers de dia de serviço, `getStopSchedule` / `getLineSchedule` |
| `apps/web/src/hooks/useCarris.ts` | Edit | Hooks `useStopSchedule` / `useLineSchedule` |
| `apps/web/src/pages/Transportes.tsx` | Edit | UI "Partidas hoje" (linha) e "Horários programados" (paragem) |
