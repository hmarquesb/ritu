---
title: Retorno, gostos e trocas
status: approved
entrega: 2
created: 2026-11-15
---

# Retorno, gostos e trocas

> Fecha o ciclo de aprendizado: toda sugestão entregue vira um retorno aguardando, as faltas e o "já sugerido" são gravados, a pessoa responde por toque ou pela conversa, marca o que gosta, troca um ingrediente sem refazer a resposta, e a indicação de "vale ter em casa" vira proposta de lista. É o que faz a ordenação da 007 ter o que ler.

## Contexto

A 007 ordena os candidatos por casa, gosto e resultado, calcula as faltas do run e escolhe o candidato a "vale ter em casa". Mas ninguém grava esses registros: os retornos não são criados, as faltas não chegam ao banco, o "já sugerido" não é marcado e a indicação de `para_ter` não vira proposta. A 008 fecha um retorno que já existe (`registrarResultado`) e a 010 tem a porta (`extras`) por onde a proposta de lista entra. Falta quem escreve.

Faltam também os toques: Ajudou · Não ajudou · Não fiz, Gosto · Não gosto, Não tenho e Trocar. Eles não passam pelo agente nem pelo modelo.

## Objetivo

- Depois de uma resposta entregue, o banco tem um retorno por sugestão, as faltas `teria_entrado` do run e o "já sugerido" de cada item.
- Dois "não ajudou" seguidos, por toque ou pela conversa, mandam a sugestão para o fim na resposta seguinte; um "não gosto" tira o alimento; um "gosto" sobe o alimento.
- Uma troca de ingrediente responde sem chamada de modelo e só usa o que está confirmado em casa.
- Com `para_ter` na saída, o bloco de aprovação traz a linha da lista.

## Escopo

- **Dentro:**
  - `registrarEntrega`: retornos, "já sugerido" e faltas `teria_entrado`, gravados quando a resposta é entregue.
  - Toques, como funções do core: `tocarRetorno`, `tocarGosto`, `trocarIngrediente` (Trocar, Não tenho, Não gosto) e `responderTroca`.
  - Troca de ingrediente por código, com pergunta quando não há substituto confirmado em casa.
  - Tool `resultado.registrar`, para o agente ligar um retorno contado na conversa que o Intérprete não ligou.
  - Gosto escrito na conversa: "adoro gengibre" vale no mesmo run e vira proposta; "não gosto de quiabo" entra como "não como".
  - Proposta de lista do `para_ter` e as etapas `aprovada` e `recusada` de `ritu_para_ter_total`.
  - Prompt `acompanhante.v5`, cenários do `demo`, evals determinísticos, casos do `c2` e a rodada ⚠️ do checkpoint `c2-conversa`.
- **Fora:**
  - Rotas HTTP dos toques, limite de toques e telas: menu do ingrediente (018), Minha casa e Como ficou? (019), limites (021).
  - Notas de rotina e padrões (012). Juiz (013). Runner completo de evals (014).
  - Comentário livre junto do retorno ("ajudou, mas achei forte"): o agente lê na conversa do dia; nada além do resultado é guardado.

## Necessidade de negócio

A razão para usar o Ritu e não uma IA genérica é ele acertar mais a cada uso. Sem esta spec, a memória de gostos, resultados e faltas existe só como tabela vazia. Com ela, cada resposta deixa rastro que muda a próxima, e a pessoa corrige uma sugestão com um toque em vez de escrever de novo.

## Critérios de aceite

