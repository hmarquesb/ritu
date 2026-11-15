# Plano · Spec 001 · Fundação

Spec: `.specs/001-fundacao.md`. Todas as tarefas são `mecanica`. As ADRs 0001 a 0021, o `README.md` e os comandos do `AGENTS.md` são do orquestrador, no fechamento.

Regras comuns a todas as tarefas (valem como parte de cada bloco):
- Código e identificadores em inglês; mensagens à pessoa em português.
- Nada de `new Date()` sem argumento nem `Date.now()` em `src/core/`.
- Não ler `.env.local`, não imprimir valor de variável de ambiente.
- Não criar pastas, portas ou arquivos de specs futuras. Não instalar biblioteca fora da lista da T1.
- Testes sem rede, sem banco, sem Docker, sem relógio real.
- Estilo Biome: 2 espaços, 100 colunas, aspas duplas, ponto e vírgula só quando necessário (`semicolons: "asNeeded"`), imports organizados.

---

### T1 · Set up the toolchain and config folder
- nivel: mecanica
- objetivo: criar o `package.json` com Node 24, as dependências e os scripts, e configurar TypeScript, Biome, Vitest (testes e evals), jscpd e a pasta `config/`, de modo que lint, typecheck, test, eval:det e dup passem.
- arquivos: `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig.json`, `biome.json`, `.jscpd.json`, `vitest.config.ts`, `vitest.eval.config.ts`, `evals/det/.gitkeep`, `.gitignore`, `config/app.ts`, `config/index.ts`, `config/index.test.ts`
- leitura: nenhuma (além de `DEVELOPMENT.md`)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · linha "Toolchain: Node 24, npm, Biome, Vitest, tsx, `tsconfig`" (abra os arquivos indicados e porte o padrão)
- contratos:
  - Dependências (sempre a estável mais recente, `npm install`, travada no lockfile): `next` (16), `react` (19), `react-dom` (19), `zod` (4); dev: `typescript` (5), `@types/node`, `@types/react`, `@types/react-dom`, `@biomejs/biome` (2), `vitest`, `tsx`, `@playwright/test`, `jscpd`. Nenhuma outra.
  - `package.json`: `"private": true`, `"type": "module"`, `"engines": { "node": ">=24 <25" }`. `.nvmrc` com `24`.
  - Scripts (exatamente):
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
  - `tsconfig.json`: strict, `noEmit`, `moduleResolution: "bundler"`, `jsx: "preserve"` (compatível com Next), plugin `next`, `include` de `next-env.d.ts`, `**/*.ts`, `**/*.tsx`, `.next/types/**/*.ts`; aliases `@/*` → `src/*` e `@config/*` → `config/*`.
  - `biome.json`: estilo acima; regras recomendadas; `complexity/noExcessiveCognitiveComplexity` como `error` com `maxAllowedComplexity: 15`; ignora `.md`, `node_modules`, `.next`, `coverage`, `test-results`, `playwright-report`, `.local`, `.claude`, `.agents`, `.docs`, `.specs`, `.plans`, `.adrs`, `design`, `next-env.d.ts`, `package-lock.json`.
  - `.jscpd.json`: `path: ["src"]`, `minTokens: 70`, `threshold: 0`, ignora `**/*.test.ts`, `**/*.test.tsx`, `**/*.eval.ts`, `src/infra/fakes/**`; sai com código ≠ 0 quando acha duplicação; saída só no console.
  - `vitest.config.ts`: ambiente `node`, inclui `src/**/*.test.ts(x)`, `scripts/**/*.test.ts` e `config/**/*.test.ts`; exclui `e2e/` e `evals/`; aliases `@` e `@config` iguais ao tsconfig. `passWithNoTests: true` não é necessário se houver o teste do config, mas pode ficar.
  - `vitest.eval.config.ts`: inclui só `evals/det/**/*.eval.ts`, `passWithNoTests: true`, mesmos aliases.
  - `evals/det/.gitkeep` vazio.
  - `.gitignore`: acrescentar `*.tsbuildinfo` e `next-env.d.ts` (manter o resto como está, inclusive `.local/` e `.claude/settings.local.json`).
  - `config/app.ts`: `export const app = { name: "Ritu", disclaimer: "Não é orientação médica." } as const`
  - `config/index.ts`: `export const config = { app } as const` e `export type AppConfig = typeof config`.
