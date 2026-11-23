# Deploy do Ritu

Roteiro para ligar as contas de produção, na ordem.

Nenhum valor real está aqui. Onde aparecer `<...>`, troque pelo seu valor. Nunca cole valor real no repositório.

Onde guardar cada valor:

- **Variável da Vercel:** Settings > Environment Variables do projeto, ambiente Production.
- **Segredo do GitHub:** Settings > Secrets and variables > Actions do repositório.
- **`.env.local`:** arquivo só da sua máquina. Ele fica fora do git. Nunca commite.

## 1. Antes

1. Rode `npm run base:check -- --producao`. Ele deve ficar verde.
2. Hoje a base tem linhas `a_confirmar`. Resolva-as com o Claude antes do primeiro deploy.
3. Enquanto houver linha `a_confirmar`, o job `deploy` para no primeiro passo.
4. Confira que o `gh` está logado na sua conta: `gh auth status`.

## 2. Gemini

1. No AI Studio, crie um projeto de produção, sem faturamento.
2. Gere a chave desse projeto.
3. Na Vercel, crie `GEMINI_API_KEY` com a chave, no ambiente Production.
4. Confira as cotas em `.docs/AI.md`, seção 10.

## 3. Neon

1. Crie o projeto `ritu` na região AWS São Paulo (sa-east-1), com Postgres 17.
2. Copie a URL **com** pooler. Na Vercel, crie `DATABASE_URL` com ela, no ambiente Production. Use `<url>` como marcador.
3. Copie a URL **sem** pooler. No GitHub, crie o segredo `DATABASE_URL_DIRETA` com ela.

## 4. Vercel

1. Importe o repositório do Ritu como projeto, no plano Hobby.
2. Dê ao projeto o nome `ritu`. Se ele estiver ocupado, use o primeiro nome livre.
3. Ajuste o Node para a versão 24.
4. Ligue o Fluid compute.
5. Confira a região `gru1`. Ela vem do `vercel.json`, não precisa escolher.
6. Crie as variáveis de produção, no ambiente Production: `DATABASE_URL`, `GEMINI_API_KEY`, `AUTH_SECRET`, `IP_HMAC_SECRET`, `CRON_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CONTATO_PRIVACIDADE` (o e-mail para pedidos sobre dados, mostrado na política de privacidade), `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`. As opcionais são `TESTER_IDS` e `OTEL_SERVICE_NAME`. Nunca crie `RITU_MODO`.
7. Gere `AUTH_SECRET`, `IP_HMAC_SECRET` e `CRON_SECRET` novos, um para cada, com `openssl rand -base64 32`. Eles devem ser diferentes dos de desenvolvimento.
8. Crie um token de conta na Vercel. No GitHub, crie o segredo `VERCEL_TOKEN` com ele.
9. Pegue o `orgId` e o `projectId` com `vercel link` ou nas configurações do projeto. No GitHub, crie os segredos `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.
10. Copie a URL de produção que a Vercel mostra no projeto. No GitHub, crie a variável `SITE_URL` com ela. No `.env.local`, crie `SITE_URL` com a mesma URL.
11. Depois do primeiro deploy, preencha `publico.siteUrl` em `config/publico.ts` com essa URL (`https://`, sem barra final). Ela vira o `metadataBase`, o `sitemap.xml` e o link "Experimente" do README. Em seguida, rode `npm run readme` e faça o commit dos dois READMEs.

## 5. Google

1. No cliente OAuth que já existe, adicione a origem `https://<url>`.
2. Adicione o callback `https://<url>/api/auth/callback/google`.
3. Publique a tela de consentimento. O status deve ficar "Em produção".

## 6. Grafana Cloud

1. Crie uma stack Free, na região mais próxima de você.
2. Copie o endpoint OTLP. Na Vercel, crie `OTEL_EXPORTER_OTLP_ENDPOINT` com ele.
3. Monte o cabeçalho `Authorization=Basic <token>`. Na Vercel, crie `OTEL_EXPORTER_OTLP_HEADERS` com ele.
4. Crie uma conta de serviço com papel Admin. Copie o token dela.
5. No `.env.local`, preencha `GRAFANA_URL` com a URL da sua stack, `GRAFANA_TOKEN` com o token da conta de serviço e `GRAFANA_ALERTA_EMAIL=<seu-email>`.
6. Rode `npm run painel:publicar`.

## 7. GitHub

1. Crie o ambiente `producao`. Nele, use a regra "só a `main`".
2. Crie os segredos `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DIRETA` e `CRON_SECRET`. O `CRON_SECRET` deve ser o mesmo da Vercel.
3. Crie a variável `SITE_URL`, se ainda não criou no passo 4.
4. Ligue os Dependabot alerts.

## 8. Conferir

1. Rode `npm run env:producao`. Corrija o que ele apontar.
2. Dispare o workflow: `gh workflow run CI --ref main`.
3. Acompanhe a execução com `gh run watch`. Espere a CI ficar verde.
4. Rode `npm run smoke:completo`.
5. No Grafana Cloud, procure um trace do Ritu.
6. No Grafana Cloud, clique em "Test" no ponto de contato. O e-mail deve chegar.

## 9. No dia a dia

1. Deploy é push na `main`.
2. Para voltar a uma versão anterior, rode `vercel rollback` ou use "Instant Rollback" no painel da Vercel.
3. Veja os crons em "Cron Jobs" do projeto na Vercel.
4. Migrações: só acrescente. Para renomear ou apagar coluna, faça em dois deploys.
5. Para trocar um segredo, atualize na Vercel e no GitHub. Depois refaça o deploy pelo `workflow_dispatch`.

## 10. Roteiro do portão 4

Os itens "No ar" da spec 022:

1. O primeiro deploy saiu pela CI, com a CI verde.
2. `npm run smoke:completo` passa.
3. Um trace aparece em até 5 minutos. `ritu_runs_total` aparece em até 15 minutos.
4. No dia seguinte, o cron de limpeza mostra `200` nos logs.
5. O Google funciona na URL final.
6. O "Test" do ponto de contato chega por e-mail.
