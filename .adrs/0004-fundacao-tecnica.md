# ADR 0004: Fundação técnica

## Status

Aceito · 2026-11-14

## Contexto

O Ritu é construído por agentes, sem revisão humana a cada commit. Isso exige ferramentas que digam "passou" ou "falhou" sem rede, banco ou chave, e regras de arquitetura conferidas por máquina. O produto é um site público, celular primeiro, num plano gratuito.

## Decisão

1. TypeScript, Node 24 e npm.
2. Next.js (App Router) para o site, presente desde a primeira spec para o build e o E2E serem gates reais.
3. Lógica em `src/core/`, sem framework; adaptadores em `src/infra/`; um único composition root. As regras de camadas e de domínios são conferidas por um teste de arquitetura.
4. Biome para lint e formatação, com limite de complexidade cognitiva; Vitest para testes; tsx para scripts; Playwright para E2E; jscpd para duplicação.
5. Postgres com o driver `postgres` e SQL puro.
6. Auth.js para a entrada.
7. zod em toda borda.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| ESLint + Prettier | Duas ferramentas e mais configuração do que o Biome |
| ORM (Prisma, Drizzle) | Mais uma camada de abstração; SQL puro basta e é explícito |
| Next.js só na entrega do site | O build e o E2E só virariam gates no meio da construção, e o `tsconfig` mudaria |
| `server-only` para separar cliente e servidor | Os scripts de terminal rodam o core sem condição especial; o teste de arquitetura cobre |

## Consequências

- A CI roda build e E2E desde o primeiro push, o que soma tempo.
- Toda biblioteca nova no core precisa mudar a lista permitida do teste de arquitetura.
- Os testes padrão rodam sem rede, banco nem chave, com fakes das portas.
