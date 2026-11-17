---
title: Observabilidade completa
status: implemented
implemented: a79f5ed
entrega: 2
created: 2026-11-15
---

# Observabilidade completa

> Fecha a camada 2 de `OBSERVABILITY.md`: toda métrica e todo span com os rótulos certos e um emissor, logs com lista fechada de códigos, o painel e os alertas do Grafana como código, gerados a partir de uma definição só, e um teste de privacidade que cobre todos os caminhos e o adaptador OTel de verdade. O fechamento da entrega 2 roda o `c3-confiavel` com o OTLP ligado, e é dele que o painel recebe os dados.

## Contexto

A 005 criou a porta `Telemetry`, o adaptador OTel, o fake em memória e a lista fechada de nomes. As specs 006 a 013 foram somando spans e métricas. Ninguém confere o conjunto:

- Rótulos divergentes de `OBSERVABILITY.md`: `ritu_tool_chamadas_total` sai com `tool.nome` e `tool.status` (a tabela diz `tool` e `status`); `ritu_run_duracao_ms` e `ritu_run_passos` saem sem rótulo.
- Contagem dobrada: `ritu_llm_erros_total` sai no `ModelRouter` (`modelo`, `papel`, `codigo`) e de novo no loop (`erro.codigo`).
- Atributo que nunca é preenchido: `cache.hit`.
- Métrica sem emissor: `ritu_feedback_total` (o 👍/👎 só tem a porta `runs.votar`).
- Nenhuma latência por modelo ou por tool: "onde está lento?" não tem resposta abaixo do run.
- `ritu_run_duracao_ms` é gravada por trecho do loop, sem os caminhos sem agente.
- Só dois códigos de log (`run_inicio`, `run_fim`); a degradação (clima fora, troca de modelo, cota esgotada) não deixa log.
- Não há painel, alerta, nem o `eval:llm` liga o OTel. O teste de privacidade cobre só o Acompanhante, e só no fake.

## Objetivo

- Toda métrica de `METRICAS` tem tipo, rótulos declarados e pelo menos um emissor coberto por cenário; todo span de `SPANS` sai com os atributos obrigatórios.
- O painel `Ritu` carrega sozinho no LGTM local, com cinco linhas, e os cinco alertas aparecem no Grafana.
- `painel.json` e `alertas.yaml` saem de uma definição tipada; um teste falha se o arquivo commitado divergir dela ou se alguma métrica ficar fora do painel.
- O teste de privacidade passa em todos os cenários (fake) e num run pelo adaptador OTel real, com a Mastra no meio.

## Escopo

- **Dentro:**
  - Lista fechada com tipo e rótulos de cada métrica; atributos obrigatórios de cada span; lista fechada de códigos de log com o nível.
  - Correções: rótulos de `ritu_tool_chamadas_total`; `ritu_llm_erros_total` só no roteador; `ritu_run_duracao_ms` e `ritu_run_passos` com rótulos e no ponto certo; `cache.hit`.
  - Métricas novas: `ritu_llm_duracao_ms`, `ritu_tool_duracao_ms`, `ritu_juiz_total`.
  - Toque de voto (`tocarVoto`), para o 👍/👎 ter emissor antes da tela.
  - `run.id` em todo log emitido dentro de um run; logs de degradação.
  - Buckets dos histogramas em `config/telemetria.ts`.
  - Painel como código (cinco linhas) e alertas como código (cinco regras, sem notificação); provisionamento no LGTM; imagem do LGTM fixada.
  - `npm run painel:gerar` e ⚠️ `npm run painel:check`.
  - `eval:llm` e `demo` ligando o OTel quando há endpoint; `instrumentation.ts` ligando métricas e logs.
  - Evals determinísticos de cobertura e de privacidade; teste de privacidade do adaptador OTel.
- **Fora:**
  - A rodada ⚠️ do `c3-confiavel`: é o fechamento da entrega 2, logo depois desta spec (abaixo, em "Resultado").
  - Rota `POST /api/feedback` e os botões 👍/👎 (018).
  - Grafana Cloud, endpoint e token de produção, import do painel e das regras por lá (022).
  - Página Bastidores (023).
  - Notificação de alerta (e-mail, Slack): o produto não notifica.
  - Tela Como pensei (020).

## Necessidade de negócio

O Ritu se apresenta como um agente rastreável. Sem painel, a telemetria é só dado guardado; com ele, qualquer pessoa da equipe vê em um minuto quanto o agente gasta, onde demora, quando troca de modelo e quando o juiz barra. Os alertas dizem quando olhar. O teste de privacidade garante que nada disso carrega texto da pessoa, o que é regra inegociável.

## Critérios de aceite

