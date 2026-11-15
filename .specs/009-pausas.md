---
title: Pausas
status: implemented
implemented: 94aa69b
entrega: 2
created: 2026-11-14
---

# Pausas

> Entrega a pergunta do Ritu à pessoa: a tool `ask_user`, com três tipos fechados de pergunta montados por código, a pausa do run em `waiting_for_input`, a retomada pelo `continuar`, a expiração, o limite de perguntas e a gravação imediata do que a pessoa responde sobre a casa e sobre o gosto. Inclui a pergunta da variante de um incômodo, feita por código antes do agente, e o `demo` com pausa no terminal.

## Contexto

Até a 008 o agente não pergunta: ingrediente ausente não entra, ingrediente incerto só entra com substituto pronto, e incômodo com variantes fica sem a variante. Isso deixa a resposta mais pobre justamente quando falta pouco para acertar ("ainda tem abóbora?"). A prova 3 de `AI.md` §1 é pedir ajuda só quando falta: perguntar quando a resposta muda a recomendação, e não perguntar quando já se sabe.

O mecanismo já existe: a 005 entregou o checkpoint, a pausa e o `continuarRun`. Falta a tool que pausa, as regras do que pode ser perguntado e o que acontece com a resposta.

## Objetivo

Depois desta spec, o Acompanhante pode pausar o run com uma pergunta sobre a casa ("Ainda tem abóbora e couve?", com Tenho · Não tenho · Não gosto por item) ou sobre um alimento ("Você come ovo?"); a pessoa responde em outro pedido e o run continua de onde parou, sem repetir chamadas de modelo; a resposta já fica gravada em Minha casa e nos gostos. Incômodo com variantes é perguntado por código, sem gastar modelo. Tudo isso roda no `demo`, roteirizado ou respondendo no terminal.

## Escopo

- **Dentro:**
  - Tool de controle `ask_user`, com os tipos `casa` e `come`, e as regras que recusam pergunta desnecessária.
  - Pergunta da variante do incômodo, por código, antes do loop.
  - Tipos `Pergunta` e `RespostaDaPessoa`; textos e rótulos das perguntas.
  - `continuar`: valida a resposta, grava o que ela diz, atualiza os dados do run e retoma.
  - Expiração da pergunta e limite de perguntas por run.
  - Gravação imediata: casa (tem, acabou), gosto ("não gosto") e falta `nao_tenho`.
  - Anotação `nao_come`.
  - Mensagens da pergunta e da resposta na conversa do dia.
  - Prompt `acompanhante.v3`.
  - Cenários do `demo` com pausa, modo `--interativo` e ⚠️ uma rodada com LLM.
  - Casos da família Perguntas para o `c2-conversa`.
- **Fora:**
  - Bloco de aprovação e `waiting_for_approval` (010). A anotação `nao_come` é só dado, como as da 008.
  - Faltas `teria_entrado`, retornos e toques fora de pergunta (011).
  - Juiz (013).
  - Rota `POST /api/runs/:id/continue` e os botões na tela (018). Aqui existe o serviço que a rota vai chamar.
  - Pergunta livre escrita pelo modelo: o produto não tem.

## Necessidade de negócio

A casa "não é a verdade absoluta" (`BUSINESS.md` §9): a comida acaba e a pessoa não avisa. Perguntar na hora certa é o que deixa a resposta usar o que ela de fato tem, e cada resposta dela melhora Minha casa sem ela precisar cadastrar nada. Quem chega com a casa vazia recebe uma pergunta em vez de uma resposta só com práticas.

## Critérios de aceite

