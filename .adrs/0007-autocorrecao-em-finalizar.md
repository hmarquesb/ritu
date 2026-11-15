# ADR 0007: Autocorreção obrigatória dentro de `finalizar`

## Status

Aceito · 2026-11-14

## Contexto

Boa parte do que pode dar errado numa resposta é conferível por regra: alimento fora da base, item em "evitar sempre", combinação proibida, linha citada que não existe, texto que diz algo diferente da parte estruturada. Confiar que o modelo acerte de primeira não basta, e deixar a conferência para depois da entrega é tarde.

## Decisão

1. O agente entrega a resposta pela tool `finalizar`, que roda o validador por dentro.
2. Com violações, `finalizar` devolve a lista e não entrega; o agente corrige e chama de novo.
3. Até 3 tentativas; depois, resposta segura.
4. O Juiz só fica com o que precisa de leitura (ADR 0013).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Validar depois do loop e descartar | Perde a chance de o agente corrigir |
| Só o Juiz (LLM) | Gasta modelo no que uma regra confere de graça e com certeza |
| Validação opcional | Uma resposta errada chegaria à pessoa |

## Consequências

- Nenhuma resposta chega à pessoa sem passar pelo validador.
- A autocorreção vira prova medida: taxa de "válida na 1ª" e de "corrigiu após violação".
- O validador é função pura, testada por tipo de violação.
