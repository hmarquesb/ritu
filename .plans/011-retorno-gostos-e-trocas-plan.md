# Plano · Spec 011 · Retorno, gostos e trocas

Spec: `.specs/011-retorno-gostos-e-trocas.md`. Nível (seção "Nível das partes" da spec): `nucleo` para `registrarEntrega` e a chamada no `companion`, `trocarIngrediente` e `responderTroca`, `resultado.registrar` e o `ctx.run` (com os pendentes no preparo e no contexto), a mudança em `preparar` para o gosto da mensagem e, por ser a contagem de `registrarResultado` (L2 da 008, que era `nucleo`), o `responder` que diz se mudou; `mecanica` para `config/toques.ts`, textos, `tocarRetorno`, `tocarGosto`, `atualizarSugestao`, `propostaDoParaTer`, a saída com `retorno_id` e `troca`, `acompanhante.v5`, container, cenários, `demo`, evals, runner e casos do `c2`. Não há parte `conteudo`: o prompt e os textos são copiados da spec, como estão neste plano.

Pré-condição: a spec 010 inteira commitada (T1 a T21 do `.plans/010-aprovacao-plan.md`, fechamento em `dab285f`), com os nomes que aquele plano e as notas de construção dele definem: `ItemTemporario`, `ContextoDoRun`/`contextoDoRun`, `manterAberto`, `fecharComPropostas`/`fecharOuFalhar`, `criarAprovar`, `cenariosComAprovacao`, `Cenario.depois`, `rodarCenario` com `bloco` e `depois`, o runner do `eval:llm` com `proposta`, `propostas` e `propostasRecusadas`.

Ficam com o orquestrador, no fechamento: docs, `AGENTS.md`, `ROADMAP.md` §0, as ADRs, a marcação da spec e a rodada ⚠️ do `eval:llm -- --checkpoint c2-conversa` (RULES §6; `QA.md`, Checkpoints). Esta spec **não** pede `demo` com LLM (RULES §6 só pede nas 007, 009, 010 e no fechamento da entrega).

## Regras comuns a todas as tarefas

- **Contratos:** estão copiados em cada tarefa. Nomes de tipos, campos, funções, textos e erros ficam **exatamente** como escritos, em português; o resto do código fica em inglês. O prompt e os textos fixos são copiados sem mudar uma vírgula. Quem recebe a tarefa não precisa abrir a spec.
- **Já existe e não se refaz** (escrito na 008 e na 010): o campo `gosta` em `SaidaDoInterprete` e em `Interpretacao`; as linhas de `nao_come` e de `gosta` no prompt `interprete.v1`; `gosta` em `normalizarInterpretacao`; a anotação `gosta` em `montarAnotacoes`; `ConteudoDaProposta` com `memoria.propor`/`gosta` e `lista.propor`/`fez_falta`; o texto `gosta` ("Você gosta de {itens}") e `listaFezFalta` em `textosDasPropostas`; a ordem do bloco em `montarPropostas`; o executor gravando `gosta`; `aprovar` somando `ritu_gosto_total{gosto: "gosta"}` e `ritu_para_ter_total{etapa: "aprovada" | "recusada"}`; o resumo `gosta: N itens` da etapa `proposta`; a recusa duradoura da lista (`proposals.recusadas(contaId, "lista.propor")` lida em `paraTerDoRun`).
- **Onde está o que já existe** (confira a assinatura real antes de usar; não redefina):
  - Retornos: `Retorno` (`id`, `conta_id`, `run_id`, `sugestao: SugestaoRegistrada`, `status: "aguardando" | "respondido"`, `resultado`, `origem: "toque" | "conversa" | null`, `criado_em`, `respondido_em`), `Resultado` (`"ajudou" | "nao_ajudou" | "nao_fez"`), `OutcomeStore` (`criar(contaId, runId, sugestoes)`, `pendentes(contaId)` — só aguardando, mais recente primeiro —, `responder(contaId, retornoId, resultado, origem)` — hoje devolve `Retorno | undefined`; só muda o aguardando e devolve o estado atual —, `doRun`, `apagarAguardandoAntesDe`): `@/core/outcomes/ports`. `registrarResultado({ tx, telemetry }, contaId, retornoId, resultado, origem): Promise<Retorno | undefined>` (soma `contarResultado` no item e nos alimentos do retorno e `ritu_retorno_total{resultado, origem}`): `@/core/outcomes/registrar`. `SugestaoRegistrada` (`tipo`, `pratica_id?`, `preparo_id?`, `alimentos: string[]`, `titulo`), `sugestaoRegistradaSchema`: `@/core/memory-schemas`. Adaptadores: `src/infra/db/outcomes.ts` (`createPgOutcomes`), `criarOutcomes` em `src/infra/fakes/memory-stores.ts`. Suíte: `test/contracts/outcomes.contract.ts`.
  - Preferências: `ItemTipo` (`"alimento" | "pratica" | "preparo"`), `Preferencia` (`gosto`, `ajudou`, `nao_ajudou`, `nao_fez`, `ultimos_resultados`, `ultima_sugestao_em`), `PreferenceStore` (`ler(contaId, itens?)`, `definirGosto(contaId, item, "gosta" | "nao_gosta" | null)`, `contarResultado`, `marcarSugerido(contaId, itens)`, `contagem`): `@/core/preferences/ports`.
  - Faltas e lista: `ShortageStore` (`registrar(contaId, [{ alimento_id, origem: "teria_entrado" | "nao_tenho", run_id? }], dia)` — uma por alimento por dia —, `diasComFalta`, `lista`, `porNaLista` — não duplica): `@/core/shortages/ports`.
  - Casa: `PantryStore` (`listar`, `registrar(contaId, itens, "conversa" | "tela" | "pergunta")` — confirma agora, apaga as faltas e tira da lista —, `marcarAcabou(contaId, itens)` — **não** cria item que não existe (009)): `@/core/pantry/ports`. `estadoDoItem`: `@/core/pantry/estado`.
  - Acompanhante: `SaidaDoAcompanhante` (`origem: "agente" | "segura" | "sem_modelo" | "codigo"`, `sugestoes: SugestaoEntregue[]`, `evitar: { texto; linha_base }[]`, `para_ter?`, `anotacoes`, `propostas`, `propostas_do_agente?`), `SugestaoEntregue` (`tipo`, `pratica_id?` — chá, óleo ou prática —, `preparo_id?` — refeição —, `titulo`, `itens: { alimento_id; nome; funcao?; contribui; verbos; linha_base; casa; observacao?; se_faltar? }[]`, …), `saidaDoAcompanhanteSchema` (z.object: **descarta campo que não conhece**), `saidaSegura`, `saidaSemModelo`, `saidaDeCodigo`: `@/core/agents/companion/saida`. `DadosDoPreparo`, `dadosDoPreparoSchema` (`dia`, `casa: { confirmados; incertos }`, `acabou`, `faltas_do_run`, `para_ter?`, `retorno?: { resultado; titulo?; registrado }`, `candidatos`, `casa_da_mensagem?`; campos novos com `.default(...)` mantêm checkpoints antigos válidos), `preparar` (lê `preferences.ler` em `lerContexto`; `completar` já lê `outcomes.pendentes`; `casaEAcabou(deps, contaId, filtro)` é privada): `@/core/agents/companion/preparo`. `criarFimDoRun({ stores, kb, runs, telemetry }).tratar(contaId, resultado, dados, perfil, extra, manterAberto?)` (`desfecho`: `entregue` válido → `done` com a saída do agente; `entregue` inválido → `failed` com `saidaSegura`; `limite` → `done` com `saidaSegura`; `sem_modelo` → `done` com `saidaSemModeloDe`; `registrarErro(contaId, runId, nome)` privado), `campos`, `saidaSemModeloDe`, `RespostaDoRun`: `@/core/agents/companion/fim-do-run`. `createCompanion(deps)` (`Deps = { stores, kb, clock, weather, router, runs, telemetry }`; `responder`, `continuar`; `semModelo`, `montarCtx` e `sinaisDaPessoa` internos): `@/core/agents/companion/responder`. `montarFiltro({ perfil, evitarDoDia, evitarDaMensagem, preferencias })`: `@/core/agents/companion/filtro-da-pessoa`. `montarMensagemInicial` (monta o contexto campo a campo, com `neutralizar`): `@/core/agents/companion/contexto`. `contextoDoRun(dados)`: `@/core/agents/companion/contexto-do-run`. `criarAcompanhante`: `@/core/agents/companion/agente`. `EntradaDoAcompanhante`, `entradaDoAcompanhanteSchema`: `@/core/agents/companion/entrada`. `acompanhanteV4`: `@/core/agents/prompts/acompanhante.v4`.
  - Conversa: `createConversation(deps)` (`conversar`, `continuar`, `aprovar`), `Deps` (com `tx`): `@/core/conversation/conversar` (`entradaDoAcompanhante(texto, i, intencoes)` é privada ali). `fecharComPropostas`/`fecharOuFalhar` (com `propostasDoFim(p)` privada, que chama `montarPropostas({ anotacoes, doAgente })`): `@/core/conversation/fim-com-propostas`. `registrarRetornoDaConversa`: `@/core/conversation/caminhos-de-codigo`.
  - Propostas: `ConteudoDaProposta`, `PropostaNaSaida`: `@/core/proposals/conteudo`. `montarPropostas({ anotacoes, doAgente, extras? })`: `@/core/proposals/montar`. `textosDasPropostas`, `textoDaProposta`: `@/core/proposals/textos`.
  - Base: `KnowledgeBase` (`alimento(id)`, `preparo(id)`, `pratica(id)`, `alimentos`, `verbo(guna)`): `@/core/knowledge/knowledge-base`. `substitutos({ alimento_id, funcao?, preparo_id?, outros_itens, filtro, sinais, limite }, kb): Substituto[]` (já tira o próprio alimento, confere virya, filtro e `checarCombinacao([...outros_itens, id])`; ordena por gunas em comum → em casa → gosta → ajudou → nome; `Substituto = { alimento_id; nome; em_comum: Guna[]; em_casa: boolean; motivo; linha_base }`, com `motivo` = `fraseDaTroca`), `fraseDaTroca`, `SinaisPessoa` (`{ em_casa; gosta; ajudou }`): `@/core/knowledge/substitutos`. `verbosDasGunas(gunas, kb)`: `@/core/knowledge/verbos`. `passaNoFiltro`, `FiltroPessoa`: `@/core/knowledge/filtros`. `Guna`, `Funcao`: `@/core/knowledge/vocab`.
  - Runs: `RunRepository` (`buscar(contaId, runId)`, `atualizar(contaId, runId, campos)` — atualizar com `{}` só muda `atualizado_em` —, `mudarStatusSe`, `etapas`), `Run` (`saida: unknown`, `status`, `dia`): `@/core/runs/ports`. `montarPergunta({ tipo: "casa", alimentos, incertos }, kb): Pergunta` (texto "Você tem {itens} em casa?" ou "Ainda tem {itens}?"): `@/core/runs/pergunta`. `createRunService(...).gravarEtapa`: `@/core/runs/run-service`.
  - Tools: `ToolContext` (`stores: Pick<Stores, "pantry" | "preferences" | "runs" | "outcomes">`, `run?: ContextoDoRun`, …), `ContextoDoRun`, `Tool`, `definirTool({ name, description, input, output, resumir?, executar })`: `@/core/tools/tool`. O "run vazio" das tools de proposta: `src/core/agents/tools/propostas.ts`.
  - Telemetria: `Telemetry` (`span(nome, atributos, fn)` com `span.atribuir`, `contador(nome, rotulos, valor?)`, `evento`, `log`): `@/core/telemetry/ports`. Nomes fechados em `@/core/telemetry/nomes`: as métricas `ritu_retorno_total`, `ritu_troca_ingrediente_total`, `ritu_gosto_total`, `ritu_faltas_total`, `ritu_para_ter_total` e os rótulos `tipo`, `motivo`, `resultado`, `origem`, `gosto`, `etapa` já existem; o span `toque` não (T1). `createMemoryTelemetry` (falha com nome fora da lista): `@/infra/fakes/memory-telemetry`.
  - Tempo: `diaLocal(agora, fuso?)`, `diasAtras(dia, n)`: `@/core/time/dia-local`. `Clock`: `@/core/clock`. `RituError(code, message)`: `@/core/errors`. `Stores`, `Transactor` (`emTransacao(fn)`): `@/core/stores`.
  - Configuração: `config` (`config.conversa.interprete.pendentesNoContexto` = 5): `@config/index`.
  - Testes: `createFixedClock`, `createScriptedRuntime(roteiro)`, `createMemoryStores` (o `emTransacao` restaura uma cópia do estado se o corpo lança; **não** serializa transações), `createFakeLlm`, mini-base `@/infra/fakes/mini-knowledge`, base real por `getContainer().knowledge` ou `readKnowledgeData` de `@/infra/container`. Cenários: `cenarios` (5, com `entrada`), `cenariosDeConversa` (7; `montar.test.ts` trava em sete), `cenariosComPausa` (4), `cenariosComAprovacao` (3), `montarCenario`, `rodarCenario` (`RodadaDoCenario = { final, perguntas, bloco?, depois? }`), `DepsDoCenario`: `test/fixtures/cenarios`. `Cenario` já tem `retornos?: { sugestao: SugestaoRegistrada; diasAtras }[]`, `preferencias?` (com `gosto`, `ajudou`, `nao_ajudou`, `ultimos_resultados`), `faltas?`, `aprovacao?`, `depois?`. Suítes de contrato: `test/contracts/*.contract.ts` (`ContractEnv = { stores, tx, clock }`, `criarDuasContas`), rodam no fake em `npm test` e no Postgres em `test:db`.
  - `demo`: `scripts/demo.ts` (`listarCenarios`, `acharCenario`, `relatorioDaRodada`), `scripts/lib/demo-report.ts` (`DadosDoRelatorio`, `formatarRelatorio`). `eval:llm`: `scripts/lib/eval-llm-casos.ts` (`rodarConversa`, `cenarioDoRunner`, `contarEtapas`), `scripts/lib/eval-llm-report.ts` (`ResultadoDoCaso`, `resumirPropostas`, `formatarRelatorio`), `scripts/eval-llm.ts` (`versaoDosPrompts` com `acompanhanteV4.versao`), `evals/llm/casos/c2/tipos.ts` (`CasoConversa`, `ExpectativaDaConversa`), `evals/llm/casos/c2/index.ts` (`casosC2`, 34 casos), `evals/llm/casos/c2/perguntas/expectativas.ts` (`terminou()`).
