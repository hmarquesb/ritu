# Plano · Spec 010 · Aprovação

Spec: `.specs/010-aprovacao.md`. Nível (seção "Nível das partes" da spec): `nucleo` para `aprovar`, o fim do run com propostas em `conversar` e `continuar`, o executor, a mudança no loop (005) e em `finalizar` (e, por serem do serviço de runs e do fim do run, `manterAberto` e `pausarSemAgente` com aprovação, D5 e D6); `mecanica` para `config/aprovacao.ts`, schemas, textos, tools de proposta e seus validadores, `propostasDoAgente`, `montarPropostas`, `ItemTemporario` e `montarFiltro`, os dados do run no preparo, `acompanhante.v4`, cenários, `demo`, evals, runner e casos do `c2`. Não há parte `conteudo`: o prompt e os textos são copiados da spec, como estão neste plano.

Pré-condição: a spec 009 inteira commitada (T1 a T18 e L1 do `.plans/009-pausas-plan.md`, fechamento em `d8512d9`), com os nomes que aquele plano e as notas de construção dele definem: `RunRepository.mudarStatusSe`, `pausarSemAgente`, `continuarRun(..., { reservado })`, `conversation.continuar` em `src/core/conversation/continuar.ts`, `ConteudoDaPendencia.anotacoes`, o fim do run em `src/core/agents/companion/fim-do-run.ts`, `cenariosComPausa`, `rodarCenario`, o runner do `eval:llm` com casos `conversa` que respondem pausas.

Ficam com o orquestrador, no fechamento: docs, `AGENTS.md`, `ROADMAP.md` §0, as ADRs, a marcação da spec e a inclusão destas tarefas em `.plans/entrega-2-estado.md` (status `pendente`). A rodada ⚠️ do `demo` com LLM é do orquestrador (RULES §6). A rodada ⚠️ do `eval:llm -- --checkpoint c2-conversa` **não** acontece nesta spec: é no fechamento da 011.

## Regras comuns a todas as tarefas

- **Contratos:** estão copiados em cada tarefa. Nomes de tipos, campos, funções, textos e erros ficam **exatamente** como escritos, em português; o resto do código fica em inglês. O prompt e os textos fixos são copiados sem mudar uma vírgula. Quem recebe a tarefa não precisa abrir a spec.
- **Onde está o que já existe** (confira a assinatura real antes de usar; não redefina):
  - Runs: `Run`, `RunMutavel`, `StatusRun` (tem `waiting_for_approval`), `RunEtapa`, `NovaEtapa`, `TipoDeEtapa` (tem `proposta`, `aprovacao` e `erro`), `RunRepository` (`buscar`, `atualizar`, `mudarStatusSe(contaId, runId, de, para): Promise<boolean>`, `acrescentarEtapa`, `etapas`, `expirarEmEsperaAntesDe`): `@/core/runs/ports`. `Pendencia` (`tipo: "pergunta" | "aprovacao"`), `ResultadoDeControle`, `ToolDeControle`, `DefinicaoDoAgente`: `@/core/runs/agente`. `Checkpoint`, `pendenciaSchema`, `lerCheckpoint`: `@/core/runs/checkpoint`. `MensagemDoLoop` (`{ papel: "tool"; chamada_id; nome; resultado }` entre outras): `@/core/runs/agent-runtime`. `createRunService` (`iniciarRun` — já leva o run em `waiting_for_approval` da conta a `done` e chama `proposals.expirarDosRuns` —, `executarRun`, `continuarRun`, `pausarSemAgente(contaId, runId, pendencia)` — hoje só `running → waiting_for_input`, com `checkpoint: null`, evento `pausa` e `ritu_pausas_total` —, `gravarEtapa`, `encerrar`, `comSpanDoRun`), `ResultadoDoRun`: `@/core/runs/run-service`. `processarChamadas` (executa as chamadas de um passo em sequência e põe o resultado de cada uma em `estado.mensagens` antes da seguinte): `@/core/runs/loop-passo`. `podeIr` (`running → waiting_for_approval`; `waiting_for_approval → done | expired`): `@/core/runs/estados`. `RunAbertoError`, `RunNaoContinuavelError`: `@/core/runs/errors`. `Pergunta`, `RespostaDaPessoa`: `@/core/runs/pergunta`. `gravarResposta(deps, contaId, runId, dia, pergunta, resposta)`: `@/core/runs/gravar-resposta`.
  - Acompanhante: `EntradaDoAcompanhante` (`nao_come_da_mensagem?: { alimento_id?: string; nome: string }[]`, `restricoes_da_mensagem?: Restricao[]`, `fato_de_rotina?: string`): `@/core/agents/companion/entrada`. `createCompanion` (`responder(contaId, entrada, opts?: { aoVivo?, run?, semModelo?, perguntasFeitas? })`, `continuar(contaId, run, { pergunta, resposta }, opts?)`; `montarCtx` interno), `RespostaDoRun`: `@/core/agents/companion/responder`. `criarFimDoRun({ stores, kb, runs, telemetry }).tratar(contaId, resultado, dados, perfil, extra)` (encerra `done`/`failed` com `runs.encerrar`; `campos(dados, extra)`): `@/core/agents/companion/fim-do-run`. `preparar`, `DadosDoPreparo`, `dadosDoPreparoSchema` (já tem `perguntas`, `nao_come_do_run`, `candidatos_completos` (só ids), `acabou`, `para_ter?`, `fato_de_rotina?`, `com_incomodo`; `paraTerDoRun` lê `shortages.lista` e `proposals.recusadas(contaId, "lista.propor")`), `entregaveis`: `@/core/agents/companion/preparo`. `Candidato`, `TipoDeSugestao`, `ItemDoCandidato`: `@/core/ranking/tipos`. `montarMensagemInicial` (monta o contexto do modelo campo a campo): `@/core/agents/companion/contexto`. `Anotacao` (`casa_tem`, `casa_acabou`, `evitar_sempre`, `nao_come`, `gosta`, `restricao`), `anotacaoSchema`, `SaidaDoAcompanhante`, `saidaDoAcompanhanteSchema`, `completarSaida`, `saidaDeCodigo`, `saidaSegura`, `saidaSemModelo`: `@/core/agents/companion/saida`. `montarAnotacoes`, `acrescentarNaoCome`: `@/core/agents/companion/anotacoes`. `montarFiltro({ perfil, evitarDoDia, evitarDaMensagem, preferencias })`: `@/core/agents/companion/filtro-da-pessoa`. `ConteudoDaPendencia`, `conteudoDaPendenciaSchema`, `aplicarResposta`, `candidatosRetirados`: `@/core/agents/companion/pergunta-do-run`. `criarAcompanhante`: `@/core/agents/companion/agente`. `finalizar`: `@/core/agents/tools/finalizar`. `askUser`: `@/core/agents/tools/ask-user`. `climaTools`, `memoriaTools`, `ayurvedaTools`: `@/core/agents/tools/{clima,memoria,ayurveda}`. `acompanhanteV3`: `@/core/agents/prompts/acompanhante.v3`.
  - Conversa: `createConversation(deps)` (`conversar`, `continuar`), `RespostaDaConversa`, `Deps`: `@/core/conversation/conversar`. `criarContinuar(deps)`: `@/core/conversation/continuar`. `anotarPendencia`, `perguntaDaVariantePendente`, `ETAPA_DA_VARIANTE`: `@/core/conversation/pausa-de-codigo`. `itensDoDia`, `gravarItensDoDia`, `anotacoesDaMensagem`, `resolverCaminhoDeCodigo`, `ContextoDoCaminho`: `@/core/conversation/caminhos-de-codigo`. `textosDaConversa`, `textoDeCasa`, `textoDeEvitar` (com `nomeDoCitado` e `nomeDoEvitar` privados): `@/core/conversation/textos`.
  - Perfil: `ItemDoDia` (`EvitarItem | { tipo: "restricao"; valor: Restricao } | { tipo: "nao_come"; valor: string }`), `ProfileStore` (`ler`, `definirRestricoes`, `definirNaoCome(contaId, { tipo: "alimento" | "texto"; valor }[])`, `acrescentarEvitarSempre` (sem duplicar), `evitarTemporario`, `acrescentarEvitarTemporario`): `@/core/accounts/ports`. `Perfil` (`evitar_sempre`, `restricoes`, `nao_come: { tipo: "alimento" | "texto"; valor }[]`): `@/core/accounts/types`. `citadoNoPerfilDoNaoCome`, `itemNoPerfilDoEvitar`: `@/core/accounts/no-perfil`.
  - Propostas e memória: `ProposalStore` (`criar(contaId, runId, { tool, conteudo }[])`, `doRun`, `decidir(contaId, id, "aprovada" | "recusada")` — só muda se pendente —, `recusadas(contaId, tool)`, `expirarDosRuns(runIds)`), `Proposta` (`id`, `run_id`, `tool`, `conteudo`, `decisao: "pendente" | "aprovada" | "recusada" | "expirada"`): `@/core/proposals/ports`. `PantryStore` (`listar`, `registrar(contaId, { alimento_id?, nome_livre? }[], "conversa" | "tela" | "pergunta")` — apaga as faltas e tira da lista —, `marcarAcabou(contaId, itens)`): `@/core/pantry/ports`. `PreferenceStore.definirGosto(contaId, { tipo: "alimento", id }, "gosta" | "nao_gosta")`, `Preferencia`: `@/core/preferences/ports`. `RoutineStore` (`anotar(contaId, texto)`, `notasAtivas(contaId)` → `{ texto }[]`): `@/core/routine/ports`. `ShortageStore` (`lista(contaId)` → `{ alimento_id; motivo; detalhe }[]`, `porNaLista(contaId, { alimento_id, motivo: "faltou_hoje" | "fez_falta", detalhe })`): `@/core/shortages/ports`. `Stores`, `Transactor` (`emTransacao(fn)`): `@/core/stores`. `MessageRepository.gravar`: `@/core/messages/ports`.
  - Base: `KnowledgeBase` (`alimento(id)`, `preparo(id)`, `pratica(id)`, `gruposEvitar` (`{ id, nome, palavras }`), `incomodos` (`{ id, nome, palavras, … }`)): `@/core/knowledge/knowledge-base`. `passaNoFiltro(alvo, filtro, kb).passa`, `EvitarItem`, `FiltroPessoa`: `@/core/knowledge/filtros`. `Restricao`, `RESTRICOES`, `restricaoSchema`: `@/core/knowledge/vocab`. `rotulosDeRestricao`: `@/core/knowledge/rotulos`. `normalizar(texto)`: `@/core/knowledge/identificar`. `juntarNomes(nomes)` (minúsculas; "a", "a e b", "a, b e c"): `@/core/knowledge/lacunas`. `neutralizar`: `@/core/neutralizar`.
  - Tools: `ToolContext` (`kb`, `filtro`, `sinais`, `contaId`, `stores: Pick<Stores, "pantry" | "preferences" | "runs" | "outcomes">`, `clock`, `telemetry`, `casaDaMensagem?`), `Tool`, `definirTool({ name, description, input, output, resumir?, executar })`: `@/core/tools/tool`.
  - Configuração: `config` (`config.memoria.esperaMinutos` = 30, `config.pausas`): `@config/index`.
  - Telemetria: `Telemetry` (`span`, `contador`, `evento`, `log`): `@/core/telemetry/ports`. Nomes fechados em `@/core/telemetry/nomes` (já tem o span `aprovacao.execucao`, os atributos `propostas.total` e `propostas.aprovadas`, as métricas `ritu_propostas_total`, `ritu_gosto_total`, `ritu_para_ter_total`, `ritu_pausas_total`, o evento `pausa` e os rótulos `tool`, `decisao`, `gosto`, `etapa`, `tipo`, `pausa.tipo`). `createMemoryTelemetry` (`spans`, `metricas`, `eventos`, `logs`; falha com atributo fora da lista): `@/infra/fakes/memory-telemetry`.
  - Testes: `createFixedClock` (`now`, `advance`, `set`): `@/infra/fakes/fixed-clock`. `createScriptedRuntime(roteiro)` (`PassoRoteirizado = { chamadas?: { nome; argumentos }[]; texto?; tokens?; erro? }`; cada passo consome o próximo item): `@/infra/fakes/scripted-runtime`. `createMemoryStores` (o `emTransacao` restaura uma cópia do estado se o corpo lançar): `@/infra/fakes/memory-stores`. `createFakeLlm(respostas)` (fila; cada pedido consome a próxima): `@/infra/fakes/fake-llm`. Mini-base: `@/infra/fakes/mini-knowledge`. Base real: `getContainer().knowledge` ou `readKnowledgeData` de `@/infra/container`, como nos evals de `evals/det/base/`. Cenários: `cenarios` (5, com `entrada`), `cenariosDeConversa` (7; `montar.test.ts` trava em sete), `cenariosComPausa` (4), `montarCenario`, `rodarCenario`, `DepsDoCenario` (tem `conversation`): `test/fixtures/cenarios`. Suítes de contrato: `test/contracts/*.contract.ts` (`ContractEnv = { stores, tx, clock }`, `criarDuasContas`), rodam no fake em `npm test` e no Postgres em `test:db`.
  - `demo`: `scripts/demo.ts` (`rodarCenario`, `--interativo` com `node:readline`), `scripts/lib/demo-report.ts` (`formatarRelatorio(DadosDoRelatorio)`, seção "Posso anotar" das anotações), `scripts/lib/demo-resposta.ts` (`formatarPergunta`, `respostaDoTexto`). `eval:llm`: `scripts/lib/eval-llm-casos.ts` (`rodarConversa`, `contarEtapas`, `resolverResposta`, `ContagemDasEtapas`), `scripts/lib/eval-llm-report.ts` (`ResultadoDoCaso`, `resumirPerguntas`, `formatarRelatorio`), `evals/llm/casos/c2/tipos.ts` (`CasoConversa`, `ExpectativaDaConversa`), `evals/llm/casos/c2/index.ts` (`casosC2`, 28 casos), `evals/llm/casos/c2/perguntas/expectativas.ts` (`terminou()` confere `status === "done"`), `evals/llm/casos/c1/tipos.ts` (`ResultadoDoRun = { saida, status, tools: string[], chamadasDeModelo, validacoes }`).
  - `RituError(code, message)`: `@/core/errors`. `Clock`: `@/core/clock`.