- [ ] **Retornos:** resposta entregue com 3 sugestões cria 3 retornos `aguardando`, na ordem, e cada `SugestaoEntregue` da saída gravada leva o `retorno_id`. Saída `segura`, saída de `codigo` e run `failed` não criam retorno.
- [ ] **Já sugerido:** depois da entrega, a prática ou o preparo e cada alimento das sugestões têm `ultima_sugestao_em` preenchido.
- [ ] **Faltas:** cada alimento de `faltas_do_run` vira uma falta `teria_entrado` com o `run_id`; alimento que a pessoa respondeu "Tenho" durante o run não é gravado; rodar duas vezes no mesmo dia conta um dia só; run que falha não grava.
- [ ] **Ordem dos registros:** retornos, "já sugerido" e faltas são gravados numa transação só; se uma parte falha, nenhuma fica.
- [ ] **Toque de retorno:** `tocarRetorno` fecha o retorno com origem `toque` e soma os contadores da sugestão e dos alimentos; tocar de novo não soma outra vez; retorno de outra conta devolve `toque_invalido`.
- [ ] **Aprendizado:** com dois "não ajudou" seguidos no mesmo item, o preparo seguinte o põe no fim do seu tipo; um "ajudou" depois o traz de volta. Vale por toque e pela conversa.
- [ ] **Toque de gosto:** `tocarGosto` grava `gosta`, `nao_gosta` ou limpa; alimento com `nao_gosta` sai dos candidatos do run seguinte; alimento com `gosta` sobe.
- [ ] **Troca:** `trocarIngrediente` com motivo `trocar` substitui o ingrediente pelo primeiro substituto confirmado em casa, devolve a sugestão com `troca` e a frase de `fraseDaTroca`, atualiza `runs.saida` e os alimentos do retorno aguardando. Nenhuma chamada de modelo.
- [ ] **Troca respeita os filtros:** o substituto nunca está em "evitar sempre", restrição, "não como" ou "não gosto", nunca é item a evitar agora (`saida.evitar`) e nunca forma combinação incompatível com os outros itens da sugestão.
- [ ] **Não tenho:** o toque marca o alimento como acabou, grava a falta `nao_tenho` e faz a troca no mesmo pedido.
- [ ] **Não gosto:** o toque grava `nao_gosta` e faz a troca no mesmo pedido.
- [ ] **Pergunta da troca:** sem substituto confirmado, e havendo um substituto incerto ou nunca registrado, `trocarIngrediente` devolve `perguntar`. "Tenho" registra em casa e troca; "Não tenho" marca acabou, grava a falta `nao_tenho` e devolve `sem_substituto`. No máximo uma pergunta por toque.
- [ ] **Sem substituto:** sem nenhum candidato, ou depois de `maxTrocasPorItem` trocas no mesmo ingrediente, devolve `sem_substituto` com o texto fixo; a sugestão não muda.
- [ ] **`resultado.registrar`:** com retorno na mensagem ainda não registrado, a tool fecha o retorno do número pedido com o resultado que o Intérprete apontou; sem retorno na mensagem, já registrado neste run ou número fora dos pendentes, recusa com o código.
- [ ] **Gosto escrito:** "adoro gengibre, o que tomo agora?" faz o gengibre contar como "gosta" na ordenação do mesmo run e põe a linha "Você gosta de gengibre" no bloco; aprovada, grava `gosta`; recusada ou expirada, não grava. "Não gosto de quiabo" vira "não como" (010).
- [ ] **Para ter em casa:** saída com `para_ter` gera a linha de lista (`fez_falta`) no bloco; aprovada, o item entra na lista com o motivo e soma `ritu_para_ter_total{etapa: "aprovada"}`; recusada, soma `recusada` e o alimento não volta a ser candidato; expirada, pode voltar.
- [ ] **Privacidade:** nenhum span, métrica, log ou `resumo` de etapa leva nome de alimento, título de sugestão ou texto da pessoa.
- [ ] `npm run demo` roda os seis cenários novos sem rede, com código 0.
- [ ] ⚠️ `npm run eval:llm -- --checkpoint c2-conversa` roda uma vez no fechamento e grava `evals/resultados/c2-conversa.md` e a coluna em `evals/COMPARACAO.md`.
- [ ] Gates: `lint`, `typecheck`, `test`, `eval:det`, `dup`, `build`, `test:db`.

## O que fazer

- Gravar a entrega dentro do `companion`, onde os dados do preparo estão à mão, antes de as propostas serem montadas.
- Reusar `substitutos` e `fraseDaTroca` (002), `registrarResultado` (008), `montarPergunta` (009) e `montarFiltro` (007, 010). Nenhuma regra de substituição nova.
- Refazer o filtro e a casa na hora do toque: o que vale é o estado de agora, não o do run.
- Copiar desta spec os textos e as linhas de prompt.

## O que não fazer

