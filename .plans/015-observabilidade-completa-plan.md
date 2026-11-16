# Plano · Spec 015 · Observabilidade completa

Spec: `.specs/015-observabilidade-completa.md`. Nível (seção "Nível das partes" da spec): `nucleo` para a porta `Telemetry` e os três adaptadores (propagação de `run.id`, buckets, `atribuirAoSpanAtual`), as medições no serviço de runs, no loop e no roteador, `opcoes.ts` e `instrumentation.ts`, o espelho de telemetria dos cenários e `src/infra/otel/privacidade.test.ts` (com a skill `mastra`); `mecanica` para o resto: `nomes.ts`, `config/telemetria.ts`, `tocarVoto` e a porta `votar`, os emissores simples, a definição e o gerador do painel, `painel:check`, `docker-compose.yml`, os scripts e os evals.

Pré-condição: a spec 014 inteira commitada (T1 a T20 do `.plans/014-evals-plan.md`), com os nomes que aquele plano define: `scripts/lib/evals/` (`comando.ts` com `executarComando(args, io)`, `rodar-run.ts` com `rodarAcompanhante`/`rodarConversa`, `rodar-apoio.ts` com `rodarInterprete`/`rodarMemoria`/`rodarJuiz`, `avaliador.ts` com `DepsDoAvaliador` e `avaliar`), `scripts/eval-llm.ts` só montando o `io`, `evals/det/mapa.ts` (`LinhaDoMapa`, `mapa`) travado por `evals/det/mapa.eval.ts` (toda entrada com `desde ≤ 2` tem arquivo que existe; todo `evals/det/**/*.eval.ts` aparece no mapa).

Ficam com o orquestrador, no fechamento: docs, `AGENTS.md`, a ADR, a marcação da spec, o print do painel. Esta spec **não** roda LLM: a rodada ⚠️ do `c3-confiavel` com o OTLP ligado é o fechamento da entrega 2, logo depois dela.

## Regras comuns a todas as tarefas

- **Contratos:** estão copiados em cada tarefa. Nomes de spans, métricas, rótulos, atributos, códigos de log, tipos, funções e erros ficam **exatamente** como escritos, em português; o resto do código fica em inglês. As consultas do painel e as expressões dos alertas são copiadas sem mudar um caractere (salvo o que a tarefa manda conferir na imagem). Quem recebe a tarefa não precisa abrir a spec.
- **Já existe e não se refaz** (005 a 013): a porta `Telemetry` e os três adaptadores, a lista fechada de nomes, os spans `run`, `guardrail.entrada`, `interprete`, `preparo`, `agente.passo`, `llm.chamada`, `tool.chamada`, `validacao`, `juiz`, `aprovacao.execucao`, `toque`, `memoria.resumo`, `padroes.deteccao`, e quase todas as métricas; o `trace_id` guardado no run e a continuação pelo `traceparent`; `OPCOES_DE_TRACE = { hideInput: true, hideOutput: true }` no adaptador da Mastra (não muda).
- **Onde está o que já existe** (confira a assinatura real antes de usar; não redefina):
  - Nomes: `src/core/telemetry/nomes.ts` hoje tem `SPANS` e `METRICAS` como **listas** (`as const`), `NomeDeSpan`, `NomeDeMetrica`, `ATRIBUTOS_PERMITIDOS` (já com `resumo.origem`, `padroes.contas`, `padroes.propostos`, `cache.hit`, `pausa.tipo`, os rótulos `caminho`, `status`, `intencao`, `modelo`, `papel`, `direcao`, `janela`, `de`, `para`, `motivo`, `tool`, `violacao`, `tipo`, `decisao`, `codigo`, `voto`, `resultado`, `origem`, `gosto`, `etapa`, e `erro.codigo`, `trace_id`), `AtributoPermitido`, `MAX_TEXTO_ATRIBUTO = 64`; teste em `nomes.test.ts`.
  - Porta (`src/core/telemetry/ports.ts`): `Atributos = Partial<Record<AtributoPermitido, string | number | boolean>>`, `SpanAtivo { atribuir(a); falhar(codigo) }`, `Telemetry { span(nome, atributos, fn, opts?: { traceparent? }); evento("pausa", atributos?); contador(nome: NomeDeMetrica, rotulos?, valor?); histograma(nome, valor, rotulos?); medidor(nome, valor, rotulos?); log(nivel: "info" | "warn" | "error", codigo: string, campos?); traceparentAtual(); encerrar() }`.
  - Fake (`src/infra/fakes/memory-telemetry.ts`): `createMemoryTelemetry(): MemoryTelemetry` com `spans: SpanRegistrado[]` (`{ nome; atributos; pai?; trace; falha? }`, `atributos` já recebe o `atribuir`), `eventos`, `metricas: MetricaRegistrada[]` (`{ tipo; nome; valor; rotulos }`), `logs: LogRegistrado[]` (`{ nivel; codigo; campos }`); a privada `validar(atributos)` lança `atributo_proibido: <chave>` para chave fora da lista ou texto acima de 64; contexto por `AsyncLocalStorage<{ indice; trace; spanId }>`; `traceparentAtual` = `00-{trace}-{spanId}-01`.
  - Adaptador OTel (`src/infra/otel/telemetry.ts`): `createOtelTelemetry()` com `tracer`/`medidor` de nome `ritu`, mapas de instrumentos (`createCounter`, `createHistogram(nome)` sem opções, `createGauge`), a privada `filtrar(atributos)` (descarta fora da lista ou longo e emite `warn` `atributo_proibido` com `erro.codigo`), a privada `emitir(nivel, codigo, campos, validar)` (põe `trace_id` do span ativo, `body: codigo`, `severityText` `INFO`/`WARN`/`ERROR`, e imprime JSON no console quando não há provedor de logs), `span` com `startActiveSpan` e `falhar("erro_inesperado")` quando o corpo lança, `encerrar` com `forceFlush` nos três provedores. Testes em `telemetry.test.ts` (exportador de spans em memória, `AsyncLocalStorageContextManager`, `W3CTraceContextPropagator`). Nulo: `src/infra/otel/null-telemetry.ts` (`createNullTelemetry()`).
  - Processos: `src/infra/otel/node-sdk.ts` (`iniciarOtelNode()` só com `OTEL_EXPORTER_OTLP_ENDPOINT`; `NodeSDK` com `OTLPTraceExporter`, `PeriodicExportingMetricReader(OTLPMetricExporter)` com o intervalo padrão, `BatchLogRecordProcessor(OTLPLogExporter)`; `serviceName` de `OTEL_SERVICE_NAME` ou `ritu`). `src/instrumentation.ts` (`register()`: sem endpoint volta; com endpoint, `import("@vercel/otel")` e `registerOTel({ serviceName })`). `@vercel/otel` 2.3.0: `registerOTel(Configuration)` aceita `metricReaders?: MetricReader[]` e `logRecordProcessors?: LogRecordProcessor[]` (conferido em `node_modules/@vercel/otel/dist/types/types.d.ts`). Container (`src/infra/container.ts`): `telemetry` (nula sem endpoint, OTel com), `iniciarTelemetria()` (só fora do Next, importa `node-sdk`), `encerrar()` (descarrega a telemetria, desliga o SDK, fecha o banco), `weather` = `createCachedWeatherSource(createOpenMeteoWeather(), clock)`. `scripts/loop-demo.ts` é o modelo: `await container.iniciarTelemetria()` no começo e `container.encerrar()` no `finally`.
  - Emissores de hoje: `src/core/llm/router.ts` (`createModelRouter({ ledger, clock, telemetry, cotas? })`; `medirCota` → `ritu_llm_cota_usada{modelo, janela}`; `anunciarTroca(t, aoTrocar)` → `ritu_llm_troca_de_modelo_total{papel, de, para, motivo}`; `paraPapel(papel, opts)` devolve `{ proximo(); usou(modelo, tokens); falhou(modelo, erro) }`: `usou` soma `ritu_llm_chamadas_total{modelo, papel}` e `ritu_tokens_total{modelo, papel, direcao}`, `falhou` soma `ritu_llm_erros_total{modelo, papel, codigo}`; `proximo()` devolve `null` quando nenhum modelo do papel tem vaga). `src/core/llm/fornecedor.ts` (`FornecedorDeModelo { proximo(); usou(modelo, tokens): Promise<void>; falhou(modelo, erro): Promise<void> }`). `src/core/llm/chamar.ts` (`chamarComPapel(deps: { router; client; telemetry }, p)`; a privada `tentar(client, fornecedor, modelo, p)` chama `fornecedor.usou(modelo, tokens)` depois de `client.gerar`). `src/core/agents/chamada-de-apoio.ts` (`chamarApoio(deps: { router; client; telemetry }, span, pedido)`; usado por `interpretar.ts` e `julgar.ts`). `src/core/agents/memory/memoria.ts` (chama `chamarComPapel({ router, client, telemetry }, …)`). `src/infra/fakes/fixed-model.ts` (`createFixedModel(modelos?)` com `usos`, `falhas`). `src/core/runs/loop.ts`: a privada `concluirChamada(amb, span, st, modelo, r)` chama `amb.deps.modelo.usou(modelo, { entrada, saida })`; a privada `tratarFalha(amb, st, modelo, erro)` soma `ritu_llm_erros_total{"erro.codigo"}` (contagem dobrada) e chama `amb.deps.modelo.falhou`; `SessaoLlm.inicio` vem de `amb.deps.clock`. `src/core/runs/loop-passo.ts`: a privada `executarChamada(amb, chamada)` abre `tool.chamada` com `{"tool.nome"}`, mede `inicio` com o `clock` e soma `ritu_tool_chamadas_total{"tool.nome", "tool.status"}` (rótulos errados); soma `ritu_pausas_total`. `src/core/runs/run-service.ts`: `createRunService({ stores, tx, runtime, clock, telemetry })`; `encerrar(contaId, runId, status, campos?)` muda o status e loga `info` `run_fim` com `run.id`, `run.status`, `trace_id`; `falhar(contaId, runId, codigo)` grava a etapa de erro e chama `encerrar(…, "failed")`; a privada `fecharTrecho(contaId, runId, estado, fim)` grava passos, tokens, `latencia_ms` e, hoje, `histograma("ritu_run_duracao_ms", estado.ativo_ms)` e `histograma("ritu_run_passos", estado.chamadas_de_modelo)` sem rótulos; `comSpanDoRun(contaId, runId, corpo)` abre o span `run` (ou continua pelo `trace_id`), loga `run_inicio`, guarda o span em `spansAbertos` e, no fim, `fecharSpan(span, run)` atribui `run.status`, `run.passos`, `run.caminho`, `run.intencoes`; a privada `dentroDoSpan(contaId, run, p, corpo)` reaproveita o span aberto ou abre um próprio (com `prompt.versao`) e loga `run_inicio`; `executarRun`, `continuarRun` (o trecho depois da pausa), `pausarSemAgente`. Usam `comSpanDoRun`: `conversar.ts` (todo o run da mensagem), `continuar.ts` (a resposta a uma pergunta) e `aprovar.ts` (a decisão do bloco). `src/core/patterns/job.ts` loga `error` `padroes_conta_falhou` com `erro.codigo`. `src/core/agents/judge/julgar.ts` (`createJudge(deps).julgar(p)`; a privada `contar(telemetry, graves, registros)` soma `ritu_juiz_reprovacoes_total` e `ritu_juiz_avisos_total`). `saidaSegura(dados?)` (`src/core/agents/companion/saida.ts`) nasce em: `fim-do-run.ts` (a privada `desfecho(fim, dados, perfil)`: `entregue` inválido → erro `saida_invalida`; `limite` → `limite:<motivo>`; erro → o código do fim ou `pausa_inesperada`; e a privada `pausa(...)` com `pausa_invalida`), `juiz-do-run.ts` (a privada `entregaSegura(resultado, dados, campos, aprovado)`), `src/core/conversation/continuar.ts` (a privada `falhar(x)`), `src/core/conversation/conversar.ts` (a privada `respostaSegura(x)`). `src/core/weather/cache.ts`: `createCachedWeatherSource(dentro, clock)` (decorador com `guardados` e `emVoo`; falha não é guardada); chamado em `src/infra/container.ts`, `src/core/weather/cache.test.ts`, `src/core/agents/tools/clima.test.ts` e `evals/det/clima/cache.eval.ts`. As tools de clima (`clima.agora`, `clima.proximas_horas`) chamam `weather.buscar` dentro do span `tool.chamada`.
  - Toques: `src/core/touches/deps.ts` (`Deps = { tx; stores; kb; clock; telemetry }`), `createTouches(deps)` em `src/core/touches/index.ts` (`tocarRetorno`, `tocarGosto`, `trocarIngrediente`, `responderTroca`), `tocarGosto` em `gosto.ts` como modelo (`telemetry.span("toque", { tipo: "gosto" }, …)`, `RituError("toque_invalido", "Toque inválido")`). `RunRepository.votar(contaId, runId, voto: "up" | "down"): Promise<void>` em `src/core/runs/ports.ts`; memória em `src/infra/fakes/memory-stores.ts` (`votar` sai sem fazer nada com run de outra conta; guarda em `db.estado.votos`); Postgres em `src/infra/db/runs.ts` (`insert into feedback … on conflict (run_id) do update set voto = excluded.voto`); contrato em `test/contracts/runs.contract.ts` ("votar aceita up e depois down no mesmo run", espera `undefined`) e uso em `test/contracts/delete-account.contract.ts`.
  - Cenários: `montarCenario(c, opts?: { runtime?; llm?; esgotar? })` em `test/fixtures/cenarios/montar.ts` cria `telemetry = createMemoryTelemetry()`, `weather = createFakeWeather()` (passado direto ao container), `router` sobre o `ledger` em memória, e devolve `deps` (`DepsDoCenario`, com `telemetry: MemoryTelemetry`, `weather: FakeWeather`, `touches`, `patterns`, …); `rodarCenario` em `rodar.ts`; registros `cenarios`, `cenariosDeConversa`, `cenariosComPausa`, `cenariosComAprovacao`, `cenariosDeAprendizado`, `cenariosDeMemoria`, `cenariosDeGuardrails` em `test/fixtures/cenarios/index.ts` (o `demo` lista exatamente esses sete; `montar.test.ts` trava contagens). `scripts/demo.ts` monta o cenário com `montarCenario` e não liga o OTel.
  - Mastra: `createMastraRuntime(deps: DepsDoRuntimeMastra)` em `src/infra/mastra/runtime.ts`, com `modeloDe` injetável (o teste `runtime.test.ts` usa um `modeloFalso`), `OPCOES_DE_TRACE`.
  - Evals: os de privacidade de hoje (`evals/det/{acompanhante,aprendizado,aprovacao,conversa,guardrails,pausas,rotina-e-padroes}/privacidade.eval.ts`) são o modelo de canário e de busca de nome de alimento; `evals/det/loop/rastro.eval.ts` confere métricas do loop.
  - Docker: `docker-compose.yml` com `postgres` e `lgtm` (`image: grafana/otel-lgtm`, sem tag; portas `3001:3000`, `4317`, `4318`; volume `lgtm-data:/data`).
