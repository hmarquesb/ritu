# Arquitetura

## 1. Visão geral

```
Navegador (Next.js, celular primeiro)
   │  Auth.js: Google · conta de demonstração por clique
   ▼
ROTAS DO SERVIDOR (Next.js na Vercel)
 sessão → conta → guardrail de entrada → limite de uso
   │
   ├── POST /api/runs                 mensagem da conversa → cria o run e transmite as etapas
   ├── POST /api/runs/:id/continue    resposta a uma pergunta do agente
   ├── POST /api/runs/:id/approve     aprovação das propostas → executor em código
   ├── toques (sem LLM): retorno, trocar ingrediente, gosto, casa, 👍/👎
   └── perfil, cidade, quiz, o que sei sobre você, bastidores (sem LLM)
          │
          ▼
   INTÉRPRETE (intenções) → o código escolhe o caminho
          │
          ├── casa, retorno ou evitar sozinhos, ajuda, ofensa, alerta, fora do assunto → resposta por código
          ▼
   PREPARO (código: qualidades, filtros, ordenação por gosto e resultado)
          ▼
   ACOMPANHANTE (loop de tools no core; cada passo na Mastra, atrás de AgentRuntime)
     leitura: clima, casa, preferências, histórico, base ayurvédica
     controle: ask_user, finalizar (com o validador)
     escrita: só propostas
          ▼
   JUIZ (fail-closed, uma nova tentativa) → texto + sugestões na tela
          │
          └── rastro (runs, run_etapas) + spans e métricas (OpenTelemetry → Grafana)

Todas as chamadas de modelo passam pelo ModelRouter (papéis, registro de cota, troca de modelo).

Vercel Cron (diário) → limpeza (demos vencidas, runs e propostas expirados, mensagens com mais de 7 dias, mensagens de run com incômodo do dia anterior, retornos sem resposta há mais de 7 dias, faltas com mais de 30 dias)
                     → detecção de padrões
```

## 2. Stack

| Camada | Escolha |
|---|---|
| Linguagem e runtime | TypeScript, Node 24, npm |
| App | Next.js (App Router) na Vercel |
| UI | Tailwind CSS + React Aria Components (sem estilo de fábrica), tokens e componentes próprios (`DESIGN.md`); ícones Phosphor |
| Auth | Auth.js v5: Google + conta de demonstração por clique, sessão em JWT |
| Banco | Postgres com o driver `postgres`, SQL puro em `src/infra/db/` |
| Limite de uso e registro de cota | Contadores no próprio Postgres, IP em HMAC |
| Agendamento | Vercel Cron |
| Qualidade | Biome, Vitest, tsx, teste de arquitetura, GitHub Actions |
| LLM | Gemini, plano gratuito, vários modelos por papel (`AI.md` §10) |
| Agente | Loop próprio no core; Mastra (`@mastra/core`) executa cada passo, atrás da porta `AgentRuntime` |
| Schemas | zod em toda borda |
| Observabilidade | OpenTelemetry → Grafana LGTM (Docker no dev, Grafana Cloud em prod) |
| Clima e cidades | Open-Meteo (previsão e geocodificação), sem chave |
| E2E | Playwright, como gate |
| Ambiente local | `docker-compose`: Postgres + `grafana/otel-lgtm` |
| MCP | Servidor com as tools de leitura da base e do clima |

Os padrões de fundação seguem as referências locais (`.local/REFERENCIAS.md`, fora do git), quando existirem.

## 3. Fluxo de um run

