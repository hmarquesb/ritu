# 023 · Bastidores e MCP · Plano

Spec: `.specs/023-bastidores-e-mcp.md`. Entrega 4, na `main`, depois da 027.

**Como ler os contratos.** A spec traz cada contrato por extenso na seção "Contratos". Para não duplicar 400 linhas, cada tarefa cita a subseção exata (pelo título em negrito, ex.: `Contratos › **Porta (src/core/bastidores/ports.ts)**`) e os critérios de aceite que ela cobre. O subagente lê **só** essas subseções e critérios da spec, mais o campo `leitura`.

Regras comuns: zod em toda borda; `src/core/` só importa `src/core/`, `config/` e zod; tempo pelo `Clock`; nada de texto de pessoa, nome de cidade, nome de alimento ou argumento de tool em span, métrica ou log; números em `config/`; nada em `data/`.

### T1 · Install the MCP packages and fence them in the architecture test
- nivel: mecanica
- objetivo: instalar `mcp-handler` e `@modelcontextprotocol/server` (2.x) e travar no teste de arquitetura que só `src/infra/mcp/**` e `src/app/api/mcp/**` os importam; incluir o histórico no tracing do Next.
- arquivos: `package.json`, `package-lock.json`, o teste de arquitetura (procure com `grep -rln "R10" test src --include=*.test.ts`), `next.config.ts`
- depende de: nenhuma
- leitura: spec 023 `Contratos › **Pacotes**`, `Contratos › **Arquitetura**` e, em `Contratos › **Histórico**`, a linha do `next.config.ts`
- skills: nenhuma
- contratos: `npm install mcp-handler@^2 @modelcontextprotocol/server@^2` (2.4.0 no dia; se o `mcp-handler` pedir outra versão do server como peer, use a que ele pede e anote no relatório). Regra nova no teste de arquitetura: importar `mcp-handler` ou `@modelcontextprotocol/*` fora de `src/infra/mcp/**` e `src/app/api/mcp/**` falha; com um caso que viola e um que passa, no estilo das regras existentes. `next.config.ts`: `outputFileTracingIncludes["/**"]` ganha `"./evals/resultados/historico.json"`.
- testes primeiro: os dois casos da regra nova.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: pacotes no `package.json` com `^2`; regra nova verde; build verde.
- fora: qualquer código que use os pacotes.

### T2 · Add the sinais_dia table and the BastidoresStore port with its adapters
- nivel: mecanica
- objetivo: tabela `sinais_dia`, porta `BastidoresStore`, adaptador Postgres, fake em memória e suíte de contrato contra os dois.
- arquivos: `db/migrations/0007_sinais_dia.sql`, `src/core/bastidores/ports.ts`, `src/infra/db/bastidores.ts`, `src/infra/fakes/memory-bastidores.ts`, `test/contracts/bastidores.contract.ts`, o teste que roda a suíte com o fake (siga o padrão dos outros contratos, ex.: `grep -rln "contract" test src --include=*.test.ts`), o registro da suíte no `test:db` (siga o padrão), e as leituras internas que faltarem nos fakes de memória de runs, feedback e retornos (só acrescentar)
- depende de: nenhuma
- leitura: spec 023 `Contratos › **Tabela sinais_dia**` e `Contratos › **Porta (src/core/bastidores/ports.ts)**` (com os três itens abaixo dela); critérios "Quem conta", "Indicadores", "Registro idempotente"
- skills: nenhuma
- contratos: os da spec, por extenso, nessas subseções. `toolsFora` e `topTools` chegam por parâmetro (a config é da T3). Migração só acrescenta.
- testes primeiro: a suíte de contrato da spec (janela inclusiva, status fora, caminho fora, juiz nulo fora, `toolsFora`, empate por id, idempotência do registro, voto de conta apagada depois do registro), rodando com o fake em `npm test`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; ⚠️ não rode `test:db` (fica para o fechamento)
- pronto quando: suíte verde com o fake; adaptador Postgres compila e segue o padrão dos outros.
- fora: `container.ts`, `cleanup.ts`, config.

