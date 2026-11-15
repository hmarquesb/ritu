# Plano · Spec 009 · Pausas

Spec: `.specs/009-pausas.md`. Nível (seção "Nível das partes" da spec): `nucleo` para `ask_user`, `continuar`, a pausa de código em `conversar`, `companion.continuar`, o fim `pausa` em `responder`, `pausarSemAgente` e `gravarResposta` (e, por serem do serviço de runs e do loop, `mudarStatusSe` e o `resumo` da pausa, D3 e D4); `mecanica` para `config/pausas.ts`, schemas, textos, `montarPergunta`, `validarResposta`, `aplicarResposta`, `textoDaResposta`, `entregaveis`, `acompanhante.v3`, cenários, `demo` (pausa e `--interativo`), evals, runner e casos do `c2`. Não há parte `conteudo`: o prompt e os textos são copiados da spec, como estão neste plano.

Pré-condição: a spec 008 inteira commitada (T1 a T20 do `.plans/008-interprete-e-conversa-plan.md`), com os nomes que aquele plano define: `createConversation` / `conversar` em `src/core/conversation/conversar.ts`, `RespostaDaConversa`, `montarAnotacoes` em `src/core/agents/companion/anotacoes.ts`, `Cenario.mensagem` e `Cenario.interpretacao`, o `demo` chamando `conversar`, o runner do `eval:llm` com os tipos `acompanhante`, `interprete` e `conversa` (`scripts/lib/eval-llm-casos.ts`, `evals/llm/casos/c2/tipos.ts`, `evals/llm/checkpoints.ts`).

Ficam com o orquestrador, no fechamento: docs, `AGENTS.md`, `ROADMAP.md` §0, as ADRs, a marcação da spec e a inclusão destas tarefas em `.plans/entrega-2-estado.md` (status `pendente`). A rodada ⚠️ do `eval:llm -- --checkpoint c2-conversa` **não** acontece nesta spec: é no fechamento da 011.

## Regras comuns a todas as tarefas

- **Contratos:** estão copiados em cada tarefa. Nomes de tipos, campos, funções, textos e erros ficam **exatamente** como escritos, em português; o resto do código fica em inglês. O prompt e os textos fixos são copiados sem mudar uma vírgula. Quem recebe a tarefa não precisa abrir a spec.
- **Onde está o que já existe** (confira a assinatura real antes de usar; não redefina):
  - Runs: `Run`, `RunMutavel`, `StatusRun`, `STATUS_RUN`, `RunEtapa`, `NovaEtapa`, `TipoDeEtapa` (já tem `pergunta`), `RunRepository`: `@/core/runs/ports`. `Pendencia`, `ResultadoDeControle`, `ToolDeControle` (`name`, `description`, `input`, `tratar(input, ctx, estado: Checkpoint)`, `aoRetomar?(resposta, estado)`), `DefinicaoDoAgente`: `@/core/runs/agente`. `Checkpoint`, `checkpointSchema`, `pendenciaSchema`, `lerCheckpoint`: `@/core/runs/checkpoint`. `createRunService` (`iniciarRun` — já cancela o run em `waiting_for_input` da conta —, `executarRun`, `continuarRun`, `gravarEtapa`, `encerrar`, `comSpanDoRun`), `ResultadoDoRun`: `@/core/runs/run-service`. `EventoAoVivo`, `FimDoTrecho` (`entregue | pausa | limite | sem_modelo | erro`), `novoCheckpoint`, `retomarCheckpoint`: `@/core/runs/loop`. `processarChamadas`, `despachoDeControle`, `aplicarControle` (soma `entregas_recusadas` em toda recusa de controle; emite o evento `pausa` e `ritu_pausas_total{tipo}` na pausa): `@/core/runs/loop-passo`. `podeIr` (`running → waiting_for_input`, `waiting_for_input → running | expired | cancelled`): `@/core/runs/estados`. `RunAbertoError`, `RunNaoContinuavelError`: `@/core/runs/errors`.
  - Acompanhante: `EntradaDoAcompanhante`, `entradaDoAcompanhanteSchema`: `@/core/agents/companion/entrada`. `createCompanion`, `RespostaDoRun`: `@/core/agents/companion/responder`. `preparar`, `DadosDoPreparo`, `dadosDoPreparoSchema`, `entregaveisEmCasa`, `Candidato`: `@/core/agents/companion/preparo` (o tipo `Candidato` mora em `@/core/ranking/tipos`). `montarMensagemInicial`: `@/core/agents/companion/contexto`. `Anotacao` (já tem `{ tipo: "nao_come"; itens: { alimento_id?: string; nome: string }[] }`), `anotacaoSchema`, `SaidaDoAcompanhante`, `saidaSegura`, `saidaDeCodigo`: `@/core/agents/companion/saida`. `montarAnotacoes(i, perfil, extra: { kb; preferencias })`: `@/core/agents/companion/anotacoes`. `validarEntrega`, `CodigoDeViolacao`: `@/core/agents/companion/validador`. `criarAcompanhante`: `@/core/agents/companion/agente`. `finalizar`: `@/core/agents/tools/finalizar`. `acompanhanteV2`: `@/core/agents/prompts/acompanhante.v2`.
  - Conversa: `createConversation`, `RespostaDaConversa`, `MensagemRecebida`: `@/core/conversation/conversar`.
  - Tools: `ToolContext` (`kb`, `filtro`, `sinais`, `contaId`, `stores: Pick<Stores, "pantry" | "preferences" | "runs" | "outcomes">`, `clock`, `telemetry`, `casaDaMensagem?`): `@/core/tools/tool`.
  - Base: `KnowledgeBase` (`alimento(id)`, `preparo(id)`, `incomodos`): `@/core/knowledge/knowledge-base`. `qualidadesDoMomento({ estados, incomodo?, gunasDoClima? }, kb)`, `MomentoQualidades` (com `precisa_variante?: { incomodo: string; pergunta: string; opcoes: { id: string; texto: string }[] }`): `@/core/knowledge/momento`. `passaNoFiltro(alvo, filtro, kb).passa`, `FiltroPessoa`: `@/core/knowledge/filtros`. `juntarNomes(nomes)` (põe em minúsculas e liga "a", "a e b", "a, b e c"): `@/core/knowledge/lacunas`.
  - Memória: `Stores`, `Transactor` (`emTransacao(fn)`): `@/core/stores`. `PantryStore` (`listar`, `registrar(contaId, itens: { alimento_id?, nome_livre? }[], origem: "conversa" | "tela" | "pergunta")` — apaga as faltas do alimento e o tira da lista —, `marcarAcabou(contaId, itens)`): `@/core/pantry/ports`; `ItemDaCasa` (`alimento_id`, `estado: "tem" | "acabou"`): `@/core/pantry/types`. `PreferenceStore` (`ler(contaId)`, `definirGosto(contaId, { tipo: "alimento", id }, "nao_gosta")`), `Preferencia` (`item_id`, `gosto`, `ajudou`): `@/core/preferences/ports`. `ShortageStore.registrar(contaId, [{ alimento_id, origem: "nao_tenho", run_id }], dia)`: `@/core/shortages/ports`. `MessageRepository` (`gravar(contaId, { run_id, autor, texto, com_incomodo, dia })`, `doDia`, `marcarIncomodoDoRun`): `@/core/messages/ports`. `executarLimpeza`: `@/core/cleanup`. `diaLocal`: `@/core/time/dia-local`.
  - Configuração: `config` (`config.memoria.esperaMinutos` = 30): `@config/index`.
  - Telemetria: `Telemetry`: `@/core/telemetry/ports`. Nomes fechados em `@/core/telemetry/nomes` (já tem `ritu_pausas_total`, `ritu_gosto_total`, `ritu_faltas_total`, o evento `pausa` e os atributos `pausa.tipo`, `origem`, `gosto`, `tipo`). `createMemoryTelemetry` (`spans`, `metricas`, `eventos`, `logs`; falha com atributo fora da lista): `@/infra/fakes/memory-telemetry`.
  - Testes: `createFixedClock` (`now`, `advance`, `set`): `@/infra/fakes/fixed-clock`. `createScriptedRuntime(roteiro)` (cada passo consome o próximo item; `pedidos` registra os pedidos), `PassoRoteirizado`: `@/infra/fakes/scripted-runtime`. `createMemoryStores`: `@/infra/fakes/memory-stores`. `createFakeLlm`: `@/infra/fakes/fake-llm`. Mini-base: `@/infra/fakes/mini-knowledge`. Base real: `getContainer().knowledge` ou `readKnowledgeData` de `@/infra/container`, como nos evals de `evals/det/base/`. Cenários: `cenarios`, `montarCenario`: `test/fixtures/cenarios`.
  - `RituError(code, message)`: `@/core/errors`. `Clock`: `@/core/clock`.
- **Camadas:** `src/core/` só importa `src/core/`, `@config/*` e `zod`. Scripts e evals só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (R6). No core, sem `new Date()` sem argumento nem `Date.now()` (R8). **Sem ciclo entre domínios do core (R9):** `agents` e `conversation` importam `runs`; por isso nada em `src/core/runs/` importa `src/core/agents/` nem `src/core/conversation/` (D1). `runs` pode importar `knowledge`.
- **Privacidade:** nenhum texto da pessoa, texto da pergunta ou da resposta, nome ou id de alimento, nome ou id de incômodo ou de variante vai para span, métrica, log ou `resumo` de etapa. O `resumo` da etapa `pergunta` é só `casa: N itens`, `come` ou `variante`. A entrada do Acompanhante dentro de `runs.pendencia` é banco, não telemetria: é permitido.
- **Testes:** os padrão rodam sem rede, banco nem chave. Nenhum teste nem eval chama a Gemini.
- **Qualidade:** complexidade cognitiva ≤ 15 por função, `npm run dup` com 0 clones e Biome. Rode `./node_modules/.bin/biome check --write <arquivos>`. O `npm run lint` pelo wrapper rtk dá falso erro ("JSON parse failed"): rode sempre `rtk bypass npm run lint`.
- **Montadores de texto:** troque `{itens}` e `{item}` com função de troca (`texto.replace("{itens}", () => valor)`), nunca com string de troca.
- **Limites:**
  - Não leia `.env.local` (nem com `cat`, `grep` ou `source`) e não abra pastas fora do repositório.
  - Arquivos temporários só no scratchpad, nunca em `/tmp` nem em `$TMPDIR`.
  - Arquivo fora da lista da tarefa: pare e diga qual. Exceção explícita só onde a tarefa disser.
  - Não toque em `.specs/`, `.docs/`, `AGENTS.md` nem `design/`.
  - Não commite.

## Decisões do planejamento

Lacunas e contradições encontradas na spec, com a opção mais conservadora. Cada uma diz como desfazer.

