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

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 005 | T1 · Loop config, ports, checkpoint, states | mecanica | concluida | a27a924 |
| 005 | T2 · Telemetry port, names, memory/null | mecanica | concluida | 55fe073 |
| 005 | T3 · Scripted runtime and fixed model | mecanica | concluida | 0becb27 |
| 005 | T4 · Agent loop | nucleo | concluida | f7b2c67 |
| 005 | T5 · Run service | nucleo | concluida | dc07700 |
| 005 | T6 · OTel adapter, instrumentation, container telemetry | nucleo | concluida | 5387e4f |
| 005 | T7 · Mastra runtime, container runtime/runs, runtime:real | nucleo | concluida | d74f24e |
| 005 | T8 · loop:demo and loop evals | mecanica | concluida | 63371fd |
| 005 | C1 · definirTool forwards resumir | mecanica | concluida | e52714c |
| 005 | C2 · Start OTel node SDK for scripts | nucleo | concluida | 3a9ea65 |
| 005 | Fechamento (gates 1–6, test:db, Grafana ok, ⚠️ runtime:real, ADR 0005; sem push) | — | concluida | (este commit) |

> 005 · ⚠️ `runtime:real gemini-3.5-flash-lite` (2026-11-15): o modelo pediu `hora_atual` com `{}`; 42 tokens de entrada, 10 de saída. Antes disso, `gemini-2.5-flash` devolveu `APICallError` 4xx (modelo provavelmente fora de linha): a 006 deve conferir a lista de modelos de `AI.md` §10 antes de fixá-la. Diagnóstico com 2 chamadas extras (`gemini-3.5-flash-lite` e `gemini-3-flash-preview`, ambas ok).
> 005 · Primeira conferência do `loop:demo` no LGTM: nenhum trace chegou ao Tempo, porque nenhum script ligava o SDK do Node. Correção C2.
> 005 · LGTM (2026-11-15): com `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` explícito, o `loop:demo` gerou o trace `ad1c2e6c…` no Tempo: 14 spans (2 `run`, o inicial e o retomado no mesmo trace; 4 `agente.passo`; 4 `llm.chamada`; 4 `tool.chamada`), o evento `pausa` e só atributos permitidos. Com o valor do `.env.local` (que não foi lido), nada chegou: **a dona deve conferir se ele aponta para `http://localhost:4318`** (OTLP por HTTP), e não para a porta 4317 (gRPC).

> Retomada (2026-11-15): sem `git push` (dona, 2026-11-15): só commits locais, até ela liberar o push.

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 006 | T1 · Quota config, windows, ports, R10 | mecanica | concluida | 55bd4f3 |
| 006 | T2 · Memory ledger + contract | nucleo | concluida | 959695c |
| 006 | T3 · llm_uso migration + Pg ledger | nucleo | concluida | 8d4a100 |
| 006 | T4 · Model router | nucleo | concluida | e68e9dd |
| 006 | T5 · Fake LLM | mecanica | concluida | 4bc52f6 |
| 006 | T6 · chamarComPapel | nucleo | concluida | a40d6da |
| 006 | T7 · Gemini client + container | nucleo | concluida | 793f3fb |
| 006 | T8 · No-model response | mecanica | concluida | a103397 |
| 006 | T9 · Cleanup llm_uso | mecanica | concluida | 51e8906 |
| 006 | T10 · cotas and modelos:check | mecanica | concluida | 319fd17 |
| 006 | T11 · Model evals | mecanica | concluida | 2430770 |
| 006 | Fechamento (gates 1–6, test:db, ⚠️ modelos:check, ADR 0026, docs; sem push) | — | concluida | (este commit) |

