---
title: Clima e cidades
status: approved
entrega: 1
created: 2026-11-14
---

# Clima e cidades

> Entrega o clima de agora e das próximas horas da cidade que a pessoa escolheu, já convertido em qualidades, a busca de cidade pelo nome e a hora local da cidade. Tudo atrás de portas, com fakes, e com as tools `clima.agora` e `clima.proximas_horas`.

## Contexto

Um dia frio e úmido pede outra coisa que um dia quente e seco (`BUSINESS.md` §1). O clima é uma das três entradas do cruzamento por qualidades, junto com o momento e o dosha. O Ritu nunca usa GPS: a pessoa busca a cidade pelo nome e o produto guarda o nome e as coordenadas com duas casas decimais. O clima também é a tool que mais mostra o caminho decidido pelo modelo: faz sentido numa mensagem de momento e é dispensável numa pergunta conceitual (`AI.md` §1).

## Objetivo

Depois desta spec, qualquer código do core pede o clima por `WeatherSource` e a busca de cidade por `CityLookup`, sem saber que é a Open-Meteo; as duas tools respondem `ok`, `sem_cidade` ou `indisponivel` sem nunca lançar erro para o agente; e os testes padrão não tocam a rede.

## Escopo

- **Dentro:**
  - Portas `WeatherSource` e `CityLookup`, adaptadores Open-Meteo, fakes.
  - Conversão do clima em faixas e qualidades; tendência das próximas 6 horas.
  - Cache de 1 hora por cidade.
  - Hora local a partir do fuso da cidade.
  - Tools `clima.agora` e `clima.proximas_horas`.
  - `config/clima.ts`.
  - Script opt-in ⚠️ `clima:real`, que chama a Open-Meteo de verdade.
- **Fora:**
  - Guardar a cidade no perfil (004) e a tela de busca (017 e 020).
  - Juntar as qualidades do clima às do momento: é `qualidadesDoMomento`, da 002, que recebe `gunasDoClima`.
  - Spans e métricas das tools (005 e 015).
  - Limite de chamadas da rota de busca de cidade (021).

## Necessidade de negócio

"Considerar o clima de verdade" é parte da promessa do produto. A pessoa precisa ver que o Ritu sabe como está o dia na cidade dela, e a resposta precisa sair mesmo quando o clima falha, dizendo que saiu sem ele.

## Critérios de aceite

- [ ] `climaEmQualidades`: temperatura aparente de 19,9 °C → `frio`; 20 e 27 → neutro; 27,1 → `quente`. Umidade de 49,9% → `seco`; 50 e 75 → neutro; 75,1 → `oleoso`.
- [ ] `tendenciaDasProximasHoras`: diferença de +3 °C ou mais entre agora e a sexta hora → `esquenta`; -3 °C ou menos → `esfria`; entre os dois → `estavel`. Alguma hora com probabilidade de chuva de 50% ou mais → `chuva: true`.
- [ ] `clima.agora` sem cidade no contexto devolve `{ status: "sem_cidade" }` e não chama a porta.
- [ ] Com a porta em modo "fora do ar", com timeout ou com resposta fora do schema, as duas tools devolvem `{ status: "indisponivel" }`.
- [ ] Duas chamadas para a mesma cidade em menos de 60 minutos fazem **um** pedido à porta de dentro; depois de 60 minutos (relógio fixo avançado), fazem outro. Falha não fica em cache.
- [ ] `clima.agora` e `clima.proximas_horas` para a mesma cidade, dentro da validade, compartilham o mesmo pedido.
- [ ] O adaptador da Open-Meteo valida a resposta com zod e arredonda latitude e longitude para duas casas antes de montar a URL (teste com `fetch` simulado confere a URL).
- [ ] `CityLookup.buscar("rio")` com `fetch` simulado devolve até 5 cidades com `nome`, `regiao`, `pais`, `lat`, `lon` (duas casas) e `fuso`; texto com menos de 2 caracteres devolve lista vazia sem chamar a rede; falha da rede lança `CityLookupUnavailableError`.
- [ ] `horaLocal(new Date("2026-01-15T15:30:00Z"), "America/Sao_Paulo")` devolve 12; fuso inválido cai no fuso padrão.
- [ ] `npm test` não abre conexão: os adaptadores são testados só com `fetch` injetado.
- [ ] ⚠️ `npm run clima:real -- "Rio de Janeiro"` imprime a cidade encontrada, o clima de agora em faixas e qualidades, e a tendência. Roda só à mão.

