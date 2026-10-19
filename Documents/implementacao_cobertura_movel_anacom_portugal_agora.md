# Portugal Agora — Implementação de cobertura móvel com dados ANACOM

**Versão:** 1.0  
**Data:** 19-10-2026  
**Objetivo:** implementar a funcionalidade **«Qual é a melhor cobertura móvel na minha localização?»** com dados públicos oficiais, distinguindo claramente cobertura prevista de desempenho real.

> **Nota de validação:** os endpoints abaixo são pontos de partida. Antes de publicar, confirmar em tempo real o catálogo, IDs de camadas, campos, sistema de coordenadas, periodicidade, licenças e suporte das operações `query`/`identify`. Não assumir que todas as camadas fornecem velocidades ou consultas por ponto.

## 1. Âmbito do MVP

- Selecionar localização no mapa ou usar geolocalização com consentimento.
- Comparar MEO, NOS, Vodafone e DIGI quando existirem dados disponíveis.
- Filtrar por tecnologia: 2G, 4G e 5G, conforme camadas publicadas.
- Apresentar cobertura prevista, fonte e data de referência.
- Mostrar velocidades **potenciais/estimadas** apenas quando os atributos oficiais as suportarem.
- Explicar que cobertura não garante sinal, débito ou qualidade em interiores.
- Apresentar estado `sem dados` separado de `sem cobertura`.

### Fora do MVP

- Medições reais de velocidade, latência e disponibilidade.
- Previsões de sinal em interiores.
- Ranking de qualidade real sem dados de medições comparáveis.
- Consulta indiscriminada de antenas como prova de cobertura.

## 2. Fonte oficial

**Catálogo ArcGIS REST ANACOM:**

```text
https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer?f=pjson
```

**Portal:** https://geo.anacom.pt/

O serviço deve ser inspecionado dinamicamente. Os IDs e nomes das camadas podem mudar e não devem ser fixados com base em suposições.

### Inspeção do serviço

```bash
curl -fsSL 'https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer?f=pjson' -o anacom-service.json
```

Inspecionar `layers`, `spatialReference`, `capabilities`, `serviceDescription`, `copyrightText` e metadados associados. Para cada camada selecionada:

```text
GET https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer/{LAYER_ID}?f=pjson
```

Confirmar `fields`, `geometryType`, `capabilities`, `advancedQueryCapabilities`, `extent`, `maxRecordCount`, `drawingInfo` e eventuais datas/metadados. Registar num catálogo interno a associação entre operador, tecnologia e ID real da camada.

## 3. Estratégia de acesso aos dados

### Opção A — Query espacial (preferida se suportada)

Se a camada disponibilizar `Query` e geometria compatível, consultar por ponto em WGS84:

```http
GET /MapServer/{LAYER_ID}/query
    ?f=geojson
    &geometry={"x":-9.14,"y":38.72,"spatialReference":{"wkid":4326}}
    &geometryType=esriGeometryPoint
    &spatialRel=esriSpatialRelIntersects
    &inSR=4326
    &outSR=4326
    &outFields=*
    &returnGeometry=false
```

Este é um **modelo de pedido**, não uma garantia de que a camada concreta suporta GeoJSON, ponto ou os campos pretendidos. Caso não suporte `f=geojson`, experimentar `f=json` e normalizar a resposta Esri.

### Opção B — Identify

Quando o serviço suportar `identify`, pode ser possível identificar as camadas que intersectam o ponto. Os parâmetros exigidos incluem tipicamente `geometry`, `geometryType`, `sr`, `layers`, `tolerance`, `mapExtent`, `imageDisplay` e `f`. Construir o pedido a partir das capacidades e documentação ArcGIS aplicáveis; não presumir que uma resposta vazia significa ausência de cobertura.

### Opção C — Dados descarregáveis / tiles

Se não houver consultas espaciais adequadas, verificar serviços WMS/WMTS, ficheiros abertos oficiais ou exportações permitidas. Pré-processar polígonos/raster e publicar uma camada consultável própria, respeitando os termos de reutilização.

## 4. Arquitetura recomendada

```text
Frontend Portugal Agora
  ├── Mapa (Leaflet / MapLibre)
  ├── Geolocalização com consentimento
  └── Comparação de operadoras
              |
              v
Backend /api/mobile-coverage
  ├── Validação de coordenadas
  ├── Catálogo de camadas ANACOM
  ├── Adaptador ArcGIS REST
  ├── Normalização dos resultados
  ├── Cache e controlo de erros
  └── Metadados de atualização
              |
              v
ANACOM ArcGIS REST / datasets oficiais
```

Não é obrigatório usar MongoDB ou Redis no MVP. Uma cache em memória pode bastar num único processo; para múltiplas instâncias, considerar Redis. Para dados geoespaciais descarregados e pesquisas locais, avaliar PostgreSQL/PostGIS.

## 5. API interna proposta

### `GET /api/mobile-coverage/point`

Parâmetros:

| Parâmetro | Tipo | Exemplo | Regra |
|---|---|---|---|
| `lat` | number | `38.72` | -90 a 90 |
| `lon` | number | `-9.14` | -180 a 180 |
| `technology` | string | `5G` | Apenas valores do catálogo |