- testes primeiro: `config/index.test.ts` confere `config.app.name === "Ritu"` e `config.app.disclaimer === "Não é orientação médica."`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run dup` (todos com código 0). `typecheck` pode precisar de um `src/` vazio; não crie arquivos de Next aqui (são da T2).
- pronto quando: os cinco comandos passam; `npm ls --depth=0` mostra só as dependências listadas; um arquivo temporário em `src/` com função de complexidade cognitiva > 15 faz `npm run lint` falhar (teste manual, apague depois).
- fora: Next app (`src/app/`, `next.config.ts`), Playwright config, `src/core/`, `src/infra/`, scripts.

### T2 · Add the minimal Next.js app and the E2E smoke test
- nivel: mecanica
- objetivo: criar a aplicação Next.js mínima (App Router) com a página provisória e o Playwright com um caso de fumaça em celular e desktop.
- arquivos: `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `playwright.config.ts`, `e2e/smoke.spec.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Página `/` mostra o nome "Ritu" e a frase "Não é orientação médica.", lidos de `config` (`@config/index` → `config.app.name`, `config.app.disclaimer`). Uma frase curta a mais é permitida (ex.: "Projeto de estudo em construção."). **Sem CSS**, sem estilização; não é tela do produto.
  - `layout.tsx`: `<html lang="pt-BR">`, `metadata` com `title: "Ritu"`.
  - `next.config.ts`: mínimo (sem opções além de `reactStrictMode` se quiser).
  - `playwright.config.ts`: `testDir: "e2e"`; `webServer` com `npm run start` na porta 3000 e `reuseExistingServer: !process.env.CI`; projetos `celular` (`devices["Pixel 7"]`) e `desktop` (`devices["Desktop Chrome"]`); só Chromium.
  - `e2e/smoke.spec.ts`: abre `/`, confere o texto "Ritu" e "Não é orientação médica." visíveis.
  - `NEXT_TELEMETRY_DISABLED=1` ao rodar build localmente (pode exportar no comando).
- testes primeiro: escreva `e2e/smoke.spec.ts` antes da página.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install chromium` (se preciso), `npm run test:e2e` (precisa do build antes).
- pronto quando: build e E2E passam nos dois projetos; lint e typecheck seguem verdes.
- fora: Tailwind, qualquer CSS, componentes, `src/core/`, `src/infra/`.

### T3 · Add typed errors and the Clock port with adapter and fake
- nivel: mecanica
- objetivo: criar os erros base, a porta `Clock`, o relógio do sistema e o relógio fixo de teste.
- arquivos: `src/core/errors.ts`, `src/core/errors.test.ts`, `src/core/clock.ts`, `src/infra/system-clock.ts`, `src/infra/fakes/fixed-clock.ts`, `src/infra/fakes/fixed-clock.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/core/errors.ts
  export class RituError extends Error {
    readonly code: string
    constructor(code: string, message: string)
  }
  export class MissingEnvError extends RituError {} // code: "env_ausente"
  ```
  - `MissingEnvError` recebe o nome da variável no construtor e monta a mensagem `Defina <NOME> no .env.local`; `code` é `"env_ausente"`; `name` de cada classe é o nome da classe.
  ```ts
  // src/core/clock.ts
  export interface Clock {
    now(): Date
  }
  ```
  - `src/infra/system-clock.ts` exporta `systemClock: Clock` (usa `new Date()`; está em infra, é permitido).
  - `src/infra/fakes/fixed-clock.ts` exporta `createFixedClock(iso: string): Clock & { advance(ms: number): void; set(iso: string): void }`. `now()` devolve uma **nova** instância de `Date` a cada chamada (mutar o retorno não muda o relógio).
- testes primeiro:
  - `createFixedClock("2026-01-15T12:00:00Z").now()` devolve sempre essa data (duas chamadas iguais).
  - `advance(60_000)` avança um minuto; `set(iso)` troca a data.
  - Mutar o `Date` devolvido não altera o próximo `now()`.
  - `new MissingEnvError("GEMINI_API_KEY")`: `instanceof RituError`, `code === "env_ausente"`, `message === "Defina GEMINI_API_KEY no .env.local"`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam; `src/core/` não importa nada além de arquivos do core.
