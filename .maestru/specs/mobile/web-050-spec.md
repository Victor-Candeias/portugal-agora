---
maestru: "0.4"
type: work-spec
id: web-050-spec
title: "WEB-050 Spec — Prova de dados REN Data Hub"
template: research-v1
work-item: mobile/WEB-050
owner: developer
created: 2026-10-19
---

# WEB-050 Spec — Prova de dados REN Data Hub

## Question

A API pública da REN Data Hub serve (a) o MVP diário do painel de energia (produção renovável e não renovável, consumo, mix e 30 dias) e (b) o indicador intradiário «mais renovável do que não renovável agora?»? Que operações usa o WEB-053?

Fora do âmbito: ENTSO-E (WEB-051) e gás natural.

## Research

Testes feitos a 2026-10-19 (cerca das 12:30, hora de Lisboa) com `curl` e com o `fetch` do Node 24.

### Documentação oficial

<https://datahub.ren.pt/pt/instrucoes-api/>. Base: `https://servicebus.ren.pt/datahubapi/electricity/<Operação>`.

| Operação | Parâmetros | Resultado (2026-10-18) |
|---|---|---|
| `ElectricityConsumptionSupplyDaily` | `culture`, `date=AAAA-MM-DD` | 200, JSON `[{ daily_Accumulation, type }]`, 27 tipos, **GWh inteiros** |
| `ElectricityProductionBreakdownDaily` | `culture`, `date` | 200, JSON Highcharts (`xAxis.categories`, `series[].data`), **MW de 15 em 15 min**, ~28 KB, `Content-Type: text/plain` |
| `ElectricityConsumptionSupplyMonthly` | `culture`, `year`, `month` | 200, `[{ monthly_Accumulation, type }]`, GWh |
| `ElectricityInstalledPowerMonthly` | `culture`, `year`, `month` | 200, `[{ monthly_Accumulation, type }]`, MW instalados |
| `ElectricityConsumptionVariationYearly` | `culture`, `year` | 200, consumo mensal (GWh) e variações (%) |
| `ElectricityMarketPricesDaily` | `culture`, `date` | 404 `No data available` para 2026-09 e 2026-10; 200 para 2025-01-25 (24 preços horários em €/MWh) |
| `ElectricityMarketPricesMonthly` | `culture`, `year`, `month` | 200, preços médios PT/ES (€/MWh) |

- `culture` só aceita `pt-PT` e `en-US` (400 com mensagem JSON para os outros valores).
- Erros em JSON `{ "message": … }`: data inválida → 400 (`Invalid date format…`); dia sem dados ou futuro → 404 (`No data found for the selected date.` / `No data available`).
- **Sem autenticação**, sem limites de pedidos observados (35 pedidos seguidos, 40–360 ms cada).
- **Sem CORS**: as respostas não trazem `Access-Control-Allow-Origin`, por isso o browser não pode chamar a API. A recolha tem de ser feita no pipeline (WEB-053), como estava previsto.
- O `Invoke-WebRequest` do PowerShell deu timeout e resposta truncada no `ProductionBreakdownDaily`; o `curl` e o `fetch` do Node funcionam (~0,3 s).

### Balanço diário (`ElectricityConsumptionSupplyDaily`)

Exemplo real de 2026-10-18 (GWh): `CONSUMO` 121, `PRODUCAO_TOTAL` 131, `PRODUCAO_RENOVAVEL` 100, `PRODUCAO_NAO_RENOVAVEL` 16, `PRODUCAO_ARMAZENAMENTO` 15, `EOLICA` 80, `SOLAR` 15, `HIDRICA` −3, `BIOMASSA` 7, `ONDAS` 0, `GAS_NATURAL` 16, `OUTRA_TERMICA` 0, `IMPORTACAO` 25, `EXPORTACAO` 3, `SALDO_IMPORTADOR` 22, `CONSUMO_BOMBAGEM` 31, `CONSUMO_BATERIAS` 0, `INJECAO_BATERIAS` 0, `CONSUMO_ARMAZENAMENTO` 31, `CORRIGIDO_TEMPERATURA` 122.

- Identidade: `PRODUCAO_TOTAL = PRODUCAO_RENOVAVEL + PRODUCAO_NAO_RENOVAVEL + PRODUCAO_ARMAZENAMENTO` (100 + 16 + 15 = 131).
- `PRODUCAO_RENOVAVEL ≈ EOLICA + SOLAR + HIDRICA + BIOMASSA + ONDAS` (99 vs 100: arredondamento dos inteiros).
- `PRODUCAO_NAO_RENOVAVEL ≈ GAS_NATURAL + OUTRA_TERMICA (+ CARVAO)`.
- `HIDRICA` é a hídrica **sem** o turbinamento de água bombeada, que a REN põe à parte em `PRODUCAO_ARMAZENAMENTO` (nem renovável nem não renovável). Por isso a `HIDRICA` pode ser **negativa** (−3 a 2026-10-18).
- Os subcomponentes `*_COGERACAO`, `*_OUTROS`, `*_CICLO_COMBINADO` e `PRODUCAO_BOMBAGEM` já estão incluídos nos totais por tecnologia (não somar).
- Tipos estáveis desde 2020: 25 tipos em 2020–2021 (com `CARVAO`), 27 em 2024–2026 (sem `CARVAO`, com `ONDAS`, `CONSUMO_BATERIAS`, `INJECAO_BATERIAS`). O parser tem de aceitar tipos em falta e tratar tipos novos como desconhecidos.
- Cobertura histórica: pelo menos desde 2020-01-15 (muito mais do que os 30 dias pedidos).
- Os valores vêm sempre inteiros (0 em 5 dias seguidos com decimais), o que dá uma precisão de ±0,5 GWh por tipo.

