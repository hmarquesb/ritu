# ADR 0036: Aprendizado gravado pelo Acompanhante e toques sem agente

## Status

Aceito · 2026-11-16

## Contexto

O Ritu aprende com o que entrega e com o que a pessoa conta: o que foi sugerido, o que fez falta, se ajudou, do que ela gosta. Esses fatos chegam por dois caminhos: a conversa, em que um agente decide os próximos passos, e os toques da tela ("Como ficou?", gosto, Trocar, Não tenho), que precisam responder na hora e sem custo de modelo. Os dois caminhos podem fechar o mesmo retorno ao mesmo tempo.

## Decisão

1. **Entrega gravada numa transação.** Quando um trecho termina entregue (origem `agente` ou `sem_modelo`), `registrarEntrega` (em `agents/companion`) cria os retornos, marca os itens como sugeridos e grava as faltas que teriam entrado, tudo numa transação, antes de fechar o run. Se algo falha, nada fica gravado e o run registra a etapa `erro` `registro_da_entrega`. As métricas são somadas depois do commit.
2. **Toques são funções do core, sem agente.** O domínio `touches` tem `tocarRetorno`, `tocarGosto`, `trocarIngrediente` e `responderTroca`. Nenhum deles chama modelo.
3. **A troca só usa o que está confirmado em casa.** Um substituto confirmado troca direto. Se o substituto está incerto ou nunca foi registrado, a troca faz uma pergunta única. Se a pessoa já disse que acabou, o item não é oferecido. O teto é de três trocas por item.
4. **Concorrência pela linha do run.** A troca abre a transação travando a linha do run, então o segundo toque espera e lê a saída já trocada. O erro `toque_invalido` é lançado fora da transação.
5. **Contar só quando muda.** `OutcomeStore.responder` diz se o `update` condicional mudou o retorno. `registrarResultado` só soma os contadores e a métrica quando mudou, então o toque e a conversa simultâneos contam uma vez.
6. **`resultado.registrar` só liga.** O modelo escolhe o número do retorno pendente, como o Intérprete o viu. O resultado ("ajudou", "não ajudou") vem do Intérprete, nunca do modelo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Gravar a entrega em `outcomes` | Ciclo de importação: a saída do Acompanhante mora em `agents` |
| Toques passando pelo agente | Custo e espera de modelo para uma ação de um toque |
| Troca por qualquer substituto da base | Sugeriria o que a pessoa não tem em casa |
| Ler os pendentes antes de responder | Dois toques simultâneos somariam duas vezes |
| A tool recebe o resultado do modelo | O modelo poderia inventar um fato da pessoa (regra 3) |

## Consequências

- No banco em memória a trava não serializa. A concorrência dos toques só se prova no Postgres (`test:db`).
- "Não tenho" para um alimento nunca registrado grava só a falta, e ele pode ser perguntado de novo num toque seguinte.
- Numa corrida entre um toque e a conversa, `resultado.registrar` pode responder `registrado: true` sem ter somado. O contador não duplica.
