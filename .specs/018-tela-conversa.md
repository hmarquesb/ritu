---
title: Tela Conversa
status: implemented
implemented: 9b018b4
entrega: 3
created: 2026-11-15
---

# Tela Conversa

> Liga o agente da entrega 2 ao site: a tela Conversa com as mensagens do dia, a caixa de texto com os atalhos de check-in, as etapas ao vivo (streaming), a pergunta do agente, a fala com as sugestões, a linha "Vale ter em casa", o menu do ingrediente, o bloco de aprovação, 👍/👎 e o indicador de retornos. Junto vêm as rotas de run, a barra de navegação de quem entrou e o E2E do caminho da demonstração até a primeira resposta.

## Contexto

A entrega 2 deixa o agente completo atrás de `conversation.conversar`, `continuar` e `aprovar` e dos toques da 011, mas só o terminal os chama. A 017 abre a porta do site e entrega `/conversa` só com a moldura. Falta a tela em que o produto acontece (`BUSINESS.md` §7 e §8) e as rotas que a alimentam (`ARCHITECTURE.md` §3).

A promessa da demonstração ("primeira resposta em menos de 1 minuto", `BUSINESS.md` §6) só se cumpre aqui: a mensagem sugerida já escrita, um toque em Enviar, as etapas ao vivo e a resposta com o que o agente propõe anotar.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Navegação:** barra inferior no celular (Conversa · Minha casa · Como ficou? · Você) e a mesma lista na lateral no desktop. A 018 cria a barra; as páginas de Minha casa, Como ficou? e Você ficam com estado vazio até a 019 e a 020.
- **Resposta:** aparece inteira, com uma transição curta, e é anunciada inteira ao leitor de tela. Não há efeito de digitação: a resposta sai pronta de `finalizar`, e simular streaming seria fingir.
- **Etapas depois da resposta:** recolhem numa linha discreta ("Pensei em 5 passos") com o botão "Como pensei".
- **Atalhos de check-in:** ícones do Phosphor, não emojis.

## Objetivo

- Na demonstração, da Entrada à primeira resposta com sugestões em **três toques** ("Testar com perfil de demonstração" → "Entendi, quero começar" → "Enviar"), só com cliques e só com teclado.
- Toda mensagem mostra ao menos uma etapa ao vivo em até 1 s depois do envio (no modo e2e), e a resposta chega no mesmo pedido, sem recarregar.
- Tudo o que a pessoa toca na Conversa (pergunta, aprovação, troca, 👍/👎) passa por rota com sessão e conta conferida, e nada da conta de outra pessoa é lido.
- Recarregar a página no meio do dia mostra a mesma conversa: mensagens, sugestões, trocas feitas, pergunta ou bloco ainda abertos e o voto.
- A Conversa passa no axe nos dois temas, em celular e desktop, em cada estado (vazia, respondendo, pergunta, resposta com bloco, erro).

## Escopo

- **Dentro:**
  - Rotas de run: enviar mensagem e responder pergunta (com streaming), aprovar, trocar ingrediente e responder a troca, votar; leitura da conversa do dia e de um run.
  - `conversaDoDia` e `visaoDoRun`: o que a tela recebe, sem campos internos da saída.
  - Frases das etapas ao vivo, montadas por código a partir das etapas do run.
  - Rota do voto (👍/👎) sobre o `tocarVoto` da 015.
  - Tela Conversa e os componentes do Ritu da conversa (`DESIGN.md` §4): falas, caixa com atalhos, etapas ao vivo, pergunta do agente, bloco de sugestão, linha "Vale ter em casa", menu do ingrediente, bloco de aprovação, rodapé da resposta e indicador de retornos.
  - Barra de navegação de quem entrou e as páginas vazias de `/casa`, `/como-ficou`, `/voce` e `/como-pensei/[runId]`.
  - Modo e2e: roteiros do agente por mensagem, clima fixo.
  - E2E da Conversa e os evals determinísticos das rotas.
- **Fora:**
  - Conteúdo de Minha casa, Como ficou? (com as rotas de retorno, de gosto, de casa e de lista): 019.
  - "Como pensei", "O que sei sobre você", Perfil, painel do dosha e o seletor de tema: 020.
  - Limite de mensagens e de toques por conta e por IP, telas de cota esgotada: 021.
  - Rodar o `c4-site`: fecha a entrega 3, depois da 020, pelas rotas desta spec.
  - Mensagens de dias anteriores na tela: o produto mostra só o dia (`BUSINESS.md` §7). Elas continuam no contexto do agente e em "Como ficou?".
  - Mostrar o "pensamento" do modelo (o evento `pensamento` do loop): não vai para a tela.

## Necessidade de negócio

A Conversa é a tela inicial e o produto inteiro para quem visita: é onde a memória, a casa, as perguntas e a aprovação aparecem juntas. Sem ela, a entrega 2 não é vista por ninguém além da dona. As etapas ao vivo e o "Como pensei" mostram que há um agente trabalhando, não um formulário; o bloco de aprovação mostra que o Ritu não grava nada sem a pessoa.

## Critérios de aceite

