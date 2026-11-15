# ADR 0009: Casa com data de confirmação e estado calculado por durabilidade

## Status

Aceito · 2026-11-14

## Contexto

O Ritu parte do que há em casa, mas a comida acaba e a pessoa não avisa. Tratar a lista como verdade absoluta leva a sugerir o que não existe; perguntar sempre cansa.

## Decisão

1. Cada item da casa guarda a data da última confirmação.
2. O estado é calculado, não guardado: confirmado, incerto (passou a validade do grupo), acabou ou sempre tenho.
3. A validade vem da durabilidade do grupo: curta (5 dias), média (14), longa (90). Os números ficam em `config/`.
4. Confirmado e sempre tenho são usados sem perguntar; incerto é perguntado ou vem com troca pronta; acabou não é usado.
5. A casa se atualiza pela conversa (por proposta), pela resposta a uma pergunta do agente (na hora) e pela aba Minha casa (na hora).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Lista simples, sem data | Fica desatualizada e o agente sugere o que acabou |
| Perguntar sempre antes de usar | Cansa e gasta pausas |
| Validade por alimento | Mais curadoria sem ganho claro; o grupo basta |

## Consequências

- O estado é função pura do item, da data e do relógio, testada por durabilidade.
- O agente precisa lidar com incertos (pergunta ou `se_faltar`).
- A tela mostra uma seção "Ainda tem?" para resolver incertos com um toque.
