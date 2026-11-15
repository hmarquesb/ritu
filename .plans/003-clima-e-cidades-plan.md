# Plano · Spec 003 · Clima e cidades

Spec: `.specs/003-clima-e-cidades.md`. Tudo `mecanica`. `AGENTS.md` (comando ⚠️ `clima:real`) e a rodada única do `clima:real` são do orquestrador, no fechamento.

## Regras comuns a todas as tarefas

- Código e identificadores em inglês **exceto** os nomes de campos, tipos e funções do contrato, que ficam exatamente como escritos aqui (em português).
- `src/core/` só importa `src/core/`, `@config/*` e `zod`. Nada de `new Date()` sem argumento nem `Date.now()` no core (o tempo vem do `Clock`).
- Testes sem rede: os adaptadores recebem `fetch` injetado; nenhum teste chama a Open-Meteo de verdade. Relógio sempre `createFixedClock` (`@/infra/fakes/fixed-clock`).
- Nunca usar localização do aparelho, IP ou adivinhar cidade. Nunca mandar coordenada com mais de duas casas.
- Não lançar erro de clima para dentro das tools: a tool sempre devolve um `status`.
- Não ler `.env.local`. Não abrir pastas fora do repositório. Arquivos temporários só no scratchpad, nunca em `/tmp`.
- Complexidade cognitiva ≤ 15 por função. DRY: reutilize o que existe (`RituError` em `@/core/errors`, `Clock` em `@/core/clock`, `Guna` em `@/core/knowledge/vocab`, `Tool`/`ToolContext` em `@/core/agents/tools/tool`, `definirTool` se existir lá).
- Biome: `./node_modules/.bin/biome check --write <seus arquivos>` antes do lint. Se o filtro de saída do `npm run lint` falhar ("JSON parse failed" ou vazio), confira com `rtk bypass npm run lint`.
- Não commitar.

## Contratos comuns (copiados da spec)

**Configuração (`config/clima.ts`, incluída em `config/index.ts` como `clima`)**

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

---

