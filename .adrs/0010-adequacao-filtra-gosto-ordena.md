# ADR 0010: Adequação filtra, gosto e resultado ordenam, em código

## Status

Aceito · 2026-11-14

## Contexto

Gostar de um alimento não o torna adequado ao momento, e o que a pessoa não pode comer nunca pode aparecer. Se o modelo pesasse tudo isso sozinho, o resultado seria imprevisível e impossível de testar sem LLM.

## Decisão

1. A adequação ayurvédica, "evitar sempre", restrições, "não como" e "não gosto" filtram.
2. Gosto, resultado (ajudou, não ajudou) e presença em casa só ordenam o que passou no filtro.
3. A filtragem e a ordenação rodam em código, no preparo, antes do agente. Os pesos ficam em `config/ranking.ts`.
4. Dois "não ajudou" seguidos mandam o item para o fim. No máximo uma sugestão por resposta pode vir marcada como novidade.
5. A troca de ingrediente também é código: mesma função, qualidades mais próximas, filtros respeitados, preferência casa → gosto → resultado. Não chama o modelo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| O modelo decide a ordem | Imprevisível, sem teste determinístico, gasta tokens |
| Gosto como filtro positivo | Faria sugerir o que não serve ao momento |
| Troca de ingrediente pelo modelo | Uma chamada por toque, sem ganho de qualidade |

## Consequências

- Aprendizado com retornos e gostos é testável sem LLM.
- O agente recebe candidatos já ordenados e escolhe entre eles.
- Mudar o comportamento é mudar pesos em `config/`, com teste.