- **Camadas:** `src/core/` só importa `src/core/`, `@config/*` e `zod` (R1); sem `new Date()` sem argumento nem `Date.now()` no core (R8): toda medida de tempo vem do `Clock`. OTel e Mastra só em `src/infra/`. `scripts/` e `evals/` só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (R6). `scripts/lib/painel*.ts` importam só `config/` e `src/core/telemetry/nomes.ts`.
- **Privacidade:** rótulo de métrica nunca leva `run.id`, `trace_id`, `conta_id`, nome de alimento ou cidade; `run.id` e `trace_id` só em span e log. Nenhum texto da pessoa, prompt, saída do agente, cidade ou e-mail em span, métrica, log ou `resumo` de etapa. Valor de texto emitido tem forma de identificador: `^[a-z0-9][a-z0-9_.:,\-]{0,63}$`. A captura de entrada e saída da Mastra continua desligada. Sem amostragem de traces.
- **Testes:** os padrão rodam sem rede, banco nem chave; nenhum teste chama modelo. O que fala com o Grafana (`painel:check`) é ⚠️ e fica fora dos gates.
- **Qualidade:** complexidade cognitiva ≤ 15 por função, `npm run dup` com 0 clones e Biome. Rode `./node_modules/.bin/biome check --write <arquivos>`. O `npm run lint` pelo wrapper rtk dá falso erro ("JSON parse failed"): rode sempre `rtk bypass npm run lint`.
- **Ambiente:** rtk em `/opt/homebrew/bin`; node em `$HOME/.nvm/versions/node/v24.22.2/bin` (`export PATH=/opt/homebrew/bin:$HOME/.nvm/versions/node/v24.22.2/bin:$PATH`). Docker disponível: `docker compose up -d` sobe Postgres e LGTM; `npm run test:db` roda os contratos no Postgres (precisa do `postgres` no ar).
- **Limites:**
  - Não leia `.env.local` (nem com `cat`, `grep` ou `source`) e não abra pastas fora do repositório.
  - Arquivos temporários só no scratchpad da sessão, nunca em `/tmp` nem em `$TMPDIR`.
  - Arquivo fora da lista da tarefa: pare e diga qual. Exceção explícita só onde a tarefa disser (testes existentes que quebram só pela assinatura nova ou pelos rótulos corrigidos, quando a tarefa autoriza).
  - Não toque em `.specs/`, `.docs/`, `AGENTS.md`, `.plans/` nem `design/`. O que a spec manda "anotar em `.plans/DECISOES-AUTONOMAS.md`" vai no relatório final da tarefa; quem anota é o orquestrador.
  - Não commite.
  - Nada de ⚠️ com LLM (`eval:llm` sem `--listar`, `demo --llm`).

## Decisões do planejamento

Lacunas e contradições entre a spec e o código, com a opção mais conservadora. Cada uma diz como desfazer.

- **D1 · `padroes_conta_falhou` fica.** A spec (`LOGS` e a tabela de emissores) chama o log de erro por conta de `padroes_falha_na_conta`; o código (012) e `OBSERVABILITY.md` §3 usam `padroes_conta_falhou`. Decidido: `LOGS` tem `padroes_conta_falhou: "error"` e `job.ts` não muda o código. Desfazer: renomear nos três lugares.
- **D2 · O relógio chega a `chamarComPapel`.** A spec quer a latência do modelo medida pelo `Clock` em `chamarComPapel`, mas o `Deps` dela é `{ router; client; telemetry }`. Decidido: `clock: Clock` obrigatório no `Deps` de `chamarComPapel` e de `chamarApoio`; Intérprete, Juiz e Memória já têm `clock` e passam. `FornecedorDeModelo.usou(modelo, tokens, duracaoMs: number)`. Desfazer: medir no roteador entre `proximo` e `usou`.
- **D3 · Espelho de telemetria nos cenários.** `npm run demo` e o `eval:llm` rodam pelos cenários, e `montarCenario` cria a própria `MemoryTelemetry`: ligar o OTel no script não exportaria nada do run. Decidido: `createTeeTelemetry(memoria, outra)` em `src/infra/fakes/tee-telemetry.ts` (devolve uma `MemoryTelemetry` que repassa tudo à `outra`) e `OpcoesDoCenario.telemetria?: Telemetry`; o `demo` e os rodadores do `eval:llm` passam `container.telemetry`. O mesmo espelho serve ao teste de privacidade pelo adaptador real. Desfazer: `montarCenario` aceitar a telemetria no lugar da memória (os evals perderiam o que leem).
- **D4 · Latência zero nos cenários.** A spec manda medir modelo, tool e trecho pelo `Clock`; nos cenários, inclusive no `eval:llm` e no `demo --llm`, o relógio é fixo (`createFixedClock(c.agora)`). Decidido: segue a spec (o `Clock`); nos runs dos cenários os histogramas de duração saem com 0 (o roteirizado não avança o relógio). Anotado para o relatório: o painel depois da rodada do `c3` mostra contagens e tokens, mas latências em 0. Desfazer: um relógio que avança no `eval:llm`.
- **D5 · O cache do clima entra nos cenários.** `cache.hit` só nasce em `createCachedWeatherSource`, e os cenários passam o clima falso direto ao container. Decidido: `montarCenario` passa ao container `createCachedWeatherSource(weather, clock, telemetry)`; `deps.weather` continua o `FakeWeather`. Desfazer: o eval de cobertura montar o cache à parte.
- **D6 · Motivo do log `resposta_segura`.** A spec não dá a lista. Decidido: o código que já existe em cada ponto: `saida_invalida`, `limite:<motivo>`, o código do erro do fim (ou `pausa_inesperada`), `pausa_invalida`, `juiz` (entrega segura do Juiz), `erro_na_retomada` (`continuar.ts`) e `erro_na_conversa` (`conversar.ts`). Desfazer: um enum fechado.
- **D7 · `run.caminho` e `run.intencoes` pelo `atribuirAoSpanAtual`.** "O span `run` recebe `run.caminho` e `run.intencoes` assim que o caminho é escolhido" — quem escolhe é `conversar.ts`, dentro do `comSpanDoRun`. Decidido: `conversar.ts` chama `telemetry.atribuirAoSpanAtual({ "run.caminho", "run.intencoes" })` logo depois de escolher o caminho; o `fecharSpan` continua atribuindo no fim. Desfazer: só no `fecharSpan`.
- **D8 · Duração por trecho no ajudante do span.** Decidido: `ritu_run_duracao_ms` sai uma vez por `comSpanDoRun` e uma vez por `dentroDoSpan` que abriu span próprio (nunca no `fecharTrecho`), com a duração `clock` do corpo e o `status` lido do run no fim do corpo; `caminho` do run. Desfazer: medir em `fecharTrecho` (perde os caminhos sem agente).
- **D9 · Regex de forma só na telemetria.** O critério de privacidade pede valor em forma de identificador "em todo valor de texto emitido". Decidido: a forma é conferida em atributo de span, de evento, rótulo de métrica e campo de log; `resumo` de etapa (ex.: `casa: 2 itens`) e console são conferidos só por canário e nome de alimento. Desfazer: mudar o formato dos resumos.
- **D10 · Cenário novo fica num registro próprio.** O eval de cobertura pode precisar de cenário novo (ex.: erro do modelo para `llm_erro`). Decidido: cenário novo vai para `cenariosDeTelemetria` (novo, em `test/fixtures/cenarios/index.ts`), fora da lista do `demo` e das travas de `montar.test.ts`. Desfazer: pôr num registro que o `demo` lista.
- **D11 · Lógica do `painel:check` em biblioteca.** Decidido: `scripts/lib/painel-check.ts` (puro, recebe um `fetch` injetado) com teste; `scripts/painel-check.ts` só chama e define o código de saída. Desfazer: tudo no script.
- **D12 · Arquivos de teste no mapa podem estar em `scripts/`.** "O painel cobre todas as métricas" é conferido por `scripts/lib/painel.test.ts`; o mapa da 014 fala em `test/` e `src/`. Decidido: aceitar `scripts/` nos `arquivos` do mapa (o `mapa.eval.ts` só confere que existe). Desfazer: um eval em `evals/det/telemetria/` que chame o teste.
- **D13 · Os evals novos entram no mapa de uma vez.** Cada `*.eval.ts` novo deixaria `mapa.eval.ts` vermelho até entrar no mapa, e o mapa é um arquivo só. Decidido: as tarefas de eval rodam só o próprio arquivo; a última (T20) põe todas as linhas no mapa e roda o `eval:det` inteiro. Desfazer: cada tarefa de eval edita o mapa, em ondas separadas.
- **D14 · Tag do LGTM.** A spec quer a imagem fixada, sem dizer qual. Decidido: a versão da imagem `grafana/otel-lgtm` já baixada na máquina (`docker image inspect`), escrita como tag exata (`grafana/otel-lgtm:<versão>`); sem imagem local, a mais recente estável no momento, fixada. A tarefa informa a tag e os caminhos de provisionamento conferidos. Desfazer: trocar a tag.
- **D15 · Spans próprios da Mastra.** O teste de privacidade do adaptador real exige "só spans de `SPANS`". Se a Mastra emitir spans pelo tracer global do OTel, o teste falha por nome. Decidido: a tarefa confere; se a Mastra emitir spans fora de `SPANS`, para e informa (não muda `OPCOES_DE_TRACE` nem a configuração da Mastra sem decisão). Desfazer: aceitar o prefixo da Mastra no teste.

