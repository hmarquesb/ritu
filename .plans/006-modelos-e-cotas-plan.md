# Plano · Spec 006 · Modelos e cotas

Spec: `.specs/006-modelos-e-cotas.md`. Nível: `nucleo` para os registros de uso (atomicidade), o roteador, `chamarComPapel` e o adaptador Gemini; `mecanica` para configuração, regra do teste de arquitetura, fakes, resposta sem modelo, limpeza, scripts e evals. Ficam com o orquestrador, no fechamento: `AI.md` §10, ADR, `AGENTS.md` e a rodada única do ⚠️ `modelos:check`.

## Regras comuns a todas as tarefas

- **Contratos:** estão na seção "Contratos" da spec (linhas 92 a 208). Nomes de tipos, campos, funções e erros ficam **exatamente** como lá, em português; o resto do código fica em inglês. A tarefa diz quais linhas ler.
- **Reúso, sem duplicar:**
  - `RituError` (`@/core/errors`), `Clock` (`@/core/clock`), `createFixedClock` (`@/infra/fakes/fixed-clock`, com `advance`).
  - `FornecedorDeModelo` (`@/core/llm/fornecedor`) e `LlmError`/`CodigoLlm` (`@/core/llm/errors`): já existem; não redefina.
  - `Telemetry` (`@/core/telemetry/ports`), `createMemoryTelemetry` (`@/infra/fakes/memory-telemetry`). Nomes de métrica e atributos só da lista fechada de `@/core/telemetry/nomes` (já tem `ritu_llm_chamadas_total`, `ritu_tokens_total`, `ritu_llm_cota_usada`, `ritu_llm_troca_de_modelo_total`, `ritu_llm_erros_total` e os rótulos `modelo`, `papel`, `janela`, `de`, `para`, `motivo`, `codigo`, `direcao`).
  - `createMemoryStores` (`@/infra/fakes/memory-stores`), cliente e migrações do banco em `src/infra/db/` (`client.ts`, `migrate.ts`), suítes de contrato em `test/contracts/` e o runner `test/db/stores.db.test.ts`.
  - Base: `KnowledgeBase` (`@/core/knowledge/knowledge-base`), `notaAdequacao` e `Prakriti` (`@/core/knowledge/adequacao`), `passaNoFiltro` e `FiltroPessoa` (`@/core/knowledge/filtros`), `Estado` e `MomentoDoDia` (`@/core/knowledge/vocab`), `createMiniKnowledge` ou equivalente em `@/infra/fakes/mini-knowledge`.
  - `requireEnv` e `optionalEnv` (`@/infra/env`).
- **Camadas:** `src/core/` só importa `src/core/`, `@config/*` e `zod`. `@google/genai` só entra em `src/infra/gemini/` (R5 já tem essa casa). Scripts e evals só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (R6). No core, sem `new Date()` sem argumento nem `Date.now()` (R8).
- **Identificador de modelo** (`gemini-<número>…`) só em `config/llm-cotas.ts` e em testes. Código, fakes não-teste, scripts e evals leem a configuração. Nos testes, prefira ler da configuração ou usar nomes falsos (`modelo-a`).
- **Privacidade:** nenhuma instrução, entrada, texto de prompt ou de resposta vai para `llm_uso`, etapa, span, métrica ou log.
- **Testes:** os padrão rodam sem rede, banco nem chave. Nenhum teste chama a Gemini.
- **Qualidade:** complexidade cognitiva ≤ 15 por função, `npm run dup` com 0 clones e Biome. Rode `./node_modules/.bin/biome check --write <arquivos>`. Se o filtro do `npm run lint` falhar ("JSON parse failed"), use `rtk bypass npm run lint`.
- **Limites:**
  - Não leia `.env.local` e não abra pastas fora do repositório, exceto as indicadas no campo `referencia`, só para ler.
  - Arquivos temporários só no scratchpad, nunca em `/tmp` nem em `$TMPDIR`.
  - Arquivo fora da lista da tarefa: pare e diga qual.
  - Não commite.

## Decisões do plano

