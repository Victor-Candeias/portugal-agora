---
maestru: "0.4"
type: work-spec
id: web-064-spec
title: "WEB-064 Spec — Validação da fonte ANACOM"
template: implementation-plan-v1
work-item: mobile/WEB-064
owner: developer
created: 2026-10-20
---

# WEB-064 Spec — Validação da fonte ANACOM

## Overview

Validar a fonte ANACOM `CoberturaQoS_Pub` (https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer) antes de escrever código no core.

**Testes feitos a 2026-10-20 (ponto de partida)**
- **Serviço.** Capacidades `Query,Map,Data`, coordenadas WGS84 (4326), `maxRecordCount` 4000, fonte «ANACOM».
- **Camadas da rede móvel** (grupo 162). São do tipo `Raster Layer`, com os campos `OBJECTID` e `Value`:
  - Global PT 163 → 164 (2G), 167 (4G), 168 (5G);
  - DIGI 169 → 170, 171, 172;
  - MEO 173 → 174, 176, 177;
  - NOS 178 → 179, 180, 181;
  - Vodafone 182 → 183, 186, 187.
- **`query` por ponto.** Erro 400 nas camadas raster.
- **`identify`.** Funciona. Em Lisboa (38.72, -9.14), com `tolerance=1`, `mapExtent=-9.2,38.7,-9.1,38.75` e `imageDisplay=800,600,96`, devolveu `UniqueValue.Pixel Value` (ex.: `1000`, `300`, `100`) e o atributo `Raster.Data da informação: 2026T2`. No oceano (-12, 38.72) devolveu `NoData`.
- **Legenda.**
  - 4G e 5G: ≥1000, ≥300, ≥100, ≥30, ≥2, >0 Mbps, «Não disponível»;
  - 2G: Muito Boa, Boa, Aceitável, Limitada, «Não disponível»;
  - o 5G está marcado como «dados provisórios».
- **`export`.** `f=image`, `format=png32`, `transparent=true`, `layers=show:<id>`, `imageSR=3857`: HTTP 200 `image/png`.
- **WMS.** `GetCapabilities` devolve 400.
- **CORS.** `Access-Control-Allow-Origin` reflete a origem; não é preciso proxy.

**Por confirmar**
- O valor de cada classe, sobretudo «> 0 Mbps», «Não disponível» e as classes do 2G.
- Que a `tolerance` não mistura células vizinhas.
- A semântica de `NoData` e de «Não disponível».
- A licença e a atribuição.

## Implementation

### Phase 1: Metadados e legenda

| Action | File | Details |
|--------|------|---------|
| Inspect | `MapServer?f=pjson`, `/{id}?f=pjson`, `/legend?f=pjson` | Guardar o `drawingInfo.renderer` (`uniqueValueInfos`) de uma camada 2G, 4G e 5G e preencher a tabela valor → classe |

### Phase 2: Pontos de teste

| Action | File | Details |
|--------|------|---------|
| Validate | `identify` vs. geo.anacom.pt | 10 a 20 pontos: Lisboa, Porto, interior (Trás-os-Montes, Alentejo), fronteira de célula, Açores, Madeira, oceano e Espanha. Registar o resultado esperado de cada um |
| Tune | parâmetros `identify` | `tolerance` 0 ou 1 e `mapExtent` pequeno à volta do ponto; documentar a configuração final |

### Phase 3: Licença

| Action | File | Details |
|--------|------|---------|
| Review | termos ANACOM / dados.gov.pt | Reutilização dos dados e das imagens `export`, atribuição e cache. Decisão: avançar ou não com o mapa |

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `.maestru/specs/mobile/web-064-spec.md` | Modify | Registar a tabela de classes, os pontos de teste e a decisão sobre a licença |

## Conclusões (2026-10-20)

### Valor do pixel → classe

O `drawingInfo` das camadas raster vem vazio (`renderer: null`) e a legenda não traz `values`. A correspondência foi confirmada assim: em cada ponto de teste, comparou-se a cor do pixel do `export` (`png32`) com as amostras da `/legend`. Todas as classes observadas coincidiram.

| Tecnologia | Valor | Classe (legenda) | Cor | Estado |
|---|---|---|---|---|
| 4G / 5G | 1000 | ≥ 1000 Mbps (só no 5G) | `#DF73FF` | `covered` |
| 4G / 5G | 300 | ≥ 300 Mbps | `#1CC1DA` | `covered` |
| 4G / 5G | 100 | ≥ 100 Mbps | `#7ED500` | `covered` |
| 4G / 5G | 30 | ≥ 30 Mbps | `#FFFF00` | `covered` |
| 4G / 5G | 2 | ≥ 2 Mbps | `#FFAA00` | `covered` |
| 4G / 5G | 0 < v < 2 | > 0 Mbps (não observado; tratado por limiar) | `#E60000` | `covered` |
| 4G / 5G | 0 | Não disponível | transparente | `not_covered` |
| 2G (voz) | 4 | Muito Boa | `#1CC1DA` | `covered` |
| 2G (voz) | 3 | Boa | `#7ED500` | `covered` |
| 2G (voz) | 2 | Aceitável | `#FFFF00` | `covered` |
| 2G (voz) | 1 | Limitada | `#E60000` | `covered` |
| 2G (voz) | 0 | Não disponível | transparente | `not_covered` |
| todas | `NoData` / sem resultado | — | transparente | `unknown` |