- **Camadas:** `src/core/` só importa `src/core/`, `@config/*` e `zod`. Scripts e evals só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (R6). No core, sem `new Date()` sem argumento nem `Date.now()` (R8). **Sem ciclo entre domínios do core (R9), contando import de tipo:** `agents` já importa `outcomes`, `proposals`, `runs`, `tools`; por isso nada em `outcomes`, `proposals`, `tools` nem `runs` importa `agents` (D1, D2). O domínio novo `touches` pode importar `agents`, `outcomes`, `runs`, `knowledge`, `preferences`, `pantry`, `shortages`, `telemetry`, `time`; nenhum domínio do core importa `touches` (só `src/infra/container.ts`).
- **Privacidade:** nenhum texto da pessoa, título de sugestão, nome ou id de alimento vai para span, métrica, log ou `resumo` de etapa. A etapa `erro` de `registro_da_entrega` tem `resumo: null`. O `resumir` de `resultado.registrar` é só `registrado` ou `recusado: <código>`. O que fica em `runs.saida`, `retornos.sugestao`, `faltas` e `preferencias` é banco, não telemetria: é permitido.
- **Testes:** os padrão rodam sem rede, banco nem chave. Nenhum teste nem eval chama a Gemini.
- **Qualidade:** complexidade cognitiva ≤ 15 por função, `npm run dup` com 0 clones e Biome. Rode `./node_modules/.bin/biome check --write <arquivos>`. O `npm run lint` pelo wrapper rtk dá falso erro ("JSON parse failed"): rode sempre `rtk bypass npm run lint`.
- **Montadores de texto:** troque `{item}` com função de troca (`texto.replace("{item}", () => valor)`), nunca com string de troca.
- **Ambiente:** rtk em `/opt/homebrew/bin`; node em `/Users/helena.batista/.nvm/versions/node/v24.22.2/bin`; sem docker (não há `test:db`: anote que não rodou).
- **Limites:**
  - Não leia `.env.local` (nem com `cat`, `grep` ou `source`) e não abra pastas fora do repositório.
  - Arquivos temporários só no scratchpad, nunca em `/tmp` nem em `$TMPDIR`.
  - Arquivo fora da lista da tarefa: pare e diga qual. Exceção explícita só onde a tarefa disser.
  - Não toque em `.specs/`, `.docs/`, `AGENTS.md` nem `design/`.
  - Não commite.

## Decisões do planejamento

Lacunas e contradições encontradas na spec, com a opção mais conservadora. Cada uma diz como desfazer.

- **D1 · `registrarEntrega` mora em `agents/companion`.** Contradição: a spec põe `src/core/outcomes/registrar-entrega.ts`, mas ele usa `SaidaDoAcompanhante`, `SugestaoEntregue` e `DadosDoPreparo` (de `agents/companion`), e `agents` já importa `outcomes` (`interpreter`, `conversation`): seria ciclo (R9). Decidido: `sugestaoRegistrada`, `idEfetivo` e `registrarEntrega` ficam em `src/core/agents/companion/registrar-entrega.ts`, com as assinaturas da spec. Desfazer: mover os tipos da saída para um domínio neutro e o arquivo para `outcomes`.
- **D2 · `propostaDoParaTer` sem importar `agents`.** Mesma razão (R9, D1 da 010): `proposals` não importa `agents`. Decidido: `propostaDoParaTer(saida: { para_ter?: { alimento_id: string; vezes: number } }): ConteudoDaProposta[]`, tipo estrutural; quem chama passa a `SaidaDoAcompanhante` inteira. Desfazer: mover `montar.ts` para `agents/companion`.
- **D3 · L2 da 008 absorvida: `responder` diz se mudou.** Faltava: `registrarResultado` lê os pendentes e depois chama `responder`; duas chamadas simultâneas (toque e conversa, ou dois toques) leem o retorno aguardando e as duas somam (no Postgres, a segunda espera a trava da linha, o `update` condicional não muda nada e ela soma assim mesmo). Decidido: `OutcomeStore.responder` passa a devolver `Promise<{ retorno: Retorno; mudou: boolean } | undefined>` (`mudou` = o `update ... where status = 'aguardando'` mudou uma linha); `registrarResultado` soma os contadores dos itens de `retorno.sugestao` (o estado depois do update, com os alimentos efetivos de uma troca) e a métrica **só** com `mudou: true`, sem ler os pendentes antes; a assinatura de `registrarResultado` não muda. Desfazer: voltar a ler os pendentes antes.
- **D4 · `tx` no Acompanhante e onde a entrega é gravada.** Faltava: `registrarEntrega` e `resultado.registrar` precisam do `Transactor`, que o `createCompanion` não recebe. Decidido: `Deps` do `createCompanion` ganha `tx: Transactor` (o container e os testes passam `tx`); `criarFimDoRun` recebe `tx` também. A entrega é gravada (a) em `fim-do-run.tratar`, quando o desfecho é `done` e a saída tem origem `agente` (fim `entregue` válido) ou `sem_modelo` (fim `sem_modelo`), antes de `fechar`; (b) em `semModelo` do `responder.ts`, antes de gravar os campos. `ritu_faltas_total` é somado só depois do commit. Desfazer: passar o `Transactor` só para uma função solta.
- **D5 · Pendentes do run.** Faltava: `ctx.run.pendentes` e `retornos_pendentes` no contexto precisam dos retornos com id, que `DadosDoPreparo` não guarda. Decidido: `DadosDoPreparo` ganha `retornos_pendentes: { n; retorno_id; tipo; titulo; ha_dias }[]` (`.default([])`), preenchido em `completar` só quando `entrada.retorno` existe com `registrado: false`, com os `pendentesNoContexto` primeiros de `outcomes.pendentes` (a mesma leitura e ordem que o Intérprete recebeu: nada é criado nem respondido entre uma e outra quando `registrado` é `false`); `n` = posição + 1; `ha_dias` = diferença em dias entre `dados.dia` e o dia local (fuso do perfil) de `criado_em`. `ContextoDoRun` ganha `retorno?` e `pendentes?` (opcional: os testes e evals que montam o run à mão não mudam; ausente vale `[]`); `contextoDoRun` sempre preenche `pendentes`. `ToolContext` ganha `tx?: Transactor` (opcional pelo mesmo motivo); `montarCtx` passa `tx`. Desfazer: ler os pendentes em `montarCtx`.
- **D6 · "Já registrado" em `resultado.registrar`.** Faltava: a spec manda marcar `registrado: true` em `dados.retorno`, mas a tool não grava o checkpoint. Decidido: a tool muda `ctx.run.retorno.registrado` em memória (vale no trecho), e antes de registrar confere que o retorno ainda está em `outcomes.pendentes`; se não estiver (registrado num trecho anterior, por toque ou pela limpeza), recusa com `ja_registrado`. Desfazer: gravar o checkpoint com `dados.retorno.registrado`.
- **D7 · Gosto da mensagem no preparo.** Decidido: `preparar` troca as preferências lidas por uma cópia em que cada id de `gosta_da_mensagem` que existe na base tem `gosto: "gosta"` (cria uma `Preferencia` zerada quando não há); essa cópia vai para `montarFiltro` (o id sai de `filtro.nao_gosta`) e para a ordenação. `DadosDoPreparo` ganha `gosta_da_mensagem?: string[]` com os **nomes** (para o contexto). `ctx.sinais` (das tools) continua lido do banco. Nada é gravado. Desfazer: aplicar também em `sinaisDaPessoa`.
- **D8 · Campos de `troca`.** Faltava: de onde vêm `contribui`, `verbos` e `linha_base` do substituto. Decidido: `contribui` = as gunas de `item.contribui` que estão em `em_comum` do substituto; `verbos` = `verbosDasGunas(contribui, kb)`; `linha_base` = a do `Substituto` (`alimentos:<id>`); `nome` = o da base; `frase` = `motivo` do `Substituto` (é a `fraseDaTroca` do original para o substituto). Desfazer: usar as gunas do substituto que estão nas buscadas.
- **D9 · Casa no toque.** Decidido: o toque usa a mesma leitura do preparo: `casaEAcabou` passa a ser exportada de `preparo.ts` (sem mudar o corpo) e `sinaisDe(preferencias, emCasa)` (pura, nova, em `filtro-da-pessoa.ts`) monta os `SinaisPessoa` no toque e em `sinaisDaPessoa` do `responder` (sem clone para o `dup`). Um substituto é **confirmado** se está em `casa.confirmados`; **acabou** se está em `acabou`; o resto (incerto ou nunca registrado) pode ser perguntado. Como `marcarAcabou` não cria item (009), "Não tenho" para um alimento nunca registrado grava só a falta: num toque seguinte ele pode ser perguntado de novo (anotar para o relatório). Desfazer: excluir da pergunta quem tem falta `nao_tenho` hoje.
- **D10 · Concorrência e métricas dos toques.** Decidido: `trocarIngrediente` e `responderTroca` rodam numa transação cuja **primeira operação** é `s.runs.atualizar(contaId, runId, {})` (no Postgres, trava a linha do run até o commit; o segundo toque espera e lê a saída já trocada); só depois `s.runs.buscar`. O fake em memória não serializa: o caso simultâneo fica para o `test:db`/leitura; os testes cobrem o segundo toque em sequência. Erro `toque_invalido` é lançado **fora** da transação (o corpo devolve um marcador), como a D10 da 010. Métricas (`ritu_troca_ingrediente_total`, `ritu_faltas_total`, `ritu_gosto_total`) somam depois do commit. O span `toque` envolve os quatro toques, com `tipo` (`retorno`, `gosto`, `troca`) e, na troca, `motivo` e `resultado`. Desfazer: transação sem a trava.
- **D11 · `responderTroca` e as métricas.** Decidido: `responderTroca` também confere o teto (passo 4); `nao_tenho` soma `ritu_faltas_total{origem: "nao_tenho"}` e `ritu_troca_ingrediente_total{resultado: "sem_substituto"}`; candidato que deixou de valer devolve `sem_substituto` e soma o mesmo. Desfazer: não somar no caminho da pergunta.
- **D12 · Toques dos cenários.** Faltava: o cenário `dois-nao-ajudou` toca em retornos semeados, que não estão na saída do run. Decidido: o `Toque` de retorno ganha `semeado?: true`; com ele, `sugestao` é a posição em `Cenario.retornos`. `DepsDoCenario` ganha `touches` (do container) e `retornosSemeados: string[]` (ids, na ordem de `Cenario.retornos`). Ordem em `rodarCenario`: entrega → aprovação → toques → `depois`. Os seis cenários novos ficam em `cenariosDeAprendizado` (a trava de sete de `cenariosDeConversa` não muda). Como "já sugerido hoje" tira o item do preparo seguinte, a primeira resposta de `dois-nao-ajudou` não pode sugerir o chá testado. Desfazer: tocar só na saída do run.
- **D13 · Motivo da lista no `demo`.** Faltava: o texto "Fez falta 3 vezes nos últimos 30 dias" é da tela Minha casa (019) e não existe no core. Decidido: o relatório do `demo` monta o motivo dos itens da lista ("Fez falta {detalhe} vezes nos últimos 30 dias" para `fez_falta`; "Faltou para {detalhe}" para `faltou_hoje`), só no script. Desfazer: levar o texto ao core na 019.
- **D14 · Medir aprendizado no `eval:llm`.** Faltava: o caso 4 precisa saber qual retorno foi fechado, e as métricas Aprendizado e Para ter em casa precisam de marca no caso. Decidido: `CasoConversa` ganha `familia?: "aprendizado" | "para_ter"`; a expectativa da conversa recebe também `retornosFechados: string[]` (títulos dos retornos de `cenario.retornos` que não estão mais em `outcomes.pendentes` no fim); o relatório ganha as seções **Aprendizado** e **Para ter em casa** (acerto = todos os `deve` ok e nenhum `naoPode`, por caso e total; sem casos da família, a seção não aparece). `cenarioDoRunner` tira `toques` do cenário, como já tira `aprovacao`. Desfazer: expor os argumentos da tool no resultado.