### T3 · Add the Bastidores config, texts and MCP limits
- nivel: mecanica
- objetivo: `config/bastidores.ts`, `config/textos-bastidores.ts`, `limites.mcp`, expostos em `config/index.ts`.
- arquivos: `config/bastidores.ts`, `config/textos-bastidores.ts`, `config/limites.ts`, `config/index.ts`, e o teste de config que trava a forma, se houver
- depende de: nenhuma
- leitura: spec 023 `Contratos › **Configuração**`, `**Limites (config/limites.ts, acréscimo)**` e `**Textos (config/textos-bastidores.ts…)**` (as tabelas de chaves, de `familias` e de `metricas`, com o `formato` de cada métrica)
- skills: nenhuma
- contratos: os da spec, por extenso. Em `textosBastidores.metricas`, cada entrada leva `id`, `rotulo` e `formato` (`"pct" | "num" | "ms" | "contagem"`), na ordem da tabela. Textos com `{marcador}` ficam como estão (quem usa interpola). `familias` tem uma entrada por `Familia` da 014 (o tipo existe em `evals/llm/` ou `scripts/lib/evals/`; importe se `config/` já importar de lá, senão use as chaves literais e um teste que compara com `FAMILIAS`).
- testes primeiro: `textosBastidores.metricas` cobre toda métrica de `config/evals.ts` que tem meta; `familias` cobre `FAMILIAS`; `bastidores.destaques` são ids de `metricas`; `checkpoints` cobre as chaves de `evals/llm/checkpoints.ts`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: quem usa a config.

### T4 · Move the history schema to core and read it at runtime
- nivel: mecanica
- objetivo: `historicoSchema` e `Historico` passam para `src/core/evals/historico.ts`; `lerHistorico` em `src/infra/evals/historico.ts`.
- arquivos: `src/core/evals/historico.ts` (novo), `src/core/evals/historico.test.ts` (novo, se precisar), `src/infra/evals/historico.ts` (novo), `src/infra/evals/historico.test.ts` (novo), `scripts/lib/evals/historico.ts`, e os imports de `historicoSchema`/`Historico` em `scripts/` que quebrarem
- depende de: nenhuma
- leitura: spec 023 `Contratos › **Histórico (src/core/evals/historico.ts…)**`
- skills: nenhuma
- contratos: os da spec. `lerHistorico(raiz = process.cwd())` lê `evals/resultados/historico.json`, valida com `historicoSchema`; ausente, ilegível ou inválido → `undefined` (nunca lança). Forma do schema sem mudança. Se o schema importa algo de `scripts/` ou `evals/`, traga o mínimo para `src/core/evals/` sem mudar a forma.
- testes primeiro: `lerHistorico` com o arquivo real valida; pasta sem o arquivo → `undefined`; JSON inválido → `undefined`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: testes verdes; `scripts/lib/evals/historico.ts` importa o schema de `src/core/evals/historico.ts`.
- fora: `container.ts`, a página.

