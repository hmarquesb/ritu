---
title: Dados e memória
status: implemented
implemented: 855506c
entrega: 1
created: 2026-11-14
---

# Dados e memória

> Entrega o banco do Ritu: as migrações, as portas de armazenamento com adaptador Postgres e fake em memória, a regra do estado dos itens da casa, a limpeza diária e as tools de leitura `casa.ler`, `preferencias.ler` e `historico.recente`. É onde mora tudo o que o Ritu lembra da pessoa.

## Contexto

Personalização e memória são o centro do produto (`BUSINESS.md` §11): casa, gostos, resultados, faltas, rotina, padrões, conversa e os fixos mudam cada resposta. Tudo precisa ser guardado por conta, com autorização no próprio repositório, e precisa existir em duas versões: Postgres, para o produto, e em memória, para os testes e evals rodarem sem banco. Os prazos de cada nível (7 dias de conversa, 30 de faltas, fim do dia para "evitar" dito na conversa) são regra de negócio e precisam de um lugar só.

## Objetivo

Depois desta spec, as specs seguintes gravam e leem qualquer dado da pessoa por portas do core, sem escrever SQL; `npm test` exercita todas as portas com os fakes; e ⚠️ `npm run test:db` roda **os mesmos testes** contra o Postgres do Docker.

## Escopo

- **Dentro:**
  - Driver `postgres`, cliente, migrações em SQL e script `db:migrate`.
  - Tabelas: `contas`, `perfis`, `evitar_temporario`, `casa`, `alimentos_desconhecidos`, `preferencias`, `retornos`, `rotina_notas`, `rotina_resumos`, `padroes`, `mensagens`, `runs`, `run_etapas`, `propostas`, `faltas`, `lista_ter_em_casa`, `feedback`.
  - Portas, adaptadores Postgres e fakes; transação.
  - Estado dos itens da casa (confirmado, incerto, acabou, sempre tenho).
  - Dia local da pessoa.
  - Limpeza diária (função e script).
  - Apagar conta e anonimizar os runs.
  - Tools `casa.ler`, `preferencias.ler`, `historico.recente`.
- **Fora:**
  - `llm_uso` (006) e `limites` (021).
  - Quem decide o que gravar: executor de propostas (010), registro de retornos e faltas (011), rotina e padrões (012).
  - Sessão, criação de conta pelo login e cópia do perfil de demonstração (017).
  - Rotas HTTP e o agendamento do cron (018 a 022).
  - Máquina de estados do run e formato do checkpoint (005): aqui o run é guardado e lido.

## Necessidade de negócio

"Nada escondido" e "lembra e aprende" (`BUSINESS.md` §2) dependem de a memória ser estruturada, por nível, apagável item por item e nunca misturada entre contas. A separação entre tem, gosta e funcionou é o que permite ordenar sem errar o filtro.

## Critérios de aceite

