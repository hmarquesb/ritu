---
title: Aprovação
status: implemented
implemented: 6ad518f
entrega: 2
created: 2026-11-14
---

# Aprovação

> Entrega o caminho de toda escrita na memória da pessoa: as propostas (as que o código monta a partir da mensagem e as que o agente faz com `memoria.propor` e `lista.propor`), o bloco "Posso anotar isto?", o run em `waiting_for_approval`, a aprovação parcial, a expiração e o executor em código, que é o único que grava. Inclui restrição e "não como" ditos na conversa, valendo na mesma resposta.

## Contexto

A 008 e a 009 já sabem o que a pessoa contou (comprou, acabou, não pode comer, não come) e deixam isso como anotação na saída, sem gravar. Falta fechar o ciclo: mostrar à pessoa o que o Ritu quer guardar, deixar que ela escolha linha por linha, e gravar só o que ela aprovou. É a prova 4 de `AI.md` §1 e a regra inegociável 4: o agente só escreve por proposta aprovada, e quem grava é um executor em código.

## Objetivo

Depois desta spec, toda resposta que tem algo a guardar termina com o bloco "Posso anotar isto?", com uma linha por assunto. A resposta do agente chega antes e não depende do bloco. "Anotar" grava só as linhas ligadas; "Agora não" não grava nada; 30 minutos sem resposta, ou uma mensagem nova, encerram o bloco sem gravar. Um run com propostas que não é aprovado deixa o banco igual.

## Escopo

- **Dentro:**
  - Tools de proposta do agente: `memoria.propor` (nota de rotina) e `lista.propor` (algo que faltou hoje), com as regras que recusam.
  - Montagem das propostas: das anotações (008 e 009) e das chamadas do agente; ordem, teto de linhas e texto de cada linha.
  - `waiting_for_approval`, pendência de aprovação e o serviço `aprovar`.
  - Executor em código, com lista fechada do que pode ser gravado.
  - Aprovação parcial, "Agora não", expiração e recusa duradoura da lista.
  - Restrição e "não como" vindos da conversa: campos do Intérprete (já na 008), temporário do dia e filtro no mesmo run.
  - Prompt `acompanhante.v4`.
  - `demo` com o bloco no terminal, cenários novos e ⚠️ uma rodada com LLM.
  - Casos da família Propostas para o `c2-conversa`.
- **Fora:**
  - Proposta de lista do "vale ter em casa" (`para_ter`), criação de retornos e gravação das faltas do run (011). Esta spec entrega o mecanismo e a regra da recusa.
  - Compactar o resumo de rotina, teto de notas e padrões no bloco (012).
  - Juiz (013). Ele confere a saída, inclusive as propostas, antes do bloco.
  - Rota `POST /api/runs/:id/approve` e o bloco na tela (018).
  - Editar e apagar pela tela (019 e 020), que não passam por proposta.

## Necessidade de negócio

"Nada escondido" (`BUSINESS.md` §2): a pessoa vê o que vai ser guardado antes de ser guardado, e decide. Sem isso, a memória do Ritu seria algo que acontece com ela, e não algo que ela controla. E a resposta não pode ficar refém do bloco: valor primeiro, anotação depois.

## Critérios de aceite

