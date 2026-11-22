# Plano · 026 · Finalizar enxuto e rodada limpa

Spec: `.specs/026-finalizar-enxuto-e-rodada-limpa.md`. Estado em `.plans/entrega-3-estado.md`.

Decisões de plano (registradas em `.plans/DECISOES-AUTONOMAS.md`, 026 A1 e A2):

- **026 A1 · Fim por montagem.** O loop ganha uma quarta forma de `ResultadoDeControle`, `{ tipo: "encerrar"; codigo: string; resumo?: string }`, que vira `FimDoTrecho` `{ tipo: "erro", codigo }`. É o jeito mínimo de `finalizar` fechar o run com a `segura` sem voltar ao modelo. O resto do loop não muda.
- **026 A2 · Rota de modelo com chave.** O roteador devolve como `modelo` o id da rota: `<modelo>` com uma chave só, `<modelo>@<n>` com mais de uma. `separarRota(rota)` (core) devolve `{ modelo, chave }`; os adaptadores (Gemini e Mastra) usam o modelo sem sufixo e a chave `n`. Telemetria usa o modelo sem sufixo.

## Tarefas

### T1 · Build the lean finalizar input and the assembly from candidates
- nivel: nucleo
- objetivo: criar `EscolhaDoModelo`, `completarEntrega` e a divisão das violações em "do modelo" e "de montagem", sem ainda trocar a entrada de `finalizar`.
- arquivos: `src/core/agents/companion/saida.ts`, `src/core/agents/companion/saida.test.ts`, `src/core/agents/companion/completar.ts` (novo), `src/core/agents/companion/completar.test.ts` (novo), `src/core/agents/companion/validador.ts`, `src/core/agents/companion/validador.test.ts`
- depende de: nenhuma
- leitura: `.docs/AI.md` §3 "Saída do Acompanhante" (já descreve o resultado)
- skills: nenhuma
- contratos (copiados da spec):
  ```ts
  // saida.ts
  const escolhaDeVagaSchema = z.object({
    funcao: funcaoSchema,
    alimento_id: z.string().describe("Um alimento_id de opcoes[funcao] do candidato."),
  })
  const trocaSchema = z.object({
    alimento_id: z.string().describe("Item da sugestão que está incerto em casa."),
    se_faltar: z.string().describe("Substituto confirmado em casa."),
  })
  const sugestaoEscolhidaSchema = z.object({
    tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
    id: z.string().describe("O id de um candidato do contexto."),
    escolhas: z.array(escolhaDeVagaSchema).optional()
      .describe("Só refeição: troca o item padrão de uma vaga por uma das opcoes."),
    trocas: z.array(trocaSchema).optional(),
    motivo: z.string(),
  })
  export const escolhaDoModeloSchema = z.object({
    resposta: z.string(),
    sugestoes: z.array(sugestaoEscolhidaSchema),
    incertos: z.array(z.string()),
    para_ter: z.literal(true).optional()
      .describe("true para mencionar o para_ter do contexto; omita se não houver ou não couber."),
  })
  export type EscolhaDoModelo = z.infer<typeof escolhaDoModeloSchema>
  // entregaDoModeloSchema e EntregaDoModelo continuam como estão (tipo interno).

  // completar.ts
  export type ContextoDaMontagem = { dados: DadosDoPreparo; clima?: { gunas: Guna[] }; kb: KnowledgeBase }
  export type Montagem =
    | { ok: true; entrega: EntregaDoModelo }
    | { ok: false; violacoes: Violacao[] } // só do modelo: fora_dos_candidatos, estrutura (escolha fora das opcoes / candidato sem opcoes / escolhas em prática / funcao que o preparo não tem), para_ter (true sem para_ter no contexto)
  export function completarEntrega(e: EscolhaDoModelo, ctx: ContextoDaMontagem): Montagem
  /** Reescreve `onde` e `mensagem` das violações do modelo em termos da escolha (`sugestoes[i].escolhas[j]`, `sugestoes[i].trocas[k]`, `sugestoes[i]`), nunca `itens[j].contribui`. */
  export function emTermosDaEscolha(v: Violacao[], e: EscolhaDoModelo, entrega: EntregaDoModelo): Violacao[]

  // validador.ts
  export type CodigoDeViolacao = /* os atuais */ | "fora_dos_candidatos"
  export type Violacao = { codigo: CodigoDeViolacao; onde: string; mensagem: string; origem: "modelo" | "montagem" }
  export const DE_MONTAGEM: readonly CodigoDeViolacao[] = ["qualidades", "novidade", "linha_base", "para_ter", "texto_sem_estrutura"]
  // e "estrutura" quando aponta prática (itens diferentes dos ingredientes) também é origem "montagem".
  // Todo o resto é "modelo": fora_da_base, fora_dos_candidatos, estrutura de refeição (vaga obrigatória vazia, item que não serve à vaga), fora_de_casa, evitar_sempre, restricao, nao_come, nao_gosta, contraindicacao, combinacao, repetida, tamanho, vazia, dosagem.
  // Nenhuma checagem sai do validador.
  ```
  Regras de montagem (`completarEntrega`):
  | Campo de `EntregaDoModelo` | De onde vem |
  |---|---|
  | `resposta`, `incertos` | Da escolha, sem mudança |
  | `explicacao` | `qualidades_do_momento` = `dados.qualidades.presentes` (o bloco que o contexto chama `momento`) + gunas do clima do run; `qualidades_buscadas` = `momento.buscadas` + o oposto de cada guna do clima; sem repetição (a mesma regra que o validador aceita hoje; procure a função de oposto já existente). Sem clima: só o que vem de `momento` |
  | `sugestoes[i].tipo`, `pratica_id` ou `preparo_id` | Do candidato de `dados.candidatos` com o mesmo `id` (`tipo === "refeicao"` → `preparo_id`; os outros → `pratica_id`). `id` fora de `dados.candidatos` → `fora_dos_candidatos`, com a lista de ids aceitos na mensagem |
  | `sugestoes[i].itens` | `candidato.itens`; cada `escolhas[k]` troca o item da mesma `funcao` pela opção de mesmo `alimento_id` em `candidato.opcoes[funcao]`; `contribui` e `linha_base` vêm do item ou da opção; `se_faltar` vem de `trocas` (troca para item confirmado em casa é ignorada; substituto fora de casa fica para o validador apontar `fora_de_casa`) |
  | `sugestoes[i].motivo` | Da escolha |
  | `sugestoes[i].linhas_base` | `[candidato.linha_base]` |
  | `sugestoes[i].novidade` | `candidato.novidade` |
  | `evitar` | `dados.qualidades.evitar.itens` → todas as linhas (`linha_base`) |
  | `citados` | Alimentos e práticas da base que aparecem na `resposta` e não estão nas sugestões, pelo mesmo casamento de nomes de `checarTextoSemEstrutura` (reaproveite a função, não duplique), até `config.resposta.maxCitados` |
  | `para_ter` | `dados.para_ter` (`alimento_id`, `vezes`, `contribui`, `linha_base`) quando a escolha traz `para_ter: true`; `true` sem `dados.para_ter` → violação `para_ter`, do modelo |
  Mesmo `id` duas vezes: não trate aqui; o validador aponta `repetida`. Candidato sem `opcoes` e escolha com `escolhas`: `estrutura` com a mensagem "esse candidato não tem opções; use o item padrão".