- [ ] **Lista fechada com tipo e rótulos:** `METRICAS` é um registro nome → `{ tipo, rotulos }`; `contador`, `histograma` e `medidor` só aceitam nomes do seu tipo (erro de compilação). O fake lança `rotulos_invalidos: <metrica>` quando os rótulos emitidos não são exatamente os declarados.
- [ ] **Rótulos corrigidos:** `ritu_tool_chamadas_total{tool, status}`; `ritu_llm_erros_total{modelo, papel, codigo}` sai uma vez por erro, só do `ModelRouter`.
- [ ] **Run:** cada trecho de trabalho num run (mensagem nova, `continuar`, `aprovar`), em qualquer caminho, inclusive os sem agente, grava `ritu_run_duracao_ms{caminho, status}` com o tempo do trecho, e `status` é o status do run ao fim do trecho. O encerramento final (`done`, `failed`, `cancelled`) grava `ritu_run_passos{caminho, status}` uma vez por run.
- [ ] **Latências:** toda chamada de modelo bem-sucedida grava `ritu_llm_duracao_ms{modelo, papel}`; toda tool chamada pelo loop grava `ritu_tool_duracao_ms{tool}`. As duas medidas vêm do `Clock`.
- [ ] **Buckets:** os quatro histogramas usam os limites de `config/telemetria.ts` no adaptador OTel (conferido com o exportador em memória).
- [ ] **Juiz:** cada julgamento soma `ritu_juiz_total{resultado}` com `aprovado`, `reprovado` ou `sem_juiz`.
- [ ] **cache.hit:** `tool.chamada` de `clima.agora` e `clima.proximas_horas` leva `cache.hit` (`true` na segunda chamada da mesma cidade dentro da validade do cache).
- [ ] **Árvore:** em todo cenário, todo span sem falha sai com os atributos obrigatórios de `SPANS`; `run` leva `prompt.versao` quando o caminho tem agente.
- [ ] **Voto:** `tocarVoto` grava o voto e soma `ritu_feedback_total{voto}` quando o voto é novo ou mudou; o mesmo voto de novo não soma; run de outra conta, inexistente ou sem resposta entregue devolve `toque_invalido`.
- [ ] **Logs:** `log` só aceita códigos de `LOGS` e o nível vem da lista. Log emitido dentro de um span `run` leva `run.id` e `trace_id` sem quem chama passar. Clima fora do ar, troca de modelo, papel sem modelo, erro de modelo e resposta segura geram o log `warn` correspondente; run que termina `failed` gera `run_falhou` (`error`) com `erro.codigo`.
- [ ] **Painel gerado:** `npm run painel:gerar` escreve `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml`; rodar duas vezes não muda nada; o teste falha se o commitado divergir do gerado.
- [ ] **Painel completo:** toda métrica de `METRICAS` aparece em alguma consulta; toda consulta só cita métricas de `METRICAS` (com `_bucket`, `_count` e `_sum` nos histogramas).
- [ ] **Provisionamento:** com `docker compose up -d`, o painel `Ritu` (uid `ritu`) e as cinco regras da pasta `Ritu` aparecem no Grafana em `localhost:3001` sem passo manual.
- [ ] **painel:check ⚠️:** com o LGTM no ar, imprime cada painel com "com dados" ou "sem dados" nas últimas 24 h, as séries `ritu_*` que o Prometheus conhece e as que o painel espera e não existem; sai com 1 se o painel ou as regras não estão carregados, com 2 se o Grafana não responde, e com 0 nos outros casos.
- [ ] **OTel nos scripts:** com `OTEL_EXPORTER_OTLP_ENDPOINT`, `npm run demo` e `npm run eval:llm` exportam traces, métricas e logs e descarregam tudo antes de sair; sem a variável, nada de OTel é carregado.
- [ ] **Next:** com endpoint, `register()` liga traces, métricas e logs (teste com o módulo do OTel substituído por um espião); sem endpoint, não importa nada de OTel.
- [ ] **Privacidade, fake:** em todos os cenários de `test/fixtures/cenarios`, nos toques (retorno, gosto, troca, voto) e em `detectarPadroes`, com canários plantados em todo campo de texto da pessoa: nenhum canário e nenhum nome de alimento da base aparece em span, evento, métrica, log, `resumo` de etapa ou saída de console; todo valor de texto emitido casa com `^[a-z0-9][a-z0-9_.:,\-]{0,63}$`.
- [ ] **Privacidade, adaptador real:** um cenário pelo `createOtelTelemetry` com exportadores em memória, e uma chamada pelo runtime da Mastra com o modelo fixo, exportam só spans de `SPANS`, métricas de `METRICAS` e logs de `LOGS`, sem canário em nenhum atributo, rótulo ou corpo.
- [ ] **Cobertura:** a suíte de cenários emite todos os nomes de `SPANS` e de `METRICAS` pelo menos uma vez, e os logs `run_inicio`, `run_fim`, `clima_indisponivel`, `troca_de_modelo`, `sem_modelo`, `llm_erro` e `resposta_segura`.
- [ ] Gates 1 a 6 verdes; `npm run dup` sem duplicação nova.

## O que fazer

- Reescrever `src/core/telemetry/nomes.ts` como registros (`SPANS`, `METRICAS`, `LOGS`) e derivar os tipos deles. Manter `ATRIBUTOS_PERMITIDOS` e `MAX_TEXTO_ATRIBUTO`.
- Mudar a porta `Telemetry` (abaixo) e os três adaptadores: OTel, nulo e fake.
- Corrigir os emissores listados em "Contexto" e acrescentar os novos (abaixo, "Emissores").
- Escrever a definição do painel e dos alertas em TypeScript e gerar os dois arquivos a partir dela.
- Montar o provisionamento no `docker-compose.yml`, conferindo os caminhos na imagem fixada.
- Ligar o OTel em `scripts/demo.ts` e `scripts/eval-llm.ts` como `loop:demo` já faz (`container.iniciarTelemetria()` no começo, `container.encerrar()` no fim, também em erro).
- Juntar o eval de privacidade do Acompanhante (`evals/det/acompanhante/privacidade.eval.ts`) ao novo, em `evals/det/telemetria/`.
- No fechamento: tirar um print do painel com a skill `playwright` depois de `npm run demo -- --cenario frio-agitada --esgotar decisao` com o OTLP ligado, salvo em `.plans/015-painel.png`.

## O que não fazer

