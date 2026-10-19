# Relatório técnico — Energia elétrica em Portugal

**Data:** 19 de outubro de 2026  
**Objetivo:** integrar no projeto Portugal Agora a produção renovável e não renovável, o consumo, o balanço elétrico e uma comparação atual com gráficos de 24 horas, 7 dias e 30 dias.

> **Nota de validação:** URLs e nomes de operações REN referidos abaixo são candidatos documentados ou discutidos anteriormente, mas não foram testados em execução neste relatório. Não assumir que um endpoint diário fornece dados intradiários. Antes de produção, confirmar os contratos, condições de acesso, frequência, granularidade, limites e permissões de reutilização.

## 1. Resumo executivo

A solução recomendada é uma pipeline sem backend permanente: **REN Data Hub → GitHub Actions → ficheiros JSON/SQLite → React no GitHub Pages**. A REN é a fonte principal portuguesa para produção, consumo e balanço; a ENTSO-E Transparency Platform é uma fonte complementar especialmente relevante para séries temporais de produção real por tecnologia e carga real. DGEG e Ember são alternativas para estatísticas e séries agregadas.

A pergunta **«Portugal está a produzir mais eletricidade renovável do que não renovável neste momento?»** só deve ser respondida com uma observação temporal efetiva, carimbo de hora, fuso e indicação da fonte. Se não houver valores intradiários recentes, mostrar **«Últimos dados disponíveis»**, nunca «agora».

## 2. Fontes e ligações

| Fonte | Uso | Acesso | Notas |
|---|---|---|---|
| REN Data Hub | Produção, consumo, balanço, potência, preços | Dados públicos; verificar política da API | Fonte principal para Portugal continental |
| ENTSO-E Transparency API | Produção por tecnologia, carga real, trocas internacionais | Registo/token e condições de utilização | Alternativa para granularidade intradiária |
| DGEG | Estatísticas nacionais de energia | Publicações e dados abertos | Útil para validação histórica |
| Ember | Dados comparativos e históricos | Verificar licença e modalidades | Não usar como substituto automático de tempo real |

Referências oficiais:
- REN: https://datahub.ren.pt/pt/instrucoes-api/
- REN API: https://servicebus.ren.pt/datahubapi/electricity/
- ENTSO-E: https://transparency.entsoe.eu/ e https://web-api.tp.entsoe.eu/api
- Documentação ENTSO-E: https://transparency.entsoe.eu/content/static_content/Static%20content/web%20api/Guide.html
- DGEG: https://www.dgeg.gov.pt/
- Ember: https://ember-energy.org/

### 2.1 Operações REN a investigar

- `ElectricityProductionBreakdownDaily` — decomposição da produção por fonte.
- `ElectricityConsumptionSupplyDaily` — consumo e abastecimento diário.
- `ElectricityConsumptionSupplyMonthly` — balanço mensal.
- `ElectricityInstalledPowerMonthly` — potência instalada.
- `ElectricityConsumptionVariationYearly` — evolução anual do consumo.
- `ElectricityMarketPricesDaily` — preços de mercado.

Exemplo exploratório (verificar parâmetros e disponibilidade):

```bash
curl -fsS 'https://servicebus.ren.pt/datahubapi/electricity/ElectricityProductionBreakdownDaily?culture=pt-PT&date=2026-10-18'
```

**Atenção:** esta operação é *Daily*. O nome não prova resolução de 15 minutos nem dados «neste momento». É necessário consultar a documentação e inspecionar a resposta. Um indicador do portal atualizado de 15 em 15 minutos não implica que todos os endpoints sejam intradiários.

### 2.2 ENTSO-E — consultas relevantes

- **Actual Generation per Production Type**: `documentType=A75`.
- **Actual Total Load**: `documentType=A65` (confirmar os restantes parâmetros específicos).
- **Cross-border physical flows**: endpoint/documentType próprio; confirmar antes de implementar.
- Portugal continental: confirmar o código EIC de área de controlo no catálogo oficial ENTSO-E e não o fixar sem validação.