Exemplo de resposta **ilustrativa** (valores fictícios):

```json
{
  "location": { "lat": 38.72, "lon": -9.14 },
  "technology": "5G",
  "source": {
    "name": "ANACOM",
    "service": "CoberturaQoS_Pub",
    "referenceDate": null,
    "checkedAt": "2026-10-19T21:00:00Z"
  },
  "operators": [
    {
      "name": "MEO",
      "status": "covered",
      "coverageType": "predicted",
      "potentialDownloadMbps": null,
      "potentialUploadMbps": null,
      "layerId": 0
    },
    {
      "name": "NOS",
      "status": "unknown",
      "coverageType": "predicted",
      "potentialDownloadMbps": null,
      "potentialUploadMbps": null,
      "layerId": null
    }
  ],
  "disclaimer": "Cobertura prevista; não representa uma medição real de velocidade ou sinal."
}
```

`layerId: 0` é apenas um exemplo fictício; nunca atribuir este ID à MEO sem confirmação do catálogo.

Estados normalizados: `covered`, `not_covered`, `unknown`, `source_unavailable`. Usar `not_covered` apenas quando a semântica oficial dos dados permitir concluir ausência de cobertura; ausência de feição pode significar simplesmente falta de dados.

### `GET /api/mobile-coverage/metadata`

Devolver catálogo de operadores/tecnologias, camadas verificadas, campos disponíveis, data de referência, última sincronização e estado da fonte. Permite desativar filtros indisponíveis no frontend.

## 6. Exemplo de implementação — TypeScript / Node.js

O código seguinte ilustra a consulta a uma camada **previamente validada**. A transformação do resultado deve ser ajustada aos campos reais.

```ts
type ArcGisQueryResult = {
  features?: Array<{ attributes?: Record<string, unknown> }>;
  error?: { code?: number; message?: string; details?: string[] };
};

const BASE =
  'https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer';

export async function queryLayerAtPoint(
  layerId: number,
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<ArcGisQueryResult> {
  if (!Number.isInteger(layerId) || layerId < 0) throw new Error('Invalid layer');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('Invalid latitude');
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error('Invalid longitude');

  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    outFields: '*',
    returnGeometry: 'false'
  });

  const response = await fetch(`${BASE}/${layerId}/query?${params}`, { signal });
  if (!response.ok) throw new Error(`ANACOM HTTP ${response.status}`);

  const body = (await response.json()) as ArcGisQueryResult;
  if (body.error) throw new Error(`ANACOM ArcGIS: ${body.error.message ?? 'error'}`);
  return body;
}
```

**Atenção:** confirmar previamente que a camada é consultável e que a geometria/semântica da interseção são adequadas. Não converter `features.length === 0` automaticamente em `not_covered`.

### Mapeamento configurável

```ts
type LayerConfig = {
  operator: 'MEO' | 'NOS' | 'Vodafone' | 'DIGI';
  technology: '2G' | '4G' | '5G';
  layerId: number;
  coverageField?: string;
  downloadPotentialField?: string;
  uploadPotentialField?: string;
  referenceDateField?: string;
};

// Preencher somente após inspecionar metadados e validar valores reais.
const layerCatalog: LayerConfig[] = [];
```

O normalizador deve usar as unidades documentadas. Não interpretar valores em kbps como Mbps nem valores de classe como velocidades absolutas. Se não houver campo de velocidade, devolver `null` e ocultar a métrica.

## 7. Comparação: «Qual é a melhor cobertura na minha localização?»

A palavra **melhor** deve ter definição transparente:

1. Identificar operadores com cobertura prevista para a tecnologia selecionada.
2. Se existirem velocidades potenciais **comparáveis, com a mesma metodologia e data de referência**, ordenar por esse indicador e identificá-lo como potencial.
3. Se só existir informação binária de cobertura, apresentar operadores com cobertura, **sem inventar ranking**.
4. Se os dados forem incompletos, indicar «comparação indisponível» ou «informação insuficiente».
5. Oferecer seleção 4G/5G e legenda da fonte, data e limitações.

Exemplo de texto de interface:

> «Na localização selecionada, os dados oficiais indicam cobertura 5G prevista para as seguintes operadoras: […]. Esta informação não garante a velocidade ou a qualidade real da ligação.»

Se houver velocidades potenciais oficiais, mostrar «velocidade potencial reportada» e nunca «velocidade que vais obter».

## 8. Cache e atualização trimestral

**Periodicidade trimestral:** usar como hipótese operacional a confirmar nos metadados oficiais; não assumir atualização efetiva num dia fixo.

Estratégia:

