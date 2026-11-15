# Plano · Spec 004 · Dados e memória

Spec: `.specs/004-dados-e-memoria.md`. Tudo `mecanica`. O orquestrador cuida de três coisas no fechamento: `AGENTS.md`, `ARCHITECTURE.md` §6, a ADR "Suíte de contrato única" e a rodada ⚠️ `test:db`.

## Regras comuns a todas as tarefas

- **Contratos:** os contratos desta spec ficam na seção "Contratos" da spec (linhas 99 a 291: config, tabelas, `jsonb`, tipos, portas, funções puras, `ToolContext`, tools, scripts). A tarefa diz qual parte ler; leia só ela. Nomes de campos, tipos, métodos e funções ficam **exatamente** como lá, em português. O resto do código fica em inglês.
- Todo método de porta recebe `contaId` primeiro, e ele vai no `WHERE` de toda consulta. Exceções: os métodos marcados "sem contaId" na spec.
- Todo carimbo de tempo vem do `Clock`. Nada de `now()` no SQL. No core, nada de `new Date()` sem argumento nem `Date.now()` (regra R8).
- `src/core/` só importa `src/core/`, `@config/*` e `zod`. O pacote `postgres` só entra em `src/infra/db/` (regra R5). Scripts e evals só importam de infra `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` (regra R6).
- Reutilize o que já existe: `RituError`, `MissingEnvError` (`@/core/errors`); `Clock` (`@/core/clock`); `createFixedClock` (`@/infra/fakes/fixed-clock`); `requireEnv` (`@/infra/env`); `Guna`, `Estado`, `MomentoDoDia`, `Grupo`, `Durabilidade`, `Restricao` (`@/core/knowledge/vocab`); `EvitarItem`, `FiltroPessoa`, `passaNoFiltro` (`@/core/knowledge/filtros`); `Prakriti` (`@/core/knowledge/adequacao`); `normalizar` (`@/core/knowledge/identificar`); `KnowledgeBase` (`@/core/knowledge/knowledge-base`); `CidadeDaPessoa` (`@/core/weather/ports`); `config.clima.fusoPadrao`; `createMiniKnowledge` ou o nome equivalente em `@/infra/fakes/mini-knowledge`.
- Nenhuma tabela nem tipo tem campo de incômodo. Nada de e-mail fora de `contas`, telefone ou coordenada com mais de duas casas.
- Complexidade cognitiva ≤ 15 por função. Duplicação: `npm run dup` deve continuar com 0 clones em `src/` fora de fakes e testes.
- Rode `./node_modules/.bin/biome check --write <seus arquivos>` antes do lint. Se o filtro do `npm run lint` falhar ("JSON parse failed" ou saída vazia), confira com `rtk bypass npm run lint`.
- Não leia `.env.local` e não abra pastas fora do repositório. Arquivos temporários vão só no scratchpad, nunca em `/tmp` nem em `$TMPDIR`.
- Se um arquivo fora da lista da tarefa precisar mudar, pare e diga qual e por quê. Não commite.

## Decisões do plano (valem para todas as tarefas)

- **D1 · Onde ficam as suítes.**
  - As suítes de contrato ficam em `test/contracts/<area>.contract.ts`. Cada uma exporta `function <area>Contract(make: () => Promise<ContractEnv> | ContractEnv)`, que declara `describe`/`it` do Vitest.
  - `ContractEnv` fica em `test/contracts/env.ts`: `{ stores: Stores; tx: Transactor; clock: FixedClock; reset?: () => Promise<void> }`. `FixedClock` é o tipo devolvido por `createFixedClock`.
  - Os testes importam as suítes por caminho relativo.
  - Contra o fake, as suítes rodam em `src/infra/fakes/memory-stores.test.ts`, que entra no `npm test`.
  - Contra o Postgres, rodam em `test/db/stores.db.test.ts`, que só entra pelo `vitest.db.config.ts`.
- **D2 · Validação de alimento conhecido.** A validação "alimento conhecido" vem de fora. As fábricas recebem `opts?: { alimentoExiste?: (id: string) => boolean }`, e o padrão aceita qualquer id.
  - `pantry.registrar` com `alimento_id` em que `alimentoExiste` dá `false` trata o item como `nome_livre` (o id vira o nome) e soma em `alimentos_desconhecidos`.
  - O container passa `(id) => Boolean(knowledge.alimento(id))`.
  - Fábricas:
    - fake: `createMemoryStores(clock, opts?)`;
    - Postgres: `createPgStores(sql, clock, opts?)` e `createPgTransactor(sql, clock, opts?)`.
