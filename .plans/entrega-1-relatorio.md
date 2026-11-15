# Entrega 1 · Relatório: cérebro no terminal

Data: 2026-11-15 · Tag: `entrega-1` · Sem `git push` (repositório remoto ainda não liberado pela dona).

## 1. O que foi construído

| Spec | O que entrega | Último código | Fechamento |
|---|---|---|---|
| 001 `fundacao` | npm, Biome, Vitest, tsx, CI, `.env.example`, `env:check`, composition root, `Clock`, `config/`, teste de arquitetura, `docker-compose` (Postgres + LGTM), ADRs 0001–0021 | f904742 | 692957b |
| 002 `base-conhecimento` | Schemas e validador da base; 130 alimentos, 30 preparos, 44 práticas, 20 combinações, 84 fontes; tools `ayurveda.*`; `base:check` | eb3226a | bdf15c2 |
| 003 `clima-e-cidades` | Portas e adaptadores Open-Meteo, faixas → qualidades, cache; tools `clima.*`; `clima:real` | 411c967 | de64b23 |
| 004 `dados-e-memoria` | Migração, repositórios Postgres e fakes com suíte de contrato única, casa por durabilidade, limpeza diária, tools de memória | 855506c | c4d8c0c |
| 005 `runtime-e-rastro` | Loop no core, Mastra por passo, runtime roteirizado, estados e checkpoint, telemetria OTel com a árvore de spans | 3a9ea65 | f7173c9 |
| 006 `modelos-e-cotas` | `ModelRouter`, papéis, registro de uso atômico por janela, troca por cota e por 429, resposta sem modelo | 2430770 | e87ffe5 |
| 007 `acompanhante` | Preparo, ordenação, faltas e "vale ter em casa", prompt v1, `finalizar` com validador, saída, `npm run demo`, `eval:llm` mínimo | e0b585b (+ 2bf435e) | 0931c0e |

## 2. Números

- `npm test`: 75 arquivos, **933 testes**. `eval:det`: 36 arquivos, **367 evals**. `test:db`: **106** contra o Postgres. e2e: 2/2 (celular e desktop). `dup`: 0 clones. `build` ok. `base:check`: sem erros, 156 linhas `a_confirmar`.
- `demo` sem rede: os cinco cenários saem com código 0.
- ⚠️ `demo --llm frio-agitada`: `done`/`agente`, uma recusa do validador e autocorreção, 3 passos, 25 196 tokens (trace `f2493135afa5d0c4a23c2a198803b338`). Com `--esgotar decisao`: troca para `gemini-3.1-flash-lite` (1 troca), `done`/`agente` na 1ª entrega, 2 passos, 16 152 tokens (trace `197043f3be39bcfa923f5b9c76ba633b`).
- ⚠️ `eval:llm c1-base` (`evals/resultados/c1-base.md`):

| Métrica | c1-base |
|---|---|
| Conteúdo: deve incluir | 83% (10/12) |
| Conteúdo: não pode incluir | 100% (12/12) |
| Trajetória correta | 67% (8/12) |
| Chamadas desnecessárias por run | 0,00 |
| Válida na 1ª tentativa | 17% (2/12) |
| Corrigiu após violação | 100% (10/10) |
| Explicação | 73% (8/11; 1 não avaliada por timeout do `apoio`) |
| Trocas de modelo | 0 |
| Latência p50 / p95 | 3,4 s / 9,2 s |
| Chamadas `decisao` por run | 2,5 (30 no total) |

Leitura: o modelo pequeno quase nunca acerta o formato na 1ª entrega, mas o validador e a autocorreção levam todos os casos a uma resposta aceita; nada proibido passou. Falhas: trajetória em 01, 02, 06 e 08; "algo que aquece" em 01; "disse que respondeu sem o clima" em 11.

## 3. ⚠️ Decisões autônomas e bloqueios

**Todas** estão em `.plans/DECISOES-AUTONOMAS.md` (cada linha diz como desfazer). As desta sessão, que mudam comportamento:

