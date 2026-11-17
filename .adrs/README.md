# ADRs (Architecture Decision Records)

- Template: `_template.md`. Nome: `NNNN-<nome>.md`. Em português.
- **ADR aceita não é reescrita.** Mudou de ideia: escreva outra com `Substitui [NNNN]`.
- Toda spec que tomar uma decisão de arquitetura entrega uma ADR (`.docs/RULES.md` §8).

## Índice

| # | Decisão | Status |
|---|---|---|
| [0001](0001-foco-no-momento.md) | Foco no momento, com o que há em casa | Aceito |
| [0002](0002-conversa-em-texto-livre.md) | Conversa em texto livre, resposta em texto do agente | Aceito |
| [0003](0003-base-estruturada-em-yaml.md) | Base estruturada em YAML consultada por tools, sem RAG | Aceito |
| [0004](0004-fundacao-tecnica.md) | Fundação técnica | Aceito |
| [0005](0005-loop-no-core-mastra-por-passo.md) | Loop do agente no core, Mastra por passo | Aceito |
| [0006](0006-roteamento-por-intencao.md) | Roteamento por intenção, com o que é sempre igual em código | Aceito |
| [0007](0007-autocorrecao-em-finalizar.md) | Autocorreção obrigatória dentro de `finalizar` | Aceito |
| [0008](0008-ler-livre-escrever-proposto.md) | Ler é livre, escrever é proposto | Aceito |
| [0009](0009-casa-com-estado-por-durabilidade.md) | Casa com data de confirmação e estado calculado por durabilidade | Aceito |
| [0010](0010-adequacao-filtra-gosto-ordena.md) | Adequação filtra, gosto e resultado ordenam, em código | Aceito |
| [0011](0011-retorno-sem-cobranca.md) | Retorno sem cobrança | Aceito |
| [0012](0012-memoria-em-niveis.md) | Memória em níveis | Aceito |
| [0013](0013-juiz-em-producao.md) | Juiz em produção, fail-closed, em modelo diferente | Aceito |
| [0014](0014-modelos-por-papel.md) | Vários modelos por papel, com registro de cota e troca automática | Aceito |
| [0015](0015-clima-real-sem-gps.md) | Clima real pela cidade escolhida, sem GPS | Aceito |
| [0016](0016-vocabulario-fechado-e-privacidade.md) | Vocabulário fechado, nenhuma pergunta sensível de saúde, privacidade por minimização | Aceito |
| [0017](0017-entrada-google-e-demonstracao.md) | Entrada com Google e demonstração por clique com perfil semeado | Aceito |
| [0018](0018-observabilidade-em-tres-camadas.md) | Observabilidade em três camadas | Aceito |
| [0019](0019-evals-como-gate.md) | Evals como gate, com registro da evolução | Aceito |
| [0020](0020-so-planos-gratuitos.md) | Só planos gratuitos, sem cartão | Aceito |
| [0021](0021-construcao-por-orquestrador-e-subagentes.md) | Construção por orquestrador e subagentes, com portões humanos | Aceito |
| [0022](0022-vocabulario-fechado-de-12-qualidades.md) | Vocabulário fechado de 12 qualidades | Aceito |
| [0023](0023-fontes-da-base-pela-internet.md) | Fontes da base consultadas pela internet, com registro da página | Aceito |
| [0024](0024-clima-por-porta-com-cache-em-memoria.md) | Clima por porta, com cache em memória e sem nova tentativa | Aceito |
| [0025](0025-suite-de-contrato-unica.md) | Suíte de contrato única para fakes e Postgres | Aceito |
| [0026](0026-roteador-com-registro-de-uso-atomico.md) | Roteador de modelos com registro de uso atômico por janela | Aceito |
| [0027](0027-cenarios-compartilhados-entre-demo-e-evals.md) | Cenários compartilhados entre demo, evals e eval:llm | Aceito |
| [0028](0028-o-que-a-mensagem-traz-vale-no-mesmo-run.md) | O que a mensagem traz vale no mesmo run, sem gravar | Aceito |
| [0029](0029-run-nasce-antes-do-interprete.md) | O run nasce antes do Intérprete e o span `run` cobre o run inteiro | Aceito |
| [0030](0030-formato-do-checkpoint-e-da-pendencia.md) | Formato do checkpoint e da pendência de pergunta | Aceito |
| [0031](0031-perguntas-fechadas-montadas-por-codigo.md) | Perguntas fechadas, com texto montado por código, e variante perguntada antes do agente | Aceito |
| [0032](0032-resposta-gravada-antes-de-retomar.md) | Resposta à pergunta gravada na hora, antes de retomar, com troca de status condicional | Aceito |
| [0033](0033-aprovacao-com-bloco-e-executor-fechado.md) | Aprovação com bloco montado por código e executor fechado | Aceito |
| [0034](0034-fim-do-run-e-aprovacao-numa-transacao.md) | Fim do run da conversa e aprovação numa transação, com troca de status condicional | Aceito |
| [0035](0035-temporario-do-dia-com-restricao-e-nao-como.md) | Restrição e "não como" ditos na conversa valem no dia, sem esperar aprovação | Aceito |
| [0036](0036-aprendizado-gravado-e-toques-sem-agente.md) | Aprendizado gravado pelo Acompanhante numa transação e toques sem agente | Aceito |
| [0037](0037-frase-do-padrao-por-codigo-e-memoria-so-para-o-resumo.md) | Frase do padrão por código e agente de Memória só para o resumo | Aceito |
| [0038](0038-tarefas-em-ondas-e-trilha-adiantada.md) | Tarefas em ondas e trilha adiantada em worktree (substitui em parte a 0021) | Aceito |
| [0039](0039-gravidade-dos-apontamentos-do-juiz-e-nova-tentativa.md) | Gravidade dos apontamentos do Juiz e nova tentativa no mesmo loop | Aceito |
| [0040](0040-tokens-em-css-tema-por-cookie-e-fontes-locais.md) | Tokens em CSS com Tailwind v4 e `light-dark()`, tema por cookie lido no servidor, fontes locais | Aceito |
| [0041](0041-runner-de-eval-com-andamento-metas-e-historico.md) | Runner de eval com andamento, metas e histórico | Aceito |
| [0042](0042-telemetria-com-lista-fechada-tipada-e-painel-gerado.md) | Telemetria com lista fechada tipada e painel gerado | Aceito |
| [0043](0043-sessao-jwt-demonstracao-por-credenciais-limitador-e-modo-e2e.md) | Sessão em JWT, demonstração como provedor de credenciais, limitador em tabela e modo de E2E em memória | Aceito |
| [0044](0044-etapas-por-fluxo-ndjson-run-independente-da-conexao-e-visao-por-projecao.md) | Etapas por fluxo NDJSON no POST, run independente da conexão e visão do run por projeção | Aceito |
| [0045](0045-toques-da-casa-por-uma-rota-visao-devolvida-e-relogio-noturno-no-e2e.md) | Toques da casa por uma rota, visão devolvida pela rota e relógio noturno no modo E2E | Aceito |