- **Camadas:** `src/core/` só importa `src/core/`, `@config/*` e `zod`. Scripts e evals só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (R6). No core, sem `new Date()` sem argumento nem `Date.now()` (R8). **Sem ciclo entre domínios do core (R9):** `agents` e `conversation` importam `runs` e `proposals`; por isso nada em `src/core/runs/` importa `agents` nem `conversation`, e nada em `src/core/proposals/` importa `agents`, `conversation` nem `tools` (D1). `proposals` pode importar `knowledge` e `runs` (só tipos de `agent-runtime`). Arquivos soltos em `src/core/` (`stores.ts`, `neutralizar.ts`, `errors.ts`) não contam como domínio.
- **Privacidade:** nenhum texto da pessoa, texto de nota, texto de linha do bloco, nome ou id de alimento vai para span, métrica, log ou `resumo` de etapa. O `resumo` das etapas `proposta` é só `casa: N itens`, `evitar_sempre: N itens`, `restricao: N itens`, `nao_come: N itens`, `gosta: N itens` (com 1, `1 item`), `rotina` ou `lista`; o da etapa `aprovacao`, `N de M`; o das tools de proposta, `proposto` ou `recusado: <código>`. O que fica em `propostas.conteudo`, `runs.saida` e `runs.checkpoint` é banco, não telemetria: é permitido.
- **Testes:** os padrão rodam sem rede, banco nem chave. Nenhum teste nem eval chama a Gemini.
- **Qualidade:** complexidade cognitiva ≤ 15 por função, `npm run dup` com 0 clones e Biome. Rode `./node_modules/.bin/biome check --write <arquivos>`. O `npm run lint` pelo wrapper rtk dá falso erro ("JSON parse failed"): rode sempre `rtk bypass npm run lint`.
- **Montadores de texto:** troque `{itens}`, `{Item}` e `{detalhe}` com função de troca (`texto.replace("{itens}", () => valor)`), nunca com string de troca.
- **Ambiente:** rtk em `/opt/homebrew/bin`; node em `/Users/helena.batista/.nvm/versions/node/v24.22.2/bin`; sem docker (não há `test:db`: anote que não rodou).
- **Limites:**
  - Não leia `.env.local` (nem com `cat`, `grep` ou `source`) e não abra pastas fora do repositório.
  - Arquivos temporários só no scratchpad, nunca em `/tmp` nem em `$TMPDIR`.
  - Arquivo fora da lista da tarefa: pare e diga qual. Exceção explícita só onde a tarefa disser.
  - Não toque em `.specs/`, `.docs/`, `AGENTS.md` nem `design/`.
  - Não commite.

## Decisões do planejamento

Lacunas e contradições encontradas na spec, com a opção mais conservadora. Cada uma diz como desfazer.

- **D1 · `Anotacao` mora em `proposals`.** Contradição: a spec põe `montarPropostas({ anotacoes: Anotacao[] })` em `src/core/proposals/montar.ts`, mas `Anotacao` mora em `agents/companion/saida.ts`, e `agents` passa a importar `proposals` (tools de proposta, saída, `finalizar`): seria ciclo (R9). Decidido: `Anotacao` e `anotacaoSchema` passam para `src/core/proposals/anotacao.ts`; `saida.ts` os reexporta com os mesmos nomes (`export { type Anotacao, anotacaoSchema } from "@/core/proposals/anotacao"`), e nenhum consumidor muda o import. Desfazer: voltar o tipo e mover `montar.ts` para `agents/companion/`.
- **D2 · Nomes dos itens num lugar só.** Faltava: `textoDaProposta` precisa dos nomes de "evitar sempre" (grupo, alimento, texto) e de itens citados, que hoje são funções privadas de `conversation/textos.ts`; `proposals` não pode importar `conversation` (R9) e copiar daria clone no `npm run dup`. Decidido: `nomeDoCitado(citado, kb)` e `nomeDoEvitar(item, kb)` passam para `src/core/knowledge/nomes.ts`, exportadas, com o mesmo corpo; `conversation/textos.ts` as importa. Desfazer: duplicar.
- **D3 · `ItemTemporario` substitui `ItemDoDia`.** Faltava: a 008 (D1 dela) já fez o temporário guardar restrição e "não como" com o nome `ItemDoDia`; a spec chama de `ItemTemporario` e acrescenta `nao_come_texto`. Decidido: renomear `ItemDoDia` para `ItemTemporario` em todos os usos (sem alias) e acrescentar `{ tipo: "nao_come_texto"; valor: string }`. "Não como" com nome que a base não conhece passa a ir para o temporário como `nao_come_texto` e, em `montarFiltro`, para `evitar_textos`. Desfazer: alias `ItemDoDia = ItemTemporario`.
- **D4 · De onde vem `ctx.run`.** Faltava: a spec diz que o `responder` monta `ctx.run` a partir de `Checkpoint.dados`, mas `dados` não tem `nao_tem`, a lista completa com nome e alimentos (D10 da 009 guardou só os ids), `na_lista`, `lista_recusada` nem `notas_ativas`. Decidido: `DadosDoPreparo` ganha, todos com `.default([])` (checkpoints antigos continuam válidos), `nao_tem_do_run: string[]`, `candidatos_do_preparo: { tipo: TipoDeSugestao; id: string; nome: string; alimentos: string[] }[]` (da lista completa, `alimentos` = ids de `itens` e de todas as `opcoes`, sem repetir), `na_lista: string[]`, `lista_recusada: string[]` e `notas_ativas: string[]` (textos). `preparar` os preenche; nenhum vai ao contexto do modelo. `ToolContext` ganha `run?: ContextoDoRun` (opcional: os testes que montam `ToolContext` à mão não quebram); sem `run`, as tools de proposta usam o run vazio (`com_incomodo: false`, listas vazias, `tem_para_ter: false`). Uma função pura `contextoDoRun(dados)` monta o campo. Desfazer: ler as listas dos stores em `montarCtx`.
- **D5 · Quem fecha o run da conversa.** Contradição: hoje o Acompanhante encerra o run em `done` dentro de `fim-do-run` e `semModelo`, e `done` não vai para `waiting_for_approval`; a spec manda a conversa decidir `done` ou `waiting_for_approval` depois de a saída existir. Decidido: `responder` e `continuar` do Acompanhante ganham a opção `manterAberto?: true`; com ela, o desfecho que iria a `done` grava os campos com `stores.runs.atualizar` e deixa o run em `running`, devolvendo `status: "running"`. `failed` continua `failed`. `conversar` e `conversation.continuar` sempre passam `manterAberto: true` e fecham o run no fim (D8). Quem chama o Acompanhante sem a conversa (cenários da 007, evals do Acompanhante, `demo` com `entrada`) não muda. Desfazer: passar as anotações ao Acompanhante e fechar lá.
- **D6 · Pausa de aprovação pelo serviço de runs.** Decidido: `pausarSemAgente(contaId, runId, pendencia, campos?)` passa a levar o run a `waiting_for_input` quando `pendencia.tipo` é `pergunta` (como hoje, com `checkpoint: null`) e a `waiting_for_approval` quando é `aprovacao` (sem mexer no checkpoint), gravando também `campos`. O evento `pausa` e `ritu_pausas_total{tipo}` saem nos dois. Desfazer: uma função `pausarParaAprovacao` separada.
- **D7 · Nada a propor com incômodo.** Lacuna: a spec diz "não propor nada … nem com incômodo", mas as anotações de código não olham o incômodo. Decidido (mais conservador): run com `com_incomodo` (ou incômodo na interpretação) não cria nenhuma proposta, nem as de código; termina em `done`. Desfazer: deixar passar as de código.
- **D8 · Ordem do fim e falha ao criar as propostas.** A spec pede que, se a criação das propostas falhar, a resposta já tenha sido gravada como mensagem. Decidido: em `conversar` e `continuar`, a mensagem do agente é gravada **antes** de `fecharComPropostas`; se ele lançar, o run vai a `failed` (se ainda em `running`), a `saida` gravada no run e devolvida é a mesma, com `propostas: []`, e nada mais muda. Desfazer: gravar a mensagem depois.
- **D9 · `propostas` e `propostas_do_agente` na saída.** Decidido: `SaidaDoAcompanhante.propostas: PropostaNaSaida[]` é obrigatório (todas as saídas montadas por código põem `[]`; o schema usa `.default([])`); `propostas_do_agente?: ConteudoDaProposta[]` é opcional e interno: `fecharComPropostas` o tira da saída final gravada e devolvida. Desfazer: tornar `propostas` opcional.
- **D10 · Concorrência na aprovação.** Faltava: o `emTransacao` em memória restaura uma cópia do estado se o corpo lança; numa segunda aprovação simultânea, lançar dentro da transação poderia apagar o que a primeira gravou entre a cópia e o erro. Decidido: dentro da transação, `mudarStatusSe` devolvendo `false` faz o corpo **retornar** um marcador (sem lançar); `RunNaoContinuavelError` é lançado depois que a transação termina. As etapas `proposta_invalida` e `aprovacao` são gravadas dentro da transação, com `s.runs.acrescentarEtapa`. As métricas (`ritu_propostas_total`, `ritu_para_ter_total`, `ritu_gosto_total`) somam só depois do commit. O teste com Postgres é um caso novo na suíte de contrato do `Transactor` (duas transações simultâneas com `mudarStatusSe` como primeira operação: só uma grava). Desfazer: lançar dentro da transação.
- **D11 · Expiração na aprovação.** Decidido: passado o prazo, numa transação, `mudarStatusSe(waiting_for_approval → expired)` e `proposals.expirarDosRuns([runId])`; se `mudarStatusSe` devolver `false`, `RunNaoContinuavelError`; senão `RituError("aprovacao_expirada", "A aprovação expirou")`. Proposta expirada não soma em `ritu_propostas_total` (não é decisão). Prazo como na 009: `clock.now() − pendencia.criada_em > esperaMinutos × 60 000` expira; 30 min exatos ainda valem. Desfazer: somar com `decisao: "expirada"`.
- **D12 · Executor e a base.** Decidido: proposta com `alimento_id` fora da base, "evitar sempre" de `alimento` fora da base ou de `grupo` que não existe em `kb.gruposEvitar` não é executada (o executor devolve `false`, a linha fica `recusada` com etapa `proposta_invalida`); casa e "não como" com só `nome` (sem `alimento_id`) são válidos (`nome_livre` e `texto`). `ritu_gosto_total{gosto: "gosta"}` é somado por `aprovar`, um por item de proposta `gosta` gravada, depois do commit (o executor não recebe `Telemetry`). Desfazer: ignorar só o item fora da base.
- **D13 · Etapa `proposta`.** Decidido: `nome` = a tool da linha (`casa.propor`, `memoria.propor`, `lista.propor`), `status: "ok"`, `resumo` pela chave do tipo: `casa` (tem e acabou), `evitar_sempre`, `restricao`, `nao_come`, `gosta` com `: N itens` (`: 1 item`), e `rotina` e `lista` sozinhos. Etapa `aprovacao`: `nome: "aprovacao"`, `status: "ok"`, `resumo: "N de M"`. Etapa de executor recusado: `{ tipo: "erro", nome: "proposta_invalida", status: "falhou" }`. Desfazer: nome fixo `proposta`.
- **D14 · Palavra de incômodo no fato.** Decidido: `fato_com_incomodo` quando `normalizar(fato)` **contém** (substring) `normalizar(palavra)` de alguma `palavras` de `kb.incomodos`. Recusa a mais (por exemplo "dor" dentro de outra palavra) só deixa de propor uma nota: é o lado seguro. Desfazer: comparar por palavra inteira.
- **D15 · "Zero escrita" com perguntas no caminho.** Contradição: o cenário `faltou-hoje` grava em Minha casa a resposta "Não tenho" (009), antes do bloco. Decidido: a comparação de "zero escrita" é entre o estado no momento em que o bloco abre (run em `waiting_for_approval`) e o estado depois de não aprovar ("Agora não", expiração, mensagem nova); nos cenários sem pergunta, também contra o estado antes da mensagem. Tabelas comparadas pelas portas: `profiles.ler`, `pantry.listar`, `routine.notasAtivas`, `shortages.lista`. Desfazer: comparar só cenários sem pergunta.
- **D16 · Segunda mensagem do cenário `vegetariana`.** Faltava: o `Cenario` só tem uma mensagem. Decidido: `Cenario.depois?: { mensagem: MensagemRecebida; interpretacao: SaidaDoInterprete; roteiro: PassoRoteirizado[] }`; `montarCenario` põe a segunda interpretação na fila do `createFakeLlm` e o segundo roteiro depois do primeiro no runtime roteirizado; `rodarCenario`, depois da aprovação, manda a segunda mensagem e roda até o fim. Os três cenários novos ficam num registro próprio `cenariosComAprovacao` (para não mexer na trava de sete de `cenariosDeConversa`); `casa-sozinha` continua em `cenariosDeConversa` e ganha `aprovacao`. Desfazer: só no eval.
- **D17 · `{Item}` e `{detalhe}`.** Decidido: `{Item}` = nome da base com a primeira letra maiúscula; `{detalhe}` do "faltou hoje" guarda o nome do candidato como está na base e o texto põe a primeira letra minúscula; o do "fez falta" é o número de vezes, em texto. Desfazer: guardar o detalhe já minúsculo.
- **D18 · Caso `c2` termina no bloco.** Decidido: o runner do `eval:llm` nunca aprova; `terminou()` passa a aceitar `done` ou `waiting_for_approval`. Desfazer: aprovar tudo no runner.
- **D19 · `aprovar` na conversa.** Decidido: `aprovar` mora em `src/core/conversation/aprovar.ts` (`criarAprovar(deps)`, com as `Deps` da conversa) e `createConversation` o expõe como `aprovar`. Desfazer: domínio próprio.