### T5 · Compute the week numbers with window, floor and cache
- nivel: mecanica
- objetivo: `janelaDaSemana` e `criarNumerosDaSemana`.
- arquivos: `src/core/bastidores/numeros.ts`, `src/core/bastidores/numeros.test.ts`
- depende de: T2, T3
- leitura: spec 023 `Contratos › **Números da semana (src/core/bastidores/numeros.ts)**`; critérios "Janela", "Piso", "Cache", "Banco fora"
- skills: nenhuma
- contratos: os da spec, por extenso. Config de `config/bastidores.ts` (`dias`, `minimoDeRuns`, `topTools`, `toolsFora`, `cacheMs`). `criarNumerosDaSemana` recebe o fuso por parâmetro ou lê `config.clima.fusoPadrao` (escolha e documente).
- testes primeiro: janela às 00:30 de 2026-12-10 em São Paulo = `{ de: "2026-12-03", ate: "2026-12-09" }`; 19 runs → `poucos` sem ler sinais; 20 → `ok`; duas chamadas na mesma hora → uma leitura do store; virada do dia → nova leitura; erro do store sobe e não é guardado.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run src/core/bastidores`
- pronto quando: testes verdes.
- fora: container, página.

### T6 · Build the evals evolution from the history
- nivel: mecanica
- objetivo: `montarEvolucao`, `formatarMetrica` e `rotuloDoGrafico`.
- arquivos: `src/core/bastidores/evolucao.ts`, `src/core/bastidores/evolucao.test.ts`, `evals/det/bastidores/evolucao.eval.ts`, `evals/det/mapa.ts` (só a entrada nova, `desde: 4`)
- depende de: T3, T4
- leitura: spec 023 `Contratos › **Evolução (src/core/bastidores/evolucao.ts)**` (com os itens abaixo dele); critérios da seção "Evolução dos evals" ("Cinco gráficos" a "Uma fonte só"); em `Evals`, o item `evolucao.eval.ts`
- skills: nenhuma
- contratos: os da spec, por extenso. `metas` de `config/evals.ts`. `FAMILIAS` da 014 (se estiver fora de `src/core`/`config`, receba por parâmetro ou traga a constante para `config/`, sem mudar o valor, e anote).
- testes primeiro: `formatarMetrica` nos quatro formatos e `null`; `rotuloDoGrafico` no formato exato do critério ("Escolheu as consultas certas: Base 67%, Conversa 75%. Meta: pelo menos 80%."), com "sem valor" e "abaixo da meta"; ponto `null`; um checkpoint só; histórico vazio → `vazia`; checkpoint sem rótulo usa o id; o eval com o `historico.json` real bate com `gerarComparacao` (mesmos valores formatados por métrica e checkpoint).
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run src/core/bastidores`, `npm run eval:det`
- pronto quando: testes e eval verdes.
- fora: página, container.

### T7 · Record the daily signals in the cleanup before deleting accounts
- nivel: mecanica
- objetivo: a limpeza diária grava os sinais de ontem em `sinais_dia` antes de apagar as contas vencidas e apaga os sinais com mais de 30 dias.
- arquivos: `src/core/cleanup.ts`, o teste dele, `src/app/_rotas/cron.ts` e `scripts/cleanup.ts` (só para passar `container.bastidores`), e os testes desses que quebrarem
- depende de: T11
- leitura: spec 023 `Contratos › **Limpeza (src/core/cleanup.ts, 004/017/021)**`; critérios "Sinais por dia" e "Registro idempotente"
- skills: nenhuma
- contratos: os da spec, por extenso. `bastidores` entra nas deps de `executarLimpeza`; `retencaoSinaisDias` de `config/bastidores.ts`; falha do registro é logada pelo `Telemetry` com `erro.codigo` (nome de log da lista fechada; acrescente em `nomes.ts` se faltar) e a limpeza segue.
- testes primeiro: o registro roda antes de apagar contas (voto 👍 de uma demonstração vencida continua contado); duas limpezas no dia → mesmos valores; sinal com 31 dias apagado; registro que lança → limpeza segue e loga; `ResultadoLimpeza` com `sinais_registrados` e `sinais_apagados`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: testes verdes.
- fora: o store (T2), o container (T11).

