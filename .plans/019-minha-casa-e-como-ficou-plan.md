# 019 · Minha casa e Como ficou? · Plano

Spec: `.specs/019-minha-casa-e-como-ficou.md`. Trilha adiantada, branch `entrega-3`.

Notas do orquestrador:

- As rotas seguem o padrão da 018: a lógica em `src/app/_rotas/<nome>.ts` (com teste, `criarRota` e `DepsDaRota`), e cada `src/app/api/**/route.ts` só liga `depsReais()` (como `src/app/api/runs/[id]/voto/route.ts`). Decisão A1 em `DECISOES-AUTONOMAS.md`.
- `Container.lerCasa(contaId)` e `Container.lerComoFicou(contaId)` resolvem o fuso sozinhos (perfil por `stores.profiles.ler(contaId)`, `cidade_fuso ?? config.clima.fusoPadrao`). Decisão A2.
- O nome da check de `lista_ter_em_casa.motivo` é o padrão do Postgres para check inline: `lista_ter_em_casa_motivo_check` (`db/migrations/0001_inicial.sql`, linha 207). A migração é a `0004`.
- Regra R4 do teste de arquitetura: `src/components/` só importa **tipos** do core (`import type`); textos vêm de `config/`. Vale para T8 e T9.
- `toque.tipo` não tem lista de valores em `src/core/telemetry/nomes.ts` (só o nome do atributo); `casa` e `lista` não exigem registro novo.

### T1 · Add the "pessoa" reason to the to-have list
- nivel: mecanica
- objetivo: a lista "Para ter em casa" aceita o motivo `pessoa`, no banco, na porta, no adaptador, no fake e na suíte de contrato.
- arquivos: `db/migrations/0004_lista_motivo_pessoa.sql` (novo), `src/core/shortages/ports.ts`, `src/infra/db/shortages.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/shortages.contract.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```sql
  alter table lista_ter_em_casa drop constraint lista_ter_em_casa_motivo_check;
  alter table lista_ter_em_casa add constraint lista_ter_em_casa_motivo_check
    check (motivo in ('faltou_hoje', 'fez_falta', 'pessoa'));
  ```
  ```ts
  // src/core/shortages/ports.ts
  export type MotivoDaLista = "faltou_hoje" | "fez_falta" | "pessoa"
  // ItemDaLista.motivo: MotivoDaLista
  // porNaLista(contaId, item: { alimento_id: string; motivo: MotivoDaLista; detalhe: string }): Promise<void>
  // Com "pessoa", detalhe é "".
  ```
  `lista.propor` (010) continua só com `faltou_hoje` e `fez_falta`: não mexa no executor nem nas tools.
- testes primeiro: na suíte de contrato da lista, `porNaLista` com `{ motivo: "pessoa", detalhe: "" }` grava e `lista` devolve o item com `motivo: "pessoa"` e `detalhe: ""`.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`. O `test:db` precisa de Postgres e não roda aqui.
- pronto quando: tipo exportado, migração escrita, suíte de contrato com o caso novo passando no fake.
- fora: `lista.propor`, executor de propostas, qualquer tela.

### T2 · Add the Minha casa and Como ficou texts
- nivel: mecanica
- objetivo: os textos das duas telas ficam em `config/`, exportados em `config/index.ts` como `textosCasa` e `textosComoFicou`.
- arquivos: `config/textos-casa.ts` (novo), `config/textos-como-ficou.ts` (novo), `config/index.ts`, `config/index.test.ts`
- depende de: nenhuma
- leitura: nenhuma (siga o formato de `config/textos-conversa.ts`)
- skills: nenhuma
- referencia: nenhuma
- contratos: objetos `as const`, aninhados pelas chaves com ponto. Placeholders literais entre chaves (`{item}`, `{Item}`, `{texto}`, `{n}`, `{detalhe}`, `{titulo}`, `{resultado}`). `{Item}`: nome com a primeira letra maiúscula; `{item}`: em minúsculas.

  `textosCasa`:
  | Chave | Texto |
  |---|---|
  | `titulo` | Minha casa |
  | `adicionar` | Adicionar |
  | `adicionarTitulo` | Adicionar à casa |
  | `adicionarBusca` | Procure um alimento |
  | `adicionarLivre` | Adicionar “{texto}” assim mesmo |
  | `adicionado` | {Item} está na sua casa. |
  | `aindaTem.titulo` | Ainda tem? |
  | `aindaTem.texto` | Faz tempo que você confirmou estes. Ainda tem? |
  | `aindaTem.tenho` | Ainda tenho |
  | `aindaTem.acabou` | Acabou |
  | `aindaTem.rotuloTenho` | Ainda tenho {item} |
  | `aindaTem.rotuloAcabou` | {Item} acabou |
  | `estado.hoje` | confirmado hoje |
  | `estado.ontem` | confirmado ontem |
  | `estado.dias` | confirmado há {n} dias |
  | `estado.sempre` | sempre tenho |
  | `estado.acabou` | acabou |
  | `estado.desconhecido` | ainda não conheço este alimento |
  | `folha.sempre` | Sempre tenho |
  | `folha.gosto` | Gosto |
  | `folha.naoGosto` | Não gosto |
  | `folha.acabou` | Acabou |
  | `folha.tenhoDeNovo` | Tenho de novo |
  | `folha.porNaLista` | Pôr na lista |
  | `folha.jaNaLista` | Já está na lista |
  | `folha.tirar` | Tirar da casa |
  | `prateleira.acabou` | Acabou |
  | `prateleira.desconhecidos` | Ainda não conheço |
  | `prateleira.numero` | {n} itens |
  | `prateleira.numeroUm` | 1 item |
  | `rotulo.sempre` | sempre tenho |
  | `rotulo.gosta` | você gosta |
  | `rotulo.naoGosta` | você não gosta |
  | `lista.titulo` | Para ter em casa |
  | `lista.faltouHoje` | Faltou para {detalhe} |
  | `lista.fezFalta` | Fez falta {detalhe} vezes nos últimos 30 dias |
  | `lista.pessoa` | Você pôs na lista |
  | `lista.comprei` | Comprei |
  | `lista.tirar` | Tirar da lista |
  | `lista.vazia` | Nada na lista por enquanto. Quando algo fizer falta, eu aviso na conversa. |
  | `vazia.titulo` | Sua casa está vazia. |
  | `vazia.texto` | Conte na conversa o que você tem, ou adicione aqui. Eu sugiro com o que você já tem. |
  | `confirma.tenho` | {Item}: anotei que você tem. |
  | `confirma.acabou` | {Item}: anotei que acabou. |
  | `confirma.sempre` | {Item}: sempre tenho. |
  | `confirma.semSempre` | {Item}: não é mais "sempre tenho". |
  | `confirma.gosta` | Anotei que você gosta de {item}. |
  | `confirma.naoGosta` | Anotei que você não gosta de {item}. Não vou sugerir. |
  | `confirma.semGosto` | Tirei o gosto de {item}. |
  | `confirma.tirado` | {Item} saiu da casa. |
  | `confirma.naLista` | {Item} está na lista. |
  | `confirma.foraDaLista` | {Item} saiu da lista. |
  | `erro` | Não consegui anotar agora. Nada mudou; tente de novo. |
  | `noscript` | Para tocar nos itens, ative o JavaScript. |
  | `grupos` | objeto `{ frutas: "Frutas", folhas: "Folhas", legumes: "Legumes", raizes: "Raízes", graos: "Grãos", leguminosas: "Leguminosas", laticinios: "Laticínios", ovos: "Ovos", oleaginosas: "Oleaginosas", oleos: "Óleos", especiarias: "Especiarias", adocantes: "Adoçantes", bebidas: "Bebidas" }` |

  `textosComoFicou`:
  | Chave | Texto |
  |---|---|
  | `titulo` | Como ficou? |
  | `texto` | Seu retorno me ajuda a acertar mais nas próximas vezes. |
  | `grupo` | Como ficou {titulo}? |
  | `ajudou` | Ajudou |
  | `naoAjudou` | Não ajudou |
  | `naoFez` | Não fiz |
  | `anotado` | Anotado: {resultado}. |
  | `dia.hoje` | Hoje |
  | `dia.ontem` | Ontem |
  | `dia.dias` | Há {n} dias |
  | `vazia.titulo` | Nada esperando seu retorno. |
  | `vazia.texto` | Quando eu sugerir algo na conversa, aparece aqui. |
  | `vazia.link` | Ir para a conversa |
  | `erro` | Não consegui anotar agora. Tente de novo. |
  | `noscript` | Para responder, ative o JavaScript. |