### Repartição da produção (`ElectricityProductionBreakdownDaily`)

- 96 pontos de 15 min (`00:00` a `23:45`), em **hora local de Lisboa**, `yAxis` em **MW** (potência média do quarto de hora).
- Mudança de hora: 92 pontos a 2026-03-29 (salta de `00:45` para `02:00`), 100 pontos a 2025-10-26 (`01:00`–`01:45` repetidos). A conversão para UTC tem de ser feita pela posição do ponto, não pela etiqueta.
- Séries: `Consumo + Armazenamento`, `Consumo`, `Bombagem`, `Hídrica`, `Solar`, `Importação`, `Exportação`, `Eólica`, `Gás Natural`, `Outra Térmica`, `Biomassa`, `Carvão`, `Ondas`, `Consumo Baterias`, `Injeção de Baterias`.
- Bate com o balanço diário: integrando os MW × 0,25 h dá `Consumo` 121,20 GWh, `Eólica` 80,18, `Solar` 14,66, `Gás Natural` 16,01, `Biomassa` 7,31, `Importação` 21,68.
- A série `Hídrica` (13,08 GWh) é **bruta**: inclui o turbinamento de água bombeada (≈ `HIDRICA` + `PRODUCAO_ARMAZENAMENTO` = 12). Não dá para separar a hídrica renovável de 15 em 15 minutos.

### Atualidade

- O dia corrente não existe (`date=2026-10-19` → 404 às 12:30). O dia anterior completo já estava publicado. A hora exata de publicação do D-1 não foi medida.
- **A REN não tem dados intradiários do próprio dia**: só serve o «último dia completo».
- Revisões: não foi possível medir numa sessão. Mitigação: o pipeline volta a pedir os 30 dias em cada execução.
- `max_age_minutes` proposto para o balanço diário: **2880** (48 h depois do fim do dia), o que tolera o atraso de publicação e o cron diário, que não é pontual.

### Licença e condições de uso

- <https://datahub.ren.pt/pt/termos-legais-e-condicoes-gerais/>: não há licença aberta. O aviso legal proíbe reproduzir ou distribuir os conteúdos sem consentimento e «extrair e/ou reutilizar a totalidade ou uma parte substancial» das bases de dados. Também diz que a informação é agregada e não é garantida.
- A API é pública e documentada, sem registo. Republicar 30 dias de agregados diários com a fonte identificada é uma extração pequena, mas **não está explicitamente autorizado**.

### Opções para o MVP diário

| Abordagem | Prós | Contras | Esforço | Risco |
|---|---|---|---|---|
| A. `ConsumptionSupplyDaily` (balanço oficial) | Classificação renovável e não renovável da própria REN; armazenamento separado; consumo, importação e exportação no mesmo pedido; 1 pedido/dia (~1,4 KB) | GWh inteiros; `HIDRICA` pode ser negativa | Baixo | Baixo |
| B. `ProductionBreakdownDaily` integrado (15 min → dia) | Precisão a 0,1 MW; dá o perfil do dia | Hídrica bruta (inclui bombagem): sobrestima o renovável cerca de 15%; 28 KB/dia | Médio | Médio (classificação errada) |
| C. Misturar A (classificação) com B (mix) | Mix preciso | Duas fontes para a mesma métrica, totais que não batem com o mix | Alto | Médio |

## Recommendation

**Usar o `ElectricityConsumptionSupplyDaily` como fonte canónica do MVP diário (opção A).**

- **WEB-052 (taxonomia `ren-daily`, v1):**
  - renováveis: `EOLICA`→`wind`, `SOLAR`→`solar`, `HIDRICA`→`hydro`, `BIOMASSA`→`biomass`, `ONDAS`→`wave`;
  - não renováveis: `GAS_NATURAL`→`natural_gas`, `CARVAO`→`coal`, `OUTRA_TERMICA`→`other_thermal`;
  - armazenamento: `PRODUCAO_ARMAZENAMENTO`→`storage`, numa classe própria `storage` (nem renovável nem não renovável, mas conta na produção total);
  - balanço: `CONSUMO`, `IMPORTACAO`, `EXPORTACAO`, `SALDO_IMPORTADOR`, `CONSUMO_ARMAZENAMENTO`, `CORRIGIDO_TEMPERATURA`;
  - subcomponentes e totais: ignorados ou só usados para validação;
  - qualquer outro tipo: `unknown`.
- **WEB-053:** pedir os últimos 30 dias (mais 1–2 dias de margem) em cada execução, a partir de ontem (hora de Lisboa). Validar a soma das tecnologias contra `PRODUCAO_RENOVAVEL` e `PRODUCAO_NAO_RENOVAVEL` (tolerância de 0,5 GWh por parcela).
- **Indicador intradiário (b):** a REN **não** o suporta, porque não publica o dia corrente. O `ProductionBreakdownDaily` dá um perfil de 15 min do dia anterior, que pode alimentar um gráfico «último dia completo» no WEB-057. O «agora» continua a precisar da ENTSO-E (WEB-051).
- Preços (`ElectricityMarketPricesDaily`) ficam fora do MVP: sem dados recentes (404 desde, pelo menos, 2026-09).
- A interface identifica sempre a fonte («REN Data Hub»), a unidade (GWh) e o dia, com o rótulo «Últimos dados disponíveis».

**Riscos em aberto:**

- **Licença:** o aviso legal da REN não autoriza explicitamente a republicação. Recomenda-se pedir consentimento por escrito à REN; até lá, publicar só agregados diários de 30 dias, com a fonte.
- Hora de publicação do D-1 e revisões por medir: ver no WEB-060.
- O contrato não é versionado (Highcharts/JSON sem esquema): o parser falha de forma explícita e mantém o último dataset válido.