## Fundadoras (a spec 001 escreve, com o racional dos docs)

| # | Decisão | Racional em |
|---|---|---|
| 0001 | Foco no momento: o que a pessoa conta + constituição → ações imediatas com o que há em casa, sempre iniciadas pela pessoa; valor antes do cadastro | `BUSINESS.md` §1–3, §13 |
| 0002 | Conversa em texto livre como entrada, e texto do agente como resposta; blocos visuais só de apoio | `BUSINESS.md` §2, §8 |
| 0003 | Base estruturada em YAML consultada por tools, em vez de RAG; vocabulário único de qualidades; refeição = preparo + alimentos da base | `KNOWLEDGE.md` §1, §5 |
| 0004 | Fundação: Next.js, core sem framework, npm, Biome, Vitest, `postgres`, Auth.js | `ARCHITECTURE.md` §2 |
| 0005 | Loop do agente no core; a Mastra executa cada passo, atrás de `AgentRuntime`; estado das pausas no banco | `ARCHITECTURE.md` §3, `AI.md` §3 |
| 0006 | Roteamento por intenção: o que é sempre igual é resolvido por código, sem o agente | `AI.md` §3 |
| 0007 | Autocorreção obrigatória: `finalizar` roda o validador e só entrega resposta sem violações | `AI.md` §3–4 |
| 0008 | Ler é livre, escrever é proposto: aprovação da pessoa e executor em código; toques da pessoa gravam direto | `AI.md` §5, §7 |
| 0009 | Casa como base com data de confirmação e estado calculado por durabilidade | `BUSINESS.md` §9 |
| 0010 | Adequação filtra, gosto e resultado ordenam; ordenação e troca de ingrediente em código | `BUSINESS.md` §9, `AI.md` §6, `KNOWLEDGE.md` §6 |
| 0011 | Retorno sem cobrança: área "Como ficou?", um toque, sem notificação | `BUSINESS.md` §10 |
| 0012 | Memória em níveis, com resumo de rotina compactado, padrões confirmados pela pessoa e sinais no contexto | `AI.md` §6, `BUSINESS.md` §11 |
| 0013 | Juiz em produção, fail-closed, em modelo diferente do agente, com uma nova tentativa no papel `reforco` | `AI.md` §8, §10 |
| 0014 | Vários modelos por papel, com registro de cota e troca automática | `AI.md` §10 |
| 0015 | Clima real (Open-Meteo) como tool, pela cidade que a pessoa escolhe; sem GPS | `DATA-SOURCES.md` §1 |
| 0016 | Vocabulário fechado e nenhuma pergunta sensível de saúde; incômodo fora da memória; privacidade por minimização | `KNOWLEDGE.md` §9, `BUSINESS.md` §12, §14 |
| 0017 | Entrada com Google e conta de demonstração por clique com perfil semeado | `ARCHITECTURE.md` §4 |
| 0018 | Observabilidade em três camadas: rastro no banco, OpenTelemetry → Grafana, qualidade contínua | `OBSERVABILITY.md` |
| 0019 | Evals como gate: determinísticos sempre, com LLM em cinco checkpoints, com registro da evolução | `QA.md` |
| 0020 | Só planos gratuitos, sem cartão | `ARCHITECTURE.md` §8 |
| 0021 | Construção por orquestrador e subagentes, commit direto na `main`, quatro portões humanos | `RULES.md` |

Devem surgir nas specs: formato do checkpoint (005 e 009), streaming das etapas (018), banco de produção (022), transporte do MCP (023).
