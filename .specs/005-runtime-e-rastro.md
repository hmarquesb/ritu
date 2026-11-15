---
title: Runtime e rastro
status: implemented
implemented: 3a9ea65
entrega: 1
created: 2026-11-14
---

# Runtime e rastro

> Entrega o loop do agente como código do Ritu (perceber, raciocinar, agir, observar), com teto de chamadas, de tempo e de tokens, checkpoint, pausa e retomada; a porta `AgentRuntime`, que executa um passo de modelo, com adaptador Mastra e fake roteirizado; o ciclo de vida do run com as etapas gravadas; e a porta `Telemetry` com o adaptador OpenTelemetry e a árvore de spans.

## Contexto

O que faz do Ritu um agente é o loop: o modelo escolhe a próxima tool, o código executa, o modelo observa e corrige (`AI.md` §1). Para isso ser confiável, o loop precisa parar sozinho (limites), sobreviver a uma pausa de minutos sem ficar vivo na memória (checkpoint no banco), não cair quando uma tool falha e deixar rastro de cada passo, tanto para a pessoa ("Como pensei") quanto para o Grafana. E precisa rodar inteiro sem LLM, para os evals determinísticos medirem trajetória, limites e pausas.

## Objetivo

Depois desta spec, dá para definir um agente (instruções, tools, tools de controle), rodá-lo com um roteiro de passos sem nenhum modelo, e obter: o run no banco com estado final conhecido, uma linha em `run_etapas` por passo, e a árvore de spans de `OBSERVABILITY.md` §3 no fake de telemetria. Com o LGTM no ar, o mesmo run aparece como um trace no Grafana.

## Escopo

- **Dentro:**
  - Porta `AgentRuntime` (um passo de modelo com tools), adaptador Mastra, fake roteirizado.
  - Loop no core, tools de controle, limites, tratamento de erro de tool e de modelo.
  - Checkpoint, pausa e retomada.
  - Estados do run, transições, serviço que cria, executa, continua e encerra runs e grava etapas.
  - Porta `Telemetry`, nomes de spans e métricas, lista de atributos permitidos, adaptador OpenTelemetry, fake em memória.
  - `config/loop.ts`.
  - Script `loop:demo` (roteirizado, sem LLM) e ⚠️ `runtime:real` (uma chamada real, para conferir o adaptador).
- **Fora:**
  - Escolha de modelo, cotas e troca (006). Aqui o loop recebe um fornecedor de modelo.
  - As tools de controle de verdade: `finalizar` com o validador (007) e `ask_user` (009).
  - Aprovação e executor de propostas (010).
  - Intérprete, caminhos por intenção e Juiz (008 e 013).
  - Métricas que não são do loop, logs completos, painel e teste de privacidade com dados reais (015).
  - Transmissão das etapas para a tela (018): aqui existem só os ganchos `aoGravarEtapa` e `aoVivo`.

## Necessidade de negócio

"Cada passo é rastreado" e "pergunta quando falta algo" são promessas do produto. O loop escrito e testado no próprio repositório, com limites e pausa provados sem LLM, é a parte que mostra engenharia de agentes, e não uso de biblioteca.

## Critérios de aceite

