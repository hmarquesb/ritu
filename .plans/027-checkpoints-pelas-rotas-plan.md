# 027 · Checkpoints pelas rotas · Plano

Spec: `.specs/027-checkpoints-pelas-rotas.md`. Entrega 4, construída na `main`, antes da 023.

Decisões do plano (registradas em `DECISOES-AUTONOMAS.md`, 027 A1 a A3):

- **A1** · Os casos de acompanhante (c1) entram por `entrada` estruturada, que nenhuma rota recebe. Pelas rotas, a primeira chamada deles continua em `companion.responder` (sem passo de rota); as pausas e o resto passam pelas rotas. Caso sem nenhum passo de rota não tem checagem `rota` e não entra no "M" de "Fluxo pelas rotas".
- **A2** · Qualquer rota com status ≠ 200 interrompe a rodada com `RotaFalhouError` (com os passos até ali); o caso fica `falhou` (nunca inconclusivo), com as expectativas como não cumpridas e a checagem de status falsa.
- **A3** · As checagens de `run_id` e de texto valem para a primeira parte da rodada (da mensagem até antes da segunda mensagem): é o run que o caso avalia.

### T1 · Give each checkpoint a target and register c4-site and c5-publico
- nivel: mecanica
- objetivo: os checkpoints passam a ter `pastas` e `alvo`; o `c4-site` e o `c5-publico` existem; quem lê `checkpoints` se ajusta; `--listar` mostra o alvo.
- arquivos: `evals/llm/checkpoints.ts`, `evals/llm/casos/index.ts` (`casosDoCheckpoint` lê `checkpoints[nome].pastas`), `scripts/lib/evals/casos.ts`, `scripts/lib/evals/casos.test.ts`, `scripts/lib/evals/historico.ts`, `scripts/lib/evals/historico.test.ts`, `scripts/lib/evals/comando.ts` (só onde lê `checkpoints[nome]` como lista de pastas), e os testes de `comando` que quebrarem por isso
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  // evals/llm/checkpoints.ts
  export type AlvoDoCheckpoint = "codigo" | "rotas"
  export const checkpoints = {
    "c1-base": { pastas: ["c1"], alvo: "codigo" },
    "c2-conversa": { pastas: ["c1", "c2"], alvo: "codigo" },
    "c3-confiavel": { pastas: ["c1", "c2", "c3"], alvo: "codigo" },
    "c4-site": { pastas: ["c1", "c2", "c3"], alvo: "rotas" },
    "c5-publico": { pastas: ["c1", "c2", "c3"], alvo: "rotas" },
  } as const satisfies Record<string, { pastas: readonly string[]; alvo: AlvoDoCheckpoint }>
  ```
  - em `scripts/lib/evals/casos.ts`: `export function alvoDoCheckpoint(nome: NomeDoCheckpoint): AlvoDoCheckpoint`.
  - `formatarListagem(checkpoint)` ganha uma linha `Alvo: código` ou `Alvo: rotas do site` (logo depois da linha do checkpoint/título, antes das famílias). O resto da listagem não muda.
  - A ordem do histórico continua a das chaves de `checkpoints` (c5-publico entra depois do c3-confiavel).
- testes primeiro:
  - `--listar` / `formatarListagem("c5-publico")` e `("c4-site")`: 86 casos, contagem por tipo, estimativa de chamadas e a linha "Alvo: rotas do site".
  - `formatarListagem("c3-confiavel")`: igual a hoje, mais a linha "Alvo: código".
  - `alvoDoCheckpoint` devolve o alvo de cada um dos cinco.
  - historico: uma entrada `c5-publico` acrescentada a um histórico com c1, c2, c3 fica depois do `c3-confiavel`; `c4-site` fica entre c3 e c5.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run scripts/lib/evals`
- pronto quando: testes acima verdes; `npm run eval:llm -- --checkpoint c5-publico --listar` imprime "Alvo: rotas do site" sem modelo nem rede.
- fora: `historico.json`, `evals/resultados/`, relatório, runners, `scripts/eval-llm.ts`.