- testes primeiro: em `config/index.test.ts`, `config.textosCasa.grupos` tem exatamente as chaves de `GRUPOS` (`src/core/knowledge/vocab.ts`); `config.textosCasa.aindaTem.rotuloTenho` contém `{item}`; `config.textosComoFicou.dia.dias` contém `{n}`.
- comandos: `npm run typecheck`, `npm test -- config`, `rtk bypass npm run lint`
- pronto quando: os dois arquivos existem, exportados no índice, testes verdes.
- fora: qualquer código fora de `config/`.

### T3 · Write the house view, the list reason text and the house reader
- nivel: mecanica
- objetivo: funções puras que montam a tela de Minha casa a partir dos stores, e a leitura que as alimenta.
- arquivos: `src/core/pantry/visao.ts`, `src/core/pantry/visao.test.ts`, `src/core/pantry/ler.ts`, `src/core/pantry/ler.test.ts` (todos novos)
- depende de: T1, T2
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  export type ItemNaCasa = {
    id: string
    alimento_id: string | null
    nome: string                                  // da base, ou o nome livre
    grupo: Grupo | null                           // null: a base não conhece
    estado: EstadoCalculado                       // de estadoDoItem (src/core/pantry/estado.ts)
    dias: number                                  // dias inteiros desde confirmado_em, contados no dia local (diaLocal)
    sempre_tenho: boolean
    gosto: "gosta" | "nao_gosta" | null           // sempre null quando grupo é null
    na_lista: boolean
  }
  export type ItemDaListaNaTela = { alimento_id: string; nome: string; motivo: MotivoDaLista; texto: string }
  export type CasaNaTela = {
    ainda_tem: ItemNaCasa[]                       // incertos, do mais antigo para o mais novo
    prateleiras: { grupo: Grupo | "desconhecidos"; nome: string; itens: ItemNaCasa[] }[]  // confirmados e sempre_tenho
    acabou: ItemNaCasa[]                          // ordem alfabética
    lista: ItemDaListaNaTela[]                    // mais recente primeiro (criado_em)
    vazia: boolean                                // nenhum item na casa (a lista não conta)
  }
  export function visaoDaCasa(p: { itens: ItemDaCasa[]; lista: ItemDaLista[]; preferencias: Preferencia[]; kb: KnowledgeBase; agora: Date; fuso: string }): CasaNaTela
  export function textoDoMotivo(item: ItemDaLista): string
  // ler.ts
  export function lerCasa(deps: { stores: Stores; kb: KnowledgeBase; clock: Clock }, contaId: string, fuso: string): Promise<CasaNaTela>
  // pantry.listar(contaId), shortages.lista(contaId) e preferences.ler(contaId, [{ tipo: "alimento", id }] dos alimentos da casa) → visaoDaCasa
  ```
  Regras: pura e sem lançar. Prateleiras só com itens `confirmado` ou `sempre_tenho`, na ordem de `GRUPOS` (`src/core/knowledge/vocab.ts`), a de desconhecidos (grupo `"desconhecidos"`, nome `config.textosCasa.prateleira.desconhecidos`) por último; grupo sem item não aparece; `nome` da prateleira de `config.textosCasa.grupos[grupo]`; dentro de cada uma, `a.nome.localeCompare(b.nome, "pt-BR")`. Incertos só em `ainda_tem` (nunca nas prateleiras). `acabou` separado, em ordem alfabética. `na_lista`: o alimento está em `lista`. Item da lista cujo alimento não existe mais na base não aparece. `textoDoMotivo`: `faltou_hoje` → `lista.faltouHoje` com `{detalhe}`; `fez_falta` → `lista.fezFalta` com `{detalhe}`; `pessoa` → `lista.pessoa`. `dias`: diferença em dias entre `diaLocal(confirmado_em, fuso)` e `diaLocal(agora, fuso)` (procure `diaLocal` com grep em `src/core/`). Gosto: preferência `{ tipo: "alimento", id: alimento_id }` da conta.
- testes primeiro: incerto só em `ainda_tem` (e do mais antigo ao mais novo); ordem dos grupos e dos itens (com acento: "Açafrão" antes de "Banana"); desconhecidos por último e com `gosto: null`; "acabou" separado; `na_lista`; `vazia` true sem itens mesmo com lista; lista sem alimento fora da base; lista do mais recente ao mais antigo; `textoDoMotivo` nos três motivos; `dias` atravessando a meia-noite no fuso; `lerCasa` com `createMemoryStores` devolvendo o mesmo que `visaoDaCasa`.
- comandos: `npm run typecheck`, `npm test -- src/core/pantry`, `rtk bypass npm run lint`
- pronto quando: testes verdes, sem `new Date()` no core (tempo pelo `agora`/`clock`).
- fora: container, rotas, telas.

### T4 · Write the Como ficou view
- nivel: mecanica
- objetivo: função pura que agrupa as sugestões que esperam retorno por dia.
- arquivos: `src/core/outcomes/visao.ts`, `src/core/outcomes/visao.test.ts` (novos)
- depende de: T2
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  export type RetornoNaTela = {
    id: string
    tipo: TipoDeSugestao
    titulo: string
    ingredientes: string[]                        // nomes dos alimentos da base, na ordem; id fora da base fica de fora
    status: "aguardando" | "respondido"
    resultado: Resultado | null
  }
  export type ComoFicouNaTela = { dias: { dia: string; nome: string; retornos: RetornoNaTela[] }[]; total: number }
  export function retornoNaTela(r: Retorno, kb: KnowledgeBase): RetornoNaTela
  export function visaoComoFicou(p: { retornos: Retorno[]; kb: KnowledgeBase; agora: Date; fuso: string }): ComoFicouNaTela
  ```
  Só `aguardando` com `criado_em` nos últimos `config.memoria.retornosDias` (7) dias; `dia` é o dia local (`diaLocal`) de `criado_em`; `nome` vem de `config.textosComoFicou.dia` (`hoje`, `ontem`, `dias` com `{n}`). Dias e retornos do mais recente para o mais antigo. `total` = número de retornos na visão. Os campos de `Retorno`, `Resultado` e `TipoDeSugestao`: leia `src/core/outcomes/ports.ts` e importe de lá (ou de onde `ports.ts` reexporta).
