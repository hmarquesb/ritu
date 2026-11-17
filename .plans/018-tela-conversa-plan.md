# 018 · Tela Conversa · Plano

Spec: `.specs/018-tela-conversa.md`. Trilha adiantada (branch `entrega-3`), depois da junção da 017 na `main` autorizada pela dona (2026-11-16).

Lacunas resolvidas pelo orquestrador (registradas em `DECISOES-AUTONOMAS.md`, 018 A1 a A4):

- **A1** A 016 não tem `RadioGroup` nem `ToggleButton`, que a spec usa (pergunta de casa e 👍/👎). A T5 cria os dois em `src/components/base/`, sobre o React Aria, e os mostra na `/marca`.
- **A2** Handlers das rotas em `src/app/_rotas/` (como a 017 A4): funções que recebem `DepsDaRota`, testáveis com os stores em memória; os `route.ts` só ligam o handler a `depsReais()`.
- **A3** `criarRota` hoje responde `400` para todo `RituError`. A T12 cria `statusDoErro(code)` em `src/app/_lib/rota.ts`: `run_nao_encontrado` → 404; `run_aberto`, `run_nao_continuavel`, `pergunta_expirada`, `aprovacao_expirada`, `run_pausado` → 409; o resto → 400. `criarRota` e `criarRotaDeFluxo` usam a mesma função.
- **A4** O estado da tela fica numa função pura (`estado.ts`, redutor) testada no Vitest; `useConversa` só liga o redutor ao `fetch` e aos fluxos.

Contratos comuns (copiados da spec, valem para várias tarefas):

```ts
// src/core/conversation/etapas.ts
export type FraseDeEtapa = { chave: string; texto: string }

// src/core/conversation/visao.ts
export type ItemNaTela = {
  alimento_id: string                   // id efetivo
  nome: string                          // da troca, quando houver
  verbos: string[]
  incerto: boolean                      // casa "incerto" e sem troca
  troca?: { frase: string }
}
export type SugestaoNaTela = {
  posicao: number
  tipo: TipoDeSugestao
  titulo: string
  como_fazer: string
  itens: ItemNaTela[]
  verbos: string[]
  motivo: string
  novidade: boolean
  aviso?: string
  podeTrocar: boolean                   // tem retorno_id e o retorno ainda está "aguardando"
}
export type VisaoDoRun = {
  run_id: string
  status: Run["status"]
  caminho: Caminho
  frases: FraseDeEtapa[]
  resposta?: string
  avisos: { tipo: "incomodo" | "geral"; texto: string }[]
  sugestoes: SugestaoNaTela[]
  evitar: string[]                      // só os textos
  para_ter?: { nome: string; vezes: number; verbos: string[]; motivo: string }
  pergunta?: { estado: "aberta" | "seguiu" | "expirou" | "respondida"; pergunta: Pergunta }
  bloco?: { estado: "aberto" | "anotado" | "recusado" | "seguiu" | "expirou"; linhas: { id: string; texto: string; decisao: "pendente" | "aprovada" | "recusada" | "expirada" }[] }
  voto?: "up" | "down"
  geral: boolean
  podeVotar: boolean                    // há resposta do agente ou do código
}

// src/core/conversation/do-dia.ts
export type FalaNaTela =
  | { autor: "pessoa"; id: string; texto: string; run_id: string | null }
  | { autor: "agente"; id: string; texto: string; run_id: string | null }
export type ConversaDoDia = {
  falas: FalaNaTela[]                   // as do dia, na ordem
  runs: Record<string, VisaoDoRun>      // por run_id das falas, e o aberto
  aberto?: { run_id: string; status: Run["status"] }   // running, waiting_for_input ou waiting_for_approval
  pendentes: number                     // outcomes.pendentes(...).length
  mensagem_sugerida?: string            // demonstração sem fala no dia
}

// src/core/conversation/eventos.ts
export type EventoDaTela =
  | { tipo: "inicio"; run_id: string }
  | { tipo: "etapa"; frase: FraseDeEtapa }
  | { tipo: "fim"; visao: VisaoDoRun; pendentes: number }
  | { tipo: "erro"; erro: string }                     // código; a tela tem o texto
```

Rotas (tabela da spec):

| Rota | Corpo | Faz | Resposta |
|---|---|---|---|
| `GET /api/conversa` | — | `conversaDoDia` | `ConversaDoDia` |
| `POST /api/runs` | `mensagemRecebidaSchema` (008) | `conversation.conversar` com `aoVivo` e `aoCriar` | Fluxo NDJSON de `EventoDaTela` |
| `GET /api/runs/:id` | — | Run da conta → `visaoDoRun` | `{ visao, pendentes }`; sem run: `404 run_nao_encontrado` |
| `POST /api/runs/:id/resposta` | `respostaDaPessoaSchema` (009) | `conversation.continuar` | Fluxo NDJSON |
| `POST /api/runs/:id/aprovacao` | `{ aprovadas: string[] }` (até `aprovacao.maxLinhas`, sem repetir) | `conversation.aprovar` | `{ visao }` |
| `POST /api/runs/:id/troca` | `{ sugestao: number; alimento_id: string; motivo: MotivoDaTroca }` | `touches.trocarIngrediente` | `{ resultado: ResultadoDaTroca; visao }` |
| `POST /api/runs/:id/troca/resposta` | `{ sugestao; alimento_id; candidato: string; resposta: "tenho" \| "nao_tenho" }` | `touches.responderTroca` | `{ resultado; visao }` |
| `POST /api/runs/:id/voto` | `{ voto: "up" \| "down" }` | `touches.tocarVoto` | `{ voto }` |

---

### T1 · Add RunRepository.doDia and votos
- nivel: mecanica
- objetivo: a porta dos runs ganha a leitura dos runs do dia e dos votos, no Postgres e na memória, cobertos pela suíte de contrato.
- arquivos: `src/core/runs/ports.ts`, `src/infra/db/runs.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/runs.contract.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
```ts
// RunRepository (src/core/runs/ports.ts) ganha
doDia(contaId: string, dia: string): Promise<Run[]>                           // mais antigo primeiro
votos(contaId: string, runIds: string[]): Promise<Record<string, "up" | "down">>
```
  - `dia` é `YYYY-MM-DD` no fuso do run, como o `MessageRepository.doDia` (004) já faz: siga exatamente o critério de dia dele (procure `doDia` em `src/infra/db/messages*.ts` e no fake de memória) e reaproveite `diaLocal` se for o caso.
  - O voto já é gravado pela 015 (`touches.tocarVoto`, `src/core/touches/voto.ts`): leia onde ele fica guardado (coluna ou tabela) e leia de lá. Sem migração nova.
  - `votos` de run de outra conta não aparece no resultado; `runIds` vazio → `{}` sem consulta.
  - Toda consulta filtra por `conta_id`.
- testes primeiro: na suíte de contrato (`test/contracts/runs.contract.ts`, roda na memória no `npm test` e no Postgres no `test:db`): `doDia` traz só os runs do dia pedido, na ordem de criação, e não traz run de outra conta; `votos` traz o voto gravado, o trocado (último), nada para run sem voto, nada para run de outra conta, `{}` para lista vazia.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: a suíte de contrato passa na memória; o SQL do Postgres segue o padrão do arquivo (o `test:db` roda no fechamento).
- fora: rotas, telas, `visaoDoRun`.

### T2 · Add the conversation screen configs and texts
- nivel: mecanica
- objetivo: criar `telaConversa` e `textosConversa` e incluí-las em `config/index.ts`.
- arquivos: `config/tela-conversa.ts`, `config/textos-conversa.ts`, `config/index.ts`, `config/index.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
```ts
// config/tela-conversa.ts (em config/index.ts como `telaConversa`)
export const telaConversa = {
  consultaDoRun: { intervaloMs: 2000, maximoMs: 90_000 },
  rotaMaxDurationS: 60,                 // maxDuration das rotas com streaming (teto do Hobby)
  contadorAPartirDe: 800,               // caracteres: o contador aparece a partir daqui (maxCaracteres é o da 008)
} as const
```
  `config/textos-conversa.ts` exporta `textosConversa` (em `config/index.ts` como `textosConversa`), objeto aninhado `as const` com estas chaves (o ponto vira aninhamento: `caixa.rotulo` → `textosConversa.caixa.rotulo`) e textos **exatos**. `{n}`, `{m}`, `{item}`, `{itens}`, `{linha}` ficam literais no texto; quem usa troca.

