# ADR 0038: Tarefas em ondas e trilha adiantada em worktree

## Status

Aceito · 2026-11-16 · Substitui em parte a [0021](0021-construcao-por-orquestrador-e-subagentes.md): a execução de uma tarefa por vez e o "direto na `main`" do item 3.

## Contexto

A 0021 manda uma tarefa por vez, porque todos os subagentes trabalham na mesma pasta e commitam na `main`. Medido na entrega 2: cerca de 6 minutos por tarefa (implementador, verificador, commit) e 2h30 numa spec de 26 tarefas, com 11 specs pela frente.

Boa parte das tarefas de uma spec não tem arquivo em comum nem depende uma da outra: configuração e tipos no começo; cenários, `demo`, evals determinísticos e casos do `eval:llm` no fim. E as specs 016 e 017 não dependem das specs que faltam na entrega 2.

## Decisão

1. O plano de cada spec diz, em cada tarefa, de quais ela depende, e agrupa as tarefas em **ondas**: tarefas sem dependência pendente e sem arquivo em comum, até 5 por onda.
2. Os implementadores de uma onda rodam ao mesmo tempo, na mesma pasta. Cada um confere só os próprios arquivos. Os gates completos rodam uma vez por onda, e o diff é conferido tarefa a tarefa, por um verificador para cada uma.
3. Continua um commit por tarefa aprovada, com caminhos explícitos, na ordem do plano.
4. Uma **trilha adiantada** pode construir, num git worktree e na branch `entrega-N`, as specs da entrega seguinte cujas dependências já estão `implemented` na `main`. A branch só entra na `main` depois do portão da entrega anterior.
5. O resto da 0021 continua: verificador em toda tarefa, portões humanos, estado em arquivo, nada de `--force` nem de reescrever histórico.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Continuar com uma tarefa por vez | O relógio da construção é a soma de todas as tarefas, mesmo das que não se tocam |
| Um worktree por tarefa | Isola os gates, mas pede instalação e junção a cada tarefa: mais cerimônia que ganho |
| Paralelo sem declarar dependência | Gate vermelho sem dono; ninguém sabe qual tarefa quebrou |
| Começar a entrega seguinte na `main` antes do portão | Mistura o que a dona ainda não conferiu com o que ela vai conferir |

## Consequências

- O relógio de uma spec cai; a janela de uso é gasta mais depressa, e a trava de `.local/uso.json` passa a valer por onda.
- O plano precisa trazer `depende de` certo. Dependência esquecida aparece como gate vermelho na onda.
- Os commits de uma onda foram verificados juntos, não um a um: o estado garantido verde é o do fim da onda.
- A trilha adiantada junta a `main` na branch a cada spec, e resolve os conflitos ali.
