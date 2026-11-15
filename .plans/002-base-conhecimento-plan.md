# Plano · Spec 002 · Base de conhecimento

Spec: `.specs/002-base-conhecimento.md`. Código (`T*`) é `mecanica`; conteúdo (`C*`) é `conteudo` (redator-base). Ordem: T1 → T9, depois C1 → C12, depois T10. ADRs ("Vocabulário fechado de 12 qualidades" e "Fontes da base consultadas pela internet com registro da página"), `KNOWLEDGE.md` e `AGENTS.md` são do orquestrador, no fechamento.

## Regras comuns a todas as tarefas

- Código e identificadores em inglês **exceto** os nomes de campos, tipos e funções do contrato, que ficam exatamente como escritos aqui (em português). Mensagens à pessoa em português.
- `src/core/` só importa `src/core/`, `@config/*` e `zod`. **Nada de `yaml` nem `node:fs` no core.** Nada de `new Date()`/`Date.now()` no core.
- Testes sem rede, sem banco, sem relógio real. Testes de código usam a mini-base (`createMiniKnowledge()`), nunca `data/`.
- Não ler `.env.local`. Não abrir pastas fora do repositório.
- Complexidade cognitiva ≤ 15 por função (o lint confere): divida em funções pequenas.
- Biome: rode `npx biome check --write <seus arquivos>` antes do lint. Se o filtro de saída mostrar "ESLint output (JSON parse failed)", confira o código real com `rtk bypass npm run lint`.
- Arquivos temporários só no scratchpad da sessão, nunca em `/tmp`.
- Não commitar.

## Contratos comuns (copiados da spec; valem para as tarefas que os citam)

### Vocabulário (`src/core/knowledge/vocab.ts`)

Cada constante `as const`, com o tipo derivado e o schema zod (`z.enum`).

| Constante | Tipo | Valores |
|---|---|---|
| `GUNAS` | `Guna` | `quente`, `frio`, `pesado`, `leve`, `oleoso`, `seco`, `estavel`, `movel`, `suave`, `aspero`, `intenso`, `brando` |
| `OPOSTO` | `Record<Guna, Guna>` | `quente↔frio`, `pesado↔leve`, `oleoso↔seco`, `estavel↔movel`, `suave↔aspero`, `intenso↔brando` |
| `RASAS` | `Rasa` | `doce`, `azedo`, `salgado`, `picante`, `amargo`, `adstringente` |
| `VIRYAS` | `Virya` | `quente`, `frio` |
| `VIPAKAS` | `Vipaka` | `doce`, `azedo`, `picante` |
| `DOSHAS` | `Dosha` | `vata`, `pitta`, `kapha` |
| `ESTADOS` | `Estado` | `com_frio`, `com_calor`, `pesada`, `seca`, `agitada`, `irritada`, `sem_energia` |
| `MOMENTOS_DO_DIA` | `MomentoDoDia` | `manha`, `almoco`, `tarde`, `jantar`, `noite` |
| `FUNCOES` | `Funcao` | `base`, `legume`, `folha`, `proteina`, `gordura`, `tempero`, `liquido`, `fruta`, `adocante` |
| `GRUPOS` | `Grupo` | `frutas`, `folhas`, `legumes`, `raizes`, `graos`, `leguminosas`, `laticinios`, `ovos`, `oleaginosas`, `oleos`, `especiarias`, `adocantes`, `bebidas` |
| `DURABILIDADES` | `Durabilidade` | `curta`, `media`, `longa` |
| `RESTRICOES` | `Restricao` | `vegetariana`, `vegana`, `sem_lactose`, `sem_gluten` |
| `GRUPOS_EVITAR` | `GrupoEvitar` | `amendoim`, `castanhas`, `leite`, `ovo`, `soja`, `trigo`, `gergelim`, `peixe`, `frutos_do_mar` |
| `MARCAS` | `Marca` | `fruta_azeda`, `fruta_doce`, `fermentado`, `estimulante` |
| `TIPOS_PRATICA` | `TipoPratica` | `cha`, `oleo`, `pratica` |
| `CONFIANCAS` | `Confianca` | `alta`, `media`, `baixa` |
| `TEMAS_QUIZ` | `TemaQuiz` | `corpo`, `pele`, `apetite_digestao`, `sono`, `clima`, `estresse`, `ritmo_energia`, `peso` |

Ids são kebab-case sem acento (`^[a-z0-9]+(-[a-z0-9]+)*$`), exceto os de `ESTADOS`.

### Schemas (`src/core/knowledge/schemas.ts`)

```ts
type FonteRef = { ref: string; campos: string[] }           // ref existe em fontes.yaml, ou "a_confirmar"

type Alimento = {
  id: string; nome: string; sinonimos: string[]
  grupo: Grupo; durabilidade: Durabilidade
  funcoes: Funcao[]                                           // 1 ou mais
  rasa: Rasa[]; virya: Virya; vipaka: Vipaka                  // rasa: 1 ou mais
  gunas: Guna[]                                               // 1 a 4, nunca os dois de um par
  efeito: { vata: number; pitta: number; kapha: number }      // inteiros de -2 (equilibra muito) a +2 (agrava muito)
  como_equilibrar: Partial<Record<Dosha, string>>             // frase curta, até 120 caracteres
  restricoes: Restricao[]                                     // quem evita este alimento
  grupos_evitar: GrupoEvitar[]
  marcas: Marca[]
  observacao?: string                                         // lida pela pessoa, até 120 caracteres
  fontes: FonteRef[]; confianca: Confianca; notas: string     // fontes: 1 ou mais
}

type Vaga = { funcao: Funcao; obrigatoria: boolean; maximo: number; grupos?: Grupo[] }  // maximo padrão 1
type Preparo = {
  id: string; nome: string
  titulo: string                                              // até 60 caracteres; lacunas {funcao} só de vagas existentes, com pelo menos uma de vaga obrigatória
  vagas: Vaga[]                                               // 1 ou mais obrigatória
  gunas_do_preparo: Guna[]
  passos: string                                              // até 400 caracteres; placeholders {funcao} só de vagas existentes
  momento: MomentoDoDia[]                                     // 1 ou mais
  contraindicacoes: Estado[]
  fontes: FonteRef[]; confianca: Confianca
}

type Pratica = {
  id: string; tipo: TipoPratica; nome: string
  ingredientes: string[]                                      // ids de alimentos; vazio só em tipo "pratica"
  preparo: string                                             // como fazer, até 300 caracteres
  gunas: Guna[]
  favorece_estados: Estado[]                                  // 1 ou mais
  efeito: { vata: number; pitta: number; kapha: number }
  momento: MomentoDoDia[]
  contraindicacoes: Estado[]
  nunca_sugerir_se: Restricao[]
  aviso: string                                               // texto extra obrigatório, ou ""
  fontes: FonteRef[]; confianca: Confianca
}

type Combinacao = { id: string; itens: string[]; motivo: string; fontes: FonteRef[]; confianca: Confianca }
// itens: 2 ou mais, cada um "alimento:<id>" | "grupo:<grupo>" | "marca:<marca>"

type DoshaInfo = {
  id: Dosha; nome: string; elementos: string[]; resumo: string
  gunas: Guna[]; equilibra_gunas: Guna[]; equilibra_rasas: Rasa[]
  caracteristicas: { corpo: string; mente: string; digestao: string }
  desequilibra: string; equilibra: string
  fontes: FonteRef[]
}

type EstadoInfo = {
  id: Estado; rotulo: string; emoji: string; eixo: "temperatura" | "corpo" | "mente"
  presentes: Guna[]; favorecer: Guna[]; evitar_gunas: Guna[]; evitar_marcas: Marca[]
  evitar_texto: string                                        // "gelados e crus"; vira o "Evite agora"
  fontes: FonteRef[]; confianca: Confianca
}

type Incomodo = {
  id: string; nome: string; palavras: string[]                // como a pessoa costuma dizer
  pergunta?: string                                           // obrigatória com mais de uma variante
  variantes: {                                                // 1 ou mais; com uma só, id "unica"
    id: string; opcao: string
    presentes: Guna[]; favorecer: Guna[]; evitar_gunas: Guna[]; evitar_marcas: Marca[]; evitar_texto: string
  }[]
  fontes: FonteRef[]; confianca: Confianca
}

type PerguntaQuiz = {
  id: string; tema: TemaQuiz; texto: string
  opcoes: { dosha: Dosha; texto: string }[]                   // exatamente 3, uma por dosha
  fontes: FonteRef[]
}

type GrupoEvitarInfo = { id: GrupoEvitar; nome: string; palavras: string[] }
type VocabuloGuna = { guna: Guna; nome: string; verbo: string | null }
type Fonte = { ref: string; titulo: string; autor: string; edicao?: string; pagina?: string; url?: string; acessado_em?: string; aprovada: boolean }
```

`DadosDaBase` = `{ alimentos: Alimento[]; preparos: Preparo[]; praticas: Pratica[]; combinacoes: Combinacao[]; doshas: DoshaInfo[]; estados: EstadoInfo[]; incomodos: Incomodo[]; quiz: PerguntaQuiz[]; gruposEvitar: GrupoEvitarInfo[]; vocabulario: VocabuloGuna[]; fontes: Fonte[] }`. Arquivos de `data/` (cada um é uma lista do tipo): `alimentos.yaml`, `preparos.yaml`, `praticas.yaml`, `combinacoes.yaml`, `doshas.yaml`, `estados.yaml`, `incomodos.yaml`, `quiz.yaml`, `grupos_evitar.yaml`, `vocabulario.yaml`, `fontes.yaml`.

### Regras de conteúdo (para C1–C12)

