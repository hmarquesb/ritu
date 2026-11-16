# Entrega 2 · Estado

> Sem `git push` até a dona criar o repositório remoto (dona, 2026-11-15): só commits locais.
> A dona edita em paralelo `.docs/ROADMAP.md`, `.specs/README.md`, `AGENTS.md`, `.specs/016..019`, `design/` e arquivos de skill/agentes: não reverter nem commitar as edições dela; nos fechamentos, commitar só os trechos do orquestrador (`git add -p` ou conferir o diff).
> **Fluxo em ondas desde 2026-11-16** (dona; ADR 0038, `RULES.md` §3, skill §2): as ondas que faltam da 013 estão na seção "Ondas" do plano; da 014 em diante o plano já nasce com `depende de` e `## Ondas`. Edições da dona nesta mudança, para **não reverter** na retomada: `.adrs/0038-*.md`, `.adrs/README.md`, `.docs/RULES.md`, `.docs/QA.md`, `.docs/ROADMAP.md`, `AGENTS.md`, `.agents/skills/construir-entrega/SKILL.md`, `.claude/agents/*.md`. Não há resto de tarefa: T1 a T9 da 013 têm commit.
> `npm run lint` pelo rtk dá falso erro de JSON: usar `rtk bypass npm run lint`.
> `test:db` pendente: sem docker neste ambiente; `mudarStatusSe` no Postgres (009 T3) só conferido por leitura. Rodar onde houver Postgres antes do portão.
> Para o relatório (dona decide): "Não tenho" de alimento nunca registrado em Minha casa vira só falta `nao_tenho` (`marcarAcabou` não faz upsert, como a spec 009 manda); não aparece como `acabou` em Minha casa.
> Demo LLM da 009 (2026-11-15, `casa-incerta --llm --interativo`, respostas por pipe): o agente perguntou "Ainda tem abóbora e couve?" (casa, 2 itens); resposta Tenho abóbora · Não tenho couve; 1ª entrega recusada pelo validador, 2ª passou; status done, origem agente, 4 passos, 35.525 tokens (34.573 entrada, 952 saída), decisão gemini-3.5-flash-lite, apoio gemini-3.1-flash-lite, 0 trocas.
> Para o relatório (dona decide): as regras comuns dos planos proíbem abrir pastas fora do repositório, mas `.local/REFERENCIAS.md` §2 aponta para uma pasta fora dele; os implementadores não a abrem.
> Para o relatório: a métrica "chamadas antes da 1ª pausa" é só expectativa de caso do `eval:llm`, não linha do relatório; `QA.md` ainda cita 42 casos no `c2` (hoje 28) — acertar no fechamento da 014.
> Helpers do orquestrador ficam no scratchpad da sessão (somem entre sessões): recriar `commit_task.sh` e `stage_mine.py` quando precisar.
> Flake visto: `eval:det` falhou 1 de 498 sob carga (não identificado).
> Linhas de status de `AGENTS.md` (topo), `.docs/ROADMAP.md` §0 e `.specs/README.md` (Andamento) atualizadas pelo orquestrador na working tree, sobre edições da dona nas mesmas linhas: ficam sem commit até a dona commitar as dela (fechamento da 010).
> Demo LLM da 010 (2026-11-16, `aprovacao-parcial --llm --interativo`, `printf '2\n'`), duas rodadas: (1) o agente chamou `memoria.propor` (proposto) e o passo seguinte do modelo falhou com `indisponivel` (sem troca de modelo); run `failed`, origem segura, 10.563 tokens; (2) repetida com log temporário do erro (revertido): sem erro; `memoria.propor` proposto, mas `finalizar` não foi aceito até o limite, origem `segura`, então só a linha de casa chegou ao bloco ("Você tem abóbora em casa"), decisão Anotar 1 de 1, gravado abóbora em Minha casa; status done, 6 passos, 33.976 tokens (33.140 entrada, 836 saída). A proposta do agente se perde quando a saída é a segura (`finalizar` é quem recolhe). Para o checkpoint c2 (011): qualidade do `finalizar` com o prompt v4.
> Para o relatório: a base não tem item barrado por "vegetariana" (só "vegana" e "sem_gluten" em `restricoes`/`nunca_sugerir_se`); o cenário `vegetariana` (010 T15) prova só que a restrição do dia chega ao filtro. Os evals da 010 T18 usam "vegana".
> Para o relatório (dona decide): "não como" de nome livre aprovado vai para `perfis.nao_come` como `texto`, mas não filtra nada no dia seguinte (`montarFiltro` só usa os de alimento; a spec 010 só manda gravar).
> Lacuna de teste (011 T12, verificador): `ha_dias` sem teste com fuso diferente de UTC nem virada de dia local.
> Para o relatório (011 T14, verificador): em corrida entre toque e conversa depois da checagem de `pendentes`, `resultado.registrar` pode responder `registrado: true` sem ter somado (o contador não duplica; `registrarResultado` só soma com `mudou`).
> Lacunas de teste (011 T19, verificador, não bloqueiam): o caso de combinação da troca só confere o invariante (não falha se a checagem sair); falta um caso de troca em que um `anterior` seja o único candidato; "Tenho" na troca não confere a origem `pergunta` em casa.
> Lacunas (011 T20, verificador, não bloqueiam): o eval de privacidade não olha `telemetry.eventos`; `ha_dias` com fuso continua sem teste (não coube nos arquivos da T20).
> Para o relatório (011 D9): "Não tenho" de alimento nunca registrado grava só a falta; num toque seguinte ele pode ser perguntado de novo.
> Para o relatório (011 D10): a concorrência dos toques (trava da linha do run) só se prova no Postgres; soma à pendência de `test:db`.
> Checkpoint `c2-conversa` (2026-11-16, para o relatório): rodada completa com 22 erros de ambiente (intérprete usava o registro de uso do Postgres; c1-08/c1-11 pausavam e o runner não respondia), corrigidos na 011 C1 (ffa5c57) e repetidos com `--casos` (`c2-conversa-parcial.md`). Juntas: intenção 18/20 (2 com tempo esgotado de 15 s, c2-02 e c2-15), 0 falsos alertas; perguntas 2/2 e 3/3; propostas 2/4; aprendizado 3/5; para ter 2/3; deve 23/34, não pode 33/34, trajetória 30/34, válida na 1ª 5/34, corrigiu 24/27 (3 terminaram sem corrigir), 0 trocas de modelo. A causa do erro de c1-11 foi confirmada pela repetição (passou a rodar com a pausa respondida).