- [x] **Pausa pelo agente:** roteiro `casa.ler` → `ask_user({ tipo: "casa", alimentos: ["abobora", "couve"] })` leva o run a `waiting_for_input`, com `pendencia` e `checkpoint` gravados, e `conversar` devolve `status: "waiting_for_input"` com a `pergunta` (texto e itens montados por código) e sem `saida`.
- [x] **Retomada:** `continuar` com Tenho para abóbora e Não tenho para couve retoma do checkpoint sem repetir chamada de modelo; o resultado da tool que o modelo recebe traz as duas respostas; a entrega com abóbora passa no validador e a com couve é recusada (`fora_de_casa`); o run termina em `done`.
- [x] **Gravação na hora:** depois desse `continuar`, e antes de o run terminar, a abóbora está em `casa` como `tem`, confirmada agora, com `origem: "pergunta"`; a couve está como `acabou` e há uma falta `nao_tenho` dela no dia, com o `run_id`; "Não gosto" grava `gosto: nao_gosta` e não mexe na casa; `ritu_gosto_total` e `ritu_faltas_total{origem: "nao_tenho"}` somam.
- [x] **Não gosto vale no run:** item respondido com Não gosto entra em `dados.filtro.nao_gosta`, e uma entrega com ele é recusada (`nao_gosta`).
- [x] **Pular:** `{ tipo: "pular" }`, ou item sem resposta, não grava nada; o item continua como estava e o modelo recebe `pulou`.
- [x] **Limite de perguntas:** a 3ª pergunta do run (contando a da variante) é recusada com `limite_de_perguntas`, o run não pausa e o loop continua.
- [x] **Recusas de `ask_user`:** cada código de "Contratos" tem um teste em que só ele é devolvido: mais de 5 itens, alimento fora da base, já confirmado, barrado pelo filtro da pessoa, marcado como acabou, fora dos candidatos, já perguntado neste run, `come` desnecessária.
- [x] **Variante por código:** mensagem com incômodo `dor-de-cabeca` sem variante pausa o run antes de qualquer chamada do papel `decisao`, com a pergunta e as opções de `incomodos.yaml`; `continuar` com `latejante` roda o preparo já com a variante e segue para o Acompanhante; com Pular, o preparo roda sem a variante e `precisa_variante` vai no contexto, como na 007.
- [x] **Incômodo de variante única ou com a variante já dita:** não há pausa.
- [x] **Expiração:** `continuar` mais de 30 minutos depois de a pergunta ser criada marca o run como `expired`, lança `RituError` com código `pergunta_expirada` e não grava nada. Com 30 minutos exatos, ainda vale.
- [x] **Resposta que não combina:** tipo diferente do da pergunta, alimento que não estava nela ou variante inexistente lança `resposta_invalida`; o run continua em `waiting_for_input` e nada é gravado.
- [x] `continuar` em run `done`, `expired`, `cancelled` ou de outra conta lança `RunNaoContinuavelError` e não muda nada.
- [x] **Mensagem nova com pergunta aberta:** o run antigo vira `cancelled` (005) e o que já foi respondido antes continua gravado.
- [x] **Mensagens:** o texto da pergunta é gravado como mensagem do agente e a resposta como mensagem da pessoa ("Tenho: abóbora · Não tenho: couve"), com o `run_id`; a pergunta da variante e a resposta dela nascem com `com_incomodo: true`.
- [x] **Rastro:** etapa `pergunta` com `resumo` `casa: 2 itens`, `come` ou `variante`; evento `pausa` com `pausa.tipo: "pergunta"`; `ritu_pausas_total` soma 1; o trecho retomado entra no mesmo trace. Nenhum span, métrica, log ou `resumo` leva nome de alimento, de incômodo ou texto da pessoa.
- [x] **Não como:** resposta "Não como" entra em `dados.filtro.nao_come`, vale no resto do run e sai na saída como anotação `nao_come`; nada vai para `perfis.nao_come`.
- [x] `npm run demo -- --cenario <nome>` roda os quatro cenários novos sem rede, respondendo com as `respostas` da fixture, e imprime a pergunta, a resposta dada e o resto do run; com `--interativo`, lê a resposta do terminal.
- [x] ⚠️ `npm run demo -- --cenario casa-incerta --llm --interativo` rodado uma vez pelo orquestrador (conferência anotada no relatório).

## O que fazer

- Escrever `montarPergunta`, `validarPedidoDePergunta`, `validarResposta`, `aplicarResposta` e `textoDaResposta` como funções puras, com TDD.
- Copiar os textos e as linhas do prompt de "Contratos" como estão.
- Gravar o que a pessoa respondeu **antes** de retomar o loop, numa transação: se o loop falhar depois, a casa e o gosto já estão certos.
- Conferir a expiração no próprio `continuar`, pelo relógio: a limpeza diária só varre o que sobrou.
- Atualizar `AI.md` §4 e §7, `BUSINESS.md` §9 e §12 e `KNOWLEDGE.md` §3.1 no fechamento, se algo divergir do que está escrito hoje.

## O que não fazer