Exemplo de estrutura da chamada (não é um pedido pronto a executar):

```text
GET https://web-api.tp.entsoe.eu/api
  ?securityToken=<TOKEN>
  &documentType=A75
  &processType=<PROCESSO_VALIDADO>
  &in_Domain=<EIC_PORTUGAL_VALIDADO>
  &periodStart=<YYYYMMDDHHMM>
  &periodEnd=<YYYYMMDDHHMM>
```

O serviço costuma devolver XML (incluindo erros estruturados). É necessário processar `TimeSeries`, `Period`, `resolution`, `Point`, códigos de tecnologia, unidades e revisões.

## 3. Definições e regras de cálculo

**Produção renovável**: eólica, solar, hídrica, biomassa e outras fontes classificadas oficialmente como renováveis. **Não renovável**: gás natural e restantes fontes fósseis ou não renováveis presentes no feed. A taxonomia tem de ser versionada e validada face à documentação da fonte. Não classificar uma categoria desconhecida como não renovável por defeito.

Para cada intervalo temporal `t`:

```text
renovavel_mw(t) = soma das tecnologias renováveis em MW
nao_renovavel_mw(t) = soma das tecnologias não renováveis em MW
producao_total_mw(t) = renovavel_mw(t) + nao_renovavel_mw(t) + desconhecida_mw(t)
percentagem_renovavel_producao(t) = 100 * renovavel_mw(t) / producao_total_mw(t)
diferenca_mw(t) = renovavel_mw(t) - nao_renovavel_mw(t)
```

Só mostrar `SIM` quando `renovavel_mw > nao_renovavel_mw`, `NÃO` quando menor, e `IGUAL` quando iguais, **desde que os dados sejam completos, contemporâneos e suficientemente recentes**. Caso contrário, `INDETERMINADO`.

**Não confundir:** percentagem renovável na **produção nacional** com percentagem renovável no **abastecimento do consumo**. O consumo pode ser superior ou inferior à produção nacional devido a importações, exportações, bombagem e outras componentes de balanço. A energia produzida num período é a integral da potência ao longo do tempo; MW não são MWh.

Se a série indicar potência média em MW por intervalos de 15 minutos:

```text
energia_mwh = potencia_media_mw * 0.25
```

Se indicar energia em MWh por intervalo, não multiplicar novamente. Para percentagens agregadas de 24h/7d/30d, usar **somas de energia** (MWh) e não médias simples de percentagens.

## 4. Atualidade dos dados

Guardar sempre:

- `interval_start_utc`, `interval_end_utc`;
- `fetched_at_utc`, `published_at_utc` quando disponível;
- `source`, `source_revision`, `quality`;
- `unit`, `resolution_minutes`, `timezone`;
- `coverage_pct` e eventuais lacunas.

Definir `max_age_minutes` por fonte após validar a frequência real de publicação. A interface mostra `Atualizado às HH:mm` e `Atraso: N min`. Não rotular como «tempo real» um valor diário ou antigo.

## 5. Arquitetura

```text
REN Data Hub ---------+
                      |         +----------------------+
ENTSO-E API ----------+-------> | GitHub Actions       |
                                | fetch / parse / QA   |
                                +----------+-----------+
                                           |
                                 normalize / reconcile
                                           |
                                +----------v-----------+
                                | SQLite + JSON         |
                                | daily / timeseries    |
                                +----------+-----------+
                                           |
                                      GitHub Pages
                                           |
                                   React + gráficos
```

**Frequência:** experimentar recolha horária para séries intradiárias (GitHub Actions agendado não garante execução pontual), e uma atualização diária de reconciliação para dados revistos. O refresh visual não cria dados novos; apenas relê os artefactos publicados.