## Notas de construção (o que mudou depois do plano; vale para todas as tarefas)

- T5: `ItemDoDia` virou `ItemTemporario` (com `nao_come_texto`); `itemDoNaoCome` exportado de `src/core/agents/companion/filtro-da-pessoa.ts`.
- T6: `ContextoDoRun`, `ToolContext.run?` e `contextoDoRun` (`src/core/agents/companion/contexto-do-run.ts`).
- T7: tools `memoria.propor` e `lista.propor` em `src/core/agents/tools/propostas.ts`.
- T11: com `manterAberto`, o run fica em `running` com os campos gravados; quem o fecha é a conversa (T13): garantir que nenhum caminho de `conversar`/`continuar` deixe o run preso em `running`.
- T13: `fecharComPropostas` e `fecharOuFalhar` (regra de falha da D8) em `src/core/conversation/fim-com-propostas.ts`; os cenários `casa-sozinha`, `evitar-sozinho` e `duas-intencoes` agora terminam em `waiting_for_approval`.
- T14: `criarAprovar` (em `src/core/conversation/aprovar.ts`) recebe `Pick<Deps, "stores" | "tx" | "kb" | "clock" | "telemetry" | "runs">`; `createConversation(...).aprovar(contaId, runId, aprovadas)`.
- T15: `rodarCenario` devolve `final` como antes da aprovação e o resultado da aprovação em `bloco.resultado`; com `decidir` e `aprovacao`, vale `decidir`; `faltou-hoje` usa `cha-gengibre`.
- T16: `DadosDoRelatorio` ganhou `decisao`, `minhaCasa` e `depois`; a seção "Posso anotar" das anotações saiu do relatório (o bloco a substitui).
- T20: `cenarioDoRunner` tira `aprovacao` do cenário (D18); `rodarConversa` devolve `statusDoRun` (lido do store) e o `ResultadoDoCaso` tem `proposta`, `propostas`, `propostasRecusadas` e `statusDoRun`.

## Tarefas

### T1 · Add the approval config
- nivel: mecanica
- objetivo: criar `config/aprovacao.ts` e expô-lo em `config`.
- arquivos: `config/aprovacao.ts`, `config/index.ts`, `config/index.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // config/aprovacao.ts
  export const aprovacao = { maxLinhas: 6, maxFaltouHoje: 1 } as const
  ```
  `config/index.ts` importa e põe `aprovacao` no objeto `config` (depois de `pausas`). O prazo continua em `config.memoria.esperaMinutos` (30); não duplicar.
- testes primeiro: `config.aprovacao` tem os dois valores; `config.memoria.esperaMinutos` é 30.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: qualquer uso do valor.

### T2 · Add the proposal content types and move the notes type to proposals
- nivel: mecanica
- objetivo: criar os tipos e schemas estritos do conteúdo das propostas e mudar `Anotacao` para o domínio `proposals`, sem mudar o que os consumidores importam.
- arquivos: `src/core/proposals/conteudo.ts`, `src/core/proposals/conteudo.test.ts`, `src/core/proposals/anotacao.ts`, `src/core/agents/companion/saida.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/core/proposals/conteudo.ts (importa só knowledge e zod)
  export type TipoDeProposta = "casa.propor" | "memoria.propor" | "lista.propor"
  export type ConteudoDaProposta =
    | { tool: "casa.propor"; acao: "tem" | "acabou"; itens: { alimento_id?: string; nome: string }[] }
    | { tool: "memoria.propor"; tipo: "evitar_sempre"; itens: EvitarItem[] }
    | { tool: "memoria.propor"; tipo: "restricao"; itens: Restricao[] }
    | { tool: "memoria.propor"; tipo: "nao_come"; itens: { alimento_id?: string; nome: string }[] }
    | { tool: "memoria.propor"; tipo: "gosta"; itens: { alimento_id: string; nome: string }[] }
    | { tool: "memoria.propor"; tipo: "rotina"; texto: string }                       // até 200
    | { tool: "lista.propor"; alimento_id: string; motivo: "faltou_hoje" | "fez_falta"; detalhe: string }
  export type PropostaNaSaida = { id: string; tool: TipoDeProposta; texto: string }
  export const conteudoDaPropostaSchema: z.ZodType<ConteudoDaProposta>
  export const propostaNaSaidaSchema
  /** O que vai para `propostas.conteudo`: o objeto sem o campo `tool`, que vai na coluna. */
  export function semTool(c: ConteudoDaProposta): { tool: TipoDeProposta; conteudo: Record<string, unknown> }
  /** Junta coluna e conteúdo e valida; undefined se não passar no schema. */
  export function lerConteudo(tool: string, conteudo: unknown): ConteudoDaProposta | undefined
  ```
  - Schema zod **estrito** para cada variante (`z.strictObject`: campo a mais é recusado); `itens` com ao menos 1 elemento; `texto` da rotina com 1 a 200 caracteres; `alimento_id`, `nome`, `detalhe` não vazios; `itens` de restrição com `restricaoSchema`; `EvitarItem` com `tipo: "grupo" | "alimento" | "texto"` e `valor` não vazio. As variantes de `memoria.propor` se distinguem por `tipo`; use uma união (por exemplo `z.union` das variantes, ou discriminação em dois níveis) que recuse `tool` desconhecida. Não há variante nem campo de remoção.
  - `src/core/proposals/anotacao.ts` (D1): recebe o tipo `Anotacao` e o `anotacaoSchema` **como estão hoje** em `saida.ts` (corpo copiado sem mudança). `saida.ts` remove as definições e acrescenta `export { type Anotacao, anotacaoSchema } from "@/core/proposals/anotacao"`, usando-os também internamente.
- testes primeiro: cada variante válida passa; campo a mais em cada variante é recusado; `tool` desconhecida, `itens` vazio, rotina com 201 caracteres, `motivo` fora da lista e restrição fora do vocabulário são recusados; um objeto com `acao: "remover"` é recusado; `semTool` tira `tool` e `lerConteudo(tool, conteudo)` refaz o objeto e valida (ida e volta igual); `lerConteudo` com conteúdo inválido devolve `undefined`. Os testes existentes de `saida.ts` e `anotacoes.ts` continuam passando sem mudar import.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e o teste de arquitetura continua verde (sem ciclo).
- fora: textos (T3), montagem (T4), saída com `propostas` (T8).

### T3 · Add the proposal line texts
- nivel: mecanica
- objetivo: mover os nomes de itens para `knowledge` e criar os textos das linhas do bloco e `textoDaProposta`.
- arquivos: `src/core/knowledge/nomes.ts`, `src/core/knowledge/nomes.test.ts`, `src/core/conversation/textos.ts`, `src/core/proposals/textos.ts`, `src/core/proposals/textos.test.ts`
- leitura: `BUSINESS.md` §8 "Fluxo de uma mensagem", item 7
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `src/core/knowledge/nomes.ts` (D2): `export function nomeDoCitado(citado: { alimento_id?: string; nome: string }, kb: KnowledgeBase): string` e `export function nomeDoEvitar(item: EvitarItem, kb: KnowledgeBase): string`, com o corpo de hoje de `conversation/textos.ts` (nome da base; grupo pelo `nome` de `kb.gruposEvitar`; texto livre com `neutralizar`). `conversation/textos.ts` apaga as cópias privadas e importa daqui; nada mais muda lá.
  - `src/core/proposals/textos.ts`:

  | Chave | Texto |
  |---|---|
  | `casaTem` | `Você tem {itens} em casa` |
  | `casaAcabou` | `Acabou: {itens}` |
  | `evitarSempre` | `Não sugerir mais {itens} (Evitar sempre)` |
  | `restricao` | `Sua alimentação é {itens}` |
  | `naoCome` | `Você não come {itens}` |
  | `gosta` | `Você gosta de {itens}` |
  | `listaFaltouHoje` | `{Item} na lista "Para ter em casa" (faltou para {detalhe})` |
  | `listaFezFalta` | `{Item} na lista "Para ter em casa" (já fez falta {detalhe} vezes)` |
  | `cabecalho` | `Posso anotar isto?` |
  | `agoraNao` | `Agora não` |
  | `anotar` | `Anotar` |

  Exporte como `export const textosDasPropostas = { … } as const`.
  ```ts
  export function textoDaProposta(c: ConteudoDaProposta, kb: KnowledgeBase): string
  ```
  - `{itens}` = `juntarNomes(nomes)` (minúsculas; "a", "a e b", "a, b e c"). Nomes: casa, "não como" e gosta com `nomeDoCitado`; "evitar sempre" com `nomeDoEvitar`; restrições pelos rótulos de `rotulosDeRestricao`.
  - Rotina: o `texto` com a primeira letra maiúscula, sem mais nada.
  - Lista (D17): `{Item}` = `kb.alimento(alimento_id).nome` com a primeira letra maiúscula (se não existir na base, o próprio id); `faltou_hoje`: `{detalhe}` = `detalhe` com a primeira letra minúscula; `fez_falta`: `{detalhe}` = `detalhe` como está.
  - Toda troca com função (`replace("{itens}", () => valor)`).