- fora: env, container, qualquer outro arquivo.

### T4 · Add the environment catalog, requireEnv and .env.example
- nivel: mecanica
- objetivo: criar o catálogo único de variáveis de ambiente com `requireEnv`, `optionalEnv` e `envStatus`, e o `.env.example` igual ao catálogo, com teste de paridade.
- arquivos: `src/infra/env.ts`, `src/infra/env.test.ts`, `.env.example`
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · linha "Variáveis de ambiente validadas"
- contratos:
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
  - `env` padrão é `process.env`, lido **só quando a função é chamada** (nada na importação).
  - String vazia (e só espaços) conta como ausente em `requireEnv`, `optionalEnv` e `envStatus`.
  - `requireEnv` de ausente/vazia lança `MissingEnvError(name)` (de `@/core/errors`, mensagem `Defina <NOME> no .env.local`).
  - `envStatus` lista só as variáveis do catálogo, na ordem do catálogo; variável fora do catálogo é ignorada.
  - Catálogo (`ENV_VARS`), nesta ordem:
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
  - `.env.example`: uma linha `NOME=valor` por variável do catálogo, na mesma ordem, com um comentário `#` de uma linha antes de cada uma (a descrição). Valores: `DATABASE_URL=postgres://ritu:ritu@localhost:5432/ritu`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`, `OTEL_SERVICE_NAME=ritu`; as demais vazias. Nenhum valor secreto.
- testes primeiro (`src/infra/env.test.ts`, sempre passando `env` explícito, nunca lendo `process.env` real):
  - `requireEnv("X", {})`, `requireEnv("X", { X: "" })` e `{ X: "   " }` lançam `MissingEnvError` com a mensagem `Defina X no .env.local`.
  - `requireEnv("X", { X: "v" })` devolve `"v"`; `optionalEnv` devolve `undefined` para vazio.
  - `envStatus({ DATABASE_URL: "x", EXTRA: "y" })` tem 11 itens, sem `EXTRA`, com `DATABASE_URL.presente === true` e `GEMINI_API_KEY.presente === false`.
  - Paridade: lê `.env.example` com `node:fs` (permitido no teste de infra) e confere que os nomes, na ordem, são exatamente `ENV_VARS.map(v => v.name)`; e que nenhuma variável além das três citadas tem valor.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam; importar `env.ts` não toca `process.env`.
- fora: `scripts/`, container.

### T5 · Add the env:check script with a pure report formatter
- nivel: mecanica
- objetivo: criar o `env:check`, que lista presente/ausente de cada variável do catálogo sem nunca expor valor, e falha com `--entrega N` quando falta obrigatória.
- arquivos: `scripts/env-check.ts`, `scripts/lib/env-report.ts`, `scripts/lib/env-report.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `scripts/lib/env-report.ts` exporta a função pura `formatEnvStatus(status, entrega?)` que recebe a saída de `envStatus` (de `@/infra/env`) e devolve `{ lines: string[]; exitCode: 0 | 1 }`.
  - Cada linha: `NOME  presente|ausente  entrega N  obrigatória|opcional` (dois espaços entre colunas; pode alinhar os nomes com padding).
  - `entrega` informado: `exitCode = 1` se alguma variável `obrigatoria` com `entrega <= N` estiver ausente; senão 0. Sem `entrega`: sempre 0. Opcionalmente, com `exitCode 1`, uma última linha `Faltam para a entrega N: A, B` (só nomes).
  - `scripts/env-check.ts`: lê `process.argv` (`--entrega N`, N de 1 a 4; inválido → mensagem e código 2), chama `envStatus()` e `formatEnvStatus`, imprime as linhas e sai com o código. Importa só `@/infra/env` e `./lib/env-report` (R6: scripts só podem importar `@/infra/container`, `@/infra/env`, `@/infra/fakes/**`).
  - O script roda com `node --env-file-if-exists=.env.local --import tsx scripts/env-check.ts`; sem `.env.local` mostra tudo ausente. Variável fora do catálogo não aparece.
  - Nunca imprime valor, tamanho ou trecho de valor.