> Para o relatório (012 D4): com a regra da spec, quem conversa sempre com os mesmos dois estados recebe primeiro "andam juntos" antes de "o que ajuda"; os históricos dos cenários ganharam dias soltos para isso não acontecer.
> Para o relatório (012 D1/D14): `montarFiltro` foi para `src/core/filtro-da-pessoa.ts`; o juiz do caso 5 do `c3` usa instruções escritas no plano, não na spec.
> Para o relatório (012 D17): o fim de um run sem pausa monta o filtro do dia pelas portas (perfil, lista do dia, preferências), sem os itens só da mensagem.
> Para o relatório, dona decide (012 D18): `agitada` evita a guna `movel` do chá de gengibre com canela; um padrão "com frio e agitada → chá" pode ser confirmado pelo histórico, mas com `agitada` o chá nunca é candidato.
> Para o relatório, dona decide (012 D19): a casa não tira prática dos candidatos (chá cuja especiaria acabou só perde nota).
> `test:db` e `npm run padroes` da 012 não rodaram (sem docker): somam à pendência de `test:db`.

> Lacuna (013 T1, verificador): o fake `createMemoryTelemetry` valida só os atributos, não o nome de métrica; os planos dizem que ele "falha com nome fora da lista". Quem trava os nomes é o teste de `METRICAS`.
> Flake (013 T9, verificador): `eval:det` teve 6 falhas em 6 arquivos numa rodada sob carga, sem reprodução nas 3 seguintes (873/873).
> Para o relatório (013 D7): com modelo real, o tempo acumulado do run pode fazer a nova tentativa do Juiz cair em `limite:tempo` (resposta segura); olhar na rodada do `c3-confiavel`.
> Para o relatório (013 D14): o cenário `alerta-emocional` mudou de frase ("ando sem vontade de nada, pra que continuar?"), porque a antiga passou a ser barrada por código.
> Para o relatório (013 D5): a nova tentativa do Juiz roda sem `ask_user`.
> Para o relatório (013 D17): `ritu_juiz_total` não foi criado (a spec não pedia).
> Para o relatório, dona decide (013): a regra 2 diz "toda resposta passa pelo Juiz"; os textos montados por código (caminhos sem agente, `sem_modelo`, resposta segura) ficam fora, como a spec manda.
> Para o relatório (013 T18, verificador): a expressão de promessa do `c3` pega "trata" em "se trata de" e não ignora "promete curar"; pode dar falso resultado na rodada.
> Para o relatório (013 C2): evals determinísticos com `testTimeout` de 30 s; sob carga alta (load > 160, testes de outra pasta em paralelo) o `npm test` ainda dá timeout de 20 s em casos que mudam a cada rodada, sem falha de asserção.
> `test:db` da 013 não rodou (sem docker): soma à pendência do topo.
> Fechamento da 013 (2026-11-16, sessão anterior, log trazido pela dona): lint, typecheck, `npm test` 2246/2246, `eval:det` 1040/1040, `dup` 0 clones, lista do `demo` com código 0. Build, os 38 cenários do `demo` e o E2E rodam no verificador depois da junção da 016.
> **Junção antecipada da 016 (dona, 2026-11-16):** a branch `entrega-3` (016 `implemented`) foi juntada na `main` antes do portão 2, para destravar a 017 na trilha adiantada (exceção ao §0.6 da skill). A ADR 0039 da 016 virou 0040 (a 0039 da `main` é a do Juiz).
> Verificador depois da junção (a0e68e4, 2026-11-16): APROVADO. lint, typecheck, build, dup 0, `eval:det` 1040/1040, `npm test` 2431/2431 na 2ª rodada (1ª: 1 falha sob carga, caso não identificado), E2E `CI=1` 47 passaram e 9 puladas (não investigadas), 38 cenários do `demo` com código 0 (`frio-agitada` falhou 1 vez sob carga e passou 6 de 6 depois), listas `c2` 54 e `c3` 84. **Docker disponível:** `db:migrate` nada a aplicar, ⚠️ `test:db` 120/120 (resolve a pendência de `test:db` da 009 a 013), `npm run padroes` código 0 (banco vazio).
> Planos da 014 (20 tarefas, 9 ondas) e da 015 (20 tarefas, 8 ondas) escritos por subagente Opus; decisões D1–D21 (014) e D1–D15 (015) nas seções "Decisões do planejamento" de cada plano. Para o relatório (dona decide): 014 D4 tira o `--casos` do `eval:llm` (a tabela da spec não o tem); 015 D4: com o relógio fixo dos cenários, as latências do painel no `c3` saem 0; 015: runs fechados por `mudarStatus` não entram em `ritu_run_passos`; `ritu_juiz_total` falta na tabela de `OBSERVABILITY.md` (fechamento da 015).