- [x] **Zero escrita sem aprovação:** rodar cada cenário que gera propostas e não aprovar deixa `perfis`, `casa`, `rotina_notas` e `lista_ter_em_casa` iguais ao estado anterior (comparação tabela a tabela nos stores em memória).
- [x] **Bloco:** run com anotações ou propostas do agente termina em `waiting_for_approval`, com `saida.propostas` (id, tipo e texto de cada linha), uma linha em `propostas` por proposta, com `decisao: "pendente"`, pendência de tipo `aprovacao`, uma etapa `proposta` por linha e o evento `pausa` com `pausa.tipo: "aprovacao"`. Run sem nada a propor termina em `done`.
- [x] **A resposta vem antes:** nesses runs, `saida.resposta` e as sugestões já estão gravadas e devolvidas antes de qualquer aprovação.
- [x] **Uma linha por assunto:** "comprei abóbora, couve e arroz" gera uma proposta só, com os três itens; os textos das linhas são os de "Contratos".
- [x] **Aprovação parcial:** `aprovar` com uma de três linhas grava só essa; as outras ficam `recusada`; o run vai a `done`; a etapa `aprovacao` tem `resumo` `1 de 3`; o span `aprovacao.execucao` leva `propostas.total` e `propostas.aprovadas`; `ritu_propostas_total{tool, decisao}` soma por linha.
- [x] **Agora não:** `aprovar` com lista vazia marca todas como `recusada`, não grava nada e encerra o run em `done`.
- [x] **Executor:** cada tipo de proposta grava exatamente o da tabela de "Contratos" (casa tem, casa acabou, evitar sempre, restrição, "não como", rotina, lista), numa transação só. Conteúdo fora do schema, ou com qualquer operação que não seja acrescentar, não é executado: a linha fica `recusada` e o run ganha uma etapa `erro` de nome `proposta_invalida`.
- [x] **Expiração:** `aprovar` mais de 30 minutos depois de o bloco ser criado marca o run como `expired` e as propostas como `expirada`, lança `aprovacao_expirada` e não grava nada. Mensagem nova com bloco aberto leva o run a `done` e as propostas a `expirada` (005).
- [x] **Expirada não é recusa:** proposta de lista expirada não entra em `proposals.recusadas`; recusada, entra.
- [x] `aprovar` com id que não é do run, ou em run de outra conta, lança erro (`aprovacao_invalida` ou `RunNaoContinuavelError`) e não muda nada. `aprovar` duas vezes, em seguida ou ao mesmo tempo: só uma grava; a outra lança `RunNaoContinuavelError` e nada é gravado de novo (teste no fake e em `test:db`, com duas chamadas simultâneas).
- [x] **`memoria.propor`:** com `fato_de_rotina` nos dados, devolve `{ proposto: true }` e a nota entra no bloco com o texto do fato; cada código de recusa de "Contratos" tem um teste.
- [x] **`lista.propor`:** só é aceita para alimento respondido com "Não tenho" neste run; cada código de recusa tem um teste; a linha traz o nome da sugestão a que ele faltou.
- [x] **Proposta e `finalizar` no mesmo passo:** chamadas nessa ordem, a proposta entra no bloco.
- [x] **Restrição no mesmo run:** com `restricoes_da_mensagem: ["vegetariana"]`, o preparo não devolve candidato com alimento que a restrição barra; o item fica no temporário do dia e continua filtrando numa segunda mensagem do mesmo dia sem aprovação; no dia seguinte, depois da limpeza, deixa de filtrar. O mesmo para `nao_come_da_mensagem`. Aprovadas, vão para `perfis.restricoes` e `perfis.nao_come`.
- [x] **Teto de linhas:** com mais de 6 propostas, ficam as 6 primeiras pela ordem de "Contratos"; as outras não são criadas.
- [x] **Nada duplicado:** item que já está no perfil, alimento que já está na lista e fato igual a uma nota ativa não geram linha.
- [x] **Incômodo fora das propostas:** run com incômodo não aceita `memoria.propor` nem `lista.propor`; fato de rotina que contém palavra de `incomodos.yaml` é recusado.
- [x] **Rastro e privacidade:** `resumo` das etapas `proposta` e `aprovacao` só tem tipo e contagem; nenhum span, métrica ou log leva nome de alimento, texto de nota ou texto da pessoa.
- [x] `npm run demo -- --cenario <nome>` roda os quatro cenários novos sem rede, imprime o bloco, a decisão da fixture e o que foi gravado; com `--interativo`, lê do terminal as linhas a desligar.
- [x] ⚠️ `npm run demo -- --cenario aprovacao-parcial --llm --interativo` rodado uma vez pelo orquestrador (conferência anotada no relatório).

## O que fazer

- Escrever `montarPropostas`, `textoDaProposta`, os validadores dos pedidos de proposta e o executor como funções puras ou com as portas injetadas, com TDD. O executor é uma tabela de `tipo → gravação`, sem caso genérico.
- Fazer das tools de proposta tools comuns que **nunca gravam**: validam e devolvem `{ proposto, proposta }`. `finalizar` lê as aceitas de `estado.mensagens`, como já faz com o clima (007).
- Rodar toda a aprovação numa transação: ou grava tudo o que foi aprovado e fecha o run, ou não muda nada.
- Conferir a expiração no próprio `aprovar`, pelo relógio.
- Atualizar `AI.md` §3, §4, §5 e §6 e `BUSINESS.md` §8, §9 e §11 no fechamento, se algo divergir do que está escrito hoje.

## O que não fazer

