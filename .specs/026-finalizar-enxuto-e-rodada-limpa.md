---
title: Finalizar enxuto e rodada limpa
status: approved
entrega: 3
created: 2026-11-22
---

# Finalizar enxuto e rodada limpa

> O Acompanhante passa a entregar em `finalizar` só o que exige julgamento: a fala, quais candidatos usar, o alimento de cada vaga, as trocas, o motivo e os incertos. O código monta o resto a partir dos candidatos que ele mesmo calculou. O runner dos evals passa a separar falha do agente de falha de infraestrutura e usa até três chaves do Gemini de desenvolvimento.

## Contexto

A "Válida na 1ª tentativa" ficou em 15% nos três checkpoints (`c1-base`, `c2-conversa`, `c3-confiavel`). O modelo de `decisao` (flash-lite) tem de copiar de volta, em `finalizar`, dados que o preparo já calculou: `qualidades_do_momento`, `qualidades_buscadas`, `contribui` e `linha_base` de cada item, `linhas_base` e `novidade` de cada sugestão, os ingredientes exatos da prática, `evitar`, `citados` e `para_ter`. As violações mais comuns da 1ª entrega no `c3-confiavel` de 2026-11-22 são exatamente essas: `qualidades` (30 runs), `novidade` (24), `estrutura` (21), `linha_base` e `texto_sem_estrutura`. Além disso, o prompt e o schema falam de `qualidades.presentes`, `qualidades.buscadas`, `qualidades.evitar` e `qualidades.conflitos`, mas o contexto entrega esse bloco com o nome `momento`.

Até o `c2`, as novas tentativas escondiam o problema (89% de correção). Na entrega 3, o Juiz e as chamadas de apoio passaram a dividir o mesmo orçamento (6 chamadas, 3 recusas, 25 s por trecho), e a correção caiu para 32%: os runs terminam em `limite:chamadas`, `limite:validacao` ou `timeout`, e saem com a resposta `segura`.

A medição também misturou infraestrutura com o agente. Das 29 falhas do `c3-confiavel`, cerca de 16 não chegaram a testar o agente: Postgres desligado (`AggregateError`), erro sem nenhuma etapa, `indisponivel` por cota, timeout antes de qualquer chamada de decisão e, nos casos `c3-s23` e `c3-s24`, uma entrega válida que virou `segura` porque o Juiz estava sem cota.

## Objetivo

- A "Válida na 1ª tentativa" chega à meta de `config/evals.ts` (≥ 60%) e a "Corrigiu após violação" a ≥ 95% no `c3-confiavel` seguinte.
- Nenhuma violação de campo copiado (`qualidades`, `novidade`, `linha_base`, `para_ter`, `texto_sem_estrutura`, estrutura da prática) volta para o modelo: todas passam a ser impossíveis por construção.
- O relatório do checkpoint diz quantos casos foram inconclusivos por infraestrutura, e esses casos não entram nas métricas.

## Escopo

- **Dentro:** schema novo de `finalizar` (`EscolhaDoModelo`); função `completarEntrega` que transforma a escolha na `EntregaDoModelo` atual; separação das violações em "do modelo" e "de montagem"; prompt `acompanhante.v8`; checagem prévia, casos inconclusivos e refazer dos inconclusivos no runner; até três chaves do Gemini no `ModelRouter` (só desenvolvimento); docs, ADR e uma rodada nova do `c3-confiavel`.
- **Fora:** o guardrail que mandou "meu chefe me humilhou" para `fora` (`c3-s18`), o resumo de rotina repetido (`c3-02`) e o caso do Juiz `c3-j07`. Ficam para depois da rodada limpa, quando dá para ver se continuam falhando. Também ficam fora: o Juiz, os limites do loop (`config/loop.ts`), os modelos de cada papel e o `c4-site` (J-A5, decisão do portão).

## Necessidade de negócio