### T2 · Run a scenario through the site route handlers
- nivel: nucleo
- objetivo: `containerDoCenario` monta o `Container` das rotas com as dependências do cenário, e `rodarCenarioPelasRotas` faz a mesma rodada de `rodarCenario`, mas cada passo é um `Request` entregue ao handler da rota; um teste prova a equivalência sem LLM.
- arquivos: `test/fixtures/cenarios/rotas.ts` (novo), `test/fixtures/cenarios/rotas.test.ts` (novo), `test/fixtures/cenarios/index.ts` (só a linha de exportação), e `test/fixtures/cenarios/rodar.ts` só para exportar `OpcoesDaRodada` (hoje é `type` local)
- depende de: nenhuma
- leitura: `src/app/_rotas/fluxo-de-run.test.ts` (como os testes chamam os handlers com `Request` e `DepsDaRota`), `test/fixtures/cenarios/rodar.ts` e `test/fixtures/cenarios/montar.ts` (a rodada que esta tarefa espelha)
- skills: nenhuma
- contratos:
  ```ts
  // test/fixtures/cenarios/rotas.ts
  // Container das rotas com as dependências do cenário; o `conversation` é embrulhado para guardar o que devolve.
  export function containerDoCenario(deps: DepsDoCenario): {
    container: Container
    devolvidos: Array<RespostaDaConversa | RespostaDoRun | ResultadoDaAprovacao>
  }

  export type PassoDeRota = {
    rota: string            // ex.: "POST /api/runs", "POST /api/runs/[id]/resposta"
    status: number
    eventos?: EventoDaTela[] // só nas rotas de fluxo (NDJSON)
    erroDeSchema?: string   // linha do NDJSON que não validou
  }

  export type RodadaPelasRotas = RodadaDoCenario & { passos: PassoDeRota[] }

  // Rota com status ≠ 200: a rodada para aqui; `passos` inclui o passo que falhou.
  export class RotaFalhouError extends Error {
    constructor(readonly passos: PassoDeRota[])
  }

  export async function rodarCenarioPelasRotas(
    deps: DepsDoCenario,
    contaId: string,
    c: Cenario,
    opts?: OpcoesDaRodada & { escopo?: string },
  ): Promise<RodadaPelasRotas>
  ```
  - Mapa dos passos de `rodarCenario` para os handlers (com `Request` de verdade, `http://eval/<caminho>`, método POST, corpo JSON, e `{ params: Promise.resolve({ id }) }` quando a rota tem `[id]`):

    | Passo | Handler | Corpo |
    |---|---|---|
    | Mensagem e segunda mensagem | `rotasDeFluxoDeRun(d).iniciar` (`POST /api/runs`) | `c.mensagem` / `c.depois.mensagem` (`mensagemRecebidaSchema`) |
    | Resposta a uma pausa | `rotasDeFluxoDeRun(d).responder` (`POST /api/runs/[id]/resposta`) | a `RespostaDaPessoa` |
    | Bloco de aprovação | `rotasDaConversa(d).aprovacao` (`POST /api/runs/[id]/aprovacao`) | `{ aprovadas: string[] }` |
    | Troca | `rotasDaConversa(d).troca` e `.respostaDaTroca` (`POST /api/runs/[id]/troca`, `/troca/resposta`) | `{ sugestao, alimento_id, motivo }` e `{ sugestao, alimento_id, candidato, resposta }` |
    | Toque de retorno | `rotasDaCasa(d).responderRetorno` (`POST /api/retornos/[id]`) | `{ resultado }` |
    | Toque de gosto | `rotasDaCasa(d).preferencias` (`POST /api/preferencias`) | `{ alimento_id, gosto }` |
  - `DepsDaRota` do cenário: `contaDaSessao: async () => contaId`; `quemPede: () => ({ ipHash: "eval", escopo: opts.escopo ?? c.nome, teto: 1000 })`; `container` de `containerDoCenario(deps)`.
  - `containerDoCenario`: todo campo que `DepsDoCenario` tem (clock, stores, telemetry, ledger, router, weather, runtime, llm, runs, companion, interpreter, judge, touches, memory, routine, patterns) vem do cenário; `conversation` é o do cenário embrulhado (`conversar`, `continuar` e `aprovar` empurram o que devolvem em `devolvidos`, sem mudar nada). `lerCasa`, `lerComoFicou` e o que as rotas leem do container usam os stores do cenário. Limitador em memória. Montar o container não pode ler `DATABASE_URL` nem chamar rede. Use `createContainer(overrides)` de `src/infra/container.ts` se ele permitir isso; senão, monte o objeto aqui. Não mude `src/`.
  - Cada resposta de fluxo (`application/x-ndjson`) vira `eventos`: cada linha não vazia é `JSON.parse` e validada no schema do evento da tela (`src/core/conversation/eventos.ts`; se não houver schema zod exportado, valide a forma mínima `{ tipo }` com os tipos de `EventoDaTela` e registre isso no relatório da tarefa). Linha que não valida vai em `erroDeSchema` (a primeira), e a rodada segue com as que validaram.
  - `final` de cada parte = o último `RespostaDaConversa | RespostaDoRun` empurrado em `devolvidos` (depois de `conversar`/`continuar`); `bloco.resultado` = o último `ResultadoDaAprovacao` empurrado. Pausas, teto `MAXIMO_DE_RETOMADAS`, escolha do bloco (`decidir` ou `c.aprovacao`), ordem dos toques, id do retorno (`semeado` ou `final.saida.sugestoes[i].retorno_id`) e segunda mensagem iguais a `rodarCenario`.
  - Cenário com `entrada` e sem `mensagem` (acompanhante): a primeira chamada é `deps.companion.responder` direto, sem passo de rota (não há rota para entrada estruturada); as pausas seguem pelas rotas.
  - Toque de gosto com `item.tipo !== "alimento"`: `deps.touches.tocarGosto` direto, sem passo (a rota só recebe alimento).
  - Status ≠ 200 em qualquer passo → `throw new RotaFalhouError(passos)`.