| Chave | Texto |
|---|---|
| `caixa.rotulo` | Sua mensagem |
| `caixa.apoio` | Conte como você está agora ou pergunte algo. |
| `caixa.atalhos` | Como você está? |
| `caixa.enviar` | Enviar |
| `caixa.respondendo` | O Ritu está respondendo |
| `caixa.vazia` | Escreva algo ou marque como você está. |
| `caixa.longa` | {n} de 1000 caracteres |
| `etapas.ainda` | O Ritu ainda está respondendo… |
| `etapas.passos` | Pensei em {n} passos |
| `etapas.passo` | Pensei em 1 passo |
| `etapas.comoPensei` | Como pensei |
| `etapas.entendendo` | Entendendo sua mensagem… |
| `etapas.cuidado` | Lendo com cuidado… |
| `etapas.clima` | Vendo o clima… |
| `etapas.casa` | Olhando sua casa… |
| `etapas.lembrando` | Lembrando do que você me contou… |
| `etapas.base` | Consultando a base ayurvédica… |
| `etapas.retorno` | Anotando o seu retorno… |
| `etapas.conferindo` | Conferindo a resposta… |
| `etapas.revisando` | Revisando com cuidado… |
| `etapas.memoria` | Atualizando o que sei da sua rotina… |
| `pergunta.pular` | Pular |
| `pergunta.responder` | Responder |
| `pergunta.seguiu` | Você seguiu a conversa. |
| `pergunta.expirou` | Esta pergunta expirou. Pode me contar de novo. |
| `pergunta.opcoesCasa` | Tenho · Não tenho · Não gosto |
| `pergunta.opcoesCome` | Como · Não como |
| `sugestao.porque` | Por quê? |
| `sugestao.novidade` | Novidade |
| `sugestao.incerto` | confira se ainda tem |
| `sugestao.menu` | Opções para {item} |
| `sugestao.menuItens` | Trocar · Não tenho · Não gosto |
| `sugestao.trocaPergunta` | Você tem {item}? |
| `sugestao.trocaOpcoes` | Tenho · Não tenho |
| `evitar.rotulo` | Evite agora: {itens}. |
| `paraTer.rotulo` | Vale ter em casa: {item} |
| `paraTer.vezes` | fez falta {n} vezes nos últimos 30 dias |
| `bloco.titulo` | Posso anotar isto? |
| `bloco.anotar` | Anotar |
| `bloco.agoraNao` | Agora não |
| `bloco.anotei` | Anotei {n} de {m}. |
| `bloco.nada` | Tudo bem, não anotei nada. |
| `bloco.seguiu` | Ficou para depois. Nada foi anotado. |
| `bloco.expirou` | Esta proposta expirou. Nada foi anotado. |
| `bloco.linha` | Anotar: {linha} |
| `rodape.aviso` | Não é orientação médica. |
| `rodape.gostei` | Gostei da resposta |
| `rodape.naoGostei` | Não gostei da resposta |
| `geral` | Resposta geral. Descubra seu dosha para eu acertar mais. |
| `retornos.um` | 1 sugestão esperando seu retorno |
| `retornos.varios` | {n} sugestões esperando seu retorno |
| `vazia.titulo` | Como você está agora? |
| `vazia.texto` | Pode contar do jeito que vier, ou tocar num dos atalhos. |
| `erro.run_aberto` | Ainda estou respondendo a sua última mensagem. |
| `erro.pergunta_expirada` | Esta pergunta expirou. Pode me contar de novo. |
| `erro.aprovacao_expirada` | Esta proposta expirou. Nada foi anotado. |
| `erro.rede` | Não consegui falar com o Ritu agora. Sua mensagem continua aqui. |
| `erro.inesperado` | Algo deu errado do meu lado. Tente de novo. |
| `erro.tentar` | Tentar de novo |
| `abas.conversa` | Conversa |
| `abas.casa` | Minha casa |
| `abas.comoFicou` | Como ficou? |
| `abas.voce` | Você |
| `abas.rotulo` | Navegação principal |
| `emBreve` | Esta parte chega em breve. |
| `semJs` | A conversa precisa de JavaScript para funcionar. |
| `comoPensei.titulo` | Como pensei |

  Acrescente também `formatar(texto: string, valores: Record<string, string | number>): string` em `config/textos-conversa.ts`, que troca cada `{chave}` pelo valor (chave ausente fica literal).
- testes primeiro: `config/index.test.ts`: `telaConversa` e `textosConversa` exportados pelo índice com os valores da tabela (confira ao menos `caixa.rotulo`, `etapas.passos`, `bloco.anotei`, `abas.voce`, `emBreve`); `formatar("Anotei {n} de {m}.", { n: 2, m: 3 })` → `"Anotei 2 de 3."`; chave ausente fica literal.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; nenhum outro arquivo tocado.
- fora: qualquer uso dos textos.