- **D1 · Regra R10.** A spec chama de R9 a regra dos identificadores, mas R9 (ciclo entre domínios) já existe. A regra nova é **R10**, mensagem `<arquivo>: R10`.
- **D2 · Janelas num arquivo próprio.** `janelaDoMinuto` e `diaDaCota` ficam em `src/core/llm/janelas.ts` (os dois registros e o roteador usam), e `router.ts` as reexporta, como a spec pede.
  - `janelaDoMinuto(agora)`: ISO UTC do início do minuto, `AAAA-MM-DDTHH:MM:00.000Z`.
  - `diaDaCota(agora)`: `AAAA-MM-DD` no fuso `llmCotas.fusoDoDia`, via `Intl.DateTimeFormat("en-CA", { timeZone })`.
- **D3 · `createMemoryLedger(clock, limitesPorTeste?)`.** `limitesPorTeste: Partial<Record<string, Limites>>` substitui, para o modelo citado, os limites recebidos em `reservar`. Serve para encolher cotas nos testes e evals.
- **D4 · Semântica do registro de uso** (vale para os dois adaptadores, garantida pela suíte de contrato):
  - Linhas por (`modelo`, `janela`, `inicio`): `janela` é `"minuto"` (inicio = `janelaDoMinuto`) ou `"dia"` (inicio = `diaDaCota`).
  - `reservar(modelo, limites)` dá `false`, sem somar nada, se: a linha do minuto ou a do dia está `esgotado`; ou `pedidos` do minuto ≥ `rpm`; ou `tokens` do minuto ≥ `tpm`; ou `pedidos` do dia ≥ `rpd`. Senão soma 1 pedido nas duas linhas e dá `true`.
  - `registrarTokens(modelo, n)`: soma `n` em `tokens` das duas linhas correntes, criando-as se faltarem (retomada sem reserva).
  - `registrarRateLimit(modelo)`: marca o minuto corrente `esgotado`; soma 1 em `rate_limits` do dia; quando chega a `llmCotas.rateLimitsParaEsgotarODia`, marca o dia `esgotado`.
  - `uso()`: um item por modelo de `llmCotas.modelos`, com os números do minuto e do dia correntes (zeros se não houver linha); `esgotado_ate: "dia"` se o dia está esgotado, senão `"minuto"` se o minuto está, senão ausente.
  - `apagarAntigas()`: apaga linhas de minuto com `inicio` de mais de 1 dia atrás e de dia com `inicio` de mais de 30 dias atrás (em relação ao relógio); devolve quantas apagou.
- **D5 · Roteador.** `createModelRouter(deps: { ledger; clock; telemetry; cotas?: typeof llmCotas })`. `cotas` é opcional (padrão `llmCotas`) só para testar a configuração inválida: papel com modelo fora de `modelos` lança `RituError("config_invalida", …)` na criação.
- **D6 · Escolha do modelo em `proximo()`.** O fornecedor guarda o `anterior` (começa em `preferir ?? lista[0]`), que só serve para detectar a troca. Ordem de tentativa fixa: `preferir` (se estiver na lista do papel), depois a lista do papel do começo, sem repetir (assim, no minuto seguinte, volta ao principal). Devolve o primeiro em que `reservar` der `true`. Se o escolhido ≠ `anterior`: `troca = { de: anterior, motivo }`, com `motivo = "429"` se `falhou(anterior, rate_limit)` foi chamado desde a última escolha, senão `"cota"`; chama `aoTrocar({ papel, de, para, motivo })` e conta `ritu_llm_troca_de_modelo_total` com `papel`, `de`, `para`, `motivo`. Depois, `anterior = escolhido`. Nada com vaga: `null`.
  - O modelo do run se mantém pelo `preferir` (do checkpoint). A nova tentativa de `chamarComPapel` depois de `resposta_invalida` é um novo `proximo()`: cai no mesmo modelo, salvo se um anterior da lista recuperou vaga.
- **D7 · `chamarComPapel`.** Laço: `proximo()` → `null` lança `SemModeloError`; senão `client.gerar({ modelo, instrucoes, entrada, schema, timeoutMs: llmCotas.timeoutMs })`.
  - Sucesso: `usou(modelo, tokens)` e devolve `{ dado, modelo, tokens, trocas, tentativas }` (`tentativas` = chamadas a `gerar`; `trocas` = escolhas com `troca`).
  - `LlmError`: sempre `falhou(modelo, erro)`. `rate_limit` → volta ao laço. `resposta_invalida` → volta ao laço uma vez; na segunda, relança. `timeout` e `indisponivel` → relança.
  - Trava: no máximo `lista do papel + 2` voltas; passou disso, `SemModeloError`.
  - Span `llm.chamada` com `llm.papel`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `llm.tentativas`, `llm.troca_de_modelo`.
