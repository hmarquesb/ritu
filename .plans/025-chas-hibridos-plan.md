# Plano · 025 · Chás híbridos

Spec: `.specs/025-chas-hibridos.md`. Decisões fora da spec: 025 A1 (água morna com limão vira `pratica`, escolha da dona) e 025 A2 (seed da demonstração com o padrão genérico), em `.plans/DECISOES-AUTONOMAS.md`.

## Tarefas

### T1 · Turn agua-morna-com-limao into a pratica
- nivel: mecanica
- objetivo: `agua-morna-com-limao` deixa de ser chá, para que toda prática `tipo: cha` tenha id com prefixo `cha-` (decisão da dona).
- arquivos: `data/praticas.yaml`, `config/base.ts`, `evals/det/base/base-valida.eval.ts` e qualquer teste que trave a contagem de chás/práticas por tipo (procure `minPraticas`, `praticasPorTipo`, `cha: 20`, `pratica: 17`)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos: em `data/praticas.yaml`, a linha `agua-morna-com-limao` passa de `tipo: cha` para `tipo: pratica` (id, ingredientes `[limao]` e o resto ficam iguais; o schema aceita prática com ingredientes). Mova a linha para junto das práticas do tipo `pratica` (perto de `agua-morna-ao-acordar`). `config/base.ts`: `minPraticas: { cha: 19, oleo: 7, pratica: 18 }`. Listas de ids esperadas por tipo nos testes/evals passam a refletir 19 chás e 18 práticas.
- testes primeiro: ajuste o teste que trava as contagens por tipo (19/7/18) antes de mexer no YAML.
- comandos: `npm test`, `npm run eval:det`, `npm run base:check`, `npm run lint`, `npm run typecheck`
- pronto quando: gates verdes; `base:check` mostra 19 chás, 7 óleos, 18 práticas.
- fora: `src/`, `alimentos.yaml`.

### T2 · Add the cha field and derive single-herb teas
- nivel: mecanica
- objetivo: campo opcional `cha` no schema de alimento e função pura `derivarChas`, com teste de tabela.
- arquivos: `src/core/knowledge/schemas.ts`, `src/core/knowledge/schemas.test.ts`, `src/core/knowledge/chas.ts` (novo), `src/core/knowledge/chas.test.ts` (novo), `config/chas.ts` (novo), `config/index.ts`
- depende de: nenhuma
- leitura: `.docs/KNOWLEDGE.md` §3 (tabela de estados) e §8.1 (R1, R2, R7)
- skills: nenhuma
- contratos:
  ```ts
  // schemas.ts
  export const PARTES_DE_CHA = ["folha", "flor", "semente", "casca", "raiz", "bebida"] as const
  export const chaDaErvaSchema = z.strictObject({
    parte: z.enum(PARTES_DE_CHA),
    aviso: z.string().max(200).optional(),
  })
  // em alimentoSchema, logo depois de `marcas`:
  cha: chaDaErvaSchema.optional(),

  // chas.ts
  export function idDoChaDerivado(erva: Alimento): string   // erva.id começa com "cha-" ? erva.id : `cha-${erva.id}`
  export function derivarChas(alimentos: readonly Alimento[], estados: readonly EstadoInfo[]): Pratica[]
  // um chá por alimento com `cha`, na ordem de `alimentos`
  ```
  Campos da prática derivada:
  | Campo | Valor |
  |---|---|
  | `id` | `idDoChaDerivado(erva)` |
  | `tipo` | `"cha"` |
  | `nome` | `erva.nome` se começa com "Chá"; senão `Chá de ${erva.nome em minúscula}` (ex.: "Chá de louro", "Chá preto") |
  | `ingredientes` | `[erva.id]` |
  | `preparo` | Pela `cha.parte`, texto em `config/chas.ts`. `folha` e `flor`: "Abafar {erva} em água quente por 5 a 10 minutos. Coar e beber morno." `semente`, `casca` e `raiz`: "Ferver {erva} em água por 5 a 10 minutos. Coar e beber morno." `bebida`: "Preparar sem açúcar e beber morno." `{erva}` = nome da erva em minúscula |
  | `gunas` | `erva.gunas` |
  | `efeito` | `erva.efeito` |
  | `contraindicacoes` | `["com_calor"]` se `virya: "quente"`; `["com_frio"]` se `virya: "frio"`; senão `[]` |
  | `favorece_estados` | Estados, na ordem de `ESTADOS` (`@/core/knowledge/vocab`), que não estão em `contraindicacoes`, cujo `favorecer` tem alguma guna da erva, cujo `evitar_gunas` não tem nenhuma guna da erva e cujo `evitar_marcas` não tem nenhuma marca da erva |
  | `momento` | Erva com marca `estimulante`: `["manha", "tarde"]`. Sem: os cinco momentos (`MOMENTOS_DO_DIA`, na ordem do vocab) |
  | `nunca_sugerir_se` | `erva.restricoes` |
  | `aviso` | `erva.cha.aviso ?? ""` |
  | `fontes` | `[...erva.fontes, { ref: "ritu-regras-da-base", campos: ["gunas", "efeito", "favorece_estados", "contraindicacoes", "momento"] }]` |
  | `confianca` | `erva.confianca` |

  `config/chas.ts` exporta os três textos de preparo (por grupo de parte), com `{erva}` como lacuna; exporte também pelo `config` de `config/index.ts` (siga o padrão dos outros textos).
