# ADR 0037: Frase do padrão por código e agente de Memória só para o resumo

## Status

Aceito · 2026-11-16

## Contexto

O Ritu aprende regularidades da rotina da pessoa ("com frio e agitada, o chá de gengibre com canela ajuda") e guarda notas curtas sobre a vida dela. Os dois entram no contexto de toda resposta. Um padrão inventado ou uma nota mal resumida mudariam as sugestões sem a pessoa ter dito nada, e texto livre e incômodo de saúde não podem virar memória (regra 6).

## Decisão

1. **Padrão por código.** Um job diário lê só registros estruturados dos últimos 60 dias (estados do momento, sugestão, resultado), sem modelo e sem texto livre. A chave e a frase do padrão saem de um modelo de frase em código, a partir dos nomes da base. Dois tipos: o que ajuda em um estado e estados que andam juntos, com no mínimo 3 ocorrências e 75% de consistência.
2. **Só vale depois do sim.** O padrão nasce `candidato` e entra no bloco de aprovação como a linha `padrao.confirmar` ("Notei isto. Está certo?"), por último e no máximo uma por resposta. Linha ligada confirma; linha desligada, com outra ligada, recusa para sempre; "Agora não" e a expiração deixam para depois (no máximo uma vez por dia e até 3 vezes). Só o confirmado vai ao prompt, e o filtro da pessoa vale sobre ele.
3. **Memória só para o resumo.** O agente de Memória (papel `apoio`, sem tools) só compacta as notas de rotina aprovadas num resumo. Com uma nota, o resumo é a nota, sem modelo. Sem modelo, com erro ou com resumo inválido, o código monta o resumo. O resumo é refeito logo depois da aprovação, fora da transação, e a falha dele não desfaz a aprovação.
4. **Notas limitadas.** `memoria.propor` recusa nota nova com 30 notas ativas (`rotina_cheia`). As notas não mudam sozinhas: a contradição se resolve no resumo, e a nota só sai quando a pessoa a tira.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| O modelo escrever a frase do padrão | Poderia inventar um fato sobre a pessoa ou carregar texto livre para a memória |
| Padrão valendo sem confirmação | A pessoa não teria visto nem recusado o que o Ritu passou a assumir |
| O agente de Memória decidir o que anotar | A escrita só acontece por proposta aprovada (regra 4) |
| Resumo só por modelo | Sem cota, o resumo ficaria desatualizado |

## Consequências

- `montarFiltro` mora em `src/core/filtro-da-pessoa.ts`, arquivo solto do core, e não em `agents/companion`: o job de padrões e o preparo o usam, e dentro de `agents` haveria um ciclo entre `agents` e `patterns`.
- O agente de Memória recebe as notas com um tipo estrutural (`NotaParaResumo`, texto e data), sem importar `routine`: uma `NotaDeRotina` passa sem conversão e `agents` não depende de `routine`.
- Um run do Acompanhante que entrega sem pausar não tem checkpoint, e portanto não tem o filtro do preparo. Nesse caso o fim do run monta o filtro do dia pelas portas (perfil, "evitar" temporário do dia e gostos), para o padrão do bloco respeitar o que a pessoa barrou.
- Quem conversa sempre com os mesmos dois estados recebe primeiro "andam juntos": os dois estados formam um padrão do tipo `estados_juntos` antes de qualquer sugestão específica ganhar ocorrências.
- A detecção diária e o resumo têm métrica e span próprios (`OBSERVABILITY.md` §3).
