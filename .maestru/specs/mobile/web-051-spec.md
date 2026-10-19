---
maestru: "0.4"
type: work-spec
id: web-051-spec
title: "WEB-051 Spec — Prova de dados ENTSO-E"
template: research-v1
work-item: mobile/WEB-051
owner: developer
created: 2026-10-19
---

# WEB-051 Spec — Prova de dados ENTSO-E

## Question

A ENTSO-E Transparency Platform serve o indicador intradiário «Portugal está a produzir mais eletricidade renovável do que não renovável agora?» e as séries de 24 h e 7 d? Que parâmetros, área, códigos, resolução e latência tem, e qual deve ser a fonte canónica de cada métrica?

**Critério de sucesso:** respostas reais da API, sem o token, para A75, A65, fluxos e preços. **Fora do âmbito:** código de produção (WEB-057).

## Research

Testes de 2026-10-19 (20:03 UTC), com o token do utilizador (`TRANSPARENCT_ENTSOE_TOKEN` em `apps/web/.env`, ignorado pelo git).

### Pedidos

- **Base:** `GET https://web-api.tp.entsoe.eu/api`.
- **Token:** o cabeçalho `SECURITY_TOKEN: <token>` funciona, por isso o token nunca entra no URL nem nos logs de URL. Em alternativa, há o parâmetro `securityToken`.
- **Área:** Portugal tem o EIC `10YPT-REN------W` (zona de licitação e área de controlo REN). Espanha, a única fronteira, é `10YES-REE------0`.
- **Datas:** `periodStart`/`periodEnd` no formato `yyyyMMddHHmm` UTC.

| Consulta | Parâmetros | Resposta | Resolução | Unidade |
|----------|------------|----------|-----------|---------|
| Produção real por tipo (16.1.B&C) | `documentType=A75&processType=A16&in_Domain=10YPT-REN------W` | 200, 15 `TimeSeries`, 43 KB por 25 h, cerca de 15 s | PT60M | MW (`MAW`) |
| Carga real total (6.1.A) | `documentType=A65&processType=A16&outBiddingZone_Domain=10YPT-REN------W` | 200, 1 série, cerca de 16 s | PT60M | MW |
| Fluxos físicos (12.1.G) ES→PT | `documentType=A11&in_Domain=10YPT-REN------W&out_Domain=10YES-REE------0` | 200, cerca de 21 s | PT15M | MW |
| Fluxos físicos PT→ES | `documentType=A11&in_Domain=10YES-REE------0&out_Domain=10YPT-REN------W` | 200, cerca de 34 s | PT15M | MW |
| Preços day-ahead (12.1.D) | `documentType=A44&in_Domain=…&out_Domain=10YPT-REN------W` | 200, cerca de 53 s | PT15M | EUR/MWh |
| Token inválido | — | **401** `Acknowledgement_MarketDocument` | — | — |
| Sem dados (período futuro) | — | **200** `Acknowledgement_MarketDocument`, `Reason/code` **999** («No matching data found…») | — | — |

Os tempos de resposta são lentos (15 a 53 s). O pipeline precisa de timeouts largos (120 s) e de pouca concorrência.

### Estrutura XML

- **Documentos:** `GL_MarketDocument` (A75, A65) e `Publication_MarketDocument` (A11, A44).
- **Hierarquia:** `TimeSeries` → `Period` (`timeInterval/start|end` em UTC, `resolution`) → `Point` (`position`, `quantity` ou `price.amount`).
- **`curveType` A03** em todas as séries (*variable sized block*):
  - os pontos repetidos são omitidos, e um valor vale da sua posição até à posição do ponto seguinte; o último ponto vale até ao fim do `Period`;
  - por exemplo, o carvão (B05) vem com um só ponto (`position 1 = 0`) para as 25 h;
  - não se deve ler como «pontos em falta».
- **A75:**
  - as séries com `inBiddingZone_Domain` são **produção**;
  - as séries com `outBiddingZone_Domain` são **consumo** das unidades (bombagem B10 e consumos auxiliares) e não entram na produção.
- **Resolução:** hoje é PT60M em A75 e A65, mas os fluxos e preços já vêm em PT15M. O parser deve aceitar qualquer `PTnM` e agregar a intervalos de 60 min.
- **Mudança de hora:** os períodos vêm em UTC, por isso não há etiquetas locais repetidas.

### Códigos PSR vistos em Portugal

B01, B04, B05, B10, B11, B12, B16, B18, B19 e B20.

