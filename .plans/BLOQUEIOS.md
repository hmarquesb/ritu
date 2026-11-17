# Bloqueios

| Spec · Tarefa | O que bloqueia | O que depende | O que a dona precisa fazer |
|---|---|---|---|

## 021 · onda 7 · gate vermelho sem dono (2026-11-17)
- `npm test`: dois testes de pergunta de casa falham por depender da hora (ver T19 no plano da 021). Nenhuma tarefa da onda 7 foi commitada; T17 e T18 revertidas, com o trabalho guardado fora do git para a próxima sessão.

## 022 · contas da dona (2026-11-17)

| Spec · Tarefa | O que bloqueia | O que depende | O que a dona precisa fazer |
|---|---|---|---|
| 022 · base | 49 linhas `a_confirmar` (44 em `alimentos.yaml`, 5 em `praticas.yaml`) | O job `deploy` para no passo "Base sem a_confirmar" (`base:check -- --producao`) | Segunda rodada da base com o Claude, antes do primeiro deploy |
| 022 · primeiro deploy | Contas Vercel, Neon, Gemini de produção, Google (URL final), Grafana Cloud e o ambiente `producao` do GitHub | Primeiro deploy pela CI e os critérios "No ar" do portão 4 | Seguir o `DEPLOY.md` do começo ao fim |
| 022 · `painel:publicar` | `GRAFANA_URL`, `GRAFANA_TOKEN`, `GRAFANA_ALERTA_EMAIL` no `.env.local` | Painel, regras e alertas por e-mail no Grafana Cloud; conferir na primeira rodada o formato do intervalo do grupo de regras e se o painel aparece como "sem mudança" na segunda | `DEPLOY.md` §6 |
| 022 · `smoke:completo` | `SITE_URL` e a produção no ar | A prova do caminho real com o Gemini de produção | `DEPLOY.md` §8 |
| 022 · `vercel` CLI | Não foi possível rodar o CLI nesta sessão | Flags do deploy e da volta (decisão 022 A3) conferidas só pela documentação | Ver o primeiro job `deploy`; se uma flag falhar, ajustar os dois passos do `ci.yml` |