- testes primeiro (`rotas.test.ts`, runtime roteirizado e LLM falso, como os testes de `rodar.test.ts`):
  - **equivalência**: para cada cenário de `cenariosDeConversa`, `cenariosComPausa`, `cenariosComAprovacao`, `cenariosDeAprendizado`, `cenariosDeMemoria` e `cenariosDeGuardrails`, monta o cenário duas vezes (uma por rodada), roda `rodarCenario` e `rodarCenarioPelasRotas`, e compara `final`, `perguntas`, `bloco`, `toques` e `depois` com `toEqual`, depois de trocar ids (uuid) e datas ISO geradas por marcadores estáveis (função de normalização no próprio teste).
  - toda rodada pela rota tem `passos` com status 200, o primeiro evento de cada fluxo `inicio` e o último `fim`.
  - `quemPede` com `teto` baixo (opção de teste) faz o `POST /api/runs` responder 429 e a rodada lançar `RotaFalhouError` com o passo 429.
  - `RunAbertoError` (run aberto antes da segunda mensagem) → `RotaFalhouError` com o status do passo.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run test/fixtures/cenarios`
- pronto quando: equivalência verde para todos os cenários dos seis mapas; nenhum handler, `conversar`, `continuar` ou arquivo de `src/` mudou.
- fora: `src/`, `scripts/`, `evals/`.

### T3 · Add the route checks list and the target lines to the report
- nivel: mecanica
- objetivo: `Checagem` aceita a lista `rota`, e o relatório mostra o alvo e, com alvo `rotas`, quantos casos fizeram o fluxo íntegro.
- arquivos: `scripts/lib/evals/resultado.ts`, `scripts/lib/evals/relatorio.ts`, `scripts/lib/evals/relatorio.test.ts`, e todo schema zod de `scripts/lib/evals/` que valida o campo `lista` de uma checagem (procure com `grep -rn "nao_pode" scripts/lib/evals --include=*.ts`; ex.: `andamento.ts`), com o teste dele
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos:
  - `Checagem.lista` ganha `"rota"` (além das que já existem). `calcularAcertou` não muda: checagem `rota` falsa deixa o caso errado.
  - `Relatorio` (entrada de `formatarRelatorio`) ganha `alvo?: "codigo" | "rotas"` (importe `AlvoDoCheckpoint` de `evals/llm/checkpoints.ts` se o tipo já existir; senão, declare o literal). Ausente vale `"codigo"`.
  - Cabeçalho: linha `- Alvo: código` ou `- Alvo: rotas do site` logo depois da linha `- Modelos:`.
  - Com alvo `rotas`: linha `Fluxo pelas rotas: N de M casos íntegros` logo abaixo do resumo de uma linha (`linhaDeResumo`). M = casos com ao menos uma checagem `rota`; N = desses, os com todas as checagens `rota` verdadeiras. Com alvo `codigo`, a linha não sai.
  - Se o relatório lista checagens falhas por lista, as de `rota` aparecem como as outras (sem tratamento especial).
- testes primeiro:
  - relatório com alvo `codigo` (e sem alvo): tem "- Alvo: código" depois de "- Modelos:" e não tem "Fluxo pelas rotas".
  - relatório com alvo `rotas` e 3 casos (um íntegro, um com checagem `rota` falsa, um sem checagem `rota`): "- Alvo: rotas do site" e "Fluxo pelas rotas: 1 de 2 casos íntegros" logo abaixo do resumo.
  - caso com só a checagem `rota` falsa fica `acertou: false`.
  - o schema do andamento aceita uma checagem `rota`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run scripts/lib/evals`
