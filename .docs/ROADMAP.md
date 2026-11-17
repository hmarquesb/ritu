# Roadmap

> Construção por agentes, em quatro entregas com portão humano (`RULES.md`). Ao fim da quarta, o produto está completo.

## 0. Estado atual (atualizar a cada sessão)

Entrega 1 (specs 001 a 007) construída, com a tag `entrega-1`, e aprovada pela dona no portão 1 em 2026-11-15. O relatório está em `.plans/entrega-1-relatorio.md`; o checkpoint `c1-base` está em `evals/resultados/c1-base.md`. Entrega 2 (specs 008 a 015, com a correção C13 da 002) construída, com a tag `entrega-2`, e aprovada com correções pela dona no portão 2 em 2026-11-17. O relatório está em `.plans/entrega-2-relatorio.md`; o checkpoint `c3-confiavel` está em `evals/resultados/c3-confiavel.md`. As correções do portão 2 (seções "Correção do portão 2" das specs 008, 010, 012, 013 e 014) estão em `.plans/portao-2-correcoes-plan.md`, com o estado em `.plans/portao-2-estado.md`. Entrega 3: 016 a 020 aprovadas; 016, 017 e 018 implementadas e juntadas na `main`; 019 implementada e 020 em construção na trilha adiantada (`entrega-3`). 021 a 024 aprovadas (entrega 4 toda especificada).

**Próximos passos, na ordem:**
1. Na `main`: as correções do portão 2 (`.plans/portao-2-correcoes-plan.md`).
2. Em paralelo, no worktree: `/construir-entrega 3 adiantada`, seguindo pela 020.
3. Depois das correções: ⚠️ rodada nova do `c3-confiavel`, em outro dia, com o modelo estável.
4. A dona revisa a base (as linhas `a_confirmar`) e escreve, com o Claude, a spec nova dos chás híbridos. Ela é construída antes da 022.
5. `/construir-entrega 3`, que junta o que houver de novo na branch `entrega-3` (skill §0.6) e fecha a entrega.

## 1. Entregas

| Entrega | Resultado visível | Specs | Provas de agência (`AI.md` §1) | Checkpoint de eval (`QA.md`) |
|---|---|---|---|---|
| **1. Cérebro no terminal** | `npm run demo`: mensagem → resposta em texto com sugestões, com caminhos diferentes por cenário, troca de modelo por cota e trace no Grafana local | 001–007 | 1, 2, 6 | `c1-base` |
| **2. Agente confiável** | Conversa livre com intenções, pausa, aprovação, retorno, gostos, "vale ter em casa", memória em níveis, juiz, evals com números, painel | 008–015 | 3, 4, 5 | `c2-conversa`, `c3-confiavel` |
| **3. Site** | Entrada com demonstração, Conversa com etapas ao vivo, Minha casa, Como ficou?, O que sei sobre você, painel do dosha, quiz, Como pensei | 016–020 | Tudo na tela | `c4-site` |
| **4. Público** | Produção, limites, Bastidores com a evolução dos evals, MCP, README com números | 021–024 | — | `c5-publico` |

Backlog detalhado: `.specs/README.md`.

**Por que nessa ordem:** o valor do produto é o raciocínio. As duas primeiras entregas constroem e medem o agente sem tela; a terceira dá a ele a cara; a quarta o põe no ar.

## 2. Riscos

| Risco | Mitigação |
|---|---|
| Agentes travam numa tarefa de núcleo | Duas reprovações sobem a tarefa de nível; referências locais em `.local/REFERENCIAS.md`; estado em arquivo para retomar |
| Cota gratuita do Gemini | Papéis de modelo com troca automática (`AI.md` §10); evals com LLM só nos checkpoints; caminhos sem agente para o que é simples |
| Modelo menor erra mais no papel de decisão | Validador obrigatório, juiz em outro modelo e segunda tentativa no papel `reforco`; os checkpoints medem |
| O modelo chama todas as tools sempre | Sinais no contexto, política no prompt, eval de chamadas desnecessárias |
| Pausa e retomada com a Mastra | Estado do run no banco; validar cedo, na spec 005 |
| Telemetria perdida no serverless | `@vercel/otel`; o rastro no banco não depende do Grafana |
| Base ayurvédica com fonte fraca ou inventada | Agentes **não inventam fonte**: linha sem fonte confirmada entra como `confianca: baixa` e `fonte: a_confirmar`, a dona revisa no portão 1, e linha `a_confirmar` não vai para produção |
| Conversa livre recebe assunto delicado | Guardrail de entrada, sinal de alerta físico e emocional em código (com o CVV), juiz, incômodo fora da memória, limites do papel no prompt (`AI.md` §8) |
| Texto da resposta diz algo diferente da parte estruturada | Validador confere nomes da base citados no texto; juiz confere o sentido |
| Commit direto na `main` sem revisão humana | Verificador em toda tarefa, CI a cada push, portões, tags para voltar |