- Não chamar modelo em nenhum toque.
- Não refazer a resposta em texto depois de uma troca: muda só a sugestão.
- Não gravar gosto escrito sem aprovação. Não gravar o comentário livre do retorno.
- Não criar rota HTTP nem componente de tela.
- Não deixar a tool `resultado.registrar` escolher o resultado: ele vem do Intérprete.
- Não propor lista para substituto que a pessoa respondeu "Não tenho" numa troca: a falta entra na contagem e a indicação vem pelo "vale ter em casa".

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Substituto da troca | Só alimento confirmado em casa | A resposta do momento é feita com o que há em casa; é a mesma regra do validador para `se_faltar` |
| Sem substituto em casa | Pergunta sobre o melhor substituto incerto ou nunca registrado; "Não tenho" grava falta | Decisão da dona. A pessoa descobre uma troca possível e a falta alimenta o "vale ter em casa" |
| "Não tenho" e "Não gosto" num ingrediente | Gravam e trocam no mesmo toque | Decisão da dona. Um toque resolve |
| "Não gosto de X" escrito | Entra como "não como": vale na hora e vira proposta (010) | Decisão da dona. Um caminho só para o que a pessoa não quer |
| "Gosto de X" escrito | Vale no mesmo run e vira proposta `gosta` | Decisão da dona. O gosto já ordena os candidatos; a escrita segue "ler livre, escrever proposto" (ADR 0008) |
| Gosto escrito sozinho | Sem caminho próprio: vai ao Acompanhante como `vida` | Evita mais um caminho por código; o agente acolhe e a proposta sai no bloco |
| Onde a entrega é gravada | No `companion`, ao fim do trecho `entregue` ou `sem_modelo` | É onde estão os dados do preparo e a casa atualizada pelas respostas |
| Entregas que contam | Origem `agente` e `sem_modelo` | As duas entregam sugestões. `segura` e `codigo` não têm sugestão |
| Como a troca fica na saída | O item original fica, com o campo `troca` | O validador de `estrutura` compara os itens com os ingredientes da prática; a tela mostra o substituto no lugar e a frase |
| Conferência da troca | Regras de `se_faltar` do validador mais `saida.evitar` | O checkpoint do run já fechou; o que o run guardou basta |
| Trocar de novo | Exclui o original e os substitutos já usados; teto de 3 por ingrediente | Evita ciclo |
| Troca e retorno | Os alimentos do retorno aguardando passam a ser os efetivos | O "ajudou" tem que contar para o que a pessoa de fato usou |
| Até quando dá para trocar | Enquanto o retorno da sugestão está aguardando | Depois do retorno, ou de 7 dias, a sugestão é história |
| Resultado em `resultado.registrar` | O que o Intérprete apontou; a tool recebe só o número do pendente | O agente decide a ligação, não o conteúdo |
| Rastro do toque | Span `toque` e métricas; sem etapa no run | O run já está encerrado |
| Rodada do `c2-conversa` | No fechamento desta spec, com o runner da 008 | `QA.md`, checkpoints |

## Contratos

### Cria

**Configuração (`config/toques.ts`, em `config/index.ts`)**

```ts
export const toques = { maxTrocasPorItem: 3, substitutosAvaliados: 8 } as const
```

**Registro da entrega (`src/core/outcomes/registrar-entrega.ts`)**

```ts
export function sugestaoRegistrada(s: SugestaoEntregue): SugestaoRegistrada
// tipo, pratica_id ou preparo_id, titulo; alimentos: o id efetivo de cada item (troca.alimento_id, se houver)
export function registrarEntrega(
  deps: { tx: Transactor; telemetry: Telemetry },
  p: { contaId: string; runId: string; dia: string; saida: SaidaDoAcompanhante; dados: DadosDoPreparo },
): Promise<SaidaDoAcompanhante>            // a saída, com retorno_id em cada sugestão
```

Numa transação, só quando `saida.origem` é `agente` ou `sem_modelo`; nas outras, devolve a saída como veio:

1. `outcomes.criar(contaId, runId, saida.sugestoes.map(sugestaoRegistrada))`; cada sugestão recebe o `retorno_id`, na ordem.
2. `preferences.marcarSugerido`: para cada sugestão, o item dela (`pratica` com `pratica_id`, ou `preparo` com `preparo_id`) e cada alimento, sem repetir.
3. Faltas: os ids de `dados.faltas_do_run` que não estão em `dados.casa.confirmados` nem em `dados.casa.incertos` → `shortages.registrar(contaId, [{ alimento_id, origem: "teria_entrado", run_id }], dia)`; soma `ritu_faltas_total{origem: "teria_entrado"}` por falta.

O `companion` (007) chama `registrarEntrega` em `responder` e em `continuar`, nos fins `entregue` (com saída válida) e `sem_modelo`, antes de gravar `runs.saida`. Se falhar, o run segue: etapa `erro` de nome `registro_da_entrega`, saída sem `retorno_id`.

**Saída (acréscimos a `saida.ts`, 007)**

```ts
// SugestaoEntregue
retorno_id?: string
// item de SugestaoEntregue
troca?: {
  alimento_id: string; nome: string
  contribui: Guna[]; verbos: string[]; linha_base: string
  frase: string                       // fraseDaTroca (002)
  anteriores: string[]                // ids já usados neste item, sem o atual
}
```

O **id efetivo** de um item é `troca.alimento_id`, ou `alimento_id` quando não há troca.

**Toques (`src/core/touches/`)**