- Não gravar nada da memória da pessoa fora do executor, com as exceções já definidas: toques e respostas a perguntas (009), retorno contado na conversa (008) e os temporários do dia.
- Não deixar o modelo escrever o texto de uma linha do bloco: a linha é montada por código; a nota de rotina é a frase do Intérprete.
- Não aceitar no executor remoção, troca ou qualquer conteúdo fora dos schemas. Tirar algo de "evitar sempre" é só pelo Perfil.
- Não segurar a resposta do agente até a aprovação.
- Não contar proposta expirada como recusa.
- Não propor nada em run de `alerta`, `fora`, `ofensa` ou `ajuda`, nem com incômodo.
- Não falar em comprar para resolver o momento, nem em marca, loja ou preço.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Restrição e "não como" na conversa | O Intérprete extrai; valem na mesma resposta e até o fim do dia; o código monta a proposta de fixo | Decisão da dona. "Sou vegetariana, o que eu como?" não pode receber carne |
| `casa.propor` como tool do agente | Sai do catálogo; proposta de casa vem só do código | Decisão da dona. O Intérprete já extrai os itens e as respostas a perguntas são gravadas na hora |
| "Faltou hoje" | No máximo uma por resposta, só para alimento respondido com "Não tenho" no run, e nunca quando há candidato a "vale ter em casa" | Decisão da dona. A lista não vira lista de compras |
| Linhas do bloco | Uma por assunto, com os itens juntos | Decisão da dona. Bloco curto; item errado se corrige em Minha casa |
| Como o agente propõe | Tools `memoria.propor` e `lista.propor`, que só validam; `finalizar` recolhe as aceitas | Proposta aparece no rastro como passo do agente, e uma recusa volta ao modelo sem gastar do teto de entregas recusadas |
| Texto da nota de rotina | A frase `fato_de_rotina` do Intérprete; o agente só decide se propõe | Nenhum texto do Acompanhante vai para o bloco; o agente não inventa fato |
| Recusa da lista | Vale para sempre e para os dois motivos: alimento com proposta de lista recusada não é proposto de novo nem indicado como "vale ter em casa" | A 007 já lê `recusadas("lista.propor")`; uma regra só |
| Recusa dos outros tipos | Não tem efeito depois | A pessoa pode contar de novo; "evitar sempre", restrição e "não como" recusados deixam de valer no dia seguinte (`BUSINESS.md` §11) |
| "Anotar" com tudo desligado | Igual a "Agora não" | Uma regra só |
| Teto do bloco | 6 linhas, na ordem: evitar sempre, restrição, "não como", casa tem, casa acabou, lista, rotina | O que é filtro de segurança vem primeiro; bloco longo no celular não é lido |
| Tipo da proposta | Coluna `propostas.tool` com `casa.propor`, `memoria.propor` ou `lista.propor`, mesmo quando quem montou foi o código | É o rótulo da métrica e da consulta de recusadas |
| Texto da linha | Montado na leitura, a partir do conteúdo | Nada de texto pronto no banco; mudar a redação não exige migração |
| Temporário do dia | A tabela `evitar_temporario` passa a guardar também restrição e "não como" | Mesma regra de "vale hoje, guarda se aprovar", sem tabela nova |
| "Não como" respondido numa pergunta (009) | Também entra no temporário do dia | Coerente com o que vem da mensagem |
| Aprovação com falha no meio | A transação desfaz tudo; o run continua em espera | A pessoa pode tentar de novo; nunca fica meio gravado |
| Caminhos de código | `casa` e `evitar` também terminam em `waiting_for_approval` | É o mesmo bloco, venha a anotação de onde vier |
| Duas aprovações ao mesmo tempo | Troca de status condicional como primeira operação da transação | Dois toques seguidos em "Anotar" não podem gravar duas vezes |
| Candidatos de `lista.propor` | A lista completa do preparo, e não só a que foi ao modelo | O alimento respondido com "Não tenho" pode ter tirado a refeição da lista do modelo; a falta continua sendo dela |

## Contratos

### Cria

**Configuração (`config/aprovacao.ts`, em `config/index.ts`)**

```ts
export const aprovacao = { maxLinhas: 6, maxFaltouHoje: 1 } as const
```

O prazo é `memoria.esperaMinutos` (004).

**Conteúdo das propostas (`src/core/proposals/conteudo.ts`)**

```ts
export type TipoDeProposta = "casa.propor" | "memoria.propor" | "lista.propor"
export type ConteudoDaProposta =
  | { tool: "casa.propor"; acao: "tem" | "acabou"; itens: { alimento_id?: string; nome: string }[] }
  | { tool: "memoria.propor"; tipo: "evitar_sempre"; itens: EvitarItem[] }
  | { tool: "memoria.propor"; tipo: "restricao"; itens: Restricao[] }
  | { tool: "memoria.propor"; tipo: "nao_come"; itens: { alimento_id?: string; nome: string }[] }
  | { tool: "memoria.propor"; tipo: "gosta"; itens: { alimento_id: string; nome: string }[] }
  | { tool: "memoria.propor"; tipo: "rotina"; texto: string }                       // até 200
  | { tool: "lista.propor"; alimento_id: string; motivo: "faltou_hoje" | "fez_falta"; detalhe: string }
export type PropostaNaSaida = { id: string; tool: TipoDeProposta; texto: string }
```