- Não pôr `run.id`, `trace_id`, `conta_id`, nome de alimento ou cidade em rótulo de métrica (cardinalidade e privacidade). `run.id` e `trace_id` só em span e log.
- Não criar métrica que não esteja em `METRICAS`, nem consulta de painel que cite nome fora dela.
- Não editar `ritu.json` nem `ritu.yaml` à mão.
- Não configurar ponto de contato, política de notificação nem e-mail no Grafana.
- Não ligar a captura de entrada e saída da Mastra (`OPCOES_DE_TRACE` continua `hideInput` e `hideOutput`).
- Não amostrar traces: o volume é baixo, todo run vira trace.
- Não acrescentar variável de ambiente: o endereço do Grafana local fica em `config/telemetria.ts`.
- Não chamar modelo nos testes desta spec.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Fonte do painel | Definição em TypeScript (`scripts/lib/painel.ts`) que gera o JSON e o YAML | Um teste confere que toda métrica está no painel e que nenhuma consulta cita nome inexistente; JSON do Grafana à mão não se testa |
| Alertas | Cinco regras como código, só visíveis no Grafana, limites em `config/telemetria.ts` | Decisão da dona. Os limites são chutes iniciais, como as metas dos evals |
| Rótulos | Declarados por métrica; o fake recusa conjunto diferente | Pega o erro na hora do teste, não no painel vazio |
| Nível do log | Vem de `LOGS`; `log(codigo, campos)` | Não há como o mesmo código sair com níveis diferentes |
| `run.id` no log | Propagado pelo contexto do span `run`, no adaptador e no fake | Ninguém esquece de passar |
| Duração do run | Por trecho (o tempo que a pessoa espera), com o status ao fim do trecho; passos uma vez por run, no encerramento | Mede a espera real; o encerramento conta runs e falhas |
| Latência de modelo | `ModelRouter`, em `usou(modelo, tokens, duracaoMs)` | Um só ponto para Intérprete, Acompanhante, Memória e Juiz |
| `cache.hit` | O cache do clima atribui ao span ativo (`atribuirAoSpanAtual`) | Só o cache sabe se acertou; a saída da tool não muda |
| Log de clima fora | No cache do clima, quando a fonte falha | Um log por falha, não um por tool |
| Juiz | `ritu_juiz_total{resultado}` | Denominador da taxa de reprovação, que o alerta usa |
| 👍/👎 | `tocarVoto` no core agora; rota e botões na 018 | Toda métrica tem emissor no fim da entrega 2 |
| `votar` | Devolve o voto anterior | O toque só conta voto novo ou mudado |
| Totais no painel | `sum(max_over_time(...[$__range]))` por processo; séries no tempo com `increase` | Scripts vivem segundos e `increase` perde o primeiro trecho de cada processo; cada processo tem `service.instance.id` próprio |
| Linha 5 do painel | Rastro: runs recentes (Tempo) e avisos e erros (Loki) | Do número para o trace em um clique |
| Datasources | Variáveis de painel por tipo (`ds_metricas`, `ds_logs`, `ds_traces`) | O mesmo JSON serve no LGTM e no Grafana Cloud |
| Imagem do LGTM | Fixada numa tag | Caminho de provisionamento e nomes de série não mudam por baixo |
| Exportação nos scripts | Intervalo de 5 s | Script curto ainda manda pelo menos uma leitura antes do fim |

## Contratos

### Cria

**`src/core/telemetry/nomes.ts`** (substitui as listas)

