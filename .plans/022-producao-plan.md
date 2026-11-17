# 022 · Produção · plano

Spec: `.specs/022-producao.md` (approved). Trilha adiantada, branch `entrega-4`, autorizada pela dona em 2026-11-17.

## Achados antes de quebrar

- `next.config.ts` já tem `outputFileTracingIncludes: { "/**": ["./data/**/*", "./seed/**/*"] }` (017). O critério "Seed no pacote" ganha só um teste na T1.
- A limpeza já existe em `src/app/_rotas/cron.ts` (`rotaDaLimpeza`, com `autorizado()` local e 401 `{ erro: "sem_autorizacao" }`); a rota fica em `src/app/api/cron/limpeza/route.ts`. As rotas novas seguem o mesmo desenho: o handler testável em `src/app/_rotas/`, o `route.ts` só liga.
- `evals/llm/checkpoints.ts` não tem `c4-site` (nasce no fechamento da entrega 3). O `c5-publico` "igual ao `c4-site`" fica **adiado** para a junção com o `c4-site` (022 A2).
- `evals/det/mapa.ts` não tem as linhas "Cron sem segredo" e "Saúde sem segredo": a T11 as cria (`desde: 4`) com o arquivo novo.
- `vercel` CLI fixado em `65.17.0` (a estável do dia, 2026-11-17). Pela documentação atual: `deploy --prod --yes --token "$VERCEL_TOKEN" --env RITU_VERSAO=<sha>` (`--env` é variável de runtime); `rollback` sem argumento volta ao deploy de produção anterior (no Hobby, só ao anterior) e não documenta `--yes`: usa a opção global `--non-interactive` (022 A3).
- API de variáveis da Vercel: `GET https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/env?teamId={VERCEL_ORG_ID}`, `Authorization: Bearer <VERCEL_TOKEN>`; resposta `{ envs: [{ key, target, ... }] }`, com `target` em lista ou texto (`production`, `preview`, `development`). Sem `decrypt`.
- A Vercel reescreve `x-forwarded-for` na borda e não repassa IP externo (documentação de request headers): a confiança da 017 no primeiro endereço vale (022 A4).

## Tarefas

### T1 · Add vercel.json and its schema test
- nivel: mecanica
- objetivo: criar `vercel.json` e o schema que o valida, com a regra de cron diário do Hobby.
- arquivos: `vercel.json`, `scripts/lib/vercel-config.ts`, `scripts/lib/vercel-config.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
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
  ```ts
  export const vercelConfigSchema = z.object({
    $schema: z.string(),
    regions: z.tuple([z.literal("gru1")]),
    git: z.object({ deploymentEnabled: z.literal(false) }),
    crons: z.array(z.object({ path: z.string().startsWith("/api/cron/"), schedule: z.string() })).min(1),
  }).strict()
  export function cronDiario(expr: string): boolean
  // true só com 5 campos, minuto e hora numéricos fixos (0–59, 0–23), e dia, mês e dia da semana "*"
  ```
- testes primeiro: `vercel.json` (lido do disco) passa no schema; todo cron dele é `cronDiario`; `cronDiario` aceita `0 6 * * *`, recusa `*/5 * * * *`, `0 6 1 * *`, `0 * * * *`, `0 6 * * 1`, expressão com 4 ou 6 campos e minuto 60; schema recusa chave a mais e `regions: ["iad1"]`; `next.config.ts` (importado) tem `./seed/**/*` e `./data/**/*` em `outputFileTracingIncludes["/**"]`.
- comandos: `npx vitest run scripts/lib/vercel-config.test.ts`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam e o JSON é exatamente o do contrato.
- fora: `next.config.ts` (só lido no teste), `package.json`.

### T2 · Share autorizarCron between the cron routes
- nivel: mecanica
- objetivo: criar `autorizarCron` e fazer a limpeza usá-lo.
- arquivos: `src/app/api/cron/_autorizar.ts`, `src/app/api/cron/_autorizar.test.ts`, `src/app/_rotas/cron.ts`, `src/app/_rotas/cron.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  export type Autorizacao = { ok: true } | { ok: false; status: 401 | 503; erro: "nao_autorizado" | "cron_desligado" }
  export function autorizarCron(cabecalho: string | null, segredo: string | undefined): Autorizacao
  // segredo ausente ou vazio → { ok: false, status: 503, erro: "cron_desligado" }
  // cabeçalho diferente de `Bearer <segredo>` → { ok: false, status: 401, erro: "nao_autorizado" }
  // comparação em tempo constante: timingSafeEqual (node:crypto) sobre buffers de mesmo tamanho; tamanhos diferentes → 401 sem chamar timingSafeEqual
  ```
  Em `rotaDaLimpeza` (`src/app/_rotas/cron.ts`): troque a função local `autorizado` por `autorizarCron(request.headers.get("authorization"), deps.segredo())`. Segredo ausente → `503 { erro: "cron_desligado" }`. Cabeçalho errado → mantém a resposta de hoje, `401 { erro: "sem_autorizacao" }` (a spec manda não mudar o 401 da limpeza; 022 A1). O resto da rota não muda.
- testes primeiro: `autorizarCron` com segredo `undefined` e `""` → 503; cabeçalho `null`, `Bearer errado`, `Bearer <segredo>x`, `bearer <segredo>` → 401; `Bearer <segredo>` → ok; em `cron.test.ts`, limpeza sem segredo → 503 `cron_desligado` e não chama a limpeza; os testes de hoje da limpeza seguem passando.
- comandos: `npx vitest run src/app/api/cron src/app/_rotas/cron.test.ts`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam e não sobra `timingSafeEqual` em `src/app/_rotas/cron.ts`.
- fora: `route.ts` das rotas, rotas novas.

### T3 · Turn off prepared statements on the Neon pooler
- nivel: nucleo
- objetivo: o cliente do Postgres passa `prepare: false` quando a URL é a do pooler do Neon.
- arquivos: `src/infra/db/opcoes.ts`, `src/infra/db/opcoes.test.ts`, `src/infra/db/client.ts`, `src/infra/db/client.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  export function opcoesDoPostgres(url: string): { prepare?: false }
  // host com "-pooler." → { prepare: false }; outros → {}; URL inválida → {}
  ```
  `createDbClient` espalha `opcoesDoPostgres(url)` nas opções do `postgres`, **depois** das que já existem.
- testes primeiro: `postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech/db?sslmode=require` → `{ prepare: false }`; a mesma sem `-pooler` → `{}`; `postgres://localhost:5432/ritu` → `{}`; `nao é url` → `{}`; host `pooler.exemplo.com` (sem hífen antes) → `{}`; em `client.test.ts`, as opções passadas ao `postgres` com a URL do pooler têm `prepare: false` e mantêm as que já tinham.
- comandos: `npx vitest run src/infra/db/opcoes.test.ts src/infra/db/client.test.ts`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam; nenhuma URL ou senha é logada.
- fora: migrações, `container.ts`.

