# Portugal Agora — Integração com a API do Portal da Transparência do SNS

## 1. Objetivo

Implementar no **Portugal Agora** um módulo de indicadores de urgência hospitalar baseado nos dados oficiais publicados no Portal da Transparência do SNS. A primeira versão deve mostrar **indicadores históricos e agregados**, com filtros por região e período e gráficos de evolução. **Não apresentar estes indicadores como tempos de espera em tempo real por hospital.**

## 2. Fonte de dados

- Portal: https://transparencia.sns.gov.pt/
- API Explore v2.1: https://transparencia.sns.gov.pt/api/explore/v2.1/
- Catálogo: https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets
- Dataset candidato: `atividade-sindrome-gripal-csh`
- Consulta de amostra: https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets/atividade-sindrome-gripal-csh/records?limit=10

**Validação obrigatória:** antes de implementar, confirmar no catálogo se o dataset está ativo, a sua descrição, os nomes reais dos campos, a granularidade, as datas cobertas, a periodicidade, as licenças e os indicadores disponíveis. O dataset de síndrome gripal não representa necessariamente a totalidade das urgências hospitalares. Não extrapolar os valores para todos os hospitais nem para todos os episódios.

## 3. Funcionalidades do MVP

1. Lista de indicadores efetivamente disponíveis no dataset.
2. Seleção de região, indicador e intervalo (7, 30, 90 dias ou personalizado).
3. Gráfico temporal e tabela de valores com data e unidade.
4. Data da última observação e data da última sincronização, claramente distintas.
5. Mensagens de ausência de dados, atraso na publicação e indisponibilidade da fonte.
6. Link para a origem oficial e nota metodológica.

**Fora do MVP:** espera atual por hospital, previsões clínicas, recomendação de hospital, alertas de urgência e triagem de sintomas.

## 4. Arquitetura proposta

```text
Portal da Transparência SNS (Explore API v2.1)
    |
    v
Coletor agendado (backend ou GitHub Actions)
    |-- consulta catálogo e metadados
    |-- pagina registos
    |-- valida campos e unidades
    |-- regista erros e atualização
    v
Armazenamento normalizado (SQLite/PostgreSQL/JSON estático)
    |
    v
API própria / ficheiros JSON publicados
    |
    v
Portugal Agora (filtros, tabela, gráficos, atribuição)
```

Se o Portugal Agora for um site estático, uma opção simples é executar o coletor periodicamente com GitHub Actions e publicar JSON versionado. Para um backend existente, preferir um job agendado com cache e API própria. Evitar que todos os visitantes consultem diretamente a API oficial a cada interação.

## 5. Exploração inicial da API

### 5.1 Verificar os metadados do dataset

```bash
curl -fSL 'https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets/atividade-sindrome-gripal-csh' \
  -H 'Accept: application/json'
```

Inspecionar `fields`, `metas`, `dataset_id`, licenças, última modificação e os valores realmente disponíveis.

### 5.2 Consultar os primeiros registos

```bash
curl -fSL 'https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets/atividade-sindrome-gripal-csh/records?limit=10' \
  -H 'Accept: application/json'
```

Resposta típica da API Explore (estrutura genérica):

```json
{
  "total_count": 123,
  "results": [
    { "campo_data": "2026-01-01", "campo_indicador": "...", "campo_valor": 42.5 }
  ]
}
```

**Os nomes `campo_data`, `campo_indicador` e `campo_valor` são ilustrativos; não são um contrato confirmado do dataset.**

### 5.3 Paginação e filtragem

A API Explore v2.1 suporta parâmetros como `limit`, `offset`, `select`, `where`, `order_by` e `group_by`, mas a utilização concreta depende do esquema do dataset. Consultar o endpoint `/records` e a documentação antes de construir filtros. Para volumes elevados, preferir exportação oficial, se disponível, em vez de paginação profunda. Respeitar limites, respostas HTTP 429 e política de utilização.

## 6. Modelo de dados interno

```typescript
export interface SnsEmergencyObservation {
  sourceDataset: string;
  regionCode: string | null;
  regionName: string;
  indicatorCode: string;
  indicatorName: string;
  observationDate: string; // YYYY-MM-DD
  value: number;
  unit: string;            // ex.: min, episódios
  granularity: 'day' | 'week' | 'month' | 'unknown';
  sourceUpdatedAt?: string;
  ingestedAt: string;
}
```

Chave lógica recomendada: `(sourceDataset, regionCode, indicatorCode, observationDate, granularity)`; acrescentar dimensões adicionais caso o dataset as exija. Preservar os dados brutos ou um hash para auditoria e detetar correções retroativas.

## 7. Exemplo de coletor em Node.js / TypeScript

O exemplo seguinte demonstra a obtenção de metadados e registos. **A transformação para o modelo interno deve ser implementada depois de confirmar os campos reais.**