- **D3 · Scripts e banco.** Scripts não importam o pacote `postgres` nem `@/infra/db/*` (regras R5 e R6).
  - O container exporta `migrateDatabase(): Promise<string[]>`, que devolve as migrações aplicadas e delega a `src/infra/db/migrate.ts`.
  - O container exporta também `closeDatabase(): Promise<void>`.
  - `scripts/db-migrate.ts` e `scripts/cleanup.ts` só usam o container e o core.
- **D4 · Adaptadores Postgres.** Cada adaptador é uma fábrica `createPg<Nome>(sql: Sql | TransactionSql, clock: Clock, opts?)`.
  - O `Transactor` usa `sql.begin(tx => fn(createPgStores(tx, clock, opts)))`.
  - Erro de conexão do driver (`ECONNREFUSED`, `ENOTFOUND`, `CONNECTION_*`) vira `RituError("banco_indisponivel", "Banco indisponível")`, sem a URL na mensagem.
  - Violação do índice único parcial de run aberto (`23505`) vira `RunAbertoError`.
- **D5 · Schema de teste.** `test:db` usa o schema `ritu_test`.
  - No `beforeAll`, o runner faz `DROP SCHEMA IF EXISTS ritu_test CASCADE; CREATE SCHEMA ritu_test` e aplica as migrações com `search_path=ritu_test`.
  - Antes de cada teste, `reset` faz `TRUNCATE` em todas as tabelas, menos `_migracoes`.
  - O cliente aceita `createDbClient({ url?, schema? })`. Sem `url`, lê `DATABASE_URL` por `requireEnv` na primeira consulta. Com `schema`, usa `connection: { search_path: schema }`.

---

### T1 · Add memory config and the pure date and pantry-state functions
- nivel: mecanica
- objetivo: criar `config/memoria.ts`, `config/casa.ts` e as funções puras `diaLocal`, `diasAtras` e `estadoDoItem`.
- arquivos: `config/memoria.ts`, `config/casa.ts`, `config/index.ts`, `config/index.test.ts`, `src/core/time/dia-local.ts`, `src/core/time/dia-local.test.ts`, `src/core/pantry/types.ts`, `src/core/pantry/estado.ts`, `src/core/pantry/estado.test.ts`
- leitura: spec 004, "Contratos" → "Configuração", a linha `casa` da tabela, "Funções puras" (só `estado.ts` e `dia-local.ts`); `.docs/BUSINESS.md` §9 "Minha casa" (linhas 192 a 222)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `config/index.ts` exporta `memoria` e `casa` junto com o que já exporta.
  - `src/core/pantry/types.ts`: `ItemDaCasa = { id: string; conta_id: string; alimento_id: string | null; nome_livre: string | null; nome_normalizado: string | null; estado: "tem" | "acabou"; sempre_tenho: boolean; confirmado_em: string /* ISO */; origem: "conversa" | "tela" | "pergunta" }`.
  - `estadoDoItem(item, agora, durabilidade)`:
    - `estado === "acabou"` → `acabou`. Isso vale antes de tudo, inclusive para `sempre_tenho`.
    - `sempre_tenho` → `sempre_tenho`.
    - Caso contrário, conta os dias inteiros desde `confirmado_em`: `Math.floor((agora - confirmado_em) / 86_400_000)`. Se passar de `config.casa.validadeDias[durabilidade ?? config.casa.durabilidadeDesconhecido]`, o item é `incerto`; se não, `confirmado`.
  - `diaLocal(agora, fuso?)` devolve `"AAAA-MM-DD"` pelo `Intl.DateTimeFormat("en-CA", { timeZone, year, month, day })`. Sem fuso, ou com fuso inválido (`RangeError`), usa `config.clima.fusoPadrao`.
  - `diasAtras(dia, n)` subtrai `n` dias de calendário de `"AAAA-MM-DD"`, calculando em UTC.
- testes primeiro:
  - Curta, confirmado há 5 dias → `confirmado`; há 6 → `incerto`. Média: 14 → `confirmado`, 15 → `incerto`. Longa: 90 → `confirmado`, 91 → `incerto`.
  - `sempre_tenho` há 400 dias → `sempre_tenho`. `acabou` → `acabou`. `durabilidade` `undefined` segue a regra de média (14 e 15).
  - `diaLocal(new Date("2026-01-15T02:30:00Z"), "America/Sao_Paulo") === "2026-01-14"`; com `"Europe/Lisbon"` → `"2026-01-15"`; com fuso inválido, usa o padrão.
  - `diasAtras("2026-03-01", 1) === "2026-02-28"`; `diasAtras("2026-01-01", 7) === "2025-12-25"`.
  - `config.memoria.mensagensDias === 7`; `config.casa.validadeDias.curta === 5`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam.
- fora: portas, banco, fakes.