- pronto quando: testes verdes; os relatórios gravados em `evals/resultados/` não foram tocados.
- fora: `comando.ts`, `casos.ts`, `historico.ts`, `checkpoints.ts`, runners.

### T4 · Run the run cases through the routes and check the route flow
- nivel: mecanica
- objetivo: `rodarAcompanhantePelasRotas` e `rodarConversaPelasRotas` rodam os casos de run pelas rotas, com o mesmo `CasoRodado` dos runners pelo código, mais as checagens da lista `rota`.
- arquivos: `scripts/lib/evals/rodar-rotas.ts` (novo), `scripts/lib/evals/rodar-rotas.test.ts` (novo), `scripts/lib/evals/rodar-run.ts`, `scripts/lib/evals/rodar-run.test.ts` (só se a refatoração pedir)
- depende de: T2, T3
- leitura: nenhuma
- skills: nenhuma
- contratos:
  ```ts
  // scripts/lib/evals/rodar-rotas.ts
  export async function rodarAcompanhantePelasRotas(
    caso: CasoC1,
    opts: { runtime: AgentRuntime; telemetria?: Telemetry },
  ): Promise<CasoRodado>
  export async function rodarConversaPelasRotas(
    caso: CasoConversa,
    opts: { runtime: AgentRuntime; llm: LlmClient; telemetria?: Telemetry },
  ): Promise<CasoRodado>
  // checagens da lista "rota", nesta ordem
  export function checagensDeRota(passos: PassoDeRota[], run: Run): Checagem[]
  ```
  - `PassoDeRota`, `RotaFalhouError` e `rodarCenarioPelasRotas` vêm de `test/fixtures/cenarios/rotas.ts` (T2). `rodarCenarioPelasRotas(deps, contaId, cenario, { ...opções de hoje, escopo: caso.id })`.
  - **Sem copiar código de `rodar-run.ts`** (o `npm run dup` não pode acusar clone): em `rodar-run.ts`, `rodarAcompanhante` e `rodarConversa` passam a aceitar em `opts`, opcionais, a função de rodada (padrão `rodarCenario`) e uma função `extras(rodada, run) => Checagem[]` (padrão nenhuma), somadas às checagens do caso; `rodar-rotas.ts` só compõe. Comportamento pelo código idêntico (os testes de `rodar-run.test.ts` continuam verdes sem mudança de expectativa).
  - `checagensDeRota(passos, run)` devolve, com `lista: "rota"`:
    1. status: `ok` se todo passo tem 200. Falsa: descrição `a rota barrou a conversa (429)` se algum passo é 429; `havia um run aberto (<status>)` se o passo que falhou é o 2º `POST /api/runs` com 409; senão `<rota> respondeu <status>`. Verdadeira: `toda rota respondeu 200`.
    2. `cada linha do NDJSON valida no schema do evento` (falsa se algum passo tem `erroDeSchema`).
    3. `cada fluxo começa com inicio e termina com fim` (todo passo com `eventos`).
    4. `o run_id do inicio é o do run gravado` (os `inicio` dos passos da primeira parte: do primeiro passo até antes do 2º `POST /api/runs`).
    5. `o texto da visão do fim é o da resposta do run` (o último `fim` da primeira parte: o texto da visão é igual ao texto da resposta gravada no run, o mesmo de `final.saida.texto`; ache os campos em `src/core/conversation/visao.ts` e `src/core/runs/ports.ts`).
    - Sem nenhum passo: `[]` (acompanhante cuja rodada não passou por rota).
  - `RotaFalhouError` vindo da rodada: o caso fica `estado: "falhou"` (nunca inconclusivo, mesmo sem etapas), `erro` = descrição da checagem de status, checagens = as do caso como não cumpridas (`deve` e `nao_pode` com `ok: false`, como o caso de pausa acima do teto) mais `checagensDeRota(e.passos, run?)` (sem run, as checagens 4 e 5 saem falsas).
  - As classes de inconclusivo da 026 (`banco`, `sem_etapas`, `cota`, `juiz_indisponivel`, `timeout_sem_decisao`) valem iguais: o erro que não é `RotaFalhouError` segue o caminho de hoje.