- [ ] **Demonstração em três toques:** depois de "Entendi, quero começar", a caixa já tem a `mensagem_sugerida` do seed; "Enviar" mostra as etapas ao vivo e depois a resposta com sugestões, a linha "Vale ter em casa" de cardamomo e o bloco "Posso anotar isto?" (E2E, só com cliques e só com teclado).
- [ ] **Mensagem sugerida só na primeira vez:** a caixa vem preenchida só em conta de demonstração sem mensagem no dia; conta Google começa com a caixa vazia e o texto de apoio.
- [ ] **Atalhos:** os 7 atalhos ficam acima da caixa, com ícone e rótulo de `data/estados.yaml`; marcar um ou mais e enviar sem texto manda só os atalhos; a fala da pessoa mostra `textoDaMensagem` (008).
- [ ] **Etapas ao vivo:** cada etapa nova aparece com a frase de `fraseDaEtapa`, sem repetir a frase anterior; a região `aria-live="polite"` anuncia só a etapa nova; a lista tem `aria-busy="true"` enquanto o run trabalha.
- [ ] **Etapas recolhidas:** com a resposta, as etapas viram a linha "Pensei em N passos" e o botão "Como pensei" (link para `/como-pensei/<run>`).
- [ ] **Resposta inteira:** a fala do agente aparece de uma vez, com transição de opacidade de até `--ritu-slow` (nenhuma com movimento reduzido), e o texto completo vai para a região de anúncio uma vez só.
- [ ] **Texto puro:** resposta, sugestões, perguntas e propostas são renderizadas como texto; uma resposta com `<script>` e `**negrito**` aparece literalmente (E2E com roteiro).
- [ ] **Caixa durante a resposta:** a caixa fica com `aria-disabled="true"` (não `disabled`), o foco não sai dela, o motivo "O Ritu está respondendo" aparece embaixo e é anunciado; Enter não envia. Ao fim, a caixa volta a aceitar e fica vazia, com os atalhos desmarcados.
- [ ] **Pergunta de casa:** o run em `waiting_for_input` mostra a pergunta com Tenho · Não tenho · Não gosto em cada item (grupo de rádio com o nome do item como rótulo), "Responder" e "Pular"; a resposta segue o run com as etapas ao vivo e termina na resposta (E2E).
- [ ] **Pergunta de variante e de "come":** as opções aparecem como botões; "Pular" existe em todas.
- [ ] **Pergunta deixada de lado:** mandar outra mensagem com a pergunta aberta deixa a pergunta com o texto "Você seguiu a conversa." e sem botões; pergunta vencida mostra "Esta pergunta expirou. Pode me contar de novo."
- [ ] **Bloco de aprovação:** cada linha é uma caixa de seleção marcada, com o rótulo "Anotar: <linha>"; "Anotar" grava só as marcadas e o bloco vira "Anotei 2 de 3."; "Agora não" grava nada e vira "Tudo bem, não anotei nada."; sem nenhuma marcada, "Anotar" fica com `aria-disabled` (E2E: aprovar um item e recusar outro).
- [ ] **Bloco expirado ou deixado de lado:** run vencido mostra "Esta proposta expirou. Nada foi anotado."; nova mensagem com o bloco aberto mostra "Ficou para depois. Nada foi anotado." (regra da 005).
- [ ] **Troca de ingrediente:** o menu do ingrediente tem Trocar · Não tenho · Não gosto; `trocou` atualiza o ingrediente na sugestão e mostra a frase da troca na própria sugestão; `perguntar` mostra "Você tem <item>?" com Tenho · Não tenho; `sem_substituto` mostra o texto da 011 (E2E: trocar mostra o substituto e o motivo).
- [ ] **Menu do ingrediente some quando não cabe:** sugestão sem `retorno_id` ou com retorno já respondido não mostra o menu; prática sem ingrediente também não.
- [ ] **👍/👎:** dois botões de alternância (`aria-pressed`), "Gostei da resposta" e "Não gostei da resposta"; o voto é gravado e trocável; recarregar mostra o voto.
- [ ] **Indicador de retornos:** com retornos aguardando, a linha "N sugestões esperando seu retorno" (singular com 1) aparece acima da caixa e leva a `/como-ficou`; sem retornos, nada aparece.
- [ ] **Recarregar:** depois de uma resposta com troca, voto e bloco aberto, recarregar mostra o mesmo estado; com run em `running`, a tela mostra "O Ritu ainda está respondendo…" e consulta o run até ele sair de `running`.
- [ ] **Run aberto:** enviar com run em `running` (outra aba) recebe `409 { erro: "run_aberto" }` e a tela mostra "Ainda estou respondendo a sua última mensagem."
- [ ] **Sem sessão e outra conta:** toda rota desta spec responde `401` sem sessão; com o id de um run de outra conta, as rotas respondem `404 { erro: "run_nao_encontrado" }` e nada muda (eval).
- [ ] **Origem:** `POST /api/runs` com `Origin` de outro site recebe `403` (proxy da 017; E2E).
- [ ] **Visão sem campo interno:** `visaoDoRun` nunca leva `linhas_base`, `citados`, `checkpoint`, `pendencia` além da pergunta, `clima_usado`, tokens nem modelos (teste e eval).
- [ ] **Navegação:** no celular, `nav` fixa embaixo com Conversa · Minha casa · Como ficou? · Você, ícone e rótulo, item atual com `aria-current="page"` e traço; no desktop (a partir de 64rem), a mesma lista numa coluna lateral. `/casa`, `/como-ficou`, `/voce` e `/como-pensei/<run>` abrem com o estado vazio e passam no axe.
- [ ] **Acessibilidade:** `/conversa` passa em `expectSemViolacoes` nos dois temas, em `celular` e `desktop`, nos estados vazia, respondendo, pergunta, resposta com bloco e erro; a lista de mensagens tem `role="log"`.
- [ ] **Zoom:** com 200% de zoom em 1280 px, a Conversa não tem rolagem horizontal e a caixa continua visível.
- [ ] Gates 1 a 6 verdes, `npm run dup` limpo, `test:db` verde com `RunRepository.doDia` e `votos`.

## O que fazer