- testes primeiro: `completar.test.ts` com: para cada candidato de cada fixture de preparo usada em `preparo.test.ts`/`contexto.test.ts`, a escolha mínima `{ resposta, sugestoes: [{ tipo, id, motivo }], incertos: [] }` passa por `completarEntrega` e `validarEntrega` sem violação `origem: "montagem"`; `id` fora dos candidatos; escolha de vaga fora das `opcoes`; `escolhas` em prática; candidato sem `opcoes`; `para_ter: true` sem `para_ter`; `para_ter: true` com `para_ter` copia os campos; `citados` derivados da fala e filtro de evitar sempre ainda apontado; clima ausente; `emTermosDaEscolha` reescreve `onde`. `validador.test.ts`: cada código tem a `origem` certa; `estrutura` de prática é montagem e de refeição é modelo.
- comandos: `npm test`, `npm run typecheck`, `rtk bypass npm run lint`
- pronto quando: gates verdes; `finalizar.ts` ainda compila sem mudança (o campo `origem` é aditivo).
- fora: `finalizar.ts`, loop, prompts, evals.

### T2 · Write the acompanhante.v8 prompt
- nivel: nucleo
- objetivo: prompt `acompanhante.v8` a partir do `v7`, sem instruções de cópia, com os campos novos de `finalizar` e os nomes reais `momento.*`; vira o ativo.
- arquivos: `src/core/agents/prompts/acompanhante.v8.ts` (novo), `src/core/agents/prompts/acompanhante.v8.test.ts` (novo), `src/core/agents/companion/agente.ts`, `src/core/agents/companion/agente.test.ts`, `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts`, `scripts/eval-llm.ts`, `scripts/lib/evals/eval-llm.test.ts` (só a troca de `v7` por `v8` nesses quatro últimos, e o que trava a versão)
- depende de: nenhuma
- leitura: nenhuma (o `v7` é a base; `src/core/agents/companion/contexto.ts` mostra o JSON de `montarMensagemInicial`)
- skills: nenhuma
- contratos: `versao: "acompanhante.v8"`. Não apague o `v7`. O `v8` não contém a sequência `qualidades.`; cita `momento.presentes`, `momento.buscadas`, `momento.conflitos`, `momento.evitar`. Descreve `finalizar` com a entrada abaixo e diz que o resto (itens, `contribui`, `linha_base`, `linhas_base`, `novidade`, `explicacao`, `evitar`, `citados`, campos do `para_ter`) é montado pelo código:
  ```
  { resposta, sugestoes: [{ tipo, id (de um candidato), escolhas?: [{ funcao, alimento_id (de opcoes[funcao]) }] (só refeição, só para trocar o item padrão), trocas?: [{ alimento_id, se_faltar }], motivo }], incertos, para_ter?: true }
  ```
  Mantém tudo o que é julgamento do `v7`: tom, conflitos, padrões, chá genérico, sem clima, pergunta, propostas, `resultado.registrar`. Sugestão só de `candidatos`.