- [x] Com o fake roteirizado: roteiro `tool A → tool B → entregar` termina com o run em `done`, 3 chamadas de modelo contadas, 2 etapas `tool`, 3 etapas `llm` e a saída gravada em `runs.saida`.
- [x] **Teto de chamadas:** roteiro que nunca entrega para na 6ª chamada de modelo, com fim `limite: chamadas`; o run não fica em `running`.
- [x] **Timeout:** com o relógio fixo avançando além de 25 s de trabalho ativo, o trecho termina com `limite: tempo`. O tempo em pausa não conta.
- [x] **Teto de tokens:** somando mais que o teto de `config/loop.ts`, o trecho termina com `limite: tokens`.
- [x] **Entrega recusada:** tool de controle que recusa devolve o motivo ao modelo como resultado de tool e o loop continua; a 3ª recusa termina com `limite: validacao`.
- [x] **Tool fora do catálogo** vira resultado `{ erro: "tool_desconhecida" }`, etapa com status `recusado`, e o loop continua.
- [x] **Argumento inválido** (zod) vira `{ erro: "argumentos_invalidos" }` e etapa `recusado`; **tool que lança** vira `{ erro: "falhou" }` e etapa `falhou`. Nos dois casos o run termina bem.
- [x] **Passo sem chamada de tool:** o loop acrescenta o lembrete de entregar pela tool de entrega e segue; conta como chamada de modelo.
- [x] **Pausa:** tool de controle que pausa leva o run a `waiting_for_input`, com `checkpoint` e `pendencia` gravados, e a função retorna. `continuarRun` com a resposta retoma do checkpoint, sem repetir chamadas de modelo anteriores, e termina em `done`.
- [x] `continuarRun` em run `expired`, `done` ou de outra conta lança `RunNaoContinuavelError` e não muda nada.
- [x] Checkpoint com formato inválido (zod) leva o run a `failed`, sem exceção solta.
- [x] **Mensagem nova com run aberto:** em `waiting_for_input`, o antigo vira `cancelled`; em `waiting_for_approval`, vira `done` e as propostas pendentes viram `expirada`; em `running`, `iniciarRun` lança `RunAbertoError`.
- [x] Erro `rate_limit` do runtime chama `modelo.falhou` e tenta de novo com o próximo modelo, sem contar chamada; sem próximo modelo, fim `sem_modelo`.
- [x] Cada etapa gravada dispara `aoGravarEtapa` na ordem.
- [x] **Ao vivo:** `aoVivo` recebe `etapa_iniciada` antes de cada chamada de modelo e de cada tool, `etapa_concluida` depois de cada etapa gravada e `pensamento` quando o passo traz texto junto com chamadas de tool. O pensamento é cortado em 160 caracteres e não vai para `run_etapas`, span, métrica nem log.
- [x] **Spans:** o fake de telemetria recebe `run` → `agente.passo` (1..n) → `llm.chamada` e `tool.chamada`, e o evento `pausa`, com os atributos de "Contratos". O trecho retomado entra no **mesmo** trace do run.
- [x] O fake de telemetria lança erro de teste para atributo fora da lista permitida ou valor de texto com mais de 64 caracteres.
- [x] Sem `OTEL_EXPORTER_OTLP_ENDPOINT`, o container entrega uma telemetria que não faz nada e nenhum pacote de OTel abre conexão.
- [x] `npm run loop:demo` roda um cenário roteirizado com pausa e retomada e imprime as etapas; com o LGTM no ar e o endpoint definido, o trace aparece no Grafana local com a árvore completa (conferência manual, anotada no relatório da entrega).
- [x] ⚠️ `npm run runtime:real` faz **uma** chamada real pelo adaptador Mastra, com uma tool de exemplo, e imprime a chamada de tool pedida pelo modelo e os tokens.
- [x] A captura de entrada e saída do modelo pelo exporter da Mastra está desligada (teste do adaptador confere a configuração).

## O que fazer

- Escrever o loop como função do core que recebe todas as dependências (runtime, fornecedor de modelo, relógio, telemetria, gravador de etapas) e testá-lo só com fakes.
- Carregar a skill `mastra` em toda tarefa do adaptador e seguir a documentação da **versão instalada**.
- Fazer o adaptador executar exatamente **uma** chamada de modelo por `passo`, com as tools declaradas por nome, descrição e schema, sem execução automática pela biblioteca. Quem executa a tool é o loop.
- Guardar em `runs.trace_id` o `traceparent` (W3C) do span raiz, para o trecho retomado entrar no mesmo trace.
- Garantir o envio dos spans antes de a função terminar (Vercel) e antes de o script sair (terminal).
- Atualizar `AI.md` §3 ("O loop") e a ADR 0005 com a divisão: loop no core, passo na Mastra.

## O que não fazer

