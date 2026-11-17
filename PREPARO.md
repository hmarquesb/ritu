# Preparo: o que a dona fecha antes de `/construir-entrega`

> Lista da dona. Quanto mais fechado, menos os agentes decidem sozinhos.
> O que ficar sem resposta, os agentes resolvem pela opção mais conservadora e registram em `.plans/DECISOES-AUTONOMAS.md`.

## 1. Ler e confirmar

- [ ] Produto: `.docs/BUSINESS.md` (conversa livre, Minha casa, o que fez falta e "vale ter em casa", trocas, gostos, Como ficou?, memória em níveis).
- [ ] Agente e modelos: `.docs/AI.md` (seis provas de agência, caminhos por intenção, papéis de modelo).
- [ ] Fluxo: `.docs/RULES.md` (commit direto na `main`, quatro portões, evals só nos checkpoints).

## 2. Máquina

- [ ] Node 24 e npm.
- [ ] Docker em execução (Postgres e Grafana locais).
- [ ] `gh` autenticado na conta **hmarquesb**; `git config user.email` desta pasta apontando para ela.
- [ ] Claude Code com acesso a Opus, Sonnet e Haiku. Abrir a sessão do orquestrador em Opus.
- [ ] Conferir `.claude/settings.json` com `/permissions`, para os comandos da construção não pedirem aprovação.
- [ ] Conferir que `.local/REFERENCIAS.md` e `.claude/settings.local.json` existem nesta máquina (ficam fora do git).
- [ ] Abrir o Claude Code nesta pasta, mandar uma mensagem qualquer e conferir que a barra de status mostra `5h NN% · 7d NN% · ctx NN%` e que `.local/uso.json` foi gravado. É por ele que o orquestrador sabe quando parar e escrever a passagem (`RULES.md` §10).

## 3. Contas e chaves (tudo gratuito, sem cartão)

| Item | Para quê | Entrega | Variável em `.env.local` |
|---|---|---|---|
| [ ] Repositório no GitHub | Push e CI | 1 | — |
| [ ] Projeto de **desenvolvimento** no AI Studio + chave | Construção e evals | 1 | `GEMINI_API_KEY` |
| [ ] Segredos locais (`openssl rand -base64 32`) | Sessão, HMAC do IP, cron | 1 e 3 | `AUTH_SECRET`, `IP_HMAC_SECRET`, `CRON_SECRET` |
| [ ] Cliente OAuth do Google com `http://localhost:3000` | Login | 3 | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| [ ] Projeto de **produção** no AI Studio + chave | Produção | 4 | `GEMINI_API_KEY` na Vercel (`DEPLOY.md` §2) |
| [ ] Banco de produção (Neon Free, São Paulo) | Produção | 4 | `DATABASE_URL` na Vercel e `DATABASE_URL_DIRETA` no GitHub (`DEPLOY.md` §3) |
| [ ] Projeto na Vercel ligado ao repositório | Produção | 4 | Variáveis na Vercel e segredos do ambiente `producao` no GitHub (`DEPLOY.md` §4 e §7) |
| [ ] Grafana Cloud Free + token OTLP | Traces de produção | 4 | `OTEL_EXPORTER_OTLP_*` na Vercel; `GRAFANA_*` no `.env.local` (`DEPLOY.md` §6) |

- [ ] Conferir no AI Studio se as cotas de `AI.md` §10 continuam as mesmas. Mudou: atualizar a tabela de lá.

## 4. Conteúdo

- [ ] **Fontes da base** (`KNOWLEDGE.md` §7): ter em mãos os livros e as páginas, para conferir as linhas no portão 1.
- [ ] **Lista de alimentos** (`KNOWLEDGE.md` §5.1): revisar os 130 fixados na spec 002.
- [ ] **Preparos e práticas** (`KNOWLEDGE.md` §5.2 e §5.3): revisar no portão 1.
- [ ] **Perguntas do quiz** (`data/quiz.yaml`): revisar o texto no portão 1.
- [ ] **Grupos de "evitar sempre"** (`data/grupos_evitar.yaml`): conferir a lista de grupos e as palavras de cada um no portão 1.
- [ ] **Perfil de demonstração** (`seed/demo.yaml`): dosha, cidade, itens da casa (alguns já incertos), gostos, resultados, um alimento que já fez falta em 3 dias, um grupo em "evitar sempre" (ex.: castanhas), duas ou três notas de rotina, um padrão a confirmar, retornos pendentes e a mensagem sugerida.
- [ ] **Números** de `BUSINESS.md` §9 e §14 (validade por grupo, faltas para indicar um alimento, mensagens por dia): conferir se fazem sentido para você.

## 5. Design

- [ ] Mover as imagens de referência e o logo para `design/` e dizer, em `.docs/DESIGN.md` §5, qual arquivo é o quê.
- [ ] Fechar em `.docs/DESIGN.md` §2: cores com valor exato, fontes, tamanhos dos ícones, tom dos textos.
- [ ] Dizer onde cada imagem entra (ex.: `login-cover.jpeg` na Entrada).

## 6. Specs

- [ ] Escrever e aprovar as specs de cada entrega (`.specs/README.md`) com `create-spec` e `refine-spec`, antes de começar aquela entrega.
- [ ] Em cada spec: contratos por extenso e marcação do que é núcleo.

## 7. Começar

Depois do `git add .`, conferir com `git status` que `.local/` e `.claude/settings.local.json` não entraram.

```
git init -b main
git config user.email "<e-mail da conta hmarquesb>"
git add . && git status
git commit -m "docs: project documentation, specs, skills and agents"
gh repo create ritu --public --source . --push
claude --model opus
> /construir-entrega 1
```