- testes primeiro: `acompanhante.v8.test.ts`: não contém `qualidades.`; todo caminho `momento.<campo>` citado no prompt existe no JSON montado por `montarMensagemInicial` com uma fixture de preparo (parse do JSON da mensagem); cita `finalizar`, `escolhas`, `trocas`, `para_ter`; não manda copiar `linha_base`/`contribui`/`novidade`.
- comandos: `npm test`, `npm run typecheck`, `rtk bypass npm run lint`
- pronto quando: gates verdes; `agente.ts` e `conversar.ts` usam o `v8`.
- fora: `finalizar.ts`, `saida.ts`, o `v7`.

### T3 · Route each model through up to three Gemini keys
- nivel: nucleo
- objetivo: `ModelRouter` e adaptadores com até três chaves (só desenvolvimento), uma cota por modelo × chave, mesmo modelo na chave seguinte antes de trocar de modelo.
- arquivos: `src/core/llm/router.ts`, `src/core/llm/router.test.ts`, `src/core/llm/fornecedor.ts`, `src/core/llm/rota.ts` (novo), `src/core/llm/rota.test.ts` (novo), `src/infra/gemini/client.ts` (e o teste dele), `src/infra/mastra/runtime.ts` (e o teste dele), `src/infra/container.ts`, `src/infra/container.test.ts`, `src/infra/env.ts`, `src/infra/env.test.ts`, `.env.example`, `scripts/runtime-real.ts`, `scripts/modelos-check.ts`, e testes que travam o catálogo de env (`scripts/lib/env-producao.test.ts`, `scripts/lib/env-report.test.ts`) se travarem contagem
- depende de: nenhuma
- leitura: `.docs/AI.md` §10 "O roteador (`ModelRouter`)"
- skills: `mastra` (por `src/infra/mastra/runtime.ts`)
- contratos:
  ```ts
  // env.ts (catálogo)
  { name: "GEMINI_API_KEY_2", entrega: 3, obrigatoria: false, producao: "local",
    descricao: "Chave de outro projeto do Google, só para os evals com LLM" },
  { name: "GEMINI_API_KEY_3", entrega: 3, obrigatoria: false, producao: "local",
    descricao: "Chave de outro projeto do Google, só para os evals com LLM" },
  // rota.ts
  export function rotaDe(modelo: string, chave: number, totalDeChaves: number): string // "<modelo>" se totalDeChaves === 1, senão "<modelo>@<n>"
  export function separarRota(rota: string): { modelo: string; chave: number } // sem sufixo → chave 1
  // router.ts
  export type Troca = { papel: Papel; de: string; para: string; motivo: "cota" | "429"; chave_de?: number; chave_para?: number }
  type Deps = { ledger; clock; telemetry; cotas?; chaves?: readonly number[] } // padrão [1]; ex. [1, 2, 3]
  ```
  A fila de um papel é, para cada modelo de `llmCotas.papeis[papel]`, as chaves configuradas na ordem. `FornecedorDeModelo.proximo()` devolve em `modelo` o id da rota. O `UsageLedger` grava com a chave = id da rota (`<modelo>@<n>` com mais de uma chave; `<modelo>` com uma só: o banco de produção não muda); limites do modelo sem sufixo valem para cada rota. 429 / cota tira só a rota. As métricas e logs (`ritu_llm_cota_usada`, `ritu_llm_troca_de_modelo_total`, `troca_de_modelo`) usam o rótulo `modelo` sem sufixo; troca entre chaves do mesmo modelo preenche `chave_de`/`chave_para`. `preferir` aceita id de rota ou modelo puro. Adaptadores: `createGeminiClient({ apiKey: (chave: number) => string })` e `createMastraRuntime({ apiKey: (chave: number) => string })`, com `separarRota` na hora da chamada (SDK do Gemini guardado por chave). `container.ts`: chaves = `[1]` + `2` se `GEMINI_API_KEY_2` presente + `3` se `GEMINI_API_KEY_3` presente; a chave 1 é `GEMINI_API_KEY`. Sem as variáveis novas, tudo igual a hoje: os testes atuais de `router.test.ts` passam sem mudança. Não citar as variáveis em `DEPLOY.md`.