### T8 · Write the six public MCP tools over the internal ones
- nivel: mecanica
- objetivo: contexto público sem stores e as seis tools públicas, com teste de equivalência contra as internas.
- arquivos: `src/core/mcp/contexto.ts`, `src/core/mcp/contexto.test.ts`, `src/core/mcp/tools.ts`, `src/core/mcp/tools.test.ts`, `evals/det/mcp/tools.eval.ts`, `evals/det/mapa.ts` (só a entrada nova, `desde: 4`)
- depende de: nenhuma
- leitura: spec 023 `Contratos › **Tools públicas (src/core/mcp/)**` (com as duas tabelas e a linha do `CityLookupUnavailableError`); critérios "Lista", "Mesmo resultado", "Dosha", "Clima", "Sem conta"; em `Evals`, o item `tools.eval.ts`
- skills: nenhuma
- contratos: os da spec, por extenso. As internas estão em `src/core/` (procure `alimentoTool`, `candidatosTool`, `substitutosTool`, `checarCombinacaoTool`, `climaAgoraTool`, `climaProximasHorasTool`); chame `execute` com `contextoPublico`; não reescreva lógica. `storesProibidos` é um `Proxy` que lança `RituError("mcp_sem_conta")` em qualquer propriedade (acrescente o código ao tipo de erro se ele for fechado). `executar` valida a entrada com `entrada` e a saída com `saida`.
- testes primeiro: os seis nomes, nesta ordem; mesmo resultado das internas com contexto neutro (alimento, candidatos sem e com `dosha`, substitutos sem `em_casa`, combinação); clima com cidade achada (com `regiao`, `pais`, `fonte`), não achada e fora do ar; `aviso` em toda saída; nenhum caso toca `storesProibidos`; acessar `storesProibidos.qualquer` lança `mcp_sem_conta`; toda saída passa no schema `saida`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run src/core/mcp`, `npm run eval:det`
- pronto quando: testes e eval verdes.
- fora: servidor, rota, telemetria (a T12 abre o span e conta a métrica).

### T9 · Add the MCP limit, the MCP metric and span, and the panel stat
- nivel: mecanica
- objetivo: `consumirMcp`, o código `limite_mcp`, os nomes de telemetria do MCP e o stat "Chamadas MCP" no painel.
- arquivos: `src/core/limits/mcp.ts`, `src/core/limits/mcp.test.ts`, `src/core/limits/erros.ts`, `src/core/telemetry/nomes.ts` (e o teste que trava a lista, se houver), `scripts/lib/painel.ts`, os gerados `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml` (por `npm run painel:gerar`), e o teste que trava o gerado
- depende de: T3
- leitura: spec 023 `Contratos › **Limites do MCP (src/core/limits/mcp.ts)**`, `Contratos › **Limites (config/limites.ts, acréscimo)**` (chaves e início das janelas) e `Contratos › **Telemetria**`; critério "Limites"
- skills: nenhuma
- contratos: os da spec, por extenso. Use `janelaDoMinuto`, `segundosAte` e o dia local já existentes em `src/core/limits/` (021).
- testes primeiro: 30 chamadas do IP no minuto passam e a 31ª barra com motivo `minuto` e `retryAfterS` até o próximo minuto; a 301ª do dia barra com motivo `ip` até a meia-noite de São Paulo; a 3001ª global barra com motivo `global`; barrado soma `ritu_limite_total{tipo:"mcp", motivo, resultado:"barrado"}`; o fake de telemetria aceita `ritu_mcp_chamadas_total{tool, resultado}` e o span `mcp.tool` com `tool.nome` e `tool.status`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run painel:gerar`
- pronto quando: testes verdes; painel regenerado e o teste do gerado verde.
- fora: rota e servidor.

### T10 · Let /api/mcp pass without an Origin header
- nivel: nucleo
- objetivo: `origemValida` ganha o caminho; `/api/mcp` sem `Origin` passa, com o `Origin` do site passa, com outro `Origin` é `403`; as outras rotas ficam como na 017.
- arquivos: `src/core/security/origem.ts`, `src/core/security/origem.test.ts`, `src/proxy.ts` e o teste dele, se houver
- depende de: T3
- leitura: spec 023 `Contratos › **Origem (src/core/security/, 017)**`; critério "Origem"
- skills: nenhuma
- contratos: os da spec, por extenso. O caminho vem de `config.bastidores.mcp.caminho`. Não abrir CORS.
- testes primeiro: `POST /api/mcp` sem origin → true; com origin igual ao host → true; outro → false; `POST /api/runs` sem origin → false (como hoje); `GET` como hoje.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; nenhuma outra rota mudou de comportamento.
- fora: a rota do MCP.