- Não deixar texto do modelo virar pergunta: o modelo escolhe o tipo e os alimentos; o texto é de código.
- Não perguntar motivo, saúde, gestação, doença ou remédio, em nenhum tipo.
- Não perguntar sobre o que já está confirmado, sobre o que o filtro da pessoa barra, nem sobre o que ela disse que acabou.
- Não manter o run vivo esperando: a função retorna na pausa.
- Não contar o tempo de espera no timeout do trecho.
- Não gravar "Como" (resposta afirmativa do tipo `come`) em lugar nenhum.
- Não pôr nome de alimento ou de incômodo em `resumo` de etapa, span, métrica ou log.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Tipos de pergunta | Só três, fechados: `casa`, `come` e `variante`; texto montado por código | Decisão da dona. Nenhum texto do modelo chega à pessoa sem conferência, e ele não consegue perguntar sobre saúde |
| Quem pergunta a variante | O código, antes do agente | Decisão da dona. A base diz quando a pergunta é necessária; o preparo já roda com a variante certa e nenhuma chamada é gasta |
| Resposta sobre a casa | Gravada na hora, sem bloco de aprovação | Decisão da dona. O toque é o consentimento, como em "Não gosto" e "Ajudou" |
| Sobre quais alimentos perguntar | Qualquer ingrediente dos candidatos do run, incerto ou nunca registrado | Decisão da dona. A resposta acerta mais; o custo é perguntar mais vezes |
| Refeição com ingrediente obrigatório fora de casa | Vai ao modelo quando o ingrediente é perguntável (nunca registrado e ainda há pergunta disponível); no máximo 2 refeições assim por run. Sai quando a pessoa responde "Não tenho" e a vaga fica sem opção | Decisão da dona. Quem chega com a casa vazia recebe pergunta e refeição, e não só chá e prática. Candidato que nenhuma entrega pode usar continua fora |
| Item marcado como acabou | Não é perguntado | A pessoa acabou de dizer que não tem; quando comprar, ela conta |
| Pular | Toda pergunta tem "Pular"; na de casa, item sem resposta conta como pulado | Ninguém fica preso numa pergunta que não sabe ou não quer responder |
| Texto digitado com pergunta aberta | É mensagem nova: cancela o run em espera (005) | Uma regra só. O que já foi respondido fica gravado |
| "Não tenho" | Marca o item como acabou e grava a falta `nao_tenho` | `BUSINESS.md` §9: o toque "Não tenho" é uma falta |
| "Não como" | Vale no run e vira anotação para o bloco de aprovação; "Como" não é gravado | "Não como" é um fixo, e fixo só é guardado com aprovação (`BUSINESS.md` §11) |
| Limite | 2 perguntas por run, contando a da variante; até 5 alimentos por pergunta de casa | `AI.md` §4 |
| Pergunta recusada | Volta ao modelo como resultado da tool, com o código; conta no teto de recusas do loop (005) | Mesmo mecanismo de `finalizar`; o agente segue sem perguntar |
| Depois da resposta | O código atualiza `Checkpoint.dados` (casa e filtro) e o loop continua; o preparo não roda de novo | Os candidatos já estão no contexto; o modelo recebe a resposta como resultado da tool e o validador usa os dados atualizados |
| Onde fica a pausa de código | `runs.pendencia`, com a entrada do Acompanhante dentro; sem checkpoint | O loop ainda não começou; retomar é chamar `responder` com a variante |
| Expiração | 30 minutos (`memoria.esperaMinutos`), conferida no `continuar` | A limpeza é diária; a regra não pode depender dela |
| Pergunta e resposta na conversa | Gravadas como mensagens | A conversa do dia fica inteira na tela, e a mensagem seguinte tem o contexto |

## Contratos

### Cria

**Configuração (`config/pausas.ts`, em `config/index.ts`)**

```ts
export const pausas = { maxPerguntasPorRun: 2, maxItensPorPergunta: 5, maxRefeicoesAPerguntar: 2 } as const
```

O prazo de espera é `memoria.esperaMinutos` (004).

**Pergunta e resposta (`src/core/runs/pergunta.ts`)**

```ts
export type RespostaDeCasa = "tenho" | "nao_tenho" | "nao_gosto"
export type Pergunta =
  | { tipo: "casa"; texto: string; itens: { alimento_id: string; nome: string }[] }
  | { tipo: "come"; texto: string; alimento_id: string; nome: string }
  | { tipo: "variante"; texto: string; incomodo: string; opcoes: { id: string; texto: string }[] }
export type RespostaDaPessoa =
  | { tipo: "casa"; itens: { alimento_id: string; resposta: RespostaDeCasa }[] }     // item ausente da lista: pulou
  | { tipo: "come"; resposta: "como" | "nao_como" }
  | { tipo: "variante"; variante: string }
  | { tipo: "pular" }
export type ConteudoDaPendencia =                 // Pendencia.conteudo (005), com tipo "pergunta"
  | { origem: "agente"; pergunta: Pergunta }
  | { origem: "codigo"; pergunta: Pergunta; entrada: EntradaDoAcompanhante }
```

