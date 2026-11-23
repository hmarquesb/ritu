# Evolução dos evals com LLM

Uma coluna por checkpoint e uma linha por métrica, gerada de `evals/resultados/historico.json`. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`.

| Métrica | c1-base | c2-conversa | c3-confiavel | c5-publico |
|---|---|---|---|---|
| Data | 2026-11-15 | 2026-11-16 | 2026-11-22 | 2026-11-23 |
| Prompts | acompanhante.v1 | acompanhante.v5, interprete.v1 | acompanhante.v8, interprete.v2, memoria.v1, juiz.v1, avaliador.v1 | acompanhante.v8, interprete.v2, memoria.v1, juiz.v1, avaliador.v1 |
| Modelos | gemini-3.1-flash-lite, gemini-3.5-flash-lite | gemini-3.1-flash-lite, gemini-3.5-flash-lite | gemini-3.1-flash-lite, gemini-3.1-flash-lite@1, gemini-3.5-flash-lite | gemini-3.1-flash-lite, gemini-3.1-flash-lite@1, gemini-3.5-flash-lite |
| Casos | 12 | 54 | 86 | 86 |
| **Intenção**: Acerto | — | 90% (18/20) | 95% (19/20) | 90% (18/20) |
| **Conteúdo**: Deve incluir | 83% (10/12) ⚠ | 68% (23/34) ⚠ | 82% (9/11) ⚠ | 75% (9/12) ⚠ |
| **Conteúdo**: Não pode incluir | 100% (12/12) | 97% (33/34) ⚠ | 100% (8/8) | 100% (9/9) |
| **Fidelidade**: Motivos fiéis | — | — | 100% (15/15) | 80% (12/15) ⚠ |
| **Fidelidade**: Texto bate com as sugestões | — | — | 82% (9/11) ⚠ | 82% (9/11) ⚠ |
| **Explicação**: Explicação completa | 73% (8/11) ⚠ | 50% (6/12) ⚠ | 55% (6/11) ⚠ | 55% (6/11) ⚠ |
| **Trajetória**: Trajetória correta | 67% (8/12) ⚠ | 88% (30/34) | 60% (3/5) ⚠ | 67% (4/6) ⚠ |
| **Trajetória**: Chamadas desnecessárias por run | 0,00 | 0,06 | 0,02 | 0,04 |
| **Autocorreção**: Válida na 1ª tentativa | 17% (2/12) ⚠ | 15% (5/34) ⚠ | 73% (30/41) | 72% (31/43) |
| **Autocorreção**: Corrigiu após violação | 100% (10/10) | 89% (24/27) ⚠ | 73% (8/11) ⚠ | 45% (5/11) ⚠ |
| **Perguntas**: Perguntas necessárias feitas | — | 100% (2/2) | 100% (2/2) | 100% (2/2) |
| **Perguntas**: Perguntas desnecessárias evitadas | — | 100% (3/3) | 100% (3/3) | 100% (3/3) |
| **Perguntas**: Perguntas recusadas por run | — | 0,00 | 0,00 | 0,00 |
| **Casa**: Acerto | — | — | 80% (4/5) ⚠ | 100% (5/5) |
| **Propostas**: Propostas corretas | — | 50% (2/4) ⚠ | 83% (5/6) | 67% (4/6) ⚠ |
| **Propostas**: Propostas recusadas por run | — | 0,09 | 0,33 ⚠ | 0,33 ⚠ |
| **Para ter em casa**: Acerto | — | 67% (2/3) ⚠ | 67% (2/3) ⚠ | 67% (2/3) ⚠ |
| **Aprendizado**: Acerto | — | 60% (3/5) ⚠ | 60% (3/5) ⚠ | 80% (4/5) ⚠ |
| **Memória**: Acerto | — | — | 90% (9/10) | 90% (9/10) |
| **Conversa**: Acerto | — | — | 67% (2/3) ⚠ | 67% (2/3) ⚠ |
| **Conversa**: Passos na pergunta simples (maior) | — | — | 2 | 2 |
| **Segurança**: Bloqueio | — | — | 100% (6/6) | 100% (6/6) |
| **Segurança**: Injection bloqueada | — | — | 100% (4/4) | 100% (4/4) |
| **Linguagem e sofrimento**: Acerto | — | — | 100% (8/8) | 88% (7/8) |
| **Linguagem e sofrimento**: Alertas perdidos | — | — | 0 | 1 ⚠ |
| **Linguagem e sofrimento**: Falsos alertas | — | 0 | 0 | 0 |
| **Incômodos**: Acerto | — | — | 75% (3/4) ⚠ | 50% (2/4) ⚠ |
| **Incômodos**: Promessas bloqueadas | — | — | 100% (3/3) | 100% (3/3) |
| **Juiz**: Acerto por caso | — | — | 77% (10/13) ⚠ | 77% (10/13) ⚠ |
| **Juiz**: Falsas reprovações | — | — | 1 | 1 |
| **Custo**: Chamadas `decisao` por run | 2,50 | 2,65 | 2,43 | 2,46 |
| **Custo**: Chamadas `apoio` por run | — | — | 1,72 | 1,77 |
| **Custo**: Chamadas `reforco` por run | — | — | 0,13 | 0,19 |
| **Custo**: Tokens de entrada por run | 12895,17 | 20513,82 | 19194,34 | 20023,52 |
| **Custo**: Tokens de saída por run | 615,58 | 677,41 | 394,53 | 524,79 |
| **Custo**: Trocas de modelo | 0 | 0 | 0 | 0 |
| **Custo**: Latência por run, p50 | 3426 ms | 6253 ms | 7050 ms | 6229 ms |
| **Custo**: Latência por run, p95 | 9174 ms | 38588 ms ⚠ | 37922 ms ⚠ | 36079 ms ⚠ |

Em `c1-base` e `c2-conversa`, Explicação incluía 'o texto bate com as sugestões', que desde o `c3-confiavel` conta em Fidelidade.
