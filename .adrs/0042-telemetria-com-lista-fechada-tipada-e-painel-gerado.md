# ADR 0042: Telemetria com lista fechada tipada e painel gerado

## Status

Aceito · 2026-11-16

## Contexto

A telemetria nasceu com uma lista de nomes de spans e métricas em texto, um fake que guardava qualquer rótulo e um painel do Grafana montado à mão. Isso deixava passar três tipos de erro sem teste: rótulo novo que ninguém declarou (e que pode carregar dado da pessoa ou estourar a cardinalidade), métrica emitida que o painel não mostra, e painel que diverge do código depois de uma mudança. Os logs não levavam o `run.id`, então não dava para ir de um log ao rastro do run. E o `demo` e o `eval:llm` rodam pelos cenários, que criam a própria telemetria em memória: ligar o OTel no script não exportava nada do run.

## Decisão

1. `src/core/telemetry/nomes.ts` é a lista fechada: `SPANS` com os atributos obrigatórios de cada span, `METRICAS` com tipo (contador, histograma, medidor) e rótulos, `LOGS` com o nível de cada código. A porta `Telemetry` é tipada por esses registros: um histograma não aceita nome de contador, e `log(codigo, campos)` não recebe o nível.
2. O fake em memória recusa rótulo fora do declarado (`rotulos_invalidos`). Um eval de cobertura roda todos os cenários e confere que todo span, toda métrica e os logs da lista saem pelo menos uma vez, com os atributos obrigatórios.
3. O `run.id` e o `trace_id` entram nos logs pelo contexto do span `run`, sem que quem loga precise passá-los.
4. A duração é medida pelo `Clock` por trecho do run, pela chamada de modelo e pela chamada de tool; os passos saem uma vez, no encerramento.
5. O painel e as regras de alerta são definidos em TypeScript (`scripts/lib/painel.ts`), gerados por `npm run painel:gerar` e travados por teste: o gerado tem de bater com a definição, e toda métrica de `METRICAS` tem de aparecer no painel. `npm run painel:check` confere um Grafana no ar.
6. Os alertas não notificam: ficam no Grafana, sem política nem ponto de contato. A imagem do LGTM é fixada por tag exata e provisiona o painel e as regras ao subir.
7. `montarCenario` aceita uma telemetria extra e espelha nela tudo o que a memória recebe (`createTeeTelemetry`). É assim que o `demo`, o `eval:llm` e o teste de privacidade pelo adaptador OTel real enxergam os runs dos cenários.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Nomes livres, conferidos só por revisão | Um rótulo com texto da pessoa passa sem ninguém ver; a privacidade fica dependendo de atenção |
| Painel montado na interface do Grafana e exportado | Diverge do código na primeira mudança, e nada avisa |
| Passar `run.id` em cada chamada de log | Esquecer é fácil, e o log sem `run.id` não leva ao rastro |
| Alertas com notificação por e-mail | Projeto de estudo, sem plantão; a notificação pediria contato e conta a mais |
| Ligar o OTel só no container, sem espelho | Os cenários usam telemetria própria; o `demo` e o `eval:llm` não exportariam nada |

## Consequências

- Métrica, span ou log novo exige entrada em `nomes.ts`, e o fake e o eval de cobertura acusam o que faltar.
- Mudar o painel é mudar `scripts/lib/painel.ts` e rodar `npm run painel:gerar`; o JSON gerado não se edita à mão.
- Nos cenários o relógio é fixo, então as durações saem 0 no `demo` e no `eval:llm`: o painel depois de uma rodada de eval mostra contagens e tokens, não latência.
- O eval de cobertura roda todos os cenários e é o mais lento da suíte determinística.
