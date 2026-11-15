# ADR 0020: Só planos gratuitos, sem cartão

## Status

Aceito · 2026-11-14

## Contexto

O Ritu é um projeto de estudo e de portfólio. Um custo recorrente, ou uma conta que pode gerar cobrança por uso, é um risco que o projeto não quer correr.

## Decisão

1. Todos os serviços em plano gratuito e sem cartão cadastrado: Vercel Hobby, Postgres gratuito (Neon ou Supabase), Gemini gratuito, Grafana Cloud Free, Open-Meteo e GitHub Actions em repositório público.
2. Os limites desses planos viram regras do produto: limite de mensagens por conta, de demonstrações por IP, troca de modelo por cota, cache de clima, pausas que evitam função longa.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Plano pago de LLM | Custo recorrente e risco de cobrança |
| Hospedagem própria | Manutenção e custo |

## Consequências

- O produto precisa degradar bem quando a cota acaba (resposta montada por código, telas de cota esgotada).
- No plano gratuito o provedor de IA pode usar as mensagens; o Aviso inicial e a tela Sobre dizem isso.
- Retenção curta de telemetria em produção.
