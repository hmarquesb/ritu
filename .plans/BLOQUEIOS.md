# Bloqueios

| Spec · Tarefa | O que bloqueia | O que depende | O que a dona precisa fazer |
|---|---|---|---|
| 006 · fechamento | ⚠️ `modelos:check` (2026-11-15): `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` e `gemini-3.6-flash` ok; `gemini-2.5-flash-lite`, `gemini-3-flash-preview` e `gemini-2.5-flash` deram `indisponivel` (o adaptador junta 4xx e 5xx nesse código: pode ser modelo fora de linha, ou o modelo recusar `responseJsonSchema`); `gemini-3.8-flash` deu `timeout` (15 s). Na 005, `gemini-3-flash-preview` respondeu pela Mastra e `gemini-2.5-flash` deu 4xx | Nada trava: o roteador pula o modelo que falha. Mas `reforco` começa em `gemini-3.8-flash`, e os papéis ficam com menos reserva | Conferir no AI Studio quais ids seguem no plano gratuito e se aceitam saída JSON com schema; atualizar `config/llm-cotas.ts` e `AI.md` §10 (commit numa linha) |