- testes primeiro: só aguardando; fora de 7 dias sai; dia no fuso (criado às 23h30 de Brasília é o dia de Brasília); nomes Hoje, Ontem, Há 3 dias; ordem; ingredientes pelos nomes da base; `retornoNaTela` de um respondido mantém `resultado`.
- comandos: `npm run typecheck`, `npm test -- src/core/outcomes`, `rtk bypass npm run lint`
- pronto quando: testes verdes, função pura.
- fora: stores, container, rotas, telas.

### T5 · Add the house and list touches
- nivel: mecanica
- objetivo: toques da casa e da lista no core, sem modelo, numa transação e dentro do span `toque`.
- arquivos: `src/core/touches/casa.ts`, `src/core/touches/casa.test.ts`, `src/core/touches/lista.ts`, `src/core/touches/lista.test.ts` (novos), `src/core/touches/index.ts`, `src/core/touches/index.test.ts`
- depende de: T1
- leitura: nenhuma (siga `src/core/touches/gosto.ts` e `retorno.ts`: `deps.telemetry.span("toque", { tipo }, …)`, `deps.tx`, `RituError("toque_invalido", "Toque inválido")`)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // casa.ts
  export const acaoDaCasaSchema = z.discriminatedUnion("acao", [
    z.strictObject({ acao: z.literal("adicionar"), alimento_id: z.string().min(1).max(60) }),
    z.strictObject({ acao: z.literal("adicionar_texto"), texto: z.string().trim().min(2).max(40) }),
    z.strictObject({ acao: z.literal("tenho"), item_id: z.uuid() }),           // Ainda tenho · Tenho de novo
    z.strictObject({ acao: z.literal("acabou"), item_id: z.uuid() }),
    z.strictObject({ acao: z.literal("sempre_tenho"), item_id: z.uuid(), valor: z.boolean() }),
    z.strictObject({ acao: z.literal("tirar"), item_id: z.uuid() }),
  ])
  export type AcaoDaCasa = z.infer<typeof acaoDaCasaSchema>
  export function tocarCasa(deps: Deps, contaId: string, acao: AcaoDaCasa): Promise<{ nome: string }>

  // lista.ts
  export const acaoDaListaSchema = z.strictObject({ acao: z.enum(["por", "tirar"]), alimento_id: z.string().min(1).max(60) })
  export type AcaoDaLista = z.infer<typeof acaoDaListaSchema>
  export function tocarLista(deps: Deps, contaId: string, acao: AcaoDaLista): Promise<{ nome: string }>
  ```
  `tocarCasa`, numa transação (`deps.tx`), dentro do span `toque` com `{ tipo: "casa" }`:
  | Ação | Faz | Recusa com `toque_invalido` |
  |---|---|---|
  | `adicionar` | `pantry.registrar(contaId, [{ alimento_id }], "tela")` | Alimento fora da base (`deps.kb.alimento(id) === undefined`) |
  | `adicionar_texto` | `identificarAlimento(texto, deps.kb)` (`src/core/knowledge/identificar.ts`): achou alimento → como `adicionar`; não → `registrar([{ nome_livre: texto }], "tela")` | — |
  | `tenho` | Lê o item da conta (`pantry.listar(contaId)` e acha pelo id); `registrar` com a mesma referência (`alimento_id` ou `nome_livre`) | Item que não é da conta |
  | `acabou` | `marcarAcabou(contaId, [referência do item])`. **Nenhuma falta** (não chame `shortages.registrar`) | Idem |
  | `sempre_tenho` | `definirSempreTenho(contaId, item_id, valor)` | Item que não é da conta, ou `valor: true` em item cujo estado (`estadoDoItem`) é `acabou` |
  | `tirar` | `pantry.tirar(contaId, item_id)` | Item que não é da conta |

  Confira em `src/core/pantry/ports.ts` se `"tela"` é um valor de `ItemDaCasa["origem"]`; se não for, use o valor existente mais próximo de "a pessoa tocou na tela" e diga qual no retorno.

  `tocarLista`, numa transação, dentro do span `toque` com `{ tipo: "lista" }`: alimento fora da base → `toque_invalido`. `por`: `shortages.porNaLista(contaId, { alimento_id, motivo: "pessoa", detalhe: "" })`; já na lista: não muda nada (não sobrescreve o motivo). `tirar`: `shortages.tirarDaLista` e `shortages.apagarDoAlimento`.

  O `nome` devolvido é o nome da base ou o nome livre (só para a frase da tela; nunca vai para span, métrica ou log). `createTouches` ganha `tocarCasa(contaId, acao)` e `tocarLista(contaId, acao)`, e o index reexporta os schemas e os tipos.
- testes primeiro (com `createMemoryStores` e o fake de telemetria, como em `gosto.test.ts`): cada ação de casa e cada recusa; "acabou" não grava falta (`shortages.diasComFalta` vazio); `adicionar_texto` com "abóbora" cai no alimento da base; texto desconhecido vira `nome_livre`; `sempre_tenho: true` em item acabado recusa; item de outra conta recusa e nada muda; `por` idempotente (motivo anterior preservado); `tirar` apaga as faltas; span `toque` com atributos exatamente `{ tipo: "casa" }` / `{ tipo: "lista" }`.
- comandos: `npm run typecheck`, `npm test -- src/core/touches`, `rtk bypass npm run lint`
- pronto quando: testes verdes; nenhum nome de alimento em atributo de span.
- fora: container, rotas, telas, `nomes.ts`.

### T6 · Wire the readers into the container and add the touch routes
- nivel: mecanica
- objetivo: o container expõe `lerCasa` e `lerComoFicou`, e as seis rotas da spec respondem por `criarRota`.
- arquivos: `src/infra/container.ts`, `src/app/_rotas/casa.ts`, `src/app/_rotas/casa.test.ts` (novos os dois), `src/app/api/casa/route.ts`, `src/app/api/preferencias/route.ts`, `src/app/api/lista/route.ts`, `src/app/api/retornos/route.ts`, `src/app/api/retornos/[id]/route.ts` (novos)
- depende de: T3, T4, T5
- leitura: `.docs/ARCHITECTURE.md` §3 (só a tabela "Rotas de toque")
- skills: `next-best-practices` (só `route-handlers.md`)
- referencia: nenhuma
- contratos:
  ```ts
  // Container
  lerCasa(contaId: string): Promise<CasaNaTela>          // fuso: (await stores.profiles.ler(contaId))?.cidade_fuso ?? config.clima.fusoPadrao; lerCasa de src/core/pantry/ler.ts
  lerComoFicou(contaId: string): Promise<ComoFicouNaTela> // stores.outcomes.pendentes(contaId) → visaoComoFicou, mesmo fuso
  // src/app/_rotas/casa.ts
  export function rotasDaCasa(deps: DepsDaRota): { lerCasa; tocarCasa; preferencias; lista; lerRetornos; responderRetorno }
  ```
  Siga `src/app/_rotas/conversa.ts` (`criarRota(deps, opts, fn)`, schema do corpo nas opções) e `src/app/api/runs/[id]/voto/route.ts` (o `route.ts` só faz `export const GET|POST = rotasDaCasa(depsReais()).<nome>`). Para o `:id` de retorno, veja como `rotaDoRun` lê `params`.
  | Rota | Corpo | Faz | Resposta |
  |---|---|---|---|
  | `GET /api/casa` | — | `container.lerCasa` | `{ casa: CasaNaTela }` |
  | `POST /api/casa` | `acaoDaCasaSchema` | `touches.tocarCasa` e `lerCasa` | `{ casa, nome }` |
  | `POST /api/preferencias` | `z.strictObject({ alimento_id: z.string().min(1).max(60), gosto: z.enum(["gosta","nao_gosta"]).nullable() })` | `touches.tocarGosto(conta.id, { tipo: "alimento", id: alimento_id }, gosto)` e `lerCasa`; `nome` da base | `{ casa, nome }` |
  | `POST /api/lista` | `acaoDaListaSchema` | `touches.tocarLista` e `lerCasa` | `{ casa, nome }` |
  | `GET /api/retornos` | — | `container.lerComoFicou` | `{ comoFicou: ComoFicouNaTela }` |
  | `POST /api/retornos/:id` | `z.strictObject({ resultado: z.enum(["ajudou","nao_ajudou","nao_fez"]) })` | `:id` não uuid → `RituError("toque_invalido")`; `touches.tocarRetorno`; `retornoNaTela(retorno, kb)`; `pendentes` = `(await lerComoFicou).total` | `{ retorno: RetornoNaTela; pendentes: number }` |
  Erros (já feitos por `criarRota`): sem sessão `401 { erro: "sem_sessao" }`; corpo fora do schema `400 { erro: "corpo_invalido" }`; `toque_invalido` `400`; corpo grande `413`. Retorno já respondido: `tocarRetorno` devolve o retorno como está e a rota responde 200 com ele.
- testes primeiro (`casa.test.ts`, com o container em memória como em `src/app/_rotas/conversa.test.ts`): cada rota sem sessão → 401; corpo inválido → 400 `corpo_invalido`; item de outra conta → 400 `toque_invalido`; `alimento_id` fora da base em preferências e lista → 400 `toque_invalido`; `:id` não uuid → 400; corpo grande → 413; `POST /api/casa` "acabou" devolve a casa com o item em `acabou`; retorno respondido duas vezes devolve o primeiro resultado.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: rotas no build, testes verdes, teste de arquitetura verde.
- fora: telas, evals, `nomes.ts`.

### T7 · Add the deterministic evals for the house touches
- nivel: mecanica
- objetivo: evals de segurança e de efeito das rotas novas, e os toques novos no teste de canários.
- arquivos: `evals/det/seguranca/toques-casa.eval.ts`, `evals/det/casa/efeito.eval.ts` (novos), `evals/det/mapa.ts`, `evals/det/telemetria/privacidade.eval.ts`
- depende de: T6
- leitura: nenhuma (siga `evals/det/seguranca/conversa.eval.ts` para as rotas e `evals/det/aprendizado/*.eval.ts` para montar o perfil semeado e o preparo seguinte)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `toques-casa.eval.ts`: cada rota (`GET/POST /api/casa`, `POST /api/preferencias`, `POST /api/lista`, `GET /api/retornos`, `POST /api/retornos/:id`) sem sessão → `401`; item da casa, retorno e alimento da lista de outra conta → `400 toque_invalido` e nada gravado; `GET /api/casa` e `GET /api/retornos` não trazem nada de outra conta.
  - `efeito.eval.ts`, com os stores em memória e o perfil semeado: "acabou" pela rota tira o alimento dos candidatos do preparo seguinte e não grava falta; "não gosto" pela rota tira o alimento; "sempre tenho" num incerto o tira de `ainda_tem`; "tirar da lista" apaga as faltas e o `para_ter` do mesmo alimento não volta no preparo seguinte; "pôr na lista" de alimento cuja proposta foi recusada grava `pessoa`.
  - `privacidade.eval.ts`: acrescente `tocarCasa` (com `adicionar_texto` de um texto canário) e `tocarLista` aos toques que o teste de canários já percorre; nenhum span, métrica ou log leva o canário.
  - `mapa.ts`: registre os dois arquivos novos no formato existente.
- testes primeiro: os próprios evals.
- comandos: `npm run eval:det`, `npm test -- evals/det/mapa`, `rtk bypass npm run lint`
- pronto quando: `eval:det` verde e o teste do mapa verde.
- fora: código de `src/`.

### T8 · Build the Minha casa screen
- nivel: tela
- objetivo: `/casa` mostra e corrige a casa: Ainda tem?, prateleiras, Acabou, Para ter em casa, folhas do item e de adicionar.
- arquivos: `src/components/ritu/casa/use-casa.ts`, `minha-casa.tsx`, `ainda-tem.tsx`, `prateleira.tsx`, `item.tsx`, `folha-item.tsx`, `adicionar.tsx`, `lista.tsx` (todos novos em `src/components/ritu/casa/`), `src/app/(app)/casa/page.tsx`, `src/app/(app)/casa/loading.tsx` (novo)
- depende de: T6
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §9; `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design` (antes de escrever), `web-design-guidelines` (antes de entregar), `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos:
  - Dados: `CasaNaTela`, `ItemNaCasa`, `ItemDaListaNaTela` de `src/core/pantry/visao.ts` (formato na T3). Rotas: `POST /api/casa` (corpo `acaoDaCasaSchema`: `adicionar {alimento_id}`, `adicionar_texto {texto}`, `tenho {item_id}`, `acabou {item_id}`, `sempre_tenho {item_id, valor}`, `tirar {item_id}`), `POST /api/preferencias` (`{ alimento_id, gosto: "gosta"|"nao_gosta"|null }`), `POST /api/lista` (`{ acao: "por"|"tirar", alimento_id }`); todas devolvem `{ casa, nome }`. Busca: `GET /api/alimentos` (017; veja como `src/app/(onboarding)` usa o `ComboBox` com mínimo de 2 caracteres). Textos: `config.textosCasa` (nunca texto solto no componente).
  - Componentes (só os base da 016 e os ícones Phosphor `light`, `@phosphor-icons/react`; confira os nomes no pacote):
    | Arquivo | Exporta | O que é |
    |---|---|---|
    | `use-casa.ts` | `useCasa(inicial: CasaNaTela)` | Estado; `tocar(acao)`, `gostar(alimento_id, gosto)`, `lista(acao)`; chama a rota, troca a casa pela resposta (sem otimismo), `toast` de confirmação (`confirma.*` com `{Item}`/`{item}`) ou de erro (`erro`); com `toque_invalido`, relê `GET /api/casa`; com `401`, volta à Entrada como a 017/018 fazem |
    | `minha-casa.tsx` | `MinhaCasa` | `h1` "Minha casa" e botão "Adicionar" (`Plus`); Ainda tem?; prateleiras; Acabou; Para ter em casa; vazia: `StateBlock kind="empty"` com `vazia.titulo`, `vazia.texto` e o botão "Adicionar"; `noscript` com `textosCasa.noscript` |
    | `ainda-tem.tsx` | `AindaTem` | `Surface tone="sunken"` sem sombra, `h2` com `Question`, `aindaTem.texto`; por item: nome, `estado.dias`, "Ainda tenho" (`secondary`, `size="sm"`, `aria-label` `rotuloTenho`) e "Acabou" (`quiet`, `size="sm"`, `aria-label` `rotuloAcabou`). Sem incertos não renderiza |
    | `prateleira.tsx` | `Prateleira` | `section` com `h2` (nome do grupo em Cormorant Garamond `text-xl` peso 500 e o número em Figtree `ink-muted`, `prateleira.numero`/`numeroUm`), `ul` de rótulos que quebram linha, assentados sobre linha de 1px em `line` com 0.5rem de `sunken` embaixo (a tábua) |
    | `item.tsx` | `ItemDaCasa` | `Chip` com o nome e os ícones `PushPin` (sempre tenho), `Heart` (gosta), `HeartBreak` (não gosta); nome acessível em palavras: "Canela, sempre tenho, você gosta"; abre `FolhaDoItem` |
    | `folha-item.tsx` | `FolhaDoItem` | `Sheet` com o nome, a linha de estado (`estado.hoje`/`ontem`/`dias`/`sempre`/`acabou`/`desconhecido`), `Switch` "Sempre tenho" (só em item que a pessoa tem), dois `ToggleChip` exclusivos Gosto · Não gosto (tocar no marcado manda `null`; ausentes quando `grupo === null`), e ações: item em casa → "Acabou" e "Tirar da casa"; item acabado → "Tenho de novo", "Pôr na lista" ou o texto "Já está na lista" (`na_lista`), "Tirar da casa" |
    | `adicionar.tsx` | `FolhaAdicionar` | `Sheet` "Adicionar à casa" com o `ComboBox` da busca; escolher registra (`adicionar`); sem resultado, a opção `adicionarLivre` manda `adicionar_texto`; a folha fica aberta, campo limpo, `toast` `adicionado` |
    | `lista.tsx` | `ListaParaTer` | `section` com `h2` e `ShoppingBag`; linhas com divisórias `line`: nome, motivo (`texto`) em `ink-muted`, "Comprei" (`secondary`, `Check`; manda `POST /api/casa` `adicionar`) e "Tirar da lista" (`quiet`; `POST /api/lista` `tirar`); vazia: `lista.vazia` |
  - Página `/casa` (servidor): `exigirPasso("pronto")` (017), `container.lerCasa(conta.id)` (use o helper de conta da página `/conversa`), `<MinhaCasa inicial={casa} />`. `loading.tsx`: `StateBlock kind="loading"`.
  - Ordem da página: Ainda tem? → prateleiras (grupos na ordem da visão; desconhecidos por último) → prateleira "Acabou" → Para ter em casa.
  - Depois de cada toque: o botão tocado fica `isPending`; se a folha fecha porque o item mudou de seção, o foco vai para o `h2` da seção nova. O item que muda de seção aparece no novo lugar só com opacidade (`--ritu-fast`), nada com movimento reduzido, sem animação de layout.
  - Acessibilidade: WCAG 2.2 AA; cor nunca é o único sinal; 200% de zoom em 1280 px sem rolagem horizontal. Só classes de token (sem `dark:`, sem cor literal). React Aria só em `src/components/`.
- testes primeiro: nenhum teste de unidade obrigatório (o E2E é a T10); `npm run build` e o `design-guard` precisam passar.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: `/casa` renderiza a casa do seed no `npm run start` em modo e2e, sem erro de console; gates verdes.
- fora: `src/components/base/`, rotas, `/como-ficou`, E2E.

### T9 · Build the Como ficou screen
- nivel: tela
- objetivo: `/como-ficou` lista as sugestões que esperam retorno, por dia, com Ajudou · Não ajudou · Não fiz.
- arquivos: `src/components/ritu/como-ficou/como-ficou.tsx`, `src/components/ritu/como-ficou/item.tsx` (novos), `src/app/(app)/como-ficou/page.tsx`, `src/app/(app)/como-ficou/loading.tsx` (novo)
- depende de: T6
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §10; `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design` (antes de escrever), `web-design-guidelines` (antes de entregar), `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos:
  - Dados: `ComoFicouNaTela` e `RetornoNaTela` de `src/core/outcomes/visao.ts` (formato na T4). Rota: `POST /api/retornos/:id` com `{ resultado: "ajudou"|"nao_ajudou"|"nao_fez" }` → `{ retorno: RetornoNaTela; pendentes: number }`. Textos: `config.textosComoFicou`.
  - `ComoFicou` (`"use client"`): `h1` `titulo`, o `texto`, um `h2` por dia (Figtree `text-sm` peso 600), da mais recente para a mais antiga; vazia: `StateBlock kind="empty"` com `vazia.titulo`, `vazia.texto` e `TextLink` `vazia.link` para `/conversa`; `noscript` com `textosComoFicou.noscript`.
  - `ItemDeRetorno`: `Surface tone="surface"`, ícone do tipo (os da 018: veja o mapa de ícones de tipo em `src/components/ritu/conversa/sugestao.tsx`, `Coffee`, `BowlFood`, `Drop`, `Wind`), título em Cormorant como `h3`, ingredientes (nomes), e Ajudou · Não ajudou · Não fiz num grupo com `aria-label` `grupo` ("Como ficou <título>?"). Depois do toque, os botões dão lugar a "Anotado: <resultado>." (`anotado`, resultado em minúsculas pelo rótulo do botão) com o ícone `Check`, em `role="status"`. Se a rota devolve um retorno já respondido, mostra o resultado gravado. Erro: `toast` `erro`; `toque_invalido` tira o item da tela; `401` volta à Entrada como a 018 faz. O botão tocado fica `isPending`.
  - Respondido fica na tela até sair; recarregar não o mostra (a página relê do servidor).
  - Página (servidor): `exigirPasso("pronto")`, `container.lerComoFicou(conta.id)`, `<ComoFicou inicial={…} />`. `loading.tsx`: `StateBlock kind="loading"`.
  - Nenhuma contagem na barra de navegação. Só classes de token; WCAG 2.2 AA.
- testes primeiro: nenhum de unidade obrigatório (E2E é a T11).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: `/como-ficou` renderiza as 2 sugestões do seed em modo e2e; gates verdes.
- fora: `src/components/base/`, `src/components/ritu/casa/`, rotas, E2E.

### T10 · Write the Minha casa E2E and take its screenshots
- nivel: tela
- objetivo: `e2e/casa.spec.ts` cobre os critérios de Minha casa e grava as screenshots com `SCREENSHOTS=1`.
- arquivos: `e2e/casa.spec.ts` (novo); correções pontuais em `src/components/ritu/casa/*` só se o E2E revelar defeito (diga quais)
- depende de: T8
- leitura: nenhuma (siga `e2e/conversa.spec.ts`: `test`, `entrarNaDemo`, `entrarComContaNova`, `expectSemViolacoes`, `TEMAS`, `usarTema`, o projeto `celular`/`desktop` e o padrão de screenshots com `SCREENSHOTS=1`)
- skills: `web-design-guidelines`
- referencia: nenhuma
- contratos (modo e2e, conta da demonstração):
  - os 3 incertos do seed em "Ainda tem?": dois "Ainda tenho" e um "Acabou" (pelos `aria-label` "Ainda tenho <item>" e "<Item> acabou"); a seção some; os dois vão para a prateleira do grupo, o terceiro para "Acabou";
  - folha do item: "Sempre tenho" liga; Gosto marca e o nome acessível do rótulo diz "você gosta"; "Tirar da casa" tira;
  - adicionar pela busca e por texto livre ("Adicionar “…” assim mesmo"), com o aviso "<Item> está na sua casa.";
  - cardamomo: na Conversa, o roteiro `demo` da 018 com a linha de cardamomo aprovada; em `/casa`, cardamomo aparece em "Para ter em casa" com "Fez falta 3 vezes nos últimos 30 dias"; "Comprei" o põe na prateleira "Especiarias" e o tira da lista;
  - "Pôr na lista" num item que acabou mostra "Você pôs na lista";
  - `POST /api/casa` com `Origin` de outro site → `403`;
  - um caminho só com teclado (abrir folha, marcar, fechar com Esc);
  - `expectSemViolacoes` em cheia (seed), vazia (`entrarComContaNova`) e com a folha aberta, nos dois temas, em `celular` e `desktop`; com 200% de zoom em 1280 px, sem rolagem horizontal;
  - screenshots (só com `SCREENSHOTS=1`): `.plans/019-casa-<cheia|vazia|folha>-<light|dark>-<celular|desktop>.png`.
- testes primeiro: o próprio spec.
- comandos: `npm run build`, `CI=1 npm run test:e2e -- e2e/conversa.spec.ts` (confere a C3 de dia; falha ali é relatada, não corrigida), `CI=1 npm run test:e2e -- e2e/casa.spec.ts`, depois `SCREENSHOTS=1 CI=1 npm run test:e2e -- e2e/casa.spec.ts`. Porta 3000 ocupada: espere e repita. Antes de terminar, reverta os `.plans/017-*.png` que o E2E da 017 regravar (`git checkout -- .plans/017-*.png`).
- pronto quando: E2E verde nos dois projetos; 12 screenshots gravadas.
- fora: `/como-ficou`, rotas, core.

### T11 · Write the Como ficou E2E and take its screenshots
- nivel: tela
- objetivo: `e2e/como-ficou.spec.ts` cobre os critérios de Como ficou? e grava as screenshots.
- arquivos: `e2e/como-ficou.spec.ts` (novo); correções pontuais em `src/components/ritu/como-ficou/*` só se o E2E revelar defeito (diga quais)
- depende de: T9, T10
- leitura: nenhuma (siga `e2e/conversa.spec.ts`)
- skills: `web-design-guidelines`
- referencia: nenhuma
- contratos (modo e2e, conta da demonstração):
  - as 2 sugestões do seed aparecem sob "Ontem";
  - "Ajudou" numa e "Não fiz" na outra mostram "Anotado: ajudou." / "Anotado: não fiz." em `role="status"`;
  - recarregar mostra a área vazia ("Nada esperando seu retorno." e o link "Ir para a conversa");
  - voltar à Conversa: o indicador de retornos da 018 sumiu;
  - `expectSemViolacoes` em cheia e vazia, nos dois temas, em `celular` e `desktop`;
  - screenshots (só com `SCREENSHOTS=1`): `.plans/019-como-ficou-<cheia|vazia>-<light|dark>-<celular|desktop>.png`.
- testes primeiro: o próprio spec.
- comandos: `npm run build`, `CI=1 npm run test:e2e -- e2e/como-ficou.spec.ts`, depois com `SCREENSHOTS=1`. Reverta os `.plans/017-*.png` regravados.
- pronto quando: E2E verde nos dois projetos; 8 screenshots gravadas.
- fora: `/casa`, rotas, core.

### C2 · Make the house question scripts independent of the wall clock
- nivel: nucleo
- objetivo: os testes do roteiro `pergunta-casa` passam a qualquer hora e em qualquer data.
- arquivos: a descobrir pelo implementador, restritos a `src/infra/e2e/**`, `e2e/roteiros.ts`, `src/app/_rotas/fluxo-de-run.test.ts`, `src/infra/container.ts` (só o relógio do modo e2e, se for a causa); nada em `src/core/` sem registrar o porquê
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: sem mudança de assinatura pública.
- sintoma: `npx vitest run src/app/_rotas/fluxo-de-run.test.ts src/infra/e2e/roteiros.test.ts` falha em 2 casos ("/resposta numa pergunta de casa segue até o fim"; "pergunta-casa: pergunta de couve e leite e, com a resposta, entrega"): esperava `waiting_for_input`, veio `waiting_for_approval`. Falha também no commit 418af28 (antes da 019), em 2026-11-17 às ~05h20 (Brasília): a causa depende do relógio (hora do dia, data ou dias desde a semente `seed/demo.yaml`, que usa `dias_atras`).
- testes primeiro: reproduzir com relógio fixo (`vi.setSystemTime` ou o `clock` do container) na hora que falha; depois corrigir para que o roteiro não dependa da hora real (preferir fixar o relógio do teste, ou ajustar o roteiro/semente, a mudar regra de produto).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`
- pronto quando: os dois arquivos passam com o relógio em 05:20, 12:00 e 20:00 de Brasília; `npm test` verde.
- fora: telas, regras do core de casa/pergunta (se a causa for regra de produto, pare e relate em vez de mudar).

### C3 · Make the E2E server independent of the hour of the day
- nivel: nucleo
- objetivo: o E2E da pergunta de casa (`e2e/conversa.spec.ts`, mensagem "fui à feira ontem, o que faço pro jantar?") passa a qualquer hora; hoje o servidor em modo e2e usa o relógio real e o momento do dia (`momentoDoDiaDaHora`, `src/core/agents/companion/preparo.ts`) só deixa os preparos com couve e leite como candidatos à noite (00h–04h59 de Brasília).
- arquivos: `src/infra/container.ts` (só o relógio do modo e2e), `src/infra/e2e/clima.ts` ou um novo `src/infra/e2e/relogio.ts` e `src/infra/e2e/relogio.test.ts`; não tocar `e2e/**`, `src/core/**`, `src/components/**`, `src/app/**`
- depende de: C2
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: sem mudança de assinatura pública. Preferência: em `RITU_MODO=e2e`, um relógio que anda junto com o real (minutos e segundos reais, para a cota por minuto e as esperas continuarem valendo) mas com a hora local fixa à noite (por exemplo, o relógio real deslocado para que a hora em `config.clima.fusoPadrao` caia às 01h do mesmo dia local ou do dia seguinte). A data mostrada na tela pode mudar de dia; se isso quebrar algo do E2E (como "Hoje"/"Ontem" ou a semente com `dias_atras`), relate.
- testes primeiro: `relogio.test.ts`: com o relógio real em 05:20, 12:00 e 20:00 de Brasília, a hora local do relógio do e2e cai na faixa da noite; o tempo decorrido entre duas leituras é o real.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`; sem Playwright (a onda tem builds em paralelo; o E2E da conversa roda na T10)
- pronto quando: `relogio.test.ts` e `npm test` verdes; o container em modo e2e usa o relógio novo.
- fora: telas, rotas, regras do core.

### C1 · Share diasEntre next to diaLocal
- nivel: mecanica
- objetivo: uma só `diasEntre` (dias entre dois dias locais `AAAA-MM-DD`), em `src/core/time/dia-local.ts`, usada pelas três cópias.
- arquivos: `src/core/time/dia-local.ts`, `src/core/time/dia-local.test.ts`, `src/core/pantry/visao.ts`, `src/core/outcomes/visao.ts`, `src/core/agents/companion/preparo.ts`
- depende de: T3, T4
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `export function diasEntre(de: string, ate: string): number` = `Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)`. As cópias de `pantry/visao.ts:128` e `outcomes/visao.ts:72` são essa; a de `preparo.ts:675` faz `Date.parse(ate) - Date.parse(de)` sem sufixo: com `AAAA-MM-DD` dá o mesmo (o JS lê a data pura como UTC); confira se `preparo.ts` só passa `AAAA-MM-DD` antes de trocar; se passa outro formato, deixe a cópia de `preparo.ts` e relate. Remova as constantes de dia que ficarem sem uso.
- testes primeiro: em `dia-local.test.ts`: mesmo dia → 0; dia seguinte → 1; virada de mês e de ano; ordem invertida → negativo.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run dup`
- pronto quando: uma só definição de `diasEntre` em `src/`; gates verdes.
- fora: telas, e2e, evals.

### C4 · Date the seeded returns on the day of the seeded conversation
- nivel: nucleo
- objetivo: os retornos copiados da semente nascem no dia da conversa semeada (ontem), não "agora"; assim "Como ficou?" os mostra sob "Ontem".
- arquivos: `src/core/outcomes/ports.ts`, `src/infra/db/outcomes.ts`, `src/infra/fakes/memory-stores.ts` (só `criarOutcomes`), `src/core/accounts/copiar-seed.ts` e os testes deles (inclusive a suíte de contrato das portas, se `outcomes.criar` tiver uma)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `criar(contaId: string, runId: string, sugestoes: SugestaoRegistrada[], opts?: { criadoEm?: Date }): Promise<Retorno[]>`; sem `criadoEm`, igual a hoje (relógio). `copiar-seed.ts` passa o instante da conversa semeada a que os retornos pertencem (o mesmo `dia = diasAtras(hoje, n)` da mensagem; use o horário que a semente já usa para a mensagem, ou meio-dia local, se não houver). `registrar-entrega.ts` não muda.
- causa: `copiar-seed.ts:105` chama `stores.outcomes.criar(...)` e `criarOutcomes` grava `criado_em = clock.now()`; `visaoComoFicou` agrupa por `criado_em`, então as 2 sugestões da semente caem em "Hoje".
- testes primeiro: fake e adaptador (contrato) respeitam `criadoEm`; `copiar-seed` cria os retornos da conversa de ontem com `criado_em` no dia de ontem (no fuso da conta); a limpeza de retornos antigos continua usando `criado_em`.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run eval:det` (só as pastas que usam a semente, se o completo travar por carga). `test:db` não roda (precisa de Postgres): diga se a SQL mudou.
- pronto quando: gates verdes; `visaoComoFicou` sobre a conta da demonstração recém-semeada põe as 2 sugestões em "Ontem" (teste).
- fora: telas, e2e, `registrar-entrega.ts`.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1 | Migração e mudança de assinatura da porta: sozinha |
| 2 | T2, T5 | T5 só depende da T1; arquivos distintos |
| 3 | T3, T4 | Dependem da T1/T2; arquivos distintos |
| 4 | T6 | Container e rotas, usados por tudo que vem depois |
| 5 | T7, T8, T9, C3 | Evals, as duas telas e o relógio do e2e; arquivos distintos |
| 6 | T10 | E2E de casa (build e porta 3000) |
| 7 | T11 | E2E de Como ficou (build e porta 3000) |