### T3 · Call aoCriar when conversar creates the run
- nivel: nucleo
- objetivo: `conversation.conversar` avisa quem chamou o id do run logo depois de criá-lo, para a rota emitir o evento `inicio`.
- arquivos: `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: a assinatura pública passa a ser
```ts
conversar(contaId: string, mensagem: MensagemRecebida, opts?: { aoVivo?: AoVivo; aoCriar?: (runId: string) => void }): Promise<RespostaDaConversa>
```
  `aoCriar` é chamado uma vez, logo depois de `runs.iniciarRun` e antes de qualquer etapa (`aoVivo`). Se `iniciarRun` lança (`RunAbertoError`), `aoCriar` não é chamado. Um `aoCriar` que lança não interrompe o run (envolva em `try/catch` e siga). `continuar` e `aprovar` não mudam.
- testes primeiro: em `conversar.test.ts`: `aoCriar` recebe o id do run gravado, uma vez, antes do primeiro evento de `aoVivo`; com run aberto (`run_aberto`) não é chamado; `aoCriar` que lança não muda a resposta.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; nenhuma outra mudança de comportamento.
- fora: rotas, eventos da tela.

### T4 · Add the E2E mode scripts, the fixed weather and wire them in the container
- nivel: nucleo
- objetivo: no modo e2e, o Intérprete e o Acompanhante rodam por roteiros escolhidos pelo texto exato da mensagem, e o clima é fixo, sem rede nem chave.
- arquivos: `src/infra/e2e/roteiros.ts`, `src/infra/e2e/clima.ts`, `src/infra/e2e/roteiros.test.ts`, `e2e/roteiros/` (novos: um arquivo `.ts` por roteiro e um `index.ts`), `src/infra/container.ts`, `src/architecture.test.ts`
- depende de: nenhuma
- leitura: `.docs/ARCHITECTURE.md` §3 (fluxo de um run)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `createContainer` com `RITU_MODO=e2e`: `weather` de um fake com clima fixo (frio úmido no Rio: o mesmo do cenário `frio-agitada` de `test/fixtures/cenarios/`); Intérprete e Acompanhante com `createFakeLlm` e `createScriptedRuntime` (os mesmos que `npm run demo` usa; procure-os) alimentados pelo índice de `src/infra/e2e/roteiros.ts`: a mensagem (texto de `textoDaMensagem`, 008) é procurada pelo texto exato; sem roteiro, o caminho é `sem_modelo` (resposta montada por código), que também é um estado testado. Fora do modo e2e nada muda.
  - Os roteiros são escritos contra o perfil semeado da 017 (`seed/demo.yaml`) e **passam no validador real** (a resposta precisa sair de `finalizar` válida e com o aviso médico onde o validador exige):

| Roteiro | Mensagem | O que acontece |
|---|---|---|
| `demo` | A `mensagem_sugerida` do seed (leia de `seed/demo.yaml`) | Intérprete: momento com `com_frio` e `agitada`. Acompanhante: `clima.agora`, `casa.ler`, `finalizar` com `cha-gengibre-canela` e o preparo de abóbora com arroz e ghee, `para_ter` de cardamomo; termina no bloco com a linha de lista e a do padrão |
| `pergunta-casa` | "fui à feira ontem, o que faço pro jantar?" | Pergunta de casa sobre `couve` e `banana` (incertos do seed); com a resposta, entrega |
| `troca` | "quero um chá quente agora" | Entrega um chá com `canela` confirmada e um substituto (`cardamomo` não está em casa; `cravo` ou o que a base der) para o E2E da troca e da pergunta da troca |
| `texto-cru` | "mostra um texto estranho" | Entrega com `resposta` contendo `<script>alert(1)</script>` e `**negrito**` |
| `lento` | "demora um pouco" | Passos com `demoraMs` real (300 ms cada), para o E2E ver as etapas chegando e o de recarregar no meio |

  - Ids de alimento, preparo e prática saem da base real (`data/*.yaml`); não invente id. Se um id da tabela não existir, use o mais próximo e anote na resposta.
  - O fake de clima e o índice de roteiros só são importados por `createContainer` no modo e2e (import dinâmico ou condicional, para não entrar no caminho de produção). Teste de arquitetura: nova regra "`src/infra/e2e/` só é importado por `src/infra/container.ts`".
  - O isolamento por `x-ritu-e2e` da 017 continua valendo.
- testes primeiro: `src/infra/e2e/roteiros.test.ts`: para cada roteiro, rodar `conversation.conversar` (e `continuar` no `pergunta-casa`) com um container e2e sobre os stores em memória e o seed semeado: o run termina no estado esperado (`waiting_for_approval` com as linhas de lista e de padrão no `demo`; `waiting_for_input` com `couve` e `banana` e depois entrega no `pergunta-casa`; entrega com sugestão trocável no `troca`; resposta com `<script>` literal no `texto-cru`); mensagem sem roteiro → caminho `sem_modelo`. Teste de arquitetura com a regra nova.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes verdes; build passa; nada de rede, banco ou chave.
- fora: rotas, telas, `e2e/*.spec.ts`.

### T5 · Add the radio group and the toggle button to the base components
- nivel: tela
- objetivo: criar os dois componentes base que a Conversa usa e que a 016 não tem, e mostrá-los na vitrine.
- arquivos: `src/components/base/radio-group.tsx`, `src/components/base/toggle-button.tsx`, `src/app/marca/_secoes/componentes-campos.tsx`
- depende de: nenhuma
- leitura: `.docs/DESIGN.md` §3 (acessibilidade) e a linha dos componentes base em §4; `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos:
  - `RadioGroup` (rótulo visível obrigatório, `orientation` horizontal por padrão) e `Radio`, sobre `RadioGroup`/`Radio` do `react-aria-components`, no mesmo estilo de `checkbox.tsx` e `chip.tsx` (tokens, foco visível, alvo de toque ≥ 44 px, variantes em mapa de objeto com `cx`).
  - `ToggleButton` sobre o `ToggleButton` do React Aria (`aria-pressed`), com `icon` (Phosphor, `light`; com `weight="fill"` quando selecionado) e nome acessível obrigatório (`aria-label` ou texto). Variantes `quiet` e `secondary` como o `Button`/`IconButton`.
  - Na `/marca`, seção de campos: um `RadioGroup` com três opções (Tenho · Não tenho · Não gosto) e um par de `ToggleButton` 👍/👎 (`ThumbsUp`, `ThumbsDown`) com os estados.
- testes primeiro: o E2E da `/marca` (`e2e/marca.spec.ts`, já existente) deve continuar verde no axe; rode-o com `CI=1 npx playwright test e2e/marca.spec.ts`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test` (inclui `design-guard.test.ts`), `npm run build`, `CI=1 npx playwright test e2e/marca.spec.ts`
- pronto quando: componentes na vitrine, axe verde nos dois temas, guard verde.
- fora: qualquer componente da Conversa.

### T6 · Add the step sentences
- nivel: mecanica
- objetivo: transformar etapas do run nas frases que a tela mostra, por código.
- arquivos: `src/core/conversation/etapas.ts`, `src/core/conversation/etapas.test.ts`
- depende de: T2
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
```ts
export type FraseDeEtapa = { chave: string; texto: string }
export function fraseDaEtapa(etapa: { tipo: TipoDeEtapa; nome: string }): FraseDeEtapa | undefined
export function frasesDoRun(etapas: { tipo: TipoDeEtapa; nome: string }[]): FraseDeEtapa[]   // na ordem, sem chave repetida em seguida
```
  `TipoDeEtapa` vem de `src/core/runs/` (005). O texto vem de `config.textosConversa.etapas.<chave>` (importe `config` como o resto do core faz).

| Etapa (`tipo` / `nome`) | `chave` |
|---|---|
| `interprete` | `entendendo` |
| `guardrail` | `cuidado` |
| `tool` / `clima.*` | `clima` |
| `tool` / `casa.ler` | `casa` |
| `tool` / `preferencias.ler`, `historico.recente` | `lembrando` |
| `tool` / `ayurveda.*` | `base` |
| `tool` / `resultado.registrar` | `retorno` |
| `validacao` | `conferindo` |
| `juiz` | `revisando` |
| `memoria` | `memoria` |
| Qualquer outra (`llm`, `pergunta`, `proposta`, `aprovacao`, `troca_de_modelo`, `erro`, tools de controle e de proposta) | sem frase (`undefined`) |

- testes primeiro: cada linha da tabela (com `clima.agora` e `clima.proximas_horas`, `ayurveda.candidatos`); as sem frase (`llm`, `pergunta`, `proposta`, `aprovacao`, `troca_de_modelo`, `erro`, `tool`/`finalizar`, `tool`/`memoria.propor`); `frasesDoRun` sem repetição seguida (`clima, clima, casa, clima` → `clima, casa, clima`) e pulando as sem frase.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: visão, eventos.

### T7 · Add the signed-in navigation and the empty tab pages
- nivel: tela
- objetivo: barra de navegação de quem entrou (embaixo no celular, lateral no desktop) e as páginas vazias das outras abas.
- arquivos: `src/components/ritu/abas.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/casa/page.tsx`, `src/app/(app)/como-ficou/page.tsx`, `src/app/(app)/voce/page.tsx`, `src/app/(app)/como-pensei/[runId]/page.tsx`
- depende de: T2
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §7 (telas); `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`, `next-best-practices`
- referencia: nenhuma
- contratos:
  - `AbasPrincipais` (`"use client"`, `usePathname`): `nav` com `aria-label` = `textosConversa.abas.rotulo`; itens Conversa (`/conversa`, `ChatCircle`), Minha casa (`/casa`, `House`), Como ficou? (`/como-ficou`, `ArrowsClockwise`), Você (`/voce`, `User`), ícones Phosphor `light` com rótulo visível; item atual com `aria-current="page"` e um traço (token). Links, não botões.
  - Celular: fixa embaixo, quatro itens, altura mínima 3.5rem, `padding-bottom: env(safe-area-inset-bottom)`; o `main` ganha espaço embaixo para a barra (e para a caixa da Conversa, que fica presa acima da barra). Desktop (a partir de 64rem): coluna lateral de 14rem à esquerda do `main`, a mesma lista na vertical.
  - `src/app/(app)/layout.tsx` (017) ganha a `nav`; `DemoBanner` continua logo abaixo do cabeçalho; nada mais muda na moldura.
  - Páginas `/casa`, `/como-ficou`, `/voce`: `exigirPasso("pronto")` (como `/conversa`), `h1` com o nome da aba e `StateBlock kind="empty"` com `textosConversa.emBreve`. `/como-pensei/[runId]`: `h1` "Como pensei" e o mesmo estado vazio. Ícone em componente de servidor vem de `@phosphor-icons/react/ssr`.
- testes primeiro: nenhum novo aqui (o E2E da T17 cobre a barra); rode o E2E existente da entrada/começar, que passa pela moldura.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npx playwright test e2e/entrada.spec.ts e2e/comecar.spec.ts`
- pronto quando: as quatro páginas abrem com a barra; E2E existentes verdes.
- fora: `/conversa/page.tsx`, componentes da conversa.

### T8 · Add the run view projection
- nivel: mecanica
- objetivo: projetar run, etapas, propostas, retornos e voto no que a tela mostra, sem campo interno.
- arquivos: `src/core/conversation/visao.ts`, `src/core/conversation/visao.test.ts`
- depende de: T6
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: os tipos `ItemNaTela`, `SugestaoNaTela` e `VisaoDoRun` do topo deste plano, e
```ts
export function visaoDoRun(p: { run: Run; etapas: RunEtapa[]; propostas: Proposta[]; retornos: Retorno[]; voto?: "up" | "down"; agora: Date }): VisaoDoRun
```
  - Fonte: `run.saida` validada com o schema da saída do Acompanhante (007, `SaidaDoAcompanhante`); `frases` = `frasesDoRun(etapas)`.
  - `pergunta`: com `status: "waiting_for_input"` e pendência dentro da espera (`esperaMinutos`, 005), `aberta`; vencida, `expirou`; run `cancelled` com pendência de pergunta, `seguiu`; run que passou de `waiting_for_input` adiante, `respondida`.
  - `bloco`: só com `saida.propostas` não vazio. `waiting_for_approval` dentro da espera: `aberto`; `expired`: `expirou`; `done` com alguma `aprovada`: `anotado`; `done` com todas `recusada`: `recusado`; propostas `expirada` num run `done` (nova mensagem): `seguiu`. `linhas` com o `id`, o texto e a `decisao` de cada `Proposta`.
  - `ItemNaTela`: id e nome efetivos (da `troca` da sugestão, 011, quando houver); `incerto` = casa `incerto` e sem troca; `troca.frase` quando trocado.
  - `podeTrocar`: a sugestão tem `retorno_id` e o retorno dele em `retornos` está `aguardando`.
  - `podeVotar`: há `resposta`. `geral` e `avisos` vêm prontos na saída.
  - Pura e não lança: saída que não passa no schema vira uma visão só com `resposta` (quando houver texto) e `frases`, `sugestoes: []`, `avisos: []`, `evitar: []`.
  - **Nunca** leva `linhas_base`, `citados`, checkpoint, pendência além da pergunta, `clima_usado`, tokens nem modelos.
- testes primeiro: cada estado de pergunta (aberta, expirou, seguiu, respondida) e de bloco (aberto, anotado, recusado, seguiu, expirou); `podeTrocar` (sem retorno, aguardando, respondido); item trocado e incerto; saída inválida; o `JSON.stringify` da visão de um cenário completo não contém `linha_base`, `citados`, `checkpoint`, `tokens`, `modelo`, `clima_usado`. Use os cenários de `test/fixtures/cenarios/` e os stores em memória para montar runs reais quando ajudar.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: rotas, conversa do dia.

### T9 · Build the speech, steps, footer, returns indicator and message box
- nivel: tela
- objetivo: os componentes da conversa que não dependem da visão de sugestões: falas, etapas, rodapé, indicador de retornos e a caixa com atalhos.
- arquivos: `src/components/ritu/conversa/fala.tsx`, `src/components/ritu/conversa/etapas.tsx`, `src/components/ritu/conversa/rodape.tsx`, `src/components/ritu/conversa/retornos.tsx`, `src/components/ritu/conversa/caixa.tsx`
- depende de: T2, T5, T6
- leitura: `.docs/DESIGN.md` §3 (regras e acessibilidade da conversa) e §4 (componentes do Ritu); `.docs/BUSINESS.md` §8 (atalhos, desenho da resposta) e §10 (indicador de retornos); `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos (componentes controlados, sem `fetch`; o estado é da T15):

| Arquivo | Exporta | O que é |
|---|---|---|
| `fala.tsx` | `FalaDaPessoa`, `FalaDoAgente` | Pessoa: balão em `surface-sunken`, alinhado à direita, até 85% da largura. Agente: texto corrido sem moldura, medida de leitura (até 38rem), entrelinha 1.6; parágrafos por linha em branco; aparece com transição de opacidade de até `--ritu-slow` (nenhuma com movimento reduzido). Texto puro sempre (nada de HTML nem Markdown) |
| `etapas.tsx` | `EtapasAoVivo`, `EtapasRecolhidas` | Ao vivo: lista das frases (`FraseDeEtapa[]`) com o `Spinner` na última, `aria-busy="true"` enquanto trabalha. Recolhidas: "Pensei em N passos" (`etapas.passos`; com 1, `etapas.passo`; com 0, só o link) e o `TextLink` "Como pensei" para `/como-pensei/<run_id>` |
| `rodape.tsx` | `RodapeDaResposta` | Aviso `rodape.aviso`, 👍/👎 com o `ToggleButton` da T5 (`ThumbsUp`, `ThumbsDown`, `aria-pressed`, nomes `rodape.gostei` e `rodape.naoGostei`), props `voto?`, `podeVotar`, `aoVotar(v)` |
| `retornos.tsx` | `IndicadorDeRetornos` | `TextLink` para `/como-ficou` com `retornos.um` (1) ou `retornos.varios` (n); com 0, não renderiza |
| `caixa.tsx` | `CaixaDeMensagem` | Atalhos: 7 `ToggleChip` com ícone e rótulo, num grupo com rótulo visível `caixa.atalhos`; `TextField multiline` com rótulo visível `caixa.rotulo` e apoio `caixa.apoio`; contador `caixa.longa` a partir de `telaConversa.contadorAPartirDe`; botão Enviar (`PaperPlaneRight` + nome `caixa.enviar`) |

  - Atalhos: ids e rótulos de `data/estados.yaml` (`com_frio`, `com_calor`, `pesada`, `seca`, `agitada`, `irritada`, `sem_energia`), ícones `Snowflake`, `Sun`, `Cloud`, `Leaf`, `Lightning`, `Fire`, `BatteryLow` (confira os nomes no pacote; nome inexistente troca pelo mais próximo e vai na resposta). A tela recebe os atalhos por prop (a página lê da base no servidor).
  - Caixa: props `texto`, `atalhos` (marcados), `respondendo`, `aoMudar`, `aoEnviar`. Enter envia; Shift+Enter quebra a linha. Enquanto `respondendo`: `aria-disabled="true"` (não `disabled`), o foco não sai, o motivo `caixa.respondendo` aparece embaixo e é anunciado, Enter não envia. Só espaços e sem atalho: Enviar com `aria-disabled` e `caixa.vazia`. Acima de `config.conversa.maxCaracteres` (1000): não envia, `aria-disabled` e a frase do contador. No celular a caixa fica presa acima da barra (`position: sticky; bottom`), fundo `canvas`, linha `line` em cima.
  - Só classes de token; nada de `dark:`; React Aria só pelos componentes base.
- testes primeiro: nenhum Vitest de componente (o E2E da T17 cobre); `design-guard.test.ts` precisa seguir verde.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: compila, guard verde, componentes sem estado próprio além do de interação.
- fora: `use-conversa.ts`, `conversa.tsx`, a página.

### T10 · Add the stream events codec
- nivel: mecanica
- objetivo: codificar e ler os eventos do fluxo NDJSON.
- arquivos: `src/core/conversation/eventos.ts`, `src/core/conversation/eventos.test.ts`
- depende de: T6, T8
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: o tipo `EventoDaTela` do topo deste plano, e
```ts
export function codificarEvento(e: EventoDaTela): string                // JSON + "\n"
export function lerEventos(): TransformStream<Uint8Array, EventoDaTela>  // usado pela tela; linha inválida é ignorada
```
  `lerEventos` decodifica UTF-8 em fluxo (`TextDecoder` com `stream: true`), junta linhas partidas entre pedaços, ignora linha vazia, JSON inválido ou objeto sem `tipo` conhecido, e emite o resto da última linha no `flush`. Sem dependência de Node (roda no navegador).
- testes primeiro: ida e volta de cada tipo; linha partida em dois pedaços; um caractere multibyte partido entre pedaços; linha inválida no meio é pulada; última linha sem `\n`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: rotas.

### T11 · Add the conversation of the day
- nivel: mecanica
- objetivo: montar o que a tela recebe ao abrir: falas do dia, visões dos runs, run aberto, retornos pendentes e a mensagem sugerida.
- arquivos: `src/core/conversation/do-dia.ts`, `src/core/conversation/do-dia.test.ts`
- depende de: T1, T8
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: os tipos `FalaNaTela` e `ConversaDoDia` do topo deste plano, e
```ts
export function conversaDoDia(deps: { stores: Stores; clock: Clock; seed: DemoSeed }, conta: Conta, perfil: Perfil): Promise<ConversaDoDia>
```
  - Dia local no fuso da cidade do perfil (`perfil.cidade_fuso`), ou `config.clima.fusoPadrao`; use `diaLocal` (004).
  - Lê `messages.doDia`, `runs.doDia`, `runs.aberto` (procure o nome exato na porta), as etapas, propostas (`proposals.doRun`) e retornos (`outcomes.doRun`) de cada run do dia, `runs.votos` e `outcomes.pendentes`; monta `visaoDoRun` por run (com `agora = clock.now()`).
  - `falas`: as mensagens do dia na ordem, com `autor` pessoa/agente; a fala do agente que é o texto de uma pergunta (009) não aparece como fala solta (a pergunta já está na visão do run).
  - `runs`: por `run_id` das falas, e o aberto. `aberto`: run em `running`, `waiting_for_input` ou `waiting_for_approval`.
  - `mensagem_sugerida`: `seed.mensagem_sugerida` só se a conta é de demonstração (`conta.tipo`) e não há fala no dia.
  - Toda leitura leva o `conta.id`.
- testes primeiro (stores em memória, `Clock` fixo): só as falas do dia (ontem fica fora); ordem; fala da pergunta fora; visão por run com voto; `aberto` presente com run em `waiting_for_approval`; `pendentes` com o número de `outcomes.pendentes`; mensagem sugerida só na demonstração sem fala (conta Google sem; demonstração com fala sem); dado de outra conta não aparece.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: rotas e telas.

### T12 · Add the streaming route helper and the error status map
- nivel: nucleo
- objetivo: `criarRotaDeFluxo`, que faz as checagens de `criarRota` e abre um fluxo NDJSON, e o mapa de código de erro para status, usado pelas duas.
- arquivos: `src/app/_lib/fluxo.ts`, `src/app/_lib/fluxo.test.ts`, `src/app/_lib/rota.ts`, `src/app/_lib/rota.test.ts`
- depende de: T2, T10
- leitura: `node_modules/next/dist/docs/` (route handlers com `ReadableStream`, `maxDuration`)
- skills: `next-best-practices` (`route-handlers.md`)
- referencia: nenhuma
- contratos:
  - Em `rota.ts`: `export function statusDoErro(code: string): number`: `run_nao_encontrado` → 404; `run_aberto`, `run_nao_continuavel`, `pergunta_expirada`, `aprovacao_expirada`, `run_pausado` → 409; qualquer outro → 400. `criarRota` passa a responder `statusDoErro(erro.code)` para `RituError` (antes, sempre 400). O resto de `criarRota` não muda.
  - Em `fluxo.ts`:
```ts
export type Emitir = (e: EventoDaTela) => void
export function criarRotaDeFluxo<B>(
  deps: DepsDaRota,
  opts: { corpo?: z.ZodType<B> },
  fn: (ctx: { conta: Conta; corpo: B; request: Request; container: Container }, emitir: Emitir) => Promise<void>,
): (request: Request) => Promise<Response>
```
  - Antes de abrir o fluxo, a mesma checagem de sessão (401 `sem_sessao`), conta, tamanho (413 `corpo_grande`) e corpo (400 `corpo_invalido`) de `criarRota` (extraia e reaproveite as funções de `rota.ts`; não duplique). `fn` pode lançar `RituError` **antes da primeira emissão**: aí a resposta é JSON com `statusDoErro`. Para isso, `fn` recebe um `emitir` que abre o fluxo na primeira chamada; a resposta só é devolvida quando houver a primeira emissão ou `fn` terminar/lançar.
  - Depois do fluxo aberto, erro vira evento `{ tipo: "erro", erro: code }` (`erro_inesperado` para o que não for `RituError`, com `telemetry.log("erro_inesperado")`) e o fluxo fecha.
  - Escrever num fluxo fechado (a pessoa saiu) é ignorado e o trabalho continua. Não ligar `request.signal` ao trabalho.
  - Headers: `Content-Type: application/x-ndjson; charset=utf-8`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. Cada linha sai com `codificarEvento`.
  - Os `route.ts` com fluxo exportam `export const maxDuration = 60` (o valor de `telaConversa.rotaMaxDurationS`; o Next exige literal estático: confira na doc instalada e anote) — isso fica nas tarefas das rotas; aqui só documente no comentário do arquivo.
- testes primeiro: `fluxo.test.ts`: 401 sem sessão, 413, 400 antes do fluxo; `RituError` antes da primeira emissão → JSON com 409/400; eventos emitidos chegam em ordem, uma linha cada; `RituError` depois da emissão → evento `erro` com o código e fluxo fechado; consumidor que cancela o fluxo no meio não interrompe `fn` (ela termina e grava). `rota.test.ts`: `statusDoErro` de cada código e um caso de `criarRota` com `run_aberto` → 409.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; rotas da 017 continuam verdes.
- fora: as rotas da conversa.

### T13 · Add the screen state reducer and the useConversa hook
- nivel: nucleo
- objetivo: o estado da tela num só lugar: redutor puro testado e o hook que o liga ao servidor.
- arquivos: `src/components/ritu/conversa/estado.ts`, `src/components/ritu/conversa/estado.test.ts`, `src/components/ritu/conversa/use-conversa.ts`
- depende de: T2, T8, T10, T11
- leitura: `.docs/ARCHITECTURE.md` §3 (fluxo de um run, estados)
- skills: `vercel-react-best-practices`
- referencia: nenhuma
- contratos:
  - `estado.ts` (puro, sem React): `EstadoDaConversa` = `{ falas, runs, aberto?, pendentes, caixa: { texto, atalhos: string[], respondendo: boolean }, aoVivo?: { run_id?: string; frases: FraseDeEtapa[] }, erro?: { codigo: string; texto?: string; atalhos: string[] }, anuncio?: string }`; `inicial(c: ConversaDoDia): EstadoDaConversa` (caixa com `mensagem_sugerida` quando houver); `reduzir(estado, acao)` com ações: `enviou` (fala da pessoa otimista com `textoDaMensagem`, caixa respondendo), `evento` (`inicio`, `etapa` sem repetir a chave anterior, `fim` → visão do run, fala do agente, caixa vazia e atalhos desmarcados, `anuncio` = resposta completa uma vez, `pendentes`; `erro` → `erro` com o código), `falhou` (rede/inesperado: a mensagem e os atalhos voltam para a caixa), `visao` (troca, aprovação, voto ou consulta: substitui a visão do run), `digitou`, `marcou`.
  - `lerEventos` (T10) só confere o `tipo` de cada evento: o redutor não confia nos campos sem checar (evento `fim` sem `visao` válida, ou `etapa` sem `frase.chave`, é ignorado ou vira `erro.inesperado`, nunca quebra a tela).
  - Run com pergunta aberta ou bloco aberto e nova mensagem enviada: a visão anterior passa a `seguiu` na tela quando o servidor devolver (a tela relê o run anterior depois do `fim`).
  - `use-conversa.ts` (`"use client"`): `useConversa(inicial: ConversaDoDia)` devolve o estado e `enviar()`, `responder(runId, resposta)`, `aprovar(runId, aprovadas)`, `trocar(runId, corpo)`, `responderTroca(runId, corpo)`, `votar(runId, voto)`, `tentarDeNovo()`. Envio: `POST /api/runs` (corpo `mensagemRecebidaSchema` da 008: texto e atalhos), lê `response.body.pipeThrough(lerEventos())`; resposta JSON não-200 vira `erro` com o código (`run_aberto` → texto `erro.run_aberto`). Resposta: `POST /api/runs/:id/resposta`, mesmo fluxo. Aprovação, troca, voto: rotas JSON, despacham `visao`. Fluxo que termina sem `fim` (conexão caiu) ou estado inicial com `aberto.status === "running"`: consulta `GET /api/runs/:id` a cada `telaConversa.consultaDoRun.intervaloMs` até sair de `running` ou passar de `maximoMs` (aí `erro.inesperado`). `401` em qualquer pedido: `window.location.assign("/")`.
  - Nada de texto de mensagem em `localStorage` ou cookie.
- testes primeiro (`estado.test.ts`): `inicial` com e sem mensagem sugerida; envio otimista; etapas sem repetir; `fim` limpa a caixa, desmarca atalhos, anuncia uma vez; `falhou` devolve texto e atalhos à caixa; `erro` `run_aberto`; `visao` substitui só o run certo.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; hook compila.
- fora: componentes visuais.

### T14 · Build the suggestion, ingredient, buy-later line, question and approval block
- nivel: tela
- objetivo: os componentes da conversa que mostram a visão do run: sugestão com ingredientes e menu, "Vale ter em casa", pergunta do agente e bloco de aprovação.
- arquivos: `src/components/ritu/conversa/sugestao.tsx`, `src/components/ritu/conversa/ingrediente.tsx`, `src/components/ritu/conversa/para-ter.tsx`, `src/components/ritu/conversa/pergunta.tsx`, `src/components/ritu/conversa/bloco-aprovacao.tsx`
- depende de: T2, T5, T8
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §8 (fluxo de uma mensagem e desenho da resposta); `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos (componentes controlados, recebem a parte da `VisaoDoRun` e callbacks; sem `fetch`):

| Arquivo | Exporta | O que é |
|---|---|---|
| `sugestao.tsx` | `BlocoDeSugestao` | Ícone do tipo (`cha` `Coffee`, `refeicao` `BowlFood`, `oleo` `Drop`, `pratica` `Wind`), título, "Novidade" (rótulo com texto, não só cor), como fazer, ingredientes como `Ingrediente`, verbos, "Por quê?" (abre `Sheet` com o motivo), aviso de incômodo em `amber-soft`. Props `sugestao: SugestaoNaTela`, `aoTrocar`, `aoResponderTroca` |
| `ingrediente.tsx` | `Ingrediente` | `Chip` com o nome; quando `podeTrocar`, abre `Menu` (Trocar · Não tenho · Não gosto, motivos `trocar`, `nao_tenho`, `nao_gosto`) com `aria-label` `sugestao.menu` ("Opções para <item>"); incerto mostra `sugestao.incerto`; logo abaixo, numa região `aria-live="polite"`, a frase da troca (`item.troca.frase`), a pergunta da troca (`sugestao.trocaPergunta` com Tenho · Não tenho) ou o texto de sem substituto (vem no `ResultadoDaTroca`, 011) |
| `para-ter.tsx` | `LinhaParaTer` | `ShoppingBag`, `paraTer.rotulo`, `paraTer.vezes`, verbos e "Por quê?" com o motivo |
| `pergunta.tsx` | `PerguntaDoAgente` | Em `Surface tone="raised"`. Casa: um `RadioGroup` (T5) por item, rótulo = nome do item, opções Tenho · Não tenho · Não gosto, botões "Responder" e "Pular" (`quiet`). Come e variante: as opções como botões e "Pular". Estado `seguiu` mostra `pergunta.seguiu`, `expirou` mostra `pergunta.expirou`, ambos sem botões; `respondida` não renderiza. Props `pergunta`, `aoResponder(resposta)` no formato `respostaDaPessoaSchema` (009: leia o schema) |
| `bloco-aprovacao.tsx` | `BlocoDeAprovacao` | `bloco.titulo`, um `Checkbox` marcado por linha com rótulo `bloco.linha` ("Anotar: <linha>"), "Agora não" e "Anotar"; sem nenhuma marcada, "Anotar" com `aria-disabled`. Depois: frase do resultado em `role="status"` (`anotado` → `bloco.anotei` com n aprovadas de m; `recusado` → `bloco.nada`; `seguiu` → `bloco.seguiu`; `expirou` → `bloco.expirou`). Props `bloco`, `aoAprovar(ids)` ("Agora não" chama com `[]`) |

  - O `ResultadoDaTroca` vem de `src/core/touches/troca.ts` (`trocou`, `perguntar`, `sem_substituto`); o componente recebe o último resultado por prop.
  - Texto puro sempre. Só classes de token; React Aria só pelos componentes base.
- testes primeiro: nenhum Vitest de componente (E2E na T17); `design-guard.test.ts` verde.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: compila, guard verde.
- fora: `conversa.tsx`, `use-conversa.ts`, a página.

### T15 · Add the JSON routes of the conversation and the run
- nivel: mecanica
- objetivo: as rotas JSON: conversa do dia, leitura do run, aprovação, troca, resposta da troca e voto.
- arquivos: `src/app/_rotas/conversa.ts`, `src/app/_rotas/conversa.test.ts`, `src/app/api/conversa/route.ts`, `src/app/api/runs/[id]/route.ts`, `src/app/api/runs/[id]/aprovacao/route.ts`, `src/app/api/runs/[id]/troca/route.ts`, `src/app/api/runs/[id]/troca/resposta/route.ts`, `src/app/api/runs/[id]/voto/route.ts`
- depende de: T8, T11, T12
- leitura: `.docs/ARCHITECTURE.md` §3 (rotas de toque)
- skills: `next-best-practices` (`route-handlers.md`)
- referencia: nenhuma
- contratos: as linhas `GET /api/conversa`, `GET /api/runs/:id`, `/aprovacao`, `/troca`, `/troca/resposta` e `/voto` da tabela de rotas no topo deste plano.
  - Padrão da 017: handlers em `src/app/_rotas/conversa.ts` (funções que recebem `DepsDaRota` e devolvem `(request, ctx) => Promise<Response>`, com `criarRota`); `route.ts` só liga a `depsReais()` (veja `src/app/_rotas/onboarding.ts` e `src/app/api/onboarding/*/route.ts`). Em Next 16, `params` é `Promise`: confira na doc instalada.
  - Exporte de `conversa.ts` um `runDaConta(container, contaId, id): Promise<Run>`: `id` validado como uuid (zod); inválido, inexistente ou de outra conta → lança `RituError("run_nao_encontrado")` (404 pelo `statusDoErro`), **antes** de chamar qualquer serviço. A T16 reaproveita.
  - `GET /api/runs/:id` → `{ visao, pendentes }`; aprovação → `{ visao }` (corpo `{ aprovadas: string[] }`, até `config.aprovacao.maxLinhas`, sem repetir: senão `aprovacao_invalida`), chama `conversation.aprovar`; troca → `touches.trocarIngrediente` com o `retorno_id` da sugestão lido da saída do run → `{ resultado, visao }`; resposta da troca → `touches.responderTroca` → `{ resultado, visao }`; voto → `touches.tocarVoto` (015, sem mudança) → `{ voto }`. A `visao` é sempre relida depois (`visaoDoRun` com etapas, propostas, retornos e voto atuais).
  - Erros: `run_aberto`, `run_nao_continuavel`, `pergunta_expirada`, `aprovacao_expirada` → 409; `aprovacao_invalida`, `toque_invalido` → 400 (pelo `statusDoErro` da T12).
- testes primeiro (`conversa.test.ts`, stores em memória, como `onboarding.test.ts`): cada rota sem sessão → 401; id não-uuid e run de outra conta → 404 `run_nao_encontrado` e nada gravado; `GET /api/conversa` com a conversa da conta; aprovação parcial muda o bloco para `anotado`; aprovação repetida → 409 `run_nao_continuavel`; troca → `trocou` e a visão com a troca; voto gravado e trocado; corpo inválido → 400.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes verdes; build passa.
- fora: `POST /api/runs` e `/resposta` (T16).

### T16 · Add the streaming run routes
- nivel: nucleo
- objetivo: `POST /api/runs` e `POST /api/runs/:id/resposta`, que rodam o agente e mandam as etapas ao vivo e a visão final por NDJSON.
- arquivos: `src/app/_rotas/fluxo-de-run.ts`, `src/app/_rotas/fluxo-de-run.test.ts`, `src/app/api/runs/route.ts`, `src/app/api/runs/[id]/resposta/route.ts`, `src/core/conversation/do-dia.ts`, `src/core/conversation/do-dia.test.ts`, `src/app/_rotas/conversa.ts`, `src/app/_rotas/conversa.test.ts`
- depende de: T3, T6, T8, T12, T15
- leitura: `.docs/ARCHITECTURE.md` §3 (fluxo de um run, estados)
- skills: `next-best-practices` (`route-handlers.md`)
- referencia: nenhuma
- contratos: as linhas `POST /api/runs` e `POST /api/runs/:id/resposta` da tabela de rotas no topo deste plano; o tipo `EventoDaTela`.
  - Com `criarRotaDeFluxo` (T12). `POST /api/runs`: corpo `mensagemRecebidaSchema` (008); chama `conversation.conversar(conta.id, corpo, { aoCriar, aoVivo })`: `aoCriar(id)` emite `{ tipo: "inicio", run_id }`; `aoVivo` emite `{ tipo: "etapa", frase }` para `etapa_iniciada` do Intérprete e para `etapa_concluida` com frase (`fraseDaEtapa`), sem repetir a chave anterior do mesmo fluxo; no fim, relê o run e emite `{ tipo: "fim", visao, pendentes }` (`visaoDoRun` + `outcomes.pendentes(...).length`).
  - `/resposta`: `runDaConta` (T15) antes de tudo; corpo `respostaDaPessoaSchema` (009); emite `inicio` com o id recebido e chama `conversation.continuar` com o mesmo `aoVivo`; o resto igual.
  - `run_aberto` (outro run em `running`) e `pergunta_expirada`, lançados antes da primeira emissão, saem como JSON 409 (é o que a T12 garante: o `inicio` só é emitido depois de `iniciarRun`).
  - O trabalho segue mesmo se a pessoa fechar a aba; não ligar `request.signal`.
  - **Extração antes de tudo:** `visaoDe` existe duas vezes, em `src/core/conversation/do-dia.ts` (~85-106) e numa cópia em `src/app/_rotas/conversa.ts` (~38-58): as mesmas 3 leituras (etapas, propostas, retornos) e a montagem de `visaoDoRun`. Exporte do core uma função só, `visaoDoRunDaConta(stores, contaId, run, voto, agora): Promise<VisaoDoRun>` (em `do-dia.ts`), use-a em `do-dia.ts`, em `conversa.ts` (apague a cópia) e no `fim` das rotas de fluxo. Os testes existentes de `do-dia` e `conversa` continuam verdes.
  - Em `conversa.ts` (T15), a aprovação com mais de `config.aprovacao.maxLinhas` linhas hoje dá `corpo_invalido` pelo zod: passe a checar no handler e lançar `aprovacao_invalida`, como as linhas repetidas, com um teste.
  - Nos `route.ts`: `export const maxDuration = 60` (literal; igual a `telaConversa.rotaMaxDurationS`) e `export const dynamic = "force-dynamic"` se a doc instalada pedir.
- testes primeiro (`fluxo-de-run.test.ts`, container com runtime roteirizado e stores em memória; use um cenário de `test/fixtures/cenarios/`): a primeira linha é `inicio`, há ao menos uma `etapa` antes de `fim`, nenhuma chave de etapa repetida em seguida, `fim` com visão válida e sem campo interno; run aberto → 409 `run_aberto` JSON; sem sessão → 401; `/resposta` com run de outra conta → 404; `/resposta` numa pergunta de casa segue até `fim`; consumidor que cancela o fluxo: o run termina `done` no store.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes verdes; build passa.
- fora: telas, evals.

### T17 · Build the conversation screen and page
- nivel: tela
- objetivo: juntar tudo na tela `/conversa`: lista com as falas e as visões, etapas ao vivo, anúncios, indicador de retornos e caixa.
- arquivos: `src/components/ritu/conversa/conversa.tsx`, `src/app/(app)/conversa/page.tsx`, `src/app/(app)/layout.tsx`, `src/components/ritu/conversa/ingrediente.tsx`
- depende de: T7, T9, T13, T14
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §8; `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`, `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos:
  - `Conversa` (`"use client"`, `inicial: ConversaDoDia`, `atalhos`): usa `useConversa`. Lista com `role="log"` e `aria-label="Conversa"`. Para cada fala: `FalaDaPessoa` ou `FalaDoAgente`; depois da fala do agente do run, na ordem: avisos, `BlocoDeSugestao` de cada sugestão, `evitar.rotulo` (se houver), `LinhaParaTer`, `PerguntaDoAgente` (pergunta não `respondida`), `BlocoDeAprovacao`, `EtapasRecolhidas` e `RodapeDaResposta` (só com `podeVotar`; alerta sem 👍/👎). Com run trabalhando: `EtapasAoVivo`. A resposta é sempre texto corrido com as sugestões logo abaixo como apoio.
  - Duas regiões `aria-live="polite"` visualmente escondidas: uma recebe a resposta completa uma vez (`anuncio`), a outra só a frase nova da etapa.
  - Ao chegar a resposta, o foco continua na caixa; a lista rola até o começo da resposta (`scrollIntoView({ block: "start" })`, sem animação com movimento reduzido).
  - Erro de rede ou `erro.inesperado`: `StateBlock kind="error"` abaixo da última fala, com "Tentar de novo"; `run_aberto` mostra `erro.run_aberto`. Estado recarregado com run `running`: `etapas.ainda` até o run sair de `running`.
  - `IndicadorDeRetornos` acima da caixa; `CaixaDeMensagem` embaixo.
  - Rótulos dos atalhos para a fala otimista: a página monta no servidor o mapa id→`"{emoji} {rotulo}"` com a mesma função que o servidor usa ao gravar a fala (`rotuloDoAtalho`, `src/core/messages/texto.ts`) sobre `knowledge.estados`, e passa a `useConversa(inicial, rotulos)`. Assim a fala da pessoa não muda de texto ao recarregar.
  - `BlocoDeAprovacao` guarda as marcadas no estado inicial: passe `key` pelo `run_id` (e pelo estado do bloco) para ele recomeçar quando o bloco mudar. `BlocoDeSugestao` recebe a sugestão inteira; os callbacks de troca montam o corpo da rota com `sugestao.posicao`.
  - Em `ingrediente.tsx` (T14), o `aria-label` do chip com menu ("Opções para <item>") esconde o "confira se ainda tem" do leitor de tela: inclua o texto de incerto no nome acessível quando `incerto`.
  - Moldura no desktop: a T7 pôs `max-w-content` (40rem) no envoltório da `nav` lateral (14rem) e do `main`, o que deixa o `main` com cerca de 24rem. Ajuste `src/app/(app)/layout.tsx` para a lateral ficar fora da medida: a medida de leitura (`max-w-content`) vale para o `main`, ao lado da coluna de 14rem. Nada mais muda na moldura.
  - Página (servidor): `exigirPasso("pronto")`, `conversaDoDia({ stores, clock, seed: container.demoSeed }, conta, perfil)`, atalhos de `data/estados.yaml` pela `knowledge` do container, `<Conversa inicial={…} atalhos={…} />`. Sem fala e sem run aberto: `StateBlock kind="empty"` com `vazia.titulo` e `vazia.texto` acima da caixa. `noscript` com `textosConversa.semJs`; as falas do dia renderizam no servidor.