- testes primeiro: um teste por linha da tabela, com a base real ou a mini-base (por exemplo casa tem com abóbora, couve e arroz → `Você tem abóbora, couve e arroz em casa`; "evitar sempre" de grupo pelo nome do grupo; restrição `sem_gluten` → `Sua alimentação é sem glúten`; não como com nome livre; rotina `essa semana você almoça fora` → `Essa semana você almoça fora`; lista faltou hoje com detalhe `Chá de gengibre com canela` → `Gengibre na lista "Para ter em casa" (faltou para chá de gengibre com canela)`; fez falta com `4` → `(já fez falta 4 vezes)`); um nome com `$&` não é reinterpretado; `nomes.test.ts` cobre as duas funções; os testes de `conversation/textos.test.ts` continuam passando.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run dup`
- pronto quando: os testes passam e `npm run dup` não acusa clone novo.
- fora: montagem do bloco (T4).

### T4 · Add propostasDoAgente and montarPropostas
- nivel: mecanica
- objetivo: criar as funções puras que recolhem as propostas aceitas do agente nas mensagens do loop e montam a lista final do bloco, na ordem e com o teto.
- arquivos: `src/core/proposals/montar.ts`, `src/core/proposals/montar.test.ts`
- leitura: `AI.md` §5
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Modo de aprovação"
- contratos:
  ```ts
  export function propostasDoAgente(mensagens: MensagemDoLoop[]): ConteudoDaProposta[]
  // resultados de memoria.propor e lista.propor com proposto: true, na ordem; nota repetida conta uma vez; de lista.propor, só a primeira (maxFaltouHoje)
  export function montarPropostas(p: { anotacoes: Anotacao[]; doAgente: ConteudoDaProposta[]; extras?: ConteudoDaProposta[] }): ConteudoDaProposta[]
  ```
  - `propostasDoAgente`: só mensagens `papel: "tool"` com `nome` `memoria.propor` ou `lista.propor`; `resultado` lido com zod (`{ proposto: true; proposta: ConteudoDaProposta }`, a proposta pelo `conteudoDaPropostaSchema`); o resto ignorado. Rotina com o mesmo texto (comparado por `normalizar`) entra uma vez. De `lista.propor`, no máximo `config.aprovacao.maxFaltouHoje` (1), a primeira.
  - `montarPropostas`: cada anotação vira uma proposta: `casa_tem` → `{ tool: "casa.propor", acao: "tem", itens }`; `casa_acabou` → `{ tool: "casa.propor", acao: "acabou", itens }`; `evitar_sempre`, `restricao`, `nao_come` e `gosta` → `{ tool: "memoria.propor", tipo: <o mesmo>, itens }`. Junta com `doAgente` e `extras` (`extras` é por onde a 011 entrega a proposta do `para_ter`). Anotação com `itens` vazio não vira proposta.
  - Ordem: evitar sempre, restrição, não como, gosta, casa tem, casa acabou, lista, rotina (dentro do mesmo tipo, a ordem de chegada). Corta em `config.aprovacao.maxLinhas` (6): as que passam disso não são criadas.
- testes primeiro: `propostasDoAgente` com uma `memoria.propor` aceita, uma recusada (`proposto: false`) e uma `lista.propor` aceita devolve as duas aceitas na ordem; duas `memoria.propor` com o mesmo fato dão uma; duas `lista.propor` aceitas dão só a primeira; resultado malformado é ignorado. `montarPropostas`: "comprei abóbora, couve e arroz" (uma anotação `casa_tem` com três itens) dá uma proposta só, com os três; a ordem com todos os tipos é a da lista; 8 propostas → ficam as 6 primeiras pela ordem; anotação vazia não vira linha; `extras` entra na posição da lista.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e o teste de arquitetura continua verde.
- fora: `finalizar` (T9); criação no banco (T13).

### T5 · Let the day's temporary list hold free-text won't-eat items and record "Não como" answers
- nivel: mecanica
- objetivo: renomear o item do temporário do dia para `ItemTemporario`, acrescentar `nao_come_texto`, levar o "não como" livre da mensagem para o temporário e para `evitar_textos`, e gravar no temporário a resposta "Não como" de uma pergunta.
- arquivos: `src/core/accounts/ports.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/db/profiles.ts`, `test/contracts/profiles.contract.ts`, `src/core/agents/companion/filtro-da-pessoa.ts`, `src/core/agents/companion/filtro-da-pessoa.test.ts`, `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/preparo.test.ts`, `src/core/conversation/caminhos-de-codigo.ts`, `src/core/conversation/conversar.test.ts` (só se um teste do temporário precisar do tipo novo), `src/core/runs/gravar-resposta.ts`, `src/core/runs/gravar-resposta.test.ts`
- leitura: `BUSINESS.md` §11, só "Evitar sempre" (o item "Pela conversa, vale na hora")
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/core/accounts/ports.ts (substitui ItemDoDia, D3)
  export type ItemTemporario =
    | EvitarItem                                              // grupo | alimento | texto
    | { tipo: "restricao"; valor: Restricao }
    | { tipo: "nao_come"; valor: string }                     // id de alimento
    | { tipo: "nao_come_texto"; valor: string }               // nome que a base não conhece
  evitarTemporario(contaId: string, dia: string): Promise<ItemTemporario[]>
  acrescentarEvitarTemporario(contaId: string, dia: string, itens: ItemTemporario[]): Promise<void>   // sem duplicar (tipo + valor)
  ```
  Renomeie `ItemDoDia` em todos os usos (sem alias). Sem migração: a coluna `tipo` já é `text`.
  - `montarFiltro` separa: `grupo`, `alimento` e `texto` vão para `evitar`; `restricao` para `restricoes`; `nao_come` para `nao_come`; `nao_come_texto` para `evitar_textos` (sem repetir, junto com os `texto` de hoje).
  - `naoComeERestricaoDaMensagem` (preparo) e `itensDoDia` (caminhos de código): "não como" com `alimento_id` → `{ tipo: "nao_come", valor: id }` (como hoje); sem `alimento_id` → `{ tipo: "nao_come_texto", valor: nome }` (cortado em 40 caracteres, `config.conversa.maxNomeLivre`).
  - `gravarResposta`: pergunta `come` com resposta `{ tipo: "come", resposta: "nao_como" }` → numa transação, `s.profiles.acrescentarEvitarTemporario(contaId, dia, [{ tipo: "nao_come", valor: pergunta.alimento_id }])`; "Como" e `pular` não gravam nada. Pergunta de casa: como hoje.