- Fontes **permitidas** como `ref` confirmada: só páginas do Ayurvedic Institute (`ayurveda.com`) e da Banyan Botanicals (`banyanbotanicals.com`), abertas **nesta tarefa** com WebFetch. Cada página aberta entra (se ainda não estiver) em `data/fontes.yaml`: `ref` kebab-case, `titulo`, `autor`, `url`, `acessado_em: "2026-11-14"`, `aprovada: true`. Cite a `ref` só nas linhas (e só nos `campos`) cujo valor estava na página.
- Sem página aberta que traga o valor: `fontes: [{ ref: a_confirmar, campos: [<campos>] }]` e `confianca: baixa`. **Nunca** escreva título, página, edição ou URL de memória. `a_confirmar` não entra em `fontes.yaml`.
- Página útil de outro site: entra em `fontes.yaml` com `aprovada: false`, e as linhas que a citam ficam com `confianca: baixa`.
- Divergência entre fontes: `confianca: media` ou `baixa` e uma nota (`notas` nos alimentos).
- Proibido: carnes, peixes, frutos do mar, suplementos, fitoterápicos, óleos essenciais; promessa de saúde ("cura", "trata", "resolve"), dosagem, quantidades em gramas, gotas ou "x vezes ao dia", linguagem de tratamento. Linguagem de conforto ("pode ajudar a aliviar a sensação de…").
- Só o vocabulário fechado (12 qualidades: `quente`, `frio`, `pesado`, `leve`, `oleoso`, `seco`, `estavel`, `movel`, `suave`, `aspero`, `intenso`, `brando`). "Úmido" é `oleoso`, "estimulante" é `movel`, "nutritivo" é `pesado`. Nunca as duas de um par.
- `data/fontes.yaml` é compartilhado entre tarefas: só **acrescente** linhas, nunca altere ou apague as existentes; reutilize uma `ref` já registrada se a página for a mesma.
- Comando: `npm run base:check`. Erros que começam com `cobertura:` são esperados enquanto as outras tarefas de conteúdo não terminam; **qualquer outro erro** ligado aos arquivos/ids da sua tarefa precisa ser zero.

---

### T1 · Add the closed vocabulary, the zod schemas and the base config files
- nivel: mecanica
- objetivo: criar o vocabulário fechado, os schemas zod de todos os arquivos da base e os arquivos de configuração `base`, `momento-do-dia` e `adequacao`.
- arquivos: `src/core/knowledge/vocab.ts`, `src/core/knowledge/vocab.test.ts`, `src/core/knowledge/schemas.ts`, `src/core/knowledge/schemas.test.ts`, `config/base.ts`, `config/momento-do-dia.ts`, `config/adequacao.ts`, `config/index.ts`, `config/index.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: seções "Vocabulário" e "Schemas" de "Contratos comuns". Detalhes dos schemas zod (exportar o schema e o tipo inferido de cada um: `alimentoSchema`/`Alimento`, `preparoSchema`/`Preparo`, `praticaSchema`/`Pratica`, `combinacaoSchema`, `doshaInfoSchema`, `estadoInfoSchema`, `incomodoSchema`, `perguntaQuizSchema`, `grupoEvitarInfoSchema`, `vocabuloGunaSchema`, `fonteSchema`, `fonteRefSchema`, e um `dadosDaBaseSchema` com as 11 listas e o tipo `DadosDaBase`):
  - `gunas` de alimento: 1 a 4, sem repetição, **nunca os dois de um par** (refine com mensagem clara).
  - `efeito`: inteiros de -2 a +2 em `vata`, `pitta`, `kapha`.
  - `como_equilibrar` e `observacao`: até 120 caracteres. `titulo`: até 60. `passos`: até 400. `preparo` (prática): até 300. `resposta` não existe aqui.
  - `fontes`: 1 ou mais em `Alimento` (nas demais tabelas, também 1 ou mais).
  - `Vaga.maximo` padrão 1 (`.default(1)`). `Preparo.vagas` com pelo menos uma `obrigatoria`.
  - `Pratica.ingredientes` vazio só no tipo `pratica`.
  - `Incomodo.variantes` 1 ou mais; `pergunta` obrigatória quando há mais de uma variante; com uma só variante, o id é `"unica"`.
  - `PerguntaQuiz.opcoes`: exatamente 3, uma por dosha.
  - `Combinacao.itens`: 2 ou mais, cada um casa `^(alimento|grupo|marca):`.
  - Ids kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`), exceto `EstadoInfo.id` (enum `ESTADOS`) e `DoshaInfo.id` (enum `DOSHAS`).
  - Objetos `.strict()` (campo desconhecido é erro).
  - `config/base.ts` (exato):
    ```ts
    export const base = {
      minAlimentos: 130, minPreparos: 30,
      minPraticas: { cha: 20, oleo: 7, pratica: 17 },
      minAlimentosPorVaga: 3,
      minPraticasPorEstado: 3,          // práticas com o estado em favorece_estados
      minPreparosPorEstado: 3,          // preparos não contraindicados com alguma qualidade favorecida
      minPreparosPorMomento: 2, minPraticasPorMomento: 3,
      minCombinacoes: 8,
    } as const
    ```
  - `config/momento-do-dia.ts`: `manha` 5h–10h59, `almoco` 11h–14h59, `tarde` 15h–17h59, `jantar` 18h–20h59, `noite` 21h–4h59 (ex.: `export const momentoDoDia = { manha: { inicio: 5, fim: 10 }, ... noite: { inicio: 21, fim: 4 } } as const`, horas inteiras inclusivas).
  - `config/adequacao.ts`: `export const adequacao = { porQualidadeBuscada: 2, porQualidadeOposta: -2, porPontoDeEfeito: -1, maximoGunasPreparo: 2 } as const`.
  - `config/index.ts`: `config` passa a ter `{ app, base, momentoDoDia, adequacao }`.
- testes primeiro:
  - `GUNAS` tem 12; `OPOSTO` é simétrico (`OPOSTO[OPOSTO[g]] === g` para toda guna).
  - schema de alimento recusa `umido`, `estimulante` e `nutritivo` em `gunas`; recusa `["quente","frio"]`; recusa `efeito.vata = 3` e `-3` e `1.5`; aceita um alimento válido completo.
  - prática `cha` com `ingredientes: []` é recusada; tipo `pratica` com `[]` é aceito.
  - quiz com duas opções `vata` é recusado.
  - combinação com item `"abobora"` (sem prefixo) é recusada.
  - incômodo com 2 variantes e sem `pergunta` é recusado.
  - `config.base.minAlimentos === 130` e `config.adequacao.porQualidadeOposta === -2`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam; `src/core/knowledge/` importa só zod e o próprio core.
- fora: validação cruzada, porta, adaptador, `data/`.