## Tarefas

### T1 · Rewrite the telemetry names as typed registries and add the telemetry config
- nivel: mecanica
- objetivo: trocar as listas de spans e métricas por registros com atributos obrigatórios, tipo e rótulos; criar a lista de logs; criar `config/telemetria.ts`.
- arquivos: `src/core/telemetry/nomes.ts`, `src/core/telemetry/nomes.test.ts`, `config/telemetria.ts` (novo), `config/telemetria.test.ts` (novo), `config/index.ts`, `config/index.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 51 ("Telemetria do agente")
- contratos (copiar exatamente; manter `ATRIBUTOS_PERMITIDOS`, `AtributoPermitido` e `MAX_TEXTO_ATRIBUTO` como estão):
  ```ts
  export const SPANS = {
    run: ["run.id", "run.caminho", "run.intencoes", "conta.tipo", "run.status", "run.passos"],
    "guardrail.entrada": ["guardrail.resultado"],
    interprete: [],
    preparo: ["candidatos.total", "faltas.registradas", "para_ter.candidato"],
    "agente.passo": ["passo.ordem"],
    "llm.chamada": [
      "llm.papel", "gen_ai.request.model", "llm.troca_de_modelo",
      "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens", "llm.tentativas",
    ],
    "tool.chamada": ["tool.nome", "tool.status"],
    validacao: ["validacao.ok", "validacao.violacoes", "validacao.tentativa"],
    juiz: ["juiz.aprovado", "juiz.tentativa"],
    "aprovacao.execucao": ["propostas.total", "propostas.aprovadas"],
    toque: ["tipo"],
    "memoria.resumo": ["resumo.origem"],
    "padroes.deteccao": ["padroes.contas", "padroes.propostos"],
  } as const satisfies Record<string, readonly AtributoPermitido[]>
  // Valores: atributos obrigatórios num span que termina sem falha.
  // Condicionais: `prompt.versao` em `run` com agente; `cache.hit` em `tool.chamada` de `clima.*`;
  // `motivo` e `resultado` em `toque` de troca (011).

  export type NomeDeSpan = keyof typeof SPANS

  export const METRICAS = {
    ritu_run_duracao_ms: { tipo: "histograma", rotulos: ["caminho", "status"] },
    ritu_run_passos: { tipo: "histograma", rotulos: ["caminho", "status"] },
    ritu_run_intencao_total: { tipo: "contador", rotulos: ["intencao"] },
    ritu_tokens_total: { tipo: "contador", rotulos: ["modelo", "papel", "direcao"] },
    ritu_llm_chamadas_total: { tipo: "contador", rotulos: ["modelo", "papel"] },
    ritu_llm_duracao_ms: { tipo: "histograma", rotulos: ["modelo", "papel"] },
    ritu_llm_cota_usada: { tipo: "medidor", rotulos: ["modelo", "janela"] },
    ritu_llm_troca_de_modelo_total: { tipo: "contador", rotulos: ["papel", "de", "para", "motivo"] },
    ritu_llm_erros_total: { tipo: "contador", rotulos: ["modelo", "papel", "codigo"] },
    ritu_fallback_sem_llm_total: { tipo: "contador", rotulos: [] },
    ritu_tool_chamadas_total: { tipo: "contador", rotulos: ["tool", "status"] },
    ritu_tool_duracao_ms: { tipo: "histograma", rotulos: ["tool"] },
    ritu_validacao_violacoes_total: { tipo: "contador", rotulos: ["violacao"] },
    ritu_guardrail_total: { tipo: "contador", rotulos: ["resultado", "origem"] },
    ritu_juiz_total: { tipo: "contador", rotulos: ["resultado"] },
    ritu_juiz_reprovacoes_total: { tipo: "contador", rotulos: ["motivo"] },
    ritu_juiz_avisos_total: { tipo: "contador", rotulos: ["motivo"] },
    ritu_pausas_total: { tipo: "contador", rotulos: ["tipo"] },
    ritu_propostas_total: { tipo: "contador", rotulos: ["tool", "decisao"] },
    ritu_rotina_resumo_total: { tipo: "contador", rotulos: ["origem"] },
    ritu_padroes_total: { tipo: "contador", rotulos: ["tipo", "etapa"] },
    ritu_feedback_total: { tipo: "contador", rotulos: ["voto"] },
    ritu_retorno_total: { tipo: "contador", rotulos: ["resultado", "origem"] },
    ritu_troca_ingrediente_total: { tipo: "contador", rotulos: ["resultado"] },
    ritu_gosto_total: { tipo: "contador", rotulos: ["gosto"] },
    ritu_faltas_total: { tipo: "contador", rotulos: ["origem"] },
    ritu_para_ter_total: { tipo: "contador", rotulos: ["etapa"] },
  } as const satisfies Record<string, { tipo: "contador" | "histograma" | "medidor"; rotulos: readonly AtributoPermitido[] }>

  export type NomeDeMetrica = keyof typeof METRICAS
  export type NomeDeContador = { [K in NomeDeMetrica]: (typeof METRICAS)[K]["tipo"] extends "contador" ? K : never }[NomeDeMetrica]
  export type NomeDeHistograma = /* idem, "histograma" */
  export type NomeDeMedidor = /* idem, "medidor" */

  export const LOGS = {
    run_inicio: "info",            // campos: — (run.id e trace_id vêm do contexto)
    run_retomado: "info",          // pausa.tipo
    run_fim: "info",               // run.status, run.caminho, run.passos
    clima_indisponivel: "warn",    // erro.codigo
    troca_de_modelo: "warn",       // papel, de, para, motivo
    sem_modelo: "warn",            // papel
    llm_erro: "warn",              // modelo, papel, codigo
    resposta_segura: "warn",       // motivo
    atributo_proibido: "warn",     // erro.codigo
    run_falhou: "error",           // erro.codigo
    padroes_conta_falhou: "error", // erro.codigo (012; D1)
    erro_inesperado: "error",      // erro.codigo
  } as const

  export type CodigoDeLog = keyof typeof LOGS
  ```
  ```ts
  // config/telemetria.ts (entra em config/index.ts como `telemetria`)
  export const telemetria = {
    buckets: {
      ritu_run_duracao_ms: [250, 500, 1000, 2000, 4000, 8000, 15000, 30000, 60000],
      ritu_run_passos: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12],
      ritu_llm_duracao_ms: [250, 500, 1000, 2000, 4000, 8000, 15000, 30000],
      ritu_tool_duracao_ms: [5, 25, 100, 250, 500, 1000, 2500, 5000],
    },
    exportacaoNosScriptsMs: 5000,
    alertas: {
      cotaDoDia: 0.8,
      runsFalhando: { taxa: 0.1, minimoDeRuns: 5, janela: "1h" },
      juizReprovando: { taxa: 0.2, minimoDeJulgamentos: 5, janela: "1h" },
      semModelo: { minimo: 1, janela: "1h" },
      rateLimit: { minimo: 5, janela: "10m" },
    },
    grafana: { url: "http://localhost:3001", uidDoPainel: "ritu", pasta: "Ritu", uidMetricas: "prometheus" },
  } as const
  ```
  `config/` não importa `src/`; o cruzamento com `METRICAS` fica no teste. A porta (`ports.ts`) **não** muda nesta tarefa: `contador(nome: NomeDeMetrica, …)` continua aceitando os nomes do registro. Nenhum código fora destes arquivos itera `SPANS` ou `METRICAS` (conferido); se o typecheck acusar algum, pare e diga.
- testes primeiro: `nomes.test.ts`: todo atributo de `SPANS` e todo rótulo de `METRICAS` está em `ATRIBUTOS_PERMITIDOS`; nenhum rótulo é `run.id`, `trace_id` ou `conta_id`; as 27 métricas e os 13 spans; `LOGS` com os 12 códigos e os níveis da tabela; um `expectTypeOf` de que `"ritu_run_passos"` não é `NomeDeContador`. `config/telemetria.test.ts`: todo histograma de `METRICAS` tem buckets, em ordem crescente, e nenhuma chave de `buckets` fica sem métrica histograma. `config/index.test.ts`: `config.telemetria.grafana.uidDoPainel` é `ritu`.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`
- pronto quando: typecheck e `npm test` verdes.
- fora: a porta e os adaptadores (T3).