- **D1 · Onde mora o que cruza domínios.** Faltava: a spec põe em `src/core/runs/pergunta.ts` o `ConteudoDaPendencia` (que contém `EntradaDoAcompanhante`) e `aplicarResposta(dados: DadosDoPreparo, …)` (que roda `entregaveis`, do Acompanhante); com `agents` importando `runs`, isso fecharia ciclo (R9). Decidido: `src/core/runs/pergunta.ts` guarda só `RespostaDeCasa`, `Pergunta`, `RespostaDaPessoa`, `RetomadaDaPergunta` (D6), os schemas, `validarResposta`, `montarPergunta`, `perguntaDaVariante` e `textoDaResposta` (dependem só de `knowledge`); `ConteudoDaPendencia`, `conteudoDaPendenciaSchema`, `aplicarResposta` e `candidatosRetirados` moram em `src/core/agents/companion/pergunta-do-run.ts`. Os nomes e as assinaturas vistos de fora ficam os da spec. Desfazer: mover se a regra R9 mudar.
- **D2 · `aplicarResposta` precisa da base.** Faltava: ela roda `entregaveis` de novo, que precisa de `kb` para ler as vagas do preparo. Decidido: `aplicarResposta(dados, pergunta, resposta, kb)`. Na nova rodada de `entregaveis`, `acabou` = os ids de `dados.perguntas.alimentos` que não estão em `casa.confirmados` nem em `casa.incertos` (inclui o "Não tenho" e o "Não gosto" desta resposta e de perguntas anteriores; o que já foi perguntado e não foi confirmado não segura refeição, porque `ja_perguntado` impede perguntar de novo). Desfazer: usar só o "Não tenho" desta resposta como `acabou`.
- **D3 · `mudarStatusSe` entra nesta spec.** Faltava: a spec manda usar `runs.mudarStatusSe` "(010)", mas a 010 ainda não foi construída. Decidido: `RunRepository.mudarStatusSe(contaId, runId, de: StatusRun, para: StatusRun): Promise<boolean>` entra aqui, nos dois adaptadores e na suíte de contrato, com o contrato da 010 (troca numa operação só, `update … where status = de`, devolve se trocou). `continuarRun` passa a usá-la. A 010 só a reutiliza. Desfazer: nenhum (a 010 precisa dela).
- **D4 · `resumo` da etapa `pergunta` do agente.** Faltava: o loop grava a etapa `pergunta` de uma pausa com `nome` = nome da tool e sem `resumo`; a spec pede `resumo` `casa: 2 itens` ou `come`. Decidido: o membro `pausar` de `ResultadoDeControle` ganha `resumo?: string` (até 80 caracteres), e `despachoDeControle` o passa para a etapa. A etapa do agente fica com `nome: "ask_user"`; a da pausa de código, com `nome: "variante"`. Desfazer: tirar o campo e deixar a etapa sem resumo.
- **D5 · Ordem do `continuar`.** Contradição: o passo 1 da spec tira o run de `waiting_for_input` antes de validar, mas o critério "resposta que não combina" e o edge case "falha em `gravarResposta`" exigem que o run continue em `waiting_for_input`. Decidido: (1) busca e confere status e conta; (2) expiração; (3) `validarResposta`, sem escrever nada; (4) `mudarStatusSe(waiting_for_input → running)` — só uma de duas chamadas simultâneas segue; (5) `gravarResposta`; se falhar, `mudarStatusSe(running → waiting_for_input)` e o erro sobe; (6) o resto. `gravarResposta` continua rodando só depois da troca de estado (nunca grava duas vezes). Desfazer: trocar o status no passo 1 e voltá-lo nos erros dos passos 3 e 5.
- **D6 · Como `aoRetomar` recebe a pergunta e os candidatos retirados.** Faltava: `aoRetomar(resposta, estado)` não tem a pergunta (que está em `runs.pendencia`) nem a base, e o resultado da tool precisa dos nomes e de `candidatos_retirados`. Decidido: o que `continuarRun` repassa a `aoRetomar` é `RetomadaDaPergunta = { pergunta: Pergunta; resposta: RespostaDaPessoa; candidatos_retirados: string[] }`. No tipo `casa`, o resultado sempre traz `candidatos_retirados` (lista vazia quando nada saiu). Desfazer: guardar a pergunta no checkpoint.
- **D7 · `continuarRun` com o run já reservado e os dados atualizados.** Faltava: hoje `continuarRun` troca o status e lê o checkpoint do run; o `continuar` precisa trocar o status antes de gravar e atualizar `checkpoint.dados` antes de retomar. Decidido: `continuarRun` ganha `reservado?: true` (o run já foi levado a `running` por `mudarStatusSe`; sem a opção, ele mesmo usa `mudarStatusSe` e lança `RunNaoContinuavelError` se não trocou). `companion.continuar` grava `checkpoint: { ...cp, dados: novos }` com `stores.runs.atualizar` antes de chamar `continuarRun`. Desfazer: passar os dados novos por parâmetro.
- **D8 · Anotações de um run que pausou.** Faltava: as anotações saem da `Interpretacao`, que não é gravada no run (008); depois de uma pausa, `continuar` não teria como montá-las. Decidido: `ConteudoDaPendencia` ganha `anotacoes?: Anotacao[]`; `conversar` as calcula antes de devolver a pausa (pausa de código: já no `pausarSemAgente`; pausa do agente: acrescenta ao `runs.pendencia` com `stores.runs.atualizar`), e uma nova pausa durante o `continuar` as carrega adiante. Na saída final, `continuar` usa essas anotações mais o `nao_come` do run (`acrescentarNaoCome`). `montarAnotacoes` ganha `extra.nao_come_do_run?: string[]`, como a spec pede. Desfazer: gravar a `Interpretacao` no run.
- **D9 · Totais do run depois da retomada.** Faltava: `fecharTrecho` grava `tokens_entrada`/`tokens_saida` = os do checkpoint (só o loop), e `responder` grava `modelos: { decisao }`; numa retomada isso apagaria os tokens e o `modelos.apoio` do Intérprete somados na 008. Decidido: `companion.continuar` grava `modelos` preservando as outras chaves e unindo `decisao`, soma `trocas_de_modelo` ao valor do run e mantém `clima_usado` anterior quando o trecho novo não chamou `clima.agora`; ao fim, `continuar` soma de novo ao run os tokens da etapa `interprete` do run (quando houver) e garante `modelos.apoio = [modelo dela]`. Na pausa, `conversar` faz o passo 8 da 008 (soma do Intérprete) antes de devolver. Desfazer: guardar os totais do Intérprete em campo próprio.
- **D10 · `candidatos_completos`.** Faltava: o tipo. Decidido: `candidatos_completos: string[]`, os ids da lista completa de candidatos (antes de `entregaveis`), na ordem; `faltas_do_run` e `para_ter` continuam calculados no `preparar` sobre os candidatos completos, como hoje. A lista inteira não vai ao checkpoint para não inchá-lo. Desfazer: guardar os objetos `Candidato`.
- **D11 · Campos novos de `DadosDoPreparo` com padrão.** Decidido: `perguntas` e `nao_come_do_run` (e `candidatos_completos`) entram no schema com `.default(...)`, para que checkpoints e fixtures antigos continuem válidos; no tipo (saída do zod) são obrigatórios. As fixtures de teste que montam `DadosDoPreparo` à mão ganham os campos. Desfazer: tornar opcionais.
- **D12 · `casa.ler` na retomada.** Faltava: `ToolContext.casaDaMensagem` (ids) não fica no checkpoint (`dados.casa_da_mensagem` guarda nomes). Decidido: `companion.continuar` monta o contexto com `casaDaMensagem: { tem: novos.casa.confirmados, acabou: [] }`, de modo que `casa.ler` depois da resposta concorda com o que o validador usa; o "Não tenho" já está gravado em Minha casa. Desfazer: guardar os ids de `casa_da_mensagem` em `dados`.
- **D13 · Telemetria da pausa de código.** Decidido: `pausarSemAgente` emite o evento `pausa` (`pausa.tipo: "pergunta"`) e soma `ritu_pausas_total{tipo: "pergunta"}`, como `aplicarControle` faz para a pausa do agente; `conversar` grava a etapa `pergunta` (`nome: "variante"`, `resumo: "variante"`). O run da pausa de código ganha `com_incomodo: true` na hora da pausa. Desfazer: emitir em `conversar`.
- **D14 · `RespostaDoRun.saida` opcional.** Decidido: como `RespostaDaConversa`, `RespostaDoRun` passa a ter `saida?` e `pergunta?`; os consumidores (evals, testes, `demo`, runner) passam a conferir `saida` antes de usar. Desfazer: tipo discriminado por `status`.
- **D15 · Recusa de `ask_user` sem `alimentos`.** Decidido: `alimentos` não vem nos códigos `limite_de_perguntas` e `muitos_itens`; nos outros, lista os ids que causaram a recusa, na ordem do pedido. Os códigos valem para os dois tipos (`casa` e `come`), na ordem da tabela. Desfazer: mandar sempre a lista.
- **D16 · Nomes no texto da resposta.** Decidido: em `textoDaResposta`, cada grupo junta os nomes com `juntarNomes` ("Tenho: abóbora e couve · Não tenho: ovo"); grupos vazios não aparecem; a ordem é Tenho, Não tenho, Não gosto. `itens[].nome` guarda o nome da base como está ("Abóbora"); só o texto da pergunta e o da resposta vão em minúsculas. Desfazer: um item por grupo.
- **D17 · Respostas que acabam no `demo` e no runner.** Decidido: pausa sem resposta sobrando na fixture (ou no caso do `eval:llm`) é respondida com `{ tipo: "pular" }`, no máximo 3 retomadas por run. Desfazer: falhar o cenário.
- **D18 · Rodada ⚠️ com `--interativo`.** Decidido: o orquestrador roda `npm run demo -- --cenario casa-incerta --llm --interativo` uma vez, com as respostas digitadas (ou passadas por pipe, `printf 't\nn\n' | …`), e anota no relatório. Desfazer: nenhum.

## Notas de construção (o que mudou depois do plano; vale para todas as tarefas)

- `citadoNoPerfilDoNaoCome` e `itemNoPerfilDoEvitar` moram em `src/core/accounts/no-perfil.ts`.
- T2: textos exportados `TEXTOS_DA_PERGUNTA` e `ROTULOS_DA_RESPOSTA` em `src/core/runs/pergunta-textos.ts`.
- T4/T5: `DadosDoPreparo` tem `perguntas`, `nao_come_do_run`, `candidatos_completos` e `acabou` (default `[]`, fora do prompt; Minha casa `acabou` ∪ `casa_da_mensagem.acabou`). `aplicarResposta` usa `dados.acabou` ∪ o `acabou` do D2 e acrescenta a `perguntas.alimentos` os ids respondidos numa resposta de casa.
- T5: `montarAnotacoes` não devolve nada com `alerta` ou `suspeito`, nem o "não como" do run.
- T7: `ask_user` recusa `acabou` por `dados.acabou` ∪ Minha casa `acabou`.
- T9: `RespostaDoRun.saida` é opcional (ausente na pausa); o fim do run mora em `src/core/agents/companion/fim-do-run.ts`; `companion.continuar` existe. Em `src/core/conversation/conversar.ts` há um helper provisório `saidaDoRun` que lança `RituError("run_pausado")` sem saída: a T10 trata a pausa antes dele (remova-o ou deixe só como guarda).
- T10: `RespostaDaConversa.saida` é opcional; pausa de código em `src/core/conversation/pausa-de-codigo.ts`. Nota: em `conversar.ts`, `com_incomodo` da mensagem do agente na pausa usa `pergunta.tipo === "variante"`.
- T11: `conversation.continuar` existe (`src/core/conversation/continuar.ts`); os totais do run na retomada são a soma dos tokens das etapas (`fixarTotais`). A variante conta como 1ª pergunta.
- T12: os quatro cenários de pausa ficam em `cenariosComPausa` (`test/fixtures/cenarios/index.ts`), separados de `cenariosDeConversa` (que `montar.test.ts` trava em sete); `rodarCenario` responde às pausas. `scripts/demo.ts` e os evals das T14–T16 precisam importar `cenariosComPausa`; `evals/det/conversa/privacidade.eval.ts` deve passar a cobri-los (a T14–T16 que tocar privacidade, ou o fechamento).
- Pendente para o fechamento: avaliar idempotência de `gravarResposta` num retry depois de falha ao gravar a mensagem da pessoa (casa/gosto já gravados); teste direto do ramo `pausa_invalida` de `fim-do-run.ts`.
- Ambiente: rtk em `/opt/homebrew/bin`; node em `/Users/helena.batista/.nvm/versions/node/v24.22.2/bin`; sem docker (não há `test:db`).

## Tarefas

### T1 · Add the pauses config
- nivel: mecanica
- objetivo: criar `config/pausas.ts` e expô-lo em `config`.
- arquivos: `config/pausas.ts`, `config/index.ts`, `config/index.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // config/pausas.ts
  export const pausas = { maxPerguntasPorRun: 2, maxItensPorPergunta: 5, maxRefeicoesAPerguntar: 2 } as const
  ```
  `config/index.ts` importa e põe `pausas` no objeto `config` (depois de `memoria`). O prazo de espera continua em `config.memoria.esperaMinutos` (30); não duplicar.
