---
title: Produção
status: approved
entrega: 4
created: 2026-11-15
---

# Produção

> Põe o Ritu no ar: Vercel Hobby em São Paulo, Neon Free em São Paulo, chave de produção do Gemini, Google com a URL final, Grafana Cloud com o painel e os alertas por e-mail, e os dois crons diários (limpeza e padrões). O deploy sai pela CI, só com os gates verdes: migrações, deploy e smoke, com volta automática se o smoke falhar. Junto vêm Dependabot, `npm audit` na CI e o `DEPLOY.md`, o roteiro que a dona segue para ligar as contas.

## Pré-condição (pendência da dona)

**Revisão da base feita (2026-11-17)** e juntada na `main`: das 156 linhas `ref: a_confirmar`, restam **49** (44 em `alimentos.yaml` e 5 em `praticas.yaml`; nenhuma em `preparos.yaml` nem em `incomodos.yaml`). A dona resolve essas 49 numa segunda rodada com o Claude **antes do primeiro deploy real**. A construção desta spec pode começar. Até a segunda rodada, o job `deploy` fica vermelho no `npm run base:check -- --producao`, como manda `KNOWLEDGE.md` §8; a checagem não se afrouxa por isso. A pendência fica em `.specs/README.md` ("Pendências da dona").

## Contexto

As entregas 1 a 3 rodam só na máquina da dona: Postgres e LGTM no Docker, chave de desenvolvimento do Gemini, Google com `localhost`. A 021 pôs os limites que o site precisa para ser público. Falta o caminho até a produção e o que só existe nela: os crons, o banco de verdade, a telemetria no Grafana Cloud e a proteção da cadeia de dependências.

Partes já prontas que esta spec só liga:

- `GET /api/cron/limpeza` com `CRON_SECRET` (017) e `executarLimpeza` (004).
- `detectarPadroes` e `npm run padroes` (012).
- `src/instrumentation.ts` com `@vercel/otel` e `telemetry.encerrar()`, que descarrega traces, métricas e logs (005, 015).
- Painel e regras gerados por `npm run painel:gerar`, com datasources por variável para servirem no LGTM e no Grafana Cloud (015).
- Headers, CSP, HSTS em produção e checagem de `Origin` no `proxy.ts` (017).
- Recusa do `RITU_MODO=e2e` com `VERCEL_ENV=production` (017).

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Deploy:** pela CI, a cada push na `main`, só depois dos jobs `gates` e `db` verdes: migrações → deploy → smoke. Commit que falha nos gates nunca vai ao ar.
- **Banco:** Neon Free na região de São Paulo (`aws-sa-east-1`); as funções da Vercel também em São Paulo (`gru1`).
- **Alertas:** as cinco regras do painel avisam por e-mail a dona; o endereço fica só no Grafana Cloud e no `.env.local`, nunca no repositório.
- **Base:** revisão das linhas `a_confirmar` com a dona antes da construção (pré-condição acima).

## Objetivo

- Todo push na `main` com gates verdes chega à produção em um job, sem passo manual, e um commit com gate vermelho nunca chega.
- Depois de cada deploy, o smoke confere a versão no ar, banco, base, seed, headers, `401` do cron e `403` sem `Origin`; se falhar, a produção volta sozinha ao deploy anterior.
- A limpeza e a detecção de padrões rodam uma vez por dia em produção, sem ninguém.
- Um run feito em produção aparece como trace no Grafana Cloud, e as cinco regras de alerta estão carregadas com o e-mail da dona.
- Ninguém sobe dependência com vulnerabilidade alta sem a CI acusar; Dependabot abre os PRs toda semana.
- A dona liga tudo (contas, chaves, variáveis, segredos do GitHub) seguindo `DEPLOY.md` do começo ao fim, sem precisar perguntar nada.

## Escopo

- **Dentro:**
  - `vercel.json`: região `gru1`, crons, deploy pelo Git desligado.
  - Rota `GET /api/cron/padroes` e o apoio `autorizarCron`, comum às duas rotas de cron.
  - Rota `GET /api/saude`, protegida pelo `CRON_SECRET`, para o smoke.
  - Cliente do Postgres com o pooler do Neon (`prepare: false`).
  - Descarga da telemetria ao fim de cada pedido com trabalho (`after()`).
  - Catálogo de variáveis com a coluna de produção; ⚠️ `npm run env:producao`, que confere os nomes na Vercel.
  - ⚠️ `npm run smoke -- <url>` (sem LLM, roda na CI) e ⚠️ `npm run smoke:completo` (Playwright contra a produção, com LLM, só à mão).
  - ⚠️ `npm run painel:publicar`: painel, regras, ponto de contato de e-mail e política de notificação no Grafana Cloud, pela API.
  - Job `deploy` na CI, com o ambiente `producao` do GitHub, concorrência única e volta automática.
  - `npm audit --omit=dev --audit-level=high` no job `gates`; `.github/dependabot.yml`.
  - `outputFileTracingIncludes` com `seed/`.
  - Registro do checkpoint `c5-publico` em `evals/llm/checkpoints.ts`.
  - `DEPLOY.md` na raiz; ADRs; docs vivos.
- **Fora:**
  - Revisão das linhas `a_confirmar` da base: com a dona, antes desta spec (pré-condição).
  - Domínio próprio: pago; o site fica em `*.vercel.app` (ADR 0020).
  - Página `/bastidores` e servidor MCP: 023.
  - Tela Sobre com a política de privacidade, landing e README: 024.
  - Rodar o `c5-publico`: no fechamento da entrega 4, depois da 024.
  - Ambientes de preview: não existem (deploy pelo Git desligado).
  - Backup próprio do banco: só o histórico de restauração do Neon Free (ver Riscos).

## Necessidade de negócio

