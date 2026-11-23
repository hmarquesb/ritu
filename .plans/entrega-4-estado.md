# Entrega 4 · Estado

> Autorizações da dona (2026-11-16):
> - Exceção ao §7.2: a 018 vale como `implemented` pela branch `entrega-3`, que é a base desta branch (`entrega-4` saiu de `entrega-3`, ainda não juntada na `main`). Construir a 021 e, desde 2026-11-17 (autorização nova da dona), a 022 nesta branch; a 023 em diante fica para depois.
> - No passo §7.3, além de `git merge main`, fazer `git merge entrega-3`. Nunca juntar nada na `main`.
> - Seguir sozinho até 95% de uso (janela de 5 horas e contexto); a partir de 85%, no máximo duas tarefas por onda. Ao terminar ou parar, fazer a passagem.
> Trilha adiantada (worktree `../ritu-worktrees/entrega-4`, branch `entrega-4`), aberta em 2026-11-17. `main` e `entrega-3` juntadas antes de planejar a 021 (já em dia, aab215e).
> A 019 e a 020 não estão nesta branch (021 A1): na junção com elas, uma tarefa de correção põe `textoDoLimite` + `toast` em `useCasa`, no hook de Como ficou? e em `useVoce`, e o E2E de toques em Minha casa.
> `npm run lint` pelo rtk dá falso erro de JSON: usar `rtk bypass npm run lint`. E2E neste worktree: `CI=1 npm run test:e2e`.
> `test:db` (⚠️) não roda na trilha adiantada (021 A4): o contrato estendido do `UsageLimiter` fica para a junção.

## 021 · Limites e degradação

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Add the usage limits and the limit texts to the config | concluida | 998164d |
| T2 · Let the usage limiter take a start per key and clean minute rows | concluida | 7bc3b24 |
| T3 · Tell when the day quota of a role is gone and when it comes back | concluida | 40f94de |
| T4 · Add the limit metric and its panel stat | concluida | ed26142 |
| T5 · Recognize testers by Google e-mail at sign-in | concluida | cf6f383 |
| T6 · Write the limit keys, the limit error and the touch limit | concluida | 9798d09 |
| T8 · Answer from the base when the person's messages ran out | concluida | 6f5cf43 |
| T11 · Let E2E tests force the day quota out per request | concluida | 256fdc4 |
| T7 · Decide each message and read the limits state | concluida | f730c49 |
| T9 · Count a touch in every POST route and answer 429 | concluida | 15b2fd5 |
| T12 · Build the quota banner, the spent box, the remaining note and the touch text | concluida | 32acb03 |
| T10 · Decide the message limit in POST /api/runs and send limits to the screen | concluida | 45ba3e3 |
| T13 · Keep the limits state in the conversation hook | concluida | 7f22d3d |
| T15 · Show the touch limit notice in the onboarding | concluida | 6666740 |
| T16 · Cover the limits with deterministic evals | concluida | b71cc43 |
| T14 · Show the limits in the conversation screen | concluida | cf7ab9d |
| T17 · Cover the limit screens end to end | concluida | 6ab1d13 |
| T21 · Give the conversation log room above the sticky panel (correção) | concluida | dbe381e |
| T20 · (revertida na junção com a entrega-3, que traz o relógio noturno) | revertida | 438479b |
| T22 · Pass quemPede in the house route tests and evals (correção) | concluida (no merge) | 6660c47 |
| T23 · Show the touch limit in Minha casa and Como ficou? (correção) | concluida (no merge) | 6660c47 |
| T24 · Document the limits and write the ADR (fechamento) | concluida | (commit de docs) |
| T18 · Make the privacy leak evals deterministic (correção) | concluida | 21d5dbd |
| T19 · Fix the time-dependent house question tests (correção) | concluida | 575bab4 |
| T20 · Let E2E tests pin the hour per request (correção) | concluida | a91d363 |
| T25 · Merge main (portão 2 + revisão da base) and keep the night e2e clock (correção) | concluida | 1c7f69b |

> Retomada em 2026-11-17 (05:20 -03). Pendências da passagem: T18 aprovada, diff em `.local/patches/021-T18.patch` (causa: UUIDs aleatórios contendo "cafe"). T17 reprovada 1x: o spec excluía `[role="log"]` do axe; sem a exclusão, `target-size` (desktop, intermitente) num botão do log parcialmente coberto pelo painel sticky (`conversa.tsx:283`). Pedido: esperar a rolagem parar antes do axe e rodar sem exclusão; se persistir, correção de layout na tela. Conferir também `e2e/conversa.spec.ts` "axe … pergunta" no desktop (possível regressão da T14). Fechamento: `dup` em `quemDe`/fuso repetidos; ação `desfez` sem teste; `limites` do 429 lido sem zod em `use-conversa.ts`.