### T1 · Add weather config, ports and pure weather functions
- nivel: mecanica
- objetivo: criar `config/clima.ts`, as portas e erros do clima, e as funções puras `climaEmQualidades`, `tendenciaDasProximasHoras` e `horaLocal`.
- arquivos: `config/clima.ts`, `config/index.ts`, `config/index.test.ts`, `src/core/weather/ports.ts`, `src/core/weather/qualidades.ts`, `src/core/weather/qualidades.test.ts`, `src/core/weather/tendencia.ts`, `src/core/weather/tendencia.test.ts`, `src/core/weather/hora-local.ts`, `src/core/weather/hora-local.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (config, ports, `qualidades.ts`, `tendencia.ts`, `hora-local.ts`). Regras:
  - `climaEmQualidades`: temperatura `< frioAbaixoDe` → `frio`; `> quenteAcimaDe` → `quente`; senão `neutro` (20 e 27 são neutros). Umidade `< secoAbaixoDe` → `seco`; `> umidoAcimaDe` → `umido`; senão `neutro`. `gunas` na ordem temperatura, umidade.
  - `tendenciaDasProximasHoras`: compara `temperatura_aparente` de agora com a da hora de índice `tendencia.horas - 1` (sexta hora) de `proximas_horas`; com menos horas, usa a última disponível; sem nenhuma, `estavel`, `chuva: false` e `ate = observado_em`. Diferença `>= +variacaoMinima` → `esquenta`; `<= -variacaoMinima` → `esfria`; senão `estavel`. `chuva` = alguma das horas consideradas (até `tendencia.horas`) com `prob_chuva >= chuva.probabilidadeMinima`. `ate` = `hora` da última hora considerada.
  - `horaLocal`: `Intl.DateTimeFormat("en-US", { timeZone: fuso, hour: "numeric", hourCycle: "h23" })` (ou equivalente que devolva 0–23); fuso inválido (o construtor lança `RangeError`) → usa `config.clima.fusoPadrao`.
  - Erros: `WeatherUnavailableError` com `code "clima_indisponivel"`, `CityLookupUnavailableError` com `code "cidades_indisponivel"` (`RituError(code, message)`; mensagem livre em português).
- testes primeiro:
  - temperatura 19.9 → `frio`; 20 e 27 → `neutro`; 27.1 → `quente`. Umidade 49.9 → `seco`; 50 e 75 → `neutro`; 75.1 → `umido` com guna `oleoso`. As 4 combinações (frio+seco, frio+úmido, quente+seco, quente+úmido) dão as gunas esperadas.
  - tendência: +3 → `esquenta`; -3 → `esfria`; +2.9 → `estavel`; uma hora com 50% → `chuva: true`; 49% → `false`; só 3 horas → usa a terceira; nenhuma hora → `estavel`, sem chuva.
  - `horaLocal(new Date("2026-01-15T15:30:00Z"), "America/Sao_Paulo") === 12`; `"Europe/Lisbon"` → 15; `"Nada/Inexistente"` → 12 (fuso padrão); 0h de madrugada devolve 0, não 24.
  - `config.clima.cacheMinutos === 60`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam.
- fora: cache, fakes, adaptadores, tools.

### T2 · Add the weather cache decorator and the fakes
- nivel: mecanica
- objetivo: criar o decorador de cache em memória da porta de clima e os fakes de clima e de cidades.
- arquivos: `src/core/weather/cache.ts`, `src/core/weather/cache.test.ts`, `src/infra/fakes/fake-weather.ts`, `src/infra/fakes/fake-cities.ts`, `src/infra/fakes/fake-weather.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (ports e `cache.ts`), mais:
  - `createCachedWeatherSource(dentro, clock)`: chave `"<lat>,<lon>"` com duas casas (`toFixed(2)`); guarda `{ clima, em: clock.now() }`; dentro de `config.clima.cacheMinutos` devolve o guardado sem chamar `dentro`; depois, chama de novo. Falha (`dentro` lança) não fica em cache e é repassada. Falha logo depois de um sucesso em cache válido: o cache válido continua sendo usado (não chama `dentro`). Duas chamadas simultâneas para a mesma chave antes da primeira resolver compartilham a mesma promessa (um pedido só). Cache em memória, por instância do decorador.
  - `src/infra/fakes/fake-weather.ts`: `createFakeWeather(inicial?: Partial<Clima>): WeatherSource & { set(c: Partial<Clima>): void; foraDoAr(sim: boolean): void; chamadas: number }`. Padrão: `temperatura_aparente: 24`, `umidade: 60`, `observado_em: "2026-01-15T12:00:00-03:00"`, 6 horas em `proximas_horas` com 24 °C e `prob_chuva: 0` (estável, sem chuva). `foraDoAr(true)` faz `buscar` lançar `WeatherUnavailableError`. `chamadas` conta as chamadas a `buscar`.
  - `src/infra/fakes/fake-cities.ts`: `createFakeCities(): CityLookup & { foraDoAr(sim: boolean): void }`, com Rio de Janeiro (RJ, Brasil, -22.91, -43.17, America/Sao_Paulo), São Paulo, Belo Horizonte, Porto Alegre, Recife e Lisboa (Portugal, Europe/Lisbon); `buscar` filtra por `normalizar` do nome contendo o texto normalizado (minúsculas, sem acento), até 5, e texto com menos de 2 caracteres → `[]`; `foraDoAr(true)` → lança `CityLookupUnavailableError`.
- testes primeiro (com `createFixedClock("2026-01-15T12:00:00Z")`):
  - duas chamadas para a mesma cidade em menos de 60 min → `fake.chamadas === 1`; `clock.advance(60 * 60_000 + 1)` → nova chamada (2);
  - cidades diferentes não dividem cache;
  - coordenadas `-22.9068, -43.1729` e `-22.91, -43.17` usam a mesma chave;
  - falha não fica em cache (fora do ar → lança; volta → chama de novo);
  - falha depois de sucesso em cache válido → devolve o cache;
  - duas chamadas simultâneas → uma chamada à porta;
  - fake de cidades: `buscar("rio")` acha Rio de Janeiro; `buscar("r")` → `[]`; `buscar("são")` e `buscar("sao")` acham São Paulo; fora do ar → lança.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam.
- fora: adaptadores, tools, container.

