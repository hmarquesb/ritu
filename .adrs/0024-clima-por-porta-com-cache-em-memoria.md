# ADR 0024: Clima por porta, com cache em memória e sem nova tentativa

## Status

Aceito · 2026-11-15

## Contexto

O agente usa o clima da cidade da pessoa para escolher qualidades (frio, quente, seco, úmido) e para dizer o que vem nas próximas horas. A fonte é a Open-Meteo, gratuita e sem chave. A resposta à pessoa não pode esperar nem quebrar por causa do clima, e os testes padrão não podem tocar a rede.

## Decisão

1. O core pede o clima por `WeatherSource` e a cidade por `CityLookup` (`src/core/weather/ports.ts`). Os adaptadores da Open-Meteo ficam em `src/infra/open-meteo/`, com `fetch` injetado.
2. Um pedido só traz `current` e `hourly`: as tools `clima.agora` e `clima.proximas_horas` usam a mesma resposta.
3. O cache é um decorador da porta (`createCachedWeatherSource`). Ele guarda em memória, por processo, por `cacheMinutos` (60), com a chave `lat,lon` em duas casas. O tempo vem do `Clock`. Uma falha não entra no cache, e pedidos simultâneos para a mesma chave dividem uma única promessa.
4. Timeout de 4 s, sem nova tentativa. Qualquer erro da porta vira `{ status: "indisponivel" }` na tool, que nunca lança erro para o agente.
5. `definirTool` aceita `executar` síncrono ou assíncrono, para que as tools de porta reusem a mesma validação de entrada e saída.
6. A hora local é calculada no core com `Intl.DateTimeFormat` e o fuso da cidade. Fuso inválido ou cidade ausente usam `America/Sao_Paulo`.
7. A rede real só roda no script ⚠️ `clima:real`, fora de todos os gates.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Cache no Postgres, compartilhado entre instâncias | Exige banco nesta spec; o volume do Ritu fica muito abaixo do limite da Open-Meteo |
| Nova tentativa com backoff | Atrasa a resposta; o agente segue sem clima e diz isso |
| Biblioteca de datas para o fuso | `Intl` resolve sem dependência nova |
| Localização do aparelho ou por IP | Proibido pela regra de privacidade: só a cidade que a pessoa escolhe |

## Consequências

- O core e as tools são testados com `createFakeWeather` e `createFakeCities`, sem rede.
- Cada instância serverless tem o próprio cache. Na partida a frio, o primeiro pedido de cada cidade vai à Open-Meteo.
- Trocar de fonte de clima é escrever outro adaptador da mesma porta.
