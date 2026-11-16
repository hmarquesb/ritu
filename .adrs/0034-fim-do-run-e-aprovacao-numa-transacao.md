# ADR 0034: Fim do run da conversa e aprovação numa transação, com troca de status condicional

## Status

Aceito · 2026-11-16

## Contexto

A conversa decide, depois que a resposta existe, se o run termina em `done` ou espera aprovação. Até aqui o Acompanhante encerrava o run sozinho, e `done` não vai para `waiting_for_approval`. Na aprovação, a pessoa pode tocar duas vezes ou responder depois do prazo. Se uma gravação falhar no meio, nada da aprovação pode ficar pela metade.

## Decisão

1. Com `manterAberto`, o Acompanhante grava os campos e deixa o run em `running`. Quem fecha o run são `conversar` e `continuar`.
2. A mensagem do agente é gravada antes de criar as propostas. Se a criação falhar, o run vai a `failed` e a resposta devolvida é a mesma, com `propostas: []`.
3. `pausarSemAgente` leva o run a `waiting_for_approval` quando a pendência é de aprovação, com o evento `pausa` e `ritu_pausas_total{tipo: "aprovacao"}`.
4. `aprovar(contaId, runId, aprovadas)` roda numa transação. A primeira operação é `mudarStatusSe(waiting_for_approval → done)`. Quem perde a corrida recebe um marcador dentro da transação, e `RunNaoContinuavelError` só é lançado depois que ela termina. As etapas `proposta_invalida` e `aprovacao` são gravadas dentro da transação; as métricas só somam depois do commit.
5. Expiração: passados 30 minutos (30 exatos ainda valem), `aprovar` expira o run e as propostas numa transação e devolve `aprovacao_expirada`. Proposta expirada não conta como decisão.
6. Uma mensagem nova com um bloco aberto fecha o run anterior e expira as propostas dele.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| O Acompanhante decide o bloco | Ele não conhece as anotações do código nem o caminho da conversa |
| Gravar a mensagem depois do bloco | Uma falha ao criar as propostas perderia a resposta |
| Lançar o erro de concorrência dentro da transação | Em memória, o rollback por cópia apagaria o que a primeira aprovação gravou |
| Somar métricas dentro da transação | Uma transação desfeita contaria decisões que não aconteceram |

## Consequências

- Toque duplo grava uma vez só, e um run não aprovado deixa o banco igual.
- Todo caminho de `conversar` e `continuar` precisa fechar o run. Os testes de cenário conferem que nenhum fica em `running`.
- A garantia de concorrência no Postgres depende do caso novo da suíte de contrato do `Transactor`, que roda em `npm run test:db`.
