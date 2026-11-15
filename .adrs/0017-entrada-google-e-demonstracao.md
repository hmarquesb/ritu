# ADR 0017: Entrada com Google e demonstração por clique com perfil semeado

## Status

Aceito · 2026-11-14

## Contexto

Personalização é o centro do produto, mas quem chega pela primeira vez (inclusive quem avalia o portfólio) precisa ver o Ritu funcionando com memória sem criar conta nem esperar semanas de uso.

## Decisão

1. Entrada com Google pelo Auth.js, guardando só o `sub` e o e-mail, que serve só para entrar. Sem as credenciais do Google, a tela mostra só a demonstração.
2. Conta de demonstração a um clique: cria uma conta nova e copia um perfil semeado (`seed/demo.yaml`) com dosha, cidade, casa com itens confirmados e incertos, gostos, resultados, faltas, rotina, um padrão a confirmar e retornos pendentes.
3. A demonstração expira em 24 h e é apagada, com limite por IP e teto global por dia.
4. Autorização por conta no repositório: toda consulta leva o `conta_id`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| E-mail e senha | Mais dado guardado e mais superfície de ataque |
| Conta de demonstração compartilhada | Uma pessoa veria o que a outra fez |
| Demonstração vazia | Não mostra memória nem personalização |

## Consequências

- O conteúdo do perfil semeado é texto lido pela pessoa e passa por curadoria.
- Limites de demonstração protegem a cota de IA.
- Um teste tenta ler dado de outra conta e tem que falhar.