- testes primeiro (`chas.test.ts`), com os dados reais (`data/alimentos.yaml` e `data/estados.yaml`, lidos como os outros testes de `src/core/knowledge` leem; os alimentos ganham `cha` no teste, porque o YAML ainda não tem): teste de tabela das seis ervas.
  | Erva (parte) | id | `favorece_estados` | `contraindicacoes` | `momento` |
  |---|---|---|---|---|
  | `louro` (folha) | `cha-louro` | com_frio, pesada, agitada, sem_energia | com_calor | todos |
  | `alecrim` (folha) | `cha-alecrim` | com_frio, pesada, sem_energia | com_calor | todos |
  | `manjericao` (folha) | `cha-manjericao` | pesada, sem_energia | com_frio | todos |
  | `cha-preto` (bebida) | `cha-preto` | pesada, sem_energia | com_calor | manha, tarde |
  | `cha-mate` (bebida) | `cha-mate` | pesada, sem_energia | com_calor | manha, tarde |
  | `cha-verde` (bebida) | `cha-verde` | pesada, sem_energia | com_calor | manha, tarde |
  Mais: nome ("Chá de louro", "Chá preto"), preparo por parte, `aviso` vindo de `cha.aviso`, fontes com `ritu-regras-da-base`, alimento sem `cha` não gera chá. `schemas.test.ts`: `cha` aceito com parte válida, recusado com parte fora da lista, com chave extra e com aviso > 200.
- comandos: `npm test -- src/core/knowledge`, `npm run lint`, `npm run typecheck`
- pronto quando: testes verdes; `derivarChas` pura, sem I/O.
- fora: `knowledge-base.ts`, `validate.ts`, `data/`.