## Notas de construção (o que mudou depois do plano; vale para todas as tarefas)

- T5: `criarFimDoRun` devolve `{ tratar, entregar }`; `entregar` grava a entrega (e, se falhar, a etapa `registro_da_entrega`, sem `retorno_id`); `semModelo` usa `entregar`. A entrega grava faltas `teria_entrado`: testes que comparam faltas antes/depois contam com elas.
- T10: com `para_ter`, o fim do run propõe a linha `lista.propor`; o cenário `so-atalhos` (roteiro de `frio-agitada`, com `para_ter`) agora termina em `waiting_for_approval`.
- T11: `gosta_da_mensagem` na entrada, no preparo (cópia das preferências, D7) e no contexto. O gosto de um alimento reordena as opções de vaga (`avaliarOpcao`), não a nota do candidato (`Candidato.gosta`/`nota` olham o preparo ou a prática). Lacuna de teste para os evals: nenhuma asserção protege que `ctx.sinais` ignora o gosto da mensagem.
- T8: `src/core/touches/troca.ts` e `aplicar-troca.ts`; o teto conta `anteriores.length + 1` (no máximo 3 trocas). A frase da troca é a de `fraseDaTroca` (ver DECISOES-AUTONOMAS). Lacunas de teste a cobrir nos evals (T18–T20): o teto dentro de `responderTroca` (D11) e `ritu_troca_ingrediente_total{resultado:"sem_substituto"}` nos caminhos `nao_tenho` e candidato inválido de `responderTroca`.

(vazia)

## Tarefas

### T1 · Add the touches config, the touch texts and the touch span
- nivel: mecanica
- objetivo: criar a configuração dos toques, o texto fixo de "sem substituto" e o nome do span `toque`.
- arquivos: `config/toques.ts`, `config/index.ts`, `config/index.test.ts`, `src/core/touches/textos.ts`, `src/core/touches/textos.test.ts`, `src/core/telemetry/nomes.ts`, `src/core/telemetry/nomes.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // config/toques.ts (com uma linha de comentário dizendo o que é cada número)
  export const toques = { maxTrocasPorItem: 3, substitutosAvaliados: 8 } as const
  ```
  `config/index.ts` importa e expõe `toques` em `config`.
  ```ts
  // src/core/touches/textos.ts
  export const textosDosToques = {
    semSubstituto: "Não achei uma troca para {item} com o que você tem em casa.",
  } as const
  export function textoSemSubstituto(nome: string): string   // {item} = nome em minúsculas (toLocaleLowerCase("pt-BR")), troca com função
  ```
  `SPANS` ganha `"toque"` (depois de `"aprovacao.execucao"`). Nenhum atributo novo: `tipo`, `motivo` e `resultado` já estão em `ATRIBUTOS_PERMITIDOS`.
- testes primeiro: `config.toques` igual a `{ maxTrocasPorItem: 3, substitutosAvaliados: 8 }`; `textoSemSubstituto("Gengibre")` = "Não achei uma troca para gengibre com o que você tem em casa."; nome com `$&` sai literal; `SPANS` contém `toque`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: os toques (T7, T8).

### T2 · Add atualizarSugestao to the outcome store
- nivel: mecanica
- objetivo: dar ao `OutcomeStore` a troca da sugestão de um retorno ainda aguardando, nos dois adaptadores e na suíte de contrato.
- arquivos: `src/core/outcomes/ports.ts`, `src/infra/db/outcomes.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/outcomes.contract.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha 21 ("Autorização por conta no repositório")
- contratos:
  ```ts
  // OutcomeStore
  atualizarSugestao(contaId: string, retornoId: string, sugestao: SugestaoRegistrada): Promise<Retorno | undefined>
  ```
  Valida `sugestao` com `sugestaoRegistradaSchema` antes de gravar (inválida lança e não grava). Só muda retorno da conta com `status = 'aguardando'` (Postgres: `update retornos set sugestao = ... where id = $1 and conta_id = $2 and status = 'aguardando' returning ...`); devolve o retorno atualizado, ou `undefined` quando não mudou (respondido, de outra conta, inexistente). Sem migração.
- testes primeiro (na suíte de contrato): troca a sugestão de um aguardando e `pendentes` passa a trazer a nova; retorno respondido não muda (`undefined`, sugestão antiga); conta B não muda o retorno da conta A (`undefined`); sugestão fora do schema lança e não grava.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run test:db` se o Postgres estiver no ar (anote se não estiver).
- pronto quando: a suíte passa no fake.
- fora: `responder` (T3).

### T3 · Count a return only when the conditional update changed it
- nivel: nucleo
- objetivo: absorver a L2 da 008: `responder` diz se mudou o retorno, e `registrarResultado` só soma quando mudou (D3).
- arquivos: `src/core/outcomes/ports.ts`, `src/core/outcomes/registrar.ts`, `src/core/outcomes/registrar.test.ts`, `src/infra/db/outcomes.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/outcomes.contract.ts`, `src/core/cleanup.test.ts`, `src/core/agents/tools/memoria.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha 21 ("Autorização por conta no repositório")
- contratos:
  ```ts
  // OutcomeStore
  /** Só o aguardando muda; mudou diz se este chamado mudou. Retorno inexistente ou de outra conta: undefined. */
  responder(contaId: string, retornoId: string, resultado: Resultado, origem: "toque" | "conversa"): Promise<{ retorno: Retorno; mudou: boolean } | undefined>
  ```
  Postgres: `mudou` = o `update ... where id and conta_id and status = 'aguardando' returning id` devolveu linha; depois lê o estado atual. Fake: `mudou` = estava aguardando.
  `registrarResultado` (assinatura igual: `({ tx, telemetry }, contaId, retornoId, resultado, origem): Promise<Retorno | undefined>`): numa transação, `const r = await s.outcomes.responder(...)`; com `r?.mudou`, soma `contarResultado` para o item (`pratica` com `pratica_id`, ou `preparo` com `preparo_id`) e cada alimento de `r.retorno.sugestao`; não lê mais os pendentes antes. `ritu_retorno_total{resultado, origem}` só com `mudou`, depois do commit. Devolve `r?.retorno`.
- testes primeiro: no contrato, `responder` devolve `mudou: true` na primeira vez e `mudou: false` (com o estado atual) na segunda; inexistente e de outra conta continuam `undefined`. Em `registrar.test.ts`: soma uma vez; segundo registro não soma nem conta métrica; os alimentos somados são os de `retorno.sugestao` (troque a sugestão com `atualizarSugestao` antes e confira que contam os novos); duas chamadas com `Promise.all` no fake somam uma vez só. Ajuste os usos em `cleanup.test.ts` e `memoria.test.ts` ao novo formato.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run test:db` se o Postgres estiver no ar (anote se não estiver).
- pronto quando: os testes passam e nenhum outro uso de `outcomes.responder` ficou com o formato antigo (`grep -rn "outcomes.responder" src test evals scripts`).
- fora: toques (T7).

