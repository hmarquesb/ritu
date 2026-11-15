# Entrega 2 · Estado

> Sem `git push` até a dona criar o repositório remoto (dona, 2026-11-15): só commits locais.
> A dona edita em paralelo `.docs/ROADMAP.md`, `.specs/README.md`, `AGENTS.md`, `.specs/016..019`, `design/` e arquivos de skill/agentes: não reverter nem commitar as edições dela; nos fechamentos, commitar só os trechos do orquestrador (`git add -p` ou conferir o diff).
> `npm run lint` pelo rtk dá falso erro de JSON: usar `rtk bypass npm run lint`.
> `test:db` pendente: sem docker neste ambiente; `mudarStatusSe` no Postgres (009 T3) só conferido por leitura. Rodar onde houver Postgres antes do portão.
> Para o relatório (dona decide): "Não tenho" de alimento nunca registrado em Minha casa vira só falta `nao_tenho` (`marcarAcabou` não faz upsert, como a spec 009 manda); não aparece como `acabou` em Minha casa.
> Demo LLM da 009 (2026-11-15, `casa-incerta --llm --interativo`, respostas por pipe): o agente perguntou "Ainda tem abóbora e couve?" (casa, 2 itens); resposta Tenho abóbora · Não tenho couve; 1ª entrega recusada pelo validador, 2ª passou; status done, origem agente, 4 passos, 35.525 tokens (34.573 entrada, 952 saída), decisão gemini-3.5-flash-lite, apoio gemini-3.1-flash-lite, 0 trocas.
> Flake visto: `eval:det` falhou 1 de 498 sob carga (não identificado).

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
| 008 | L2 · registrarResultado: contar só quando o update condicional de responder mudou o retorno (evita contar duas vezes em chamadas concorrentes) — avaliar na 011 | nucleo | adiada para a 011 | |
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