- testes primeiro: `router.test.ts` (casos novos, os antigos intactos): com `chaves: [1,2,3]`, 429 na chave 1 passa para a chave 2 do mesmo modelo; cota esgotada nas três passa para o modelo seguinte; ledger recebe `<modelo>@2`; métrica sem sufixo; com `chaves` omitido, ledger recebe `<modelo>`. `rota.test.ts`. Teste do Gemini client e do runtime: rota `m@2` usa a chave 2 e o modelo `m`.
- comandos: `npm test`, `npm run typecheck`, `rtk bypass npm run lint`, `npm run env:check`
- pronto quando: gates verdes; `.env.example` lista as duas variáveis novas.
- fora: `config/llm-cotas.ts`, `DEPLOY.md`, runner de evals.

### T4 · Classify inconclusive eval cases
- nivel: mecanica
- objetivo: cada caso do runner termina `acertou`, `falhou` ou `inconclusivo`, com o motivo, a partir do que o runner colhe do run.
- arquivos: `scripts/lib/evals/resultado.ts`, `scripts/lib/evals/inconclusivo.ts` (novo), `scripts/lib/evals/inconclusivo.test.ts` (novo), `scripts/lib/evals/rodar-run.ts`, `scripts/lib/evals/rodar-apoio.ts`, `scripts/lib/evals/rodar-apoio.test.ts`
- depende de: nenhuma
- leitura: `.docs/QA.md` "Checkpoints" (regras da rodada)
- skills: nenhuma
- contratos:
  ```ts
  export type EstadoDoCaso = "acertou" | "falhou" | "inconclusivo"
  export type MotivoInconclusivo =
    | "banco"               // erro de conexão com o Postgres (ex.: AggregateError, ECONNREFUSED)
    | "sem_etapas"          // o caso terminou com erro antes da 1ª etapa
    | "cota"                // fim do run por indisponivel, ou 429/cota em alguma chamada do run
    | "juiz_indisponivel"   // a entrega passou no validador e o Juiz não respondeu
    | "timeout_sem_decisao" // timeout antes de qualquer chamada de decisao concluída
  // ResultadoDoCaso ganha: estado: EstadoDoCaso; inconclusivo?: MotivoInconclusivo
  // `acertou` continua (true só com estado "acertou"), para não quebrar o andamento já gravado.
  export function classificarCaso(p: { erro?: string; etapas: Colhido["etapas"]; houveCotaOu429: boolean; fim?: string; juiz?: "aprovado" | "reprovado" | "indisponivel"; validouOk: boolean; chamadasDeDecisao: number }): { estado: EstadoDoCaso; inconclusivo?: MotivoInconclusivo }
  ```
  `rodar-run.ts` e `rodar-apoio.ts` preenchem `estado` e `inconclusivo` em todo resultado (o que precisar de sinal novo — 429 visto, fim do run — vem do que já é colhido: etapas, trocas, erro). Um caso inconclusivo nunca vira `acertou`.