### T2 · Add the domain types, ports, jsonb schemas and RunAbertoError
- nivel: mecanica
- objetivo: criar os tipos de domínio, as 11 portas, `Stores`, `Transactor`, `RunAbertoError` e os schemas zod dos campos `jsonb`.
- arquivos: `src/core/accounts/types.ts`, `src/core/accounts/ports.ts`, `src/core/pantry/ports.ts`, `src/core/pantry/types.ts` (só acrescentar), `src/core/preferences/ports.ts`, `src/core/outcomes/ports.ts`, `src/core/shortages/ports.ts`, `src/core/routine/ports.ts`, `src/core/patterns/ports.ts`, `src/core/messages/ports.ts`, `src/core/runs/ports.ts`, `src/core/runs/errors.ts`, `src/core/proposals/ports.ts`, `src/core/stores.ts`, `src/core/memory-schemas.ts`, `src/core/memory-schemas.test.ts`, `src/core/runs/errors.test.ts`
- leitura: spec 004, "Contratos" → "Tabelas", o parágrafo de `runs.momento`/`retornos.sugestao`, "Tipos de domínio" e "Portas"
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Um tipo por tabela, com os campos iguais às colunas. `timestamptz` vira `string` ISO, `date` vira `string` `"AAAA-MM-DD"` e `numeric(5,2)` vira `number`.
  - Os tipos que as portas nomeiam: `Conta`, `Perfil` (com `evitar_sempre: (EvitarItem & { desde: string })[]`), `ItemDaCasa`, `Preferencia`, `ItemTipo`, `Retorno`, `SugestaoRegistrada` (o `retornos.sugestao`), `ItemDaLista`, `NotaDeRotina`, `ResumoDeRotina`, `Padrao`, `StatusPadrao`, `Mensagem`, `Run`, `RunMutavel`, `RunEtapa`, `NovaEtapa`, `Caminho`, `StatusRun`, `Proposta`.
  - `RunMutavel` são os campos de `runs` que não são `id`, `conta_id`, `criado_em` nem `dia`. `NovaEtapa` é `RunEtapa` sem `run_id`, `ordem` nem `criado_em`.
  - `src/core/stores.ts` exporta `Stores` e `Transactor`, exatamente como na spec.
  - `RunAbertoError extends RituError` usa `code "run_aberto"`, com mensagem livre em português.
  - `src/core/memory-schemas.ts` exporta os schemas zod:
    - `momentoSchema` (`.strict()`: campo a mais é recusado);
    - `sugestaoRegistradaSchema`;
    - `prakritiSchema` (`{vata, pitta, kapha}`, números de 0 a 1 que somam 1 ± 0,01);
    - `evitarSempreSchema`;
    - `naoComeSchema`.
- testes primeiro:
  - `momentoSchema` aceita `{ estados: ["cansaco"], momento_do_dia: "manha", gunas_buscadas: ["quente"] }`, com valores válidos do vocabulário. Recusa o mesmo objeto com `incomodo: "dor"` e com `com_incomodo: true`.
  - `prakritiSchema` recusa uma soma de 0,8.
  - `new RunAbertoError().code === "run_aberto"` e é `instanceof RituError`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os testes passam e o typecheck passa.
- fora: implementações, banco.