### T4 · Add the production column to the env catalog
- nivel: mecanica
- objetivo: cada variável do catálogo diz o uso em produção, com a função que aponta faltas e proibidas.
- arquivos: `src/infra/env.ts`, `src/infra/env.test.ts`, `.env.example`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  export type UsoEmProducao = "obrigatoria" | "opcional" | "proibida" | "local" | "por_deploy"
  export type EnvVar = { name: string; entrega: 1 | 2 | 3 | 4; obrigatoria: boolean; producao: UsoEmProducao; descricao: string }
  export function faltandoEmProducao(catalogo: readonly EnvVar[], nomes: readonly string[]): { ausentes: string[]; proibidas: string[] }
  // ausentes = obrigatórias (producao) que não estão em nomes; proibidas = proibidas que estão; local e por_deploy não entram; ordem do catálogo
  ```
  | Variável | `producao` | Descrição (catálogo e `.env.example`) |
  |---|---|---|
  | `DATABASE_URL` | obrigatoria | Postgres. Em produção, a URL do Neon **com** pooler |
  | `GEMINI_API_KEY` | obrigatoria | Em produção, a chave do projeto de produção |
  | `AUTH_SECRET`, `IP_HMAC_SECRET`, `CRON_SECRET` | obrigatoria | Sem mudança |
  | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | obrigatoria | Sem mudança |
  | `TESTER_IDS` | opcional | Sem mudança |
  | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | obrigatoria | Em produção, endpoint e token do Grafana Cloud |
  | `OTEL_SERVICE_NAME` | opcional | Padrão `ritu` |
  | `RITU_MODO` | proibida | Sem mudança |
  | `RITU_VERSAO` | por_deploy | Sha do commit, posto pela CI em cada deploy. Nova, entrega 4, não obrigatória |
  | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | local | Para `env:producao` à mão. Novas, entrega 4, não obrigatórias |
  | `GRAFANA_URL`, `GRAFANA_TOKEN`, `GRAFANA_ALERTA_EMAIL` | local | Para `painel:publicar`. Novas, entrega 4, não obrigatórias |
  | `SITE_URL` | local | URL de produção, para `smoke` e `smoke:completo`. Nova, entrega 4, não obrigatória |

  "Sem mudança" = a descrição atual fica. Variável do catálogo que não está na tabela: escolha `opcional` se o produto roda sem ela, e liste no relatório. `.env.example` ganha as variáveis novas com valor vazio e um comentário curto, nunca valor real.
- testes primeiro: toda entrada de `ENV_VARS` tem `producao` válido; as linhas da tabela batem; `faltandoEmProducao` aponta obrigatória ausente, proibida presente (`RITU_MODO`), ignora `local` e `por_deploy`, e devolve listas vazias com tudo certo; todo nome do catálogo aparece em `.env.example` (lido do disco); `env:check -- --entrega 4` continua sem exigir as novas.
- comandos: `npx vitest run src/infra/env.test.ts scripts/lib/env-report.test.ts`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam.
- fora: `scripts/` (o `env:producao` é a T12), `.env.local` (nunca ler).

### T5 · Write the smoke checks as pure functions
- nivel: mecanica
- objetivo: as checagens do smoke de produção, puras e testadas com respostas em fixture.
- arquivos: `scripts/lib/smoke.ts`, `scripts/lib/smoke.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  export type Checagem = { grupo: "versao" | "saude" | "pagina" | "headers" | "protecao"; nome: string; ok: boolean; detalhe: string }
  export function checarSaude(s: unknown, esperado: { versao?: string; ultimaMigracao: string }): Checagem[]
  export function checarPagina(status: number, html: string): Checagem[]
  export function checarHeaders(h: Headers): Checagem[]
  export function checarProtecao(r: { cronSemBearer: number; postSemOrigin: number }): Checagem[]
  export function ultimaMigracao(arquivos: readonly string[]): string   // o maior nome de .sql da lista, no mesmo formato que src/infra/db/migrate.ts grava na coluna de nome de _migracoes (leia o migrate.ts para saber se vai com ou sem a extensão)
  export function versaoChegou(s: unknown, esperada: string): boolean
  ```
  Saúde (o corpo de `GET /api/saude`):
  ```ts
  type Saude = { versao: string | null; ambiente: "production" | "preview" | "development"; banco: "ok" | "falhou"; migracao: string | null;
    base: { alimentos: number; preparos: number; praticas: number }; seed: "ok" | "falhou"; telemetria: boolean; google: boolean }
  ```
  - **saude:** `banco` e `seed` `ok`; contagens da base maiores que zero; `migracao` igual a `esperado.ultimaMigracao`; `telemetria` e `google` `true`; `ambiente` `production`; com `esperado.versao`, `versao` igual. Corpo que não é `Saude` (zod) → uma checagem falha "formato".
  - **pagina:** `status === 200` e o HTML contém "Não é orientação médica".
  - **headers:** CSP com `nonce-`, `frame-ancestors 'none'` e sem `'unsafe-inline'` em `script-src`; `x-content-type-options: nosniff`; `referrer-policy: strict-origin-when-cross-origin`; `permissions-policy` com `camera=()`, `microphone=()` e `geolocation=()`; `strict-transport-security` com `max-age` ≥ 31536000.
  - **protecao:** `cronSemBearer === 401`; `postSemOrigin === 403`.
  - `detalhe` só traz status, nome de header ou o valor esperado; nunca corpo de resposta, valor de header recebido inteiro, nem segredo.
- testes primeiro: um caso verde e um vermelho por checagem; saúde com formato errado; CSP com `'unsafe-inline'` em `style-src` passa e em `script-src` falha; HSTS `max-age=600` falha; nenhum `detalhe` contém o HTML da fixture nem o valor da CSP inteiro.
- comandos: `npx vitest run scripts/lib/smoke.test.ts`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam; nenhuma função faz pedido de rede.
- fora: `scripts/smoke.ts` (T12), `package.json`.

### T6 · Write the Grafana Cloud publishing requests as pure functions
- nivel: mecanica
- objetivo: montar os pedidos do `painel:publicar` sem rede.
- arquivos: `scripts/lib/painel-publicar.ts`, `scripts/lib/painel-publicar.test.ts`, `config/telemetria.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  export type Pedido = { metodo: "GET" | "POST" | "PUT"; caminho: string; corpo?: unknown }
  export function trocarDatasource(regras: unknown, uidCloud: string): unknown   // troca todo datasourceUid igual a config.telemetria.grafana.uidMetricas ("prometheus") pelo da stack; "__expr__" fica
  export function pedidoDoPainel(painel: object, pastaUid: string): Pedido       // POST /api/dashboards/db, corpo { dashboard: painel sem id, folderUid: pastaUid, overwrite: true }
  export function pedidosDasRegras(regras: unknown, pastaUid: string): Pedido[]   // um PUT /api/v1/provisioning/alert-rules/:uid por regra, com folderUID = pastaUid (o script faz POST /api/v1/provisioning/alert-rules se o PUT der 404)
  export function pedidoDoContato(email: string): Pedido                          // ponto de contato uid e nome "ritu-email", tipo "email", settings.addresses = email
  export function pedidoDaPolitica(): Pedido                                      // PUT /api/v1/provisioning/policies, receiver raiz "ritu-email"
  export function pedidoDaPasta(): Pedido                                         // POST /api/folders { uid: "ritu", title: "Ritu" }
  export function uidDoPrometheusCloud(datasources: unknown): string | null       // primeiro tipo "prometheus" com nome começado por "grafanacloud-"
  export function mudou(atual: unknown, novo: unknown): boolean                   // compara ignorando id, version, updated, created, provenance e datas
  export const CABECALHO_SEM_PROVENIENCIA = { "X-Disable-Provenance": "true" }
  ```
  `config/telemetria.ts` ganha, dentro de `grafana`, `producao: { pasta: "Ritu", uidDaPasta: "ritu", contato: "ritu-email" }`; as funções usam esses valores. As regras vêm de `observability/grafana/alerting/ritu.yaml` (formato de provisionamento por arquivo: `groups[].rules[]`); confira o formato no arquivo e o da API de provisionamento (uma regra por pedido, com `ruleGroup` e `folderUID`).
- testes primeiro: com o YAML e o painel reais do repositório, `trocarDatasource` não deixa nenhum `"prometheus"` e mantém `__expr__`; cinco pedidos de regra, todos `PUT` com o uid da regra; contato com o e-mail no corpo e `pedidoDoContato` não loga; política com o receptor; `uidDoPrometheusCloud` acha o certo e devolve `null` sem `grafanacloud-*`; `mudou` é `false` para o mesmo objeto com `id`/`version`/datas diferentes e `true` com um campo real diferente.
- comandos: `npx vitest run scripts/lib/painel-publicar.test.ts config`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam; nenhum e-mail ou token em código ou teste (use `alguem@exemplo.com`).
- fora: `scripts/painel-publicar.ts` (T12), `scripts/lib/painel.ts` e os arquivos gerados.

### T7 · Add the deploy job, the audit step and Dependabot to CI
- nivel: mecanica
- objetivo: o deploy sai pela CI só com gates verdes, com volta automática; auditoria e Dependabot.
- arquivos: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `scripts/ci-workflow.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  - `on`: acrescenta `workflow_dispatch` (o resto fica).
  - Job `gates`: passo `Auditoria` com `npm audit --omit=dev --audit-level=high`, logo depois de "Instalar dependências" (antes do build).
  - Job novo `deploy` (o `npx vercel@65.17.0` é o mesmo nos dois passos):
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
      - checkout; setup-node (.nvmrc, cache npm); npm ci   # copie o formato dos jobs existentes
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
        run: npx vercel@65.17.0 deploy --prod --yes --token "$VERCEL_TOKEN" --env RITU_VERSAO=${{ github.sha }}
        env: { VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }} }
      - name: Smoke
        run: npm run smoke -- "${{ vars.SITE_URL }}"
        env: { CRON_SECRET: ${{ secrets.CRON_SECRET }}, RITU_VERSAO_ESPERADA: ${{ github.sha }} }
      - name: Voltar ao deploy anterior
        if: failure() && steps.deploy.outcome == 'success'
        run: npx vercel@65.17.0 rollback --token "$VERCEL_TOKEN" --non-interactive
        env: { VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }} }
  ```
  O passo "Base sem a_confirmar" fica exatamente assim, sem `continue-on-error` nem condição: com `a_confirmar` na base, o deploy para ali.
  - `.github/dependabot.yml`:
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
- testes primeiro (`scripts/ci-workflow.test.ts`, lendo os YAML com `yaml`): `needs`, `if`, `environment`, `concurrency`; a ordem dos nomes dos passos do `deploy` (depois dos de instalação): Base sem a_confirmar → Variáveis na Vercel → Migrações → Deploy → Smoke → Voltar ao deploy anterior; o passo da base roda `base:check -- --producao` sem `continue-on-error` nem `if`; a condição do passo de volta contém `failure()` e `steps.deploy.outcome == 'success'`; o `id` do deploy é `deploy`; as duas chamadas do `vercel` usam a mesma versão fixa (sem `latest`); `workflow_dispatch` em `on`; o passo `Auditoria` vem antes do build no `gates`; `secrets.` só aparece dentro do job `deploy`; o Dependabot tem os dois ecossistemas, `monday`, `09:00`, `America/Sao_Paulo`, limite 5 e prefixo `chore(deps)`.
- comandos: `npx vitest run scripts/ci-workflow.test.ts`, `npx biome check scripts/ci-workflow.test.ts`, `npm run typecheck`
- pronto quando: os testes passam; os jobs `gates`, `evals` e `db` não mudam além do passo de auditoria.
- fora: `package.json` (os scripts `env:producao` e `smoke` são da T12).

### T8 · Add the health check and the telemetry flag to the container
- nivel: nucleo
- objetivo: `container.saude()` e `container.telemetriaLigada`.
- arquivos: `src/infra/saude.ts`, `src/infra/saude.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- depende de: nenhuma
- leitura: `OBSERVABILITY.md` §3 "Privacidade"
- skills: nenhuma
- contratos:
  ```ts
  export type Saude = {
    versao: string | null                 // RITU_VERSAO
    ambiente: "production" | "preview" | "development"   // VERCEL_ENV, ou "development" sem ela (valor desconhecido → "development")
    banco: "ok" | "falhou"                // `select 1`, timeout de 3 s
    migracao: string | null               // nome da última linha de `_migracoes` (ordem de aplicação), ou null se o banco falhou
    base: { alimentos: number; preparos: number; praticas: number }
    seed: "ok" | "falhou"                 // seed/demo.yaml lido e validado (loadDemoSeed da 017)
    telemetria: boolean                   // OTEL_EXPORTER_OTLP_ENDPOINT presente
    google: boolean                       // googleDisponivel() (src/infra/auth/next.ts)
  }
  // container.saude(): Promise<Saude>; container.telemetriaLigada: boolean (true quando a telemetria montada não é a nula)
  ```
  Escreva `saude.ts` como uma função com dependências injetadas (consulta ao banco, leitura das migrações, contagens da base, leitor do seed, `env`), para testar sem banco; o container compõe. No modo em memória (sem `DATABASE_URL`, ou e2e) o banco responde `ok` e `migracao` é `null`. Nenhum campo leva valor de variável, URL, e-mail ou mensagem de erro; erro do banco não vai para log com a mensagem (só `erro.codigo`, se logar).