- testes primeiro: `inconclusivo.test.ts`, um caso por motivo e os de controle (`falhou` com violação, `acertou`).
- comandos: `npm test`, `npm run typecheck`, `rtk bypass npm run lint`
- pronto quando: gates verdes; todo `ResultadoDoCaso` produzido tem `estado`.
- fora: métricas, relatório, rodada, comando (T8); `rodar-run.test.ts` (fica com T9); `src/`.

### T5 · Swap finalizar to the model's choice and end on assembly errors
- nivel: nucleo
- objetivo: `finalizar` recebe `EscolhaDoModelo`, monta, valida, e com violação de montagem fecha o run com a `segura` sem voltar ao modelo.
- arquivos: `src/core/agents/tools/finalizar.ts`, `src/core/agents/tools/finalizar.test.ts`, `src/core/runs/agente.ts`, `src/core/runs/loop-passo.ts`, `src/core/runs/loop.test.ts`, `src/core/agents/companion/fim-do-run.ts`, `src/core/agents/companion/fim-do-run.test.ts`
- depende de: T1
- leitura: `.docs/AI.md` §3 "O loop"
- skills: nenhuma
- contratos: fluxo: `escolhaDoModeloSchema` (é o `input`) → `completarEntrega` (violações do modelo voltam: `recusar` com `{ entregue: false, violacoes }` em termos da escolha) → `validarEntrega` → com alguma `origem: "montagem"`: `{ tipo: "encerrar", codigo: "montagem", resumo: "erro_de_montagem" }`; só do modelo: `recusar` com `emTermosDaEscolha(...)`, contando como entrega recusada, como hoje. Sem violação: `completarSaida(entrega, dados, kb)` e propostas, como hoje. `ResultadoDeControle` ganha `| { tipo: "encerrar"; codigo: string; resumo?: string }` (026 A1): despacho da etapa `validacao` com status `falhou` e o resumo `erro_de_montagem`; `aplicarControle` devolve `{ tipo: "erro", codigo }`, e `fim-do-run` sai com `segura`, logando `resposta_segura` com `motivo: "montagem"` (run `failed`, erro `montagem`). Métrica `ritu_validacao_violacoes_total` continua por código.
- testes primeiro: `finalizar.test.ts`: escolha mínima entrega; `id` fora dos candidatos recusa com `fora_dos_candidatos`; violação do modelo traz `onde` em termos da escolha; violação de montagem (forçada com dados de preparo inconsistentes ou um `completarEntrega` falso injetável) devolve `encerrar`. `loop.test.ts`: controle `encerrar` fecha o trecho com `erro` e a etapa `validacao` `falhou` `erro_de_montagem`. `fim-do-run.test.ts`: `resposta_segura` com `motivo: "montagem"`.
- comandos: `npm test -- src/core/agents/tools src/core/runs src/core/agents/companion/fim-do-run`, `npm run typecheck` (vai acusar os arquivos das tarefas T6 a T9 da mesma onda: ignore os de fora da sua lista), `rtk bypass npm run lint`
- pronto quando: os testes dos arquivos desta tarefa passam.
- fora: todos os outros testes e evals que chamam `finalizar` (T6 a T9, na mesma onda).