- Conferir na versão instalada do Next 16 como uma rota devolve `ReadableStream` (`node_modules/next/dist/docs/`, `route-handlers`) e o `maxDuration` do segmento.
- Escrever primeiro as funções puras (`fraseDaEtapa`, `visaoDoRun`, `conversaDoDia`, `codificarEvento`) e os testes; depois as rotas com os stores em memória; por último as telas.
- Usar os componentes base da 016 e os ícones do Phosphor; carregar `frontend-design` antes das telas e `web-design-guidelines` antes de entregar.
- Usar `criarRota` (017) em toda rota com corpo JSON; a rota com streaming usa a mesma checagem de sessão, de corpo e de erro antes de abrir o fluxo.
- Manter o estado da tela num só lugar (`useConversa`), alimentado pela leitura inicial do servidor e pelos eventos.
- Escrever os roteiros do modo e2e contra o perfil semeado da 017, e fazê-los passar no validador real.
- Registrar no mapa dos evals os arquivos novos.
- Atualizar os docs e escrever a ADR no fechamento.

## O que não fazer

- Não renderizar texto da saída como HTML nem como Markdown; não usar `dangerouslySetInnerHTML`.
- Não simular digitação da resposta.
- Não mandar à tela `linhas_base`, `citados`, o checkpoint, a entrada do Acompanhante, o clima usado, tokens, modelos nem o "pensamento" do modelo.
- Não chamar modelo, a Open-Meteo ou o Postgres em `npm test`, `eval:det` ou `test:e2e`.
- Não gravar nada a partir da tela sem passar por `conversation`, `touches`.
- Não guardar texto de mensagem no `localStorage` nem em cookie.
- Não ligar `request.signal` ao run: a pessoa fechar a aba não cancela o trabalho.
- Não construir Minha casa, Como ficou?, Você nem Como pensei além do estado vazio.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Navegação | Barra inferior no celular, lateral no desktop; Conversa · Minha casa · Como ficou? · Você (dona) | Quatro destinos fixos, alcançáveis com o polegar; "Você" junta Perfil, O que sei e o dosha (020) |
| Resposta | Inteira, com transição de opacidade (dona) | A resposta sai pronta de `finalizar`; quem mostra o trabalho são as etapas |
| Etapas depois da resposta | Recolhem em "Pensei em N passos" + "Como pensei" (dona) | A conversa fica limpa e o rastro continua a um toque |
| Atalhos | Ícones do Phosphor, peso `light` (dona) | `DESIGN.md` §3 permite; igual em todo aparelho |
| Transporte das etapas | Resposta do `POST` em NDJSON (`application/x-ndjson`), lida com `fetch` e `ReadableStream` | É `POST` com corpo e sessão; `EventSource` só faz `GET`. Uma linha por evento é simples de testar |
| O run e a conexão | O run segue até o fim mesmo se a pessoa sair; a tela recarregada consulta o run | Ninguém perde uma resposta por trocar de aba; o resultado fica no banco |
| Consulta do run em andamento | `GET /api/runs/:id` a cada 2 s, por até 90 s | Só acontece depois de recarregar no meio; não vale um canal próprio |
| Frases das etapas | Por código, a partir de `tipo` e `nome` da etapa; etapas sem frase não aparecem | O texto da tela é do produto, não do modelo |
| Saída para a tela | Projeção `visaoDoRun`, com só o que a tela mostra | Payload menor e nenhum detalhe interno exposto |
| Mensagens na tela | Só as do dia local da conta | `BUSINESS.md` §7 |
| Mensagem sugerida | Só na demonstração e só sem mensagem no dia | Na conta Google seria pôr palavras na boca da pessoa |
| Envio pelo teclado | Enter envia; Shift+Enter quebra a linha | Padrão de conversa; no celular, o botão Enviar |
| Bloco de aprovação | Todas as linhas marcadas; "Anotar" e "Agora não" | `BUSINESS.md` §8, passo 7 |
| Rotas de toque desta spec | Troca, resposta da troca e voto, debaixo de `/api/runs/:id/` | Todas dependem do run; a conta é conferida pelo run |
| `/api/feedback` de `ARCHITECTURE.md` §3 | Vira `POST /api/runs/:id/voto` | Mesmo motivo; o doc é atualizado |
| Erro no meio do fluxo | Evento `erro` com código, e a tela mostra o texto do código | O status HTTP já foi enviado quando o fluxo abriu |
| Páginas das outras abas | Estado vazio "Esta parte chega em breve." até 019 e 020 | A barra não aponta para 404; tudo é preenchido antes do portão 3 |
| Agente no modo e2e | Runtime roteirizado e Intérprete roteirizado, escolhidos pelo texto exato da mensagem | O E2E roda sem chave, com resposta, pergunta, bloco e troca previsíveis |

## Contratos

### Cria

**Configuração (`config/tela-conversa.ts`, incluída em `config/index.ts` como `telaConversa`)**

```ts
export const telaConversa = {
  consultaDoRun: { intervaloMs: 2000, maximoMs: 90_000 },
  rotaMaxDurationS: 60,                 // maxDuration das rotas com streaming (teto do Hobby)
  contadorAPartirDe: 800,               // caracteres: o contador aparece a partir daqui (maxCaracteres é o da 008)
} as const
```

**Frases das etapas (`src/core/conversation/etapas.ts`)**

```ts
export type FraseDeEtapa = { chave: string; texto: string }
export function fraseDaEtapa(etapa: { tipo: TipoDeEtapa; nome: string }): FraseDeEtapa | undefined
export function frasesDoRun(etapas: { tipo: TipoDeEtapa; nome: string }[]): FraseDeEtapa[]   // na ordem, sem chave repetida em seguida
```

