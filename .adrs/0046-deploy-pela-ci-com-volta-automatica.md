# ADR 0046: Deploy pela CI com volta automática

## Status

Aceito · 2026-11-17

## Contexto

Os agentes commitam direto na `main`, e ninguém acompanha cada push. O Ritu é projeto de uma pessoa só: a produção precisa se cuidar sozinha, e um commit com gate vermelho, ou uma base com fonte por confirmar, não pode chegar a quem abre o link. A Vercel faz deploy pelo Git por padrão, sem olhar os gates da CI.

## Decisão

1. O deploy pelo Git da Vercel fica desligado (`vercel.json`, `git.deploymentEnabled: false`). Quem decide quando sobe é a CI.
2. O job `deploy` roda só em `push` (ou `workflow_dispatch`) na `main`, com `needs: [gates, db]`, no ambiente `producao` do GitHub, com `concurrency: { group: producao, cancel-in-progress: false }`.
3. Ordem, e cada passo vermelho para os seguintes: `base:check -- --producao` → `env:producao` (só nomes das variáveis na Vercel) → `db:migrate` pela URL direta → `vercel deploy --prod --env RITU_VERSAO=<sha>` → `smoke`.
4. Se o smoke falha depois de um deploy bem-sucedido, `vercel rollback` volta ao deploy de produção anterior e o job termina vermelho.
5. O smoke da CI não chama modelo nem cria conta: confere versão no ar, saúde (banco, base, seed, migração), página com o aviso, headers e proteções. O caminho real com o Gemini é o `smoke:completo`, à mão.
6. `/api/saude` fica atrás do mesmo `CRON_SECRET` dos crons; cada chamada acorda o banco.
7. Toda migração precisa funcionar com o código que já está no ar: só acrescenta; renomear ou apagar coluna leva dois deploys. A volta automática depende disso.
8. O `vercel` CLI entra por `npx` com versão fixa no workflow, sem dependência no `package.json`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Deploy pelo Git da Vercel | Sobe sem olhar os gates; um commit quebrado iria ao ar |
| Ambientes de preview | Gastam cota e banco no plano gratuito, e não há revisão humana por PR |
| Smoke com LLM na CI | Cada push gastaria cota do Gemini e uma das demonstrações do dia |
| Volta à mão | Ninguém acompanha a CI; o site ficaria quebrado até alguém ver |

## Consequências

- Commit com gate vermelho ou base com `a_confirmar` nunca vai ao ar; enquanto houver linha `a_confirmar`, o job para no primeiro passo.
- A dona liga as contas e os segredos pelo `DEPLOY.md`; o primeiro deploy não tem anterior para onde voltar.
- Migração que quebra o código no ar é proibida, o que custa um deploy a mais em renomeações.