Schema zod estrito para cada variante (campo a mais é recusado). `propostas.conteudo` (004) guarda o objeto sem o campo `tool`, que vai na coluna.

**Textos (`src/core/proposals/textos.ts`)**

| Proposta | Linha |
|---|---|
| Casa, tem | Você tem {itens} em casa |
| Casa, acabou | Acabou: {itens} |
| Evitar sempre | Não sugerir mais {itens} (Evitar sempre) |
| Restrição | Sua alimentação é {itens} |
| Não como | Você não come {itens} |
| Gosta | Você gosta de {itens} |
| Rotina | A frase, com a primeira letra maiúscula |
| Lista, faltou hoje | {Item} na lista "Para ter em casa" (faltou para {detalhe}) |
| Lista, fez falta | {Item} na lista "Para ter em casa" (já fez falta {detalhe} vezes) |
| Cabeçalho e botões | `Posso anotar isto?`, `Agora não`, `Anotar` |

`{itens}` segue a regra da 008 (nomes em minúsculas, "a", "a e b", "a, b e c"; restrições pelos rótulos). `{detalhe}` do "faltou hoje" é o nome do candidato, com a primeira letra minúscula.

```ts
export function textoDaProposta(c: ConteudoDaProposta, kb: KnowledgeBase): string
```

**Tools de proposta (`src/core/agents/tools/propostas.ts`)**

```ts
export const memoriaPropor: Tool<{ tipo: "rotina" }, ResultadoDeProposta>
// description: "Propõe guardar o fato_de_rotina do contexto como nota de rotina. Só grava se a pessoa aprovar."
export const listaPropor: Tool<{ alimento_id: string; pratica_id?: string; preparo_id?: string }, ResultadoDeProposta>
// description: "Propõe pôr na lista Para ter em casa um alimento que a pessoa respondeu que não tem e que faltou para uma sugestão. Só grava se a pessoa aprovar."
export type ResultadoDeProposta = { proposto: true; proposta: ConteudoDaProposta } | { proposto: false; motivo: CodigoDeRecusaDeProposta }
```

As duas leem `ctx.run`, que o `responder` monta a partir de `Checkpoint.dados` a cada trecho:

```ts
// acréscimo ao ToolContext
run: {
  fato_de_rotina?: string; com_incomodo: boolean; tem_para_ter: boolean
  nao_tem: string[]                                   // respondidos com "Não tenho" neste run
  candidatos: { tipo: TipoDeSugestao; id: string; nome: string; alimentos: string[] }[]   // lista completa do preparo, antes de `entregaveis` (009) e das retiradas por resposta
  na_lista: string[]; lista_recusada: string[]; notas_ativas: string[]
}
```

| Tool | Código | Recusa quando |
|---|---|---|
| as duas | `com_incomodo` | O run tem incômodo |
| `memoria.propor` | `sem_fato` | Não há `fato_de_rotina` |
| `memoria.propor` | `fato_com_incomodo` | O fato, normalizado, contém alguma das `palavras` de um incômodo da base |
| `memoria.propor` | `ja_anotado` | O fato, normalizado, é igual a uma nota ativa |
| `lista.propor` | `fora_da_base` | O alimento não existe |
| `lista.propor` | `sem_nao_tenho` | O alimento não está em `nao_tem` |
| `lista.propor` | `com_para_ter` | `tem_para_ter` |
| `lista.propor` | `fora_do_candidato` | Sem `pratica_id` nem `preparo_id`, com os dois, ou o candidato indicado não usa o alimento |
| `lista.propor` | `ja_na_lista` | O alimento está em `na_lista` |
| `lista.propor` | `ja_recusado` | O alimento está em `lista_recusada` |
| `lista.propor` | `filtrado` | `passaNoFiltro` reprova o alimento |

A etapa de cada chamada é do tipo `tool` (005), com `resumir` devolvendo `proposto` ou `recusado: <código>`.

`criarAcompanhante` passa a ter `tools: [...climaTools, ...memoriaTools, ...ayurvedaTools, memoriaPropor, listaPropor]` e a usar `acompanhante.v4`.

**Recolher e montar (`src/core/proposals/montar.ts`)**

```ts
export function propostasDoAgente(mensagens: MensagemDoLoop[]): ConteudoDaProposta[]
// resultados de memoria.propor e lista.propor com proposto: true, na ordem; nota repetida conta uma vez; de lista.propor, só a primeira (maxFaltouHoje)
export function montarPropostas(p: { anotacoes: Anotacao[]; doAgente: ConteudoDaProposta[]; extras?: ConteudoDaProposta[] }): ConteudoDaProposta[]
```