- testes primeiro: tudo ok; banco que lança → `banco: "falhou"`, `migracao: null`, sem a mensagem do erro em nenhum campo; banco que demora mais de 3 s (relógio falso ou timer falso) → `falhou`; seed inválido → `seed: "falhou"`; `VERCEL_ENV` ausente → `development`; contagens iguais às da base carregada; `telemetriaLigada` `false` com a telemetria nula e `true` com endpoint; canário: com todas as variáveis do catálogo com valores únicos, `JSON.stringify(saude)` não contém nenhum deles (exceto `RITU_VERSAO` em `versao`).
- comandos: `npx vitest run src/infra/saude.test.ts src/infra/container.test.ts`, `npx biome check <arquivos>`, `npm run typecheck`
- pronto quando: os testes passam; o teste de arquitetura segue verde.
- fora: rotas, `src/app/`.

### T9 · Flush telemetry after each request with work
- nivel: nucleo
- objetivo: com telemetria ligada, as rotas agendam `container.telemetry.encerrar()` em `after()`.
- arquivos: `src/app/_apoio/descarregar.ts`, `src/app/_apoio/descarregar.test.ts`, `src/app/_lib/rota.ts`, `src/app/_lib/rota.test.ts`, `src/app/_lib/fluxo.ts`, `src/app/_lib/fluxo.test.ts`
- depende de: T8
- leitura: nenhuma
- skills: next-best-practices (só a parte de `after`)
- contratos:
  ```ts
  export function descarregarDepois(container: Container, agendar?: (f: () => Promise<void>) => void): void
  // telemetriaLigada: agendar(() => container.telemetry.encerrar()); nula: nada. agendar padrão = after de "next/server"
  ```
  `criarRota` chama depois de montar a resposta (sucesso ou erro tratado); `criarRotaDeFluxo` chama no fim do fluxo transmitido (quando o stream fecha, inclusive com erro). O `agendar` injetável existe só para o teste não depender do Next.
