# Evolução dos evals com LLM

Uma coluna por checkpoint e uma linha por métrica, gerada de `evals/resultados/historico.json`. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`.

| Métrica | c1-base | c2-conversa |
|---|---|---|
| Data | 2026-11-15 | 2026-11-16 |
| Prompts | acompanhante.v1 | acompanhante.v5, interprete.v1 |
| Modelos | gemini-3.1-flash-lite, gemini-3.5-flash-lite | gemini-3.1-flash-lite, gemini-3.5-flash-lite |
| Casos | 12 | 54 |
| **Intenção**: Acerto | — | 90% (18/20) |
| **Conteúdo**: Deve incluir | 83% (10/12) ⚠ | 68% (23/34) ⚠ |
| **Conteúdo**: Não pode incluir | 100% (12/12) | 97% (33/34) ⚠ |
| **Fidelidade**: Motivos fiéis | — | — |
| **Fidelidade**: Texto bate com as sugestões | — | — |
| **Explicação**: Explicação completa | 73% (8/11) ⚠ | 50% (6/12) ⚠ |
| **Trajetória**: Trajetória correta | 67% (8/12) ⚠ | 88% (30/34) |
| **Trajetória**: Chamadas desnecessárias por run | 0,00 | 0,06 |
| **Autocorreção**: Válida na 1ª tentativa | 17% (2/12) ⚠ | 15% (5/34) ⚠ |
| **Autocorreção**: Corrigiu após violação | 100% (10/10) | 89% (24/27) ⚠ |
| **Perguntas**: Perguntas necessárias feitas | — | 100% (2/2) |
| **Perguntas**: Perguntas desnecessárias evitadas | — | 100% (3/3) |
| **Perguntas**: Perguntas recusadas por run | — | 0,00 |
| **Casa**: Acerto | — | — |
| **Propostas**: Propostas corretas | — | 50% (2/4) ⚠ |
| **Propostas**: Propostas recusadas por run | — | 0,09 |
| **Para ter em casa**: Acerto | — | 67% (2/3) ⚠ |
| **Aprendizado**: Acerto | — | 60% (3/5) ⚠ |
| **Memória**: Acerto | — | — |
| **Conversa**: Acerto | — | — |
| **Conversa**: Passos na pergunta simples (maior) | — | — |
| **Segurança**: Bloqueio | — | — |
| **Segurança**: Injection bloqueada | — | — |
| **Linguagem e sofrimento**: Acerto | — | — |
| **Linguagem e sofrimento**: Alertas perdidos | — | — |
| **Linguagem e sofrimento**: Falsos alertas | — | 0 |
| **Incômodos**: Acerto | — | — |
| **Incômodos**: Promessas bloqueadas | — | — |
| **Juiz**: Acerto por caso | — | — |
| **Juiz**: Falsas reprovações | — | — |
| **Custo**: Chamadas `decisao` por run | 2,50 | 2,65 |
| **Custo**: Chamadas `apoio` por run | — | — |
| **Custo**: Chamadas `reforco` por run | — | — |
| **Custo**: Tokens de entrada por run | 12895,17 | 20513,82 |
| **Custo**: Tokens de saída por run | 615,58 | 677,41 |
| **Custo**: Trocas de modelo | 0 | 0 |
| **Custo**: Latência por run, p50 | 3426 ms | 6253 ms |
| **Custo**: Latência por run, p95 | 9174 ms | 38588 ms ⚠ |

Em `c1-base` e `c2-conversa`, Explicação incluía 'o texto bate com as sugestões', que desde o `c3-confiavel` conta em Fidelidade.
