# Roadmap

> Construção por agentes, em quatro entregas com portão humano (`RULES.md`). Ao fim da quarta, o produto está completo.

## 0. Estado atual (atualizar a cada sessão)

Entrega 1 (001 a 007) aprovada no portão 1, com a tag `entrega-1`. Entrega 2 (008 a 015) aprovada com correções no portão 2 (2026-11-17), com a tag `entrega-2`; as correções estão na `main` (`.plans/portao-2-correcoes-plan.md`). Base com 127 alimentos, nenhuma linha `a_confirmar`. Entrega 3 (016 a 020) na `main`, com a `entrega-3` juntada em 2026-11-22 (`e1891a9`) e a tag `entrega-3`, parada no portão 3: relatório e roteiro em `.plans/entrega-3-relatorio.md`, screenshots em `docs/screenshots/entrega-3/`. Entrega 4: 021 e 022 implementadas e produção no ar (migrações `0005` e `0006` aplicadas em 2026-11-22; a 020 está em produção); 023 e 024 aprovadas. Spec 025 (chás híbridos) implementada. Rodada `c3-confiavel` de 2026-11-22 completa (86/86), com 17 metas abaixo; `c3-s23` e `c3-s24` falharam (resposta `segura` depois de recusas do validador). Análise do portão 3: cerca de 16 das 29 falhas foram de infraestrutura (banco, cota, Juiz sem cota); o resto vem do `finalizar`, que pede ao modelo campos que o código já calculou (válida na 1ª tentativa em 15% desde o `c1`). Spec 026 implementada para isso (ADR 0052): `finalizar` recebe só a escolha do agente, `acompanhante.v8`, até três chaves do Gemini nos evals e casos inconclusivos fora das métricas.

Portão 3 aprovado com correções em 2026-11-22, com a conferência do roteiro adiada para depois da entrega 4 (`.plans/entrega-3-relatorio.md`). Rodada `c3-confiavel` com o `acompanhante.v8` retomada: 85/86, 1 inconclusivo, 13 metas abaixo (só avisam).

Entrega 4 (021 a 027) na `main`, com a tag `entrega-4`, parada no portão 4: relatório e roteiro em `.plans/entrega-4-relatorio.md`. Rodada `c5-publico` de 2026-11-23 completa (86/86, pelas rotas do site), com uma falha crítica (alerta perdido em `c3-s19`) e metas abaixo (só avisam). O deploy para em `env:producao` até a dona cadastrar `CONTATO_PRIVACIDADE`.

**Próximos passos, na ordem:**
1. A dona confere os roteiros do portão 3 e do portão 4 e decide o portão 4.
2. Rodada de correções: problemas dos dois portões, o alerta perdido da `c5-publico` e as metas abaixo.

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