O Ritu precisa responder como agente na maior parte das mensagens, e não com a resposta segura. Hoje, 30 de 48 runs do agente terminam sem sugestão nenhuma, e o número do portão não diz se a culpa é do agente ou da cota.

## Critérios de aceite

- [ ] A tool `finalizar` recebe `EscolhaDoModelo` (contrato abaixo) e mais nada; o schema antigo deixa de ser entrada do modelo e continua só como tipo interno (`EntregaDoModelo`).
- [ ] `completarEntrega(escolha, contexto)` monta a `EntregaDoModelo` a partir de `dados.candidatos`, da base e do clima do run, sem chamar modelo.
- [ ] Teste determinístico: para cada candidato de cada fixture do preparo, uma escolha mínima (`{ tipo, id, motivo }`) passa por `completarEntrega` e `validarEntrega` sem nenhuma violação de montagem.
- [ ] Violação de montagem depois de `completarEntrega` não volta para o modelo: o run termina com a resposta `segura`, a etapa `validacao` registra `erro_de_montagem` e a telemetria loga `resposta_segura` com `motivo: "montagem"`.
- [ ] Violação do modelo volta para o modelo como hoje, com a mensagem escrita em termos da escolha (`sugestoes[i].escolhas[j]`, não `itens[j].contribui`).
- [ ] Escolha com `id` fora de `dados.candidatos` vira a violação `fora_dos_candidatos`, com a lista de ids aceitos na mensagem.
- [ ] `acompanhante.v8` é o prompt ativo; ele não contém `qualidades.` e cita os campos do contexto pelo nome real (`momento.presentes`, `momento.buscadas`, `momento.conflitos`, `momento.evitar`). Um teste confere que todo caminho `momento.<campo>` citado no prompt existe no JSON montado por `montarMensagemInicial`.
- [ ] O loop, as tools, as pausas, a aprovação e o Juiz funcionam como antes; os evals determinísticos de `evals/det/acompanhante`, `loop`, `pausas`, `aprovacao` e `guardrails` passam (os que leem campos copiados são atualizados para a escolha).
- [ ] `GEMINI_API_KEY_2` e `GEMINI_API_KEY_3` são opcionais, com `producao: "local"`. Sem elas, o roteador se comporta exatamente como hoje (os testes atuais do `ModelRouter` passam sem mudança).
- [ ] Com elas, cada par modelo × chave tem a própria cota no `UsageLedger` (chave `<modelo>@<n>`, com `n` de 1 a 3). Em 429 ou cota esgotada, o roteador tenta o mesmo modelo na chave seguinte antes de trocar de modelo.
- [ ] `npm run eval:llm` faz uma checagem prévia (Postgres responde; cada chave configurada responde a uma listagem de modelos) e para com uma mensagem clara se algo falhar, antes de rodar o 1º caso.
- [ ] Cada caso termina como `acertou`, `falhou` ou `inconclusivo`, conforme a regra da seção Contratos. Os inconclusivos não entram em nenhuma métrica, o relatório lista quantos foram e por quê, e `--retomar` roda de novo só os inconclusivos e os que faltam.
- [ ] O relatório do checkpoint diz "rodada completa" só com zero inconclusivos; se sobrar algum, o cabeçalho diz "rodada incompleta: N inconclusivos".
- [ ] Rodada nova do `c3-confiavel` com `acompanhante.v8`, gravada em `evals/resultados/` e em `COMPARACAO.md`, com `c3-s23` e `c3-s24` incluídos.
- [ ] `AI.md` §3 ("Saída do Acompanhante"), `QA.md` ("Regras da rodada" e "Registro da evolução"), `.env.example` e a ADR 0052 descrevem o que esta spec mudou.

## O que fazer