```typescript
const BASE = 'https://transparencia.sns.gov.pt/api/explore/v2.1';
const DATASET = 'atividade-sindrome-gripal-csh';

type RecordsPage = { total_count: number; results: Record<string, unknown>[] };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`SNS API HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function main() {
  const datasetUrl = `${BASE}/catalog/datasets/${DATASET}`;
  const recordsUrl = `${datasetUrl}/records?limit=20`;
  const metadata = await getJson<Record<string, unknown>>(datasetUrl);
  const page = await getJson<RecordsPage>(recordsUrl);
  console.log('Metadados:', JSON.stringify(metadata, null, 2));
  console.log('Total:', page.total_count);
  console.log('Exemplo:', JSON.stringify(page.results[0] ?? null, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
```

Para produção, adicionar retry com backoff apenas para falhas transitórias, controlo de concorrência, validação de esquema (por exemplo, Zod), paginação/exportação, testes, persistência e métricas. Não fazer retries ilimitados.

## 8. API interna sugerida

```http
GET /api/sns/urgencias/indicadores
GET /api/sns/urgencias/regioes
GET /api/sns/urgencias/series?indicator=tempo-espera&region=lisboa&days=30
GET /api/sns/urgencias/metadata
```

Exemplo de resposta **interna** (não é o formato oficial da API SNS):

```json
{
  "indicator": "tempo-espera",
  "region": "lisboa",
  "unit": "min",
  "isRealTime": false,
  "source": "Portal da Transparência do SNS",
  "sourceDataset": "atividade-sindrome-gripal-csh",
  "lastObservationDate": "2026-01-01",
  "lastSyncAt": "2026-01-02T08:00:00Z",
  "points": [{ "date": "2026-01-01", "value": 42.5 }]
}
```

Todos os valores e datas do exemplo são fictícios.

## 9. Interface no Portugal Agora

**Página:** Saúde → Urgências → Indicadores do SNS.

- Cabeçalho: «Indicadores de urgência hospitalar».
- Aviso permanente: «Dados estatísticos publicados pelo SNS. Não representam a espera atual num hospital.»
- Filtros: indicador, região, intervalo.
- Cartão: última observação disponível, valor e unidade.
- Gráfico de linhas: série temporal, com indicação de períodos sem dados.
- Tabela acessível: data, região, indicador, valor, unidade.
- Rodapé: fonte, ligação para dataset, metodologia e data de sincronização.

Evitar cores ou classificações como «urgência mais rápida» sem dados oficiais comparáveis e atualizados. Não preencher lacunas com zeros; usar valores nulos e sinalização explícita.

## 10. Atualização, cache e desempenho

- Sincronização inicial sugerida: **1 vez por dia**, ajustável à periodicidade real da publicação.
- Guardar `lastSuccessfulSyncAt`, `lastAttemptAt`, `sourceLastModified` e erros.
- Aplicar cache na API própria e no cliente.
- Reprocessar uma janela recente (por exemplo, 30 dias) para incorporar revisões retroativas.
- Em caso de falha, manter último conjunto válido, assinalando que pode estar desatualizado.
- Não confundir «última sincronização» com «última data dos dados».

## 11. Segurança, licenciamento e privacidade

- Confirmar licença e regras de atribuição de cada dataset antes de republicar.
- Apresentar hiperligação visível para o Portal da Transparência do SNS e para o dataset concreto.
- Usar HTTPS, timeouts, validação de dados e limitação de pedidos.
- Não recolher dados pessoais de saúde dos utilizadores; este módulo trabalha com estatísticas públicas agregadas.
- Se futuramente houver autenticação, guardar segredos no backend ou no sistema de CI, nunca no JavaScript público.

## 12. Avisos de saúde e responsabilidade

Os indicadores históricos não devem orientar decisões clínicas ou a escolha de um serviço de urgência. Apresentar uma nota clara: **«Em situação de emergência, ligue 112. Para orientação em situações não emergentes, contacte SNS 24 — 808 24 24 24.»**

## 13. Testes e critérios de aceitação

- [ ] O catálogo e o dataset estão acessíveis e os campos reais foram documentados.
- [ ] Indicadores, unidades e regiões são extraídos sem pressupostos incorretos.
- [ ] O coletor lida com erros HTTP, timeouts, limites e alterações de esquema.
- [ ] Registos duplicados e revisões são tratados corretamente.
- [ ] Datas, fusos horários e agregações estão validados.
- [ ] Os gráficos distinguem ausência de dados de valor zero.
- [ ] A interface indica claramente que os dados **não são em tempo real**.
- [ ] Atribuição e licença foram verificadas.
- [ ] Existe monitorização da última sincronização bem-sucedida.
- [ ] O site mantém dados anteriores quando a origem está temporariamente indisponível.

## 14. Plano de implementação

**Fase 1 — Descoberta:** testar catálogo e dataset, documentar esquema, licença e periodicidade. Confirmar se existem datasets mais adequados para o objetivo de tempos de espera.

**Fase 2 — Ingestão:** criar coletor, validação, persistência e atualização agendada.

**Fase 3 — API interna:** publicar indicadores, regiões, séries e metadados.

**Fase 4 — Frontend:** filtros, gráfico, tabela, fontes e estados de erro.

**Fase 5 — Produção:** monitorização, testes de qualidade, revisão de licenças e acessibilidade.

## 15. Evolução futura

Uma integração de **tempos atuais por hospital e prioridade Manchester** deve ser tratada como módulo independente, sujeito à identificação de uma fonte oficial com API, licença, granularidade e atualização verificadas. Não reutilizar um dataset histórico regional como se fornecesse espera hospitalar em tempo real.

---

**Referências principais:**

- Portal da Transparência do SNS: https://transparencia.sns.gov.pt/
- API Explore v2.1: https://transparencia.sns.gov.pt/api/explore/v2.1/
- Dataset candidato: https://transparencia.sns.gov.pt/explore/dataset/atividade-sindrome-gripal-csh/

*Documento de arquitetura e implementação. Os endpoints devem ser validados em ambiente real antes da entrada em produção.*
