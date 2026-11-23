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

**Tela Como pensei:** linha do tempo dessas etapas, em linguagem de gente. As frases saem por código, a partir do tipo e do nome de cada etapa e dos campos estruturados dela, com os textos em `config/textos-como-pensei.ts`; nada é o `resumo` cru e nenhum modelo escreve a frase. Os detalhes técnicos (modelo, tokens, tempo) ficam recolhidos em cada passo, e os totais do run (passos, tempo, modelo por papel, trocas, versão do prompt, tentativas da revisão), recolhidos no fim. No passo de validação, o `resumo` guarda os códigos das violações, e é por eles que a frase diz o que foi corrigido. Exemplos ("Entendi que você está com frio e quer saber o que comer", "Vi o clima: 19 °C e úmido", "Conferi a resposta: 1 problema, o chá pedia canela e você não tem", "Corrigi e conferi de novo", "Propus pôr cardamomo na lista: já fez falta 4 vezes"). É a observabilidade que a pessoa enxerga.

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
├─ pausa (evento)           pausa.tipo = pergunta | aprovacao (a pergunta de código também emite)
├─ juiz (1 ou 2)            juiz.aprovado, juiz.tentativa
│  └─ llm.chamada
└─ aprovacao.execucao       propostas.total, propostas.aprovadas
```

Um run pausado continua **no mesmo trace** quando retoma: o `trace_id` fica salvo no run, e o trecho novo entra como filho do span raiz.

`run` leva `prompt.versao` quando o caminho tem agente, e `run.intencoes` é a lista de ids de intenção do caminho escolhido (ADR 0029). Etapa `interprete`: `resumo` só com ids de intenção (ou `alerta`), nunca o texto. Etapa `pergunta`: `resumo` é `casa: N itens` (ou `casa: 1 item`), `come` ou `variante`, nunca os alimentos nem a resposta; o `nome` é `ask_user` na pergunta do agente e `variante` na do código. Caminhos `alerta` e `fora` gravam uma etapa `guardrail` com status `recusado` e nome `alerta_fisico`, `alerta_emocional`, `injection`, `suspeito` ou `fora`, sem modelo nem tokens. O `resumo` diz quem barrou: `codigo` (os padrões de entrada, antes do Intérprete; o nome `injection` só existe aqui) ou `interprete`. O span `guardrail.entrada` leva `guardrail.resultado` (`ok`, `alerta_fisico`, `alerta_emocional` ou `injection`).

Etapa `juiz` (uma por leitura): `resumo` é `aprovado`, `reprovado: <motivos>` ou `indisponivel`, com `; registros: <motivos>` quando houve aviso, só com os códigos de motivo, nunca o trecho apontado. O status é `ok` (aprovado), `recusado` (reprovado) ou `falhou` (Juiz sem modelo ou com erro; sem modelo nem tokens). Nova tentativa que não entrega grava a etapa `erro` de nome `nova_tentativa:<fim>` (`limite`, `sem_modelo`, `erro`, `pausa`, `sem_estado`), com status `falhou` e sem resumo, e a resposta segura sai. O run guarda `juiz_tentativas` e `juiz_aprovado` (`null` com o Juiz indisponível); `modelos.reforco` lista os modelos da nova tentativa, e `modelos.apoio` junta os do Intérprete e do Juiz. `tool.chamada` das tools de clima leva `cache.hit`.

Aprovação (`AI.md` §5): cada linha do bloco grava uma etapa `proposta`, com `nome` igual à tool (`casa.propor`, `memoria.propor`, `lista.propor`) e `resumo` só de tipo e contagem (`casa: 2 itens`, `evitar_sempre: 1 item`, `rotina`, `lista`, `padrao`), nunca o texto da linha, o alimento nem a nota. A decisão grava uma etapa `aprovacao` com `resumo` `N de M` (linhas gravadas de linhas pendentes). Linha que o executor recusa por conteúdo que a base não conhece grava a etapa `erro` `proposta_invalida`, com status `falhou` e sem resumo. Aprovada uma nota de rotina, o resumo refeito grava a etapa `memoria` de nome `resumo_de_rotina`, com `resumo` igual à origem (`vazio`, `direto`, `modelo` ou `codigo`), mais modelo e tokens quando houve chamada; a etapa fica no run mesmo quando o resumo não mudou. Se o resumo falha, a aprovação segue e o run grava a etapa `erro` `resumo_de_rotina`, com status `falhou` e sem resumo. A gravação da entrega (`AI.md` §6) que falha grava a etapa `erro` `registro_da_entrega`, com status `falhou` e sem resumo; o run segue e a resposta sai. A pausa para aprovação emite o evento `pausa` com `pausa.tipo = aprovacao` e soma `ritu_pausas_total{tipo: "aprovacao"}`. As métricas da decisão (`ritu_propostas_total`, `ritu_para_ter_total`, `ritu_gosto_total`) só somam depois que a transação termina, para uma decisão desfeita não contar.

Spans fora de um run: `toque` (`tipo`: `retorno`, `gosto`, `troca`, `voto`, `perfil` ou `memoria` (com `acao`, o nome da ação); na troca, `motivo`: `trocar`, `nao_tenho` ou `nao_gosto`, e `resultado`: `trocou`, `perguntar` ou `sem_substituto`; nunca o alimento nem a sugestão), `memoria.resumo` (`resumo.origem`: `modelo` ou `codigo`; só abre quando o agente de Memória é chamado, com duas notas ou mais, e dentro do run da aprovação ele fica no trace do run) e `padroes.deteccao` (`padroes.contas`, `padroes.propostos`, a detecção diária; erro numa conta vira log `error` com o código do erro e não para o job).

Spans, métricas, atributos e códigos de log são uma lista fechada em `src/core/telemetry/nomes.ts`, com os atributos obrigatórios de cada span, o tipo e os rótulos de cada métrica e o nível de cada log. Nome novo entra lá primeiro.

### Métricas

| Métrica | Tipo | Rótulos |
|---|---|---|
| `ritu_run_duracao_ms` | histograma | `caminho`, `status`: tempo de cada trecho de trabalho num run (o que a pessoa espera por uma resposta), com o status ao fim do trecho |
| `ritu_run_passos` | histograma | `caminho`, `status`: uma vez por run, no encerramento; conta runs e falhas |
| `ritu_run_intencao_total` | contador | `intencao` |
| `ritu_entrada_total` | contador | `conta.tipo` (google, demo), `entrada.resultado` (nova, retorno, limite_ip, limite_global): uma por entrada, sem identificador da conta |
| `ritu_tokens_total` | contador | `modelo`, `papel`, `direcao` |
| `ritu_llm_chamadas_total` | contador | `modelo`, `papel` |
| `ritu_llm_duracao_ms` | histograma | `modelo`, `papel` |
| `ritu_llm_cota_usada` | medidor | `modelo`, `janela` (minuto, dia); fração de 0 a 1 |
| `ritu_llm_troca_de_modelo_total` | contador | `papel`, `de`, `para`, `motivo` (cota, 429) |
| `ritu_llm_erros_total` | contador | `modelo`, `papel`, `codigo` (rate_limit, timeout…) |
| `ritu_fallback_sem_llm_total` | contador | — (só a falta de modelo; o modo `limite` não soma) |
| `ritu_limite_total` | contador | `tipo` (mensagem, toque), `motivo` (conta, demo, ip, minuto, dia), `resultado` (barrado, so_atalhos, alerta): uma por decisão de limite que barra ou desvia a mensagem, ou por toque barrado; nunca chave, IP, hash ou conta |
| `ritu_tool_chamadas_total` | contador | `tool`, `status` |
| `ritu_mcp_chamadas_total` | contador | `tool` (as seis tools públicas), `resultado` (`ok`, `invalido`, `erro`): uma por chamada de tool do MCP público; o painel mostra o total no stat "Chamadas MCP", por resultado |
| `ritu_tool_duracao_ms` | histograma | `tool` |
| `ritu_validacao_violacoes_total` | contador | `violacao` |
| `ritu_guardrail_total` | contador | `resultado` (`alerta_fisico`, `alerta_emocional`, `injection`, `suspeito`), `origem` (`codigo`, `interprete`): uma vez por mensagem barrada antes do Acompanhante |
| `ritu_juiz_total` | contador | `resultado` (`aprovado`, `reprovado`, `sem_juiz`): um por leitura do Juiz |
| `ritu_juiz_reprovacoes_total` | contador | `motivo`: um por motivo grave de cada leitura reprovada |
| `ritu_juiz_avisos_total` | contador | `motivo` (`jargao`, `saude_na_proposta`): apontamentos que só registram |
| `ritu_pausas_total` | contador | `tipo` |
| `ritu_propostas_total` | contador | `tool`, `decisao` |
| `ritu_rotina_resumo_total` | contador | `origem` (vazio, direto, modelo, codigo); soma quando o resumo gravado muda |
| `ritu_padroes_total` | contador | `tipo` (ajuda_em_estado, estados_juntos), `etapa` (detectado, confirmado, recusado); a decisão só soma depois que a transação termina |
| `ritu_feedback_total` | contador | `voto` |
| `ritu_retorno_total` | contador | `resultado`, `origem` (toque, conversa) |
| `ritu_troca_ingrediente_total` | contador | `resultado` (trocou, sem_substituto) |
| `ritu_gosto_total` | contador | `gosto` (gosta, nao_gosta, limpou) |
| `ritu_faltas_total` | contador | `origem` (teria_entrado, nao_tenho) |
| `ritu_memoria_edicoes_total` | contador | `nivel` (fixos, gostos, faltas, rotina, padroes, conversa), `acao`: uma por edição da pessoa em Você |
| `ritu_conta_apagada_total` | contador | `tipo` (google, demo): uma por "Apagar meus dados" |
| `ritu_para_ter_total` | contador | `etapa` (candidato, indicada, aprovada, recusada) |

Rótulo nunca leva id de run, de conta, `trace_id`, nome de alimento ou cidade. Os limites dos histogramas ficam em `config/telemetria.ts`.

### Logs

JSON estruturado. Cada código tem um nível fixo; dentro de um run, todo log leva `run.id` e `trace_id` sem quem chama passar. Sem provedor de logs, o JSON vai para o console.

| Nível | Códigos |
|---|---|
| `info` | `run_inicio`, `run_retomado`, `run_fim` |
| `warn` | `clima_indisponivel`, `troca_de_modelo`, `sem_modelo`, `llm_erro`, `resposta_segura`, `atributo_proibido` |
| `error` | `run_falhou`, `padroes_conta_falhou`, `sinais_dia_falhou`, `erro_inesperado` |

### Painel e alertas como código

Os dois saem de uma definição em TypeScript (`scripts/lib/painel.ts`) por `npm run painel:gerar`: `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml` (escrito em JSON, que é YAML válido). Os gerados não se editam à mão. O `docker compose` sobe o LGTM numa tag fixa da imagem `grafana/otel-lgtm` e provisiona o painel e as regras ao subir (`observability/grafana/dashboards.yaml` aponta o provedor para a pasta do painel); os dois arquivos também são importáveis no Grafana Cloud. Um teste confere que o gerado é igual ao commitado, que toda métrica de `nomes.ts` aparece no painel e que as consultas só citam métricas da lista. ⚠️ `npm run painel:check` confere um Grafana no ar: painel e regras presentes, e, painel por painel, se há dados; sai com 1 se falta painel ou regra e com 2 se o Grafana não responde.

Linhas do painel:

1. **Saúde:** runs por hora, espera por resposta (p50 e p95), runs que falharam, 429 do modelo, limites atingidos (`ritu_limite_total` por `resultado`), latência do modelo e das tools.
2. **Agente:** intenções, caminhos, passos por run, tools, violações do validador, juiz, guardrail, pausas, memória (propostas, padrões, edições da pessoa e contas apagadas).
3. **Modelos e cota:** chamadas e tokens por modelo e por papel; cota do dia e do minuto por modelo; trocas de modelo; respostas sem modelo; erros do modelo.
4. **Qualidade:** 👍/👎, retornos, trocas de ingrediente, gostos, faltas, propostas, indicações de "vale ter em casa", entradas por tipo de conta e resultado.
5. **Rastro:** runs recentes (Tempo, com `run.caminho`, `run.status`, `run.passos` e a duração de cada um) e avisos e erros (Loki).

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

- `npm run demo` e `npm run eval:llm` exportam quando há endpoint: os cenários espelham a telemetria em memória no adaptador OTel.
- Envio só pelas variáveis padrão do OTel: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`.
- **Serverless:** a instância pode congelar logo após a resposta. Com telemetria ligada, `criarRota`, `criarRotaDeFluxo` (quando o fluxo fecha), os crons e a saúde agendam `telemetry.encerrar()` em `after()` (`descarregarDepois`), que descarrega traces, métricas e logs. As saídas antes de a rota trabalhar (401, 400, 413, 429) não descarregam.
- **Grafana Cloud:** ⚠️ `npm run painel:publicar` publica pela API o mesmo painel e as mesmas regras de `painel:gerar`, com o uid do Prometheus da stack no lugar de `prometheus`, na pasta `Ritu`, com `X-Disable-Provenance` (a dona pode editar na tela). As cinco regras avisam por e-mail pelo ponto de contato `ritu-email`, ligado à política raiz; o endereço fica só no Grafana Cloud e no `.env.local`. Rodar duas vezes não muda nada.
- A telemetria do core passa pela porta `Telemetry` (spans, contadores, histogramas). O adaptador OTel fica em `src/infra/`; o fake grava em memória e é o que os testes conferem.

