---
title: Minha casa e Como ficou?
status: approved
entrega: 3
created: 2026-11-15
---

# Minha casa e Como ficou?

> Preenche duas das abas que a 018 deixa vazias: **Minha casa** (a casa por grupo em prateleiras, a seção "Ainda tem?", "sempre tenho", gosto por item, os itens que acabaram e a lista "Para ter em casa" com o motivo) e **Como ficou?** (as sugestões que esperam retorno, com Ajudou · Não ajudou · Não fiz). Junto vêm as rotas de toque da casa, do gosto, da lista e do retorno, todas sem modelo.

## Contexto

A entrega 2 grava a casa, os gostos, as faltas, a lista e os retornos, e a 011 já tem os toques de retorno e de gosto como funções do core. A 018 põe a Conversa no ar e deixa `/casa` e `/como-ficou` com "Esta parte chega em breve.". Falta a pessoa **ver e corrigir** o que o Ritu sabe da casa dela, e responder às sugestões sem escrever (`BUSINESS.md` §7, §9 e §10).

Minha casa é o que torna a personalização visível: é a base de toda sugestão "com o que você tem". Como a comida acaba sem aviso, a aba precisa resolver o incerto em um toque. Como ficou? é de onde vem o "funcionou", que reordena as próximas sugestões.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Itens em prateleiras:** cada grupo é uma prateleira, com os itens como rótulos que quebram linha; tocar num item abre uma folha com as opções dele.
- **Uma página só:** "Ainda tem?" no topo (só com incertos), depois a casa por grupo, os que acabaram e a lista "Para ter em casa".
- **"Acabou" pela aba não é falta.** Falta é o que fez falta para uma sugestão (`BUSINESS.md` §9). `ARCHITECTURE.md` §3 dizia o contrário e é corrigido.
- **Como ficou? mostra só o que espera retorno.** Depois do toque, o item fica na tela com o resultado até a pessoa sair; na próxima visita, some.

## Objetivo

- Na demonstração, resolver os 3 incertos do seed em "Ainda tem?" com um toque cada, e ver a seção sumir.
- Toda ação da aba (adicionar, ainda tenho, acabou, sempre tenho, gosto, tirar, pôr e tirar da lista) responde sem chamada de modelo e muda a próxima resposta da Conversa: item "acabou" não entra; "não gosto" sai; "sempre tenho" nunca fica incerto.
- Aprovar a linha de cardamomo na Conversa da demonstração faz cardamomo aparecer em "Para ter em casa" com "Fez falta 3 vezes nos últimos 30 dias"; "Comprei" o põe na casa e o tira da lista.
- Responder as 2 sugestões do seed em Como ficou? zera o indicador da Conversa.
- As duas telas passam no axe nos dois temas, em celular e desktop, em cada estado (cheia, vazia, erro).

## Escopo

- **Dentro:**
  - Visões puras: `visaoDaCasa` e `visaoComoFicou`.
  - Toques novos no core: `tocarCasa` e `tocarLista`. Os de retorno e gosto já existem (011).
  - Motivo `pessoa` na lista "Para ter em casa" (a pessoa pode pôr um item por conta própria, `BUSINESS.md` §9), com migração.
  - Rotas: `GET /api/casa`, `POST /api/casa`, `POST /api/preferencias`, `POST /api/lista`, `GET /api/retornos`, `POST /api/retornos/:id`.
  - Telas `/casa` e `/como-ficou` e os componentes do Ritu delas (`DESIGN.md` §4).
  - E2E das duas telas e evals determinísticos das rotas.
- **Fora:**
  - "Como pensei", "O que sei sobre você", Perfil (com "evitar sempre", restrições e "não como"), painel do dosha e seletor de tema: 020.
  - Confirmar ou recusar um padrão: no bloco de aprovação (012) e em "O que sei sobre você" (020). A rota `/api/padroes/:id` de `ARCHITECTURE.md` §3 fica para a 020.
  - Limite de toques por conta (60 por minuto, 300 por dia) e telas de cota esgotada: 021. Estas telas não dependem de modelo e continuam funcionando com a cota esgotada.
  - Comentário livre junto do retorno ("ajudou, mas achei forte"): vai pela Conversa (011).
  - Gosto de prática ou de preparo pela tela: só alimentos da casa aqui; o resto na 020.
  - Histórico de retornos respondidos: o produto não mostra (decisão da dona).

## Necessidade de negócio

Sem a aba, a casa só muda pela conversa, e o "incerto" vira pergunta atrás de pergunta. Com ela, a pessoa confere em segundos o que o Ritu acha que ela tem, e cada sugestão fica mais certeira. Como ficou? fecha o ciclo de aprendizado: é o retorno que distingue o Ritu de uma IA que responde sempre igual.