- testes primeiro (`env-report.test.ts`, montando o status com `envStatus({...})` de valores conhecidos, ex. `GEMINI_API_KEY: "segredo-123"`, `DATABASE_URL: "postgres://u:senha@h/db"`):
  - Nenhuma linha contém `segredo-123`, `senha`, nem o tamanho do valor (`"11"`).
  - Há uma linha por variável do catálogo (11), com `presente`/`ausente` corretos.
  - `--entrega 1` com `GEMINI_API_KEY` ausente → 1; com `DATABASE_URL` ausente → 1; com as duas presentes e todas as outras ausentes → 0.
  - `--entrega 3` com as duas presentes e `AUTH_SECRET` ausente → 1.
  - Sem entrega → 0 mesmo com tudo ausente.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run env:check` (código 0; não cole a saída se ela tiver algo além de presente/ausente), `npm run env:check -- --entrega 1` (anote só o código de saída)
- pronto quando: testes passam e os dois comandos rodam.
- fora: `src/infra/env.ts` (não altere), container.

### T6 · Add the lazy composition root
- nivel: mecanica
- objetivo: criar o container único da aplicação, preguiçoso, com `config` e `clock`.
- arquivos: `src/infra/container.ts`, `src/infra/container.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · linha "Core sem framework + portas + composition root"
- contratos:
  ```ts
  export type Container = { config: AppConfig; clock: Clock }
  export function createContainer(overrides?: Partial<Container>): Container
  export function getContainer(): Container // singleton preguiçoso
  ```
  - `AppConfig`/`config` vêm de `@config/index`; `Clock` de `@/core/clock`; padrão do relógio é `systemClock` (`@/infra/system-clock`).
  - Importar o módulo não lê `process.env`, não instancia nada e não abre conexão: o singleton nasce na primeira chamada a `getContainer()`.
  - Cada spec seguinte acrescenta as suas portas ao tipo `Container`. Nenhum outro arquivo instancia adaptador.
- testes primeiro:
  - `getContainer() === getContainer()`.
  - `createContainer({ clock: createFixedClock("2026-01-15T12:00:00Z") }).clock.now().toISOString() === "2026-01-15T12:00:00.000Z"`.
  - `createContainer().config.app.name === "Ritu"`.
  - Importar o módulo não lê `process.env`: use `vi.resetModules()` e um `Proxy` (ou `vi.stubGlobal`) em `process.env` que conta acessos, faça `await import("./container")` e confira zero acessos.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam.
- fora: env, scripts, app.

### T7 · Add the architecture test with rules R1 to R9
- nivel: mecanica
- objetivo: criar o teste de arquitetura com um verificador puro `checkFile(caminho, fonte)` e as regras R1 a R9, com casos que violam e casos válidos para cada regra, mais a varredura do repositório.
- arquivos: `src/architecture.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · linha "Teste de arquitetura"
- contratos:
  - Cada violação sai como `<arquivo>: <regra> <detalhe>` (ex.: `src/core/x.ts: R1 importa "next/server"`). Arquivos `*.test.ts(x)` e `*.eval.ts` só são dispensados onde a regra diz.
  - Regras:
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
  - A lista de pacotes permitidos no core e o mapa pacote → pasta são constantes no topo do teste.
  - `checkFile(path, source): string[]` é função pura (R1 a R8). R9 precisa do grafo: uma função pura `findDomainCycles(files: { path: string; source: string }[]): string[]` sobre o conjunto. Imports relativos (`./`, `../`) são resolvidos para o caminho real para R1–R4 e R9 (ex.: `src/core/a/x.ts` com `../../infra/y` conta como `@/infra/y`).
  - Detecta `import ... from "x"`, `import "x"`, `export ... from "x"`, `import("x")` e `require("x")`; distingue `import type` (R4).
  - Comentários (`//`, `/* */`) e conteúdo de strings/template literals que não sejam o especificador de um import não geram violação falsa: remova comentários antes de analisar e só considere especificadores na posição sintática de import.
  - Os casos de teste montam as fontes **em tempo de execução** (ex.: `"im" + "port"`, `["next", "server"].join("/")`, `"Date" + ".now()"`), para o próprio arquivo de teste não cair nas regras na varredura.
  - Varredura: percorre `src/`, `scripts/`, `evals/` (`.ts`/`.tsx`, ignorando `node_modules`, `.next`) com `node:fs`, aplica `checkFile` e `findDomainCycles` e espera zero violações.
  - Complexidade cognitiva de cada função ≤ 15 (o lint confere): divida em funções pequenas por regra.