- [x] `npm test` roda a suíte de contrato de todas as portas contra os fakes, sem banco.
- [x] ⚠️ `npm run test:db`, com o Postgres do `docker compose` no ar, aplica as migrações num schema limpo e roda a mesma suíte de contrato contra os adaptadores Postgres, com código 0.
- [x] `npm run db:migrate` aplica as migrações pendentes em ordem, registra cada uma em `_migracoes`, e rodar de novo não faz nada.
- [x] **Autorização:** para cada porta, um teste grava com a conta A e tenta ler, alterar e apagar com a conta B; a leitura devolve vazio e a escrita não muda nada.
- [x] Só um run aberto por conta: criar um segundo run com outro em `running`, `waiting_for_input` ou `waiting_for_approval` lança `RunAbertoError`.
- [x] `estadoDoItem`: item de durabilidade curta confirmado há 5 dias é `confirmado`; há 6, `incerto`; média, 14 e 15; longa, 90 e 91; `sempre_tenho` nunca fica `incerto`; `estado: acabou` é sempre `acabou`; alimento que a base não conhece usa a durabilidade média.
- [x] `casa.registrar` de um alimento apaga as faltas dele e o tira de `lista_ter_em_casa`, na mesma transação.
- [x] Registrar em casa um nome que a base não conhece guarda o item com `alimento_id` nulo e soma 1 em `alimentos_desconhecidos`; o mesmo nome com acento ou maiúscula diferente cai na mesma linha.
- [x] `faltas.registrar` duas vezes para a mesma conta, alimento e dia mantém uma linha.
- [x] `faltas.diasComFalta` conta dias diferentes dentro da janela pedida e ignora os mais antigos.
- [x] `preferencias`: `contarResultado("ajudou")` soma 1 só no contador certo; `definirGosto` não mexe nos contadores. `ultimos_resultados` guarda os dois retornos mais recentes entre "ajudou" e "não ajudou", o mais novo primeiro; "não fez" não entra.
- [x] Limpeza diária, com relógio fixo: apaga mensagens com mais de 7 dias; apaga mensagens marcadas `com_incomodo` de dias anteriores; apaga retornos `aguardando` com mais de 7 dias (os respondidos ficam); apaga faltas com mais de 30 dias; apaga `evitar_temporario` de dias anteriores; marca como `expired` os runs em espera há mais de 30 minutos e como `expirada` as propostas pendentes deles; apaga contas de demonstração vencidas. Devolve a contagem de cada item.
- [x] `contas.apagar` remove perfil, casa, preferências, retornos, rotina, padrões, mensagens, propostas, faltas, lista e feedback da conta; os runs ficam sem `conta_id`, sem `saida`, `checkpoint`, `pendencia` e `clima_usado`, e as etapas ficam sem `resumo`.
- [x] Nenhuma tabela tem coluna para incômodo; `runs.momento` recusa (zod) objeto com campo de incômodo.
- [x] `perfil.removerEvitarSempre` só existe na porta de perfil e exige `confirmado: true`; nenhuma outra porta altera `evitar_sempre`.
- [x] `casa.ler` devolve os itens com estado calculado, sem os que acabaram e sem os que caem em "evitar sempre"; `preferencias.ler` devolve só os itens pedidos; `historico.recente` devolve no máximo 20 linhas dos últimos 7 dias, sem texto da pessoa.
- [x] Importar o container não abre conexão; a primeira consulta abre.

## O que fazer

- Escrever a suíte de contrato de cada porta uma vez (`test/contracts/`), parametrizada pela fábrica, e rodá-la contra o fake (`npm test`) e contra o Postgres (`test:db`).
- Passar o relógio aos repositórios: todo carimbo de tempo vem de `Clock`, nunca de `now()` no SQL.
- Receber `contaId` como primeiro parâmetro de todo método e colocá-lo no `WHERE` de toda consulta.
- Validar com zod todo `jsonb` na leitura e na escrita.
- Acrescentar à CI um segundo job, `db`, com o serviço `postgres:17-alpine`, que roda `db:migrate` e `test:db`.

## O que não fazer

