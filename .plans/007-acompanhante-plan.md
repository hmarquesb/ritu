# Plano · Spec 007 · Acompanhante

Spec: `.specs/007-acompanhante.md`. Nível: `nucleo` para `preparar`, mensagem inicial e prompt, validador, saída, `finalizar` e definição do agente, `responder` e `eval-llm`; `mecanica` para configuração, entrada, textos, `ToolContext.telemetry` e `resumir`, lacunas, filtro, candidatos, faltas, cenários, `demo` e evals determinísticos. Ficam com o orquestrador, no fechamento: `AI.md` §3, §4 e §6, `AGENTS.md`, `ROADMAP.md` §0, a ADR, a rodada única do ⚠️ `demo --llm` (com e sem `--esgotar decisao`) e, no fechamento da entrega, o ⚠️ `eval:llm -- --checkpoint c1-base`.

## Regras comuns a todas as tarefas

- **Contratos:** estão na seção "Contratos" da spec (linhas 113 a 561). Nomes de tipos, campos, funções, textos e erros ficam **exatamente** como lá, em português; o resto do código fica em inglês. A tarefa diz quais linhas ler. Textos fixos e o prompt são copiados sem mudar uma vírgula.
- **Onde está o que já existe** (confira a assinatura real antes de usar; não redefina):
  - `Tool`, `ToolContext`, `definirTool`: `@/core/tools/tool` (a spec diz `agents/tools/tool.ts`: o arquivo mudou de lugar na 005).
  - `DefinicaoDoAgente`, `ToolDeControle`, `ResultadoDeControle`, `Pendencia`: `@/core/runs/agente`. `Checkpoint`: `@/core/runs/checkpoint`. `novoCheckpoint`, `FimDoTrecho`, `EventoAoVivo`: `@/core/runs/loop`. `createRunService`: `@/core/runs/run-service`. `Run`, `RunMutavel`, `RunEtapa`, `NovaEtapa`, `Caminho` (já tem `acompanhante` e `sem_modelo`): `@/core/runs/ports`.
  - Base: `KnowledgeBase` (`@/core/knowledge/knowledge-base`, com `linha`, `verbo`, `estados`), `qualidadesDoMomento`, `momentoDoDia`, `MomentoQualidades` (`@/core/knowledge/momento`), `notaAdequacao`, `Prakriti` (`@/core/knowledge/adequacao`), `passaNoFiltro`, `FiltroPessoa`, `EvitarItem` (`@/core/knowledge/filtros`), `resolverEvitar`, `normalizar` (`@/core/knowledge/identificar`), `substitutos`, `fraseDaTroca`, `checarCombinacao`, `SinaisPessoa` (`@/core/knowledge/substitutos`), `Estado`, `MomentoDoDia`, `Restricao`, `Guna`, `Funcao` (`@/core/knowledge/vocab`), `Preparo`, `Pratica` (`@/core/knowledge/schemas`), `verbosDasGunas` (`@/core/knowledge/verbos`).
  - Clima: `WeatherSource`, `CidadeDaPessoa`, `Clima` (`@/core/weather/ports`), `horaLocal` (`@/core/weather/hora-local`), `climaTools` (`@/core/agents/tools/clima`), `createFakeWeather` (`@/infra/fakes/fake-weather`).
  - Memória: `Stores` (`@/core/stores`), portas em `@/core/<dominio>/ports` (`accounts` tem perfil e `evitarTemporario`/`acrescentarEvitarTemporario`; `preferences` tem `Preferencia` com `ultimos_resultados` e `ultima_sugestao_em`, `contagem`, `ItemTipo`; `runs.recentes`; `outcomes.pendentes`; `routine.resumo`; `patterns.listar`; `messages.doDia`; `shortages.diasComFalta` e `lista`; `proposals.recusadas`), `estadoDoItem` (`@/core/pantry/estado`), `diaLocal`, `diasAtras` (`@/core/time/dia-local`), `memoriaTools` (`@/core/agents/tools/memoria`), `ayurvedaTools` (`@/core/agents/tools/ayurveda`), `createMemoryStores` (`@/infra/fakes/memory-stores`).
  - Modelos: `ModelRouter`, `createModelRouter` (`@/core/llm/router`), `chamarComPapel` (`@/core/llm/chamar`), `respostaSemModelo`, `RespostaSemModelo` (`@/core/llm/sem-modelo`), `createMemoryLedger` (`@/infra/fakes/memory-stores`), `createFakeLlm` (`@/infra/fakes/fake-llm`), `llmCotas` (`@config/index`).
  - Telemetria: `Telemetry` (`@/core/telemetry/ports`), nomes fechados em `@/core/telemetry/nomes` (já tem os spans `preparo` e `validacao`, as métricas `ritu_validacao_violacoes_total`, `ritu_fallback_sem_llm_total`, `ritu_run_intencao_total`, `ritu_para_ter_total` e os atributos `candidatos.total`, `faltas.registradas`, `para_ter.candidato`, `validacao.ok`, `validacao.violacoes`, `validacao.tentativa`, `violacao`, `intencao`, `etapa`), `createMemoryTelemetry` (`@/infra/fakes/memory-telemetry`).
  - Testes: `createFixedClock` (`@/infra/fakes/fixed-clock`), `createScriptedRuntime` e `PassoRoteirizado` (`@/infra/fakes/scripted-runtime`), mini-base (`@/infra/fakes/mini-knowledge`). A base real é lida pelo container (`getContainer().knowledge`), como nos evals de `evals/det/base/`.
  - `RituError` (`@/core/errors`), `Clock` (`@/core/clock`), `requireEnv`/`optionalEnv` (`@/infra/env`).
