# ADR 0030: Formato do checkpoint e da pendência de pergunta

## Status

Aceito · 2026-11-15

## Contexto

Um run pode parar no meio para perguntar algo à pessoa (o que tem em casa, se come um alimento, qual a variante do incômodo) e continuar quando ela responde. A pausa pode vir do agente (`ask_user`) ou do código (variante perguntada antes do agente). Para retomar, o run precisa guardar o que o preparo calculou, a pergunta feita e o que a resposta vai mudar, sem inchar o banco e sem guardar texto de saúde.

## Decisão

1. O checkpoint da 005 leva os `dados` do preparo com três campos novos: `perguntas` (`feitas` e os ids já perguntados), `nao_come_do_run` (ids) e `candidatos_completos` (só os ids da lista antes de `entregaveis`), além de `acabou` (Minha casa ∪ o que a mensagem disse que acabou, fora do prompt). Os campos novos têm padrão no schema, para checkpoints antigos continuarem válidos.
2. A pendência de pergunta (`runs.pendencia`) é `ConteudoDaPendencia`, discriminada por `origem: "agente" | "codigo"`, com a `pergunta` e as `anotacoes` do run (as anotações saem da interpretação, que não é gravada).
3. A pausa de código não tem checkpoint: a pendência guarda a entrada do Acompanhante, e a retomada chama o agente do zero com a variante escolhida.
4. Na retomada, os `dados` atualizados pela resposta são gravados no checkpoint antes de o loop continuar.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Guardar os objetos `Candidato` inteiros | Incha o checkpoint; os ids bastam para recalcular |
| Gravar a `Interpretacao` no run | Ela pode ter texto e incômodo; as anotações já são o que a retomada precisa |
| Checkpoint também na pausa de código | Não há loop a retomar: o agente ainda não rodou |

## Consequências

- Retomar não depende de nada além do run gravado.
- Mudança futura em `DadosDoPreparo` precisa de padrão no schema ou quebra checkpoints em espera.