- testes primeiro (`rodar-rotas.test.ts`, sem LLM: runtime roteirizado e LLM falso, cenário pequeno de `test/fixtures/cenarios`):
  - `checagensDeRota`: tudo certo → 5 checagens `ok`; um passo 500 → status falsa com `<rota> respondeu 500`; 429 → `a rota barrou a conversa (429)`; linha inválida → 2 falsa; fluxo sem `fim` → 3 falsa; `run_id` diferente → 4 falsa; texto diferente → 5 falsa; sem passos → `[]`.
  - `rodarConversaPelasRotas` num cenário de conversa roteirizado: mesmas checagens `deve`/`nao_pode` que `rodarConversa` no mesmo caso, mais 5 `rota` verdadeiras.
  - rodada que lança `RotaFalhouError` com 429 → `estado: "falhou"`, sem `inconclusivo`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run scripts/lib/evals`, `npm run dup`
- pronto quando: testes verdes; `dup` sem clone novo; testes de `rodar-run.test.ts` sem expectativa alterada.
- fora: `test/fixtures/`, `src/`, `comando.ts`, `eval-llm.ts`, relatório.

### T5 · Pick the case runner by the checkpoint target
- nivel: mecanica
- objetivo: a rodada de um checkpoint com alvo `rotas` usa os runners pelas rotas nos casos de acompanhante e conversa, e o relatório recebe o alvo.
- arquivos: `scripts/eval-llm.ts`, `scripts/lib/evals/comando.ts`, `scripts/lib/evals/casos.ts` (só `Rodadores`/`criarRodarCaso`, se preciso), `scripts/lib/evals/eval-llm.test.ts` e os testes de `comando`/`casos` que mudarem
- depende de: T1, T3, T4
- leitura: nenhuma
- skills: nenhuma
- contratos:
  - `IoDoComando.rodarCaso(caso, alvo: AlvoDoCheckpoint)`: o comando passa `alvoDoCheckpoint(checkpoint)` (de `casos.ts`, T1) em toda chamada (rodada nova, `--retomar`, `--caso`).
  - `scripts/eval-llm.ts`: os rodadores dependem do alvo. `codigo` → `rodarAcompanhante`/`rodarConversa` (como hoje); `rotas` → `rodarAcompanhantePelasRotas`/`rodarConversaPelasRotas` (de `scripts/lib/evals/rodar-rotas.ts`), com os mesmos `opts`. Intérprete, memória e juiz não mudam. Um `criarRodarCaso` por alvo, criado na primeira vez que o alvo aparece.
  - O comando passa `alvo` ao `formatarRelatorio` (campo `alvo` do `Relatorio`, T3) em toda rodada que grava relatório.
  - `--retomar` recusa como hoje se casos, prompts ou modelos mudaram; o alvo vem do checkpoint, não do andamento.
- testes primeiro:
  - o comando com `--checkpoint c5-publico` (io falso) chama `rodarCaso` com `"rotas"` em todo caso; com `c3-confiavel`, `"codigo"`.
  - o relatório gravado de uma rodada falsa do `c5-publico` tem "- Alvo: rotas do site" e "Fluxo pelas rotas:"; o do `c3-confiavel`, "- Alvo: código".
  - `--caso <id>` com `c5-publico` passa `"rotas"`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run scripts`, `npm run eval:llm -- --checkpoint c5-publico --listar`
