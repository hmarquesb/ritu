# ADR 0031: Perguntas fechadas, com texto montado por código, e variante perguntada antes do agente

## Status

Aceito · 2026-11-15

## Contexto

O agente às vezes precisa saber algo para sugerir bem: se ainda há um ingrediente em casa, se a pessoa come um alimento, qual a forma de um incômodo. Uma pergunta livre do modelo poderia tocar saúde, motivo ou dado sensível, e teria respostas abertas difíceis de gravar.

## Decisão

1. Há três tipos fechados de pergunta: `casa` (até 5 itens, cada um com Tenho · Não tenho · Não gosto), `come` (um alimento) e `variante` (as variantes do incômodo na base). O texto da pergunta e o das opções são montados por código; o modelo só escolhe tipo e ids.
2. `ask_user` confere o pedido em código e recusa com um código fechado (`limite_de_perguntas`, `muitos_itens`, `fora_da_base`, `ja_confirmado`, `filtrado`, `acabou`, `fora_dos_candidatos`, `ja_perguntado`, `come_desnecessaria`). A recusa volta como resultado de tool e conta no teto de entregas recusadas.
3. No máximo 2 perguntas por run, contando a variante.
4. A variante é perguntada pelo código antes do agente, quando o incômodo tem mais de uma variante e a mensagem não disse qual.
5. A etapa `pergunta` grava um `resumo` fechado (`casa: N itens`, `come` ou `variante`), passado pelo `ResultadoDeControle`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Pergunta livre do modelo | Pode perguntar de saúde ou motivo; resposta aberta não grava em Minha casa |
| Variante perguntada pelo agente | Gasta uma chamada de modelo para algo que o código sabe sozinho |
| Sem limite de perguntas | Conversa vira questionário |

## Consequências

- Nenhuma pergunta sobre saúde, motivo, gestação, doença ou remédio sai do Ritu.
- Um tipo novo de pergunta exige código, texto e testes; o prompt sozinho não cria pergunta nova.