## Critérios de aceite

### Minha casa

- [ ] **Prateleiras:** cada grupo com item `confirmado` ou `sempre_tenho` aparece como `section` com `h2` (nome do grupo e número de itens), na ordem de `GRUPOS`, e os itens em ordem alfabética (`pt-BR`). Grupo sem item não aparece. Itens que a base não conhece ficam na prateleira "Ainda não conheço", com o texto "ainda não conheço este alimento" na folha.
- [ ] **Rótulo do item:** `Chip` com o nome; "sempre tenho" com o ícone `PushPin`, "gosto" com `Heart`, "não gosto" com `HeartBreak`; o nome acessível diz tudo em palavras ("Canela, sempre tenho, você gosta"). A cor nunca é o único sinal.
- [ ] **Folha do item:** tocar no rótulo abre `Sheet` com o nome, a linha de estado ("confirmado hoje", "confirmado ontem", "confirmado há N dias", "sempre tenho"), a chave "Sempre tenho", Gosto · Não gosto, "Acabou" e "Tirar da casa". Item que a base não conhece não tem gosto.
- [ ] **Ainda tem?:** com itens incertos, a seção aparece no topo, com o texto "Faz tempo que você confirmou estes. Ainda tem?" e, por item, o nome, "confirmado há N dias", "Ainda tenho" e "Acabou" (`aria-label` "Ainda tenho <item>" e "<Item> acabou"). Sem incertos, a seção não existe. Os incertos não aparecem nas prateleiras.
- [ ] **Ainda tenho:** confirma o item agora (`pantry.registrar`); ele vai para a prateleira do grupo e sai de "Ainda tem?" (E2E com os 3 incertos do seed).
- [ ] **Acabou:** marca acabou (`pantry.marcarAcabou`), **sem** gravar falta; o item vai para a prateleira "Acabou".
- [ ] **Acabou (prateleira):** fica depois dos grupos; a folha de cada item tem "Tenho de novo", "Pôr na lista" (ou o texto "Já está na lista") e "Tirar da casa".
- [ ] **Sempre tenho:** a chave grava na hora; item "sempre tenho" nunca vai para "Ainda tem?". A chave só existe em item que a pessoa tem.
- [ ] **Gosto:** Gosto · Não gosto são dois `ToggleChip` exclusivos; tocar no marcado limpa. Grava por `tocarGosto` (011). Alimento com "não gosto" sai dos candidatos da próxima resposta (eval).
- [ ] **Tirar da casa:** apaga a linha da casa (`pantry.tirar`).
- [ ] **Adicionar:** o botão "Adicionar" abre a folha "Adicionar à casa" com a busca de alimento (`GET /api/alimentos`, 017). Escolher um alimento o registra; sem resultado, a opção "Adicionar “<texto>” assim mesmo" registra o texto, que antes passa por `identificarAlimento` (002). A folha continua aberta, com o campo limpo, e o aviso breve diz "<Item> está na sua casa.".
- [ ] **Para ter em casa:** cada item mostra o nome e o motivo: "Faltou para <detalhe>", "Fez falta <n> vezes nos últimos 30 dias" ou "Você pôs na lista"; e os botões "Comprei" e "Tirar da lista".
- [ ] **Comprei:** registra o alimento em casa (`pantry.registrar`, que apaga as faltas e tira da lista); ele aparece na prateleira do grupo.
- [ ] **Tirar da lista:** tira o item da lista e apaga as faltas dele; o Ritu só volta a indicá-lo depois de 3 dias novos de falta. Não conta como recusa.
- [ ] **Pôr na lista:** grava com motivo `pessoa`; funciona também para alimento cuja proposta de lista foi recusada antes.
- [ ] **Do bloco à lista:** na demonstração (modo e2e, roteiro `demo` da 018), aprovar a linha de cardamomo na Conversa faz cardamomo aparecer em `/casa` com "Fez falta 3 vezes nos últimos 30 dias" (E2E).
- [ ] **Casa vazia:** sem nenhum item, `StateBlock kind="empty"` com "Sua casa está vazia." e "Conte na conversa o que você tem, ou adicione aqui. Eu sugiro com o que você já tem.", com o botão "Adicionar". Lista vazia: "Nada na lista por enquanto. Quando algo fizer falta, eu aviso na conversa."
- [ ] **Depois de cada toque:** a tela mostra a casa que a rota devolveu (sem atualização otimista); o botão tocado fica `isPending`; o aviso breve confirma em palavras ("Couve: anotei que acabou."). Fechada a folha porque o item mudou de lugar, o foco vai para o `h2` da seção para onde ele foi.

### Como ficou?