```ts
export const SPANS = {
  run: ["run.id", "run.caminho", "run.intencoes", "conta.tipo", "run.status", "run.passos"],
  "guardrail.entrada": ["guardrail.resultado"],
  interprete: [],
  preparo: ["candidatos.total", "faltas.registradas", "para_ter.candidato"],
  "agente.passo": ["passo.ordem"],
  "llm.chamada": [
    "llm.papel", "gen_ai.request.model", "llm.troca_de_modelo",
    "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens", "llm.tentativas",
  ],
  "tool.chamada": ["tool.nome", "tool.status"],
  validacao: ["validacao.ok", "validacao.violacoes", "validacao.tentativa"],
  juiz: ["juiz.aprovado", "juiz.tentativa"],
  "aprovacao.execucao": ["propostas.total", "propostas.aprovadas"],
  toque: ["tipo"],
  "memoria.resumo": ["resumo.origem"],
  "padroes.deteccao": ["padroes.contas", "padroes.propostos"],
} as const satisfies Record<string, readonly AtributoPermitido[]>
// Valores: atributos obrigatórios num span que termina sem falha.
// Condicionais: `prompt.versao` em `run` com agente; `cache.hit` em `tool.chamada` de `clima.*`;
// `motivo` e `resultado` em `toque` de troca (011).

export type NomeDeSpan = keyof typeof SPANS

export const METRICAS = {
  ritu_run_duracao_ms: { tipo: "histograma", rotulos: ["caminho", "status"] },
  ritu_run_passos: { tipo: "histograma", rotulos: ["caminho", "status"] },
  ritu_run_intencao_total: { tipo: "contador", rotulos: ["intencao"] },
  ritu_tokens_total: { tipo: "contador", rotulos: ["modelo", "papel", "direcao"] },
  ritu_llm_chamadas_total: { tipo: "contador", rotulos: ["modelo", "papel"] },
  ritu_llm_duracao_ms: { tipo: "histograma", rotulos: ["modelo", "papel"] },
  ritu_llm_cota_usada: { tipo: "medidor", rotulos: ["modelo", "janela"] },
  ritu_llm_troca_de_modelo_total: { tipo: "contador", rotulos: ["papel", "de", "para", "motivo"] },
  ritu_llm_erros_total: { tipo: "contador", rotulos: ["modelo", "papel", "codigo"] },
  ritu_fallback_sem_llm_total: { tipo: "contador", rotulos: [] },
  ritu_tool_chamadas_total: { tipo: "contador", rotulos: ["tool", "status"] },
  ritu_tool_duracao_ms: { tipo: "histograma", rotulos: ["tool"] },
  ritu_validacao_violacoes_total: { tipo: "contador", rotulos: ["violacao"] },
  ritu_guardrail_total: { tipo: "contador", rotulos: ["resultado", "origem"] },
  ritu_juiz_total: { tipo: "contador", rotulos: ["resultado"] },
  ritu_juiz_reprovacoes_total: { tipo: "contador", rotulos: ["motivo"] },
  ritu_juiz_avisos_total: { tipo: "contador", rotulos: ["motivo"] },
  ritu_pausas_total: { tipo: "contador", rotulos: ["tipo"] },
  ritu_propostas_total: { tipo: "contador", rotulos: ["tool", "decisao"] },
  ritu_rotina_resumo_total: { tipo: "contador", rotulos: ["origem"] },
  ritu_padroes_total: { tipo: "contador", rotulos: ["tipo", "etapa"] },
  ritu_feedback_total: { tipo: "contador", rotulos: ["voto"] },
  ritu_retorno_total: { tipo: "contador", rotulos: ["resultado", "origem"] },
  ritu_troca_ingrediente_total: { tipo: "contador", rotulos: ["resultado"] },
  ritu_gosto_total: { tipo: "contador", rotulos: ["gosto"] },
  ritu_faltas_total: { tipo: "contador", rotulos: ["origem"] },
  ritu_para_ter_total: { tipo: "contador", rotulos: ["etapa"] },
} as const satisfies Record<string, { tipo: "contador" | "histograma" | "medidor"; rotulos: readonly AtributoPermitido[] }>

export type NomeDeMetrica = keyof typeof METRICAS
export type NomeDeContador = { [K in NomeDeMetrica]: (typeof METRICAS)[K]["tipo"] extends "contador" ? K : never }[NomeDeMetrica]
export type NomeDeHistograma = /* idem, "histograma" */
export type NomeDeMedidor = /* idem, "medidor" */

export const LOGS = {
  run_inicio: "info",            // campos: — (run.id e trace_id vêm do contexto)
  run_retomado: "info",          // pausa.tipo
  run_fim: "info",               // run.status, run.caminho, run.passos
  clima_indisponivel: "warn",    // erro.codigo
  troca_de_modelo: "warn",       // papel, de, para, motivo
  sem_modelo: "warn",            // papel
  llm_erro: "warn",              // modelo, papel, codigo
  resposta_segura: "warn",       // motivo
  atributo_proibido: "warn",     // erro.codigo
  run_falhou: "error",           // erro.codigo
  padroes_falha_na_conta: "error", // erro.codigo (012)
  erro_inesperado: "error",      // erro.codigo
} as const

export type CodigoDeLog = keyof typeof LOGS
```

Mudanças nos atributos permitidos: entram `resumo.origem`, `padroes.contas` e `padroes.propostos` (se a 012 ainda não os pôs). Os nomes acrescentados pelas specs 011 a 013 (`toque`, `memoria.resumo`, `padroes.deteccao`, `ritu_rotina_resumo_total`, `ritu_padroes_total`, `ritu_guardrail_total`, `ritu_juiz_avisos_total`) já estão nos registros acima; quem construiu antes só acrescentou à lista antiga.

**Porta `Telemetry`** (`src/core/telemetry/ports.ts`)

```ts
export interface Telemetry {
  span<T>(nome: NomeDeSpan, atributos: Atributos, fn: (s: SpanAtivo) => Promise<T>, opts?: { traceparent?: string }): Promise<T>
  evento(nome: "pausa", atributos?: Atributos): void
  contador(nome: NomeDeContador, rotulos?: Atributos, valor?: number): void
  histograma(nome: NomeDeHistograma, valor: number, rotulos?: Atributos): void
  medidor(nome: NomeDeMedidor, valor: number, rotulos?: Atributos): void
  atribuirAoSpanAtual(a: Atributos): void         // novo
  log(codigo: CodigoDeLog, campos?: Atributos): void // muda: sem o nível
  traceparentAtual(): string | undefined
  encerrar(): Promise<void>
}
```

Comportamento comum aos adaptadores:

- Dentro de um span `run` (aberto ou continuado), todo `log` ganha `run.id` (do atributo do span, inclusive quando chega depois por `atribuir`) e `trace_id`, se quem chama não os passou.
- `atribuirAoSpanAtual` sem span ativo não faz nada.

Adaptador OTel (`src/infra/otel/telemetry.ts`):

- Histograma criado com `advice: { explicitBucketBoundaries }` de `config/telemetria.ts`.
- `run.id` no contexto: ao abrir `run`, guarda um portador mutável numa chave de contexto própria; `atribuir` com `run.id` atualiza o portador.
- Exceção que escapa de um span `run`: além de `falhar("erro_inesperado")`, log `erro_inesperado`.

Fake (`src/infra/fakes/memory-telemetry.ts`):

- Lança `rotulos_invalidos: <metrica>` se o conjunto de rótulos não é exatamente o declarado.
- `LogRegistrado` passa a `{ codigo: CodigoDeLog; nivel; campos }`, com o nível de `LOGS`.
- `SpanRegistrado` guarda os atributos finais (abertura mais `atribuir` e `atribuirAoSpanAtual`).

Nulo: implementa o método novo sem fazer nada.

**`config/telemetria.ts`** (entra em `config/index.ts`)

