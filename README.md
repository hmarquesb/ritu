# Ritu

Um agente ayurvédico para o dia a dia. Você conta como está, do jeito que quiser, e ele responde com o que fazer agora usando o que você tem em casa e o clima da sua cidade: um chá, uma refeição simples, um óleo, uma prática. Ele explica o porquê, troca ingredientes, lembra do que você gosta e do que já funcionou, avisa o que vale ter em casa, e só anota algo com a sua aprovação.

> **Status:** em construção. A documentação está em [`.docs/`](.docs/), as decisões de arquitetura em [`.adrs/`](.adrs/) e o fluxo de construção em [`.docs/RULES.md`](.docs/RULES.md).

## Como rodar

Precisa de Node 24 (`.nvmrc`) e npm. Docker só para os serviços locais.

```
npm ci
npm run lint && npm run typecheck && npm test && npm run eval:det
npm run build && npx playwright install chromium && npm run test:e2e
```

Esses comandos rodam sem `.env.local`, sem Docker e sem rede.

Serviços locais (Postgres em `localhost:5432` e Grafana em `localhost:3001`, com OTLP em `4317` e `4318`):

```
docker compose up -d
```

Variáveis de ambiente: copie `.env.example` para `.env.local` e preencha. `npm run env:check` mostra quais estão presentes, sem nunca imprimir valores.

Projeto de estudo. Não é orientação médica.
