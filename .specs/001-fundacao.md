---
title: Fundação
status: approved
entrega: 1
created: 2026-11-14
---

# Fundação

> Monta o repositório em que as outras 23 specs vão trabalhar: ferramentas, os seis gates sem LLM rodando localmente e na CI, as regras de camadas e de domínios conferidas por teste, o limite de complexidade e a checagem de duplicação, o composition root, as portas `Clock` e de ambiente, e os serviços locais. Não entrega nenhuma função do produto.

## Contexto

O Ritu é construído por agentes, sem interrupção, com um commit por tarefa aprovada pelo verificador (`RULES.md`). Isso só funciona se, desde a primeira tarefa, existirem comandos que digam "passou" ou "falhou" sem depender de rede, banco ou chave, e se as regras de arquitetura forem conferidas por máquina e não por leitura. Hoje a pasta só tem documentação.

## Objetivo

Depois desta spec, num clone limpo, `npm ci` seguido dos gates 1 a 6 de `QA.md` passa sem `.env.local`, sem Docker e sem rede, e a CI do GitHub roda os mesmos seis gates a cada push na `main`.

## Escopo

- **Dentro:**
  - `package.json` com Node 24, npm e os scripts dos gates 1 a 6 e `env:check`.
  - TypeScript, Biome, Vitest, tsx e Playwright configurados.
  - Aplicação Next.js mínima (App Router), com uma página provisória, para o build e o E2E serem reais desde o primeiro push.
  - Teste de arquitetura com as regras de camadas e a regra de domínios sem ciclo.
  - Limite de complexidade no Biome e checagem de duplicação (`dup`).
  - Erros tipados base, porta `Clock` com adaptador e fake, catálogo de variáveis de ambiente com `requireEnv`, composition root.
  - Pasta `config/` com o primeiro arquivo.
  - `.env.example` e o script `env:check`.
  - `docker-compose.yml` com Postgres e Grafana LGTM.
  - CI no GitHub Actions.
  - As 21 ADRs fundadoras de `.adrs/README.md`.
- **Fora:**
  - Tailwind, React Aria, tokens e qualquer tela do produto (spec 016 em diante).
  - Driver `postgres`, migrações e repositórios (004).
  - Mastra e OpenTelemetry (005); SDK do Gemini e `ModelRouter` (006).
  - Auth.js (017).
  - Runner de evals com relatório e os comandos ⚠️ `demo` e `eval:llm` (007 e 014). Aqui o `eval:det` só existe como comando que roda os casos que as próximas specs vão acrescentar.
  - Painel do Grafana como código (015).
  - `git init` e a criação do repositório no GitHub: são da dona (`PREPARO.md` §7).

## Necessidade de negócio

O produto é uma peça de portfólio cujo valor está em mostrar engenharia de agentes medida e confiável. A fundação é o que torna cada número posterior (testes, evals, traces) reproduzível por quem clonar o repositório, e é o que permite a construção autônoma sem revisão humana a cada commit.

## Critérios de aceite

- [ ] Num clone limpo, sem `.env.local` e sem Docker: `npm ci && npm run lint && npm run typecheck && npm test && npm run eval:det && npm run build && npm run test:e2e` termina com código 0.
- [ ] `npm test` não abre conexão de rede nem lê variável de ambiente obrigatória.
- [ ] O teste de arquitetura tem, para **cada** regra R1 a R9 de "Contratos", um caso que viola a regra e é acusado, e um caso válido que passa; e uma varredura do repositório inteiro que devolve zero violações.
- [ ] Criar um arquivo `src/core/x.ts` com `import "next/server"` faz `npm test` falhar com a mensagem `src/core/x.ts: R1 ...`.
- [ ] Dois arquivos `src/core/a/x.ts` e `src/core/b/y.ts` que importam um ao outro fazem `npm test` falhar com `R9` e o ciclo `a → b → a`.
- [ ] Uma função com complexidade cognitiva acima de 15 em `src/` faz `npm run lint` falhar.
- [ ] Dois blocos iguais de 70 tokens ou mais em `src/` (fora de testes e fakes) fazem `npm run dup` falhar; o repositório da fundação passa.
- [ ] `npm run env:check` lista todas as variáveis do catálogo com `presente` ou `ausente`, e em nenhuma hipótese imprime valor, tamanho ou trecho de valor (teste confere a saída com valores conhecidos).
- [ ] `npm run env:check -- --entrega 1` termina com código 1 quando falta `GEMINI_API_KEY` ou `DATABASE_URL`, e com código 0 quando as duas existem, mesmo com as demais ausentes.
- [ ] `requireEnv` de variável ausente ou vazia lança `MissingEnvError` com a mensagem `Defina <NOME> no .env.local`.
- [ ] Importar `src/infra/container.ts` não lê `process.env` nem abre conexão; `getContainer()` devolve sempre a mesma instância; `createContainer({ clock })` devolve um container com o relógio passado.
- [ ] `createFixedClock("2026-01-15T12:00:00Z").now()` devolve sempre essa data; `advance(ms)` avança.
- [ ] `docker compose up -d` sobe Postgres saudável em `localhost:5432` e Grafana em `localhost:3001`, com OTLP em `4317` e `4318`.
- [ ] `.env.example` lista exatamente as variáveis do catálogo, sem valor secreto; um teste falha se o catálogo e o arquivo divergirem.
- [ ] O workflow de CI roda os gates 1 a 6 em push na `main` e em pull request, sem nenhum segredo configurado, e fica verde no primeiro push.
- [ ] A página `/` mostra o nome "Ritu" e a frase "Não é orientação médica."; o E2E confere isso em viewport de celular e de desktop.
- [ ] `.adrs/` tem as ADRs 0001 a 0021, no template, com status `Aceito`, e o índice de `.adrs/README.md` lista todas.
- [ ] A seção "Comandos" de `AGENTS.md` descreve os comandos que existem.