| PSR | Descrição ENTSO-E | Tecnologia interna | Classificação |
|-----|-------------------|--------------------|---------------|
| B01 | Biomass | `biomass` | renovável |
| B02 | Fossil Brown coal/Lignite | `coal` | não renovável |
| B03 | Fossil Coal-derived gas | `other_thermal` | não renovável |
| B04 | Fossil Gas | `natural_gas` | não renovável |
| B05 | Fossil Hard coal | `coal` | não renovável |
| B06 / B07 | Fossil Oil / Oil shale | `oil` | não renovável |
| B08 | Fossil Peat | `other_thermal` | não renovável |
| B09 | Geothermal | `geothermal` | renovável |
| B10 | Hydro Pumped Storage | `storage` | armazenamento |
| B11 / B12 | Hydro Run-of-river / Water Reservoir | `hydro` | renovável |
| B13 | Marine | `wave` | renovável |
| B14 | Nuclear | `nuclear` | não renovável |
| B15 | Other renewable | `other_renewable` (nova) | renovável |
| B16 | Solar | `solar` | renovável |
| B17 | Waste | `other_thermal` | não renovável (conservador: a fração renovável não vem separada) |
| B18 / B19 | Wind Offshore / Onshore | `wind` | renovável |
| B20 | Other | `other_thermal` | não renovável (em PT é sobretudo cogeração térmica, como `OUTRA_TERMICA` da REN) |
| B25 | Energy storage | `storage` | armazenamento |

Os códigos fora desta tabela passam a `unknown:<PSR>` e o intervalo fica `incomplete` (nunca não renovável por omissão).

### Latência

- Às 20:03 UTC, o último intervalo publicado em A75 e A65 era 18:00–19:00 UTC, ou seja, cerca de **64 min** depois do fim do intervalo.
- Com recolha de hora a hora (cron `:20`) e os atrasos do cron do GitHub, a idade máxima esperada ronda os 140 min.
- **Proposta:** `maxAgeMinutes` = **180** para a ENTSO-E. A REN diária mantém 2880.

### Reconciliação com a REN (dia 2026-10-18)

ENTSO-E: soma de MW × h dos pontos A03 expandidos. REN: balanço diário publicado.

| Métrica | ENTSO-E | REN | Nota |
|---------|---------|-----|------|
| Renovável | 106,8 GWh | 107 GWh | Eólica 80,2, solar 15,4, biomassa 7,3, hídrica 3,9 |
| Não renovável | 16,1 GWh | 16 GWh | Gás 16,0 e B20 0,1 |
| Armazenamento | 9,2 GWh (B10) | 15 GWh | A REN inclui baterias e outra definição de bombagem: **não comparar** |
| Carga/consumo | 122 GWh | 121 GWh | A65 é a carga total; a REN é o consumo referido à rede |

A diferença na renovável e na não renovável fica abaixo de 1%. A hídrica difere por definição: a REN publica-a líquida da bombagem, a ENTSO-E bruta. As fontes são coerentes, mas não somáveis.

### Condições de utilização

- Não foi possível abrir as páginas oficiais dos termos (erros 400 e 404).
- **Decisão conservadora:**
  - publicar só produção (A75), carga (A65) e fluxos (A11), sempre com a atribuição «ENTSO-E Transparency Platform»;
  - **não publicar preços day-ahead (A44)**: costumam ter restrições de reutilização dos NEMO;
  - o utilizador deve confirmar os termos antes de alargar o âmbito.

### Becos sem saída

- **Preços da REN** (`ElectricityMarketPricesDaily`): 404 desde 2026-09 (WEB-050).
- **Preços ENTSO-E:** tecnicamente disponíveis, mas excluídos pelas condições de reutilização.

## Recommendation

**Usar a ENTSO-E como fonte canónica do intradiário:**
- produção por tecnologia (A75), carga (A65) e trocas com Espanha (A11), agregadas a 60 min em MW;
- a REN continua a ser a fonte canónica do balanço diário e dos 30 dias.

**Razões:** a REN não tem série intradiária na API pública (WEB-050), e a ENTSO-E tem cerca de 1 h de latência e coincide com a REN em menos de 1% nos totais diários.

**Próximos passos (WEB-057):**
- secret `TRANSPARENCT_ENTSOE_TOKEN` (mesmo nome no `.env` e no GitHub), enviado no cabeçalho `SECURITY_TOKEN`;
- parser A03 genérico, taxonomia `entsoe-psr@1` no core e recolha de hora a hora;
- reconciliação diária com a REN no `status.json` (WEB-060), sem misturar as fontes.

**Riscos em aberto:**
- a API é lenta (até cerca de 1 min por pedido);
- o token pode expirar ou ser revogado: o pipeline republica o último dataset;
- os termos de reutilização estão por confirmar;
- uma mudança para PT15M é suportada pelo parser.