| Spec | Tarefa | Nível | Status | Commit |
|---|---|---|---|---|
| 002 | C13-T1 · Add the explicit food list to preparation slots | mecanica | concluida | 47631ee |
| 002 | C13-T2 · Restrict slot foods in the preparations | conteudo | concluida | 2cddf81 |
| 002 | C13-T3 · Add the slot eval | mecanica | concluida | db5d22f |
| 008 | T1 · Add the conversation config, the interpreter output schema and the shared text helpers | mecanica | concluida | 9e78ec1 |
| 008 | T2 · Add the interpretation normalization | mecanica | concluida | ea09dc6 |
| 008 | T3 · Add the path choice | mecanica | concluida | 1f0f492 |
| 008 | T4 · Add the message text, the prompt selection and the day's conversation reader | mecanica | concluida | 771f1fb |
| 008 | T5 · Add the interpreter prompt v1 and its input builder | mecanica | concluida | c2d94c8 |
| 008 | T6 · Add the fixed texts and the text builders | mecanica | concluida | 7a490c1 |
| 008 | T7 · Add the notes and the code-made output to the companion output | mecanica | concluida | bf32d6d |
| 008 | T8 · Let the day's temporary list hold restrictions and "não como" | mecanica | concluida | 2239f18 |
| 008 | T9 · Add registrarResultado | nucleo | concluida | dcafb44 |
| 008 | T10 · Add the interpreter | nucleo | concluida | d0234e6 |
| 008 | T11 · Let preparar and casa.ler use what the message says | nucleo | concluida | 3d37150 |
| 008 | T12 · Add the companion prompt v2 | mecanica | concluida | f5c7de0 |
| 008 | T13 · Let the run service open the run span for a whole run, and responder reuse a created run | nucleo | concluida | ed3e8fb |
| 008 | T14 · Add the conversar service and wire it in the container | nucleo | concluida | 5584a12 |
| 008 | T15 · Add the seven conversation scenarios | mecanica | concluida | a85e22f |
| 008 | T16 · Run messages through conversar in the demo and show what was understood | mecanica | concluida | e49eed5 |
| 008 | T17 · Add the conversation deterministic evals, part 1 | mecanica | concluida | ad5ee43 |
| 008 | T18 · Add the conversation deterministic evals, part 2 | mecanica | concluida | 7673a7c |
| 008 | T19 · Generalize the eval:llm runner to any checkpoint | mecanica | concluida | 7c538e3 |
| 008 | T20 · Add the 20 intent cases of c2 | mecanica | concluida | c70b343 |
| 008 | L1 · Move the profile checks shared by conversation/textos.ts and companion/anotacoes.ts to accounts | mecanica | concluida | d7f758e |
| 008 | L2 · registrarResultado: contar só quando o update condicional de responder mudou o retorno (evita contar duas vezes em chamadas concorrentes) — avaliar na 011 | nucleo | absorvida na 011 T3 | |
| 008 | L3 · Neutralize the message's house names and the return title before the prompt | mecanica | concluida | d88e4a9 |
| 009 | T1 · Add the pauses config | mecanica | concluida | 2bf9f65 |
| 009 | T2 · Add the question and answer types, texts and builders | mecanica | concluida | 4b8cdc5 |
| 009 | T3 · Add the conditional status change, the code pause and the pause summary to runs | nucleo | concluida | 32fdbb3 |
| 009 | T4 · Let meals with an askable ingredient reach the model | mecanica | concluida | 6cc8bbf |
| 009 | T5 · Add aplicarResposta, the pending content and the "não como" note | mecanica | concluida | cd84b5d |
| 009 | T6 · Add gravarResposta | nucleo | concluida | 505c0df |
| 009 | T7 · Add the ask_user control tool | nucleo | concluida | e897ea6 |
| 009 | T8 · Add the companion prompt v3 and give ask_user to the companion | mecanica | concluida | 19847ae |
| 009 | T9 · Let the companion pause and continue | nucleo | concluida | adb3c67 |
| 009 | T10 · Pause conversar for a variant and for the agent's question | nucleo | concluida | e447f97 |
| 009 | T11 · Add the continuar service | nucleo | concluida | 013af13 |
| 009 | T12 · Add the four pause scenarios | mecanica | concluida | f98a6e9 |
| 009 | T13 · Show pauses in the demo and add the interactive mode | mecanica | concluida | 62c517a |
| 009 | T14 · Add the pauses deterministic evals, part 1 | mecanica | concluida | 6e7d689 |
| 009 | T15 · Add the pauses deterministic evals, part 2 | mecanica | concluida | 37b9368 |
| 009 | T16 · Add the pauses deterministic evals, part 3 | mecanica | concluida | 7ea12a1 |
| 009 | T17 · Let eval:llm conversation cases answer pauses and measure questions | mecanica | concluida | 89e47a4 |
| 009 | T18 · Add the 8 question cases of c2 | mecanica | concluida | 2a8fecf |
| 009 | L1 · Test the invalid pause branch of the run end | mecanica | concluida | 94aa69b |
| 010 | T1 · Add the approval config | mecanica | concluida | 72b1631 |
| 010 | T2 · Add the proposal content types and move the notes type to proposals | mecanica | concluida | ab3dbca |
| 010 | T3 · Add the proposal line texts | mecanica | concluida | f2c92a6 |
| 010 | T4 · Add propostasDoAgente and montarPropostas | mecanica | concluida | d164f6c |
| 010 | T5 · Let the day's temporary list hold free-text won't-eat items and record "Não como" answers | mecanica | concluida | 40055e0 |
| 010 | T6 · Add the run data the proposal tools read | mecanica | concluida | 0e302de |
| 010 | T7 · Add the proposal tools | mecanica | concluida | 5619492 |
| 010 | T8 · Add propostas to the companion output | mecanica | concluida | 0ab99c3 |
| 010 | T9 · Let finalizar collect the agent's proposals | nucleo | concluida | 541d01f |
| 010 | T10 · Add the companion prompt v4 and give the proposal tools to the companion | mecanica | concluida | 66bf21e |
| 010 | T11 · Let the companion keep the run open and let the run service pause for approval | nucleo | concluida | 4b9e988 |
| 010 | T12 · Add the proposal executor | nucleo | concluida | b1d48d9 |
| 010 | T13 · End conversation runs with the approval block | nucleo | concluida | 9dff186 |
| 010 | T14 · Add the aprovar service | nucleo | concluida | 21b9dcf |
| 010 | T15 · Add the approval scenarios | mecanica | concluida | 17257c2 |
| 010 | T16 · Show the approval block in the demo | mecanica | concluida | c3f38a7 |
| 010 | T17 · Add the approval deterministic evals, part 1 | mecanica | concluida | a55920b |
| 010 | T18 · Add the approval deterministic evals, part 2 | mecanica | concluida | 4a36fe7 |
| 010 | T19 · Add the approval deterministic evals, part 3 | mecanica | concluida | fc519aa |
| 010 | T20 · Let eval:llm conversation cases measure proposals | mecanica | concluida | 098c7ca |
| 010 | T21 · Add the 6 proposal cases of c2 | mecanica | concluida | 6ad518f |
| 011 | T1 · Add the touches config, the touch texts and the touch span | mecanica | concluida | 9ce73f1 |
| 011 | T2 · Add atualizarSugestao to the outcome store | mecanica | concluida | cf6199b |
| 011 | T3 · Count a return only when the conditional update changed it | nucleo | concluida | a4786cf |
| 011 | T4 · Add retorno_id and troca to the companion output, and sugestaoRegistrada | mecanica | concluida | b552685 |
| 011 | T5 · Record the delivery from the companion | nucleo | concluida | 62ca250 |
| 011 | T6 · Export the house and signals helpers for the touches | mecanica | concluida | f85d244 |
| 011 | T7 · Add tocarRetorno and tocarGosto | mecanica | concluida | 730d3b5 |
| 011 | T8 · Add trocarIngrediente and responderTroca | nucleo | concluida | cad23b2 |
| 011 | T9 · Wire the touches in the container | mecanica | concluida | 0631e29 |
| 011 | T10 · Add propostaDoParaTer and pass it to the run end | mecanica | concluida | 3d7e560 |
| 011 | T11 · Let a like written in the message count in the run | nucleo | concluida | 2ae20db |
| 011 | T12 · Add the pending returns to the run data, the model context and ctx.run | nucleo | concluida | a32b260 |
| 011 | T13 · Add the companion prompt v5 | mecanica | concluida | 14fc6ab |
| 011 | T14 · Add the resultado.registrar tool and give it and v5 to the companion | nucleo | concluida | f54ef4a |
| 011 | T15 · Let scenarios run touches | mecanica | concluida | d0162f6 |
| 011 | T16 · Add the six learning scenarios | mecanica | concluida | b8dce95 |
| 011 | T17 · Show returns, recorded items and touches in the demo | mecanica | concluida | 5faa5d8 |
| 011 | T18 · Add the learning deterministic evals, part 1 | mecanica | concluida | b33ef02 |
| 011 | T19 · Add the learning deterministic evals, part 2 | mecanica | concluida | 908cbb4 |
| 011 | T20 · Add the learning deterministic evals, part 3 | mecanica | concluida | 89dd026 |
| 011 | T21 · Let eval:llm conversation cases measure learning and para-ter | mecanica | concluida | 8b092b1 |
| 011 | T22 · Add the 8 learning cases of c2 | mecanica | concluida | f770592 |
| 011 | C1 · Let eval:llm run without Postgres and rerun selected cases | nucleo | concluida | ffa5c57 |
| 012 | T1 · Add the patterns config, the telemetry names and the memoria step type | mecanica | concluida | 83136a6 |
| 012 | T2 · Export contemIncomodo and refuse a 31st routine note in memoria.propor | mecanica | concluida | 16a7bda |
| 012 | T3 · Add respondidosDesde, contasComRunDesde and porTool to the stores | mecanica | concluida | f7905b2 |
| 012 | T4 · Add the memory agent output, input, code summary and prompt memoria.v1 | mecanica | concluida | 12cabc4 |
| 012 | T5 · Add the memory agent and atualizarResumo | nucleo | concluida | 2da8411 |
| 012 | T6 · Add apagarNota and corrigirNota | mecanica | concluida | aa12f99 |
| 012 | T7 · Add the pattern key and sentence builders | mecanica | concluida | 9593f62 |
| 012 | T8 · Add the pure pattern detections | mecanica | concluida | 0176fa6 |
| 012 | T9 · Move the person filter to a loose core file | mecanica | concluida | 1a409df |
| 012 | T10 · Add padraoVale and filter confirmed patterns in the preparation | mecanica | concluida | d3601e9 |
| 012 | T11 · Add the daily pattern detection job | nucleo | concluida | ed67e82 |
| 012 | T12 · Add decidirPadrao and apagarPadrao | mecanica | concluida | d2694c4 |
| 012 | T13 · Add the padrao.confirmar proposal and the routine cap in the executor | mecanica | concluida | 9f01ba5 |
| 012 | T14 · Offer one candidate pattern at the end of the companion run | nucleo | concluida | da8157d |
| 012 | T15 · Decide patterns and refresh the routine summary on approval | nucleo | concluida | a86549b |
| 012 | T16 · Add the companion prompt v6 | mecanica | concluida | 97efcd4 |
| 012 | T17 · Wire routine and patterns in the container and add npm run padroes | mecanica | concluida | 9d1e6cf |
| 012 | T18 · Let scenarios seed routine notes, history and patterns | mecanica | concluida | a258f56 |
| 012 | T19 · Add the six routine and pattern scenarios | mecanica | concluida | 1359b6a |
| 012 | T20 · Show the routine summary and the patterns in the demo | mecanica | concluida | 5aedfa4 |
| 012 | T21 · Add the routine and patterns deterministic evals, part 1 | mecanica | concluida | fefd452 |
| 012 | T22 · Add the routine and patterns deterministic evals, part 2 | mecanica | concluida | e45c6f5 |
| 012 | T23 · Add the routine and patterns deterministic evals, part 3 | mecanica | concluida | c2d4939 |
| 012 | T24 · Add the routine and patterns deterministic evals, part 4 | mecanica | concluida | 3f92f5f |
| 012 | T25 · Let eval:llm run memory cases and add the c3-confiavel checkpoint | mecanica | concluida | ec17be5 |
| 012 | T26 · Add the 8 memory cases of c3 | mecanica | concluida | af3d544 |
| 013 | T1 · Add the judge config and the guardrail and judge metric names | mecanica | concluida | 7b9f105 |
| 013 | T2 · Add the input guardrail patterns and conferirEntrada | mecanica | concluida | fd956bc |
| 013 | T3 · Add the dosage check to the validator | mecanica | concluida | 866b736 |
| 013 | T4 · Add the judge output, the retry message and the prompt juiz.v1 | mecanica | concluida | 141f62c |
| 013 | T5 · Add the judge input builders | mecanica | concluida | 13aed81 |
| 013 | T6 · Add the judge agent | nucleo | concluida | 4db52d2 |
| 013 | T7 · Return the trecho state, add extra model calls and neutralize tool results in the request | nucleo | concluida | dbf3ae8 |
| 013 | T8 · Add the judge step of the companion run | nucleo | concluida | bc66687 |
| 013 | T9 · Add the judge to the container and the scripted judge to scenarios | mecanica | concluida | b662ffa |
| 013 | T10 · Run the judge in responder and continuar | nucleo | concluida | 8735a45 |
| 013 | T11 · Add the input guardrail step to conversar | nucleo | concluida | 8df0b0a |
| 013 | T12 · Add the seven guardrail and judge scenarios | mecanica | concluida | 5db16ae |
| 013 | T13 · Show the judge in the demo and list the new scenarios | mecanica | concluida | 367eafa |
| 013 | T14 · Add the guardrail deterministic evals, part 1 | mecanica | concluida | 8c50f57 |
| 013 | T15 · Add the guardrail deterministic evals, part 2 | mecanica | concluida | 6d11319 |
| 013 | T16 · Add the guardrail deterministic evals, part 3 | mecanica | concluida | aeaeb67 |
| 013 | T17 · Let eval:llm run judge cases and measure the safety families | mecanica | concluida | 09966da |
| 013 | T18 · Add the 22 judge and safety cases of c3 | mecanica | concluida | 7f0a5bf |
| 013 | C1 · Remove the clone between interpretar.ts and julgar.ts (npm run dup) | mecanica | concluida | cd1196f |
| 013 | C2 · Raise the eval timeout, share the judge reasons reader and keep judge cases out of the response metrics | mecanica | concluida | d2d75cc |
| 014 | T1 · Add the evals config | mecanica | pendente | |
| 014 | T2 · Add the case families, marks and criteria types | mecanica | pendente | |
| 014 | T3 · Mark the 84 cases with type, families and marks | mecanica | pendente | |
| 014 | T4 · Add the case result types | mecanica | pendente | |
| 014 | T5 · Add the metrics and the targets | mecanica | pendente | |
| 014 | T6 · Add the round loop and the saved progress | mecanica | pendente | |
| 014 | T7 · Add the eval grader | mecanica | pendente | |
| 014 | T8 · Add the history and the generated comparison | mecanica | pendente | |
| 014 | T9 · Add the round report and the local failures file | mecanica | pendente | |
| 014 | T10 · Replace word checks by grader criteria in 15 cases | mecanica | pendente | |
| 014 | T11 · Add the shared run collectors | mecanica | pendente | |
| 014 | T12 · Add the run case runners (companion and conversation) | mecanica | pendente | |
| 014 | T13 · Add the support case runners (interpreter, memory, judge) | mecanica | pendente | |
| 014 | T14 · Add the case listing, the call estimate and the dispatcher with the grader | mecanica | pendente | |
| 014 | T15 · Rewrite the eval:llm command on the new runner | mecanica | pendente | |
| 014 | T16 · Remove the old runner and the old case fields | mecanica | pendente | |
| 014 | T17 · Transcribe c1-base and c2-conversa to the history and generate the comparison | mecanica | pendente | |
| 014 | T18 · Add the deterministic eval map | mecanica | pendente | |
| 014 | T19 · Add the LLM case registry eval | mecanica | pendente | |
| 014 | T20 · Add the evals CI job with the per-group summary | mecanica | pendente | |
| 015 | T1 · Rewrite the telemetry names as typed registries and add the telemetry config | mecanica | pendente | |
| 015 | T2 · Return the previous vote from votar | mecanica | pendente | |
| 015 | T3 · Type the telemetry port by metric kind, propagate run.id to logs and enforce declared labels | nucleo | pendente | |
| 015 | T4 · Measure each run segment and close the run with steps and logs | nucleo | pendente | |
| 015 | T5 · Mark cache hits and log weather outages in the weather cache | mecanica | pendente | |
| 015 | T6 · Measure model and tool latency, and log model swaps, missing models and model errors | nucleo | pendente | |
| 015 | T7 · Count judge verdicts, log safe answers and tag the run span with the chosen path | mecanica | pendente | |
| 015 | T8 · Add the vote touch | mecanica | pendente | |
| 015 | T9 · Add the dashboard and alert definitions | mecanica | pendente | |
| 015 | T10 · Add the Grafana dashboard and alert generators | mecanica | pendente | |
| 015 | T11 · Add the painel:check library | mecanica | pendente | |
| 015 | T12 · Add painel:gerar and painel:check, generate the dashboard files and lock them | mecanica | pendente | |
| 015 | T13 · Build the OTel exporter options and turn on metrics and logs in Next | nucleo | pendente | |
| 015 | T14 · Add the telemetry mirror for scenarios | nucleo | pendente | |
| 015 | T15 · Add the vote eval | mecanica | pendente | |
| 015 | T16 · Turn on OTel in demo and eval:llm | mecanica | pendente | |
| 015 | T17 · Provision the dashboard and alerts in the local LGTM | mecanica | pendente | |
| 015 | T18 · Test privacy through the real OTel adapter and the Mastra runtime | nucleo | pendente | |
| 015 | T19 · Add the telemetry coverage eval | mecanica | pendente | |
| 015 | T20 · Replace the companion privacy eval by the full one and map the new evals | mecanica | pendente | |