```ts
export const telemetria = {
  buckets: {
    ritu_run_duracao_ms: [250, 500, 1000, 2000, 4000, 8000, 15000, 30000, 60000],
    ritu_run_passos: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12],
    ritu_llm_duracao_ms: [250, 500, 1000, 2000, 4000, 8000, 15000, 30000],
    ritu_tool_duracao_ms: [5, 25, 100, 250, 500, 1000, 2500, 5000],
  },
  exportacaoNosScriptsMs: 5000,
  alertas: {
    cotaDoDia: 0.8,
    runsFalhando: { taxa: 0.1, minimoDeRuns: 5, janela: "1h" },
    juizReprovando: { taxa: 0.2, minimoDeJulgamentos: 5, janela: "1h" },
    semModelo: { minimo: 1, janela: "1h" },
    rateLimit: { minimo: 5, janela: "10m" },
  },
  grafana: { url: "http://localhost:3001", uidDoPainel: "ritu", pasta: "Ritu", uidMetricas: "prometheus" },
} as const
```

Teste de config: todo histograma de `METRICAS` tem buckets, em ordem crescente, e nenhuma chave de `buckets` fica sem métrica. `uidMetricas` é conferido na imagem fixada.

**Toque de voto** (`src/core/touches/voto.ts`)

```ts
export function tocarVoto(deps: Deps, contaId: string, runId: string, voto: "up" | "down"): Promise<void>
// Deps da 011. Dentro do span `toque` (tipo: "voto").
// Run inexistente, de outra conta ou sem `saida`: RituError "toque_invalido".
// anterior = runs.votar(...); anterior !== voto → ritu_feedback_total{voto}.
```

**Emissores** (o que muda em cada lugar)

| Onde | O que faz |
|---|---|
| Ajudante do serviço de runs que abre ou continua o span `run` (008) | Mede o trecho com o `Clock`; no fim, `ritu_run_duracao_ms{caminho, status}`. Ao continuar (`continuar`, `aprovar`), log `run_retomado` com `pausa.tipo`. O span `run` recebe `run.caminho` e `run.intencoes` (ids unidos por vírgula) assim que o caminho é escolhido |
| `encerrar` do serviço de runs | `ritu_run_passos{caminho, status}` com `run.passos`; log `run_fim` com status, caminho e passos. O histograma sai de `executarRun` |
| `falhar` do serviço de runs | Log `run_falhou` com `erro.codigo` |
| `ModelRouter` | `usou(modelo, tokens, duracaoMs)` grava `ritu_llm_duracao_ms`; troca anunciada gera log `troca_de_modelo`; papel sem modelo com vaga gera log `sem_modelo`; `falhou` gera log `llm_erro` |
| Loop (`tratarFalha`) | Deixa de somar `ritu_llm_erros_total` |
| Loop e `chamarComPapel` | Medem a chamada com o `Clock` e passam `duracaoMs` a `usou` |
| Loop (`tool.chamada`) | `ritu_tool_chamadas_total{tool, status}` e `ritu_tool_duracao_ms{tool}` |
| `createCachedWeatherSource(dentro, clock, telemetry)` | `atribuirAoSpanAtual({ "cache.hit": … })` em toda consulta; falha da fonte gera log `clima_indisponivel` com `erro.codigo` e segue o comportamento de hoje |
| Onde a saída vira `saidaSegura` (007, 013) | Log `resposta_segura` com `motivo` |
| `julgar` (013) | `ritu_juiz_total{resultado}` por julgamento: `aprovado`, `reprovado`; `sem_modelo` ou erro, `sem_juiz` |
| `detectarPadroes` (012) | O log de erro por conta usa o código `padroes_falha_na_conta` |

### Painel e alertas

**Definição** (`scripts/lib/painel.ts`)

```ts
export type Fonte = "metricas" | "logs" | "traces"
export type Painel = {
  titulo: string
  descricao: string              // a pergunta que o painel responde, uma frase
  tipo: "timeseries" | "stat" | "barchart" | "bargauge" | "table" | "logs"
  fonte: Fonte
  consultas: { expr: string; legenda?: string }[]
  unidade?: "ms" | "percentunit" | "short"
  limites?: { amarelo: number; vermelho: number }
}
export type Linha = { titulo: string; paineis: Painel[] }
export const PAINEL: { uid: string; titulo: "Ritu"; linhas: Linha[] }

export type Alerta = { uid: string; titulo: string; expr: string; para: string; resumo: string }
export const ALERTAS: Alerta[]
```

**Gerador** (`scripts/lib/painel-grafana.ts`): `gerarPainel(PAINEL): object` e `gerarAlertas(ALERTAS): string` (YAML de provisionamento de regras do Grafana, `apiVersion: 1`, um grupo `ritu` na pasta `Ritu`, intervalo de 1 min). Painel com as variáveis `ds_metricas` (prometheus), `ds_logs` (loki) e `ds_traces` (tempo), intervalo padrão de 24 h, uma linha recolhível por `Linha`, painéis de 12 colunas (stat de 6) e 8 de altura. `scripts/painel.ts` (`npm run painel:gerar`) grava os dois arquivos com JSON formatado em 2 espaços e fim de linha.

**Linhas e consultas.** `$__range` nos totais, `$__rate_interval` nas séries. `TOTAL(m, por)` abrevia `sum by (por) (max_over_time(m[$__range]))`; sem `por`, `sum(max_over_time(m[$__range]))`.

