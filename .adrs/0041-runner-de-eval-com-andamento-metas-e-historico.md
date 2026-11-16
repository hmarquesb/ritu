# ADR 0041: Runner de eval com andamento, metas e histórico

## Status

Aceito · 2026-11-16

## Contexto

O runner do `eval:llm` das entregas anteriores conferia palavras no texto da resposta, contava as famílias por campos soltos em cada caso (`familia`, `falsoAlerta`, `boa`, `juiz`) e só escrevia o relatório no fim. Uma rodada do `c3-confiavel` gasta cerca de 300 chamadas da cota gratuita: um 429 no meio perdia tudo, e a comparação entre checkpoints era editada à mão. Conferir palavra não mede o que a família pede (uma resposta pode citar "aviso" e não avisar), e não havia meta por métrica para dizer à dona o que piorou.

## Decisão

1. Cada caso declara o `tipo`, as `familias` que mede e as `marcas` que o põem numa métrica (`pergunta_necessaria`, `alerta_devido`, `falso_alerta`, `injection`, `promessa`, `falsa_reprovacao` e outras). As métricas saem dessas marcas, não de campos soltos.
2. O que é conferível por código continua por código. O que depende de ler o texto vai para o avaliador `avaliador.v1`, no papel `apoio` e pelo `ModelRouter`, só com perguntas fechadas de sim ou não, cada uma com o valor esperado. O texto avaliado é dado, nunca instrução.
3. Cada métrica tem uma meta em `config/evals.ts`. O relatório marca o que ficou abaixo e a variação contra o checkpoint anterior. Três metas são críticas e abrem o relatório: bloqueio de segurança, alerta perdido e promessa em incômodo. A meta avisa e não trava a rodada: quem decide é a dona, no portão.
4. A rodada grava o andamento caso a caso em `evals/local/` (fora do git), com uma assinatura dos casos, dos prompts e dos modelos. `--retomar` continua; assinatura diferente obriga `--do-zero`. Segunda rodada no mesmo dia só com `--extra`. `--caso` roda um caso sem gravar; `--listar` não chama modelo.
5. `evals/resultados/historico.json` é a fonte dos números por checkpoint; `evals/COMPARACAO.md` é gerado dele e não se edita à mão. Os detalhes dos casos que falharam ficam em `evals/local/`, fora do git, e nada que vem da conversa entra em `evals/resultados/`.
6. `evals/det/mapa.ts` liga cada linha de evals determinísticos de `QA.md` aos arquivos que a conferem, e um eval trava a ligação. Outro eval trava o registro dos casos com LLM (ids, famílias, marcas e contagens).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter a checagem por palavras | Mede o vocabulário, não o comportamento; falha com sinônimo e passa com a palavra fora de lugar |
| Avaliador com nota livre (1 a 5) | Nota varia entre rodadas e não diz o que falhou; pergunta fechada com valor esperado é reprodutível e auditável |
| Meta que reprova a rodada | A rodada gasta a cota do dia; travar por meta perderia os números que a dona precisa ver no portão |
| Relatório só no fim, sem andamento | Um 429 no caso 200 perdia 200 casos de cota gratuita |
| `COMPARACAO.md` editado à mão | Diverge dos relatórios; um JSON gerando a tabela também alimenta a página Bastidores |

## Consequências

- Rodadas sobrevivem a 429 e a queda de rede, e a comparação entre checkpoints sai sempre igual aos números.
- O avaliador custa uma chamada por pergunta conferida, contada na estimativa do `--listar`.
- Caso novo precisa de tipo, famílias e marcas válidas, ou o eval do registro falha.
- Mudar a lista de evals determinísticos de `QA.md` exige mudar `evals/det/mapa.ts`.
