# ADR 0053: Checkpoints do eval com LLM pelos handlers das rotas do site

## Status

Aceito · 2026-11-22

## Contexto

Os checkpoints `c1` a `c3` chamam a conversa direto pelo código (`conversar`, `continuar`, `aprovar`). Nenhum eval com LLM passava pelo caminho de quem visita o site: rota, limites, NDJSON das etapas, pausa e retomada pela rota, visão final relida do banco. O `c4-site` e o `c5-publico`, previstos em `QA.md`, não existiam.

## Decisão

1. Cada checkpoint tem `pastas` e `alvo` (`"codigo" | "rotas"`). `c4-site` e `c5-publico` rodam as pastas `c1`, `c2` e `c3` com alvo `rotas`.
2. Com alvo `rotas`, os casos de acompanhante e de conversa rodam pelos handlers exportados (`rotasDeFluxoDeRun`, `rotasDaConversa`, `rotasDaCasa`) com `Request` de verdade, no mesmo processo do runner. O `Container` das rotas é montado com as dependências do cenário (relógio, clima, stores, roteador, runtime); a sessão entra por `contaDaSessao` e o limite por `quemPede` com o escopo do caso. O `conversation` é embrulhado só para guardar o que devolve.
3. Cada caso de run pelas rotas ganha as checagens da lista `rota`: status 200, NDJSON válido, `inicio` e `fim` em cada fluxo, `run_id` e texto da visão batendo com o run gravado. Rota com status diferente de 200 (inclusive 429 e run aberto) faz o caso falhar; nunca é inconclusivo.
4. Os casos de acompanhante entram por entrada estruturada, que nenhuma rota recebe: a primeira chamada deles segue no código, e as pausas passam pela rota.
5. Um teste sem LLM prova que a rodada pelas rotas devolve o mesmo resultado que a rodada pelo código em todos os cenários de conversa.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Servidor HTTP no ar e `fetch` | Cada caso precisa do próprio relógio e clima; exigiria um modo de teste novo no código de produção |
| Rota nova para a entrada estruturada do acompanhante | Abre superfície pública só para eval |
| 429 como inconclusivo | Um caso cabe em qualquer limite; barrar é erro de ligação, que é o que o checkpoint procura |

## Consequências

- O checkpoint final mede o agente pelo caminho do site, sem cobrir cookies, CSP e middleware, que ficam com o E2E.
- O relatório diz o alvo e, com alvo `rotas`, "Fluxo pelas rotas: N de M casos íntegros".
- O `c4-site` fica registrado sem rodada; o `historico.json` só mostra os checkpoints rodados.
