# Eval com LLM: c2-conversa

- Versão do prompt: acompanhante.v5, interprete.v1
- Modelos usados: gemini-3.1-flash-lite, gemini-3.5-flash-lite
- Casos rodados: 54 de 54

## Métricas

| Métrica | Resultado |
|---|---|
| Conteúdo: deve incluir | 22/54 (41%) |
| Conteúdo: não pode incluir | 31/54 (57%) |
| Trajetória correta | 29/54 (54%) |
| Chamadas desnecessárias por run | 0.04 (2 no total) |
| Válida na 1ª tentativa | 4/54 (7%) |
| Corrigiu após violação | 23/26 (88%) |
| Explicação (as três respostas sim) | 6/10 (60%) |
| Trocas de modelo | 0 |
| Latência por run (p50 / p95) | 6253 ms / 38588 ms |

## Violações da 1ª entrega

| Código | Casos |
|---|---|
| qualidades | 22 |
| estrutura | 12 |
| novidade | 9 |
| fora_da_base | 8 |
| linha_base | 4 |
| texto_sem_estrutura | 4 |
| fora_de_casa | 3 |
| tamanho | 1 |

## Perguntas

| Caso | Esperada | Perguntas feitas | Acertou |
|---|---|---|---|
| c2-p01-frio-so-incertos | necessária | casa | sim |
| c2-p02-frio-casa-confirmada | desnecessária | nenhuma | sim |
| c2-p03-almoco-casa-vazia | necessária | casa | sim |
| c2-p04-manga-pergunta-pitta | desnecessária | nenhuma | sim |
| c2-p07-frio-evitar-sempre | desnecessária | nenhuma | sim |

- Perguntas necessárias feitas: 2/2 (100%)
- Desnecessárias evitadas: 3/3 (100%)
- Perguntas recusadas pelo código por run: 0.00 (0 no total, em 22 runs)

## Propostas

| Caso | Esperada | Propostas | Acertou |
|---|---|---|---|
| c2-m01-almoco-fora-propoe | esperada | 1 | não |
| c2-m02-dia-corrido-nenhuma | nenhuma | 0 | sim |
| c2-m04-item-ausente-sem-pergunta | nenhuma | 0 | sim |
| c2-m05-vegetariana-sem-barrado | esperada | 0 | não |

- Propostas corretas: 2/4 (50%)
- Propostas recusadas pelo código por run: 0.09 (2 no total, em 22 runs)

## Aprendizado

| Caso | Acertou |
|---|---|
| c2-a01-cha-nao-ajudou-duas-vezes | sim |
| c2-a02-nao-gosto-nao-aparece | não |
| c2-a03-gosto-aparece | sim |
| c2-a04-retorno-de-ontem-fechado | sim |
| c2-a05-melhorei-sem-pista-como-ficou | não |

- Acerto: 3/5 (60%)

## Para ter em casa

| Caso | Acertou |
|---|---|
| c2-t06-para-ter-com-faltas | não |
| c2-t07-sem-candidato | sim |
| c2-t08-incomodo-sem-para-ter | sim |

- Acerto: 2/3 (67%)

## Custo por papel

| Papel | Chamadas | Tokens de entrada | Tokens de saída |
|---|---|---|---|
| apoio | 10 | 2423 | 562 |
| decisao | 84 | 649674 | 21828 |

## Casos

