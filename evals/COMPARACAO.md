# Evolução dos evals com LLM

Uma coluna por checkpoint e uma linha por métrica, gerada de `evals/resultados/historico.json`. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`.

| Métrica | c1-base | c2-conversa | c3-confiavel |
|---|---|---|---|
| Data | 2026-11-15 | 2026-11-16 | 2026-11-22 |
| Prompts | acompanhante.v1 | acompanhante.v5, interprete.v1 | acompanhante.v8, interprete.v2, memoria.v1, juiz.v1, avaliador.v1 |
| Modelos | gemini-3.1-flash-lite, gemini-3.5-flash-lite | gemini-3.1-flash-lite, gemini-3.5-flash-lite | gemini-3.1-flash-lite, gemini-3.1-flash-lite@1, gemini-3.5-flash-lite |
| Casos | 12 | 54 | 86 |
| **Intenção**: Acerto | — | 90% (18/20) | 95% (19/20) |
| **Conteúdo**: Deve incluir | 83% (10/12) ⚠ | 68% (23/34) ⚠ | 82% (9/11) ⚠ |
| **Conteúdo**: Não pode incluir | 100% (12/12) | 97% (33/34) ⚠ | 100% (8/8) |
| **Fidelidade**: Motivos fiéis | — | — | 100% (15/15) |
| **Fidelidade**: Texto bate com as sugestões | — | — | 82% (9/11) ⚠ |
| **Explicação**: Explicação completa | 73% (8/11) ⚠ | 50% (6/12) ⚠ | 55% (6/11) ⚠ |
| **Trajetória**: Trajetória correta | 67% (8/12) ⚠ | 88% (30/34) | 60% (3/5) ⚠ |
| **Trajetória**: Chamadas desnecessárias por run | 0,00 | 0,06 | 0,02 |
| **Autocorreção**: Válida na 1ª tentativa | 17% (2/12) ⚠ | 15% (5/34) ⚠ | 69% (24/35) |
| **Autocorreção**: Corrigiu após violação | 100% (10/10) | 89% (24/27) ⚠ | 73% (8/11) ⚠ |
| **Perguntas**: Perguntas necessárias feitas | — | 100% (2/2) | 100% (2/2) |
| **Perguntas**: Perguntas desnecessárias evitadas | — | 100% (3/3) | 100% (1/1) |
| **Perguntas**: Perguntas recusadas por run | — | 0,00 | 0,00 |
| **Casa**: Acerto | — | — | 80% (4/5) ⚠ |
| **Propostas**: Propostas corretas | — | 50% (2/4) ⚠ | 80% (4/5) |
| **Propostas**: Propostas recusadas por run | — | 0,09 | 0,40 ⚠ |
| **Para ter em casa**: Acerto | — | 67% (2/3) ⚠ | 50% (1/2) ⚠ |
| **Aprendizado**: Acerto | — | 60% (3/5) ⚠ | 60% (3/5) ⚠ |
| **Memória**: Acerto | — | — | 100% (9/9) |
| **Conversa**: Acerto | — | — | 67% (2/3) ⚠ |
| **Conversa**: Passos na pergunta simples (maior) | — | — | 2 |
| **Segurança**: Bloqueio | — | — | 100% (6/6) |
| **Segurança**: Injection bloqueada | — | — | 100% (4/4) |
| **Linguagem e sofrimento**: Acerto | — | — | 100% (8/8) |
| **Linguagem e sofrimento**: Alertas perdidos | — | — | 0 |
| **Linguagem e sofrimento**: Falsos alertas | — | 0 | 0 |
| **Incômodos**: Acerto | — | — | 100% (3/3) |
| **Incômodos**: Promessas bloqueadas | — | — | 100% (2/2) |
| **Juiz**: Acerto por caso | — | — | 77% (10/13) ⚠ |
| **Juiz**: Falsas reprovações | — | — | 1 |
| **Custo**: Chamadas `decisao` por run | 2,50 | 2,65 | 2,46 |
| **Custo**: Chamadas `apoio` por run | — | — | 1,61 |
| **Custo**: Chamadas `reforco` por run | — | — | 0,07 |
| **Custo**: Tokens de entrada por run | 12895,17 | 20513,82 | 18812,34 |
| **Custo**: Tokens de saída por run | 615,58 | 677,41 | 357,51 |
| **Custo**: Trocas de modelo | 0 | 0 | 0 |
| **Custo**: Latência por run, p50 | 3426 ms | 6253 ms | 5743 ms |
| **Custo**: Latência por run, p95 | 9174 ms | 38588 ms ⚠ | 37454 ms ⚠ |

Em `c1-base` e `c2-conversa`, Explicação incluía 'o texto bate com as sugestões', que desde o `c3-confiavel` conta em Fidelidade.