### T2 · Add cross validation and the KnowledgeBase port
- nivel: mecanica
- objetivo: criar a validação cruzada (`validarBase`) e a porta `KnowledgeBase` com `createKnowledgeBase`, índices, `linha(ref)` e `verbo(guna)`.
- arquivos: `src/core/knowledge/validate.ts`, `src/core/knowledge/validate.test.ts`, `src/core/knowledge/knowledge-base.ts`, `src/core/knowledge/knowledge-base.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (vocabulário e schemas, já em `vocab.ts` e `schemas.ts`), mais:
  ```ts
  // src/core/knowledge/knowledge-base.ts
  export interface KnowledgeBase {
    readonly alimentos: readonly Alimento[]
    readonly preparos: readonly Preparo[]
    readonly praticas: readonly Pratica[]
    readonly combinacoes: readonly Combinacao[]
    readonly doshas: readonly DoshaInfo[]
    readonly estados: readonly EstadoInfo[]
    readonly incomodos: readonly Incomodo[]
    readonly quiz: readonly PerguntaQuiz[]
    readonly gruposEvitar: readonly GrupoEvitarInfo[]
    readonly vocabulario: readonly VocabuloGuna[]
    readonly fontes: readonly Fonte[]
    alimento(id: string): Alimento | undefined
    preparo(id: string): Preparo | undefined
    pratica(id: string): Pratica | undefined
    linha(ref: string): unknown | undefined        // "<tabela>:<id>"; incômodo: "incomodos:<id>/<variante>"
    verbo(guna: Guna): string | null
  }
  export function createKnowledgeBase(dados: DadosDaBase, opcoes?: { cobertura?: boolean }): KnowledgeBase    // valida e indexa; lança KnowledgeInvalidError
  export function validarBase(dados: unknown, opcoes?: { cobertura?: boolean }): { erros: string[]; avisos: string[]; contagens: Contagens }
  export class KnowledgeInvalidError extends RituError {}                    // code: "base_invalida"; .erros: string[]
  ```
  - `validarBase` pode ficar em `validate.ts` e ser reexportada por `knowledge-base.ts`. `RituError` vem de `@/core/errors` (`constructor(code, message)`).
  - `opcoes.cobertura` (padrão `true`): quando `false`, os erros de cobertura não são gerados (é assim que a mini-base de teste é carregada). Decisão autônoma registrada.
  - `Contagens`: `{ porArquivo: Record<string, number>; alimentosPorGrupo: Record<Grupo, number>; praticasPorTipo: Record<TipoPratica, number>; aConfirmar: number }` (`aConfirmar` = linhas com alguma `ref: a_confirmar`).
  - Primeiro valida cada lista com o schema zod (erros de schema com `arquivo`, `id` e `campo`); depois a validação cruzada. **Todos** os erros são listados de uma vez, cada um como `"<arquivo>:<id>:<campo> <mensagem>"` (ex.: `alimentos:abobora:fontes ref "x" não existe em fontes.yaml`).
  - Erros de cobertura começam com `cobertura:` (ex.: `cobertura: alimentos tem 12, mínimo 130`).
  - Validação cruzada (cada regra com teste próprio):
    1. id repetido em qualquer tabela;
    2. `ref` de fonte inexistente em `fontes.yaml` (exceto `a_confirmar`);
    3. ingrediente de prática ou item `alimento:<id>` de combinação que não existe (e `grupo:`/`marca:` fora do vocabulário);
    4. placeholder `{funcao}` em `passos` ou `titulo` sem vaga daquela função;
    5. `titulo` sem lacuna de nenhuma vaga obrigatória;
    6. vaga de preparo com menos de `config.base.minAlimentosPorVaga` alimentos possíveis (alimentos com a `funcao` da vaga em `funcoes` e, se a vaga tem `grupos`, do grupo);
    7. prática `oleo` sem ingrediente do grupo `oleos`;
    8. `grupos_evitar` obrigatório: laticínios e `ghee` → `leite`; grupo `ovos` → `ovo`; `tofu` → `soja`; `pao` e `macarrao` → `trigo`; `amendoim` → `amendoim`; `castanha-de-caju`, `castanha-do-para`, `amendoa`, `noz` → `castanhas`; `gergelim` e `oleo-de-gergelim` → `gergelim` (só checa os ids que existirem);
    9. alimento do grupo `oleos` exceto `ghee` sem `observacao` contendo "prensado a frio";
    10. pergunta do quiz sem uma opção por dosha (já no schema; manter mensagem clara);
    11. estado (em `favorece_estados`, `contraindicacoes`) sem linha em `estados.yaml`, e guna sem linha em `vocabulario.yaml`;
    12. fonte com `url` e sem `acessado_em`;
    13. cobertura (só com `cobertura: true`), usando `config.base`: `minAlimentos`, `minPreparos`, `minPraticas` por tipo, `minPraticasPorEstado` (práticas com o estado em `favorece_estados`), `minPreparosPorEstado` (preparos sem o estado em `contraindicacoes` e com alguma guna de `gunas_do_preparo` no `favorecer` do estado), `minPreparosPorMomento`, `minPraticasPorMomento`, `minCombinacoes`.
  - Avisos (não falham): linha com `a_confirmar`; fonte com `aprovada: false`.
  - `createKnowledgeBase`: chama `validarBase`; com erros, lança `KnowledgeInvalidError` (mensagem com a contagem e os primeiros erros; `.erros` com todos). Indexa por id. `linha(ref)`: tabelas `alimentos`, `preparos`, `praticas`, `combinacoes`, `doshas`, `estados`, `incomodos` (`incomodos:<id>/<variante>` devolve a variante; `incomodos:<id>` devolve o incômodo), `quiz`, `grupos_evitar`, `vocabulario`, `fontes`; ref malformada ou inexistente → `undefined`. `verbo(guna)` lê `vocabulario`.
- testes primeiro: monte nos testes uma base mínima válida em TypeScript (poucas linhas, com `cobertura: false`), e para cada regra 1–12 um caso que a viola e confere a mensagem; regra 13 com `cobertura: true` gera erros `cobertura:`; vários erros juntos aparecem todos; `createKnowledgeBase` lança `KnowledgeInvalidError` com `code === "base_invalida"`; `linha("alimentos:x")`, `linha("incomodos:dor-de-cabeca/latejante")` e `linha("nada:x")`/`linha("malformado")`; `verbo("aspero") === null`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam; complexidade ≤ 15 em todas as funções.
- fora: mini-base, adaptador YAML, `data/`, funções de domínio.

### T3 · Add the mini knowledge base fake
- nivel: mecanica
- objetivo: criar a mini-base em TypeScript usada por todos os testes de código da base, válida em `createKnowledgeBase(..., { cobertura: false })`.
- arquivos: `src/infra/fakes/mini-knowledge.ts`, `src/infra/fakes/mini-knowledge.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schemas). `src/infra/fakes/mini-knowledge.ts` exporta `createMiniKnowledge(): KnowledgeBase` e `miniDados: DadosDaBase` (os dados crus, para testes que precisem alterar). Conteúdo (valores plausíveis; é fake, todas as linhas com `fontes: [{ ref: "fonte-teste", campos: [] }]` e uma fonte `fonte-teste` com `aprovada: true`, sem `url`):
  - **16 alimentos**, ids tirados desta lista da base real, incluindo obrigatoriamente: `leite`, `iogurte-natural`, `manteiga`, `ghee`, `oleo-de-gergelim`, `oleo-de-coco`, `canela`, `cardamomo`, `gengibre`, `limao`, `banana`, `mel`, `abobora`, `cenoura`, `batata-doce`, `arroz-branco`. Pode trocar no máximo 2 desses se for impossível fechar as vagas, registrando no relatório. Regras: `leite`, `iogurte-natural`, `manteiga`, `ghee` com `grupos_evitar: ["leite"]` e `restricoes` com `vegana` (e `sem_lactose` em `leite` e `iogurte-natural`); `mel` com `vegana`; `oleo-de-gergelim` com `grupos_evitar: ["gergelim"]` e `observacao: "Prefira o prensado a frio e não torrado."`; `oleo-de-coco` com `observacao: "Prefira o prensado a frio."`; `limao` com marca `fruta_azeda`; `banana` com marca `fruta_doce`; `iogurte-natural` com marca `fermentado`; `canela` e `cardamomo` com `virya: quente`, função `tempero` e pelo menos uma guna em comum (`quente`); `gengibre` também `tempero` e `quente`; `banana` com sinônimo `banana-prata`; `abobora` com sinônimos `jerimum` e `moranga`.
  - **4 preparos**: `arroz-com-legume` (vagas `base` obrigatória, `legume` obrigatória, `gordura` obrigatória, `tempero` opcional; `titulo: "Arroz bem cozido com {legume} e {gordura}"`), `leite-morno-com-especiaria` (vagas `liquido` obrigatória com `grupos: ["laticinios"]`, `tempero` obrigatória, `adocante` opcional), `pure-de-raiz` (`base` obrigatória com `grupos: ["raizes"]`, `gordura` obrigatória), `mingau` (`base` obrigatória, `liquido` obrigatória, `fruta` opcional, `adocante` opcional). Toda vaga precisa de **pelo menos 3** alimentos possíveis entre os 16 (ajuste `funcoes` dos alimentos para isso; um alimento pode ter várias funções; ex.: `leite`, `iogurte-natural` e `manteiga` com função `liquido` grupo `laticinios` não fecha se manteiga não for líquido — ajuste a vaga ou as funções até a validação passar). Nenhum preparo combina laticínio com fruta.
  - **6 práticas**: `cha-gengibre` (cha, `[gengibre]`), `cha-canela-cardamomo` (cha, `[canela, cardamomo]`), `cha-gengibre-limao-mel` (cha, `[gengibre, limao, mel]`, `preparo` diz para juntar o mel só depois de amornar), `oleo-pes-gergelim` (oleo, `[oleo-de-gergelim]`), `oleo-pes-coco` (oleo, `[oleo-de-coco]`), `respiracao-lenta` (pratica, `[]`). Óleos: `preparo` diz "óleo prensado a frio" e que é para uso na pele.
  - **2 combinações**: `leite-fruta-azeda` (`["alimento:leite", "marca:fruta_azeda"]`) e `leite-banana` (`["alimento:leite", "alimento:banana"]`).
  - **7 estados** (todos de `ESTADOS`), com `rotulo`, `emoji`, `eixo`, `presentes`, `favorecer` (ex.: `com_frio`: presentes `frio`, favorecer `quente`; `com_calor`: presentes `quente`, favorecer `frio`; `pesada`: presentes `pesado`, favorecer `leve`, `quente`; …), `evitar_gunas`, `evitar_marcas`, `evitar_texto`. Requisito para testes: `com_calor` favorece `frio` e `pesada` favorece `quente`, para dar conflito.
  - **1 incômodo** `dor-de-cabeca` com `pergunta` e 3 variantes `latejante`, `tensa`, `pesada`; e **1** `gases` com uma variante `unica`.
  - **3 doshas**, **12 linhas de vocabulário** (tabela: quente/aquece, frio/refresca, oleoso/úmido/umedece, seco/seca, pesado/nutritivo/nutre, leve/alivia o peso, estavel/estável/assenta, movel/estimulante/estimula, suave/suaviza, brando/acalma, intenso/desperta, aspero/áspero/`null`), **9 grupos_evitar** com pelo menos 4 `palavras` cada (`leite`: leite, laticínio, queijo, iogurte; `frutos_do_mar`: camarão, lagosta, siri, marisco; `gergelim`: gergelim, tahine, sésamo, óleo de gergelim; os demais plausíveis), **quiz** com 1 pergunta (tema `corpo`).
- testes primeiro: `createMiniKnowledge()` não lança; `validarBase(miniDados, { cobertura: false }).erros` é vazio; contagens 16/4/6/2; `kb.linha("praticas:oleo-pes-gergelim")` existe.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam (`src/infra/fakes/` fica fora do `dup`).
- fora: `data/`, funções de domínio.

### T4 · Add moment qualities, time of day and suitability score
- nivel: mecanica
- objetivo: criar as funções puras `qualidadesDoMomento`, `momentoDoDia` e `notaAdequacao`.
- arquivos: `src/core/knowledge/momento.ts`, `src/core/knowledge/momento.test.ts`, `src/core/knowledge/adequacao.ts`, `src/core/knowledge/adequacao.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // momento.ts
  type MomentoEntrada = { estados: Estado[]; incomodo?: { id: string; variante?: string }; gunasDoClima?: Guna[] }
  type MomentoQualidades = {
    presentes: Guna[]; buscadas: Guna[]
    evitar_gunas: Guna[]; evitar_marcas: Marca[]
    evitar: { texto: string; linha_base: string }[]
    conflitos: [Guna, Guna][]                       // pares em que as duas qualidades foram pedidas
    linhas_base: string[]
    precisa_variante?: { incomodo: string; pergunta: string; opcoes: { id: string; texto: string }[] }
  }
  function qualidadesDoMomento(entrada: MomentoEntrada, kb: KnowledgeBase): MomentoQualidades
  function momentoDoDia(hora: number): MomentoDoDia          // hora local, 0 a 23

  // adequacao.ts
  function notaAdequacao(item: { gunas: Guna[]; efeito?: Record<Dosha, number> }, buscadas: Guna[], prakriti?: Prakriti): { nota: number; contribui: Guna[] }
  type Prakriti = Partial<Record<Dosha, number>>              // proporções que somam 1
  ```
  - Todos exportados (tipos também).
  - `qualidadesDoMomento`: `presentes` = união (sem repetição, ordem estável) das `presentes` dos estados, da variante do incômodo e das gunas do clima; `buscadas` = união de `favorecer` dos estados e da variante, mais o **oposto** (`OPOSTO`) de cada guna do clima. `evitar_gunas`/`evitar_marcas` = uniões. `evitar` = um item por estado/variante com `evitar_texto` não vazio, `linha_base` `estados:<id>` ou `incomodos:<id>/<variante>`. Quando uma guna e o seu oposto estão em `buscadas`, o par vai para `conflitos` (uma vez, como `[a, b]` na ordem em que apareceram) e as duas continuam. `linhas_base`: as linhas usadas. Incômodo com mais de uma variante e sem `variante`: preenche `precisa_variante` (`incomodo` = id, `pergunta`, `opcoes` = `{ id, texto: opcao }`) e **não** acrescenta qualidades do incômodo. Incômodo com uma variante (`unica`) usa essa variante sem perguntar. Incômodo com id inexistente: ignorado. Entrada vazia: listas vazias.
  - `momentoDoDia(hora)`: pelas faixas de `config.momentoDoDia` (`@config/index`); `noite` cobre 21–23 e 0–4.
  - `notaAdequacao`: soma `config.adequacao.porQualidadeBuscada` (2) por guna do item que está em `buscadas`; `porQualidadeOposta` (-2) por guna do item cujo oposto está em `buscadas`; com `prakriti` e `efeito`, soma `porPontoDeEfeito (-1) × efeito[dosha] × proporção` para cada dosha da prakriti. Sem prakriti, `efeito` não muda a nota. `contribui` = gunas do item que estão em `buscadas`.