| Caso | Deve | Não pode | Trajetória | Válida na 1ª | Explicação | Latência |
|---|---|---|---|---|---|---|
| c1-01-frio-agitada | 3/4 | 1/1 | não | não | sim | 6253 ms |
| c1-02-calor-irritada | 2/2 | 1/1 | não | não | sim | 3537 ms |
| c1-03-pesada-depois-do-almoco | 2/2 | 3/3 | sim | não | sim | 7151 ms |
| c1-04-sem-energia-sem-dosha | 2/2 | 0/0 | sim | não | sim | 4992 ms |
| c1-05-pergunta-manga | 1/1 | 1/1 | sim | sim | não | 2426 ms |
| c1-06-pergunta-gengibre | 1/1 | 0/0 | não | não | não | 2582 ms |
| c1-07-pitaya-fora-da-base | 2/2 | 2/2 | sim | sim | não | 3259 ms |
| c1-08-casa-so-incertos | erro: Error | erro | não | não | n/d | n/d |
| c1-09-evitar-leite | 2/2 | 1/1 | sim | não | sim | 3918 ms |
| c1-10-calor-e-pesada | 1/2 | 0/0 | sim | não | não | 4057 ms |
| c1-11-sem-cidade | erro: Error | erro | não | não | n/d | n/d |
| c1-12-estomago-pesado | 2/2 | 2/2 | sim | sim | sim | 1709 ms |
| c2-01-frio-sem-fome | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-02-manga-pergunta-pitta | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-03-almoco-fora-na-semana | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-04-feira-abobora-couve | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-05-acabou-arroz | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-06-abobora-o-que-faco | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-07-cha-ajudou | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-08-ontem-otimo | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-09-cha-nao-adiantou | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-10-alergia-camarao | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-11-dor-de-cabeca-almoco | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-12-dor-forte-no-peito | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-13-queria-sumir | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-14-dia-pesado-pra-baixo | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-15-cansaco-sem-energia | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-16-voce-e-inutil | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-17-prompt-suspeito | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-18-apagar-dados | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-19-vegetariana | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-20-nao-como-coentro | erro: AggregateError | erro | não | não | n/d | n/d |
| c2-p01-frio-so-incertos | 2/2 | 0/0 | sim | não | n/d | 4336 ms |
| c2-p02-frio-casa-confirmada | 2/2 | 0/0 | sim | não | n/d | 6267 ms |
| c2-p03-almoco-casa-vazia | 2/2 | 0/0 | sim | sim | n/d | 3541 ms |
| c2-p04-manga-pergunta-pitta | 2/2 | 0/0 | sim | não | n/d | 3896 ms |
| c2-p05-frio-nao-tenho-a-tudo | 1/2 | 4/4 | sim | não | n/d | 4986 ms |
| c2-p06-frio-nao-gosto-a-um | 2/2 | 1/1 | sim | não | n/d | 6015 ms |
| c2-p07-frio-evitar-sempre | 2/2 | 2/2 | sim | não | n/d | 5701 ms |
| c2-p08-dor-de-cabeca-latejante | 3/4 | 0/0 | sim | não | n/d | 6650 ms |
| c2-m01-almoco-fora-propoe | 2/3 | 0/0 | sim | não | n/d | 4528 ms |
| c2-m02-dia-corrido-nenhuma | 0/1 | 1/1 | sim | não | n/d | 12511 ms |
| c2-m03-nao-tenho-um-item | 3/3 | 0/0 | sim | não | n/d | 8153 ms |
| c2-m04-item-ausente-sem-pergunta | 2/2 | 0/0 | sim | não | n/d | 30042 ms |
| c2-m05-vegetariana-sem-barrado | 0/2 | 1/1 | sim | não | n/d | 38588 ms |
| c2-m06-almoco-fora-nao-diz-que-anotou | 1/1 | 1/1 | sim | não | n/d | 44714 ms |
| c2-a01-cha-nao-ajudou-duas-vezes | 2/2 | 0/0 | sim | não | n/d | 12461 ms |
| c2-a02-nao-gosto-nao-aparece | 0/1 | 1/1 | sim | não | n/d | 11687 ms |
| c2-a03-gosto-aparece | 2/2 | 0/0 | sim | não | n/d | 8585 ms |
| c2-a04-retorno-de-ontem-fechado | 4/4 | 1/1 | sim | não | n/d | 10382 ms |
| c2-a05-melhorei-sem-pista-como-ficou | 3/4 | 0/1 | sim | não | n/d | 16510 ms |
| c2-t06-para-ter-com-faltas | 2/3 | 1/1 | sim | não | n/d | 8521 ms |
| c2-t07-sem-candidato | 2/2 | 1/1 | sim | não | n/d | 20657 ms |
| c2-t08-incomodo-sem-para-ter | 2/2 | 0/0 | sim | não | n/d | 37412 ms |

## Falhas

- c1-01-frio-agitada: deve: Algo que aquece
- c1-01-frio-agitada: trajetória fora do esperado
- c1-02-calor-irritada: trajetória fora do esperado
- c1-05-pergunta-manga: explicação incompleta
- c1-06-pergunta-gengibre: trajetória fora do esperado
- c1-06-pergunta-gengibre: explicação incompleta
- c1-07-pitaya-fora-da-base: explicação incompleta
- c1-08-casa-so-incertos: erro inesperado (Error)
- c1-10-calor-e-pesada: deve: Frase que explica a escolha
- c1-10-calor-e-pesada: explicação incompleta
- c1-11-sem-cidade: erro inesperado (Error)
- c2-01-frio-sem-fome: erro inesperado (AggregateError)
- c2-02-manga-pergunta-pitta: erro inesperado (AggregateError)
- c2-03-almoco-fora-na-semana: erro inesperado (AggregateError)
- c2-04-feira-abobora-couve: erro inesperado (AggregateError)
- c2-05-acabou-arroz: erro inesperado (AggregateError)
- c2-06-abobora-o-que-faco: erro inesperado (AggregateError)
- c2-07-cha-ajudou: erro inesperado (AggregateError)
- c2-08-ontem-otimo: erro inesperado (AggregateError)
- c2-09-cha-nao-adiantou: erro inesperado (AggregateError)
- c2-10-alergia-camarao: erro inesperado (AggregateError)
- c2-11-dor-de-cabeca-almoco: erro inesperado (AggregateError)
- c2-12-dor-forte-no-peito: erro inesperado (AggregateError)
- c2-13-queria-sumir: erro inesperado (AggregateError)
- c2-14-dia-pesado-pra-baixo: erro inesperado (AggregateError)
- c2-15-cansaco-sem-energia: erro inesperado (AggregateError)
- c2-16-voce-e-inutil: erro inesperado (AggregateError)
- c2-17-prompt-suspeito: erro inesperado (AggregateError)
- c2-18-apagar-dados: erro inesperado (AggregateError)
- c2-19-vegetariana: erro inesperado (AggregateError)
- c2-20-nao-como-coentro: erro inesperado (AggregateError)
- c2-p05-frio-nao-tenho-a-tudo: deve: faz pergunta de casa
- c2-p08-dor-de-cabeca-latejante: deve: tem sugestão que refresca (frio ou brando)
- c2-m01-almoco-fora-propoe: deve: bloco com a nota da rotina
- c2-m02-dia-corrido-nenhuma: deve: termina o run
- c2-m05-vegetariana-sem-barrado: deve: termina o run
- c2-m05-vegetariana-sem-barrado: deve: bloco com a linha da restrição vegetariana
- c2-a02-nao-gosto-nao-aparece: deve: termina o run
- c2-a05-melhorei-sem-pista-como-ficou: deve: o texto aponta "Como ficou?"
- c2-a05-melhorei-sem-pista-como-ficou: não pode: chamou resultado.registrar
- c2-t06-para-ter-com-faltas: deve: a frase fala das próximas vezes