- **Camadas:** `src/core/` só importa `src/core/`, `@config/*` e `zod`. Scripts e evals só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (R6). No core, sem `new Date()` sem argumento nem `Date.now()` (R8). Identificador de modelo (`gemini-<n>`) só em `config/llm-cotas.ts` e em testes (R10). Sem ciclo entre domínios do core (R9): `src/core/ranking/` não importa `src/core/agents/`; os tipos que os dois usam (`Candidato`, `ItemDoCandidato`, `EstadoNaCasa`, `TipoDeSugestao`, `ParaTer`) moram em `src/core/ranking/tipos.ts`, e `preparo.ts` os reexporta.
- **Privacidade:** nenhum texto da pessoa, texto da resposta, nome de alimento ou de cidade vai para span, métrica, log ou `resumo` de etapa. Ids de alimento também não vão para atributo.
- **Testes:** os padrão rodam sem rede, banco nem chave. Nenhum teste chama a Gemini.
- **Qualidade:** complexidade cognitiva ≤ 15 por função, `npm run dup` com 0 clones e Biome. Rode `./node_modules/.bin/biome check --write <arquivos>`. Se o filtro do `npm run lint` falhar ("JSON parse failed"), use `rtk bypass npm run lint`.
- **Limites:**
  - Não leia `.env.local` (nem com `cat`, `grep` ou `source`) e não abra pastas fora do repositório.
  - Arquivos temporários só no scratchpad, nunca em `/tmp` nem em `$TMPDIR`.
  - Arquivo fora da lista da tarefa: pare e diga qual. Exceção explícita só onde a tarefa disser.
  - Não commite.

## Decisões do plano

- **D1 · Tipos do ranking.** `src/core/ranking/tipos.ts` define `EstadoNaCasa`, `TipoDeSugestao`, `ItemDoCandidato`, `Candidato` e `ParaTer` (spec linhas 182 a 206). `preparo.ts` reexporta. Evita o ciclo `agents ↔ ranking`.
- **D2 · `ToolContext.telemetry`.** Campo obrigatório `telemetry: Telemetry`. Quem monta `ToolContext` em teste, eval ou script passa `createMemoryTelemetry()` (ou a do container, no script).
- **D3 · Campos do run.** `modelos` é `{ decisao: string[] }`: os modelos usados pelo papel, na ordem, sem repetir. `trocas_de_modelo` é o número de trocas. `momento` = `{ estados, momento_do_dia, gunas_buscadas }`. `clima_usado` = o resultado `ok` de `clima.agora` sem o campo da cidade (se a saída da tool tiver nome de cidade, tire-o).
- **D4 · Fim `limite`.** O loop devolve `limite` com `motivo` `chamadas`, `tempo`, `tokens` ou `validacao` (terceira entrega recusada, `config.loop.maxEntregasRecusadas`). Todos dão `saidaSegura`, run `done` e uma etapa `erro` de nome `limite:<motivo>`, gravada por `responder` com `runs.gravarEtapa`.
- **D5 · Sem modelo antes do loop.** `iniciarRun({ caminho: "sem_modelo", intencoes })` e depois `encerrar(..., "done", campos)` com a saída. Nenhum checkpoint.
- **D6 · Clima em `finalizar`.** O último resultado de `clima.agora` com `status: "ok"` é procurado em `estado.mensagens` (formato do `Checkpoint` da 005: confira como o loop guarda os resultados de tool). `clima` do validador = `{ gunas }` desse resultado.
- **D7 · Fuso.** `fuso` = o fuso da cidade do perfil, ou o padrão de `config` (o mesmo que `diaLocal` usa sem fuso).
- **D8 · `eval:llm` mínimo.** As perguntas de "explicação" usam `chamarComPapel` no papel `apoio`, com schema `{ diz_o_que_o_momento_pede: boolean, diz_o_que_cada_item_traz: boolean, texto_bate_com_sugestoes: boolean }`. Uma chamada por caso.

## Tarefas

### T1 · Add ranking and response config, the companion input schema and fixed texts
- nivel: mecanica
- objetivo: criar `config/ranking.ts`, `config/resposta.ts`, a entrada do Acompanhante e os textos fixos.
- arquivos: `config/ranking.ts`, `config/resposta.ts`, `config/index.ts`, `config/ranking.test.ts`, `src/core/agents/companion/entrada.ts`, `src/core/agents/companion/entrada.test.ts`, `src/core/agents/companion/textos.ts`
- leitura: spec linhas 117 a 154 e 409 a 418
- skills: nenhuma
- referencia: nenhuma
- contratos: `ranking` e `resposta` exatamente como na spec, em `config` (chaves `ranking` e `resposta`) e reexportados por `config/index.ts`. `Intencao`, `EntradaDoAcompanhante` e `entradaDoAcompanhanteSchema` (texto até 1000 caracteres; `intencoes` com 1 ou mais; `estados` do vocabulário; `incomodo` opcional; `evitar_da_mensagem` array de strings). `textos.ts` exporta um objeto `textosDoAcompanhante = { respostaSegura, avisoIncomodo, avisoGeral, motivoParaTer }` com os quatro textos idênticos aos da spec.
- testes primeiro: config tem os valores da spec; schema aceita entrada mínima válida, recusa `intencoes` vazio, texto com 1001 caracteres e estado fora do vocabulário.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: preparo, saída.