- **D8 · Métricas do fornecedor.** `usou`: `ritu_llm_chamadas_total` (`modelo`, `papel`) e `ritu_tokens_total` (`modelo`, `papel`, `direcao: "entrada" | "saida"`). `falhou`: `ritu_llm_erros_total` (`modelo`, `papel`, `codigo`). A cada `proximo` com modelo escolhido: `ritu_llm_cota_usada` com `modelo` e `janela` (`"minuto"` = pedidos/rpm, `"dia"` = pedidos/rpd), lido de `ledger.uso()`.
- **D9 · Rótulos dos estados.** `respostaSemModelo` monta `{estados}` com os rótulos que a base expõe para os estados (de `estados.yaml`), em minúsculas, ligados por ", " e " e " no último (um: só ele; dois: "a e b").

## Tarefas

### T1 · Add the quota config, quota windows, ledger and client ports, and rule R10
- nivel: mecanica
- objetivo: criar a configuração de modelos e cotas, as funções de janela, os tipos das portas `UsageLedger` e `LlmClient` e a regra R10 do teste de arquitetura.
- arquivos: `config/llm-cotas.ts`, `config/llm-cotas.test.ts`, `config/index.ts`, `src/core/llm/janelas.ts`, `src/core/llm/janelas.test.ts`, `src/core/llm/ledger.ts`, `src/core/llm/client.ts`, `src/architecture.test.ts`
- leitura: spec linhas 96 a 119 (config), 129 a 153 (portas `ledger.ts` e `client.ts`; de `router.ts` só `janelaDoMinuto` e `diaDaCota`), 194 (regra); D1, D2 deste plano
- skills: nenhuma
- referencia: nenhuma
- contratos: `llmCotas` e `Papel` exatamente como na spec, exportados também por `config/index.ts` (chave `llmCotas` em `config`, como as outras). `Limites`, `UsoDoModelo`, `UsageLedger` (`ledger.ts`) e `LlmClient` (`client.ts`, importa `z` de `zod`) exatamente como na spec. `janelaDoMinuto(agora: Date): string` e `diaDaCota(agora: Date): string` (D2). R10: texto que casa com `/gemini-[0-9]/` em arquivo de `src/`, `scripts/` ou `evals/` que não seja teste (`*.test.ts`) dá `<arquivo>: R10`; `config/` fica fora da regra.
- testes primeiro:
  - config: todo modelo de cada papel existe em `modelos`; `decisao[0]`, `apoio[0]` e `reforco[0]` batem com a spec; `fusoDoDia` é `America/Los_Angeles`.
  - janelas: `janelaDoMinuto(2026-01-15T12:34:56.789Z)` = `2026-01-15T12:34:00.000Z`; `diaDaCota` de `2026-01-16T07:59:00Z` (23h59 em LA) = `2026-01-15` e de `2026-01-16T08:01:00Z` (0h01) = `2026-01-16`; horário de verão (julho, UTC−7) também vira à meia-noite local.
  - R10: um arquivo falso em `src/core/x.ts` com `"gemini-3.5-flash-lite"` dá `src/core/x.ts: R10`; o mesmo texto num `*.test.ts` não dá; o repositório real passa.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; nenhum arquivo do repositório fora de `config/` e testes casa com `/gemini-[0-9]/`.
- fora: roteador, adaptadores, container.