1. A tela envia a mensagem (`POST /api/runs`), com texto, atalhos de check-in ou os dois.
2. Sessão → conta. Sem sessão: `401`. A rota confirma no banco que a conta existe e não venceu.
3. Limite de uso (por conta e por IP) e tamanho da mensagem.
4. `conversar` cria o run (caminho provisório, `trace_id`) e abre o span `run`, que cobre tudo até a resposta. A barreira de run aberto é conferida antes de gastar modelo (ADR 0029). A mensagem da pessoa é gravada com o `run_id`.
5. Com texto: o guardrail de entrada (`src/core/guardrails/`) confere em código as frases claras de alerta e de injection, antes de qualquer modelo; se casa, o run segue para o caminho de alerta ou de `fora`, sem Intérprete. Se não, o Intérprete devolve as intenções e os campos (`AI.md` §3). Só com atalhos: os dois passos são pulados. Se o Intérprete falha, o run segue com a resposta montada por código.
6. O código escolhe o caminho pela intenção. Casa, retorno ou "evitar sempre" sozinhos, ajuda, ofensa, alerta e fora do assunto são resolvidos aqui, sem o agente. O que a mensagem traz (itens de casa, "evitar sempre", "não como", restrição) vale no mesmo run sem gravar a casa nem o perfil (ADR 0028).
7. Preparo em código: qualidades, filtros, ordenação, faltas e contexto. O Acompanhante roda, **transmitindo as etapas** (streaming): "vendo o clima…", "olhando sua casa…", "conferindo a resposta…". O código anexa à saída as anotações a propor, e a resposta do agente é gravada em `mensagens`.
8. `finalizar` → validador → correções, se houver. Entregue a saída do agente, o Juiz a lê (`AI.md` §3), entre o fim do trecho e o fim do run. Reprovada, o Acompanhante tenta de novo no mesmo run, uma vez, no papel `reforco`; reprovada de novo, ou com o Juiz fora do ar, sai a resposta segura montada por código (`AI.md` §8). O Juiz não lê textos montados por código.
9. A tela mostra o texto do agente e as sugestões. Cada sugestão vira um registro em `retornos` (aguardando). As faltas do run são gravadas em `faltas`. Se houver propostas, a tela mostra o bloco de aprovação e o run fica em `waiting_for_approval`. Quem fecha o run é `conversar` (ou `continuar`): o Acompanhante o deixa em `running`, e a conversa o leva a `done`, ou à pausa com as propostas montadas por código (`AI.md` §5).
10. Etapas, tokens, modelo usado e latência ficam no banco; spans e métricas saem por OTel.

### Estados do run

```
running → waiting_for_input → running → … → done
        ↘ waiting_for_approval → done
        ↘ failed · expired · cancelled
```

- `waiting_for_input` e `waiting_for_approval` guardam o checkpoint. O run **não fica vivo** esperando: a resposta chega em outro pedido e retoma.
- A resposta a uma pergunta entra por `continuar`, que confere conta, estado e prazo, troca `waiting_for_input` por `running` numa operação condicional, grava a resposta na hora e retoma o run (`AI.md` §7). Uma retomada pode pausar de novo.
- A decisão do bloco entra por `aprovar(conta, run, aprovadas)`, da conversa, sem LLM: confere conta, estado e prazo e, numa transação, troca `waiting_for_approval` por `done` (condicional, a primeira operação), grava só as linhas aprovadas pelo executor e registra as etapas. Quem chega depois da primeira decisão recebe `RunNaoContinuavelError`. Passados 30 min, `aprovar` expira o run e as propostas. A rota que expõe `aprovar` é da camada de tela.
- Um run aberto por conta. Espera de mais de 30 min → `expired`.

### Rotas de toque (sem LLM)

| Ação | Rota | O que grava |
|---|---|---|
| Retorno com um toque | `POST /api/retornos/:id` | `retornos` e o contador em `preferencias` |
| Trocar ingrediente | `POST /api/sugestoes/:id/trocar` | A sugestão do run e o retorno dela, com o substituto e o motivo; confere as combinações com os outros itens. "Não tenho" e "Não gosto" também gravam a falta e o gosto |
| Não gosto · Gosto | `POST /api/preferencias` | `preferencias` |
| Não tenho · Ainda tenho · Sempre tenho · adicionar · tirar | `POST /api/casa` | `casa`. "Não tenho" também grava uma falta em `faltas`. Registrar um alimento apaga as faltas dele e o tira de `lista_ter_em_casa` |
| Tirar um item da lista "Para ter em casa" | `POST /api/lista` | `lista_ter_em_casa` |
| 👍 / 👎 na resposta | `POST /api/feedback` | `feedback` |
| Confirmar ou recusar um padrão · apagar um padrão | `POST /api/padroes/:id` | `padroes` |

