# Fontes de dados externas

## 1. Open-Meteo: clima e cidades

- API gratuita, sem chave, uso não comercial.
- **Geocodificação:** a pessoa busca a cidade pelo nome (no Aviso inicial ou no Perfil). O produto guarda o nome escolhido e as coordenadas com duas casas decimais. Nunca usa GPS nem localização do aparelho. Atrás da porta `CityLookup`.
- **Previsão:** acessada só pelas tools `clima.agora` e `clima.proximas_horas` (`AI.md` §4), atrás da porta `WeatherSource`.
- `clima.agora`: temperatura aparente e umidade relativa atuais, convertidas em qualidades pelas faixas de `KNOWLEDGE.md` §4.
- `clima.proximas_horas`: tendência das próximas 6 h (esquenta, esfria, estável; chuva sim ou não).
- Um pedido só traz o clima de agora e as próximas horas. Resposta validada com zod. Timeout de 4 s, sem nova tentativa.
- Cache de 1 hora por cidade (chave: coordenadas com duas casas), em memória, por processo. Falha não entra no cache.
- A busca de cidade aceita qualquer país, com nomes em português, a partir de 2 caracteres e até 5 resultados. A cidade traz o fuso, que define a hora local; sem cidade, vale `America/Sao_Paulo`.
- Sem cidade: a tool devolve `sem_cidade`, o agente responde sem clima e diz isso.
- Falhou (timeout, erro ou resposta fora do schema): a tool devolve `indisponivel`, o agente segue sem clima e diz isso. A falha vira etapa do rastro e conta na métrica de tools.

## 2. Google (login)

- OAuth pelo Auth.js. O produto guarda só o `sub` e o e-mail, que serve só para entrar.
- Cliente OAuth criado no Google Cloud, sem faturamento, com as URLs de `localhost` e de produção.

## 3. Gemini

- Chat com chamada de função. O Acompanhante usa o provider da Mastra; Intérprete, Juiz e Memória usam o cliente próprio (`LlmClient`). Todos pedem o modelo ao `ModelRouter`.
- Vários modelos, divididos por papel, com as cotas e a ordem de troca de `AI.md` §10.
- A cota é contada por projeto e por modelo. O dia da cota vira à meia-noite do horário do Pacífico.
- Um projeto e uma chave por ambiente: desenvolvimento (onde rodam os evals) e produção.
- Plano gratuito: o provedor pode usar as mensagens para melhorar os produtos dele. O Aviso inicial e a tela Sobre avisam.
