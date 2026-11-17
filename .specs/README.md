# Specs

Cada spec descreve **o quê e por quê** de uma parte. O **como** fica no plano (`.plans/`), escrito pelo orquestrador.

- Template: `_template.md`. Acrescente `entrega: N` no cabeçalho.
- Nome: `NNN-<nome-em-kebab-case>.md`.
- Status: `draft` → `approved` (a dona aprovou) → `implemented` (com o hash do último commit).
- Os contratos vêm **por extenso**: é deles que o orquestrador tira as tarefas mastigadas.
- Marque na spec o **nível** de cada parte: `mecanica` (Haiku), `nucleo` (Sonnet), `tela` (Sonnet) ou `conteudo` (Opus). Regras em `RULES.md` §1.
- Liste em "Leitura para a construção" só as seções de `.docs/` que a construção precisa abrir.
- As specs de uma entrega são todas aprovadas antes de ela começar. As das entregas seguintes podem ser escritas durante a construção, a partir do código já commitado.
- **Andamento:** 001 a 007 implementadas (entrega 1, aprovada no portão 1); 008 a 015 implementadas (entrega 2); 016 a 020 aprovadas (entrega 3 toda especificada), 016 e 017 implementadas; 021 a 024 aprovadas (entrega 4 toda especificada). Antes da 008: correção C13 da 002 (alimentos aceitos por vaga).

## Pendências da dona

- **Revisão das 156 linhas `a_confirmar` da base** (106 em `alimentos.yaml`, 37 em `praticas.yaml`, 10 em `preparos.yaml`, 3 em `incomodos.yaml`), em conversa com o Claude, **antes de a 022 ir para código**. O deploy da 022 roda `base:check -- --producao`, que falha enquanto houver alguma. Agentes não mexem em `data/` para passar esse gate.

## Backlog

### Entrega 1: cérebro no terminal

| # | Spec | Entrega | Depende de | Nível |
|---|---|---|---|---|
| 001 | `fundacao` | Repositório: npm, Biome, Vitest, tsx, CI, `.env.example`, `env:check`, composition root, `Clock`, pasta `config/`, teste de arquitetura, `docker-compose` (Postgres + LGTM), ADRs fundadoras | — | Mecânica |
| 002 | `base-conhecimento` | Schemas zod e validador de `alimentos`, `preparos`, `praticas`, `combinacoes`, `doshas`, `incomodos`, `quiz`, `grupos_evitar`, `vocabulario` e `fontes`; 130 alimentos, 30 preparos e 44 práticas; momento → qualidades (`estados`); tools `ayurveda.alimento`, `ayurveda.candidatos`, `ayurveda.substitutos`, `ayurveda.checar_combinacao` | 001 | Mecânica; **conteúdo** nos YAML |
| 003 | `clima-e-cidades` | Portas `WeatherSource` e `CityLookup`, adaptadores Open-Meteo, faixas → qualidades, cache por cidade; tools `clima.agora` e `clima.proximas_horas` | 001 | Mecânica |
| 004 | `dados-e-memoria` | Migrações e repositórios (com fakes) de contas, perfis, casa, preferências, retornos, rotina, padrões, mensagens, runs, etapas, propostas, faltas, lista e evitar sempre (fixo e do dia); estado dos itens da casa por durabilidade; tools `casa.ler`, `preferencias.ler`, `historico.recente` | 001 | Mecânica |
| 005 | `runtime-e-rastro` | Porta `AgentRuntime` + adaptador Mastra + runtime roteirizado; loop com teto de chamadas, timeout e teto de tokens; estados do run e checkpoint; etapas; porta `Telemetry` + OTel com a árvore de spans | 001, 004 | **Núcleo** |
| 006 | `modelos-e-cotas` | Portas `LlmClient` e `ModelRouter`; papéis `decisao`, `apoio` e `reforco`; `config/llm-cotas.ts`; registro de uso por minuto e por dia; troca de modelo por cota e por 429; resposta montada por código quando não há modelo | 001, 004, 005 | **Núcleo** |
| 007 | `acompanhante` | Preparo com filtros (inclusive "evitar sempre" por grupo e ingrediente), ordenação com casa, gosto e resultado (`config/ranking.ts`), novidade, faltas do run e candidato a "vale ter em casa"; prompt versionado; catálogo; sinais; `finalizar` com o validador; saída com texto e parte estruturada; `npm run demo` com fixtures e com LLM; `eval:llm` mínimo para o checkpoint `c1-base` | 002–006 | **Núcleo** |

### Entrega 2: agente confiável