As rotas só autenticam, validam a entrada e chamam funções do core, em `src/core/touches/` (ADR 0036). Todas recebem a `contaId` da sessão, rodam em transação e não chamam modelo:

| Função | Rota | O que faz |
|---|---|---|
| `tocarRetorno(deps, contaId, retornoId, resultado)` | `/api/retornos/:id` | Fecha o retorno com origem `toque`. Retorno que não existe, é de outra conta ou já foi respondido: `toque_invalido` |
| `tocarGosto(deps, contaId, item, gosto)` | `/api/preferencias` | Grava `gosta`, `nao_gosta` ou limpa (`null`). Item fora da base: `toque_invalido` |
| `trocarIngrediente(deps, contaId, { runId, sugestao, alimento_id, motivo })` | `/api/sugestoes/:id/trocar` | Com motivo `trocar`, `nao_tenho` ou `nao_gosto`: anota o que o motivo pede e devolve `trocou` (com a sugestão nova), `perguntar` (com a pergunta sobre o substituto mais próximo) ou `sem_substituto` |
| `responderTroca(deps, contaId, { runId, sugestao, alimento_id, candidato, resposta })` | `/api/sugestoes/:id/trocar` | Resposta `tenho` (registra em casa e troca) ou `nao_tenho` (anota a falta e devolve `sem_substituto`) |

Rotina e padrões têm funções do core que as rotas de "O que sei sobre você" chamam, em `src/core/routine/` e `src/core/patterns/`. Também recebem a `contaId` da sessão e confirmam que o item é da conta; item que não existe ou não é dela: `nota_invalida` ou `padrao_invalido`.

| Função | O que faz |
|---|---|
| `apagarNota(deps, contaId, notaId)` | Desativa a nota ativa e refaz o resumo de rotina |
| `corrigirNota(deps, contaId, notaId, texto)` | Numa transação, desativa a nota e anota outra com o texto novo (até 200 caracteres, sem palavra de incômodo); refaz o resumo e devolve a nota nova |
| `decidirPadrao(deps, contaId, padraoId, decisao)` | Confirma ou recusa um padrão `candidato` (`confirmado` ou `recusado`) |
| `apagarPadrao(deps, contaId, padraoId)` | Apaga o padrão, em qualquer status |
| `detectarPadroes(deps)` | Job diário (`npm run padroes`): detecta e propõe candidatos para as contas com run recente; erro numa conta não para as outras |

`sugestao` é a posição na saída do run, a partir de 0; `alimento_id` é o ingrediente tocado, pelo id efetivo. A troca só usa substituto confirmado em casa, com teto de três por item. A transação da troca começa travando a linha do run, então dois toques seguidos esperam um pelo outro. O erro `toque_invalido` é lançado fora da transação, e as métricas só somam depois do commit.

## 4. Autenticação e demonstração

- **Google** pelo Auth.js, só com `sub` e e-mail. Sem as credenciais do Google, a tela mostra só a demonstração.
- **Conta de demonstração por clique:** é o provedor `demo` do Auth.js, do tipo credenciais e sem campos. O `authorize` consome o limite de demonstrações (por IP e global, `config/limites.ts`) e cria a conta nova **com a cópia do perfil semeado** (`seed/demo.yaml`: dosha, cidade, casa com itens confirmados e incertos, gostos, resultados, faltas (um alimento já com 3 dias), notas de rotina, um padrão a confirmar, retornos pendentes e conversas anteriores). Depois do Aviso inicial, que a demonstração também vê, cai na tela Conversa com uma mensagem sugerida. Expira em 24 h. No máximo 5 por IP por dia.
- Sessão em JWT, em cookie `httpOnly`, `SameSite=Lax`. O token guarda só `contaId` e `tipo`; nome, e-mail e foto nunca ficam nele. Toda rota protegida confere a conta no banco. O porquê está na ADR 0043.
- Autorização por conta **no repositório**: toda consulta leva o `conta_id`. Um teste tenta ler o run de outra conta e tem que falhar.