### T6 · Move the core tests to the model's choice
- nivel: nucleo
- objetivo: os testes de `src/` que chamam `finalizar` (runtime roteirizado) passam a mandar `EscolhaDoModelo` em vez da entrega inteira.
- arquivos: todo `src/**/*.test.ts` que monta a entrada de `finalizar`, menos os da T5. Hoje: `src/core/agents/companion/agente.test.ts`, `dosagem.test.ts`, `juiz-do-run.test.ts`, `responder.test.ts`, `saida.test.ts` (só se chamar `finalizar`), `validador.test.ts` (só se chamar `finalizar`), `src/core/agents/tools/ask-user.test.ts`, `src/core/como-pensei/ler.test.ts`, `src/core/como-pensei/linha-do-tempo.test.ts`, `src/core/conversation/continuar.test.ts`, `conversar.test.ts`, `etapas.test.ts`, `src/core/runs/run-service.test.ts`, e helpers de teste/fixtures em `src/` que montem essa entrada (procure `"finalizar"` e `argumentos`)
- depende de: T1, T2 (agente.test e conversar.test já com `v8`)
- leitura: nenhuma
- skills: nenhuma
- contratos: a entrada nova (`EscolhaDoModelo`, em `src/core/agents/companion/saida.ts`): `{ resposta, sugestoes: [{ tipo, id, escolhas?, trocas?, motivo }], incertos, para_ter?: true }`; `id` tem de ser de um candidato do `dados.candidatos` do run de teste. Se um teste só verificava campo copiado (`contribui`, `linha_base`, `novidade`, `qualidades`), passe a verificar o campo montado na saída. Não mude a intenção de nenhum teste; se um teste dependia de sugestão fora dos candidatos, troque por um candidato da fixture.
- testes primeiro: n/a (migração); rode os arquivos antes para ver o que quebra.
- comandos: `npm test -- src/` (os arquivos desta tarefa), `rtk bypass npm run lint`
- pronto quando: os testes desta lista passam com a T5 aplicada.
- fora: código de produção em `src/` (exceto helpers de teste), `evals/`, `e2e/`, `scripts/`.

### T7 · Move the deterministic evals (acompanhante, aprendizado, aprovacao, guardrails) to the model's choice
- nivel: mecanica
- objetivo: os evals destas pastas que mandam a entrada de `finalizar` passam a mandar `EscolhaDoModelo`; os que leem campos copiados passam a ler o campo montado.
- arquivos: `evals/det/acompanhante/**`, `evals/det/aprendizado/**`, `evals/det/aprovacao/**`, `evals/det/guardrails/**` (e helpers delas)
- depende de: T1
- leitura: nenhuma
- skills: nenhuma
- contratos: os mesmos da T6. `validador.eval.ts` que chama `validarEntrega` direto com `EntregaDoModelo` continua com a entrega (é o tipo interno), só acrescente o que o campo `origem` pedir.
- testes primeiro: n/a (migração).
- comandos: `npm run eval:det -- evals/det/acompanhante evals/det/aprendizado evals/det/aprovacao evals/det/guardrails`, `rtk bypass npm run lint`
- pronto quando: essas pastas passam com a T5 aplicada.
- fora: outras pastas de `evals/det/`, `src/`.

### T8 · Move the deterministic evals (loop, modelos, pausas) to the model's choice
- nivel: mecanica
- objetivo: idem T7, nas pastas `loop`, `modelos` e `pausas`.
- arquivos: `evals/det/loop/**`, `evals/det/modelos/**`, `evals/det/pausas/**` (e helpers delas)
- depende de: T1, T3
- leitura: nenhuma
- skills: nenhuma
- contratos: os mesmos da T6.
- testes primeiro: n/a (migração).
- comandos: `npm run eval:det -- evals/det/loop evals/det/modelos evals/det/pausas`, `rtk bypass npm run lint`
- pronto quando: essas pastas passam com a T5 aplicada.
- fora: outras pastas de `evals/det/`, `src/`.

### T9 · Move the e2e scripts, demo scenarios and runner tests to the model's choice
- nivel: mecanica
- objetivo: roteiros do modo e2e, cenários do `demo`/`loop:demo` e testes do runner que mandam a entrada de `finalizar` passam a mandar `EscolhaDoModelo`.
- arquivos: `e2e/roteiros/*.ts`, `scripts/loop-demo.ts`, `scripts/lib/demo-report.test.ts`, os cenários roteirizados de `scripts/lib/` que chamam `finalizar` (procure `"finalizar"`), `scripts/lib/evals/colher.test.ts`, `scripts/lib/evals/rodar-run.test.ts`
- depende de: T1, T4
- leitura: nenhuma
- skills: nenhuma
- contratos: os mesmos da T6. Os roteiros do e2e são escritos contra o seed: o `id` sai dos candidatos que o preparo calcula para o seed (o `src/infra/e2e/roteiros.test.ts` roda cada roteiro pela conversa inteira e é o teste deles). `rodar-run.test.ts` também passa a conferir `estado` nos resultados.
- testes primeiro: n/a (migração).
- comandos: `npm test -- src/infra/e2e scripts/`, `rtk bypass npm run lint`, `npm run demo -- --cenario <cada cenário>` (sem LLM)
- pronto quando: esses testes passam com a T5 aplicada; `npm run demo` roda todos os cenários sem erro.
- fora: `src/`, `evals/det/`.

