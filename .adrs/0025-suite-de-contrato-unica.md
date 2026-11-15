# ADR 0025: Suíte de contrato única para fakes e Postgres

## Status

Aceito · 2026-11-15

## Contexto

Tudo o que o Ritu lembra da pessoa passa por onze portas de armazenamento. Os testes padrão e os evals determinísticos rodam sem banco, então cada porta tem um fake em memória. O produto usa Postgres. Se os dois implementarem as regras de jeitos diferentes (unicidade, cascata, autorização por conta, uma falta por dia, um run aberto), os testes passam e o produto erra.

## Decisão

1. Cada porta tem uma suíte de contrato em `test/contracts/<area>.contract.ts`. A suíte é uma função que recebe a fábrica (`stores`, `tx`, `clock`, `reset`) e declara os testes. Ela só usa as portas, nunca o estado interno de uma implementação.
2. A mesma suíte roda contra o fake em `src/infra/fakes/memory-stores.test.ts`, dentro do `npm test`, e contra o Postgres em `test/db/stores.db.test.ts`, dentro do ⚠️ `npm run test:db` (`vitest.db.config.ts`). O banco é o do `docker compose`, no schema `ritu_test`, que é recriado a cada rodada.
3. Toda suíte tem um teste de autorização: grava com a conta A e tenta ler, alterar e apagar com a conta B.
4. O que nenhuma porta lê, como a anonimização dos runs depois de apagar a conta, é conferido por SQL direto no runner do Postgres.
5. A CI tem um job `db` com `postgres:17-alpine`, que roda `db:migrate` e `test:db`. Os gates 1 a 6 continuam sem banco.
6. Os adaptadores usam SQL puro com o driver `postgres`, sem ORM. As migrações ficam em `db/migrations/` e são aplicadas por `db:migrate`, que os scripts alcançam pelo container (`migrateDatabase`), sem importar o driver.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só fakes, sem teste contra o banco | O SQL ficaria sem teste; unicidade e cascata reais nunca seriam exercidas |
| Só Postgres (testcontainers ou banco obrigatório) | Os gates passariam a exigir Docker; CI e agentes ficariam mais lentos e frágeis |
| Suítes separadas para o fake e para o Postgres | Elas divergem com o tempo, e é exatamente essa divergência que o contrato existe para impedir |
| ORM ou gerador de consultas | Dependência a mais; o volume e o formato das consultas não pedem um |

## Consequências

- Uma regra nova de armazenamento é escrita uma vez, na suíte, e as duas implementações precisam cumpri-la.
- O fake reimplementa as regras do banco (unicidade, cascata, transação). O custo é manter duas implementações, e a suíte é o que as mantém iguais.
- `test:db` precisa do Docker no ar. Localmente ele é opt-in; na CI, roda a cada push.