### T11 · Wire the Bastidores store, the week numbers and the history into the container
- nivel: mecanica
- objetivo: o `Container` ganha `bastidores`, `numerosDaSemana` e `historico`, com o adaptador Postgres no modo normal e o fake em memória nos modos de teste e e2e.
- arquivos: `src/infra/container.ts`, o teste dele, e os fakes/containers de teste que montam `Container` à mão e quebrarem no typecheck (só acrescentar o campo)
- depende de: T2, T4, T5
- leitura: spec 023 as linhas "`Container` ganha …" em `Contratos › **Porta**`, `**Números da semana**` e `**Histórico**`
- skills: nenhuma
- contratos: `bastidores: BastidoresStore`; `numerosDaSemana: () => Promise<NumerosDaSemana>` (uma instância por container, fuso `config.clima.fusoPadrao`); `historico: () => Historico | undefined` (via `lerHistorico`). O banco continua preguiçoso: importar o container não lê `DATABASE_URL`.
- testes primeiro: no modo e2e, `container.bastidores` é o fake; `numerosDaSemana()` devolve `poucos` num container vazio; `historico()` devolve o histórico real.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes e build verdes.
- fora: limpeza (T7), página, MCP.

### T12 · Serve the MCP tools at /api/mcp with limits and telemetry
- nivel: nucleo
- objetivo: servidor MCP sem estado com as seis tools, rota `/api/mcp` com corpo máximo, limites e `descarregarDepois`, e o eval de segurança da rota.
- arquivos: `src/infra/mcp/servidor.ts`, `src/infra/mcp/servidor.test.ts`, `src/app/api/mcp/route.ts`, `evals/det/seguranca/mcp-rota.eval.ts`, `evals/det/privacidade/<novo arquivo>.eval.ts` (canários do MCP), `evals/det/mapa.ts` (só as entradas novas, `desde: 4`), `src/app/_lib/rota.ts` (só `limite_mcp` em `CODIGOS_DE_LIMITE`)
- depende de: T1, T8, T9, T10, T11
- leitura: spec 023 `Contratos › **Servidor (src/infra/mcp/servidor.ts)**` e `**Rota (src/app/api/mcp/route.ts)**`; critérios "Lista", "Entrada inválida", "Limites", "Origem", "Corpo", "Telemetria" e, em "Geral", o de canários; em `Evals`, os itens `mcp-rota.eval.ts` e `privacidade/`; `OBSERVABILITY.md` §3 "Privacidade"; a documentação da versão instalada de `mcp-handler` e `@modelcontextprotocol/server` em `node_modules` (README e tipos)
- skills: nenhuma
- contratos: os da spec, por extenso. `ipDoPedido` e `hashDoIp` (017) e `descarregarDepois` (022) já existem em `src/app/` ou `src/infra/`. Diferença da API instalada para a spec (`registerTool`, `outputSchema`, `structuredContent`, erro de tool, modo sem estado, `basePath`): siga a API instalada e liste a diferença no relatório da tarefa (o orquestrador registra).
- testes primeiro: `initialize` + `tools/list` devolvem as seis com `inputSchema` e `outputSchema`; `tools/call` de `ayurveda_alimento` devolve `structuredContent` com `aviso`; argumento inválido → `isError: true` com "Entrada inválida." e os campos, sem stack; 31ª no minuto → `429` com `Retry-After` e o corpo JSON-RPC da spec; corpo > 16 KB → `413` sem consumir; `GET` não consome; métrica e span por chamada; canário na cidade e nos nomes de alimento não aparece em span, métrica, log nem console.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run build`
- pronto quando: testes, evals e build verdes.
- fora: página, smoke.
- notas (da sessão anterior): `src/app/_lib/rota.ts` (`CODIGOS_DE_LIMITE`) não tem `limite_mcp`: acrescente (o arquivo entra na lista desta tarefa). Use `medirChamadaMcp` de `src/core/mcp/telemetria.ts` (o classificador não pode lançar, senão perde o erro original). `CityLookupUnavailableError` é checado por `instanceof` em `src/core/mcp/tools.ts`: se a rota carregar cópias separadas, troque pela marca/código (`cidades_indisponivel`). `createPgBastidores(sql)` recebe só o `sql`. `origemValida` usa `startsWith("/api/mcp")` (conforme a spec; não mexer).

### T13 · Build the Bastidores page
- nivel: tela
- objetivo: `/bastidores` com as três seções, os componentes de `src/components/ritu/bastidores/` e o E2E.
- arquivos: `src/app/bastidores/page.tsx`, `src/components/ritu/bastidores/` (`numeros-da-semana.tsx`, `barras.tsx`, `grafico-evolucao.tsx`, `tabela-metricas.tsx`, `use-o-mcp.tsx` e testes), `e2e/bastidores.spec.ts`, e o que o modo e2e precisar para semear o fake abaixo e acima do piso (só em `src/infra/e2e/**`, por `x-ritu-e2e`, como os outros cenários)
- depende de: T3, T5, T6, T8, T11
- leitura: spec 023 `Contratos › **Página (src/app/bastidores/page.tsx)**`, `**Componentes (src/components/ritu/bastidores/)**` (com o exemplo de configuração) e `**Textos**`; critérios das seções "Últimos 7 dias" (os de tela), "Evolução dos evals", "Use a base no seu agente" e "Geral"; o parágrafo "E2E" de `Evals`; `DESIGN.md` §3 "Acessibilidade"; `.specs/016-design-system.md` "Contratos" (só os componentes usados: `Surface`, `StateBlock`, `IconButton`, `toast`, `Disclosure` se existir)
- skills: `frontend-design`, `web-design-guidelines`
- contratos: os da spec, por extenso. Sem biblioteca de gráfico; SVG no servidor; só `use-o-mcp.tsx` é cliente; sem ISR nem `revalidate`; só classes de token; nenhum número da semana abaixo do piso no HTML. `DESCRICOES_PUBLICAS` de `src/core/mcp/tools.ts`.
- testes primeiro: o E2E da spec (sem sessão; axe nos dois temas com a tabela aberta, celular e desktop; cinco `role="img"` com nome; "Todas as métricas" abre e fecha pelo teclado; "Copiar endereço" mostra o toast; fake abaixo do piso → `StateBlock`; acima → sete indicadores).
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e -- e2e/bastidores.spec.ts`
- pronto quando: E2E e axe verdes; página abre sem sessão, com sessão e na demonstração.
- fora: `src/core/`, rota do MCP, links na Entrada (024).

### T14 · Cover the week numbers with the privacy eval
- nivel: mecanica
- objetivo: eval determinístico dos números da semana: piso, hoje fora, voto de demonstração depois da limpeza e ausência de dado de pessoa no JSON e no HTML.
- arquivos: `evals/det/bastidores/numeros.eval.ts`, `evals/det/mapa.ts` (só a entrada nova, `desde: 4`)
- depende de: T7, T11, T13
- leitura: spec 023, em `Evals`, o item `numeros.eval.ts`; critérios "Piso", "Sinais por dia" e o de canários em "Geral"
- skills: nenhuma
- contratos: use o container em modo e2e (fakes) ou os fakes diretamente, como os evals de `evals/det/privacidade/`; o HTML vem de renderizar a página ou do handler, como outro eval de página já faça (procure um).
- testes primeiro: 19 e 20 runs; run de hoje fora; voto de demonstração contado depois de a limpeza apagar a conta; JSON de `NumerosDaSemana` e HTML sem `conta_id`, e-mail nem canários plantados nas mensagens e no perfil.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm run eval:det`
- pronto quando: eval verde.
- fora: código de `src/`.

### T15 · Check Bastidores and the MCP tools in the production smoke
- nivel: mecanica
- objetivo: grupo `publico` no smoke: `GET /bastidores` → 200 e `tools/list` com as seis tools.
- arquivos: `scripts/lib/smoke.ts`, o teste dele, `scripts/smoke.ts`
- depende de: T12, T13
- leitura: spec 023 `Contratos › **Smoke (022, acréscimos em scripts/lib/smoke.ts)**`; critério "Smoke"
- skills: nenhuma
- contratos: os da spec, por extenso. `POST /api/mcp` com `initialize` e `tools/list`, sem `Origin`, com os headers que o Streamable HTTP pede (`accept: application/json, text/event-stream`); resposta pode vir em JSON ou SSE: trate os dois.
- testes primeiro: `checarPublico` com 200 e as seis tools (qualquer ordem) → ok; 500 → falha; faltando uma tool → falha com o nome.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: rodar o smoke contra produção.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1 | Instala biblioteca e mexe em `package.json` e `next.config.ts`: sozinha |
| 2 | T2 | Migração: sozinha |
| 3 | T3, T4, T8 | Independentes, sem arquivo em comum (config; histórico; MCP no core) |
| 4 | T5, T6, T9, T10 | Dependem de T2/T3/T4; arquivos separados (`mapa.ts` só na T6 nesta onda) |
| 5 | T11 | `container.ts`, que todos usam: sozinha |
| 6 | T7 | Muda a assinatura de `executarLimpeza`, usada fora dos arquivos dela: sozinha |
| 7 | T12, T13 | Rota do MCP e página: sem arquivo em comum (`mapa.ts` só na T12) |
| 8 | T14, T15 | Eval dos números e smoke: sem arquivo em comum |

Fechamento (orquestrador): gates 1 a 6, `dup` e ⚠️ `test:db` (contrato do `BastidoresStore` no Postgres); ADRs "MCP público só de leitura" e "Bastidores com piso e sinais por dia"; docs vivos da lista da spec (`ARCHITECTURE.md` §1, §4, §5, §6, §7; `OBSERVABILITY.md` §4; `BUSINESS.md` §7, §14; `DATA-SOURCES.md`; `QA.md`; `AGENTS.md`); spec `implemented`.

### C1 · Stop the intermittent target-size violation in the question (correção da CI)
- nivel: tela
- objetivo: o teste `e2e/conversa.spec.ts` "axe na conversa, tema light|dark › pergunta" passa sempre, no celular e no desktop, sem excluir regra nem elemento do axe.
- arquivos: `e2e/conversa.spec.ts` e o componente ou estilo da pergunta do agente/da caixa fixa que causar a sobreposição (em `src/components/ritu/` ou `src/app/(app)/conversa/`); nada mais
- depende de: nenhuma
- leitura: `DESIGN.md` §3 "Acessibilidade"
- skills: `frontend-design`, `web-design-guidelines`
- contexto: na CI, 2 das 3 últimas rodadas falharam em `e2e/conversa.spec.ts:463` com `target-size` (serious) em dois elementos React Aria da pergunta (`#react-aria…-_r_13_` e `_r_15_`); uma vez no desktop dark, outra no celular light. Localmente passa. A 021 já tinha visto `target-size` intermitente num botão do log parcialmente coberto pelo painel fixo (`conversa.tsx`, painel sticky); a correção de então (T21, espaço do log acima do painel) não bastou. O axe do `target-size` conta a área visível: um alvo parcialmente coberto pelo painel fixo ou ainda em animação/rolagem quando o axe roda falha.
- contratos: sem excluir `target-size` nem o seletor do axe; sem `waitForTimeout` fixo como única defesa. Ache a causa (sobreposição pelo painel fixo, alvo menor que 24×24 durante a animação de entrada, rolagem não terminada) e corrija na tela ou espere no teste por um estado estável observável (rolagem parada, animação terminada, alvo inteiro visível).
- testes primeiro: reproduza: rode o teste com `--repeat-each=20` nos dois projetos, com `CI=1`, e conte as falhas antes da correção.
- comandos: `CI=1 npm run build && CI=1 npx playwright test e2e/conversa.spec.ts -g "pergunta" --repeat-each=20`, `rtk bypass npm run lint`, `npm run typecheck`
- pronto quando: 0 falhas em `--repeat-each=20` nos dois projetos e nos dois temas; o resto de `e2e/conversa.spec.ts` verde.
- fora: regras do axe, outros testes.