- testes primeiro: nenhum Vitest (E2E na T19); guard verde.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, e uma checagem manual com `npm run build && RITU_MODO=e2e npm run start` ou o E2E existente de entrada (`CI=1 npx playwright test e2e/entrada.spec.ts`)
- pronto quando: a demonstração chega à `/conversa` e envia a mensagem sugerida até a resposta no navegador.
- fora: rotas, E2E da conversa.

### T18 · Add the conversation deterministic evals
- nivel: mecanica
- objetivo: evals de segurança das rotas da conversa e da visão sem campo interno.
- arquivos: `evals/det/seguranca/conversa.eval.ts`, `evals/det/conversa/visao.eval.ts`, `evals/det/mapa.ts`
- depende de: T15, T16
- leitura: `.docs/QA.md` (só a tabela dos evals determinísticos)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `seguranca/conversa.eval.ts` (como `evals/det/seguranca/*.eval.ts` da 017; R6 proíbe importar `@/infra/*` fora do container: siga o que os outros evals fazem): cada rota da 018 (`GET /api/conversa`, `POST /api/runs`, `GET /api/runs/:id`, `/resposta`, `/aprovacao`, `/troca`, `/troca/resposta`, `/voto`) sem sessão → 401; com run de outra conta → 404 e nada gravado (troca, voto, aprovação, resposta); `GET /api/conversa` não traz fala nem run de outra conta, inclusive quando uma mensagem da conta cita o `run_id` de um run de outra conta (o `conversaDoDia` busca runs citados de outro dia com `runs.buscar`, que filtra por conta: o eval prova que o run não aparece).
  - `conversa/visao.eval.ts`: a visão de cada cenário de conversa de `test/fixtures/cenarios/` (rodado com o runtime roteirizado) passa no tipo `VisaoDoRun` (schema zod local ao eval) e o JSON não tem `linha_base`, `citados`, `checkpoint`, `tokens`, `modelo`, `clima_usado`.
  - `mapa.ts`: as linhas "Rota sem sessão" e "Dado de outra conta" ganham `seguranca/conversa.eval.ts`; a visão entra na linha que fala de dado interno/visão (ou numa linha nova "Visão do run sem campo interno", se não houver).