## O que fazer

- Instalar só o que esta spec usa: `next`, `react`, `react-dom`, `zod`; e, em desenvolvimento, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@biomejs/biome`, `vitest`, `tsx`, `@playwright/test`, `jscpd`. Sempre a versão estável mais recente na hora da instalação, travada no `package-lock.json`.
- Escrever o verificador de arquitetura como função pura (`checkFile(caminho, fonte)`) e testá-la com fontes montadas em tempo de execução, para o próprio teste não cair nas regras.
- Manter o container preguiçoso: nada é lido nem conectado na importação.
- Escrever as ADRs fundadoras a partir do racional que já está nos documentos indicados em `.adrs/README.md`, sem acrescentar decisão nova. Quem escreve é o orquestrador, no fechamento da spec.
- Atualizar `README.md` (como rodar) e `AGENTS.md` (comandos) no fechamento.

## O que não fazer

- Não instalar biblioteca de specs futuras "para adiantar".
- Não criar portas, repositórios, tabelas ou pastas vazias de specs futuras. Cada pasta de `ARCHITECTURE.md` §7 nasce na spec que a usa.
- Não estilizar a página provisória nem tratá-la como tela do produto.
- Não ler `.env.local` em teste, nem imprimir valor de variável em nenhum script.
- Não usar `new Date()` nem `Date.now()` em `src/core/`.
- Não escrever teste que dependa de Docker, rede ou relógio real.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Next.js entra agora ou só na entrega 3 | Agora, com uma página provisória | O gate 5 (build) e o 6 (E2E) rodam na CI desde o primeiro push; com o Next presente, as regras de camadas de `src/app/` valem desde o início e o `tsconfig` não muda no meio da construção |
| Versões | Node 24 (`engines: ">=24 <25"`, `.nvmrc`), Next 16, React 19, TypeScript 5, Biome 2, zod 4; demais na estável mais recente | Stack de `ARCHITECTURE.md` §2; a versão exata fica no lockfile |
| Estilo de código (Biome) | 2 espaços, 100 colunas, aspas duplas, ponto e vírgula só quando necessário, imports organizados, regras recomendadas; `.md` fora | Um formatador só, sem discussão de estilo nas tarefas |
| Limite de complexidade | `complexity/noExcessiveCognitiveComplexity` ligado como erro, `maxAllowedComplexity: 15` | Mede de graça a parte de Clean Code e SOLID que dá para medir; roda em toda tarefa junto do lint |
| Checagem de duplicação | `jscpd` em `src/`, `minTokens: 70`, `threshold: 0`, ignorando `*.test.ts(x)`, `*.eval.ts` e `src/infra/fakes/`; roda no fechamento de cada spec e na CI, não por tarefa | DRY conferido por máquina, sem nova tentativa a cada tarefa: as duplicações são corrigidas uma vez, no fechamento |
| Domínios (vertical slices) | Proibir ciclo entre domínios do core (R9), em vez de exigir `index.ts` em cada domínio | Protege a fronteira entre slices sem mudar os caminhos de arquivo dos contratos das specs 002 a 007 |
| Alias de importação | `@/*` → `src/*` e `@config/*` → `config/*` | `config/` fica na raiz (`ARCHITECTURE.md` §7) |
| Onde ficam os fakes das portas | `src/infra/fakes/` | Fake é um adaptador. Testes, evals determinísticos e a demo com fixtures usam os mesmos |
| `eval:det` nesta spec | `vitest run --config vitest.eval.config.ts`, casos em `evals/det/**/*.eval.ts`, passa sem casos | O gate 4 precisa existir para a CI; cada spec acrescenta os seus casos; o runner com relatório é da 014 |
| E2E nesta spec | `@playwright/test`, um caso de fumaça, projetos "celular" (Pixel 7) e "desktop", só Chromium | O gate 6 fica real desde o início; celular primeiro |
| `import "server-only"` | Não usar | A proteção vem do teste de arquitetura (R4, R5 e R7), e os scripts de terminal rodam o core sem condição especial do Node |
| Validação de ambiente | Catálogo único + `requireEnv` sob demanda, sem validar tudo na partida | Testes e CI rodam sem nenhuma variável; cada adaptador exige a sua na primeira vez que é usado |
| `AUTH_SECRET`, `IP_HMAC_SECRET` e `CRON_SECRET` | Exigidas a partir da entrega 3 | Nenhuma spec das entregas 1 e 2 lê esses segredos |
| `docker-compose.yml` | Um arquivo na raiz, com `postgres` (17-alpine) e `lgtm` (`grafana/otel-lgtm`) | Um comando sobe o ambiente; `observability/` fica para o painel (015) |
| Banco local | Usuário, senha e banco `ritu`, porta 5432; a URL vai pronta no `.env.example` | Credencial local não é segredo |
| Página provisória | `/` com o nome, uma frase e o aviso; sem CSS | É substituída pela Entrada (017) e pela landing (024) |

## Contratos

### Cria

**Scripts do `package.json`**

| Script | Comando |
|---|---|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `biome check .` |
| `format` | `biome check --write .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `eval:det` | `vitest run --config vitest.eval.config.ts` |
| `test:e2e` | `playwright test` |
| `dup` | `jscpd` (configuração em `.jscpd.json`) |
| `env:check` | `node --env-file-if-exists=.env.local --import tsx scripts/env-check.ts` |