| Etapa (`tipo` / `nome`) | `chave` | Texto |
|---|---|---|
| `interprete` | `entendendo` | Entendendo sua mensagem… |
| `guardrail` | `cuidado` | Lendo com cuidado… |
| `tool` / `clima.*` | `clima` | Vendo o clima… |
| `tool` / `casa.ler` | `casa` | Olhando sua casa… |
| `tool` / `preferencias.ler`, `historico.recente` | `lembrando` | Lembrando do que você me contou… |
| `tool` / `ayurveda.*` | `base` | Consultando a base ayurvédica… |
| `tool` / `resultado.registrar` | `retorno` | Anotando o seu retorno… |
| `validacao` | `conferindo` | Conferindo a resposta… |
| `juiz` | `revisando` | Revisando com cuidado… |
| `memoria` | `memoria` | Atualizando o que sei da sua rotina… |
| Qualquer outra (`llm`, `pergunta`, `proposta`, `aprovacao`, `troca_de_modelo`, `erro`, tools de controle e de proposta) | — | Sem frase |

Os textos ficam em `config/textos-conversa.ts`. "Pensei em N passos" usa `frasesDoRun(...).length` (com 1: "Pensei em 1 passo"; com 0, a linha mostra só "Como pensei").

**Visão do run (`src/core/conversation/visao.ts`)**

```ts
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
export function visaoDoRun(p: { run: Run; etapas: RunEtapa[]; propostas: Proposta[]; retornos: Retorno[]; voto?: "up" | "down"; agora: Date }): VisaoDoRun
```

- `pergunta`: com `status: "waiting_for_input"` e pendência dentro da espera, `aberta`; vencida, `expirou`; run `cancelled` com pendência de pergunta, `seguiu`; run que passou de `waiting_for_input` adiante, `respondida` (a resposta da pessoa aparece como fala dela).
- `bloco`: com `saida.propostas` não vazio. `waiting_for_approval` dentro da espera: `aberto`; `expired`: `expirou`; `done` com alguma `aprovada`: `anotado`; `done` com todas `recusada`: `recusado`; propostas `expirada` num run `done` (nova mensagem, 005): `seguiu`.
- `podeTrocar` olha `retornos` do run pelo `retorno_id`.
- `visaoDoRun` é pura e não lança: saída que não passa no schema da 007 vira uma visão só com `resposta` (quando houver texto) e `frases`.

**Conversa do dia (`src/core/conversation/do-dia.ts`)**

```ts
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
export function conversaDoDia(deps: { stores: Stores; clock: Clock; seed: DemoSeed }, conta: Conta, perfil: Perfil): Promise<ConversaDoDia>
```

Dia local no fuso da cidade do perfil, ou `clima.fusoPadrao`. Lê `messages.doDia`, `runs.doDia`, `runs.aberto`, as etapas, propostas e retornos de cada run do dia, `runs.votos` e `outcomes.pendentes`. A fala do agente que é o texto de uma pergunta (009) não aparece como fala solta: a pergunta já está na visão do run.

**`RunRepository` (004) ganha**

```ts
doDia(contaId: string, dia: string): Promise<Run[]>                           // mais antigo primeiro
votos(contaId: string, runIds: string[]): Promise<Record<string, "up" | "down">>
```

Cobertos pela suíte de contrato dos runs (Postgres e memória); `votos` não acha run de outra conta.

**Voto:** a rota usa `touches.tocarVoto` (015, `src/core/touches/voto.ts`), sem mudança: run da conta com `saida`, senão `toque_invalido`; soma `ritu_feedback_total{voto}` só quando o voto é novo ou mudou.

**Eventos do fluxo (`src/core/conversation/eventos.ts`)**

```ts
export type EventoDaTela =
  | { tipo: "inicio"; run_id: string }
  | { tipo: "etapa"; frase: FraseDeEtapa }
  | { tipo: "fim"; visao: VisaoDoRun; pendentes: number }
  | { tipo: "erro"; erro: string }                     // código; a tela tem o texto
export function codificarEvento(e: EventoDaTela): string                // JSON + "\n"
export function lerEventos(): TransformStream<Uint8Array, EventoDaTela>  // usado pela tela; linha inválida é ignorada
```

`etapa` sai em `etapa_iniciada` (do Intérprete) e em `etapa_concluida` com frase, sem repetir a chave anterior do mesmo fluxo. `inicio` sai quando o run existe (`conversar` ganha `opts.aoCriar?: (runId: string) => void`, chamado logo depois de `runs.iniciarRun`; `continuar` emite com o id recebido).

**Rotas**

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

- `:id` é validado como uuid; inválido ou de outra conta: `404 { erro: "run_nao_encontrado" }`, conferido antes de chamar o serviço.
- Erros conhecidos → `409` com o código: `run_aberto`, `run_nao_continuavel`, `pergunta_expirada`, `aprovacao_expirada`; → `400`: `mensagem_invalida`, `resposta_invalida`, `aprovacao_invalida`, `toque_invalido`. Antes do fluxo abrir, saem como resposta JSON; depois, como evento `erro`.
- **Rotas com fluxo** (`src/app/_lib/fluxo.ts`): `criarRotaDeFluxo(deps, { corpo }, fn)` faz a mesma checagem de sessão, conta, tamanho e corpo de `criarRota`, abre um `ReadableStream`, chama `fn(ctx, emitir)` e fecha o fluxo no fim. Escrever num fluxo fechado (a pessoa saiu) é ignorado e o trabalho continua. Headers: `Content-Type: application/x-ndjson; charset=utf-8`, `Cache-Control: no-store`, `X-Accel-Buffering: no`. `export const maxDuration = telaConversa.rotaMaxDurationS`.
- `trocarIngrediente` e `responderTroca` recebem do run o `retorno_id` da sugestão; o serviço da 011 já recusa sugestão sem retorno ou respondida.