- testes primeiro: os próprios evals.
- comandos: `npm run lint`, `npm run typecheck`, `npm run eval:det`, `npm run eval:det:resumo`
- pronto quando: evals verdes; resumo mostra os arquivos novos nos grupos.
- fora: E2E.

### T19 · Write the conversation E2E and take the screenshots
- nivel: tela
- objetivo: E2E da Conversa (cliques e teclado, todos os estados, axe nos dois temas) e as screenshots para a dona.
- arquivos: `e2e/conversa.spec.ts`, `evals/det/mapa.ts`, `.plans/018-*.png`
- depende de: T4, T16, T17, T18
- leitura: `.docs/DESIGN.md` §3 (acessibilidade)
- skills: `web-design-guidelines`, `playwright`
- referencia: nenhuma
- contratos:
  - Servidor no modo e2e (`CI=1 npm run test:e2e`), `test`/`entrarNaDemo` de `e2e/apoio/sessao.ts`, `expectSemViolacoes` e `usarTema` (016). Roteiros da T4: `demo`, `pergunta-casa`, `troca`, `texto-cru`, `lento`.
  - Casos:
    - demonstração até a resposta em três toques ("Testar com perfil de demonstração" → "Entendi, quero começar" → "Enviar"), só com cliques e só com teclado; a caixa já vem com a `mensagem_sugerida`; etapas aparecem antes da resposta; resposta com sugestões, "Vale ter em casa: cardamomo" e o bloco "Posso anotar isto?"; a resposta é anunciada uma vez; etapas recolhem em "Pensei em N passos" com "Como pensei";
    - conta nova (Google simulada da 017) começa com a caixa vazia e o texto de apoio;
    - atalhos: marcar dois e enviar sem texto;
    - caixa durante a resposta: `aria-disabled="true"`, foco na caixa, "O Ritu está respondendo"; ao fim, vazia e atalhos desmarcados;
    - pergunta de casa (roteiro `pergunta-casa`: itens `couve` e `leite`, A5) respondida e pulada;
    - bloco: aprovar um e recusar outro ("Anotei 1 de 2." ou o número certo); "Agora não";
    - troca (roteiro `troca`: `cha-canela`, trocar a `canela`, A5): Trocar mostra o substituto e a frase; Não tenho com pergunta da troca;
    - 👍 e troca para 👎; recarregar mantém o voto, a troca e o bloco aberto;
    - `<script>` e `**` aparecem como texto;
    - recarregar no meio do roteiro `lento` mostra "O Ritu ainda está respondendo…" e depois a resposta;
    - envio com run aberto em outra aba → "Ainda estou respondendo a sua última mensagem.";
    - `POST /api/runs` com `Origin` de outro site → 403;
    - indicador de retornos com o número do seed, levando a `/como-ficou`;
    - barra: navegar pelas quatro abas, `aria-current` certo; no desktop a barra é lateral;
    - zoom: 200% em 1280 px sem rolagem horizontal e com a caixa visível;
    - axe (`expectSemViolacoes`) nos estados vazia, respondendo, pergunta, resposta com bloco e erro; nas quatro abas e em `/como-pensei/<run>`; nos dois temas; em `celular` e `desktop`.
  - Esperas observáveis (`expect(...).toBeVisible()` etc.), nada de `waitForTimeout`.
  - Confira nas screenshots de desktop: o cabeçalho (`max-w-content`) e o corpo (envoltório `max-w-[59rem]` da T17, com a lateral de 14rem) ficam alinhados? Desalinhado é defeito de tela: relate, não contorne.
  - Os E2E da 017 regravam `.plans/017-*.png` a cada rodada: não inclua esses arquivos na sua resposta como tocados; o orquestrador os reverte.
  - `mapa.ts`: a linha "Resposta do agente com `<script>`" aponta para `e2e/conversa.spec.ts`.
  - Screenshots em `.plans/018-<estado>-<tema>-<projeto>.png` (estados `vazia`, `respondendo`, `pergunta`, `resposta-bloco`; temas `light`, `dark`; projetos `celular`, `desktop`), por um teste marcado que só roda com `SCREENSHOTS=1` ou por script equivalente ao da 017 (procure como a 017 tirou as dela).
  - Antes de rodar: `lsof -nP -iTCP:3000 -sTCP:LISTEN` vazio; se houver servidor, espere e repita (não mate processo).
