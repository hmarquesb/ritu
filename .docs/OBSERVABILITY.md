# Observabilidade

> Como saber, a qualquer momento, **o que o agente fez, quanto gastou e se foi bom**.
> Specs 005 e 015.

## 1. Três camadas, três perguntas

| Camada | Pergunta | Onde fica | Quem vê |
|---|---|---|---|
| **1. Rastro do agente** | Por que ele recomendou isso? Que tools chamou, em que ordem, o que voltou? | Tabelas `runs` e `run_etapas` (Postgres) | A pessoa, na tela **Como pensei**; os evals |
| **2. Telemetria técnica** | Onde está lento? O que falha? Quanto gasta? | Traces, métricas e logs via OpenTelemetry → Grafana (LGTM) | Só a equipe, no Grafana |
| **3. Qualidade contínua** | As respostas são boas? Estão melhorando? | Evals por checkpoint (relatórios em `evals/resultados/`) + sinais reais (👍/👎, retornos, trocas) | README, CI e a página pública **Bastidores** |

A camada 1 funciona mesmo com o Grafana fora do ar. A camada 2 nunca guarda texto da pessoa.

## 2. Camada 1: rastro do agente

Cada passo do run grava uma linha em `run_etapas`:

| Campo | Exemplo |
|---|---|
| `ordem` | 3 |
| `tipo` | `interprete` · `llm` · `tool` · `validacao` · `pergunta` · `proposta` · `aprovacao` · `juiz` · `guardrail` · `troca_de_modelo` · `erro` |
| `nome` | `clima.agora` |
| `resumo` | "19 °C, úmido → frio, úmido" (texto curto, gerado por código, sem dado sensível) |
| `status` | `ok` · `falhou` · `recusado` |
| `duracao_ms`, `modelo`, `tokens_entrada`, `tokens_saida` | 412, —, 0, 0 |

O run guarda os totais: intenções, passos, tokens, latência, `prompt_versao`, modelo usado em cada papel, trocas de modelo, `trace_id`, resultado do juiz e número de tentativas.

**Tela Como pensei:** linha do tempo dessas etapas, em linguagem de gente ("Entendi que você está com frio e quer saber o que comer", "Vi o clima: 19 °C e úmido", "Conferi a resposta: 1 problema, o chá pedia canela e você não tem", "Corrigi e conferi de novo", "Propus pôr cardamomo na lista: já fez falta 4 vezes"). É a observabilidade que a pessoa enxerga.

## 3. Camada 2: OpenTelemetry

### Árvore de spans de um run

```
run                         run.id, run.intencoes, run.caminho, conta.tipo, prompt.versao, run.status, run.passos (cobre o run inteiro, também os caminhos sem agente)
├─ guardrail.entrada        guardrail.resultado
├─ interprete               (só com texto livre; a etapa grava só os ids das intenções)
│  └─ llm.chamada
├─ preparo                  candidatos.total, faltas.registradas, para_ter.candidato
├─ agente.passo (1..n)      passo.ordem
│  ├─ llm.chamada           llm.papel, gen_ai.request.model, llm.troca_de_modelo, gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, llm.tentativas
│  └─ tool.chamada          tool.nome, tool.status, cache.hit
├─ validacao                validacao.ok, validacao.violacoes, validacao.tentativa
├─ pausa (evento)           pausa.tipo = pergunta | aprovacao
├─ juiz                     juiz.aprovado, juiz.tentativa
│  └─ llm.chamada
└─ aprovacao.execucao       propostas.total, propostas.aprovadas
```

Um run pausado continua **no mesmo trace** quando retoma: o `trace_id` fica salvo no run, e o trecho novo entra como filho do span raiz.

`run` leva `prompt.versao` quando o caminho tem agente, e `run.intencoes` é a lista de ids de intenção do caminho escolhido (ADR 0029). Etapa `interprete`: `resumo` só com ids de intenção (ou `alerta`), nunca o texto. Caminhos `alerta` e `fora` gravam uma etapa `guardrail` com status `recusado` e nome `alerta_fisico`, `alerta_emocional`, `suspeito` ou `fora`, sem modelo nem tokens. `tool.chamada` das tools de clima leva `cache.hit`.

Spans fora de um run: `toque` (`tipo`; na troca, `motivo` e `resultado`), `memoria.resumo` (`resumo.origem`) e `padroes.deteccao` (`padroes.contas`, `padroes.propostos`).