**Textos (`config/textos-conversa.ts`, incluídos como `textosConversa`)**

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
| `etapas.comoPensei` | Como pensei |
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
| `abas.conversa`, `abas.casa`, `abas.comoFicou`, `abas.voce` | Conversa · Minha casa · Como ficou? · Você |
| `abas.rotulo` | Navegação principal |
| `emBreve` | Esta parte chega em breve. |

O texto de `geral` só aparece quando `visao.geral` é verdadeiro e o agente não o disse (o aviso `geral` já vem em `avisos`: a tela mostra os `avisos`, sem texto próprio além deles).

**Ícones (Phosphor, peso `light`)**

| Uso | Ícone |
|---|---|
| Atalhos: `com_frio`, `com_calor`, `pesada`, `seca`, `agitada`, `irritada`, `sem_energia` | `Snowflake`, `Sun`, `Cloud`, `Leaf`, `Lightning`, `Fire`, `BatteryLow` |
| Sugestões: `cha`, `refeicao`, `oleo`, `pratica` | `Coffee`, `BowlFood`, `Drop`, `Wind` |
| Vale ter em casa | `ShoppingBag` |
| Abas: Conversa, Minha casa, Como ficou?, Você | `ChatCircle`, `House`, `ArrowsClockwise`, `User` |
| Enviar | `PaperPlaneRight` |
| 👍 / 👎 | `ThumbsUp`, `ThumbsDown` (com `weight="fill"` quando marcados) |

Conferir os nomes no pacote instalado; nome que não existir troca pelo mais próximo e entra na nota do plano.

**Componentes (`src/components/ritu/conversa/`, `"use client"` onde houver estado)**

| Arquivo | Exporta | O que é |
|---|---|---|
| `use-conversa.ts` | `useConversa(inicial: ConversaDoDia)` | Estado da tela: falas, runs, aberto, pendentes, estado da caixa; `enviar`, `responder`, `aprovar`, `trocar`, `responderTroca`, `votar`; lê os fluxos com `lerEventos`; consulta o run em andamento |
| `conversa.tsx` | `Conversa` | Lista (`role="log"`, `aria-label="Conversa"`), região de anúncio, indicador de retornos e caixa |
| `fala.tsx` | `FalaDaPessoa`, `FalaDoAgente` | Pessoa: balão em `surface-sunken`, alinhado à direita, até 85% da largura. Agente: texto corrido sem moldura, `measure` de leitura (até 38rem), entrelinha 1.6; parágrafos por linha em branco |
| `etapas.tsx` | `EtapasAoVivo`, `EtapasRecolhidas` | Lista das frases com o `Spinner` na última; recolhidas: "Pensei em N passos" e o `TextLink` "Como pensei" |
| `pergunta.tsx` | `PerguntaDoAgente` | Pergunta em `Surface tone="raised"`; casa: um `RadioGroup` por item (rótulo = nome do item); come e variante: botões; "Pular" `quiet` |
| `sugestao.tsx` | `BlocoDeSugestao` | Ícone do tipo, título, "Novidade" (rótulo com texto, não só cor), como fazer, ingredientes como `Chip` com o menu, verbos, "Por quê?" (abre `Sheet` com o motivo), aviso de incômodo em `amber-soft` |
| `ingrediente.tsx` | `Ingrediente` | `Chip` com o nome; abre `Menu` (Trocar · Não tenho · Não gosto) com `aria-label` "Opções para <item>"; incerto mostra "confira se ainda tem"; mostra a frase da troca, a pergunta da troca ou o "sem substituto" logo abaixo, numa região `aria-live="polite"` |
| `para-ter.tsx` | `LinhaParaTer` | `ShoppingBag`, "Vale ter em casa: <item>", "fez falta N vezes…", verbos e "Por quê?" |
| `bloco-aprovacao.tsx` | `BlocoDeAprovacao` | "Posso anotar isto?", `Checkbox` por linha, "Agora não" e "Anotar"; depois, a frase do resultado em `role="status"` |
| `rodape.tsx` | `RodapeDaResposta` | Aviso médico, 👍/👎 (`ToggleButton`), "Como pensei" |
| `caixa.tsx` | `CaixaDeMensagem` | Atalhos (`ToggleChip` com ícone e rótulo, num grupo com rótulo "Como você está?"), `TextField multiline` com rótulo visível, contador a partir de `contadorAPartirDe`, botão Enviar com ícone e nome |
| `retornos.tsx` | `IndicadorDeRetornos` | `TextLink` para `/como-ficou` com o texto do número |

- A tela anuncia a resposta numa região `aria-live="polite"` visualmente escondida, com o texto completo da `resposta` uma vez. As etapas usam outra região, que recebe só a frase nova.
- Ao chegar a resposta, o foco continua na caixa; a lista rola até o começo da resposta (`scrollIntoView` com `block: "start"`, sem animação com movimento reduzido).
- Erro de rede ou `erro.inesperado` no envio: a mensagem volta para a caixa e aparece `StateBlock kind="error"` abaixo da última fala, com "Tentar de novo".

