# ADRs (Architecture Decision Records)

- Template: `_template.md`. Nome: `NNNN-<nome>.md`. Em português.
- **ADR aceita não é reescrita.** Mudou de ideia: escreva outra com `Substitui [NNNN]`.
- Toda spec que tomar uma decisão de arquitetura entrega uma ADR (`.docs/RULES.md` §8).

## Índice

| # | Decisão | Status |
|---|---|---|
| — | Nenhuma escrita ainda | — |

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