Spans, métricas, atributos e códigos de log são uma lista fechada em `src/core/telemetry/nomes.ts`, com os atributos obrigatórios de cada span, o tipo e os rótulos de cada métrica e o nível de cada log. Nome novo entra lá primeiro.

### Métricas

| Métrica | Tipo | Rótulos |
|---|---|---|
| `ritu_run_duracao_ms` | histograma | `caminho`, `status`: tempo de cada trecho de trabalho num run (o que a pessoa espera por uma resposta), com o status ao fim do trecho |
| `ritu_run_passos` | histograma | `caminho`, `status`: uma vez por run, no encerramento; conta runs e falhas |
| `ritu_run_intencao_total` | contador | `intencao` |
| `ritu_tokens_total` | contador | `modelo`, `papel`, `direcao` |
| `ritu_llm_chamadas_total` | contador | `modelo`, `papel` |
| `ritu_llm_duracao_ms` | histograma | `modelo`, `papel` |
| `ritu_llm_cota_usada` | medidor | `modelo`, `janela` (minuto, dia); fração de 0 a 1 |
| `ritu_llm_troca_de_modelo_total` | contador | `papel`, `de`, `para`, `motivo` (cota, 429) |
| `ritu_llm_erros_total` | contador | `modelo`, `papel`, `codigo` (rate_limit, timeout…) |
| `ritu_fallback_sem_llm_total` | contador | — |
| `ritu_tool_chamadas_total` | contador | `tool`, `status` |
| `ritu_tool_duracao_ms` | histograma | `tool` |
| `ritu_validacao_violacoes_total` | contador | `violacao` |
| `ritu_guardrail_total` | contador | `resultado`, `origem` (codigo, interprete) |
| `ritu_juiz_total` | contador | `resultado` (aprovado, reprovado, sem_juiz) |
| `ritu_juiz_reprovacoes_total` | contador | `motivo` |
| `ritu_juiz_avisos_total` | contador | `motivo` |
| `ritu_pausas_total` | contador | `tipo` |
| `ritu_propostas_total` | contador | `tool`, `decisao` |
| `ritu_rotina_resumo_total` | contador | `origem` (vazio, direto, modelo, codigo) |
| `ritu_padroes_total` | contador | `tipo`, `etapa` (detectado, confirmado, recusado) |
| `ritu_feedback_total` | contador | `voto` |
| `ritu_retorno_total` | contador | `resultado`, `origem` (toque, conversa) |
| `ritu_troca_ingrediente_total` | contador | `resultado` (trocou, sem_substituto) |
| `ritu_gosto_total` | contador | `gosto` |
| `ritu_faltas_total` | contador | `origem` (teria_entrado, nao_tenho) |
| `ritu_para_ter_total` | contador | `etapa` (candidato, indicada, aprovada, recusada) |

Rótulo nunca leva id de run, de conta, `trace_id`, nome de alimento ou cidade. Os limites dos histogramas ficam em `config/telemetria.ts`.

### Logs

JSON estruturado. Cada código tem um nível fixo; dentro de um run, todo log leva `run.id` e `trace_id` sem quem chama passar. Sem provedor de logs, o JSON vai para o console.

| Nível | Códigos |
|---|---|
| `info` | `run_inicio`, `run_retomado`, `run_fim` |
| `warn` | `clima_indisponivel`, `troca_de_modelo`, `sem_modelo`, `llm_erro`, `resposta_segura`, `atributo_proibido` |
| `error` | `run_falhou`, `padroes_falha_na_conta`, `erro_inesperado` |

### Painel e alertas como código

Os dois saem de uma definição em TypeScript (`scripts/lib/painel.ts`) por `npm run painel:gerar`: `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml`. Carregam sozinhos no LGTM local e são importáveis no Grafana Cloud. Um teste confere que o gerado é igual ao commitado e que toda métrica aparece no painel. ⚠️ `npm run painel:check` diz, painel por painel, se há dados.

Linhas do painel:

1. **Saúde:** runs por hora, espera por resposta (p50 e p95), runs que falharam, 429 do modelo, latência do modelo e das tools.
2. **Agente:** intenções, caminhos, passos por run, tools, violações do validador, juiz, guardrail, pausas, memória.
3. **Modelos e cota:** chamadas e tokens por modelo e por papel; cota do dia e do minuto por modelo; trocas de modelo; respostas sem modelo; erros do modelo.
4. **Qualidade:** 👍/👎, retornos, trocas de ingrediente, gostos, faltas, propostas, indicações de "vale ter em casa".
5. **Rastro:** runs recentes (Tempo) e avisos e erros (Loki).

Alertas, visíveis só no Grafana, sem notificação; limites em `config/telemetria.ts`:

| Alerta | Quando |
|---|---|
| Cota do dia | Algum modelo com 80% ou mais da cota do dia |
| Runs falhando | 10% ou mais dos runs em 1 h, com pelo menos 5 runs |
| Sem modelo | Alguma resposta montada sem modelo em 1 h |
| Juiz reprovando | 20% ou mais dos julgamentos em 1 h, com pelo menos 5 |
| 429 frequente | 5 ou mais 429 em 10 min |

Um print desse painel vai para o README.

### Ambientes

| | Dev | Prod |
|---|---|---|
| Destino | `grafana/otel-lgtm` no `docker-compose` (Grafana em `localhost:3001`) | Grafana Cloud Free |
| Configuração | `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` | Endpoint e token nas variáveis da Vercel |
| Sem endpoint | Telemetria desligada (testes, CI, quem clonar o repo) | — |

- Envio só pelas variáveis padrão do OTel: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`.
- **Serverless:** a função termina logo após a resposta. Usar `@vercel/otel` em `instrumentation.ts` e garantir o envio antes do fim (validar na spec 005).
- A telemetria do core passa pela porta `Telemetry` (spans, contadores, histogramas). O adaptador OTel fica em `src/infra/`; o fake grava em memória e é o que os testes conferem.

### Privacidade

Spans, métricas e logs levam **ids, tipos, durações, contagens, tokens e nomes de modelo**. Nunca texto da pessoa, prompt, saída do agente, nome de cidade, e-mail ou segredo. A captura de input e output do exporter da Mastra fica desligada. Valor de texto emitido tem forma de identificador (minúsculas, dígitos, `_.:,-`, até 64 caracteres). Um eval determinístico planta canários em todo campo de texto da pessoa, roda todos os cenários, os toques e a detecção de padrões, e falha se achar canário, nome de alimento ou valor fora da forma em span, métrica, log, `resumo` de etapa ou console. Um teste faz o mesmo pelo adaptador OTel real, com a Mastra no meio.

## 4. Camada 3: qualidade contínua

| Sinal | Origem | Vai para |
|---|---|---|
| Evals determinísticos | CI, a cada push | Status da CI |
| Evals com LLM | Nos cinco checkpoints (`QA.md`) | `evals/resultados/<checkpoint>.md`, `evals/COMPARACAO.md` e `evals/resultados/historico.json` |
| 👍/👎 por resposta | Uso real | Métrica + candidato a caso de eval |
| Retornos (ajudou, não ajudou, não fiz) | Uso real | Métrica + ordenação das próximas sugestões |
| Trocas de ingrediente e "Não gosto" | Uso real | Métrica + gostos |
| Indicações de "vale ter em casa" (aprovadas e recusadas) | Uso real | Métrica |

**Bastidores (página pública).** O Grafana é fechado; esta página é aberta. `/bastidores` mostra:

- números agregados dos últimos 7 dias, lidos do Postgres: runs, intenções, p50 de duração, passos médios, tools mais usadas, taxa de reprovação do juiz, trocas de modelo, 👍/👎 e retornos;
- a **evolução dos evals**: um gráfico por métrica, com um ponto por checkpoint, lido de `historico.json`.

Sem nenhum dado de pessoa.

## 5. O que cada portão confere

- **Entrega 1:** um run no terminal aparece como trace no Grafana local, com a árvore de §3 e o modelo de cada chamada.
- **Entrega 2:** o painel e os alertas carregam sozinhos, com dados da rodada do `c3-confiavel` (feita com o OTLP ligado); a linha de modelos e cota mostra as trocas; o teste de privacidade passa.
- **Entrega 3:** Como pensei mostra a mesma história do trace.
- **Entrega 4:** traces de produção chegam ao Grafana Cloud; Bastidores no ar, com a evolução dos checkpoints.