- testes primeiro (com `createMiniKnowledge()` de `@/infra/fakes/mini-knowledge`):
  - cada um dos 7 estados devolve `presentes`/`buscadas` iguais aos da linha em `kb.estados`;
  - `com_calor` + `pesada` → `conflitos` contém `["frio","quente"]` ou `["quente","frio"]` conforme a ordem, e as duas em `buscadas`;
  - `dor-de-cabeca` sem variante → `precisa_variante` com 3 opções e sem gunas do incômodo; com `variante: "latejante"` → gunas da variante e `linhas_base` com `incomodos:dor-de-cabeca/latejante`;
  - `gases` sem variante usa `unica`; incômodo `inexistente` é ignorado; entrada vazia → tudo vazio;
  - clima `["frio","oleoso"]` → `presentes` com `frio`,`oleoso`; `buscadas` com `quente`,`seco`;
  - `momentoDoDia`: 4→noite, 5→manha, 10→manha, 11→almoco, 14→almoco, 15→tarde, 18→jantar, 20→jantar, 21→noite, 23→noite, 0→noite;
  - `notaAdequacao`: item com 2 gunas buscadas > item com 1; item com guna oposta < item neutro; sem prakriti, `efeito` não muda; com prakriti `{ vata: 1 }` e `efeito.vata = 2`, a nota cai 2.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam.
- fora: filtros, substitutos, tools.

### T5 · Add person filters and food identification
- nivel: mecanica
- objetivo: criar `passaNoFiltro`, `normalizar`, `identificarAlimento` e `resolverEvitar`.
- arquivos: `src/core/knowledge/filtros.ts`, `src/core/knowledge/filtros.test.ts`, `src/core/knowledge/identificar.ts`, `src/core/knowledge/identificar.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // filtros.ts
  type EvitarItem = { tipo: "grupo" | "alimento" | "texto"; valor: string }
  type FiltroPessoa = { evitar: EvitarItem[]; restricoes: Restricao[]; nao_come: string[]; nao_gosta: string[] }   // nao_come e nao_gosta: ids
  function passaNoFiltro(alvo: Alimento | Preparo | Pratica, filtro: FiltroPessoa, kb: KnowledgeBase): { passa: boolean; motivo?: "evitar_sempre" | "restricao" | "nao_come" | "nao_gosta" }
  // Prática: reprova se qualquer ingrediente reprova. Preparo: reprova se alguma vaga obrigatória fica sem nenhum alimento aprovado.

  // identificar.ts
  function normalizar(texto: string): string                  // minúsculas, sem acento, sem pontuação, espaços simples
  function identificarAlimento(nome: string, kb: KnowledgeBase): { tipo: "alimento"; id: string } | { tipo: "desconhecido"; nome: string }
  function resolverEvitar(texto: string, kb: KnowledgeBase): EvitarItem   // grupo pelas palavras → alimento pelo nome ou sinônimo → texto
  ```
  - Exporte também `filtroVazio: FiltroPessoa`.
  - Alimento reprova, nesta ordem de motivo: `evitar_sempre` (grupo em `grupos_evitar`; id igual; item `texto` cujo `normalizar` bate com o nome ou um sinônimo normalizado do alimento) → `restricao` (alguma restrição do filtro em `alimento.restricoes`) → `nao_come` → `nao_gosta`.
  - Prática: reprova se qualquer ingrediente reprova (motivo do primeiro), e também se alguma restrição do filtro está em `nunca_sugerir_se` (`restricao`).
  - Preparo: para cada vaga obrigatória, os alimentos possíveis (função da vaga e grupos, se houver) que passam; se alguma fica vazia, reprova com o motivo mais frequente entre os reprovados daquela vaga (empate: a ordem acima). Exemplo da spec: alimento em `nao_gosta` que é o único de uma vaga obrigatória → motivo `nao_gosta`.
  - `normalizar`: minúsculas, remove acentos (NFD + remove diacríticos), troca pontuação e hífen por espaço, colapsa espaços, `trim`.
  - `identificarAlimento`: casa o `normalizar` do nome com o id (hífens como espaço), o nome ou um sinônimo normalizados; nada de semelhança aproximada; sem casamento → `desconhecido` com o nome original.
  - `resolverEvitar`: se o texto normalizado bate **inteiro** com nome/sinônimo/id de um alimento → `alimento` (o alimento ganha do grupo quando o nome bate inteiro); senão, se bate com alguma `palavra` normalizada de um grupo de `gruposEvitar` (texto igual à palavra, ou contendo-a como palavra inteira) → `grupo`; senão → `texto` com o texto original.
- testes primeiro (mini-base):
  - grupo `leite` em evitar tira `leite`, `iogurte-natural`, `manteiga`, `ghee`, o preparo `leite-morno-com-especiaria`, e nenhuma prática com esses ingredientes passa;
  - grupo `gergelim` tira `oleo-pes-gergelim` (e passa `oleo-pes-coco`);
  - item `{ tipo: "texto", valor: "Jerimum" }` tira `abobora`;
  - restrição `vegana` tira `mel` e a prática `cha-gengibre-limao-mel` com motivo `restricao`;
  - preparo cuja única opção de uma vaga obrigatória está em `nao_gosta` → `nao_gosta` (monte o caso a partir de `miniDados` se precisar);
  - `normalizar("  Abóbora, Cabotiá! ")` → `"abobora cabotia"`;
  - `identificarAlimento("BANANA-PRATA")` → `banana`; `"abóbora"` → `abobora`; `"pitaia"` → desconhecido;
  - `resolverEvitar("camarão")` → grupo `frutos_do_mar`; `resolverEvitar("leite")` → alimento `leite` (nome inteiro ganha); `resolverEvitar("queijo")` → grupo `leite`; `resolverEvitar("pitaia")` → texto `pitaia`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam.
- fora: substitutos, combinações, tools.

### T6 · Add substitutes and combination check
- nivel: mecanica
- objetivo: criar `substitutos`, `fraseDaTroca` e `checarCombinacao`.
- arquivos: `src/core/knowledge/substitutos.ts`, `src/core/knowledge/substitutos.test.ts`, `src/core/knowledge/combinacoes.ts`, `src/core/knowledge/combinacoes.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // substitutos.ts
  type SinaisPessoa = { em_casa: string[]; gosta: string[]; ajudou: Record<string, number> }
  function substitutos(p: { alimento_id: string; funcao?: Funcao; preparo_id?: string; outros_itens: string[]; filtro: FiltroPessoa; sinais: SinaisPessoa; limite: number }, kb: KnowledgeBase): Substituto[]
  type Substituto = { alimento_id: string; nome: string; em_comum: Guna[]; em_casa: boolean; motivo: string; linha_base: string }
  function fraseDaTroca(de: Alimento, para: Alimento, emComum: Guna[], kb: KnowledgeBase): string

  // combinacoes.ts
  function checarCombinacao(ids: string[], kb: KnowledgeBase): { compativel: boolean; conflitos: { itens: [string, string]; motivo: string; linha_base: string }[] }
  ```
  - `passaNoFiltro`/`FiltroPessoa` vêm de `./filtros` (T5). Exporte também `sinaisVazios: SinaisPessoa`.
  - `substitutos`: candidatos são alimentos com a mesma função (com `funcao` informada; com `preparo_id`, a vaga dessa função no preparo e os `grupos` dela; sem função, alimentos do **mesmo grupo**), mesma `virya`, pelo menos uma guna em comum (alimento com uma só guna: exige essa), aprovados em `passaNoFiltro` e compatíveis (`checarCombinacao`) com `outros_itens`. Ordem: mais gunas em comum → está em casa (`sinais.em_casa`) → a pessoa gosta → mais vezes ajudou → nome. O próprio alimento nunca é devolvido. Corta em `limite`. `linha_base` = `alimentos:<id>`. `motivo` = `fraseDaTroca`. Alimento inexistente → `[]`.
  - `fraseDaTroca`: `"Troquei {de.nome em minúsculas} por {para.nome em minúsculas}: os dois {verbo}."` com até dois verbos (das gunas em comum, na ordem de `GUNAS`, só as com verbo não nulo) ligados por " e "; sem verbo em comum: `"Troquei {de} por {para}: têm a mesma função no preparo."`. Ex.: `"Troquei canela por cardamomo: os dois aquecem."` — atenção: o verbo de `vocabulario` é "aquece" (singular); para "os dois", use a forma plural: acrescente "m" ao verbo terminado em vogal ("aquece" → "aquecem", "refresca" → "refrescam", "alivia o peso" → "aliviam o peso": pluralize a primeira palavra). Escreva a regra numa função pequena e teste-a com os 11 verbos.
  - `checarCombinacao`: para cada linha de `kb.combinacoes`, verifica se dois ids distintos da lista casam com dois itens distintos da linha (`alimento:<id>` = id igual; `grupo:<g>` = `alimento.grupo === g`; `marca:<m>` = `alimento.marcas` inclui `m`). Cada par conflitante entra uma vez em `conflitos` com `motivo` e `linha_base` `combinacoes:<id>`. Sem conflito → `compativel: true`. Ids desconhecidos são ignorados aqui.
