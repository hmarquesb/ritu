---
title: Modelos e cotas
status: implemented
implemented: 2430770
entrega: 1
created: 2026-11-14
---

# Modelos e cotas

> Entrega o `ModelRouter`: os papéis `decisao`, `apoio` e `reforco`, cada um com a sua lista ordenada de modelos do plano gratuito do Gemini; o registro de uso por minuto e por dia; a troca automática de modelo por cota e por erro 429; o cliente `LlmClient` para as chamadas de uma resposta só; e a resposta montada por código para quando não há modelo nenhum.

## Contexto

O Ritu roda só no plano gratuito, em que cada modelo tem cota própria por minuto e por dia (`AI.md` §10). Dois modelos carregam o volume (500 pedidos por dia cada) e o modelo Flash é escasso (20 por dia). Sem um ponto único que conte e distribua as chamadas, o produto para no meio do dia ou gasta os modelos fortes à toa. E quando tudo acaba, a pessoa não pode ficar sem resposta.

## Objetivo

Depois desta spec, nenhuma parte do código escolhe modelo: pede um papel ao `ModelRouter` e recebe o próximo modelo com vaga. O uso fica registrado por modelo e por janela, a troca acontece sozinha e fica no rastro, e sem modelo para `decisao` existe uma resposta pronta por código.

## Escopo

- **Dentro:**
  - `config/llm-cotas.ts` com modelos, cotas e listas por papel.
  - Porta `UsageLedger` (registro de uso), adaptador Postgres (`llm_uso`) e fake.
  - `ModelRouter`, que implementa o `FornecedorDeModelo` da 005 para cada papel.
  - Porta `LlmClient` (resposta estruturada em uma chamada), adaptador Gemini e fake.
  - `chamarComPapel`: uma chamada com troca de modelo, para Intérprete, Juiz e Memória.
  - `respostaSemModelo`: texto e práticas gerais por código.
  - Métricas de modelos e cota; limpeza das linhas antigas de `llm_uso`.
  - Scripts `cotas` e ⚠️ `modelos:check`.
- **Fora:**
  - Os agentes que usam os papéis: Acompanhante (007), Intérprete (008), Juiz (013), Memória (012).
  - Resposta segura quando o Juiz fica sem modelo (013).
  - Limites por conta e por IP e as telas de cota esgotada (021).
  - Linha de modelos e cota no painel (015).

## Necessidade de negócio

"Só planos gratuitos" é uma regra do projeto. O roteador é o que transforma várias cotas pequenas em um produto que aguenta o dia, com o Acompanhante e o Juiz em modelos diferentes e o modelo forte guardado para a segunda tentativa de uma resposta reprovada.

## Critérios de aceite