### T2 · Return the previous vote from votar
- nivel: mecanica
- objetivo: `RunRepository.votar` passa a devolver o voto anterior, nos dois adaptadores, com o contrato.
- arquivos: `src/core/runs/ports.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/db/runs.ts`, `test/contracts/runs.contract.ts`, `test/contracts/delete-account.contract.ts` (só se quebrar)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  votar(contaId: string, runId: string, voto: "up" | "down"): Promise<"up" | "down" | null>
  // o voto anterior; null sem voto ou run que não é da conta (e aí não grava nada)
  ```
  Postgres: numa consulta só ou numa transação, leia o voto anterior da linha de `feedback` do run (só se o run for da conta) e faça o upsert de hoje; devolva o anterior. Memória: o mesmo comportamento.
- testes primeiro (`runs.contract.ts`, no lugar do caso "votar aceita up e depois down no mesmo run"): primeiro voto devolve `null`; o segundo (`down`) devolve `up`; o mesmo voto de novo devolve o mesmo; run de outra conta devolve `null` e não grava (o caso "conta B não lê nem altera" continua passando).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `docker compose up -d postgres` e `npm run test:db`
- pronto quando: `npm test` e `npm run test:db` verdes.
- fora: o toque de voto (T8).

### T3 · Type the telemetry port by metric kind, propagate run.id to logs and enforce declared labels
- nivel: nucleo
- objetivo: mudar a porta `Telemetry` (contador, histograma e medidor por tipo; `atribuirAoSpanAtual`; `log(codigo, campos)`), os três adaptadores (buckets, `run.id` e `trace_id` nos logs, rótulos exatos no fake) e corrigir os emissores que hoje saem com rótulos errados.
- arquivos: `src/core/telemetry/ports.ts`, `src/infra/otel/telemetry.ts`, `src/infra/otel/telemetry.test.ts`, `src/infra/otel/null-telemetry.ts`, `src/infra/otel/null-telemetry.test.ts`, `src/infra/fakes/memory-telemetry.ts`, `src/infra/fakes/memory-telemetry.test.ts`, `src/core/runs/run-service.ts` (só as chamadas de `log` e os rótulos dos dois histogramas), `src/core/runs/loop.ts` (só tirar o contador de `tratarFalha`), `src/core/runs/loop-passo.ts` (só os rótulos de `ritu_tool_chamadas_total`), `src/core/patterns/job.ts` (só a chamada de `log`), `src/core/touches/troca.ts` (só o tipo do nome da métrica, se o typecheck pedir); e os testes e evals que quebrarem só por essas mudanças (ex.: `src/core/runs/loop.test.ts`, `src/core/runs/run-service.test.ts`, `src/core/patterns/job.test.ts`, `src/core/llm/router.test.ts`, `evals/det/loop/rastro.eval.ts`), sem mudar o que eles conferem além do rótulo ou da assinatura
- depende de: T1
- leitura: `.docs/OBSERVABILITY.md` §3 ("Logs" e "Privacidade")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §3, linha 57 ("OpenTelemetry com LGTM")
- contratos:
  ```ts
  export interface Telemetry {
    span<T>(nome: NomeDeSpan, atributos: Atributos, fn: (s: SpanAtivo) => Promise<T>, opts?: { traceparent?: string }): Promise<T>
    evento(nome: "pausa", atributos?: Atributos): void
    contador(nome: NomeDeContador, rotulos?: Atributos, valor?: number): void
    histograma(nome: NomeDeHistograma, valor: number, rotulos?: Atributos): void
    medidor(nome: NomeDeMedidor, valor: number, rotulos?: Atributos): void
    atribuirAoSpanAtual(a: Atributos): void         // novo
    log(codigo: CodigoDeLog, campos?: Atributos): void // muda: sem o nível
    traceparentAtual(): string | undefined
    encerrar(): Promise<void>
  }
  ```
  Comportamento comum aos adaptadores:
  - Dentro de um span `run` (aberto ou continuado), todo `log` ganha `run.id` (do atributo do span, inclusive quando chega depois por `atribuir` ou `atribuirAoSpanAtual`) e `trace_id`, se quem chama não os passou. Vale para log emitido em span filho do `run`.
  - `atribuirAoSpanAtual` sem span ativo não faz nada; com span ativo, faz o mesmo que `atribuir` desse span.
  - O nível do log vem de `LOGS[codigo]`.
  Adaptador OTel:
  - Histograma criado com `advice: { explicitBucketBoundaries }` de `config.telemetria.buckets[nome]`.
  - `run.id` no contexto: ao abrir `run`, guarda um portador mutável (`{ runId?: string }`) numa chave de contexto própria (`createContextKey`), a partir do atributo `run.id` da abertura (também quando o `run` continua por `traceparent` em outro processo); `atribuir` e `atribuirAoSpanAtual` com `run.id` atualizam o portador; `emitir` lê o portador do contexto ativo.
  - Exceção que escapa de um span `run`: além de `falhar("erro_inesperado")`, log `erro_inesperado` com `erro.codigo: "erro_inesperado"`.
  - Log com campo fora de `ATRIBUTOS_PERMITIDOS` ou texto acima de 64: descarta o campo e emite `atributo_proibido` (como hoje).
  Fake:
  - Lança `rotulos_invalidos: <metrica>` se o conjunto de chaves dos rótulos não é exatamente o declarado em `METRICAS[nome].rotulos` (sem rótulos = `{}` = `[]`). Continua lançando `atributo_proibido` como hoje (e também para log com campo proibido).
  - `LogRegistrado` passa a `{ codigo: CodigoDeLog; nivel: "info" | "warn" | "error"; campos: Atributos }`, com o nível de `LOGS`; `campos` já com `run.id` e `trace_id` do contexto.
  - `SpanRegistrado` guarda os atributos finais (abertura mais `atribuir` e `atribuirAoSpanAtual`).
  Nulo: implementa `atribuirAoSpanAtual` sem fazer nada; `log(codigo, campos)`.
  Emissores corrigidos nesta tarefa (o resto vem nas T4 a T9):
  - `loop-passo.ts`: `ritu_tool_chamadas_total{tool, status}` (o valor de `tool` é o mesmo `nomeSpan` de hoje).
  - `loop.ts`, `tratarFalha`: deixa de somar `ritu_llm_erros_total` (o roteador já soma em `falhou`).
  - `run-service.ts`: `log("run_inicio", …)`, `log("run_fim", …)`; os dois histogramas de `fecharTrecho` passam a sair com `{ caminho: run.caminho, status: run.status }` lidos do run (provisório: a T4 muda o ponto e o significado).
  - `job.ts`: `log("padroes_conta_falhou", { "erro.codigo": … })`.
  - Outro emissor que o fake estrito acusar com rótulos fora do declarado (ex.: um `{ ...objeto }` com chave a mais): a exceção desta tarefa permite mudar **só o objeto de rótulos** nesse arquivo, para o conjunto declarado em `METRICAS`; diga no relatório cada arquivo e linha. Se a correção pedir mais que isso, pare e diga.
- testes primeiro: `memory-telemetry.test.ts`: `rotulos_invalidos` com rótulo a menos, a mais e trocado; contador sem rótulo passa em `ritu_fallback_sem_llm_total`; log dentro de `run` ganha `run.id` e `trace_id`; `run.id` atribuído depois chega ao log seguinte; log fora de span não ganha nada; nível vem de `LOGS`; `atribuirAoSpanAtual` dentro de span filho muda o span filho; fora de span não faz nada. `telemetry.test.ts` (com `InMemorySpanExporter`, um `MeterProvider` com `InMemoryMetricExporter` + leitor manual ou periódico com `forceFlush`, e um `LoggerProvider` com `InMemoryLogRecordExporter` + `SimpleLogRecordProcessor`): buckets do histograma iguais aos de `config/telemetria.ts`; log dentro de `run` com `run.id` e `trace_id`; `run.id` atribuído depois; `run` continuado por `traceparent` recria o portador; exceção no `run` gera `erro_inesperado`. `null-telemetry.test.ts`: o método novo não lança.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: typecheck, `npm test` e `eval:det` verdes; nenhuma métrica do repositório sai com rótulo fora do declarado (o fake lança).
- fora: duração por trecho, passos no encerramento, `run_retomado`, `run_falhou` (T4); latência de modelo e tool (T6); clima (T5); juiz e resposta segura (T7).

### T4 · Measure each run segment and close the run with steps and logs
- nivel: nucleo
- objetivo: medir com o `Clock` cada trecho de trabalho num run, em qualquer caminho, e registrar no encerramento os passos e os logs de fim, retomada e falha.
- arquivos: `src/core/runs/run-service.ts`, `src/core/runs/run-service.test.ts`
- depende de: T3
- leitura: `.docs/OBSERVABILITY.md` §3 (tabela "Métricas", linhas de `ritu_run_duracao_ms` e `ritu_run_passos`)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 51
- contratos (D8):
  - `comSpanDoRun` (mensagem nova, `continuar`, `aprovar`) e `dentroDoSpan` quando abre span próprio: medem o corpo com o `clock` (`clock.now().getTime()` antes e depois) e, no fim (também quando o corpo lança, com o status do run lido depois), gravam `ritu_run_duracao_ms{caminho, status}` com `caminho` = `run.caminho` e `status` = o status do run ao fim do trecho. `dentroDoSpan` que reaproveita o span aberto não grava (quem grava é o `comSpanDoRun` que o abriu).
  - `fecharTrecho` deixa de gravar os dois histogramas.
  - Ao continuar um run (o `comSpanDoRun` que reabre pelo `trace_id` de um run que já tinha `trace_id`, isto é, `continuar` e `aprovar`): log `run_retomado` com `pausa.tipo` = o tipo da pendência guardada no run (`pergunta` ou `aprovacao`; lido antes do corpo). O primeiro trecho do run loga `run_inicio` como hoje; a continuação loga `run_retomado` no lugar de `run_inicio`.
  - `encerrar(contaId, runId, status, campos?)`: depois de mudar o status, `ritu_run_passos{caminho, status}` com o valor `run.passos` (do run depois da mudança) e log `run_fim` com `run.status`, `run.caminho`, `run.passos`. Uma vez por run (o encerramento final: `done`, `failed`, `cancelled`).
  - `falhar(contaId, runId, codigo)`: log `run_falhou` com `erro.codigo: codigo`, além do que faz hoje.
  - O span `run` continua recebendo no fim `run.status`, `run.passos`, `run.caminho` e `run.intencoes` (ids unidos por vírgula) também no `dentroDoSpan` que abre span próprio (hoje só recebe status e passos), para todo `run` sem falha ter os atributos obrigatórios de `SPANS.run`.
  - Run cancelado em `iniciarRun` (aberto em `waiting_for_input`) ou fechado como `done` (em `waiting_for_approval`) passa por `mudarStatus`, não por `encerrar`: fica como está (só os que passam por `encerrar` contam em `ritu_run_passos`; anotado no relatório).
- testes primeiro (`run-service.test.ts`, com `createMemoryTelemetry` e `createFixedClock` avançado pelo runtime roteirizado ou à mão): um `comSpanDoRun` de caminho sem agente grava uma `ritu_run_duracao_ms` com a duração do corpo e o status do fim; `executarRun` direto grava uma (pelo `dentroDoSpan`); `continuarRun` dentro de `comSpanDoRun` grava uma só; `encerrar("done")` grava `ritu_run_passos` uma vez com `caminho` e `status`, e `run_fim` com os três campos e `run.id`; `falhar` gera `run_falhou` com o código; continuar loga `run_retomado` com `pausa.tipo`; span `run` aberto por `dentroDoSpan` tem `run.caminho` e `run.intencoes` no fim.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: os testes passam; os evals de cenário continuam verdes.
- fora: `conversar.ts` (T7), loop e roteador (T6).

### T5 · Mark cache hits and log weather outages in the weather cache
- nivel: mecanica
- objetivo: o cache do clima atribui `cache.hit` ao span ativo e loga `clima_indisponivel` quando a fonte falha; os cenários passam a usar o cache.
- arquivos: `src/core/weather/cache.ts`, `src/core/weather/cache.test.ts`, `src/infra/container.ts` (só a linha do `weather`), `src/core/agents/tools/clima.test.ts` (só a chamada de `createCachedWeatherSource`), `evals/det/clima/cache.eval.ts` (só a chamada), `test/fixtures/cenarios/montar.ts` (só o clima passado ao container, D5)
- depende de: T3
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  export function createCachedWeatherSource(dentro: WeatherSource, clock: Clock, telemetry: Telemetry): WeatherSource
  ```
  - Toda consulta (`buscar`) chama `telemetry.atribuirAoSpanAtual({ "cache.hit": true | false })`: `true` quando a entrada guardada ainda é válida; `false` quando vai à fonte ou espera um pedido em voo.
  - Falha da fonte: `telemetry.log("clima_indisponivel", { "erro.codigo": <code do RituError ou "desconhecido"> })`, uma vez por falha (no pedido à fonte, não por quem esperou o mesmo pedido), e segue o comportamento de hoje (a falha não é guardada e sobe).
  - Fora de span (ex.: `clima:real`), `atribuirAoSpanAtual` não faz nada.
  - `container.ts`: `createCachedWeatherSource(createOpenMeteoWeather(), clock, container.telemetry)`.
  - `montar.ts` (D5): o container recebe `weather: createCachedWeatherSource(weather, clock, telemetry)`; `deps.weather` continua o `FakeWeather` (os cenários seguem mudando o clima por ele). Se algum teste de cenário depender de o clima mudar no meio do mesmo run sem passar a validade do cache, pare e diga qual.
- testes primeiro (`cache.test.ts`, com `createMemoryTelemetry`): dentro de um span `tool.chamada`, a primeira busca da cidade marca `cache.hit: false` e a segunda, dentro da validade, `true`; depois da validade, `false`; fonte fora do ar gera um log `clima_indisponivel` com `erro.codigo` e o erro sobe; fora de span não lança.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: typecheck, `npm test` e `eval:det` verdes.
- fora: as tools de clima.