**Erros (`src/core/errors.ts`)**

```ts
export class RituError extends Error {
  readonly code: string
  constructor(code: string, message: string)
}
export class MissingEnvError extends RituError {} // code: "env_ausente"
```

**Relógio (`src/core/clock.ts`)**

```ts
export interface Clock {
  now(): Date
}
```

- Adaptador: `src/infra/system-clock.ts` exporta `systemClock: Clock`.
- Fake: `src/infra/fakes/fixed-clock.ts` exporta `createFixedClock(iso: string): Clock & { advance(ms: number): void; set(iso: string): void }`.

**Configuração (`config/`)**

- `config/app.ts`: `export const app = { name: "Ritu", disclaimer: "Não é orientação médica." } as const`
- `config/index.ts`: `export const config = { app } as const` e `export type AppConfig = typeof config`. Cada spec que cria um arquivo em `config/` o acrescenta aqui.

**Ambiente (`src/infra/env.ts`)**

```ts
export type EnvVar = {
  name: string
  entrega: 1 | 2 | 3 | 4      // a partir de qual entrega é usada
  obrigatoria: boolean
  descricao: string
}
export const ENV_VARS: readonly EnvVar[]
export type EnvSource = Record<string, string | undefined>
export function requireEnv(name: string, env?: EnvSource): string        // lança MissingEnvError
export function optionalEnv(name: string, env?: EnvSource): string | undefined // vazio conta como ausente
export function envStatus(env?: EnvSource): { name: string; entrega: number; obrigatoria: boolean; presente: boolean }[]
```

Catálogo (`ENV_VARS`), que é também o conteúdo do `.env.example`:

| Variável | Entrega | Obrigatória | Para quê |
|---|---|---|---|
| `DATABASE_URL` | 1 | Sim | Postgres. No `.env.example`: `postgres://ritu:ritu@localhost:5432/ritu` |
| `GEMINI_API_KEY` | 1 | Sim | Chave do projeto de desenvolvimento; só os comandos ⚠️ a usam |
| `AUTH_SECRET` | 3 | Sim | Sessão |
| `IP_HMAC_SECRET` | 3 | Sim | HMAC do IP nos limites |
| `CRON_SECRET` | 3 | Sim | Autenticação do cron |
| `AUTH_GOOGLE_ID` | 3 | Não | Login Google; sem ela a Entrada mostra só a demonstração |
| `AUTH_GOOGLE_SECRET` | 3 | Não | Idem |
| `TESTER_IDS` | 4 | Não | Contas com limite ampliado |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | 1 | Não | Sem ela a telemetria fica desligada. Dev: `http://localhost:4318` |
| `OTEL_EXPORTER_OTLP_HEADERS` | 4 | Não | Token do Grafana Cloud |
| `OTEL_SERVICE_NAME` | 1 | Não | Padrão `ritu` |

**`env:check` (`scripts/env-check.ts`)**

- Saída: uma linha por variável do catálogo, no formato `NOME  presente|ausente  entrega N  obrigatória|opcional`.
- `--entrega N`: código de saída 1 se alguma variável obrigatória com `entrega <= N` estiver ausente; sem a opção, sempre 0.
- A formatação é uma função pura (`formatEnvStatus`) em `scripts/lib/env-report.ts`, testada.

**Composition root (`src/infra/container.ts`)**

```ts
export type Container = { config: AppConfig; clock: Clock }
export function createContainer(overrides?: Partial<Container>): Container
export function getContainer(): Container // singleton preguiçoso
```

Cada spec seguinte acrescenta as suas portas ao tipo `Container`. Nenhum outro arquivo instancia adaptador.

**Regras do teste de arquitetura (`src/architecture.test.ts`)**

Cada violação sai como `<arquivo>: <regra>`. Arquivos `*.test.ts(x)` e `*.eval.ts` só são dispensados onde a regra diz.

| Regra | O que proíbe |
|---|---|
| R1 | `src/core/**` importar qualquer pacote externo que não seja `zod` (inclui `next`, `next-auth`, `postgres`, `@mastra/*`, `@opentelemetry/*`, `@vercel/otel`, `@google/genai` e módulos `node:*`), ou importar `@/infra/**`, `@/app/**`, `@/components/**`. `@/core/**` e `@config/**` são livres. Testes do core podem importar `@/infra/fakes/**` e `vitest` |
| R2 | `src/infra/**` importar `@/app/**` ou `@/components/**` |
| R3 | `src/app/**` importar `@/infra/**`, exceto `@/infra/container` |
| R4 | `src/components/**` importar `@/infra/**`; ou importar `@/core/**` sem ser `import type` |
| R5 | Pacote fora da sua pasta: `postgres` só em `src/infra/db/`; `@mastra/*` só em `src/infra/mastra/`; `@opentelemetry/*` e `@vercel/otel` só em `src/infra/otel/` e `src/instrumentation.ts`; `@google/genai` só em `src/infra/gemini/`; `next-auth` e `@auth/*` só em `src/infra/auth/` |
| R6 | `scripts/**` e `evals/**` importar `@/infra/**`, exceto `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` |
| R7 | Nome de variável `NEXT_PUBLIC_*` contendo `KEY`, `SECRET`, `TOKEN`, `PASSWORD` ou `DATABASE` |
| R8 | `new Date()` sem argumento ou `Date.now()` em `src/core/**` (fora de testes) |
| R9 | Ciclo de importação entre domínios do core. Domínio é a primeira pasta abaixo de `src/core/` (`knowledge`, `agents`, `runs`...); arquivos soltos em `src/core/` não são domínio e ficam fora do grafo. A violação mostra o ciclo (`a → b → a`). Testes ficam fora |

A lista de pacotes permitidos no core e o mapa pacote → pasta são constantes no topo do teste. Uma spec que precise mudá-los diz isso nos próprios contratos.

**Serviços locais (`docker-compose.yml`)**

| Serviço | Imagem | Portas | Detalhes |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | `5432:5432` | `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` = `ritu`; volume nomeado; healthcheck com `pg_isready` |
| `lgtm` | `grafana/otel-lgtm` | `3001:3000`, `4317:4317`, `4318:4318` | Grafana em `localhost:3001`; volume nomeado |

**CI (`.github/workflows/ci.yml`)**