- Não usar ORM nem gerador de consultas: SQL puro com o driver `postgres`.
- Não gravar incômodo, motivo de "evitar sempre", e-mail fora de `contas`, telefone ou coordenada com mais de duas casas.
- Não gravar o estado "incerto": ele é calculado.
- Não criar método que leia dados sem `contaId` (exceções: limpeza, `alimentos_desconhecidos` e busca de conta pelo `google_sub`).
- Não apagar nem alterar migração já aplicada: correção é migração nova.
- Não expor nas tools o texto das mensagens.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Mensagem de run com incômodo | Marcada `com_incomodo` e apagada na limpeza do dia seguinte, junto com a resposta do agente | Decisão da dona: incômodo de saúde não fica guardado; a conversa do dia continua inteira na tela |
| Retorno sem resposta | Sai de "Como ficou?" depois de 7 dias, sem contar como "não fez" | Decisão da dona: a área não pode virar cobrança |
| Migrações | Arquivos `db/migrations/NNNN_nome.sql`, aplicados por `scripts/db-migrate.ts` dentro de transação, com a tabela `_migracoes` | Sem dependência nova; SQL legível no repositório |
| Testes com banco | Suíte de contrato única; Postgres é opt-in local (`test:db`) e job próprio na CI | Os gates 1 a 6 continuam sem banco; os adaptadores reais são testados de verdade |
| Ids | `uuid`, gerado no banco (`gen_random_uuid()`) e, nos fakes, por `crypto.randomUUID()` | Sem sequência exposta em URL |
| Dia | Texto `AAAA-MM-DD` no fuso da cidade da pessoa (ou no fuso padrão), calculado no core por `diaLocal` | "Uma falta por dia" e "até o fim do dia" são o dia da pessoa, não o do servidor |
| "Não como" | Lista de `{tipo: alimento | texto, valor}` | O que a base reconhece filtra por id; o resto segue como texto |
| Casa: unicidade | Uma linha por conta e alimento; para nome livre, por conta e nome normalizado | "Comprei abóbora" duas vezes confirma, não duplica |
| Lista "Para ter em casa" | Chave `alimento_id` | Só alimentos da base entram na lista (`BUSINESS.md` §9) |
| Onboarding "Evitar sempre" | `contas.evitar_passo` (`pronto`, `nenhum`, `pulou`) e `contas.evitar_lembrete_em` | A 017 precisa saber se o passo foi feito e se o lembrete único de quem pulou já saiu |
| Tipo do run | Coluna `caminho`: `acompanhante`, `casa`, `retorno`, `evitar`, `ajuda`, `ofensa`, `alerta`, `fora`, `sem_modelo` | É o rótulo `run.caminho` da telemetria |
| Transação | Porta `Transactor`, que entrega o mesmo conjunto de portas ligado a uma transação | O executor de propostas (010) grava em várias tabelas de uma vez |
| Limpeza | Função do core `executarLimpeza` + `scripts/cleanup.ts`; a rota do cron (022) chama a mesma função | Testável com relógio fixo e fakes |
| `feedback` nesta spec | Sim | Evita uma migração dentro de uma spec de tela |
| Prazos | `config/memoria.ts` | `DEVELOPMENT.md`: número ajustável fica em `config/` |

## Contratos

### Cria

**Configuração**

```ts
// config/memoria.ts
export const memoria = {
  mensagensDias: 7, retornosDias: 7, faltasDias: 30,
  esperaMinutos: 30,                 // run em espera e proposta pendente
  rotinaNotasAtivas: 30, resumoRotinaCaracteres: 1200, padroesNoPrompt: 10,
  mensagensDoDiaNoPrompt: 6, historicoLinhas: 20,
} as const
// config/casa.ts
export const casa = { validadeDias: { curta: 5, media: 14, longa: 90 }, durabilidadeDesconhecido: "media" } as const
```

**Tabelas** (`db/migrations/0001_inicial.sql`). Toda tabela com `conta_id` tem chave estrangeira para `contas(id)` com `ON DELETE CASCADE`, exceto `runs` (`ON DELETE SET NULL`). `ts` = `timestamptz`.