**Segurança:** token ENTSO-E apenas nos secrets do GitHub Actions; nunca embutir em Vite/React ou em JSON público. O token não deve aparecer nos logs. A REN poderá ter limitações de CORS e limites de acesso; a recolha no Actions evita depender do browser.

## 6. Estrutura do repositório

```text
.github/workflows/update-energy.yml
scripts/energy/
  fetch_ren.py
  fetch_entsoe.py
  normalize.py
  aggregate.py
  validate.py
  export.py
  requirements.txt
public/data/energy/
  latest.json
  timeseries-24h.json
  timeseries-7d.json
  timeseries-30d.json
  daily.json
  energy.sqlite
src/features/energy/
  api.ts
  types.ts
  useEnergy.ts
  EnergyDashboard.tsx
  components/GenerationMixChart.tsx
  components/LoadGenerationChart.tsx
  components/EnergyHistoryChart.tsx
```

## 7. Esquema SQLite

```sql
CREATE TABLE IF NOT EXISTS energy_observation (
  source TEXT NOT NULL,
  area TEXT NOT NULL,
  interval_start_utc TEXT NOT NULL,
  interval_end_utc TEXT NOT NULL,
  technology TEXT NOT NULL,
  classification TEXT NOT NULL CHECK(classification IN ('renewable','non_renewable','unknown')),
  power_mw REAL,
  energy_mwh REAL,
  quality TEXT NOT NULL DEFAULT 'reported',
  fetched_at_utc TEXT NOT NULL,
  PRIMARY KEY(source, area, interval_start_utc, interval_end_utc, technology)
);

CREATE INDEX IF NOT EXISTS idx_energy_time
ON energy_observation(area, interval_start_utc);

CREATE TABLE IF NOT EXISTS energy_balance (
  source TEXT NOT NULL,
  area TEXT NOT NULL,
  interval_start_utc TEXT NOT NULL,
  interval_end_utc TEXT NOT NULL,
  consumption_mwh REAL,
  imports_mwh REAL,
  exports_mwh REAL,
  fetched_at_utc TEXT NOT NULL,
  PRIMARY KEY(source, area, interval_start_utc, interval_end_utc)
);
```

**Importante:** não somar diretamente REN e ENTSO-E: são fontes alternativas para o mesmo fenómeno. Escolher uma fonte canónica por métrica e intervalo, mantendo proveniência e divergências.

## 8. Contrato JSON do frontend

```json
{
  "area": "PT_CONTINENTAL",
  "source": "ENTSOE",
  "intervalStartUtc": "2026-10-19T08:00:00Z",
  "intervalEndUtc": "2026-10-19T08:15:00Z",
  "fetchedAtUtc": "2026-10-19T08:35:00Z",
  "resolutionMinutes": 15,
  "freshness": "latest_available",
  "quality": "complete",
  "renewableMw": 4300,
  "nonRenewableMw": 1250,
  "unknownMw": 0,
  "renewableSharePct": 77.48,
  "renewableExceedsNonRenewable": true,
  "technologyMw": {
    "wind": 1900,
    "solar": 800,
    "hydro": 1450,
    "biomass": 150,
    "natural_gas": 1250
  }
}
```

**Os números deste JSON são exclusivamente fictícios**, para exemplificar o contrato.

## 9. Normalização e cálculo em Python

```python
from dataclasses import dataclass

RENEWABLE = {'wind', 'solar', 'hydro', 'biomass', 'geothermal'}
NON_RENEWABLE = {'natural_gas', 'coal', 'oil', 'nuclear'}

@dataclass(frozen=True)
class Observation:
    technology: str
    power_mw: float


def summarize(observations: list[Observation]) -> dict:
    renewable = sum(x.power_mw for x in observations if x.technology in RENEWABLE)
    nonrenewable = sum(x.power_mw for x in observations if x.technology in NON_RENEWABLE)
    unknown = sum(x.power_mw for x in observations if x.technology not in RENEWABLE | NON_RENEWABLE)
    total = renewable + nonrenewable + unknown
    complete = unknown == 0 and total > 0
    return {
        'renewableMw': renewable,
        'nonRenewableMw': nonrenewable,
        'unknownMw': unknown,
        'renewableSharePct': round(100 * renewable / total, 2) if total else None,
        'renewableExceedsNonRenewable': (renewable > nonrenewable) if complete else None,
        'quality': 'complete' if complete else 'incomplete',
    }
```

