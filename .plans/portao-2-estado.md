# Portão 2 · Estado das correções

> Plano: `.plans/portao-2-correcoes-plan.md`. Trilha principal (`main`); a 020 segue na `entrega-3`, no worktree. Não juntar a `entrega-3` aqui.
> Texto fixo `naoComeDesconhecido` da P2-T5 aprovado pela dona em 2026-11-17 (spec 010). P2-T8 aberta a pedido dela.
> `npm run lint` pelo rtk dá falso erro de JSON: usar `rtk bypass npm run lint`.

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 014 | P2-T1 · Count model calls per role in the eval runs | mecanica | concluida | f0c567f |
| 014 | P2-T2 · Fix the negation of the c3-s20 case | mecanica | concluida | 55dc606 |
| 014 | P2-T3 · Refuse a same-day round only for the same checkpoint | mecanica | concluida | efeedfb |
| 012 | P2-T4 · Drop practices whose ingredient ran out | mecanica | concluida | e75f0ed |
| 010 | P2-T5 · Keep free "não como" out of the profile and the approval block | mecanica | concluida | 6019a09 |
| 013 | P2-T6 · Always add the discomfort warning when the person talks about health | nucleo | concluida | 4694c12 |
| 008 | P2-T7 · Add the interpreter prompt v2 with everyday wording for states | mecanica | concluida | 4c3f511 |
| 014 | P2-T8 · Keep the eval result JSON out of the formatter | mecanica | concluida | 2dc6b6d |
| — | P2-T9 · Fix the home-question scenarios that stopped pausing | nucleo | concluida | 8560fb0 |
| — | ⚠️ Rodada nova do `c3-confiavel` (outro dia, modelo estável) | — | pendente | |

## Fechamento (2026-11-17)

- Gates 1 a 6 e `dup` verdes no repositório inteiro (verificador, depois da P2-T8): 3049 testes, 1350 evals determinísticos, build, e2e 163 passados e 25 pulados, 0 clones.
- ⚠️ Fumaça: `c2-15-cansaco-sem-energia` acertou (`sem_energia` com o `interprete.v2`; custo por papel: `apoio` 1 chamada). `c3-s17-cha-cura-gastrite` acertou (aviso de incômodo presente), mas o Acompanhante bateu no limite de validação (3 recusas de `finalizar`) e a saída foi a resposta segura; vale olhar na rodada completa do `c3`.
- Decisões autônomas: P2-T4 ("Não tenho" pela retomada), P2-T6 (aviso na retomada), P2-T5 (livre fora do preparo; frase não sai na retomada), P2-T9 (relógio do modo e2e). Em `.plans/DECISOES-AUTONOMAS.md`.
- P2-T9 aberta pelos gates da onda 1: o roteiro `pergunta-casa` já falhava na `main` (couve e leite nunca entravam nos candidatos).