### T4 · Add retorno_id and troca to the companion output, and sugestaoRegistrada
- nivel: mecanica
- objetivo: acrescentar `retorno_id` à sugestão entregue e `troca` ao item, no tipo e no schema, e criar as funções puras do id efetivo e da sugestão registrada.
- arquivos: `src/core/agents/companion/saida.ts`, `src/core/agents/companion/saida.test.ts`, `src/core/agents/companion/registrar-entrega.ts` (novo, D1), `src/core/agents/companion/registrar-entrega.test.ts` (novo)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // SugestaoEntregue
  retorno_id?: string
  // item de SugestaoEntregue
  troca?: {
    alimento_id: string; nome: string
    contribui: Guna[]; verbos: string[]; linha_base: string
    frase: string                       // fraseDaTroca (002)
    anteriores: string[]                // ids já usados neste item, sem o atual
  }
  ```
  O schema (`saidaDoAcompanhanteSchema`) ganha os dois campos, opcionais (sem eles, o `safeParse` descartaria os campos de uma saída gravada).
  ```ts
  // registrar-entrega.ts
  /** O id efetivo de um item é troca.alimento_id, ou alimento_id quando não há troca. */
  export function idEfetivo(item: SugestaoEntregue["itens"][number]): string
  export function sugestaoRegistrada(s: SugestaoEntregue): SugestaoRegistrada
  // tipo, pratica_id ou preparo_id, titulo; alimentos: o id efetivo de cada item (troca.alimento_id, se houver)
  ```
  `sugestaoRegistrada` só põe `pratica_id`/`preparo_id` quando existem; `alimentos` na ordem dos itens.
- testes primeiro: saída com `retorno_id` e item com `troca` passa no schema e volta igual; sem eles, igual a hoje; `idEfetivo` com e sem troca; `sugestaoRegistrada` de um chá (pratica_id), de uma refeição com um item trocado (alimento efetivo) e de uma prática sem itens (`alimentos: []`), validada por `sugestaoRegistradaSchema`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `registrarEntrega` (T5).

### T5 · Record the delivery from the companion
- nivel: nucleo
- objetivo: criar `registrarEntrega` (retornos, "já sugerido" e faltas numa transação) e chamá-lo no Acompanhante quando a resposta é entregue.
- arquivos: `src/core/agents/companion/registrar-entrega.ts`, `src/core/agents/companion/registrar-entrega.test.ts`, `src/core/agents/companion/fim-do-run.ts`, `src/core/agents/companion/fim-do-run.test.ts`, `src/core/agents/companion/responder.ts`, `src/core/agents/companion/responder.test.ts`, `src/core/conversation/continuar.test.ts`, `src/core/conversation/conversar.test.ts`, `src/infra/container.ts`
- leitura: `AI.md` §6 ("Faltas e "vale ter em casa" (código)"); `BUSINESS.md` §9 ("O que fez falta") e §10
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 47 ("Memórias")
- contratos:
  ```ts
  export function registrarEntrega(
    deps: { tx: Transactor; telemetry: Telemetry },
    p: { contaId: string; runId: string; dia: string; saida: SaidaDoAcompanhante; dados: DadosDoPreparo },
  ): Promise<SaidaDoAcompanhante>            // a saída, com retorno_id em cada sugestão
  ```
  Numa transação, só quando `saida.origem` é `agente` ou `sem_modelo`; nas outras, devolve a saída como veio:
  1. Com sugestões: `outcomes.criar(contaId, runId, saida.sugestoes.map(sugestaoRegistrada))`; cada sugestão recebe o `retorno_id`, na ordem. Sem sugestões: nenhum retorno.
  2. `preferences.marcarSugerido`: para cada sugestão, o item dela (`pratica` com `pratica_id`, ou `preparo` com `preparo_id`) e cada alimento (id efetivo), sem repetir (tipo + id), numa chamada só.
  3. Faltas: os ids de `dados.faltas_do_run` que não estão em `dados.casa.confirmados` nem em `dados.casa.incertos` → `shortages.registrar(contaId, [{ alimento_id, origem: "teria_entrado", run_id }], dia)` (numa chamada só; sem nenhum, não chama). Depois do commit, soma `ritu_faltas_total{origem: "teria_entrado"}` por falta.
  Se qualquer parte lançar, nada fica (a transação desfaz) e o erro sobe.
  - Chamada no Acompanhante (D4): `Deps` do `createCompanion` ganha `tx: Transactor`; `criarFimDoRun` recebe `tx`. Em `tratar`, depois de `desfecho` e antes de `fechar`: se `alvo === "done"` e `saida.origem` é `agente` ou `sem_modelo`, `saida = await registrarEntrega(...)` com `dia: dados.dia` e o `run.id`. Em `semModelo` (`responder.ts`), o mesmo antes de gravar os campos. Se `registrarEntrega` lançar, o run segue com a saída sem `retorno_id` e grava a etapa `{ tipo: "erro", nome: "registro_da_entrega", status: "falhou", resumo: null, duracao_ms: 0, modelo: null, tokens_entrada: 0, tokens_saida: 0 }`. A saída gravada em `runs.saida` e devolvida é a com `retorno_id`.
  - `src/infra/container.ts`: passa `tx: container.tx` ao `createCompanion`. Os testes que montam `createCompanion`/`criarFimDoRun` passam `tx` (o `createMemoryStores` é também o `Transactor`).
- testes primeiro (`createMemoryStores`, mini-base ou base real, runtime roteirizado): entrega com 3 sugestões cria 3 retornos `aguardando` na ordem, e cada sugestão da saída gravada no run leva o `retorno_id` certo; o item e cada alimento ficam com `ultima_sugestao_em`; faltas `teria_entrado` com o `run_id`, menos as que estão em casa (confirmado ou incerto) — inclusive a que entrou em `casa.confirmados` por "Tenho" numa pausa (`continuar`); duas entregas no mesmo dia gravam uma falta por alimento; resposta sem sugestão grava faltas e nenhum retorno; saída `segura` (limite, saída inválida, erro), de `codigo` e run `failed` não gravam nada; fim `sem_modelo` e `semModelo` gravam; falha no `shortages.registrar` não deixa retorno nem "já sugerido", grava a etapa `erro` `registro_da_entrega` e a resposta chega sem `retorno_id`; `ritu_faltas_total` soma por falta só quando grava.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes passam e os evals existentes continuam verdes.
- fora: toques; `resultado.registrar` (T14).

### T6 · Export the house and signals helpers for the touches
- nivel: mecanica
- objetivo: deixar a leitura da casa do preparo e a montagem dos sinais disponíveis para os toques, sem clone (D9).
- arquivos: `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/filtro-da-pessoa.ts`, `src/core/agents/companion/filtro-da-pessoa.test.ts`, `src/core/agents/companion/responder.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `casaEAcabou(deps, contaId, filtro)` de `preparo.ts` passa a ser `export`, sem mudar assinatura nem corpo (devolve `{ casa: { confirmados; incertos }; acabou: string[] }`).
  - `filtro-da-pessoa.ts`:
    ```ts
    export function sinaisDe(preferencias: Preferencia[], emCasa: string[]): SinaisPessoa
    // em_casa: emCasa; gosta: item_id das preferências com gosto "gosta"; ajudou: { item_id: ajudou } das que têm ajudou > 0
    ```
  - `sinaisDaPessoa` do `responder.ts` passa a usar `sinaisDe(await stores.preferences.ler(contaId), dados.casa.confirmados)`; o resultado não muda.
- testes primeiro: `sinaisDe` com gosta, nao_gosta, ajudou 0 e ajudou 2; os testes do `responder` continuam verdes.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: os toques.

### T7 · Add tocarRetorno and tocarGosto
- nivel: mecanica
- objetivo: criar os toques de retorno e de gosto, como funções do core, sem modelo.
- arquivos: `src/core/touches/deps.ts` (novo), `src/core/touches/retorno.ts`, `src/core/touches/retorno.test.ts`, `src/core/touches/gosto.ts`, `src/core/touches/gosto.test.ts`
- leitura: `BUSINESS.md` §9 ("Gostos") e §10
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha 21 ("Autorização por conta no repositório")
- contratos:
  ```ts
  // deps.ts
  export type Deps = { tx: Transactor; stores: Stores; kb: KnowledgeBase; clock: Clock; telemetry: Telemetry }

  // retorno.ts
  export function tocarRetorno(deps: Deps, contaId: string, retornoId: string, resultado: Resultado): Promise<Retorno>
  // registrarResultado(..., "toque"); sem retorno: RituError "toque_invalido"

  // gosto.ts
  export function tocarGosto(deps: Deps, contaId: string, item: { tipo: ItemTipo; id: string }, gosto: "gosta" | "nao_gosta" | null): Promise<void>
  // item fora da base: "toque_invalido"; preferences.definirGosto; ritu_gosto_total{gosto: "gosta" | "nao_gosta" | "limpou"}
  ```
  - `tocarRetorno`: dentro do span `toque` com `{ tipo: "retorno" }`; `registrarResultado({ tx, telemetry }, contaId, retornoId, resultado, "toque")`; `undefined` (inexistente, de outra conta, apagado pela limpeza) → `throw new RituError("toque_invalido", "Toque inválido")`. Retorno já respondido (pelo toque ou pela conversa) é devolvido como está, sem somar (T3).
  - `tocarGosto`: dentro do span `toque` com `{ tipo: "gosto" }`; item da base conforme o tipo (`kb.alimento`, `kb.preparo`, `kb.pratica`); fora → `toque_invalido`; `stores.preferences.definirGosto(contaId, item, gosto)`; depois, `ritu_gosto_total{gosto}` com `limpou` quando `gosto` é `null`.
  - Mensagem do erro igual nos toques: "Toque inválido".
- testes primeiro (`createMemoryStores`, mini-base, `createMemoryTelemetry`): toque soma os contadores do item e dos alimentos e fecha com origem `toque`; tocar de novo devolve o retorno sem somar outra vez; retorno fechado pela conversa e depois tocado devolve como está; retorno de outra conta e inexistente → `toque_invalido`; gosto `gosta`, `nao_gosta`, `null` gravam e somam a métrica com o rótulo certo; item fora da base → `toque_invalido` e nada gravado; o span `toque` sai com `tipo` e sem nome de alimento.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: troca (T8); container (T9).

