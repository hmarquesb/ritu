# ADR 0012: Memória em níveis

## Status

Aceito · 2026-11-14

## Contexto

Personalização e memória são o centro do produto, mas cada tipo de lembrança tem uma origem, uma duração e um jeito de chegar ao agente. Jogar tudo no prompt estoura o contexto e mistura fato confirmado com suposição.

## Decisão

1. A memória tem níveis: run, conversa (7 dias), fixos, casa, gostos e resultados, faltas (30 dias), rotina e padrões.
2. Fixos, resumo de rotina e padrões confirmados vão sempre no prompt; casa, gostos e histórico vêm por tool; ordenação e faltas usam a memória em código.
3. A rotina é um conjunto de notas aprovadas, compactado pelo agente de Memória num resumo com teto de tamanho; a versão anterior fica guardada.
4. Padrões são detectados por código, num job diário, só sobre registros estruturados, e só valem depois que a pessoa confirma.
5. O prompt recebe sinais (contadores, não conteúdo) para o agente decidir o que consultar.
6. Tudo aparece em "O que sei sobre você" e pode ser corrigido ou apagado item por item.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Histórico completo no prompt | Estoura o contexto e a cota |
| Memória vetorial com busca semântica | Pouco transparente; difícil mostrar e apagar item por item |
| Padrões inferidos pelo modelo sobre texto livre | Pode ler incômodos e inventar regularidades |

## Consequências

- Cada nível tem retenção e limpeza próprias.
- O texto que volta ao prompt vindo da pessoa é delimitado como dado.
- A transparência exige uma tela que mostre todos os níveis.