- testes primeiro: contrato do perfil (fake): `nao_come_texto` é guardado, lido e não duplica; `montarFiltro` põe `nao_come_texto` em `evitar_textos` e não em `nao_come` nem em `evitar`; `preparar` com `nao_come_da_mensagem: [{ nome: "jiló" }]` grava `{ tipo: "nao_come_texto", valor: "jiló" }` no temporário do dia e devolve `evitar_textos` com `jiló`; `gravarResposta` com "Não como" grava o item `nao_come` no temporário do dia; com "Como", nada.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`; ⚠️ `npm run test:db` se o Postgres estiver no ar (anote se não estiver).
- pronto quando: os testes e os evals passam.
- fora: dados do run (T6); propostas.

### T6 · Add the run data the proposal tools read
- nivel: mecanica
- objetivo: acrescentar a `DadosDoPreparo` o que as tools de proposta precisam, preencher no `preparar` e no `aplicarResposta`, e montar `ctx.run` a cada trecho do Acompanhante.
- arquivos: `src/core/tools/tool.ts`, `src/core/agents/companion/contexto-do-run.ts`, `src/core/agents/companion/contexto-do-run.test.ts`, `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/preparo.test.ts`, `src/core/agents/companion/pergunta-do-run.ts`, `src/core/agents/companion/pergunta-do-run.test.ts`, `src/core/agents/companion/responder.ts`, `src/core/agents/companion/responder.test.ts`, `src/core/agents/companion/contexto.test.ts`. Exceção: fixtures de teste ou eval que montem `DadosDoPreparo` à mão e quebrem no typecheck podem ganhar os campos novos (diga quais).
- leitura: `BUSINESS.md` §9, só "Lista "Para ter em casa""
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `dadosDoPreparoSchema` ganha (D4), todos com `.default([])`:
  ```ts
  nao_tem_do_run: z.array(z.string())          // ids respondidos com "Não tenho" neste run
  candidatos_do_preparo: z.array(z.object({ tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]), id: z.string(), nome: z.string(), alimentos: z.array(z.string()) }))
  na_lista: z.array(z.string())                // alimento_id da lista "Para ter em casa"
  lista_recusada: z.array(z.string())          // alimento_id das propostas de lista recusadas
  notas_ativas: z.array(z.string())            // textos das notas de rotina ativas
  ```
  - `preparar`: `candidatos_do_preparo` = a lista completa (`todos`, antes de `entregaveis` e do corte), com `alimentos` = ids de `itens` e de todas as `opcoes`, sem repetir; `na_lista` = `shortages.lista(contaId)` → `alimento_id`; `lista_recusada` = `proposals.recusadas(contaId, "lista.propor")` → `conteudo.alimento_id` quando for string; `notas_ativas` = `routine.notasAtivas(contaId)` → `texto`; `nao_tem_do_run: []`. `paraTerDoRun` passa a receber `na_lista` e `lista_recusada` já lidos (sem ler de novo). Nenhum desses campos vai ao contexto do modelo (`montarMensagemInicial` não muda; confira com um teste).
  - `aplicarResposta` (009): resposta de casa com `nao_tenho` também acrescenta o id a `nao_tem_do_run` (sem repetir).
  - `src/core/tools/tool.ts`:
  ```ts
  export type ContextoDoRun = {
    fato_de_rotina?: string; com_incomodo: boolean; tem_para_ter: boolean
    nao_tem: string[]                                   // respondidos com "Não tenho" neste run
    candidatos: { tipo: TipoDeSugestao; id: string; nome: string; alimentos: string[] }[]   // lista completa do preparo, antes de `entregaveis` (009) e das retiradas por resposta
    na_lista: string[]; lista_recusada: string[]; notas_ativas: string[]
  }
  // ToolContext ganha:
  run?: ContextoDoRun
  ```
  - `src/core/agents/companion/contexto-do-run.ts`: `export function contextoDoRun(dados: DadosDoPreparo): ContextoDoRun` (puro): `fato_de_rotina` (se houver), `com_incomodo: dados.com_incomodo`, `tem_para_ter: dados.para_ter !== undefined`, `nao_tem: dados.nao_tem_do_run`, `candidatos: dados.candidatos_do_preparo`, `na_lista`, `lista_recusada`, `notas_ativas`.
  - `responder.ts`: `montarCtx` passa `run: contextoDoRun(dados)` (em `comModelo`) e `run: contextoDoRun(novos)` (em `continuar`).
- testes primeiro: `preparar` com uma refeição de vaga com opções devolve em `candidatos_do_preparo` os ids das opções; com um alimento na lista, uma proposta de lista recusada (`proposals.criar` + `decidir("recusada")`) e uma nota ativa, os três campos vêm preenchidos; um checkpoint antigo sem os campos passa no schema com listas vazias; `aplicarResposta` com "Não tenho" acrescenta a `nao_tem_do_run`, sem repetir em duas respostas; `contextoDoRun` com e sem `fato_de_rotina` e com `para_ter`; o contexto do modelo não traz `na_lista`, `lista_recusada`, `notas_ativas`, `candidatos_do_preparo` nem `nao_tem_do_run`; `responder` com runtime roteirizado e uma tool de teste registrando o `ctx` recebido mostra `ctx.run` preenchido (ou confira por `montarCtx` exportado só para teste, se mais simples).
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: tools de proposta (T7).

### T7 · Add the proposal tools
- nivel: mecanica
- objetivo: criar `memoria.propor` e `lista.propor`, tools comuns que nunca gravam: validam o pedido pelo `ctx.run` e devolvem a proposta ou o código de recusa.
- arquivos: `src/core/agents/tools/propostas.ts`, `src/core/agents/tools/propostas.test.ts`
- leitura: `AI.md` §4, só "Escrita (viram proposta, §5)"
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Modo de aprovação"
- contratos:
  ```ts
  export type CodigoDeRecusaDeProposta = "com_incomodo" | "sem_fato" | "fato_com_incomodo" | "ja_anotado" | "fora_da_base" | "sem_nao_tenho" | "com_para_ter" | "fora_do_candidato" | "ja_na_lista" | "ja_recusado" | "filtrado"
  export type ResultadoDeProposta = { proposto: true; proposta: ConteudoDaProposta } | { proposto: false; motivo: CodigoDeRecusaDeProposta }
  export const memoriaPropor: Tool<{ tipo: "rotina" }, ResultadoDeProposta>
  // name: "memoria.propor"
  // description: "Propõe guardar o fato_de_rotina do contexto como nota de rotina. Só grava se a pessoa aprovar."
  export const listaPropor: Tool<{ alimento_id: string; pratica_id?: string; preparo_id?: string }, ResultadoDeProposta>
  // name: "lista.propor"
  // description: "Propõe pôr na lista Para ter em casa um alimento que a pessoa respondeu que não tem e que faltou para uma sugestão. Só grava se a pessoa aprovar."
  export function validarMemoriaPropor(run: ContextoDoRun, kb: KnowledgeBase): CodigoDeRecusaDeProposta | undefined
  export function validarListaPropor(pedido: { alimento_id: string; pratica_id?: string; preparo_id?: string }, run: ContextoDoRun, filtro: FiltroPessoa, kb: KnowledgeBase): CodigoDeRecusaDeProposta | undefined
  ```
  Feitas com `definirTool`; `input` zod estrito (`{ tipo: z.literal("rotina") }`; `{ alimento_id: z.string(), pratica_id: z.string().optional(), preparo_id: z.string().optional() }`); `output` zod da união. Sem `ctx.run`, usam o run vazio (D4: `com_incomodo: false`, `tem_para_ter: false`, listas vazias). Conferem na ordem da tabela e devolvem o primeiro código:

  | Tool | Código | Recusa quando |
  |---|---|---|
  | as duas | `com_incomodo` | O run tem incômodo |
  | `memoria.propor` | `sem_fato` | Não há `fato_de_rotina` |
  | `memoria.propor` | `fato_com_incomodo` | O fato, normalizado, contém alguma das `palavras` de um incômodo da base (D14: substring sobre `normalizar`) |
  | `memoria.propor` | `ja_anotado` | O fato, normalizado, é igual a uma nota ativa (normalizada) |
  | `lista.propor` | `fora_da_base` | O alimento não existe |
  | `lista.propor` | `sem_nao_tenho` | O alimento não está em `nao_tem` |
  | `lista.propor` | `com_para_ter` | `tem_para_ter` |
  | `lista.propor` | `fora_do_candidato` | Sem `pratica_id` nem `preparo_id`, com os dois, ou o candidato indicado não usa o alimento |
  | `lista.propor` | `ja_na_lista` | O alimento está em `na_lista` |
  | `lista.propor` | `ja_recusado` | O alimento está em `lista_recusada` |
  | `lista.propor` | `filtrado` | `passaNoFiltro` reprova o alimento |

  - Candidato indicado: `pratica_id` casa com um item de `run.candidatos` de `tipo` diferente de `refeicao` e `id` igual; `preparo_id`, com `tipo: "refeicao"` e `id` igual; "usa o alimento" = o id está em `alimentos`.
  - `filtrado`: `passaNoFiltro(kb.alimento(id), ctx.filtro, kb).passa` falso.
  - Aceita: `memoria.propor` → `{ proposto: true, proposta: { tool: "memoria.propor", tipo: "rotina", texto: run.fato_de_rotina } }`; `lista.propor` → `{ proposto: true, proposta: { tool: "lista.propor", alimento_id, motivo: "faltou_hoje", detalhe: <nome do candidato indicado, como está> } }`.
  - `resumir`: `proposto` ou `recusado: <código>` (nada da pessoa).
  - Nenhuma das duas toca em `ctx.stores`.
- testes primeiro: um teste por código, em que só ele é devolvido (run com incômodo nas duas; sem fato; fato com uma palavra de incômodo da base, por exemplo a primeira `palavras` de `dor-de-cabeca`; fato igual a nota ativa com acento e maiúscula diferentes; alimento fora da base; alimento sem "Não tenho"; com `para_ter`; sem candidato, com os dois ids, e com candidato que não usa o alimento; já na lista; já recusado; barrado por "evitar sempre"); um aceito para cada tool, com o conteúdo exato (detalhe = nome do candidato); `resumir` nos dois casos; sem `ctx.run`, `memoria.propor` dá `sem_fato` e `lista.propor` dá `fora_da_base` ou `sem_nao_tenho`; nenhuma escrita nos stores (compare o estado em memória antes e depois).
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: registrar as tools no Acompanhante (T10); `finalizar` (T9).

### T8 · Add propostas to the companion output
- nivel: mecanica
- objetivo: dar à saída do Acompanhante a lista `propostas` (linhas do bloco) e o campo interno `propostas_do_agente`.
- arquivos: `src/core/agents/companion/saida.ts`, `src/core/agents/companion/saida.test.ts`. Exceção: testes, evals, fixtures e scripts que montem `SaidaDoAcompanhante` à mão e quebrem no typecheck podem ganhar `propostas: []` e nada mais (diga quais).
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos (D9):
  ```ts
  // SaidaDoAcompanhante ganha:
  propostas: PropostaNaSaida[]                       // vazio quando não há
  propostas_do_agente?: ConteudoDaProposta[]        // interno: o que finalizar recolheu; sai da saída final
  ```
  `saidaDoAcompanhanteSchema` ganha `propostas: z.array(propostaNaSaidaSchema).default([])` e `propostas_do_agente: z.array(conteudoDaPropostaSchema).optional()`. `completarSaida`, `saidaDeCodigo`, `saidaSegura` e `saidaSemModelo` põem `propostas: []`. `anotacoes` continua na saída, como dado.
- testes primeiro: as quatro montadoras devolvem `propostas: []` e sem `propostas_do_agente`; o schema aceita uma saída com `propostas_do_agente` e a mantém no parse; uma saída antiga sem `propostas` passa com `[]`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: `finalizar` (T9); fim do run (T13).

### T9 · Let finalizar collect the agent's proposals
- nivel: nucleo
- objetivo: fazer `finalizar` pôr na saída entregue as propostas aceitas das tools de proposta e garantir, por teste, que o resultado de cada tool do passo já está em `estado.mensagens` quando a seguinte roda.
- arquivos: `src/core/agents/tools/finalizar.ts`, `src/core/agents/tools/finalizar.test.ts`, `src/core/runs/loop.test.ts`
- leitura: `AI.md` §4, só "Escrita (viram proposta, §5)"
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linhas "Loop de execução com rastro" e "Modo de aprovação"
- contratos:
  - `finalizar`, na entrega aceita: `{ tipo: "entregar", saida: { ...completarSaida(entrada, dados, ctx.kb), propostas_do_agente: propostasDoAgente(estado.mensagens) } }` (sem o campo quando a lista é vazia). Recusa por violação: como hoje (nada de proposta).
  - Loop (005): o resultado de cada tool entra em `estado.mensagens` antes de a tool seguinte do mesmo passo ser executada. `processarChamadas` já faz isso: **não mude** `loop-passo.ts`; só escreva o teste. Se o teste falhar, pare e descreva.
- testes primeiro: com um agente de teste `[memoriaPropor, listaPropor]` + controle `[finalizar]` e o runtime roteirizado (base real, `createMemoryStores`, `ctx.run` com `fato_de_rotina`): um passo com `memoria.propor` e `finalizar` nessa ordem entrega com `propostas_do_agente` contendo a nota; `finalizar` num passo seguinte também; uma `memoria.propor` recusada não entra; `finalizar` recusado por violação e depois aceito traz a proposta aceita antes; `lista.propor` aceita duas vezes → só a primeira. `loop.test.ts`: uma tool de teste que registra `amb.estado.mensagens` vê, no mesmo passo, o resultado da tool anterior.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: registrar as tools no Acompanhante (T10); criar as propostas no banco (T13).

### T10 · Add the companion prompt v4 and give the proposal tools to the companion
- nivel: mecanica
- objetivo: criar `acompanhante.v4` como cópia da v3 com a troca de uma linha por três, e fazer `criarAcompanhante` usá-lo com as tools de proposta.
- arquivos: `src/core/agents/prompts/acompanhante.v4.ts`, `src/core/agents/prompts/acompanhante.v4.test.ts`, `src/core/agents/companion/agente.ts`, `src/core/agents/companion/agente.test.ts`, `scripts/eval-llm.ts` (só a versão do prompt no cabeçalho do relatório, presa a `acompanhanteV3`)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `acompanhanteV4`: cópia exata de `acompanhanteV3` (`instrucoes`, `lembreteDeEntrega`) com `versao: "acompanhante.v4"` e **uma** troca em "O QUE VALE SEMPRE": a linha que começa com `- fato_de_rotina:` (hoje `- fato_de_rotina: leve em conta no que sugerir. Não diga que anotou.`) é substituída por estas três, nesta ordem, sem mudar uma vírgula:
  ```text
  - fato_de_rotina: leve em conta no que sugerir. Se ele muda o que faz sentido para a pessoa por mais de um dia, chame memoria.propor. A nota só é guardada se ela aprovar: nunca diga que anotou.
  - lista.propor: só para um alimento que a pessoa respondeu "nao_tenho" nesta conversa e que faria diferença numa sugestão. No máximo um, com a sugestão a que ele faltou. Não use quando o contexto trouxer para_ter.
  - O que você propõe guardar aparece para a pessoa depois da sua resposta. Não fale das propostas no texto e não fale em comprar para resolver o momento.
  ```
  - `criarAcompanhante()`: `instrucoes`, `prompt_versao` e `lembreteDeEntrega` de `acompanhanteV4`; `tools: [...climaTools, ...memoriaTools, ...ayurvedaTools, memoriaPropor, listaPropor]` (com o cast para `Tool<unknown, unknown>` que as outras usam); `controle` como hoje (`finalizar`, `ask_user`). A v3 continua no repositório.
- testes primeiro: v4 tem `versao` `acompanhante.v4` e o mesmo lembrete da v3; v4 é a v3 com a linha `- fato_de_rotina:` trocada pelas três linhas e nenhuma outra diferença (compare linha a linha, como o teste da v3 faz com a v2); `criarAcompanhante` usa a v4 e tem `memoria.propor` e `lista.propor` por último nas tools.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam (os cenários roteirizados continuam passando).
- fora: fim do run (T11, T13).

### T11 · Let the companion keep the run open and let the run service pause for approval
- nivel: nucleo
- objetivo: dar ao Acompanhante a opção de não fechar o run no desfecho bom (para a conversa decidir entre `done` e `waiting_for_approval`) e dar a `pausarSemAgente` a pausa de aprovação.
- arquivos: `src/core/agents/companion/responder.ts`, `src/core/agents/companion/responder.test.ts`, `src/core/agents/companion/fim-do-run.ts`, `src/core/agents/companion/fim-do-run.test.ts`, `src/core/runs/run-service.ts`, `src/core/runs/run-service.test.ts`
- leitura: `AI.md` §5; `OBSERVABILITY.md` §3, a linha `pausa` da árvore
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Modo de aprovação"
- contratos:
  - `OpcoesDoResponder` ganha `manterAberto?: true`; `continuar(contaId, run, r, opts?: { aoVivo?; manterAberto?: true })` também (D5). Com ela:
    - em `fim-do-run`, desfecho com `alvo: "done"` e run em `running`: `stores.runs.atualizar(contaId, runId, campos)` (sem trocar o status) e a resposta sai com `status: "running"`. `failed` e a pausa (`waiting_for_input`) não mudam.
    - em `semModelo` com run dado: o mesmo (grava os campos sem `encerrar`; `status: "running"`).
    - sem a opção, tudo como hoje.
  - `pausarSemAgente(contaId, runId, pendencia, campos?: Partial<RunMutavel>)` (D6): `pendencia.tipo === "pergunta"` → `waiting_for_input` com `checkpoint: null` (como hoje); `"aprovacao"` → `waiting_for_approval`, sem mexer no checkpoint; nos dois, grava `pendencia: { ...pendencia, criada_em: clock.now().toISOString() }` e `campos`, emite `telemetry.evento("pausa", { "pausa.tipo": pendencia.tipo })` e `telemetry.contador("ritu_pausas_total", { tipo: pendencia.tipo })`. Exige o run em `running` (regra de `podeIr`).
- testes primeiro: `responder` com `manterAberto` e roteiro que entrega deixa o run em `running` com `saida`, `momento` e `modelos` gravados e devolve `status: "running"`; sem a opção, `done` como hoje; com `manterAberto` e fim `erro`, `failed`; com `manterAberto` e sem modelo (run dado), `running` com a saída sem modelo; `continuar` com `manterAberto` depois de uma pausa termina em `running`; `pausarSemAgente` com `aprovacao` leva a `waiting_for_approval`, mantém o checkpoint, grava `criada_em` do relógio e os `campos`, emite um evento `pausa` com `pausa.tipo: "aprovacao"` e soma `ritu_pausas_total{tipo: "aprovacao"}`; com `pergunta`, como hoje; em run `done`, lança.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: a conversa (T13).

### T12 · Add the proposal executor
- nivel: nucleo
- objetivo: criar o executor em código, uma tabela fechada de `tipo → gravação` que só acrescenta, e o caso de contrato da troca de status condicional dentro de duas transações simultâneas.
- arquivos: `src/core/proposals/executor.ts`, `src/core/proposals/executor.test.ts`, `test/contracts/transactor.contract.ts`
- leitura: `AI.md` §5; `BUSINESS.md` §11 (só a tabela e as "Regras da memória")
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Modo de aprovação"; `.local/REFERENCIAS.md` §1, linha "Autorização por conta no repositório"
- contratos:
  ```ts
  export function executarProposta(stores: Stores, contaId: string, tool: string, conteudo: unknown, kb: KnowledgeBase): Promise<boolean>   // false: não aceita
  ```
  Valida `{ tool, ...conteudo }` com `lerConteudo(tool, conteudo)` (T2); inválido → `false` sem gravar. Depois confere a base (D12): qualquer `alimento_id` fora da base, "evitar sempre" de `alimento` fora da base ou de `grupo` fora de `kb.gruposEvitar` → `false` sem gravar. Grava (tabela fechada, um `switch`/mapa por variante, **sem caso genérico**):

  | Proposta | Grava |
  |---|---|
  | Casa, tem | `pantry.registrar(contaId, itens, "conversa")`, cada item como `{ alimento_id }` ou `{ nome_livre: nome }` |
  | Casa, acabou | `pantry.marcarAcabou(contaId, itens)`, no mesmo formato |
  | Evitar sempre | `profiles.acrescentarEvitarSempre(contaId, itens)` |
  | Restrição | `profiles.definirRestricoes(contaId, …)` com a união das atuais (`profiles.ler`) e das novas, sem repetir |
  | Não como | `profiles.definirNaoCome(contaId, …)` com a união (alimento da base como `{ tipo: "alimento", valor: id }`; nome livre como `{ tipo: "texto", valor: nome }`), sem repetir (tipo + valor) |
  | Gosta | `preferences.definirGosto(contaId, { tipo: "alimento", id }, "gosta")` para cada item |
  | Rotina | `routine.anotar(contaId, texto)` |
  | Lista | `shortages.porNaLista(contaId, { alimento_id, motivo, detalhe })` |

  Devolve `true` depois de gravar. Não há operação de remover. Quem chama passa os `stores` da transação.
  - Contrato do `Transactor` (D10), caso novo: com um run em `waiting_for_approval`, duas chamadas simultâneas (`Promise.all`) de `tx.emTransacao(async (s) => { if (!(await s.runs.mudarStatusSe(a, run.id, "waiting_for_approval", "done"))) return false; await s.routine.anotar(a, "nota"); return true })`: exatamente uma devolve `true`, o run fica `done` e há uma nota só.
- testes primeiro (`createMemoryStores`, base real ou mini-base): cada tipo grava exatamente o da tabela (casa tem com um item da base e um livre; casa acabou; evitar sempre sem duplicar o que já está; restrição unida às atuais; não como com alimento e com nome livre, unido; gosta; rotina; lista); registrar em casa um alimento que estava na lista o tira da lista e apaga as faltas dele; conteúdo com campo a mais, com `acao: "remover"`, com `tool` desconhecida ou com `alimento_id` fora da base devolve `false` e não grava nada; outra conta não é tocada; o caso de contrato no fake.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run test:db` se o Postgres estiver no ar (anote se não estiver).
- pronto quando: os testes passam.
- fora: `aprovar` (T14).