| # | Spec | Entrega | Depende de | Nível |
|---|---|---|---|---|
| 008 | `interprete-e-conversa` | Intérprete (intenções e campos, inclusive `evitar_sempre` aplicado no mesmo run, `ofensa`, `ajuda` e alerta com tipo físico ou emocional); caminhos por intenção, incluindo os sem agente (`casa`, `retorno`, `evitar`, `ajuda`, `ofensa`, `alerta` e `fora`, com texto fixo); itens da casa citados valendo no mesmo run; anotações de casa e de "evitar sempre" como dado; `registrarResultado`; mensagens e contexto da conversa do dia; atalhos de check-in; `eval:llm` para qualquer checkpoint, com os casos de intenção | 007 | Parte núcleo |
| 009 | `pausas` | `ask_user` com três tipos fechados de pergunta (casa, come, variante), texto montado por código; `waiting_for_input`, `continuar`, expiração, limite de perguntas; pergunta agrupada sobre a casa com Tenho · Não tenho · Não gosto, gravada na hora; variante do incômodo perguntada por código antes do agente; anotação `nao_come`; demo com pausa no terminal; casos de perguntas do `c2` | 008 | **Núcleo** |
| 010 | `aprovacao` | Propostas montadas por código (casa, "evitar sempre", restrição, "não como") e pelo agente (`memoria.propor` para rotina, `lista.propor` para o que faltou hoje); bloco com uma linha por assunto; `waiting_for_approval`, executor em código, aprovação parcial, expiração, recusa duradoura da lista; restrição e "não como" da conversa valendo no mesmo run | 009 | **Núcleo** |
| 011 | `retorno-gostos-e-trocas` | Retornos criados a cada sugestão; registro por toque e pela conversa quando o agente está no caminho (`resultado.registrar`), sobre o `registrarResultado` da 008; gostos; troca de ingrediente por código; gravação de "já sugerido", de gostos e de resultados, que a ordenação da 007 lê; gravação das faltas do run; proposta de lista para a indicação de "vale ter em casa" (`para_ter`) | 008, 010 | Parte núcleo |
| 012 | `rotina-e-padroes` | Resumo de rotina compactado (agente de Memória), com reserva por código, refeito depois de cada nota aprovada, apagada ou corrigida; teto de notas; detecção diária de padrões em código, com a frase montada por código (`npm run padroes`); linha "Notei isto. Está certo?" no bloco, com confirmação, recusa e "fica para depois"; casos de memória do `c3` | 010, 011 | Parte núcleo |
| 013 | `guardrails-e-juiz` | Guardrail de entrada em código (alerta físico e emocional, injection) antes do Intérprete; `dosagem` no validador; Juiz fail-closed, com motivos graves e de registro (jargão), uma nova tentativa no papel `reforco` e resposta segura; proposta de rotina com saúde sai do bloco; evals de "dado, não instrução"; casos de segurança e do Juiz do `c3` | 006 a 012 | Parte núcleo |
| 014 | `evals` | Runner com `--retomar`, famílias e marcas nos 84 casos, avaliador do eval, métricas com metas que avisam e falhas críticas, relatório por checkpoint com a variação, `historico.json`, `COMPARACAO.md` gerado, mapa dos evals determinísticos, job `evals` na CI | 008–013 | Mecânica |
| 015 | `observabilidade-completa` | Métricas de `OBSERVABILITY.md`, logs estruturados, painel como código (com a linha de modelos e cota), teste de privacidade | 005, 006, 014 | Parte núcleo |

### Entrega 3: site

| # | Spec | Entrega | Depende de | Nível |
|---|---|---|---|---|
| 016 | `design-system` | Tokens, fontes, componentes base, tema claro e escuro, página `/marca`, a partir de `DESIGN.md`, com as regras de acessibilidade (§3) e o gate do axe no E2E | 001 | **Tela** |
| 017 | `entrada-e-contas` | Auth.js com Google e demonstração por clique, perfil semeado, limite de demonstrações (por IP e teto global), headers de segurança, CSP e checagem de `Origin`, limpeza diária, autorização por conta, Aviso inicial, passo "Evitar sempre", dosha (com o quiz dentro do onboarding) e cidade | 004, 016 | **Núcleo**; tela na Entrada; **conteúdo** no perfil de demonstração |
| 018 | `tela-conversa` | Mensagens, caixa de texto com atalhos, etapas ao vivo (streaming), pergunta do agente, fala do agente com sugestões de apoio, linha "Vale ter em casa", menu do ingrediente, bloco de aprovação, 👍/👎, indicador de retornos; resposta em texto puro; acessibilidade da conversa (`role="log"`, etapas em `aria-live`, resposta anunciada inteira, caixa com `aria-disabled`); E2E do caminho da demonstração | 008–013, 017 | **Tela**; parte núcleo (streaming) |
| 019 | `minha-casa-e-como-ficou` | Aba Minha casa (grupos, estados, "Ainda tem?", sempre tenho, gosto, lista "Para ter em casa" com o motivo e tirar item); área Como ficou?; rotas de toque | 011, 018 | **Tela**; rotas mecânicas |
| 020 | `perfil-memoria-e-rastro` | O que sei sobre você (todos os níveis, corrigir e apagar); Perfil (dosha, cidade, evitar sempre com confirmação para tirar, restrições, apagar dados); painel do dosha; Como pensei | 012, 018 | **Tela** |

### Entrega 4: público

| # | Spec | Entrega | Depende de | Nível |
|---|---|---|---|---|
| 021 | `limites-e-degradacao` | Limite por conta e por IP, limite das rotas de toque, testers, telas de cota esgotada, práticas gerais montadas por código | 018 | Mecânica; tela nos avisos |
| 022 | `producao` | Vercel, banco de produção, projeto e chave de produção do Gemini, Google com a URL final, Grafana Cloud, cron (limpeza e padrões), smoke, Dependabot e `npm audit` na CI, `DEPLOY.md` | 021 | Parte núcleo (precisa das contas da dona) |
| 023 | `bastidores-e-mcp` | Página `/bastidores` com os agregados de 7 dias (piso de 20 conversas, sinais por dia), a evolução dos evals em cinco gráficos com a tabela completa e a seção do MCP; servidor MCP público (`/api/mcp`) com seis tools de leitura da base e do clima, sem dado de conta, com limite por IP e global | 015, 022 | Mecânica; tela em Bastidores; núcleo na rota do MCP e no `Origin` |
| 024 | `landing-e-readme` | Seções da Entrada abaixo do cartão, rodapé público, tela Sobre com a política de privacidade (`CONTATO_PRIVACIDADE`), metadados, robots e sitemap; README em português e `README.en.md` com blocos gerados (`npm run readme`) e prints por script (`npm run prints`) | 016–023 | **Tela**; **conteúdo** no README |