> 021 fechada em 2026-11-17: gates 1 a 6 e `dup` verdes na junção (6660c47); spec `implemented`; ADR 0045. Trilha adiantada sem outra spec liberada: a 022 em diante fica para depois (autorização da dona). Pendências para a junção na `main`: `test:db` do `UsageLimiter` (021 A4); toast de toque em `useVoce` quando a 020 chegar (021 A1); número da ADR 0045 pode colidir com ADR nova da trilha principal.

> Junção da `main` em 2026-11-17 (§7.3, T25; portão 2 fechado e revisão da base). Conflitos em 7 arquivos, com uma causa só: os dois lados criaram um relógio para o modo e2e. A `main` (P2-T9) partia de 20h30 UTC e perguntava a banana. Esta branch tem o relógio deslocado para a noite (`createRelogioE2e`, da `entrega-3`, 019 C3); a T20, de hora por requisição, já tinha sido revertida em 438479b. Fica o relógio noturno, com o roteiro de couve e leite e os testes desta branch. Medido à mão: à noite, o roteiro da couve e do leite pausa em `waiting_for_input` nas 12 datas do ano, às 21h, 1h e 3h de São Paulo; o da banana não pausa. Ficam como nesta branch: `relogio.ts`, `relogio.test.ts`, `roteiros.test.ts`, `fluxo-de-run.test.ts`, `e2e/conversa.spec.ts` e `e2e/roteiros/pergunta-casa.ts`. O `container.ts` perde o `relogioDoE2e` da `main`. O `conversar.test.ts` e o `DECISOES-AUTONOMAS.md` ficam com o que veio dos dois lados. Gates: lint, typecheck, test (3241), eval:det (1421), base:check (49 a_confirmar, sem erros), dup (0 clones), build e `CI=1 npm run test:e2e` (186 passam; "recarregar no meio" falhou uma vez sob carga e passou isolado 3 de 3).

## 022 · Produção

Plano em `.plans/022-producao-plan.md`. `c5-publico` adiado (022 A2).

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Add vercel.json and its schema test | concluida | 454bac7 |
| T2 · Share autorizarCron between the cron routes | concluida | ac16829 |
| T3 · Turn off prepared statements on the Neon pooler | concluida | 0f792ca |
| T4 · Add the production column to the env catalog | concluida | 2e9af68 |
| T5 · Write the smoke checks as pure functions | concluida | bee9ab7 |
| T6 · Write the Grafana Cloud publishing requests as pure functions | concluida | ba7a0c2 |
| T7 · Add the deploy job, the audit step and Dependabot to CI | concluida | d56fc4a |
| T8 · Add the health check and the telemetry flag to the container | concluida | 2f53c20 |
| T9 · Flush telemetry after each request with work | concluida | 0f9b2f5 |
| T10 · Add the patterns cron route and the health route | concluida | 5049b6e |
| T11 · Cover the cron and health routes with a deterministic eval | concluida | d84b6d0 |
| T12 · Add the production scripts and the production smoke spec | concluida | 28c987f |
| T13 · Write DEPLOY.md | concluida | 7b4e997 |
| T14 · Close spec 022 | concluida | (commit de docs) |

> 022 fechada em 2026-11-17 na trilha adiantada: gates 1 a 6, `dup` (0 clones) e `base:check` (49 `a_confirmar`, sem erros) verdes; spec `implemented`; ADRs 0046 a 0048. Pendente: `c5-publico` (022 A2, espera o `c4-site`); o que depende das contas da dona está em `.plans/BLOQUEIOS.md` (base, primeiro deploy, `painel:publicar`, `smoke:completo`, flags do `vercel` CLI). Sem push (pedido da dona). Pendências para a junção na `main`: `test:db` do `UsageLimiter` (021 A4) e do `container.saude()` com Postgres real; linhas de status de `AGENTS.md`, `ROADMAP.md` §0 e `.specs/README.md` ficam com a sessão principal.


## 025 · Chás híbridos

Plano em `.plans/025-chas-hibridos-plan.md`. Na `main`.

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Turn agua-morna-com-limao into a pratica | concluida | 5f77408 |
| T2 · Add the cha field and derive single-herb teas | concluida | ccb364d |
| T3 · Validate and mount the derived teas in the knowledge base | concluida | 8a56da9 |
| T4 · Review the cha field of the six herbs and write rule R9 | concluida | 62cf4e5 |
| T5 · Make the tea pattern generic | concluida | de64927 |
| T6 · Seed the demo profile with the generic tea pattern | concluida | 0e01c99 |
| T7 · Migrate the stored tea pattern keys | concluida | b98484a |
| T8 · Add acompanhante.v7 | concluida | aa8c485 |
| T9 · Add the deterministic evals for derived teas and the generic pattern | concluida | d4461e7 |
| T10 · Add the c3 LLM cases for the tea pattern | concluida | 8d1d73f |
| T11 · Close spec 025 | concluida | (commit de docs) |