- [ ] **Lista:** `h1` "Como ficou?", o texto "Seu retorno me ajuda a acertar mais nas próximas vezes." e as sugestões `aguardando` dos últimos 7 dias, agrupadas por dia ("Hoje", "Ontem", "Há N dias"), da mais recente para a mais antiga. Cada uma com o ícone do tipo, o título, os ingredientes (nomes) e Ajudou · Não ajudou · Não fiz num grupo com `aria-label` "Como ficou <título>?".
- [ ] **Toque:** grava por `tocarRetorno` (011); os botões dão lugar a "Anotado: <resultado>." com o ícone `Check`, em `role="status"`. Recarregar a página tira o item.
- [ ] **Já respondido em outra aba ou pela conversa:** o toque devolve o retorno como está, e a tela mostra o resultado gravado.
- [ ] **Vazia:** "Nada esperando seu retorno." e "Quando eu sugerir algo na conversa, aparece aqui.", com o `TextLink` "Ir para a conversa".
- [ ] **Indicador:** responder as 2 sugestões do seed e voltar à Conversa: o indicador de retornos (018) some (E2E).

### Rotas e segurança

- [ ] **Sem sessão:** toda rota desta spec responde `401 { erro: "sem_sessao" }` (eval).
- [ ] **Outra conta:** item da casa, retorno ou alimento da lista de outra conta → `400 { erro: "toque_invalido" }` e nada muda (eval). `GET /api/casa` e `GET /api/retornos` não trazem nada de outra conta.
- [ ] **Corpo:** ação fora do schema → `400 { erro: "corpo_invalido" }`; `alimento_id` fora da base em gosto e lista → `400 { erro: "toque_invalido" }`.
- [ ] **Origem:** `POST /api/casa` com `Origin` de outro site → `403` (proxy da 017; E2E).
- [ ] **Privacidade:** nenhum span, métrica ou log leva nome de alimento, nome livre ou título de sugestão; os toques novos entram no teste de canários da 015.
- [ ] **Acessibilidade:** `/casa` e `/como-ficou` passam em `expectSemViolacoes` nos dois temas, em `celular` e `desktop`, nos estados cheia (seed), vazia e com a folha aberta; com 200% de zoom em 1280 px, sem rolagem horizontal.
- [ ] Gates 1 a 6 verdes, `npm run dup` limpo, `test:db` verde com a migração e a suíte da lista.

## O que fazer

- Carregar a skill `frontend-design` antes de escrever as telas e `web-design-guidelines` antes de entregar; seguir a direção visual desta spec e `DESIGN.md`.
- Escrever primeiro as funções puras (`visaoDaCasa`, `visaoComoFicou`, `textoDoMotivo`, `textoDaConfirmacao`) e os testes; depois os toques e as rotas com os stores em memória; por último as telas.
- Usar `criarRota` (017) em todas as rotas e só os componentes base da 016.
- Reusar `estadoDoItem` (004), `identificarAlimento` (002), `tocarRetorno` e `tocarGosto` (011), `diaLocal` (004).
- Registrar no mapa dos evals os arquivos novos.
- Atualizar os docs no fechamento.

## O que não fazer

- Não chamar modelo, a Open-Meteo nem o Postgres em `npm test`, `eval:det` ou `test:e2e`.
- Não gravar falta a partir da aba (nem em "Acabou", nem em "Tirar da casa").
- Não criar o estado "incerto" no banco: ele é calculado (`ARCHITECTURE.md` §6).
- Não atualizar a tela antes da resposta da rota.
- Não mostrar retornos já respondidos numa visita nova, nem deixar mudar um retorno respondido.
- Não pôr contagem de retornos na barra de navegação: o produto não cobra (`BUSINESS.md` §10).
- Não pôr nome de alimento, nome livre ou título em span, métrica ou log.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Itens da casa | Prateleiras por grupo, itens como rótulos; folha com as opções (dona) | Compacto no celular, com cara de despensa; as opções ficam a um toque sem poluir a lista |
| Estrutura da aba | Uma página: Ainda tem? → prateleiras → Acabou → Para ter em casa (dona) | A pessoa vê tudo rolando; o que pede ação fica no topo |
| "Acabou" pela aba | Não grava falta (dona) | Falta é o que fez falta para uma sugestão (`BUSINESS.md` §9); acabar sozinho não diz que a pessoa precisa do item |
| Como ficou? | Só o que espera retorno; respondido fica na tela até sair (dona) | `BUSINESS.md` §10; a pessoa vê que o toque contou, sem a área virar histórico |
| Incertos | Só em "Ainda tem?", não repetidos na prateleira | Um lugar para cada item; o topo resolve o incerto |
| Itens que acabaram | Prateleira "Acabou" no fim, com "Tenho de novo" e "Pôr na lista" | Some do caminho sem sumir da casa; daqui a pessoa repõe ou anota |
| Tirar da lista | Tira e apaga as faltas do alimento | Sem isso, as faltas de 30 dias fariam o Ritu indicar o mesmo item na resposta seguinte |
| Pôr na lista por conta própria | Motivo novo `pessoa` ("Você pôs na lista"), com migração | `BUSINESS.md` §9 já permite; o motivo explica a origem |
| "Comprei" | É "adicionar" com o id do alimento | Registrar já apaga as faltas e tira da lista (004); nenhuma regra nova |
| Adicionar texto livre | Passa por `identificarAlimento` antes; sem achar, vira nome livre | "Abóbora" digitado sem escolher na busca cai no alimento da base |
| Atualização da tela | Sem otimismo: a rota devolve a visão e a tela troca | Simples e sempre igual ao banco; os toques são rápidos (sem modelo) |
| Uma rota para a casa | `POST /api/casa` com `acao` (união discriminada) | `ARCHITECTURE.md` §3 já prevê uma rota; um `criarRota` só |
| Contagem na barra | Nenhuma | O produto não cobra; o indicador discreto fica na Conversa (018) |
| Rastro dos toques novos | Span `toque` com `tipo: "casa"` e `"lista"`; sem métrica nova | Mesmo padrão da 011; o painel já tem gostos, faltas e retornos |

