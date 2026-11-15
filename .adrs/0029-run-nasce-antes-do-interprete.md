# ADR 0029: O run nasce antes do Intérprete e o span `run` cobre o run inteiro

## Status

Aceito · 2026-11-15

## Contexto

Toda mensagem passa primeiro pelo Intérprete (papel `apoio`), que decide o caminho: `acompanhante` (com o agente) ou um caminho de código (`casa`, `evitar`, `retorno`, `ofensa`, `ajuda`, `fora`, `alerta`). A chamada do Intérprete gasta modelo e precisa ser rastreada, e os caminhos de código também precisam de run, etapas e totais. Antes, o run e o span `run` nasciam em `executarRun`, dentro do Acompanhante.

## Decisão

1. `conversar` cria o run antes do Intérprete, com caminho provisório. A barreira de run aberto (`RunAbertoError`) é conferida aí, antes de gastar modelo.
2. O serviço de runs ganha `comSpanDoRun(contaId, runId, corpo)`: abre o span `run` e guarda o `SpanAtivo` num mapa interno por `run.id`. `executarRun` e `continuarRun`, quando já há span aberto para o run, não abrem outro e usam o guardado.
3. `responder` aceita um run já criado (`opts.run`); com ele, não soma `ritu_run_intencao_total` (quem soma é `conversar`).
4. A etapa `interprete` grava só ids de intenção no `resumo`. Os totais do run somam o Intérprete: `modelos.apoio`, `tokens_entrada` e `tokens_saida`; `passos` conta só os passos do agente; nos caminhos de código, `latencia_ms` é a duração do Intérprete.
5. Se o Intérprete falha, o run segue com a resposta sem modelo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Intérprete fora do run | O gasto do papel `apoio` e o caminho escolhido ficariam fora do rastro |
| Dois spans `run` (um em `conversar`, outro em `executarRun`) | Um run viraria dois traces no Grafana |
| Contar o Intérprete em `passos` | Mudaria o significado de `passos` (iterações do agente) e os limites de `config/` |

## Consequências

- Todo caminho, com ou sem agente, tem run, etapas e um único span `run`.
- O mapa de spans vive no serviço de runs; um run que termina precisa liberar a entrada (feito em `comSpanDoRun`).
- Desfazer: tirar o mapa e voltar a abrir o span só em `executarRun`; os caminhos de código ficariam sem span `run`.