> 006 · ⚠️ `modelos:check` (2026-11-15): 3.5 Flash Lite, 3.1 Flash Lite e 3.6 Flash ok; 2.5 Flash Lite, 3 Flash e 2.5 Flash `indisponivel`; 3.8 Flash `timeout`. Registrado em `BLOQUEIOS.md`.
> 006 · T10: o implementador incluiu `cat .env.local` num comando de leitura; o classificador negou e o arquivo não foi lido. Vai para o relatório da entrega.

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 007 | T1 · Add ranking and response config, the companion input schema and fixed texts | mecanica | concluida | 5f3179b |
| 007 | T2 · Add telemetry to ToolContext and resumir to the read tools | mecanica | concluida | bed70d0 |
| 007 | T3 · Add placeholder filling for preparation titles and steps | mecanica | concluida | 9aea31a |
| 007 | T4 · Add the person filter builder | mecanica | concluida | cf05941 |
| 007 | T5 · Add candidate building and ordering | mecanica | concluida | 7671601 |
| 007 | T6 · Add shortages of the run and the worth-having pick | mecanica | concluida | da6ff11 |
| 007 | T7 · Add preparar | nucleo | concluida | e294fba |
| 007 | T8 · Add the companion prompt v1 and the initial message | nucleo | concluida | 7724a15 |
| 007 | T9 · Add the delivery validator | nucleo | concluida | 517671f |
| 007 | T10 · Add the companion output and its completion | nucleo | concluida | 58c1aaa |
| 007 | T11 · Add the finalizar tool and the companion agent definition | nucleo | concluida | ff280f4 |
| 007 | T12 · Add the responder service and wire companion in the container | nucleo | concluida | 8c0516f |
| 007 | C2 · Test the companion getter and its override in the container | mecanica | concluida | 4672209 |
| 007 | C3 · Tighten three c1 expectations | mecanica | concluida | f3e1ebe |
| 007 | C4 · Fix the real-LLM run of frio-agitada (tool name, finalizar refused) | nucleo | concluida | 4b3e014 |
| 007 | C5 · Keep unfillable meals out of the model's candidates | nucleo | concluida | e0b585b |
| 007 | T13 · Add the demo scenarios | mecanica | concluida | f23219e |
| 007 | T14 · Add the demo script and its report | mecanica | concluida | a8c17c3 |
| 007 | T15 · Add the companion deterministic evals, part 1 | mecanica | concluida | a2024f4 |
| 007 | T16 · Add the companion deterministic evals, part 2 | mecanica | concluida | bd400aa |
| 007 | T17 · Add the minimal eval:llm runner and the 12 c1 cases | nucleo | concluida | 73c1495 |
| 007 | C1 · Keep optional placeholders removable in the preparation texts | conteudo | concluida | 4cc3dbf |
> 007 · C1: 23 `passos` de `data/preparos.yaml` reescritos (só redação; cada vaga opcional numa frase própria). Para o portão: kitchari, leguminosa-cozida e arroz-com-leguminosa passaram a temperar "numa panelinha à parte"; sopa, sopa-creme, caldo, arroz-papa, raiz-cozida, mingau e ovo-mexido ganharam "aquecer {gordura}" como passo próprio.

> 007 · Fechamento: gates 1–6 verdes (916 testes, 366 evals det, dup 0, e2e 2, ⚠️ test:db 106). ⚠️ `demo --llm frio-agitada` (2026-11-15): `done`/`segura`/`limite:validacao`; o modelo chamou `ayurveda_checar_combinacao` (recusado) e `finalizar` foi recusado 3 vezes; 34 985 tokens. Abre C4.
> 007 · C4/C5 (2026-11-15): causas do `demo --llm`: (1) o Mastra 1.83 troca `.` por `_` no nome das tools e não destroca; (2) o modelo errava formatos que o contrato não dizia; (3) o preparo oferecia refeição com vaga obrigatória sem opção em casa, que nenhuma entrega válida podia usar. Depois de C5: ⚠️ `demo --llm frio-agitada` → `done`/`agente`, 1 recusa e autocorreção, 3 passos, 25 196 tokens, trace `f2493135…`; com `--esgotar decisao` → troca para `gemini-3.1-flash-lite` (1 troca), `done`/`agente` na 1ª, 2 passos, 16 152 tokens, trace `197043f3…`. Chamadas reais na depuração: ~30. Para o portão: o modo de fazer diz "abóbora picado" (concordância da lacuna `{legume} picado`).
| 007 | Fechamento (gates 1–6, ⚠️ test:db 106, ⚠️ demo --llm, ADR 0027, AI.md, AGENTS.md; sem push) | — | concluida | (este commit) |

| Entrega | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 1 | C6 · eval:llm runner keeps going and always writes the report | nucleo | concluida | 2bf435e |
> Entrega 1 · ⚠️ `eval:llm c1-base` (2026-11-15), 1ª tentativa: casos 1–4 ok; no caso 5 um `LlmError` `timeout` derrubou o runner sem gravar o relatório (~20 chamadas gastas). Abre C6; a rodada é refeita inteira no mesmo dia (a 1ª não produziu resultado).
> Entrega 1 · ⚠️ `eval:llm c1-base` refeito (2026-11-15): 12/12 casos; deve 83%, não pode 100%, trajetória 67%, válida na 1ª 17%, corrigiu 100%, explicação 73% (1 não avaliada). Gates finais: 933 testes, 367 evals det, 106 test:db, e2e 2/2, dup 0, build ok, base:check ok.
| 1 | Fechamento da entrega (gates, c1-base, relatório, ROADMAP §0, tag `entrega-1`; sem push) | — | concluida | (este commit) |