### T3 · Add contract suites and the memory fake for accounts, profiles, pantry, shortages and preferences
- nivel: mecanica
- objetivo: escrever as suítes de contrato dessas cinco portas e o fake em memória que as cumpre.
- arquivos: `test/contracts/env.ts`, `test/contracts/accounts.contract.ts`, `test/contracts/profiles.contract.ts`, `test/contracts/pantry.contract.ts`, `test/contracts/shortages.contract.ts`, `test/contracts/preferences.contract.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/fakes/memory-stores.test.ts`
- leitura: spec 004, "Critérios de aceite", "Contratos" → "Portas" e "Edge cases e modos de falha"; `.docs/BUSINESS.md` §9 "O que fez falta" (linhas 238 a 253)
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha "Autorização por conta no repositório"
- contratos:
  - D1 e D2.
  - `createMemoryStores(clock, opts?)` devolve `Stores & Transactor`, com um estado só. Os ids vêm de `crypto.randomUUID()`. A transação do fake é uma cópia do estado: se `fn` lança, o estado volta ao de antes.
  - Nesta tarefa, as seis portas restantes podem ficar como stubs que lançam `new Error("não implementado")`. A T4 as completa.
  - Regras desta tarefa:
    - `accounts.buscar` de demo com `expira_em <= agora` → `undefined`. `apagarDemosVencidas` apaga essas demos e devolve a quantidade.
    - `profiles.ler` sem linha devolve o perfil vazio: listas vazias e o resto `null`. `definirCidade` arredonda `lat`/`lon` para 2 casas.
    - `acrescentarEvitarSempre` não duplica (mesmo `tipo` e `valor` normalizado) e carimba `desde` com a data ISO do relógio.
    - `removerEvitarSempre(contaId, item, { confirmado: true })` remove. Sem `confirmado: true`, o tipo não compila, e em tempo de execução lança `RituError("confirmacao_necessaria", …)`.
    - Os métodos de `evitarTemporario` são por dia.
    - `pantry.registrar`:
      - item novo → `estado: "tem"`, `confirmado_em` = agora;
      - item que já existe (mesmo `alimento_id`, ou mesmo `nome_normalizado`) → volta para `tem` com nova data;
      - nome livre → soma 1 em `alimentos_desconhecidos[normalizar(nome)]`;
      - para cada `alimento_id`, apaga as faltas dele e o tira de `lista_ter_em_casa`, no mesmo passo.
    - `marcarAcabou` → `estado: "acabou"`. `definirSempreTenho` e `tirar` agem por `itemId` e conta. `desconhecidos(limite)` ordena por `vezes` decrescente.
    - `shortages.registrar` é idempotente por (conta, alimento, dia).
    - `diasComFalta(contaId, desdeDia)` devolve um item por alimento com `dias` = dias distintos `>= desdeDia` e o `ultimo_dia`.
    - `porNaLista` faz upsert por `alimento_id`. `apagarFaltasAntesDe(dia)` apaga as faltas com `dia < dia`.
    - `preferences.contarResultado` soma no contador. `ajudou` e `nao_ajudou` entram no início de `ultimos_resultados`, que fica com até 2; `nao_fez` não entra. `definirGosto` não mexe em contador.
    - `ler(contaId)` sem itens devolve todas; com itens, só as pedidas que existem.
    - `marcarSugerido` carimba `ultima_sugestao_em`. `contagem` conta as preferências com gosto e as com algum resultado.
  - Autorização: em toda suíte, um teste grava com a conta A e lê, altera e apaga com a conta B. B lê vazio e A continua intacta.
- testes primeiro: as suítes acima, cobrindo os critérios de aceite dessas portas e os edge cases de `registrar`. `memory-stores.test.ts` chama cada `<area>Contract(() => ({ stores, tx, clock }))` com `createFixedClock("2026-01-15T12:00:00Z")`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run dup`
- pronto quando: as cinco suítes passam contra o fake.
- fora: Postgres, as outras seis portas (só stubs), tools.

### T4 · Add contract suites and the memory fake for outcomes, routine, patterns, messages, runs, proposals, transaction and account deletion
- nivel: mecanica
- objetivo: completar o fake com as seis portas restantes, a transação e o `accounts.apagar` em cascata, com as suítes de contrato.
- arquivos: `test/contracts/outcomes.contract.ts`, `test/contracts/routine.contract.ts`, `test/contracts/patterns.contract.ts`, `test/contracts/messages.contract.ts`, `test/contracts/runs.contract.ts`, `test/contracts/proposals.contract.ts`, `test/contracts/transactor.contract.ts`, `test/contracts/delete-account.contract.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/fakes/memory-stores.test.ts`
- leitura: spec 004, "Critérios de aceite", "Contratos" → "Portas" e "Edge cases e modos de falha"
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - D1 e D2. Siga o padrão das suítes da T3 (`test/contracts/env.ts`).
  - `outcomes.criar` grava `status: "aguardando"`, valida `sugestao` com `sugestaoRegistradaSchema` e devolve os registros. `pendentes` devolve os `aguardando`, o mais recente primeiro.
  - `responder` só muda um retorno `aguardando`: grava `resultado`, `origem` e `respondido_em`. Já respondido → devolve o estado atual. Inexistente → `undefined`. `apagarAguardandoAntesDe(limite)` só apaga `aguardando` com `criado_em < limite`.
  - `routine.anotar` limita o texto a 200 caracteres (`RituError("texto_longo")` acima disso). `gravarResumo` usa versão = anterior + 1 e limite de `config.memoria.resumoRotinaCaracteres`. `resumo` devolve a versão mais nova.
  - `patterns.propor`: se já existe (conta, tipo, chave), recusado ou não, devolve `undefined`. Senão, cria como `candidato`. `decidir` carimba `decidido_em`.
  - `messages.gravar`, `doDia` (em ordem de `criado_em`) e `marcarIncomodoDoRun` (marca `com_incomodo` em todas as mensagens do run). `apagarAntesDe(limite)` usa `criado_em < limite`. `apagarComIncomodoAntesDoDia(dia)` usa `com_incomodo && dia < dia`.
  - `runs.criar` com outro run da conta em `running`, `waiting_for_input` ou `waiting_for_approval` → `RunAbertoError`. Os padrões de um run novo: `status: "running"`, contadores 0, `modelos: {}`, `com_incomodo: false`.
  - `atualizar` valida `momento` com `momentoSchema`. `acrescentarEtapa` usa `ordem` = última + 1. `recentes(contaId, desde, limite)` traz só `done`, com `criado_em >= desde`, os mais novos primeiro.
  - `contarMensagensDoDia` conta as mensagens da conta no dia com `autor: "pessoa"`. `votar` faz upsert em `feedback`.
  - `expirarEmEsperaAntesDe(limite)` passa a `expired` os runs em `waiting_for_input` ou `waiting_for_approval` com `atualizado_em < limite` e devolve os ids.
  - `proposals.decidir` só muda uma proposta `pendente` (carimba `decidida_em`); fora disso, devolve o estado atual. `recusadas(contaId, tool)` lista as recusadas daquela tool. `expirarDosRuns(ids)` passa as pendentes desses runs a `expirada`.
  - `tx.emTransacao(fn)`: se `fn` lança, nada do que ela gravou fica.
  - `accounts.apagar(contaId)` remove a conta e todas as linhas dela. Os runs ficam com `conta_id: null` e `saida`, `checkpoint`, `pendencia` e `clima_usado` nulos. As etapas desses runs ficam com `resumo: null`.
  - Autorização: o mesmo teste A/B da T3, em cada porta nova.
- testes primeiro: as suítes acima, incluindo um run aberto por conta, a transação desfeita e o apagar conta conferido em todas as portas.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run dup`
- pronto quando: todas as suítes passam contra o fake, sem nenhum stub restante.
- fora: Postgres, limpeza, tools.