| Tabela | Colunas |
|---|---|
| `contas` | `id uuid pk`, `tipo text` (google, demo), `google_sub text unique null`, `email text null`, `expira_em ts null`, `tester bool`, `aviso_aceito_em ts null`, `evitar_passo text null` (pronto, nenhum, pulou), `evitar_lembrete_em ts null`, `dosha_adiado_em ts null`, `criado_em ts` |
| `perfis` | `conta_id uuid pk`, `prakriti jsonb null` (`{vata, pitta, kapha}` somando 1), `origem text null` (quiz, declarado), `evitar_sempre jsonb` (lista de `{tipo, valor, desde}`), `restricoes text[]`, `nao_come jsonb` (lista de `{tipo, valor}`), `cidade_nome text null`, `cidade_lat numeric(5,2) null`, `cidade_lon numeric(5,2) null`, `cidade_fuso text null`, `atualizado_em ts` |
| `evitar_temporario` | `conta_id`, `tipo text`, `valor text`, `dia date`; pk (`conta_id`, `tipo`, `valor`, `dia`) |
| `casa` | `id uuid pk`, `conta_id`, `alimento_id text null`, `nome_livre text null`, `nome_normalizado text null`, `estado text` (tem, acabou), `sempre_tenho bool`, `confirmado_em ts`, `origem text` (conversa, tela, pergunta). Exatamente um entre `alimento_id` e `nome_livre`. Único por (`conta_id`, `alimento_id`) e por (`conta_id`, `nome_normalizado`) |
| `alimentos_desconhecidos` | `nome text pk` (normalizado), `vezes int` |
| `preferencias` | `conta_id`, `item_tipo text` (alimento, pratica, preparo), `item_id text`, `gosto text null` (gosta, nao_gosta), `ajudou int`, `nao_ajudou int`, `nao_fez int`, `ultimos_resultados text[]` (até 2, o mais recente primeiro; só `ajudou` e `nao_ajudou`), `ultima_sugestao_em ts null`; pk (`conta_id`, `item_tipo`, `item_id`) |
| `retornos` | `id uuid pk`, `conta_id`, `run_id uuid`, `sugestao jsonb`, `status text` (aguardando, respondido), `resultado text null` (ajudou, nao_ajudou, nao_fez), `origem text null` (toque, conversa), `criado_em ts`, `respondido_em ts null` |
| `rotina_notas` | `id uuid pk`, `conta_id`, `texto text` (até 200), `ativa bool`, `criado_em ts` |
| `rotina_resumos` | `conta_id`, `versao int`, `texto text` (até 1200), `criado_em ts`; pk (`conta_id`, `versao`) |
| `padroes` | `id uuid pk`, `conta_id`, `tipo text` (ajuda_em_estado, estados_juntos), `chave text`, `frase text`, `ocorrencias int`, `status text` (candidato, confirmado, recusado), `criado_em ts`, `decidido_em ts null`; único por (`conta_id`, `tipo`, `chave`) |
| `mensagens` | `id uuid pk`, `conta_id`, `run_id uuid null`, `autor text` (pessoa, agente), `texto text`, `com_incomodo bool`, `dia date`, `criado_em ts` |
| `runs` | `id uuid pk`, `conta_id uuid null`, `caminho text`, `intencoes text[]`, `status text` (running, waiting_for_input, waiting_for_approval, done, failed, expired, cancelled), `checkpoint jsonb null`, `pendencia jsonb null`, `momento jsonb null`, `com_incomodo bool`, `clima_usado jsonb null`, `saida jsonb null`, `passos int`, `tokens_entrada int`, `tokens_saida int`, `latencia_ms int`, `modelos jsonb`, `trocas_de_modelo int`, `prompt_versao text null`, `juiz_tentativas int`, `juiz_aprovado bool null`, `trace_id text null`, `dia date`, `criado_em ts`, `atualizado_em ts`. Índice único parcial em `conta_id` onde `status` é `running`, `waiting_for_input` ou `waiting_for_approval` |
| `run_etapas` | `run_id uuid` (cascade), `ordem int`, `tipo text`, `nome text`, `resumo text null`, `status text` (ok, falhou, recusado), `duracao_ms int`, `modelo text null`, `tokens_entrada int`, `tokens_saida int`, `criado_em ts`; pk (`run_id`, `ordem`) |
| `propostas` | `id uuid pk`, `run_id uuid`, `conta_id`, `tool text`, `conteudo jsonb`, `decisao text` (pendente, aprovada, recusada, expirada), `criado_em ts`, `decidida_em ts null` |
| `faltas` | `conta_id`, `alimento_id text`, `dia date`, `origem text` (teria_entrado, nao_tenho), `run_id uuid null`; pk (`conta_id`, `alimento_id`, `dia`) |
| `lista_ter_em_casa` | `conta_id`, `alimento_id text`, `motivo text` (faltou_hoje, fez_falta), `detalhe text`, `criado_em ts`; pk (`conta_id`, `alimento_id`) |
| `feedback` | `run_id uuid pk` (cascade), `conta_id`, `voto text` (up, down), `criado_em ts` |

`runs.momento`: `{ estados: Estado[]; momento_do_dia: MomentoDoDia; gunas_buscadas: Guna[] }`, schema estrito (campo a mais é recusado). `retornos.sugestao`: `{ tipo: "cha" | "refeicao" | "oleo" | "pratica"; pratica_id?: string; preparo_id?: string; alimentos: string[]; titulo: string }`.