```ts
type Deps = { tx: Transactor; stores: Stores; kb: KnowledgeBase; clock: Clock; telemetry: Telemetry }

// retorno.ts
export function tocarRetorno(deps: Deps, contaId: string, retornoId: string, resultado: Resultado): Promise<Retorno>
// registrarResultado(..., "toque"); sem retorno: RituError "toque_invalido"

// gosto.ts
export function tocarGosto(deps: Deps, contaId: string, item: { tipo: ItemTipo; id: string }, gosto: "gosta" | "nao_gosta" | null): Promise<void>
// item fora da base: "toque_invalido"; preferences.definirGosto; ritu_gosto_total{gosto: "gosta" | "nao_gosta" | "limpou"}

// troca.ts
export type MotivoDaTroca = "trocar" | "nao_tenho" | "nao_gosto"
export type ResultadoDaTroca =
  | { resultado: "trocou"; sugestao: SugestaoEntregue }
  | { resultado: "perguntar"; pergunta: { alimento_id: string; nome: string; texto: string } }
  | { resultado: "sem_substituto"; texto: string }
export function trocarIngrediente(deps: Deps, contaId: string, p: { runId: string; sugestao: number; alimento_id: string; motivo: MotivoDaTroca }): Promise<ResultadoDaTroca>
export function responderTroca(deps: Deps, contaId: string, p: { runId: string; sugestao: number; alimento_id: string; candidato: string; resposta: "tenho" | "nao_tenho" }): Promise<ResultadoDaTroca>
```

`sugestao` é a posição na saída, a partir de 0. `alimento_id` é o id efetivo do ingrediente tocado.

Ordem de `trocarIngrediente`, numa transação e dentro do span `toque` (`tipo: "troca"`, `motivo`, `resultado`):

1. Busca o run da conta, a sugestão e o item pelo id efetivo. Sem run, sem saída, posição ou item que não existe, sugestão sem `retorno_id` ou com retorno já respondido: `toque_invalido`.
2. Pelo motivo: `nao_tenho` → `pantry.marcarAcabou` e `shortages.registrar` com `origem: "nao_tenho"`, o `run_id` e o dia local, e `ritu_faltas_total{origem: "nao_tenho"}`; `nao_gosto` → `preferences.definirGosto(alimento, "nao_gosta")` e `ritu_gosto_total{gosto: "nao_gosta"}`; `trocar` → nada.
3. Lê o perfil, os temporários do dia, as preferências e a casa; monta o filtro (`montarFiltro`) e os sinais (`em_casa`: confirmados; `gosta`; `ajudou`).
4. Com `troca.anteriores` já em `maxTrocasPorItem`: `sem_substituto`.
5. `substitutos({ alimento_id: <id original do item>, funcao, preparo_id, outros_itens: <ids efetivos dos outros itens>, filtro, sinais, limite: substitutosAvaliados }, kb)`, tirando o id efetivo atual, os `anteriores` e os que têm `alimentos:<id>` em `saida.evitar`.
6. O primeiro que está **confirmado** em casa: aplica a troca (abaixo) e devolve `trocou`.
7. Senão, o primeiro que está incerto ou nunca foi registrado (o que está como acabou não entra): devolve `perguntar`, com o texto de `montarPergunta({ tipo: "casa", alimentos: [id], incertos }, kb)` (009).
8. Senão: `sem_substituto`.

Aplicar a troca: preenche `item.troca` (os `anteriores` ganham o id efetivo que saiu, quando ele não é o original); grava a saída com `runs.atualizar`; `outcomes.atualizarSugestao` com `sugestaoRegistrada` da sugestão nova; `preferences.marcarSugerido` para o substituto; `ritu_troca_ingrediente_total{resultado: "trocou"}`. Em `sem_substituto`: `ritu_troca_ingrediente_total{resultado: "sem_substituto"}`. O que o passo 2 gravou fica gravado nos três resultados.

`responderTroca`: confere, como no passo 1, e que `candidato` ainda sai do passo 5. `tenho` → `pantry.registrar([{ alimento_id: candidato }], "pergunta")` e aplica a troca. `nao_tenho` → `pantry.marcarAcabou`, falta `nao_tenho` do candidato e devolve `sem_substituto`.

**Textos (`src/core/touches/textos.ts`)**

| Chave | Texto |
|---|---|
| `semSubstituto` | Não achei uma troca para {item} com o que você tem em casa. |

`{item}`: nome do alimento em minúsculas. A frase da troca é a de `fraseDaTroca` (002): "Troquei canela por cardamomo: os dois aquecem."

**Tool `resultado.registrar` (`src/core/agents/tools/resultado.ts`)**

```ts
export const resultadoRegistrar: Tool<{ pendente: number }, { registrado: true; titulo: string } | { registrado: false; motivo: "sem_retorno" | "ja_registrado" | "fora_dos_pendentes" }>
// description: "Anota como foi uma sugestão anterior, quando a pessoa contou isso na mensagem. Passe o número da sugestão em retornos_pendentes."
```

Lê `ctx.run`, que ganha:

```ts
retorno?: { resultado: Resultado; registrado: boolean }
pendentes: { n: number; retorno_id: string }[]
```

| Código | Recusa quando |
|---|---|
| `sem_retorno` | `ctx.run.retorno` não existe |
| `ja_registrado` | `retorno.registrado` é `true`, ou a tool já registrou neste run |
| `fora_dos_pendentes` | `pendente` não está em `pendentes` |

Aceita: `registrarResultado(deps, contaId, retorno_id, retorno.resultado, "conversa")` e marca `registrado: true` em `dados.retorno`. `resumir`: `registrado` ou `recusado: <código>`. `criarAcompanhante` acrescenta a tool e passa a usar `acompanhante.v5`.

**Contexto do Acompanhante (acréscimos a `contexto.ts`, 007)**

- Com `retorno` na entrada e `registrado: false`: logo depois de `retorno`, `retornos_pendentes: [{ n, tipo, titulo, ha_dias }]`, com os `conversa.interprete.pendentesNoContexto` retornos aguardando mais recentes, na mesma ordem e numeração que o Intérprete recebeu.
- Com gosto na mensagem: `gosta_da_mensagem: [nomes]`, logo depois de `casa_da_mensagem`.

**Prompt `acompanhante.v5` (`src/core/agents/prompts/acompanhante.v5.ts`)**

Cópia de `acompanhante.v4` com `versao: "acompanhante.v5"`. A linha que começa com "- retorno:" é substituída por estas duas:

```text
- retorno: a pessoa contou como foi uma sugestão. Reconheça em uma frase. Com registrado true, já está anotado. Com registrado false, veja retornos_pendentes: se der para saber de qual sugestão ela fala, chame resultado.registrar com o número dela; se não der, diga que ela pode marcar em "Como ficou?". Nunca diga que anotou sem a tool ter devolvido registrado: true.
- gosta_da_mensagem: alimentos de que a pessoa acabou de dizer que gosta. Já contam na ordem dos candidatos. Não diga que anotou.
```

**Proposta de lista do "vale ter em casa" (`src/core/proposals/montar.ts`)**

```ts
export function propostaDoParaTer(saida: SaidaDoAcompanhante): ConteudoDaProposta[]
// com saida.para_ter: [{ tool: "lista.propor", alimento_id, motivo: "fez_falta", detalhe: String(vezes) }]; sem: []
```

O fim do run (010) passa `extras: propostaDoParaTer(saida)` a `montarPropostas`.

**Gosto escrito (acréscimos à 008 e à 010)**

```ts
// SaidaDoInterprete (008)
gosta: string[]
// Interpretacao (008)
gosta: { alimento_id: string; nome: string }[]
// Anotacao (008)
| { tipo: "gosta"; itens: { alimento_id: string; nome: string }[] }       // só os que ainda não têm "gosta"
// EntradaDoAcompanhante (007)
gosta_da_mensagem?: string[]                                              // ids de alimentos
// ConteudoDaProposta (010)
| { tool: "memoria.propor"; tipo: "gosta"; itens: { alimento_id: string; nome: string }[] }
```

- Prompt do Intérprete (`interprete.v1`, 008): a linha de `nao_come` passa a ser "os alimentos que ela disse que não come ou de que não gosta ("não como coentro", "não gosto de quiabo"), com as palavras dela."; entra, depois dela, "- gosta: os alimentos de que ela disse que gosta ("adoro gengibre"), com o nome no singular. Só gosto declarado; pedir ou comprar um alimento não é gostar."
- `normalizarInterpretacao`: cada nome de `gosta` passa por `identificarAlimento`; só fica o que é da base; sem repetir; até `maxEvitar`; sai o que também está em `evitar` ou em `nao_come` da mesma mensagem. `gosta` não acrescenta intenção.
- `montarAnotacoes`: anotação `gosta` com os itens que passam no filtro do perfil ("evitar sempre", restrição, "não como") e ainda não têm `gosta`.
- `conversar`: leva os ids para `gosta_da_mensagem`.
- `preparar`: cada id de `gosta_da_mensagem` conta como `gosto: "gosta"` nas preferências usadas pela ordenação e sai de `filtro.nao_gosta` neste run. Nada é gravado.
- Linha da proposta (010, `textos.ts`): "Você gosta de {itens}". Ordem do bloco: evitar sempre, restrição, não como, gosta, casa tem, casa acabou, lista, rotina.
- Executor (010): `preferences.definirGosto({ tipo: "alimento", id }, "gosta")` para cada item que existe na base; `ritu_gosto_total{gosto: "gosta"}`.
- Resumo da etapa `proposta`: `gosta: 1 item`.

**Mudanças em specs anteriores**