### Direção visual (com a skill `frontend-design`, dentro da 016)

- **Assinatura: a prateleira.** Cada grupo é um título em Cormorant Garamond (`text-xl`, peso 500) com o número em Figtree `ink-muted` ao lado; os rótulos assentam sobre uma linha de 1px em `line` com 0.5rem de `sunken` embaixo, como uma tábua. É o único gesto decorativo da aba.
- **O resto é quieto:** "Ainda tem?" em `Surface tone="sunken"` sem sombra; a lista "Para ter em casa" em linhas com divisórias `line`, o ícone `ShoppingBag` no título; Como ficou? em blocos `Surface tone="surface"`, título da sugestão em Cormorant, dia como `h2` em Figtree `text-sm` peso 600.
- **Movimento:** o item que muda de seção só aparece no novo lugar com opacidade (`--ritu-fast`); nada com movimento reduzido. Sem animação de layout.
- **Escrita:** rótulos pelo que a pessoa faz ("Ainda tenho", "Acabou", "Comprei"); a confirmação repete a ação ("anotei que acabou"); erro diz o que houve e que nada mudou.

## Contratos

### Cria

**Migração (`db/migrations/<próximo número>_lista_motivo_pessoa.sql`)**

```sql
alter table lista_ter_em_casa drop constraint <nome da check de motivo>;
alter table lista_ter_em_casa add constraint lista_ter_em_casa_motivo_check
  check (motivo in ('faltou_hoje', 'fez_falta', 'pessoa'));
```

O nome atual da check é conferido no banco (`\d lista_ter_em_casa`) antes de escrever a migração.

**`ShortageStore` (004) muda**

```ts
export type MotivoDaLista = "faltou_hoje" | "fez_falta" | "pessoa"
// ItemDaLista.motivo e o item de porNaLista passam a usar MotivoDaLista; com "pessoa", detalhe é "".
```

`lista.propor` (010) continua só com `faltou_hoje` e `fez_falta`. Suíte de contrato da lista: grava e lê `pessoa`.

**Configuração (`config/textos-casa.ts`, em `config/index.ts` como `textosCasa`)**

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
| `prateleira.numero` | {n} itens (com 1: 1 item) |
| `rotulo.sempre`, `rotulo.gosta`, `rotulo.naoGosta` | sempre tenho · você gosta · você não gosta |
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
| `grupos` | frutas: Frutas · folhas: Folhas · legumes: Legumes · raizes: Raízes · graos: Grãos · leguminosas: Leguminosas · laticinios: Laticínios · ovos: Ovos · oleaginosas: Oleaginosas · oleos: Óleos · especiarias: Especiarias · adocantes: Adoçantes · bebidas: Bebidas |

**Textos de Como ficou? (`config/textos-como-ficou.ts`, como `textosComoFicou`)**

| Chave | Texto |
|---|---|
| `titulo` | Como ficou? |
| `texto` | Seu retorno me ajuda a acertar mais nas próximas vezes. |
| `grupo` | Como ficou {titulo}? |
| `ajudou`, `naoAjudou`, `naoFez` | Ajudou · Não ajudou · Não fiz |
| `anotado` | Anotado: {resultado}. |
| `dia.hoje`, `dia.ontem`, `dia.dias` | Hoje · Ontem · Há {n} dias |
| `vazia.titulo` | Nada esperando seu retorno. |
| `vazia.texto` | Quando eu sugerir algo na conversa, aparece aqui. |
| `vazia.link` | Ir para a conversa |
| `erro` | Não consegui anotar agora. Tente de novo. |