### T2 · Add the memory usage ledger and its contract suite
- nivel: nucleo
- objetivo: implementar o registro de uso em memória e a suíte de contrato que o adaptador Postgres também vai rodar.
- arquivos: `test/contracts/usage-ledger.contract.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/fakes/memory-stores.test.ts`
- leitura: spec linhas 129 a 139 e 172; D3, D4 deste plano
- skills: nenhuma
- referencia: nenhuma
- contratos: `createMemoryLedger(clock: Clock, limitesPorTeste?: Partial<Record<string, Limites>>): UsageLedger`, exportado de `memory-stores.ts`. A suíte exporta uma função, no padrão das outras de `test/contracts/` (por exemplo, `runUsageLedgerContract(nome, montar: (clock) => Promise<{ ledger: UsageLedger; limpar?: () => Promise<void> }>)`), e o runner do fake a chama em `memory-stores.test.ts`.
- testes primeiro (na suíte de contrato, com relógio fixo):
  - `reservar` soma 1 nas duas janelas; `uso()` mostra; com `rpm` cheio dá `false` e não soma no dia; no minuto seguinte (`advance`) volta a dar `true`.
  - `tpm`: depois de `registrarTokens` acima do limite, `reservar` dá `false` naquele minuto.
  - `rpd` cheio: `false` até a virada do dia da cota (meia-noite de LA), mesmo trocando de minuto.
  - `registrarRateLimit`: minuto esgotado (`esgotado_ate: "minuto"`); no minuto seguinte volta; o terceiro no mesmo dia da cota esgota o dia (`esgotado_ate: "dia"`).
  - `registrarTokens` sem reserva anterior soma assim mesmo.
  - 20 `reservar` em `Promise.all` com `rpm: 15` dão exatamente 15 `true`.
  - `apagarAntigas`: minuto de 25 h atrás sai, de 23 h fica; dia de 31 dias atrás sai, de 29 fica; devolve a contagem.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: a suíte passa no fake e não depende de detalhe do fake (só da porta e do relógio).
- fora: Postgres, migração, roteador.

### T3 · Add the llm_uso migration and the Postgres usage ledger
- nivel: nucleo
- objetivo: criar a tabela `llm_uso` e o adaptador Postgres com a reserva das duas janelas numa operação atômica, rodando a suíte de contrato da T2 em `test:db`.
- arquivos: `db/migrations/0002_llm_uso.sql`, `src/infra/db/usage-ledger.ts`, `test/db/stores.db.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- leitura: spec linhas 121 a 139 e 172 a 175; D4 deste plano
- skills: nenhuma
- referencia: nenhuma
- contratos: tabela `llm_uso` (`modelo text`, `janela text`, `inicio text`, `pedidos int`, `tokens int`, `rate_limits int`, `esgotado bool`; pk (`modelo`, `janela`, `inicio`); defaults 0/false). `createPgUsageLedger(db, clock): UsageLedger` (siga a forma dos outros adaptadores de `src/infra/db/`). Atomicidade: numa transação, garanta as duas linhas (`insert … on conflict do nothing`), trave-as (`select … for update`, sempre na mesma ordem: minuto e depois dia), confira os limites e só então some; ou um único comando equivalente. Container ganha `ledger: UsageLedger` (preguiçoso, Postgres; aceita override) e o tipo `Container` também.
- testes primeiro: o runner do Postgres em `test/db/stores.db.test.ts` chama a suíte da T2 (inclusive as 20 reservas simultâneas); o teste do container confere que `ledger` existe, aceita override e que importar o container não abre o banco.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run test:db` (o Postgres do `docker compose` está no ar)
- pronto quando: `test:db` passa com a suíte do registro de uso; `db:migrate` aplica a 0002 uma vez só.
- fora: roteador, limpeza (T9), scripts.

### T4 · Add the model router
- nivel: nucleo
- objetivo: implementar `createModelRouter`, que devolve um `FornecedorDeModelo` por papel com reserva, troca e métricas.
- arquivos: `src/core/llm/router.ts`, `src/core/llm/router.test.ts`
- leitura: spec linhas 141 a 148 e 163 a 168; critérios de aceite linhas 43 a 53; D5, D6, D8 deste plano
- skills: nenhuma
- referencia: nenhuma
- contratos: `ModelRouter` e `createModelRouter` como na spec, mais o `cotas?` de D5; `router.ts` reexporta `janelaDoMinuto` e `diaDaCota` de `./janelas`. `temModelo(papel)`: `true` se algum modelo do papel tem vaga pelos números de `ledger.uso()` e pelos limites (mesma regra de D4), sem reservar. `usou` e `falhou` delegam ao ledger como na spec (`usou` soma entrada + saída).
- testes primeiro (com `createMemoryLedger`, relógio fixo e telemetria em memória):
  - cada papel devolve o principal com cota livre.
  - minuto cheio do principal (pedidos e, num segundo caso, tokens) → o segundo da lista, com `troca: { de, motivo: "cota" }`, `aoTrocar` chamado e a métrica com `papel`, `de`, `para`, `motivo`; no minuto seguinte volta ao principal (e isso também é troca).
  - dia cheio → fora até a virada do dia de LA.
  - `falhou(m, rate_limit)` → o próximo `proximo()` troca com `motivo: "429"`; o terceiro `rate_limit` do dia o tira até a virada.
  - `preferir` com vaga é devolvido mesmo não sendo o primeiro; sem vaga, segue a lista do começo.
  - todos sem vaga → `null`; `temModelo` → `false`, sem mudar `uso()`.
  - configuração com modelo fora de `modelos` → erro na criação.
  - métricas `ritu_llm_chamadas_total`, `ritu_tokens_total`, `ritu_llm_erros_total` e `ritu_llm_cota_usada` com os rótulos de D8.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; o roteador só usa modelos da lista do papel.