- testes primeiro (mini-base):
  - substitutos de `canela` (função `tempero`): primeiro é quente e `tempero`; `cardamomo` antes de `gengibre` se tiver mais gunas em comum (ou desempate por casa/gosto conforme montado); com `cardamomo` em `nao_gosta`, ele some; com `em_casa: ["gengibre"]` e empate de gunas, `gengibre` sobe; filtro que elimina todos → `[]`; nunca devolve `canela`; `limite: 1` devolve um;
  - `outros_itens: ["leite"]` tira candidato que conflita com leite;
  - `fraseDaTroca` canela→cardamomo = `"Troquei canela por cardamomo: os dois aquecem."`; sem verbo em comum = frase da função;
  - `checarCombinacao(["leite","limao"])` acusa `leite-fruta-azeda`; `["leite","banana"]` acusa `leite-banana`; `["arroz-branco","abobora"]` → compatível.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam.
- fora: tools, adaptador.

### T7 · Add the Tool contract and the four ayurveda tools
- nivel: mecanica
- objetivo: criar o tipo `Tool` e as tools `ayurveda.alimento`, `ayurveda.candidatos`, `ayurveda.substitutos` e `ayurveda.checar_combinacao`.
- arquivos: `src/core/agents/tools/tool.ts`, `src/core/agents/tools/ayurveda.ts`, `src/core/agents/tools/ayurveda.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/core/agents/tools/tool.ts
  export type ToolContext = { kb: KnowledgeBase; filtro: FiltroPessoa; sinais: SinaisPessoa; prakriti?: Prakriti }
  export type Tool<I, O> = {
    name: string                    // em português, com ponto: "ayurveda.alimento"
    description: string             // o "quando faz sentido chamar"
    input: z.ZodType<I>
    output: z.ZodType<O>
    execute(input: I, ctx: ToolContext): Promise<O>
  }
  ```
  | Tool | Entrada | Saída |
  |---|---|---|
  | `ayurveda.alimento` | `{ alimentos: string[] }` (1 a 5; id, nome ou sinônimo) | `{ alimentos: { id, nome, grupo, rasa, virya, vipaka, gunas, verbos: string[], efeito, como_equilibrar, observacao?, confianca, linha_base }[]; desconhecidos: string[] }` |
  | `ayurveda.candidatos` | `{ tipo: "alimento" \| "preparo" \| "pratica"; buscadas: Guna[] (1 a 6); momento_do_dia?: MomentoDoDia; estados?: Estado[]; funcao?: Funcao; limite?: number (1 a 10, padrão 5) }` | `{ candidatos: { tipo, id, nome, gunas, contribui: Guna[], nota: number, linha_base }[] }` |
  | `ayurveda.substitutos` | `{ alimento_id: string; funcao?: Funcao; preparo_id?: string; outros_itens?: string[]; limite?: number (1 a 5, padrão 3) }` | `{ substitutos: Substituto[]; desconhecidos: string[] }` |
  | `ayurveda.checar_combinacao` | `{ itens: string[] }` (2 a 8 ids de alimentos) | `{ compativel: boolean; conflitos: { itens: [string, string]; motivo: string; linha_base: string }[]; desconhecidos: string[] }` |
  - Descrições (o "quando faz sentido chamar"), em português, curtas: alimento → "Consulte as qualidades e o efeito de alimentos citados pela pessoa ou que você pensa em sugerir."; candidatos → "Busque alimentos, preparos ou práticas que atendem às qualidades buscadas, já filtrados para a pessoa."; substitutos → "Ache um substituto para um ingrediente que a pessoa não tem ou não quer."; checar_combinacao → "Confira se os alimentos de uma sugestão combinam entre si antes de entregar."
  - `ayurveda.alimento`: usa `identificarAlimento`; `verbos` = verbos não nulos das gunas; o mesmo alimento escrito de dois jeitos sai uma vez; `linha_base` `alimentos:<id>`.
  - `ayurveda.candidatos`: aplica sempre `ctx.filtro` (`passaNoFiltro`); tira o que tem algum `estados` em `contraindicacoes` (alimentos não têm contraindicação); tira o que não serve ao `momento_do_dia` (preparo/prática sem ele em `momento`); com `funcao`, só alimentos com essa função; ordena por `notaAdequacao` (alimento: `gunas`+`efeito`; preparo: `gunas_do_preparo`, sem efeito; prática: `gunas`+`efeito`), com `ctx.prakriti`; nota ≤ 0 fica fora; desempate por nome; corta em `limite`. `linha_base` `<tabela>:<id>` (`alimentos`, `preparos`, `praticas`).
  - `ayurveda.substitutos`: chama `substitutos` com `ctx.filtro`, `ctx.sinais`; id inexistente → `substitutos: []` e o id em `desconhecidos`.
  - `ayurveda.checar_combinacao`: chama `checarCombinacao`; ids inexistentes vão em `desconhecidos` e não impedem `compativel: true`.
  - `execute` valida a entrada com `input.parse` e devolve dados que passam em `output`.
  - Exporta `ayurvedaTools: Tool<unknown, unknown>[]` com as quatro (e cada uma nomeada: `alimentoTool`, `candidatosTool`, `substitutosTool`, `checarCombinacaoTool`).
  - Domínio `agents` importa `knowledge` (ok; `knowledge` não importa `agents`, senão R9 acusa ciclo).
- testes primeiro (mini-base, `ctx` com `filtroVazio`/`sinaisVazios`):
  - `ayurveda.alimento` com `["Banana-prata", "banana", "abóbora", "pitaia"]` → 2 alimentos (banana uma vez), `desconhecidos: ["pitaia"]`, cada um com `linha_base` e `kb.linha(linha_base)` definido;
  - `ayurveda.candidatos` tipo `pratica`, `buscadas: ["quente"]` → só práticas com nota > 0, ordenadas por nota; com filtro `gergelim`, `oleo-pes-gergelim` some; com `momento_do_dia` fora do `momento` de uma prática, ela some; com `estados` contraindicado, some;
  - `ayurveda.substitutos` de `canela` → lista; de `xyz` → `[]` e `desconhecidos: ["xyz"]`;
  - `ayurveda.checar_combinacao` `["leite","limao"]` → `compativel: false`; `["arroz-branco","xyz"]` → `compativel: true`, `desconhecidos: ["xyz"]`;
  - entrada inválida (`alimentos: []`, `limite: 11`) lança erro de zod;
  - toda `linha_base` devolvida existe em `kb.linha`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes passam e o teste de arquitetura segue verde.
- fora: registro na Mastra, adaptador.

### T8 · Add the YAML adapter, container wiring and empty data files
- nivel: mecanica
- objetivo: criar o adaptador que lê `data/*.yaml`, ligar `knowledge` no container, permitir `yaml` só em `src/infra/knowledge/` e criar os 11 arquivos de `data/` vazios.
- arquivos: `package.json`, `package-lock.json`, `src/infra/knowledge/yaml-knowledge.ts`, `src/infra/knowledge/yaml-knowledge.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`, `src/architecture.test.ts`, `next.config.ts`, `data/alimentos.yaml`, `data/preparos.yaml`, `data/praticas.yaml`, `data/combinacoes.yaml`, `data/doshas.yaml`, `data/estados.yaml`, `data/incomodos.yaml`, `data/quiz.yaml`, `data/grupos_evitar.yaml`, `data/vocabulario.yaml`, `data/fontes.yaml`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Instalar `yaml` (estável mais recente) como dependência.
  - `src/infra/knowledge/yaml-knowledge.ts` exporta `loadKnowledgeBase(dir?: string): KnowledgeBase` (padrão `path.join(process.cwd(), "data")`) e `readDadosDaBase(dir?: string): DadosDaBase` (só lê e faz parse, sem validar; usado pelo `base:check`). Único lugar do projeto que importa `yaml`. Lê os 11 arquivos (`grupos_evitar.yaml` → `gruposEvitar`); arquivo ausente ou YAML malformado → lança `KnowledgeInvalidError` (de `@/core/knowledge/knowledge-base`) com o nome do arquivo em `.erros`. Arquivo vazio ou `[]` → lista vazia. `loadKnowledgeBase` chama `createKnowledgeBase(dados)` (com cobertura).
  - Container (`src/infra/container.ts`): `Container` ganha `knowledge: KnowledgeBase`. **Carregado na primeira leitura** de `container.knowledge` (getter preguiçoso que chama `loadKnowledgeBase()` uma vez e guarda), nunca na importação nem em `createContainer()`. `createContainer({ knowledge })` aceita override (testes passam `createMiniKnowledge()`). Mantém `config` e `clock` como estão.
  - `src/architecture.test.ts`: no mapa de R5 (pacote → pasta permitida), acrescente `yaml` → `src/infra/knowledge/`. Acrescente casos: `import { parse } from "yaml"` em `src/infra/knowledge/x.ts` válido; em `src/core/x.ts` → R1; em `src/infra/x.ts` → R5.
  - `next.config.ts`: incluir `data/**` no rastreamento de arquivos (`outputFileTracingIncludes: { "/**": ["./data/**/*"] }` ou a forma equivalente da versão instalada do Next; confira na doc instalada em `node_modules/next/dist/docs` ou nos tipos de `NextConfig`).
  - Os 11 arquivos `data/*.yaml` com o conteúdo `[]` e um comentário de uma linha no topo (`# <descrição curta> — schema em src/core/knowledge/schemas.ts`).
- testes primeiro:
  - `yaml-knowledge.test.ts`: escreve num diretório temporário do sistema (`fs.mkdtempSync(path.join(os.tmpdir(), "ritu-kb-"))`) os 11 arquivos com os dados de `miniDados` (de `@/infra/fakes/mini-knowledge`, serializados com `yaml.stringify`), e confere que `readDadosDaBase(dir)` devolve os mesmos dados; `loadKnowledgeBase(dir)` **lança** com erros `cobertura:` (mini não cumpre mínimos); arquivo ausente → `KnowledgeInvalidError` com o nome do arquivo; YAML malformado (`"- : ["`) → idem. Limpa o diretório no fim.
  - `container.test.ts`: importar o módulo e chamar `createContainer()` não lê `data/` (espie `loadKnowledgeBase` com `vi.mock` ou confira que nenhum erro acontece mesmo com `data/` vazia); `createContainer({ knowledge: createMiniKnowledge() }).knowledge.alimento("banana")` existe; manter os testes atuais.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes e build passam; `yaml` só aparece em `src/infra/knowledge/`.