## O que fazer

- Escrever as funções puras e as tools com TDD sobre o fake.
- Injetar o `fetch` nos adaptadores (`createOpenMeteoWeather({ fetch })`), para testar sem rede.
- Conferir os nomes de parâmetros e campos da Open-Meteo na documentação oficial antes de escrever os adaptadores, e ajustar os schemas se algum nome tiver mudado. O contrato das portas não muda.
- Rodar `clima:real` uma vez, no fechamento da spec, e anotar o resultado no relatório da entrega.

## O que não fazer

- Não usar localização do aparelho, IP ou qualquer forma de adivinhar a cidade.
- Não mandar à Open-Meteo coordenada com mais de duas casas.
- Não lançar erro de clima para dentro do loop do agente: a tool sempre devolve um `status`.
- Não guardar o cache em banco.
- Não acrescentar vento, pressão, estação do ano ou qualquer medida que não esteja em `KNOWLEDGE.md` §4.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Umidade alta | Vira a qualidade `oleoso`; o nome mostrado é "úmido" | Vocabulário fechado da spec 002 |
| Um pedido só para agora e próximas horas | O adaptador busca `current` e `hourly` na mesma chamada | As duas tools dividem o cache; menos pedidos |
| Onde fica o cache | Em memória, por processo, num decorador da porta (`createCachedWeatherSource`) com `Clock` | Sem banco nesta spec; o volume do Ritu fica muito abaixo do limite da Open-Meteo mesmo sem cache compartilhado entre instâncias |
| Chave do cache | `lat,lon` com duas casas | É assim que a cidade fica guardada |
| Tendência | Compara a temperatura aparente de agora com a da sexta hora; limiar de 3 °C | Simples de explicar na resposta ("vai esfriar à tarde") |
| Chuva | Probabilidade de 50% ou mais em alguma das 6 horas | Idem |
| Busca de cidade | Qualquer país, nomes em português, até 5 resultados, mínimo de 2 caracteres | A pessoa pode morar fora do Brasil |
| Fuso | Vem da busca de cidade e fica guardado com ela (`cidade_fuso`, na 004); sem cidade, `America/Sao_Paulo` | O momento do dia (002) depende da hora local, com ou sem clima |
| Hora local | `Intl.DateTimeFormat` com o fuso, no core | Sem biblioteca de datas |
| Timeout | 4 s por pedido, sem nova tentativa | A resposta não pode esperar o clima; o agente segue sem ele e diz isso |
| Script com rede | `clima:real`, marcado com ⚠️, fora de todos os gates | `DEVELOPMENT.md`: serviço real é opt-in |

## Contratos

### Cria

**Configuração (`config/clima.ts`, incluída em `config/index.ts`)**

```ts
export const clima = {
  temperaturaAparente: { frioAbaixoDe: 20, quenteAcimaDe: 27 },   // °C
  umidade: { secoAbaixoDe: 50, umidoAcimaDe: 75 },                // %
  tendencia: { horas: 6, variacaoMinima: 3 },                     // °C
  chuva: { probabilidadeMinima: 50 },                             // %
  cacheMinutos: 60,
  timeoutMs: 4000,
  fusoPadrao: "America/Sao_Paulo",
  busca: { minimoCaracteres: 2, maximoResultados: 5, idioma: "pt" },
} as const
```

**Tipos e portas (`src/core/weather/ports.ts`)**

```ts
export type Coordenadas = { lat: number; lon: number }                  // duas casas decimais
export type Cidade = { nome: string; regiao?: string; pais: string; lat: number; lon: number; fuso: string }
export type CidadeDaPessoa = { nome: string; lat: number; lon: number; fuso: string }

export type PrevisaoHora = { hora: string; temperatura_aparente: number; prob_chuva: number }   // hora em ISO
export type Clima = {
  temperatura_aparente: number      // °C
  umidade: number                   // %
  observado_em: string              // ISO
  proximas_horas: PrevisaoHora[]    // 6 horas a partir da próxima
}

export interface WeatherSource {
  buscar(c: Coordenadas): Promise<Clima>          // lança WeatherUnavailableError
}
export interface CityLookup {
  buscar(nome: string): Promise<Cidade[]>         // lança CityLookupUnavailableError
}
export class WeatherUnavailableError extends RituError {}      // code: "clima_indisponivel"
export class CityLookupUnavailableError extends RituError {}   // code: "cidades_indisponivel"
```