### T5 · Add the postgres driver, the initial migration, the lazy client and db:migrate
- nivel: mecanica
- objetivo: instalar o `postgres`, escrever `db/migrations/0001_inicial.sql`, o cliente preguiçoso, o aplicador de migrações e o script `db:migrate`.
- arquivos: `package.json`, `package-lock.json`, `db/migrations/0001_inicial.sql`, `src/infra/db/client.ts`, `src/infra/db/client.test.ts`, `src/infra/db/migrate.ts`, `src/infra/db/errors.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`, `scripts/db-migrate.ts`
- leitura: spec 004, "Contratos" → "Tabelas" (texto inteiro, com FKs, unicidades e o índice parcial) e "Scripts"
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha "Driver `postgres` e SQL puro"
- contratos:
  - D3 e D5. Instale `npm install postgres@latest`, a versão estável mais recente.
  - A migração tem as 17 tabelas da spec, com colunas, tipos, `CHECK` dos textos enumerados e de "exatamente um entre `alimento_id` e `nome_livre`", FKs (`ON DELETE CASCADE`; `runs.conta_id` com `ON DELETE SET NULL`; `run_etapas.run_id` e `feedback.run_id` em cascata para `runs`), unicidades e o índice único parcial de run aberto.
  - Os ids usam `uuid default gen_random_uuid()`. Nenhuma coluna tem `default now()`: o tempo vem do código.
  - `migrate.ts`:
    - cria `_migracoes (nome text pk, aplicada_em timestamptz)`;
    - lê `db/migrations/*.sql` em ordem de nome;
    - aplica cada migração pendente numa transação e registra o nome dela;
    - devolve os nomes aplicados;
    - rodar de novo devolve `[]`.
  - `client.ts`:
    - `createDbClient({ url?, schema? })` devolve um objeto com `sql` preguiçoso (a conexão só abre na primeira consulta; sem `url`, `requireEnv("DATABASE_URL")` também só é lido aí) e `close()`;
    - `isConnectionError(e)` e `toDbError(e)` traduzem para `RituError("banco_indisponivel")`, sem a URL na mensagem.
  - `scripts/db-migrate.ts` chama `migrateDatabase()` do container, imprime "Aplicadas: …" ou "Nada a aplicar" e fecha a conexão.
  - O script em `package.json` é `"db:migrate": "node --env-file-if-exists=.env.local --import tsx scripts/db-migrate.ts"`.
- testes primeiro (sem banco):
  - importar `client.ts` ou o container não lê `DATABASE_URL` e não abre conexão;
  - `toDbError` de um erro `ECONNREFUSED` cuja mensagem contém a URL devolve `code "banco_indisponivel"`, e a mensagem não contém `postgres://`;
  - a migração não contém `now()` nem colunas de incômodo (teste que lê o arquivo SQL);
  - as 17 tabelas aparecem no SQL.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`. Com o Docker no ar (`docker compose up -d postgres`), rode também `DATABASE_URL=postgres://ritu:ritu@localhost:5432/ritu npm run db:migrate` duas vezes: a primeira aplica e a segunda não faz nada. Banco local é permitido nesta tarefa.
- pronto quando: os gates passam e o `db:migrate` local aplica e é idempotente.
- fora: adaptadores das portas.

