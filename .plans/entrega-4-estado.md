# Entrega 4 · Estado

> Autorizações da dona (2026-11-16):
> - Exceção ao §7.2: a 018 vale como `implemented` pela branch `entrega-3`, que é a base desta branch (`entrega-4` saiu de `entrega-3`, ainda não juntada na `main`). Construir só a 021; a 022 em diante fica para depois.
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
| T18 · Make the privacy leak evals deterministic (correção) | concluida | 21d5dbd |
| T19 · Fix the time-dependent house question tests (correção) | concluida | 575bab4 |
| T20 · Let E2E tests pin the hour per request (correção) | concluida | a91d363 |

> Retomada em 2026-11-17 (05:20 -03). Pendências da passagem: T18 aprovada, diff em `.local/patches/021-T18.patch` (causa: UUIDs aleatórios contendo "cafe"). T17 reprovada 1x: o spec excluía `[role="log"]` do axe; sem a exclusão, `target-size` (desktop, intermitente) num botão do log parcialmente coberto pelo painel sticky (`conversa.tsx:283`). Pedido: esperar a rolagem parar antes do axe e rodar sem exclusão; se persistir, correção de layout na tela. Conferir também `e2e/conversa.spec.ts` "axe … pergunta" no desktop (possível regressão da T14). Fechamento: `dup` em `quemDe`/fuso repetidos; ação `desfez` sem teste; `limites` do 429 lido sem zod em `use-conversa.ts`.