### T8 · Add trocarIngrediente and responderTroca
- nivel: nucleo
- objetivo: trocar um ingrediente de uma sugestão entregue por código, só com o que está confirmado em casa, com uma pergunta quando não há confirmado.
- arquivos: `src/core/touches/troca.ts`, `src/core/touches/troca.test.ts`, `src/core/touches/aplicar-troca.ts` (opcional, para caber na complexidade)
- leitura: `BUSINESS.md` §9 ("Trocar um ingrediente" e "O que fez falta")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha 21 ("Autorização por conta no repositório")
- contratos:
  ```ts
  export type MotivoDaTroca = "trocar" | "nao_tenho" | "nao_gosto"
  export type ResultadoDaTroca =
    | { resultado: "trocou"; sugestao: SugestaoEntregue }
    | { resultado: "perguntar"; pergunta: { alimento_id: string; nome: string; texto: string } }
    | { resultado: "sem_substituto"; texto: string }
  export function trocarIngrediente(deps: Deps, contaId: string, p: { runId: string; sugestao: number; alimento_id: string; motivo: MotivoDaTroca }): Promise<ResultadoDaTroca>
  export function responderTroca(deps: Deps, contaId: string, p: { runId: string; sugestao: number; alimento_id: string; candidato: string; resposta: "tenho" | "nao_tenho" }): Promise<ResultadoDaTroca>
  ```
  `Deps` de `./deps` (T7). `sugestao` é a posição na saída, a partir de 0. `alimento_id` é o id efetivo do ingrediente tocado (`idEfetivo`, T4).

  Ordem de `trocarIngrediente`, numa transação (primeira operação `s.runs.atualizar(contaId, runId, {})`, D10) e dentro do span `toque` (`tipo: "troca"`, `motivo`, e `resultado` ao fim com `span.atribuir`):
  1. Busca o run da conta (`s.runs.buscar`), lê `run.saida` com `saidaDoAcompanhanteSchema.safeParse`, a sugestão na posição e o item cujo id efetivo é `alimento_id`. Sem run, sem saída, posição ou item que não existe, sugestão sem `retorno_id` ou com retorno que não está em `s.outcomes.pendentes(contaId)`: `toque_invalido` (lançado fora da transação, D10).
  2. Pelo motivo: `nao_tenho` → `pantry.marcarAcabou(contaId, [{ alimento_id }])` e `shortages.registrar(contaId, [{ alimento_id, origem: "nao_tenho", run_id }], dia)` (dia = `diaLocal(clock.now(), perfil.cidade_fuso)`), e depois `ritu_faltas_total{origem: "nao_tenho"}`; `nao_gosto` → `preferences.definirGosto(contaId, { tipo: "alimento", id: alimento_id }, "nao_gosta")` e depois `ritu_gosto_total{gosto: "nao_gosta"}`; `trocar` → nada.
  3. Lê o perfil, os temporários do dia (`profiles.evitarTemporario(contaId, dia)`), as preferências e a casa (`casaEAcabou`, T6); monta o filtro (`montarFiltro({ perfil, evitarDoDia, evitarDaMensagem: [], preferencias })`) e os sinais (`sinaisDe(preferencias, casa.confirmados)`). Tudo depois do passo 2 (o "não gosto" e o "acabou" já valem).
  4. Com `troca.anteriores` já em `maxTrocasPorItem` (`config.toques`): `sem_substituto`.
  5. `substitutos({ alimento_id: <id original do item>, funcao: item.funcao, preparo_id: sugestao.preparo_id, outros_itens: <ids efetivos dos outros itens>, filtro, sinais, limite: substitutosAvaliados }, kb)`, tirando o id efetivo atual, os `anteriores` e os que têm `alimentos:<id>` em `saida.evitar[].linha_base`.
  6. O primeiro que está **confirmado** em casa: aplica a troca (abaixo) e devolve `trocou`.
  7. Senão, o primeiro que está incerto ou nunca foi registrado (o que está em `acabou` não entra) (D9): devolve `perguntar`, com `{ alimento_id, nome, texto }` e o texto de `montarPergunta({ tipo: "casa", alimentos: [id], incertos: casa.incertos }, kb).texto`.
  8. Senão: `sem_substituto` com `textoSemSubstituto(<nome do item tocado>)` (T1).

  Aplicar a troca: preenche `item.troca` (D8: `alimento_id`, `nome`, `contribui` = gunas de `item.contribui` em `em_comum`, `verbos` = `verbosDasGunas(contribui, kb)`, `linha_base`, `frase` = `motivo` do substituto, `anteriores` = os de antes mais o id efetivo que saiu, quando ele não é o original); o item original (`alimento_id`, `nome`, …) fica como está; grava a saída com `runs.atualizar(contaId, runId, { saida })` (nada mais muda no run; as propostas não mudam, mesmo em `waiting_for_approval`); `outcomes.atualizarSugestao(contaId, retorno_id, sugestaoRegistrada(sugestaoNova))`; `preferences.marcarSugerido(contaId, [{ tipo: "alimento", id: substituto }])`; depois do commit, `ritu_troca_ingrediente_total{resultado: "trocou"}`. Em `sem_substituto`: `ritu_troca_ingrediente_total{resultado: "sem_substituto"}`. O que o passo 2 gravou fica gravado nos três resultados. Nenhuma chamada de modelo; o texto da resposta não muda.

  `responderTroca` (mesma transação com a trava, mesmo span com `motivo: "trocar"`): confere como no passo 1, o teto do passo 4 (D11) e que `candidato` ainda sai do passo 5 (refeito agora); se não sai, `sem_substituto`. `tenho` → `pantry.registrar(contaId, [{ alimento_id: candidato }], "pergunta")` e aplica a troca com o candidato (devolve `trocou`). `nao_tenho` → `pantry.marcarAcabou(contaId, [{ alimento_id: candidato }])`, falta `nao_tenho` do candidato (com `run_id` e o dia local), devolve `sem_substituto` com `textoSemSubstituto(<nome do item tocado>)`; métricas da D11. Nunca uma segunda pergunta. Nenhuma proposta de lista.
- testes primeiro (`createMemoryStores`, base real como nos evals de `evals/det/base/`, runtime roteirizado ou saída gravada direto no run com `retorno_id` de um retorno criado): Trocar na canela do `cha-gengibre-canela` com cardamomo confirmado → `trocou`, frase "Troquei canela por cardamomo: os dois aquecem." (se a base der outra frase, pare e diga), `runs.saida` com `troca`, retorno aguardando com os alimentos efetivos, "já sugerido" do substituto; o substituto nunca está em "evitar sempre", restrição, "não como", "não gosto" nem em `saida.evitar`, nem forma combinação incompatível; trocar de novo parte do id efetivo e não repete original nem anteriores; teto de 3 → `sem_substituto` sem mudar a sugestão; sem confirmado com um incerto ou nunca registrado → `perguntar` (o `acabou` não é perguntado); `responderTroca` `tenho` registra em casa com origem `pergunta` e troca; `nao_tenho` marca acabou, grava falta `nao_tenho` e devolve `sem_substituto`; candidato que virou "não gosto" entre a pergunta e a resposta → `sem_substituto`; motivo `nao_tenho` marca acabou, grava a falta e troca no mesmo pedido; motivo `nao_gosto` grava `nao_gosta` e troca; retorno respondido, outra conta, posição ou item inexistente → `toque_invalido` sem gravar nada; segundo toque no id que já saiu → `toque_invalido`; nenhum `llm` (o runtime roteirizado não é chamado); métricas e span sem nome de alimento.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: container (T9); cenários (T15, T16).

### T9 · Wire the touches in the container
- nivel: mecanica
- objetivo: expor os quatro toques no container, já com as dependências.
- arquivos: `src/core/touches/index.ts` (novo), `src/core/touches/index.test.ts` (novo), `src/infra/container.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/core/touches/index.ts
  export function createTouches(deps: Deps): {
    tocarRetorno(contaId: string, retornoId: string, resultado: Resultado): Promise<Retorno>
    tocarGosto(contaId: string, item: { tipo: ItemTipo; id: string }, gosto: "gosta" | "nao_gosta" | null): Promise<void>
    trocarIngrediente(contaId: string, p: { runId: string; sugestao: number; alimento_id: string; motivo: MotivoDaTroca }): Promise<ResultadoDaTroca>
    responderTroca(contaId: string, p: { runId: string; sugestao: number; alimento_id: string; candidato: string; resposta: "tenho" | "nao_tenho" }): Promise<ResultadoDaTroca>
  }
  export type { MotivoDaTroca, ResultadoDaTroca } from "./troca"
  ```
  Container: ganha `touches: ReturnType<typeof createTouches>`, preguiçoso como os outros, com `{ tx, stores, kb: knowledge, clock, telemetry }` do próprio container.
- testes primeiro: `createTouches` com `createMemoryStores` chama cada toque com as deps (um toque de gosto grava; um retorno inexistente lança `toque_invalido`).
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: rotas HTTP (018 e 019).

### T10 · Add propostaDoParaTer and pass it to the run end
- nivel: mecanica
- objetivo: transformar o `para_ter` da saída na linha de lista do bloco de aprovação.
- arquivos: `src/core/proposals/montar.ts`, `src/core/proposals/montar.test.ts`, `src/core/conversation/fim-com-propostas.ts`, `src/core/conversation/fim-com-propostas.test.ts`
- leitura: `BUSINESS.md` §9 ("Vale ter em casa")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 48 ("Modo de aprovação")
- contratos:
  ```ts
  // montar.ts (D2: tipo estrutural, sem importar agents)
  export function propostaDoParaTer(saida: { para_ter?: { alimento_id: string; vezes: number } }): ConteudoDaProposta[]
  // com saida.para_ter: [{ tool: "lista.propor", alimento_id, motivo: "fez_falta", detalhe: String(vezes) }]; sem: []
  ```
  `propostasDoFim` (em `fim-com-propostas.ts`) passa `extras: propostaDoParaTer(p.saida)` a `montarPropostas`. Com incômodo ou caminho sem proposta, continua `[]`. A linha do bloco sai pelo texto que já existe (`listaFezFalta`: `{Item} na lista "Para ter em casa" (já fez falta {detalhe} vezes)`).
- testes primeiro: com `para_ter` → uma linha `lista.propor` com `fez_falta` e `detalhe: "3"`; sem → `[]`; no fim do run, saída com `para_ter` gera a proposta e o run vai a `waiting_for_approval`; com `com_incomodo`, nenhuma; a linha fica na posição de `lista` na ordem do bloco.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `aprovar` (já soma `ritu_para_ter_total`).

### T11 · Let a like written in the message count in the run
- nivel: nucleo
- objetivo: levar o "gosto" da mensagem até o preparo e o contexto, valendo no mesmo run sem gravar (D7).
- arquivos: `src/core/agents/companion/entrada.ts`, `src/core/agents/companion/entrada.test.ts`, `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts`, `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/preparo.test.ts`, `src/core/agents/companion/contexto.ts`, `src/core/agents/companion/contexto.test.ts`
- leitura: `AI.md` §6 ("Ordenação (código)"); `BUSINESS.md` §9 ("Gostos")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 47 ("Memórias")
- contratos:
  ```ts
  // EntradaDoAcompanhante (007)
  gosta_da_mensagem?: string[]                                              // ids de alimentos
  ```
  - `conversar`: `entradaDoAcompanhante` leva `gosta_da_mensagem: i.gosta.map((g) => g.alimento_id)` quando `i.gosta` não está vazio.
  - `preparar`: cada id de `gosta_da_mensagem` que existe na base conta como `gosto: "gosta"` nas preferências usadas pela ordenação e sai de `filtro.nao_gosta` neste run (D7: uma cópia das preferências, com `Preferencia` zerada para quem não tem, vai a `montarFiltro` e a `montarCandidatos`). Nada é gravado. `DadosDoPreparo` ganha `gosta_da_mensagem: z.array(z.string()).optional()` com os nomes da base, só quando há.
  - Contexto (`montarMensagemInicial`): com gosto na mensagem, `gosta_da_mensagem: [nomes]` (com `neutralizar`), logo depois de `casa_da_mensagem`.
  - A anotação `gosta` e a proposta já existem (008, 010): "Gosto" de alimento em "evitar sempre", restrição ou "não como" é ignorado pelo Intérprete e por `montarAnotacoes`; o filtro desses continua valendo no preparo.
