# ADR 0015: Clima real pela cidade escolhida, sem GPS

## Status

Aceito · 2026-11-14

## Contexto

Um dia frio e úmido pede outra coisa que um dia quente e seco, então o clima entra na recomendação. Localização precisa do aparelho é dado sensível e desnecessário para isso.

## Decisão

1. O clima vem da Open-Meteo (gratuita, sem chave), pela cidade que a pessoa escolhe buscando pelo nome.
2. O produto guarda o nome da cidade e as coordenadas com duas casas decimais. Nunca usa GPS nem localização do aparelho.
3. O clima é consultado por tools (`clima.agora`, `clima.proximas_horas`), atrás das portas `WeatherSource` e `CityLookup`, e convertido em qualidades por faixas em `config/`.
4. Cache de 1 hora por cidade. Sem cidade ou com a API fora do ar, a tool devolve `sem_cidade` ou `indisponivel` e o agente segue sem clima, dizendo isso.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Geolocalização do navegador | Dado sensível, pede permissão, desnecessário |
| Estação do ano fixa | Não reflete o dia de verdade |
| API de clima paga | Fora da regra de planos gratuitos |

## Consequências

- O agente decide quando consultar o clima (prova de caminho decidido).
- Falha de clima não derruba o run.
- Uso da Open-Meteo é não comercial, o que cabe num projeto de estudo.