### T3 · Validate and mount the derived teas in the knowledge base
- nivel: mecanica
- objetivo: a base valida o campo `cha`, passa a expor os chás derivados em `kb.praticas` e `kb.pratica(id)`, e as seis ervas ganham o campo.
- arquivos: `src/core/knowledge/validate.ts`, `src/core/knowledge/validate.test.ts`, `src/core/knowledge/knowledge-base.ts`, `src/core/knowledge/knowledge-base.test.ts`, `data/alimentos.yaml` (só o campo `cha` das seis ervas) e os testes/evals existentes que quebrarem porque a base real passa a ter 50 práticas (ex.: `evals/det/base/base-valida.eval.ts:235`, `src/infra/container.test.ts`)
- depende de: T1, T2
- leitura: nenhuma
- skills: nenhuma
- contratos: regras novas em `analisarBase` (`validate.ts`), com comentários `// Regra 14` a `// Regra 17`, depois da 13 (cobertura), e usando `derivarChas(d.alimentos, d.estados)` e `idDoChaDerivado` de `./chas`:
  - Regra 14: `cha` só em alimento do grupo `especiarias` ou `bebidas`. Mensagem com `alimentos:<id>`.
  - Regra 15: o id derivado não pode existir em `praticas.yaml` (o fixo nunca é substituído; colisão é erro). Mensagem com `alimentos:<id>` e o id.
  - Regra 16: `favorece_estados` derivado não pode sair vazio. Mensagem com `alimentos:<id>`.
  - Regra 17: prática `tipo: cha` tem id com prefixo `cha-`; prática de outro tipo, não. Mensagem com `praticas:<id>`.
  - A regra de cobertura (13) e as contagens continuam sobre os dados crus de `praticas.yaml`.
  `data/alimentos.yaml`: campo `cha` logo depois de `marcas`, só nestas ervas: `louro`, `alecrim` e `manjericao` com `cha: { parte: folha }`; `cha-preto`, `cha-mate` e `cha-verde` com `cha: { parte: bebida }`. Sem `aviso`.
  `knowledge-base.ts`, em `montar`: `const praticas = [...d.praticas, ...derivarChas(d.alimentos, d.estados)]`; `kb.praticas`, o índice de `kb.pratica(id)` e `kb.linha("praticas:<id>")` passam a incluir os derivados (os fixos primeiro).
- testes primeiro: um caso por regra nova (com fixture mínima, como os casos existentes de `validate.test.ts`), incluindo colisão de id e erva em grupo errado; `knowledge-base.test.ts`: com um alimento com `cha` na fixture, `kb.pratica("cha-<id>")` devolve o chá, `kb.praticas` tem fixos + derivados, e `kb.linha("praticas:cha-<id>")` acha a linha.
- comandos: `npm test`, `npm run eval:det`, `npm run base:check`, `npm run lint`, `npm run typecheck`
- pronto quando: gates verdes; a base real carrega com 50 práticas e `kb.pratica("cha-louro")` existe. Teste que quebrar por causa dos seis chás novos é ajustado ao comportamento novo (nunca apagado); se a mudança esperada não for óbvia, relate em vez de ajustar.
- fora: `praticas.yaml`, `chas.ts` (só importa), `.docs/`.

### T4 · Review the cha field of the six herbs and write rule R9
- nivel: conteudo
- objetivo: conferir o campo `cha` das seis ervas (já preenchido na T3) e documentar o campo e a regra R9.
- arquivos: `data/alimentos.yaml` (só o campo `cha` das seis ervas), `.docs/KNOWLEDGE.md`
- depende de: T3
- leitura: `.docs/KNOWLEDGE.md` §5.1, §5.3 e §8.1
- skills: nenhuma
- contratos: as seis ervas com `cha`: `louro`, `alecrim`, `manjericao` (`parte: folha`), `cha-preto`, `cha-mate`, `cha-verde` (`parte: bebida`). Confira a parte. `aviso` (até 200 caracteres, lido pela pessoa) só se houver cuidado conhecido **com fonte já em `fontes.yaml`**, e então acrescente o `campos` na fonte da erva; sem fonte, sem aviso. Nenhuma outra erva ganha `cha` (noz-moscada, alho, cebola, sal, cebolinha, coentro fresco, orégano, salsinha e pimenta-do-reino ficam sem).
  `.docs/KNOWLEDGE.md`: §5.1, o campo `cha` (`parte`: folha | flor | semente | casca | raiz | bebida; `aviso` opcional; só em `especiarias` e `bebidas`). §5.3: `praticas.yaml` tem 44 práticas (19 chás, 7 óleos, 18 práticas); a base monta mais um chá simples por erva com `cha` (6), 50 no total; o fixo vence (colisão de id é erro); toda prática `tipo: cha` tem id `cha-…`, e só ela; preparo do chá simples pela parte (textos em `config/chas.ts`). §8.1, regra nova, com este texto:
  > **R9. Chás simples pelas ervas.** Erva ou especiaria com o campo `cha` vira um chá de uma erva só, montado por código: gunas e efeito da erva (R1), contraindicação e momento pelo virya e pela marca `estimulante` (R2), e estados favorecidos pela tabela de §3, como nos hábitos (R7). O chá fixo de `praticas.yaml` vence o derivado.
  Descreva o produto como ele é (sem "agora", sem histórico). Não invente fonte.