- testes primeiro: com a telemetria em memória ligada, uma rota de `criarRota` agenda uma vez e, ao rodar o agendado, `encerrar` é chamado uma vez; com a nula, nada é agendado; `criarRotaDeFluxo` agenda depois de o stream fechar, não antes; erro dentro da rota ainda agenda.
- comandos: `npx vitest run src/app/_apoio src/app/_lib`, `npx biome check <arquivos>`, `npm run typecheck`, `npm test` (a assinatura de `criarRota` não muda; confira os usos)
- pronto quando: os testes passam e nenhuma rota existente muda de comportamento.
- fora: rotas de cron e saúde (T10).

### T10 · Add the patterns cron route and the health route
- nivel: mecanica
- objetivo: `GET /api/cron/padroes` e `GET /api/saude`, com `autorizarCron`, e a descarga nas três rotas de cron e saúde.
- arquivos: `src/app/_rotas/cron.ts`, `src/app/_rotas/cron.test.ts`, `src/app/_rotas/saude.ts`, `src/app/_rotas/saude.test.ts`, `src/app/api/cron/padroes/route.ts`, `src/app/api/saude/route.ts`, `src/app/api/cron/limpeza/route.ts`
- depende de: T2, T8, T9
- leitura: nenhuma
- skills: nenhuma
- contratos:
  | Rota | Autorização | Faz | Devolve |
  |---|---|---|---|
  | `GET /api/cron/padroes` | `autorizarCron` (401 `{ erro: "nao_autorizado" }`, 503 `{ erro: "cron_desligado" }`) | `container.patterns.detectarPadroes()` | `200 ResultadoDaDeteccao` (`{ contas: number; propostos: number; falhas: number }`); erro inesperado → `500 { erro: "falhou" }`, com `container.telemetry.log` de nível `error` e só `erro.codigo` |
  | `GET /api/saude` | `autorizarCron` (o mesmo `CRON_SECRET`) | `container.saude()` | `200 Saude` com `banco: "ok"`; `503 Saude` com `banco: "falhou"` |

  Os `route.ts` exportam `export const dynamic = "force-dynamic"`, não passam por `criarRota`, leem o segredo de `process.env.CRON_SECRET` e chamam `descarregarDepois(container)`; os handlers testáveis ficam em `src/app/_rotas/` como a limpeza (`rotaDosPadroes`, `rotaDaSaude`). A limpeza também passa a chamar `descarregarDepois`. Código de log novo, se preciso, entra antes em `src/core/telemetry/nomes.ts` (aí acrescente o arquivo à tarefa e diga no relatório).