### T2 · Add telemetry to ToolContext and resumir to the read tools
- nivel: mecanica
- objetivo: dar `telemetry` ao `ToolContext` e um `resumir` sem dado da pessoa a cada uma das nove tools de leitura.
- arquivos: `src/core/tools/tool.ts`, `src/core/agents/tools/clima.ts`, `src/core/agents/tools/memoria.ts`, `src/core/agents/tools/ayurveda.ts` e os testes deles; e **todo arquivo que monta um `ToolContext` e só precisa ganhar `telemetry`** (conhecidos: `evals/det/base/candidatos.eval.ts`, `evals/det/base/substitutos.eval.ts`, `evals/det/memoria/casa-estado.eval.ts`, `evals/det/memoria/casa-evitar.eval.ts`, `evals/det/memoria/historico.eval.ts`, `scripts/loop-demo.ts`, `src/core/agents/tools/ayurveda.test.ts`, `src/core/agents/tools/memoria.test.ts`; outros que o typecheck apontar, só com essa mudança)
- leitura: spec linhas 462 (última frase) e 473 a 484; D2
- skills: nenhuma
- referencia: nenhuma
- contratos: `ToolContext` ganha `telemetry: Telemetry` (obrigatório). `resumir` de cada tool, exatamente como a tabela da spec: `clima.agora` e `clima.proximas_horas` → `ok`, `sem cidade` ou `indisponível`; `casa.ler` → `{confirmados} confirmados, {incertos} incertos`; `preferencias.ler` → `{n} registros`; `historico.recente` → `{n} dias`; `ayurveda.alimento` → `{n} alimentos`; `ayurveda.candidatos` → `{n} candidatos`; `ayurveda.substitutos` → `{n} substitutos`; `ayurveda.checar_combinacao` → `compatível` ou `{n} conflitos`. Confira os campos reais da saída de cada tool para contar.
- testes primeiro: um teste por tool para o `resumir` (cada variante: ok/sem cidade/indisponível; compatível/conflitos), conferindo que nenhum nome de alimento ou de cidade aparece.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e evals passam.
- fora: `finalizar`, lógica das tools.

### T3 · Add placeholder filling for preparation titles and steps
- nivel: mecanica
- objetivo: implementar `preencherLacunas`, `tituloDoPreparo` e `passosDoPreparo`.
- arquivos: `src/core/knowledge/lacunas.ts`, `src/core/knowledge/lacunas.test.ts`
- leitura: spec linhas 156 a 177
- skills: nenhuma
- referencia: nenhuma
- contratos: as três assinaturas e as quatro regras da spec. `tituloDoPreparo` usa `p.titulo`; `passosDoPreparo` usa `p.passos`; os nomes vêm de `kb` (nome do alimento), agrupados por `funcao` na ordem dos `itens`.
- testes primeiro: os cinco exemplos da tabela da spec, exatamente; conector antes quando não há depois; palavra anterior (`com`, `de`, `e`) quando não há conector; espaço duplo e maiúscula; `tituloDoPreparo`/`passosDoPreparo` com um preparo da mini-base.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e cada `titulo` e `passos` de `data/preparos.yaml`, preenchido com a 1ª opção de cada vaga obrigatória, não fica com `{` nem `}` (teste com a base real pelo container ou eval; se usar a base real, ponha num `*.test.ts` que importe `readKnowledgeData` do container).
- fora: preparo do Acompanhante.

### T4 · Add the person filter builder
- nivel: mecanica
- objetivo: implementar `montarFiltro` (perfil + "evitar sempre" guardado, do dia e da mensagem + preferências).
- arquivos: `src/core/agents/companion/filtro-da-pessoa.ts`, `src/core/agents/companion/filtro-da-pessoa.test.ts`
- leitura: spec linhas 237 a 241 e 53; `AI.md` §6 "Evitar sempre"
- skills: nenhuma
- referencia: nenhuma
- contratos: `montarFiltro(p: { perfil: Perfil; evitarDoDia: EvitarItem[]; evitarDaMensagem: EvitarItem[]; preferencias: Preferencia[] }): { filtro: FiltroPessoa; evitar_textos: string[] }`. O filtro junta o "evitar sempre" do perfil, o do dia e o da mensagem; as restrições e o "não como" do perfil; os "não gosta" das preferências. Item do tipo texto (que não casou com a base) vai para `evitar_textos`, sem repetir. Confira os campos reais de `FiltroPessoa`, `Perfil` e `EvitarItem`.
- testes primeiro: cada origem de "evitar sempre" entra no filtro; grupo e alimento; texto livre vai para `evitar_textos`; "não gosta" entra; nada de motivo em lugar nenhum.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: gravar `evitar_temporario` (é de `preparar`).