### T6 · Add the Postgres adapters for accounts, profiles, pantry, shortages and preferences, and test:db
- nivel: mecanica
- objetivo: implementar os adaptadores Postgres dessas cinco portas e o runner `test:db`, que roda as suítes da T3 contra o Postgres.
- arquivos: `src/infra/db/accounts.ts`, `src/infra/db/profiles.ts`, `src/infra/db/pantry.ts`, `src/infra/db/shortages.ts`, `src/infra/db/preferences.ts`, `src/infra/db/mappers.ts`, `src/infra/db/stores.ts`, `test/db/stores.db.test.ts`, `vitest.db.config.ts`, `package.json`
- leitura: spec 004, "Contratos" → "Portas" e "Tabelas"; as suítes já escritas em `test/contracts/`
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linhas "Autorização por conta no repositório" e "Driver `postgres` e SQL puro"
- contratos:
  - D1, D2, D4 e D5. SQL puro com tagged templates do `postgres`, sem ORM.
  - Todo `jsonb` é validado com os schemas de `@/core/memory-schemas` na escrita e na leitura.
  - Nesta tarefa, `createPgStores` monta as cinco portas reais. As outras seis ficam como stubs que lançam `"não implementado"`, até a T7.
  - `pantry.registrar` faz as escritas (casa, `alimentos_desconhecidos`, faltas, lista) numa transação: `sql.begin` se `sql` não for de transação; dentro de uma, direto.
  - `"test:db": "vitest run --config vitest.db.config.ts"`. O config usa os mesmos aliases do `vitest.config.ts`, `include: ["test/db/**/*.db.test.ts"]` e `fileParallelism: false`.
  - O runner usa `DATABASE_URL` do ambiente, com padrão `postgres://ritu:ritu@localhost:5432/ritu`. Ele cria o schema `ritu_test`, aplica as migrações e chama as cinco suítes com `reset`.
- testes primeiro: as suítes da T3 já existem. Rode `npm run test:db` com o Docker no ar e faça passar.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run dup`, `npm run test:db` (banco local permitido)
- pronto quando: as cinco suítes passam no Postgres e os gates padrão continuam verdes.
- fora: as outras seis portas, container, limpeza.

### T7 · Add the remaining Postgres adapters, the transactor and the container stores
- nivel: mecanica
- objetivo: implementar os adaptadores Postgres de outcomes, routine, patterns, messages, runs e proposals, o `Transactor`, o `accounts.apagar` com anonimização, e ligar `stores` e `tx` no container.
- arquivos: `src/infra/db/outcomes.ts`, `src/infra/db/routine.ts`, `src/infra/db/patterns.ts`, `src/infra/db/messages.ts`, `src/infra/db/runs.ts`, `src/infra/db/proposals.ts`, `src/infra/db/transactor.ts`, `src/infra/db/accounts.ts`, `src/infra/db/stores.ts`, `src/infra/db/mappers.ts`, `test/db/stores.db.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts`
- leitura: spec 004, "Contratos" → "Portas" e "Tabelas"; as suítes em `test/contracts/`
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha "Driver `postgres` e SQL puro"
- contratos:
  - D2, D3 e D4.
  - `accounts.apagar` roda numa transação:
    - anonimiza os runs da conta (`conta_id`, `saida`, `checkpoint`, `pendencia` e `clima_usado` nulos);
    - zera `resumo` nas etapas desses runs;
    - apaga a conta, e a cascata leva o resto.
  - `runs.criar` traduz o `23505` do índice parcial em `RunAbertoError`.
  - O `Container` ganha `stores: Stores` e `tx: Transactor`, preguiçosos e com override aceito (como `weather`), mais as funções `migrateDatabase()` e `closeDatabase()` da D3. Para `alimentoExiste`, usa `(id) => Boolean(this.knowledge.alimento(id))`, resolvido na primeira chamada.
  - Importar o container não abre conexão.
  - O runner `test/db/stores.db.test.ts` passa a chamar todas as suítes.
  - O runner ganha dois testes próprios, com SQL direto, porque nenhuma porta lê esses efeitos:
    1. Depois de `accounts.apagar`, os runs da conta ficam com `conta_id`, `saida`, `checkpoint`, `pendencia` e `clima_usado` nulos, e as etapas ficam com `resumo` nulo. Nenhuma tabela com `conta_id` tem linha da conta.
    2. `runs.votar` grava uma linha em `feedback` e, chamado de novo, atualiza o voto.
- testes primeiro: `container.test.ts` cobre três casos: `createContainer({ stores, tx })` com o fake devolve o override; criar o container e ler `stores` não lê `DATABASE_URL` até a primeira consulta; todas as suítes de `test/contracts/` passam no `npm run test:db`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run dup`, `npm run test:db` (banco local permitido)
- pronto quando: todas as suítes passam contra o fake e contra o Postgres.
- fora: limpeza, tools, CI.