- testes primeiro: "adoro gengibre" (interpretação com `gosta: [{ alimento_id: "gengibre", nome: "Gengibre" }]`) → `entrada.gosta_da_mensagem = ["gengibre"]`; no preparo, candidato com gengibre tem `gosta: true` e nota maior que sem a mensagem; alimento com `nao_gosta` gravado e citado como gosto volta aos candidatos neste run; `preferences` não muda; id fora da base é ignorado; o contexto traz `gosta_da_mensagem` depois de `casa_da_mensagem`; sem gosto, o contexto não muda.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes passam e os evals existentes continuam verdes.
- fora: prompt (T13).

### T12 · Add the pending returns to the run data, the model context and ctx.run
- nivel: nucleo
- objetivo: dar ao run os retornos pendentes numerados como o Intérprete viu, no contexto do modelo e no `ctx.run` da tool (D5).
- arquivos: `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/preparo.test.ts`, `src/core/agents/companion/contexto.ts`, `src/core/agents/companion/contexto.test.ts`, `src/core/agents/companion/contexto-do-run.ts`, `src/core/agents/companion/contexto-do-run.test.ts`, `src/core/tools/tool.ts`
- leitura: `BUSINESS.md` §10
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `DadosDoPreparo` ganha (com `.default([])`):
    ```ts
    retornos_pendentes: { n: number; retorno_id: string; tipo: "cha" | "refeicao" | "oleo" | "pratica"; titulo: string; ha_dias: number }[]
    ```
    Preenchido em `completar` só com `entrada.retorno` e `registrado: false`: os `config.conversa.interprete.pendentesNoContexto` primeiros de `outcomes.pendentes(contaId)` (já lidos ali), `n` = posição + 1, `ha_dias` = dias inteiros entre `dados.dia` e `diaLocal(new Date(criado_em), perfil.cidade_fuso ?? undefined)`.
  - Contexto: com `retorno` na entrada e `registrado: false`, logo depois de `retorno`, `retornos_pendentes: [{ n, tipo, titulo, ha_dias }]` (título com `neutralizar`; sem `retorno_id`). Com `registrado: true` ou sem retorno, o campo não aparece.
  - `ContextoDoRun` (em `tool.ts`) ganha:
    ```ts
    retorno?: { resultado: Resultado; registrado: boolean }
    pendentes?: { n: number; retorno_id: string }[]      // D5: ausente vale []
    ```
    `ToolContext` ganha `tx?: Transactor` (D5). `contextoDoRun(dados)` põe `retorno` (de `dados.retorno`: `resultado` e `registrado`) quando existe e sempre `pendentes` (de `retornos_pendentes`: `n` e `retorno_id`).
- testes primeiro: com retorno `registrado: false` e três retornos aguardando, `retornos_pendentes` na ordem de `pendentes` (mais recente primeiro), numerados 1..3, com `ha_dias` certo (retorno de ontem = 1, de hoje = 0); com seis aguardando, só cinco; com `registrado: true` ou sem retorno, vazio; o contexto mostra o campo logo depois de `retorno`, sem `retorno_id`; `contextoDoRun` com e sem retorno; um checkpoint antigo (sem o campo) continua válido.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: a tool (T14).

### T13 · Add the companion prompt v5
- nivel: mecanica
- objetivo: criar o prompt `acompanhante.v5`, cópia da v4 com a linha de retorno trocada por duas.
- arquivos: `src/core/agents/prompts/acompanhante.v5.ts`, `src/core/agents/prompts/acompanhante.v5.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `export const acompanhanteV5 = { versao: "acompanhante.v5", instrucoes, lembreteDeEntrega } as const`, cópia de `acompanhanteV4` (mesmo `lembreteDeEntrega`). A linha que começa com "- retorno:" é substituída por estas duas, nesta ordem:
  ```text
  - retorno: a pessoa contou como foi uma sugestão. Reconheça em uma frase. Com registrado true, já está anotado. Com registrado false, veja retornos_pendentes: se der para saber de qual sugestão ela fala, chame resultado.registrar com o número dela; se não der, diga que ela pode marcar em "Como ficou?". Nunca diga que anotou sem a tool ter devolvido registrado: true.
  - gosta_da_mensagem: alimentos de que a pessoa acabou de dizer que gosta. Já contam na ordem dos candidatos. Não diga que anotou.
  ```
- testes primeiro (como `acompanhante.v4.test.ts`): versão `acompanhante.v5` e lembrete igual ao da v4; desfazendo a troca (as duas linhas pela linha da v4), as linhas ficam iguais às da v4; as duas linhas estão no lugar da antiga, nesta ordem; só uma linha começa com "- retorno:".
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `criarAcompanhante` (T14).

### T14 · Add the resultado.registrar tool and give it and v5 to the companion
- nivel: nucleo
- objetivo: criar a tool que liga um retorno contado na conversa ao pendente certo e passar o Acompanhante para a v5 com a tool nova.
- arquivos: `src/core/agents/tools/resultado.ts`, `src/core/agents/tools/resultado.test.ts`, `src/core/agents/companion/agente.ts`, `src/core/agents/companion/agente.test.ts`, `src/core/agents/companion/responder.ts`, `scripts/eval-llm.ts`
- leitura: `AI.md` §4 (só a tabela "Escrita" e "Controle", para o padrão de recusa)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha 44 ("Tools com catálogo fechado e cadeia")
- contratos:
  ```ts
  export const resultadoRegistrar: Tool<{ pendente: number }, { registrado: true; titulo: string } | { registrado: false; motivo: "sem_retorno" | "ja_registrado" | "fora_dos_pendentes" }>
  // name: "resultado.registrar"
  // description: "Anota como foi uma sugestão anterior, quando a pessoa contou isso na mensagem. Passe o número da sugestão em retornos_pendentes."
  ```
  Feita com `definirTool`; entrada `z.object({ pendente: z.number().int() })`. Lê `ctx.run` (T12):

  | Código | Recusa quando |
  |---|---|
  | `sem_retorno` | `ctx.run.retorno` não existe |
  | `ja_registrado` | `retorno.registrado` é `true`, ou a tool já registrou neste run, ou o retorno não está mais em `ctx.stores.outcomes.pendentes(ctx.contaId)` (D6) |
  | `fora_dos_pendentes` | `pendente` não está em `ctx.run.pendentes` (por `n`) |

  Aceita: `registrarResultado({ tx: ctx.tx, telemetry: ctx.telemetry }, ctx.contaId, retorno_id, retorno.resultado, "conversa")` e marca `ctx.run.retorno.registrado = true` (D6); devolve `{ registrado: true, titulo }` com o título do retorno registrado. O resultado vem sempre de `ctx.run.retorno.resultado` (do Intérprete); a tool recebe só o número. Sem `ctx.tx`, lança `Error("resultado.registrar sem transação")`. `resumir`: `registrado` ou `recusado: <código>`.
  - `criarAcompanhante` usa `acompanhanteV5` (instruções, versão, lembrete) e acrescenta `resultadoRegistrar` às tools (depois de `listaPropor`).
  - `montarCtx` (`responder.ts`) passa `tx: deps.tx` (T5) no `ToolContext`.
  - `scripts/eval-llm.ts`: `versaoDosPrompts` usa `acompanhanteV5.versao`.
  - `resultado.registrar` e `finalizar` no mesmo passo: as chamadas já rodam em sequência (`processarChamadas`), então o registro entra antes da entrega; confira num teste.
- testes primeiro (`createMemoryStores`, runtime roteirizado): um caso por código de recusa e um aceito; o resultado gravado é o do `ctx.run.retorno` (nunca um vindo da entrada); chamada duas vezes no mesmo run → segunda `ja_registrado` e a contagem soma uma vez; retorno fechado por toque antes → `ja_registrado`; `resumir` sem título; `criarAcompanhante` com a v5 e a tool nova; roteiro `resultado.registrar` + `finalizar` no mesmo passo fecha o retorno com origem `conversa` antes da entrega.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes passam e os evals existentes continuam verdes.
- fora: cenários (T16); casos do `c2` (T22).

### T15 · Let scenarios run touches
- nivel: mecanica
- objetivo: dar aos cenários uma lista de toques executados depois da entrega e da aprovação (D12).
- arquivos: `test/fixtures/cenarios/tipos.ts`, `test/fixtures/cenarios/montar.ts`, `test/fixtures/cenarios/rodar.ts`, `test/fixtures/cenarios/montar.test.ts`, `test/fixtures/cenarios/rodar.test.ts` (novo)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // tipos.ts
  export type Toque =
    | { tipo: "retorno"; sugestao: number; resultado: Resultado; semeado?: true }   // D12: com semeado, posição em Cenario.retornos
    | { tipo: "gosto"; item: { tipo: ItemTipo; id: string }; gosto: "gosta" | "nao_gosta" | null }
    | { tipo: "troca"; sugestao: number; alimento_id: string; motivo: MotivoDaTroca; resposta?: "tenho" | "nao_tenho" }
  // Cenario ganha:
  toques?: Toque[]
  ```
  - `DepsDoCenario` ganha `touches` (`container.touches`, T9) e `retornosSemeados: string[]` (ids dos retornos de `Cenario.retornos`, na ordem).
  - `rodar.ts`: `RodadaDoCenario` ganha `toques?: ToqueFeito[]`, só quando o cenário tem toques:
    ```ts
    export type ToqueFeito =
      | { tipo: "retorno"; retorno: Retorno }
      | { tipo: "gosto" }
      | { tipo: "troca"; resultado: ResultadoDaTroca; resposta?: ResultadoDaTroca }
    ```
    Ordem: entrega (com as pausas) → aprovação (se houver) → toques, um por vez → `depois`. Retorno: `semeado` usa `deps.retornosSemeados[sugestao]`; sem ele, `final.saida.sugestoes[sugestao].retorno_id` (sem id, lança erro com o nome do cenário). Troca: `trocarIngrediente` com o `run_id` de `final`; se devolver `perguntar` e o toque tem `resposta`, `responderTroca` com `candidato = pergunta.alimento_id`.
- testes primeiro: um cenário de teste montado no próprio arquivo (a partir de um de `cenariosComAprovacao` ou `cenariosDeConversa`, com toques acrescentados): toque de gosto grava a preferência; toque de retorno na sugestão 0 fecha o retorno com origem `toque`; toque `semeado` fecha o retorno semeado; troca com `resposta` chama `responderTroca`; os toques rodam antes de `depois`; sem toques, `RodadaDoCenario` não tem `toques`. `montar.test.ts`: `retornosSemeados` na ordem de `Cenario.retornos`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e os cenários existentes não mudam.
- fora: os seis cenários (T16); `demo` (T17).

