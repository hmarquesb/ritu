# ADR 0005: Loop do agente no core, Mastra por passo

## Status

Aceito · 2026-11-14

## Contexto

O loop do agente precisa de teto de chamadas, de tempo e de tokens, de pausa e retomada em outro pedido HTTP, de checkpoint e de rastro. Um framework de agentes resolve a chamada de modelo com tools, mas entregar o loop inteiro a ele prende o produto às escolhas dele e dificulta testar sem modelo.

## Decisão

1. O loop (perceber, raciocinar, agir, observar) é código do Ritu, no core: controla passos, limites, checkpoint e pausas, e executa as tools.
2. Cada passo (uma chamada de modelo com tools) é executado pela Mastra, atrás da porta `AgentRuntime`.
3. O estado das pausas (`waiting_for_input`, `waiting_for_approval`) fica no banco, como checkpoint. O run não fica vivo esperando: a resposta chega em outro pedido e retoma.
4. Para testes há um `AgentRuntime` roteirizado, que define a sequência de tools de cada cenário.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Loop inteiro na Mastra (workflow ou agente) | Limites, checkpoint e rastro ficariam no formato do framework; difícil testar sem modelo |
| Chamar o SDK do modelo direto, sem framework | Reescrever tool calling e provider; a Mastra já resolve o passo |
| Manter o run vivo esperando a pessoa | Função longa na Vercel; estado perdido se cair |

## Consequências

- Trocar de framework é trocar um adaptador.
- O loop é testado de forma determinística com o runtime roteirizado.
- O formato do checkpoint é contrato do core e precisa ser versionado.