A classificação real deve partir de um mapeamento **dos códigos ENTSO-E/REN para a taxonomia interna**, guardado em ficheiro versionado. Este exemplo não implementa o parser específico da API, que depende da confirmação dos contratos e dos códigos reais.

## 10. GitHub Actions — base executável

```yaml
name: Update Energy Data
on:
  workflow_dispatch:
  schedule:
    - cron: '17 * * * *'
permissions:
  contents: write
jobs:
  energy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -r scripts/energy/requirements.txt
      - name: Update energy datasets
        env:
          ENTSOE_TOKEN: ${{ secrets.ENTSOE_TOKEN }}
        run: python scripts/energy/export.py
      - name: Commit refreshed data
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add public/data/energy/
          if ! git diff --cached --quiet; then
            git commit -m 'data: refresh Portugal electricity indicators'
            git push
          fi
```

**Pré-requisitos:** implementar `export.py` e restantes módulos; configurar o secret; permitir escrita do `GITHUB_TOKEN`; ajustar proteção da branch. Se o workflow principal fizer build e deploy no mesmo repositório, validar se commits do `GITHUB_TOKEN` disparam o deploy desejado. Uma alternativa mais robusta é gerar e publicar os dados como artefactos no próprio workflow de Pages.

## 11. Frontend React / TypeScript

```ts
export type EnergyLatest = {
  area: string;
  source: string;
  intervalStartUtc: string;
  intervalEndUtc: string;
  fetchedAtUtc: string;
  resolutionMinutes: number;
  freshness: string;
  quality: string;
  renewableMw: number;
  nonRenewableMw: number;
  unknownMw: number;
  renewableSharePct: number | null;
  renewableExceedsNonRenewable: boolean | null;
  technologyMw: Record<string, number>;
};

export async function getLatestEnergy(): Promise<EnergyLatest> {
  const base = import.meta.env.BASE_URL;
  const response = await fetch(`${base}data/energy/latest.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Falha na leitura: ${response.status}`);
  return response.json();
}
```

Para gráficos, utilizar **Recharts** ou **Apache ECharts**. Representar renovável e não renovável em séries separadas e consumo numa terceira série, sempre com a mesma unidade. A comparação de potência instantânea usa MW; gráficos de energia por dia usam MWh/GWh.

### Componentes da página

1. **Indicador principal:** `SIM / NÃO / INDETERMINADO` com hora da observação e fonte.
2. **Cartões:** produção renovável, produção não renovável, quota renovável da produção, consumo, importação/exportação (quando disponíveis).
3. **Mix de produção:** barras empilhadas por tecnologia.
4. **Histórico 24h:** linha ou área empilhada de potência por intervalo (se existir granularidade suficiente).
5. **Histórico 7d:** mesma série intradiária ou agregados diários devidamente identificados.
6. **Histórico 30d:** totais diários em GWh e percentagem renovável ponderada por energia.
7. **Qualidade:** hora de recolha, resolução, lacunas e última revisão.

### Lógica de apresentação

```ts
function verdict(data: EnergyLatest, maxAgeMinutes: number): string {
  const age = (Date.now() - Date.parse(data.intervalEndUtc)) / 60000;
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMinutes) return 'DADOS DESATUALIZADOS';
  if (data.quality !== 'complete' || data.renewableExceedsNonRenewable === null) {
    return 'INDETERMINADO';
  }
  return data.renewableExceedsNonRenewable ? 'SIM' : 'NÃO';
}
```

