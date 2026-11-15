# ADR 0018: Observabilidade em três camadas

## Status

Aceito · 2026-11-14

## Contexto

É preciso saber, a qualquer momento, o que o agente fez, quanto gastou e se foi bom. Essas três perguntas têm públicos diferentes: a pessoa quer entender por que recebeu uma sugestão; a equipe quer achar lentidão e falhas; quem avalia quer ver a qualidade evoluir.

## Decisão

1. Camada 1, rastro do agente: cada passo do run vira uma etapa no Postgres (`runs`, `run_etapas`). A pessoa vê na tela Como pensei. Funciona com o Grafana fora do ar.
2. Camada 2, telemetria técnica: traces, métricas e logs por OpenTelemetry, atrás da porta `Telemetry`, para o Grafana LGTM (Docker no dev, Grafana Cloud em produção). Nunca leva texto da pessoa, prompt nem saída do agente.
3. Camada 3, qualidade contínua: evals por checkpoint, com relatórios versionados, mais sinais reais (👍/👎, retornos, trocas), na CI, no README e na página pública Bastidores.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só OpenTelemetry | A pessoa não veria o rastro; dependeria do Grafana no ar |
| Plataforma de observabilidade de LLM paga | Fora da regra de planos gratuitos; texto da pessoa sairia do sistema |
| Só logs | Sem árvore de spans nem métricas agregadas |

## Consequências

- O rastro é gravado por código, com resumos curtos sem dado sensível.
- Um teste de privacidade confere que nenhum span ou métrica leva texto da pessoa.
- Telemetria desligada quando não há endpoint configurado.