`{Item}`: nome com a primeira letra maiúscula; `{item}`: em minúsculas (regra da 008).

**Visão da casa (`src/core/pantry/visao.ts`)**

```ts
export type ItemNaCasa = {
  id: string
  alimento_id: string | null
  nome: string                                  // da base, ou o nome livre
  grupo: Grupo | null                           // null: a base não conhece
  estado: EstadoCalculado                       // 004
  dias: number                                  // dias inteiros desde confirmado_em, no dia local
  sempre_tenho: boolean
  gosto: "gosta" | "nao_gosta" | null           // sempre null quando grupo é null
  na_lista: boolean
}
export type ItemDaListaNaTela = { alimento_id: string; nome: string; motivo: MotivoDaLista; texto: string }
export type CasaNaTela = {
  ainda_tem: ItemNaCasa[]                       // incertos, do mais antigo para o mais novo
  prateleiras: { grupo: Grupo | "desconhecidos"; nome: string; itens: ItemNaCasa[] }[]  // confirmados e sempre_tenho
  acabou: ItemNaCasa[]                          // ordem alfabética
  lista: ItemDaListaNaTela[]                    // mais recente primeiro
  vazia: boolean                                // nenhum item na casa (a lista não conta)
}
export function visaoDaCasa(p: { itens: ItemDaCasa[]; lista: ItemDaLista[]; preferencias: Preferencia[]; kb: KnowledgeBase; agora: Date; fuso: string }): CasaNaTela
export function textoDoMotivo(item: ItemDaLista): string
```

Pura e sem lançar. Prateleiras na ordem de `GRUPOS`, a de desconhecidos por último; dentro de cada uma, `localeCompare` em `pt-BR`. Item da lista cujo alimento não existe mais na base não aparece.

**Visão de Como ficou? (`src/core/outcomes/visao.ts`)**

```ts
export type RetornoNaTela = {
  id: string
  tipo: TipoDeSugestao
  titulo: string
  ingredientes: string[]                        // nomes dos alimentos da base, na ordem
  status: "aguardando" | "respondido"
  resultado: Resultado | null
}
export type ComoFicouNaTela = { dias: { dia: string; nome: string; retornos: RetornoNaTela[] }[]; total: number }
export function retornoNaTela(r: Retorno, kb: KnowledgeBase): RetornoNaTela
export function visaoComoFicou(p: { retornos: Retorno[]; kb: KnowledgeBase; agora: Date; fuso: string }): ComoFicouNaTela
```

Só `aguardando` com `criado_em` nos últimos `config.memoria.retornosDias` (7) dias; `dia` é o dia local de `criado_em`; `nome` vem de `dia.*`. Mais recente primeiro.

