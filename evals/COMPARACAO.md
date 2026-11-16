# Evolução dos evals com LLM

Uma coluna por checkpoint e uma linha por métrica. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`.

| Métrica | c1-base | c2-conversa |
|---|---|---|
| Data | 2026-11-15 | 2026-11-16 |
| Prompt | acompanhante.v1 | acompanhante.v5, interprete.v1 |
| Casos | 12 | 54 (34 com resposta, 20 de intérprete) |
| Conteúdo: deve incluir | 83% (10/12) | 68% (23/34) |
| Conteúdo: não pode incluir | 100% (12/12) | 97% (33/34) |
| Trajetória correta | 67% (8/12) | 88% (30/34) |
| Chamadas desnecessárias por run | 0,00 | 0,06 |
| Válida na 1ª tentativa | 17% (2/12) | 15% (5/34) |
| Corrigiu após violação | 100% (10/10) | 89% (24/27) |
| Explicação (as três respostas sim) | 73% (8/11; 1 não avaliada) | 50% (6/12; só os casos do c1) |
| Trocas de modelo | 0 | 0 |
| Latência por run (p50 / p95) | 3,4 s / 9,2 s | 6,3 s / 38,6 s (rodada completa) |
| Chamadas `decisao` (total / por run) | 30 / 2,5 | 90 / 2,6 |
| Tokens `decisao` (entrada / saída) | 154 742 / 7 387 | 697 470 / 23 032 |
| Intenção (acerto / falsos alertas) | — | 90% (18/20; 2 por tempo esgotado) / 0 de 2 |
| Perguntas (necessárias / desnecessárias evitadas) | — | 100% (2/2) / 100% (3/3) |
| Propostas corretas | — | 50% (2/4) |
| Aprendizado | — | 60% (3/5) |
| Para ter em casa | — | 67% (2/3) |
| Chamadas `apoio` (total) | — | 30 |

O `c2-conversa` junta a rodada completa (`c2-conversa.md`) com a repetição dos 22 casos que deram erro de ambiente nela (`c2-conversa-parcial.md`).
