# ADR 0027: Cenários compartilhados entre demo, evals e eval:llm

## Status

Aceito · 2026-11-15

## Contexto

O acompanhante precisa ser mostrado no terminal (`npm run demo`), conferido sem rede (evals determinísticos) e medido com LLM de verdade (`eval:llm`). Os três precisam de uma pessoa, uma casa, faltas, clima e um registro de uso montados do mesmo jeito, sobre a base real de `data/`. Montar isso três vezes deixaria os três divergirem.

## Decisão

1. Um cenário é um dado (`Cenario`, em `test/fixtures/cenarios/`): perfil, casa, gostos, faltas, clima, entrada, roteiro e, quando preciso, um papel com todos os modelos esgotados (`esgotado`).
2. `montarCenario(c, { runtime?, esgotar? })` monta tudo em memória (stores, registro de uso, clima, telemetria e relógio fixo), com a base real pelo container, o roteador real sobre o registro em memória, o serviço de runs e o `companion`.
3. Sem `runtime`, o cenário roda com o runtime roteirizado (`c.roteiro`), sem rede. Com o runtime da Mastra, o mesmo cenário roda com LLM real e o registro de uso continua em memória.
4. `esgotar` marca só o modelo principal do papel (mostra a troca); `esgotado` esgota todos (mostra a resposta sem modelo).
5. `demo`, os evals de `evals/det/acompanhante/` e os casos de `evals/llm/casos/` usam os mesmos cenários. `npm test` roda `test/**/*.test.ts`, menos `test/db/`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Montagem própria em cada script e eval | Três cópias que divergem; um cenário do demo deixaria de provar o que o eval prova |
| Cenários com Postgres | Os gates rodam sem banco; o contrato das portas já é provado pela suíte única (ADR 0025) |
| Registro de uso real no `demo --llm` e no `eval:llm` | Exige o banco no ar; o 429 continua tratado pelo roteador |

## Consequências

- Um cenário novo serve ao demo e aos evals de uma vez.
- O `demo --llm` e o `eval:llm` não somam com o uso real do dia no Postgres; quem roda precisa olhar `npm run cotas` antes.
- Mudar um cenário pode quebrar evals de trajetória: o roteiro precisa seguir passando no validador real.