- Cache de metadados: TTL inicial de 24 h, com atualização em background.
- Cache de consultas por ponto: TTL inicial de 7 dias, ajustável segundo o volume e a política da fonte.
- Chave de cache: versão do dataset + tecnologia + operador + coordenadas normalizadas.
- Evitar arredondar coordenadas de forma que altere a resposta em limites de cobertura. Preferir células geográficas com resolução validada ou guardar consultas exatas quando necessário.
- Ao detetar uma nova versão/data de referência do dataset, invalidar as entradas antigas.
- Aplicar `stale-while-revalidate` apenas quando o frontend identifica claramente a data dos dados.
- Backoff exponencial em erros 429/5xx e timeout controlado; nunca fazer polling agressivo.
- Monitorizar alterações no catálogo e no esquema das camadas.

**Importante:** `checkedAt` é a hora da consulta à fonte; `referenceDate` é a data dos dados publicados. Não são equivalentes.

## 9. Frontend — UX

- Botão «Usar a minha localização», com pedido explícito de permissão.
- Alternativa: pesquisa de morada/localidade e toque no mapa.
- Filtro 2G/4G/5G e seleção por operadora.
- Camadas geográficas com legenda e opacidade ajustável.
- Tabela de comparação com cobertura, velocidade potencial (quando disponível), fonte e data.
- Aviso: «Cobertura prevista, não medição real. Pode variar em interiores e consoante o equipamento.»
- Estados visuais distintos: cobertura, sem cobertura confirmada, sem dados e fonte temporariamente indisponível.
- Interface acessível: informação também em texto, sem depender apenas de cores.

## 10. Segurança, privacidade e licenciamento

- Não guardar coordenadas precisas do utilizador em logs por defeito.
- Não associar histórico de localizações a contas sem necessidade e base legal.
- HTTPS, validação de inputs, limites de pedidos e timeout no backend.
- Se forem usados dados/tiles da ANACOM, confirmar licenciamento, atribuição, limites de acesso, política de cache e eventuais obrigações de indicação da fonte.
- Mostrar «Fonte: ANACOM» e a data de referência quando disponíveis, segundo as condições aplicáveis.
- Rever RGPD e política de privacidade se houver geolocalização ou analytics.

## 11. Testes e critérios de aceitação

| Cenário | Resultado esperado |
|---|---|
| Local com cobertura documentada | `covered` e fonte visível |
| Local sem cobertura confirmada | `not_covered` apenas se inferência permitida |
| Ponto fora do âmbito da camada | `unknown` |
| Fonte indisponível | `source_unavailable` e erro controlado |
| Camada sem velocidade | Campo `null`, sem velocidade inventada |
| Alteração do ID da camada | Catálogo atualizado, sem falha silenciosa |
| Dataset novo | Cache invalidada por versão |
| Utilizador nega localização | Seleção manual continua disponível |
| Ponto perto de fronteira de polígonos | Resultado verificado contra visualização oficial |

## 12. Plano de implementação

### Fase 1 — Descoberta e validação

1. Consultar o endpoint do serviço e guardar metadados.
2. Identificar camadas efetivas por operador/tecnologia.
3. Confirmar operações espaciais suportadas e campos de velocidades.
4. Validar 10–20 coordenadas contra o mapa oficial, incluindo fronteiras e locais sem dados.
5. Confirmar termos de uso, atribuição e data de referência.

### Fase 2 — Backend

1. Criar catálogo configurável de camadas.
2. Implementar adaptador ArcGIS REST com timeout e tratamento de erros.
3. Implementar normalização e estados semânticos.
4. Publicar endpoints `/point` e `/metadata`.
5. Adicionar cache e métricas de erros/latência.

### Fase 3 — Frontend

1. Adicionar secção «Cobertura móvel».
2. Implementar localização manual ou autorizada.
3. Apresentar comparação por tecnologia e operadora.
4. Adicionar mapa, legenda, data de referência e avisos.

### Fase 4 — Operação

1. Agendar verificação diária dos metadados.
2. Detetar alterações trimestrais de versão/publicação.
3. Invalidar cache e executar testes de regressão.
4. Monitorizar disponibilidade e alterações de esquema.

## 13. Evoluções futuras

- Mapas de cobertura com tiles oficiais ou pré-processados.
- Comparação por freguesia, concelho e distrito, **apenas** quando a resolução e a metodologia dos dados suportarem agregação estatística.
- Histórico de versões oficiais para visualizar evolução da cobertura.
- Cruzamento com medições reais provenientes de fonte independente, devidamente identificada.
- Exportação CSV/GeoJSON dos resultados, quando autorizada pela licença.

## 14. Referências para validação

- ANACOM — GEO.ANACOM: https://geo.anacom.pt/
- ANACOM — ArcGIS REST CoberturaQoS_Pub: https://geo.anacom.pt/server/rest/services/publico/CoberturaQoS_Pub/MapServer?f=pjson
- Portal de dados abertos: https://dados.gov.pt/
- ArcGIS REST API — Map Service: https://developers.arcgis.com/rest/services-reference/enterprise/map-service/
- ArcGIS REST API — Query (Map Service/Layer): https://developers.arcgis.com/rest/services-reference/enterprise/query-map-service-layer/

---

**Princípio de produto:** comunicar o que os dados oficiais permitem concluir, sem apresentar estimativas de cobertura como medições reais e sem classificar uma operadora como «melhor» quando os dados não sustentam essa comparação.