- testes primeiro: `config.pausas` tem os três valores; `config.memoria.esperaMinutos` é 30.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: qualquer uso do valor.

### T2 · Add the question and answer types, texts and builders
- nivel: mecanica
- objetivo: criar os tipos e schemas da pergunta e da resposta, os textos fixos e as funções puras que montam a pergunta, validam a resposta e escrevem o texto da resposta.
- arquivos: `src/core/runs/pergunta-textos.ts`, `src/core/runs/pergunta.ts`, `src/core/runs/pergunta.test.ts`
- leitura: `AI.md` §7 (só a tabela)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  - `src/core/runs/pergunta-textos.ts`:

  | Chave | Texto |
  |---|---|
  | `casaAindaTem` | `Ainda tem {itens}?` |
  | `casaVoceTem` | `Você tem {itens} em casa?` |
  | `come` | `Você come {item}?` |

  Rótulos: `{ tenho: "Tenho", nao_tenho: "Não tenho", nao_gosto: "Não gosto", como: "Como", nao_como: "Não como", pular: "Pular" }`.
  - `src/core/runs/pergunta.ts` (só importa `knowledge`, `zod` e os textos; **não** importa `agents`, D1):
  ```ts
  export type RespostaDeCasa = "tenho" | "nao_tenho" | "nao_gosto"
  export type Pergunta =
    | { tipo: "casa"; texto: string; itens: { alimento_id: string; nome: string }[] }
    | { tipo: "come"; texto: string; alimento_id: string; nome: string }
    | { tipo: "variante"; texto: string; incomodo: string; opcoes: { id: string; texto: string }[] }
  export type RespostaDaPessoa =
    | { tipo: "casa"; itens: { alimento_id: string; resposta: RespostaDeCasa }[] }     // item ausente da lista: pulou
    | { tipo: "come"; resposta: "como" | "nao_como" }
    | { tipo: "variante"; variante: string }
    | { tipo: "pular" }
  export type RetomadaDaPergunta = { pergunta: Pergunta; resposta: RespostaDaPessoa; candidatos_retirados: string[] }  // D6
  export const perguntaSchema, respostaDaPessoaSchema   // zod, discriminados por tipo
  export function validarResposta(pergunta: Pergunta, resposta: RespostaDaPessoa): boolean
  export function montarPergunta(p: { tipo: "casa"; alimentos: string[]; incertos: string[] } | { tipo: "come"; alimento: string }, kb: KnowledgeBase): Pergunta
  export function perguntaDaVariante(precisa: NonNullable<MomentoQualidades["precisa_variante"]>): Pergunta
  export function textoDaResposta(pergunta: Pergunta, resposta: RespostaDaPessoa): string
  ```
  - `validarResposta`: `pular` vale para qualquer pergunta; fora isso, o tipo tem que ser o mesmo da pergunta, os `alimento_id` da resposta de casa têm que estar na pergunta, sem repetir, e a `variante` tem que estar nas `opcoes`.
  - `montarPergunta` casa: `itens` na ordem de `alimentos`, com `nome` da base como está (`kb.alimento(id).nome`, D16); texto `casaAindaTem` quando **todos** os alimentos estão em `incertos`; com algum fora de `incertos` (nunca registrado), `casaVoceTem`. `{itens}` = `juntarNomes(nomes)` (minúsculas; "a", "a e b", "a, b e c"). come: `Você come {item}?` com o nome em minúsculas. Id fora da base: lança `RituError("fora_da_base", …)` (quem chama já validou).
  - `perguntaDaVariante`: `{ tipo: "variante", texto: precisa.pergunta, incomodo: precisa.incomodo, opcoes: precisa.opcoes }`.
  - `textoDaResposta`: casa: `"Tenho: abóbora · Não tenho: couve · Não gosto: ovo"` — grupos na ordem Tenho, Não tenho, Não gosto, separados por `" · "`, nomes de cada grupo com `juntarNomes`, grupos vazios fora (D16); só pulados (lista vazia): `"Pular"`. come: `"Como"` ou `"Não como"`. variante: o `texto` da opção escolhida. pular: `"Pular"`.
- testes primeiro: schemas aceitam e recusam cada tipo; `validarResposta` aceita `pular` para os três tipos, recusa tipo trocado, alimento fora da pergunta, alimento repetido e variante inexistente; `montarPergunta` com dois incertos dá "Ainda tem abóbora e couve?" e com um nunca registrado dá "Você tem abóbora e couve em casa?"; três itens dão "a, b e c"; `come` dá "Você come ovo?"; `perguntaDaVariante` copia pergunta e opções; `textoDaResposta` nos casos acima, inclusive casa só com pulados → "Pular" e dois itens no mesmo grupo; um nome com `$&` não é reinterpretado.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e o teste de arquitetura continua verde.
- fora: `ConteudoDaPendencia` e `aplicarResposta` (T5); `ask_user` (T7).

### T3 · Add the conditional status change, the code pause and the pause summary to runs
- nivel: nucleo
- objetivo: dar ao repositório de runs a troca de status condicional, fazer `continuarRun` usá-la (com a opção de run já reservado), criar `pausarSemAgente` e deixar a pausa de controle levar um `resumo` para a etapa.
- arquivos: `src/core/runs/ports.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/db/runs.ts`, `test/contracts/runs.contract.ts`, `src/core/runs/run-service.ts`, `src/core/runs/run-service.test.ts`, `src/core/runs/agente.ts`, `src/core/runs/loop-passo.ts`, `src/core/runs/loop.test.ts`
- leitura: `AI.md` §7, último parágrafo ("Pausa: …"); `OBSERVABILITY.md` §3, a linha `pausa` da árvore
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linhas "Loop de execução com rastro" e "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  - `RunRepository` ganha (D3):
  ```ts
  /** Troca o status numa operação só (update … where status = de); devolve se trocou. */
  mudarStatusSe(contaId: string, runId: string, de: StatusRun, para: StatusRun): Promise<boolean>
  ```
  Postgres: `update runs set status = $para, atualizado_em = now() where id = $runId and conta_id = $contaId and status = $de returning id`. Memória: o mesmo, atômico. Outra conta: `false`, nada muda.
  - `ResultadoDeControle` (D4): `| { tipo: "pausar"; pendencia: Omit<Pendencia, "criada_em" | "chamada_id">; resumo?: string }`; `despachoDeControle` passa `r.resumo` (cortado em 80) como `resumo` da etapa `pergunta`/`proposta`.
  - `continuarRun(contaId, runId, p: Execucao & { resposta: unknown; reservado?: true })` (D7): sem `reservado`, troca com `stores.runs.mudarStatusSe(contaId, runId, "waiting_for_input", "running")` e, se devolver `false` (ou o run não existir), `RunNaoContinuavelError`; com `reservado`, exige o run em `running` (senão `RunNaoContinuavelError`) e não troca nada. O resto não muda (lê checkpoint e pendência do run buscado **depois** da troca, chama `aoRetomar` da tool da pendência com `p.resposta`).
  - Serviço de runs ganha (D13):
  ```ts
  pausarSemAgente(contaId: string, runId: string, pendencia: Omit<Pendencia, "criada_em" | "chamada_id">): Promise<Run>
  ```
  Exige o run em `running` (transição pela regra de `podeIr`); grava `status: "waiting_for_input"`, `pendencia: { ...pendencia, criada_em: clock.now().toISOString() }`, `checkpoint: null`; emite `telemetry.evento("pausa", { "pausa.tipo": pendencia.tipo })` e `telemetry.contador("ritu_pausas_total", { tipo: pendencia.tipo })`; devolve o run atualizado.