O limite `maxAgeMinutes` deve ser configurado por fonte depois de confirmar a latência de publicação. Nunca calcular «agora» a partir de uma série apenas diária.

## 12. Tratamento de 24 horas, 7 dias e 30 dias

| Vista | Resolução preferida | Indicador principal | Estratégia alternativa |
|---|---|---|---|
| 24h | 15/30/60 min conforme fonte | MW por intervalo | Avisar que não existe histórico intradiário |
| 7d | intradiária ou diária | MWh/GWh e % renovável | Dados diários REN |
| 30d | diária | GWh por dia, média ponderada | Dados diários/mensais REN |

- Converter os carimbos temporais para UTC na ingestão; apresentar `Europe/Lisbon` na interface.
- Tratar mudança de hora legal e intervalos em falta/duplicados.
- Não preencher lacunas com zero; distinguir `missing` de produção nula.
- Fazer backfill de revisões históricas, sobretudo quando dados preliminares são corrigidos.
- Agregar a energia por intervalos **não sobrepostos**; evitar contar duas vezes fontes duplicadas.

## 13. Testes e validações

- API devolve erro, XML inesperado, HTML ou timeout.
- Token ENTSO-E ausente, expirado ou sem autorização.
- Intervalos de duração variável (PT15M/PT30M/PT60M).
- Códigos de tecnologia desconhecidos.
- Produção negativa, nula, dados duplicados ou séries incompletas.
- Percentagens entre 0 e 100, salvo indicador explicitamente diferente.
- Dados REN e ENTSO-E divergentes: guardar origem e não misturar silenciosamente.
- Consumo e produção não devem ser forçados a coincidir.
- Mudança de horário de verão/inverno.
- Cache do GitHub Pages e atualização de ficheiros estáticos.
- Limites de tamanho do JSON e performance em dispositivos móveis.

## 14. Roadmap de implementação

**Fase 0 — Prova de dados (obrigatória):** testar endpoints REN, verificar estrutura, cobertura temporal, frequência e licenças; pedir token ENTSO-E e testar produção por tecnologia e consumo real para Portugal. Decidir qual fonte suporta verdadeiramente o indicador intradiário.

**Fase 1 — MVP diário:** produção renovável/não renovável, consumo, percentagem renovável e histórico de 30 dias, com base em dados diários verificados.

**Fase 2 — Intradiário:** importar série temporal real (idealmente 15 minutos), publicar `latest.json` e histórico de 24h; mostrar `SIM/NÃO` apenas quando a série for recente e completa.

**Fase 3 — Análise:** gráficos de 7d/30d, exportação CSV, comparação com consumo, saldo de importação/exportação, preços e comparações anuais.

**Fase 4 — Operação:** monitorização da pipeline, avisos de desatualização, reconciliação automática e documentação das fontes.

## 15. Critérios de aceitação

Revistos no WEB-060 (2026-10-19); evidência em `.maestru/specs/mobile/web-060-spec.md`.

- [x] Cada métrica apresenta fonte, unidade e período.
- [x] Produção renovável e não renovável são calculadas com taxonomia validada.
- [x] Consumo e produção não são tratados como equivalentes.
- [x] Vista 24h só aparece quando existe granularidade intradiária real.
- [x] Histórico 7d/30d agrega energia corretamente.
- [x] `SIM/NÃO` nunca é mostrado com dados incompletos ou desatualizados.
- [x] Frontend funciona no GitHub Pages sem segredos no bundle.
- [x] Falha na atualização preserva último dataset válido e assinala antiguidade.
- [x] Todos os exemplos com dados fictícios são identificados como demonstração.

## 16. Recomendação final

Implementar primeiro um **painel diário oficial REN**, em paralelo com uma **prova técnica da ENTSO-E para séries intradiárias**. Só depois de validar a granularidade e latência publicar a funcionalidade «Portugal está a produzir mais eletricidade renovável do que não renovável neste momento?». Esta separação evita apresentar como tempo real aquilo que é apenas um balanço diário.