### T3 · Add the Open-Meteo weather and geocoding adapters
- nivel: mecanica
- objetivo: criar os adaptadores Open-Meteo de previsão e de busca de cidade, com `fetch` injetado, timeout e validação zod.
- arquivos: `src/infra/open-meteo/weather.ts`, `src/infra/open-meteo/weather.test.ts`, `src/infra/open-meteo/cities.ts`, `src/infra/open-meteo/cities.test.ts`
- leitura: `.docs/DATA-SOURCES.md` §1
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `weather.ts`: `createOpenMeteoWeather(deps?: { fetch?: typeof fetch }): WeatherSource`. `GET https://api.open-meteo.com/v1/forecast` com `latitude`, `longitude`, `current=apparent_temperature,relative_humidity_2m`, `hourly=apparent_temperature,precipitation_probability`, `forecast_hours=7`, `timezone=auto`. Lê `current.apparent_temperature`, `current.relative_humidity_2m`, `current.time`, `hourly.time[]`, `hourly.apparent_temperature[]` e `hourly.precipitation_probability[]`; descarta a hora atual e fica com as 6 seguintes (a primeira hora de `hourly` é a atual; se `hourly.time[0]` for diferente de `current.time` truncado à hora, descarte as horas `<=` a hora atual). Probabilidade nula conta como 0. Latitude e longitude arredondadas para duas casas **antes** de montar a URL (`Math.round(x * 100) / 100`, serializado sem casas extras). `observado_em` = `current.time`.
  - `cities.ts`: `createOpenMeteoCities(deps?: { fetch?: typeof fetch }): CityLookup`. Texto com `trim()`; com menos de `config.clima.busca.minimoCaracteres` caracteres → `[]` sem chamar a rede. `GET https://geocoding-api.open-meteo.com/v1/search` com `name` (codificado), `count=5`, `language=pt`, `format=json`. De cada item de `results[]`: `name` → `nome`, `admin1` → `regiao` (opcional), `country` → `pais`, `latitude` → `lat` (duas casas), `longitude` → `lon` (duas casas), `timezone` → `fuso`. Sem `results` → `[]`. Até `maximoResultados`.
  - Os dois: `signal: AbortSignal.timeout(config.clima.timeoutMs)`; use `URLSearchParams` para os parâmetros; status diferente de 200, erro de rede, timeout (`AbortError`/`TimeoutError`) ou resposta fora do schema zod → lança o erro tipado da porta (`WeatherUnavailableError` / `CityLookupUnavailableError`, de `@/core/weather/ports`). Schemas zod no próprio adaptador, só com os campos lidos (`.passthrough()`/objeto não estrito para ignorar extras).
  - Padrão de `fetch`: `globalThis.fetch`, lido na chamada (não na importação).
- testes primeiro (sempre com `fetch` simulado: `vi.fn(async (url) => new Response(JSON.stringify(corpo), { status: 200 }))`):
  - weather: a URL chamada tem `latitude=-22.91`, `longitude=-43.17` para entrada `-22.9068, -43.1729`, e os parâmetros `current`, `hourly`, `forecast_hours=7`, `timezone=auto`; resposta com 7 horas → `proximas_horas` com 6 (sem a atual), `prob_chuva` nulo vira 0; status 500 → `WeatherUnavailableError`; corpo sem `current` → `WeatherUnavailableError`; `fetch` que lança (erro de rede ou `DOMException` de timeout) → `WeatherUnavailableError`.
  - cities: `buscar("rio")` devolve até 5 com os campos mapeados e lat/lon com duas casas; a URL tem `name=rio`, `count=5`, `language=pt`, `format=json`; `buscar("r")` e `buscar("  ")` → `[]` e `fetch` não chamado; `"  São Paulo "` → `name=S%C3%A3o+Paulo` (ou `%20`), sem espaços nas pontas; sem `results` → `[]`; status 500 → `CityLookupUnavailableError`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam; nenhum teste abre a rede.
- fora: cache, tools, container, script.

