# ADR 0014: Vários modelos por papel, com registro de cota e troca automática

## Status

Aceito · 2026-11-14

## Contexto

O Ritu usa só o plano gratuito do Gemini, em que cada modelo tem a sua cota por minuto e por dia. Um modelo só esgota rápido, e um erro 429 não pode derrubar a resposta.

## Decisão

1. O uso é dividido em papéis: `decisao` (Acompanhante), `apoio` (Intérprete, Juiz, Memória) e `reforco` (segunda tentativa depois de uma reprovação do Juiz).
2. Cada papel tem uma lista ordenada de modelos, versionada em `config/llm-cotas.ts`. Identificador de modelo não é segredo nem variável de ambiente.
3. Toda chamada passa pelo `ModelRouter`, que reserva uma vaga num registro de uso (por modelo, por minuto e por dia) e, sem vaga, passa ao próximo da lista.
4. Erro 429 marca o modelo como esgotado até o fim da janela.
5. Sem modelo para `decisao`, sai a resposta montada por código; sem modelo para o Juiz, sai a resposta segura.
6. O modelo usado, o papel e as trocas ficam no run, na etapa e no span.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Um modelo só | Esgota a cota rapidamente |
| Plano pago | Fora da regra de só planos gratuitos (ADR 0020) |
| Cada código escolhe o seu modelo | Sem visão da cota; trocas espalhadas |

## Consequências

- Nenhum código chama o SDK direto nem escolhe modelo.
- A troca de modelo é testada sem rede, com registro em memória.
- Qualidade pode variar entre modelos; os evals medem.