### T16 · Add the six learning scenarios
- nivel: mecanica
- objetivo: escrever os seis cenários da spec, num registro próprio.
- arquivos: `test/fixtures/cenarios/entrega-registrada.ts`, `test/fixtures/cenarios/troca-por-toque.ts`, `test/fixtures/cenarios/nao-tenho-com-pergunta.ts`, `test/fixtures/cenarios/dois-nao-ajudou.ts`, `test/fixtures/cenarios/retorno-pelo-agente.ts`, `test/fixtures/cenarios/gosto-escrito.ts`, `test/fixtures/cenarios/index.ts`, `test/fixtures/cenarios/cenarios.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: cenários de conversa (`mensagem`, `interpretacao` no formato de `SaidaDoInterprete`, com `gosta: []` quando não há), base real, perfil e clima do `frio-agitada` (Vata-Pitta, Rio, `agora: "2026-06-15T22:00:00.000Z"`). Registro novo `cenariosDeAprendizado: Record<string, CenarioDeConversa>` em `index.ts`, com os seis (`comMensagem`). Os roteiros chamam `finalizar` com sugestões que passam no validador (copie o padrão do roteiro do `frio-agitada`); `para_ter` só no cenário cujo preparo tem candidato.

  | Cenário | Mensagem e toques | Mostra |
  |---|---|---|
  | `entrega-registrada` | O momento do `frio-agitada`, pelo `conversar`; aprova o bloco | Três retornos aguardando, faltas gravadas, "já sugerido"; linha "Cardamomo na lista…" aprovada; item na lista com "Fez falta 3 vezes nos últimos 30 dias" |
  | `troca-por-toque` | Momento; toque Trocar na canela do chá, com cardamomo confirmado em casa | "Troquei canela por cardamomo: os dois aquecem."; retorno com os alimentos novos; nenhuma etapa `llm` |
  | `nao-tenho-com-pergunta` | Momento; toque Não tenho no gengibre, sem substituto confirmado e com um nunca registrado; resposta Não tenho | Acabou e falta do gengibre; pergunta "Você tem … em casa?"; falta do candidato; `semSubstituto` |
  | `dois-nao-ajudou` | Momento; dois toques Não ajudou no mesmo chá, em dias diferentes (dois retornos semeados); nova mensagem de momento | O chá no fim do seu tipo no segundo preparo |
  | `retorno-pelo-agente` | "aquilo de ontem me fez bem, e agora tô com frio", com dois retornos aguardando e o Intérprete sem `pendente` | Roteiro `resultado.registrar` → `finalizar`; retorno fechado com origem `conversa` |
  | `gosto-escrito` | "adoro gengibre, o que tomo agora?" | Gengibre conta como gosto na ordem; bloco com "Você gosta de gengibre"; aprova; preferência gravada |

  Detalhes:
  - `troca-por-toque`: "nenhuma etapa `llm`" vale para o toque: as etapas `llm` do run não aumentam depois do toque, e o runtime roteirizado não tem passo sobrando consumido.
  - `dois-nao-ajudou` (D12): dois retornos semeados do mesmo chá (`diasAtras: 2` e `1`), toques `{ tipo: "retorno", sugestao: 0, resultado: "nao_ajudou", semeado: true }` e `sugestao: 1`; a primeira resposta **não** sugere esse chá ("já sugerido hoje" o tiraria do segundo preparo); `depois` com uma mensagem de momento. Escolha um chá que fique entre os candidatos de chá no preparo de `depois` com ao menos outro chá.
  - `retorno-pelo-agente`: interpretação com `intencoes: ["momento", "retorno"]` e `retorno: { resultado: "ajudou" }` (sem `pendente`); dois retornos semeados (`diasAtras: 1` e `3`); roteiro com `resultado.registrar { pendente: 1 }` e depois `finalizar`.
  - `gosto-escrito`: interpretação com `gosta: ["gengibre"]`; `aprovacao: { aprovar: [<posição da linha gosta>] }`.
  - Ids e textos têm que existir na base e bater com a frase de `fraseDaTroca`; se algum não bater, pare e diga qual.
- testes primeiro (`cenarios.test.ts`, um por cenário, com `montarCenario` + `rodarCenario`): o que a coluna "Mostra" diz, conferido nos stores (`outcomes`, `shortages.lista`/`diasComFalta`, `preferences.ler`, `pantry.listar`), na saída, nas etapas e no checkpoint (`dados.candidatos` do run de `depois` para a ordem); `cenariosDeAprendizado` tem 6; `cenariosDeConversa` continua com 7.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `demo` (T17); evals (T18 a T20).

### T17 · Show returns, recorded items and touches in the demo
- nivel: mecanica
- objetivo: acrescentar ao relatório do `demo` as seções "Como ficou?", "Gravado" e "Toques", e listar os cenários novos.
- arquivos: `scripts/demo.ts`, `scripts/lib/demo-report.ts`, `scripts/lib/demo-report.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `scripts/demo.ts`: `listarCenarios` e `acharCenario` incluem `cenariosDeAprendizado`. `--interativo` não muda.
  - `DadosDoRelatorio` ganha `comoFicou?: { titulo: string }[]` (retornos aguardando da conta depois da rodada, mais recente primeiro), `gravado?: { faltas: number; sugeridos: number; lista: { nome: string; motivo: string }[] }` (`faltas` = soma de `ritu_faltas_total{origem: "teria_entrado"}` na telemetria em memória; `sugeridos` = preferências com `ultima_sugestao_em` preenchido; `lista` = `shortages.lista` com o nome da base e o motivo da D13: `fez_falta` → "Fez falta {detalhe} vezes nos últimos 30 dias"; `faltou_hoje` → "Faltou para {detalhe}") e `toques?: string[]` (uma linha por toque).
  - Seções, depois da resposta e na ordem: **Como ficou?** (um título por linha; sem retorno aguardando, a seção não aparece), **Gravado** ("N faltas", "M itens marcados como sugeridos" e, com lista, "Lista Para ter em casa:" e um item por linha com o motivo), **Toques** (só com toques). Linhas dos toques: retorno → `Retorno da sugestão {n}: {Ajudou | Não ajudou | Não fiz}` (com `semeado`, `Retorno semeado {n}: …`), n a partir de 1; gosto → `Gosto de {nome}: {gosta | não gosta | limpou}`; troca → `{Trocar | Não tenho | Não gosto} {nome} na sugestão {n}: ` seguido da frase da troca, ou da pergunta e da resposta (`Pergunta: {texto} → {Tenho | Não tenho}`) e do resultado final, ou do texto de `sem_substituto`.
- testes primeiro: `formatarRelatorio` com e sem cada seção; as linhas de cada tipo de toque; a lista com os dois motivos; sem nada novo, o relatório é igual ao de hoje.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run demo -- --cenario <nome>` para os seis cenários novos, sem rede, código 0; `npm run demo` (lista) mostra os seis.
- pronto quando: os testes passam e os seis cenários rodam com código 0.
- fora: `AGENTS.md` (fechamento).

### T18 · Add the learning deterministic evals, part 1
- nivel: mecanica
- objetivo: escrever os evals de entrega, retorno e gosto.
- arquivos: `evals/det/aprendizado/entrega.eval.ts`, `evals/det/aprendizado/retorno.eval.ts`, `evals/det/aprendizado/gosto.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: evals com o runtime roteirizado, `createMemoryStores`, `createFakeLlm`, `createFixedClock` e a **base real**, pelos cenários (`montarCenario`, `rodarCenario`, `cenariosDeAprendizado`, `cenariosComAprovacao`, `cenarios`) ou montando as deps como nos evals de `evals/det/aprovacao/`. Toques por `deps.touches`. Cada eval:
  - `entrega.eval.ts`: retornos, "já sugerido" e faltas gravados na entrega; nada em saída `segura`, de `codigo` ou run `failed`; "Tenho" durante o run tira a falta; mesma falta no mesmo dia conta uma vez; falha no meio não deixa metade.
  - `retorno.eval.ts`: toque e conversa somam igual; segundo toque não soma; dois "não ajudou" mandam para o fim e um "ajudou" traz de volta (no checkpoint do preparo seguinte: `no_fim` do candidato e a posição no tipo); retorno de outra conta é recusado (`toque_invalido`).
  - `gosto.eval.ts`: `nao_gosta` tira o alimento do run seguinte; `gosta` sobe; limpar volta ao normal; gosto escrito vale no run, não grava sem aprovação (recusada e expirada) e grava com.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T19 · Add the learning deterministic evals, part 2
- nivel: mecanica
- objetivo: escrever os evals da troca, da pergunta da troca e do "Não tenho".
- arquivos: `evals/det/aprendizado/troca.eval.ts`, `evals/det/aprendizado/troca-pergunta.eval.ts`, `evals/det/aprendizado/nao-tenho.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: mesmas ferramentas da T18. Cada eval:
  - `troca.eval.ts`: substituto confirmado, na mesma função, com filtros e combinação respeitados; item a evitar agora (`saida.evitar`) não entra; trocar de novo não repete; teto de trocas (3); retorno atualizado; nenhuma chamada de modelo (etapas `llm` e passos do runtime iguais antes e depois).
  - `troca-pergunta.eval.ts`: sem confirmado, pergunta o incerto ou o nunca registrado; acabou não é perguntado; "Tenho" registra e troca; "Não tenho" grava falta e encerra; uma pergunta por toque.
  - `nao-tenho.eval.ts`: acabou, falta `nao_tenho` e troca no mesmo toque; a falta conta para o "vale ter em casa" (com faltas em mais dois dias, o preparo seguinte tem `para_ter` desse alimento).
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T20 · Add the learning deterministic evals, part 3
- nivel: mecanica
- objetivo: escrever os evals de `resultado.registrar`, do "vale ter em casa" e da privacidade.
- arquivos: `evals/det/aprendizado/resultado-registrar.eval.ts`, `evals/det/aprendizado/para-ter.eval.ts`, `evals/det/aprendizado/privacidade.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: mesmas ferramentas da T18. Cada eval:
  - `resultado-registrar.eval.ts`: um caso por código de recusa (`sem_retorno`, `ja_registrado`, `fora_dos_pendentes`) e um aceito; o resultado gravado é o do Intérprete.
  - `para-ter.eval.ts`: `para_ter` na saída gera a linha; aprovada grava (item na lista com `fez_falta` e o número de vezes) e soma `ritu_para_ter_total{etapa: "aprovada"}`; recusada soma `recusada` e bloqueia o alimento (sem `para_ter` dele num run seguinte); expirada não bloqueia.
  - `privacidade.eval.ts`: os seis cenários de `cenariosDeAprendizado` (com os toques) não deixam nome de alimento da base, id de alimento, título de sugestão nem texto da pessoa (a mensagem inteira e cada palavra com 5 letras ou mais) em atributo de span, rótulo de métrica, campo de log ou `resumo` de etapa; o span `toque` só tem `tipo`, `motivo` e `resultado`.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T21 · Let eval:llm conversation cases measure learning and para-ter
- nivel: mecanica
- objetivo: dar ao runner do `eval:llm` os retornos fechados do caso e a família, e acrescentar ao relatório as seções Aprendizado e Para ter em casa (D14).
- arquivos: `evals/llm/casos/c2/tipos.ts`, `scripts/lib/eval-llm-casos.ts`, `scripts/lib/eval-llm-casos.test.ts`, `scripts/lib/eval-llm-report.ts`, `scripts/lib/eval-llm-report.test.ts`
- leitura: `QA.md` "Checkpoints" (só as regras da rodada) e "Registro da evolução"
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha 28 ("Eval com rodadas, relatório e comparação")
- contratos:
  - `CasoConversa` ganha `familia?: "aprendizado" | "para_ter"`.
  - A expectativa da conversa passa a receber também `retornosFechados: string[]`: os títulos (`sugestao.titulo`) dos retornos de `cenario.retornos` que não estão mais em `outcomes.pendentes(contaId)` no fim do caso.
  - `cenarioDoRunner` tira `toques` do cenário, como já tira `aprovacao`. O runner nunca toca nem aprova.
  - `ResultadoDoCaso` ganha `familia?`. Relatório, seções **Aprendizado** e **Para ter em casa** (cada uma só com casos da família; sem casos, não aparece), no formato da seção Propostas: tabela `| Caso | Acertou |` e a linha "Acerto: X/Y (Z%)"; acerto = sem erro, todos os `deve` ok e nenhum `naoPode` ok. A lógica fica em `eval-llm-casos.ts`/`eval-llm-report.ts`, testável.