### T5 · Add candidate building and ordering
- nivel: mecanica
- objetivo: implementar os tipos do ranking, `montarCandidatos` e `cortarParaOContexto`.
- arquivos: `src/core/ranking/tipos.ts`, `src/core/ranking/candidatos.ts`, `src/core/ranking/candidatos.test.ts`
- leitura: spec linhas 179 a 206, 243 a 250 e 271 a 283; critérios linhas 52, 54 e 55; D1
- skills: nenhuma
- referencia: nenhuma
- contratos: os tipos de D1 (linhas 182 a 206) e as duas funções, com **todas** as regras das linhas 271 a 283 (quem entra, opções de vaga, adequação, nota, `no_fim`, ordem, novidade, `contribui`). Pesos de `config.ranking`. `cortarParaOContexto` aplica `ranking.noContexto` por tipo e `opcoesPorVaga`. `linha_base` no formato `<tabela>:<id>` (`praticas:x`, `preparos:x`, `alimentos:x`).
- testes primeiro (mini-base; ordem relativa, não valor exato): cada motivo de saída de "quem entra"; vaga obrigatória sem opção tira o preparo; confirmado > incerto > ausente; "gosta" sobe; "ajudou" sobe até o teto; dois `nao_ajudou` mais recentes mandam para o fim mesmo com "ajudou" antigos; sugerido hoje sai; "não gosto" sai; no máximo uma novidade, só com alguma `ultima_sugestao_em`, e na 3ª posição no máximo; corte por tipo.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e nenhuma função passa de complexidade 15.
- fora: faltas, preparo.

### T6 · Add shortages of the run and the worth-having pick
- nivel: mecanica
- objetivo: implementar `faltasDoRun` e `escolherParaTer`.
- arquivos: `src/core/ranking/faltas.ts`, `src/core/ranking/faltas.test.ts`, e (correção depois da 1ª reprovação) `src/core/ranking/candidatos.ts` e `candidatos.test.ts`: `montarCandidatos` deixa de cortar as opções de vaga; o único corte é o de `cortarParaOContexto`
- leitura: spec linhas 252 a 259 e 285 a 287; critérios linhas 56 e 57
- skills: nenhuma
- referencia: nenhuma
- contratos: as duas assinaturas e as regras das linhas 285 e 287, com `config.ranking.faltas`. `ParaTer` de `@/core/ranking/tipos`.
- testes primeiro: falta só de alimento ausente entre os 5 mais adequados só pela adequação; confirmado ou incerto não entra; sem repetir; `escolherParaTer`: soma o dia de hoje, mínimo 3 dias, tira filtrado, na lista e recusado, desempate por mais dias, depois último dia mais recente, depois nome.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: leitura do banco.

### T7 · Add preparar
- nivel: nucleo
- objetivo: implementar `preparar`, que lê as portas e monta `DadosDoPreparo` dentro do span `preparo`.
- arquivos: `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/preparo.test.ts`
- leitura: spec linhas 179 a 235 e 261 a 269; critérios linhas 52, 53, 56, 57 e 67 (só `preparo`); D1, D7; `AI.md` §3 "Preparo"
- skills: nenhuma
- referencia: nenhuma
- contratos: `Sinais`, `DadosDoPreparo` e o schema zod `dadosDoPreparoSchema` (é o `Checkpoint.dados`), `preparar(deps, contaId, entrada)`. Os sete passos da spec, na ordem. Item de `evitar_da_mensagem` resolvido com `resolverEvitar` e gravado com `acrescentarEvitarTemporario` (dia local, sem motivo) **antes** de montar o filtro; falha ao gravar sobe. `casa.confirmados`/`incertos` por `estadoDoItem` ("sempre tenho" = confirmado), sem itens filtrados e sem alimentos fora da base. `sugeridos_hoje` das saídas dos runs do dia (`runs.recentes` desde o início do dia local), linhas `praticas:<id>`/`preparos:<id>`. `mensagens_do_dia` com as últimas 6 (`config.memoria.mensagensDoDiaNoPrompt` se existir) e `padroes` até 10 (`config.memoria.padroesNoPrompt`). `fixos.nao_come` leva os nomes dos itens de alimento (pela base) **e** os itens de texto do perfil, como vieram: o "não como" em texto não filtra, mas o modelo precisa saber. Span `preparo` com `candidatos.total`, `faltas.registradas` (= `faltas_do_run.length`) e `para_ter.candidato` (boolean).
- testes primeiro (stores em memória, mini-base, relógio fixo, telemetria em memória): `com_frio` + `agitada` dá `quente` e `estavel` em `buscadas`; item da mensagem filtra no mesmo run e fica em `evitar_temporario` do dia, sem motivo; texto sem base vai para `evitar_textos`; `pergunta` sem estados → sem candidatos e sem faltas; `para_ter` com 3 dias em 30 e não com incômodo; sugerido hoje sai; span com os atributos e sem nome de alimento.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; `dadosDoPreparoSchema` valida o que `preparar` devolve.
- fora: mensagem inicial, loop.