- fora: `chamarComPapel`, adaptadores, container.

### T5 · Add the fake LLM client
- nivel: mecanica
- objetivo: criar o `LlmClient` falso para os testes de `chamarComPapel` e dos agentes.
- arquivos: `src/infra/fakes/fake-llm.ts`, `src/infra/fakes/fake-llm.test.ts`
- leitura: spec linhas 150 a 153 e 174
- skills: nenhuma
- referencia: nenhuma
- contratos: `createFakeLlm(respostas: (unknown | { erro: LlmError["code"] })[]): LlmClient & { pedidos: unknown[] }`. Cada `gerar` guarda o pedido (`{ modelo, instrucoes, entrada }`) em `pedidos` e consome a próxima resposta: `{ erro: c }` lança `new LlmError(c, …)`; senão valida com `p.schema` e, se falhar, lança `LlmError("resposta_invalida", …)`. Tokens fixos (por exemplo `{ entrada: 10, saida: 5 }`). Acabaram as respostas: lança um `Error` dizendo isso.
- testes primeiro: devolve o dado validado; erro roteirizado vira `LlmError` com o código; dado fora do schema vira `resposta_invalida`; `pedidos` registra a ordem e o modelo.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: o adaptador Gemini.

### T6 · Add chamarComPapel and SemModeloError
- nivel: nucleo
- objetivo: implementar a chamada de uma resposta só, com troca de modelo, para Intérprete, Juiz e Memória.
- arquivos: `src/core/llm/chamar.ts`, `src/core/llm/chamar.test.ts`, `src/core/llm/router.ts` (só para exportar o tipo `Troca`)
- leitura: spec linhas 155 a 161; critério de aceite linha 52; D6, D7 deste plano
- skills: nenhuma
- referencia: nenhuma
- contratos: `SemModeloError extends RituError` (`code: "sem_modelo"`) e `chamarComPapel` como na spec. `Troca` = `{ papel: Papel; de: string; para: string; motivo: "cota" | "429" }` (o mesmo tipo do `aoTrocar` de `router.ts`; exporte-o de `router.ts` e reuse).
- testes primeiro (roteador real, `createMemoryLedger`, `createFakeLlm`, relógio fixo, telemetria em memória):
  - sucesso: devolve dado, modelo principal do papel, tokens, `trocas: 0`, `tentativas: 1`; tokens registrados no ledger.
  - `rate_limit` no primeiro → segundo modelo da lista; `trocas: 1`, `tentativas: 2`; `aoTrocar` com `motivo: "429"`.
  - `resposta_invalida` uma vez → nova tentativa no mesmo modelo e sucesso; duas vezes → lança o `LlmError`.
  - `timeout` → lança, depois de `falhou`.
  - sem modelo (cotas zeradas por `limitesPorTeste`) → `SemModeloError`.
  - `preferir` respeitado.
  - span `llm.chamada` só com atributos permitidos; nenhum texto de instrução ou entrada na telemetria.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: adaptador Gemini, agentes.

