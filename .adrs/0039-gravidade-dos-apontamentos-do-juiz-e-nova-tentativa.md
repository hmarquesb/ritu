# ADR 0039: Gravidade dos apontamentos do Juiz e nova tentativa no mesmo loop

## Status

Aceito · 2026-11-16

## Contexto

O validador (004) confere em código o que dá para conferir em código: linha da base, filtro da pessoa, formato, dosagem. Outros problemas só se veem lendo o texto: uma promessa de cura, um conselho que soa como orientação médica, um tom que não acolhe, um alimento barrado citado de passagem, jargão. Uma frase de sofrimento ou uma ordem escondida na mensagem também precisam ser barradas antes de qualquer modelo, sem depender de o Intérprete acertar. A regra 2 do `AGENTS.md` diz que toda resposta do agente passa pelo Juiz, e a regra 5 diz que o validador vem antes.

## Decisão

1. **O modelo aponta, o código decide.** O Juiz (papel `apoio`, prompt `juiz.v1`, sem tools) devolve só apontamentos (`motivo` e `trecho`). Quem decide é o código, por `config/juiz.ts`: motivo grave reprova; `jargao` só registra; `saude_na_proposta` tira a proposta de rotina do bloco, sem nova tentativa; motivo desconhecido é descartado.
2. **Nova tentativa no mesmo loop.** Reprovada, a entrega volta ao mesmo agente, com o mesmo estado, mais uma mensagem de sistema com os motivos e os trechos, e o modelo do papel `reforco`. A nova entrega passa de novo pelo validador e pelo Juiz. São no máximo duas leituras do Juiz por run.
3. **Fail-closed.** Duas reprovações, nova tentativa que não entrega, Juiz sem modelo ou com erro: sai a resposta segura, montada por código, e nada da entrega do agente vira mensagem, retorno, falta ou proposta.
4. **Guardrail de entrada em código, antes do Intérprete.** Padrões só para frases claras de alerta físico, alerta emocional e injection. Alerta ganha de injection, e emocional ganha de físico. O que não casa vai para o Intérprete, que continua podendo apontar alerta e suspeita. Mensagem só com atalhos não passa pelo guardrail.
5. **Quem não passa pelo Juiz:** os textos montados por código (caminhos sem agente, `sem_modelo`, resposta segura). São fixos e revisados no repositório, sem saída de modelo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| O Juiz decidir aprovar ou reprovar | A gravidade mudaria com o modelo e com o prompt; o código torna a regra fixa e testável |
| Reescrever a resposta no próprio Juiz | O Juiz passaria a escrever para a pessoa sem passar pelo validador nem pela base |
| Nova tentativa num run novo | Perderia o contexto e as tools já chamadas, e gastaria a cota de novo do zero |
| Entregar a resposta quando o Juiz cai | Uma resposta não julgada chegaria à pessoa justamente quando a proteção falhou |
| Guardrail de entrada só pelo Intérprete | Uma frase de risco dependeria de um modelo responder bem, e com a cota esgotada não haveria barreira |

## Consequências

- O passo do Juiz mora num arquivo próprio do Acompanhante (`juiz-do-run.ts`) e roda entre o fim do trecho e o fim do run, em `responder` e em `continuar`. O fim do run não muda e recebe a saída que o Juiz deixou.
- O trecho grava `runs.saida` ao entregar, antes do Juiz. A saída final (aprovada ou segura) sobrescreve esse campo antes de o run sair de `running`, e nada lê a saída não julgada.
- A nova tentativa roda sem `ask_user`: uma pausa nesse ponto deixaria o run esperando a pessoa com uma resposta já reprovada.
- O teto de chamadas da nova tentativa é o do run mais `chamadas_extras`. O tempo continua acumulado, então com modelo real a nova tentativa pode cair em `limite:tempo` e virar resposta segura.
- O resultado de tool vai ao modelo com `<` e `>` neutralizados em toda string. O estado do run guarda o resultado original.
- O Intérprete e o Juiz dividem a mesma chamada de apoio (`src/core/agents/chamada-de-apoio.ts`). O `apoio` do run junta os modelos dos dois, e as trocas do Juiz não somam em `trocas_de_modelo`.