- **007 · C5:** a spec põe refeição como candidato mesmo quando a vaga obrigatória só tem opções ausentes de casa. Nenhuma entrega válida podia usá-la, e o modelo insistia nela (resposta segura em 3 de 4 rodadas reais). Agora essa refeição não vai ao modelo; as faltas seguem contadas sobre a lista completa.
- **007 · C4 (correção, não decisão):** o Mastra 1.83 troca `.` por `_` no nome das tools e não destroca; o adaptador agora codifica e decodifica, e falha alto se dois nomes colidirem. As mensagens do validador passaram a dizer os valores aceitos (mesmos códigos, nada afrouxado).
- **007 · T12:** `clima_usado` gravado por um invólucro de `clima.agora`; saída fora do schema vira resposta segura e run `failed`.
- **007 · T13:** cenários compartilhados entre demo e evals (ADR 0027); `npm test` passa a rodar `test/**`.
- **Entrega · C6:** o runner do `eval:llm` segue quando um caso falha e sempre grava o relatório. A 1ª rodada do dia caiu no caso 5 (timeout da chamada `apoio`) sem gravar nada; a rodada foi refeita inteira no mesmo dia. Chamadas reais no dia: cerca de 100 (depuração ~30, rodadas ~60, demos ~12).

**Bloqueio aberto** (`.plans/BLOQUEIOS.md`): `modelos:check` deu `indisponivel` para `gemini-2.5-flash-lite`, `gemini-3-flash-preview` e `gemini-2.5-flash`, e `timeout` para `gemini-3.8-flash`. Nada trava, mas `reforco` começa num modelo que falhou. Ação da dona: conferir no AI Studio e atualizar `config/llm-cotas.ts` e `AI.md` §10.

**A conferir pela dona:**
- `OTEL_EXPORTER_OTLP_ENDPOINT` do `.env.local` deve ser `http://localhost:4318` (OTLP por HTTP). Com o valor atual, nenhum trace chegou na 005; os demos acima usaram o valor explícito.
- Texto de preparo: "Juntar abóbora picado" (concordância da lacuna `{legume} picado` em `data/preparos.yaml`).
- Na 006 · T10, um subagente tentou `cat .env.local`; o classificador negou e o arquivo não foi lido.

## 4. Bibliotecas instaladas

Produção: `@google/genai`, `@mastra/core`, `@opentelemetry/*` (api, api-logs, exporters OTLP HTTP de traces, métricas e logs, sdk-logs, sdk-metrics, sdk-node), `@vercel/otel`, `next`, `react`, `react-dom`, `postgres`, `yaml`, `zod`.
Desenvolvimento: `@biomejs/biome`, `@opentelemetry/context-async-hooks`, `@opentelemetry/core`, `@opentelemetry/sdk-trace-base`, `@playwright/test`, `@types/node@24`, `@types/react`, `@types/react-dom`, `jscpd`, `tsx`, `typescript`, `vitest`.

## 5. Roteiro de conferência do portão 1

Antes: `docker compose up -d` e `npm install`.

1. **Cenários sem rede.** `npm run demo` → lista os cinco cenários. `npm run demo -- --cenario frio-agitada` → etapas com o pensamento entre aspas antes de cada tool, resposta, chá/refeição/prática com ingredientes de casa, "Evite agora", "Vale ter em casa: Cardamomo", "Não é orientação médica." e o resumo (`done`, `agente`).
2. **Autocorreção.** `npm run demo -- --cenario autocorrecao` → duas etapas `validacao`, a 1ª `recusado` (ingrediente fora de casa), a 2ª `ok`; origem `agente`.
3. **Sem modelo.** `npm run demo -- --cenario sem-modelo` → nenhuma etapa `llm`; resposta montada por código com práticas sem ingrediente; origem `sem_modelo`.
4. **LLM real e troca de modelo** (⚠️ gasta ~5 chamadas cada). `npm run demo -- --cenario frio-agitada --llm` → `done`/`agente`, modelo `gemini-3.5-flash-lite`. Depois, `... --llm --esgotar decisao` → 1ª etapa `troca_de_modelo` (motivo `cota`), modelo `gemini-3.1-flash-lite`, "trocas de modelo: 1".
5. **Trace no Grafana.** Com `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`, rode o passo 4 e copie o `trace_id` do resumo. Em http://localhost:3001 → Explore → Tempo → busque o id (o 2º bloco do `trace_id`). Deve ver `run` → `preparo` → `agente.passo` → `llm.chamada` / `tool.chamada` → `validacao`, sem texto da pessoa nem nome de alimento nos atributos.
6. **A base.** Leia `data/alimentos.yaml`, `data/preparos.yaml` e `data/praticas.yaml` por amostra; `npm run base:check` lista as 156 linhas `a_confirmar` para revisão.
7. **O checkpoint.** Leia `evals/resultados/c1-base.md` e `evals/COMPARACAO.md`; os casos que falharam estão na seção "Falhas".
8. **Decisões.** Leia `.plans/DECISOES-AUTONOMAS.md` (em especial 007 · C5) e `.plans/BLOQUEIOS.md`.

Responda "aprovado" ou liste os ajustes; ajuste vira tarefa de correção ou spec nova antes da entrega 2.