- [x] Com cota livre, `paraPapel("decisao").proximo()` devolve `gemini-3.5-flash-lite`; `apoio`, `gemini-3.1-flash-lite`; `reforco`, `gemini-3.6-flash`.
- [x] Com a cota do **minuto** do modelo principal cheia (pedidos ou tokens), `proximo()` devolve o segundo da lista do papel, com `troca: { de, motivo: "cota" }`; no minuto seguinte volta ao principal.
- [x] Com a cota do **dia** cheia, o modelo fica fora até a virada do dia da cota.
- [x] O dia da cota vira à meia-noite de `America/Los_Angeles`: com o relógio fixo, um pedido às 23h59 e outro à 0h01 do Pacífico caem em janelas diferentes.
- [x] `falhou(modelo, rate_limit)` tira o modelo até o fim do minuto corrente; o terceiro `rate_limit` do mesmo modelo no mesmo dia da cota o tira até a virada do dia.
- [x] `proximo()` com `preferir` devolve o modelo preferido se ele tiver vaga, mesmo não sendo o primeiro da lista.
- [x] Com todos os modelos do papel sem vaga, `proximo()` devolve `null`.
- [x] A reserva é atômica: 20 reservas simultâneas num modelo com 15 por minuto dão exatamente 15 sucessos (teste no fake e, em `test:db`, no Postgres).
- [x] `usou` soma os tokens na janela do minuto e na do dia.
- [x] `chamarComPapel`: devolve o dado validado pelo schema, o modelo usado e as trocas; em `rate_limit` troca de modelo e tenta de novo; em `resposta_invalida` tenta uma vez mais no mesmo modelo; sem modelo, lança `SemModeloError`.
- [x] Cada troca gera a etapa `troca_de_modelo` (pelo gancho) e a métrica `ritu_llm_troca_de_modelo_total` com `papel`, `de`, `para` e `motivo`.
- [x] O adaptador Gemini pede saída em JSON, valida com o schema zod recebido e mapeia 429, timeout, 5xx e JSON inválido para os códigos de `LlmError`.
- [x] `respostaSemModelo` com estados devolve o texto aprovado para "sem modelo, com atalhos", com até 3 práticas do tipo `pratica` que favorecem os estados, sem as contraindicadas e sem as barradas pelo filtro da pessoa; sem estados, devolve o texto de "sem modelo, só texto" e nenhuma prática.
- [x] `executarLimpeza` apaga janelas de minuto com mais de 1 dia e de dia com mais de 30 dias.
- [x] `npm run cotas` imprime, por modelo, pedidos e tokens do minuto e do dia, o limite e a porcentagem usada.
- [x] ⚠️ `npm run modelos:check` faz uma chamada mínima por modelo de `config/llm-cotas.ts` e diz, para cada um, `ok` ou o erro. Roda só à mão.
- [x] Nenhum arquivo fora de `config/llm-cotas.ts` contém um identificador de modelo (teste de arquitetura, regra R10).

## O que fazer

- Escrever o roteador como código do core que recebe o `UsageLedger`, o relógio e a telemetria.
- Fazer a reserva das duas janelas (minuto e dia) numa única operação atômica no adaptador Postgres.
- Conferir a API do SDK do Gemini na documentação da versão instalada antes de escrever o adaptador.
- Rodar ⚠️ `modelos:check` uma vez, no fechamento, e anotar o resultado no relatório da entrega. Identificador recusado: registrar em `.plans/BLOQUEIOS.md` e seguir com os demais.
- Acrescentar a regra R10 ao teste de arquitetura.

## O que não fazer

- Não ler identificador de modelo ou cota de variável de ambiente.
- Não fazer nova tentativa escondida no adaptador: quem decide tentar de novo é o roteador ou `chamarComPapel`.
- Não chamar o SDK fora de `src/infra/gemini/` (e de `src/infra/mastra/`, da 005).
- Não registrar texto de prompt nem de resposta em `llm_uso`, etapa, span, métrica ou log.
- Não usar modelo fora da lista do papel.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Listas por papel | `decisao`: 3.5 Flash Lite → 3.1 Flash Lite → 3.6 Flash. `apoio`: 3.1 Flash Lite → 3.5 Flash Lite. `reforco`: 3.6 Flash → 3.5 Flash Lite → 3.1 Flash Lite | `AI.md` §10 |
| Janela do minuto | Minuto cheio do relógio, em UTC | Simples e atômico; a diferença para uma janela deslizante é coberta pelo tratamento do 429 |
| Janela do dia | Dia no fuso `America/Los_Angeles` | É quando a cota do provedor vira |
| Erro 429 | Fora até o fim do minuto; no terceiro do dia, fora até a virada do dia | O erro não diz qual cota estourou; a contagem própria pode estar atrasada em relação à do provedor |
| Tokens por minuto | Contados depois da chamada; modelo com tokens do minuto acima do limite não recebe reserva nova | O tamanho da chamada só é conhecido no fim |
| Manter o modelo do run | `preferir`, com o modelo guardado no checkpoint | `AI.md` §10: um run tenta manter o mesmo modelo em cada papel |
| Saída estruturada | `LlmClient.gerar` sempre recebe um schema zod e devolve o dado validado | Intérprete, Juiz e Memória só produzem JSON |
| Práticas da resposta sem modelo | Só do tipo `pratica` (sem ingrediente), ordenadas por `notaAdequacao` | Não dependem da casa nem de pergunta |
| Textos da resposta sem modelo | Os dois textos de "Contratos" | Aprovados pela dona |
| Identificadores só na configuração | Regra R10 no teste de arquitetura | Trocar de modelo é um commit num arquivo só |