### T4 · Add the weather tools, ToolContext field and container wiring
- nivel: mecanica
- objetivo: criar as tools `clima.agora` e `clima.proximas_horas`, acrescentar `clima` ao `ToolContext` e ligar `weather` e `cities` no container.
- arquivos: `src/core/agents/tools/tool.ts`, `src/core/agents/tools/clima.ts`, `src/core/agents/tools/clima.test.ts`, `src/core/agents/tools/ayurveda.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `ToolContext` (em `tool.ts`) ganha: `clima: { fonte: WeatherSource; cidade?: CidadeDaPessoa }`. Atualize os contextos montados em `ayurveda.test.ts` (ex.: `clima: { fonte: createFakeWeather() }`) sem mudar o que esses testes conferem.
  - Tools (`src/core/agents/tools/clima.ts`), as duas com entrada `{}` (`z.object({}).strict()`):
    | Tool | Saída |
    |---|---|
    | `clima.agora` | `{ status: "ok"; cidade: string; temperatura_aparente: number; umidade: number; faixa_temperatura; faixa_umidade; gunas: Guna[]; observado_em: string }` ou `{ status: "sem_cidade" }` ou `{ status: "indisponivel" }` |
    | `clima.proximas_horas` | `{ status: "ok"; cidade: string; temperatura: "esquenta" \| "esfria" \| "estavel"; chuva: boolean; ate: string }` ou `{ status: "sem_cidade" }` ou `{ status: "indisponivel" }` |
  - Saída como união discriminada por `status` (zod `discriminatedUnion`).
  - Sem `ctx.clima.cidade` → `{ status: "sem_cidade" }` **sem chamar** a porta. Qualquer erro da porta (inclusive não tipado) → `{ status: "indisponivel" }`; nunca lança.
  - `clima.agora` usa `climaEmQualidades` (mesmas `gunas`); `clima.proximas_horas` usa `tendenciaDasProximasHoras`. Números: temperatura com uma casa, umidade inteira. `cidade` = `ctx.clima.cidade.nome`.
  - Descrições (de `AI.md` §4): `clima.agora` → "Consulte a temperatura aparente e a umidade da cidade da pessoa, já em qualidades. Faz sentido em mensagens de momento; é dispensável em pergunta conceitual."; `clima.proximas_horas` → "Consulte a tendência das próximas 6 horas (esquenta, esfria, chove). Só quando a ação é para mais tarde ou depende de sair de casa."
  - Exporta `climaAgoraTool`, `climaProximasHorasTool` e `climaTools: Tool<unknown, unknown>[]`.
  - Container: `Container` ganha `weather: WeatherSource` (= `createCachedWeatherSource(createOpenMeteoWeather(), clock)`, com o `clock` do container) e `cities: CityLookup` (= `createOpenMeteoCities()`); criados de forma preguiçosa (na primeira leitura, como `knowledge`), sem abrir rede na criação; overrides aceitos em `createContainer({ weather, cities })`.
- testes primeiro (com `createFakeWeather`):
  - `clima.agora` sem cidade → `sem_cidade` e `fake.chamadas === 0`;
  - fora do ar → `indisponivel` nas duas tools; porta que lança um `Error` qualquer → `indisponivel`;
  - `ok`: `clima.agora` traz as mesmas `gunas` de `climaEmQualidades`, temperatura com uma casa (ex.: 24.37 → 24.4) e umidade inteira (60.6 → 61); `clima.proximas_horas` traz a tendência certa;
  - as duas tools para a mesma cidade com o fonte embrulhado em `createCachedWeatherSource` → uma chamada à porta;
  - container: `createContainer({ weather: fake })` usa o fake; `createContainer()` não chama `fetch` (espione `globalThis.fetch`).
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam; teste de arquitetura verde.
- fora: script, evals.

### T5 · Add the opt-in clima:real script and the weather evals
- nivel: mecanica
- objetivo: criar o script ⚠️ `clima:real` (rede real, opt-in) e os evals determinísticos de clima.
- arquivos: `package.json`, `scripts/clima-real.ts`, `evals/det/clima/faixas.eval.ts`, `evals/det/clima/tools-clima.eval.ts`, `evals/det/clima/cache.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Script `clima:real` = `tsx scripts/clima-real.ts`, recebendo o nome da cidade como argumento (`npm run clima:real -- "Rio de Janeiro"`). ⚠️ Chama a rede. Fora dos gates e da CI. Comentário no topo do arquivo com ⚠️ e "roda só à mão".
  - O script usa só `getContainer()` (`@/infra/container`; R6): `cities.buscar(nome)`, pega a primeira, chama `weather.buscar({ lat, lon })`, e imprime: a cidade encontrada (nome, região, país, fuso), a hora local (`horaLocal`), temperatura aparente e umidade com as faixas e as `gunas` (`climaEmQualidades`), e a tendência (`tendenciaDasProximasHoras`). Sem argumento → mensagem de uso e código 2. Nenhuma cidade → mensagem e código 1. Erro de rede → mensagem e código 1.
  - **Não rode** `npm run clima:real` nesta tarefa (é rede real; quem roda é o orquestrador no fechamento). Confira só que `npx tsc --noEmit` passa e que, sem argumento, o script sai com 2 (`npx tsx scripts/clima-real.ts; echo $?`), o que não abre rede.
  - Evals (`evals/det/clima/`), com fakes e `createFixedClock`:
    - `faixas.eval.ts`: todas as bordas de temperatura (19.9, 20, 27, 27.1) e de umidade (49.9, 50, 75, 75.1), e as quatro combinações de qualidades (frio e seco, frio e úmido, quente e seco, quente e úmido).
    - `tools-clima.eval.ts`: `ok`, `sem_cidade` e `indisponivel` para as duas tools; a saída `ok` de `clima.agora` traz as mesmas `gunas` de `climaEmQualidades`.
    - `cache.eval.ts`: um pedido por cidade dentro de 60 minutos; cidades diferentes não dividem cache.
- testes primeiro: são os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: evals passam; script compila e sai com 2 sem argumento.
- fora: rodar a rede.