### T10 · Leave inconclusive cases out of the metrics and rerun them on resume
- nivel: mecanica
- objetivo: métricas sem inconclusivos, relatório com a contagem e o cabeçalho completo/incompleto, e `--retomar` refazendo os inconclusivos e os que faltam.
- arquivos: `scripts/lib/evals/metricas.ts`, `metricas.test.ts`, `relatorio.ts`, `relatorio.test.ts`, `rodada.ts`, `rodada.test.ts`, `andamento.ts`, `andamento.test.ts`, `historico.ts`, `historico.test.ts` (só se o histórico precisar da contagem)
- depende de: T4, T9
- leitura: `.docs/QA.md` "Checkpoints" e "Registro da evolução"
- skills: nenhuma
- contratos: inconclusivos (`estado === "inconclusivo"`) não entram em nenhuma métrica de `calcularMetricas`. O relatório lista quantos foram e o motivo de cada um (id do caso e `MotivoInconclusivo`), e o cabeçalho diz "rodada completa" só com zero inconclusivos; senão "rodada incompleta: N inconclusivos". `--retomar` (andamento) roda de novo os resultados `inconclusivo` e os casos que faltam; os demais ficam. Andamento antigo sem `estado`: trate `acertou: true` como `acertou` e `false` como `falhou`.
- testes primeiro: métricas ignoram inconclusivo; cabeçalho completo/incompleto; retomada escolhe inconclusivos + faltantes.
- comandos: `npm test -- scripts/lib/evals`, `rtk bypass npm run lint`, `npm run typecheck`
- pronto quando: gates verdes.
- fora: `comando.ts` e a checagem prévia (T11).