- testes primeiro: contrato (rodando no fake em `npm test`): `mudarStatusSe` troca quando o status bate e devolve `true`; com status diferente devolve `false` e não muda; de outra conta devolve `false`; duas chamadas seguidas `waiting_for_input → running`: só a primeira devolve `true`. Loop: a pausa com `resumo: "casa: 2 itens"` grava a etapa `pergunta` com esse `resumo`; sem `resumo`, `null` como hoje. Serviço: `continuarRun` em run `waiting_for_input` funciona como antes; em `running` sem `reservado` lança `RunNaoContinuavelError`; com `reservado` em `running` retoma do checkpoint sem repetir passo do roteiro; com `reservado` em `waiting_for_input` lança; `pausarSemAgente` deixa o run em `waiting_for_input` com `pendencia.criada_em` do relógio, sem checkpoint, um evento `pausa` e `ritu_pausas_total` somando 1; em run `done` lança.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`; ⚠️ `npm run test:db` se o Postgres estiver no ar (anote se não estiver).
- pronto quando: os testes e os evals passam (os de `evals/det/loop/` continuam verdes).
- fora: `ask_user`, `continuar` da conversa.

### T4 · Let meals with an askable ingredient reach the model
- nivel: mecanica
- objetivo: trocar `entregaveisEmCasa` por `entregaveis`, acrescentar a `DadosDoPreparo` as perguntas do run, o "não como" do run e os ids dos candidatos completos, marcar `depende_de_pergunta` no contexto do modelo e mudar a mensagem de `fora_de_casa` do validador.
- arquivos: `src/core/ranking/tipos.ts`, `src/core/agents/companion/preparo.ts`, `src/core/agents/companion/preparo.test.ts`, `src/core/agents/companion/contexto.ts`, `src/core/agents/companion/contexto.test.ts`, `src/core/agents/companion/validador.ts`, `src/core/agents/companion/validador.test.ts`, `src/core/agents/tools/finalizar.test.ts`, `src/core/agents/companion/saida.test.ts`, `evals/det/acompanhante/faltas.eval.ts`, `evals/det/acompanhante/validador.eval.ts`, `evals/det/acompanhante/evitar-sempre.eval.ts`, `evals/det/acompanhante/preparo.eval.ts`. Exceção: outra fixture de teste ou eval que monte `DadosDoPreparo` à mão e quebre no typecheck pode ganhar os campos novos (diga quais).
- leitura: `AI.md` §3, só "Preparo (código, antes do loop)"; `BUSINESS.md` §9 "Minha casa" (só a tabela de estados)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `Candidato` (em `src/core/ranking/tipos.ts`) e `candidatoSchema` ganham `depende_de_pergunta?: boolean`.
  - `dadosDoPreparoSchema` ganha (D10, D11):
  ```ts
  perguntas: z.object({ feitas: z.number().int().nonnegative(), alimentos: z.array(z.string()) }).default({ feitas: 0, alimentos: [] })
  nao_come_do_run: z.array(z.string()).default([])        // ids respondidos com "Não como"
  candidatos_completos: z.array(z.string()).default([])   // ids da lista completa, antes de entregaveis
  ```
  - Substitui `entregaveisEmCasa`:
  ```ts
  // src/core/agents/companion/preparo.ts
  export function entregaveis(candidatos: Candidato[], p: { casa: Casa; acabou: string[]; perguntasRestantes: number }, kb: KnowledgeBase): Candidato[]
  ```
  - Um alimento é **perguntável** quando não está em `casa.confirmados` nem em `casa.incertos`, não está em `acabou` e `perguntasRestantes > 0`.
  - Chá, óleo e prática passam sempre (como hoje). A refeição fica quando cada vaga obrigatória tem ao menos uma opção confirmada, incerta ou perguntável.
  - A refeição que só fica por causa de opção perguntável (alguma vaga obrigatória sem opção confirmada ou incerta) sai com `depende_de_pergunta: true`; as outras saem **sem** o campo (o valor anterior é descartado, para a função poder rodar de novo). Ficam as `config.pausas.maxRefeicoesAPerguntar` (2) primeiras com `depende_de_pergunta`, pela ordem; as outras com o campo saem.
  - `preparar(deps, contaId, entrada, opts?: { runId?: string; perguntasFeitas?: number })`: lê de Minha casa também os ids com `estado: "acabou"` (`acabou`); `perguntasRestantes = config.pausas.maxPerguntasPorRun − (opts.perguntasFeitas ?? 0)`; `candidatos = cortarParaOContexto(entregaveis(todos, { casa, acabou, perguntasRestantes }, kb))`; `candidatos_completos = todos.map(c => c.id)`; `perguntas = { feitas: opts.perguntasFeitas ?? 0, alimentos: [] }`; `nao_come_do_run = []`. `faltas_do_run` e `para_ter` continuam calculados sobre `todos`.
  - `montarMensagemInicial`: o candidato com `depende_de_pergunta` leva `depende_de_pergunta: true` no contexto (sem o campo quando falso). `candidatos_completos`, `perguntas` e `nao_come_do_run` **não** vão ao contexto.
  - Validador, `fora_de_casa` por ingrediente ausente: se o candidato do item (`preparo_id` em `dados.candidatos`) tem `depende_de_pergunta` e `dados.perguntas.feitas < config.pausas.maxPerguntasPorRun`, a mensagem é `"pergunte antes com ask_user (tipo casa) ou use outro candidato"`; com `depende_de_pergunta` e sem pergunta disponível, `"use outro candidato"`; sem `depende_de_pergunta`, a mensagem de hoje.
- testes primeiro: `entregaveis` com casa vazia e 2 perguntas restantes deixa no máximo 2 refeições, todas com `depende_de_pergunta`; com 0 perguntas restantes, nenhuma refeição perguntável; item em `acabou` não segura refeição; refeição com opção confirmada não leva o campo; rodar duas vezes dá o mesmo resultado; chá, óleo e prática não mudam; `preparar` com `perguntasFeitas: 1` grava `perguntas.feitas: 1` e só uma pergunta restante; `faltas_do_run` continua contando os alimentos da lista completa; `candidatos_completos` traz os ids de antes do filtro; o contexto mostra `depende_de_pergunta`; as duas mensagens novas do validador. Ajuste os testes e evals existentes que esperavam a refeição fora (ex.: `faltas.eval.ts`, "refeição com vaga obrigatória só ausente de casa"): com perguntas disponíveis ela agora fica com `depende_de_pergunta`; mantenha a asserção das faltas.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam e os cinco cenários da 007 continuam passando em `test/fixtures/cenarios/cenarios.test.ts`.
- fora: `ask_user` (T7); `aplicarResposta` (T5).

### T5 · Add aplicarResposta, the pending content and the "não como" note
- nivel: mecanica
- objetivo: criar o conteúdo da pendência de pergunta, a função que aplica a resposta aos dados do run e a anotação `nao_come` vinda do run.
- arquivos: `src/core/agents/companion/pergunta-do-run.ts`, `src/core/agents/companion/pergunta-do-run.test.ts`, `src/core/agents/companion/anotacoes.ts`, `src/core/agents/companion/anotacoes.test.ts`
- leitura: `BUSINESS.md` §9 "O que fez falta" (só a tabela)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/core/agents/companion/pergunta-do-run.ts (D1, D8)
  export type ConteudoDaPendencia =                 // Pendencia.conteudo, com tipo "pergunta"
    | { origem: "agente"; pergunta: Pergunta; anotacoes?: Anotacao[] }
    | { origem: "codigo"; pergunta: Pergunta; entrada: EntradaDoAcompanhante; anotacoes?: Anotacao[] }
  export const conteudoDaPendenciaSchema   // zod, discriminado por origem; usa perguntaSchema, entradaDoAcompanhanteSchema e anotacaoSchema
  export function aplicarResposta(dados: DadosDoPreparo, pergunta: Pergunta, resposta: RespostaDaPessoa, kb: KnowledgeBase): DadosDoPreparo   // D2
  export function candidatosRetirados(antes: DadosDoPreparo, depois: DadosDoPreparo): string[]   // ids em antes.candidatos e não em depois.candidatos, na ordem
  ```
  `aplicarResposta` é pura (não muta `dados`). Efeito por resposta:

  | Resposta | Efeito em `dados` |
  |---|---|
  | `tenho` | Entra em `casa.confirmados`, sai de `casa.incertos`; o `casa` do item nos candidatos (em `itens` e em `opcoes`) vira `confirmado` |
  | `nao_tenho` | Sai de `casa.incertos`; o `casa` do item nos candidatos vira `ausente` |
  | `nao_gosto` | Entra em `filtro.nao_gosta`; sai das duas listas de casa |
  | `nao_come` | Entra em `filtro.nao_come` e em `nao_come_do_run` |
  | `como`, `pulou`, `pular`, `variante` | Nada |

  Sem repetir ids nas listas. Depois de aplicar uma resposta de casa, roda `entregaveis(dados.candidatos, { casa, acabou, perguntasRestantes: config.pausas.maxPerguntasPorRun − dados.perguntas.feitas }, kb)` com `acabou` = ids de `dados.perguntas.alimentos` que não estão em `casa.confirmados` nem em `casa.incertos` (D2): a refeição que ficou sem opção numa vaga obrigatória sai.
  - `anotacoes.ts`: `Extra` ganha `nao_come_do_run?: string[]`, e:
  ```ts
  export function acrescentarNaoCome(anotacoes: Anotacao[], naoComeDoRun: string[], perfil: Perfil, kb: KnowledgeBase): Anotacao[]
  ```
  Junta os ids de `naoComeDoRun` (que existem na base e não estão em `perfil.nao_come` como `{ tipo: "alimento", valor: id }`) à anotação `{ tipo: "nao_come"; itens: { alimento_id: string; nome: string }[] }` já existente (sem repetir `alimento_id`), ou cria uma no fim. `montarAnotacoes` chama `acrescentarNaoCome` com `extra.nao_come_do_run ?? []`. Nada vai para `perfis.nao_come`.
- testes primeiro: cada linha da tabela; Tenho para item incerto muda o `casa` do item em `itens` e em `opcoes`; "Não tenho" para a única opção de uma vaga obrigatória tira a refeição e `candidatosRetirados` devolve o id; Pular não muda nada (`toEqual` com a entrada); `dados` de entrada não é mutado; schema aceita as duas origens e recusa origem desconhecida; `acrescentarNaoCome` cria a anotação, junta a uma existente sem repetir e ignora o que já está no perfil; `montarAnotacoes` sem `nao_come_do_run` devolve o mesmo de antes.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: gravação no banco (T6); `conversar`.