- Não deixar a Mastra (ou qualquer biblioteca) rodar mais de um passo por conta própria, guardar memória de conversa ou fazer nova tentativa escondida.
- Não manter run vivo em memória esperando a pessoa.
- Não pôr texto da pessoa, instruções, argumento ou resultado de tool, nem nome de cidade, em span, métrica, log ou `resumo` de etapa.
- Não escolher modelo dentro do loop nem do adaptador: o identificador chega pronto.
- Não tratar resultado de tool como instrução: ele entra na conversa como dado, em JSON.
- Não importar `@mastra/*`, `@ai-sdk/*` nem `@opentelemetry/*` fora das pastas de R5.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Quem controla o loop | O core do Ritu; a Mastra executa cada passo atrás de `AgentRuntime` | Decisão da dona. Limites, pausa e checkpoint ficam testáveis sem LLM e não dependem do comportamento de uma versão da biblioteca |
| Como uma tool encerra ou pausa o loop | Tools de controle, com resultado `entregar`, `recusar` ou `pausar` | `finalizar` (007) e `ask_user` (009) usam o mesmo mecanismo |
| Checkpoint | As mensagens do loop, os contadores e os dados do preparo, em `runs.checkpoint`, com versão e zod | Retomar é recarregar e continuar; nada depende de memória do processo |
| Quando grava o checkpoint | Na pausa e no fim do trecho; as etapas, a cada passo | Menos escrita; o rastro ao vivo vem das etapas |
| Várias tools no mesmo passo | Executadas em sequência, na ordem pedida, até 4; depois de uma tool de controle que entrega ou pausa, as restantes recebem `{ ignorada: true }` | Determinístico; uma tool não corre com a outra |
| Erro de modelo | `rate_limit`: troca de modelo sem contar chamada. `timeout`, `indisponivel` ou resposta inválida: uma nova tentativa no mesmo modelo; depois, fim com erro | A troca por cota é assunto do fornecedor de modelo (006) |
| Mensagem nova com run em espera | Fecha o antigo (`cancelled`, ou `done` com propostas `expirada`) e começa o novo | A pessoa não precisa responder ao bloco de aprovação para continuar conversando; proposta expirada não conta como recusa |
| Limites | `config/loop.ts`: 6 chamadas, 25 s por trecho, 15 s por passo, 60 mil tokens por run, 3 entregas recusadas | `AI.md` §3; o teto de tokens cobre 6 passos com folga |
| Telemetria | Porta própria com nomes e atributos fechados; adaptador com `@opentelemetry/api`; SDK por `@vercel/otel` no Next e `@opentelemetry/sdk-node` nos scripts | O core não conhece OTel; a lista fechada de atributos é a trava de privacidade |
| Sem endpoint | Telemetria nula | Testes, CI e quem clona o repositório não precisam de Grafana |
| Resumo da etapa | Cada tool pode ter `resumir(saida)`; sem ele, o resumo é só o status | Texto curto, gerado por código, sem dado da pessoa |
| Provider do Gemini na Mastra | O que a versão instalada da Mastra indicar; a chave vem de `GEMINI_API_KEY`, passada pelo adaptador | Uma variável só para os dois clientes de LLM |

## Contratos

### Cria

**Configuração (`config/loop.ts`, em `config/index.ts`)**

```ts
export const loop = {
  maxChamadasDeModelo: 6,
  timeoutTrechoMs: 25_000,
  timeoutPassoMs: 15_000,
  maxTokensPorRun: 60_000,
  maxEntregasRecusadas: 3,
  maxToolsPorPasso: 4,
  maxResultadoDeToolCaracteres: 4_000,
} as const
```

**Porta do runtime (`src/core/runs/agent-runtime.ts`)**

```ts
export type ChamadaDeTool = { id: string; nome: string; argumentos: unknown }
export type MensagemDoLoop =
  | { papel: "pessoa"; conteudo: string }
  | { papel: "agente"; texto?: string; chamadas: ChamadaDeTool[] }
  | { papel: "tool"; chamada_id: string; nome: string; resultado: unknown }
  | { papel: "sistema"; conteudo: string }                       // lembretes do loop
export type PedidoDePasso = {
  instrucoes: string
  mensagens: MensagemDoLoop[]
  tools: { name: string; description: string; input: z.ZodType }[]
  modelo: string
  timeoutMs: number
}
export type ResultadoDePasso = { texto?: string; chamadas: ChamadaDeTool[]; tokens_entrada: number; tokens_saida: number }
export interface AgentRuntime { passo(p: PedidoDePasso): Promise<ResultadoDePasso> }
export class LlmError extends RituError {}   // code: "rate_limit" | "timeout" | "indisponivel" | "resposta_invalida"
```

**Fornecedor de modelo (`src/core/llm/fornecedor.ts`)**: o que o loop precisa saber sobre modelos. A 006 implementa.

```ts
export interface FornecedorDeModelo {
  proximo(): Promise<{ modelo: string; troca?: { de: string; motivo: "cota" | "429" } } | null>   // null: sem modelo
  usou(modelo: string, tokens: { entrada: number; saida: number }): Promise<void>
  falhou(modelo: string, erro: LlmError): Promise<void>
}
```

