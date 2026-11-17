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
| T1 · Add the usage limits and the limit texts to the config | pendente | |
| T2 · Let the usage limiter take a start per key and clean minute rows | pendente | |
| T3 · Tell when the day quota of a role is gone and when it comes back | pendente | |
| T4 · Add the limit metric and its panel stat | pendente | |
| T5 · Recognize testers by Google e-mail at sign-in | pendente | |
| T6 · Write the limit keys, the limit error and the touch limit | pendente | |
| T8 · Answer from the base when the person's messages ran out | pendente | |
| T11 · Let E2E tests force the day quota out per request | pendente | |
| T7 · Decide each message and read the limits state | pendente | |
| T9 · Count a touch in every POST route and answer 429 | pendente | |
| T12 · Build the quota banner, the spent box, the remaining note and the touch text | pendente | |
| T10 · Decide the message limit in POST /api/runs and send limits to the screen | pendente | |
| T13 · Keep the limits state in the conversation hook | pendente | |
| T15 · Show the touch limit notice in the onboarding | pendente | |
| T16 · Cover the limits with deterministic evals | pendente | |
| T14 · Show the limits in the conversation screen | pendente | |
| T17 · Cover the limit screens end to end | pendente | |