O Ritu é projeto de portfólio: só vale se alguém puder abrir o link. Ir ao ar sem trava põe na frente de quem avalia um commit quebrado ou uma base com fonte inventada; ir ao ar sem cron deixa dados vencidos acumulando no banco gratuito e padrões que nunca aparecem. O deploy pela CI, o smoke com volta automática e os alertas por e-mail fazem a produção se cuidar sozinha, que é o que um projeto de uma pessoa só consegue manter.

## Critérios de aceite

- [ ] **Deploy só com gates verdes:** o job `deploy` tem `needs: [gates, db]`, roda só em `push` na `main` (e em `workflow_dispatch` na `main`), nunca em `pull_request`; com `gates` ou `db` vermelho, não roda (conferido pelo YAML no teste do workflow).
- [ ] **Ordem no job:** `base:check --producao` → `env:producao` → `db:migrate` (URL direta) → `vercel deploy --prod` → `smoke`; qualquer passo vermelho para os seguintes (teste do workflow lê a ordem dos `steps`).
- [ ] **Volta automática:** se o smoke falha depois de um deploy bem-sucedido, o passo `vercel rollback` roda e o job termina vermelho (teste do workflow confere a condição `failure()` e o `id` do passo de deploy).
- [ ] **Concorrência:** dois pushes seguidos não fazem deploy em paralelo: `concurrency: { group: producao, cancel-in-progress: false }` no job.
- [ ] **Segredos no ambiente:** o job usa o ambiente `producao` do GitHub; nenhum segredo de produção aparece em outro job nem é impresso no log (teste do workflow procura `secrets.` fora do job `deploy`).
- [ ] **`vercel.json`:** `regions: ["gru1"]`, `git.deploymentEnabled: false` e os dois crons com as expressões desta spec; um teste valida o arquivo contra o schema zod `vercelConfigSchema` e confere que todo cron cai uma vez por dia (regra do Hobby).
- [ ] **Cron de padrões:** `GET /api/cron/padroes` sem `Authorization: Bearer <CRON_SECRET>` responde `401 { erro: "nao_autorizado" }` sem rodar nada; com ele, roda `detectarPadroes` e devolve `ResultadoDaDeteccao` (eval com o container em memória).
- [ ] **Cron comum:** `/api/cron/limpeza` e `/api/cron/padroes` usam o mesmo `autorizarCron`; comparação em tempo constante; `CRON_SECRET` ausente responde `503 { erro: "cron_desligado" }` (teste da função).
- [ ] **Saúde:** `GET /api/saude` sem o bearer responde `401`; com ele, devolve `Saude` com `banco: "ok"`, contagens da base, `seed: "ok"`, a última migração aplicada e `versao` igual a `RITU_VERSAO`; com o banco fora, `banco: "falhou"` e status `503` (eval com os fakes e com o adaptador de saúde em memória).
- [ ] **Pooler:** `opcoesDoPostgres(url)` devolve `prepare: false` quando o host tem `-pooler.` e não mexe em `prepare` nos outros casos (teste).
- [ ] **Descarga da telemetria:** com telemetria ligada, `criarRota`, `criarRotaDeFluxo` e as rotas de cron agendam `container.telemetry.encerrar()` em `after()`; com telemetria nula, não agendam nada (teste com a telemetria em memória contando as chamadas).
- [ ] **Catálogo:** toda variável de `ENV_VARS` tem `producao` em `obrigatoria | opcional | proibida | local | por_deploy`; `faltandoEmProducao(catalogo, nomes)` aponta as obrigatórias ausentes e as proibidas presentes (teste).
- [ ] **`env:producao` ⚠️:** com `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`, lista só os **nomes** das variáveis do alvo `production`, imprime "presente/ausente/proibida" por nome e sai com 1 se faltar obrigatória ou houver proibida; nunca imprime valor (teste com a resposta da API em fixture).
- [ ] **Smoke ⚠️:** `npm run smoke -- <url>` espera `versao` igual a `RITU_VERSAO_ESPERADA` (até 120 s), confere a saúde, `GET /` com `200` e o texto "Não é orientação médica", os headers (CSP com nonce e `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS), `401` em `/api/cron/limpeza` sem bearer e `403` em `POST /api/onboarding/aviso` sem `Origin`; imprime uma linha por checagem e sai com 1 na primeira falha de cada grupo, sem chamar modelo nem criar conta (as funções de checagem são puras e têm teste com respostas em fixture).
- [ ] **Smoke completo ⚠️:** `npm run smoke:completo` (Playwright, `playwright.producao.config.ts`, projeto `celular`) abre `SITE_URL`, entra pela demonstração, aceita o Aviso, manda a mensagem sugerida e espera a resposta com "Não é orientação médica" em até 90 s. Não roda no `test:e2e` nem na CI.
- [ ] **Painel no Grafana Cloud ⚠️:** `npm run painel:publicar` cria ou atualiza a pasta `Ritu`, o painel `ritu`, as cinco regras (com o uid do Prometheus do Grafana Cloud no lugar de `prometheus`), o ponto de contato `ritu-email` e a política raiz apontando para ele; rodar duas vezes não muda nada e imprime "sem mudança" em cada item (as funções que montam os pedidos são puras e têm teste).
- [ ] **Audit:** o job `gates` tem o passo `npm audit --omit=dev --audit-level=high` antes do build.
- [ ] **Dependabot:** `.github/dependabot.yml` com `npm` e `github-actions`, semanal, segunda às 09h `America/Sao_Paulo`, grupos de minor e patch (produção e desenvolvimento separados), até 5 PRs abertos, prefixo `chore(deps)` (validado por um teste que lê o YAML).
- [ ] **Seed no pacote:** `next.config.ts` inclui `./seed/**/*` em `outputFileTracingIncludes`, ao lado de `./data/**/*`; a saúde em produção mostra `seed: "ok"`.
- [ ] **`c5-publico` registrado:** `npm run eval:llm -- --checkpoint c5-publico --listar` lista os mesmos casos e o mesmo alvo do `c4-site`, sem modelo nem rede.
- [ ] **No ar (portão 4, depois de a dona seguir `DEPLOY.md`):** o primeiro deploy pela CI fica verde; `smoke:completo` passa em produção; o trace desse run aparece no Grafana Cloud em até 5 min e `ritu_runs_total` em até 15 min; o cron de limpeza aparece com `200` nos logs da Vercel no dia seguinte; entrar com Google na URL final funciona; uma regra de alerta disparada à mão (`Test` no ponto de contato) chega por e-mail.
- [ ] Gates 1 a 6 verdes, `npm run dup` limpo, `test:db` verde.

## O que fazer

- Escrever primeiro as funções puras com teste: `opcoesDoPostgres`, `faltandoEmProducao`, `autorizarCron`, as checagens do smoke, os montadores de pedido do `painel:publicar`, `vercelConfigSchema` e o teste do workflow; depois rotas, scripts e workflow.
- Ler na documentação **atual** da Vercel, do Neon e do Grafana Cloud o que esta spec cita (flags do `vercel` CLI, rota da API de variáveis, cabeçalho de proveniência do Grafana) antes de escrever; anotar diferenças em `.plans/DECISOES-AUTONOMAS.md`.
- Fixar a versão do `vercel` CLI no workflow (`npx vercel@<versão>`), a estável do dia da construção.
- Escrever `DEPLOY.md` como roteiro numerado, na ordem em que a dona cria as contas, com o que copiar de cada tela e para onde (variável da Vercel, segredo do GitHub ou `.env.local`), terminando no primeiro deploy e no roteiro do portão 4.
- Registrar em `.plans/BLOQUEIOS.md` o que depende das contas da dona (primeiro deploy, `painel:publicar`, `smoke:completo`) e seguir com o resto.
- Atualizar docs, comandos do `AGENTS.md`, `.env.example` e escrever as ADRs no fechamento.

## O que não fazer

- **Nunca mexer em `data/` nem tirar `a_confirmar` para passar o `base:check --producao`.** Gate vermelho por base é bloqueio da dona.
- Não ligar o deploy pelo Git da Vercel nem criar ambiente de preview.
- Não imprimir valor de variável, segredo, URL de banco nem e-mail em log da CI, script ou relatório.
- Não pôr e-mail da dona, URL do banco ou token no repositório (nem em `DEPLOY.md`, que usa marcadores como `<seu-email>`).
- Não chamar modelo nem criar conta no smoke da CI.
- Não rodar `smoke:completo` na CI nem nos gates.
- Não escrever migração que quebre o código que está no ar (ver Decisões, "Migrações").
- Não usar a chave de produção do Gemini fora da Vercel (evals e scripts usam a de desenvolvimento).
- Não expor `/api/saude` sem o bearer.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Quando vai ao ar | Job `deploy` na CI, a cada push na `main`, depois de `gates` e `db` verdes (dona) | Os agentes commitam direto na `main`; só os gates separam um commit quebrado da produção |
| Como o deploy é feito | `vercel deploy --prod` pelo CLI, com build na Vercel; deploy pelo Git desligado em `vercel.json` | O build usa as variáveis do projeto na Vercel; a CI só decide **quando** |
| Banco | Neon Free em `aws-sa-east-1` (dona) | Não pausa o projeto por inatividade (o Supabase Free pausa após 7 dias); dorme após 5 min e acorda em centenas de ms; 1 GB e 100 CU-h por mês bastam |
| Região das funções | `gru1` (São Paulo) | Um run faz dezenas de consultas ao banco e poucas chamadas ao Gemini; a função fica ao lado do banco e de quem usa |
| Conexão | `DATABASE_URL` na Vercel = URL com pooler (`-pooler`); `postgres` com `prepare: false` nesse caso; migrações pela URL direta (segredo `DATABASE_URL_DIRETA`) | O pooler do Neon é em modo transação e não aceita prepared statements; DDL vai direto |
| Migrações | Rodam na CI antes do deploy; toda migração tem que funcionar com o código que já está no ar (só acrescenta; renomear ou apagar coluna é feito em dois deploys) | Entre a migração e o fim do deploy, o código antigo atende com o schema novo; a volta automática também depende disso |
| Volta automática | Smoke vermelho → `vercel rollback` para o deploy de produção anterior | Ninguém acompanha a CI; o site volta a funcionar sozinho e o job vermelho avisa |
| Versão no ar | `vercel deploy -e RITU_VERSAO=<sha>`; a saúde devolve `versao`; o smoke espera o sha do commit | Confere que o smoke testa o deploy novo, não o anterior |
| Saúde | `GET /api/saude` com `Authorization: Bearer <CRON_SECRET>` | Uma consulta ao banco por chamada acordaria o Neon e gastaria CU-h; com o bearer, só a CI e a dona chamam |
| Smoke da CI | Sem LLM e sem criar conta | Cada push gastaria cota do Gemini e uma das 30 demonstrações do dia |
| Smoke completo | Playwright contra a produção, à mão, no portão e depois de mudanças grandes | É o único que prova o caminho real com o Gemini de produção |
| Crons | Dois crons diários (Hobby só aceita um por dia por cron, com precisão de 1 h): limpeza `0 6 * * *` (3h em São Paulo), padrões `0 8 * * *` (5h) | Madrugada no Brasil; horas diferentes, para a limpeza terminar antes da detecção mesmo com o atraso de até 59 min |
| Duração das funções | Padrão do Fluid compute no Hobby (300 s); nenhuma configuração | O trecho mais longo do run tem teto de 25 s (`config/loop.ts`); as pausas já evitam função longa |
| Descarga da telemetria | `after(() => container.telemetry.encerrar())` nas rotas com trabalho e nos crons, só com telemetria ligada | Na Vercel a instância pode congelar depois da resposta; métricas periódicas se perderiam |
| Variáveis de produção | Coluna `producao` no catálogo e ⚠️ `env:producao` pela API da Vercel, só com nomes | O deploy para antes de subir sem variável obrigatória ou com `RITU_MODO` |
| Segredos do GitHub | Ambiente `producao`, restrito à `main`: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DIRETA`, `CRON_SECRET`; variável `SITE_URL` | PR de fork e do Dependabot não leem os segredos |
| Google | O mesmo cliente OAuth, com a origem e o callback da URL final; tela de consentimento publicada ("Em produção") | Escopos `openid email` não pedem verificação; em "Teste" só entram os e-mails cadastrados |
| Grafana Cloud | Painel e regras pela API (`painel:publicar`), com `X-Disable-Provenance` para a dona poder editar na tela | O mesmo painel gerado pela 015; reproduzível em outra stack |
| Alertas | Ponto de contato `ritu-email` com `GRAFANA_ALERTA_EMAIL` (só no `.env.local`) e política raiz apontando para ele (dona) | A dona é avisada sem olhar o painel; o e-mail não entra no repositório |
| Dependabot | Semanal, grupos de minor e patch, majors sozinhos, até 5 PRs; a dona aprova o merge | Menos PRs; major pede leitura humana |
| `c5-publico` | Mesmos casos e mesmo alvo do `c4-site`, com a chave de **desenvolvimento** e os prompts e `config/` commitados (que são os de produção) | `RULES.md` §6 e `QA.md`: evals usam a chave de desenvolvimento; rodar contra a produção gastaria a cota de quem visita e escreveria no banco real |

## Contratos

### Cria

**`vercel.json`** (raiz)

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"],
  "git": { "deploymentEnabled": false },
  "crons": [
    { "path": "/api/cron/limpeza", "schedule": "0 6 * * *" },
    { "path": "/api/cron/padroes", "schedule": "0 8 * * *" }
  ]
}
```

A Vercel manda `Authorization: Bearer <CRON_SECRET>` sozinha quando a variável existe no projeto.

**Schema do arquivo** (`scripts/lib/vercel-config.ts`, usado só no teste)

```ts
export const vercelConfigSchema = z.object({
  $schema: z.string(),
  regions: z.tuple([z.literal("gru1")]),
  git: z.object({ deploymentEnabled: z.literal(false) }),
  crons: z.array(z.object({ path: z.string().startsWith("/api/cron/"), schedule: z.string() })).min(1),
}).strict()
export function cronDiario(expr: string): boolean
// true só com 5 campos, minuto e hora numéricos fixos, e dia, mês e dia da semana "*"
```

**Apoio dos crons** (`src/app/api/cron/_autorizar.ts`)

```ts
export type Autorizacao = { ok: true } | { ok: false; status: 401 | 503; erro: "nao_autorizado" | "cron_desligado" }
export function autorizarCron(cabecalho: string | null, segredo: string | undefined): Autorizacao
// segredo ausente ou vazio → 503 cron_desligado; cabeçalho diferente de `Bearer <segredo>` (comparação em tempo constante, com timingSafeEqual sobre buffers de mesmo tamanho) → 401 nao_autorizado
```

`/api/cron/limpeza` (017) passa a usar `autorizarCron`; a resposta e o `401` dela não mudam.

**Rotas**

| Rota | Autorização | Faz | Devolve |
|---|---|---|---|
| `GET /api/cron/padroes` | `autorizarCron` | `container.patterns.detectarPadroes()` | `200 ResultadoDaDeteccao`; erro inesperado → `500 { erro: "falhou" }`, com log `error` (`erro.codigo`) |
| `GET /api/saude` | `autorizarCron` (o mesmo segredo) | `container.saude()` | `200 Saude` com `banco: "ok"`; `503 Saude` com `banco: "falhou"` |

As três rotas exportam `export const dynamic = "force-dynamic"`, não passam por `criarRota` e agendam a descarga da telemetria em `after()`.

**Saúde** (`src/infra/saude.ts`, composição no container)

```ts
export type Saude = {
  versao: string | null                 // RITU_VERSAO
  ambiente: "production" | "preview" | "development"   // VERCEL_ENV, ou "development" sem ela
  banco: "ok" | "falhou"                // `select 1`, timeout de 3 s
  migracao: string | null               // nome da última linha de `_migracoes`, ou null se o banco falhou
  base: { alimentos: number; preparos: number; praticas: number }
  seed: "ok" | "falhou"                 // `seed/demo.yaml` lido e validado (017)
  telemetria: boolean                   // OTEL_EXPORTER_OTLP_ENDPOINT presente
  google: boolean                       // googleDisponivel() (017)
}
container.saude(): Promise<Saude>
```

Nenhum campo leva valor de variável, URL, e-mail ou mensagem de erro.

**Cliente do banco** (`src/infra/db/opcoes.ts`)

```ts
export function opcoesDoPostgres(url: string): { prepare?: false }
// host com "-pooler." → { prepare: false }; outros → {}; URL inválida → {}
```

`createDbClient` espalha `opcoesDoPostgres(url)` nas opções do `postgres`, depois das que já existem.

**Descarga da telemetria** (`src/app/_apoio/descarregar.ts`)

```ts
export function descarregarDepois(container: Container): void
// telemetria ligada: after(() => container.telemetry.encerrar()); nula: nada
```

Chamado por `criarRota`, `criarRotaDeFluxo` (no fim do fluxo transmitido) e pelas rotas de cron e saúde. O container ganha `telemetriaLigada: boolean`.

**Catálogo de variáveis** (`src/infra/env.ts`)

```ts
export type UsoEmProducao = "obrigatoria" | "opcional" | "proibida" | "local" | "por_deploy"
export type EnvVar = { name: string; entrega: 1 | 2 | 3 | 4; obrigatoria: boolean; producao: UsoEmProducao; descricao: string }
export function faltandoEmProducao(catalogo: readonly EnvVar[], nomes: readonly string[]): { ausentes: string[]; proibidas: string[] }
```

| Variável | `producao` | Descrição (catálogo e `.env.example`) |
|---|---|---|
| `DATABASE_URL` | obrigatoria | Postgres. Em produção, a URL do Neon **com** pooler |
| `GEMINI_API_KEY` | obrigatoria | Em produção, a chave do projeto de produção |
| `AUTH_SECRET`, `IP_HMAC_SECRET`, `CRON_SECRET` | obrigatoria | Sem mudança |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | obrigatoria | Sem mudança |
| `TESTER_IDS` | opcional | Sem mudança (021) |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | obrigatoria | Em produção, endpoint e token do Grafana Cloud |
| `OTEL_SERVICE_NAME` | opcional | Padrão `ritu` |
| `RITU_MODO` | proibida | Sem mudança (017) |
| `RITU_VERSAO` | por_deploy | Sha do commit, posto pela CI em cada deploy. Nova, entrega 4, não obrigatória |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | local | Para `env:producao` à mão. Novas, entrega 4, não obrigatórias |
| `GRAFANA_URL`, `GRAFANA_TOKEN`, `GRAFANA_ALERTA_EMAIL` | local | Para `painel:publicar`. Novas, entrega 4, não obrigatórias |
| `SITE_URL` | local | URL de produção, para `smoke` e `smoke:completo`. Nova, entrega 4, não obrigatória |

`faltandoEmProducao`: `ausentes` = obrigatórias que não estão em `nomes`; `proibidas` = proibidas que estão. `local` e `por_deploy` não entram em nenhuma das listas.

**Scripts**

| Comando | Linha do `package.json` | Faz |
|---|---|---|
| ⚠️ `npm run env:producao` | `node --env-file-if-exists=.env.local --import tsx scripts/env-producao.ts` | `GET` na API de variáveis do projeto na Vercel (alvo `production`, só `key` e `target`), `faltandoEmProducao`, uma linha por variável do catálogo: `presente`, `ausente`, `proibida` ou `—` (local); código 1 com ausente ou proibida, 2 se a API não responde |
| ⚠️ `npm run smoke -- <url>` | `node --env-file-if-exists=.env.local --import tsx scripts/smoke.ts` | Checagens abaixo; `<url>` ou `SITE_URL`; precisa de `CRON_SECRET`; `RITU_VERSAO_ESPERADA` opcional |
| ⚠️ `npm run smoke:completo` | `playwright test -c playwright.producao.config.ts` | Caminho da demonstração em produção, com LLM |
| ⚠️ `npm run painel:publicar` | `node --env-file-if-exists=.env.local --import tsx scripts/painel-publicar.ts` | Publica no Grafana Cloud, abaixo |

**Smoke** (`scripts/lib/smoke.ts`, funções puras; `scripts/smoke.ts` faz os pedidos)

```ts
export type Checagem = { grupo: "versao" | "saude" | "pagina" | "headers" | "protecao"; nome: string; ok: boolean; detalhe: string }
export function checarSaude(s: unknown, esperado: { versao?: string; ultimaMigracao: string }): Checagem[]
export function checarPagina(status: number, html: string): Checagem[]
export function checarHeaders(h: Headers): Checagem[]
export function checarProtecao(r: { cronSemBearer: number; postSemOrigin: number }): Checagem[]
```

- **versao:** `GET /api/saude` a cada 5 s, até `versao === RITU_VERSAO_ESPERADA` ou 120 s (sem a variável, pula).
- **saude:** `banco` e `seed` `ok`; contagens da base maiores que zero; `migracao` igual ao maior arquivo de `db/migrations/` do checkout; `telemetria` e `google` `true`; `ambiente` `production`.
- **pagina:** `GET /` → `200` e o HTML contém "Não é orientação médica".
- **headers:** CSP com `nonce-`, `frame-ancestors 'none'` e sem `'unsafe-inline'` em `script-src`; `x-content-type-options: nosniff`; `referrer-policy: strict-origin-when-cross-origin`; `permissions-policy` com `camera=()`, `microphone=()` e `geolocation=()`; `strict-transport-security` com `max-age` de pelo menos 31536000.
- **protecao:** `GET /api/cron/limpeza` sem bearer → `401`; `POST /api/onboarding/aviso` sem `Origin` → `403`.

`detalhe` só traz status, nome de header ou o valor esperado; nunca corpo de resposta nem segredo.

**Smoke completo** (`playwright.producao.config.ts`, `e2e-producao/demonstracao.spec.ts`): `testDir: "e2e-producao"`, `baseURL: process.env.SITE_URL`, só o projeto `celular`, sem `webServer`, `retries: 0`, `timeout: 120_000`. Passos: Entrada → "Experimentar" → Aviso → "Entendi" → Conversa → mensagem sugerida → espera o texto da resposta com "Não é orientação médica". O `playwright.config.ts` da 001 continua com `testDir: "e2e"`.

**Grafana Cloud** (`scripts/lib/painel-publicar.ts`, funções puras; `scripts/painel-publicar.ts` faz os pedidos)

```ts
export type Pedido = { metodo: "GET" | "POST" | "PUT"; caminho: string; corpo?: unknown }
export function trocarDatasource(regras: unknown, uidCloud: string): unknown   // troca o uid `prometheus` (config/telemetria.ts) pelo da stack
export function pedidoDoPainel(painel: object, pastaUid: string): Pedido       // POST /api/dashboards/db, overwrite: true
export function pedidosDasRegras(regras: unknown, pastaUid: string): Pedido[]   // PUT /api/v1/provisioning/alert-rules/:uid (POST se 404)
export function pedidoDoContato(email: string): Pedido                          // ponto de contato `ritu-email`, tipo email
export function pedidoDaPolitica(): Pedido                                      // PUT /api/v1/provisioning/policies, receptor raiz `ritu-email`
export function mudou(atual: unknown, novo: unknown): boolean                   // compara ignorando id, version e datas
```

Ordem: acha o uid do datasource Prometheus da stack (`GET /api/datasources`, tipo `prometheus`, o primeiro com nome começado por `grafanacloud-`) → pasta `Ritu` (uid `ritu`) → painel (de `observability/dashboards/ritu.json`) → regras (de `observability/grafana/alerting/ritu.yaml`) → contato → política. Todo pedido de provisionamento leva `X-Disable-Provenance: true`. `Authorization: Bearer <GRAFANA_TOKEN>` (token de conta de serviço com papel Admin). Cada item imprime `criado`, `atualizado` ou `sem mudança`; o e-mail nunca é impresso. Falha de um pedido: código 1 com o caminho e o status.

`config/telemetria.ts` ganha `grafana.producao: { pasta: "Ritu", uidDaPasta: "ritu", contato: "ritu-email" }`.

**Workflow** (`.github/workflows/ci.yml`)

- `on`: acrescenta `workflow_dispatch`.
- Job `gates`: passo `Auditoria` com `npm audit --omit=dev --audit-level=high`, depois de "Instalar dependências".
- Job novo `deploy`:

```yaml
deploy:
  needs: [gates, db]
  if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch')
  runs-on: ubuntu-latest
  environment: producao
  concurrency: { group: producao, cancel-in-progress: false }
  env:
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  steps:
    - checkout; setup-node (.nvmrc, cache npm); npm ci
    - name: Base sem a_confirmar
      run: npm run base:check -- --producao
    - name: Variáveis na Vercel
      run: npm run env:producao
      env: { VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }} }
    - name: Migrações
      run: npm run db:migrate
      env: { DATABASE_URL: ${{ secrets.DATABASE_URL_DIRETA }} }
    - name: Deploy
      id: deploy
      run: npx vercel@<versão> deploy --prod --yes --token "$VERCEL_TOKEN" -e RITU_VERSAO=${{ github.sha }}
      env: { VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }} }
    - name: Smoke
      run: npm run smoke -- "${{ vars.SITE_URL }}"
      env: { CRON_SECRET: ${{ secrets.CRON_SECRET }}, RITU_VERSAO_ESPERADA: ${{ github.sha }} }
    - name: Voltar ao deploy anterior
      if: failure() && steps.deploy.outcome == 'success'
      run: npx vercel@<versão> rollback --yes --token "$VERCEL_TOKEN"
      env: { VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }} }
