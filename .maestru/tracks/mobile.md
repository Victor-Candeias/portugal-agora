---
maestru: "0.4"
type: work-track
id: mobile
title: "Mobile & Android Auto"
created: 2026-07-12
description: Apps nativas Android e Android Auto para o Portugal Hoje
owner: developer
status: active
---

# mobile: Mobile & Android Auto

## Summary

<!-- maestru:work-items-list -->
| ID | Title | Status | Created | Owner | Priority | Completed | Template | Blocked By | Spec |
|---|---|---|---|---|---|---|---|---|---|
| AA-001 | App Android Auto — Portugal Hoje | done | 2026-07-12 | developer | high | 2026-07-12 |  |  | [AA-001](../specs/mobile/aa-001-spec.md) |
| WEB-001 | Atualizar identidade do site para Portugal-Hoje | done | 2026-07-13 |  | medium | 2026-07-13 |  |  |  |
| WEB-002 | Implementar integração CARRIS GTFS + fix favicon | done | 2026-07-13 |  | high | 2026-07-13 |  |  |  |
| WEB-003 | Rework Carris: migrar para API Carris Metropolitana REST JSON | done | 2026-07-13 |  | high | 2026-07-13 |  |  |  |
| WEB-004 | Combustivel: layout responsivo distrito/municipio | done | 2026-07-14 |  | low | 2026-07-14 |  |  |  |
| WEB-005 | Tempo: usar localizacao do utilizador com fallback Lisboa | done | 2026-07-14 |  | low | 2026-07-14 |  |  |  |
| WEB-006 | Hospitais: usar localizacao do utilizador com fallback Lisboa/todos municipios | done | 2026-07-14 |  | low | 2026-07-14 |  |  |  |
| WEB-007 | Carris Veiculos: combobox operador e carreira em vez de chips de linhas | done | 2026-07-14 |  | low | 2026-07-14 |  |  |  |
| WEB-008 | Carris: aproveitar v1 stops (status/facilities) e v2 arrivals by_stop | done | 2026-07-14 |  | low | 2026-07-14 |  |  |  |
| WEB-009 | Carris Linhas: expandir carreira ao clicar para ver mais informacao | done | 2026-07-15 |  | low | 2026-07-15 |  |  |  |
| WEB-010 | Carris: pipeline de build SQLite (WASM) + modelo de dados | done | 2026-07-15 |  | critical | 2026-07-15 |  |  |  |
| WEB-011 | Carris: sincronização de dados estáticos (linhas, paragens, rotas, patterns, shapes) | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-010 |  |
| WEB-012 | Carris: horários programados via GTFS (trips/schedules) | backlog | 2026-07-15 |  | medium |  |  | WEB-011 |  |
| WEB-013 | Carris: chegadas em tempo real (fetch direto, mantém-se) | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-010 |  |
| WEB-014 | Carris: localização de veículos em tempo real (fetch direto, mantém-se) | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-010 |  |
| WEB-015 | Carris: alertas da rede (desvios, obras, interrupções) | backlog | 2026-07-15 |  | medium |  |  | WEB-010 |  |
| WEB-016 | Carris: identificação de operadores via GTFS (agency.txt + routes.txt) | done | 2026-07-15 |  | medium | 2026-07-15 |  | WEB-010, WEB-011 |  |
| WEB-017 | Carris: migrar apps (web/mobile/android-auto) para consumir API própria | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-011, WEB-012, WEB-013, WEB-014, WEB-015, WEB-016 |  |
| WEB-018 | Turismo: integrar SIGTUR/TravelBI (ArcGIS REST) e criar tab/página Turismo | done | 2026-07-17 |  | medium | 2026-07-17 |  |  | [WEB-018](../specs/mobile/web-018-spec.md) |
| WEB-019 | Turismo: integrar ICNF (Áreas Protegidas, Rede Natura 2000, Percursos Pedestres) | done | 2026-07-17 |  | medium | 2026-07-17 |  |  |  |
| WEB-020 | Turismo: validar Agenda Cultural Lisboa/OSM Overpass/Wikidata/UNESCO e integrar UNESCO | done | 2026-07-17 |  | medium | 2026-07-17 |  |  |  |
<!-- /maestru:work-items-list -->