## Contratos

### Cria

**Configuração (`config/llm-cotas.ts`, em `config/index.ts`)**

```ts
export const llmCotas = {
  fusoDoDia: "America/Los_Angeles",
  rateLimitsParaEsgotarODia: 3,
  timeoutMs: 15_000,
  modelos: {
    "gemini-3.5-flash-lite":  { rpm: 15, tpm: 250_000, rpd: 500 },
    "gemini-3.1-flash-lite":  { rpm: 15, tpm: 250_000, rpd: 500 },
    "gemini-3.6-flash":       { rpm: 5,  tpm: 250_000, rpd: 20 },
  },
  papeis: {
    decisao: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"],
    apoio:   ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite"],
    reforco: ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  },
} as const
export type Papel = keyof typeof llmCotas.papeis
```

**Tabela (`db/migrations/0002_llm_uso.sql`)**

| Tabela | Colunas |
|---|---|
| `llm_uso` | `modelo text`, `janela text` (minuto, dia), `inicio text` (minuto em ISO UTC, ou `AAAA-MM-DD` do dia da cota), `pedidos int`, `tokens int`, `rate_limits int`, `esgotado bool`; pk (`modelo`, `janela`, `inicio`) |

**Portas (`src/core/llm/`)**

```ts
// ledger.ts
export type Limites = { rpm: number; tpm: number; rpd: number }
export type UsoDoModelo = { modelo: string; minuto: { pedidos: number; tokens: number }; dia: { pedidos: number; tokens: number; rate_limits: number }; esgotado_ate?: "minuto" | "dia" }
export interface UsageLedger {
  reservar(modelo: string, limites: Limites): Promise<boolean>          // soma 1 pedido nas duas janelas, ou não soma em nenhuma
  registrarTokens(modelo: string, tokens: number): Promise<void>
  registrarRateLimit(modelo: string): Promise<void>                     // esgota o minuto; no N-ésimo do dia, esgota o dia
  uso(): Promise<UsoDoModelo[]>
  apagarAntigas(): Promise<number>
}

// router.ts
export interface ModelRouter {
  paraPapel(papel: Papel, opts?: { preferir?: string; aoTrocar?: (t: { papel: Papel; de: string; para: string; motivo: "cota" | "429" }) => void }): FornecedorDeModelo
  temModelo(papel: Papel): Promise<boolean>                              // sem reservar
}
export function createModelRouter(deps: { ledger: UsageLedger; clock: Clock; telemetry: Telemetry }): ModelRouter
export function janelaDoMinuto(agora: Date): string
export function diaDaCota(agora: Date): string

// client.ts
export interface LlmClient {
  gerar<T>(p: { modelo: string; instrucoes: string; entrada: string; schema: z.ZodType<T>; timeoutMs?: number }): Promise<{ dado: T; tokens: { entrada: number; saida: number } }>   // lança LlmError
}

// chamar.ts
export class SemModeloError extends RituError {}     // code: "sem_modelo"
export function chamarComPapel<T>(
  deps: { router: ModelRouter; client: LlmClient; telemetry: Telemetry },
  p: { papel: Papel; instrucoes: string; entrada: string; schema: z.ZodType<T>; preferir?: string; aoTrocar?: (t: Troca) => void },
): Promise<{ dado: T; modelo: string; tokens: { entrada: number; saida: number }; trocas: number; tentativas: number }>
```

Comportamento de `FornecedorDeModelo` devolvido por `paraPapel`:

- `proximo()`: percorre a lista do papel a partir do preferido (se houver) e devolve o primeiro em que `reservar` der certo. Se não for o mesmo da chamada anterior, preenche `troca` e chama `aoTrocar`.
- `usou(modelo, tokens)`: `registrarTokens` com a soma de entrada e saída; métricas `ritu_llm_chamadas_total` e `ritu_tokens_total`.
- `falhou(modelo, erro)`: `rate_limit` → `registrarRateLimit`; todo erro → `ritu_llm_erros_total` com `codigo`.
- A cada `proximo`, atualiza `ritu_llm_cota_usada` (fração de pedidos usada) para o modelo e a janela.

**Adaptadores e fakes**

- `src/infra/db/usage-ledger.ts` (Postgres) e, em `src/infra/fakes/memory-stores.ts`, `createMemoryLedger(clock, limitesPorTeste?)`.
- `src/infra/gemini/client.ts`: `createGeminiClient(deps: { apiKey: () => string }): LlmClient`.
- `src/infra/fakes/fake-llm.ts`: `createFakeLlm(respostas: (unknown | { erro: LlmError["code"] })[]): LlmClient & { pedidos: unknown[] }`.
- Container: ganha `ledger`, `router` e `llm`.

**Resposta sem modelo (`src/core/llm/sem-modelo.ts`)**

```ts
export type RespostaSemModelo = {
  resposta: string
  praticas: { pratica_id: string; nome: string; verbos: string[]; linha_base: string }[]    // 0 a 3
}
export function respostaSemModelo(p: { estados: Estado[]; momento_do_dia: MomentoDoDia; filtro: FiltroPessoa; prakriti?: Prakriti }, kb: KnowledgeBase): RespostaSemModelo
```

Textos (em `src/core/llm/textos.ts`):

- Com estados: "Meu limite de conversas de hoje acabou, então não consigo pensar na sua mensagem com calma. Para você não ficar sem nada, separei direto da base o que costuma ajudar quando a pessoa está {estados}:". `{estados}` são os rótulos de `estados.yaml` em minúsculas, ligados por vírgula e "e".
- Sem estados: "Meu limite de conversas de hoje acabou e não consigo ler sua mensagem agora. Se você marcar como está nos atalhos, eu separo direto da base o que costuma ajudar. Minha casa, Como ficou? e as trocas continuam funcionando."

**Limpeza**: `executarLimpeza` (da 004) passa a receber `ledger` e devolve também `llm_uso: number`.

**Teste de arquitetura, regra R10**: texto que casa com `/gemini-[0-9]/` em qualquer arquivo de `src/`, `scripts/` ou `evals/` que não seja `config/llm-cotas.ts` ou um teste. Mensagem: `<arquivo>: R10`.

**Scripts**

| Script | O que faz |
|---|---|
| `cotas` | `node --env-file-if-exists=.env.local --import tsx scripts/cotas.ts`: tabela de uso por modelo. Precisa do banco |
| ⚠️ `modelos:check` | `node --env-file-if-exists=.env.local --import tsx scripts/modelos-check.ts`: uma chamada mínima por modelo, passando pelo registro de uso |

### Usa

