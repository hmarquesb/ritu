# Entrega 1 · Estado

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 001 | T1 · Set up the toolchain and config folder | mecanica | concluida | d7cbd50 |
| 001 | T2 · Add the minimal Next.js app and the E2E smoke test | mecanica | concluida | 9c2f73a |
| 001 | T3 · Add typed errors and the Clock port | mecanica | concluida | 6ec6de2 |
| 001 | T4 · Add the environment catalog and .env.example | mecanica | concluida | 33f6650 |
| 001 | T5 · Add the env:check script | mecanica | concluida | f8eb158 |
| 001 | T6 · Add the lazy composition root | mecanica | concluida | 562c326 |
| 001 | T7 · Add the architecture test R1–R9 | mecanica | concluida | 867380d |
| 001 | T8 · Add docker-compose and the CI workflow | mecanica | concluida | f904742 |
| 001 | Fechamento (gates, ADRs 0001–0021, docs; sem push) | — | concluida | (este commit) |

> Repositório no GitHub ainda não existe (dona, 2026-11-14): só commits locais, sem `git push` e sem conferir CI até ela criar o repo.
> Limite da janela de 5 h elevado para 95% (dona, 2026-11-14, só para esta sessão de construção). Semana segue em 95%.
> Nesta sessão não há passagem por `contexto_pct` (dona, 2026-11-14): segue até o fim da entrega ou até 95% da janela de 5 h / semana.

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 002 | T1 · Vocabulary, schemas, config | mecanica | concluida | 47aa620 |
| 002 | T2 · Cross validation and KnowledgeBase port | mecanica | concluida | 693abf6 |
| 002 | T3 · Mini knowledge base fake | mecanica | concluida | 6733200 |
| 002 | T4 · Moment qualities, time of day, score | mecanica | concluida | bc40fe3 |
| 002 | T5 · Person filters and identification | mecanica | concluida | 2f43292 |
| 002 | T6 · Substitutes and combinations | mecanica | concluida | e0413d5 |
| 002 | T7 · Tool contract and ayurveda tools | mecanica | concluida | 43a5368 |
| 002 | T8 · YAML adapter, container, data stubs | mecanica | concluida | a2a6eb5 |
| 002 | T9 · base:check script | mecanica | concluida | d316268 |
| 002 | C1 · Vocabulary, avoid groups, states, doshas, discomforts | conteudo | concluida | 1c27365 |
| 002 | C2 · Quiz | conteudo | concluida | db29997 |
| 002 | C3 · Fruits and leafy greens | conteudo | concluida | 5a958d2 |
| 002 | C4 · Vegetables and roots | conteudo | concluida | 9c04d37 |
| 002 | C5 · Grains and legumes | conteudo | concluida | 6a9b2fb |
| 002 | C6 · Dairy, eggs, nuts, oils | conteudo | concluida | 259b468 |
| 002 | C7 · Spices and herbs | conteudo | concluida | 5d464f5 |
| 002 | C8 · Sweeteners, drinks, combinations | conteudo | concluida | 3daf9e0 |
| 002 | C9 · Preparations batch 1 | conteudo | concluida | 1601ec8 |
| 002 | C10 · Preparations batch 2 | conteudo | concluida | 72cc66b |
| 002 | C11 · Teas | conteudo | concluida | 67ae6a7 |
| 002 | C12 · Oil and daily practices | conteudo | concluida | a087fe3 |
| 002 | T11 · Slot minimum exceptions in config | mecanica | concluida | 3fa6bc2 |
| 002 | T10 · Deterministic evals of the real base | mecanica | concluida | eb3226a |
| 002 | Fechamento | — | concluida | (este commit) |

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 003 | T1 · Weather config, ports, pure functions | mecanica | concluida | c5a91f6 |
| 003 | T2 · Weather cache and fakes | mecanica | concluida | cfec503 |
| 003 | T3 · Open-Meteo adapters | mecanica | concluida | 303a7f3 |
| 003 | T4 · Weather tools, ToolContext, container | mecanica | concluida | fcf42e6 |
| 003 | T5 · clima:real script and weather evals | mecanica | concluida | 411c967 |
| 003 | Fechamento (gates 1–6, ADR 0024, docs; sem push) | — | concluida | (este commit) |

> 003 · ⚠️ `clima:real "Rio de Janeiro"` (2026-11-15, 04h local): Rio de Janeiro (Rio de Janeiro, Brasil) · America/Sao_Paulo · 25,1 °C (neutro) · 98% (úmido → `oleoso`) · próximas 6 h: esquenta, sem chuva · exit 0. Vai para o relatório da entrega.

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 004 | T1 · Memory config, dia local, pantry state | mecanica | concluida | 8fd937b |
| 004 | T2 · Domain types, ports, jsonb schemas | mecanica | concluida | 965f6b4 |
| 004 | T3 · Contracts + memory fake (accounts, profiles, pantry, shortages, preferences) | mecanica | concluida | 4382804 |
| 004 | T4 · Contracts + memory fake (rest, transaction, delete account) | mecanica | concluida | bab3df8 |
| 004 | T5 · postgres driver, migration, client, db:migrate | mecanica | concluida | fb10d7b |
| 004 | T6 · Pg adapters part 1 + test:db | mecanica | concluida | 38abc25 |
| 004 | T7 · Pg adapters part 2, transactor, container | mecanica | concluida | 4016e9e |
| 004 | T8 · Daily cleanup | mecanica | concluida | d0e2f5e |
| 004 | T9 · Memory tools + ToolContext | mecanica | concluida | fb589b6 |
| 004 | T10 · Memory evals + CI db job | mecanica | concluida | 4e223b4 |
| 004 | C1 · Test db:migrate idempotence | mecanica | concluida | 855506c |
| 004 | Fechamento (gates 1–6, ⚠️ test:db 97 ok, ADR 0025, docs; sem push) | — | concluida | (este commit) |