| Linha | Painel | Tipo | Consulta |
|---|---|---|---|
| 1. Saúde | Runs por hora | timeseries | `sum by (status) (increase(ritu_run_passos_count[1h]))` |
| | Espera por resposta, p50 e p95 | timeseries, ms | `histogram_quantile(0.5 \| 0.95, sum by (le) (rate(ritu_run_duracao_ms_bucket[$__rate_interval])))` |
| | Runs que falharam | stat, percentunit, 5% e 10% | `TOTAL(ritu_run_passos_count{status="failed"}) / TOTAL(ritu_run_passos_count)` |
| | 429 do modelo | stat | `TOTAL(ritu_llm_erros_total{codigo="rate_limit"})` |
| | Latência do modelo, p95 | timeseries, ms | `histogram_quantile(0.95, sum by (le, modelo) (rate(ritu_llm_duracao_ms_bucket[$__rate_interval])))` |
| | Latência das tools, p95 | barchart, ms | `histogram_quantile(0.95, sum by (le, tool) (increase(ritu_tool_duracao_ms_bucket[$__range])))` |
| 2. Agente | Intenções | barchart | `TOTAL(ritu_run_intencao_total, intencao)` |
| | Caminhos | barchart | `TOTAL(ritu_run_passos_count, caminho)` |
| | Passos por run | timeseries | `sum by (caminho) (rate(ritu_run_passos_sum[$__rate_interval])) / sum by (caminho) (rate(ritu_run_passos_count[$__rate_interval]))` |
| | Tools | barchart | `TOTAL(ritu_tool_chamadas_total, tool, status)` |
| | Violações do validador | barchart | `TOTAL(ritu_validacao_violacoes_total, violacao)` |
| | Juiz | barchart | `TOTAL(ritu_juiz_total, resultado)`; `TOTAL(ritu_juiz_reprovacoes_total, motivo)`; `TOTAL(ritu_juiz_avisos_total, motivo)` |
| | Guardrail | barchart | `TOTAL(ritu_guardrail_total, resultado, origem)` |
| | Pausas | barchart | `TOTAL(ritu_pausas_total, tipo)` |
| | Memória | barchart | `TOTAL(ritu_rotina_resumo_total, origem)`; `TOTAL(ritu_padroes_total, tipo, etapa)` |
| 3. Modelos e cota | Chamadas por modelo e papel | timeseries | `sum by (modelo, papel) (increase(ritu_llm_chamadas_total[1h]))` |
| | Tokens | barchart | `TOTAL(ritu_tokens_total, modelo, direcao)` |
| | Cota do dia | bargauge, percentunit, 80% e 100% | `max by (modelo) (last_over_time(ritu_llm_cota_usada{janela="dia"}[$__range]))` |
| | Cota do minuto | timeseries, percentunit | `max by (modelo) (ritu_llm_cota_usada{janela="minuto"})` |
| | Trocas de modelo | table | `TOTAL(ritu_llm_troca_de_modelo_total, papel, de, para, motivo)` |
| | Respostas sem modelo | stat, 1 e 1 | `TOTAL(ritu_fallback_sem_llm_total)` |
| | Erros do modelo | barchart | `TOTAL(ritu_llm_erros_total, modelo, codigo)` |
| 4. Qualidade | 👍/👎 | barchart | `TOTAL(ritu_feedback_total, voto)` |
| | Retornos | barchart | `TOTAL(ritu_retorno_total, resultado, origem)` |
| | Trocas de ingrediente | barchart | `TOTAL(ritu_troca_ingrediente_total, resultado)` |
| | Gostos | barchart | `TOTAL(ritu_gosto_total, gosto)` |
| | Faltas | barchart | `TOTAL(ritu_faltas_total, origem)` |
| | Propostas | barchart | `TOTAL(ritu_propostas_total, tool, decisao)` |
| | Vale ter em casa | barchart | `TOTAL(ritu_para_ter_total, etapa)` |
| 5. Rastro | Runs recentes | table, traces | TraceQL `{ name = "run" }`, 20 linhas, com `run.caminho`, `run.status`, `run.passos` e a duração |
| | Avisos e erros | logs, logs | `{service_name="ritu"} \| severity_text=~"WARN\|ERROR"` |

As consultas de Loki e Tempo são o ponto de partida: conferir na imagem fixada o nome do rótulo de serviço e do campo de severidade, e anotar a diferença em `.plans/DECISOES-AUTONOMAS.md`.

**Alertas** (limites de `config/telemetria.ts`; `para: "0m"`; sem dados = normal; erro de execução = erro; rótulo `gravidade: aviso`)

| uid | Título | Expressão |
|---|---|---|
| `ritu-cota-do-dia` | Cota do dia acima de 80% | `max by (modelo) (ritu_llm_cota_usada{janela="dia"}) >= 0.8` |
| `ritu-runs-falhando` | Mais de 10% dos runs falhando em 1 h | `(sum(increase(ritu_run_passos_count{status="failed"}[1h])) / sum(increase(ritu_run_passos_count[1h]))) >= 0.1 and sum(increase(ritu_run_passos_count[1h])) >= 5` |
| `ritu-sem-modelo` | Resposta montada sem modelo | `sum(increase(ritu_fallback_sem_llm_total[1h])) >= 1` |
| `ritu-juiz-reprovando` | Juiz reprovando acima de 20% | `(sum(increase(ritu_juiz_total{resultado="reprovado"}[1h])) / sum(increase(ritu_juiz_total[1h]))) >= 0.2 and sum(increase(ritu_juiz_total[1h])) >= 5` |
| `ritu-429` | 429 frequente | `sum(increase(ritu_llm_erros_total{codigo="rate_limit"}[10m])) >= 5` |

**Arquivos gerados e provisionamento**

- `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml`: gerados.
- `observability/grafana/dashboards.yaml`: provedor de dashboards escrito à mão (`ritu`, pasta `Ritu`, `allowUiUpdates: false`), apontando para onde `observability/dashboards/` é montada.
- `docker-compose.yml`: `lgtm` com a imagem numa tag fixa e três volumes só leitura: `dashboards.yaml` e `alerting/ritu.yaml` nos diretórios de provisionamento do Grafana da imagem (que somam aos que ela já tem), e `observability/dashboards/` no diretório do provedor.

**`scripts/painel-check.ts`** (⚠️ `npm run painel:check`)

