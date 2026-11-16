# ADR 0035: Restrição e "não como" ditos na conversa valem no dia, sem esperar aprovação

## Status

Aceito · 2026-11-16

## Contexto

Quando a pessoa diz "sou vegetariana" ou "não como pimentão", a resposta seguinte já precisa respeitar isso. Guardar no perfil, porém, só acontece com aprovação. Se a pessoa disser "Agora não", ainda assim não faz sentido o Ritu sugerir, na mesma tarde, o que ela acabou de dizer que não come.

## Decisão

1. O temporário do perfil guarda `ItemTemporario`, que substitui `ItemDoDia`. Ele pode ser um alimento, um grupo, uma restrição, um "não como" de alimento da base ou um `nao_come_texto`, para nomes que a base não conhece.
2. Restrição e "não como" ditos na mensagem vão para o temporário do dia antes do preparo. `montarFiltro` os aplica na mesma resposta e nas mensagens seguintes do mesmo dia. `nao_come_texto` vai para `evitar_textos`.
3. A resposta "Não como" a uma pergunta (009) também vai para o temporário do dia.
4. O temporário é limpo na virada do dia. O que deve durar vai para o perfil, por proposta aprovada.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só filtrar depois de aprovar | A resposta logo seguinte sugeriria o que a pessoa acabou de recusar |
| Gravar direto no perfil | Escrita sem aprovação (regra 4) |
| Manter o alias `ItemDoDia` | Dois nomes para a mesma coisa |

## Consequências

- "Agora não" não grava nada no perfil, mas a restrição continua valendo até o fim do dia.
- Restrição sem nenhum item marcado na base (hoje, "vegetariana") passa pelo filtro sem barrar nada.