**Toques (`src/core/touches/`, `Deps` da 011)**

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
export function tocarLista(deps: Deps, contaId: string, acao: z.infer<typeof acaoDaListaSchema>): Promise<{ nome: string }>
```

`tocarCasa`, numa transação, dentro do span `toque` (`tipo: "casa"`):

| Ação | Faz | Recusa com `toque_invalido` |
|---|---|---|
| `adicionar` | `pantry.registrar([{ alimento_id }], "tela")` | Alimento fora da base |
| `adicionar_texto` | `identificarAlimento(texto)`: achou → como `adicionar`; não → `registrar([{ nome_livre: texto }], "tela")` | — |
| `tenho` | Lê o item da conta; `registrar` com a mesma referência | Item que não é da conta |
| `acabou` | `marcarAcabou` com a referência do item. Nenhuma falta | Idem |
| `sempre_tenho` | `definirSempreTenho(item_id, valor)` | Item que não é da conta, ou `valor: true` em item `acabou` |
| `tirar` | `pantry.tirar(item_id)` | Item que não é da conta |

`tocarLista`, numa transação, dentro do span `toque` (`tipo: "lista"`): alimento fora da base → `toque_invalido`. `por`: `shortages.porNaLista({ alimento_id, motivo: "pessoa", detalhe: "" })` (já na lista: não muda). `tirar`: `shortages.tirarDaLista` e `shortages.apagarDoAlimento`.

O nome devolvido é o da base ou o nome livre: serve só para a frase de confirmação na tela, nunca para a telemetria. `toque` aceita os valores `casa` e `lista` em `tipo` (registro de atributos da 015).

**Leitura da casa (`src/core/pantry/ler.ts`)**

```ts
export function lerCasa(deps: { stores: Stores; kb: KnowledgeBase; clock: Clock }, contaId: string, fuso: string): Promise<CasaNaTela>
// pantry.listar, shortages.lista e preferences.ler(contaId, alimentos da casa) → visaoDaCasa
```

`Container.touches` ganha `tocarCasa` e `tocarLista`; `Container` ganha `lerCasa` e `lerComoFicou` (`outcomes.pendentes` → `visaoComoFicou`). O fuso é o da cidade do perfil, ou `clima.fusoPadrao`.

**Rotas (todas por `criarRota`)**

| Rota | Corpo | Faz | Resposta |
|---|---|---|---|
| `GET /api/casa` | — | `lerCasa` | `{ casa: CasaNaTela }` |
| `POST /api/casa` | `acaoDaCasaSchema` | `tocarCasa` e `lerCasa` | `{ casa, nome }` |
| `POST /api/preferencias` | `{ alimento_id: string; gosto: "gosta" \| "nao_gosta" \| null }` | `tocarGosto(…, { tipo: "alimento", id }, gosto)` (011) e `lerCasa` | `{ casa, nome }` |
| `POST /api/lista` | `acaoDaListaSchema` | `tocarLista` e `lerCasa` | `{ casa, nome }` |
| `GET /api/retornos` | — | `lerComoFicou` | `{ comoFicou: ComoFicouNaTela }` |
| `POST /api/retornos/:id` | `{ resultado: "ajudou" \| "nao_ajudou" \| "nao_fez" }` | `tocarRetorno` (011); `:id` não uuid → `toque_invalido` | `{ retorno: RetornoNaTela; pendentes: number }` |

**Ícones (Phosphor, peso `light`)**

| Uso | Ícone |
|---|---|
| Adicionar | `Plus` |
| Sempre tenho · gosto · não gosto | `PushPin`, `Heart`, `HeartBreak` |
| Ainda tem? | `Question` |
| Para ter em casa · Comprei | `ShoppingBag`, `Check` |
| Anotado (Como ficou?) | `Check` |
| Tipo da sugestão | os da 018 (`Coffee`, `BowlFood`, `Drop`, `Wind`) |

Conferir os nomes no pacote instalado; nome que não existir troca pelo mais próximo e entra na nota do plano.

**Componentes (`src/components/ritu/casa/` e `src/components/ritu/como-ficou/`, `"use client"` onde houver estado)**

| Arquivo | Exporta | O que é |
|---|---|---|
| `casa/use-casa.ts` | `useCasa(inicial: CasaNaTela)` | Estado da tela; `tocar(acao)`, `gostar(alimento_id, gosto)`, `lista(acao)`; chama a rota, troca a casa pela resposta, dispara o `toast` de confirmação ou de erro |
| `casa/minha-casa.tsx` | `MinhaCasa` | Cabeçalho com `h1` e "Adicionar"; Ainda tem?; prateleiras; Acabou; Para ter em casa; estado vazio |
| `casa/ainda-tem.tsx` | `AindaTem` | `Surface tone="sunken"`, `h2` com `Question`, uma linha por incerto com "Ainda tenho" (`secondary`) e "Acabou" (`quiet`), `size="sm"` |
| `casa/prateleira.tsx` | `Prateleira` | `section` com `h2` (nome e número), `ul` de `ItemDaCasa`, a linha da tábua |
| `casa/item.tsx` | `ItemDaCasa` | `Chip` com os ícones e o nome acessível; abre `FolhaDoItem` |
| `casa/folha-item.tsx` | `FolhaDoItem` | `Sheet` com o título do item, a linha de estado, `Switch` "Sempre tenho", dois `ToggleChip` de gosto, e as ações do estado do item |
| `casa/adicionar.tsx` | `FolhaAdicionar` | `Sheet` com o `ComboBox` da busca (mínimo de 2 caracteres, da 017) e a opção de texto livre |
| `casa/lista.tsx` | `ListaParaTer` | `section` com `h2` e `ShoppingBag`; uma linha por item com nome, motivo em `ink-muted`, "Comprei" (`secondary`, `Check`) e "Tirar da lista" (`quiet`) |
| `como-ficou/como-ficou.tsx` | `ComoFicou` | `h1`, texto, um `h2` por dia, os itens; estado vazio |
| `como-ficou/item.tsx` | `ItemDeRetorno` | `Surface`, ícone do tipo, título (`h3`), ingredientes, grupo dos três botões; depois do toque, "Anotado: …" em `role="status"` |

**Páginas**

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/casa` | `src/app/(app)/casa/page.tsx` | Servidor: `exigirPasso("pronto")`, `lerCasa`, `<MinhaCasa inicial={…} />` |
| `/como-ficou` | `src/app/(app)/como-ficou/page.tsx` | Servidor: `exigirPasso("pronto")`, `lerComoFicou`, `<ComoFicou inicial={…} />` |
| Carregando | `loading.tsx` nas duas | `StateBlock kind="loading"` |

**Testes**