```

(`<versão>` é a mesma nos dois passos; a sintaxe exata das flags é conferida na versão fixada.)

**Teste do workflow** (`scripts/ci-workflow.test.ts`): lê o YAML com `yaml` e confere `needs`, `if`, `environment`, `concurrency`, a ordem dos nomes dos passos do `deploy`, a condição do passo de volta, o passo de auditoria no `gates` e que `secrets.` só aparece dentro do job `deploy`.

**Dependabot** (`.github/dependabot.yml`)

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly, day: monday, time: "09:00", timezone: America/Sao_Paulo }
    open-pull-requests-limit: 5
    commit-message: { prefix: "chore(deps)" }
    groups:
      producao: { dependency-type: production, update-types: [minor, patch] }
      desenvolvimento: { dependency-type: development, update-types: [minor, patch] }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly, day: monday, time: "09:00", timezone: America/Sao_Paulo }
    commit-message: { prefix: "chore(deps)" }
```

**`next.config.ts`**: `outputFileTracingIncludes: { "/**": ["./data/**/*", "./seed/**/*"] }`.

**Checkpoint** (`evals/llm/checkpoints.ts`): entrada `c5-publico` com as mesmas pastas e o mesmo alvo do `c4-site`, logo depois dele.

**`DEPLOY.md`** (raiz), em seções numeradas, cada passo com a tela, o que copiar e para onde:

1. Antes: `base:check -- --producao` verde (pré-condição); `gh` na conta da dona.
2. **Gemini:** projeto de produção no AI Studio, sem faturamento; chave → `GEMINI_API_KEY` da Vercel (produção). Conferir as cotas de `AI.md` §10.
3. **Neon:** projeto `ritu` em `AWS São Paulo (sa-east-1)`, Postgres 17; URL **com** pooler → `DATABASE_URL` da Vercel; URL **sem** pooler → segredo `DATABASE_URL_DIRETA` do GitHub.
4. **Vercel:** projeto importado do repositório (Hobby), nome `ritu` (ou o primeiro livre); Node 24; Fluid compute ligado; região `gru1` (vem do `vercel.json`); variáveis de produção do catálogo, com `AUTH_SECRET`, `IP_HMAC_SECRET` e `CRON_SECRET` novos (`openssl rand -base64 32`, diferentes dos de desenvolvimento); token de conta → segredo `VERCEL_TOKEN`; `orgId` e `projectId` (de `vercel link` ou das configurações) → `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`. A URL de produção → variável `SITE_URL` do GitHub e `SITE_URL` do `.env.local`.
5. **Google:** no cliente OAuth existente, origem `https://<url>` e callback `https://<url>/api/auth/callback/google`; tela de consentimento publicada ("Em produção").
6. **Grafana Cloud:** stack Free na região mais próxima; endpoint OTLP e cabeçalho `Authorization=Basic <...>` → `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_EXPORTER_OTLP_HEADERS` da Vercel; conta de serviço Admin → `GRAFANA_URL` e `GRAFANA_TOKEN` no `.env.local`; `GRAFANA_ALERTA_EMAIL=<seu-email>` no `.env.local`; `npm run painel:publicar`.
7. **GitHub:** ambiente `producao` com a regra "só a `main`"; segredos `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DIRETA`, `CRON_SECRET` (o mesmo da Vercel); variável `SITE_URL`; Dependabot alerts ligados.
8. **Conferir:** `npm run env:producao`; disparar o workflow (`gh workflow run CI --ref main`) e acompanhar; `npm run smoke:completo`; trace no Grafana Cloud; "Test" no ponto de contato chega por e-mail.
9. **No dia a dia:** deploy é push na `main`; voltar à mão (`vercel rollback` ou "Instant Rollback" no painel); ver os crons em "Cron Jobs" do projeto; regra das migrações; trocar um segredo (Vercel + GitHub + redeploy pelo `workflow_dispatch`).