- 004: `OutcomeStore` ganha `atualizarSugestao(contaId: string, retornoId: string, sugestao: SugestaoRegistrada): Promise<Retorno | undefined>`, que só muda retorno `aguardando`. Nos dois adaptadores e em `test/contracts/outcomes.contract.ts`. Sem migração.
- 005: `SPANS` ganha `toque`; os atributos são os rótulos que já existem (`tipo`, `motivo`, `resultado`).
- 007: `SugestaoEntregue.retorno_id` e `troca` no item; `companion` chama `registrarEntrega`; `ToolContext.run` com `retorno` e `pendentes`; `criarAcompanhante` com a tool nova e a v5.
- 008: campo `gosta` no Intérprete e na interpretação, anotação `gosta`, linha de `nao_come` no prompt (já escritos na 008).
- 010: proposta `gosta`, `extras` com `propostaDoParaTer`; em `aprovar`, para cada proposta de lista com motivo `fez_falta`, `ritu_para_ter_total{etapa: "aprovada" | "recusada"}` (já escritos na 010).

**Container:** ganha `touches: { tocarRetorno, tocarGosto, trocarIngrediente, responderTroca }`, já com as dependências.

**Cenários (`test/fixtures/cenarios/`)**

`Cenario` ganha `toques?: Toque[]`, executados na ordem depois da entrega (e da aprovação, se houver):

```ts
export type Toque =
  | { tipo: "retorno"; sugestao: number; resultado: Resultado }
  | { tipo: "gosto"; item: { tipo: ItemTipo; id: string }; gosto: "gosta" | "nao_gosta" | null }
  | { tipo: "troca"; sugestao: number; alimento_id: string; motivo: MotivoDaTroca; resposta?: "tenho" | "nao_tenho" }
```

| Cenário | Mensagem e toques | Mostra |
|---|---|---|
| `entrega-registrada` | O momento do `frio-agitada`, pelo `conversar`; aprova o bloco | Três retornos aguardando, faltas gravadas, "já sugerido"; linha "Cardamomo na lista…" aprovada; item na lista com "Fez falta 3 vezes nos últimos 30 dias" |
| `troca-por-toque` | Momento; toque Trocar na canela do chá, com cardamomo confirmado em casa | "Troquei canela por cardamomo: os dois aquecem."; retorno com os alimentos novos; nenhuma etapa `llm` |
| `nao-tenho-com-pergunta` | Momento; toque Não tenho no gengibre, sem substituto confirmado e com um nunca registrado; resposta Não tenho | Acabou e falta do gengibre; pergunta "Você tem … em casa?"; falta do candidato; `semSubstituto` |
| `dois-nao-ajudou` | Momento; dois toques Não ajudou no mesmo chá, em dias diferentes (dois retornos semeados); nova mensagem de momento | O chá no fim do seu tipo no segundo preparo |
| `retorno-pelo-agente` | "aquilo de ontem me fez bem, e agora tô com frio", com dois retornos aguardando e o Intérprete sem `pendente` | Roteiro `resultado.registrar` → `finalizar`; retorno fechado com origem `conversa` |
| `gosto-escrito` | "adoro gengibre, o que tomo agora?" | Gengibre conta como gosto na ordem; bloco com "Você gosta de gengibre"; aprova; preferência gravada |

O relatório do `demo` ganha, depois da resposta: "Como ficou?" (os retornos aguardando, com o título), "Gravado" (quantas faltas e quantos itens marcados como sugeridos) e "Toques" (um por linha, com o resultado). `--interativo` não muda.

### Usa

