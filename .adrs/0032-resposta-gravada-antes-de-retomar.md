# ADR 0032: Resposta à pergunta gravada na hora, antes de retomar, com troca de status condicional

## Status

Aceito · 2026-11-15

## Contexto

A resposta a uma pergunta de casa muda Minha casa, os gostos e as faltas. A pessoa pode tocar duas vezes, a pergunta pode expirar, e a gravação pode falhar no meio. O agente só escreve por proposta aprovada (regra 4), mas a resposta a uma pergunta fechada já é a própria decisão da pessoa.

## Decisão

1. `RunRepository.mudarStatusSe(contaId, runId, de, para)` troca o status numa operação só (`update … where status = de`) e diz se trocou. Entrou nesta spec; a 010 reutiliza.
2. O `continuar` segue esta ordem: busca o run e confere status e conta; confere a expiração (30 minutos); valida a resposta sem escrever nada; reserva o run com `mudarStatusSe(waiting_for_input → running)` (de duas chamadas simultâneas, só uma segue); grava a resposta; se a gravação falha, devolve o run a `waiting_for_input` e o erro sobe; retoma.
3. `gravarResposta` grava tudo numa transação, sem bloco de aprovação: é a resposta da pessoa a uma pergunta fechada, não uma proposta do agente.
4. Na retomada, os totais do run são recalculados pela soma dos tokens das etapas (loop e Intérprete, cada um uma vez), e `modelos` preserva as chaves anteriores.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Trocar o status antes de validar | Resposta inválida deixaria o run fora de `waiting_for_input` |
| Gravar a resposta só no fim do run | O agente retomaria sem saber o que a pessoa tem |
| Proposta com aprovação para a resposta | Pedir aprovação de algo que a pessoa acabou de responder |
| Somar os totais a cada trecho | Conta o Intérprete duas vezes quando a retomada não passa pelo loop |

## Consequências

- Toque duplo não grava duas vezes.
- Se a mensagem da pessoa falhar ao ser gravada depois de `gravarResposta`, a casa já mudou e o run volta a esperar; uma nova resposta grava de novo os mesmos valores.