### Usa

- **001:** catálogo `ENV_VARS`, `env:check`, `requireEnv`, `optionalEnv`, workflow da CI (jobs `gates` e `db`), `playwright.config.ts`, teste de arquitetura.
- **002:** `npm run base:check -- --producao` (código 1 com `a_confirmar` ou fonte não aprovada); `readDadosDaBase`.
- **004:** `createDbClient`, `db:migrate` com `_migracoes`, `executarLimpeza` e `ResultadoLimpeza`.
- **005 e 015:** `Telemetry.encerrar()` (descarrega traces, métricas e logs), `createNullTelemetry`, `src/instrumentation.ts` com `@vercel/otel`; `observability/dashboards/ritu.json`, `observability/grafana/alerting/ritu.yaml`, `config/telemetria.ts` (`grafana.uidMetricas: "prometheus"`), `ritu_runs_total`.
- **012:** `container.patterns.detectarPadroes(): Promise<ResultadoDaDeteccao>`, com `ResultadoDaDeteccao = { contas: number; propostos: number; falhas: number }`.
- **014:** `evals/llm/checkpoints.ts` e a entrada `c4-site`.
- **017:** `GET /api/cron/limpeza`, `googleDisponivel()`, leitor e validação de `seed/demo.yaml`, `proxy.ts` (CSP, headers, HSTS com `VERCEL_ENV=production`, `origemValida`), `criarRota`, recusa de `RITU_MODO=e2e` em produção, `POST /api/onboarding/aviso`.
- **018:** `criarRotaDeFluxo`.
- **021:** `TESTER_IDS` e o catálogo com a descrição nova.