### T6 · Add gravarResposta
- nivel: nucleo
- objetivo: gravar numa transação o que a pessoa respondeu a uma pergunta de casa e somar as métricas.
- arquivos: `src/core/runs/gravar-resposta.ts`, `src/core/runs/gravar-resposta.test.ts`
- leitura: `BUSINESS.md` §9 "Minha casa" (só "Como a casa é atualizada") e "O que fez falta"
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  export function gravarResposta(deps: { tx: Transactor; telemetry: Telemetry }, contaId: string, runId: string, dia: string, pergunta: Pergunta, resposta: RespostaDaPessoa): Promise<void>
  ```
  Numa transação (`tx.emTransacao(async (s) => …)`), **só** para pergunta e resposta de tipo `casa` (as outras e `pular` não gravam nada):

  | Resposta | Grava |
  |---|---|
  | `tenho` | `s.pantry.registrar(contaId, [{ alimento_id }], "pergunta")` (que apaga as faltas do alimento e o tira da lista) |
  | `nao_tenho` | `s.pantry.marcarAcabou(contaId, [{ alimento_id }])`; `s.shortages.registrar(contaId, [{ alimento_id, origem: "nao_tenho", run_id: runId }], dia)` |
  | `nao_gosto` | `s.preferences.definirGosto(contaId, { tipo: "alimento", id: alimento_id }, "nao_gosta")`; não mexe na casa |

  Item da pergunta ausente da resposta: pulado, nada gravado. Depois que a transação termina, por item: `telemetry.contador("ritu_faltas_total", { origem: "nao_tenho" })` e `telemetry.contador("ritu_gosto_total", { gosto: "nao_gosta" })`. Erro dentro da transação sobe e nenhuma métrica é somada. Nenhum id ou nome de alimento em rótulo.
- testes primeiro (com `createMemoryStores` e o `Transactor` em memória): Tenho grava `tem`, confirmado agora, `origem: "pergunta"`, e apaga uma falta anterior do alimento; Não tenho marca `acabou` e grava a falta `nao_tenho` com o `run_id` e o dia; Não gosto grava `gosto: nao_gosta` e não cria item em casa; Pular, item ausente, `come` e `variante` não gravam nada; as métricas somam uma por item; com uma falha simulada no meio, nada é gravado e nenhuma métrica soma.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: `continuar`.

### T7 · Add the ask_user control tool
- nivel: nucleo
- objetivo: criar a tool de controle `ask_user`, que confere o pedido do modelo, pausa o run com a pergunta montada por código e transforma a resposta no resultado da tool.
- arquivos: `src/core/agents/tools/ask-user.ts`, `src/core/agents/tools/ask-user.test.ts`
- leitura: `AI.md` §4 "Controle" (só a tabela); `AI.md` §7 (só a tabela)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  ```ts
  export type CodigoDeRecusa = "limite_de_perguntas" | "muitos_itens" | "fora_da_base" | "ja_confirmado" | "filtrado" | "acabou" | "fora_dos_candidatos" | "ja_perguntado" | "come_desnecessaria"
  export type PedidoDePergunta = { tipo: "casa"; alimentos: string[] } | { tipo: "come"; alimento: string }
  export const askUser: ToolDeControle<PedidoDePergunta>
  // name: "ask_user"
  // description: "Pergunta à pessoa se ela tem um alimento em casa (tipo casa, até 5 de uma vez) ou se come um alimento (tipo come). Use só quando a resposta muda o que você vai sugerir."
  export function validarPedidoDePergunta(pedido: PedidoDePergunta, p: { dados: DadosDoPreparo; acabou: string[]; preferencias: Preferencia[]; kb: KnowledgeBase }): { codigo: CodigoDeRecusa; alimentos?: string[] } | undefined
  ```
  `input`: zod discriminado por `tipo` (`alimentos: z.array(z.string())`, `alimento: z.string()`). Os ids do pedido (`alimentos`, ou `[alimento]` no tipo `come`) são conferidos na ordem da tabela; devolve o primeiro código; `alimentos` lista os ids que causaram a recusa, na ordem do pedido, e não vem em `limite_de_perguntas` nem `muitos_itens` (D15). Os códigos valem para os dois tipos.

  | Código | Recusa quando |
  |---|---|
  | `limite_de_perguntas` | `dados.perguntas.feitas` já é `config.pausas.maxPerguntasPorRun` |
  | `muitos_itens` | Mais de `config.pausas.maxItensPorPergunta` alimentos, ou nenhum |
  | `fora_da_base` | Algum id não existe em `kb.alimento(id)` |
  | `ja_confirmado` | Algum alimento está em `dados.casa.confirmados` |
  | `filtrado` | `passaNoFiltro(alimento, dados.filtro, kb).passa` é falso para algum (evitar sempre, restrição, "não como", "não gosto") |
  | `acabou` | Algum está em `acabou` (Minha casa com `estado: "acabou"`) |
  | `fora_dos_candidatos` | Algum não é item (`itens`) nem opção de vaga (`opcoes`) de nenhum candidato de `dados.candidatos` |
  | `ja_perguntado` | Algum está em `dados.perguntas.alimentos` |
  | `come_desnecessaria` | Tipo `come` para alimento que está em casa (confirmado ou incerto) ou que tem `gosto: "gosta"` ou `ajudou > 0` nas preferências (`item_id`) |

  `tratar(pedido, ctx, estado)`:
  - `dados = dadosDoPreparoSchema.parse(estado.dados)`; `acabou` = `alimento_id` dos itens de `await ctx.stores.pantry.listar(ctx.contaId)` com `estado: "acabou"`; `preferencias = await ctx.stores.preferences.ler(ctx.contaId)`.
  - com código: `{ tipo: "recusar", resultado: { perguntou: false, motivo: <código>, alimentos?: [...] } }` (o loop já soma no teto de recusas).
  - sem código: `pergunta = montarPergunta(pedido.tipo === "casa" ? { tipo: "casa", alimentos, incertos: alimentos.filter(id => dados.casa.incertos.includes(id)) } : { tipo: "come", alimento }, ctx.kb)`; atribui `estado.dados = { ...dados, perguntas: { feitas: dados.perguntas.feitas + 1, alimentos: [...dados.perguntas.alimentos, ...ids] } }` (o loop guarda esse objeto no checkpoint da pausa); devolve `{ tipo: "pausar", pendencia: { tipo: "pergunta", conteudo: { origem: "agente", pergunta } }, resumo }`, com `resumo` = `casa: N itens` (N = número de alimentos; com 1, `casa: 1 item`) ou `come` (o campo `resumo` é da T3).
  - `aoRetomar(retomada, estado)`: `retomada` é `RetomadaDaPergunta` (`{ pergunta, resposta, candidatos_retirados }`, D6; valide com zod e, se inválida, devolva `{ erro: "resposta_invalida" }`). Resultado para o modelo:
  ```ts
  // casa (itens na ordem da pergunta; item ausente da resposta, ou resposta "pular": "pulou")
  { respostas: { alimento_id: string; nome: string; resposta: RespostaDeCasa | "pulou" }[]; candidatos_retirados: string[] }
  // come
  { alimento_id: string; nome: string; resposta: "como" | "nao_como" | "pulou" }
  ```
- testes primeiro (mini-base ou base real, `createMemoryStores`, `ToolContext` montado à mão): um teste por código, em que só ele é devolvido (mais de 5 itens; lista vazia; alimento fora da base; já confirmado; barrado pelo filtro; marcado como acabou; fora dos candidatos; já perguntado; `come` para alimento incerto; `come` para alimento com "gosta"; limite com `perguntas.feitas: 2`); pedido limpo de casa pausa com a pergunta montada por código (texto "Ainda tem …" com incertos), `resumo` `casa: 2 itens`, e `estado.dados.perguntas` com `feitas + 1` e os ids; pedido limpo `come` pausa com `resumo` `come`; `aoRetomar` de casa com uma resposta, um item ausente e `candidatos_retirados`; `aoRetomar` com `pular` dá tudo `pulou`; `aoRetomar` de `come`. Pelo loop (`executarTrecho` ou `createRunService` com runtime roteirizado e um agente de teste com `[finalizar, askUser]`): `ask_user` recusado conta em `entregas_recusadas`; `ask_user` e `finalizar` no mesmo passo: vale o primeiro e o outro recebe `{ ignorada: true }`; o checkpoint gravado na pausa tem `dados.perguntas` atualizado.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: registrar a tool no Acompanhante (T8).

### T8 · Add the companion prompt v3 and give ask_user to the companion
- nivel: mecanica
- objetivo: criar `acompanhante.v3` como cópia da v2 com a troca de uma linha por cinco, e fazer `criarAcompanhante` usá-lo com `controle: [finalizar, askUser]`.
- arquivos: `src/core/agents/prompts/acompanhante.v3.ts`, `src/core/agents/prompts/acompanhante.v3.test.ts`, `src/core/agents/companion/agente.ts`, `src/core/agents/companion/agente.test.ts`, `scripts/eval-llm.ts` (só a versão do prompt no cabeçalho do relatório, se estiver presa a `acompanhanteV2`)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `acompanhanteV3`: cópia exata de `acompanhanteV2` (`instrucoes`, `lembreteDeEntrega`) com `versao: "acompanhante.v3"` e **uma** troca em "O QUE VALE SEMPRE": a linha que começa com `- Ingrediente:` é substituída por estas cinco, nesta ordem, sem mudar uma vírgula:
  ```text
  - Ingrediente: só o que está "confirmado" em casa. Para usar um que está "incerto" ou "ausente", pergunte antes com ask_user (tipo casa) e só use se a resposta for "tenho". Sem perguntar, "incerto" só entra com se_faltar preenchido por um substituto confirmado em casa (ayurveda.substitutos), e "ausente" não entra.
  - ask_user: no máximo 2 perguntas, e só quando a resposta muda o que você vai sugerir. Se já dá para sugerir bem com o que está confirmado, não pergunte. Junte até 5 alimentos numa pergunta só. Só pergunte sobre ingrediente dos candidatos. Nunca pergunte sobre o que já está confirmado nem sobre o que está em evitar_sempre, restrições, "não como" ou "não gosto".
  - Candidato com depende_de_pergunta: só entregue depois de um "tenho" para o ingrediente que falta. Se a pergunta não couber, use outro candidato.
  - ask_user tipo come: só quando um alimento de origem animal entraria na sugestão e nada no contexto diz se a pessoa come.
  - Depois da resposta: "tenho" pode entrar; "nao_tenho", "nao_gosto" e "nao_come" não entram; "pulou" fica como estava. Não comente a resposta: use.
  ```
  - `criarAcompanhante()`: `instrucoes`, `prompt_versao` e `lembreteDeEntrega` de `acompanhanteV3`; `controle: [finalizar as ToolDeControle<unknown>, askUser as ToolDeControle<unknown>]`. A v2 continua no repositório.
- testes primeiro: v3 tem `versao` `acompanhante.v3` e o mesmo lembrete da v2; v3 é a v2 com a linha `- Ingrediente:` trocada pelas cinco linhas e nenhuma outra diferença (compare linha a linha, como o teste da v2 faz com a v1); `criarAcompanhante` usa a v3 e tem `finalizar` e `ask_user` no controle, nessa ordem.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam (os cenários roteirizados continuam passando).
- fora: tratamento da pausa em `responder` (T9).

### T9 · Let the companion pause and continue
- nivel: nucleo
- objetivo: fazer `responder` tratar o fim `pausa` (run em espera, sem saída) e criar `companion.continuar`, que aplica a resposta aos dados do checkpoint e retoma o loop.
- arquivos: `src/core/agents/companion/responder.ts`, `src/core/agents/companion/responder.test.ts`, `src/core/agents/companion/fim-do-run.ts` (criar, se precisar tirar o tratamento do fim de `responder.ts` para a complexidade), `src/core/conversation/conversar.ts` (só o que o typecheck pedir por `saida` opcional), `evals/det/acompanhante/entrega.eval.ts`, `evals/det/acompanhante/privacidade.eval.ts`, `evals/det/acompanhante/trajetoria.eval.ts`, `evals/det/acompanhante/degradacao.eval.ts`, `test/fixtures/cenarios/cenarios.test.ts`, `scripts/demo.ts`, `scripts/lib/demo-report.ts`, `scripts/eval-llm.ts`. Exceção: outros consumidores de `RespostaDoRun.saida` que o typecheck apontar (ex.: `evals/det/conversa/*.eval.ts`, `scripts/lib/eval-llm-casos.ts`) podem ganhar a conferência de `saida` e nada mais (diga quais).
- leitura: `AI.md` §7, último parágrafo
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  - `RespostaDoRun` (D14): `{ run_id: string; status: Run["status"]; saida?: SaidaDoAcompanhante; pergunta?: Pergunta; fim: FimDoTrecho["tipo"]; motivo?: string }`. Com `status: "waiting_for_input"` vem `pergunta` e não vem `saida`.
  - `OpcoesDoResponder` ganha `perguntasFeitas?: number`, repassado a `preparar(..., { runId, perguntasFeitas })` (pausa de código: `perguntasFeitas: 1`).
  - **Fim `pausa`** (em `responder` e em `continuar`): não encerra nem cancela; grava com `stores.runs.atualizar` (o run já está em `waiting_for_input`) `momento`, `com_incomodo`, `clima_usado`, `prompt_versao`, `modelos`, `trocas_de_modelo` (sem `saida`); devolve `{ run_id, status: "waiting_for_input", fim: "pausa", pergunta }`, com `pergunta = conteudoDaPendenciaSchema.parse(fim.pendencia.conteudo).pergunta`. Sem `medirParaTer`. Conteúdo inválido: run `failed`, etapa `erro` `pausa_invalida`, saída segura.
  - `createCompanion` ganha:
  ```ts
  continuar(contaId: string, run: Run, r: { pergunta: Pergunta; resposta: RespostaDaPessoa }, opts?: { aoVivo?: (e: EventoAoVivo) => void }): Promise<RespostaDoRun>
  ```
  1. Exige `run.status === "running"` (quem chama já trocou o status com `mudarStatusSe`); senão `RunNaoContinuavelError`.
  2. `cp = lerCheckpoint(run.checkpoint)`; `dados = dadosDoPreparoSchema.parse(cp.dados)`; `novos = aplicarResposta(dados, r.pergunta, r.resposta, kb)`; `retirados = candidatosRetirados(dados, novos)`; `stores.runs.atualizar(contaId, run.id, { checkpoint: { ...cp, dados: novos } })` (D7).
  3. Sem modelo para `decisao` (`!router.temModelo("decisao")`): resposta sem modelo com o run dado (como o `semModelo` de hoje, com `novos`).
  4. Senão `runs.continuarRun(contaId, run.id, { agente: acompanharClima(criarAcompanhante(), …), ctx, modelo: router.paraPapel("decisao", { aoTrocar }), aoVivo, aoGravarEtapa, resposta: { pergunta: r.pergunta, resposta: r.resposta, candidatos_retirados: retirados }, reservado: true })`. `ctx` montado com `novos` (filtro e sinais atualizados) e `casaDaMensagem: { tem: novos.casa.confirmados, acabou: [] }` (D12).
  5. O fim é tratado como em `responder` (mesma função; `saidaDoFim`, `fechar`, `registrarErro`, `medirParaTer`), com `dados = novos` e os totais da D9: `modelos` preserva as chaves do run e une `decisao` com os modelos novos; `trocas_de_modelo` soma ao do run; `clima_usado` novo ou o do run.
  - O fim `pausa` deixa de cair em `pausa_inesperada`.
- testes primeiro (runtime roteirizado, `createMemoryStores`, base real ou mini-base): roteiro `casa.ler` → `ask_user({ tipo: "casa", alimentos: ["abobora", "couve"] })` com os dois incertos: `responder` devolve `status: "waiting_for_input"`, `pergunta` com texto e itens montados por código, sem `saida`; o run tem `pendencia` e `checkpoint`, e o evento `pausa` e `ritu_pausas_total` saem uma vez. Depois, com o run levado a `running` por `mudarStatusSe`, `continuar` com Tenho para abóbora e Não tenho para couve: o roteiro segue do passo seguinte sem repetir pedido (`pedidos.length` igual ao número de passos); o resultado da tool que o modelo recebe (última mensagem `tool` do pedido seguinte) traz as duas respostas e `candidatos_retirados`; uma entrega com couve é recusada com `fora_de_casa` e a com abóbora passa; o run termina `done` com `saida`. Não gosto em um item: entrega com ele recusada com `nao_gosta`. `continuar` em run `waiting_for_input` (não reservado) lança `RunNaoContinuavelError`. Sem modelo na retomada: resposta sem modelo, run `done`. Os totais: `modelos.apoio` gravado antes no run continua depois do `continuar`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`; `npm run demo -- --cenario frio-agitada` com código 0.
- pronto quando: os testes e os evals passam.
- fora: `conversar` e `continuar` da conversa (T10, T11); gravação da resposta (é do `continuar` da conversa).

### T10 · Pause conversar for a variant and for the agent's question
- nivel: nucleo
- objetivo: fazer `conversar` perguntar a variante do incômodo por código, antes do Acompanhante, e devolver a pergunta do agente quando o loop pausa.
- arquivos: `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts`, `src/core/conversation/pausa-de-codigo.ts` (criar, se precisar para a complexidade)
- leitura: `BUSINESS.md` §8 "Fluxo de uma mensagem", item 3; `KNOWLEDGE.md` §3.1 (só o parágrafo antes da tabela)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  - `RespostaDaConversa` muda: `{ run_id: string; status: Run["status"]; caminho: Caminho; saida?: SaidaDoAcompanhante; pergunta?: Pergunta; interpretacao?: Interpretacao }`. Com `status: "waiting_for_input"` vem a `pergunta` e não vem `saida`.
  - **Antes de `companion.responder`**, no caminho `acompanhante` (depois de `registrarResultado` e da gravação dos itens do dia, que já acontecem hoje): se `entrada.incomodo` existe sem `variante` e `qualidadesDoMomento({ estados: entrada.estados, incomodo: entrada.incomodo }, kb).precisa_variante` vem preenchido, é a **pausa de código** (não chama o Acompanhante nem o papel `decisao`):
    1. `pergunta = perguntaDaVariante(precisa)`;
    2. grava a etapa `{ tipo: "pergunta", nome: "variante", status: "ok", resumo: "variante", duracao_ms: 0, modelo: null, tokens_entrada: 0, tokens_saida: 0 }` com os eventos ao vivo (`etapa_iniciada`/`etapa_concluida`), como as outras etapas de `conversar`;
    3. `anotacoes` = `montarAnotacoes(interpretacao, perfil, { kb, preferencias })` (D8);
    4. `runs.pausarSemAgente(contaId, run.id, { tipo: "pergunta", conteudo: { origem: "codigo", pergunta, entrada, anotacoes } })` (emite o evento `pausa` e soma `ritu_pausas_total`, D13); `stores.runs.atualizar(contaId, run.id, { com_incomodo: true })`;
    5. grava a mensagem do agente com `texto: pergunta.texto`, `com_incomodo: true`, `run_id`, `dia`; `messages.marcarIncomodoDoRun(contaId, run.id)` (a da pessoa também fica com `com_incomodo: true`);
    6. soma ao run o Intérprete (passo 8 da 008: `modelos.apoio`, tokens), D9;
    7. devolve `{ run_id, status: "waiting_for_input", caminho: "acompanhante", pergunta, interpretacao }`.
  - Incômodo de variante única, ou com a variante já dita: sem pausa (segue como hoje). Só atalhos nunca pausam (não trazem incômodo).
  - **Fim `pausa` do loop** (`companion.responder` devolve `status: "waiting_for_input"` com `pergunta`): acrescenta `anotacoes` ao `runs.pendencia` (lê o run, `conteudo: { ...conteudo, anotacoes }`, `stores.runs.atualizar`); grava a mensagem do agente com `texto: pergunta.texto` (`com_incomodo: false`; com incômodo na interpretação, `marcarIncomodoDoRun` como no passo 7 da 008); soma o Intérprete (passo 8); devolve `{ run_id, status: "waiting_for_input", caminho: "acompanhante", pergunta, interpretacao }`. O retorno ligado e os itens do dia já foram gravados antes. Não grava `saida`.
- testes primeiro (`createMemoryStores`, `createFakeLlm` com a interpretação, runtime roteirizado, base real, `createMemoryTelemetry`): mensagem com `incomodo: { id: "dor-de-cabeca" }` sem variante pausa com a pergunta e as três opções de `incomodos.yaml`, sem nenhum pedido ao runtime roteirizado e sem chamada do papel `decisao`; o run fica `waiting_for_input`, com `pendencia` de origem `codigo` (com a entrada e as anotações), sem checkpoint, `com_incomodo: true`; etapa `pergunta` `variante`; um evento `pausa`; `ritu_pausas_total` soma 1; as duas mensagens (pessoa e agente) com `com_incomodo: true` e o `run_id`. Incômodo `estomago-pesado` (variante única) e `dor-de-cabeca` com `variante: "latejante"` não pausam. Roteiro `casa.ler` → `ask_user` casa: `conversar` devolve `waiting_for_input`, `pergunta`, sem `saida`; mensagem do agente com o texto da pergunta; `pendencia.conteudo.anotacoes` gravado; `modelos.apoio` no run. Nenhum span, métrica, log ou `resumo` com nome de alimento, de incômodo ou texto da pessoa.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam (os de `evals/det/conversa/` continuam verdes).
- fora: `continuar` (T11); rota HTTP (018).

### T11 · Add the continuar service
- nivel: nucleo
- objetivo: criar `continuar`, que recebe a resposta da pessoa a uma pergunta aberta, confere, grava o que ela diz e retoma o run (pelo Acompanhante, ou pelo `responder` na pausa de código).
- arquivos: `src/core/conversation/continuar.ts`, `src/core/conversation/continuar.test.ts`, `src/core/conversation/conversar.ts` (só para expor `continuar` em `createConversation`)
- leitura: `AI.md` §7, último parágrafo; `BUSINESS.md` §9 "Minha casa", só "Como a casa é atualizada"
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §2, linha "Human-in-the-loop com `waiting_for_input` e `continue`"
- contratos:
  ```ts
  // createConversation(deps) passa a devolver também:
  continuar(contaId: string, runId: string, resposta: RespostaDaPessoa, opts?: { aoVivo?: (e: EventoAoVivo) => void }): Promise<RespostaDaConversa>
  ```
  `src/core/conversation/continuar.ts` exporta a fábrica (`criarContinuar(deps)`, com as mesmas deps de `createConversation`), e `createConversation` a usa. Ordem (D5):
  1. `run = stores.runs.buscar(contaId, runId)`; ausente (inclusive de outra conta) ou fora de `waiting_for_input` (`done`, `expired`, `cancelled`, `running`): `RunNaoContinuavelError`, nada muda. `pendenciaSchema` + `conteudoDaPendenciaSchema` sobre `run.pendencia`; inválida: `RunNaoContinuavelError`.
  2. `clock.now() − pendencia.criada_em > config.memoria.esperaMinutos × 60 000` (30 min exatos ainda valem): `stores.runs.mudarStatusSe(contaId, runId, "waiting_for_input", "expired")` e `throw new RituError("pergunta_expirada", "A pergunta expirou")`; nada é gravado. (Se `mudarStatusSe` devolver `false`: `RunNaoContinuavelError`.)
  3. `validarResposta(conteudo.pergunta, resposta)` (depois do parse com `respostaDaPessoaSchema`); inválida: `throw new RituError("resposta_invalida", "Resposta inválida")`; o run continua em `waiting_for_input` e nada é gravado.
  4. `mudarStatusSe(contaId, runId, "waiting_for_input", "running")`; `false`: `RunNaoContinuavelError` (outra chamada chegou antes).
  5. Daqui em diante, dentro de `runs.comSpanDoRun(contaId, runId, …)` (mesmo trace: o span usa o `trace_id` salvo). `gravarResposta({ tx, telemetry }, contaId, runId, run.dia, conteudo.pergunta, resposta)`; se falhar: `mudarStatusSe(contaId, runId, "running", "waiting_for_input")` e o erro sobe. Grava a mensagem da pessoa: `texto: textoDaResposta(pergunta, resposta)`, `com_incomodo: conteudo.pergunta.tipo === "variante"`, `run_id`, `dia: run.dia`.
  6. Origem `agente`: `companion.continuar(contaId, runAtual, { pergunta, resposta }, { aoVivo })` (`runAtual` relido, em `running`). Origem `codigo`: `entrada = resposta.tipo === "variante" ? { ...conteudo.entrada, incomodo: { ...conteudo.entrada.incomodo, variante: resposta.variante } } : conteudo.entrada` (com Pular, sem variante; `precisa_variante` vai no contexto, como na 007); `companion.responder(contaId, entrada, { run: runAtual, perguntasFeitas: 1, aoVivo })`.
  7. Pelo fim:
     - **outra pausa** (`status: "waiting_for_input"`): carrega `conteudo.anotacoes` para a nova pendência (`stores.runs.atualizar`); grava a mensagem do agente com o texto da nova pergunta (`com_incomodo` se o run tem `com_incomodo`); devolve `{ run_id, status, caminho: run.caminho, pergunta }`.
     - **os demais**: `anotacoes = acrescentarNaoCome(conteudo.anotacoes ?? [], naoComeDoRun, perfil, kb)`, com `naoComeDoRun` de `run.checkpoint.dados.nao_come_do_run` quando houver checkpoint (senão `[]`); grava `saida: { ...saida, anotacoes }` no run; grava a mensagem do agente com `saida.resposta` (`com_incomodo: false`; se o run tem `com_incomodo`, `marcarIncomodoDoRun`); totais da D9 (soma aos `tokens_entrada`/`tokens_saida` do run os da etapa `interprete` do run, quando houver, e `modelos.apoio = [modelo dela]`, preservando `decisao`); devolve `{ run_id, status, caminho, saida }`.
  - Erro inesperado depois do passo 4 (fora o do passo 5): se o run está `running`, `runs.encerrar(..., "failed")`; a `saidaSegura()` é gravada como mensagem do agente e devolvida. `RunNaoContinuavelError`, `pergunta_expirada` e `resposta_invalida` sobem.
  - "Como" e "Não como" não gravam nada fora do run; nada vai para `perfis.nao_come`.
- testes primeiro (`createMemoryStores`, `createFakeLlm`, runtime roteirizado, base real, `createFixedClock`, `createMemoryTelemetry`):
  - pausa do agente (abóbora e couve incertas) → `continuar` com Tenho/Não tenho: antes de o roteiro seguir (confira num passo roteirizado ou lendo o banco depois), abóbora em `casa` `tem` com `origem: "pergunta"` e confirmada agora, couve `acabou` com falta `nao_tenho` do dia e com o `run_id`; `ritu_faltas_total{origem: "nao_tenho"}` soma; run `done`; mensagens: pergunta (agente) e "Tenho: abóbora · Não tenho: couve" (pessoa), com o `run_id`;
  - Não gosto grava `gosto: nao_gosta`, não mexe na casa, `ritu_gosto_total` soma;
  - Pular e item sem resposta não gravam nada; o modelo recebe `pulou`;
  - pausa de código com `latejante`: `responder` roda com a variante (candidatos diferentes dos de `tensa`) e segue para o Acompanhante; com Pular, roda sem variante e `precisa_variante` vai no contexto; mensagem da pessoa da variante com `com_incomodo: true`;
  - expiração: 30 min exatos vale; 30 min e 1 ms → run `expired`, `RituError` `pergunta_expirada`, nada gravado;
  - resposta que não combina (tipo trocado, alimento fora da pergunta, variante inexistente): `resposta_invalida`, run em `waiting_for_input`, nada gravado;
  - run `done`, `expired`, `cancelled` e de outra conta: `RunNaoContinuavelError`, nada muda;
  - duas chamadas seguidas ao mesmo run: a segunda recebe `RunNaoContinuavelError` e a casa é gravada uma vez;
  - falha simulada em `gravarResposta` (override do `tx`): o erro sobe e o run volta a `waiting_for_input`;
  - mensagem nova (`conversar`) com pergunta aberta: o run antigo vira `cancelled` e o que já foi respondido antes continua gravado;
  - "Não como" (roteiro com `ask_user` tipo `come`): `dados.filtro.nao_come` no checkpoint, anotação `nao_come` na saída, nada em `perfis.nao_come`;
  - a 3ª pergunta do run (variante + agente + agente) é recusada com `limite_de_perguntas`, o run não pausa e o loop segue;
  - rastro: o trecho retomado entra no mesmo trace (mesmo `trace_id` do run); totais com `modelos.apoio` e os tokens do Intérprete preservados.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: rota `POST /api/runs/:id/continue` e botões (018); bloco de aprovação (010).

### T12 · Add the four pause scenarios
- nivel: mecanica
- objetivo: acrescentar `respostas` ao `Cenario` e criar os quatro cenários com pausa.
- arquivos: `test/fixtures/cenarios/tipos.ts`, `test/fixtures/cenarios/index.ts`, `test/fixtures/cenarios/casa-incerta.ts`, `test/fixtures/cenarios/casa-vazia.ts`, `test/fixtures/cenarios/dor-de-cabeca.ts`, `test/fixtures/cenarios/pergunta-recusada.ts`, `test/fixtures/cenarios/cenarios.test.ts`, `test/fixtures/cenarios/rodar.ts` (criar: ajudante que roda um cenário até o fim)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `Cenario` ganha `respostas?: RespostaDaPessoa[]`, usadas na ordem a cada pausa.
  - `test/fixtures/cenarios/rodar.ts`:
  ```ts
  export async function rodarCenario(deps: DepsDoCenario, contaId: string, c: Cenario, opts?: { aoVivo?: (e: EventoAoVivo) => void; responder?: (p: Pergunta, i: number) => Promise<RespostaDaPessoa> }): Promise<{ final: RespostaDaConversa | RespostaDoRun; perguntas: { pergunta: Pergunta; resposta: RespostaDaPessoa }[] }>
  ```
  Chama `conversar` (com `mensagem`) ou `responder` (com `entrada`); enquanto `status === "waiting_for_input"` e houver `pergunta`, pega a resposta (`opts.responder` ou a próxima de `c.respostas`; sem resposta sobrando, `{ tipo: "pular" }`, D17), chama `deps.conversation.continuar(contaId, run_id, resposta, { aoVivo })`; no máximo 3 retomadas.
  - Os quatro cenários (base real; perfil, clima e forma como os da 007 e 008; todos com `mensagem` e `interpretacao` roteirizada, passando por `conversar`):

  | Cenário | Mostra | Mensagem e interpretação | Roteiro | Respostas |
  |---|---|---|---|---|
  | `casa-incerta` | Abóbora e couve incertas; a pessoa tem uma e não tem a outra | momento com frio; casa com `abobora` e `couve` com `diasDesdeConfirmacao: 20` | `casa.ler` → `ask_user({ tipo: "casa", alimentos: ["abobora", "couve"] })` → `finalizar` com a abóbora | `[{ tipo: "casa", itens: [{ alimento_id: "abobora", resposta: "tenho" }, { alimento_id: "couve", resposta: "nao_tenho" }] }]` |
  | `casa-vazia` | Primeira conversa, nada em Minha casa | momento; `casa: []` | `casa.ler` → `ask_user` casa com 5 itens, entre eles os de uma refeição com `depende_de_pergunta` → `finalizar` com a refeição feita do que ela tem | três Tenho, um Não gosto, um pulado (ausente da lista) |
  | `dor-de-cabeca` | "tô com dor de cabeça, o que como no almoço?" | `intencoes: ["momento"]`, `incomodo: { id: "dor-de-cabeca" }` | (pausa de código) → `clima.agora` → `finalizar` com o aviso de incômodo | `[{ tipo: "variante", variante: "latejante" }]` |
  | `pergunta-recusada` | O agente tenta perguntar sobre item já confirmado | momento; casa com um alimento confirmado | `ask_user` casa com o confirmado (recusada, `ja_confirmado`) → `finalizar` | nenhuma |

  Para `casa-vazia`, escolha os 5 ids rodando `preparar` sobre o cenário (pegue a primeira refeição com `depende_de_pergunta` e complete com ingredientes de outros candidatos); o `finalizar` só usa itens respondidos com Tenho. Os roteiros têm que passar no validador do `finalizar` (copie a forma de uma entrega válida dos cenários existentes). Confira os ids na base; se algum não existir, pare e diga qual.
- testes primeiro: cada cenário novo roda por `rodarCenario` até `done`, com o número de pausas esperado (1, 1, 1, 0), a pergunta impressa com o texto esperado ("Ainda tem abóbora e couve?" em `casa-incerta`; "Você tem … em casa?" em `casa-vazia`; a pergunta de `incomodos.yaml` em `dor-de-cabeca`) e saída do agente (`origem: "agente"`); `pergunta-recusada` tem uma etapa `validacao` `ask_user` `recusado` e nenhuma pausa; os doze cenários anteriores continuam rodando.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes passam.
- fora: `scripts/demo.ts` (T13).

### T13 · Show pauses in the demo and add the interactive mode
- nivel: mecanica
- objetivo: fazer o `demo` imprimir cada pergunta com as opções numeradas e a resposta usada, e ler a resposta do terminal com `--interativo`.
- arquivos: `scripts/demo.ts`, `scripts/lib/demo-report.ts`, `scripts/lib/demo-report.test.ts`, `scripts/lib/demo-resposta.ts`, `scripts/lib/demo-resposta.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `demo` roda o cenário com `rodarCenario` (T12); com `--interativo`, `opts.responder` lê do terminal (`node:readline`, uma linha por pergunta ou por item); sem, usa `cenario.respostas`. `--interativo` combina com `--llm` e `--esgotar`.
  - `scripts/lib/demo-resposta.ts` (puro, testável):
  ```ts
  export function formatarPergunta(p: Pergunta): string
  // casa: o texto e, por item, "  <n>. <nome>  [t] Tenho  [n] Não tenho  [g] Não gosto  [Enter] Pular"
  // come: o texto e "  1. Como  2. Não como  [Enter] Pular"; variante: o texto e "  <n>. <opção>" por opção, e "[Enter] Pular"
  export function respostaDoTexto(p: Pergunta, linhas: string[]): RespostaDaPessoa
  // casa: uma linha por item, "t" | "n" | "g" (maiúscula ou minúscula) ou vazia (pula o item); outra letra também pula
  // come e variante: uma linha com o número da opção; vazia ou fora da faixa: { tipo: "pular" }
  ```
  - Relatório (`DadosDoRelatorio`): ganha `perguntas?: { pergunta: Pergunta; resposta: RespostaDaPessoa }[]`. Para cada pausa, um bloco "Pergunta" com `formatarPergunta` e a linha "Resposta: <textoDaResposta(pergunta, resposta)>", na ordem em que aconteceram, entre as etapas e a resposta final. A resposta final aceita `saida` ausente (run que terminou em espera).
- testes primeiro: `formatarPergunta` nos três tipos; `respostaDoTexto` para casa (`t`, `n`, `g`, vazio, letra estranha), come (1, 2, vazio) e variante (número válido, fora da faixa, vazio); o relatório de um run com uma pausa tem o bloco "Pergunta" com as opções e a linha "Resposta: Tenho: abóbora · Não tenho: couve"; o de um run sem pausa não tem o bloco.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; e rode `npm run demo -- --cenario <nome>` para os 16 cenários (os quatro novos e os doze anteriores), sem rede, todos com código 0; rode `printf 't\nn\n' | npm run demo -- --cenario casa-incerta --interativo` com código 0.
- pronto quando: os testes passam, os 16 cenários rodam com código 0 e os quatro novos imprimem a pergunta, a resposta dada e o resto do run.
- fora: `--llm` real (não rodar).

### T14 · Add the pauses deterministic evals, part 1
- nivel: mecanica
- objetivo: escrever os evals de pausa e retomada, gravação, recusas e limite.
- arquivos: `evals/det/pausas/pausa-casa.eval.ts`, `evals/det/pausas/gravacao.eval.ts`, `evals/det/pausas/recusas.eval.ts`, `evals/det/pausas/limite.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: evals com o runtime roteirizado, `createMemoryStores`, `createFakeLlm`, `createFixedClock` e a **base real** (pelos cenários de `test/fixtures/cenarios`, `montarCenario` e `rodarCenario`, ou montando as deps como nos evals de `evals/det/conversa/`). `continuar` é `deps.conversation.continuar(contaId, runId, resposta)`. Cada eval:
  - `pausa-casa.eval.ts`: `casa-incerta` pausa em `waiting_for_input` com `pendencia` (origem `agente`) e `checkpoint`; `conversar` devolve a `pergunta` sem `saida`; a retomada não repete pedido ao runtime; o resultado da tool que o modelo recebe traz as respostas; o validador usa os dados atualizados (entrega com couve recusada `fora_de_casa`, com abóbora aceita); o run termina `done`.
  - `gravacao.eval.ts`: Tenho grava `tem`/`origem: "pergunta"` e apaga a falta anterior do alimento (e o tira da lista "Para ter em casa"); Não tenho marca `acabou` e grava a falta `nao_tenho` com o `run_id`; Não gosto grava `nao_gosta` e não mexe na casa; Pular e item sem resposta não gravam; tudo já está gravado antes do passo seguinte do loop (confira num `aoVivo` da primeira etapa depois da retomada).
  - `recusas.eval.ts`: um caso por código de `ask_user` (`limite_de_perguntas`, `muitos_itens`, `fora_da_base`, `ja_confirmado`, `filtrado`, `acabou`, `fora_dos_candidatos`, `ja_perguntado`, `come_desnecessaria`), cada um devolvendo só aquele `motivo`, e um pedido limpo que pausa.
  - `limite.eval.ts`: a 3ª pergunta é recusada com `limite_de_perguntas` e o run não pausa; a da variante conta (pausa de código + duas do agente → a 2ª do agente é recusada); mais de 5 itens recusado com `muitos_itens`.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T15 · Add the pauses deterministic evals, part 2
- nivel: mecanica
- objetivo: escrever os evals de candidatos perguntáveis, variante, expiração e resposta inválida.
- arquivos: `evals/det/pausas/entregaveis.eval.ts`, `evals/det/pausas/variante.eval.ts`, `evals/det/pausas/expiracao.eval.ts`, `evals/det/pausas/resposta-invalida.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: mesmas ferramentas da T14. Cada eval:
  - `entregaveis.eval.ts`: casa vazia leva ao modelo no máximo 2 refeições, com `depende_de_pergunta`; item com `estado: "acabou"` em Minha casa não segura refeição; com `perguntasFeitas: 2` (sem pergunta disponível), nenhuma refeição perguntável; "Não tenho" para a única opção de uma vaga obrigatória tira a refeição e o resultado da tool traz o id em `candidatos_retirados`; as faltas (`faltas_do_run`) seguem contadas sobre a lista completa (`candidatos_completos`).
  - `variante.eval.ts`: `dor-de-cabeca` sem variante pausa sem nenhum pedido ao runtime (nenhuma chamada do papel `decisao`); `latejante`, `tensa` e `pesada` dão candidatos diferentes; Pular segue com `precisa_variante` no contexto (mensagem inicial do runtime); incômodo de variante única (`estomago-pesado`) e incômodo com a variante já dita não pausam.
  - `expiracao.eval.ts`: com o relógio 30 min depois de `pendencia.criada_em`, `continuar` vale; com 31 min, run `expired`, `pergunta_expirada` e nada gravado (casa, gosto, faltas, mensagens); mensagem nova com pergunta aberta cancela o run em espera e o já respondido continua gravado.
  - `resposta-invalida.eval.ts`: tipo trocado, alimento fora da pergunta e variante inexistente → `resposta_invalida`, run em `waiting_for_input`, nada gravado; outra conta → `RunNaoContinuavelError`.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T16 · Add the pauses deterministic evals, part 3
- nivel: mecanica
- objetivo: escrever os evals de "não como", mensagens e privacidade.
- arquivos: `evals/det/pausas/nao-come.eval.ts`, `evals/det/pausas/mensagens.eval.ts`, `evals/det/pausas/privacidade.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: mesmas ferramentas da T14. Cada eval:
  - `nao-come.eval.ts`: roteiro com `ask_user({ tipo: "come", alimento: "ovo" })` e resposta "Não como": `ovo` em `dados.filtro.nao_come` (checkpoint), uma entrega com ovo recusada com `nao_come`, anotação `nao_come` com o ovo na saída final, nada em `perfis.nao_come`; "Como" não grava nada em lugar nenhum.
  - `mensagens.eval.ts`: pergunta (agente) e resposta (pessoa, `textoDaResposta`) gravadas com o `run_id`, na ordem; as da variante com `com_incomodo: true` e apagadas por `executarLimpeza` com o relógio no dia seguinte, mesmo com o run expirado.
  - `privacidade.eval.ts`: os quatro cenários novos não deixam nome de alimento da base, id de alimento, nome ou id de incômodo e de variante, nem texto da pessoa (a mensagem inteira e cada palavra com 5 letras ou mais) em atributo de span, rótulo de métrica, campo de log ou `resumo` de etapa; os `resumo` das etapas `pergunta` são só `casa: N itens`, `come` ou `variante`.
- testes primeiro: os próprios evals.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam.
- fora: código de produção (se um eval falhar por bug, pare e descreva o bug).

### T17 · Let eval:llm conversation cases answer pauses and measure questions
- nivel: mecanica
- objetivo: fazer o runner do `eval:llm` responder às pausas dos casos `conversa` e medir as perguntas feitas, evitadas e recusadas.
- arquivos: `evals/llm/casos/c2/tipos.ts`, `scripts/lib/eval-llm-casos.ts`, `scripts/lib/eval-llm-casos.test.ts`, `scripts/lib/eval-llm-report.ts`, `scripts/lib/eval-llm-report.test.ts`, `scripts/eval-llm.ts`
- leitura: `QA.md` "Checkpoints" (só as regras da rodada)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha "Eval com rodadas, relatório e comparação"
- contratos:
  - O caso `conversa` ganha `respostas?: RespostaDaPessoa[]` (usadas na ordem a cada pausa; sem resposta sobrando, `{ tipo: "pular" }`, no máximo 3 retomadas, D17) e `pergunta?: "necessaria" | "desnecessaria"`.
  - O runner roda o caso com `rodarCenario` (T12) sobre o `montarCenario` com `runtime` e `llm` reais. A expectativa passa a receber `{ resposta: RespostaDaConversa; resultado: ResultadoDoRun; perguntas: { pergunta: Pergunta; resposta: RespostaDaPessoa }[]; recusadas: number; llmAntesDaPrimeiraPausa: number }`, onde `recusadas` = etapas `validacao` de nome `ask_user` com `status: "recusado"` do run, e `llmAntesDaPrimeiraPausa` = etapas `llm` com `ordem` menor que a da primeira etapa `pergunta` (sem pausa: todas).
  - Relatório, seção **Perguntas** (só com casos `conversa` que têm `pergunta`): "perguntas necessárias feitas" (casos `necessaria` com ao menos uma pergunta de tipo `casa`, por caso e total), "desnecessárias evitadas" (casos `desnecessaria` sem nenhuma pergunta, por caso e total) e "perguntas recusadas pelo código por run" (média de `recusadas` nos casos `conversa`). Sem casos assim, a seção não aparece.
  - A lógica que não chama modelo (despachar respostas, contar recusas e passos, montar as métricas) fica em `scripts/lib/eval-llm-casos.ts` / `eval-llm-report.ts`, testável.
- testes primeiro: com um runtime roteirizado e o `createFakeLlm` no lugar do real, um caso `conversa` com pausa recebe as `respostas` na ordem e a expectativa vê `perguntas`; sem respostas, a pausa recebe `pular`; `recusadas` e `llmAntesDaPrimeiraPausa` contados de etapas prontas; a seção Perguntas com acerto por caso e total; sem casos com `pergunta`, a seção não aparece; o `c1-base` continua gerando o mesmo relatório.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run eval:llm -- --checkpoint c2-conversa --listar` (sem rede, código 0). **Não** rode a rodada com modelo.
- pronto quando: os testes passam e `--listar` funciona sem chave.
- fora: os 8 casos (T18); rodada ⚠️.

### T18 · Add the 8 question cases of c2
- nivel: mecanica
- objetivo: escrever os 8 casos do tipo `conversa` da família Perguntas.
- arquivos: `evals/llm/casos/c2/perguntas/01-frio-so-incertos.ts` … `evals/llm/casos/c2/perguntas/08-dor-de-cabeca-latejante.ts` (um arquivo por caso, nome com número e assunto), `evals/llm/casos/c2/perguntas/expectativas.ts`, `evals/llm/casos/c2/index.ts`, `scripts/lib/eval-llm-casos.test.ts` (só acrescentar o teste de contagem)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: tipo `conversa` da T17 (cenário com `mensagem`, base real, perfil e clima como os cenários da 007/008). Expectativas reutilizáveis em `expectativas.ts` (por exemplo `perguntouCasa()`, `naoPerguntou()`, `perguntouNoMaximo(n)`, `itensNaPergunta(max)`, `nuncaPerguntou(id)`, `semItemNaSaida(id)` — procura em `sugestoes`, `citados` e no texto pelo nome —, `semSegundaPerguntaSobre(ids)`, `pausouSemDecisao()` (`llmAntesDaPrimeiraPausa === 0` e a primeira pergunta é `variante`), `temAvisoDeIncomodo()`, `sugestaoQueRefresca()` (alguma sugestão com `frio` ou `brando` em `verbos`/`contribui`), `terminou()`). Casos:

  | # | Caso | Respostas | `pergunta` | Esperado |
  |---|---|---|---|---|
  | 1 | Momento com frio; os melhores candidatos só têm itens incertos | Tenho a tudo | `necessaria` | Pergunta de casa |
  | 2 | Momento com frio; casa cheia e confirmada | — | `desnecessaria` | Nenhuma pergunta |
  | 3 | Momento; Minha casa vazia | Tenho a tudo | `necessaria` | Pergunta de casa, com até 5 itens |
  | 4 | "Manga é boa para Pitta?" | — | `desnecessaria` | Nenhuma pergunta |
  | 5 | Como o 1, respondendo Não tenho a tudo | Não tenho a tudo | — | Entrega sem os itens; nenhuma segunda pergunta sobre os mesmos |
  | 6 | Como o 1, respondendo Não gosto a um item | Não gosto ao primeiro, Tenho aos outros | — | O item não aparece em sugestão nem no texto |
  | 7 | Item de "evitar sempre" entre os que serviriam | Tenho a tudo | `desnecessaria` | O item nunca é perguntado |
  | 8 | "Tô com dor de cabeça", respondendo `latejante` | `[{ tipo: "variante", variante: "latejante" }]` | — | Pausa sem chamada de `decisao`; sugestão que refresca; aviso de incômodo |

  "Tenho a tudo" e "Não tenho a tudo" são respostas montadas na hora com os itens da pergunta: o campo `respostas` aceita também uma função `(p: Pergunta) => RespostaDaPessoa` (acrescente ao tipo da T17 se ainda não aceitar, no mesmo arquivo de tipos). No caso 7, use um alimento de "evitar sempre" do perfil que seja ingrediente de um candidato bom para frio (confira na base). Os ids de alimentos, o incômodo `dor-de-cabeca` e a variante `latejante` têm que existir na base; se algum não existir, pare e diga qual.
- testes primeiro: `casosC2` tem 28 casos (20 de Intenção + 8 de Perguntas), ids únicos; os 8 novos são `tipo: "conversa"` com `mensagem`; `--listar` do `c2-conversa` mostra 12 + 28; cada expectativa de `expectativas.ts` tem um teste com um resultado pronto que passa e outro que falha.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`; `npm run eval:llm -- --checkpoint c2-conversa --listar` (sem rede, código 0, 40 casos). **Não** rode a rodada com modelo.
- pronto quando: os testes passam e a listagem mostra os 40 casos.
- fora: rodada ⚠️ do `c2-conversa` (fechamento da 011).

### L1 · Test the invalid pause branch of the run end
- nivel: mecanica
- objetivo: cobrir por teste o ramo `pausa_invalida` de `src/core/agents/companion/fim-do-run.ts` (conteúdo de pausa que não passa em `conteudoDaPendenciaSchema` leva o run a `failed` com a etapa `pausa_invalida` e a saída segura).
- arquivos: `src/core/agents/companion/fim-do-run.test.ts` (novo). Só teste; não mude código de produção. Se o ramo não for alcançável sem mudar produção, pare e diga por quê.
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: os de `fim-do-run.ts` como estão (`criarFimDoRun().tratar`). Monte as dependências com `createMemoryStores`, `createMemoryTelemetry`, `createFixedClock` e o serviço de runs, como `responder.test.ts` faz.
- testes primeiro: (1) fim `pausa` com conteúdo inválido → run `failed`, etapa `pausa_invalida`, resposta com `origem: "segura"` e o aviso "Não é orientação médica"; (2) fim `pausa` com conteúdo válido → run `waiting_for_input`, sem `saida`.
- comandos: `npm run lint` (ou `rtk bypass npm run lint`), `npm run typecheck`, `npm test`
- pronto quando: os dois testes passam.
- fora: qualquer arquivo além do teste novo.

## Fechamento

O que o orquestrador faz ao fechar a spec 009, depois da T18 aprovada:

1. **Verificação do repositório inteiro** pelo verificador: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run dup` (0 clones), `npm run build`; os 16 cenários de `npm run demo -- --cenario <nome>` com código 0; `printf 't\nn\n' | npm run demo -- --cenario casa-incerta --interativo` com código 0; `npm run eval:llm -- --checkpoint c2-conversa --listar` com 40 casos. ⚠️ `npm run test:db` com o Postgres no ar (a T3 mexe na porta de runs: `mudarStatusSe`).
2. **⚠️ `demo` com LLM** (a spec pede): `npm run demo -- --cenario casa-incerta --llm --interativo`, rodado uma vez pelo orquestrador, respondendo no terminal (ou por pipe, D18). Anotar no relatório da entrega: se o agente perguntou, que itens, a resposta dada, se a entrega passou no validador e os tokens.
3. **ADRs novas** (decisão de arquitetura nova = ADR nova; 0028 e 0029 são da 008):
   - `0030-formato-do-checkpoint-e-da-pendencia.md` · "Formato do checkpoint e da pendência de pergunta": checkpoint da 005 com `dados` do preparo (`perguntas`, `nao_come_do_run`, `candidatos_completos` só com ids, D10/D11); pendência `pergunta` com `origem: "agente" | "codigo"` e `anotacoes` (D8); pausa de código sem checkpoint, com a entrada do Acompanhante na pendência; os dados atualizados gravados no checkpoint antes de retomar (D7). É a ADR que a definição de pronto da spec pede.
   - `0031-perguntas-fechadas-montadas-por-codigo.md` · "Perguntas fechadas, com texto montado por código, e variante perguntada antes do agente": três tipos (`casa`, `come`, `variante`), recusas em código como resultado de tool contando no teto de recusas, limite de 2 por run contando a variante, `resumo` da pausa no `ResultadoDeControle` (D4).
   - `0032-resposta-gravada-antes-de-retomar.md` · "Resposta à pergunta gravada na hora, antes de retomar, com troca de status condicional": `mudarStatusSe` adiantada da 010 (D3), ordem do `continuar` (D5), gravação numa transação sem bloco de aprovação, expiração conferida no `continuar`, totais do run preservados na retomada (D9).
   - Atualizar `.adrs/README.md` com as três.
4. **Docs** (só o que divergir do construído; sem "por enquanto" nem histórico):
   - `AI.md` §4 ("Controle": `ask_user` com os códigos de recusa e o resultado da tool; o validador com a mensagem nova de `fora_de_casa`) e §7 (pausa de código, `continuar`, gravação na hora, expiração conferida no pedido); §3 "Preparo" (`entregaveis`, `depende_de_pergunta`, no máximo 2 refeições perguntáveis).
   - `BUSINESS.md` §9 ("Minha casa": resposta a pergunta grava na hora; "O que fez falta": "Não tenho" a pergunta conta) e §12 (nenhuma pergunta sobre saúde, motivo, gestação, doença ou remédio), se divergir.
   - `KNOWLEDGE.md` §3.1 (a coluna "Variante (pergunta do agente)" passa a dizer que a pergunta é do código).
   - `ARCHITECTURE.md` §3 (fluxo: `continuar` como a entrada da resposta a uma pergunta; a rota é da 018) e §6, se divergir (pendência com origem).
   - `OBSERVABILITY.md` §3 (etapa `pergunta` com `resumo` `casa: N itens` | `come` | `variante`; evento `pausa` também na pausa de código).
   - `QA.md` (lista `evals/det/pausas/`; família Perguntas no `c2-conversa`, 12 + 28 casos, e as três métricas novas).
   - `ROADMAP.md` §0 atualizado.
5. **`AGENTS.md`**, tabela de comandos:
   - `npm run demo`: acrescentar que os cenários com pausa imprimem a pergunta com as opções numeradas e a resposta usada, e `npm run demo -- --cenario <nome> --interativo` (lê a resposta do terminal: na de casa, `t`, `n`, `g` ou Enter por item; nas outras, o número da opção ou Enter).
   - Linha ⚠️ do `demo --llm`: acrescentar que combina com `--interativo`.
6. **Spec:** `status: implemented` com o hash do último commit; marcar os critérios de aceite; atualizar `.specs/README.md` se ele listar o status. Registrar em `.plans/DECISOES-AUTONOMAS.md` que o risco anotado na 005 · T5 (atualização sem condição em `continuarRun`) foi resolvido pela T3 (D3).