### T11 · Check Postgres and each key before the first case
- nivel: mecanica
- objetivo: `npm run eval:llm` confere o Postgres e cada chave configurada antes do 1º caso, em toda rodada e retomada, e para com mensagem clara se algo falhar.
- arquivos: `scripts/lib/evals/checagem-previa.ts` (novo), `scripts/lib/evals/checagem-previa.test.ts` (novo), `src/infra/gemini/listar-modelos.ts` (novo) e teste, `scripts/lib/evals/comando.ts`, `scripts/eval-llm.ts`, `evals/det/evals-llm/checagem-previa.eval.ts` (novo)
- depende de: T3, T10
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  export type ChecagemPrevia = { banco: () => Promise<void>; chaves: { variavel: string; listar: () => Promise<void> }[] }
  export async function checarAntes(c: ChecagemPrevia): Promise<{ ok: true } | { ok: false; mensagem: string }>
  // mensagem diz qual parte falhou: "Postgres não respondeu (docker compose up -d)" ou "GEMINI_API_KEY_2 não respondeu à listagem de modelos". Uma chave inválida para a rodada; não segue só com as outras.
  ```
  `listar` usa a listagem de modelos do SDK do Gemini (`models.list`), uma chamada por chave configurada (`GEMINI_API_KEY` e, se presentes, `_2` e `_3`). `--listar` não checa nada (sem rede); `--caso` e rodadas checam. Falha: sai com código 2, sem criar andamento.
- testes primeiro: `checagem-previa.test.ts` (banco falha → para; chave 2 falha → para nomeando a variável; tudo ok); eval determinístico: checagem que para sem Postgres, com fakes, sem rede.
- comandos: `npm test -- scripts/lib/evals`, `npm run eval:det -- evals/det/evals-llm`, `rtk bypass npm run lint`, `npm run typecheck`
- pronto quando: gates verdes; o comando chama a checagem antes do 1º caso.
- fora: métricas e relatório.

### T12 · Cover the lean finalizar, the keys and the runner with deterministic evals
- nivel: mecanica
- objetivo: evals determinísticos novos da spec e o mapa atualizado.
- arquivos: `evals/det/acompanhante/montagem.eval.ts` (novo), `evals/det/acompanhante/prompt-v8.eval.ts` (novo), `evals/det/modelos/varias-chaves.eval.ts` (novo), `evals/det/evals-llm/inconclusivos.eval.ts` (novo), `evals/det/mapa.ts`, e a lista de evals determinísticos em `.docs/QA.md` (só as linhas destes arquivos e do `checagem-previa.eval.ts` da T11)
- depende de: T5, T7, T8, T10, T11
- leitura: `.docs/QA.md` "Evals determinísticos (sem LLM)" (só para achar onde listar)
- skills: nenhuma
- contratos: `montagem.eval.ts`: para cada candidato de cada fixture do preparo, escolha mínima `{ tipo, id, motivo }` passa por `completarEntrega` e `validarEntrega` sem violação de montagem; escolha fora dos candidatos (`fora_dos_candidatos` com a lista de ids); escolha de vaga fora das `opcoes` (`estrutura`); `para_ter: true` sem `para_ter` (`para_ter`, origem modelo); `citados` derivados da fala respeitando evitar sempre. `prompt-v8.eval.ts`: sem `qualidades.`, caminhos `momento.*` existentes no JSON de `montarMensagemInicial`. `varias-chaves.eval.ts`: três chaves, 429 na chave 1 passa para a chave 2 do mesmo modelo. `inconclusivos.eval.ts`: um caso por motivo de inconclusivo e métricas sem eles. `mapa.ts` com os arquivos novos (incluindo `evals/det/evals-llm/checagem-previa.eval.ts`).
- testes primeiro: os próprios evals.
- comandos: `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: `eval:det` verde; `mapa.eval.ts` verde.
- fora: código de produção.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2, T3, T4 | Sem dependências e sem arquivo em comum (montagem, prompt, roteador, runner) |
| 2 | T5, T6, T7, T8, T9 | A troca da entrada de `finalizar` quebra todo chamador; a troca e as migrações vão juntas, com arquivos separados, e os gates da onda conferem o conjunto |
| 3 | T10 | Métricas, relatório e retomada dependem do estado (T4) e de `rodar-run.test.ts` já migrado (T9) |
| 4 | T11 | Mexe em `comando.ts` e `eval-llm.ts`, depois do roteador (T3) e da T10 |
| 5 | T12 | Os evals novos usam tudo acima e mexem em `mapa.ts` e `QA.md` |

Fechamento (orquestrador): gates 1 a 6 e `dup`; ADR 0052; `AI.md` (já atualizado na aprovação; conferir), `QA.md`, `AGENTS.md` (comando `eval:llm`), `.specs/README.md`, `ROADMAP.md` §0; spec `implemented`; push; ⚠️ fumaça `--caso`; ⚠️ rodada `c3-confiavel` com `--extra` (autorizado na spec).

### T13 · Move the shared scenario fixtures to the model's choice (correção do plano)
- nivel: nucleo
- objetivo: os roteiros de `finalizar` em `test/fixtures/` (cenários usados por evals e testes) passam a mandar `EscolhaDoModelo`.
- arquivos: `test/fixtures/**` que monta a entrada de `finalizar` (hoje `test/fixtures/cenarios/*.ts` e helpers delas)
- depende de: T1, T5
- leitura: nenhuma
- skills: nenhuma
- contratos: os da T6. Conversão: `id` = `pratica_id` ou `preparo_id`; `trocas` = `se_faltar` de cada item (`{ alimento_id, se_faltar }`); `escolhas` só quando a troca de vaga for intencional; `para_ter: true` quando havia `para_ter`; saem `explicacao`, `evitar`, `citados`, `linhas_base`, `novidade`, `contribui` e `linha_base`. Todo `id` em `dados.candidatos` do cenário; onde o cenário testa sugestão fora dos candidatos de propósito, o id inválido fica (vira `fora_dos_candidatos`).
- testes primeiro: n/a (migração).
- comandos: `npm run eval:det`, `npm test`, `rtk bypass npm run lint` (falhas em arquivos de T6 a T9 ainda em curso são esperadas: compare com a linha de base)
- pronto quando: nenhum teste ou eval falha por causa de um cenário de `test/fixtures/`.
- fora: `src/`, `evals/det/`, `e2e/`, `scripts/`.