- testes primeiro: com runtime roteirizado e `createFakeLlm`, um caso `conversa` com dois retornos semeados e um roteiro que chama `resultado.registrar` vê `retornosFechados` com o título certo; `cenarioDoRunner` sem `toques`; as duas seções com acerto por caso e total; sem casos das famílias, as seções não aparecem; o relatório do `c1-base` e as seções Perguntas e Propostas não mudam.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run eval:llm -- --checkpoint c2-conversa --listar` (sem rede, código 0). **Não** rode a rodada com modelo.
- pronto quando: os testes passam e `--listar` funciona sem chave.
- fora: os 8 casos (T22); rodada ⚠️.

### T22 · Add the 8 learning cases of c2
- nivel: mecanica
- objetivo: escrever os 8 casos do tipo `conversa` das famílias Aprendizado e Para ter em casa.
- arquivos: `evals/llm/casos/c2/aprendizado/01-…ts` … `05-…ts`, `evals/llm/casos/c2/aprendizado/expectativas.ts`, `evals/llm/casos/c2/para-ter/06-…ts` … `08-…ts`, `evals/llm/casos/c2/para-ter/expectativas.ts` (um arquivo por caso, nome com número e assunto), `evals/llm/casos/c2/index.ts`, `scripts/lib/eval-llm-casos.test.ts` (só a contagem)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: tipo `conversa` da T21 (cenário com `mensagem` e `interpretacao`, base real, perfil e clima como os casos da família Propostas), `familia: "aprendizado"` nos casos 1 a 5 e `familia: "para_ter"` nos 6 a 8. Expectativas reutilizáveis em `expectativas.ts` de cada pasta (por exemplo `primeiroDoTipoNao(id, tipo)`, `naoAparece(alimentoId)`, `apareceNasSugestoes(alimentoId)`, `chamouResultadoRegistrar()`, `fechouRetorno(titulo)`, `nenhumRetornoFechado()`, `apontaComoFicou()` (o texto normalizado contém "como ficou"), `naoDizQueAnotou()` (reuse o de `../propostas/expectativas` se servir), `comParaTer()`, `semParaTer()`, `semFraseDeCompra()` (sem "comprar", "loja", "mercado", "preço", "marca", "R$")); use `terminou()` de `../perguntas/expectativas`. Casos:

  | # | Caso | Esperado |
  |---|---|---|
  | 1 | Momento, com dois "não ajudou" seguidos no chá mais adequado | O chá não é a primeira sugestão do tipo |
  | 2 | Momento, com "não gosto" em um alimento adequado e em casa | O alimento não aparece |
  | 3 | Momento, com "gosto" em um alimento adequado e em casa | O alimento aparece nas sugestões |
  | 4 | "aquilo de ontem me fez bem, e agora tô com frio", dois pendentes | `resultado.registrar` chamada com o pendente certo; o texto reconhece em uma frase |
  | 5 | "melhorei, e agora tô com frio", três pendentes sem pista | Nenhum registro; o texto aponta "Como ficou?" e não diz que anotou |
  | 6 | Momento com candidato a "vale ter em casa" | `para_ter` preenchido; a frase fala das próximas vezes, sem marca, loja ou preço |
  | 7 | Momento sem candidato | Sem `para_ter` e sem frase de compra |
  | 8 | Incômodo, com faltas em 3 dias | Sem `para_ter` |

  Casos 1 a 3 usam `cenario.preferencias` (`ultimos_resultados: ["nao_ajudou", "nao_ajudou"]`, `gosto`); 4 e 5 usam `cenario.retornos` com títulos distintos e interpretação com `retorno` sem `pendente`; 6 e 8 usam `cenario.faltas` em 3 dias. Ids de alimentos, chás e o vocabulário têm que existir na base; se algum não existir, pare e diga qual.
- testes primeiro: `casosC2` tem 42 casos (20 de Intenção + 8 de Perguntas + 6 de Propostas + 5 de Aprendizado + 3 de Para ter em casa), ids únicos; os 8 novos são `tipo: "conversa"` com `mensagem` e `familia`; `--listar` do `c2-conversa` mostra 12 + 42; cada expectativa nova tem um teste com um resultado pronto que passa e outro que falha.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run eval:llm -- --checkpoint c2-conversa --listar` (sem rede, código 0, 54 casos). **Não** rode a rodada com modelo.
- pronto quando: os testes passam e a listagem mostra os 54 casos.
- fora: rodada ⚠️ do `c2-conversa` (fechamento).

### C1 · Let eval:llm run without Postgres and rerun selected cases
- nivel: nucleo
- objetivo: a rodada ⚠️ do `c2-conversa` de 2026-11-16 deu `erro (AggregateError)` nos 20 casos de intérprete (o runner passa `container.router`, cujo registro de uso é o do Postgres, e não há banco no ar) e `erro (Error)` em `c1-08-casa-so-incertos` e `c1-11-sem-cidade`; corrigir o runner e permitir repetir só os casos com erro.
- arquivos: `scripts/eval-llm.ts`, `scripts/lib/eval-llm-casos.ts`, `scripts/lib/eval-llm-casos.test.ts`, e o que o diagnóstico de c1-08/c1-11 mostrar necessário em `scripts/lib/` (diga quais)
- leitura: nenhuma
- skills: nenhuma
- contratos:
  - casos de intérprete usam um `ModelRouter` com registro de uso em memória (`createMemoryLedger(clock)` + `createModelRouter({ ledger, clock, telemetry })`), como `montarCenario` já faz para os casos de acompanhante e de conversa; o `eval:llm` não precisa de `DATABASE_URL` nem do Postgres;
  - c1-08 e c1-11: achar a causa do `Error` sem LLM (lendo o código e reproduzindo com o runtime roteirizado ou o `createFakeLlm`) e corrigir no runner; se a causa for comportamento do produto (não do runner), não corrigir: parar e relatar;
  - opção nova `--casos <id>[,<id>...]`: roda só os casos do checkpoint com esses ids, na ordem do checkpoint; id desconhecido sai com código 1 e a lista dos ids válidos; com `--casos`, o relatório vai para `evals/resultados/<checkpoint>-parcial.md` (nunca sobrescreve `<checkpoint>.md`); combina com `--listar` (lista só os filtrados).
- testes primeiro: filtro por ids (ordem do checkpoint, id desconhecido), nome do arquivo parcial, intérprete roda sem tocar no ledger do container (dublê que lança se usado), o caso que reproduz o erro de c1-08 e de c1-11.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run eval:llm -- --checkpoint c2-conversa --listar` (54) e `-- --casos c1-08-casa-so-incertos,c2-01-frio-sem-fome --listar` (2). NADA de LLM real.
- pronto quando: os testes acima passam; a explicação da causa de c1-08 e c1-11 está no relatório do implementador.
- fora: código de produção em `src/`; casos e expectativas.

## Fechamento

O que o orquestrador faz ao fechar a spec 011, depois da T22 aprovada:

1. **Verificação do repositório inteiro** pelo verificador: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det` (flake conhecido: 1 de 498 sob carga; se falhar um caso só, rodar de novo uma vez e anotar o caso), `npm run dup` (0 clones), `npm run build`; os 25 cenários de `npm run demo -- --cenario <nome>` com código 0 (5 + 7 + 4 + 3 + 6); `printf '2\n' | npm run demo -- --cenario aprovacao-parcial --interativo` com código 0; `npm run eval:llm -- --checkpoint c2-conversa --listar` com 54 casos. ⚠️ `npm run test:db` com o Postgres no ar (T2 e T3 mexem no adaptador e na suíte de `OutcomeStore`; a trava da D10 só se prova no Postgres); sem docker, anotar que não rodou, somando à pendência de `test:db` do topo de `.plans/entrega-2-estado.md`.
2. **⚠️ Rodada do checkpoint `c2-conversa`** (RULES §6; `QA.md`, Checkpoints): `npm run env:check` (só presente/ausente) para confirmar `GEMINI_API_KEY` de desenvolvimento; `npm run eval:llm -- --checkpoint c2-conversa`, uma vez, pelo orquestrador; grava `evals/resultados/c2-conversa.md` e a coluna nova em `evals/COMPARACAO.md` (e `historico.json`). Não rodar duas rodadas completas no mesmo dia; 429 persistente ou três erros seguidos: a rodada para e segue no dia seguinte com `--retomar` (anotar no relatório da entrega). Anotar no relatório: Intenção (acerto e falsos alertas), Perguntas, Propostas, Aprendizado, Para ter em casa, custo do papel `apoio`, violações da 1ª entrega e, pela nota da demo LLM da 010, se o `finalizar` passou a ser aceito com a v5 (quantos casos terminaram com origem `segura`).
3. **ADRs novas** (decisão de arquitetura nova = ADR nova; confira o próximo número em `.adrs/README.md`):
   - "Aprendizado registrado pelo Acompanhante e toques sem agente": `registrarEntrega` numa transação ao fim do trecho entregue, em `agents/companion` (D1, D4); domínio `touches` com funções do core, troca só com confirmado em casa, pergunta única, trava da linha do run e métricas depois do commit (D9, D10, D11); `responder` com `mudou` e a contagem só quando muda (D3); `resultado.registrar` só liga, o resultado vem do Intérprete (D6).
   - Atualizar `.adrs/README.md`.
4. **Docs** (só o que divergir do construído; sem "por enquanto" nem histórico), como a spec pede em "Resultado": `BUSINESS.md` §9 (troca, gostos, faltas, vale ter em casa) e §10; `AI.md` §4 (`resultado.registrar`, `acompanhante.v5`) e §6 (gosto da mensagem, entrega gravada); `ARCHITECTURE.md` §3 ("Rotas de toque": as funções do core que as rotas da 018/019 vão chamar); `OBSERVABILITY.md` §3 (span `toque` com `tipo`, `motivo`, `resultado`; etapa `erro` `registro_da_entrega`); `QA.md` (lista `evals/det/aprendizado/`; `c2-conversa` com 12 + 42 = 54 casos — 20 de intérprete e 22 de conversa: 8 de perguntas, 6 de propostas, 5 de aprendizado e 3 de para ter em casa — e as métricas Aprendizado e Para ter em casa). Isso também resolve a nota do topo de `.plans/entrega-2-estado.md` sobre a contagem de casos do `QA.md`. `ROADMAP.md` §0 atualizado.
5. **`AGENTS.md`**, tabela de comandos: `npm run demo` acrescenta que os cenários de aprendizado imprimem "Como ficou?", "Gravado" e "Toques"; `eval:llm` cita as famílias novas do `c2-conversa`.
6. **Spec:** `status: implemented` com o hash do último commit; marcar os critérios de aceite; atualizar `.specs/README.md` se ele listar o status.
7. **Estado:** anotar para o relatório da entrega a D9 ("Não tenho" de alimento nunca registrado pode ser perguntado de novo num toque seguinte) e a D10 (concorrência dos toques só conferida no Postgres).