Usa a API HTTP do Grafana em `telemetria.grafana.url` (o LGTM entra como admin anônimo): confere `GET /api/dashboards/uid/ritu` e as cinco regras em `GET /api/v1/provisioning/alert-rules`; para cada consulta de métrica do painel, `POST /api/ds/query` nas últimas 24 h; lista os nomes `ritu_*` do Prometheus. Imprime uma linha por painel (`com dados` / `sem dados`), as séries esperadas que não existem e as que existem sem estar no painel. Códigos de saída: 0, 1 (painel ou regras ausentes), 2 (Grafana fora do ar).

**OTel nos processos**

- `src/infra/otel/opcoes.ts`: `opcoesDoOtel({ intervaloMs })` devolve exportadores de trace, métrica (leitor periódico) e log, e o recurso com `service.name` e `service.instance.id` (uuid por processo). `node-sdk.ts` usa com `telemetria.exportacaoNosScriptsMs`.
- `src/instrumentation.ts`: com endpoint, liga traces, métricas e logs com as mesmas opções. Conferir na versão instalada do `@vercel/otel` se `registerOTel` aceita leitor de métricas e processador de logs; se não aceitar, no runtime `nodejs` usar o `NodeSDK` de `node-sdk.ts` e anotar em `.plans/DECISOES-AUTONOMAS.md`.

### Usa

- Spec 004: `RunRepository.votar` passa a `Promise<"up" | "down" | null>` (o voto anterior; `null` sem voto ou run que não é da conta). Suíte de contrato: primeiro voto devolve `null`; o segundo devolve o primeiro.
- Spec 005: porta `Telemetry`, `createOtelTelemetry`, `createNullTelemetry`, `createMemoryTelemetry`, `ATRIBUTOS_PERMITIDOS`, `MAX_TEXTO_ATRIBUTO`, `OPCOES_DE_TRACE`, `container.iniciarTelemetria()` e `container.encerrar()`, `src/instrumentation.ts`.
- Spec 006: `ModelRouter`, `FornecedorDeModelo.usou` e `falhou`, `Troca`, `chamarComPapel`, `SemModeloError`, `ritu_llm_cota_usada` (fração de 0 a 1).
- Spec 003: `createCachedWeatherSource`.
- Spec 007: `saidaSegura`, `montarCenario`, `cenarios`, `Cenario`.
- Spec 008: ajudante do span `run`, `conversar`, caminhos.
- Spec 011: `Deps` dos toques, span `toque`, `tocarRetorno`, `tocarGosto`, `trocarIngrediente`, `RituError` `toque_invalido`.
- Spec 012: `detectarPadroes`, span `memoria.resumo` e `padroes.deteccao`, métricas de rotina e padrões.
- Spec 013: `julgar`, span `juiz`, `ritu_guardrail_total`, `ritu_juiz_reprovacoes_total`, `ritu_juiz_avisos_total`.
- Spec 014: `evals/det/mapa.ts`, `scripts/eval-llm.ts`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos novos, em `evals/det/telemetria/`:

- `privacidade.eval.ts`: substitui o da 007. Canários `zibelina` e `quarzo7` plantados em: texto da mensagem, nome livre na casa, texto livre de "evitar sempre", nota de rotina, nome da cidade e e-mail da conta. Roda todos os cenários, os quatro toques e `detectarPadroes`; junta spans, eventos, métricas, logs, `resumo` das etapas e o console (espião). Falha com canário, nome de alimento da base ou valor de texto fora do formato.
- `cobertura.eval.ts`: todos os nomes de `SPANS` e de `METRICAS` emitidos pela suíte; os sete logs da lista do critério; atributos obrigatórios em todo span sem falha; `prompt.versao` nos runs com agente; `cache.hit` nas tools de clima. Se faltar um cenário para algum nome (429, por exemplo), cria em `test/fixtures/cenarios/`.
- `voto.eval.ts`: voto novo, voto mudado, voto repetido, run de outra conta.

Testes novos fora de `evals/`: `src/infra/otel/privacidade.test.ts` (adaptador real com exportadores em memória e a Mastra com o modelo fixo); `src/infra/otel/telemetry.test.ts` ganha buckets e `run.id` nos logs; `scripts/lib/painel.test.ts` (gerado igual ao commitado, cobertura das métricas, nomes das consultas); `config/telemetria.test.ts`.

O mapa da 014 ganha as linhas novas de `QA.md` (abaixo).

Sem casos com LLM.

## Nível das partes

- **nucleo** (Sonnet): porta `Telemetry` e os três adaptadores (propagação de `run.id`, buckets, `atribuirAoSpanAtual`), medições no ajudante do span `run`, no loop e no roteador, `opcoes.ts` e `instrumentation.ts`, `src/infra/otel/privacidade.test.ts` (com a skill `mastra`).
- Todo o resto é `mecanica`: `nomes.ts`, `config/telemetria.ts`, `tocarVoto` e a porta `votar`, os emissores simples da tabela, definição e gerador do painel, `painel:check`, `docker-compose.yml`, scripts, evals.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `OBSERVABILITY.md` §3 (árvore de spans) e §5.
- `ARCHITECTURE.md` §"Pastas" (árvore de `observability/`).
- Specs 011 a 013: só os trechos de telemetria citados em "Usa", se a construção delas ainda não chegou ao código.

## Dependências

- Specs 005, 006 e 014 construídas; 008 a 013 construídas (os emissores e cenários delas entram na cobertura).
- Nenhum pacote novo: `@opentelemetry/sdk-trace-base`, `sdk-metrics`, `sdk-logs` e `context-async-hooks` já estão instalados e têm os exportadores em memória.
- Docker com `grafana/otel-lgtm` para `painel:check` e o print.
- Nenhuma migração, nenhuma variável de ambiente nova.