- Cada anotação vira uma proposta: `casa_tem` e `casa_acabou` → `casa.propor`; `evitar_sempre`, `restricao` e `nao_come` → `memoria.propor` do tipo correspondente.
- `extras` é por onde a 011 entrega a proposta do `para_ter` (`propostaDoParaTer`). Em `aprovar`, cada proposta de lista com motivo `fez_falta` soma `ritu_para_ter_total{etapa: "aprovada" | "recusada"}`.
- A anotação `gosta` (011) vira `memoria.propor` do tipo `gosta`.
- Ordem: evitar sempre, restrição, não como, gosta, casa tem, casa acabou, lista, rotina. Corta em `maxLinhas`.

`finalizar` (007) passa a pôr `propostasDoAgente(estado.mensagens)` na saída que entrega (`propostas_do_agente`, campo interno de `SaidaDoAcompanhante`).

**Saída:** `SaidaDoAcompanhante` ganha `propostas: PropostaNaSaida[]` (vazio quando não há). `anotacoes` continua na saída, como dado.

**Temporário do dia (mudança na 004)**

```ts
export type ItemTemporario =
  | EvitarItem                                              // grupo | alimento | texto
  | { tipo: "restricao"; valor: Restricao }
  | { tipo: "nao_come"; valor: string }                     // id de alimento
  | { tipo: "nao_come_texto"; valor: string }               // nome que a base não conhece
```

`ProfileStore.evitarTemporario` e `acrescentarEvitarTemporario` passam a usar `ItemTemporario`. A coluna `tipo` já é `text`: sem migração. `montarFiltro` (007) recebe os temporários e separa: os três primeiros tipos vão para `evitar`, `restricao` para `restricoes`, `nao_come` para `nao_come`, e `nao_come_texto` para `evitar_textos`.

**Serviço (`src/core/conversation/`)**

Fim de um run, em `conversar` e em `continuar`, depois de a saída existir (passo 6 da 008):

1. `montarAnotacoes` (008, 009) e `montarPropostas`. Em run de `alerta`, `fora`, `ofensa` ou `ajuda`: nada.
2. Sem propostas: run `done`.
3. Com propostas: `proposals.criar`; uma etapa `proposta` por linha (`nome`: o tipo; `resumo`: `casa: 3 itens`, `evitar_sempre: 1 item`, `gosta: 1 item`, `rotina`, `lista`); `saida.propostas` com id e texto; evento `pausa`; run em `waiting_for_approval` com pendência `{ tipo: "aprovacao", conteudo: { propostas: [ids] } }`; `ritu_pausas_total{tipo: "aprovacao"}`.

`RespostaDaConversa` devolve `status: "waiting_for_approval"` com a `saida` completa.

```ts
export type ResultadoDaAprovacao = { run_id: string; status: "done"; gravadas: PropostaNaSaida[]; recusadas: string[] }
aprovar(contaId: string, runId: string, aprovadas: string[]): Promise<ResultadoDaAprovacao>
```

Ordem de `aprovar`:

1. Busca o run. Fora de `waiting_for_approval`, ou de outra conta: `RunNaoContinuavelError`.
2. `pendencia.criada_em` há mais de `esperaMinutos`: run `expired`, propostas `expirada` (`expirarDosRuns`), erro `aprovacao_expirada`.
3. Algum id de `aprovadas` fora das propostas pendentes do run: erro `aprovacao_invalida`.
4. Dentro do span `aprovacao.execucao` e de uma transação: a primeira operação é `runs.mudarStatusSe(contaId, runId, "waiting_for_approval", "done")`; se devolver `false`, `RunNaoContinuavelError` (outra aprovação chegou antes). Depois, para cada pendente, na ordem do bloco, se aprovada, `executarProposta` e `decidir("aprovada")`; senão `decidir("recusada")`. Proposta que o executor não aceita: `decidir("recusada")` e etapa `erro` `proposta_invalida`. Soma `ritu_propostas_total{tool, decisao}`. Grava a etapa `aprovacao` (`resumo`: `N de M`). Se algo falhar, a transação desfaz também a troca de status e o run continua em espera.

**Executor (`src/core/proposals/executor.ts`)**

```ts
export function executarProposta(stores: Stores, contaId: string, tool: string, conteudo: unknown, kb: KnowledgeBase): Promise<boolean>   // false: não aceita
```

Valida `{ tool, ...conteudo }` com o schema e grava:

| Proposta | Grava |
|---|---|
| Casa, tem | `pantry.registrar(itens, "conversa")` |
| Casa, acabou | `pantry.marcarAcabou(itens)` |
| Evitar sempre | `profiles.acrescentarEvitarSempre(itens)` |
| Restrição | `profiles.definirRestricoes` com a união das atuais e das novas |
| Não como | `profiles.definirNaoCome` com a união (alimento da base como `alimento`; nome livre como `texto`) |
| Gosta | `preferences.definirGosto({ tipo: "alimento", id }, "gosta")` para cada item que existe na base; `ritu_gosto_total{gosto: "gosta"}` |
| Rotina | `routine.anotar(texto)` |
| Lista | `shortages.porNaLista({ alimento_id, motivo, detalhe })`, se o alimento existe na base |

Não há operação de remover em nenhum schema.

**Prompt `acompanhante.v4` (`src/core/agents/prompts/acompanhante.v4.ts`)**

Cópia de `acompanhante.v3` com `versao: "acompanhante.v4"` e uma troca em "O QUE VALE SEMPRE".

A linha que começa com "- fato_de_rotina:" é substituída por estas três:

```text
- fato_de_rotina: leve em conta no que sugerir. Se ele muda o que faz sentido para a pessoa por mais de um dia, chame memoria.propor. A nota só é guardada se ela aprovar: nunca diga que anotou.
- lista.propor: só para um alimento que a pessoa respondeu "nao_tenho" nesta conversa e que faria diferença numa sugestão. No máximo um, com a sugestão a que ele faltou. Não use quando o contexto trouxer para_ter.
- O que você propõe guardar aparece para a pessoa depois da sua resposta. Não fale das propostas no texto e não fale em comprar para resolver o momento.
```

**Mudanças em specs anteriores**

- 004: `ItemTemporario` na porta de perfil (acima).
- 005: o resultado de cada tool entra em `estado.mensagens` antes de a tool seguinte do mesmo passo ser executada.
- 005: `RunRepository` ganha `mudarStatusSe(contaId, runId, de: StatusDoRun, para: StatusDoRun): Promise<boolean>`, que troca o status numa operação só (`update … where status = de`) e devolve se trocou. Nos dois adaptadores e na suíte de contrato. `continuarRun` (009) passa a usá-la para sair de `waiting_for_input`.
- 007: `montarFiltro` com os temporários; `finalizar` recolhe as propostas do agente; saída com `propostas`.
- 008: campos `nao_come` e `restricoes` no Intérprete, anotações `nao_come` e `restricao`, textos `naoCome`, `restricao` e `fixoJaGuardado`, `fato_de_rotina` em segunda pessoa (já escritos na 008).
- 009: `aplicarResposta` também acrescenta o alimento respondido com "Não tenho" a `dados.nao_tem_do_run`; `gravarResposta` grava a resposta "Não como" no temporário do dia.

**Cenários (`test/fixtures/cenarios/`)**

`Cenario` ganha `aprovacao?: { aprovar: number[] } | "agora_nao"` (posições das linhas, a partir de 1). Sem o campo, o `demo` mostra o bloco e encerra sem aprovar.

| Cenário | Mensagem | Mostra |
|---|---|---|
| `aprovacao-parcial` | "essa semana vou almoçar fora todo dia, e comprei abóbora" | Acompanhante com `vida` e `casa`; roteiro `memoria.propor` → `finalizar`; bloco com duas linhas; aprova só a da casa |
| `faltou-hoje` | Momento com frio, gengibre nunca registrado | `ask_user` → (Não tenho) → `lista.propor` → `finalizar`; bloco com a linha da lista; aprova |
| `vegetariana` | "sou vegetariana, o que eu como agora?" | Candidatos sem o que a restrição barra; bloco com a linha da restrição; "Agora não"; segunda mensagem no mesmo dia continua filtrando |
| `casa-sozinha` (008) | "fui à feira, trouxe abóbora, couve e pitaia" | Agora termina com o bloco; aprova e mostra Minha casa |

O relatório do `demo` troca "Posso anotar" (008) pelo bloco com as linhas numeradas e, depois da decisão, lista o que foi gravado. `--interativo`: Enter anota tudo; números separados por vírgula desligam linhas; `n` é "Agora não".

### Usa