### T6 · Measure model and tool latency, and log model swaps, missing models and model errors
- nivel: nucleo
- objetivo: gravar a latência de toda chamada de modelo bem-sucedida e de toda tool chamada pelo loop, medidas pelo `Clock`, e os logs de troca de modelo, papel sem modelo e erro de modelo no roteador.
- arquivos: `src/core/llm/fornecedor.ts`, `src/core/llm/router.ts`, `src/core/llm/router.test.ts`, `src/core/llm/chamar.ts`, `src/core/llm/chamar.test.ts`, `src/core/agents/chamada-de-apoio.ts`, `src/core/agents/interpreter/interpretar.ts`, `src/core/agents/judge/julgar.ts` (só a chamada de `chamarApoio`), `src/core/agents/memory/memoria.ts`, `src/core/runs/loop.ts`, `src/core/runs/loop-passo.ts`, `src/core/runs/loop.test.ts`, `src/infra/fakes/fixed-model.ts`, `src/infra/fakes/fixed-model.test.ts`, `scripts/lib/evals/avaliador.ts` (só a chamada de `chamarComPapel`); e os testes que quebrarem só pela assinatura nova
- depende de: T3
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 51
- contratos (D2):
  ```ts
  // fornecedor.ts
  usou(modelo: string, tokens: { entrada: number; saida: number }, duracaoMs: number): Promise<void>
  // chamar.ts e chamada-de-apoio.ts
  type Deps = { router: ModelRouter; client: LlmClient; telemetry: Telemetry; clock: Clock }
  ```
  - `ModelRouter`, em `usou(modelo, tokens, duracaoMs)`: além do que faz hoje, `ritu_llm_duracao_ms{modelo, papel}` com `duracaoMs`. Troca anunciada (`anunciarTroca`): log `troca_de_modelo` com `papel`, `de`, `para`, `motivo`. `proximo()` que devolve `null` (papel sem modelo com vaga): log `sem_modelo` com `papel` (uma vez por `null`). `falhou(modelo, erro)`: log `llm_erro` com `modelo`, `papel`, `codigo` (a métrica `ritu_llm_erros_total` continua aqui e só aqui).
  - `chamarComPapel`, na privada `tentar`: mede `client.gerar` com `deps.clock` e passa `duracaoMs` a `usou`. `chamarApoio` repassa o `clock`. Intérprete, Juiz e Memória passam o `clock` que já têm. O avaliador do eval (`scripts/lib/evals/avaliador.ts`) passa o `clock` de `DepsDoAvaliador`.
  - Loop: `concluirChamada` passa a `usou` a duração da tentativa que deu certo (`clock` antes e depois de `tentarModelo`; guarde o início da tentativa em `SessaoLlm` ou passe adiante). `executarChamada` (`loop-passo.ts`): `ritu_tool_duracao_ms{tool}` com `clock.now().getTime() - inicio` (o mesmo `tool` de `ritu_tool_chamadas_total`), para toda tool chamada pelo loop (inclusive recusada).
  - `createFixedModel`: `usos` passa a guardar `duracaoMs`.
- testes primeiro: `router.test.ts`: `usou` grava `ritu_llm_duracao_ms` com os rótulos e o valor; troca gera o log com os quatro campos; papel sem vaga gera `sem_modelo`; `falhou` gera `llm_erro` e soma a métrica uma vez. `chamar.test.ts`: com um `client` que avança o relógio fixo em 120 ms, `ritu_llm_duracao_ms` = 120. `loop.test.ts`: um `LlmError` no passo soma `ritu_llm_erros_total` uma vez (não duas); a tool chamada gera `ritu_tool_duracao_ms{tool}`; a duração do modelo chega a `usou`.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: typecheck, `npm test` e `eval:det` verdes.
- fora: `run-service.ts` (T4).

### T7 · Count judge verdicts, log safe answers and tag the run span with the chosen path
- nivel: mecanica
- objetivo: somar `ritu_juiz_total` por julgamento, logar `resposta_segura` onde a saída vira a segura e atribuir caminho e intenções ao span `run` assim que o caminho é escolhido.
- arquivos: `src/core/agents/judge/julgar.ts`, `src/core/agents/judge/julgar.test.ts`, `src/core/agents/companion/fim-do-run.ts`, `src/core/agents/companion/juiz-do-run.ts`, `src/core/conversation/continuar.ts`, `src/core/conversation/conversar.ts`; e os testes desses arquivos que quebrarem só pelos logs novos
- depende de: T3, T6 (a T6 mexe em `julgar.ts`: esta tarefa vem depois)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `julgar`: cada julgamento soma `ritu_juiz_total{resultado}` com `aprovado` (veredito `ok: true` e `aprovado: true`), `reprovado` (`ok: true` e `aprovado: false`) ou `sem_juiz` (`ok: false`, por `sem_modelo` ou erro).
  - Log `resposta_segura` com `motivo` (D6) em cada ponto onde a saída vira `saidaSegura`: `fim-do-run.ts` `desfecho` (`saida_invalida`; `limite:<fim.motivo>`; o código do erro do fim ou `pausa_inesperada`) e `pausa` (`pausa_invalida`); `juiz-do-run.ts` `entregaSegura` (`juiz`); `continuar.ts` `falhar` (`erro_na_retomada`); `conversar.ts` `respostaSegura` (`erro_na_conversa`). Sem log em `sem_modelo` (essa saída é a montada por código, não a segura).
  - `conversar.ts` (D7): logo depois de escolher o caminho, `telemetry.atribuirAoSpanAtual({ "run.caminho": caminho, "run.intencoes": intencoes.join(",") })`, em todos os caminhos (com e sem agente).
- testes primeiro: `julgar.test.ts`: aprovado, reprovado e sem modelo somam o rótulo certo. Nos testes de `fim-do-run`/`juiz-do-run`/`conversar` (os que já existem), um caso por motivo novo conferindo `logs` com `codigo: "resposta_segura"`, `nivel: "warn"` e o `motivo`; em `conversar`, o span `run` tem `run.caminho` e `run.intencoes` também num caminho sem agente.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: typecheck, `npm test` e `eval:det` verdes.
- fora: `run-service.ts`.

### T8 · Add the vote touch
- nivel: mecanica
- objetivo: criar `tocarVoto`, para o 👍/👎 ter emissor antes da tela.
- arquivos: `src/core/touches/voto.ts` (novo), `src/core/touches/voto.test.ts` (novo), `src/core/touches/index.ts`, `src/core/touches/index.test.ts`
- depende de: T2, T3
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  export function tocarVoto(deps: Deps, contaId: string, runId: string, voto: "up" | "down"): Promise<void>
  // Deps da 011. Dentro do span `toque` (tipo: "voto").
  // Run inexistente, de outra conta ou sem `saida`: RituError "toque_invalido".
  // anterior = runs.votar(...); anterior !== voto → ritu_feedback_total{voto}.
  ```
  `createTouches` ganha `tocarVoto(contaId, runId, voto)`. Busque o run com `deps.stores.runs.buscar(contaId, runId)` (devolve `undefined` para run de outra conta); sem run ou com `saida` nula: `throw new RituError("toque_invalido", "Toque inválido")`.
- testes primeiro (`voto.test.ts`, com `createMemoryStores` e `createMemoryTelemetry`): voto novo soma 1 com `{ voto: "up" }`; voto mudado soma com o novo; o mesmo voto de novo não soma; run de outra conta, inexistente ou sem saída lança `toque_invalido` e não soma; o span `toque` tem `tipo: "voto"`.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`
- pronto quando: os testes passam.
- fora: rota e botões (018); o eval (T15).

### T9 · Add the dashboard and alert definitions
- nivel: mecanica
- objetivo: escrever em TypeScript a definição do painel `Ritu` (cinco linhas) e dos cinco alertas.
- arquivos: `scripts/lib/painel.ts` (novo)
- depende de: T1
- leitura: `.docs/OBSERVABILITY.md` §3 ("Painel e alertas como código")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §3, linha 57
- contratos:
  ```ts
  export type Fonte = "metricas" | "logs" | "traces"
  export type Painel = {
    titulo: string
    descricao: string              // a pergunta que o painel responde, uma frase
    tipo: "timeseries" | "stat" | "barchart" | "bargauge" | "table" | "logs"
    fonte: Fonte
    consultas: { expr: string; legenda?: string }[]
    unidade?: "ms" | "percentunit" | "short"
    limites?: { amarelo: number; vermelho: number }
  }
  export type Linha = { titulo: string; paineis: Painel[] }
  export const PAINEL: { uid: string; titulo: "Ritu"; linhas: Linha[] }
  export type Alerta = { uid: string; titulo: string; expr: string; para: string; resumo: string }
  export const ALERTAS: Alerta[]
  export function TOTAL(m: string, ...por: string[]): string
  // sem `por`: `sum(max_over_time(${m}[$__range]))`; com: `sum by (${por.join(", ")}) (max_over_time(${m}[$__range]))`
  ```
  `PAINEL.uid` = `config.telemetria.grafana.uidDoPainel`. `$__range` nos totais, `$__rate_interval` nas séries. Painéis (copiar as consultas; `p50 | p95` vira duas consultas; `;` separa consultas do mesmo painel):

  | Linha | Painel | Tipo | Consulta |
  |---|---|---|---|
  | 1. Saúde | Runs por hora | timeseries | `sum by (status) (increase(ritu_run_passos_count[1h]))` |
  | | Espera por resposta, p50 e p95 | timeseries, ms | `histogram_quantile(0.5 \| 0.95, sum by (le) (rate(ritu_run_duracao_ms_bucket[$__rate_interval])))` |
  | | Runs que falharam | stat, percentunit, 5% e 10% | `TOTAL(ritu_run_passos_count{status="failed"}) / TOTAL(ritu_run_passos_count)` |
  | | 429 do modelo | stat | `TOTAL(ritu_llm_erros_total{codigo="rate_limit"})` |
  | | Latência do modelo, p95 | timeseries, ms | `histogram_quantile(0.95, sum by (le, modelo) (rate(ritu_llm_duracao_ms_bucket[$__rate_interval])))` |
  | | Latência das tools, p95 | barchart, ms | `histogram_quantile(0.95, sum by (le, tool) (increase(ritu_tool_duracao_ms_bucket[$__range])))` |
  | 2. Agente | Intenções | barchart | `TOTAL(ritu_run_intencao_total, intencao)` |
  | | Caminhos | barchart | `TOTAL(ritu_run_passos_count, caminho)` |
  | | Passos por run | timeseries | `sum by (caminho) (rate(ritu_run_passos_sum[$__rate_interval])) / sum by (caminho) (rate(ritu_run_passos_count[$__rate_interval]))` |
  | | Tools | barchart | `TOTAL(ritu_tool_chamadas_total, tool, status)` |
  | | Violações do validador | barchart | `TOTAL(ritu_validacao_violacoes_total, violacao)` |
  | | Juiz | barchart | `TOTAL(ritu_juiz_total, resultado)`; `TOTAL(ritu_juiz_reprovacoes_total, motivo)`; `TOTAL(ritu_juiz_avisos_total, motivo)` |
  | | Guardrail | barchart | `TOTAL(ritu_guardrail_total, resultado, origem)` |
  | | Pausas | barchart | `TOTAL(ritu_pausas_total, tipo)` |
  | | Memória | barchart | `TOTAL(ritu_rotina_resumo_total, origem)`; `TOTAL(ritu_padroes_total, tipo, etapa)` |
  | 3. Modelos e cota | Chamadas por modelo e papel | timeseries | `sum by (modelo, papel) (increase(ritu_llm_chamadas_total[1h]))` |
  | | Tokens | barchart | `TOTAL(ritu_tokens_total, modelo, direcao)` |
  | | Cota do dia | bargauge, percentunit, 80% e 100% | `max by (modelo) (last_over_time(ritu_llm_cota_usada{janela="dia"}[$__range]))` |
  | | Cota do minuto | timeseries, percentunit | `max by (modelo) (ritu_llm_cota_usada{janela="minuto"})` |
  | | Trocas de modelo | table | `TOTAL(ritu_llm_troca_de_modelo_total, papel, de, para, motivo)` |
  | | Respostas sem modelo | stat, 1 e 1 | `TOTAL(ritu_fallback_sem_llm_total)` |
  | | Erros do modelo | barchart | `TOTAL(ritu_llm_erros_total, modelo, codigo)` |
  | 4. Qualidade | 👍/👎 | barchart | `TOTAL(ritu_feedback_total, voto)` |
  | | Retornos | barchart | `TOTAL(ritu_retorno_total, resultado, origem)` |
  | | Trocas de ingrediente | barchart | `TOTAL(ritu_troca_ingrediente_total, resultado)` |
  | | Gostos | barchart | `TOTAL(ritu_gosto_total, gosto)` |
  | | Faltas | barchart | `TOTAL(ritu_faltas_total, origem)` |
  | | Propostas | barchart | `TOTAL(ritu_propostas_total, tool, decisao)` |
  | | Vale ter em casa | barchart | `TOTAL(ritu_para_ter_total, etapa)` |
  | 5. Rastro | Runs recentes | table, traces | TraceQL `{ name = "run" }`, 20 linhas, com `run.caminho`, `run.status`, `run.passos` e a duração |
  | | Avisos e erros | logs, logs | `{service_name="ritu"} \| severity_text=~"WARN\|ERROR"` |

  "stat, percentunit, 5% e 10%" = `unidade: "percentunit"`, `limites: { amarelo: 0.05, vermelho: 0.1 }`; "80% e 100%" = `{ amarelo: 0.8, vermelho: 1 }`; "1 e 1" = `{ amarelo: 1, vermelho: 1 }`. A consulta TraceQL vai em `expr` (`{ name = "run" }`); as colunas e o limite de 20 linhas o gerador põe (T10). As consultas de Loki e Tempo são o ponto de partida; quem confere na imagem é a T17.
  Alertas (limites de `config.telemetria.alertas`, montados por interpolação, de modo que mudar o config muda a expressão; `para: "0m"`):

  | uid | Título | Expressão |
  |---|---|---|
  | `ritu-cota-do-dia` | Cota do dia acima de 80% | `max by (modelo) (ritu_llm_cota_usada{janela="dia"}) >= 0.8` |
  | `ritu-runs-falhando` | Mais de 10% dos runs falhando em 1 h | `(sum(increase(ritu_run_passos_count{status="failed"}[1h])) / sum(increase(ritu_run_passos_count[1h]))) >= 0.1 and sum(increase(ritu_run_passos_count[1h])) >= 5` |
  | `ritu-sem-modelo` | Resposta montada sem modelo | `sum(increase(ritu_fallback_sem_llm_total[1h])) >= 1` |
  | `ritu-juiz-reprovando` | Juiz reprovando acima de 20% | `(sum(increase(ritu_juiz_total{resultado="reprovado"}[1h])) / sum(increase(ritu_juiz_total[1h]))) >= 0.2 and sum(increase(ritu_juiz_total[1h])) >= 5` |
  | `ritu-429` | 429 frequente | `sum(increase(ritu_llm_erros_total{codigo="rate_limit"}[10m])) >= 5` |

  `resumo` de cada alerta: uma frase em português dizendo o que olhar.