Schemas zod para os três. `validarResposta(pergunta, resposta)`: `pular` vale para qualquer pergunta; fora isso, o tipo tem que ser o mesmo, os `alimento_id` têm que estar na pergunta, sem repetir, e a `variante` tem que estar nas opções.

**Textos (`src/core/runs/pergunta-textos.ts`)**

| Chave | Texto |
|---|---|
| `casaAindaTem` | Ainda tem {itens}? |
| `casaVoceTem` | Você tem {itens} em casa? |
| `come` | Você come {item}? |
| Rótulos | `Tenho`, `Não tenho`, `Não gosto`, `Como`, `Não como`, `Pular` |

- `casaAindaTem` quando todos os itens estão incertos; com algum nunca registrado, `casaVoceTem`.
- `{itens}`: nomes da base em minúsculas, "a", "a e b", "a, b e c" (regra 1 de `preencherLacunas`, 007).
- Variante: o texto é o campo `pergunta` do incômodo e as opções são `opcao` de cada variante (002).

```ts
export function montarPergunta(p: { tipo: "casa"; alimentos: string[]; incertos: string[] } | { tipo: "come"; alimento: string }, kb: KnowledgeBase): Pergunta
export function perguntaDaVariante(precisa: NonNullable<MomentoQualidades["precisa_variante"]>): Pergunta
export function textoDaResposta(pergunta: Pergunta, resposta: RespostaDaPessoa): string
// casa: "Tenho: abóbora · Não tenho: couve · Não gosto: ovo"; só pulados: "Pular"
// come: "Como" | "Não como"; variante: o texto da opção; pular: "Pular"
```

**`ask_user` (`src/core/agents/tools/ask-user.ts`)**

```ts
export const askUser: ToolDeControle<{ tipo: "casa"; alimentos: string[] } | { tipo: "come"; alimento: string }>
// name: "ask_user"
// description: "Pergunta à pessoa se ela tem um alimento em casa (tipo casa, até 5 de uma vez) ou se come um alimento (tipo come). Use só quando a resposta muda o que você vai sugerir."
export function validarPedidoDePergunta(pedido, p: { dados: DadosDoPreparo; acabou: string[]; preferencias: Preferencia[]; kb: KnowledgeBase }): CodigoDeRecusa | undefined
```

`tratar`: lê `pantry.listar` e `preferences.ler` pelo `ToolContext`, chama `validarPedidoDePergunta` e:

- com código: `{ tipo: "recusar", resultado: { perguntou: false, motivo: <código>, alimentos?: [...] } }`;
- sem: soma em `dados.perguntas` e devolve `{ tipo: "pausar", pendencia: { tipo: "pergunta", conteudo: { origem: "agente", pergunta } } }`.

| Código | Recusa quando |
|---|---|
| `limite_de_perguntas` | `dados.perguntas.feitas` já é `maxPerguntasPorRun` |
| `muitos_itens` | Mais de `maxItensPorPergunta` alimentos, ou nenhum |
| `fora_da_base` | Algum id não existe em `kb.alimentos` |
| `ja_confirmado` | Algum alimento está em `dados.casa.confirmados` |
| `filtrado` | `passaNoFiltro` reprova algum (evitar sempre, restrição, "não como", "não gosto") |
| `acabou` | Algum está em Minha casa com `estado: acabou` |
| `fora_dos_candidatos` | Algum não é ingrediente nem opção de vaga de nenhum candidato de `dados.candidatos` |
| `ja_perguntado` | Algum está em `dados.perguntas.alimentos` |
| `come_desnecessaria` | Tipo `come` para alimento que está em casa (confirmado ou incerto) ou que tem "gosta" ou algum "ajudou" |

A ordem da tabela é a ordem de conferência; devolve o primeiro. `alimentos` lista os ids que causaram a recusa.

`aoRetomar(resposta, estado)` devolve o resultado da tool para o modelo:

```ts
// casa
{ respostas: { alimento_id: string; nome: string; resposta: RespostaDeCasa | "pulou" }[] }
// come
{ alimento_id: string; nome: string; resposta: "como" | "nao_como" | "pulou" }
```

`criarAcompanhante` passa a ter `controle: [finalizar, askUser]` e a usar `acompanhante.v3`.

**Dados do run (acréscimos a `DadosDoPreparo`, 007)**

