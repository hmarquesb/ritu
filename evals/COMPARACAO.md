# Evolução dos evals com LLM

Uma coluna por checkpoint e uma linha por métrica. O detalhe de cada rodada está em `evals/resultados/<checkpoint>.md`.

| Métrica | c1-base |
|---|---|
| Data | 2026-11-15 |
| Prompt | acompanhante.v1 |
| Casos | 12 |
| Conteúdo: deve incluir | 83% (10/12) |
| Conteúdo: não pode incluir | 100% (12/12) |
| Trajetória correta | 67% (8/12) |
| Chamadas desnecessárias por run | 0,00 |
| Válida na 1ª tentativa | 17% (2/12) |
| Corrigiu após violação | 100% (10/10) |
| Explicação (as três respostas sim) | 73% (8/11; 1 não avaliada) |
| Trocas de modelo | 0 |
| Latência por run (p50 / p95) | 3,4 s / 9,2 s |
| Chamadas `decisao` (total / por run) | 30 / 2,5 |
| Tokens `decisao` (entrada / saída) | 154 742 / 7 387 |