- Criar `EscolhaDoModelo` e trocar o `inputSchema` de `finalizar` por ele.
- Criar `completarEntrega` em `src/core/agents/companion/completar.ts`, com as regras de montagem da tabela abaixo.
- Dividir os códigos de violação em dois conjuntos (`DO_MODELO` e `DE_MONTAGEM`) em `validador.ts`, sem tirar nenhuma checagem: as de montagem viram invariantes.
- Escrever `acompanhante.v8` a partir do `v7`: tirar as instruções de cópia, descrever os campos novos de `finalizar`, corrigir os nomes para `momento.*` e manter tudo o que é julgamento (tom, conflitos, padrões, chá genérico, sem clima, pergunta, propostas).
- Ensinar o `ModelRouter` e o `UsageLedger` a trabalhar com até três chaves.
- No runner (`scripts/lib/evals/`), acrescentar a checagem prévia, o estado `inconclusivo` e a retomada dos inconclusivos.
- Atualizar os evals determinísticos que montam entregas à mão para montar escolhas.
- Rodar o `c3-confiavel` completo no fim, com `--extra` se a rodada cair no mesmo dia da anterior (autorizado pela dona nesta spec).

## O que não fazer

- Não decidir por código quais candidatos entram, nem a ordem entre eles, nem o alimento de cada vaga: isso continua sendo escolha do agente.
- Não montar a fala (`resposta`) nem o `motivo` por código.
- Não tirar tools do catálogo nem mudar o loop, as pausas, a aprovação ou o Juiz.
- Não usar `GEMINI_API_KEY_2` e `_3` em produção, nem citá-las em `DEPLOY.md`.
- Não tornar o Juiz tolerante a indisponibilidade em produção: lá ele continua fail-closed. Só o eval classifica isso como inconclusivo.
- Não apagar o `acompanhante.v7` (as rodadas antigas apontam para ele).

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| O que o modelo entrega | Fala, candidatos escolhidos, alimento de cada vaga (entre as `opcoes`), `se_faltar`, motivo, incertos e se menciona o `para_ter` | É o que exige julgamento. O resto o código já sabe e o modelo só podia copiar errado |
| Sugestão fora dos candidatos | Recusada (`fora_dos_candidatos`) | O prompt já proíbe, e o `ask_user` já recusa. A montagem precisa dos dados do candidato |
| Item padrão de cada vaga | O do candidato (`itens`); `escolhas` só para trocar por uma das `opcoes` | O agente decide sem precisar repetir o que não muda |
| `explicacao` | Montada: `qualidades_do_momento` = `momento.presentes` + gunas do clima do run; `qualidades_buscadas` = `momento.buscadas` + o oposto de cada guna do clima, sem repetição | A mesma regra que o validador já aceita |
| `evitar` | Montado: todas as linhas de `momento.evitar.itens` | O prompt mandava copiar todas |
| `citados` | Montado: alimentos e práticas da base que aparecem na `resposta` e não estão nas sugestões (o mesmo casamento de nomes de `checarTextoSemEstrutura`) | A checagem de filtro (evitar sempre, restrição, não come) continua valendo para o que o texto cita |
| `para_ter` | O modelo diz `para_ter: true` ou omite; o código copia o `para_ter` do contexto | Mencionar ou não é julgamento; os campos não |
| Violação de montagem | Termina com `segura` e registra `erro_de_montagem` | É bug de código; mandar para o modelo gasta chamada sem chance de acerto |
| Várias chaves | Só desenvolvimento, uma cota por modelo × chave, mesmo modelo nas outras chaves antes de trocar de modelo | Cota grátis é por projeto do Google; manter o modelo deixa a rodada comparável |
| Inconclusivo | Infraestrutura impediu o agente de tentar (regra em Contratos) | O número do portão mede o agente, não a cota |
| Rodada do mesmo dia | A dona autoriza `--extra` para a rodada desta spec | Regra de `QA.md`: só a dona libera a segunda rodada do dia |

## Contratos

### Cria

**Entrada de `finalizar`** (`src/core/agents/companion/saida.ts`):