```ts
perguntas: { feitas: number; alimentos: string[] }      // começa em { feitas: 0, alimentos: [] }; a pausa da variante entra com feitas: 1
nao_come_do_run: string[]                               // ids respondidos com "Não como"
```

**Candidatos que vão ao modelo (mudança na 007)**

`entregaveisEmCasa` passa a ser:

```ts
// src/core/agents/companion/preparo.ts
export function entregaveis(candidatos: Candidato[], p: { casa: Casa; acabou: string[]; perguntasRestantes: number }, kb: KnowledgeBase): Candidato[]
```

- Um alimento é **perguntável** quando não está em `casa.confirmados` nem em `casa.incertos`, não está em `acabou` e `perguntasRestantes > 0`.
- A refeição fica quando cada vaga obrigatória tem ao menos uma opção confirmada, incerta ou perguntável.
- A refeição que só fica por causa de opção perguntável leva `depende_de_pergunta: true` (campo novo de `Candidato`, no contexto do modelo). Ficam as `maxRefeicoesAPerguntar` primeiras pela ordem; as outras saem.
- `acabou` são os itens de Minha casa com `estado: acabou`; `perguntasRestantes` é `maxPerguntasPorRun − perguntas.feitas`.
- `faltasDoRun` e o candidato a "vale ter em casa" continuam calculados sobre a lista completa, que fica em `dados.candidatos_completos`.

No validador, `fora_de_casa` em item de candidato com `depende_de_pergunta` devolve a mensagem "pergunte antes com ask_user (tipo casa) ou use outro candidato"; sem pergunta disponível, "use outro candidato".

```ts
// src/core/runs/pergunta.ts
export function aplicarResposta(dados: DadosDoPreparo, pergunta: Pergunta, resposta: RespostaDaPessoa): DadosDoPreparo
```

| Resposta | Efeito em `dados` |
|---|---|
| `tenho` | Entra em `casa.confirmados`, sai de `casa.incertos`; o `casa` do item nos candidatos vira `confirmado` |
| `nao_tenho` | Sai de `casa.incertos`; o `casa` do item nos candidatos vira `ausente` |
| `nao_gosto` | Entra em `filtro.nao_gosta`; sai das duas listas de casa |
| `nao_come` | Entra em `filtro.nao_come` e em `nao_come_do_run` |
| `como`, `pulou`, `pular` | Nada |

Depois de aplicar as respostas, `aplicarResposta` roda `entregaveis` de novo sobre `dados.candidatos` (com o `nao_tenho` contando como `acabou`): a refeição que ficou sem opção numa vaga obrigatória sai, e o resultado da tool que volta ao modelo traz `candidatos_retirados: [ids]`.

**Gravação da resposta (`src/core/runs/gravar-resposta.ts`)**

```ts
export function gravarResposta(deps: { tx: Transactor; telemetry: Telemetry }, contaId: string, runId: string, dia: string, pergunta: Pergunta, resposta: RespostaDaPessoa): Promise<void>
```

Numa transação, só para pergunta de casa:

| Resposta | Grava |
|---|---|
| `tenho` | `pantry.registrar(…, "pergunta")` (que apaga as faltas do alimento e o tira da lista, 004) |
| `nao_tenho` | `pantry.marcarAcabou`; `shortages.registrar` com `origem: "nao_tenho"` e o `run_id`; `ritu_faltas_total{origem: "nao_tenho"}` |
| `nao_gosto` | `preferences.definirGosto(…, "nao_gosta")`; `ritu_gosto_total{gosto: "nao_gosta"}` |

`come` e `variante` não gravam nada fora do run.

**Anotação nova (`saida.ts`)**

```ts
| { tipo: "nao_come"; itens: { alimento_id: string; nome: string }[] }
```

`montarAnotacoes` (008) passa a receber `nao_come_do_run`.

**Serviço (`src/core/conversation/`)**

`RespostaDaConversa` (008) muda: `saida` passa a ser opcional e entra `pergunta?: Pergunta`. Com `status: "waiting_for_input"` vem a `pergunta` e não vem `saida`.

```ts
continuar(contaId: string, runId: string, resposta: RespostaDaPessoa, opts?: { aoVivo?: (e: EventoAoVivo) => void }): Promise<RespostaDaConversa>
```

Mudanças em `conversar` (008), no caminho `acompanhante`:

- **Antes de `responder`:** se a interpretação traz incômodo sem variante e `qualidadesDoMomento` devolve `precisa_variante`, o código grava a etapa `pergunta` (`nome: "variante"`), emite o evento `pausa`, grava a mensagem do agente com o texto da pergunta (`com_incomodo: true`), marca a mensagem da pessoa com `marcarIncomodoDoRun` e leva o run a `waiting_for_input`, com `pendencia` de origem `codigo` e a entrada dentro. Não chama o Acompanhante.
- **Fim `pausa` do loop:** grava a mensagem do agente com o texto da pergunta e devolve `waiting_for_input`. O retorno ligado e o caminho já foram gravados antes; as anotações só entram na saída final.

Ordem de `continuar`:

1. Busca o run. Fora de `waiting_for_input`, ou de outra conta: `RunNaoContinuavelError`. A saída de `waiting_for_input` é feita com `runs.mudarStatusSe` (010): com duas chamadas ao mesmo tempo, só uma segue.
2. `pendencia.criada_em` há mais de `esperaMinutos`: run `expired`, erro `pergunta_expirada`.
3. `validarResposta`; inválida: erro `resposta_invalida`, sem mudar nada.
4. `gravarResposta`. Grava a mensagem da pessoa (`textoDaResposta`; `com_incomodo: true` na da variante).
5. Origem `agente`: `aplicarResposta` no `checkpoint.dados`, `companion.continuar` (que chama `continuarRun` da 005 com o resultado de `aoRetomar`). Origem `codigo`: põe a variante na entrada (com Pular, deixa sem) e chama `companion.responder` com `opts.run` e `perguntas.feitas: 1`.
6. Pelo fim: outra pausa devolve a nova pergunta; os demais seguem os passos 6 a 8 de `conversar` (008), com as anotações, incluindo `nao_come`.

`createCompanion` (007) ganha `continuar(contaId, run, resposta, opts)` e `responder` passa a tratar o fim `pausa` (devolve o run em espera, sem saída). O serviço de runs ganha `pausarSemAgente(contaId, runId, pendencia)` para a pausa de código.

**Prompt `acompanhante.v3` (`src/core/agents/prompts/acompanhante.v3.ts`)**

Cópia de `acompanhante.v2` com `versao: "acompanhante.v3"` e uma troca em "O QUE VALE SEMPRE".

A linha que começa com "- Ingrediente:" é substituída por estas cinco:

```text
- Ingrediente: só o que está "confirmado" em casa. Para usar um que está "incerto" ou "ausente", pergunte antes com ask_user (tipo casa) e só use se a resposta for "tenho". Sem perguntar, "incerto" só entra com se_faltar preenchido por um substituto confirmado em casa (ayurveda.substitutos), e "ausente" não entra.
- ask_user: no máximo 2 perguntas, e só quando a resposta muda o que você vai sugerir. Se já dá para sugerir bem com o que está confirmado, não pergunte. Junte até 5 alimentos numa pergunta só. Só pergunte sobre ingrediente dos candidatos. Nunca pergunte sobre o que já está confirmado nem sobre o que está em evitar_sempre, restrições, "não como" ou "não gosto".
- Candidato com depende_de_pergunta: só entregue depois de um "tenho" para o ingrediente que falta. Se a pergunta não couber, use outro candidato.
- ask_user tipo come: só quando um alimento de origem animal entraria na sugestão e nada no contexto diz se a pessoa come.
- Depois da resposta: "tenho" pode entrar; "nao_tenho", "nao_gosto" e "nao_come" não entram; "pulou" fica como estava. Não comente a resposta: use.
```

**Cenários (`test/fixtures/cenarios/`)**

`Cenario` ganha `respostas?: RespostaDaPessoa[]`, usadas na ordem a cada pausa.

| Cenário | Mostra | Roteiro |
|---|---|---|
| `casa-incerta` | Abóbora e couve incertas; a pessoa tem uma e não tem a outra | `casa.ler` → `ask_user` casa → (Tenho, Não tenho) → `finalizar` com a abóbora |
| `casa-vazia` | Primeira conversa, nada em Minha casa | `casa.ler` → `ask_user` casa com 5 itens, entre eles os de uma refeição com `depende_de_pergunta` → (três Tenho, um Não gosto, um pulado) → `finalizar` com a refeição feita do que ela tem |
| `dor-de-cabeca` | "tô com dor de cabeça, o que como no almoço?" | Pausa de código → (`latejante`) → `clima.agora` → `finalizar` com o aviso de incômodo |
| `pergunta-recusada` | O agente tenta perguntar sobre item já confirmado | `ask_user` (recusada) → `finalizar` |