Fake: `src/infra/fakes/fixed-model.ts` exporta `createFixedModel(modelos?: string[])`, que devolve o primeiro modelo até `falhou` ser chamado com `rate_limit`.

**Tools de controle e definição do agente (`src/core/runs/agente.ts`)**

```ts
export type Pendencia = { tipo: "pergunta" | "aprovacao"; chamada_id?: string; conteudo: unknown; criada_em: string }
export type ResultadoDeControle =
  | { tipo: "entregar"; saida: unknown }
  | { tipo: "recusar"; resultado: unknown }                 // volta ao modelo como resultado da tool
  | { tipo: "pausar"; pendencia: Omit<Pendencia, "criada_em" | "chamada_id"> }
export type ToolDeControle<I> = {
  name: string; description: string; input: z.ZodType<I>
  tratar(input: I, ctx: ToolContext, estado: Checkpoint): Promise<ResultadoDeControle>
  aoRetomar?(resposta: unknown, estado: Checkpoint): unknown    // transforma a resposta da pessoa no resultado da tool
}
export type DefinicaoDoAgente = {
  nome: string; instrucoes: string; prompt_versao: string
  tools: Tool<unknown, unknown>[]
  controle: ToolDeControle<unknown>[]                           // pelo menos uma que entrega
  lembreteDeEntrega: string
}
```

`Tool` (da 002) ganha o campo opcional `resumir?(saida: O): string` (até 80 caracteres, sem dado da pessoa).

**Checkpoint (`src/core/runs/checkpoint.ts`)**, validado com zod na leitura e na escrita:

```ts
export type Checkpoint = {
  versao: 1
  agente: string; prompt_versao: string
  mensagens: MensagemDoLoop[]
  chamadas_de_modelo: number
  tokens: { entrada: number; saida: number }
  entregas_recusadas: number
  pausas: number
  ativo_ms: number                     // tempo de trabalho já gasto em trechos anteriores
  modelo?: string                      // o run tenta manter o mesmo modelo
  dados: unknown                       // contexto do preparo; quem define o formato é a 007
}
```

**Loop (`src/core/runs/loop.ts`)**

```ts
export type FimDoTrecho =
  | { tipo: "entregue"; saida: unknown }
  | { tipo: "pausa"; pendencia: Pendencia }
  | { tipo: "limite"; motivo: "chamadas" | "tempo" | "tokens" | "validacao" }
  | { tipo: "sem_modelo" }
  | { tipo: "erro"; codigo: string }
export type EventoAoVivo =
  | { tipo: "etapa_iniciada"; etapa: { tipo: TipoDeEtapa; nome: string } }
  | { tipo: "etapa_concluida"; etapa: RunEtapa }
  | { tipo: "pensamento"; texto: string }       // a frase que o modelo escreve antes de usar uma tool
export type DepsDoLoop = {
  runtime: AgentRuntime; modelo: FornecedorDeModelo; clock: Clock; telemetry: Telemetry
  gravarEtapa(etapa: NovaEtapa): Promise<void>
  aoVivo?: (e: EventoAoVivo) => void
}
export function executarTrecho(agente: DefinicaoDoAgente, estado: Checkpoint, ctx: ToolContext, deps: DepsDoLoop): Promise<{ fim: FimDoTrecho; estado: Checkpoint }>
export function novoCheckpoint(agente: DefinicaoDoAgente, mensagemInicial: string, dados: unknown): Checkpoint
export function retomarCheckpoint(estado: Checkpoint, pendencia: Pendencia, resultadoDaTool: unknown): Checkpoint
```

Ordem de um passo: confere limites → pede o modelo (`proximo`) → `runtime.passo` → grava etapa `llm` → para cada chamada de tool: valida o nome e os argumentos, executa, corta o resultado em `maxResultadoDeToolCaracteres`, grava etapa `tool` (ou `validacao`, `pergunta`, `erro`, conforme o caso) → acrescenta as mensagens ao estado → repete.

**Estados e serviço do run (`src/core/runs/`)**

Transições válidas (`estados.ts`, função `podeIr(de, para)`):