**Tipos de domínio (`src/core/`)**: um tipo por tabela, em camelCase só nos nomes de método; os campos seguem os nomes das colunas. `Perfil.evitar_sempre: (EvitarItem & { desde: string })[]`.

**Portas** (cada uma em `src/core/<área>/ports.ts`; todo método recebe `contaId` primeiro, salvo indicação):

```ts
interface AccountRepository {                        // src/core/accounts/
  criar(dados: { tipo: "google" | "demo"; google_sub?: string; email?: string; expira_em?: Date }): Promise<Conta>
  buscar(contaId: string): Promise<Conta | undefined>              // vencida conta como inexistente
  buscarPorGoogleSub(sub: string): Promise<Conta | undefined>      // sem contaId
  marcar(contaId: string, campos: Partial<Pick<Conta, "aviso_aceito_em" | "evitar_passo" | "evitar_lembrete_em" | "dosha_adiado_em">>): Promise<void>
  apagar(contaId: string): Promise<void>                           // cascata + anonimiza os runs
  apagarDemosVencidas(): Promise<number>                           // sem contaId
}
interface ProfileStore {                             // src/core/accounts/
  ler(contaId): Promise<Perfil>                                    // sem linha: perfil vazio
  definirPrakriti(contaId, prakriti: Prakriti | null, origem: "quiz" | "declarado" | null): Promise<void>
  definirCidade(contaId, cidade: CidadeDaPessoa | null): Promise<void>     // arredonda para 2 casas
  definirRestricoes(contaId, restricoes: Restricao[]): Promise<void>
  definirNaoCome(contaId, itens: { tipo: "alimento" | "texto"; valor: string }[]): Promise<void>
  acrescentarEvitarSempre(contaId, itens: EvitarItem[]): Promise<void>     // sem duplicar
  removerEvitarSempre(contaId, item: EvitarItem, opts: { confirmado: true }): Promise<void>
  evitarTemporario(contaId, dia: string): Promise<EvitarItem[]>
  acrescentarEvitarTemporario(contaId, dia: string, itens: EvitarItem[]): Promise<void>
}
interface PantryStore {                              // src/core/pantry/
  listar(contaId): Promise<ItemDaCasa[]>
  registrar(contaId, itens: { alimento_id?: string; nome_livre?: string }[], origem): Promise<void>   // estado tem, confirmado agora; apaga faltas e tira da lista
  marcarAcabou(contaId, itens: { alimento_id?: string; nome_livre?: string }[]): Promise<void>
  definirSempreTenho(contaId, itemId: string, valor: boolean): Promise<void>
  tirar(contaId, itemId: string): Promise<void>
  desconhecidos(limite: number): Promise<{ nome: string; vezes: number }[]>    // sem contaId
}
interface PreferenceStore {                          // src/core/preferences/
  ler(contaId, itens?: { tipo: ItemTipo; id: string }[]): Promise<Preferencia[]>   // sem itens: todas
  definirGosto(contaId, item, gosto: "gosta" | "nao_gosta" | null): Promise<void>
  contarResultado(contaId, item, resultado: "ajudou" | "nao_ajudou" | "nao_fez"): Promise<void>   // soma no contador; ajudou e nao_ajudou entram no início de ultimos_resultados (fica com 2)
  marcarSugerido(contaId, itens: { tipo: ItemTipo; id: string }[]): Promise<void>
  contagem(contaId): Promise<{ de_gosto: number; de_resultado: number }>
  apagar(contaId, item): Promise<void>
}
interface OutcomeStore {                             // src/core/outcomes/
  criar(contaId, runId: string, sugestoes: SugestaoRegistrada[]): Promise<Retorno[]>
  pendentes(contaId): Promise<Retorno[]>                           // mais recente primeiro
  responder(contaId, retornoId: string, resultado, origem: "toque" | "conversa"): Promise<Retorno | undefined>   // já respondido: não muda
  doRun(contaId, runId: string): Promise<Retorno[]>
  apagarAguardandoAntesDe(limite: Date): Promise<number>           // sem contaId
}
interface ShortageStore {                            // src/core/shortages/
  registrar(contaId, faltas: { alimento_id: string; origem: "teria_entrado" | "nao_tenho"; run_id?: string }[], dia: string): Promise<void>
  diasComFalta(contaId, desdeDia: string): Promise<{ alimento_id: string; dias: number; ultimo_dia: string }[]>
  apagarDoAlimento(contaId, alimentoId: string): Promise<void>
  lista(contaId): Promise<ItemDaLista[]>
  porNaLista(contaId, item: { alimento_id: string; motivo: "faltou_hoje" | "fez_falta"; detalhe: string }): Promise<void>
  tirarDaLista(contaId, alimentoId: string): Promise<void>
  apagarFaltasAntesDe(dia: string): Promise<number>                // sem contaId
}
interface RoutineStore {                             // src/core/routine/
  notasAtivas(contaId): Promise<NotaDeRotina[]>
  anotar(contaId, texto: string): Promise<NotaDeRotina>
  desativar(contaId, notaId: string): Promise<void>
  resumo(contaId): Promise<ResumoDeRotina | undefined>             // a versão mais nova
  gravarResumo(contaId, texto: string): Promise<ResumoDeRotina>    // versão anterior + 1
}
interface PatternStore {                             // src/core/patterns/
  listar(contaId, status?: StatusPadrao): Promise<Padrao[]>
  propor(contaId, p: { tipo; chave: string; frase: string; ocorrencias: number }): Promise<Padrao | undefined>   // recusado ou já existente: undefined
  decidir(contaId, padraoId: string, status: "confirmado" | "recusado"): Promise<void>
  apagar(contaId, padraoId: string): Promise<void>
}
interface MessageRepository {                        // src/core/messages/
  gravar(contaId, m: { run_id?: string; autor: "pessoa" | "agente"; texto: string; com_incomodo: boolean; dia: string }): Promise<Mensagem>
  doDia(contaId, dia: string): Promise<Mensagem[]>                 // em ordem
  marcarIncomodoDoRun(contaId, runId: string): Promise<void>
  apagarAntesDe(limite: Date): Promise<number>                     // sem contaId
  apagarComIncomodoAntesDoDia(dia: string): Promise<number>        // sem contaId
}
interface RunRepository {                            // src/core/runs/
  criar(contaId, r: { caminho: Caminho; intencoes: string[]; dia: string; trace_id?: string }): Promise<Run>   // lança RunAbertoError
  buscar(contaId, runId: string): Promise<Run | undefined>
  aberto(contaId): Promise<Run | undefined>
  atualizar(contaId, runId: string, campos: Partial<RunMutavel>): Promise<void>
  acrescentarEtapa(contaId, runId: string, etapa: NovaEtapa): Promise<RunEtapa>      // ordem = última + 1
  etapas(contaId, runId: string): Promise<RunEtapa[]>
  recentes(contaId, desde: Date, limite: number): Promise<Run[]>   // só status done
  contarMensagensDoDia(contaId, dia: string): Promise<number>
  votar(contaId, runId: string, voto: "up" | "down"): Promise<void>
  expirarEmEsperaAntesDe(limite: Date): Promise<string[]>          // sem contaId; devolve os ids
}
interface ProposalStore {                            // src/core/proposals/
  criar(contaId, runId: string, propostas: { tool: string; conteudo: unknown }[]): Promise<Proposta[]>
  doRun(contaId, runId: string): Promise<Proposta[]>
  decidir(contaId, propostaId: string, decisao: "aprovada" | "recusada"): Promise<Proposta | undefined>   // só muda se pendente
  recusadas(contaId, tool: string): Promise<Proposta[]>
  expirarDosRuns(runIds: string[]): Promise<number>                // sem contaId
}

type Stores = { accounts; profiles; pantry; preferences; outcomes; shortages; routine; patterns; messages; runs; proposals }
interface Transactor { emTransacao<T>(fn: (stores: Stores) => Promise<T>): Promise<T> }
export class RunAbertoError extends RituError {}     // code: "run_aberto"
```