## Evals (quando a spec toca agente, prompt, tool ou base)

A spec não toca agente, prompt, tool nem base. Nenhum caso com LLM novo; o `c5-publico` só é registrado.

Determinísticos novos:

- `evals/det/seguranca/cron-e-saude.eval.ts`: `/api/cron/padroes` e `/api/saude` sem bearer, com bearer errado, com `CRON_SECRET` ausente e com o certo; a saúde nunca devolve valor de variável (procura canários plantados em todas as variáveis do catálogo no corpo).
- `evals/det/mapa.ts`: as linhas "Cron sem segredo" e "Saúde sem segredo" ganham o arquivo.

## Nível das partes

- **nucleo** (Sonnet): `descarregarDepois` e a integração em `criarRota` e `criarRotaDeFluxo`; `opcoesDoPostgres` no cliente do banco; `container.saude()`.
- Todo o resto é `mecanica`: `vercel.json` e o schema, rotas de cron e saúde, `autorizarCron`, catálogo e `env:producao`, smoke e smoke completo, `painel:publicar`, workflow e o teste dele, Dependabot, `next.config.ts`, checkpoint, `DEPLOY.md`, docs.
- Nenhuma tela.

## Leitura para a construção

- `ARCHITECTURE.md` §4 "Proteção do site" e §8–§9: serviços, planos e ambientes.
- `OBSERVABILITY.md` §3 "Ambientes" e "Privacidade": o que pode sair em log e span.
- `DEVELOPMENT.md` "Regras" (segredos e variáveis).
- `RULES.md` §4 (bloqueios por conta da dona) e §5 (git).
- `.specs/017-entrada-e-contas.md`, Contratos: `criarRota`, `proxy.ts`, rota de limpeza.