### T8 · Add the companion prompt v1 and the initial message
- nivel: nucleo
- objetivo: copiar o prompt `acompanhante.v1` e implementar `montarMensagemInicial`.
- arquivos: `src/core/agents/prompts/acompanhante.v1.ts`, `src/core/agents/companion/contexto.ts`, `src/core/agents/companion/contexto.test.ts`
- leitura: spec linhas 289 a 347; critério linha 58
- skills: nenhuma
- referencia: nenhuma
- contratos: `acompanhanteV1 = { versao: "acompanhante.v1", instrucoes, lembreteDeEntrega }`, com `instrucoes` e `lembreteDeEntrega` **idênticos** aos da spec (copie o bloco de texto inteiro). `montarMensagemInicial(dados, texto?)`: os dois blocos, a ordem dos campos do JSON (linha 347), `so_atalhos: true` sem texto, campo vazio ou ausente fora, sem notas numéricas (`adequacao`, `nota`, `no_fim` fora), `<`/`>` → `‹`/`›` no texto e em `evitar_textos`, `resumo_de_rotina`, `padroes`, `mensagens_do_dia`.
- testes primeiro: JSON válido dentro de `<contexto>`; ordem das chaves; sem texto → sem `<mensagem_da_pessoa>` e com `so_atalhos`; troca de `<`/`>` no texto e nos quatro campos; nenhuma nota numérica; teste que compara `instrucoes` com o texto da spec (lido do próprio arquivo de teste como literal).
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: validador, saída.

### T9 · Add the delivery validator
- nivel: nucleo
- objetivo: implementar `validarEntrega`, função pura com os 17 códigos de violação, e o schema da entrega do modelo.
- arquivos: `src/core/agents/companion/saida.ts` (só `EntregaDoModelo` e `entregaDoModeloSchema` nesta tarefa), `src/core/agents/companion/validador.ts`, `src/core/agents/companion/validador.test.ts`
- leitura: spec linhas 349 a 367, 403 e 420 a 451; critério linha 59; `AI.md` §4
- skills: nenhuma
- referencia: nenhuma
- contratos: `EntregaDoModelo` e `entregaDoModeloSchema` (sem tetos de tamanho nem de quantidade). `CodigoDeViolacao`, `Violacao`, `validarEntrega(entrega, { dados, clima?, kb, sinais })` com a tabela inteira das linhas 431 a 447 e as regras 449 a 451 (`normalizar`, palavra inteira, `expressoesIgnoradas`; `mensagem` curta em português, só com ids; ordem do percurso). Tetos de `config.resposta`.
- testes primeiro (mini-base): **um teste por código em que só ele é apontado**, e uma entrega correta sem nenhuma violação; incerto com e sem `se_faltar`; `se_faltar` fora dos substitutos; `qualidades` aceita as do clima consultado; `vazia` só com candidatos no contexto; `texto_sem_estrutura` ignora "café da manhã".
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; nenhuma função passa de complexidade 15.
- fora: `completarSaida`, `finalizar`.

### T10 · Add the companion output and its completion
- nivel: nucleo
- objetivo: implementar `SaidaDoAcompanhante`, `completarSaida`, `saidaSegura` e `saidaSemModelo`.
- arquivos: `src/core/agents/companion/saida.ts`, `src/core/agents/companion/saida.test.ts`
- leitura: spec linhas 369 a 407 e 409 a 418; critérios linhas 60 (parte da saída) e 64
- skills: nenhuma
- referencia: nenhuma
- contratos: `Aviso`, `SugestaoEntregue`, `SaidaDoAcompanhante`, `saidaDoAcompanhanteSchema` e as três funções. `titulo`/`como_fazer` por `tituloDoPreparo`/`passosDoPreparo` (refeição) ou nome/preparo da prática; `nome` dos alimentos e `verbos` por `kb` (pula `null`); `casa` de cada item por `dados.casa`; `se_faltar` com `fraseDaTroca`; `aviso` da prática quando não é vazio; `evitar` com o texto da linha da base; avisos `incomodo` (com `dados.com_incomodo`) e `geral` (com `dados.geral`) dos textos fixos; `para_ter` com `verbos` e `motivo` = `motivoParaTer` com `{vezes}`. `saidaSegura(dados?)`: texto aprovado, listas vazias, `avisos` vazio, `geral` de `dados` ou `false`. `saidaSemModelo(r, dados, kb)`: `origem: "sem_modelo"`, práticas como `SugestaoEntregue` com `motivo` vazio e `linhas_base` com a linha dela.
- testes primeiro: entrega de refeição vira título preenchido, nomes, verbos, modo de fazer e `casa`; prática com `aviso`; avisos por código nos dois casos; `saidaSegura` com e sem dados; `saidaSemModelo` a partir de uma `RespostaSemModelo`; o resultado passa em `saidaDoAcompanhanteSchema`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: validador (já pronto), `finalizar`.