- testes primeiro: nenhum.
- comandos: `npm run base:check`, `npm test -- src/core/knowledge`
- pronto quando: `base:check` sem erros; KNOWLEDGE.md com o campo, a contagem e a R9.
- fora: código, `praticas.yaml`.

### T5 · Make the tea pattern generic
- nivel: nucleo
- objetivo: o padrão de chá passa a ser `<estados>|cha`, sem erva.
- arquivos: `src/core/patterns/textos.ts`, `textos.test.ts`, `detectar.ts`, `detectar.test.ts`, `job.ts`, `job.test.ts`, `vale.ts`, `vale.test.ts` (todos em `src/core/patterns/`)
- depende de: nenhuma
- leitura: `.specs/012-rotina-e-padroes.md`, seções "Chave e frase do padrão" e "Detecção"
- skills: nenhuma
- contratos:
  ```ts
  export type ItemDoPadrao = { tipo: "pratica" | "preparo"; id: string } | { tipo: "cha" }
  // chaveDeAjuda(estados, { tipo: "cha" }) === `${estados em ordem unidos por "+"}|cha`
  // itemValido("cha") → { tipo: "cha" }; "pratica:<id>" e "preparo:<id>" seguem válidos
  export const MODELO_AJUDA_CHA = "Quando você está {estados}, um chá costuma te ajudar."
  export function fraseDeAjudaCha(estados: Estado[]): string   // mesmo texto de estados de fraseDeAjuda (NA_FRASE, ", " e " e ")
  ```
  - `job.ts`, `retornosDosRuns`: `sugestao.pratica_id` cuja prática em `kb.pratica(id)` é `tipo: "cha"` vira `{ tipo: "cha" }`; prática que não está na base é ignorada (não entra); outra prática segue `{ tipo: "pratica", id }`; preparo como hoje. A função passa a receber `kb`.
  - `detectar.ts`: a chave interna do item (`${tipo}:${id}`) vira `"cha"` para o item `cha`; grupo com item `cha` usa `fraseDeAjudaCha(estados)`; os outros seguem `fraseDeAjuda`.
  - `job.ts`, `estadosPorItem` e `semOsGuardados`: a chave do item `cha` é `"cha"`.
  - `vale.ts`, `padraoVale`: item `cha` vale se `kb.praticas.some(p => p.tipo === "cha" && passaNoFiltro(p, filtro, kb).passa)`.
  - A frase de padrões de preparo e de prática que não é chá não muda.
- testes primeiro: `textos`: chave e leitura de `com_frio+agitada|cha`, frase "Quando você está com frio e agitada, um chá costuma te ajudar."; `detectar`: 3 retornos `ajudou` com frio e agitada, um de `cha-gengibre-canela` e dois de outro chá, mapeados para `{tipo:"cha"}` → um padrão `com_frio+agitada|cha` com a frase de "um chá"; `job`: retorno de chá vira `cha`, de prática fora da base é ignorado, de prática não-chá segue `pratica:<id>`; `semOsGuardados` não propõe `…|cha` de novo se a conta já tem `…|cha` com o estado (inclusive `recusado`); `vale`: `cha` vale com algum chá no filtro e não vale quando todos os chás são barrados (ex.: kb de teste com um só chá e "evitar sempre" do ingrediente).
- comandos: `npm test -- src/core/patterns`, `npm run eval:det`, `npm run lint`, `npm run typecheck`
- pronto quando: testes e evals verdes.
- fora: `src/core/knowledge/`, migrações, seed.