### T13 · End conversation runs with the approval block
- nivel: nucleo
- objetivo: fazer `conversar` e `continuar` fecharem o run: sem propostas, `done`; com propostas, criar as linhas, gravar as etapas e a saída com o bloco e pausar em `waiting_for_approval`.
- arquivos: `src/core/conversation/fim-com-propostas.ts`, `src/core/conversation/fim-com-propostas.test.ts`, `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts`, `src/core/conversation/continuar.ts`, `src/core/conversation/continuar.test.ts`. Exceção: testes, evals e cenários que esperavam `status: "done"` de um run da conversa que agora termina em `waiting_for_approval` (por exemplo `test/fixtures/cenarios/cenarios.test.ts`, `evals/det/conversa/*.eval.ts`, `evals/det/pausas/*.eval.ts`, `scripts/lib/*.test.ts`) podem trocar a expectativa para o status novo e nada mais (diga quais).
- leitura: `AI.md` §5; `BUSINESS.md` §8 "Fluxo de uma mensagem", item 7; `OBSERVABILITY.md` §3, a linha `pausa`
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Modo de aprovação"
- contratos:
  ```ts
  // src/core/conversation/fim-com-propostas.ts
  export async function fecharComPropostas(
    deps: Pick<Deps, "stores" | "kb" | "runs" | "telemetry">,
    p: { contaId: string; runId: string; caminho: Caminho; comIncomodo: boolean; saida: SaidaDoAcompanhante; anotacoes: Anotacao[]; aoVivo?: (e: EventoAoVivo) => void },
  ): Promise<SaidaDoAcompanhante>
  ```
  Chamado com o run em `running`, depois de a saída existir e de a mensagem do agente ser gravada (D8):
  1. `caminho` em `alerta`, `fora`, `ofensa` ou `ajuda`, ou `comIncomodo` (D7): nenhuma proposta. Senão `propostas = montarPropostas({ anotacoes, doAgente: saida.propostas_do_agente ?? [] })`.
  2. Sem propostas: `final = { ...saida sem propostas_do_agente, anotacoes, propostas: [] }`; `runs.encerrar(contaId, runId, "done", { saida: final })`.
  3. Com propostas: `criadas = stores.proposals.criar(contaId, runId, propostas.map(semTool))`; uma etapa `proposta` por linha, na ordem (D13: `nome` = a tool; `resumo` `casa: 3 itens`, `evitar_sempre: 1 item`, `restricao: …`, `nao_come: …`, `gosta: …`, `rotina`, `lista`; `status: "ok"`), com os eventos ao vivo `etapa_iniciada`/`etapa_concluida`; `final = { ...saida sem propostas_do_agente, anotacoes, propostas: criadas.map((c, i) => ({ id: c.id, tool: propostas[i].tool, texto: textoDaProposta(propostas[i], kb) })) }`; `runs.pausarSemAgente(contaId, runId, { tipo: "aprovacao", conteudo: { propostas: criadas.map(c => c.id) } }, { saida: final })` (evento `pausa` e `ritu_pausas_total{tipo: "aprovacao"}` saem lá, T11).
  4. Devolve `final`.
  - `conversar`: chama o Acompanhante (`responder`) com `manterAberto: true`; `viaCodigo` deixa de encerrar o run (grava os campos com `stores.runs.atualizar`); o `semModelo` da conversa também passa `manterAberto: true`. Depois de gravar a mensagem do agente com `saida.resposta`, se o run está em `running`, chama `fecharComPropostas` com as anotações (as de `anotacoesDaMensagem` ou as do caminho de código) e `comIncomodo` = incômodo na interpretação ou `run.com_incomodo`. Se ele lançar: run `failed` (se ainda em `running`) com a saída sem propostas (`propostas: []`), e a resposta devolvida é essa (D8). `RespostaDaConversa` devolve o `status` final (`done` ou `waiting_for_approval`) com a `saida` completa (com `propostas`). A pausa de pergunta (009) não muda.
  - `continuar` (conversa): chama `companion.continuar` e `companion.responder` (pausa de código) com `manterAberto: true`; em `aposFim`, depois de gravar a mensagem do agente, chama `fecharComPropostas` com `anotacoes = acrescentarNaoCome(conteudo.anotacoes ?? [], naoComeDoRun, perfil, kb)` e `comIncomodo = run.com_incomodo`, com a mesma regra de falha. Um run que pausou e termina com propostas faz `waiting_for_input → running → waiting_for_approval`.
  - A resposta (`saida.resposta` e sugestões) é gravada no run e devolvida já nesta chamada, antes de qualquer aprovação.