- testes primeiro: padrões sem bearer → 401 e `detectarPadroes` não roda; sem segredo → 503; com bearer → 200 com as contagens; `detectarPadroes` que lança → 500 `falhou`; saúde sem bearer → 401, sem segredo → 503, com bearer e banco ok → 200, banco falhou → 503 com o corpo `Saude`; descarga agendada nas três rotas com telemetria ligada.
- comandos: `npx vitest run src/app/_rotas src/app/api`, `npx biome check <arquivos>`, `npm run typecheck`, `npm run build`
- pronto quando: os testes passam e o build lista as duas rotas novas.
- fora: `proxy.ts` (as rotas `/api/cron/*` e `/api/saude` são GET e não precisam de `Origin`; se o `proxy.ts` barrar, pare e diga).

### T11 · Cover the cron and health routes with a deterministic eval
- nivel: mecanica
- objetivo: eval de segurança das rotas de cron e saúde.
- arquivos: `evals/det/seguranca/cron-e-saude.eval.ts`, `evals/det/mapa.ts`
- depende de: T10
- leitura: nenhuma
- skills: nenhuma
- contratos: `/api/cron/padroes` e `/api/saude` sem bearer, com bearer errado, com `CRON_SECRET` ausente e com o certo, pelo container em memória; a saúde nunca devolve valor de variável: plante canários (valores únicos) em todas as variáveis de `ENV_VARS` e procure cada um no corpo (só `RITU_VERSAO` pode aparecer, em `versao`). Em `evals/det/mapa.ts`, duas linhas novas no grupo de segurança (copie o grupo das linhas de `evals/det/seguranca/`), `desde: 4`: `linha: "Cron sem segredo: /api/cron/* responde 401 sem o bearer e 503 sem CRON_SECRET"` e `linha: "Saúde sem segredo: /api/saude pede o bearer e não devolve valor de variável"`, as duas com `arquivos: ["evals/det/seguranca/cron-e-saude.eval.ts"]`. Se `mapa.eval.ts` exigir que a linha exista em `.docs/QA.md`, acrescente as duas linhas na tabela de evals determinísticos de `QA.md` (e o arquivo à tarefa).
- testes primeiro: o próprio eval.
- comandos: `npx vitest run --config <config do eval:det> evals/det/seguranca/cron-e-saude.eval.ts evals/det/mapa.eval.ts` (veja o script `eval:det` no `package.json`), `npx biome check <arquivos>`
- pronto quando: o eval e o `mapa.eval.ts` passam.
- fora: código de produção.