- `npm test`: `visaoDaCasa` (incerto só em `ainda_tem`, ordem dos grupos e dos itens, desconhecidos por último, "acabou" separado, `na_lista`, `vazia`, lista com alimento fora da base), `textoDoMotivo` (os três motivos), `visaoComoFicou` (só aguardando dos últimos 7 dias, dias no fuso, ordem), `tocarCasa` (cada ação e cada recusa; "acabou" não grava falta; `adicionar_texto` que acha alimento da base), `tocarLista` (`por` idempotente, `tirar` apaga faltas), rotas com os stores em memória (401, 400, 413).
- `e2e/casa.spec.ts` (modo e2e, `entrarNaDemo`): os 3 incertos resolvidos (dois "Ainda tenho", um "Acabou") e a seção some; folha: sempre tenho, gosto e tirar; adicionar pela busca e por texto livre; cardamomo aprovado na Conversa aparece na lista, "Comprei" o põe na prateleira de especiarias; "Pôr na lista" num item que acabou; `Origin` de outro site → `403`; só com teclado; axe em cheia, vazia (conta nova do modo e2e) e com a folha aberta, nos dois temas.
- `e2e/como-ficou.spec.ts`: as 2 sugestões do seed em "Ontem"; "Ajudou" e "Não fiz" mostram "Anotado"; recarregar mostra a área vazia; o indicador da Conversa some; axe cheia e vazia, nos dois temas.

### Usa

- **002:** `identificarAlimento`, `KnowledgeBase`, `GRUPOS`.
- **004:** `PantryStore`, `ItemDaCasa`, `estadoDoItem`, `ShortageStore`, `ItemDaLista`, `PreferenceStore`, `OutcomeStore.pendentes`, `Retorno`, `diaLocal`, `createMemoryStores`, suítes de contrato, `config.memoria`.
- **011:** `Deps` dos toques, span `toque`, `tocarRetorno`, `tocarGosto`, `RituError` `toque_invalido`.
- **015:** registro de atributos (`toque.tipo`), teste de canários.
- **016:** tokens, `Button`, `IconButton`, `Chip`, `ToggleChip`, `Switch`, `Sheet`, `ComboBox`, `Surface`, `StateBlock`, `TextLink`, `toast`, `ICON`, `expectSemViolacoes`.
- **017:** `criarRota`, `exigirPasso`, `contaAtual`, `GET /api/alimentos`, proxy com `Origin`, modo e2e, `entrarNaDemo`, perfil semeado.
- **018:** páginas e barra de `(app)`, ícones dos tipos de sugestão, indicador de retornos, roteiro `demo` do modo e2e.

## Evals (quando a spec toca agente, prompt, tool ou base)

A spec não muda agente, prompt, tool nem base. Novos determinísticos:

- `evals/det/seguranca/toques-casa.eval.ts`: cada rota sem sessão → `401`; item da casa, retorno e lista de outra conta → `toque_invalido` e nada gravado; as leituras não trazem dado de outra conta.
- `evals/det/casa/efeito.eval.ts`, com os stores em memória e o perfil semeado: "acabou" tira o alimento dos candidatos do preparo seguinte e não grava falta; "não gosto" pela rota tira o alimento; "sempre tenho" num incerto o tira de `ainda_tem`; "tirar da lista" apaga as faltas e o `para_ter` do mesmo alimento não volta no preparo seguinte; "pôr na lista" de alimento recusado grava `pessoa`.

## Nível das partes

- **tela** (Sonnet): componentes de `src/components/ritu/casa/` e `src/components/ritu/como-ficou/`, as duas páginas e os `loading.tsx`, `e2e/casa.spec.ts` e `e2e/como-ficou.spec.ts`.
- Todo o resto é `mecanica`: migração, `MotivoDaLista`, textos, visões, `tocarCasa`, `tocarLista`, `lerCasa`, `lerComoFicou`, rotas, evals determinísticos e mapa.

## Leitura para a construção

- `BUSINESS.md` §9 (Minha casa, gostos, o que fez falta, lista) e §10 (Como ficou?).
- `DESIGN.md` §3 (regras e acessibilidade) e §4 (componentes do Ritu).
- `DEVELOPMENT.md` §"UI" e §"Camadas e importações".
- Skills: `frontend-design` e `web-design-guidelines` (tela); `next-best-practices` (`route-handlers.md`, `rsc-boundaries.md`).

## Dependências

- 018 implementada (barra, páginas vazias, roteiro `demo`); 011 e 015 implementadas.
- Nenhum pacote novo. Nenhuma variável de ambiente nova.

## Riscos e trade-offs

