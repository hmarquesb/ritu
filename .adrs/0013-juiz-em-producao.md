# ADR 0013: Juiz em produção, fail-closed, em modelo diferente

## Status

Aceito · 2026-11-14

## Contexto

Parte do que pode dar errado só se confere lendo: promessa de cura, dosagem, motivo que não bate com a linha citada, jargão, tom que cobra, palavrão. O validador por regra não pega isso. Um juiz que usa o mesmo modelo de quem escreveu tende a repetir o mesmo viés.

## Decisão

1. Toda resposta do Acompanhante passa por um Juiz (LLM, papel `apoio`) antes de chegar à pessoa.
2. O Juiz roda em produção, não só nos evals, e usa um modelo diferente do Acompanhante.
3. Reprovou: o Acompanhante recebe as violações e tem uma nova tentativa, no papel `reforco` (modelo mais forte).
4. Reprovou de novo, ou não há modelo para o Juiz: sai a resposta segura genérica (fail-closed), e o motivo fica no run.
5. O Juiz só confere o que precisa de leitura; o que dá para conferir por regra é do validador (ADR 0007).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Juiz só nos evals | Respostas ruins chegariam à pessoa em produção |
| Fail-open (entrega se o Juiz falhar) | Uma promessa de saúde poderia passar |
| Mesmo modelo para escrever e julgar | Repete o viés |

## Consequências

- Mais uma chamada de modelo por resposta.
- A taxa de reprovação do Juiz vira métrica pública.
- O papel `reforco` consome os modelos escassos só onde muda o resultado.