### Privacidade

Spans, métricas e logs levam **ids, tipos, durações, contagens, tokens e nomes de modelo**. Nunca texto da pessoa, prompt, saída do agente, nome de cidade, e-mail ou segredo. A captura de input e output do exporter da Mastra fica desligada. Valor de texto emitido tem forma de identificador (minúsculas, dígitos, `_.:,-`, até 64 caracteres). Um eval determinístico planta canários em todo campo de texto da pessoa, roda todos os cenários, os toques e a detecção de padrões, e falha se achar canário, nome de alimento ou valor fora da forma em span, métrica, log, `resumo` de etapa ou console. Um teste faz o mesmo pelo adaptador OTel real, com a Mastra no meio.

## 4. Camada 3: qualidade contínua

| Sinal | Origem | Vai para |
|---|---|---|
| Evals determinísticos | CI, a cada push | Status da CI |
| Evals com LLM | Nos cinco checkpoints (`QA.md`) | `evals/resultados/<checkpoint>.md` e `.json`; `evals/resultados/historico.json`, de onde sai `evals/COMPARACAO.md` |
| 👍/👎 por resposta | Uso real | Métrica + candidato a caso de eval |
| Retornos (ajudou, não ajudou, não fiz) | Uso real | Métrica + ordenação das próximas sugestões |
| Trocas de ingrediente e "Não gosto" | Uso real | Métrica + gostos |
| Indicações de "vale ter em casa" (aprovadas e recusadas) | Uso real | Métrica |