- pronto quando: testes verdes; `--listar` dos cinco checkpoints sem modelo nem rede.
- fora: runners, fixtures, `src/`, `evals/resultados/`.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2, T3 | Sem dependências e sem arquivo em comum (T1: checkpoints, casos, histórico, comando; T2: fixtures de cenário; T3: resultado, relatório, andamento) |
| 2 | T4 | Usa a rodada pelas rotas (T2) e a lista `rota` (T3); mexe em `rodar-run.ts` |
| 3 | T5 | Liga tudo no comando e no script; toca `comando.ts` e `casos.ts`, de T1 |

Fechamento (orquestrador): gates 1 a 6 e `dup`; `QA.md` (tabela de checkpoints); `DECISOES-AUTONOMAS.md` (022 · A2 e J-A5 resolvidas, 027 A1 a A3); ADR do alvo `rotas`; `AGENTS.md` (comando `eval:llm` com o alvo); spec `implemented`.

### T6 · Keep the route flush off in the scenario container (correção)
- nivel: nucleo
- objetivo: a rodada pelas rotas não chama o `after()` do Next fora de uma requisição quando o ambiente tem a telemetria ligada.
- arquivos: `test/fixtures/cenarios/rotas.ts`, `test/fixtures/cenarios/rotas.test.ts`
- depende de: T2
- leitura: nenhuma
- skills: nenhuma
- contexto: a fumaça `npm run eval:llm -- --checkpoint c5-publico --caso c2-p01-frio-so-incertos` falhou com "`after` was called outside a request scope" em `descarregarDepois` (`src/app/_apoio/descarregar.ts`), chamado no `finally` de `criarRotaDeFluxo` (`src/app/_lib/fluxo.ts:104`). `descarregarDepois` só agenda se `container.telemetriaLigada`; o `containerDoCenario` usa `createContainer(...)`, que liga a flag pelo ambiente (`OTEL_EXPORTER_OTLP_ENDPOINT`). No eval, quem descarrega a telemetria é o próprio script, no fim (`container.encerrar()` de `scripts/eval-llm.ts`).
- contratos: `containerDoCenario(deps).container.telemetriaLigada === false` sempre, qualquer que seja o ambiente. Não mude `src/`.
- testes primeiro: com `vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")`, `containerDoCenario(deps).container.telemetriaLigada` é `false`, e uma rodada de um cenário de conversa por `rodarCenarioPelasRotas` termina sem lançar.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run test/fixtures/cenarios`
- pronto quando: testes verdes; nenhum arquivo de `src/` mudou.
- fora: `src/`, `scripts/`.
