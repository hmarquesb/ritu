# ADR 0002: Conversa em texto livre, resposta em texto do agente

## Status

Aceito · 2026-11-14

## Contexto

A pessoa conta como está, pergunta, fala da rotina e avisa o que comprou, tudo do jeito dela. Formulários e menus não cobrem essa variedade. Do outro lado, uma lista de cartões não explica o porquê nem soa como alguém que ouviu.

## Decisão

1. A entrada é uma mensagem em texto livre. Atalhos de check-in são opcionais e equivalem a dizer aquilo por escrito.
2. Uma mensagem pode ter mais de uma intenção, e o agente entende todas.
3. Toda resposta é um texto do agente falando com a pessoa. Sugestões, bloco de aprovação e "vale ter em casa" são blocos de apoio, desenhados abaixo do texto, e nunca substituem a fala.
4. A saída do agente traz o texto e a parte estruturada juntos, e o validador e o Juiz conferem que as duas dizem o mesmo.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Formulário de estado (temperatura, energia, fome) | Não cobre perguntas, casa, rotina nem retornos |
| Resposta só em cartões | Não explica o porquê; não soa como gente |
| Texto sem parte estruturada | Impede validar, trocar ingrediente e registrar retornos por código |

## Consequências

- É preciso um Intérprete para classificar intenções e campos (ADR 0006).
- O texto da pessoa é dado, nunca instrução, e é renderizado como texto puro.
- Validador e Juiz precisam conferir a coerência entre texto e estrutura.