## Dependências

- **Contas da dona** (gratuitas, sem cartão, `PREPARO.md` §3): Vercel Hobby, Neon Free, projeto de produção no AI Studio, Grafana Cloud Free, ambiente `producao` no GitHub. A construção não espera por elas: o código, o workflow e o `DEPLOY.md` ficam prontos e testados; primeiro deploy, `painel:publicar` e `smoke:completo` vão para `.plans/BLOQUEIOS.md` até a dona seguir o `DEPLOY.md`.
- **Revisão da base** (pré-condição desta spec).
- `vercel` CLI por `npx` com versão fixada (sem dependência no `package.json`).
- APIs: Vercel (variáveis do projeto), Grafana (dashboards, provisionamento de alertas, datasources).
- Specs 001, 002, 004, 005, 012, 014, 015, 017, 018, 021.
- Nenhuma migração.

## Riscos e trade-offs

- **Commit vai ao ar sem olho humano:** é a escolha da dona; os gates, o smoke e a volta automática são a rede. Os portões continuam sendo onde ela confere.
- **Banco sem backup próprio:** o Neon Free guarda um histórico curto de restauração; perder dados de visitantes de um projeto de estudo é aceitável, e quase tudo nele vence em dias (limpeza).
- **Neon dormindo:** a primeira consulta depois de 5 min parado leva algumas centenas de ms a mais; `connect_timeout` de 10 s cobre.
- **100 CU-h por mês:** com 0,25 CU, cobre cerca de 13 h acordado por dia; cada visita acorda o banco por 5 min. Se acabar, o Neon suspende até o mês seguinte e o site mostra o erro de banco: o alerta "Runs falhando" avisa. Projeto de estudo aceita.
- **Cron com atraso de até 59 min e só uma vez por dia:** limpeza e padrões não precisam de hora exata.
- **Métricas no serverless:** a descarga em `after()` aumenta um pouco o tempo de CPU por pedido; sem ela as métricas periódicas se perdem. Se mesmo assim faltarem séries no Grafana Cloud, o rastro no banco (`runs`, `run_etapas`) continua inteiro.
- **`x-forwarded-for`:** a 017 confia no primeiro endereço; conferir na documentação da Vercel que ela reescreve o header na borda (anotar em `DECISOES-AUTONOMAS.md`).
- **Volta automática com migração nova:** só é segura porque toda migração é compatível com o código anterior; a regra vai para `DEVELOPMENT.md`.
- **`c5-publico` fora da produção:** mede os prompts e a configuração que estão no ar, não a rede e o banco de produção; o `smoke:completo` cobre o caminho real.