```ts
const escolhaDeVagaSchema = z.object({
  funcao: funcaoSchema,
  alimento_id: z.string().describe("Um alimento_id de opcoes[funcao] do candidato."),
})

const trocaSchema = z.object({
  alimento_id: z.string().describe("Item da sugestão que está incerto em casa."),
  se_faltar: z.string().describe("Substituto confirmado em casa."),
})

const sugestaoEscolhidaSchema = z.object({
  tipo: z.enum(["cha", "refeicao", "oleo", "pratica"]),
  id: z.string().describe("O id de um candidato do contexto."),
  escolhas: z.array(escolhaDeVagaSchema).optional()
    .describe("Só refeição: troca o item padrão de uma vaga por uma das opcoes."),
  trocas: z.array(trocaSchema).optional(),
  motivo: z.string(),
})

export const escolhaDoModeloSchema = z.object({
  resposta: z.string(),
  sugestoes: z.array(sugestaoEscolhidaSchema),
  incertos: z.array(z.string()),
  para_ter: z.literal(true).optional()
    .describe("true para mencionar o para_ter do contexto; omita se não houver ou não couber."),
})

export type EscolhaDoModelo = z.infer<typeof escolhaDoModeloSchema>
```

**Montagem** (`src/core/agents/companion/completar.ts`):

```ts
export type ContextoDaMontagem = {
  dados: DadosDoPreparo
  clima?: { gunas: Guna[] }
  kb: KnowledgeBase
}

export type Montagem =
  | { ok: true; entrega: EntregaDoModelo }
  | { ok: false; violacoes: Violacao[] } // só violações do modelo: fora_dos_candidatos, estrutura (escolha fora das opcoes), para_ter (true sem para_ter no contexto)

export function completarEntrega(e: EscolhaDoModelo, ctx: ContextoDaMontagem): Montagem
```

| Campo de `EntregaDoModelo` | De onde vem |
|---|---|
| `resposta`, `incertos` | Da escolha, sem mudança |
| `explicacao` | Regra da tabela de Decisões |
| `sugestoes[i].tipo`, `pratica_id` ou `preparo_id` | Do candidato (`tipo === "refeicao"` → `preparo_id`; os outros → `pratica_id`) |
| `sugestoes[i].itens` | `candidato.itens`, com cada `escolhas[k]` trocando o item da mesma `funcao` pela opção de mesmo `alimento_id` em `candidato.opcoes[funcao]`; `contribui` e `linha_base` de cada item vêm do item ou da opção; `se_faltar` vem de `trocas` |
| `sugestoes[i].motivo` | Da escolha |
| `sugestoes[i].linhas_base` | `[candidato.linha_base]` |
| `sugestoes[i].novidade` | `candidato.novidade` |
| `evitar` | `dados.qualidades.evitar.map((e) => e.linha_base)` |
| `citados` | Regra da tabela de Decisões, até `config.resposta.maxCitados` (o que passar disso fica para o validador apontar `tamanho`) |
| `para_ter` | `dados.para_ter` (`alimento_id`, `vezes`, `contribui`, `linha_base`) quando a escolha traz `para_ter: true` |

**Códigos de violação** (`validador.ts`):

```ts
export const DE_MONTAGEM: readonly CodigoDeViolacao[] = [
  "qualidades", "novidade", "linha_base", "para_ter", "texto_sem_estrutura",
] // e "estrutura" quando aponta prática (itens diferentes dos ingredientes)

export type CodigoDeViolacao = /* os atuais */ | "fora_dos_candidatos"
```

Todo o resto é do modelo: `fora_da_base`, `fora_dos_candidatos`, `estrutura` de refeição (vaga obrigatória vazia, item que não serve à vaga), `fora_de_casa`, `evitar_sempre`, `restricao`, `nao_come`, `nao_gosta`, `contraindicacao`, `combinacao`, `repetida`, `tamanho`, `vazia`, `dosagem`. `validarEntrega` devolve as violações com um campo a mais, `origem: "modelo" | "montagem"`.