- Adaptadores: `src/infra/db/client.ts` (cliente preguiçoso, lê `DATABASE_URL` com `requireEnv` na primeira consulta) e um arquivo por porta em `src/infra/db/`.
- Fakes: `src/infra/fakes/memory-stores.ts` exporta `createMemoryStores(clock): Stores & Transactor`, com um estado só, para as regras cruzadas (registrar em casa apaga faltas) valerem também no fake.
- Container: `Container` ganha `stores: Stores` e `tx: Transactor`.

**Funções puras**

```ts
// src/core/pantry/estado.ts
type EstadoCalculado = "confirmado" | "incerto" | "acabou" | "sempre_tenho"
function estadoDoItem(item: ItemDaCasa, agora: Date, durabilidade: Durabilidade | undefined): EstadoCalculado
// incerto quando passaram MAIS dias inteiros que a validade desde confirmado_em

// src/core/time/dia-local.ts
function diaLocal(agora: Date, fuso?: string): string            // "AAAA-MM-DD"; sem fuso ou inválido: fuso padrão
function diasAtras(dia: string, n: number): string

// src/core/cleanup.ts
type ResultadoLimpeza = { mensagens: number; mensagens_com_incomodo: number; retornos: number; faltas: number; evitar_temporario: number; runs_expirados: number; propostas_expiradas: number; demos: number }
function executarLimpeza(deps: { stores: Stores; clock: Clock }): Promise<ResultadoLimpeza>
```