Em `push` na `main` e em `pull_request`; `permissions: contents: read`; Node 24 com cache de npm; `NEXT_TELEMETRY_DISABLED=1`. Passos, nesta ordem: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run eval:det` → `npm run dup` → `npm run build` → `npx playwright install --with-deps chromium` → `npm run test:e2e`. Nenhum segredo.

**Playwright (`playwright.config.ts`)**

`testDir: "e2e"`; `webServer` com `npm run start` na porta 3000 e `reuseExistingServer` fora da CI; projetos `celular` (Pixel 7) e `desktop` (Desktop Chrome). Caso de fumaça em `e2e/smoke.spec.ts`.

### Usa

Nenhum contrato anterior. É a primeira spec.

## Evals (quando a spec toca agente, prompt, tool ou base)

Não toca agente, prompt, tool nem base. Cria só o comando `eval:det` e a pasta `evals/det/`, sem casos.

## Nível das partes

Tudo mecânica. As ADRs fundadoras são escritas pelo orquestrador no fechamento.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro: padrões de código e camadas.
- `QA.md`, só a tabela "Gates, na ordem".
- `.adrs/README.md` e, para cada ADR fundadora, só a seção indicada na coluna "Racional em" (no fechamento).

## Dependências

- Node 24 e npm na máquina; Docker só para o critério dos serviços locais.
- Repositório git iniciado e repositório no GitHub criado pela dona, para o critério da CI.
- Nenhuma spec anterior.

## Riscos e trade-offs

- **Next.js numa entrega "de terminal":** o build e o E2E somam tempo à CI desde o início. Aceito, em troca de gates reais e de não mexer na fundação no meio da construção.
- **Sem `server-only`:** a separação cliente/servidor depende só do teste de arquitetura. Se um caso escapar das regras, a correção é uma regra nova no teste.
- **R1 bem fechada (só `zod` no core):** uma spec que precise de outro pacote puro no core tem que declarar a mudança. É atrito de propósito.
- **`eval:det` sem casos passa:** o gate 4 só começa a medir alguma coisa na spec 002.
- **R9 só proíbe ciclo:** um domínio ainda pode importar um arquivo interno de outro. É a forma barata de manter os slices; se o acoplamento crescer, a correção é uma regra nova no teste.
- **Ciclo já previsto nas specs:** se o contrato de uma spec criar um ciclo entre domínios, o teste acusa na primeira tarefa; a correção é mover o tipo comum para um arquivo solto em `src/core/` ou para o domínio de baixo.
- **Sem validar todas as variáveis na partida:** uma variável ausente só aparece quando o adaptador é usado. O `env:check --entrega N`, rodado pelo orquestrador antes de cada entrega, cobre isso.

## Edge cases e modos de falha

- Variável definida como string vazia conta como ausente, em `requireEnv`, `optionalEnv` e `env:check`.
- `.env.local` inexistente: `env:check` roda e mostra tudo ausente.
- Porta 5432, 3000 ou 3001 ocupada por outro projeto: o `docker compose` ou o E2E falham com o erro da porta. Nenhum teste dos gates 1 a 5 depende dessas portas.
- Docker desligado: os seis gates passam do mesmo jeito.
- Importação dinâmica (`import("...")`) e `require("...")` também são vistas pelo teste de arquitetura.
- Comentário ou string que contenha um `import` proibido não gera violação falsa de regra de importação.
- Variável no `.env.local` que não está no catálogo é ignorada, e o `env:check` não a lista.

## Resultado (definição de pronto)

- Todos os critérios de aceite marcados.
- CI verde no commit de fechamento.
- ADRs 0001 a 0021 escritas e indexadas.
- `README.md` e a seção "Comandos" de `AGENTS.md` atualizados.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `biome.json`, `.jscpd.json`, `next.config.ts`
- `vitest.config.ts`, `vitest.eval.config.ts`, `playwright.config.ts`
- `.gitignore` (acrescenta `*.tsbuildinfo` e `next-env.d.ts`), `.env.example`
- `docker-compose.yml`, `.github/workflows/ci.yml`
- `src/app/layout.tsx`, `src/app/page.tsx`
- `src/architecture.test.ts`
- `src/core/errors.ts`, `src/core/clock.ts`
- `src/infra/env.ts`, `src/infra/env.test.ts`, `src/infra/system-clock.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- `src/infra/fakes/fixed-clock.ts`, `src/infra/fakes/fixed-clock.test.ts`
- `config/app.ts`, `config/index.ts`
- `scripts/env-check.ts`, `scripts/lib/env-report.ts`, `scripts/lib/env-report.test.ts`
- `evals/det/` (vazia, com `.gitkeep`), `e2e/smoke.spec.ts`
- `.adrs/0001-*.md` a `.adrs/0021-*.md`, `.adrs/README.md`
- `README.md`, `AGENTS.md`