`scripts/demo.ts`: a cada pausa imprime a pergunta com as opções numeradas e a resposta usada. `--interativo` lê do terminal (`node:readline`): na de casa, uma letra por item (`t`, `n`, `g` ou Enter para pular); nas outras, o número da opção ou Enter para pular.

### Usa

- Spec 002: `KnowledgeBase`, `passaNoFiltro`, `qualidadesDoMomento`, `MomentoQualidades`, `Incomodo`.
- Spec 004: `PantryStore` (`listar`, `registrar`, `marcarAcabou`), `PreferenceStore` (`ler`, `definirGosto`), `ShortageStore.registrar`, `MessageRepository`, `Transactor`, `memoria.esperaMinutos`, `diaLocal`.
- Spec 005: `ToolDeControle`, `ResultadoDeControle`, `Pendencia`, `Checkpoint`, `continuarRun`, `RunNaoContinuavelError`, estados do run, evento `pausa`, etapa `pergunta`, `ritu_pausas_total`.
- Spec 007: `DadosDoPreparo`, `Candidato`, `criarAcompanhante`, `finalizar`, validador, `createCompanion`, `preencherLacunas`, `Cenario`.
- Spec 008: `conversar`, `RespostaDaConversa`, `Anotacao`, `montarAnotacoes`, `acompanhanteV2`, `EntradaDoAcompanhante` com os acréscimos, runner de evals com o tipo `conversa`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/pausas/`:

- `pausa-casa.eval.ts`: pausa, retomada sem repetir chamadas, resultado da tool com as respostas, validador com os dados atualizados.
- `gravacao.eval.ts`: Tenho, Não tenho e Não gosto gravam o esperado na hora; Pular e item sem resposta não gravam; registrar em casa apaga as faltas do alimento.
- `recusas.eval.ts`: um caso por código, e um pedido limpo.
- `entregaveis.eval.ts`: casa vazia leva ao modelo no máximo 2 refeições, com `depende_de_pergunta`; item com `acabou` não segura refeição; sem pergunta disponível, nenhuma refeição perguntável; "Não tenho" para a única opção tira a refeição e avisa em `candidatos_retirados`; as faltas seguem contadas sobre a lista completa.
- `limite.eval.ts`: 3ª pergunta recusada; a da variante conta; mais de 5 itens recusado.
- `variante.eval.ts`: pausa sem chamada de `decisao`; cada variante dá candidatos diferentes; Pular segue com `precisa_variante`; variante única não pausa.
- `expiracao.eval.ts`: 30 minutos vale, 31 expira; resposta a run expirado não grava; mensagem nova cancela a espera.
- `resposta-invalida.eval.ts`: tipo trocado, alimento fora da pergunta, variante inexistente, outra conta.
- `nao-come.eval.ts`: filtra no run, sai como anotação, não vai para o perfil.
- `mensagens.eval.ts`: pergunta e resposta gravadas; as da variante com `com_incomodo` e apagadas na limpeza do dia seguinte, mesmo com o run expirado.
- `privacidade.eval.ts`: os quatro cenários não deixam nome de alimento, de incômodo nem texto da pessoa em span, métrica, log ou `resumo`.

Com LLM (⚠️ no `c2-conversa`), 8 casos do tipo `conversa` em `evals/llm/casos/c2/perguntas/`:

| # | Caso | Esperado |
|---|---|---|
| 1 | Momento com frio; os melhores candidatos só têm itens incertos | Pergunta de casa (necessária) |
| 2 | Momento com frio; casa cheia e confirmada | Nenhuma pergunta |
| 3 | Momento; Minha casa vazia | Pergunta de casa, com até 5 itens |
| 4 | "Manga é boa para Pitta?" | Nenhuma pergunta |
| 5 | Como o 1, respondendo Não tenho a tudo | Entrega sem os itens; nenhuma segunda pergunta sobre os mesmos |
| 6 | Como o 1, respondendo Não gosto a um item | O item não aparece em sugestão nem no texto |
| 7 | Item de "evitar sempre" entre os que serviriam | Nunca perguntado |
| 8 | "Tô com dor de cabeça", respondendo `latejante` | Pausa sem chamada de `decisao`; sugestão que refresca; aviso de incômodo |

Métricas: perguntas necessárias feitas (casos 1 e 3), desnecessárias evitadas (2, 4 e 7), perguntas recusadas pelo código por run.

## Nível das partes

- **nucleo** (Sonnet): `ask_user`, `continuar`, a pausa de código em `conversar`, `companion.continuar`, o fim `pausa` em `responder`, `pausarSemAgente`, `gravarResposta`.
- `mecanica`: `config/pausas.ts`, schemas, textos, `montarPergunta`, `validarPedidoDePergunta`, `validarResposta`, `aplicarResposta`, `textoDaResposta`, `acompanhante.v3`, cenários, `demo` (pausa e `--interativo`), evals, casos do `c2`.

Os textos e o prompt são copiados desta spec; não há parte `conteudo`.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `AI.md` §4 ("Controle") e §7.
- `BUSINESS.md` §8 ("Fluxo de uma mensagem", item 3) e §9 ("Minha casa" e "O que fez falta").
- `KNOWLEDGE.md` §3.1.
- `OBSERVABILITY.md` §3, a linha `pausa` da árvore.

## Dependências

- Specs 002, 004, 005, 007 e 008.
- Nenhum pacote novo, nenhuma migração.
- `GEMINI_API_KEY` de desenvolvimento, só para a rodada ⚠️ do `demo`.

## Riscos e trade-offs

- **Perguntar sobre qualquer candidato pode cansar.** O limite de 2, a recusa do que já se sabe e a linha do prompt seguram; o `c2` mede as desnecessárias. Se passar do ponto, o ajuste é restringir `fora_dos_candidatos` aos primeiros de cada tipo.
- **"Como" não é guardado:** a mesma pergunta pode voltar outro dia. A recusa `come_desnecessaria` cobre quem já tem o alimento ou já gostou dele.
- **Resposta gravada e run que falha depois:** a casa fica atualizada e a pessoa recebe a resposta segura. É o certo: o que ela disse continua valendo.
- **Recusa de pergunta gasta do teto de recusas do loop.** Um modelo que insiste em perguntar errado chega mais cedo à resposta segura.
- **Preparo não roda de novo depois da resposta:** a ordem dos candidatos no contexto fica a de antes. O modelo recebe as respostas e o validador confere.
- **A entrada do Acompanhante fica em `runs.pendencia` na pausa de código**, com o texto da pessoa. É banco, não telemetria, e some com o run expirado na anonimização e no "apagar meus dados" (004).

## Edge cases e modos de falha

- `ask_user` e `finalizar` no mesmo passo: vale a primeira (005); a outra recebe `{ ignorada: true }`.
- Duas perguntas de casa no mesmo run com itens diferentes: permitido, até o limite.
- Pergunta de casa em que a pessoa responde só parte: o resto conta como pulado.
- Tenho para alimento que caiu em "evitar sempre" entre a pergunta e a resposta: é gravado em casa e continua fora das sugestões.
- `continuar` chamado duas vezes ao mesmo tempo: a segunda encontra o run em `running` e recebe `RunNaoContinuavelError`; `gravarResposta` roda depois da troca de estado, então não grava duas vezes.
- Falha em `gravarResposta`: o erro sobe, o run continua em `waiting_for_input` e a pessoa pode responder de novo.
- Sem modelo para `decisao` na retomada: resposta sem modelo, como na 007; o que foi respondido fica gravado.
- Pausa de código e, depois, o agente pergunta sobre a casa: permitido (é a 2ª). Uma terceira é recusada.
- Só atalhos nunca pausam por variante: atalho não traz incômodo.
- Run expirado pela limpeza antes de a pessoa responder: `continuar` recebe `RunNaoContinuavelError`.
- Alimento perguntado que a pessoa registra pela tela durante a espera: a resposta dela na pergunta vale por último.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes.
- Os quatro cenários novos rodam no `demo` sem rede; ⚠️ a rodada com LLM em `casa-incerta` está anotada no relatório da entrega.
- `AI.md`, `BUSINESS.md` e `KNOWLEDGE.md` batem com o que foi construído; ADR do formato do checkpoint (005 e 009) escrita; `ROADMAP.md` §0 atualizado.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `config/pausas.ts`, `config/index.ts`
- `src/core/runs/`: `pergunta.ts`, `pergunta-textos.ts`, `gravar-resposta.ts`, `run-service.ts`
- `src/core/agents/tools/ask-user.ts`
- `src/core/agents/prompts/acompanhante.v3.ts`
- `src/core/agents/companion/`: `preparo.ts`, `saida.ts`, `agente.ts`, `responder.ts`
- `src/core/conversation/conversar.ts`
- `test/fixtures/cenarios/*.ts`, `scripts/demo.ts`, `scripts/lib/demo-report.ts`
- `evals/det/pausas/*.eval.ts`, `evals/llm/casos/c2/perguntas/*.ts`
