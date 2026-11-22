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
   └── Você (perfil, memória), cidade, quiz, bastidores (sem LLM)
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

Vercel Cron, 3h em São Paulo → limpeza (demos vencidas, runs e propostas expirados, mensagens com mais de 7 dias, mensagens de run com incômodo do dia anterior, retornos sem resposta há mais de 7 dias, faltas com mais de 30 dias)
Vercel Cron, 5h em São Paulo → detecção de padrões
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
3. Tamanho da mensagem e limite de mensagens, decididos na rota, antes de `conversar` (ADR 0045). Com um run em `running` na conta: `409 run_aberto`, sem consumir. Senão `decidirMensagem`, nesta ordem: tester segue sem contar; cota de IA do dia esgotada em todos os modelos de `decisao` segue sem contar; consome, de uma vez, a chave da conta (ou da demonstração) e a do IP. Se passou, segue. Se barrou: mensagem só com atalhos vai a `conversar` com `semModelo: "limite"` (práticas por código, sem modelo, sem contar); mensagem com sinal de alerta reconhecido por `conferirEntrada` segue normal, sem contar, e o guardrail por código responde; o resto recebe `429` com o código (`limite_mensagens`, `limite_demo` ou `limite_ip`), `Retry-After` e o estado dos limites no corpo. O fim da leitura e todo evento `fim` levam o estado dos limites (`mensagens` e `cota_ia`).
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

### Rotas de run

| Ação | Rota | Resposta |
|---|---|---|
| Conversa do dia | `GET /api/conversa` | JSON |
| Mensagem nova | `POST /api/runs` | Fluxo NDJSON |
| Resposta a uma pergunta do agente | `POST /api/runs/:id/resposta` | Fluxo NDJSON |
| Visão de um run | `GET /api/runs/:id` | JSON |
| Decisão do bloco de aprovação | `POST /api/runs/:id/aprovacao` | JSON |
| Trocar ingrediente | `POST /api/runs/:id/troca` | JSON |
| Resposta à troca (tenho, não tenho) | `POST /api/runs/:id/troca/resposta` | JSON |
| 👍 / 👎 na resposta | `POST /api/runs/:id/voto` | JSON |

As rotas de mensagem e de resposta devolvem `application/x-ndjson`, uma linha por evento: `inicio` (com o `run_id`), `etapa` (uma frase do produto), `fim` (com a visão do run e o número de pendentes) e `erro` (com o código). Erro conhecido antes do fluxo abrir sai em JSON, com o status do código: `404` para `run_nao_encontrado`; `409` para `run_aberto`, `run_nao_continuavel`, `pergunta_expirada`, `aprovacao_expirada` e `run_pausado`; `400` para o resto. Erro depois de aberto vira evento `erro`; erro sem marca do Ritu vira `500` `erro_inesperado`.

O run segue até o fim mesmo que a pessoa saia da tela: a rota não liga o `request.signal`, e o resultado fica no banco. A tela recarregada no meio de um run consulta `GET /api/runs/:id` a cada 2 s, por até 90 s (`config/tela-conversa.ts`). A rota devolve só a visão do run (`visaoDoRun`, em `src/core/conversation/visao.ts`), sem campo interno. Decisões em ADR 0044.

### Rotas de toque (sem LLM)

| Ação | Rota | O que grava |
|---|---|---|
| Retorno com um toque | `POST /api/retornos/:id` | `retornos` e o contador em `preferencias`. Devolve o retorno e quantos ainda esperam; retorno já respondido volta como está |
| Trocar ingrediente | `POST /api/runs/:id/troca` | A sugestão do run e o retorno dela, com o substituto e o motivo; confere as combinações com os outros itens. "Não tenho" e "Não gosto" também gravam a falta e o gosto |
| Não gosto · Gosto | `POST /api/preferencias` | `preferencias` |
| Minha casa: adicionar (da base ou texto livre) · Ainda tenho · Acabou · Sempre tenho · tirar | `POST /api/casa` (`acao` em união discriminada) | `casa`. "Acabou" pela tela não grava falta. Registrar um alimento apaga as faltas dele e o tira de `lista_ter_em_casa`. Devolve a casa inteira (`CasaNaTela`) |
| Pôr na lista ou tirar da lista "Para ter em casa" | `POST /api/lista` (`acao`: `por` ou `tirar`) | `lista_ter_em_casa`; `por` grava o motivo `pessoa`; `tirar` também apaga as faltas do alimento. Devolve a casa inteira |
| Ler a casa · ler o que espera retorno | `GET /api/casa` · `GET /api/retornos` | Nada; devolvem `CasaNaTela` e `ComoFicouNaTela` |
| 👍 / 👎 na resposta | `POST /api/runs/:id/voto` | `feedback` |
| Ler "Você" (carta do dosha, fixos, memória por nível, conta) | `GET /api/voce` | Nada; devolve `VoceNaTela` |
| Perfil: dosha · quiz · cidade · evitar sempre (acrescentar, tirar) · restrições · "não como" (acrescentar, tirar) | `POST /api/perfil` (`acao` em união discriminada: `dosha`, `quiz`, `cidade`, `evitar_acrescentar`, `evitar_tirar`, `restricoes`, `nao_come_acrescentar`, `nao_come_tirar`) | `perfis`. `evitar_tirar` só passa com `confirmado: true`. Devolve `Você` inteiro; o quiz devolve também o resultado |
| Memória: gosto · esquecer um item · apagar falta · corrigir ou apagar nota de rotina · confirmar, recusar ou apagar padrão · apagar a conversa de um dia | `POST /api/memoria` (`acao` em união discriminada: `gosto`, `esquecer`, `falta_apagar`, `nota_corrigir`, `nota_apagar`, `padrao_decidir`, `padrao_apagar`, `conversa_apagar`) | `preferencias`, `faltas`, `rotina_notas`, `padroes`, `mensagens` e `runs.fora_da_conversa`. Devolve `Você` inteiro |