### Proteção do site

- **Texto puro na tela:** a resposta do agente e todo texto da pessoa são renderizados como texto. Nada de `dangerouslySetInnerHTML` nem de markdown vindo do modelo.
- **Headers** em todas as respostas: CSP com nonce (sem `unsafe-inline` em script, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` desligando câmera, microfone e geolocalização, e HSTS em produção.
- **Origem:** o `src/proxy.ts` confere o header `Origin` em todo pedido cujo método não é `GET`, `HEAD` nem `OPTIONS`: o host do `Origin` tem que ser igual ao host do pedido (`x-forwarded-host` ou `host`); senão (diferente, ausente ou inválido), `403`. Soma-se ao `SameSite=Lax`.
- **Nonce da CSP:** o proxy gera um nonce por pedido, põe na CSP e o repassa à página, que o lê do header e o expõe também em `<meta name="csp-nonce">`.
- **Entrada das rotas:** corpo validado em zod, com tamanho máximo. Erro para fora nunca mostra stack nem detalhe interno.
- **Limites:** mensagens, toques e demonstrações têm limites próprios (`BUSINESS.md` §14), contados por conta e por IP em HMAC.
- **Cron:** só com `CRON_SECRET`.
- **Servidor MCP:** público e sem login, com limite por IP. Só expõe as tools de leitura da base e do clima; nunca dado de conta.
- **Dependências:** Dependabot semanal e `npm audit --omit=dev --audit-level=high` na CI.

## 5. Portas e adaptadores

A lógica fica em `src/core/`, sem Next, Auth.js, driver de banco, Mastra ou SDK de LLM.

| Porta | Adaptador | Fake para testes |
|---|---|---|
| `AgentRuntime` (um passo de modelo com tools) | Mastra | Passos roteirizados (define a sequência de tools de cada cenário) |
| `LlmClient` | Gemini | Respostas fixas; modo "429" |
| `ModelRouter` | Papéis e cotas de `config/llm-cotas.ts`, registro no Postgres | Registro em memória, com cota configurável por teste |
| `WeatherSource` | Open-Meteo (previsão) | Clima e previsão fixos; modo "fora do ar" |
| `CityLookup` | Open-Meteo (geocodificação) | Lista fixa de cidades |
| `KnowledgeBase` | YAML em `data/` | Os mesmos arquivos ou mini-tabela |
| `RunRepository`, `MessageRepository`, `AccountRepository`, `PantryStore`, `ShortageStore`, `PreferenceStore`, `OutcomeStore`, `RoutineStore`, `PatternStore`, `ProposalStore` | Postgres | Em memória |
| `UsageLimiter` (`src/core/limits/`; consome várias chaves de uma vez, todas ou nenhuma) | Postgres | Em memória |
| `Telemetry` | OpenTelemetry | Em memória (os testes conferem spans e métricas) |
| `Clock` | Relógio do sistema | Data fixa |

A montagem acontece num único composition root (`src/infra/container.ts`). O teste de arquitetura falha se uma camada importar o que não pode.

**Modo de E2E.** Com `RITU_MODO=e2e`, o container monta stores, limitador e cidades em memória, guardados no `globalThis` (o Next carrega os módulos em separado). Nesse modo o header `x-ritu-e2e` vale como o IP do pedido e como prefixo das chaves do limitador, para cada cenário ter a sua cota. O container recusa subir no modo e2e com `VERCEL_ENV=production`.

## 6. Modelo de dados

| Tabela | Campos principais |
|---|---|
| `contas` | `id`, `tipo` (google, demo), `google_sub`, `email`, `expira_em`, `tester`, `aviso_aceito_em`, `evitar_passo` (pronto, nenhum, pulou), `evitar_lembrete_em`, `dosha_adiado_em` |
| `perfis` | `conta_id`, `prakriti` (pode ser nulo), `origem` (quiz, declarado), `evitar_sempre[]` (`{tipo: grupo | alimento | texto, valor, desde}`), `restricoes[]`, `nao_come[]`, `cidade_nome`, `cidade_lat`, `cidade_lon` (duas casas decimais), `cidade_fuso` |
| `evitar_temporario` | `conta_id`, `tipo` (grupo, alimento, texto, restricao, nao_come), `valor`, `dia`. O que a pessoa disse na conversa e vale até o fim do dia: "evitar sempre", restrição e "não como" com alimento da base; apagado pela limpeza diária |
| `casa` | `id`, `conta_id`, `alimento_id` (nulo se a base não conhece), `nome_livre`, `nome_normalizado`, `estado` (tem, acabou), `sempre_tenho`, `confirmado_em`, `origem` (conversa, tela, pergunta). Exatamente um entre `alimento_id` e `nome_livre`; uma linha por conta e alimento, ou por conta e nome normalizado |
| `preferencias` | `conta_id`, `item_tipo` (alimento, pratica, preparo), `item_id`, `gosto` (gosta, nao_gosta, nulo), `ajudou`, `nao_ajudou`, `nao_fez`, `ultimos_resultados` (os dois mais recentes), `ultima_sugestao_em` |
| `retornos` | `id`, `conta_id`, `run_id`, `sugestao` (tipo e ids), `status` (aguardando, respondido), `resultado` (ajudou, nao_ajudou, nao_fez), `origem` (toque, conversa), `respondido_em`. Sem resposta em 7 dias, é apagado |
| `rotina_notas` | `id`, `conta_id`, `texto` (até 200 caracteres), `ativa`, `criado_em` |
| `rotina_resumos` | `conta_id`, `versao`, `texto` (até 1200 caracteres), `criado_em` |
| `padroes` | `id`, `conta_id`, `tipo`, `chave`, `frase`, `ocorrencias`, `status` (candidato, confirmado, recusado), `criado_em`, `decidido_em`. Um por conta, tipo e chave |
| `mensagens` | `id`, `conta_id`, `run_id`, `autor` (pessoa, agente), `texto`, `com_incomodo`, `dia`, `criado_em` (apagadas depois de 7 dias; as de run com incômodo, no dia seguinte) |
| `runs` | `id`, `conta_id`, `caminho` (acompanhante, casa, retorno, evitar, ajuda, ofensa, alerta, fora, sem_modelo), `intencoes[]`, `status`, `checkpoint`, `pendencia` (pergunta com `origem` agente ou código e as anotações da mensagem), `momento` (campos estruturados, sem incômodo), `com_incomodo`, `clima_usado`, `saida`, `passos`, `tokens_entrada`, `tokens_saida`, `latencia_ms`, `modelos` (por papel), `trocas_de_modelo`, `prompt_versao`, `juiz_tentativas`, `juiz_aprovado`, `trace_id`, `dia`, `criado_em`, `atualizado_em`. No máximo um run aberto (`running`, `waiting_for_input`, `waiting_for_approval`) por conta |
| `run_etapas` | `run_id`, `ordem`, `tipo`, `nome`, `resumo`, `status`, `duracao_ms`, `modelo`, `tokens_entrada`, `tokens_saida` |
| `propostas` | `id`, `run_id`, `conta_id`, `tool`, `conteudo`, `decisao` (pendente, aprovada, recusada, expirada), `decidida_em` |
| `faltas` | `conta_id`, `alimento_id`, `dia`, `origem` (teria_entrado, nao_tenho), `run_id`. Uma linha por conta, alimento e dia; apagadas depois de 30 dias |
| `lista_ter_em_casa` | `conta_id`, `alimento_id`, `motivo` (faltou_hoje, fez_falta), `detalhe` (a sugestão de hoje, ou o número de faltas), `criado_em` |
| `feedback` | `run_id`, `conta_id`, `voto` (up, down), `criado_em`. Um voto por run |
| `alimentos_desconhecidos` | `nome`, `vezes` (sem `conta_id`; candidatos a entrar na base) |
| `llm_uso` | `modelo`, `janela` (minuto ou dia), `inicio`, `pedidos`, `tokens` |
| `limites` | `chave` (opaca: HMAC do IP ou identificador, nunca texto da pessoa), `janela` (minuto, dia), `inicio`, `total`. Uma linha por chave, janela e início; as de dia são apagadas pela limpeza diária |

O estado "incerto" de um item da casa não é gravado: é calculado de `confirmado_em`, da durabilidade do grupo e de `sempre_tenho` (`BUSINESS.md` §9).

A recusa de uma indicação de "vale ter em casa" não tem tabela própria: é a proposta `lista.propor` daquele alimento com `decisao` recusada.

"Apagar meus dados" remove a conta em cascata. Runs ficam sem `conta_id` e sem `saida`, `checkpoint`, `pendencia` e `clima_usado`, e as etapas ficam sem `resumo`: servem só às métricas agregadas.

**Como é guardado.** SQL puro com o driver `postgres`, sem ORM. As migrações ficam em `db/migrations/NNNN_nome.sql` e são aplicadas em ordem por `db:migrate`, cada uma numa transação, com registro em `_migracoes`. Migração aplicada não muda: correção é migração nova. Os ids são `uuid`. Todo carimbo de tempo vem do `Clock`, nunca de `now()` no SQL. Todo campo `jsonb` é validado com zod na escrita e na leitura. O dia de uma linha (`dia`) é o dia local da pessoa, no fuso da cidade dela ou no fuso padrão.

**Portas.** O core grava e lê por onze portas (`AccountRepository`, `ProfileStore`, `PantryStore`, `PreferenceStore`, `OutcomeStore`, `ShortageStore`, `RoutineStore`, `PatternStore`, `MessageRepository`, `RunRepository`, `ProposalStore`) e por um `Transactor`, que entrega as mesmas portas ligadas a uma transação. Todo método recebe `contaId` primeiro, e ele vai no `WHERE` de toda consulta; as exceções são os métodos de limpeza, `alimentos_desconhecidos` e a busca de conta pelo `google_sub`. Cada porta tem um adaptador Postgres (`src/infra/db/`) e um fake em memória (`src/infra/fakes/memory-stores.ts`). Uma suíte de contrato única (`test/contracts/`) roda contra os dois: o fake no `npm test` e o Postgres no ⚠️ `test:db` e no job `db` da CI.

**Limpeza diária.** `executarLimpeza` apaga as mensagens com mais de 7 dias, as mensagens com incômodo de dias anteriores, os retornos sem resposta com mais de 7 dias, as faltas com mais de 30 dias e o "evitar" temporário de dias anteriores. Ela também expira os runs em espera há mais de 30 minutos e as propostas pendentes deles, e apaga as contas de demonstração vencidas. Os prazos ficam em `config/memoria.ts`, e os cortes por dia usam o fuso padrão.

## 7. Estrutura de pastas

```
src/
  core/                      # sem framework
    knowledge/               # base, substitutos, combinações, explicação
    weather/  pantry/  preferences/  routine/  patterns/  limits/
    security/                # CSP e headers de segurança, checagem de Origin
    guardrails/              # padrões e conferência da entrada: alerta emocional, alerta físico, injection (sem LLM)
    filtro-da-pessoa.ts      # filtro do dia (perfil, temporários, gostos), usado pelo preparo e pelos padrões
    ranking/                 # ordenação dos candidatos
    llm/                     # ModelRouter, papéis, cotas
    agents/
      interpreter/  companion/  memory/
      judge/                 # Juiz: entrada, prompt juiz.v1, leitura dos apontamentos, veredito, textos da nova tentativa
      chamada-de-apoio.ts    # a chamada do papel apoio, dividida por Intérprete e Juiz
      tools/                 # catálogo fechado: leitura, controle, escrita
      prompts/               # prompts versionados
    runs/                    # estados, checkpoint, etapas, loop, caminhos por intenção, aprovação
    telemetry/               # porta Telemetry e nomes de spans e métricas
  infra/                     # adaptadores: mastra, gemini, open-meteo, db, auth (Auth.js, token, IP em HMAC), otel
    container.ts             # composition root
  app/                       # Next.js: telas e rotas; marca/ é a vitrine do design system
    fonts/                   # Cormorant Garamond e Figtree (woff2 variável, OFL)
  proxy.ts                   # headers de segurança (CSP com nonce) e checagem de Origin
  components/                # UI: só aqui se importa react-aria-components (R5)
    tokens/                  # tokens.css (o único lugar com cor, raio, sombra) e teste de contraste
    theme/                   # cookie ritu_theme e seletor de tema
    base/                    # componentes base sobre React Aria
    brand/                   # Logo e DoshaBlot
config/                      # llm-cotas.ts, clima.ts, ranking.ts, limites.ts, padroes.ts, ui.ts, evals.ts (pausas, estimativas e metas)
public/marca/                # símbolo do logo, manchas dos doshas, textura de papel
scripts/                     # demo.ts (terminal), eval-llm.ts, cleanup.ts, padroes.ts, smoke.ts
  lib/evals/                 # runner do eval com LLM: casos, rodadores, avaliador, rodada, métricas, metas, relatório, histórico e comparação
data/                        # base ayurvédica em YAML
seed/                        # perfil de demonstração (demo.yaml)
evals/
  det/                       # evals determinísticos; mapa.ts liga cada linha de QA.md aos arquivos
  llm/                       # tipos.ts (famílias e marcas), avaliador.v1.ts, checkpoints.ts, casos/{c1,c2,c3} e casos/index.ts
  resultados/                # <checkpoint>.md e .json, historico.json
  local/                     # andamento e falhas da rodada; fora do git
  COMPARACAO.md              # gerado de resultados/historico.json
observability/
  dashboards/ritu.json       # painel, gerado por npm run painel:gerar
  grafana/alerting/ritu.yaml # regras de alerta, geradas por npm run painel:gerar
  grafana/dashboards.yaml    # provedor do painel no LGTM, escrito à mão
mcp/                         # servidor MCP
test/fixtures/
e2e/                         # Playwright; apoio/ com usarTema e expectSemViolacoes (axe)
```

## 8. Serviços e planos

Só planos gratuitos, sem cartão.

| Serviço | Plano | Cuidado |
|---|---|---|
| Vercel | Hobby | Tempo máximo de função; as pausas já evitam função longa |
| Postgres em produção | Neon Free ou Supabase Free | Um projeto para o Ritu |
| Gemini | Gratuito | Cotas por modelo e troca automática (`AI.md` §10). No plano gratuito o provedor pode usar as mensagens: o Aviso inicial e a tela Sobre dizem isso |
| Grafana Cloud | Free | Retenção curta e limite mensal |
| Open-Meteo | Gratuito, uso não comercial | Cache de 1 h por cidade |
| GitHub Actions | Gratuito em repositório público | — |

## 9. Ambientes

| | Dev | Prod |
|---|---|---|
| Site | `localhost:3000` | Vercel (`*.vercel.app`) |
| Banco | Postgres no Docker | Neon ou Supabase |
| Observabilidade | LGTM no Docker (`localhost:3001`) ou desligada | Grafana Cloud |
| Google | Cliente OAuth com `localhost` | Mesmo cliente, com a URL de produção |
| LLM | Chave do projeto de desenvolvimento; é a que roda os evals | Chave do projeto de produção |