### T6 · Seed the demo profile with the generic tea pattern
- nivel: mecanica
- objetivo: o perfil de demonstração grava o padrão `com_frio+agitada|cha`, não o do chá de gengibre com canela.
- arquivos: `seed/demo.yaml`, `src/core/demo-seed.ts`, `src/core/demo-seed.test.ts`, `src/core/accounts/copiar-seed.ts`, `src/core/accounts/copiar-seed.test.ts`, `evals/det/seguranca/demonstracao.eval.ts` (se travar o item ou a frase)
- depende de: T5
- leitura: nenhuma
- skills: nenhuma
- contratos: `padrao.item` do schema do seed passa a ser `z.union([z.strictObject({ tipo: z.enum(["pratica","preparo"]), id: z.string() }), z.strictObject({ tipo: z.literal("cha") })])`. `seed/demo.yaml`: `item: { tipo: cha }`. `demo-seed.ts`: a checagem de existência (`exige`) não se aplica ao item `cha`; `ehDoItemDoPadrao` para `cha` é `sugestao.pratica_id?.startsWith("cha-") === true` (toda prática `tipo: cha` tem id `cha-…`, e só ela). `copiar-seed.ts`: com item `cha`, `frase: fraseDeAjudaCha(estados)` (de `@/core/patterns/textos`); `chaveDeAjuda` já monta `…|cha`. Itens `pratica`/`preparo` seguem como hoje.
- testes primeiro: o seed real valida e cumpre o padrão (≥ `ocorrencias` conversas com os estados e um chá `ajudou`); `copiarSeed` grava a chave `com_frio+agitada|cha` e a frase "Quando você está com frio e agitada, um chá costuma te ajudar."
- comandos: `npm test`, `npm run eval:det`, `npm run lint`, `npm run typecheck`
- pronto quando: gates verdes.
- fora: `src/core/patterns/`.

### T7 · Migrate the stored tea pattern keys
- nivel: nucleo
- objetivo: migração `0005` converte as chaves `…|pratica:cha-*` gravadas para `…|cha`, junta duplicadas e reescreve a frase.
- arquivos: `db/migrations/0005_padroes_de_cha.sql` (novo), `test/db/` (teste novo ou caso novo no arquivo de padrões/migração existente)
- depende de: T5
- leitura: nenhuma
- skills: nenhuma
- contratos: em uma transação:
  1. Linhas de `padroes` com `tipo = 'ajuda_em_estado'` e `chave ~ '\|pratica:cha-'`: chave nova `split_part(chave, '|', 1) || '|cha'`.
  2. Por `(conta_id, chave nova)` (somando as linhas que **já** têm a chave nova, se houver), fica uma linha: status por prioridade `confirmado` > `recusado` > `candidato`; `ocorrencias` somadas; `criado_em` o menor; `decidido_em` o da linha mantida.
  3. Apagar as outras; gravar a chave nova e a frase nova, montada em SQL pelo modelo "Quando você está {estados}, um chá costuma te ajudar.", com os estados (separados por `+` na chave, já em ordem) pelos rótulos: com_frio → "com frio", com_calor → "com calor", pesada → "pesada", seca → "seca", agitada → "agitada", irritada → "irritada", sem_energia → "sem energia"; um estado: o rótulo; dois ou mais: os primeiros unidos por ", " e o último por " e ".
  Tabela: `padroes (id uuid, conta_id, tipo, chave, frase, ocorrencias int, status in ('candidato','confirmado','recusado'), criado_em, decidido_em, unique (conta_id, tipo, chave))`. Chaves de preparo e de prática que não começa com `cha-` não mudam. O `npm run db:migrate` aplica as pendentes em ordem.