- Spec 002: `KnowledgeBase`, `substitutos`, `fraseDaTroca`, `SinaisPessoa`, `passaNoFiltro`, `identificarAlimento`, `Guna`, `Funcao`.
- Spec 004: `Stores`, `Transactor`, `OutcomeStore` (`criar`, `doRun`, `pendentes`), `PreferenceStore` (`ler`, `definirGosto`, `marcarSugerido`), `ShortageStore.registrar`, `PantryStore` (`listar`, `registrar`, `marcarAcabou`), `ProfileStore`, `RunRepository` (`buscar`, `atualizar`), `Retorno`, `Resultado`, `SugestaoRegistrada`, `ItemTipo`, `estadoDoItem`, `diaLocal`.
- Spec 005: `Telemetry`, `SPANS`, `Tool`, `ToolContext`, etapa `erro`.
- Spec 007: `SaidaDoAcompanhante`, `SugestaoEntregue`, `DadosDoPreparo` (`faltas_do_run`, `casa`, `para_ter`), `preparar`, `montarFiltro`, `createCompanion`, `criarAcompanhante`, `Cenario`, `montarCenario`, `scripts/demo.ts`.
- Spec 008: `registrarResultado`, `Interpretacao`, `normalizarInterpretacao`, `montarAnotacoes`, `conversar`, `conversa.interprete.pendentesNoContexto`, runner do `eval:llm` com checkpoints.
- Spec 009: `montarPergunta`, `continuar`, `aplicarResposta`.
- Spec 010: `montarPropostas` (`extras`), `ConteudoDaProposta`, `executarProposta`, `aprovar`, `acompanhanteV4`, recusa duradoura da lista.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/aprendizado/`:

- `entrega.eval.ts`: retornos, "já sugerido" e faltas gravados na entrega; nada em saída `segura`, de `codigo` ou run `failed`; "Tenho" durante o run tira a falta; mesma falta no mesmo dia conta uma vez; falha no meio não deixa metade.
- `retorno.eval.ts`: toque e conversa somam igual; segundo toque não soma; dois "não ajudou" mandam para o fim e um "ajudou" traz de volta; retorno de outra conta é recusado.
- `gosto.eval.ts`: `nao_gosta` tira o alimento do run seguinte; `gosta` sobe; limpar volta ao normal; gosto escrito vale no run, não grava sem aprovação e grava com.
- `troca.eval.ts`: substituto confirmado, na mesma função, com filtros e combinação respeitados; item a evitar agora não entra; trocar de novo não repete; teto de trocas; retorno atualizado; nenhuma chamada de modelo.
- `troca-pergunta.eval.ts`: sem confirmado, pergunta o incerto ou o nunca registrado; acabou não é perguntado; "Tenho" registra e troca; "Não tenho" grava falta e encerra; uma pergunta por toque.
- `nao-tenho.eval.ts`: acabou, falta `nao_tenho` e troca no mesmo toque; a falta conta para o "vale ter em casa".
- `resultado-registrar.eval.ts`: um caso por código de recusa e um aceito; o resultado gravado é o do Intérprete.
- `para-ter.eval.ts`: `para_ter` na saída gera a linha; aprovada grava e soma a métrica; recusada bloqueia o alimento; expirada não bloqueia.
- `privacidade.eval.ts`: os cenários não deixam nome de alimento, título nem texto da pessoa em span, métrica, log ou `resumo`.

Com LLM (⚠️ no `c2-conversa`), 8 casos do tipo `conversa`, em `evals/llm/casos/c2/aprendizado/` e `evals/llm/casos/c2/para-ter/`:

| # | Caso | Esperado |
|---|---|---|
| 1 | Momento, com dois "não ajudou" seguidos no chá mais adequado | O chá não é a primeira sugestão do tipo |
| 2 | Momento, com "não gosto" em um alimento adequado e em casa | O alimento não aparece |
| 3 | Momento, com "gosto" em um alimento adequado e em casa | O alimento aparece nas sugestões |
| 4 | "aquilo de ontem me fez bem, e agora tô com frio", dois pendentes | `resultado.registrar` chamada com o pendente certo; o texto reconhece em uma frase |
| 5 | "melhorei, e agora tô com frio", três pendentes sem pista | Nenhum registro; o texto aponta "Como ficou?" e não diz que anotou |
| 6 | Momento com candidato a "vale ter em casa" | `para_ter` preenchido; a frase fala das próximas vezes, sem marca, loja ou preço |
| 7 | Momento sem candidato | Sem `para_ter` e sem frase de compra |
| 8 | Incômodo, com faltas em 3 dias | Sem `para_ter` |

Métricas: **Aprendizado** e **Para ter em casa** (acerto), no formato das outras.

## Nível das partes

- **nucleo** (Sonnet): `registrarEntrega` e a chamada no `companion`; `trocarIngrediente` e `responderTroca`; `resultado.registrar` e o `ctx.run`; a mudança em `preparar` para o gosto da mensagem.
- `mecanica`: `config/toques.ts`, `tocarRetorno`, `tocarGosto`, textos, `propostaDoParaTer`, `atualizarSugestao` nos adaptadores e no contrato, acréscimos do Intérprete e das propostas, `acompanhante.v5`, cenários, `demo`, evals, casos do `c2`.

Os textos e o prompt são copiados desta spec; não há parte `conteudo`. A rodada ⚠️ do `c2-conversa` é do orquestrador.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `BUSINESS.md` §9 ("Trocar um ingrediente", "Gostos", "O que fez falta", "Vale ter em casa") e §10.
- `AI.md` §6 ("Ordenação" e "Faltas e vale ter em casa").
- `QA.md`, "Checkpoints" e "Registro da evolução".
- `OBSERVABILITY.md` §3, a tabela de métricas.

## Dependências

- Specs 002, 004, 005, 007, 008, 009 e 010.
- Nenhum pacote novo, nenhuma migração.
- `GEMINI_API_KEY` de desenvolvimento, para a rodada ⚠️ do `c2-conversa`.

## Riscos e trade-offs

- **Troca só com o que há em casa:** casa pouco preenchida dá muito "sem substituto". A pergunta da troca ajuda a preencher a casa e alimenta o "vale ter em casa".
- **A troca não refaz o texto:** a resposta escrita continua citando o ingrediente original; a sugestão mostra o substituto e a frase. Refazer o texto custaria uma chamada de modelo por toque.
- **Conferência da troca sem os dados do preparo:** usa o que o run guardou (`saida.evitar`) e o estado de agora. Uma contraindicação que dependia do clima do momento não é refeita.
- **Gosto escrito sem caminho próprio:** "adoro gengibre" sozinho gasta um run do Acompanhante.
- **Faltas gravadas antes da aprovação:** a resposta já foi entregue; a aprovação decide só as propostas.
- **Rodada do `c2` com três modelos:** menos reserva se a cota do dia acabar; o runner segue no dia seguinte.

## Edge cases e modos de falha

- Resposta sem sugestão (pergunta conceitual): nenhum retorno; as faltas ainda são gravadas se o preparo montou candidatos.
- Sugestão sem ingrediente (prática de respiração): retorno com `alimentos` vazio; não há o que trocar.
- A pessoa registrou o alimento em casa entre o preparo e a entrega (resposta "Tenho"): a falta não é gravada.
- Troca num run em `waiting_for_approval`: permitida; a saída é atualizada e as propostas não mudam.
- Dois toques de troca ao mesmo tempo no mesmo item: a transação lê a saída de novo; o segundo vê o primeiro e parte do id efetivo novo, ou devolve `toque_invalido` se o id tocado já saiu.
- Substituto perguntado deixa de valer entre a pergunta e a resposta (a pessoa marcou "não gosto"): `responderTroca` devolve `sem_substituto`.
- Toque "Não tenho" em alimento já marcado como acabou hoje: a falta do dia conta uma vez só.
- Retorno fechado pela conversa e depois tocado: o toque devolve o retorno como está.
- `resultado.registrar` e `finalizar` no mesmo passo: o registro entra antes da entrega (010, mudança na 005).
- "Gosto" escrito de alimento que está em "evitar sempre", restrição ou "não como": ignorado, sem anotação.
- "Gosto" escrito de alimento que tinha "não gosto": vale como gosto no run; aprovada a proposta, passa a `gosta`.
- `para_ter` na saída e o alimento entra na lista por outro caminho antes da aprovação: `porNaLista` não duplica.
- Falha ao gravar a entrega: a resposta chega à pessoa sem `retorno_id`; a etapa `erro` fica no rastro.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates verdes.
- Os seis cenários novos rodam no `demo` sem rede.
- ⚠️ `c2-conversa` rodado uma vez, com `evals/resultados/c2-conversa.md` e a coluna nova em `evals/COMPARACAO.md`.
- `.docs/` atualizado no fechamento: `BUSINESS.md` §9, `AI.md` §4 e §6, `ARCHITECTURE.md` §3 ("Rotas de toque"), `OBSERVABILITY.md` §3 (span `toque`), `QA.md` (evals de aprendizado).
- `AGENTS.md` com os cenários novos do `demo`.

## Arquivos e diretórios envolvidos

- `config/toques.ts`, `config/index.ts`
- `src/core/outcomes/`: `registrar-entrega.ts`, `ports.ts`
- `src/core/touches/`: `retorno.ts`, `gosto.ts`, `troca.ts`, `textos.ts`
- `src/core/agents/tools/resultado.ts`; `src/core/tools/tool.ts`
- `src/core/agents/prompts/acompanhante.v5.ts`
- `src/core/agents/companion/`: `saida.ts`, `contexto.ts`, `entrada.ts`, `preparo.ts`, `agente.ts`, `responder.ts`
- `src/core/agents/interpreter/`: `saida.ts`, `interpretacao.ts`; `src/core/agents/prompts/interprete.v1.ts`
- `src/core/proposals/`: `conteudo.ts`, `textos.ts`, `montar.ts`, `executor.ts`
- `src/core/conversation/`: `conversar.ts`, `aprovar.ts`
- `src/core/telemetry/nomes.ts`
- `src/infra/db/outcomes.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/container.ts`, `test/contracts/outcomes.contract.ts`
- `test/fixtures/cenarios/*.ts`, `scripts/demo.ts`, `scripts/lib/demo-report.ts`
- `evals/det/aprendizado/*.eval.ts`, `evals/llm/casos/c2/aprendizado/*.ts`, `evals/llm/casos/c2/para-ter/*.ts`
- `evals/resultados/c2-conversa.md`, `evals/COMPARACAO.md`