## Riscos e trade-offs

- **Nomes no Prometheus:** a conversão de OTLP pode acrescentar sufixo (`_total`, unidade). As consultas usam os nomes como estão em `METRICAS`; o `painel:check` lista o que existe e o que falta, e qualquer ajuste vira uma função `serie(nome)` no gerador, com teste.
- **Totais com `max_over_time` por processo:** um processo que começou antes do período soma o que fez antes dele. Em dev, com scripts curtos, é o que conta certo; em produção (022), conferir com os primeiros dados.
- **Gauge da cota:** só muda quando há chamada; o painel mostra o último valor do período, que pode ser de horas antes.
- **Alertas sem notificação:** só servem a quem abre o Grafana. É a escolha: o produto não notifica.
- **Limites chutados:** taxa de falha, reprovação e 429 saíram de bom senso; a dona ajusta em `config/telemetria.ts` depois do `c3`.
- **Formato de valor no teste de privacidade:** pega texto com espaço, acento e maiúscula; não pega uma palavra solta em minúsculas. Os canários cobrem esse caso nos campos de texto da pessoa.
- **Run expirado pela limpeza:** não passa por `encerrar` e não entra em `ritu_run_passos`. A contagem de runs é de runs que terminaram.

## Edge cases e modos de falha

- LGTM fora do ar com endpoint ligado: o exportador falha em silêncio (diagnóstico do OTel), o run segue, nada é relançado.
- `log` com campo fora de `ATRIBUTOS_PERMITIDOS` ou texto acima de 64 caracteres: o adaptador descarta o campo e emite `atributo_proibido`; o fake lança.
- `atribuirAoSpanAtual` fora de span (cache chamado pelo `clima:real`): não faz nada.
- Span `run` continuado em outro processo pelo `traceparent`: o portador do `run.id` é criado de novo na continuação, a partir do atributo `run.id` passado na abertura.
- Dois votos iguais em sequência rápida: o segundo devolve o mesmo anterior e não soma.
- `painel:gerar` com consulta que cita métrica inexistente: o teste falha antes do commit; o gerador não valida (é papel do teste).
- `painel:check` com Grafana no ar e Prometheus sem nenhuma série `ritu_*`: todos os painéis "sem dados", saída 0.
- Imagem do LGTM sem os diretórios de provisionamento esperados: a construção para, registra em `.plans/BLOQUEIOS.md` com a saída do `ls` da imagem.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates verdes; `npm run eval:det` com os três evals novos.
- `npm run painel:gerar` sem diff.
- Com `docker compose up -d` e o OTLP ligado: `npm run demo -- --cenario frio-agitada --esgotar decisao`, depois `npm run painel:check` com saída 0, a troca de modelo visível na linha "Modelos e cota", e o print em `.plans/015-painel.png`.
- **Fechamento da entrega 2, logo depois desta spec:** a rodada ⚠️ `npm run eval:llm -- --checkpoint c3-confiavel` roda com `OTEL_EXPORTER_OTLP_ENDPOINT` ligado e o LGTM no ar; o relatório do portão 2 leva o `painel:check` e um print do painel depois da rodada.
- `.docs/` conferido no fechamento: `OBSERVABILITY.md` §3 e §5, `QA.md` (linhas abaixo), `ARCHITECTURE.md` (árvore de `observability/`), `DEVELOPMENT.md` (`log(codigo, campos)`).
- `QA.md`, "Segurança e privacidade", com: "Nenhum span, métrica, log, `resumo` ou saída de console contém texto da pessoa, nome de alimento ou valor fora do formato de identificador, no fake e no adaptador OTel". E em "Evals determinísticos": "Todo span, métrica e log da lista fechada é emitido por algum cenário, com os atributos e rótulos declarados" e "O painel cobre todas as métricas".
- `AGENTS.md` com `painel:gerar` e ⚠️ `painel:check` na tabela de comandos.

## Arquivos e diretórios envolvidos

- `src/core/telemetry/nomes.ts`, `nomes.test.ts`, `ports.ts`
- `src/infra/otel/telemetry.ts`, `null-telemetry.ts`, `node-sdk.ts`, `opcoes.ts` (novo), `privacidade.test.ts` (novo), `telemetry.test.ts`
- `src/infra/fakes/memory-telemetry.ts` e o teste
- `src/instrumentation.ts`
- `src/core/runs/run-service.ts` (ou o ajudante do span `run` da 008), `loop.ts`, `loop-passo.ts`, `ports.ts`
- `src/core/llm/router.ts`, `fornecedor.ts`, `chamar.ts`
- `src/core/weather/cache.ts`, `src/infra/container.ts`
- `src/core/touches/voto.ts` (novo); `src/infra/db/runs.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/runs.contract.ts`
- Onde nasce `saidaSegura` (007 e 013), `julgar` (013), `detectarPadroes` (012)
- `config/telemetria.ts` (novo), `config/telemetria.test.ts` (novo), `config/index.ts`
- `scripts/lib/painel.ts`, `painel-grafana.ts`, `painel.test.ts`, `scripts/painel.ts`, `scripts/painel-check.ts` (novos); `scripts/demo.ts`, `scripts/eval-llm.ts`; `package.json`
- `observability/dashboards/ritu.json`, `observability/grafana/dashboards.yaml`, `observability/grafana/alerting/ritu.yaml` (novos); `docker-compose.yml`
- `evals/det/telemetria/` (novo); `evals/det/acompanhante/privacidade.eval.ts` (sai); `evals/det/mapa.ts`; `test/fixtures/cenarios/` (se faltar cenário)
- `.docs/OBSERVABILITY.md`, `QA.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`; `AGENTS.md`
