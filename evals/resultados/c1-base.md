# Eval com LLM: c1-base

- Versão do prompt: acompanhante.v1
- Modelos usados: gemini-3.1-flash-lite, gemini-3.5-flash-lite
- Casos rodados: 12 de 12

## Métricas

| Métrica | Resultado |
|---|---|
| Conteúdo: deve incluir | 10/12 (83%) |
| Conteúdo: não pode incluir | 12/12 (100%) |
| Trajetória correta | 8/12 (67%) |
| Chamadas desnecessárias por run | 0.00 (0 no total) |
| Válida na 1ª tentativa | 2/12 (17%) |
| Corrigiu após violação | 10/10 (100%) |
| Explicação (as três respostas sim) | 8/11 (73%), 1 não avaliada(s), fora da conta |
| Trocas de modelo | 0 |
| Latência por run (p50 / p95) | 3426 ms / 9174 ms |

## Custo por papel

| Papel | Chamadas | Tokens de entrada | Tokens de saída |
|---|---|---|---|
| apoio | 11 | 2767 | 627 |
| decisao | 30 | 154742 | 7387 |

## Casos

| Caso | Deve | Não pode | Trajetória | Válida na 1ª | Explicação | Latência |
|---|---|---|---|---|---|---|
| c1-01-frio-agitada | 3/4 | 1/1 | não | não | sim | 4871 ms |
| c1-02-calor-irritada | 2/2 | 1/1 | não | não | sim | 3391 ms |
| c1-03-pesada-depois-do-almoco | 2/2 | 3/3 | sim | não | sim | 3319 ms |
| c1-04-sem-energia-sem-dosha | 2/2 | 0/0 | sim | não | não avaliada | 4764 ms |
| c1-05-pergunta-manga | 1/1 | 1/1 | sim | sim | sim | 2459 ms |
| c1-06-pergunta-gengibre | 1/1 | 0/0 | não | não | não | 3246 ms |
| c1-07-pitaya-fora-da-base | 2/2 | 2/2 | sim | não | não | 2850 ms |
| c1-08-casa-so-incertos | 1/1 | 2/2 | não | não | não | 5333 ms |
| c1-09-evitar-leite | 2/2 | 1/1 | sim | não | sim | 9174 ms |
| c1-10-calor-e-pesada | 2/2 | 0/0 | sim | sim | sim | 3426 ms |
| c1-11-sem-cidade | 1/2 | 1/1 | sim | não | sim | 5498 ms |
| c1-12-estomago-pesado | 2/2 | 2/2 | sim | não | sim | 4874 ms |

## Falhas

- c1-01-frio-agitada: deve: Algo que aquece
- c1-01-frio-agitada: trajetória fora do esperado
- c1-02-calor-irritada: trajetória fora do esperado
- c1-06-pergunta-gengibre: trajetória fora do esperado
- c1-06-pergunta-gengibre: explicação incompleta
- c1-07-pitaya-fora-da-base: explicação incompleta
- c1-08-casa-so-incertos: trajetória fora do esperado
- c1-08-casa-so-incertos: explicação incompleta
- c1-11-sem-cidade: deve: Diz que respondeu sem o clima