| De | Para |
|---|---|
| `running` | `waiting_for_input`, `waiting_for_approval`, `done`, `failed`, `cancelled` |
| `waiting_for_input` | `running`, `expired`, `cancelled` |
| `waiting_for_approval` | `done`, `expired` |
| `done`, `failed`, `expired`, `cancelled` | nenhuma |

```ts
// run-service.ts
export type NovaEtapa = { tipo: TipoDeEtapa; nome: string; resumo?: string; status: "ok" | "falhou" | "recusado"; duracao_ms: number; modelo?: string; tokens_entrada?: number; tokens_saida?: number }
export type TipoDeEtapa = "interprete" | "llm" | "tool" | "validacao" | "pergunta" | "proposta" | "aprovacao" | "juiz" | "guardrail" | "troca_de_modelo" | "erro"
export type ResultadoDoRun = { run: Run; fim: FimDoTrecho }

export function createRunService(deps: { stores: Stores; tx: Transactor; runtime: AgentRuntime; clock: Clock; telemetry: Telemetry }): {
  iniciarRun(contaId: string, r: { caminho: Caminho; intencoes: string[]; fuso?: string }): Promise<Run>              // fecha run em espera; lança RunAbertoError se houver um running
  executarRun(contaId: string, runId: string, p: { agente: DefinicaoDoAgente; estado: Checkpoint; ctx: ToolContext; modelo: FornecedorDeModelo; aoGravarEtapa?: (e: RunEtapa) => void; aoVivo?: (e: EventoAoVivo) => void }): Promise<ResultadoDoRun>
  continuarRun(contaId: string, runId: string, p: { agente: DefinicaoDoAgente; resposta: unknown; ctx: ToolContext; modelo: FornecedorDeModelo; aoGravarEtapa?: (e: RunEtapa) => void; aoVivo?: (e: EventoAoVivo) => void }): Promise<ResultadoDoRun>
  gravarEtapa(contaId: string, runId: string, etapa: NovaEtapa): Promise<RunEtapa>
  encerrar(contaId: string, runId: string, status: "done" | "failed" | "cancelled", campos?: Partial<RunMutavel>): Promise<void>
}
export class RunNaoContinuavelError extends RituError {}   // code: "run_nao_continuavel"
```

Como cada fim vira estado: `entregue` → o serviço grava `saida` e **devolve** o fim sem encerrar (quem chama roda o Juiz e decide `done` ou `waiting_for_approval`; nesta spec, o teste encerra com `done`); `pausa` → `waiting_for_input` com `checkpoint` e `pendencia`; `limite`, `sem_modelo` e `erro` → devolvidos a quem chama, que entrega a resposta segura ou a montada por código (007) e encerra. Qualquer exceção não prevista → `failed`. Em todos os casos o run sai de `executarRun` com `passos`, tokens e `latencia_ms` atualizados.

**Telemetria (`src/core/telemetry/`)**

```ts
// ports.ts
export type Atributos = Partial<Record<AtributoPermitido, string | number | boolean>>
export interface SpanAtivo { atribuir(a: Atributos): void; falhar(codigo: string): void }
export interface Telemetry {
  span<T>(nome: NomeDeSpan, atributos: Atributos, fn: (s: SpanAtivo) => Promise<T>, opts?: { traceparent?: string }): Promise<T>
  evento(nome: "pausa", atributos?: Atributos): void
  contador(nome: NomeDeMetrica, rotulos?: Atributos, valor?: number): void
  histograma(nome: NomeDeMetrica, valor: number, rotulos?: Atributos): void
  medidor(nome: NomeDeMetrica, valor: number, rotulos?: Atributos): void
  log(nivel: "info" | "warn" | "error", codigo: string, campos?: Atributos): void
  traceparentAtual(): string | undefined
  encerrar(): Promise<void>                    // envia o que falta
}
```

