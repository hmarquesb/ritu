# ADR 0022: Vocabulário fechado de 12 qualidades

## Status

Aceito · 2026-11-15

## Contexto

O momento da pessoa, o clima, os doshas, os alimentos, os preparos e as práticas precisam ser cruzados por código, e o Juiz precisa conferir o que o agente disse. As fontes usam termos variados ("úmido", "estimulante", "nutritivo", "oleoso") que, soltos, impedem o cruzamento por tabela.

## Decisão

1. Um vocabulário fechado de 12 qualidades em 6 pares: `quente`↔`frio`, `pesado`↔`leve`, `oleoso`↔`seco`, `estavel`↔`movel`, `suave`↔`aspero`, `intenso`↔`brando`, definido em `src/core/knowledge/vocab.ts` e validado por zod em todo arquivo de `data/`.
2. "Úmido" é `oleoso`, "estimulante" é `movel`, "nutritivo" é `pesado`. Um item nunca tem as duas qualidades de um par.
3. A pessoa não vê ids: vê verbos (`data/vocabulario.yaml`: aquece, refresca, umedece, nutre…). `aspero` não tem verbo e nunca aparece como benefício.
4. Semelhante aumenta, oposto equilibra: as qualidades buscadas são as `favorecer` dos estados e o oposto das qualidades do clima.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| As 20 gunas clássicas | Mais granularidade do que as fontes abertas sustentam por alimento; mais linhas `a_confirmar` |
| Termos livres por arquivo | Sem cruzamento por tabela; o Juiz não teria como conferir |
| Separar "úmido" de "oleoso" | Duas qualidades quase sempre juntas nas fontes; mais um par sem ganho de recomendação |

## Consequências

- Momento, clima, alimentos e práticas são cruzados por funções puras, testadas sem LLM.
- Perde-se a diferença entre óleo e água ("úmido" = `oleoso`).
- Qualquer qualidade nova é mudança de vocabulário, de schema e da base inteira.