- testes primeiro: para **cada** regra R1 a R9, pelo menos um caso que viola (e confere a string `<arquivo>: R<n>`) e um caso válido que passa. Obrigatórios:
  - `checkFile("src/core/x.ts", 'import { NextResponse } from "next/server"')` → uma violação começando com `src/core/x.ts: R1`.
  - `src/core/x.test.ts` importando `@/infra/fakes/fixed-clock` e `vitest` → sem violação; `src/core/x.ts` importando `zod` e `@config/index` → sem violação; `node:fs` em `src/core/x.ts` → R1.
  - `findDomainCycles` com `src/core/a/x.ts` importando `@/core/b/y` e `src/core/b/y.ts` importando `@/core/a/x` → violação com `R9` e `a → b → a`. Arquivo solto `src/core/errors.ts` importado por ambos não forma ciclo.
  - Import proibido dentro de comentário ou de string comum → sem violação.
  - `import("postgres")` e `require("postgres")` em `src/infra/x.ts` → R5; em `src/infra/db/client.ts` → válido.
  - `src/components/x.tsx` com `import type { Clock } from "@/core/clock"` → válido; sem `type` → R4.
  - `process.env.NEXT_PUBLIC_API_KEY` → R7; `NEXT_PUBLIC_SITE_URL` → válido.
  - `new Date()` em `src/core/x.ts` → R8; `new Date("2026-01-01")` → válido; `Date.now()` em `src/core/x.test.ts` → válido.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`. Prova manual (depois apague): criar `src/core/x.ts` com `import "next/server"` e ver `npm test` falhar com `src/core/x.ts: R1 ...`; criar `src/core/a/x.ts` e `src/core/b/y.ts` que se importam e ver `R9` com `a → b → a`.
- pronto quando: todos os casos passam, a varredura dá zero e as duas provas manuais falham como descrito.
- fora: qualquer outro arquivo.

### T8 · Add docker-compose and the CI workflow
- nivel: mecanica
- objetivo: criar os serviços locais (Postgres e Grafana LGTM) e a CI do GitHub Actions com os gates 1 a 6.
- arquivos: `docker-compose.yml`, `.github/workflows/ci.yml`
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · linha "CI sem segredos"
- contratos:
  - `docker-compose.yml` (raiz, sem a chave `version`):
    | Serviço | Imagem | Portas | Detalhes |
    |---|---|---|---|
    | `postgres` | `postgres:17-alpine` | `5432:5432` | `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB` = `ritu`; volume nomeado; healthcheck com `pg_isready -U ritu -d ritu` |
    | `lgtm` | `grafana/otel-lgtm` | `3001:3000`, `4317:4317`, `4318:4318` | Grafana em `localhost:3001`; volume nomeado |
  - `.github/workflows/ci.yml`: em `push` na `main` e em `pull_request`; `permissions: contents: read`; `ubuntu-latest`; `actions/setup-node` com `node-version-file: .nvmrc` (24) e `cache: npm`; env `NEXT_TELEMETRY_DISABLED=1` e `CI=true`. Passos, nesta ordem: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run eval:det` → `npm run dup` → `npm run build` → `npx playwright install --with-deps chromium` → `npm run test:e2e`. Nenhum segredo, nenhum `secrets.*`.
- testes primeiro: não se aplica (configuração). Valide com `docker compose config -q` e, se o Docker estiver ligado, `docker compose up -d`, espere o Postgres ficar `healthy` (`docker compose ps`), confira `curl -sf localhost:3001/api/health`, e depois `docker compose down` (sem `-v` não é necessário apagar volume; pode usar `down -v`).
- comandos: `docker compose config -q`; `npm run lint` (o Biome pode ignorar YAML).
- pronto quando: compose válido e os serviços sobem saudáveis (se Docker disponível); o YAML da CI tem exatamente os passos na ordem, sem segredo.
- fora: qualquer código.