- testes primeiro (`createMemoryStores`, `createFakeLlm`, runtime roteirizado, base real, `createMemoryTelemetry`): `casa-sozinha` (caminho `casa`) termina em `waiting_for_approval` com uma linha `Você tem abóbora, couve e pitaia em casa`, uma proposta `pendente` com `tool: "casa.propor"`, uma etapa `proposta` (`casa: 3 itens`), pendência `{ tipo: "aprovacao", conteudo: { propostas: [id] } }`, um evento `pausa` (`aprovacao`) e `saida.resposta` gravada; um roteiro `memoria.propor` → `finalizar` com `fato_de_rotina` dá uma linha de rotina; uma mensagem sem nada a propor termina em `done` com `propostas: []`; com incômodo e anotação de casa, nenhuma proposta e `done`; caminho `alerta` sem proposta; a saída final não tem `propostas_do_agente`; com 8 anotações, 6 linhas; falha simulada em `proposals.criar` (override do store): run `failed`, mensagem do agente já gravada, a saída devolvida sem propostas; pausa de pergunta seguida de `continuar` com anotação → `waiting_for_approval`; banco de `perfis`, `casa`, `rotina_notas` e `lista_ter_em_casa` igual ao de antes da mensagem nesses cenários (nada gravado antes da aprovação); nenhum `resumo`, span, métrica ou log com nome de alimento ou texto da nota.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`; `npm run demo -- --cenario casa-sozinha` com código 0.
- pronto quando: os testes e os evals passam.
- fora: `aprovar` (T14); rota HTTP (018).

### T14 · Add the aprovar service
- nivel: nucleo
- objetivo: criar `aprovar`, que recebe as linhas ligadas, confere prazo e ids e, numa transação que começa pela troca de status condicional, grava só o aprovado pelo executor e fecha o run.
- arquivos: `src/core/conversation/aprovar.ts`, `src/core/conversation/aprovar.test.ts`, `src/core/conversation/conversar.ts` (só para expor `aprovar` em `createConversation`)
- leitura: `AI.md` §5; `BUSINESS.md` §9, só "Lista "Para ter em casa""; `OBSERVABILITY.md` §3, a linha `aprovacao.execucao`
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linhas "Modo de aprovação" e "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  ```ts
  export type ResultadoDaAprovacao = { run_id: string; status: "done"; gravadas: PropostaNaSaida[]; recusadas: string[] }
  // createConversation(deps) passa a devolver também (D19):
  aprovar(contaId: string, runId: string, aprovadas: string[]): Promise<ResultadoDaAprovacao>
  ```
  `src/core/conversation/aprovar.ts` exporta `criarAprovar(deps)` (as `Deps` da conversa). Ordem:
  1. `run = stores.runs.buscar(contaId, runId)`; ausente (inclusive de outra conta) ou fora de `waiting_for_approval`: `RunNaoContinuavelError`, nada muda. `pendenciaSchema` sobre `run.pendencia` com `tipo: "aprovacao"` e `conteudo: { propostas: string[] }` (zod); inválida: `RunNaoContinuavelError`.
  2. `clock.now() − pendencia.criada_em > config.memoria.esperaMinutos × 60 000` (30 min exatos ainda valem; D11): numa transação, `mudarStatusSe(contaId, runId, "waiting_for_approval", "expired")` e `proposals.expirarDosRuns([runId])`; se `mudarStatusSe` devolver `false`, `RunNaoContinuavelError`; senão `throw new RituError("aprovacao_expirada", "A aprovação expirou")`. Nada é gravado.
  3. `pendentes` = `proposals.doRun(contaId, runId)` com `decisao: "pendente"` e id em `conteudo.propostas`, na ordem do bloco. Algum id de `aprovadas` fora de `pendentes`: `throw new RituError("aprovacao_invalida", "Aprovação inválida")`; nada muda. `aprovadas` repetidas contam uma vez; lista vazia é "Agora não" (e "Anotar" com tudo desligado é igual).
  4. Dentro de `runs.comSpanDoRun(contaId, runId, …)` e do span `aprovacao.execucao`, uma transação (`tx.emTransacao(async (s) => …)`):
     - a primeira operação é `s.runs.mudarStatusSe(contaId, runId, "waiting_for_approval", "done")`; se devolver `false`, o corpo **retorna** um marcador sem lançar (D10) e, fora da transação, `RunNaoContinuavelError` (outra aprovação chegou antes);
     - para cada pendente, na ordem: se aprovada, `executarProposta(s, contaId, p.tool, p.conteudo, kb)`; `true` → `s.proposals.decidir(contaId, p.id, "aprovada")`; `false` → `decidir("recusada")` e `s.runs.acrescentarEtapa` de `{ tipo: "erro", nome: "proposta_invalida", status: "falhou", resumo: null, duracao_ms: 0, modelo: null, tokens_entrada: 0, tokens_saida: 0 }`; não aprovada → `decidir("recusada")`;
     - grava a etapa `{ tipo: "aprovacao", nome: "aprovacao", status: "ok", resumo: "N de M" }` (N = gravadas, M = pendentes) com `s.runs.acrescentarEtapa`;
     - se algo lançar, a transação desfaz tudo, inclusive a troca de status: o run continua em `waiting_for_approval` e o erro sobe.
  5. Depois do commit: span com `propostas.total: M` e `propostas.aprovadas: N`; `ritu_propostas_total{tool, decisao}` uma vez por linha (`aprovada` ou `recusada`); cada proposta de lista com `motivo: "fez_falta"` soma `ritu_para_ter_total{etapa: "aprovada" | "recusada"}`; cada item de proposta `gosta` gravada soma `ritu_gosto_total{gosto: "gosta"}` (D12).
  6. Devolve `{ run_id, status: "done", gravadas: <as gravadas como PropostaNaSaida, com textoDaProposta>, recusadas: <ids recusados> }`.
  - "Expirada não é recusa": `decidir` nunca recebe `expirada`; a expiração é só por `expirarDosRuns`.
- testes primeiro (`createMemoryStores`, `createFakeLlm`, runtime roteirizado, base real, `createFixedClock`, `createMemoryTelemetry`; o bloco aberto por `conversar`):
  - aprovação parcial: bloco com três linhas (por exemplo restrição, casa tem e rotina), `aprovar` com uma: só ela grava; as outras ficam `recusada`; run `done`; etapa `aprovacao` com `resumo` `1 de 3`; span `aprovacao.execucao` com `propostas.total: 3` e `propostas.aprovadas: 1`; `ritu_propostas_total` soma por linha com `tool` e `decisao`;
  - "Agora não" (lista vazia): todas `recusada`, nada gravado, run `done`;
  - expiração: 30 min exatos vale; 30 min e 1 ms → run `expired`, propostas `expirada`, `RituError` `aprovacao_expirada`, nada gravado; proposta de lista expirada não aparece em `proposals.recusadas(contaId, "lista.propor")`; recusada, aparece;
  - id que não é do run → `aprovacao_invalida`, nada muda; outra conta → `RunNaoContinuavelError`, nada muda; run `done` ou `expired` (pela limpeza) → `RunNaoContinuavelError`;
  - duas chamadas em seguida: a segunda lança `RunNaoContinuavelError` e nada é gravado de novo; duas ao mesmo tempo (`Promise.all`): uma grava, a outra lança `RunNaoContinuavelError`, a nota de rotina existe uma vez;
  - conteúdo que o executor não aceita (proposta criada à mão com `alimento_id` fora da base): a linha fica `recusada`, etapa `erro` `proposta_invalida`, as outras aprovadas gravam;
  - falha simulada no meio (store que lança na segunda gravação): nada gravado, run continua `waiting_for_approval`, nenhuma métrica somada;
  - "vale ter em casa": proposta de lista `fez_falta` criada à mão soma `ritu_para_ter_total{etapa: "aprovada"}` ao aprovar e `recusada` ao recusar;
  - mensagem nova com bloco aberto: o run antigo vai a `done` e as propostas a `expirada` (005; só confira);
  - nenhum span, métrica ou log com nome de alimento, texto de nota ou texto da pessoa.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: rota `POST /api/runs/:id/approve` e o bloco na tela (018).

### T15 · Add the approval scenarios
- nivel: mecanica
- objetivo: acrescentar ao `Cenario` a decisão do bloco e a segunda mensagem, fazer `rodarCenario` aprovar, e criar os três cenários novos.
- arquivos: `test/fixtures/cenarios/tipos.ts`, `test/fixtures/cenarios/index.ts`, `test/fixtures/cenarios/montar.ts`, `test/fixtures/cenarios/rodar.ts`, `test/fixtures/cenarios/casa-sozinha.ts`, `test/fixtures/cenarios/aprovacao-parcial.ts`, `test/fixtures/cenarios/faltou-hoje.ts`, `test/fixtures/cenarios/vegetariana.ts`, `test/fixtures/cenarios/cenarios.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `Cenario` ganha `aprovacao?: { aprovar: number[] } | "agora_nao"` (posições das linhas, a partir de 1) e `depois?: { mensagem: MensagemRecebida; interpretacao: SaidaDoInterprete; roteiro: PassoRoteirizado[] }` (D16). Sem `aprovacao`, o bloco fica aberto.
  - `montarCenario`: com `depois`, o `createFakeLlm` recebe `[c.interpretacao, c.depois.interpretacao]` e o runtime roteirizado, `[...c.roteiro, ...c.depois.roteiro]`.
  - `rodarCenario` ganha em `opts` `decidir?: (propostas: PropostaNaSaida[]) => Promise<string[]>` (ids aprovados) e devolve também `bloco?: { propostas: PropostaNaSaida[]; aprovadas: string[]; resultado: ResultadoDaAprovacao }` e `depois?: RodadaDoCenario`. Depois das pausas, se o final está em `waiting_for_approval` com `saida.propostas` não vazio: `aprovadas` = `opts.decidir(propostas)`, ou pelas posições de `c.aprovacao` (`"agora_nao"` → `[]`); sem nenhum dos dois, não aprova (o bloco fica aberto e `bloco` não vem). Com `aprovadas` definido, `deps.conversation.aprovar(contaId, run_id, aprovadas)`. Com `c.depois`, manda `depois.mensagem` por `conversar` e roda até o fim (sem aprovar o segundo bloco).
  - Registro novo (D16), com os três cenários novos, depois de `cenariosComPausa`:
  ```ts
  export const cenariosComAprovacao: Record<string, CenarioDeConversa>
  ```
  `casa-sozinha` continua em `cenariosDeConversa` e ganha `aprovacao: { aprovar: [1] }`.
  - Os três cenários (base real; perfil, clima e forma como os da 008 e 009; mensagem com `interpretacao` roteirizada; textos e entregas do `finalizar` válidos no validador — copie a forma de uma entrega válida dos cenários existentes):

  | Cenário | Mensagem e interpretação | Roteiro | Bloco e decisão |
  |---|---|---|---|
  | `aprovacao-parcial` | "essa semana vou almoçar fora todo dia, e comprei abóbora"; `intencoes: ["vida", "casa"]`, `itens_casa: [{ nome: "abóbora", acao: "tem" }]`, `fato_de_rotina: "essa semana você vai almoçar fora todo dia"` | `memoria.propor({ tipo: "rotina" })` → `finalizar` | duas linhas (casa tem, rotina); `aprovacao: { aprovar: [1] }` (só a da casa) |
  | `faltou-hoje` | momento com frio; gengibre nunca registrado em casa | `ask_user({ tipo: "casa", alimentos: ["gengibre"] })` → (Não tenho) → `lista.propor({ alimento_id: "gengibre", pratica_id: <chá com gengibre entre os candidatos> })` → `finalizar` sem gengibre | uma linha da lista; `aprovacao: { aprovar: [1] }` |
  | `vegetariana` | "sou vegetariana, o que eu como agora?"; `intencoes: ["momento"]`, `restricoes: ["vegetariana"]` | `finalizar` com uma sugestão sem nada que a restrição barra | uma linha da restrição; `aprovacao: "agora_nao"`; `depois`: "e no jantar?", `intencoes: ["momento"]`, `finalizar` com sugestão vegetariana |

  Para `faltou-hoje`, escolha o chá rodando `preparar` sobre o cenário (um candidato `cha` que usa `gengibre`, sem `para_ter` no run); `respostas: [{ tipo: "casa", itens: [{ alimento_id: "gengibre", resposta: "nao_tenho" }] }]`. Confira os ids na base; se algum não existir, pare e diga qual.
- testes primeiro: cada cenário novo roda por `rodarCenario` até o fim: `aprovacao-parcial` com 2 linhas na ordem (casa, rotina), aprova a 1ª, abóbora em Minha casa e nenhuma nota de rotina; `faltou-hoje` com 1 pausa e 1 linha (`Gengibre na lista "Para ter em casa" (faltou para …)`), gengibre na lista depois de aprovar; `vegetariana` com a linha `Sua alimentação é vegetariana`, nada no perfil depois de "Agora não", e os candidatos da segunda mensagem (`checkpoint.dados.candidatos` do segundo run) sem alimento que a restrição barra; `casa-sozinha` aprova e Minha casa tem abóbora, couve e pitaia; os dezesseis cenários anteriores continuam rodando; `cenariosDeConversa` continua com sete.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes passam.
- fora: `scripts/demo.ts` (T16).