- testes primeiro (`npm run test:db`, Postgres do `docker compose` já no ar): aplicar até a `0004`, inserir linhas de duas contas (uma com `com_frio+agitada|pratica:cha-gengibre-canela` `confirmado` 3 e `com_frio+agitada|pratica:cha-louro` `candidato` 2; outra com `recusado` + `candidato`; mais uma de preparo e uma `estados_juntos`), aplicar a `0005` e conferir: uma linha por chave nova, status certo, ocorrências somadas, menor `criado_em`, frase "Quando você está com frio e agitada, um chá costuma te ajudar.", demais linhas intactas. Se o harness de `test/db` não permitir parar na `0004`, monte o cenário rodando o SQL da `0005` depois de inserir as linhas antigas.
- comandos: `npm run test:db`, `npm test`, `npm run lint`
- pronto quando: `test:db` e `npm test` verdes.
- fora: código de `src/core/`.

### T8 · Add acompanhante.v7
- nivel: mecanica
- objetivo: prompt v7 do Acompanhante, com a linha de `padroes` que fala de "um chá".
- arquivos: `src/core/agents/prompts/acompanhante.v7.ts` (novo), `acompanhante.v7.test.ts` (novo), `src/core/agents/companion/agente.ts`, `src/core/agents/companion/agente.test.ts`, `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts`, `scripts/eval-llm.ts`, `scripts/lib/evals/eval-llm.test.ts` (só onde citam a v6 como a versão em uso)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- contratos: `acompanhanteV7` igual à `acompanhanteV6`, com `versao` "acompanhante.v7" (siga o formato da v6) e a linha de `padroes` trocada por:
  > - padroes: regularidades que a pessoa confirmou. Quando um padrão fala do momento de agora e o que ele aponta está entre os candidatos, dê preferência a ele e diga isso em uma frase. Quando o padrão fala de "um chá", escolha entre os chás candidatos o que casa com o momento e com a casa. Padrão não autoriza nada fora dos candidatos.
  Os usos da versão em uso (`agente.ts`, `conversar.ts`, `scripts/eval-llm.ts`) passam a importar `acompanhanteV7`. A v6 e o teste dela ficam (histórico de prompts).
- testes primeiro: `acompanhante.v7.test.ts` no molde do da v6, conferindo a linha nova e que o resto é igual à v6.
- comandos: `npm test`, `npm run lint`, `npm run typecheck`
- pronto quando: gates verdes.
- fora: `evals/resultados/` (gerados; não editar).

### T9 · Add the deterministic evals for derived teas and the generic pattern
- nivel: mecanica
- objetivo: evals determinísticos da 025.
- arquivos: `evals/det/base/chas-derivados.eval.ts` (novo), `evals/det/rotina-e-padroes/padrao-cha-generico.eval.ts` (novo), `evals/det/mapa.ts`, `.docs/QA.md` (lista de evals determinísticos, se o mapa exigir a linha)
- depende de: T3, T5
- leitura: `.docs/QA.md`, só a lista "Evals determinísticos"
- skills: nenhuma
- contratos (base real, sem rede; use os helpers de candidatos/filtro que os evals de `evals/det/base/` e `evals/det/acompanhante/` já usam):
  - `cha-derivado-campos`: `kb.praticas` tem 50 (44 fixas + 6 derivadas); `kb.pratica("cha-louro")` existe; tabela das seis ervas (`favorece_estados`, `contraindicacoes`, `momento`) igual à de T2.
  - `cha-derivado-frio-agitada`: momento `com_frio + agitada`, tarde, casa com louro e canela → `cha-louro` entre os candidatos de chá, `cha-gengibre-canela` não, e nenhum chá candidato com guna `movel`.
  - `cha-derivado-acabou`: louro como `acabou` (ou "não tenho") → `cha-louro` fora dos candidatos e a falta de louro registrada para o "vale ter em casa".
  - `cha-derivado-evitar-sempre`: "evitar sempre" de louro → `cha-louro` nunca é candidato.
  - `cha-estimulante-noite`: à noite, nenhum entre `cha-preto`, `cha-mate` e `cha-verde`; com `agitada`, nenhum deles em momento algum.
  - `padrao-cha-generico`: 3 retornos `ajudou` com frio e agitada (um de `cha-gengibre-canela`, dois de `cha-louro`) passando pelo job com stores em memória → um padrão `com_frio+agitada|cha` com a frase "Quando você está com frio e agitada, um chá costuma te ajudar."; `padraoVale` desse padrão é verdadeiro.
  `mapa.ts`: inclua os arquivos novos nas linhas certas (base/candidatos e padrões).
