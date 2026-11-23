# ADR 0054: MCP público só de leitura, sem estado, com limites próprios

## Status

Aceito · 2026-11-22

## Contexto

A base ayurvédica e o clima em qualidades são o que o Ritu tem de reaproveitável por outros agentes. O servidor MCP abre isso para fora, sem login, e por isso precisa de uma superfície mínima: nada que leia ou escreva dado de conta, e limites que protejam o banco (cada pedido escreve no limitador) e a cota da Open-Meteo.

## Decisão

1. **Seis tools públicas, só de leitura:** `ayurveda_alimento`, `ayurveda_candidatos`, `ayurveda_substitutos`, `ayurveda_checar_combinacao`, `clima_agora` e `clima_proximas_horas`. Cada uma chama o `execute` da tool interna correspondente, sem reescrever a lógica, com um contexto neutro (`filtroVazio`, `sinaisVazios`, `contaId: "mcp"`). O `dosha` opcional de `ayurveda_candidatos` vira prakriti `{ dosha: 1 }`; o clima recebe a cidade pelo nome, resolvida pelo `CityLookup` (primeiro resultado, com `regiao` e `pais` na saída). Nenhuma tool de escrita, de conta, de casa, de memória ou de controle (`ask_user`, `finalizar`) é exposta.
2. **Sem caminho até dado de conta:** os stores do contexto público são `storesProibidos`, que lança `RituError("mcp_sem_conta")` em qualquer acesso. Saída validada em zod, com `fonte` nas tools de clima e o aviso "Não é orientação médica." em toda resposta.
3. **Transporte:** `mcp-handler` em `src/app/api/mcp/route.ts`, sem estado, só `POST` (o `GET` responde `405`). O servidor fica em `src/infra/mcp/servidor.ts`, que lê `IP_HMAC_SECRET` e `RITU_MODO`; a rota não lê env.
4. **Limites:** 30 chamadas por IP por minuto, 300 por IP por dia e 3000 no total por dia (`limites.mcp`), na tabela `limites`, com o IP em HMAC. Toda requisição `POST` conta. Estouro devolve `429` com `Retry-After` e um erro JSON-RPC. Corpo acima de 16 KB devolve `413` sem consumir limite.
5. **Origem:** o `proxy.ts` aceita `Origin` ausente só em `POST /api/mcp` (clientes MCP não o mandam); `Origin` de outro site continua `403`, e as demais rotas seguem exigindo `Origin`. Não há CORS.
6. **Telemetria:** `ritu_mcp_chamadas_total{tool, resultado}` e o span `mcp.tool` com `tool.nome` e `tool.status`. Cidade, nomes de alimento e argumentos nunca vão para span, métrica nem log.

### Diferenças da API instalada (`mcp-handler` e `@modelcontextprotocol/server` 2.4.0)

- Não existe `basePath`: quem fixa `/api/mcp` é a rota do Next.
- O `inputSchema` anunciado deixa o valor passar; a validação real (`safeParse`) fica na tool, para contar `invalido` e responder erro de tool com "Entrada inválida." e a lista dos campos, sem stack.
- `outputSchema` e `structuredContent` seguem o protocolo.

### Exceção no teste de arquitetura

O servidor é o adaptador do protocolo e a rota o importa. No R3 (tela não importa adaptador), só `route.ts` pode importar `@/infra/mcp/servidor`; no R6 (eval não importa adaptador), só `mcp-rota.eval.ts` e `mcp-canarios.eval.ts`. `limites.eval.ts` tira `/api/mcp` da varredura das rotas de toque, porque a rota tem limite próprio.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Expor `criarPostMcp` pelo container | Colocaria o `mcp-handler` no composition root sem ganho; a exceção estreita é menor |
| OAuth no MCP | A base é pública e o servidor não alcança dado de conta; o limite por IP basta |
| Reescrever as tools para o MCP | Duas lógicas para a mesma base; as tools internas já são puras sobre o contexto |
| Prompts e resources MCP | Só tools resolvem o caso |

## Consequências

- Um agente compatível com MCP (Streamable HTTP) testa a base sem entrar no site.
- O teste de arquitetura carrega duas exceções nomeadas; qualquer outra importação do servidor falha.
- Uma versão nova do `mcp-handler` com `basePath` ou schema estrito pode simplificar a rota e a validação.