- testes primeiro: nenhum nesta tarefa (o teste do painel é da T12, contra o gerado); confira com `npm run typecheck` e um `it` provisório no scratchpad, se quiser.
- comandos: `npm run typecheck`, `rtk bypass npm run lint`
- pronto quando: typecheck verde; cinco linhas com 6, 9, 7, 7 e 2 painéis; cinco alertas.
- fora: o gerador (T10).

### T10 · Add the Grafana dashboard and alert generators
- nivel: mecanica
- objetivo: gerar o JSON do painel e o YAML das regras de alerta a partir da definição.
- arquivos: `scripts/lib/painel-grafana.ts`, `scripts/lib/painel-grafana.test.ts` (novos)
- depende de: T9
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §3, linha 57
- contratos:
  ```ts
  export function gerarPainel(p: typeof PAINEL): object
  export function gerarAlertas(a: Alerta[]): string
  ```
  - `gerarPainel`: dashboard do Grafana com `uid` e `title` da definição, `schemaVersion` atual da imagem (use 39 se não souber; a T17 confere), intervalo padrão `now-24h` a `now`, as variáveis de template `ds_metricas` (tipo `datasource`, `query: "prometheus"`), `ds_logs` (`loki`) e `ds_traces` (`tempo`); cada painel usa `datasource: { type, uid: "${ds_…}" }` pela `fonte`. Uma linha recolhível (`type: "row"`, `collapsed: false`) por `Linha`, seguida dos painéis dela; painéis com 12 colunas de largura (`stat` com 6) e 8 de altura, posicionados em grade sem sobreposição (`gridPos` calculado). `fieldConfig.defaults.unit` pela `unidade`; `thresholds` pelos `limites` (verde, amarelo, vermelho). Painel `traces` do tipo `table` com a consulta TraceQL, `limit: 20` e as colunas `run.caminho`, `run.status`, `run.passos` e a duração. Painel `logs` com a consulta Loki. `description` = `descricao`. Os ids dos painéis são sequenciais (determinístico).
  - `gerarAlertas`: YAML de provisionamento de regras do Grafana, `apiVersion: 1`, um grupo `ritu` na pasta `config.telemetria.grafana.pasta` (`Ritu`), `interval: 1m`; cada regra com `uid`, `title`, a consulta Prometheus (datasource uid `config.telemetria.grafana.uidMetricas`, últimos 10 min) e a condição sobre ela, `for: <para>`, `noDataState: OK` (sem dados = normal), `execErrState: Error` (erro de execução = erro), `labels: { gravidade: aviso }`, `annotations: { summary: <resumo> }`; nenhuma política nem ponto de contato. YAML gerado com a biblioteca `yaml` (já instalada), determinístico.
- testes primeiro (`painel-grafana.test.ts`): as três variáveis; uma `row` por linha; nenhum painel sobreposto e nenhum passa de 24 colunas; o painel de cota do dia com `percentunit` e os limites; `gerarAlertas` tem `apiVersion: 1`, cinco regras com os uids, `noDataState: OK`, `execErrState: Error`, `gravidade: aviso` e nenhuma chave `contactPoints` ou `policies`; duas gerações iguais.
- comandos: `npm run typecheck`, `npx vitest run scripts/lib/painel-grafana.test.ts`, `rtk bypass npm run lint`
- pronto quando: os testes passam.
- fora: escrita dos arquivos (T12).

### T11 · Add the painel:check library
- nivel: mecanica
- objetivo: a lógica do `painel:check` (consultar o Grafana, dizer painel por painel se há dados, listar séries) como funções puras com `fetch` injetado.
- arquivos: `scripts/lib/painel-check.ts`, `scripts/lib/painel-check.test.ts` (novos)
- depende de: T9
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §3, linha 57
- contratos (D11):
  ```ts
  export type Busca = (url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }) => Promise<{ status: number; json(): Promise<unknown> }>
  export async function conferirPainel(p: { url: string; busca: Busca; agora: number }): Promise<{ codigo: 0 | 1 | 2; linhas: string[] }>
  export function seriesEsperadas(): string[]   // os nomes de METRICAS, com `_bucket`, `_count` e `_sum` nos histogramas
  ```
  Usa a API HTTP do Grafana em `url` (o LGTM entra como admin anônimo):
  - Grafana fora do ar (a busca lança ou `GET /api/health` não é 200): `codigo: 2`, linha `Grafana não responde em <url>`.
  - `GET /api/dashboards/uid/ritu` não 200, ou `GET /api/v1/provisioning/alert-rules` sem as cinco regras de `ALERTAS` (por `uid`): `codigo: 1`, uma linha por ausência.
  - Para cada consulta de métrica do painel (`fonte: "metricas"`), `POST /api/ds/query` nas últimas 24 h (`from = agora − 24 h`, `to = agora`, datasource uid `config.telemetria.grafana.uidMetricas`); painel com algum quadro com valores: `com dados`; sem: `sem dados`. Uma linha por painel: `<linha> · <painel>: com dados | sem dados`.
  - Lista os nomes `ritu_*` que o Prometheus conhece (pelo proxy do datasource: `GET /api/datasources/proxy/uid/<uidMetricas>/api/v1/label/__name__/values`); imprime as séries esperadas (`seriesEsperadas`) que não existem e as `ritu_*` que existem sem estar no painel.
  - Grafana no ar e nenhuma série `ritu_*`: todos `sem dados`, `codigo: 0`.
- testes primeiro (`painel-check.test.ts`, com uma `busca` falsa por URL): Grafana fora → 2; painel ausente → 1; regras faltando → 1; tudo presente com um painel com dados e outro sem → 0 e as linhas; séries que faltam e que sobram; `seriesEsperadas` inclui `ritu_run_passos_count` e `ritu_tokens_total`.
- comandos: `npm run typecheck`, `npx vitest run scripts/lib/painel-check.test.ts`, `rtk bypass npm run lint`
- pronto quando: os testes passam.
- fora: o script (T12).

### T12 · Add painel:gerar and painel:check, generate the dashboard files and lock them
- nivel: mecanica
- objetivo: criar os dois comandos, gerar `ritu.json` e `ritu.yaml`, e o teste que trava o gerado e a cobertura das métricas.
- arquivos: `scripts/painel.ts`, `scripts/painel-check.ts`, `scripts/lib/painel.test.ts`, `observability/dashboards/ritu.json`, `observability/grafana/alerting/ritu.yaml` (novos), `package.json`
- depende de: T10, T11
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `package.json`: `"painel:gerar": "tsx scripts/painel.ts"` e `"painel:check": "tsx scripts/painel-check.ts"`.
  - `scripts/painel.ts`: grava `observability/dashboards/ritu.json` (`JSON.stringify(gerarPainel(PAINEL), null, 2) + "\n"`) e `observability/grafana/alerting/ritu.yaml` (`gerarAlertas(ALERTAS)`, com fim de linha), criando as pastas. Rodar duas vezes não muda nada.
  - `scripts/painel-check.ts` (⚠️ no comentário de topo: fala com o Grafana local): `conferirPainel({ url: config.telemetria.grafana.url, busca: fetch adaptado, agora: Date.now() })`, imprime as linhas e sai com o código.
  - `scripts/lib/painel.test.ts`: o JSON e o YAML commitados são iguais ao que `gerarPainel`/`gerarAlertas` produzem hoje (falha se alguém editou à mão ou mudou a definição sem gerar); toda métrica de `METRICAS` aparece em alguma consulta do painel (pelo nome-base, aceitando `_bucket`, `_count`, `_sum` nos histogramas); toda consulta de métrica só cita nomes `ritu_*` de `METRICAS` (com os sufixos dos histogramas); toda expressão de `ALERTAS` só cita nomes de `METRICAS`.
- testes primeiro: `painel.test.ts` antes de gerar os arquivos (falha por arquivo ausente); depois `npm run painel:gerar`.
- comandos: `npm run painel:gerar` (duas vezes; `git status` sem diff na segunda), `npm run typecheck`, `npx vitest run scripts/lib`, `rtk bypass npm run lint`
- pronto quando: o teste passa; a segunda geração não muda nada.
- fora: `docker-compose.yml` (T17).