- `nomes.ts`: `SPANS` (os nomes da árvore de `OBSERVABILITY.md` §3: `run`, `guardrail.entrada`, `interprete`, `preparo`, `agente.passo`, `llm.chamada`, `tool.chamada`, `validacao`, `juiz`, `aprovacao.execucao`), `METRICAS` (todas as da tabela de `OBSERVABILITY.md` §3) e `ATRIBUTOS_PERMITIDOS` (todos os atributos da árvore e todos os rótulos da tabela, mais `run.id`, `erro.codigo`, `trace_id`). Valor de texto: até 64 caracteres.
- Esta spec emite: spans `run` (`run.id`, `run.caminho`, `conta.tipo`, `prompt.versao`, `run.status`, `run.passos`), `agente.passo` (`passo.ordem`), `llm.chamada` (`gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `llm.tentativas`, `llm.troca_de_modelo`), `tool.chamada` (`tool.nome`, `tool.status`); evento `pausa` (`pausa.tipo`); métricas `ritu_run_duracao_ms`, `ritu_run_passos`, `ritu_tool_chamadas_total`, `ritu_pausas_total`, `ritu_llm_erros_total`; logs `info` de início e fim de run com `run.id` e `trace_id`.
- Fake: `src/infra/fakes/memory-telemetry.ts` exporta `createMemoryTelemetry()`, com `spans`, `eventos`, `metricas` e `logs` para os testes, e erro para atributo fora da lista.
- Adaptador: `src/infra/otel/telemetry.ts` (`createOtelTelemetry()`), `src/infra/otel/node-sdk.ts` (SDK para scripts) e `src/instrumentation.ts` (`@vercel/otel`, só com o endpoint definido). `createNullTelemetry()` em `src/infra/otel/null-telemetry.ts`.

**Adaptador Mastra (`src/infra/mastra/runtime.ts`)**: `createMastraRuntime(deps: { apiKey: () => string }): AgentRuntime`. Converte `MensagemDoLoop` para o formato da biblioteca e de volta; mapeia erro 429 para `rate_limit`, estouro de `timeoutMs` para `timeout`, 5xx para `indisponivel` e resposta sem texto nem chamada para `resposta_invalida`; devolve os tokens informados pelo provedor.

**Container**: ganha `runtime: AgentRuntime` (Mastra), `telemetry: Telemetry` (OTel com endpoint, nula sem) e `runs: ReturnType<typeof createRunService>`. `Container` ganha `encerrar(): Promise<void>`.

**Teste de arquitetura**: o mapa de R5 ganha `@ai-sdk/*` → `src/infra/mastra/` e `@opentelemetry/*` continua em `src/infra/otel/` e `src/instrumentation.ts`.

**Scripts**

| Script | O que faz |
|---|---|
| `loop:demo` | `tsx scripts/loop-demo.ts`: roda com o fake roteirizado e os stores em memória um cenário de 4 passos com uma pausa, imprime as etapas e o estado final. Com o endpoint definido, exporta o trace |
| ⚠️ `runtime:real` | `tsx scripts/runtime-real.ts <modelo>`: uma chamada real pelo adaptador Mastra. Só o orquestrador, uma vez, no fechamento |

**Fake roteirizado (`src/infra/fakes/scripted-runtime.ts`)**

```ts
type PassoRoteirizado = { chamadas?: { nome: string; argumentos: unknown }[]; texto?: string; tokens?: { entrada: number; saida: number }; erro?: "rate_limit" | "timeout" | "indisponivel" | "resposta_invalida"; demoraMs?: number }
export function createScriptedRuntime(roteiro: PassoRoteirizado[], clock?: FixedClock): AgentRuntime & { pedidos: PedidoDePasso[] }
```

`demoraMs` avança o relógio fixo. Roteiro esgotado lança erro de teste. Padrão de tokens: 100 de entrada e 20 de saída.

### Usa

- Spec 001: `RituError`, `Clock`, relógio fixo, container, `requireEnv` e `optionalEnv`, teste de arquitetura.
- Spec 002: `Tool`, `ToolContext`.
- Spec 004: `RunRepository`, `ProposalStore`, `Stores`, `Transactor`, `Run`, `RunEtapa`, `RunAbertoError`, `diaLocal`, `memoria.esperaMinutos`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/loop/`, com o fake roteirizado e os stores em memória:

- `limites.eval.ts`: teto de chamadas, timeout e teto de tokens; em cada um o run termina em estado conhecido.
- `entrega.eval.ts`: entrega recusada volta ao modelo; a 3ª recusa encerra.
- `tools.eval.ts`: tool fora do catálogo é recusada e vira etapa; tool que falha não derruba o run.
- `pausa.eval.ts`: pausa grava checkpoint e pendência; continuar retoma sem repetir passos; continuar run expirado é recusado.
- `rastro.eval.ts`: a árvore de spans e as etapas de um run com pausa, na ordem; nenhum atributo fora da lista; nenhum atributo com o texto da mensagem usada no cenário.

Com LLM: nenhum caso novo.

## Nível das partes

- **nucleo** (Sonnet): loop, tools de controle, checkpoint, serviço do run, adaptador Mastra, porta e adaptador de telemetria, `instrumentation.ts`.
- `mecanica`: `config/loop.ts`, `nomes.ts`, fakes (roteirizado, modelo fixo, telemetria em memória), scripts, evals.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `AI.md` §3, só "O loop", e §8, só "Entre os passos".
- `OBSERVABILITY.md` §2 e §3 (árvore de spans, métricas, ambientes e privacidade).
- Skill `mastra`, nas tarefas de `src/infra/mastra/`.

## Dependências

- Specs 001, 002 e 004.
- Pacotes: `@mastra/core` e o provider do Gemini que a versão instalada indicar; `@opentelemetry/api`, `@opentelemetry/sdk-node`, exportadores OTLP por HTTP, `@vercel/otel`. Estáveis mais recentes.
- LGTM do `docker-compose`, só para a conferência manual do trace.
- `GEMINI_API_KEY`, só para ⚠️ `runtime:real`.

## Riscos e trade-offs

- **A Mastra faz pouco:** só o passo de modelo com tools. Abrimos mão de recursos prontos (memória, workflows, suspensão) em troca de controle e de testes sem LLM. A porta permite trocar isso depois sem mexer no loop.
- **Declarar tool sem execução depende da versão:** se a versão instalada não permitir, o adaptador registra uma execução que só devolve um marcador e limita a um passo. O critério é o mesmo: uma chamada de modelo por `passo`.
- **Checkpoint só na pausa e no fim:** se o processo cair no meio de um trecho, o run fica em `running` até a limpeza expirar. Aceito; as etapas já gravadas mostram onde parou.
- **Lista fechada de atributos:** todo atributo novo exige mexer em `nomes.ts`. É atrito de propósito.
- **Envio de spans em função serverless:** se o envio atrasar a resposta de forma perceptível, o ajuste é do adaptador, sem mudar a porta.

## Edge cases e modos de falha

- Modelo pede a mesma tool duas vezes com os mesmos argumentos no mesmo passo: executa as duas (as tools de leitura são baratas e têm cache onde importa).
- Modelo pede mais de 4 tools no passo: as excedentes recebem `{ erro: "muitas_tools" }`.
- Resultado de tool maior que o limite: cortado, com `"cortado": true`.
- Duas tools de controle no mesmo passo: vale a primeira.
- Pausa pedida depois de o run já ter pausado o número máximo de vezes: quem limita é a tool de controle (009); o loop só conta em `pausas`.
- `continuarRun` chamado duas vezes ao mesmo tempo: a segunda encontra o run em `running` e é recusada.
- Limite atingido exatamente no passo que entrega: a entrega vale.
- Telemetria fora do ar: o run termina normalmente; a falha de envio não vira erro do run.
- Run cujo `agente` ou `prompt_versao` do checkpoint não bate com a definição atual: `failed`, com código `checkpoint_incompativel`.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes.
- `loop:demo` conferido no Grafana local e ⚠️ `runtime:real` rodado uma vez, os dois anotados no relatório da entrega.
- `AI.md` §3 e a ADR 0005 dizem: loop no core, passo na Mastra.
- `AGENTS.md` com os dois comandos.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `config/loop.ts`, `config/index.ts`
- `src/core/runs/`: `agent-runtime.ts`, `agente.ts`, `checkpoint.ts`, `loop.ts`, `estados.ts`, `run-service.ts` e os testes
- `src/core/llm/fornecedor.ts`
- `src/core/telemetry/ports.ts`, `src/core/telemetry/nomes.ts`
- `src/core/agents/tools/tool.ts` (campo `resumir`)
- `src/infra/mastra/runtime.ts` e o teste
- `src/infra/otel/telemetry.ts`, `node-sdk.ts`, `null-telemetry.ts`, `src/instrumentation.ts`
- `src/infra/fakes/scripted-runtime.ts`, `fixed-model.ts`, `memory-telemetry.ts`
- `src/infra/container.ts`, `src/architecture.test.ts`
- `scripts/loop-demo.ts`, `scripts/runtime-real.ts`, `package.json`
- `evals/det/loop/*.eval.ts`
- `.docs/AI.md`, `.adrs/0005-*.md`, `.adrs/README.md`, `AGENTS.md`