### T7 · Add the Gemini client adapter and wire router and llm in the container
- nivel: nucleo
- objetivo: criar o `LlmClient` sobre o SDK `@google/genai` e ligar `router` e `llm` no container.
- arquivos: `package.json`, `package-lock.json`, `src/infra/gemini/client.ts`, `src/infra/gemini/client.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- leitura: spec linhas 150 a 153 e 172 a 175; critério de aceite linha 54; "O que não fazer" linhas 69 a 75
- skills: nenhuma
- referencia: nenhuma
- contratos: `npm install @google/genai` (estável mais recente). **Confira a API na versão instalada** (`node_modules/@google/genai`, tipos e README) antes de escrever. `createGeminiClient(deps: { apiKey: () => string }): LlmClient`: a chave é lida na primeira chamada (não na criação); pede saída JSON (`responseMimeType: "application/json"`; se o SDK aceitar, `responseJsonSchema` a partir do zod com `z.toJSONSchema`), instrução de sistema = `instrucoes`, conteúdo = `entrada`, timeout = `timeoutMs ?? llmCotas.timeoutMs` (por `AbortSignal` ou opção do SDK). Valida o JSON com `schema`. Mapeia: 429 → `rate_limit`; aborto/timeout → `timeout`; 5xx e erro de rede → `indisponivel`; JSON que não parseia ou não passa no schema → `resposta_invalida`; outros 4xx → `indisponivel`. Tokens de `usageMetadata` (`promptTokenCount`, `candidatesTokenCount`; ausentes = 0). Sem nova tentativa no adaptador. Container ganha `router: ModelRouter` (`createModelRouter({ ledger, clock, telemetry })`) e `llm: LlmClient` (`createGeminiClient({ apiKey: () => requireEnv("GEMINI_API_KEY") })`), preguiçosos e com override.
- testes primeiro: o adaptador recebe o cliente do SDK por injeção opcional (por exemplo `deps.sdk?`), e o teste usa um falso: sucesso com JSON válido e tokens; status 429, 503, 400 e aborto mapeados; JSON inválido e fora do schema → `resposta_invalida`; criar o cliente não lê a chave. Container: `router` e `llm` existem, aceitam override e importar o container não lê `GEMINI_API_KEY`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam sem rede; o SDK só é importado em `src/infra/gemini/`.
- fora: Mastra (o Acompanhante segue pelo runtime da 005), scripts.

### T8 · Add the no-model response
- nivel: mecanica
- objetivo: montar por código o texto e as práticas gerais para quando não há modelo para `decisao`.
- arquivos: `src/core/llm/textos.ts`, `src/core/llm/sem-modelo.ts`, `src/core/llm/sem-modelo.test.ts`
- leitura: spec linhas 177 a 190; critério de aceite linha 55; edge case linha 254; D9 deste plano
- skills: nenhuma
- referencia: nenhuma
- contratos: `RespostaSemModelo` e `respostaSemModelo(p, kb)` como na spec; os dois textos **exatamente** como na spec, em `textos.ts` (`{estados}` substituído). Práticas: só do tipo `pratica` (sem ingrediente) da base, que favorecem pelo menos um dos estados, sem as contraindicadas para os estados ou o momento, e que passam em `passaNoFiltro` com o `filtro`; ordenadas por `notaAdequacao` (com `prakriti` quando houver), no máximo 3. Cada item: `pratica_id`, `nome`, `verbos`, `linha_base` (campos da prática na base; confira os nomes no schema `Pratica` de `@/core/knowledge/schemas`). Sem estados: o texto "só texto" e lista vazia.
- testes primeiro (mini-base): com um estado, texto com o rótulo em minúsculas e até 3 práticas válidas; com dois e três estados, a junção "a e b" e "a, b e c"; nenhuma prática contraindicada nem barrada pelo filtro; filtro que tira todas → texto com estados e lista vazia; sem estados → o outro texto.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; textos iguais aos da spec.
- fora: roteador, loop.

### T9 · Clean old llm_uso rows in the daily cleanup
- nivel: mecanica
- objetivo: fazer `executarLimpeza` apagar as janelas antigas do registro de uso.
- arquivos: `src/core/cleanup.ts`, `src/core/cleanup.test.ts`, `scripts/cleanup.ts`, `evals/det/memoria/limpeza.eval.ts`
- leitura: spec linhas 56 e 192
- skills: nenhuma
- referencia: nenhuma
- contratos: `executarLimpeza(deps: { stores; clock; ledger: UsageLedger })`; `ResultadoLimpeza` ganha `llm_uso: number`, de `ledger.apagarAntigas()`. O script passa `container.ledger`; testes e eval passam `createMemoryLedger(clock)`.
- testes primeiro: em `cleanup.test.ts`, janelas de minuto com mais de 1 dia e de dia com mais de 30 dias somem e entram na contagem `llm_uso`; as recentes ficam.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: testes e evals passam; o script imprime também `llm_uso`.
- fora: o ledger em si.

### T10 · Add the cotas and modelos:check scripts
- nivel: mecanica
- objetivo: criar `npm run cotas` (tabela de uso) e ⚠️ `npm run modelos:check` (uma chamada mínima por modelo).
- arquivos: `scripts/cotas.ts`, `scripts/modelos-check.ts`, `package.json`
- leitura: spec linhas 57, 58 e 196 a 201
- skills: nenhuma
- referencia: nenhuma
- contratos: os dois comandos com `node --env-file-if-exists=.env.local --import tsx scripts/<nome>.ts`, como os outros. `cotas`: `container.ledger.uso()` e `llmCotas.modelos`; por modelo, uma linha com pedidos e tokens do minuto e do dia, limite e porcentagem usada (pedidos/rpm, tokens/tpm, pedidos/rpd), e `esgotado_ate` quando houver. `modelos:check`: para cada modelo de `llmCotas.modelos`, `ledger.reservar(modelo, limites)` (sem vaga: imprime `sem vaga` e segue), depois `container.llm.gerar` com instrução e entrada mínimas e schema `z.object({ ok: z.boolean() })`, `registrarTokens`; imprime `<modelo>  ok  <tokens>` ou `<modelo>  <codigo do LlmError>` (e, em `rate_limit`, `registrarRateLimit`). Nunca imprime prompt nem chave. Ambos fecham com `container.encerrar()` e saem com código 1 só em erro inesperado. Os ids dos modelos vêm da configuração (R10).
- testes primeiro: nenhum teste unitário (scripts finos); confira com `npm run typecheck` e com ⚠️ `npm run cotas` contra o Postgres local (não rode `modelos:check`).
- comandos: `npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run cotas`
- pronto quando: `cotas` imprime uma linha por modelo com zeros num banco novo.
- fora: rodar `modelos:check` (fica com o orquestrador, no fechamento).

### T11 · Add the deterministic model evals
- nivel: mecanica
- objetivo: criar os evals determinísticos de papéis, troca, virada, resposta sem modelo e loop com roteador.
- arquivos: `evals/det/modelos/papeis.eval.ts`, `evals/det/modelos/troca.eval.ts`, `evals/det/modelos/virada.eval.ts`, `evals/det/modelos/sem-modelo.eval.ts`, `evals/det/modelos/loop-com-router.eval.ts`
- leitura: spec linhas 210 a 218; siga a forma dos evals existentes em `evals/det/loop/`
- skills: nenhuma
- referencia: nenhuma
- contratos: só o que as tarefas anteriores criaram: `createModelRouter` (`@/core/llm/router`), `createMemoryLedger` (`@/infra/fakes/memory-stores`), `respostaSemModelo` (`@/core/llm/sem-modelo`), `llmCotas` (`@config/index`), o loop/serviço da 005 com `createScriptedRuntime` (`@/infra/fakes/scripted-runtime`). Ids de modelo vêm de `llmCotas`, nunca literais (R10).
  - `papeis`: cada papel pede o principal enquanto há cota.
  - `troca`: cota do minuto, do dia e 429 levam ao próximo da lista; troca no gancho e na métrica.
  - `virada`: o registro vira à meia-noite do Pacífico.
  - `sem-modelo`: com `decisao` sem modelo (cada modelo do papel esgotado no dia por `llmCotas.rateLimitsParaEsgotarODia` chamadas a `registrarRateLimit`; `temModelo` lê os limites da configuração, não os `limitesPorTeste`), `temModelo("decisao")` é `false` e `respostaSemModelo` devolve o texto certo e práticas válidas para cada estado da base real; nenhuma contraindicada ou barrada por "evitar sempre".
  - `loop-com-router`: no loop da 005 com o roteador real e o registro em memória, um `rate_limit` roteirizado no meio do run troca de modelo sem contar chamada, gera a etapa `troca_de_modelo` e o run termina em `done`.
- testes primeiro: os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os cinco evals passam.
- fora: código de produção (se um eval revelar bug, pare e diga qual).