**Páginas e moldura**

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/conversa` | `src/app/(app)/conversa/page.tsx` | Servidor: `exigirPasso("pronto")`, `conversaDoDia`, `<Conversa inicial={…} />`. Sem fala e sem run aberto: `StateBlock kind="empty"` com `vazia.*` acima da caixa |
| `/casa`, `/como-ficou`, `/voce` | `src/app/(app)/<rota>/page.tsx` | `h1` com o nome da aba e `StateBlock kind="empty"` com `emBreve` |
| `/como-pensei/[runId]` | `src/app/(app)/como-pensei/[runId]/page.tsx` | `h1` "Como pensei" e `StateBlock kind="empty"` com `emBreve` |

- `src/app/(app)/layout.tsx` (017) ganha a `nav` (`src/components/ritu/abas.tsx`, `AbasPrincipais`, com `usePathname` para `aria-current`). Celular: fixa embaixo, quatro itens com ícone e rótulo, altura mínima 3.5rem, `padding-bottom: env(safe-area-inset-bottom)`; o `main` ganha espaço embaixo para a barra e a caixa. Desktop (a partir de 64rem): coluna lateral de 14rem à esquerda do `main`, os mesmos itens em lista vertical.
- Na Conversa do celular, a caixa fica presa acima da barra (`position: sticky; bottom`), com fundo `canvas` e a linha de `line` em cima.
- `DemoBanner` (017) continua logo abaixo do cabeçalho.

**Modo e2e (acréscimos à 017)**

- `createContainer` com `RITU_MODO=e2e`: `weather` de um fake com clima fixo (frio úmido no Rio: o mesmo do cenário `frio-agitada`); Intérprete e Acompanhante com `createFakeLlm` e `createScriptedRuntime` alimentados por `e2e/roteiros/` (índice no servidor, `src/infra/e2e/roteiros.ts`): a mensagem é procurada pelo texto exato; sem roteiro, o caminho é `sem_modelo` (resposta montada por código), que também é um estado testado.
- Roteiros (escritos contra o perfil semeado da 017):

| Roteiro | Mensagem | O que acontece |
|---|---|---|
| `demo` | A `mensagem_sugerida` do seed | Intérprete: momento com `com_frio` e `agitada`. Acompanhante: `clima.agora`, `casa.ler`, `finalizar` com `cha-gengibre-canela` e o preparo de abóbora com arroz e ghee, `para_ter` de cardamomo; termina no bloco com a linha de lista e a do padrão |
| `pergunta-casa` | "fui à feira ontem, o que faço pro jantar?" | Pergunta de casa sobre `couve` e `banana` (incertos do seed); com a resposta, entrega |
| `troca` | "quero um chá quente agora" | Entrega um chá com `canela` confirmada e um substituto (`cardamomo` não está em casa; `cravo` ou o que a base der) para o E2E da troca e da pergunta da troca |
| `texto-cru` | "mostra um texto estranho" | Entrega com `resposta` contendo `<script>alert(1)</script>` e `**negrito**` |
| `lento` | "demora um pouco" | Passos com `demoraMs` real (300 ms cada), para o E2E ver as etapas chegando e para o de recarregar no meio |

- O fake de clima e o índice de roteiros só são importados por `createContainer` no modo e2e. Teste de arquitetura: `src/infra/e2e/` só é importado por `src/infra/container.ts`.

**Telemetria**

- Nenhuma métrica nova: `ritu_feedback_total` já existe (015) e é somada pelo `tocarVoto` da 015.
- Nenhum span novo: o `run` (005) já cobre o trabalho; as rotas de leitura não abrem span.
- Rótulo nunca leva conta nem texto.

**Testes e evals**

- `npm test`: `fraseDaEtapa` (cada linha da tabela e as sem frase), `frasesDoRun` (sem repetição seguida), `visaoDoRun` (cada estado de pergunta e de bloco; `podeTrocar`; saída inválida; nenhum campo interno: o JSON da visão não contém `linha_base`, `citados`, `checkpoint`, `tokens`, `modelo`), `conversaDoDia` com os stores em memória (só o dia, ordem, fala da pergunta fora, mensagem sugerida só na demonstração sem fala), `codificarEvento` e `lerEventos` (linha partida em dois pedaços, linha inválida), `criarRotaDeFluxo` (401, 400, 413 antes do fluxo; `erro` dentro do fluxo; fluxo fechado não interrompe o trabalho).
- `evals/det/seguranca/conversa.eval.ts`: cada rota desta spec sem sessão → `401`; com run de outra conta → `404` e nada gravado (troca, voto, aprovação, resposta); `GET /api/conversa` não traz fala nem run de outra conta.
- `evals/det/conversa/visao.eval.ts`: a visão de cada cenário de conversa (`test/fixtures/cenarios/`) passa no schema e não tem campo interno.
- `evals/det/mapa.ts`: as linhas "Rota sem sessão" e "Dado de outra conta" ganham os arquivos; a linha "Resposta do agente com `<script>`" aponta para `e2e/conversa.spec.ts`.
- `e2e/conversa.spec.ts` (servidor no modo e2e, `entrarNaDemo` da 017):
  - demonstração até a resposta em três toques, só com cliques e só com teclado; etapas aparecem antes da resposta; a resposta é anunciada uma vez;
  - pergunta de casa respondida e pulada;
  - bloco: aprovar um e recusar outro; "Agora não";
  - troca: Trocar mostra o substituto e a frase; Não tenho com pergunta da troca;
  - 👍 e troca para 👎; recarregar mantém;
  - `<script>` e `**` aparecem como texto;
  - recarregar no meio do roteiro `lento` mostra "O Ritu ainda está respondendo…" e depois a resposta;
  - envio com run aberto em outra aba → frase do `run_aberto`;
  - `POST /api/runs` com `Origin` de outro site → `403`;
  - indicador de retornos com o número do seed, levando a `/como-ficou`;
  - barra: navegar pelas quatro abas, `aria-current` certo;
  - axe nos estados vazia, respondendo, pergunta, resposta com bloco e erro; nas quatro abas e em `/como-pensei/<run>`; nos dois temas.
- O `smoke.spec.ts` não muda.

### Usa

- **001:** `RituError`, container, teste de arquitetura, Playwright.
- **004:** `Run`, `RunEtapa`, `RunRepository`, `Proposta`, `ProposalStore.doRun`, `Retorno`, `OutcomeStore.doRun` e `pendentes`, `MessageRepository.doDia`, `Mensagem`, `diaLocal`, `createMemoryStores`, suíte de contrato.
- **005:** `TipoDeEtapa`, `EventoAoVivo`, estados do run, regra de run aberto (`RunAbertoError`, cancelamento e expiração), `esperaMinutos`.
- **007:** `SaidaDoAcompanhante`, `SugestaoEntregue`, `TipoDeSugestao`, schema da saída.
- **008:** `createConversation` (`conversar`), `mensagemRecebidaSchema`, `textoDaMensagem`, `Caminho`, `config.conversa.maxCaracteres`, cenários de conversa.
- **009:** `continuar`, `Pergunta`, `respostaDaPessoaSchema`, `RunNaoContinuavelError`.
- **010:** `aprovar`, `PropostaNaSaida`, `config.aprovacao.maxLinhas`.
- **011:** `touches.trocarIngrediente`, `responderTroca`, `MotivoDaTroca`, `ResultadoDaTroca`, `retorno_id` e `troca` na saída.
- **012:** linha do padrão no bloco (vem pronta em `saida.propostas`).
- **013:** resposta segura e avisos (vêm prontos na saída).
- **015:** `METRICAS` (`ritu_feedback_total`), `Telemetry`, `touches.tocarVoto`.
- **016:** tokens, `Button`, `IconButton`, `TextField`, `Chip`, `ToggleChip`, `Menu`, `Sheet`, `Checkbox`, `Surface`, `StateBlock`, `Spinner`, `TextLink`, `toast`, `ICON`, `expectSemViolacoes`, `usarTema`.
- **017:** `criarRota`, `exigirPasso`, `contaAtual`, `(app)/layout.tsx`, `DemoBanner`, `DemoSeed` (`mensagem_sugerida`), proxy com `Origin`, modo e2e, `e2e/apoio/sessao.ts` (`test`, `entrarNaDemo`).

## Evals (quando a spec toca agente, prompt, tool ou base)

A spec não muda agente, prompt, tool nem base. Os evals determinísticos novos são os de `evals/det/seguranca/conversa.eval.ts` e `evals/det/conversa/visao.eval.ts`. Nenhum caso com LLM novo: o `c4-site` roda os casos de sempre pelas rotas desta spec, no fechamento da entrega 3.

## Nível das partes

- **nucleo** (Sonnet): `criarRotaDeFluxo` e as rotas com fluxo (`/api/runs` e `/resposta`), `aoCriar` em `conversar`, `useConversa` (leitura do fluxo, consulta do run, estado), o modo e2e com os roteiros no container.
- **tela** (Sonnet): todos os componentes de `src/components/ritu/conversa/`, `AbasPrincipais`, a página `/conversa`, as páginas vazias, o ajuste do `(app)/layout.tsx` e `e2e/conversa.spec.ts`.
- **conteudo** (Opus): nada. Os textos estão nesta spec; as respostas dos roteiros e2e são escritas pelo construtor do núcleo e passam no validador real.
- Todo o resto é `mecanica`: configuração, textos, `fraseDaEtapa`, `visaoDoRun`, `conversaDoDia`, eventos, `RunRepository.doDia` e `votos` (com migração nenhuma), rotas JSON, evals determinísticos e mapa.

## Leitura para a construção

- `BUSINESS.md` §8 (a conversa: o que a pessoa diz, atalhos, fluxo de uma mensagem e o desenho da resposta) e §10 (indicador de retornos).
- `ARCHITECTURE.md` §3 (fluxo de um run, estados e rotas de toque).
- `DESIGN.md` §3 (regras e acessibilidade da conversa) e §4 (componentes do Ritu).
- `DEVELOPMENT.md` §"UI" e §"Camadas e importações".
- Skills: `frontend-design` e `web-design-guidelines` (tela); `next-best-practices` (`route-handlers.md`, `rsc-boundaries.md`).
- Documentação instalada: `node_modules/next/dist/docs/` (rota com `ReadableStream`, `maxDuration`).

## Dependências

- Entrega 2 fechada (008 a 015) e as specs 016 e 017 implementadas.
- Nenhum pacote novo.
- Nenhuma variável de ambiente nova.

## Riscos e trade-offs

- **Tempo de função no Hobby da Vercel:** um run longo pode passar de 60 s. As pausas já cortam o run em pedidos; um run que estoure o tempo fica `running` até a limpeza marcar `expired`. A tela recarregada mostra "ainda respondendo" por até 90 s e depois o erro. A 022 confere o teto real na produção.
- **Fluxo atrás de proxy:** algum proxy pode segurar o NDJSON até o fim; aí a pessoa vê só a resposta, sem as etapas. `X-Accel-Buffering: no` e `Cache-Control: no-store` reduzem o risco; a resposta continua correta.
- **Run que segue sem a pessoa:** gasta cota mesmo quando ninguém vai ler. É raro e o resultado fica no dia dela.
- **Páginas vazias nas abas:** a barra aponta para telas ainda sem conteúdo durante a construção da entrega 3. Nada vai a público antes do portão 3.
- **Visão por projeção:** cada campo novo da saída precisa entrar em `visaoDoRun` para aparecer. É o preço de não vazar campo interno.
- **Roteiros e2e acoplados ao seed:** mudar o perfil semeado pode quebrar um roteiro no validador real. O E2E acusa, que é o aviso certo.
- **Sem histórico de dias anteriores:** quem volta no dia seguinte vê a conversa vazia. É o desenho do produto; o agente lembra pelo contexto e "Como ficou?".

## Edge cases e modos de falha

- Dois envios seguidos (duplo toque): o segundo encontra o run em `running` e recebe `run_aberto`; a tela mantém só o primeiro.
- A pessoa recarrega com uma pergunta aberta: a visão traz `pergunta.estado = "aberta"` e os botões continuam funcionando.
- Pergunta respondida depois de vencer: `409 pergunta_expirada`; a pergunta passa a `expirou`, sem perder o que já estava na tela.
- Aprovação em duas abas: a segunda recebe `run_nao_continuavel`; a tela relê o run e mostra o resultado da primeira.
- Troca num ingrediente que outra aba já trocou: o serviço da 011 trabalha com o id efetivo atual; a tela substitui a sugestão pela que vier em `visao`.
- Troca depois de responder o retorno em "Como ficou?": `toque_invalido`; a tela relê o run e o menu some.
- Run `failed`: a fala do agente é a resposta segura que o serviço gravou; sem sugestões, sem voto além do da resposta.
- Caminhos sem agente (`casa`, `evitar`, `ajuda`, `ofensa`, `alerta`, `fora`): a resposta aparece como fala, sem sugestões; o bloco aparece quando houver anotações (`casa`, `evitar`); alerta não tem 👍/👎 nem "Pensei em…" além das frases que existirem.
- Saída sem sugestões (pergunta conceitual): só o texto, o rodapé e, se houver, o bloco.
- Fluxo que termina sem `fim` (conexão caiu): a tela consulta `GET /api/runs/:id` como no recarregar.
- Linha do fluxo partida entre dois pedaços: `lerEventos` junta antes de ler.
- Texto com 1000 caracteres: o contador avisa; acima disso a caixa não deixa enviar (`aria-disabled` e a frase do contador).
- Mensagem só com espaços e sem atalho: Enviar fica com `aria-disabled` e a frase `caixa.vazia`.
- JavaScript desligado: `/conversa` mostra as falas do dia (renderizadas no servidor) e um `noscript` dizendo que a conversa precisa de JavaScript.
- Conta vencida no meio do fluxo (demonstração passou de 24 h): o fluxo já aberto termina; o próximo pedido recebe `401` e a tela volta à Entrada com o aviso da 017.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 6 verdes; `npm run dup` limpo; `test:db` verde.
- `npm run build && npm run start` com `RITU_MODO=e2e`: demonstração da Entrada à resposta e ao bloco no navegador; screenshots em `.plans/018-<estado>-<tema>-<projeto>.png` da Conversa vazia, respondendo, com pergunta e com resposta e bloco (claro e escuro, celular e desktop) para a dona conferir.
- Com Postgres, sem `RITU_MODO` e com a chave de desenvolvimento: uma mensagem de verdade pela tela, com etapas, resposta e bloco, para conferir o fluxo fora do modo e2e.
- `ARCHITECTURE.md` §3: as rotas de run como são (com o fluxo NDJSON, `/troca`, `/voto`, `/aprovacao`, `/resposta`), a regra de o run seguir sem a conexão e a consulta do run; §7 com `src/components/ritu/conversa/` e `src/infra/e2e/`.
- `BUSINESS.md` §7: a barra de navegação e "Você"; §8: atalhos com ícones, etapas recolhidas em "Pensei em N passos".
- `DESIGN.md` §3: a resposta aparece inteira; §4: a barra de navegação na tabela do Ritu.
- `QA.md`: o E2E da conversa aponta para `e2e/conversa.spec.ts`. `DEVELOPMENT.md`: os roteiros do modo e2e.
- `.specs/README.md`: a linha da 018 com a barra de navegação; as da 019 e 020 dizem que preenchem as páginas que a 018 deixa vazias.
- ADR nova (próximo número livre): etapas por fluxo NDJSON no `POST`, run independente da conexão e visão do run por projeção.

## Arquivos e diretórios envolvidos

- `config/tela-conversa.ts`, `config/textos-conversa.ts` (novos), `config/index.ts`
- `src/core/conversation/etapas.ts`, `visao.ts`, `do-dia.ts`, `eventos.ts` (novos, com testes), `conversar.ts` (`aoCriar`)
- `src/core/runs/ports.ts` (`doDia`, `votos`), `src/infra/db/runs.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/runs.contract.ts`
- `src/infra/container.ts`
- `src/infra/e2e/` (novo: roteiros e clima fixo)
- `src/architecture.test.ts`
- `src/app/_lib/fluxo.ts` (novo)
- `src/app/api/conversa/route.ts`, `src/app/api/runs/route.ts`, `src/app/api/runs/[id]/route.ts`, `…/[id]/resposta/route.ts`, `…/[id]/aprovacao/route.ts`, `…/[id]/troca/route.ts`, `…/[id]/troca/resposta/route.ts`, `…/[id]/voto/route.ts` (novos)
- `src/app/(app)/layout.tsx`, `src/app/(app)/conversa/page.tsx`, `src/app/(app)/{casa,como-ficou,voce}/page.tsx`, `src/app/(app)/como-pensei/[runId]/page.tsx`
- `src/components/ritu/conversa/` (novo), `src/components/ritu/abas.tsx` (novo)
- `e2e/roteiros/` (novo), `e2e/conversa.spec.ts` (novo)
- `evals/det/seguranca/conversa.eval.ts`, `evals/det/conversa/visao.eval.ts` (novos), `evals/det/mapa.ts`
- `.docs/ARCHITECTURE.md`, `BUSINESS.md`, `DESIGN.md`, `QA.md`, `DEVELOPMENT.md`; `.specs/README.md`; `.adrs/`