> 025 fechada em 2026-11-17 na `main`: gates 1 a 6, `dup` (0 clones), `base:check -- --producao` e `test:db` verdes (3433 testes, 1452 casos det, 187 e2e). ADR 0049. Decisões 025 A1 a A3. Pendente: push (o job `deploy` aplica a `0005` em produção) e a rodada nova do `c3-confiavel` com `c3-s23`/`c3-s24`.

## 027 · Checkpoints pelas rotas

Plano em `.plans/027-checkpoints-pelas-rotas-plan.md`. Na `main` (entrega 4, depois do portão 3). Branch `entrega-4` já juntada (sem commit além da `main`).

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Give each checkpoint a target and register c4-site and c5-publico | concluida | 81ad2fd |
| T2 · Run a scenario through the site route handlers | concluida | 14c274e |
| T3 · Add the route checks list and the target lines to the report | concluida | 4c6f61b |
| T4 · Run the run cases through the routes and check the route flow | concluida | 340784a |
| T5 · Pick the case runner by the checkpoint target | concluida | 87a2bc2 |

> 027 fechada em 2026-11-22 na `main`: ADR 0053; decisões 027 A1 a A3; 022 A2 e J-A5 resolvidas. `c5-publico` fica para o fechamento da entrega 4, depois da 024.

| Tarefa (027, correção) | Status | Commit |
|---|---|---|
| T6 · Keep the route flush off in the scenario container | concluida | 293e8f8 |

> Fumaça ⚠️ do fechamento da 027 (2026-11-22): `--checkpoint c5-publico --caso c2-p01-frio-so-incertos` acertou, com pausa pela rota de resposta e as 5 checagens `rota` ok. A 1ª tentativa achou o `after()` do Next fora de requisição (telemetria ligada pelo ambiente): corrigido na T6.

## 023 · Bastidores e MCP

Plano em `.plans/023-bastidores-e-mcp-plan.md`. Na `main`.

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Install the MCP packages and fence them in the architecture test | concluida | fbf797f |
| C1 · Stop the intermittent target-size violation in the question (correção da CI) | concluida | 05df77c |
| T2 · Add the sinais_dia table and the BastidoresStore port with its adapters | concluida | ffebb92 |
| T3 · Add the Bastidores config, texts and MCP limits | concluida | aba3439 |
| T4 · Move the history schema to core and read it at runtime | concluida | b016eca |
| T8 · Write the six public MCP tools over the internal ones | concluida (escalada a nucleo) | c6a2c34 |
| T5 · Compute the week numbers with window, floor and cache | concluida | c32358e |
| T6 · Build the evals evolution from the history | concluida | cfefc3b |
| T9 · Add the MCP limit, the MCP metric and span, and the panel stat | concluida | 85e9530 |
| T10 · Let /api/mcp pass without an Origin header | concluida | b5f4b6c |
| T11 · Wire the Bastidores store, the week numbers and the history into the container | concluida | 6a6029d |
| T7 · Record the daily signals in the cleanup before deleting accounts | concluida | cef1eed |
| T12 · Serve the MCP tools at /api/mcp with limits and telemetry | concluida | 44e9cdd |
| T13 · Build the Bastidores page | concluida | ac1226b |
| T14 · Cover the week numbers with the privacy eval | concluida (2ª verificação) | e770b3d |
| T15 · Check Bastidores and the MCP tools in the production smoke | concluida | 17e6d80 |
> eval:det intermitente visto na 023 T1: `evals/det/aprendizado/privacidade.eval.ts` (dois-nao-ajudou) falhou uma vez sob carga e passou isolado e na 2ª rodada.

> Parada para passagem em 2026-11-22 (pedido da dona). 023: T1–T6 e T8–T11 com commit; faltam T7 (onda 6), T12 e T13 (onda 7), T14 e T15 (onda 8) e o fechamento. CI verde em `05df77c` (C1 resolveu o axe intermitente).

> Retomada em 2026-11-22 (21:30 -03). Pendências da passagem levadas para a T12 do plano da 023. Pedido da dona nesta sessão: parar ao chegar a 90% da janela de 5 horas (esperando a onda em curso voltar), fazer a passagem e retomar sozinho às 02h30.

> 023 fechada em 2026-11-22 na `main`: gates 1 a 6, `dup` (0 clones), `base:check` e `test:db` (165) verdes; 3864 testes, 1631 casos det, 313 e2e. ADRs 0054 e 0055. Decisões 023 (T12, T13). Segue a 024.
