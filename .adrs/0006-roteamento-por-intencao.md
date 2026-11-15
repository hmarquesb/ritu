# ADR 0006: Roteamento por intenção, com o que é sempre igual em código

## Status

Aceito · 2026-11-14

## Contexto

Muitas mensagens não precisam de julgamento: avisar o que comprou, dar um retorno, dizer que não pode comer algo, perguntar como apagar os dados, ofender o Ritu ou mandar algo fora do assunto. Mandar tudo ao agente principal gasta cota, aumenta a latência e abre espaço para erro onde a resposta é sempre a mesma.

## Decisão

1. Um Intérprete (modelo do papel `apoio`) classifica a mensagem em intenções e extrai os campos.
2. O código escolhe o caminho pela intenção. `casa`, `retorno` e `evitar` sozinhos, `ajuda`, `ofensa`, `alerta` e `fora` são resolvidos por código, com texto fixo ou proposta montada por código, sem o Acompanhante.
3. Só `momento`, `pergunta`, `vida` e mensagens com mais de uma intenção vão para o Acompanhante.
4. Sinal de alerta ganha de tudo e encerra o run antes do agente.
5. Regra de ouro: a menor autonomia que resolve.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Tudo para o agente principal | Mais chamadas, mais latência, mais erro em respostas que são sempre iguais |
| Classificação só por regras (palavras-chave) | Não entende a variedade da conversa |

## Consequências

- Cada caminho tem um número previsível de chamadas de modelo.
- O Intérprete vira ponto único: sem ele, a mensagem não vai ao agente e sai a resposta montada por código.
- Os evals de intenção medem a classificação.