Todo `POST` com conta, exceto `POST /api/runs`, é um toque e passa pelo limite de toques dentro de `criarRota` e `criarRotaDeFluxo`, pelo método e não por uma lista de rotas: depois da sessão, da conta e do corpo válidos, e antes de a função da rota rodar. Os `GET`, a limpeza e `/api/auth/*` não contam. Barrado: `429 { erro: "limite_toques" }` com `Retry-After` em segundos (até o próximo minuto ou até a meia-noite local) e nada gravado. Quem decide é `consumirToque`: tester segue; o minuto da conta é consumido antes do dia da conta e do IP, e cada consumo é atômico. As rotas só autenticam, validam a entrada e chamam funções do core (a lógica de cada rota fica em `src/app/_rotas/`, e cada `route.ts` só liga as dependências reais), em `src/core/touches/` (ADR 0036). Todas recebem a `contaId` da sessão, rodam em transação e não chamam modelo:

| Função | Rota | O que faz |
|---|---|---|
| `tocarRetorno(deps, contaId, retornoId, resultado)` | `/api/retornos/:id` | Fecha o retorno com origem `toque`. Retorno que não existe, é de outra conta ou já foi respondido: `toque_invalido` |
| `tocarGosto(deps, contaId, item, gosto)` | `/api/preferencias` | Grava `gosta`, `nao_gosta` ou limpa (`null`). Item fora da base: `toque_invalido` |
| `tocarCasa(deps, contaId, acao)` | `/api/casa` | Aplica a ação na casa. Item que não é da conta ou alimento fora da base: `toque_invalido`. Texto livre passa antes por `identificarAlimento` |
| `tocarLista(deps, contaId, acao)` | `/api/lista` | Põe na lista com motivo `pessoa` (já na lista: não muda) ou tira e apaga as faltas. Alimento fora da base: `toque_invalido` |
| `tocarPerfil(deps, contaId, acao)` | `/api/perfil` | Aplica a ação no perfil. Alimento fora da base ou tirar sem confirmação: `toque_invalido`. Conta uma edição de nível `fixos` |
| `tocarMemoria(deps, contaId, acao)` | `/api/memoria` | Aplica a ação na memória. Apagar a conversa de um dia apaga as mensagens dele e tira os runs fechados dele da conversa (`fora_da_conversa`); fora dos últimos 7 dias: `toque_invalido`; com run aberto no dia: `conversa_em_andamento` |
| `trocarIngrediente(deps, contaId, { runId, sugestao, alimento_id, motivo })` | `/api/runs/:id/troca` | Com motivo `trocar`, `nao_tenho` ou `nao_gosto`: anota o que o motivo pede e devolve `trocou` (com a sugestão nova), `perguntar` (com a pergunta sobre o substituto mais próximo) ou `sem_substituto` |
| `responderTroca(deps, contaId, { runId, sugestao, alimento_id, candidato, resposta })` | `/api/runs/:id/troca/resposta` | Resposta `tenho` (registra em casa e troca) ou `nao_tenho` (anota a falta e devolve `sem_substituto`) |