### T8 · Add the daily cleanup function and script
- nivel: mecanica
- objetivo: criar `executarLimpeza` no core e o script `cleanup`.
- arquivos: `src/core/cleanup.ts`, `src/core/cleanup.test.ts`, `scripts/cleanup.ts`, `package.json`
- leitura: spec 004, critério de aceite "Limpeza diária" e "Contratos" → "Funções puras" (`cleanup.ts`) e "Scripts"
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `executarLimpeza({ stores, clock })` devolve `ResultadoLimpeza`. Com `hoje = diaLocal(clock.now())` (fuso padrão) e `agora = clock.now()`, a limpeza faz:
    1. `mensagens = messages.apagarAntesDe(agora - mensagensDias)`;
    2. `mensagens_com_incomodo = messages.apagarComIncomodoAntesDoDia(hoje)`;
    3. `retornos = outcomes.apagarAguardandoAntesDe(agora - retornosDias)`;
    4. `faltas = shortages.apagarFaltasAntesDe(diasAtras(hoje, faltasDias))`;
    5. `evitar_temporario` = os temporários com `dia < hoje`;
    6. `ids = runs.expirarEmEsperaAntesDe(agora - esperaMinutos)`, com `runs_expirados = ids.length` e `propostas_expiradas = proposals.expirarDosRuns(ids)`;
    7. `demos = accounts.apagarDemosVencidas()`.
  - Para o passo 5, a porta de perfil ganha um método "sem contaId": `apagarEvitarTemporarioAntesDe(dia: string): Promise<number>`. Acrescente-o à porta (`src/core/accounts/ports.ts`), ao fake (`src/infra/fakes/memory-stores.ts`), ao Postgres (`src/infra/db/profiles.ts`) e à suíte `test/contracts/profiles.contract.ts`. Esses quatro arquivos também são desta tarefa.
  - `scripts/cleanup.ts` usa `getContainer().stores` e o relógio do container, imprime as contagens e fecha a conexão.
  - `"cleanup": "node --env-file-if-exists=.env.local --import tsx scripts/cleanup.ts"`.
