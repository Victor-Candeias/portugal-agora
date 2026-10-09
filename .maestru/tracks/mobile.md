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
| MOB-001 | Mobile: setup de build Android (JDK 17, EAS, eas.json, lockfile) | done | 2026-10-08 | developer | high | 2026-10-08 |  |  | [MOB-001](../specs/mobile/mob-001-spec.md) |
| MOB-002 | Mobile: mover lógica partilhável do web para packages/core | done | 2026-10-08 | developer | high | 2026-10-08 |  |  | [MOB-002](../specs/mobile/mob-002-spec.md) |
| MOB-003 | Mobile: camada SQLite nativa (expo-sqlite) + download/cache dos .sqlite | done | 2026-10-08 | developer | high | 2026-10-08 |  | MOB-001 | [MOB-003](../specs/mobile/mob-003-spec.md) |
| MOB-004 | Mobile: componente de mapa nativo (react-native-maps) | done | 2026-10-08 | developer | medium | 2026-10-09 |  | MOB-001 | [MOB-004](../specs/mobile/mob-004-spec.md) |
| MOB-005 | Mobile: ecrãs em falta (Proteção Civil, Hospitais, Transportes, Metro Porto, Serviços Públicos, Código Postal) | done | 2026-10-08 | developer | high | 2026-10-09 |  | MOB-002, MOB-003, MOB-004 | [MOB-005](../specs/mobile/mob-005-spec.md) |
| MOB-006 | Android Auto: corrigir manifest, HostValidator, signing e targetSdk | done | 2026-10-08 | developer | high | 2026-10-08 |  |  | [MOB-006](../specs/mobile/mob-006-spec.md) |
| MOB-007 | Mobile: CI de build Android + publicação em teste interno no Google Play | done | 2026-10-08 | developer | medium | 2026-10-09 |  | MOB-001 | [MOB-007](../specs/mobile/mob-007-spec.md) |
| MOB-008 | Mobile: atualizar rotas da API Aberta (Tempo, EV, Economia, risco de incêndio) | done | 2026-10-09 | developer | high | 2026-10-09 |  |  | [MOB-008](../specs/mobile/mob-008-spec.md) |
| MOB-009 | Mobile: novo ícone e splash (Portugal_Agora.png) + APK de release com nome e versão | done | 2026-10-09 | developer | medium | 2026-10-09 |  |  |  |
| MOB-010 | Combustível (mobile): ordenar postos pela localização do utilizador, com seletor Preço/Distância | done | 2026-10-09 | developer | high | 2026-10-09 |  |  |  |
| MOB-011 | Tempo (mobile): cidade IPMA mais próxima e tempo atual pela localização do utilizador | done | 2026-10-09 | developer | medium | 2026-10-09 |  |  |  |
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
| WEB-012 | Carris: horários programados via GTFS (trips/schedules) | done | 2026-07-15 |  | medium | 2026-10-09 |  | WEB-011 | [WEB-012](../specs/mobile/web-012-spec.md) |
| WEB-013 | Carris: chegadas em tempo real (fetch direto, mantém-se) | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-010 |  |
| WEB-014 | Carris: localização de veículos em tempo real (fetch direto, mantém-se) | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-010 |  |
| WEB-015 | Carris: alertas da rede (desvios, obras, interrupções) | done | 2026-07-15 |  | medium | 2026-10-09 |  | WEB-010 | [WEB-015](../specs/mobile/web-015-spec.md) |
| WEB-016 | Carris: identificação de operadores via GTFS (agency.txt + routes.txt) | done | 2026-07-15 |  | medium | 2026-07-15 |  | WEB-010, WEB-011 |  |
| WEB-017 | Carris: migrar apps (web/mobile/android-auto) para consumir API própria | done | 2026-07-15 |  | high | 2026-07-15 |  | WEB-011, WEB-012, WEB-013, WEB-014, WEB-015, WEB-016 |  |
| WEB-018 | Turismo: integrar SIGTUR/TravelBI (ArcGIS REST) e criar tab/página Turismo | done | 2026-07-17 |  | medium | 2026-07-17 |  |  | [WEB-018](../specs/mobile/web-018-spec.md) |
| WEB-019 | Turismo: integrar ICNF (Áreas Protegidas, Rede Natura 2000, Percursos Pedestres) | done | 2026-07-17 |  | medium | 2026-07-17 |  |  |  |
| WEB-020 | Turismo: validar Agenda Cultural Lisboa/OSM Overpass/Wikidata/UNESCO e integrar UNESCO | done | 2026-07-17 |  | medium | 2026-07-17 |  |  |  |
| WEB-021 | Turismo: enriquecimento on-demand via Wikidata (descrição + foto Wikimedia Commons) | done | 2026-07-19 |  | medium | 2026-07-19 |  |  |  |
| WEB-022 | Metro do Porto: pipeline GTFS->SQLite (WASM) + página de estações/próximas partidas | done | 2026-07-19 |  | medium | 2026-07-19 |  |  |  |
| WEB-023 | Serviços Públicos: PSP/GNR via Overpass (SQLite/WASM) + página perto de mim | done | 2026-07-19 |  | medium | 2026-07-19 |  |  |  |
| WEB-024 | Metro do Porto: corrigir URL do portal (dadosabertos.cm-porto.pt) e seleção do GTFS mais recente | done | 2026-10-08 | developer | high | 2026-10-08 |  |  |  |
| WEB-025 | Tempo: avisos meteorológicos do IPMA via API Aberta (/ipma/warnings) | done | 2026-10-09 | developer | high | 2026-10-09 |  |  | [WEB-025](../specs/mobile/web-025-spec.md) |
| WEB-026 | Proteção Civil: comunicados da ANPC via API Aberta (/anpc/warnings) | done | 2026-10-09 | developer | high | 2026-10-09 |  |  | [WEB-026](../specs/mobile/web-026-spec.md) |
| WEB-027 | Proteção Civil: mapa de focos de incêndio por satélite (NASA FIRMS via /nasafirms/hotspots) | done | 2026-10-09 | developer | medium | 2026-10-09 |  |  | [WEB-027](../specs/mobile/web-027-spec.md) |
| WEB-028 | Web: página Economia (BdP + INE via API Aberta) em vez de ComingSoon | done | 2026-10-09 | developer | high | 2026-10-09 |  |  | [WEB-028](../specs/mobile/web-028-spec.md) |
| WEB-029 | Web: página EV (tarifas CEME + simulador) em vez de ComingSoon | done | 2026-10-09 | developer | medium | 2026-10-09 |  |  | [WEB-029](../specs/mobile/web-029-spec.md) |
| WEB-030 | Economia: gráficos de séries históricas INE/Eurostat (/ine/stats) | done | 2026-10-09 | developer | medium | 2026-10-09 |  | WEB-028 | [WEB-030](../specs/mobile/web-030-spec.md) |
| WEB-031 | Contratos Públicos: nova secção com dados BASE (/base/contracts) | backlog | 2026-10-09 | developer | medium |  |  |  |  |
| WEB-032 | Fundos PRR/PT2030: nova secção (/prr, /pt2030) | backlog | 2026-10-09 | developer | medium |  |  |  |  |
| WEB-033 | Ferramenta: validador de NIF (/nif/validate) | backlog | 2026-10-09 | developer | low |  |  |  |  |
| WEB-034 | Geo: filtro por freguesia (/geo/parishes) | backlog | 2026-10-09 | developer | low |  |  |  |  |
| WEB-035 | Combustível: preços por posto com raio a partir do GPS (/fuel/stations) | backlog | 2026-10-09 | developer | medium |  |  |  |  |
| WEB-036 | Combustível (web): corrigir ordenação por distância (título, destaque, seletor Preço/Distância e raio) | backlog | 2026-10-09 | developer | medium |  |  |  |  |
| WEB-037 | Header: botão para voltar ao Início, à direita na linha Portugal-Hoje, quando fora do menu principal | backlog | 2026-10-09 | developer | medium |  |  |  |  |
| WEB-038 | Código Postal: trocar geoapi.pt por moradas.dev (resolver HTTP 429) | done | 2026-10-09 | developer | high | 2026-10-09 |  |  | [WEB-038](../specs/mobile/web-038-spec.md) |
| WEB-039 | Deploy Pages: passar VITE_APIABERTA_KEY ao build a partir do secret APIABERTA_KEY | done | 2026-10-09 | developer | medium | 2026-10-09 |  |  |  |
<!-- /maestru:work-items-list -->