- **Classes do 4G.** A legenda do 4G vai só até «≥ 300 Mbps»; o «≥ 1000 Mbps» existe apenas no 5G.
- **Limiares.** A tradução no 4G e no 5G faz-se por limiar (`v ≥ 1000`, `≥ 300`, …, `> 0`, `= 0`), o que cobre o valor de «> 0 Mbps» seja ele qual for.
- **Formato dos valores.** Vêm como texto e variam entre camadas (`"300.000000"` no Global PT, `"300"` nas operadoras). Usar `Number()`.
- **`0` e `NoData`.**
  - `0` é uma classe explícita dentro da grelha da operadora: há dados e o serviço não está disponível. Fica como `not_covered`.
  - `NoData` aparece fora da grelha (oceano, Espanha). Fica como `unknown`.
  - No mapa oficial, ambos aparecem transparentes.
- **Data de referência.** Só as camadas das operadoras trazem o atributo `Raster.Data da informação: 2026T2`. As do Global PT não o trazem. Extrair a data de qualquer resultado que a tenha.

### «Global PT» não é uma operadora

Em todos os pontos testados, o valor do Global PT é o **máximo das quatro operadoras** (ex.: Montesinho 4G: Global 30, operadoras 2/0/30/2; Corvo 2G: Global 3, operadoras 0/1/3/1). É a cobertura agregada do país. Na UI aparece como «Melhor entre operadoras» e fica fora da comparação e do ranking.

### `identify`

- **Configuração final.** `tolerance=0`, `mapExtent` de ±0,01° à volta do ponto, `imageDisplay=400,400,96`, `returnGeometry=false` e `layers=all:<5 ids>`.
- **Resposta.** Um pedido por tecnologia devolve as 5 camadas, com `UniqueValue.Pixel Value`.
- **Comparação.** Com `tolerance=1` e um `mapExtent` maior, o resultado em Lisboa foi o mesmo. Com `tolerance=0`, o resultado vem só do pixel do ponto e não mistura células vizinhas, cuja grelha tem 100 m.

### Pontos de teste (`identify`, Global/DIGI/MEO/NOS/Vodafone)

| Ponto | 2G | 4G | 5G |
|---|---|---|---|
| Lisboa (38.72, -9.14) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/300/1000/1000/1000 |
| Porto (41.15, -8.61) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/300/1000/1000/1000 |
| Bragança (41.806, -6.757) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/300/1000/1000/1000 |
| Montesinho (41.93, -6.85) | 4/0/1/4/1 | 30/2/0/30/2 | 100/0/0/100/2 |
| Mértola (37.64, -7.66) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/0/1000/1000/1000 |
| Alentejo rural (37.9, -7.9) | 4/4/4/4/4 | 300/100/300/100/100 | 300/0/0/100/300 |
| Serra da Estrela (40.32, -7.61) | 4/2/4/4/4 | 300/100/300/100/100 | 100/0/100/100/100 |
| Gerês (41.80, -8.15) | 4/0/4/4/1 | 100/0/30/100/2 | 100/0/2/100/2 |
| Ponta Delgada (37.74, -25.67) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/100/1000/1000/1000 |
| Corvo (39.70, -31.11) | 3/0/1/3/1 | 30/0/0/30/2 | 100/0/0/100/2 |
| Funchal (32.65, -16.91) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/300/1000/1000/1000 |
| Porto Santo (33.06, -16.34) | 4/4/4/4/4 | 300/100/300/300/300 | 1000/0/300/1000/1000 |
| Oceano (38.72, -12) | NoData | NoData | NoData |
| Badajoz, Espanha (38.88, -6.97) | NoData | NoData | NoData |

- **Grelha.** Uma varredura de 124 pontos em Trás-os-Montes e no Corvo só encontrou os valores da tabela de classes.
- **Ilhas.** As ilhas estão cobertas pela grelha, embora a descrição do dataset fale só de Portugal Continental.

### Licença e atribuição — decisão: **avançar**

- **dados.gov.pt.** O dataset «Cobertura da Rede Móvel de Comunicações Eletrónicas» (ANACOM, trimestral) tem a licença `notspecified`. O recurso publicado é um serviço WMS (`publico/Rede_Móvel`), sem `Fees` nem `AccessConstraints`.
- **Termos do sítio da ANACOM** (`render.jsp?categoryId=140985`). Autorizam a cópia e distribuição para fins **informativos, pessoais e não comerciais**, com:
  - referência ao original;
  - o aviso «Copyright © ANACOM»;
  - nenhuma modificação;
  - notificação à ANACOM.
- **Uso nesta app.** O projeto é local, pessoal e não comercial, por isso o uso cabe nos termos:
  - consulta em direto do `identify` e do `export`;
  - imagens mostradas sem alterações, só com a opacidade ajustável;
  - sem redistribuir nem guardar em cache para lá da cache do browser e do React Query;
  - atribuição «Fonte: ANACOM · © ANACOM» com ligação para geo.anacom.pt.
- **Publicação.** Antes de qualquer publicação pública ou uso comercial, é preciso notificar a ANACOM ou pedir autorização por escrito.
- **Cache.** A cache dos resultados fica limitada a 24 h, porque a fonte é atualizada todos os trimestres.
