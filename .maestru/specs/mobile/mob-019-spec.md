---
maestru: "0.4"
type: work-spec
id: mob-019-spec
title: "MOB-019 Spec — Previsão a 5 dias (open-data IPMA)"
template: implementation-plan-v1
work-item: mobile/MOB-019
owner: developer
created: 2026-10-11
---

# MOB-019 Spec — Previsão a 5 dias (open-data IPMA)

## Overview

A rota `/v1/ipma/forecasts` da API Aberta só tem 3 dias. A previsão do mobile passa a vir do open-data do IPMA, que tem 5 dias por cidade, não precisa de chave e permite CORS. É um pedido por cidade (a escolhida na tab Tempo, Lisboa no Início), e a lista de locais vem do `distrits-islands.json`.

## Implementation

1. **Core (`packages/core/src/api/ipma.ts`):**
   - `IPMA_WEATHER_TYPES`: `idWeatherType` → descrição PT, tirada de `open-data/weather-type-classe.json`.
   - `IpmaLocation` + `parseIpmaLocations()`: `globalIdLocal`/`local`/`latitude`/`longitude` → `cityId`/`cityName`/`district`/coordenadas numéricas.
   - `parseIpmaDailyForecast()`: dias do `cities/daily/{id}.json` → `IpmaDailyForecast[]` (o mesmo tipo que a API Aberta). Temperaturas e probabilidade de precipitação arredondadas; `windSpeed` = `classWindSpeed`.
   - `ipmaClient.getLocations()` e `ipmaClient.getCityForecast(cityId)`.
2. **Mobile (`apps/mobile/hooks/useTempo.ts`):** `useIpmaLocations()` (cache 24 h) e `useIpmaCityForecast(cityId)` (cache 1 h) substituem `useIpmaForecasts()`.
3. **Tab Tempo:** os chips e a cidade mais próxima usam `useIpmaLocations()`, e a previsão é a da cidade selecionada. Loading e erro tratados para os dois pedidos, e o botão Atualizar refaz ambos.
4. **Início:** o cartão Tempo usa `useIpmaCityForecast(DEFAULT_CITY_ID)`.
5. `ApiAbertaClient.getIpmaForecasts()` fica no core, mas o mobile deixa de o usar.
6. O Android Auto fica como está: já usa o open-data e mostra 4 dias (`take(4)`, limite de linhas do `PaneTemplate`).

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/api/ipma.ts` | modify | Tipos de tempo, locais e previsão diária do open-data |
| `apps/mobile/hooks/useTempo.ts` | modify | `useIpmaLocations`, `useIpmaCityForecast` |
| `apps/mobile/app/(tabs)/tempo.tsx` | modify | Locais + previsão a 5 dias da cidade selecionada |
| `apps/mobile/app/(tabs)/index.tsx` | modify | Cartão Tempo com a previsão de Lisboa do open-data |
| `README.md` | modify | Fonte da previsão do tempo |
