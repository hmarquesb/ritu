# ADR 0047: Produção em São Paulo com Neon

## Status

Aceito · 2026-11-17

## Contexto

O Ritu precisa de um banco gratuito que não seja pausado por falta de uso e de funções perto de quem usa. Um run faz dezenas de consultas ao banco e poucas chamadas ao Gemini. A Vercel Hobby aceita um cron por dia por agendamento, com atraso de até 59 minutos. Em serverless, a instância pode congelar depois da resposta, e as métricas periódicas se perderiam.

## Decisão

1. Banco: Neon Free em `aws-sa-east-1`. Funções da Vercel em `gru1` (`vercel.json`).
2. `DATABASE_URL` na Vercel é a URL com pooler (`-pooler`); `opcoesDoPostgres` põe `prepare: false` nesse host, porque o pooler é em modo transação. As migrações usam a URL direta (segredo `DATABASE_URL_DIRETA` do GitHub).
3. Dois crons diários: limpeza `0 6 * * *` e padrões `0 8 * * *` (3h e 5h em São Paulo), as duas rotas com `autorizarCron` sobre o `CRON_SECRET`, que responde `503` quando o segredo falta.
4. Com telemetria ligada, as rotas com trabalho e os crons agendam `telemetry.encerrar()` em `after()`.
5. O catálogo de variáveis diz o uso de cada uma em produção (`obrigatoria`, `opcional`, `proibida`, `local`, `por_deploy`); `env:producao` confere os nomes na Vercel antes de migrar.
6. Grafana Cloud recebe o mesmo painel e as mesmas regras da 015 por `painel:publicar`, com `X-Disable-Provenance`, e as regras avisam por e-mail num ponto de contato cujo endereço fica fora do repositório.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Supabase Free | Pausa o projeto depois de 7 dias sem uso |
| Funções em `iad1` | Cada consulta atravessaria o continente; o banco e quem usa estão no Brasil |
| Prepared statements no pooler | O pooler do Neon em modo transação não os aceita |
| Sem descarga em `after()` | Métricas periódicas se perderiam quando a instância congela |

## Consequências

- O Neon dorme depois de 5 minutos parado e a primeira consulta leva centenas de ms a mais; 100 CU-h por mês cobrem o uso de um projeto de estudo.
- Sem backup próprio: só o histórico curto de restauração do Neon Free.
- A descarga em `after()` soma um pouco de CPU por pedido.
