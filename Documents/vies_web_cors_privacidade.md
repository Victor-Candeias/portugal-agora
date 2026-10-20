# VIES na versão Web — Limitações de CORS e proteção do NIF

## 1. Problema identificado

Na versão web da aplicação, a consulta direta ao VIES (VAT Information Exchange System) a partir do browser pode falhar devido à política de **Cross-Origin Resource Sharing (CORS)**. O serviço VIES não disponibiliza necessariamente os cabeçalhos CORS necessários para permitir chamadas JavaScript diretamente a partir da origem da aplicação.

Mensagem apresentada atualmente:

> Nesta versão web, o VIES não responde diretamente ao browser (sem CORS) e não usamos intermediários para não enviar o NIF a terceiros. Consulte o nome e a morada no portal oficial ou na app mobile.

## 2. Causa técnica

- Os browsers aplicam a política de mesma origem e verificam os cabeçalhos CORS nas respostas de pedidos entre origens.
- Se o endpoint VIES não autorizar a origem da aplicação, o browser impede o JavaScript de aceder à resposta.
- Esta limitação é do contexto browser; não significa, por si só, que o serviço VIES esteja indisponível.
- A aplicação móvel nativa pode utilizar uma integração HTTP própria, sem a mesma imposição de CORS do browser, embora continue sujeita à disponibilidade e às condições do serviço.

## 3. Privacidade e segurança

O NIF/NIPC é um identificador fiscal que deve ser tratado com cuidado. Utilizar um proxy público ou serviço CORS de terceiros pode divulgar a esse intermediário o identificador consultado, além de metadados do pedido.

**Decisão atual:** não utilizar proxies CORS públicos ou intermediários externos não aprovados para contornar a restrição.

Nota: uma consulta ao VIES implica necessariamente transmitir o identificador ao próprio serviço VIES. A restrição aqui descrita pretende evitar destinatários adicionais não controlados.

## 4. Alternativas de implementação

### Opção A — Manter consulta manual no portal oficial (solução imediata)

1. Apresentar uma explicação curta sobre a indisponibilidade da consulta automática na web.
2. Disponibilizar um link para o portal oficial: https://ec.europa.eu/taxation_customs/vies/
3. Permitir ao utilizador introduzir o identificador diretamente no portal.
4. Evitar incluir o NIF em parâmetros de URL ou sistemas de analytics.

**Vantagens:** implementação simples, sem infraestrutura adicional nem exposição do NIF a proxies de terceiros.

**Limitações:** o nome e a morada não são preenchidos automaticamente na aplicação web; a informação devolvida pelo VIES pode variar conforme o Estado-Membro.

### Opção B — Backend próprio para consulta VIES (recomendação para evolução)

Arquitetura proposta:

```text
Browser (HTTPS)
    |
    | POST /api/v1/vat/validate
    | { "countryCode": "PT", "vatNumber": "123456789" }
    v
Backend próprio (HTTPS, autenticação e controlo de acesso)
    |
    | Pedido ao serviço oficial VIES
    v
VIES / Comissão Europeia
    |
    v
Backend: normalização e minimização da resposta
    |
    v
Browser: validade e dados disponíveis
```

O backend é operado pela própria aplicação, não por um proxy público de terceiros. Continua a existir transmissão ao serviço oficial VIES, indispensável para a validação.

**Controlos necessários:**

- Validar e normalizar país e identificador fiscal antes do pedido.
- Aplicar autenticação quando adequada, rate limiting, timeout e proteção contra abuso.
- Nunca incluir o NIF completo em logs, métricas, traces, URLs ou mensagens de erro.
- Usar HTTPS e guardar segredos apenas no servidor.
- Definir política de retenção e evitar persistir consultas sem necessidade.
- Tratar indisponibilidade, timeout e respostas inconclusivas como estados distintos de «inválido».
- Confirmar condições de utilização, requisitos de proteção de dados e formato da interface oficial antes de implementar.

Exemplo de contrato **interno proposto** (não é o contrato oficial do VIES):

```http
POST /api/v1/vat/validate
Content-Type: application/json

{
  "countryCode": "PT",
  "vatNumber": "123456789"
}
```

Resposta ilustrativa:

```json
{
  "status": "valid",
  "countryCode": "PT",
  "name": null,
  "address": null,
  "checkedAt": "2026-10-19T22:00:00Z",
  "source": "VIES"
}
```

`name` e `address` devem ser opcionais: a validação de um número não garante a disponibilização destes campos.

### Opção C — Consulta através da app móvel

Manter a funcionalidade na app nativa, desde que a integração existente esteja validada e respeite os requisitos de segurança e privacidade. Não assumir que uma WebView elimina o problema de CORS.

## 5. Experiência de utilização recomendada

Texto sugerido para a versão web:

> **Consulta VIES indisponível nesta versão web.** O serviço oficial não permite a consulta direta a partir do browser devido a restrições CORS. Para proteger o seu NIF, não recorremos a proxies externos. Pode efetuar a consulta no portal oficial VIES ou utilizar a aplicação móvel. A disponibilização de nome e morada depende da resposta do serviço.

A interface deve distinguir claramente:

- **Não consultado:** a aplicação não conseguiu realizar o pedido.
- **Válido:** o VIES confirmou a validade do identificador.
- **Inválido:** o VIES respondeu que o identificador não é válido para a consulta efetuada.
- **Indisponível / inconclusivo:** não foi possível obter uma resposta conclusiva.

Não apresentar uma falha CORS como «NIF inválido».

## 6. Plano de implementação

| Fase | Trabalho | Resultado |
|---|---|---|
| 1 | Melhorar a mensagem web e adicionar link oficial | Solução imediata, sem backend |
| 2 | Confirmar interfaces e condições oficiais do VIES | Requisitos técnicos e legais validados |
| 3 | Implementar endpoint no backend próprio | Consulta controlada a partir da web |
| 4 | Adicionar validações, rate limiting, timeouts e proteção de logs | Segurança e resiliência |
| 5 | Testar números válidos, inválidos, falhas e dados ausentes | Comportamento previsível |
| 6 | Monitorizar apenas métricas agregadas, sem NIF | Observabilidade com minimização de dados |

## 7. Critérios de aceitação

- A aplicação web não envia NIF para proxies CORS públicos.
- O link para o portal oficial funciona e não inclui o NIF na URL.
- Uma falha de rede, CORS ou indisponibilidade não é apresentada como invalidez fiscal.
- Nome e morada são tratados como dados opcionais.
- Caso exista backend, o identificador não surge em logs ou traces.
- Os estados e mensagens são compreensíveis para o utilizador.

## 8. Conclusão

**Curto prazo:** manter o acesso ao portal oficial e melhorar a mensagem de erro.

**Médio prazo:** implementar uma integração com o VIES através de um **backend próprio**, se a consulta automática na web for necessária. Esta abordagem contorna a limitação de CORS sem recorrer a proxies públicos de terceiros, mas exige controlos de privacidade, segurança e disponibilidade.

> Nota: este documento é uma proposta de arquitetura. A disponibilidade, os formatos e as condições concretas das interfaces oficiais do VIES devem ser confirmados antes da implementação.