### T11 · Add the finalizar tool and the companion agent definition
- nivel: nucleo
- objetivo: implementar `finalizar` (tool de controle que roda o validador no span `validacao`) e `criarAcompanhante`.
- arquivos: `src/core/agents/tools/finalizar.ts`, `src/core/agents/tools/finalizar.test.ts`, `src/core/agents/companion/agente.ts`, `src/core/agents/companion/agente.test.ts`
- leitura: spec linhas 453 a 472; critérios linhas 60, 61 e 67 (só `validacao`); D6
- skills: nenhuma
- referencia: nenhuma
- contratos: `finalizar: ToolDeControle<EntregaDoModelo>` com `name`, `description` e `input` da spec. `tratar`: valida `estado.dados` com `dadosDoPreparoSchema` (fora do schema → lança); clima de D6; span `validacao` com `validacao.tentativa` = `estado.entregas_recusadas + 1`, `validacao.ok`, `validacao.violacoes`; com violações, `ritu_validacao_violacoes_total` com `violacao: <codigo>` por violação e `{ tipo: "recusar", resultado: { entregue: false, violacoes } }`; sem violações, `{ tipo: "entregar", saida: completarSaida(...) }`. `criarAcompanhante()`: `nome: "acompanhante"`, `instrucoes`/`prompt_versao`/`lembreteDeEntrega` de `acompanhanteV1`, `tools: [...climaTools, ...memoriaTools, ...ayurvedaTools]` (nove), `controle: [finalizar]`.
- testes primeiro: entrega com violação recusa e soma a métrica; entrega limpa entrega a saída completa; clima `ok` mais recente vale para `qualidades`; dados fora do schema lançam; span sem texto; a definição tem as nove tools e `finalizar`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `responder`.

### T12 · Add the responder service and wire companion in the container
- nivel: nucleo
- objetivo: implementar `createCompanion().responder` (preparo → checagem de modelo → run → loop → saída) e ligar `companion` no container.
- arquivos: `src/core/agents/companion/responder.ts`, `src/core/agents/companion/responder.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- leitura: spec linhas 486 a 518; critérios linhas 61 a 63, 66, 68 e 69; D3, D4, D5, D7
- skills: nenhuma
- referencia: nenhuma
- contratos: `RespostaDoRun` e `createCompanion(deps)` como na spec; a ordem de `responder` (passos 1 a 6) e a tabela de fins (linhas 505 a 511), com D3 a D5. `ToolContext` com `kb`, `filtro`, `sinais` (`em_casa` = `casa.confirmados`; `gosta` = ids com "gosta"; `ajudou` = contador por id), `prakriti`, `clima` com a cidade do perfil, `contaId`, `stores`, `clock`, `fuso`, `telemetry`. `executarRun` com `router.paraPapel("decisao", { aoTrocar })`; `aoVivo` repassado. Métricas `ritu_run_intencao_total` por intenção, `ritu_fallback_sem_llm_total` e `ritu_para_ter_total{etapa: "candidato" | "indicada"}`. Container ganha `companion` (preguiçoso, com override), usando `stores`, `knowledge`, `clock`, `weather`, `router`, `runs` e `telemetry`.
- testes primeiro (runtime roteirizado, stores e ledger em memória, mini-base, relógio fixo, telemetria em memória):
  - autocorreção: `finalizar` recusado → `finalizar` corrigido → `done`, duas etapas `validacao` (a 1ª `recusado`), `origem: "agente"`;
  - terceira recusa, teto de chamadas → `origem: "segura"`, sem sugestão, `done`, etapa `erro` `limite:<motivo>`;
  - erro do loop → saída segura e `failed`;
  - sem modelo antes do loop (ledger esgotado no dia para todos os modelos de `decisao`) → caminho `sem_modelo`, `origem: "sem_modelo"`, métrica; o mesmo quando o loop devolve `sem_modelo`;
  - `clima.agora` indisponível e sem cidade → `done` com resposta do agente;
  - run gravado com `saida`, `momento`, `com_incomodo`, `clima_usado` (sem cidade), `prompt_versao`, `modelos`, `trocas_de_modelo`;
  - pensamento chega a `aoVivo` cortado em 160 e não vai para `run_etapas`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; importar o container não lê variável de ambiente.
- fora: demo, cenários.

### T13 · Add the demo scenarios
- nivel: mecanica
- objetivo: criar o tipo `Cenario`, `montarCenario` e os cinco cenários com roteiro.
- arquivos: `test/fixtures/cenarios/tipos.ts`, `test/fixtures/cenarios/montar.ts`, `test/fixtures/cenarios/index.ts`, `test/fixtures/cenarios/frio-agitada.ts`, `test/fixtures/cenarios/pergunta-manga.ts`, `test/fixtures/cenarios/autocorrecao.ts`, `test/fixtures/cenarios/estomago-pesado.ts`, `test/fixtures/cenarios/sem-modelo.ts`, `test/fixtures/cenarios/cenarios.test.ts`
- leitura: spec linhas 520 a 544
- skills: nenhuma
- referencia: nenhuma
- contratos: `Cenario` como na spec; `montarCenario(c, opts?: { runtime?: AgentRuntime; esgotar?: Papel })` devolve `{ contaId, deps }` com stores, ledger e clima em memória, relógio fixo em `c.agora`, base real de `data/` (pelo container), telemetria em memória, roteador real sobre o ledger, serviço de runs e `companion` montados (por padrão com `createScriptedRuntime(c.roteiro)`). Os cinco cenários da tabela, com perfis, casa, faltas, clima e roteiros que **passam no validador real** (ids da base real). `index.ts` exporta `cenarios: Record<string, Cenario>`. `esgotar` marca o principal do papel como esgotado no dia (`registrarRateLimit` × `llmCotas.rateLimitsParaEsgotarODia`). No `sem-modelo`, todos os modelos de `decisao` esgotados.
- testes primeiro: `cenarios.test.ts` roda cada cenário com o roteiro e confere status `done`, a `origem` esperada (`agente`, `agente`, `agente`, `agente`, `sem_modelo`) e, no `autocorrecao`, duas etapas `validacao`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os cinco cenários terminam em `done` com a origem certa.
- fora: script `demo`.

### T14 · Add the demo script and its report
- nivel: mecanica
- objetivo: criar `npm run demo` e a formatação pura da saída.
- arquivos: `scripts/demo.ts`, `scripts/lib/demo-report.ts`, `scripts/lib/demo-report.test.ts`, `package.json`
- leitura: spec linhas 545 a 552; critérios linhas 70 e 71
- skills: nenhuma
- referencia: nenhuma
- contratos: script `demo` com o comando da spec. Sem argumento lista os cenários (nome e descrição). `--cenario <nome>` roda com o roteiro. ⚠️ `--llm`: troca só o runtime (Mastra, do container) e mantém ledger e stores em memória; `--esgotar decisao` repassa a `montarCenario`. `formatarRelatorio(...)` em `demo-report.ts` (pura): etapas na ordem com o pensamento entre aspas antes de cada tool; resposta; cada sugestão com título, ingredientes (marca `incerto` e frase de `se_faltar`), verbos, motivo e modo de fazer; "Evite agora"; "Vale ter em casa"; avisos; "Não é orientação médica." (de `config.app`); resumo com status, origem, passos, tokens, modelo, trocas e `trace_id`. Código 0 em sucesso; 1 em cenário desconhecido ou erro. **Não rode com `--llm`.** O script importa cenários de `test/fixtures/cenarios` e de infra só o container.
- testes primeiro: `demo-report.test.ts` com uma saída de exemplo: todas as seções na ordem, o aviso médico, o pensamento entre aspas.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`; `npm run demo`; `npm run demo -- --cenario <nome>` para os cinco
- pronto quando: os cinco cenários saem com código 0, sem rede.
- fora: `eval:llm`.