- fora: conteúdo dos YAML, script `base:check`.

### T9 · Add the base:check script with a pure report
- nivel: mecanica
- objetivo: criar o comando `base:check`, que valida `data/` e imprime o relatório, com `--producao` falhando em `a_confirmar` ou fonte não aprovada.
- arquivos: `package.json`, `scripts/base-check.ts`, `scripts/lib/base-report.ts`, `scripts/lib/base-report.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Script `base:check`: `tsx scripts/base-check.ts`.
  - `scripts/base-check.ts`: lê com `readDadosDaBase()` — **atenção à regra R6**: scripts só podem importar `@/infra/container`, `@/infra/env` e `@/infra/fakes/**`. Então exponha a leitura pelo container: acrescente em `src/infra/container.ts` uma função exportada `readKnowledgeData(dir?: string): DadosDaBase` que delega para `readDadosDaBase` (e inclua `src/infra/container.ts` nos arquivos desta tarefa). Depois chama `validarBase(dados)` (de `@/core/knowledge/knowledge-base`) e `formatBaseReport`. Erro de leitura (`KnowledgeInvalidError`) → imprime os erros e sai com 1.
  - `scripts/lib/base-report.ts` exporta a função pura `formatBaseReport(resultado: { erros: string[]; avisos: string[]; contagens: Contagens }, dados: DadosDaBase, producao: boolean): { lines: string[]; exitCode: 0 | 1 }`. Imprime: contagem por arquivo; contagem por grupo de alimento; contagem por tipo de prática; número de linhas com `a_confirmar`; a lista de erros (ou "Erros: nenhum"). `exitCode` 1 se houver erro; com `producao`, também 1 se `contagens.aConfirmar > 0` ou houver fonte com `aprovada: false` (com uma linha explicando quantas).
- testes primeiro (`base-report.test.ts`, com `miniDados` e o resultado de `validarBase(miniDados, { cobertura: false })`): linhas trazem as contagens 16/4/6/2; sem erros → `exitCode 0` e "Erros: nenhum"; com um erro → 1 e o erro listado; `producao` com uma linha `a_confirmar` (altere uma cópia de `miniDados`) → 1; `producao` com fonte `aprovada: false` → 1; `producao` limpo → 0.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run base:check` (com `data/` vazia, deve listar erros `cobertura:` e sair com 1 — esperado neste ponto).
- pronto quando: testes passam e o comando roda.
- fora: conteúdo.

### C1 · Write vocabulary, avoid groups, states, doshas and discomforts
- nivel: conteudo
- objetivo: escrever `data/vocabulario.yaml`, `data/grupos_evitar.yaml`, `data/estados.yaml`, `data/doshas.yaml` e `data/incomodos.yaml`, com as fontes abertas registradas em `data/fontes.yaml`.
- arquivos: `data/vocabulario.yaml`, `data/grupos_evitar.yaml`, `data/estados.yaml`, `data/doshas.yaml`, `data/incomodos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1 a §3.1 (qualidades, doshas, momento, incômodos); `.docs/KNOWLEDGE.md` §8 e §9; `.docs/BUSINESS.md` §8 (só a tabela "Atalhos de check-in", para `rotulo` e `emoji`) e §12 (linguagem de conforto)
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schemas e "Regras de conteúdo"), mais:
  - `vocabulario.yaml` (exato):
    | `guna` | `nome` | `verbo` |
    |---|---|---|
    | `quente` | quente | aquece |
    | `frio` | frio | refresca |
    | `oleoso` | úmido | umedece |
    | `seco` | seco | seca |
    | `pesado` | nutritivo | nutre |
    | `leve` | leve | alivia o peso |
    | `estavel` | estável | assenta |
    | `movel` | estimulante | estimula |
    | `suave` | suave | suaviza |
    | `brando` | brando | acalma |
    | `intenso` | intenso | desperta |
    | `aspero` | áspero | `null` (nunca aparece como benefício) |
  - `grupos_evitar.yaml`: os 9 grupos (`amendoim`, `castanhas`, `leite`, `ovo`, `soja`, `trigo`, `gergelim`, `peixe`, `frutos_do_mar`), com `nome` para a tela e pelo menos 4 `palavras` cada (ex.: `frutos_do_mar`: camarão, lagosta, siri, caranguejo, marisco, lula, polvo, ostra). As palavras são como a pessoa diz, em português.
  - `estados.yaml`: os 7 estados (`com_frio`, `com_calor`, `pesada`, `seca`, `agitada`, `irritada`, `sem_energia`), com `rotulo` e `emoji` dos atalhos de check-in de `BUSINESS.md` §8 e as qualidades da tabela de `KNOWLEDGE.md` §3, já no vocabulário fechado; `evitar_marcas` só com `fruta_azeda`, `fruta_doce`, `fermentado`, `estimulante`.
  - `doshas.yaml`: 3 linhas; `gunas`, `equilibra_gunas` e `equilibra_rasas` iguais à tabela de `KNOWLEDGE.md` §2, no vocabulário fechado. Texto leve, sem promessa.
  - `incomodos.yaml`: os 7 de `KNOWLEDGE.md` §3.1 com ids `dor-de-cabeca` (variantes `latejante`, `tensa`, `pesada`, com `pergunta`), `estomago-pesado`, `gases`, `cansaco`, `dificuldade-para-dormir`, `nariz-entupido`, `colica-leve` (variantes conforme a tabela; uma só → id `unica`).
- testes primeiro: não se aplica (conteúdo). A validação é o `base:check`.
- comandos: `npm run base:check` (só erros `cobertura:` são aceitos; nenhum outro erro nestes 5 arquivos nem em `fontes.yaml`)
- pronto quando: os 5 arquivos completos, todas as linhas com fonte (página aberta ou `a_confirmar`), sem erro fora de `cobertura:`.
- fora: alimentos, preparos, práticas, quiz, combinações; qualquer código.

### C2 · Write the dosha quiz
- nivel: conteudo
- objetivo: escrever `data/quiz.yaml` com 8 perguntas, uma por tema.
- arquivos: `data/quiz.yaml`, `data/fontes.yaml`
- leitura: `.docs/BUSINESS.md` §13, só a linha "Quiz"; `.docs/KNOWLEDGE.md` §2, §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `PerguntaQuiz` e "Regras de conteúdo"). 8 perguntas, uma por tema de `TEMAS_QUIZ` (`corpo`, `pele`, `apetite_digestao`, `sono`, `clima`, `estresse`, `ritmo_energia`, `peso`); exatamente 3 opções, uma por dosha (`vata`, `pitta`, `kapha`); texto curto, em segunda pessoa, sem julgamento sobre corpo ou peso, sem pergunta de saúde (doença, gestação, remédio). Ids kebab-case (ex.: `quiz-corpo`).
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: 8 perguntas válidas, com fonte.
- fora: os demais arquivos.

### C3 · Write fruits and leafy greens (29 foods)
- nivel: conteudo
- objetivo: escrever em `data/alimentos.yaml` os alimentos dos grupos `frutas` (21) e `folhas` (8).
- arquivos: `data/alimentos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1, §2, §5.1, §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Alimento` e "Regras de conteúdo"), mais:
  - Ids e durabilidade: `frutas` (curta; `tamara`, `uva-passa` e `ameixa-seca`: longa): `banana`, `maca`, `pera`, `mamao`, `manga`, `laranja`, `tangerina`, `limao`, `abacate`, `abacaxi`, `melancia`, `melao`, `uva`, `morango`, `goiaba`, `maracuja`, `caqui`, `coco`, `tamara`, `uva-passa`, `ameixa-seca`. `folhas` (curta): `couve`, `espinafre`, `alface`, `rucula`, `agriao`, `repolho`, `acelga`, `escarola`.
  - `funcoes`: frutas com `fruta` (e outras se fizer sentido, ex.: `limao` também `tempero`, `coco` também `gordura`); folhas com `folha`. Lembre que cada vaga de preparo precisa de pelo menos 3 alimentos possíveis.
  - `marcas`: `fruta_azeda` e `fruta_doce` conforme a fonte.
  - Sinônimos comuns no Brasil (ex.: `tangerina`: mexerica, bergamota, ponkan; `mamao`: papaia).
  - **Acrescente** ao arquivo (que pode já ter linhas de outras tarefas); não altere linhas de outros grupos.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: os 29 ids presentes, válidos, com fonte.
- fora: outros grupos e arquivos.

### C4 · Write vegetables and roots (23 foods)
- nivel: conteudo
- objetivo: escrever em `data/alimentos.yaml` os grupos `legumes` (14) e `raizes` (9).
- arquivos: `data/alimentos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1, §2, §5.1, §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Alimento` e "Regras de conteúdo"), mais: `legumes` (curta): `abobora`, `abobrinha`, `chuchu`, `quiabo`, `tomate`, `pepino`, `vagem`, `berinjela`, `pimentao`, `brocolis`, `couve-flor`, `milho-verde`, `ervilha`, `jilo`. `raizes` (media): `cenoura`, `beterraba`, `batata-doce`, `batata`, `mandioca`, `inhame`, `mandioquinha`, `nabo`, `rabanete`. `abobora` com sinônimos `jerimum`, `abóbora cabotiá`, `moranga`; `mandioca`: aipim, macaxeira; `mandioquinha`: batata-baroa. `funcoes`: legumes com `legume`; raízes com `base` e/ou `legume`. Alimentos brasileiros fora das fontes entram com `confianca: baixa`. **Acrescente**; não altere outras linhas.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: os 23 ids presentes, válidos, com fonte.
- fora: outros grupos e arquivos.

### C5 · Write grains and legumes (20 foods)
- nivel: conteudo
- objetivo: escrever em `data/alimentos.yaml` os grupos `graos` (11) e `leguminosas` (9).
- arquivos: `data/alimentos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1, §2, §5.1, §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Alimento` e "Regras de conteúdo"), mais: `graos` (longa; `pao`: media): `arroz-branco`, `arroz-integral`, `aveia`, `fuba`, `cuscuz-de-milho`, `canjica`, `tapioca`, `farinha-de-mandioca`, `pao`, `macarrao`, `quinoa`. `leguminosas` (longa; `tofu`: media): `feijao-preto`, `feijao-carioca`, `feijao-fradinho`, `lentilha`, `lentilha-vermelha`, `grao-de-bico`, `feijao-mungo`, `ervilha-partida`, `tofu`. Regras fixas: `grupos_evitar` `trigo` em `pao` e `macarrao`; `soja` em `tofu`. `restricoes` `sem_gluten` em `pao`, `macarrao` e `aveia`. `funcoes`: grãos com `base`; leguminosas com `proteina`. **Acrescente**; não altere outras linhas.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: os 20 ids presentes, válidos, com fonte.
- fora: outros grupos e arquivos.

### C6 · Write dairy, eggs, nuts and seeds, and oils (21 foods)
- nivel: conteudo
- objetivo: escrever em `data/alimentos.yaml` os grupos `laticinios` (5), `ovos` (1), `oleaginosas` (10) e `oleos` (5).
- arquivos: `data/alimentos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1, §2, §5.1, §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Alimento` e "Regras de conteúdo"), mais:
  - Ids (durabilidade): `laticinios` (media): `leite`, `iogurte-natural`, `queijo-minas`, `ricota`, `manteiga`. `ovos` (media): `ovo`. `oleaginosas` (longa): `castanha-de-caju`, `castanha-do-para`, `amendoa`, `noz`, `amendoim`, `gergelim`, `linhaca`, `chia`, `semente-de-girassol`, `semente-de-abobora`. `oleos` (longa): `ghee`, `azeite`, `oleo-de-coco`, `oleo-de-gergelim`, `oleo-de-girassol`.
  - `grupos_evitar`: `leite` em todos os laticínios e no `ghee`; `ovo` no `ovo`; `amendoim` no `amendoim`; `castanhas` em `castanha-de-caju`, `castanha-do-para`, `amendoa` e `noz`; `gergelim` em `gergelim` e `oleo-de-gergelim`.
  - `restricoes`: `vegana` em laticínios, `ghee` e `ovo`; `sem_lactose` em laticínios, exceto `manteiga` (e `ghee`, que não é laticínio aqui).
  - `marcas`: `fermentado` em `iogurte-natural`.
  - `observacao`: `azeite` → "Prefira o extravirgem, prensado a frio."; `oleo-de-coco` e `oleo-de-girassol` → "Prefira o prensado a frio."; `oleo-de-gergelim` → "Prefira o prensado a frio e não torrado.".
  - `funcoes`: laticínios com `liquido` e/ou `proteina`/`gordura` conforme o caso (leite: `liquido`); `ovo`: `proteina`; oleaginosas: `proteina` e/ou `gordura`; óleos: `gordura`.
  - **Acrescente**; não altere outras linhas.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: os 21 ids presentes, válidos, com fonte, com as regras fixas.
- fora: outros grupos e arquivos.

### C7 · Write spices and herbs (27 foods)
- nivel: conteudo
- objetivo: escrever em `data/alimentos.yaml` o grupo `especiarias` (27).
- arquivos: `data/alimentos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1, §2, §5.1, §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Alimento` e "Regras de conteúdo"), mais: `especiarias` (longa; ervas frescas `hortela`, `coentro-fresco`, `salsinha`, `cebolinha`, `manjericao`, `pimenta-fresca`: curta; `gengibre`, `alho` e `cebola`: media): `gengibre`, `canela`, `cardamomo`, `cominho`, `coentro-em-grao`, `erva-doce`, `curcuma`, `pimenta-do-reino`, `cravo`, `noz-moscada`, `mostarda-em-grao`, `louro`, `anis-estrelado`, `pimenta-fresca`, `hortela`, `camomila`, `capim-limao`, `erva-cidreira`, `coentro-fresco`, `salsinha`, `cebolinha`, `manjericao`, `alecrim`, `oregano`, `alho`, `cebola`, `sal`. `funcoes`: `tempero` (e `legume` para `cebola`, se fizer sentido). Sinônimos: `curcuma`: açafrão-da-terra; `capim-limao`: capim-santo; `erva-doce`: funcho. Ervas usadas em chá (`camomila`, `capim-limao`, `erva-cidreira`, `hortela`) são ervas culinárias, não fitoterápico: nenhuma linguagem de tratamento. **Acrescente**; não altere outras linhas.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: os 27 ids presentes, válidos, com fonte.
- fora: outros grupos e arquivos.

### C8 · Write sweeteners, drinks and food combinations
- nivel: conteudo
- objetivo: escrever em `data/alimentos.yaml` os grupos `adocantes` (4) e `bebidas` (6), e `data/combinacoes.yaml` com pelo menos 8 linhas.
- arquivos: `data/alimentos.yaml`, `data/combinacoes.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §1, §2, §5.1, §5 (seção de `combinacoes.yaml`, se houver), §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schemas `Alimento`, `Combinacao` e "Regras de conteúdo"), mais:
  - `adocantes` (longa): `mel`, `acucar-mascavo`, `rapadura`, `melado`. `bebidas` (longa; `agua-de-coco` e `leite-de-coco`: media): `agua-de-coco`, `leite-de-coco`, `cafe`, `cha-preto`, `cha-mate`, `cha-verde`.
  - `restricoes` `vegana` em `mel`. `marcas` `estimulante` em `cafe`, `cha-preto`, `cha-mate` e `cha-verde`. `funcoes`: adoçantes com `adocante`; `leite-de-coco` com `liquido`; `agua-de-coco` com `liquido`; chás e café com `liquido`.
  - `combinacoes.yaml`: pelo menos 8 linhas, incluindo leite com fruta azeda (`["alimento:leite", "marca:fruta_azeda"]`), leite com banana, melão com qualquer outro alimento (modele como linhas que a validação aceite, ex.: `["alimento:melao", "grupo:<g>"]` para os grupos relevantes, ou o que a fonte disser), mel aquecido (como nota de preparo: ex. `["alimento:mel", "marca:..."]` só se fizer sentido no modelo de pares; senão registre o cuidado no texto das práticas de chá com mel e explique no relatório) e iogurte à noite só se a fonte trouxer. Itens só com `alimento:<id>` existentes, `grupo:<grupo>` de `GRUPOS` ou `marca:<marca>` de `MARCAS`. Nenhuma linha com carne ou peixe.
  - **Acrescente** em `alimentos.yaml`; não altere outras linhas.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos; ao fim desta tarefa os 130 alimentos devem existir e o erro `cobertura: alimentos` deve sumir)
- pronto quando: 10 alimentos e ≥ 8 combinações válidos, com fonte.
- fora: preparos, práticas.

### C9 · Write meal preparations, first batch (15)
- nivel: conteudo
- objetivo: escrever em `data/preparos.yaml` os 15 primeiros preparos.
- arquivos: `data/preparos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §5.2 (preparos), §6 ("Explicar"), §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Preparo` e "Regras de conteúdo"), mais:
  - Ids: `mingau`, `sopa`, `sopa-creme`, `caldo`, `arroz-papa`, `arroz-com-legume`, `kitchari`, `leguminosa-cozida`, `arroz-com-leguminosa`, `refogado`, `folhas-refogadas`, `legumes-no-vapor`, `legumes-assados`, `pure-de-raiz`, `raiz-cozida`.
  - `titulo` é o modelo do nome da refeição, com lacunas `{funcao}` das vagas (ex.: `arroz-com-legume`: "Arroz bem cozido com {legume} e {gordura}"); pelo menos uma lacuna de vaga obrigatória; até 60 caracteres. `passos` com os mesmos placeholders, até 400 caracteres, sem quantidade em gramas.
  - Vaga com `grupos` restringe quem a preenche (ex.: a `base` de `pure-de-raiz` só aceita `raizes`). Cada vaga precisa de **pelo menos 3** alimentos possíveis em `alimentos.yaml` (confira com `base:check`). Nenhum preparo combina laticínio com fruta.
  - `momento`: dos `MOMENTOS_DO_DIA` (`manha`, `almoco`, `tarde`, `jantar`, `noite`); `contraindicacoes`: dos `ESTADOS`.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: os 15 preparos válidos, com fonte.
- fora: os outros 15 preparos; práticas; alimentos (se uma vaga não fechar 3 alimentos, ajuste a vaga, não os alimentos, e relate).

### C10 · Write meal preparations, second batch (15)
- nivel: conteudo
- objetivo: escrever em `data/preparos.yaml` os outros 15 preparos.
- arquivos: `data/preparos.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §5.2, §6 ("Explicar"), §8 e §9
- skills: nenhuma
- referencia: nenhuma
- contratos: os mesmos de C9, com os ids: `salada-morna`, `salada-crua`, `fruta-cozida-com-especiaria`, `fruta-assada`, `fruta-fresca`, `ovo-mexido`, `omelete-com-legume`, `leite-morno-com-especiaria`, `iogurte-batido-com-especiaria`, `tapioca-recheada`, `cuscuz-no-vapor`, `torrada-com-gordura`, `macarrao-com-legume`, `polenta-mole`, `oleaginosas-de-molho`. `leite-morno-com-especiaria` precisa de uma vaga obrigatória que só aceite laticínios (para "evitar sempre: leite" tirá-lo). **Acrescente**; não altere os 15 já escritos.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos; ao fim, o erro `cobertura: preparos` some e os mínimos por estado e por momento de preparos devem ser atendidos)
- pronto quando: 30 preparos no arquivo, todos válidos.
- fora: práticas; alimentos.

### C11 · Write teas (20 practices)
- nivel: conteudo
- objetivo: escrever em `data/praticas.yaml` as 20 práticas do tipo `cha`.
- arquivos: `data/praticas.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §5.3 (inclusive a tabela "Inclui / Não inclui"), §8 e §9; `.docs/BUSINESS.md` §12
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Pratica` e "Regras de conteúdo"), mais: ids `cha-gengibre`, `cha-gengibre-canela`, `cha-gengibre-limao-mel`, `cha-canela`, `cha-canela-cardamomo`, `cha-cardamomo`, `cha-cravo-canela`, `cha-erva-doce`, `cha-cominho-coentro-erva-doce`, `cha-coentro-em-grao`, `cha-hortela`, `cha-hortela-erva-doce`, `cha-camomila`, `cha-camomila-erva-doce`, `cha-capim-limao`, `cha-capim-limao-hortela`, `cha-erva-cidreira`, `cha-curcuma-gengibre`, `cha-anis-estrelado`, `agua-morna-com-limao`. `ingredientes` só com ids de `alimentos.yaml` (ex.: `coentro-em-grao`, `erva-doce`, `cominho`). Chá com `mel` diz para juntar o mel só depois de amornar. Nenhuma quantidade em gramas, gotas ou "x vezes ao dia". `favorece_estados` 1 ou mais. `aviso`: "" ou texto curto quando houver cuidado conhecido.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` (só erros `cobertura:` aceitos)
- pronto quando: 20 chás válidos, com fonte.
- fora: óleos e práticas; outros arquivos.

### C12 · Write oil and daily practices (24 practices)
- nivel: conteudo
- objetivo: escrever em `data/praticas.yaml` as 7 práticas `oleo` e as 17 do tipo `pratica`.
- arquivos: `data/praticas.yaml`, `data/fontes.yaml`
- leitura: `.docs/KNOWLEDGE.md` §5.3 (inclusive a tabela "Inclui / Não inclui"), §8 e §9; `.docs/BUSINESS.md` §12
- skills: nenhuma
- referencia: nenhuma
- contratos: "Contratos comuns" (schema `Pratica` e "Regras de conteúdo"), mais:
  - `oleo` (7): `oleo-pes-gergelim`, `oleo-pes-coco`, `oleo-barriga-gergelim`, `oleo-corpo-gergelim`, `oleo-corpo-coco`, `oleo-corpo-girassol`, `oleo-couro-cabeludo-coco`. Ingredientes: o óleo correspondente (`oleo-de-gergelim`, `oleo-de-coco`, `oleo-de-girassol`). O `preparo` diz "óleo prensado a frio" e que é para uso na pele. Sem óleo essencial.
  - `pratica` (17, `ingredientes: []`): `agua-morna-ao-acordar`, `agua-morna-ao-longo-do-dia`, `caminhada-leve-apos-refeicao`, `caminhada-leve-de-manha`, `respiracao-lenta`, `pausa-em-silencio`, `alongamento-leve`, `pes-aquecidos`, `escalda-pes-morno`, `banho-morno`, `rosto-com-agua-fresca`, `bolsa-morna-na-barriga`, `comer-sentada-sem-tela`, `almoco-como-refeicao-principal`, `jantar-leve-e-cedo`, `telas-desligadas-antes-de-dormir`, `dormir-cedo`.
  - Nenhuma quantidade nem frequência ("x vezes ao dia"). Práticas leves, sem promessa.
  - **Acrescente**; não altere os chás.
- testes primeiro: não se aplica.
- comandos: `npm run base:check` — ao fim desta tarefa **zero erros** (inclusive `cobertura:`). Se algum mínimo por estado ou por momento não fechar, ajuste `favorece_estados`/`momento` das práticas desta tarefa (com coerência e fonte) e relate.
- pronto quando: 44 práticas no arquivo e `npm run base:check` com código 0.
- fora: alimentos, preparos (se faltar cobertura de preparo, relate em vez de editar).

### T10 · Add deterministic evals for the real knowledge base
- nivel: mecanica
- objetivo: criar os evals determinísticos da base real em `evals/det/base/`.
- arquivos: `evals/det/base/base-valida.eval.ts`, `evals/det/base/estados.eval.ts`, `evals/det/base/evitar-sempre.eval.ts`, `evals/det/base/restricoes.eval.ts`, `evals/det/base/substitutos.eval.ts`, `evals/det/base/combinacoes.eval.ts`, `evals/det/base/candidatos.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - A base real vem do container: `getContainer().knowledge` (`@/infra/container`; R6 permite). Funções de `@/core/knowledge/*` e tools de `@/core/agents/tools/ayurveda`.
  - Listas de ids esperadas (copie nos evals): os 130 alimentos (`frutas`: banana, maca, pera, mamao, manga, laranja, tangerina, limao, abacate, abacaxi, melancia, melao, uva, morango, goiaba, maracuja, caqui, coco, tamara, uva-passa, ameixa-seca; `folhas`: couve, espinafre, alface, rucula, agriao, repolho, acelga, escarola; `legumes`: abobora, abobrinha, chuchu, quiabo, tomate, pepino, vagem, berinjela, pimentao, brocolis, couve-flor, milho-verde, ervilha, jilo; `raizes`: cenoura, beterraba, batata-doce, batata, mandioca, inhame, mandioquinha, nabo, rabanete; `graos`: arroz-branco, arroz-integral, aveia, fuba, cuscuz-de-milho, canjica, tapioca, farinha-de-mandioca, pao, macarrao, quinoa; `leguminosas`: feijao-preto, feijao-carioca, feijao-fradinho, lentilha, lentilha-vermelha, grao-de-bico, feijao-mungo, ervilha-partida, tofu; `laticinios`: leite, iogurte-natural, queijo-minas, ricota, manteiga; `ovos`: ovo; `oleaginosas`: castanha-de-caju, castanha-do-para, amendoa, noz, amendoim, gergelim, linhaca, chia, semente-de-girassol, semente-de-abobora; `oleos`: ghee, azeite, oleo-de-coco, oleo-de-gergelim, oleo-de-girassol; `especiarias`: gengibre, canela, cardamomo, cominho, coentro-em-grao, erva-doce, curcuma, pimenta-do-reino, cravo, noz-moscada, mostarda-em-grao, louro, anis-estrelado, pimenta-fresca, hortela, camomila, capim-limao, erva-cidreira, coentro-fresco, salsinha, cebolinha, manjericao, alecrim, oregano, alho, cebola, sal; `adocantes`: mel, acucar-mascavo, rapadura, melado; `bebidas`: agua-de-coco, leite-de-coco, cafe, cha-preto, cha-mate, cha-verde); os 30 preparos (mingau, sopa, sopa-creme, caldo, arroz-papa, arroz-com-legume, kitchari, leguminosa-cozida, arroz-com-leguminosa, refogado, folhas-refogadas, legumes-no-vapor, legumes-assados, pure-de-raiz, raiz-cozida, salada-morna, salada-crua, fruta-cozida-com-especiaria, fruta-assada, fruta-fresca, ovo-mexido, omelete-com-legume, leite-morno-com-especiaria, iogurte-batido-com-especiaria, tapioca-recheada, cuscuz-no-vapor, torrada-com-gordura, macarrao-com-legume, polenta-mole, oleaginosas-de-molho); as 44 práticas (chás: cha-gengibre, cha-gengibre-canela, cha-gengibre-limao-mel, cha-canela, cha-canela-cardamomo, cha-cardamomo, cha-cravo-canela, cha-erva-doce, cha-cominho-coentro-erva-doce, cha-coentro-em-grao, cha-hortela, cha-hortela-erva-doce, cha-camomila, cha-camomila-erva-doce, cha-capim-limao, cha-capim-limao-hortela, cha-erva-cidreira, cha-curcuma-gengibre, cha-anis-estrelado, agua-morna-com-limao; óleos: oleo-pes-gergelim, oleo-pes-coco, oleo-barriga-gergelim, oleo-corpo-gergelim, oleo-corpo-coco, oleo-corpo-girassol, oleo-couro-cabeludo-coco; práticas: agua-morna-ao-acordar, agua-morna-ao-longo-do-dia, caminhada-leve-apos-refeicao, caminhada-leve-de-manha, respiracao-lenta, pausa-em-silencio, alongamento-leve, pes-aquecidos, escalda-pes-morno, banho-morno, rosto-com-agua-fresca, bolsa-morna-na-barriga, comer-sentada-sem-tela, almoco-como-refeicao-principal, jantar-leve-e-cedo, telas-desligadas-antes-de-dormir, dormir-cedo).
  - Evals:
    - `base-valida.eval.ts`: `validarBase` sem erros; os 130, 30 e 44 ids conferem exatamente (mesmo conjunto) com as listas; mínimos de `config.base` atendidos (contagens).
    - `estados.eval.ts`: cada estado e cada variante de incômodo devolve `presentes`/`buscadas` iguais às da linha; `com_calor` + `pesada` devolve conflito `quente`/`frio`; `dor-de-cabeca` sem variante devolve `precisa_variante` com 3 opções.
    - `evitar-sempre.eval.ts`: para cada um dos 9 grupos, nenhum alimento, preparo ou prática aprovado por `passaNoFiltro` contém item do grupo; grupo `leite` tira leite, iogurte-natural, queijo-minas, ricota, manteiga e ghee, o preparo `leite-morno-com-especiaria` e toda prática com esses ingredientes; grupo `gergelim` tira `oleo-pes-gergelim`, `oleo-barriga-gergelim` e `oleo-corpo-gergelim`; `peixe` e `frutos_do_mar` não tiram nada e não dão erro.
    - `restricoes.eval.ts`: `vegana` tira laticínios, ghee, ovo e mel e o que depende deles; `sem_gluten` tira pao, macarrao e aveia.
    - `substitutos.eval.ts`: canela → primeiro substituto tem `virya` quente e função `tempero`; com esse substituto em `nao_gosta`, ele some; com filtro que elimina todos os candidatos, lista vazia.
    - `combinacoes.eval.ts`: para cada linha de `combinacoes.yaml`, monta um par de exemplo (um alimento que casa cada item) e `checarCombinacao` acusa a linha.
    - `candidatos.eval.ts`: para cada estado, `ayurveda.candidatos` (com as `buscadas` de `qualidadesDoMomento` e `estados: [estado]`) devolve pelo menos 3 práticas e 3 preparos, todos com `linha_base` existente em `kb.linha` e nenhum com o estado em `contraindicacoes`.
- testes primeiro: são os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run base:check`
- pronto quando: `eval:det` passa com os 7 arquivos.
- fora: `data/` (se um eval falhar por conteúdo, relate exatamente a linha e o motivo; não edite os YAML).