**Funções puras (`src/core/weather/`)**

```ts
// qualidades.ts
type FaixaTemperatura = "frio" | "neutro" | "quente"
type FaixaUmidade = "seco" | "neutro" | "umido"
function climaEmQualidades(c: Pick<Clima, "temperatura_aparente" | "umidade">): { faixa_temperatura: FaixaTemperatura; faixa_umidade: FaixaUmidade; gunas: Guna[] }
// gunas: frio → ["frio"], quente → ["quente"], seco → ["seco"], umido → ["oleoso"]; neutro não acrescenta

// tendencia.ts
type Tendencia = { temperatura: "esquenta" | "esfria" | "estavel"; chuva: boolean; ate: string }
function tendenciaDasProximasHoras(c: Clima): Tendencia

// hora-local.ts
function horaLocal(agora: Date, fuso: string): number          // 0 a 23; fuso inválido usa clima.fusoPadrao

// cache.ts
function createCachedWeatherSource(dentro: WeatherSource, clock: Clock): WeatherSource
```

**Adaptadores (`src/infra/open-meteo/`)**

- `weather.ts`: `createOpenMeteoWeather(deps?: { fetch?: typeof fetch }): WeatherSource`. `GET https://api.open-meteo.com/v1/forecast` com `latitude`, `longitude`, `current=apparent_temperature,relative_humidity_2m`, `hourly=apparent_temperature,precipitation_probability`, `forecast_hours=7`, `timezone=auto`. Lê `current.apparent_temperature`, `current.relative_humidity_2m`, `current.time`, `hourly.time[]`, `hourly.apparent_temperature[]` e `hourly.precipitation_probability[]`; descarta a hora atual e fica com as 6 seguintes. Probabilidade nula conta como 0.
- `cities.ts`: `createOpenMeteoCities(deps?: { fetch?: typeof fetch }): CityLookup`. `GET https://geocoding-api.open-meteo.com/v1/search` com `name`, `count=5`, `language=pt`, `format=json`. Lê de cada item de `results[]`: `name` → `nome`, `admin1` → `regiao`, `country` → `pais`, `latitude`, `longitude`, `timezone` → `fuso`. Sem `results` → lista vazia.
- Os dois: `AbortSignal.timeout(clima.timeoutMs)`; status diferente de 200, erro de rede, timeout ou resposta fora do schema zod → erro tipado da porta.

**Fakes (`src/infra/fakes/`)**

- `fake-weather.ts`: `createFakeWeather(inicial?: Partial<Clima>): WeatherSource & { set(c: Partial<Clima>): void; foraDoAr(sim: boolean): void; chamadas: number }`. Padrão: 24 °C, 60%, estável, sem chuva.
- `fake-cities.ts`: `createFakeCities(): CityLookup & { foraDoAr(sim: boolean): void }`, com Rio de Janeiro, São Paulo, Belo Horizonte, Porto Alegre, Recife e Lisboa.

**Container**: `Container` ganha `weather: WeatherSource` (Open-Meteo dentro de `createCachedWeatherSource`) e `cities: CityLookup`.

**`ToolContext` (da 002) ganha:**

```ts
clima: { fonte: WeatherSource; cidade?: CidadeDaPessoa }
```

**Tools (`src/core/agents/tools/clima.ts`)**, as duas com entrada `{}`:

| Tool | Saída |
|---|---|
| `clima.agora` | `{ status: "ok"; cidade: string; temperatura_aparente: number; umidade: number; faixa_temperatura; faixa_umidade; gunas: Guna[]; observado_em: string }` ou `{ status: "sem_cidade" }` ou `{ status: "indisponivel" }` |
| `clima.proximas_horas` | `{ status: "ok"; cidade: string; temperatura: "esquenta" \| "esfria" \| "estavel"; chuva: boolean; ate: string }` ou `{ status: "sem_cidade" }` ou `{ status: "indisponivel" }` |