**Bastidores (página pública).** O Grafana é fechado; esta página é aberta. `/bastidores` mostra:

- números agregados dos últimos 7 dias, lidos do Postgres: runs, intenções, p50 de duração, passos médios, tools mais usadas, taxa de reprovação do juiz, trocas de modelo, 👍/👎 e retornos;
- a **evolução dos evals**: um gráfico por métrica, com um ponto por checkpoint, lido de `historico.json`.

Sem nenhum dado de pessoa.

- **Piso:** com menos de 20 conversas (runs `done`) nos 7 dias completos até ontem, os números da semana não aparecem; os evals e o MCP aparecem sempre.
- **Votos e retornos** vêm da tabela `sinais_dia`, gravada pela limpeza diária antes de apagar as contas vencidas (`ARCHITECTURE.md` §6); o resto vem de `runs` e `run_etapas`. O resultado fica em cache em memória por 1 h.
- **Evolução:** cinco gráficos em SVG no servidor (um por métrica de destaque, com a meta tracejada) e a tabela de todas as métricas, recolhida; os valores são os de `evals/COMPARACAO.md`.
- **MCP:** a página explica como ligar o servidor `/api/mcp`. Cada chamada soma `ritu_mcp_chamadas_total` e abre o span `mcp.tool` (`tool.nome`, `tool.status`), raiz e sem run; nome de cidade, alimento e argumentos nunca saem da chamada.

## 5. O que cada portão confere

- **Entrega 1:** um run no terminal aparece como trace no Grafana local, com a árvore de §3 e o modelo de cada chamada.
- **Entrega 2:** o painel e os alertas carregam sozinhos, com dados da rodada do `c3-confiavel` (feita com o OTLP ligado; nos cenários o relógio é fixo, então as latências saem 0); `npm run painel:check` sai com 0; a linha de modelos e cota mostra as trocas; o teste de privacidade passa.
- **Entrega 3:** Como pensei mostra a mesma história do trace.
- **Entrega 4:** traces de produção chegam ao Grafana Cloud em até 5 min e `ritu_runs_total` em até 15 min; o "Test" do ponto de contato `ritu-email` chega por e-mail; Bastidores no ar, com a evolução dos checkpoints.