### T16 · Show the approval block in the demo
- nivel: mecanica
- objetivo: fazer o `demo` imprimir o bloco com as linhas numeradas, a decisão e o que foi gravado, e ler a decisão do terminal com `--interativo`.
- arquivos: `scripts/demo.ts`, `scripts/lib/demo-report.ts`, `scripts/lib/demo-report.test.ts`, `scripts/lib/demo-resposta.ts`, `scripts/lib/demo-resposta.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `demo` lista e acha também os cenários de `cenariosComAprovacao`; roda com `rodarCenario`; com `--interativo`, `opts.decidir` lê uma linha do terminal; sem, usa `cenario.aprovacao`. Combina com `--llm` e `--esgotar`.
  - `scripts/lib/demo-resposta.ts` (puro):
  ```ts
  export function formatarBloco(propostas: PropostaNaSaida[]): string
  // "Posso anotar isto?", uma linha "  <n>. [x] <texto>" por proposta e "[Agora não] [Anotar]" (textos de textosDasPropostas)
  export function aprovadasDoTexto(propostas: PropostaNaSaida[], linha: string): string[]
  // Enter (linha vazia) anota tudo; números separados por vírgula desligam essas linhas; "n" (maiúscula ou minúscula) é "Agora não" ([]); número fora da faixa é ignorado
  ```
  - Relatório (`DadosDoRelatorio`): a seção "Posso anotar" das anotações (008) sai; entra, depois da resposta final, o bloco (`formatarBloco`) quando `saida.propostas` não é vazio; depois da decisão, `Decisão: Anotar <n> de <m>` ou `Decisão: Agora não`, e `Gravado:` com o texto de cada `gravadas` (ou `Gravado: nada`); quando alguma `casa.propor` foi gravada, `Minha casa:` com os itens de `pantry.listar` (nome e estado). Sem decisão (bloco aberto), só o bloco e `Bloco aberto`. Com `depois`, uma segunda seção com o relatório do segundo run, depois de uma linha `Depois: <mensagem>`.
- testes primeiro: `formatarBloco` com duas linhas; `aprovadasDoTexto` com Enter, `2`, `1, 3`, `n`, `N` e `9`; o relatório de um run com bloco e aprovação parcial tem o bloco, a decisão e o gravado; com "Agora não", `Gravado: nada`; sem propostas, nada do bloco; o de `vegetariana` tem a seção `Depois:`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; e rode `npm run demo -- --cenario <nome>` para os 19 cenários (os três novos e os dezesseis anteriores), sem rede, todos com código 0; rode `printf '2\n' | npm run demo -- --cenario aprovacao-parcial --interativo` com código 0.
- pronto quando: os testes passam, os 19 cenários rodam com código 0 e os quatro com aprovação imprimem o bloco, a decisão e o gravado.
- fora: `--llm` real (não rodar).

### T17 · Add the approval deterministic evals, part 1
- nivel: mecanica
- objetivo: escrever os evals de zero escrita, aprovação parcial e executor.
- arquivos: `evals/det/aprovacao/zero-escrita.eval.ts`, `evals/det/aprovacao/parcial.eval.ts`, `evals/det/aprovacao/executor.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: evals com o runtime roteirizado, `createMemoryStores`, `createFakeLlm`, `createFixedClock` e a **base real**, pelos cenários de `test/fixtures/cenarios` (`montarCenario`, `rodarCenario`, `cenariosComAprovacao`, `cenariosDeConversa`) ou montando as deps como nos evals de `evals/det/conversa/`. `aprovar` é `deps.conversation.aprovar(contaId, runId, ids)`. Cada eval:
  - `zero-escrita.eval.ts` (D15): para `aprovacao-parcial`, `faltou-hoje`, `vegetariana` e `casa-sozinha`, sem aprovar ("Agora não"), com expiração (relógio 31 min depois e `aprovar`) e com mensagem nova, `profiles.ler`, `pantry.listar`, `routine.notasAtivas` e `shortages.lista` ficam iguais aos do momento em que o bloco abriu; nos cenários sem pergunta, iguais também aos de antes da mensagem.
  - `parcial.eval.ts`: aprova uma de três (restrição, casa e rotina, por exemplo); "Agora não"; tudo desligado (lista vazia) é igual a "Agora não"; etapa `aprovacao` com `N de M`; `ritu_propostas_total` por linha.
  - `executor.eval.ts`: cada tipo grava o esperado (casa tem, casa acabou, evitar sempre, restrição, "não como", gosta, rotina, lista); registrar em casa apaga as faltas e tira da lista; conteúdo com remoção, campo a mais ou alimento fora da base não é executado (linha `recusada` e etapa `proposta_invalida` quando passa por `aprovar`).
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T18 · Add the approval deterministic evals, part 2
- nivel: mecanica
- objetivo: escrever os evals das tools de proposta, da expiração e da restrição no run.
- arquivos: `evals/det/aprovacao/tools-de-proposta.eval.ts`, `evals/det/aprovacao/expiracao.eval.ts`, `evals/det/aprovacao/restricao-no-run.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: mesmas ferramentas da T17. Cada eval:
  - `tools-de-proposta.eval.ts`: um caso por código de recusa (`com_incomodo` nas duas, `sem_fato`, `fato_com_incomodo`, `ja_anotado`, `fora_da_base`, `sem_nao_tenho`, `com_para_ter`, `fora_do_candidato`, `ja_na_lista`, `ja_recusado`, `filtrado`) e um aceito para cada tool; proposta e `finalizar` no mesmo passo: a proposta entra no bloco; `lista.propor` aceita seguida de resposta segura (entrega recusada até o limite): a proposta não entra no bloco; `memoria.propor` chamada duas vezes: uma linha; run com incômodo não aceita nenhuma das duas.
  - `expiracao.eval.ts`: 30 minutos vale, 31 expira (`aprovacao_expirada`, run `expired`, propostas `expirada`); expirada não entra em `recusadas`; recusada entra e bloqueia nova proposta de lista do mesmo alimento (`ja_recusado` num run seguinte) e a indicação de "vale ter em casa" dele; run expirado pela limpeza (`executarLimpeza`) → `RunNaoContinuavelError`.
  - `restricao-no-run.eval.ts`: com `restricoes_da_mensagem: ["vegetariana"]`, o preparo não devolve candidato com alimento que a restrição barra; o item fica no temporário do dia e continua filtrando numa segunda mensagem do mesmo dia sem aprovação; no dia seguinte, depois de `executarLimpeza`, deixa de filtrar; o mesmo para `nao_come_da_mensagem` (alimento da base) e, para nome livre, `evitar_textos`; aprovadas, ficam em `perfis.restricoes` e `perfis.nao_come` e filtram no dia seguinte; "Não como" respondido numa pergunta (009) também entra no temporário do dia.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T19 · Add the approval deterministic evals, part 3
- nivel: mecanica
- objetivo: escrever os evals do bloco, da autorização e da privacidade.
- arquivos: `evals/det/aprovacao/bloco.eval.ts`, `evals/det/aprovacao/autorizacao.eval.ts`, `evals/det/aprovacao/privacidade.eval.ts`, `evals/det/conversa/privacidade.eval.ts` (só para passar a cobrir também `cenariosComPausa` e `cenariosComAprovacao`)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: mesmas ferramentas da T17. Cada eval:
  - `bloco.eval.ts`: "comprei abóbora, couve e arroz" gera uma linha só, `Você tem abóbora, couve e arroz em casa`; a ordem com vários tipos (evitar sempre, restrição, não como, gosta, casa tem, casa acabou, lista, rotina); teto de 6 (8 anotações → 6 propostas criadas, as 2 últimas pela ordem não existem em `proposals.doRun`); nada duplicado (item já no perfil, alimento já na lista, fato igual a nota ativa não geram linha); os textos de cada tipo; run sem nada a propor termina em `done`; caminhos `casa` e `evitar` terminam em `waiting_for_approval`; run com pergunta e depois propostas passa por `waiting_for_input → running → waiting_for_approval`; a resposta (`saida.resposta`, sugestões) está gravada no run e devolvida antes de `aprovar`.
  - `autorizacao.eval.ts`: outra conta não aprova (`RunNaoContinuavelError`) nem lê as propostas (`proposals.doRun` vazio); aprovar duas vezes em seguida e ao mesmo tempo: só uma grava.
  - `privacidade.eval.ts`: os quatro cenários com aprovação (e a aprovação de cada um) não deixam nome de alimento da base, id de alimento, texto de nota, texto de linha do bloco nem texto da pessoa (a mensagem inteira e cada palavra com 5 letras ou mais) em atributo de span, rótulo de métrica, campo de log ou `resumo` de etapa; os `resumo` das etapas `proposta` e `aprovacao` só têm tipo e contagem.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T20 · Let eval:llm conversation cases measure proposals
- nivel: mecanica
- objetivo: dar ao runner do `eval:llm` as propostas do run e as recusas das tools de proposta, e acrescentar ao relatório a seção Propostas.
- arquivos: `evals/llm/casos/c2/tipos.ts`, `evals/llm/casos/c2/perguntas/expectativas.ts`, `scripts/lib/eval-llm-casos.ts`, `scripts/lib/eval-llm-casos.test.ts`, `scripts/lib/eval-llm-report.ts`, `scripts/lib/eval-llm-report.test.ts`, `scripts/eval-llm.ts`
- leitura: `QA.md` "Checkpoints" (só as regras da rodada)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha "Eval com rodadas, relatório e comparação"
- contratos:
  - O caso `conversa` ganha `proposta?: "esperada" | "nenhuma"`.
  - A expectativa passa a receber também `propostas: PropostaNaSaida[]` (`resposta.saida?.propostas ?? []`) e `propostasRecusadas: number` (etapas `tool` de nome `memoria.propor` ou `lista.propor` com `resumo` começando por `recusado:`). Conte em `contarEtapas` (`ContagemDasEtapas` ganha `propostasRecusadas`).
  - O runner **nunca** aprova (D18): o caso termina no bloco.
  - `terminou()` passa a aceitar `status` `done` ou `waiting_for_approval`.
  - Relatório, seção **Propostas** (só com casos `conversa` que têm `proposta`): "propostas corretas" (casos `esperada` com ao menos uma proposta e todos os `deve` ok; casos `nenhuma` sem nenhuma proposta; por caso e total) e "propostas recusadas pelo código por run" (média de `propostasRecusadas` nos casos `conversa`). Sem casos assim, a seção não aparece.
  - A lógica que não chama modelo fica em `scripts/lib/eval-llm-casos.ts` / `eval-llm-report.ts`, testável.
- testes primeiro: com um runtime roteirizado e o `createFakeLlm` no lugar do real, um caso `conversa` que termina no bloco: a expectativa vê `propostas` e `propostasRecusadas`; o runner não chama `aprovar` (o run fica `waiting_for_approval`); `terminou()` aceita os dois status; a seção Propostas com acerto por caso e total; sem casos com `proposta`, a seção não aparece; o relatório do `c1-base` e a seção Perguntas não mudam.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run eval:llm -- --checkpoint c2-conversa --listar` (sem rede, código 0). **Não** rode a rodada com modelo.
- pronto quando: os testes passam e `--listar` funciona sem chave.
- fora: os 6 casos (T21); rodada ⚠️.

### T21 · Add the 6 proposal cases of c2
- nivel: mecanica
- objetivo: escrever os 6 casos do tipo `conversa` da família Propostas.
- arquivos: `evals/llm/casos/c2/propostas/01-almoco-fora-propoe.ts` … `evals/llm/casos/c2/propostas/06-almoco-fora-nao-diz-que-anotou.ts` (um arquivo por caso, nome com número e assunto), `evals/llm/casos/c2/propostas/expectativas.ts`, `evals/llm/casos/c2/index.ts`, `scripts/lib/eval-llm-casos.test.ts` (só acrescentar o teste de contagem)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: tipo `conversa` da T20 (cenário com `mensagem` e `interpretacao`, base real, perfil e clima como os casos da família Perguntas). Expectativas reutilizáveis em `expectativas.ts` (por exemplo `chamouMemoriaPropor()` (`tools` do resultado inclui `memoria.propor`), `blocoComRotina()` (alguma proposta com `tool: "memoria.propor"` e texto igual ao fato com a primeira letra maiúscula), `nenhumaProposta()`, `listaNoMaximoUma()`, `listaSoDe(id)` (toda proposta `lista.propor` cita o nome do alimento), `nenhumaListaAceita()`, `blocoComRestricao(rotulo)`, `semAlimentoBarrado(restricao)` (nenhuma sugestão com alimento que `passaNoFiltro` reprova para a restrição), `naoDizQueAnotou()` (o texto de `saida.resposta`, normalizado, não contém `anotei`, `anotado`, `guardei`, `vou anotar`, `posso anotar`, `bloco` nem `aprovar`)). Casos:

  | # | Caso | Respostas | `proposta` | Esperado |
  |---|---|---|---|---|
  | 1 | "essa semana vou almoçar fora todo dia" (`fato_de_rotina` na interpretação) | — | `esperada` | `memoria.propor` chamada; bloco com a nota |
  | 2 | "hoje o dia foi corrido" (sem fato de rotina) | — | `nenhuma` | Nenhuma proposta |
  | 3 | Momento; a pessoa responde Não tenho para um item | Não tenho a tudo | — | No máximo uma `lista.propor`, e só desse item |
  | 4 | Momento sem pergunta, com item ausente entre os candidatos | — | `nenhuma` | Nenhuma `lista.propor` aceita |
  | 5 | "sou vegetariana, o que eu como agora?" | — | `esperada` | Nenhuma sugestão com o que a restrição barra; bloco com a linha da restrição |
  | 6 | Como o 1 | — | — | O texto da resposta não diz que anotou nem fala do bloco |

  Use `naoTenhoATudo` de `../perguntas/expectativas` no caso 3. Ids de alimentos e o vocabulário têm que existir na base; se algum não existir, pare e diga qual.
- testes primeiro: `casosC2` tem 34 casos (20 de Intenção + 8 de Perguntas + 6 de Propostas), ids únicos; os 6 novos são `tipo: "conversa"` com `mensagem`; `--listar` do `c2-conversa` mostra 12 + 34; cada expectativa de `expectativas.ts` tem um teste com um resultado pronto que passa e outro que falha.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run eval:llm -- --checkpoint c2-conversa --listar` (sem rede, código 0, 46 casos). **Não** rode a rodada com modelo.
- pronto quando: os testes passam e a listagem mostra os 46 casos.
- fora: rodada ⚠️ do `c2-conversa` (fechamento da 011).

## Fechamento

O que o orquestrador faz ao fechar a spec 010, depois da T21 aprovada:

1. **Verificação do repositório inteiro** pelo verificador: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run dup` (0 clones), `npm run build`; os 19 cenários de `npm run demo -- --cenario <nome>` com código 0; `printf '2\n' | npm run demo -- --cenario aprovacao-parcial --interativo` com código 0; `npm run eval:llm -- --checkpoint c2-conversa --listar` com 46 casos. ⚠️ `npm run test:db` com o Postgres no ar (T5 e T12 mexem em suítes de contrato: temporário do perfil e transações simultâneas); sem docker, anotar que não rodou.
2. **⚠️ `demo` com LLM** (a spec pede; RULES §6): `npm run demo -- --cenario aprovacao-parcial --llm --interativo`, rodado uma vez pelo orquestrador, decidindo no terminal (ou por pipe, `printf '2\n' | …`). Anotar no relatório da entrega: se o agente chamou `memoria.propor`, as linhas do bloco, a decisão, o que foi gravado, se a resposta não falou do bloco e os tokens.
3. **ADRs novas** (decisão de arquitetura nova = ADR nova; confira o próximo número em `.adrs/README.md`):
   - "Aprovação com bloco montado por código e executor fechado": propostas do código e das tools que só validam, uma linha por assunto, ordem e teto, texto montado na leitura, `Anotacao` no domínio `proposals` (D1), executor como tabela fechada que só acrescenta e recusa o que a base não conhece (D12), nada a propor com incômodo (D7).
   - "Fim do run da conversa e aprovação numa transação": o Acompanhante deixa o run aberto para a conversa fechar (D5), `pausarSemAgente` com aprovação (D6), mensagem gravada antes do bloco (D8), troca de status condicional como primeira operação da transação e recusa por concorrência fora dela (D10), expiração conferida em `aprovar` (D11).
   - "Temporário do dia com restrição e "não como"": `ItemTemporario` com `nao_come_texto` (D3) e a resposta "Não como" no temporário.
   - Atualizar `.adrs/README.md`.
4. **Docs** (só o que divergir do construído; sem "por enquanto" nem histórico):
   - `AI.md` §3 (dados do run no preparo e `ctx.run`, D4), §4 ("Escrita": códigos de recusa das duas tools, `finalizar` recolhe; `acompanhante.v4`), §5 (ordem e teto do bloco, aprovação parcial, "Agora não", expiração, concorrência, nada com incômodo, executor) e §6, se divergir.
   - `BUSINESS.md` §8 (item 7: textos das linhas), §9 ("Lista Para ter em casa": recusa vale para sempre, expirada não conta) e §11 (restrição e "não como" da conversa valem no dia, guardam com aprovação), se divergir.
   - `OBSERVABILITY.md` §3 (etapas `proposta` e `aprovacao` com `resumo` de tipo e contagem; `proposta_invalida`; evento `pausa` com `aprovacao`).
   - `ARCHITECTURE.md` §3 (fluxo: `aprovar` como a entrada da decisão; a rota é da 018), se divergir.
   - `QA.md` (lista `evals/det/aprovacao/`; família Propostas no `c2-conversa`, 12 + 34 casos, e as duas métricas novas).
   - `ROADMAP.md` §0 atualizado.
5. **`AGENTS.md`**, tabela de comandos: `npm run demo`: acrescentar que os cenários com aprovação imprimem o bloco com as linhas numeradas, a decisão e o que foi gravado, e que `--interativo` lê a decisão (Enter anota tudo; números separados por vírgula desligam linhas; `n` é "Agora não").
6. **Spec:** `status: implemented` com o hash do último commit; marcar os critérios de aceite; atualizar `.specs/README.md` se ele listar o status.