### T13 · Build the OTel exporter options and turn on metrics and logs in Next
- nivel: nucleo
- objetivo: um ponto só para os exportadores e o recurso do OTel, usado pelo SDK dos scripts (com exportação a cada 5 s) e pelo `register()` do Next (traces, métricas e logs).
- arquivos: `src/infra/otel/opcoes.ts`, `src/infra/otel/opcoes.test.ts`, `src/instrumentation.test.ts` (novos), `src/infra/otel/node-sdk.ts`, `src/instrumentation.ts`
- depende de: T1
- leitura: `.docs/OBSERVABILITY.md` §3 ("Ambientes")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §3, linha 57
- contratos:
  - `src/infra/otel/opcoes.ts`: `opcoesDoOtel({ intervaloMs })` devolve `{ traceExporter, metricReader, logRecordProcessor, resource }`: exportadores OTLP HTTP de trace, métrica (num `PeriodicExportingMetricReader` com `exportIntervalMillis: intervaloMs`) e log (num `BatchLogRecordProcessor`), e o recurso com `service.name` (`OTEL_SERVICE_NAME` ou `ritu`) e `service.instance.id` (um `randomUUID()` por processo). Endpoint e headers pelas variáveis padrão do OTel (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`), lidas pelos próprios exportadores; nenhuma variável nova.
  - `node-sdk.ts`: `iniciarOtelNode()` usa `opcoesDoOtel({ intervaloMs: config.telemetria.exportacaoNosScriptsMs })`; continua só ligando com endpoint; `encerrar` faz `shutdown` (que descarrega tudo).
  - `src/instrumentation.ts`: com endpoint, liga traces, métricas e logs com as mesmas opções. `@vercel/otel` 2.3.0 aceita `metricReaders` e `logRecordProcessors` em `registerOTel` (conferido no `types.d.ts`): `registerOTel({ serviceName, traceExporter, metricReaders: [metricReader], logRecordProcessors: [logRecordProcessor], attributes: { "service.instance.id": … } })` (ou o campo de recurso que a versão instalada aceitar; confira). Intervalo de exportação no Next: o padrão do leitor (não o dos scripts). Sem endpoint, não importa nada de OTel (nem `opcoes.ts`): o import é dinâmico e fica depois da checagem. Se, ao conferir, `registerOTel` não aceitar um dos dois, use no runtime `nodejs` o `NodeSDK` de `node-sdk.ts` e diga no relatório (o orquestrador anota).
- testes primeiro: `opcoes.test.ts`: o recurso tem `service.name` e um `service.instance.id` em formato uuid, diferente em duas chamadas de processos simulados (ou igual dentro do processo, se for módulo; documente); o leitor de métricas usa o intervalo pedido. `src/instrumentation.test.ts`: com `vi.mock("@vercel/otel")` como espião e o endpoint definido em `process.env` (guardado e restaurado), `register()` chama `registerOTel` com leitor de métricas e processador de logs; sem endpoint, `register()` não importa `@vercel/otel` nem `./infra/otel/opcoes` (espião não chamado).
- comandos: `npm run typecheck`, `npm test`, `npm run build`, `rtk bypass npm run lint`
- pronto quando: typecheck, `npm test` e build verdes.
- fora: os scripts (T16).

### T14 · Add the telemetry mirror for scenarios
- nivel: nucleo
- objetivo: deixar um cenário repassar toda a telemetria a outra `Telemetry` (o OTel do container ou o adaptador real com exportadores em memória), sem perder o que os evals leem da memória.
- arquivos: `src/infra/fakes/tee-telemetry.ts`, `src/infra/fakes/tee-telemetry.test.ts` (novos), `test/fixtures/cenarios/montar.ts`
- depende de: T3, T5 (a T5 mexe em `montar.ts`: esta tarefa vem depois)
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 51
- contratos (D3):
  ```ts
  export function createTeeTelemetry(memoria: MemoryTelemetry, outra: Telemetry): MemoryTelemetry
  // OpcoesDoCenario ganha: telemetria?: Telemetry
  ```
  - `span(nome, atributos, fn, opts)`: abre o span na `memoria` e, dentro dele, na `outra` (ambos com os mesmos atributos e `opts`); o `SpanAtivo` passado a `fn` repassa `atribuir` e `falhar` aos dois. Exceção sobe pelos dois.
  - `evento`, `contador`, `histograma`, `medidor`, `atribuirAoSpanAtual`, `log`: chama os dois (a `memoria` primeiro: se ela lançar `rotulos_invalidos` ou `atributo_proibido`, a outra não recebe).
  - `traceparentAtual`: o da `outra`, se houver; senão o da `memoria`.
  - `encerrar`: os dois.
  - `spans`, `eventos`, `metricas`, `logs`: os da `memoria`.
  - `montarCenario`: com `opts.telemetria`, `telemetry = createTeeTelemetry(createMemoryTelemetry(), opts.telemetria)`; sem, como hoje. `deps.telemetry` continua `MemoryTelemetry`.
- testes primeiro (`tee-telemetry.test.ts`, com duas `createMemoryTelemetry`, a segunda no papel de `outra`): span aninhado aparece nos dois com o pai certo; `atribuirAoSpanAtual` chega aos dois; métrica com rótulo inválido lança e não chega à outra; `traceparentAtual` vem da outra; `log` dentro de `run` ganha `run.id` nos dois. Um teste de `montarCenario` com `telemetria` (no próprio arquivo de teste do tee, importando de `test/fixtures/cenarios`): um cenário de `cenarios` roda e a outra recebe o span `run`.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: typecheck, `npm test` e `eval:det` verdes.
- fora: os scripts (T16).

### T15 · Add the vote eval
- nivel: mecanica
- objetivo: o eval determinístico do toque de voto.
- arquivos: `evals/det/telemetria/voto.eval.ts` (novo)
- depende de: T8
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: sobre um cenário de `cenarios` montado com `montarCenario` e rodado até `done` (com saída), usando `deps.touches.tocarVoto`: voto novo soma `ritu_feedback_total{voto: "up"}`; voto mudado soma `{voto: "down"}`; voto repetido não soma; run de outra conta (crie uma segunda conta em `deps.stores.accounts.criar({ tipo: "demo" })`) lança `toque_invalido` e não soma; nenhum rótulo leva id. O mapa entra na T20 (D13).
- testes primeiro: o próprio eval.
- comandos: `npm run typecheck`, `npx vitest run --config vitest.eval.config.ts evals/det/telemetria/voto.eval.ts`, `rtk bypass npm run lint`
- pronto quando: o eval passa (o `mapa.eval.ts` acusa o arquivo novo até a T20: esperado).
- fora: `evals/det/mapa.ts`.

### T16 · Turn on OTel in demo and eval:llm
- nivel: mecanica
- objetivo: com `OTEL_EXPORTER_OTLP_ENDPOINT`, `npm run demo` e `npm run eval:llm` exportam traces, métricas e logs dos runs e descarregam tudo antes de sair; sem a variável, nada de OTel é carregado.
- arquivos: `scripts/demo.ts`, `scripts/eval-llm.ts`, `scripts/lib/evals/rodar-run.ts`, `scripts/lib/evals/rodar-apoio.ts`, `scripts/lib/evals/rodar-run.test.ts`, `scripts/lib/evals/rodar-apoio.test.ts`
- depende de: T13, T14
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Como `scripts/loop-demo.ts`: `await container.iniciarTelemetria()` no começo e `await container.encerrar()` no `finally` (também em erro e no `--listar`/lista de cenários, que não abrem nada). Sem endpoint, `iniciarTelemetria` não faz nada e `container.telemetry` é a nula (nada de OTel importado).
  - `demo.ts`: `montarCenario(c, { …, telemetria: container.telemetry })`.
  - Rodadores do eval: `rodarAcompanhante`/`rodarConversa` aceitam `telemetria?: Telemetry` nas opções e repassam a `montarCenario`; `rodarInterprete`/`rodarMemoria`/`rodarJuiz` aceitam `telemetria?: Telemetry` em `DepsDeApoio` e usam `createTeeTelemetry(createMemoryTelemetry(), telemetria)` no lugar da memória quando vier. `eval-llm.ts` passa `container.telemetry` a todos e ao avaliador (que já recebe `telemetry`).
  - O `--listar` do `eval:llm` continua sem tocar no container (não chama `iniciarTelemetria`).
- testes primeiro: em `rodar-run.test.ts` e `rodar-apoio.test.ts`, um caso com `telemetria` (uma `createMemoryTelemetry` extra) que recebe o span `run` (conversa) e o span `interprete` (Intérprete).
- comandos: `npm run typecheck`, `npm test`, `npm run demo` (só a lista, sem LLM) e `npm run demo -- --cenario frio-agitada` (roteirizado, sem LLM), `npm run eval:llm -- --checkpoint c1-base --listar`, `rtk bypass npm run lint`
- pronto quando: typecheck e `npm test` verdes; os dois comandos sem LLM saem com 0.
- fora: `container.ts`.

### T17 · Provision the dashboard and alerts in the local LGTM
- nivel: mecanica
- objetivo: fixar a imagem do LGTM e montar o provisionamento, para o painel `Ritu` e as cinco regras aparecerem no Grafana local sem passo manual.
- arquivos: `docker-compose.yml`, `observability/grafana/dashboards.yaml` (novo); `scripts/lib/painel.ts`, `scripts/lib/painel-grafana.ts`, `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml` só se a conferência na imagem mudar o nome do rótulo de serviço, do campo de severidade, do uid do datasource ou do `schemaVersion` (regerar com `npm run painel:gerar`)
- depende de: T12
- leitura: `.docs/ARCHITECTURE.md` §7 (árvore de `observability/`)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §3, linha 57
- contratos (D14):
  - `lgtm` com a imagem numa tag fixa (`grafana/otel-lgtm:<versão>`; a versão da imagem local, `docker image inspect grafana/otel-lgtm`, ou a estável mais recente) e três volumes só leitura: `observability/grafana/dashboards.yaml` e `observability/grafana/alerting/ritu.yaml` nos diretórios de provisionamento do Grafana da imagem (`…/provisioning/dashboards/` e `…/provisioning/alerting/`, com nomes de arquivo que **somam** aos que a imagem já tem, sem sobrescrever), e `observability/dashboards/` no diretório que o provedor aponta. Confira os caminhos com `docker run --rm --entrypoint sh grafana/otel-lgtm:<versão> -c 'ls -R <raiz do grafana>/conf/provisioning'` (ou o equivalente da imagem).
  - `observability/grafana/dashboards.yaml`: provedor de dashboards escrito à mão (`apiVersion: 1`, provedor `ritu`, `folder: Ritu`, `allowUiUpdates: false`, `type: file`, `options.path` = onde `observability/dashboards/` é montada).
  - Confira na imagem fixada: o uid do datasource Prometheus (`config.telemetria.grafana.uidMetricas` = `prometheus`), o nome do rótulo de serviço no Loki (`service_name`) e o campo de severidade (`severity_text`), e o `schemaVersion` do Grafana. Se algum diferir, ajuste a definição (`painel.ts`, ou `painel-grafana.ts` para o `schemaVersion`) e regere; diga no relatório cada diferença (o orquestrador anota em `.plans/DECISOES-AUTONOMAS.md`). `uidMetricas` diferente: diga e pare (mudar `config/` está fora desta tarefa).
  - Imagem sem os diretórios de provisionamento esperados: pare e informe a saída do `ls` (o orquestrador registra em `.plans/BLOQUEIOS.md`).
- testes primeiro: nenhum automático; a conferência é com o Docker (abaixo).
- comandos: `docker compose up -d`, esperar o Grafana subir, `curl -s localhost:3001/api/dashboards/uid/ritu` (200) e `curl -s localhost:3001/api/v1/provisioning/alert-rules` (as cinco regras), `npm run painel:check` (sai com 0: painel e regras carregados), `npx vitest run scripts/lib`, `rtk bypass npm run lint`
- pronto quando: com `docker compose up -d`, o painel `Ritu` (uid `ritu`) e as cinco regras da pasta `Ritu` aparecem sem passo manual; `painel:check` sai com 0.
- fora: notificação, ponto de contato, política (nada disso é configurado).

### T18 · Test privacy through the real OTel adapter and the Mastra runtime
- nivel: nucleo
- objetivo: provar, pelo adaptador OTel de verdade com exportadores em memória, que um cenário e uma chamada pelo runtime da Mastra exportam só nomes da lista fechada e nenhum canário.
- arquivos: `src/infra/otel/privacidade.test.ts` (novo)
- depende de: T4, T5, T6, T7, T14
- leitura: `.docs/OBSERVABILITY.md` §3 ("Privacidade")
- skills: `mastra`
- referencia: `.local/REFERENCIAS.md` §3, linha 57
- contratos:
  - Provedores globais de teste: `BasicTracerProvider` com `InMemorySpanExporter` e `SimpleSpanProcessor`; `MeterProvider` com `InMemoryMetricExporter` e um leitor com `forceFlush` (ou `PeriodicExportingMetricReader` descarregado no fim); `LoggerProvider` com `InMemoryLogRecordExporter` e `SimpleLogRecordProcessor`; `AsyncLocalStorageContextManager` e `W3CTraceContextPropagator` (veja `telemetry.test.ts`). Desligue tudo no `afterAll`.
  - Um cenário (um de `cenariosDeConversa` com mensagem, perfil com cidade e casa com nome livre) montado com `montarCenario(c, { telemetria: createOtelTelemetry() })`, com os canários `zibelina` e `quarzo7` plantados na mensagem, no nome livre da casa, no "evitar sempre" em texto livre, na nota de rotina e no nome da cidade (pelos campos do cenário; o que não tiver campo, pelos `deps.stores` antes de `rodarCenario`).
  - Uma chamada pelo runtime da Mastra com o modelo fixo: `createMastraRuntime({ …, modeloDe: () => <modelo falso> })` (veja `modeloFalso` em `src/infra/mastra/runtime.test.ts`), um passo com uma mensagem com canário, dentro de um span `run` do adaptador OTel.
  - Confere: todo span exportado tem nome em `SPANS`; toda métrica exportada tem nome em `METRICAS` (nos pontos de dados, os rótulos são exatamente os declarados); todo log tem `body` em `LOGS`; nenhum atributo, rótulo ou corpo contém canário; todo valor de texto casa com `^[a-z0-9][a-z0-9_.:,\-]{0,63}$` (D9).
  - D15: se a Mastra emitir spans pelo tracer global com nome fora de `SPANS`, pare e informe os nomes (não mude `OPCOES_DE_TRACE` nem a configuração da Mastra).
- testes primeiro: o próprio arquivo; rode-o uma vez com um canário posto de propósito num atributo permitido (sem salvar) e veja-o falhar.
- comandos: `npm run typecheck`, `npx vitest run src/infra/otel`, `npm test`, `rtk bypass npm run lint`
- pronto quando: o teste passa.
- fora: código de produto.

### T19 · Add the telemetry coverage eval
- nivel: mecanica
- objetivo: provar que a suíte de cenários emite todo span, toda métrica e os sete logs da lista, com os atributos e rótulos declarados.
- arquivos: `evals/det/telemetria/cobertura.eval.ts` (novo); se faltar cenário para algum nome, cenários novos em `test/fixtures/cenarios/<nome>.ts` (novos) e o registro `cenariosDeTelemetria` em `test/fixtures/cenarios/index.ts` (D10)
- depende de: T4, T5, T6, T7, T8
- leitura: `.docs/OBSERVABILITY.md` §3 ("Árvore de spans de um run")
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Roda todos os cenários de todos os registros de `test/fixtures/cenarios/index.ts` (cada um com `montarCenario` e `rodarCenario`, como os evals de cenário de hoje), mais: `frio-agitada` com `{ esgotar: "decisao" }` (troca de modelo); os quatro toques (`tocarRetorno`, `tocarGosto`, `trocarIngrediente`, `tocarVoto`) sobre runs entregues; `deps.patterns` (detecção diária) num cenário com histórico. Junta spans, métricas e logs de todos.
  - Confere: todo nome de `SPANS` e de `METRICAS` emitido pelo menos uma vez; os logs `run_inicio`, `run_fim`, `clima_indisponivel`, `troca_de_modelo`, `sem_modelo`, `llm_erro` e `resposta_segura` emitidos; todo span sem `falha` tem os atributos obrigatórios de `SPANS[nome]`; todo span `run` de caminho com agente (`run.caminho` = `acompanhante`) tem `prompt.versao`; todo `tool.chamada` de `clima.agora` e `clima.proximas_horas` tem `cache.hit`.
  - Nome sem cenário (ex.: `ritu_llm_erros_total`/`llm_erro`, que pede um `LlmError` do modelo: `createFakeLlm` com `{ erro: "rate_limit" }` para o Intérprete): crie o cenário no registro `cenariosDeTelemetria` (não listado no `demo` nem travado em `montar.test.ts`).
  - Atributo obrigatório ausente num span, ou nome que só sai mudando código de produto: **pare e diga** qual span, qual atributo e onde ele nasce (o orquestrador abre a correção). Não mude código de produto.
  - O mapa entra na T20 (D13).
- testes primeiro: o próprio eval, escrito antes dos cenários novos.
- comandos: `npm run typecheck`, `npx vitest run --config vitest.eval.config.ts evals/det/telemetria/cobertura.eval.ts`, `npm test` (se mexeu em `test/fixtures`), `rtk bypass npm run lint`
- pronto quando: o eval passa.
- fora: `evals/det/mapa.ts`; código de produto.

### T20 · Replace the companion privacy eval by the full one and map the new evals
- nivel: mecanica
- objetivo: o eval de privacidade que cobre todos os caminhos (cenários, toques, detecção de padrões e console), no lugar do da 007, e as linhas novas no mapa da 014.
- arquivos: `evals/det/telemetria/privacidade.eval.ts` (novo), `evals/det/acompanhante/privacidade.eval.ts` (sai), `evals/det/mapa.ts`
- depende de: T15, T18, T19, T12
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `privacidade.eval.ts`: canários `zibelina` e `quarzo7` plantados em: texto da mensagem, nome livre na casa, texto livre de "evitar sempre", nota de rotina, nome da cidade e e-mail da conta (pelos campos do cenário; o que não tiver campo, pelos `deps.stores` depois de `montarCenario` e antes de `rodarCenario`). Roda todos os cenários de todos os registros, os quatro toques e a detecção de padrões; junta spans (atributos), eventos, métricas (rótulos), logs (campos), o `resumo` de todas as etapas dos runs e o console (espião em `console.log`, `info`, `warn`, `error` durante tudo). Falha com canário (sem diferenciar maiúsculas) ou nome de alimento da base (`kb` real; palavra inteira, texto normalizado) em qualquer um; falha com valor de texto fora de `^[a-z0-9][a-z0-9_.:,\-]{0,63}$` em span, evento, métrica ou log (D9: o `resumo` e o console só pelo canário e pelo nome de alimento). Porte os ajudantes do eval que sai.
  - `evals/det/acompanhante/privacidade.eval.ts` sai (o novo cobre o que ele cobria).
  - `mapa.ts`: a linha de "Segurança e privacidade" que hoje começa com "Nenhum span, métrica ou log do fake de telemetria contém texto da pessoa" passa a apontar para `evals/det/telemetria/privacidade.eval.ts` e `src/infra/otel/privacidade.test.ts` (e para os outros evals de privacidade que já apontava, menos o que saiu), com `linha` = o começo do texto novo: "Nenhum span, métrica, log, `resumo` ou saída de console contém texto da pessoa, nome de alimento ou valor fora do formato de identificador, no fake e no adaptador OTel" (até 60 caracteres). Grupo novo `Telemetria`, `desde: 2`: "Todo span, métrica e log da lista fechada é emitido por algum cenário, com os atributos e rótulos declarados" → `evals/det/telemetria/cobertura.eval.ts`; "O painel cobre todas as métricas" → `scripts/lib/painel.test.ts` (D12); "O toque de voto soma 👍/👎 só quando o voto é novo ou mudou" → `evals/det/telemetria/voto.eval.ts`. Qualquer outra entrada que citasse `evals/det/acompanhante/privacidade.eval.ts` deixa de citá-lo.
- testes primeiro: o eval novo antes de apagar o velho; rode-o com um canário vazando de propósito (sem salvar) e veja-o falhar.
- comandos: `npm run typecheck`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: `npm run eval:det` inteiro verde, inclusive `mapa.eval.ts`.
- fora: código de produto.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2 | Sem dependência; `nomes.ts` e `config/` numa, a porta `votar` e os stores na outra |
| 2 | T3 | Muda a porta `Telemetry`, usada em todo o core: roda sozinha |
| 3 | T4, T5, T8, T9, T13 | Dependem só de T1 a T3; arquivos distintos (`run-service`, cache do clima e `montar.ts`, toques, `scripts/lib/painel.ts`, `src/infra/otel/opcoes.ts` e `instrumentation`) |
| 4 | T6 | Muda `usou` e o `Deps` de `chamarComPapel` e `chamarApoio`, usados por vários agentes: roda sozinha |
| 5 | T7, T10, T11, T14, T15 | T7 depois da T6 (`julgar.ts`); T10 e T11 da T9; T14 da T5 (`montar.ts`); T15 da T8; arquivos distintos |
| 6 | T12 | Mexe em `package.json`: roda sozinha |
| 7 | T16, T17, T18, T19 | T16 depende de T13 e T14; T17 de T12; T18 de T4 a T7 e T14; T19 de T4 a T8; arquivos distintos (T19 só cria arquivos em `test/fixtures/cenarios/` e o registro novo em `index.ts`, que nenhuma outra da onda toca) |
| 8 | T20 | Precisa dos três evals e do teste do painel para fechar o mapa |

## Fechamento

O orquestrador, depois da T20:

1. Mandar o `verificador` rodar os gates 1 a 6, `npm run dup` e `npm run test:db` (Docker no ar) no repositório inteiro, e `npm run painel:gerar` sem diff.
2. Com `docker compose up -d` e `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` só na linha de comando (sem mexer em `.env.local`): `npm run demo -- --cenario frio-agitada --esgotar decisao` (roteirizado, sem LLM), depois `npm run painel:check` (saída 0) e conferir a troca de modelo na linha "Modelos e cota". Print do painel com a skill `playwright`, salvo em `.plans/015-painel.png`. Lembrar (D4): no cenário, as latências saem 0.
3. ADR `0042` (ou o próximo número livre depois da 0041 da 014; conferir `.adrs/README.md`): "Telemetria com lista fechada tipada e painel gerado" — registros `SPANS`/`METRICAS`/`LOGS` com atributos, tipo, rótulos e nível; fake que recusa rótulo fora do declarado; `run.id` nos logs pelo contexto; duração por trecho e passos no encerramento; painel e alertas gerados de TypeScript e travados por teste; alertas sem notificação; LGTM fixado; espelho de telemetria nos cenários (D3). Atualizar o índice.
4. Docs:
   - `OBSERVABILITY.md` §3: árvore (condicionais `prompt.versao`, `cache.hit`), tabela de métricas (já tem `ritu_llm_duracao_ms`, `ritu_tool_duracao_ms`, falta `ritu_juiz_total{resultado}`: conferir), logs (níveis; `padroes_conta_falhou`, D1), painel e alertas (comandos, provisionamento, imagem fixada), privacidade (eval e teste do adaptador); §5 (o que o portão 2 confere: painel com dados da rodada do `c3`).
   - `QA.md` "Segurança e privacidade": trocar a linha de telemetria por "Nenhum span, métrica, log, `resumo` ou saída de console contém texto da pessoa, nome de alimento ou valor fora do formato de identificador, no fake e no adaptador OTel"; em "Evals determinísticos", grupo `Telemetria` com "Todo span, métrica e log da lista fechada é emitido por algum cenário, com os atributos e rótulos declarados", "O painel cobre todas as métricas" e a linha do voto. Conferir que o mapa (`evals/det/mapa.ts`) bate com o texto novo.
   - `ARCHITECTURE.md` §7: árvore de `observability/` (`dashboards/ritu.json`, `grafana/dashboards.yaml`, `grafana/alerting/ritu.yaml`, gerados e escritos à mão).
   - `DEVELOPMENT.md`: "Telemetria pela porta `Telemetry`" com `log(codigo, campos)` e o nível vindo da lista.
5. `AGENTS.md`, tabela de comandos: `npm run painel:gerar` e ⚠️ `npm run painel:check`; `docker compose up -d` com o painel e as regras provisionados; `npm run demo` e `npm run eval:llm` exportam com o endpoint.
6. Marcar a spec `implemented`, com o hash.
7. Notas para o relatório da entrega 2: D1 (`padroes_conta_falhou` em vez do nome da spec), D3 (espelho), D4 (latência 0 nos cenários e no `eval:llm`: o painel da rodada do `c3` não terá latência), D5, D10, D14 (tag do LGTM), D15 (se ocorreu); runs fechados por `mudarStatus` (cancelado na abertura de outro, ou `done` de um bloco abandonado) não entram em `ritu_run_passos`; o que a T17 achou de diferente na imagem.
8. Fechamento da entrega 2, logo depois desta spec (não é desta spec): ⚠️ `npm run eval:llm -- --checkpoint c3-confiavel` com `OTEL_EXPORTER_OTLP_ENDPOINT` ligado e o LGTM no ar; o relatório do portão 2 leva o `painel:check` e um print do painel depois da rodada.