A limpeza usa o dia no fuso padrão para os cortes por dia.

**`ToolContext` (da 002) ganha:** `contaId: string`, `stores: Pick<Stores, "pantry" | "preferences" | "runs" | "outcomes">`, `clock: Clock`, `fuso?: string`.

**Tools (`src/core/agents/tools/memoria.ts`)**

| Tool | Entrada | Saída |
|---|---|---|
| `casa.ler` | `{}` | `{ itens: { alimento_id: string \| null; nome: string; grupo: Grupo \| null; estado: "confirmado" \| "incerto" \| "sempre_tenho"; dias_desde_confirmacao: number; conhecido: boolean }[]; confirmados: number; incertos: number }` |
| `preferencias.ler` | `{ itens: { tipo: "alimento" \| "pratica" \| "preparo"; id: string }[] }` (1 a 10) | `{ itens: { tipo; id; gosto: "gosta" \| "nao_gosta" \| null; ajudou: number; nao_ajudou: number; nao_fez: number }[] }` (só os que têm registro) |
| `historico.recente` | `{ dias?: number }` (1 a 7, padrão 7) | `{ runs: { dia: string; momento_do_dia; estados: Estado[]; sugestoes: { titulo: string; resultado: "ajudou" \| "nao_ajudou" \| "nao_fez" \| "aguardando" }[] }[] }` |

- `casa.ler` ordena por grupo e nome, tira o que acabou e o que não passa em `passaNoFiltro` só pelo motivo `evitar_sempre`.
- `historico.recente` usa `runs.momento`, `runs.saida` e `retornos`; nunca `mensagens`.
- Exporta `memoriaTools`.

**Scripts**

| Script | Comando | Observação |
|---|---|---|
| `db:migrate` | `node --env-file-if-exists=.env.local --import tsx scripts/db-migrate.ts` | Precisa do banco |
| ⚠️ `test:db` | `vitest run --config vitest.db.config.ts` | Precisa do Docker; usa o schema `ritu_test`, recriado a cada rodada |
| `cleanup` | `node --env-file-if-exists=.env.local --import tsx scripts/cleanup.ts` | Imprime as contagens |

### Usa