Rotina e padrões têm funções do core que `tocarMemoria` chama, em `src/core/routine/` e `src/core/patterns/`. Também recebem a `contaId` da sessão e confirmam que o item é da conta; item que não existe ou não é dela: `nota_invalida` ou `padrao_invalido`.

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
- **Limites:** mensagens, toques e demonstrações têm limites próprios (`BUSINESS.md` §14), contados por conta e por IP em HMAC, na tabela `limites`. Cada pedido de consumo leva o próprio início de janela, e o adaptador do banco confere todos os tetos sob trava, numa transação, e só então soma: se um barra, nenhum sobe. A limpeza diária apaga as janelas de dia anteriores a ontem e as de minuto anteriores a hoje. No modo e2e (`RITU_MODO=e2e`), o header `x-ritu-e2e-teto` (1 a 100) substitui os tetos daquele pedido e o `x-ritu-e2e-cota: esgotada` tira a cota do dia do modelo `decisao`; fora do modo e2e os dois são ignorados.
- **Cron e saúde:** `/api/cron/limpeza`, `/api/cron/padroes` e `/api/saude` só com `Authorization: Bearer <CRON_SECRET>`, conferido por `autorizarCron` em tempo constante; sem `CRON_SECRET`, `503 cron_desligado`. A Vercel manda o bearer sozinha nos crons. A saúde (banco, última migração, contagens da base, seed, telemetria, Google, versão) nunca devolve valor de variável, URL nem mensagem de erro.
- **Servidor MCP:** público e sem login, com limite por IP. Só expõe as tools de leitura da base e do clima; nunca dado de conta.
- **Dependências:** Dependabot semanal, com os pacotes `@opentelemetry/*` e o `@vercel/otel` num grupo só (eles só instalam juntos). Na CI, o `audit-ci` barra advisory alto ou crítico em dependência de produção; as exceções ficam em `audit-ci.jsonc`, cada uma com o id e o porquê.

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

**Modo de E2E.** Com `RITU_MODO=e2e`, o container monta stores, limitador e cidades em memória, guardados no `globalThis` (o Next carrega os módulos em separado). Nesse modo o header `x-ritu-e2e` vale como o IP do pedido e como prefixo das chaves do limitador, para cada cenário ter a sua cota. O relógio anda como o real, mas parte das 20h30 UTC do dia em que o processo sobe, para que o momento do dia (e, com ele, os candidatos dos roteiros) não dependa da hora da rodada. O container recusa subir no modo e2e com `VERCEL_ENV=production`.

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
| `runs` | `id`, `conta_id`, `fora_da_conversa` (verdadeiro quando a pessoa apagou o dia: o run sai da conversa e fica só no rastro, sem texto), `caminho` (acompanhante, casa, retorno, evitar, ajuda, ofensa, alerta, fora, sem_modelo), `intencoes[]`, `status`, `checkpoint`, `pendencia` (pergunta com `origem` agente ou código e as anotações da mensagem), `momento` (campos estruturados, sem incômodo), `com_incomodo`, `clima_usado`, `saida`, `passos`, `tokens_entrada`, `tokens_saida`, `latencia_ms`, `modelos` (por papel), `trocas_de_modelo`, `prompt_versao`, `juiz_tentativas`, `juiz_aprovado`, `trace_id`, `dia`, `criado_em`, `atualizado_em`. No máximo um run aberto (`running`, `waiting_for_input`, `waiting_for_approval`) por conta |
| `run_etapas` | `run_id`, `ordem`, `tipo`, `nome`, `resumo`, `status`, `duracao_ms`, `modelo`, `tokens_entrada`, `tokens_saida` |
| `propostas` | `id`, `run_id`, `conta_id`, `tool`, `conteudo`, `decisao` (pendente, aprovada, recusada, expirada), `decidida_em` |
| `faltas` | `conta_id`, `alimento_id`, `dia`, `origem` (teria_entrado, nao_tenho), `run_id`. Uma linha por conta, alimento e dia; apagadas depois de 30 dias |
| `lista_ter_em_casa` | `conta_id`, `alimento_id`, `motivo` (faltou_hoje, fez_falta, pessoa), `detalhe` (a sugestão de hoje, ou o número de faltas), `criado_em` |
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
    como-pensei/             # linha-do-tempo.ts (frases por código a partir das etapas) e ler.ts (a leitura do run para a tela)
    runs/                    # estados, checkpoint, etapas, loop, caminhos por intenção, aprovação
    telemetry/               # porta Telemetry e nomes de spans e métricas
  infra/                     # adaptadores: mastra, gemini, open-meteo, db, auth (Auth.js, token, IP em HMAC), otel
    container.ts             # composition root; saude() e telemetriaLigada
    saude.ts                 # leitura da saúde (banco, migração, base, seed), sem valor de variável
    e2e/                     # modo e2e: roteiros, clima e relógio fixos e cota por x-ritu-e2e; só o container importa
  app/                       # Next.js: telas e rotas; marca/ é a vitrine do design system
    _lib/                    # rota.ts (sessão, corpo e erros do Ritu viram status), fluxo.ts (rota de fluxo NDJSON)
    _rotas/                  # corpo das rotas: conversa, fluxo-de-run (mensagem e resposta do run), cron (limpeza e padrões), saude, onboarding, busca
    _apoio/                  # descarregar.ts: telemetry.encerrar() em after() com telemetria ligada
    api/cron/_autorizar.ts   # autorizarCron, comum aos crons e à saúde
    fonts/                   # Cormorant Garamond e Figtree (woff2 variável, OFL)
  proxy.ts                   # headers de segurança (CSP com nonce) e checagem de Origin
  components/                # UI: só aqui se importa react-aria-components (R5)
    tokens/                  # tokens.css (o único lugar com cor, raio, sombra) e teste de contraste
    theme/                   # cookie ritu_theme e seletor de tema
    base/                    # componentes base sobre React Aria
    brand/                   # Logo e DoshaBlot
    ritu/                    # telas do Ritu: abas.tsx (barra de navegação), conversa/ (componentes, estado.ts, use-conversa.ts, ler-eventos.ts), casa/ (Minha casa, use-casa.ts), como-ficou/, voce/ (carta do dosha, fixos, memória, conta) e como-pensei/ (a linha do tempo)