## Edge cases e modos de falha

- `base:check --producao` vermelho: o job `deploy` para no primeiro passo; nada é migrado nem publicado. Não é tarefa de agente "consertar": é bloqueio da dona.
- Variável obrigatória faltando na Vercel: `env:producao` para o job antes da migração, com o nome da variável.
- API da Vercel fora do ar: `env:producao` sai com 2 e o job para; o próximo push tenta de novo.
- Migração falha: o job para antes do deploy; a produção continua no código anterior com o schema anterior (a migração roda em transação, 004).
- Deploy falha (build na Vercel): o passo de volta não roda (deploy não teve sucesso); a produção continua no anterior.
- Smoke falha por demora (versão não chega em 120 s): volta automática; o job vermelho mostra a checagem `versao`.
- Primeiro deploy com smoke vermelho: não há deploy anterior; `vercel rollback` falha e o job termina vermelho com as duas falhas; a dona corrige pelo `DEPLOY.md`.
- Dois pushes em sequência: o segundo espera o primeiro (`concurrency`); os dois sobem em ordem.
- `CRON_SECRET` diferente na Vercel e no GitHub: o smoke recebe `401` da saúde e falha com "saude: 401"; volta automática.
- Cron de padrões com erro numa conta: `detectarPadroes` soma em `falhas` e segue (012); a rota devolve `200` com as contagens.
- Cron chamado duas vezes no mesmo dia (reenvio da Vercel): limpeza e detecção são idempotentes (004, 012).
- `GRAFANA_TOKEN` sem papel Admin: `painel:publicar` falha no pedido de política com o status `403` e o caminho.
- Stack do Grafana sem datasource `grafanacloud-*` do tipo Prometheus: `painel:publicar` sai com 1 antes de qualquer escrita.
- Dependabot com major que quebra a CI: o PR fica vermelho e não vai ao ar; a dona decide.

## Resultado (definição de pronto)

- Critérios de aceite marcados (os do item "No ar" no portão 4, depois de a dona seguir o `DEPLOY.md`).
- `DEPLOY.md` seguido do começo ao fim pela dona sem dúvida pendente.
- ADRs: `NNNN-deploy-pela-ci-com-volta-automatica.md` e `NNNN-producao-em-sao-paulo-com-neon.md` (próximos números livres).
- `.docs/` atualizados: `ARCHITECTURE.md` §1 (crons de limpeza e padrões, horários), §4 (`/api/saude` com o segredo do cron; Dependabot e auditoria como estão), §7 (pastas e arquivos novos), §8 (Neon Free em São Paulo, Vercel `gru1`), §9 (fluxo de deploy, ambiente `producao` do GitHub, URL com e sem pooler); `OBSERVABILITY.md` §3 (Grafana Cloud por `painel:publicar`, alertas por e-mail) e §5 (entrega 4); `DEVELOPMENT.md` (migração compatível com o código no ar; `DEPLOY.md`); `QA.md` (`c5-publico` com a chave de desenvolvimento); `ROADMAP.md` §0.
- `AGENTS.md`: comandos ⚠️ `env:producao`, ⚠️ `smoke`, ⚠️ `smoke:completo`, ⚠️ `painel:publicar`; `DEPLOY.md` no mapa.
- `PREPARO.md` §3 aponta para o `DEPLOY.md` nas linhas da entrega 4.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `vercel.json`, `DEPLOY.md`, `next.config.ts`, `package.json`, `.env.example`, `playwright.producao.config.ts` (novos ou alterados na raiz)
- `.github/workflows/ci.yml`, `.github/dependabot.yml`
- `src/app/api/cron/_autorizar.ts`, `src/app/api/cron/padroes/route.ts`, `src/app/api/cron/limpeza/route.ts`, `src/app/api/saude/route.ts`, `src/app/_apoio/descarregar.ts`
- `src/infra/env.ts`, `src/infra/db/opcoes.ts`, `src/infra/db/client.ts`, `src/infra/saude.ts`, `src/infra/container.ts`
- Apoio das rotas da 017 e da 018 (`criarRota`, `criarRotaDeFluxo`)
- `config/telemetria.ts`
- `scripts/env-producao.ts`, `scripts/smoke.ts`, `scripts/painel-publicar.ts`, `scripts/lib/smoke.ts`, `scripts/lib/painel-publicar.ts`, `scripts/lib/vercel-config.ts`, `scripts/ci-workflow.test.ts`
- `e2e-producao/demonstracao.spec.ts`
- `evals/llm/checkpoints.ts`, `evals/det/seguranca/cron-e-saude.eval.ts`, `evals/det/mapa.ts`
- `.adrs/`, `.docs/ARCHITECTURE.md`, `.docs/OBSERVABILITY.md`, `.docs/DEVELOPMENT.md`, `.docs/QA.md`, `.docs/ROADMAP.md`, `AGENTS.md`, `PREPARO.md`