- **Sem atualização otimista:** cada toque espera a rota (dezenas de ms sem modelo). Em rede lenta, o botão fica em `isPending`; vale pela tela sempre igual ao banco.
- **"Acabou" sem falta:** a pessoa que marca muita coisa como acabada não recebe "vale ter em casa" por isso. É a regra do produto; ela pode pôr na lista por conta própria.
- **Tirar da lista zera as faltas:** some a contagem que justificava o item. É o que a pessoa pediu ao tirar.
- **Prateleiras longas:** uma casa com 60 itens fica comprida no celular. Os grupos e a quebra de linha dos rótulos seguram; busca dentro da casa fica para depois do portão, se a dona pedir.
- **Retorno respondido some na próxima visita:** quem quiser ver o que funcionou vê o efeito nas sugestões, não uma lista. Decisão da dona.

## Edge cases e modos de falha

- Toque no mesmo item em duas abas: a segunda recebe a casa como está; "tenho" e "acabou" são idempotentes no resultado.
- Item tirado em outra aba e tocado aqui: `toque_invalido`; a tela relê `GET /api/casa`, mostra a casa atual e o aviso de erro.
- Retorno apagado pela limpeza (mais de 7 dias) enquanto a tela estava aberta: `toque_invalido`; o item sai da tela.
- Adicionar alimento que já está na casa: confirma de novo (`registrar`) e o tira de "Ainda tem?" e da lista.
- Adicionar alimento em "evitar sempre": é gravado (a casa é o que a pessoa tem); o filtro continua tirando ele das sugestões.
- Gosto num item que a base não conhece: não existe na folha; a rota recusa `alimento_id` fora da base.
- "Comprei" num item cuja conta não tem mais o alimento na lista (outra aba): registra em casa do mesmo jeito.
- Erro de rede: `toast` com `textosCasa.erro`; a tela não muda.
- Conta de demonstração vencida no meio: a rota responde `401` e a tela volta à Entrada com o aviso da 017.
- JavaScript desligado: as páginas mostram a casa e os retornos renderizados no servidor, sem ações, e um `noscript` dizendo que tocar precisa de JavaScript.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 6 verdes; `npm run dup` limpo; `test:db` verde.
- Screenshots em `.plans/019-<tela>-<estado>-<tema>-<projeto>.png` de `/casa` (cheia, vazia, folha aberta) e `/como-ficou` (cheia, vazia), claro e escuro, celular e desktop, para a dona conferir.
- `ARCHITECTURE.md` §3: a tabela de rotas de toque como ela é (`/api/casa` com as ações, `/api/preferencias`, `/api/lista` com `por` e `tirar`, `/api/retornos/:id`, sem falta em "acabou" pela tela); §6: `lista_ter_em_casa.motivo` com `pessoa`; §7: `src/components/ritu/casa/` e `como-ficou/`.
- `BUSINESS.md` §9: "Acabou" pela aba não é falta; tirar da lista apaga as faltas do alimento; o item posto pela pessoa mostra "Você pôs na lista"; §7: Minha casa em prateleiras com "Acabou"; §10: o respondido some na visita seguinte.
- `DESIGN.md` §4: prateleira, folha do item e item de retorno na tabela do Ritu.
- `QA.md`: os E2E de Minha casa e de Como ficou? apontam para os arquivos novos.
- `.specs/README.md`: a linha da 019 como foi feita.

## Arquivos e diretórios envolvidos

- `db/migrations/<próximo>_lista_motivo_pessoa.sql` (novo)
- `src/core/shortages/ports.ts`, `src/infra/db/shortages.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/shortages.contract.ts`
- `config/textos-casa.ts`, `config/textos-como-ficou.ts` (novos), `config/index.ts`
- `src/core/pantry/visao.ts`, `src/core/pantry/ler.ts`, `src/core/outcomes/visao.ts` (novos, com testes)
- `src/core/touches/casa.ts`, `src/core/touches/lista.ts` (novos, com testes)
- `src/core/telemetry/` (valores `casa` e `lista` de `toque.tipo`)
- `src/infra/container.ts`
- `src/app/api/casa/route.ts`, `src/app/api/preferencias/route.ts`, `src/app/api/lista/route.ts`, `src/app/api/retornos/route.ts`, `src/app/api/retornos/[id]/route.ts` (novos)
- `src/app/(app)/casa/page.tsx`, `loading.tsx`; `src/app/(app)/como-ficou/page.tsx`, `loading.tsx`
- `src/components/ritu/casa/`, `src/components/ritu/como-ficou/` (novos)
- `e2e/casa.spec.ts`, `e2e/como-ficou.spec.ts` (novos)
- `evals/det/seguranca/toques-casa.eval.ts`, `evals/det/casa/efeito.eval.ts` (novos), `evals/det/mapa.ts`
- `.docs/ARCHITECTURE.md`, `BUSINESS.md`, `DESIGN.md`, `QA.md`; `.specs/README.md`