### T15 · Add the companion deterministic evals, part 1
- nivel: mecanica
- objetivo: criar os evals de preparo, "evitar sempre", ordenação, faltas e validador sobre a base real.
- arquivos: `evals/det/acompanhante/preparo.eval.ts`, `evitar-sempre.eval.ts`, `ordenacao.eval.ts`, `faltas.eval.ts`, `validador.eval.ts`
- leitura: spec linhas 565 a 571; siga a forma dos evals de `evals/det/base/` e `evals/det/loop/`
- skills: nenhuma
- referencia: nenhuma
- contratos: só o que as tarefas anteriores criaram. Base real pelo container. Cada eval cobre o que a linha dele na spec diz (inclusive "cada variante de `dor-de-cabeca` dá candidatos diferentes" e "um caso por código de violação, sobre a base real").
- testes primeiro: os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os cinco evals passam.
- fora: código de produção (se um eval revelar bug, pare e diga qual).

### T16 · Add the companion deterministic evals, part 2
- nivel: mecanica
- objetivo: criar os evals de entrega, trajetória, degradação e privacidade, com os cenários.
- arquivos: `evals/det/acompanhante/entrega.eval.ts`, `trajetoria.eval.ts`, `degradacao.eval.ts`, `privacidade.eval.ts`
- leitura: spec linhas 572 a 575
- skills: nenhuma
- referencia: nenhuma
- contratos: usam `montarCenario` e `cenarios` de `test/fixtures/cenarios`. `trajetoria`: os cinco cenários no status, origem e etapas esperadas; `pergunta-manga` com 2 chamadas de modelo. `privacidade`: nenhum span, métrica, log ou `resumo` de etapa contém o texto da entrada, o texto da resposta ou nome de alimento (nomes da base real).
- testes primeiro: os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os quatro evals passam.
- fora: código de produção (se um eval revelar bug, pare e diga qual).

### T17 · Add the minimal eval:llm runner and the 12 c1 cases
- nivel: nucleo
- objetivo: criar ⚠️ `npm run eval:llm -- --checkpoint c1-base`, com os 12 casos e o relatório em `evals/resultados/c1-base.md`.
- arquivos: `scripts/eval-llm.ts`, `scripts/lib/eval-llm-report.ts`, `scripts/lib/eval-llm-report.test.ts`, `evals/llm/casos/c1/*.ts` (12 casos e um `index.ts`), `package.json`
- leitura: spec linhas 577 a 594 e 550; D8; `QA.md` "Evals com LLM" e "Checkpoints"
- skills: nenhuma
- referencia: nenhuma
- contratos: cada caso = `{ id, cenario: Cenario (sem roteiro), deve: Expectativa[], naoPode: Expectativa[], trajetoria?: {...} }`, com as expectativas da tabela (de preferência sobre a parte estruturada: ids, avisos, `citados`, `incertos`, tools chamadas, número de chamadas de modelo; para texto, `normalizar` e palavras-chave). O runner roda os casos **um por vez** com `montarCenario(c, { runtime: container.runtime })`, conferindo cada expectativa por código, e uma chamada `apoio` de explicação por caso (D8). Métricas da linha 594 (conteúdo, trajetória, chamadas desnecessárias, válida na 1ª, corrigiu após violação, explicação, custo por papel com tokens, trocas e latência p50/p95), mais versão do prompt e modelos usados, formatadas por função pura em `eval-llm-report.ts`. Erro 429 persistente: para a rodada e grava o que tem. **Não rode o script.**
- testes primeiro: `eval-llm-report.test.ts` com resultados de exemplo (p50/p95, contagens, tabela); um teste que carrega os 12 casos e confere ids únicos e cenários válidos.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam; o script compila.
- fora: rodar o eval (fica com o orquestrador, no fechamento da entrega).