config/                      # llm-cotas.ts, clima.ts, ranking.ts, limites.ts, padroes.ts, ui.ts, evals.ts (pausas, estimativas e metas)
public/marca/                # símbolo do logo, manchas dos doshas, textura de papel
scripts/                     # demo.ts (terminal), eval-llm.ts, cleanup.ts, padroes.ts, smoke.ts, env-producao.ts, painel-publicar.ts; ci-workflow.test.ts trava o workflow
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
e2e/                         # Playwright; apoio/ com usarTema e expectSemViolacoes (axe); roteiros/ são os roteiros do modo e2e
e2e-producao/                # smoke:completo contra a produção (playwright.producao.config.ts), só à mão
.github/                     # workflows/ci.yml (gates, evals, db, deploy) e dependabot.yml
vercel.json                  # região gru1, deploy pelo Git desligado, crons
DEPLOY.md                    # roteiro da dona para ligar as contas de produção
```

## 8. Serviços e planos

Só planos gratuitos, sem cartão.

| Serviço | Plano | Cuidado |
|---|---|---|
| Vercel | Hobby, funções em `gru1` (São Paulo) | Um cron por dia por agendamento, com atraso de até 59 min; tempo máximo de função (as pausas já evitam função longa) |
| Postgres em produção | Neon Free em `aws-sa-east-1` | Dorme após 5 min parado; 100 CU-h por mês; sem backup próprio além do histórico curto de restauração |
| Gemini | Gratuito | Cotas por modelo e troca automática (`AI.md` §10). No plano gratuito o provedor pode usar as mensagens: o Aviso inicial e a tela Sobre dizem isso |
| Grafana Cloud | Free | Retenção curta e limite mensal |
| Open-Meteo | Gratuito, uso não comercial | Cache de 1 h por cidade |
| GitHub Actions | Gratuito em repositório público | — |

## 9. Ambientes

| | Dev | Prod |
|---|---|---|
| Site | `localhost:3000` | Vercel (`*.vercel.app`) |
| Banco | Postgres no Docker | Neon: a aplicação usa a URL com pooler (`prepare: false`); as migrações, a URL direta |
| Observabilidade | LGTM no Docker (`localhost:3001`) ou desligada | Grafana Cloud |
| Google | Cliente OAuth com `localhost` | Mesmo cliente, com a URL de produção |
| LLM | Chave do projeto de desenvolvimento; é a que roda os evals | Chave do projeto de produção |

**Deploy** (ADR 0046). O deploy pelo Git da Vercel fica desligado; quem sobe é o job `deploy` da CI, a cada push na `main` (ou `workflow_dispatch`), só depois dos jobs `gates` e `db` verdes, no ambiente `producao` do GitHub (restrito à `main`, com os segredos `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DIRETA` e `CRON_SECRET`, e a variável `SITE_URL`), um de cada vez. Passos: `base:check -- --producao` → `env:producao` → `db:migrate` pela URL direta → `vercel deploy --prod` com `RITU_VERSAO` igual ao sha → `smoke`. Se o smoke falha depois do deploy, `vercel rollback` volta ao deploy anterior e o job fica vermelho. Toda migração funciona com o código que já está no ar. O roteiro para ligar as contas é o `DEPLOY.md`.
