# ADR 0033: Aprovação com bloco montado por código e executor fechado

## Status

Aceito · 2026-11-16

## Contexto

O agente só escreve na memória da pessoa por proposta aprovada (regra 4). As propostas vêm de dois lados: do código, que lê a mensagem (casa, "evitar sempre", restrição, "não como"), e do agente, que percebe uma rotina ou uma falta no meio do run. A pessoa decide num bloco curto, no celular. O que for gravado não pode depender do texto que o modelo escreveu nem abrir caminho para apagar dados.

## Decisão

1. O agente propõe por duas tools, `memoria.propor` e `lista.propor`. Elas só validam e devolvem `proposto: true` ou um código de recusa. Quem recolhe as aceitas é `finalizar`.
2. `montarPropostas` junta as anotações do código e as propostas do agente numa linha por assunto, numa ordem fixa: o que é filtro de segurança vem primeiro, e a lista e a rotina ficam por último. O bloco tem um teto de 6 linhas, e as que passam do teto não são criadas.
3. O texto de cada linha é montado por código, a partir do conteúdo e dos nomes da base, na hora da leitura.
4. `Anotacao` mora no domínio `proposals`, e `agents/companion/saida.ts` a reexporta. Isso evita um ciclo entre `agents` e `proposals`.
5. Quem grava é o executor (`executarProposta`), uma tabela fechada de `tipo → gravação` sem caso genérico. Ele só acrescenta e não tem nenhuma operação de remover.
6. Antes de gravar, o executor valida o conteúdo pelo schema estrito e confere a base. Não grava `alimento_id` fora da base, nem "evitar sempre" de alimento ou grupo que a base não conhece; nesses casos a linha fica `recusada` e o run ganha uma etapa `proposta_invalida`. Casa e "não como" com nome livre são válidos.
7. Um run com incômodo não cria proposta nenhuma, nem as do código, e termina em `done`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| O agente escreve a linha do bloco | O texto que a pessoa aprova poderia não corresponder ao que é gravado |
| Executor genérico (aplica o patch que vier) | Abre caminho para remover ou sobrescrever o que a pessoa não aprovou |
| Ignorar só o item fora da base e gravar o resto | Grava algo diferente do que a pessoa viu na linha |
| Deixar passar as propostas de código com incômodo | Mistura um momento de saúde com memória; o lado conservador é não propor |

## Consequências

- O que a pessoa lê é exatamente o que é gravado.
- Um tipo novo de proposta exige schema, texto, uma entrada na tabela do executor e um caso de eval.
- Uma resposta com incômodo nunca guarda nada, nem a casa.
- "Não como" de nome livre aprovado fica no perfil como `texto`, mas não filtra candidatos, porque a base não o conhece.
