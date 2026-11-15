# ADR 0011: Retorno sem cobrança

## Status

Aceito · 2026-11-14

## Contexto

Saber se uma sugestão ajudou é o que fecha o ciclo com o mundo e melhora as próximas respostas. Mas cobrar retorno com notificações ou perguntas insistentes vai contra o princípio de que quem começa é sempre a pessoa.

## Decisão

1. Toda sugestão entregue entra na área "Como ficou?".
2. A pessoa responde se quiser, com um toque: Ajudou · Não ajudou · Não fiz. O toque é gravado na hora, por código.
3. O retorno também pode vir pela conversa; o agente liga o comentário à sugestão certa ou, sem saber qual é, não registra.
4. Sugestão sem retorno sai da área depois de 7 dias, sem contar como "não fiz".
5. Sem notificação. A tela Conversa mostra só um indicador discreto de retornos pendentes.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Notificação ou e-mail pedindo retorno | Cobra a pessoa; exige canal de contato |
| Pergunta de retorno no início de cada conversa | Atrapalha quem chegou com outra necessidade |
| Retorno obrigatório antes de nova sugestão | Barreira de uso |

## Consequências

- Menos retornos do que com cobrança, mas mais honestos.
- O aprendizado (ADR 0010) funciona com o que vier.
- Retornos são uma métrica de uso real.