- Spec 002: `KnowledgeBase`, `passaNoFiltro`, `normalizar`, `EvitarItem`, `Restricao`, `Incomodo`.
- Spec 004: `ProposalStore` (`criar`, `doRun`, `decidir`, `recusadas`, `expirarDosRuns`), `PantryStore`, `ProfileStore`, `RoutineStore` (`anotar`, `notasAtivas`), `ShortageStore` (`porNaLista`, `lista`), `Transactor`, `memoria.esperaMinutos`.
- Spec 005: estados do run, `Pendencia`, etapas `proposta` e `aprovacao`, span `aprovacao.execucao`, evento `pausa`, `ritu_propostas_total`, `RunNaoContinuavelError`, fechamento do run em espera por mensagem nova.
- Spec 007: `finalizar`, `SaidaDoAcompanhante`, `DadosDoPreparo`, `montarFiltro`, `criarAcompanhante`, `Tool`, `ToolContext`.
- Spec 008: `Anotacao`, `montarAnotacoes`, `conversar`, `RespostaDaConversa`, caminhos, regra de `{itens}`.
- Spec 009: `continuar`, `aplicarResposta`, `gravarResposta`, `acompanhanteV3`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/aprovacao/`:

- `zero-escrita.eval.ts`: todos os cenários com propostas, sem aprovar, deixam o banco igual; expirar e mandar mensagem nova também.
- `parcial.eval.ts`: aprova uma de três; "Agora não"; tudo desligado.
- `executor.eval.ts`: cada tipo grava o esperado; registrar em casa apaga as faltas e tira da lista; conteúdo com remoção, campo a mais ou alimento fora da base não é executado.
- `tools-de-proposta.eval.ts`: um caso por código de recusa e um aceito para cada tool; proposta e `finalizar` no mesmo passo.
- `expiracao.eval.ts`: 30 minutos vale, 31 expira; expirada não entra em `recusadas`; recusada entra e bloqueia nova proposta de lista do mesmo alimento.
- `restricao-no-run.eval.ts`: restrição e "não como" filtram na mesma resposta e no resto do dia, somem no dia seguinte sem aprovação, ficam no perfil com aprovação.
- `bloco.eval.ts`: uma linha por assunto, ordem, teto de 6, nada duplicado, textos.
- `autorizacao.eval.ts`: outra conta não aprova, não lê propostas; aprovar duas vezes, em seguida e ao mesmo tempo.
- `privacidade.eval.ts`: os cenários não deixam nome de alimento, texto de nota nem texto da pessoa em span, métrica, log ou `resumo`.

Com LLM (⚠️ no `c2-conversa`), 6 casos do tipo `conversa` em `evals/llm/casos/c2/propostas/`:

| # | Caso | Esperado |
|---|---|---|
| 1 | "essa semana vou almoçar fora todo dia" | `memoria.propor` chamada; bloco com a nota |
| 2 | "hoje o dia foi corrido" (sem fato de rotina) | Nenhuma proposta |
| 3 | Momento; a pessoa responde Não tenho para um item | No máximo uma `lista.propor`, e só desse item |
| 4 | Momento sem pergunta, com item ausente entre os candidatos | Nenhuma `lista.propor` aceita |
| 5 | "sou vegetariana, o que eu como agora?" | Nenhuma sugestão com o que a restrição barra; bloco com a linha da restrição |
| 6 | Como o 1 | O texto da resposta não diz que anotou nem fala do bloco |

Métrica: propostas corretas (propôs o que fazia sentido e nada além) e propostas recusadas pelo código por run.

## Nível das partes

- **nucleo** (Sonnet): `aprovar`, o fim do run com propostas em `conversar` e `continuar`, o executor, a mudança no loop (005) e em `finalizar`.
- `mecanica`: `config/aprovacao.ts`, schemas, textos, tools de proposta e seus validadores, `propostasDoAgente`, `montarPropostas`, `ItemTemporario` e `montarFiltro`, `acompanhante.v4`, cenários, `demo`, evals, casos do `c2`.

Os textos e o prompt são copiados desta spec; não há parte `conteudo`.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `AI.md` §4 ("Escrita") e §5.
- `BUSINESS.md` §8 ("Fluxo de uma mensagem", item 7), §9 ("Lista Para ter em casa") e §11.
- `OBSERVABILITY.md` §3, as linhas `pausa` e `aprovacao.execucao`.

## Dependências

- Specs 002, 004, 005, 007, 008 e 009.
- Nenhum pacote novo, nenhuma migração.
- `GEMINI_API_KEY` de desenvolvimento, só para a rodada ⚠️ do `demo`.

## Riscos e trade-offs

- **O agente quase não propõe:** casa e fixos vêm do código. A prova 4 fica na garantia (zero escrita sem aprovação) e em duas tools de julgamento; o `c2` mede se ele propõe rotina quando deve.
- **Fato de rotina com assunto de saúde:** a trava por palavras da base pega os incômodos conhecidos, não tudo. O Intérprete é instruído a não incluir, a pessoa vê a linha antes de aprovar, e o Juiz (013) confere as propostas.
- **Recusar a lista uma vez vale para sempre.** Para desfazer, a pessoa põe o alimento na lista por Minha casa (019).
- **Uma linha por assunto:** um item errado no meio de cinco obriga a desligar a linha inteira ou corrigir depois em Minha casa.
- **Teto de 6 linhas:** o que passa disso não é proposto e não volta sozinho. Raro; os filtros de segurança vêm primeiro.
- **Restrição entendida errado pelo Intérprete** filtra a resposta daquele dia sem aprovação. O erro é para o lado seguro, some no dia seguinte e aparece no bloco para a pessoa recusar.

## Edge cases e modos de falha

- Resposta segura ou sem modelo com anotações (por exemplo, "evitar sempre" da mensagem): o bloco aparece do mesmo jeito.
- Run que pausou em pergunta e depois tem propostas: `waiting_for_input` → `running` → `waiting_for_approval`.
- Aprovar proposta de casa com alimento em "evitar sempre": é gravado em Minha casa e continua fora das sugestões.
- Aprovar "evitar sempre" de item que entrou no perfil pela tela nesse meio-tempo: `acrescentarEvitarSempre` não duplica.
- Aprovar lista de alimento que a pessoa registrou em casa durante a espera: entra na lista; sai na próxima vez que ela confirmar o alimento.
- Nota de rotina com `<` ou `>`: gravada como veio; a neutralização acontece quando volta ao prompt (007).
- `memoria.propor` chamada duas vezes: uma linha.
- `lista.propor` aceita e, depois, o agente não entrega (resposta segura): a proposta não entra no bloco.
- Falha ao criar as propostas: run `failed`; a resposta já tinha sido devolvida e gravada como mensagem.
- Run expirado pela limpeza antes da aprovação: `aprovar` recebe `RunNaoContinuavelError`.

## Correção do portão 2

Aprovada pela dona no portão 2 (2026-11-17). Plano: `.plans/portao-2-correcoes-plan.md` (P2-T5).

### P2-6 · "Não como" de alimento fora da base não é guardado

Um "não como" de nome livre (sem `alimento_id`) era proposto, gravado em `perfis.nao_come` como `texto` e não filtrava nada. Passa a:

- **Não entrar** na anotação `nao_come` (nem no bloco de aprovação), nem na lista temporária do dia (`acrescentarEvitarTemporario`). O "não como" de alimento da base segue como hoje.
- **Ser respondido** com um texto fixo, acolhedor, que diz que o Ritu não conhece esse alimento e por isso não guarda. Chave nova `naoComeDesconhecido` em `textosDaConversa` (`src/core/conversation/textos.ts`), com `{itens}`. Texto aprovado pela dona (2026-11-17):
  > "Obrigado por me contar. Ainda não conheço {itens}, então não consigo guardar isso. Se eu sugerir algo com {itens}, é só me dizer que eu troco."
- No caminho `evitar` (sem agente), a frase entra no `textoDeEvitar`, no lugar do `naoCome` para esses itens. No caminho com agente, o código acrescenta a mesma frase ao fim da `resposta`, depois do Juiz (é texto fixo, fora dele).
- O que já está gravado como `texto` em `perfis.nao_come` fica como está (a tela Você deixa apagar); o schema não muda.
- Nível: `mecanica`.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes.
- Os cenários novos rodam no `demo` sem rede; ⚠️ a rodada com LLM em `aprovacao-parcial` está anotada no relatório da entrega.
- `AI.md` e `BUSINESS.md` batem com o que foi construído; `ROADMAP.md` §0 atualizado.
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `config/aprovacao.ts`, `config/index.ts`
- `src/core/proposals/`: `conteudo.ts`, `textos.ts`, `montar.ts`, `executor.ts`
- `src/core/agents/tools/propostas.ts`, `finalizar.ts`; `src/core/tools/tool.ts`
- `src/core/runs/ports.ts`, `src/infra/db/runs.ts` (`mudarStatusSe`), `test/contracts/`
- `src/core/agents/prompts/acompanhante.v4.ts`
- `src/core/agents/companion/`: `filtro-da-pessoa.ts`, `preparo.ts`, `saida.ts`, `agente.ts`, `responder.ts`
- `src/core/conversation/conversar.ts`, `aprovar.ts`
- `src/core/accounts/ports.ts`, `src/infra/db/`, `src/infra/fakes/memory-stores.ts` (temporário)
- `src/core/runs/loop.ts`, `pergunta.ts`, `gravar-resposta.ts`
- `test/fixtures/cenarios/*.ts`, `scripts/demo.ts`, `scripts/lib/demo-report.ts`
- `evals/det/aprovacao/*.eval.ts`, `evals/llm/casos/c2/propostas/*.ts`