**Fluxo de `finalizar`:** `escolhaDoModeloSchema.parse` → `completarEntrega` (violações do modelo voltam) → `validarEntrega` → com violação de `origem: "montagem"`, fim com `segura` e `erro_de_montagem`; com violação do modelo, volta para o modelo e conta como entrega recusada, como hoje.

**Prompt:** `src/core/agents/prompts/acompanhante.v8.ts`, `versao: "acompanhante.v8"`, registrado como o ativo no lugar do `v7`.

**Variáveis de ambiente** (`src/infra/env.ts` e `.env.example`):

```ts
{ name: "GEMINI_API_KEY_2", entrega: 3, obrigatoria: false, producao: "local",
  descricao: "Chave de outro projeto do Google, só para os evals com LLM" },
{ name: "GEMINI_API_KEY_3", entrega: 3, obrigatoria: false, producao: "local",
  descricao: "Chave de outro projeto do Google, só para os evals com LLM" },
```

**Roteador:** a fila de um papel vira a lista de pares `(modelo, chave)` na ordem: para cada modelo de `llmCotas.papeis[papel]`, as chaves configuradas de 1 a 3. O `UsageLedger` grava o uso com a chave `<modelo>@<n>` quando há mais de uma chave, e com `<modelo>` quando há uma só (o banco de produção não muda). As métricas continuam com o rótulo `modelo` sem o sufixo. `Troca` ganha `chave_de?: number; chave_para?: number`.

**Runner:**

```ts
type EstadoDoCaso = "acertou" | "falhou" | "inconclusivo"
type MotivoInconclusivo =
  | "banco"            // erro de conexão com o Postgres
  | "sem_etapas"       // o caso terminou com erro antes da 1ª etapa
  | "cota"             // fim do run por indisponivel, ou 429/cota em alguma chamada do run
  | "juiz_indisponivel" // a entrega passou no validador e o Juiz não respondeu
  | "timeout_sem_decisao" // timeout antes de qualquer chamada de decisao concluída
```

Um caso é `inconclusivo` quando cai em qualquer um desses motivos; o motivo vai para o `.json` do caso e para o relatório. `--retomar` roda de novo os inconclusivos e os que faltam. A checagem prévia roda antes do 1º caso, em toda rodada e em toda retomada.

### Usa

- 007: `DadosDoPreparo`, `Candidato`, `ItemDoCandidato`, `validarEntrega`, `EntregaDoModelo`, `SaidaDoAcompanhante` e a conversão para a saída (sem mudança).
- 006: `ModelRouter`, `UsageLedger`, `config/llm-cotas.ts`.
- 013: Juiz fail-closed e `saidaSegura`.
- 014: runner, `--retomar`, `--extra`, famílias, `historico.json`, `COMPARACAO.md`.
- 025: padrão de chá genérico e os casos `c3-s23` e `c3-s24`.

## Evals (quando a spec toca agente, prompt, tool ou base)

- **Determinísticos novos:** montagem sem violação de montagem para todo candidato de todas as fixtures (`evals/det/acompanhante/montagem.eval.ts`); escolha fora dos candidatos; escolha de vaga fora das `opcoes`; `para_ter: true` sem `para_ter` no contexto; `citados` derivados da fala respeitando evitar sempre; prompt `v8` sem `qualidades.` e com os caminhos de `momento` existentes; roteador com três chaves (429 na chave 1 passa para a chave 2 do mesmo modelo); runner classificando cada motivo de inconclusivo; checagem prévia que para sem Postgres.
- **Com LLM:** nenhum caso novo. A rodada do `c3-confiavel` com o `v8` deve mostrar: zero violações de montagem na 1ª entrega; "Válida na 1ª tentativa" ≥ 60%; "Corrigiu após violação" ≥ 95%; `c3-s23` e `c3-s24` com sugestão de chá; zero inconclusivos. As metas avisam e não travam.