- Números arredondados: temperatura com uma casa, umidade inteira.
- Exporta `climaTools: Tool<unknown, unknown>[]`.
- `description` de cada uma é o "quando faz sentido chamar" de `AI.md` §4.

**Script**: `clima:real` = `tsx scripts/clima-real.ts "<cidade>"`. ⚠️ Chama a rede. Fora dos gates e da CI.

### Usa

- Spec 001: `RituError`, `Clock`, container, `config/index.ts`.
- Spec 002: tipo `Guna`, tipo `Tool`, `ToolContext`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/clima/`:

- `faixas.eval.ts`: todas as bordas das faixas de temperatura e de umidade, e as quatro combinações de qualidades (frio e seco, frio e úmido, quente e seco, quente e úmido).
- `tools-clima.eval.ts`: `ok`, `sem_cidade` e `indisponivel` para as duas tools; a saída `ok` de `clima.agora` traz as mesmas `gunas` de `climaEmQualidades`.
- `cache.eval.ts`: um pedido por cidade dentro de 60 minutos; cidades diferentes não dividem cache.

Com LLM: nenhum caso novo. A família Trajetória (checkpoint `c1-base`) mede se `clima.agora` foi chamada quando devia.

## Nível das partes

Tudo mecânica.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `DATA-SOURCES.md` §1: regras de uso da Open-Meteo.
- `AI.md` §4, só as duas linhas de `clima.*`: texto das descrições.

## Dependências

- Specs 001 e 002.
- Open-Meteo (previsão e geocodificação), sem chave. Só o script ⚠️ a chama.
- Nenhuma biblioteca nova.

## Riscos e trade-offs

- **Cache por processo:** na Vercel, duas instâncias podem buscar a mesma cidade na mesma hora. Aceito: o custo é um pedido a mais a uma API gratuita.
- **Sem nova tentativa:** uma falha passageira da Open-Meteo vira resposta sem clima. A resposta diz isso e a pessoa pode mandar de novo.
- **Limiar fixo de 3 °C:** em cidades de clima muito estável a tendência quase sempre é `estavel`. É o comportamento desejado: só comentar quando muda.
- **Nomes de campo da Open-Meteo escritos nesta spec:** se a API tiver mudado, o schema zod falha no `clima:real` e o adaptador é ajustado, sem mexer nas portas.
- **Umidade acima de 75% é comum no Rio:** a qualidade `oleoso` vai aparecer com frequência no clima. É coerente com a tabela de `KNOWLEDGE.md` §4; os números ficam em `config/clima.ts` para ajuste.

## Edge cases e modos de falha

- Resposta com menos de 6 horas de previsão: a tendência usa a última hora disponível; sem nenhuma, `estavel` e `chuva: false`.
- Temperatura exatamente em 20 ou 27 e umidade exatamente em 50 ou 75: neutro.
- Cidade com nome repetido em estados ou países diferentes: a busca devolve todas, com `regiao` e `pais`, e quem escolhe é a pessoa.
- Busca sem resultado: lista vazia, sem erro.
- Texto de busca com espaços nas pontas ou acentos: enviado sem os espaços, com a codificação de URL.
- Relógio do servidor em UTC: `horaLocal` sempre usa o fuso da cidade, nunca o do servidor.
- Falha logo depois de um sucesso em cache: o cache válido continua sendo usado.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes.
- `clima:real` rodado uma vez, com o resultado no relatório da entrega.
- `AGENTS.md` com o comando ⚠️ `clima:real`.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `config/clima.ts`, `config/index.ts`
- `src/core/weather/`: `ports.ts`, `qualidades.ts`, `tendencia.ts`, `hora-local.ts`, `cache.ts` e os testes
- `src/core/agents/tools/clima.ts`, `src/core/agents/tools/tool.ts` (campo `clima` no contexto)
- `src/infra/open-meteo/weather.ts`, `src/infra/open-meteo/cities.ts` e os testes
- `src/infra/fakes/fake-weather.ts`, `src/infra/fakes/fake-cities.ts`
- `src/infra/container.ts`
- `scripts/clima-real.ts`, `package.json`
- `evals/det/clima/*.eval.ts`
- `AGENTS.md`