- testes primeiro: são os próprios evals.
- comandos: `npm run eval:det`, `npm test -- evals/det/mapa`, `npm run lint`, `npm run typecheck`
- pronto quando: evals verdes; `mapa.eval.ts` verde.
- fora: `src/`.

### T10 · Add the c3 LLM cases for the tea pattern
- nivel: mecanica
- objetivo: casos `c3-s23` e `c3-s24` do `c3-confiavel` (não rodar `eval:llm` real; só `--listar`).
- arquivos: `evals/llm/casos/c3/seguranca/23-padrao-cha-agitada.ts` (novo), `evals/llm/casos/c3/seguranca/24-cha-da-casa.ts` (novo), `evals/llm/casos/c3/index.ts`, e o teste que trava a contagem de casos do `c3`, se houver
- depende de: T3
- leitura: nenhuma
- skills: nenhuma
- contratos (molde: `evals/llm/casos/c3/memoria/07-cha-com-padrao.ts`; use `sugere` de `../memoria/expectativas` ou o equivalente):
  - `c3-s23-padrao-cha-agitada`, família `memoria`: padrão `confirmado` `{ tipo: "ajuda_em_estado", chave: "com_frio+agitada|cha", frase: "Quando você está com frio e agitada, um chá costuma te ajudar.", ocorrencias: 3 }`; estados `com_frio` e `agitada`, à tarde; casa com louro e gengibre (mais arroz, abóbora, ghee). **Deve:** terminou e uma sugestão de chá que passe no filtro (`cha-louro` ou outro chá candidato; se não houver helper "algum chá", crie um em `expectativas.ts` da pasta). **Não pode:** `cha-gengibre-canela`.
  - `c3-s24-cha-da-casa`, família `memoria`: `com_frio`, à noite, alecrim como única erva de casa (mais arroz, abóbora, ghee). **Deve:** terminou e `sugere("cha-alecrim")`. Critério incerto (LLM, `esperado: true`): "O texto cita o alecrim pelo nome?"
- testes primeiro: `npm run eval:llm -- --checkpoint c3-confiavel --listar` lista os dois.
- comandos: `npm test`, `npm run lint`, `npm run typecheck`, `npm run eval:llm -- --checkpoint c3-confiavel --listar`
- pronto quando: gates verdes; os dois casos listados.
- fora: `evals/resultados/`, qualquer chamada real a modelo.

### T11 · Close spec 025
- nivel: orquestrador
- ADR 0049 ("Chás simples derivados das ervas e padrão de chá genérico") e índice; `AI.md` na seção dos padrões, se citar o item; `.specs/README.md`, `ROADMAP.md` §0, `AGENTS.md` (status); spec `implemented` com hash; ⚠️ `db:migrate` em produção e deploy ficam com a dona (`BLOQUEIOS.md`).

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2, T5, T8 | Sem dependências e sem arquivo em comum |
| 2 | T3, T6 | T3 precisa de T1 e T2; T6 de T5. Arquivos distintos |
| 3 | T7 | Migração roda sozinha |
| 4 | T4, T9, T10 | Precisam da base com os derivados (T3) e do padrão (T5). Arquivos distintos |