## Nível das partes

- **nucleo** (Sonnet): `completarEntrega`, a divisão de violações e o fluxo de `finalizar`; o prompt `acompanhante.v8`; o `ModelRouter` e o `UsageLedger` com várias chaves.
- Runner, env, docs e evals determinísticos: mecânica.

## Leitura para a construção

- `AI.md` §3 "Saída do Acompanhante" e "O loop": o que muda no texto.
- `AI.md` §10 "O roteador (`ModelRouter`)": a ordem de troca, para encaixar as chaves.
- `QA.md` "Checkpoints" (regras da rodada) e "Registro da evolução".
- `src/core/agents/prompts/acompanhante.v7.ts`: base do `v8`.

## Dependências

- Specs 006, 007, 013, 014 e 025.
- Três projetos do Google com chave do Gemini (já no `.env.local`).
- Docker Desktop ligado para a checagem prévia e para a rodada.

## Riscos e trade-offs

- O agente deixa de "declarar" as qualidades e os `contribui`. A explicação continua na parte estruturada (montada por código) e na fala, que o avaliador e o Juiz continuam lendo.
- Sugestão só sai de `dados.candidatos`. Uma refeição que o agente achasse com `ayurveda.candidatos` e não estivesse no preparo deixa de ser aceita; ela já falharia em `fora_de_casa` na maioria dos casos.
- `citados` derivados pegam também alimentos citados de forma negativa ("evite café"). É o mesmo comportamento da checagem atual de texto.
- As chaves extras deixam a rodada mais rápida, mas não aumentam a cota de produção. O número de produção continua limitado à chave do projeto de produção.

## Edge cases e modos de falha

- Escolha com o mesmo `id` duas vezes: violação `repetida`, como hoje.
- `escolhas` para uma `funcao` que o preparo não tem, ou para prática: violação `estrutura`, do modelo.
- `trocas` para item confirmado em casa: ignorada. `trocas` com substituto fora de casa: `fora_de_casa`, do modelo.
- Candidato sem `opcoes` e escolha com `escolhas`: `estrutura`, com a mensagem "esse candidato não tem opções; use o item padrão".
- Clima indisponível: `explicacao` sai só com o que vem de `momento`.
- Uma chave inválida na checagem prévia: a rodada para e diz qual variável falhou; não segue só com as outras.
- Todas as chaves do mesmo modelo esgotadas: troca de modelo, como hoje; todas as rotas do papel esgotadas: `indisponivel`, e o caso fica inconclusivo.

## Resultado (definição de pronto)

- Critérios de aceite marcados, `npm test`, `eval:det` e `npm run dup` sem falha, E2E sem regressão.
- `c3-confiavel` rodado com o `v8`, com o relatório e a comparação commitados.
- ADR 0052 escrita; `AI.md`, `QA.md`, `.env.example`, `.specs/README.md`, `ROADMAP.md` §0 e a linha de status do `AGENTS.md` atualizados.

## Arquivos e diretórios envolvidos

- `src/core/agents/tools/finalizar.ts`, `src/core/agents/companion/saida.ts`, `completar.ts` (novo), `validador.ts`, `registrar-entrega.ts`, `agente.ts`
- `src/core/agents/prompts/acompanhante.v8.ts` (novo); `agente.ts` e `src/core/conversation/conversar.ts` passam a apontar para o `v8`
- `src/core/llm/router.ts`, `ledger.ts`, `fornecedor.ts`, `src/infra/container.ts`, `src/infra/env.ts`, `.env.example`
- `scripts/eval-llm.ts`, `scripts/lib/evals/`
- `evals/det/acompanhante/`, `evals/det/loop/`, `evals/det/modelos/`, `evals/det/evals-llm/`
- `.docs/AI.md`, `.docs/QA.md`, `.adrs/0052-finalizar-enxuto.md`