### T12 · Add the production scripts and the production smoke spec
- nivel: mecanica
- objetivo: os comandos ⚠️ `env:producao`, `smoke`, `smoke:completo` e `painel:publicar`.
- arquivos: `package.json`, `scripts/env-producao.ts`, `scripts/smoke.ts`, `scripts/painel-publicar.ts`, `scripts/lib/env-producao.ts`, `scripts/lib/env-producao.test.ts`, `playwright.producao.config.ts`, `e2e-producao/demonstracao.spec.ts`, `biome.json` ou `tsconfig.json` só se `e2e-producao/` não for coberto (diga no relatório)
- depende de: T4, T5, T6
- leitura: nenhuma
- skills: nenhuma
- contratos:
  | Comando | Linha do `package.json` | Faz |
  |---|---|---|
  | ⚠️ `npm run env:producao` | `node --env-file-if-exists=.env.local --import tsx scripts/env-producao.ts` | `GET https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?teamId=${VERCEL_ORG_ID}` com `Authorization: Bearer ${VERCEL_TOKEN}`; considera só `key` e `target` dos `envs` com alvo `production` (`target` pode ser lista ou texto); `faltandoEmProducao`; uma linha por variável do catálogo: `presente`, `ausente`, `proibida` ou `—` (local e por_deploy); código 1 com ausente ou proibida, 2 se a API não responde ou não é 2xx; nunca imprime valor |
  | ⚠️ `npm run smoke -- <url>` | `node --env-file-if-exists=.env.local --import tsx scripts/smoke.ts` | Checagens da T5, na ordem versao → saude → pagina → headers → protecao; `<url>` ou `SITE_URL`; precisa de `CRON_SECRET`; `RITU_VERSAO_ESPERADA` opcional (sem ela, pula versao); versao: `GET /api/saude` com bearer a cada 5 s até `versaoChegou` ou 120 s; `ultimaMigracao` do maior arquivo de `db/migrations/`; imprime uma linha por checagem e sai com 1 na primeira falha de cada grupo; não chama modelo nem cria conta |
  | ⚠️ `npm run smoke:completo` | `playwright test -c playwright.producao.config.ts` | Abaixo |
  | ⚠️ `npm run painel:publicar` | `node --env-file-if-exists=.env.local --import tsx scripts/painel-publicar.ts` | Com `GRAFANA_URL`, `GRAFANA_TOKEN`, `GRAFANA_ALERTA_EMAIL`: acha o uid (`GET /api/datasources`, sai com 1 antes de escrever se `null`) → pasta → painel (`observability/dashboards/ritu.json`) → regras (`observability/grafana/alerting/ritu.yaml`, PUT; 404 → POST) → contato → política; todo pedido de provisionamento leva `X-Disable-Provenance: true`; `Authorization: Bearer <GRAFANA_TOKEN>`; cada item imprime `criado`, `atualizado` ou `sem mudança` (lê o atual e usa `mudou`); nunca imprime o e-mail nem o token; falha de um pedido: código 1 com o caminho e o status |

  Escreva a parte de `env:producao` que não faz rede em `scripts/lib/env-producao.ts` (`nomesEmProducao(resposta: unknown): string[]` com zod, `linhasDoEnvProducao(catalogo, nomes): { linhas: string[]; codigo: 0 | 1 }`) e teste com uma resposta da API em fixture.
  **Smoke completo:** `playwright.producao.config.ts` com `testDir: "e2e-producao"`, `use.baseURL: process.env.SITE_URL`, só o projeto `celular` (copie o `devices` do projeto `celular` de `playwright.config.ts`), sem `webServer`, `retries: 0`, `timeout: 120_000`. `e2e-producao/demonstracao.spec.ts`: Entrada → "Experimentar" → Aviso → "Entendi" → Conversa → mensagem sugerida → espera o texto da resposta com "Não é orientação médica" em até 90 s. Use os textos de `config/` e os helpers de `e2e/apoio/` que servirem. O `playwright.config.ts` continua com `testDir: "e2e"` e o `test:e2e` não roda `e2e-producao/`.