- testes primeiro (fake e `createFixedClock`), na borda de cada prazo (no prazo fica, um dia ou um minuto depois sai):
  - mensagem de 7 dias fica e a de 7 dias + 1 min sai;
  - mensagem com incômodo de ontem sai e a de hoje fica;
  - retorno `aguardando` de 8 dias sai e o respondido de 8 dias fica;
  - falta de 30 dias fica e a de 31 sai;
  - evitar temporário de ontem sai;
  - run em `waiting_for_input` há 31 min vira `expired` e a proposta pendente dele vira `expirada`; o de 29 min fica;
  - demo vencida sai;
  - todas as contagens batem.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` (banco local permitido)
- pronto quando: os testes passam.
- fora: cron e rota (022).

### T9 · Add the memory tools and extend ToolContext
- nivel: mecanica
- objetivo: acrescentar `contaId`, `stores`, `clock` e `fuso` ao `ToolContext` e criar as tools `casa.ler`, `preferencias.ler` e `historico.recente`.
- arquivos: `src/core/agents/tools/tool.ts`, `src/core/agents/tools/memoria.ts`, `src/core/agents/tools/memoria.test.ts`, `src/core/agents/tools/ayurveda.test.ts`, `src/core/agents/tools/clima.test.ts`, `evals/det/base/candidatos.eval.ts`, `evals/det/base/substitutos.eval.ts`, `evals/det/clima/tools-clima.eval.ts`
- leitura: spec 004, "Contratos" → "`ToolContext`" e "Tools", e os critérios de aceite de `casa.ler`, `preferencias.ler` e `historico.recente`
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `ToolContext` ganha os campos `contaId: string`, `stores: Pick<Stores, "pantry" | "preferences" | "runs" | "outcomes">`, `clock: Clock` e `fuso?: string`, todos obrigatórios menos `fuso`. Os testes e evals que montam `ToolContext` passam a usar `createMemoryStores(clock)` e um `contaId` fixo.
  - Use `definirTool` (aceita `executar` assíncrono). A entrada é `.strict()` e a saída é o zod da tabela "Tools" da spec.
  - `casa.ler`:
    - lista a casa e calcula `estadoDoItem` com a durabilidade do alimento na base (`kb.alimento(id)?.durabilidade`);
    - tira o que acabou e o que `passaNoFiltro` reprova com motivo `evitar_sempre`;
    - `nome` = nome do alimento na base ou `nome_livre`; `grupo` vem da base ou é `null`; `conhecido` = `alimento_id != null`;
    - ordena por grupo (nulos no fim) e depois por nome;
    - devolve as contagens `confirmados` (inclui `sempre_tenho`) e `incertos`.
  - `preferencias.ler` aceita de 1 a 10 itens e devolve só os que têm registro.
  - `historico.recente({ dias = 7 })` (1 a 7):
    - usa `runs.recentes(contaId, agora - dias, config.memoria.historicoLinhas)` e `outcomes.doRun`;
    - de cada run, tira `dia`, `momento_do_dia` e `estados` de `runs.momento`, e as sugestões dos retornos (`titulo`, com `resultado` = `resultado ?? "aguardando"`);
    - nunca lê `mensagens`;
    - run sem `momento` é ignorado.
  - Exporta `memoriaTools`.
- testes primeiro:
  - `casa.ler` traz um item incerto e um confirmado com as contagens certas, sem o que acabou;
  - um alimento do grupo em "evitar sempre" some;
  - um nome livre aparece com `conhecido: false`;
  - `preferencias.ler` com um item sem registro devolve só os outros;
  - `historico.recente` traz no máximo 20 runs dos últimos 7 dias;
  - a saída não tem nenhuma chave `texto` (confira com um JSON das mensagens gravadas para o mesmo run);
  - uma conta não vê o histórico de outra.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os testes e os evals passam.
- fora: o loop do agente, as tools de escrita.

### T10 · Add the memory deterministic evals and the CI db job
- nivel: mecanica
- objetivo: escrever os 6 evals de `evals/det/memoria/` e o job `db` na CI.
- arquivos: `evals/det/memoria/casa-estado.eval.ts`, `evals/det/memoria/casa-evitar.eval.ts`, `evals/det/memoria/faltas.eval.ts`, `evals/det/memoria/limpeza.eval.ts`, `evals/det/memoria/privacidade-dados.eval.ts`, `evals/det/memoria/historico.eval.ts`, `.github/workflows/ci.yml`
- leitura: spec 004, "Evals" e "O que fazer" (job `db`)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Os evals usam só fakes (`createMemoryStores`, `createFixedClock` e a mini-base) e o que o core exporta.
    - `casa-estado`: o estado "incerto" aparece no dia certo para cada durabilidade; "sempre tenho" nunca fica incerto; um alimento desconhecido é guardado e sai em `casa.ler` com `conhecido: false`.
    - `casa-evitar`: um item da casa que cai em "evitar sempre" não aparece em `casa.ler`.
    - `faltas`: no máximo uma falta por alimento por dia; registrar em casa apaga as faltas e tira o alimento da lista.
    - `limpeza`: cada prazo de `config/memoria.ts` na borda (no prazo fica, um dia depois sai); a mensagem com incômodo some no dia seguinte.
    - `privacidade-dados`: uma conta não lê nada de outra, em nenhuma porta; depois de `accounts.apagar`, nenhuma porta tem linha da conta e os runs ficam sem texto.
    - `historico`: `historico.recente` não devolve texto de mensagem nem incômodo.
  - O CI ganha o job `db` (`runs-on: ubuntu-latest`), com o serviço `postgres:17-alpine` (`POSTGRES_USER/PASSWORD/DB` = `ritu`, porta 5432 e healthcheck `pg_isready`) e `env: DATABASE_URL: postgres://ritu:ritu@localhost:5432/ritu`. Os passos são checkout, setup-node (`.nvmrc`), `npm ci`, `npm run db:migrate` e `npm run test:db`. O job `gates` não muda.
- testes primeiro: os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: os evals passam e o YAML da CI é válido. Para conferir, rode `node -e "require('yaml').parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"`.
- fora: código de produção.

### C1 · Test that db:migrate is idempotent and ordered
- nivel: mecanica
- objetivo: cobrir o critério "`db:migrate` aplica as pendentes em ordem, registra em `_migracoes` e rodar de novo não faz nada" com um teste contra o Postgres.
- arquivos: `test/db/stores.db.test.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `migrate(sql, clock, dir?)` em `src/infra/db/migrate.ts` devolve os nomes aplicados. O runner já cria o schema `ritu_test` e chama `migrate` uma vez no `beforeAll`.
- testes primeiro: um teste novo no runner, com três verificações.
  - Chamar `migrate` de novo devolve `[]`.
  - `select nome from _migracoes order by nome` é igual à lista de arquivos `db/migrations/*.sql` em ordem de nome.
  - Numa pasta temporária no scratchpad, ou num diretório dentro de `test/db/fixtures/` criado e apagado pelo próprio teste, com `0001_a.sql` e `0002_b.sql` (cada um cria uma tabela trivial num schema próprio `ritu_test_mig`, recriado no teste), a primeira chamada devolve `["0001_a.sql", "0002_b.sql"]` e a segunda devolve `[]`. Use o caminho mais simples que o `migrate` aceite.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db` (banco local permitido)
- pronto quando: o teste passa no `test:db`.
- fora: código de produção.