- testes primeiro: o próprio spec.
- comandos: `npm run lint`, `npm run typecheck`, `npm run build`, `CI=1 npm run test:e2e`, `npm run eval:det:resumo`
- pronto quando: `e2e/conversa.spec.ts` verde 3 vezes seguidas (`--repeat-each=3`) e a suíte E2E inteira verde; screenshots gravadas.
- fora: código de produção. Defeito de tela encontrado vira relato (o orquestrador abre a correção), não contorno no teste.

### C1 · Isolate the model quota per E2E test
- nivel: nucleo
- objetivo: no modo e2e, o registro de uso dos modelos (cota por minuto e por dia) não pode ser compartilhado entre testes: cada `x-ritu-e2e` tem a sua cota, como os stores.
- arquivos: `src/infra/container.ts`, `src/infra/fakes/memory-stores.ts` (se o isolamento ficar lá), um teste novo ao lado (`src/infra/e2e/cota.test.ts` ou no teste existente do container/e2e)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: hoje `createMemoryLedger` (`src/infra/fakes/memory-stores.ts` ~1022), usado em `src/infra/container.ts` ~191 no modo e2e, é um só para o processo; com os limites de `config/llm-cotas.ts` (rpm 15) a cota acaba depois de 8 a 10 mensagens roteirizadas no mesmo minuto, e a tela mostra "Meu limite de conversas de hoje acabou" ou a resposta segura. Corrigir: no modo e2e, o ledger segue o mesmo isolamento por `x-ritu-e2e` que os stores já usam (procure como os stores escolhem o "banco" pelo header). Não mude os limites de `config/llm-cotas.ts`, nem o comportamento fora do modo e2e. Um teste sem header (o padrão) continua com um ledger só.
- testes primeiro: com o container em modo e2e, dois ids de `x-ritu-e2e` diferentes têm cotas independentes (esgotar uma não esgota a outra); fora do e2e nada muda.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers=3`, `npm run build`
- pronto quando: testes verdes; build passa.
- fora: rotas, telas, `e2e/*.spec.ts`.

### C2 · Answer run_aberto with 409 when another run is running
- nivel: nucleo
- objetivo: com um run `running` aberto (roteiro `lento` numa aba), `POST /api/runs` de outra aba deve responder `409 { erro: "run_aberto" }` e não `500 erro_inesperado`.
- arquivos: os que a causa exigir, entre `src/app/_lib/fluxo.ts`, `src/app/_rotas/fluxo-de-run.ts`, `src/infra/fakes/memory-stores.ts`, `src/core/runs/run-service.ts`, e os testes deles; diga quais tocou
- depende de: C1
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: suspeitas do E2E: (a) `src/app/_lib/fluxo.ts` (`descreverErro`, ~25) não reconhece o erro como `RituError` (por exemplo, erro embrulhado pela transação ou por `comSpanDoRun`); (b) `emTransacao` do fake (`memory-stores.ts` ~997) restaura `db.estado` no `catch` e pode sobrescrever o run em andamento de outro pedido. Ache a causa real com um teste que reproduza: dois `POST /api/runs` concorrentes da mesma conta pelo handler (`src/app/_rotas/fluxo-de-run.ts`) com o container e2e e o roteiro `lento`; o segundo responde 409 `run_aberto` em JSON e o primeiro termina normalmente, sem perder o run. Se a causa for o `emTransacao` restaurar estado de outro pedido, corrija o fake para não apagar escrita alheia (é defeito do fake, não do Postgres).
- testes primeiro: o teste de concorrência acima.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test -- --maxWorkers=3`, `npm run build`
- pronto quando: o teste passa; nada mais muda.
- fora: telas, `e2e/*.spec.ts`.

### C3 · Align the header with the body on desktop and keep the message box above the bar on mobile
- nivel: tela
- objetivo: corrigir dois defeitos de layout vistos nas screenshots da T19.
- arquivos: `src/app/(app)/layout.tsx`, `src/components/ritu/conversa/caixa.tsx`, `src/components/ritu/conversa/conversa.tsx`, `src/components/tokens/tokens.css`
- depende de: nenhuma
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos:
  - Desktop (`.plans/018-resposta-bloco-light-desktop.png`): logo, menu e a faixa da demonstração ficam em x≈344–936 (`max-w-content`), e a lateral começa em x≈192 e o corpo em 448–1088. O cabeçalho e o corpo devem usar o mesmo envoltório e alinhar à esquerda com a lateral. Troque o `max-w-[59rem]` por um token novo de largura em `tokens.css` (por exemplo `--container-shell`, usado como `max-w-shell`), e o `main` continua com `max-w-content`.
  - Celular (`.plans/018-pergunta-light-celular.png`): a caixa presa (atalhos, texto e Enviar) ocupa mais da metade da tela e o fim dela, com o Enviar, fica por baixo da barra inferior fixa. A caixa fica inteira acima da barra (`bottom` igual à altura da barra mais a safe area) e ocupa menos altura: os atalhos numa linha com rolagem horizontal (só nessa linha, sem rolagem horizontal da página), o campo começando com 2 a 3 linhas.
  - Larguras arbitrárias de `conversa.tsx` (`max-w-[38rem]`) e `fala.tsx` passam a token, se houver um que sirva (`max-w-prose`/`max-w-content`); `fala.tsx` está fora desta tarefa: só `conversa.tsx`.
  - Só tokens, sem `dark:`.
- testes primeiro: nenhum Vitest; o guard continua verde.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run src/components`, `npm run build`, `CI=1 npx playwright test e2e/entrada.spec.ts e2e/comecar.spec.ts e2e/marca.spec.ts` (antes, `lsof -nP -iTCP:3000 -sTCP:LISTEN`; ocupada, espere; não suba servidor próprio)
- pronto quando: layout corrigido, E2E existentes verdes; diga como conferiu a caixa no celular (screenshot em 390×844 ou o projeto `celular` do Playwright).
- fora: `e2e/conversa.spec.ts` (é da T19, em curso).

### C4 · Keep the fixed panel from covering the conversation and fix the returns link target
- nivel: tela
- objetivo: corrigir os defeitos de tela que o E2E e as screenshots da T19 acharam depois da C3.
- arquivos: `src/components/ritu/conversa/retornos.tsx`, `src/components/ritu/conversa/conversa.tsx`, `src/components/ritu/conversa/caixa.tsx`, `src/app/(app)/layout.tsx`, `src/components/ritu/demo-banner.tsx`
- depende de: C3
- leitura: `.docs/DESIGN.md` §3 (acessibilidade e conversa) e §4; `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos:
  - axe `target-size` (serious) no link do indicador de retornos ("N sugestões esperando seu retorno", `retornos.tsx`), dentro do painel fixo (`conversa.tsx` ~227): o alvo tem menos de 24 px de altura e fica colado no conteúdo. O link precisa de alvo de pelo menos 24×24 px com folga (por exemplo, `inline-flex items-center min-h-11` ou `min-h-6` com espaço em volta), sem mudar o texto.
  - O painel fixo (retornos, atalhos, caixa) cobre o começo da resposta no desktop (`.plans/018-resposta-bloco-light-desktop.png`: cobre o primeiro cartão de sugestão) e cobre a pergunta no celular (`.plans/018-pergunta-light-celular.png`). Nada da conversa pode ficar escondido atrás do painel: a lista (`role="log"`) ganha espaço embaixo igual à altura do painel (meça o painel, por exemplo com `ResizeObserver` numa variável CSS, ou use um layout em que o painel não sobreponha a lista), e o `scrollIntoView` da resposta e o `scroll-margin` levam o painel em conta. No celular, diminua a altura do painel onde der sem perder função (por exemplo, menos espaço entre atalhos e campo, contador só quando aparece).
  - A faixa da demonstração ("Você está no perfil de demonstração…", `DemoBanner`) continua no envoltório estreito (texto a partir de x≈344) e desalinhada do cabeçalho e do corpo, que agora usam `max-w-shell`: ela usa o mesmo envoltório.
  - Só tokens, sem `dark:`; nenhum texto novo.
- testes primeiro: nenhum Vitest; o guard continua verde.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npx vitest run src/components`, `npm run build`, `CI=1 npx playwright test e2e/conversa.spec.ts e2e/entrada.spec.ts e2e/comecar.spec.ts e2e/marca.spec.ts` (antes, `lsof -nP -iTCP:3000 -sTCP:LISTEN`; ocupada, espere; não suba servidor próprio fora do Playwright; sem `SCREENSHOTS=1`)
- pronto quando: `conversa.spec.ts` verde nos dois projetos (inclusive o axe da "resposta com bloco" no desktop); os outros E2E verdes; diga como conferiu que nada fica atrás do painel.
- fora: `e2e/conversa.spec.ts` (da T19, sem commit).

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1 | Muda a porta `RunRepository`, usada fora dos arquivos dela: sozinha |
| 2 | T2, T3, T4, T5 | Sem dependência entre si nem arquivo em comum (config; `conversar.ts`; e2e e container; componentes base e `/marca`) |
| 3 | T6, T7 | Dependem de T2; `etapas.ts` × moldura e abas |
| 4 | T8, T9 | T8 depende de T6; T9 de T2, T5, T6; core × componentes |
| 5 | T10, T11, T14 | Dependem de T8 (e T11 de T1); arquivos novos distintos |
| 6 | T12, T13 | T12 depende de T10; T13 de T10, T11; `_lib` × componentes |
| 7 | T15, T17 | T15 depende de T12; T17 de T7, T9, T13, T14; rotas × tela |
| 8 | T16 | Depende de T15 (`runDaConta`) e T3 |
| 9 | T18 | Depende de T15 e T16; mexe em `mapa.ts` |
| 10 | T19 | E2E de tudo; mexe em `mapa.ts` depois da T18 |
| 10a | C1, C3 | Defeitos achados pela T19: cota do modo e2e (núcleo) e layout (tela); sem arquivo em comum |
| 10b | C2 | Pode tocar `memory-stores.ts` (como a C1) |
| 10c | T19 | Volta ao E2E com as correções |
| 10d | C4 | Defeitos de tela achados na 2ª rodada da T19 |
| 10e | T19 | Fecha o E2E e as screenshots |