- Spec 001: `RituError`, `Clock`, `requireEnv`, container, `docker-compose` (Postgres), CI.
- Spec 002: `Guna`, `Estado`, `MomentoDoDia`, `Restricao`, `Grupo`, `Durabilidade`, `EvitarItem`, `Prakriti`, `passaNoFiltro`, `normalizar`, `KnowledgeBase`, `Tool`, `ToolContext`.
- Spec 003: `CidadeDaPessoa`, `clima.fusoPadrao`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/memoria/`, com os fakes:

- `casa-estado.eval.ts`: o estado "incerto" aparece na data certa para cada durabilidade; "sempre tenho" nunca fica incerto; alimento desconhecido é guardado e aparece em `casa.ler` com `conhecido: false`.
- `casa-evitar.eval.ts`: item da casa que cai em "evitar sempre" não aparece em `casa.ler`.
- `faltas.eval.ts`: uma falta por alimento por dia; registrar em casa apaga as faltas e tira da lista.
- `limpeza.eval.ts`: cada prazo de `config/memoria.ts`, na borda (no prazo fica, um dia depois sai); mensagem com incômodo some no dia seguinte.
- `privacidade-dados.eval.ts`: uma conta não lê nada de outra, em todas as portas; depois de `contas.apagar`, nenhuma tabela tem linha da conta e os runs ficaram sem texto.
- `historico.eval.ts`: `historico.recente` não devolve texto de mensagem nem incômodo.

Com LLM: nenhum caso novo.

## Nível das partes

Tudo mecânica.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `BUSINESS.md` §9, só "Minha casa" e "O que fez falta": estados e regras das faltas.
- `ARCHITECTURE.md` §4, último item: autorização por conta.

## Dependências

- Specs 001, 002 e 003.
- Pacote `postgres` (estável mais recente); Postgres 17 do `docker-compose` para `db:migrate` e `test:db`.

## Riscos e trade-offs

- **Fakes com regras duplicadas:** o fake reimplementa unicidade e cascata. A suíte de contrato única é o que impede os dois de divergirem.
- **`jsonb` em vez de tabelas filhas** (`evitar_sempre`, `nao_come`, `saida`, `checkpoint`): menos junções e migrações; a validação fica no zod, não no banco.
- **Uma migração inicial grande:** as specs seguintes acrescentam as suas (`llm_uso`, `limites`) em arquivos novos.
- **Limpeza no fuso padrão:** uma pessoa em outro fuso pode ter a mensagem com incômodo apagada algumas horas antes ou depois da virada do dia dela. Aceito.
- **Runs anonimizados ficam para sempre:** servem às métricas agregadas de Bastidores; não têm texto, conta nem cidade.

## Edge cases e modos de falha

- `registrar` em casa um item que estava como `acabou`: volta para `tem`, com nova data.
- `registrar` com `alimento_id` que não existe na base: tratado como nome livre.
- `responder` um retorno já respondido ou já apagado: devolve o estado atual ou `undefined`, sem erro.
- `decidir` proposta que não está pendente: não muda nada.
- `criar` run com outro aberto: `RunAbertoError`; quem chama decide se cancela o antigo (005).
- Conta de demonstração vencida: `buscar` devolve `undefined` mesmo antes de a limpeza apagar.
- Banco fora do ar: o erro do driver sobe como `RituError` com código `banco_indisponivel`, sem a URL na mensagem.
- `DATABASE_URL` ausente: `MissingEnvError` na primeira consulta, não na importação.
- Perfil sem cidade: `diaLocal` usa o fuso padrão.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes; job `db` verde na CI.
- `ARCHITECTURE.md` §6 igual às tabelas finais.
- `AGENTS.md` com `db:migrate`, ⚠️ `test:db` e `cleanup`.
- ADR nova: "Suíte de contrato única para fakes e Postgres".
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `db/migrations/0001_inicial.sql`
- `config/memoria.ts`, `config/casa.ts`, `config/index.ts`
- `src/core/accounts/`, `pantry/`, `preferences/`, `outcomes/`, `shortages/`, `routine/`, `patterns/`, `messages/`, `runs/`, `proposals/` (`ports.ts` e tipos)
- `src/core/pantry/estado.ts`, `src/core/time/dia-local.ts`, `src/core/cleanup.ts` e os testes
- `src/core/agents/tools/memoria.ts`, `src/core/agents/tools/tool.ts`
- `src/infra/db/client.ts` e um adaptador por porta; `src/infra/db/transactor.ts`
- `src/infra/fakes/memory-stores.ts`
- `src/infra/container.ts`
- `test/contracts/*.contract.ts`, `vitest.db.config.ts`
- `scripts/db-migrate.ts`, `scripts/cleanup.ts`, `package.json`
- `.github/workflows/ci.yml` (job `db`)
- `evals/det/memoria/*.eval.ts`
- `.docs/ARCHITECTURE.md`, `AGENTS.md`, `.adrs/`