- testes primeiro: `env-producao.test.ts` (alvo em lista e em texto, preview ignorado, proibida, ausente, resposta malformada → erro, nenhuma linha com valor); o resto é casca de rede.
- comandos: `npx vitest run scripts/lib`, `npx biome check <arquivos>`, `npm run typecheck`, `npx playwright test -c playwright.producao.config.ts --list` (só lista, sem rede)
- pronto quando: os testes passam, `--list` mostra um teste no projeto `celular`, e nenhum dos quatro comandos roda nos gates.
- fora: `.github/`, rodar qualquer comando ⚠️.

### T13 · Write DEPLOY.md
- nivel: mecanica
- objetivo: o roteiro numerado que a dona segue para ligar as contas, sem nenhum valor real.
- arquivos: `DEPLOY.md`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos: seções numeradas, cada passo com a tela, o que copiar e para onde (variável da Vercel, segredo do GitHub ou `.env.local`), marcadores como `<seu-email>`, `<url>`, `<token>`; nunca e-mail, URL de banco ou token reais.
  1. Antes: `base:check -- --producao` verde (hoje há linhas `a_confirmar` na base, a resolver com o Claude antes do primeiro deploy; enquanto houver, o job `deploy` para no primeiro passo); `gh` na conta da dona.
  2. **Gemini:** projeto de produção no AI Studio, sem faturamento; chave → `GEMINI_API_KEY` da Vercel (produção). Conferir as cotas de `AI.md` §10.
  3. **Neon:** projeto `ritu` em `AWS São Paulo (sa-east-1)`, Postgres 17; URL **com** pooler → `DATABASE_URL` da Vercel; URL **sem** pooler → segredo `DATABASE_URL_DIRETA` do GitHub.
  4. **Vercel:** projeto importado do repositório (Hobby), nome `ritu` (ou o primeiro livre); Node 24; Fluid compute ligado; região `gru1` (vem do `vercel.json`); variáveis de produção do catálogo (liste as obrigatórias e opcionais de produção: `DATABASE_URL`, `GEMINI_API_KEY`, `AUTH_SECRET`, `IP_HMAC_SECRET`, `CRON_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, e opcionais `TESTER_IDS`, `OTEL_SERVICE_NAME`; `RITU_MODO` nunca), com `AUTH_SECRET`, `IP_HMAC_SECRET` e `CRON_SECRET` novos (`openssl rand -base64 32`, diferentes dos de desenvolvimento); token de conta → segredo `VERCEL_TOKEN`; `orgId` e `projectId` (de `vercel link` ou das configurações) → `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`. A URL de produção → variável `SITE_URL` do GitHub e `SITE_URL` do `.env.local`.
  5. **Google:** no cliente OAuth existente, origem `https://<url>` e callback `https://<url>/api/auth/callback/google`; tela de consentimento publicada ("Em produção").
  6. **Grafana Cloud:** stack Free na região mais próxima; endpoint OTLP e cabeçalho `Authorization=Basic <...>` → `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_EXPORTER_OTLP_HEADERS` da Vercel; conta de serviço Admin → `GRAFANA_URL` e `GRAFANA_TOKEN` no `.env.local`; `GRAFANA_ALERTA_EMAIL=<seu-email>` no `.env.local`; `npm run painel:publicar`.
  7. **GitHub:** ambiente `producao` com a regra "só a `main`"; segredos `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DIRETA`, `CRON_SECRET` (o mesmo da Vercel); variável `SITE_URL`; Dependabot alerts ligados.
  8. **Conferir:** `npm run env:producao`; disparar o workflow (`gh workflow run CI --ref main`) e acompanhar; `npm run smoke:completo`; trace no Grafana Cloud; "Test" no ponto de contato chega por e-mail.
  9. **No dia a dia:** deploy é push na `main`; voltar à mão (`vercel rollback` ou "Instant Rollback" no painel); ver os crons em "Cron Jobs" do projeto; regra das migrações (só acrescentar; renomear ou apagar coluna em dois deploys); trocar um segredo (Vercel + GitHub + redeploy pelo `workflow_dispatch`).
  10. **Roteiro do portão 4:** os itens "No ar" da spec: primeiro deploy pela CI verde; `smoke:completo` passa; trace em até 5 min e `ritu_runs_total` em até 15 min; cron de limpeza com `200` nos logs no dia seguinte; Google na URL final; "Test" do ponto de contato chega por e-mail.
- testes primeiro: nenhum (texto); confira com `grep` que não há `@` fora de `<seu-email>` nem URL com senha.
- comandos: `npx biome check DEPLOY.md` (se o Biome ignora `.md`, só o grep)
- pronto quando: o arquivo segue a ordem acima e não tem valor real.
- fora: qualquer outro arquivo.

### T14 · Close spec 022 (orquestrador)
- nivel: orquestrador
- objetivo: ADRs `NNNN-deploy-pela-ci-com-volta-automatica.md` e `NNNN-producao-em-sao-paulo-com-neon.md`; docs vivos da seção "Resultado" da spec; comandos ⚠️ no `AGENTS.md` e `DEPLOY.md` no mapa; `PREPARO.md` §3; spec `implemented` só com os critérios que não dependem das contas (os "No ar" ficam no `BLOQUEIOS.md`).
- depende de: T1 a T13

## Adiadas

- **c5-publico** (`evals/llm/checkpoints.ts`): depende do `c4-site`, que ainda não existe (022 A2). Entra na junção com o fechamento da entrega 3.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2, T3, T4, T5 | Funções puras e arquivos novos, sem arquivo em comum |
| 2 | T6, T7, T8, T13 | Sem dependência pendente e sem arquivo em comum com as outras |
| 3 | T9 | Depende de T8 (`telemetriaLigada`); mexe em `criarRota` e `criarRotaDeFluxo`, usados por todas as rotas |
| 4 | T10 | Depende de T2, T8 e T9 |
| 5 | T12 | Mexe em `package.json`: roda sozinha |
| 6 | T11 | Depende de T10 |
| 7 | T14 | Fechamento |