- Spec 001: `RituError`, `Clock`, `requireEnv`, container, teste de arquitetura.
- Spec 002: `KnowledgeBase`, `Estado`, `MomentoDoDia`, `FiltroPessoa`, `Prakriti`, `notaAdequacao`, `passaNoFiltro`.
- Spec 004: driver e migrações, `executarLimpeza`, `diaLocal`, ⚠️ `test:db`.
- Spec 005: `FornecedorDeModelo`, `LlmError`, `Telemetry`, nomes de métricas.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/modelos/`, com o registro em memória e o relógio fixo:

- `papeis.eval.ts`: cada papel pede o modelo principal enquanto há cota.
- `troca.eval.ts`: cota do minuto, cota do dia e erro 429 levam ao próximo modelo da lista do papel; a troca aparece no gancho e na métrica.
- `virada.eval.ts`: o registro vira o dia à meia-noite do Pacífico.
- `sem-modelo.eval.ts`: sem modelo para `decisao`, `respostaSemModelo` devolve o texto certo e práticas válidas para cada estado; nenhuma prática contraindicada ou barrada por "evitar sempre".
- `loop-com-router.eval.ts`: no loop da 005 com o roteador real e o registro em memória, um `rate_limit` no meio do run troca de modelo sem contar chamada e o run termina em `done`.

Com LLM: nenhum caso novo. A família Custo (checkpoint `c1-base`) usa os números desta spec.

## Nível das partes

- **nucleo** (Sonnet): `router.ts`, `chamar.ts`, os dois adaptadores do registro de uso (atomicidade) e o adaptador Gemini.
- `mecanica`: configuração, migração, fakes, `sem-modelo.ts`, scripts, R10, evals.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `AI.md` §10: papéis, cotas e regras do roteador.
- `DATA-SOURCES.md` §3: Gemini.

## Dependências

- Specs 001, 002, 004 e 005.
- Pacote `@google/genai` (estável mais recente).
- `GEMINI_API_KEY` do projeto de desenvolvimento, só para ⚠️ `modelos:check`.

## Riscos e trade-offs

- **Contagem própria diferente da do provedor:** chamadas feitas fora do roteador (AI Studio, outro ambiente com a mesma chave) não são vistas. O tratamento do 429 cobre a diferença; por isso cada ambiente tem a sua chave.
- **Janela de minuto fixa:** na virada do minuto podem sair até 2 × `rpm` pedidos em poucos segundos. O 429 resultante só tira o modelo por um minuto.
- **Identificadores e cotas mudam:** estão num arquivo só, e ⚠️ `modelos:check` mostra o que deixou de existir. Atualizar é um commit e uma linha em `AI.md` §10.
- **`decisao` e `apoio` podem cair no mesmo modelo** quando o principal de um deles esgota. O Juiz perde a independência de modelo nesse intervalo; preferimos isso a parar de responder.
- **Resposta sem modelo é genérica:** só práticas sem ingrediente. É o mínimo para a pessoa não sair de mãos vazias.

## Edge cases e modos de falha

- Modelo preferido sem vaga: segue a lista do papel desde o início.
- Lista do papel com modelo que não está em `modelos`: erro na criação do roteador (teste de configuração).
- `usou` de um modelo sem reserva anterior (retomada depois de pausa longa): soma os tokens assim mesmo.
- Banco fora do ar na reserva: o erro sobe; o run termina com erro e a resposta segura (007).
- Relógio do servidor em UTC: `diaDaCota` usa sempre o fuso da configuração.
- `respostaSemModelo` em que o filtro tira todas as práticas: devolve o texto com estados e a lista vazia.
- Chave ausente: `MissingEnvError` na primeira chamada real; testes e evals nunca chegam lá.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes; job `db` verde.
- ⚠️ `modelos:check` rodado uma vez, com o resultado no relatório da entrega.
- `AI.md` §10 igual a `config/llm-cotas.ts`.
- `AGENTS.md` com `cotas` e ⚠️ `modelos:check`.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `config/llm-cotas.ts`, `config/index.ts`
- `db/migrations/0002_llm_uso.sql`
- `src/core/llm/`: `ledger.ts`, `router.ts`, `client.ts`, `chamar.ts`, `sem-modelo.ts`, `textos.ts` e os testes
- `src/core/cleanup.ts`
- `src/infra/db/usage-ledger.ts`, `src/infra/gemini/client.ts`
- `src/infra/fakes/memory-stores.ts`, `src/infra/fakes/fake-llm.ts`
- `src/infra/container.ts`, `src/architecture.test.ts`
- `scripts/cotas.ts`, `scripts/modelos-check.ts`, `package.json`
- `test/contracts/usage-ledger.contract.ts`
- `evals/det/modelos/*.eval.ts`
- `.docs/AI.md`, `AGENTS.md`