### C1 · Keep optional placeholders removable in the preparation texts
- nivel: conteudo (texto) + mecanica (eval)
- objetivo: conferir com um eval da base real que toda lacuna de vaga opcional, em `titulo` e `passos`, pode sair sem quebrar a frase, e reescrever os textos que falham.
- arquivos: `evals/det/base/lacunas.eval.ts`, `data/preparos.yaml` (só `titulo` e `passos`)
- leitura: spec linhas 156 a 177; `KNOWLEDGE.md` §8 (só para saber que não se inventa fato)
- contratos (revisto depois da 1ª reprovação): regra estrutural sobre o modelo:
  - em `passos`: toda frase (trecho até o ponto) que tem uma lacuna de vaga **opcional** tem **exatamente uma lacuna** (por exemplo, "Se quiser, juntar {tempero}."). A regra 3 de `preencherLacunas` tira a frase inteira quando a vaga vem vazia;
  - em `titulo`: cada lacuna de vaga opcional fica precedida por ` com `, ` de `, ` e ` ou `, ` e seguida por ` e `, `, `, `.` ou fim do texto;
  - lacuna de vaga obrigatória não tem restrição.
  E sobre o texto gerado: para cada preparo, **todas as combinações** de vagas opcionais vazias e preenchidas (obrigatórias com a 1ª opção) dão `titulo` e `passos` sem `{`, `}`, espaço duplo, ` .`, `,.`, `, .`, ` ,`, `, ,`, ` e.`, ` com.`, ` de.` e sem dois verbos no infinitivo colados (palavra terminada em `ar`/`er`/`ir` seguida de outra terminada em `ar`/`er`/`ir`, no início da frase).
  Reescrita só de redação: mesmos ingredientes, mesma ordem de preparo, nenhum fato novo, `passos` até 400 caracteres e `titulo` até 60.
- pronto quando: o eval passa nos 30 preparos; `npm run base:check` passa.

### C2 · Test the companion getter and its override in the container
- nivel: mecanica
- objetivo: cobrir em teste a criação preguiçosa de `companion` no container e o override (apontado pelo verificador na T12, não bloqueante).
- arquivos: `src/infra/container.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `Container.companion: ReturnType<typeof createCompanion>`, getter preguiçoso; `createContainer({ companion })` usa o override. Siga a forma do teste "runtime e runs aceitam override".
- testes primeiro: (1) acessar `companion` duas vezes devolve a mesma instância e não lê `process.env` além do já permitido; (2) `createContainer({ companion: fake })` devolve o fake.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os dois testes passam.
- fora: `container.ts`.

### C3 · Tighten three c1 expectations
- nivel: mecanica
- objetivo: corrigir três expectativas dos casos c1 que podiam dar falso positivo ou falso negativo (apontadas pelo verificador na T17).
- arquivos: `evals/llm/casos/c1/expectativas.ts`, `evals/llm/casos/c1/12-estomago-pesado.ts`, `evals/llm/casos/c1/03-pesada-depois-do-almoco.ts`, `scripts/lib/eval-llm-report.test.ts`
- leitura: nenhuma
- contratos: (1) `trazGuna` passa só quando ao menos um item sugerido contribui a qualidade; `qualidades_buscadas` deixa de ser alternativa. (2) palavras proibidas de texto ("trata", "cura" e afins) casam por palavra inteira depois de `normalizar` (fronteira de palavra), e não por substring. (3) no caso 03, "nada doce" passa a conferir também que nenhum item sugerido tem sabor doce como principal ou é adoçante (`mel`, açúcares), pela parte estruturada da base, além das palavras-chave.
- testes primeiro: em `eval-llm-report.test.ts`, um caso por correção: `trazGuna` falha com só `qualidades_buscadas`; "procura" e "contrata" não disparam "cura"/"trata"; uma saída com `mel` falha no caso 03.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `scripts/eval-llm.ts`; não rodar `eval:llm`.

### C5 · Keep unfillable meals out of the model's candidates
- nivel: nucleo
- objetivo: não oferecer ao modelo refeição cuja vaga obrigatória não tem nenhuma opção em casa (confirmada ou incerta), sem perder a contagem de faltas; e deixar claro, na mensagem de `estrutura`, que prática sem ingrediente leva `itens` vazio.
- ver DECISOES-AUTONOMAS (007 · C5).
