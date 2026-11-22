---
title: Checkpoints pelas rotas do site (c4-site e c5-publico)
status: implemented
implemented: 87a2bc2
entrega: 4
created: 2026-11-22
---

# Checkpoints pelas rotas do site (c4-site e c5-publico)

> O runner do eval com LLM ganha um segundo alvo: além de chamar a conversa direto pelo código (c1 a c3), roda os mesmos casos pelos handlers das rotas do site (`/api/runs`, resposta, aprovação, troca, retornos, preferências), com o NDJSON das etapas ao vivo e a visão final. Com isso, o `c4-site` e o `c5-publico` passam a existir em `evals/llm/checkpoints.ts`, e a entrega 4 fecha com o `c5-publico`.

## Contexto

`QA.md` prevê cinco checkpoints. O `c4-site` ("todas as famílias, pelas rotas reais do site") devia nascer com a 018, e o `c5-publico` com a 022, mas nenhum dos dois foi criado (DECISOES 022 · A2 e J-A5). O portão 3 foi com o `c3-confiavel`. Sem o alvo pelas rotas, a evolução em Bastidores (023) e no README (024) para no c3, e nenhum eval com LLM passa pelo caminho que quem visita usa: rota, limites, streaming das etapas, pausa e retomada pela rota, visão final relida do banco.

## Objetivo

- `npm run eval:llm -- --checkpoint c5-publico` roda os 86 casos; os casos de run (acompanhante e conversa) passam pelos handlers das rotas, e os de Intérprete e de apoio rodam como no `c3-confiavel`.
- Para cada cenário de conversa, a rodada pelas rotas devolve o mesmo resultado que a rodada pelo código, provado sem LLM.
- O fechamento da entrega 4 roda o `c5-publico`.

## Escopo

- **Dentro:**
  - Campo `alvo` nos checkpoints (`"codigo" | "rotas"`); registro do `c4-site` e do `c5-publico`, os dois com as pastas `c1`, `c2` e `c3` e o alvo `rotas`.
  - `rodarCenarioPelasRotas`: a mesma rodada de `rodarCenario` (mensagem, pausas, bloco de aprovação, toques, segunda mensagem), mas cada passo é um `Request` entregue ao handler da rota.
  - `containerDoCenario`: o `Container` que as rotas recebem, montado com as dependências do cenário (relógio fixo, clima falso, stores, roteador, LLM, runtime, telemetria).
  - Checagens de rota em cada caso de run (lista `rota`): status, NDJSON válido, ordem dos eventos, visão final batendo com o run.
  - Linha "Fluxo pelas rotas" no relatório da rodada com alvo `rotas`; linha "Alvo" no cabeçalho de todo relatório.
  - Teste de equivalência sem LLM: todos os cenários de conversa, pelas rotas e pelo código, com o runtime roteirizado.
  - `QA.md` (tabela de checkpoints) e `DECISOES-AUTONOMAS.md` (022 · A2 e J-A5 resolvidas).
- **Fora:**
  - Servidor HTTP rodando, cookies e login: a autenticação, o CSP, o `Origin` e o middleware já têm o E2E (017, 018). Aqui a sessão entra por `contaDaSessao` injetado.
  - Rodar o `c4-site`: fica registrado e pode ser rodado à mão, mas não entra na entrega (o portão 3 foi com o `c3-confiavel`). Sem entrada dele no `historico.json`, Bastidores e `COMPARACAO.md` só mostram os checkpoints rodados.
  - Casos novos com LLM, mudança de prompt, de métrica, de meta ou de `FAMILIAS`.
  - Rodar contra a produção (o `c5-publico` usa a chave de desenvolvimento, como diz a 022).

## Necessidade de negócio

O produto diz que mede o agente e que melhora com o uso. A linha do tempo dos evals precisa chegar ao produto público, e o checkpoint final precisa passar pelo mesmo caminho que o site usa; senão um erro de ligação entre rota e agente (pausa que não retoma, visão que não bate com o run, limite que barra a conversa) passa sem ser visto.

## Critérios de aceite

- [ ] `npm run eval:llm -- --checkpoint c5-publico --listar` lista os 86 casos, a contagem por tipo, a estimativa de chamadas e "Alvo: rotas do site", sem modelo nem rede. O mesmo para `c4-site`.
- [ ] `--checkpoint c3-confiavel --listar` continua igual, com "Alvo: código".
- [ ] **Equivalência:** para cada cenário de `cenariosDeConversa` (e dos mapas de pausa, aprovação, aprendizado, memória e guardrails), com o runtime roteirizado e o LLM falso, `rodarCenarioPelasRotas` devolve um `RodadaDoCenario` igual ao de `rodarCenario` (`final`, `perguntas`, `bloco`, `toques`, `depois`), comparado com `toEqual` depois de tirar ids e datas geradas.
- [ ] **Checagens de rota** (lista `rota`, em todo caso de run com alvo `rotas`): toda resposta de rota com status 200; cada linha do NDJSON valida no schema do evento da tela; o primeiro evento é `inicio` e o último é `fim`; o `run_id` do `inicio` é o do run gravado; o texto da visão do `fim` é o texto da resposta do run gravado. Qualquer uma falsa → o caso fica `errado`, com a descrição da checagem.
- [ ] **Limite da rota:** um 429 de limite numa rodada de eval vira checagem de rota falsa ("a rota barrou a conversa"), nunca inconclusivo.
- [ ] As classes de inconclusivo da 026 (`banco`, `sem_etapas`, `cota`, `juiz_indisponivel`, `timeout_sem_decisao`) valem iguais pelas rotas.
- [ ] O relatório de uma rodada com alvo `rotas` tem no cabeçalho "Alvo: rotas do site" e, abaixo do resumo, "Fluxo pelas rotas: N de M casos íntegros"; com alvo `codigo`, "Alvo: código". Os relatórios já gravados não mudam.
- [ ] `historico.json` não muda de forma; uma rodada do `c5-publico` entra nele depois do `c3-confiavel`, na ordem de `checkpoints`.
- [ ] `QA.md`: a linha do `c4-site` diz "Registrado; não rodado (o portão 3 foi com o `c3-confiavel`)"; a do `c5-publico`, "Fim da entrega 4, pelos handlers das rotas, com os prompts e a `config/` commitados".
- [ ] Gates verdes: lint, typecheck, `npm test`, `eval:det`, `dup`, build, E2E e o teste de arquitetura.

## O que fazer

- Mudar `evals/llm/checkpoints.ts` para a forma dos contratos e ajustar quem lê (`scripts/lib/evals/casos.ts`, `historico.ts`, `comando.ts`).
- Escrever `containerDoCenario` e `rodarCenarioPelasRotas` em `test/fixtures/cenarios/rotas.ts`, exportados pelo `index.ts` da pasta.
- Escrever `scripts/lib/evals/rodar-rotas.ts` com `rodarAcompanhantePelasRotas` e `rodarConversaPelasRotas`, com a mesma assinatura e o mesmo `CasoRodado` de `rodar-run.ts`, reaproveitando `colher.ts` e `inconclusivo.ts`.
- Em `scripts/eval-llm.ts`, escolher o runner do caso pelo `alvo` do checkpoint (`rodarAcompanhante`/`rodarConversa` ou as versões pelas rotas); Intérprete e apoio não mudam.
- Teste de equivalência em `test/fixtures/cenarios/rotas.test.ts`; testes do runner e do relatório para o alvo.
- Atualizar `QA.md` e marcar 022 · A2 e J-A5 como resolvidas em `.plans/DECISOES-AUTONOMAS.md`, apontando para esta spec.

## O que não fazer

- Não subir servidor, não criar rota, header ou modo novo (`RITU_MODO`) só para eval: tudo entra pelas dependências que os handlers já recebem (`DepsDaRota`).
- Não mudar handler de rota, `conversar`, `continuar`, prompt, casos, métricas, metas ou `FAMILIAS`.
- Não reescrever relatórios e rodadas já gravados em `evals/resultados/`.
- Não rodar o `c4-site` nesta entrega.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Como chegar às rotas | Chamar os handlers exportados (`rotasDeFluxoDeRun`, `rotasDaConversa` e os de retornos e preferências) com `Request` de verdade, no mesmo processo do runner | É o código que o Next roda em cada rota; cada caso precisa do relógio e do clima do cenário, o que um servidor único não dá sem um modo de teste novo em produção |
| Sessão | `contaDaSessao` devolve a conta montada pelo cenário | Login e cookies já são cobertos pelo E2E; não abre porta dos fundos na autenticação |
| Quem pede | `quemPede` devolve `{ ipHash: "eval", escopo: <id do caso>, teto: 1000 }` | Cada caso com o próprio escopo de limite, como o E2E faz com `x-ritu-e2e` |
| Como obter `final` | O `conversation` do container é o do cenário embrulhado: guarda o que `conversar`, `continuar` e `aprovar` devolvem, sem mudar nada | As checagens dos casos leem a mesma forma de hoje; as checagens de rota leem o NDJSON e a visão |
| Casos de Intérprete e de apoio | Rodam como no `c3-confiavel` | Não existe rota que os chame isolados; o Intérprete já passa pela rota dentro dos casos de conversa |
| 429 de limite na rodada | Falha da rota, não inconclusivo | Um caso de eval cabe em qualquer limite; barrar é erro de ligação, que é o que o checkpoint procura |
| `c4-site` | Registrado, não rodado; sem entrada no histórico | Decisão da dona no portão 3: a entrega fecha só com o `c5-publico` |
| Ordem na entrega 4 | Antes da 023 | Bastidores e o README já nascem lendo um histórico que o `c5-publico` vai completar no fechamento |

## Contratos

**Cria**

`evals/llm/checkpoints.ts`:

```ts
export type AlvoDoCheckpoint = "codigo" | "rotas"
export const checkpoints = {
  "c1-base": { pastas: ["c1"], alvo: "codigo" },
  "c2-conversa": { pastas: ["c1", "c2"], alvo: "codigo" },
  "c3-confiavel": { pastas: ["c1", "c2", "c3"], alvo: "codigo" },
  "c4-site": { pastas: ["c1", "c2", "c3"], alvo: "rotas" },
  "c5-publico": { pastas: ["c1", "c2", "c3"], alvo: "rotas" },
} as const satisfies Record<string, { pastas: readonly string[]; alvo: AlvoDoCheckpoint }>
```

`test/fixtures/cenarios/rotas.ts`:

```ts
// Container das rotas com as dependências do cenário; o `conversation` é embrulhado para guardar o que devolve.
export function containerDoCenario(deps: DepsDoCenario): {
  container: Container
  devolvidos: Array<RespostaDaConversa | RespostaDoRun | ResultadoDaAprovacao>
}

export type PassoDeRota = {
  rota: string            // ex.: "POST /api/runs", "POST /api/runs/[id]/resposta"
  status: number
  eventos?: EventoDaTela[] // só nas rotas de fluxo (NDJSON)
  erroDeSchema?: string   // linha do NDJSON que não validou
}

export type RodadaPelasRotas = RodadaDoCenario & { passos: PassoDeRota[] }

export async function rodarCenarioPelasRotas(
  deps: DepsDoCenario,
  contaId: string,
  c: Cenario,
  opts?: OpcoesDaRodada & { escopo?: string },
): Promise<RodadaPelasRotas>
```

Mapa dos passos de `rodarCenario` para as rotas:

| Passo | Rota (handler) | Corpo |
|---|---|---|
| Mensagem e segunda mensagem | `POST /api/runs` (`rotasDeFluxoDeRun(deps).iniciar`) | `mensagemRecebidaSchema` |
| Resposta a uma pausa | `POST /api/runs/[id]/resposta` (`responder`) | `respostaDaPessoaSchema` |
| Bloco de aprovação | `POST /api/runs/[id]/aprovacao` (`rotasDaConversa(deps).aprovacao`) | `{ aprovadas: string[] }` |
| Troca de ingrediente | `POST /api/runs/[id]/troca` e `/troca/resposta` | os schemas de `src/app/_rotas/conversa.ts` |
| Toque de retorno | `POST /api/retornos/[id]` | o schema da rota (019) |
| Toque de gosto | `POST /api/preferencias` | o schema da rota (019) |

`scripts/lib/evals/rodar-rotas.ts`:

```ts
export async function rodarAcompanhantePelasRotas(/* mesmos parâmetros de rodarAcompanhante */): Promise<CasoRodado>
export async function rodarConversaPelasRotas(/* mesmos parâmetros de rodarConversa */): Promise<CasoRodado>
// checagens da lista "rota", na ordem dos critérios de aceite
export function checagensDeRota(passos: PassoDeRota[], run: Run): Checagem[]
```

Relatório (`scripts/lib/evals/relatorio.ts`): linha `- Alvo: código` ou `- Alvo: rotas do site` depois de `- Modelos:`; com alvo `rotas`, linha `Fluxo pelas rotas: N de M casos íntegros` logo abaixo do resumo de uma linha (íntegro = todas as checagens da lista `rota` verdadeiras).

**Usa**

- 014: runner, `CasoRodado`, `Checagem`, relatório, `historico.json`, `COMPARACAO.md`.
- 018 e 019: `rotasDeFluxoDeRun`, `rotasDaConversa`, rotas de retornos e preferências, `DepsDaRota`, `EventoDaTela`.
- 021: limites (`quemPede`, `teto`).
- 026: classes de inconclusivo, checagem prévia, roteador com até três chaves.
- Fixtures: `montarCenario`, `rodarCenario`, `DepsDoCenario`, `OpcoesDaRodada`, mapas de cenários.

## Evals (quando a spec toca agente, prompt, tool ou base)

- Determinísticos: o teste de equivalência (todos os cenários de conversa, pelas rotas × pelo código) e os testes de `checagensDeRota` (status ≠ 200, linha inválida, `fim` ausente, `run_id` diferente, texto diferente, 429).
- Com LLM: nenhum caso novo. A rodada ⚠️ do `c5-publico` é do fechamento da entrega 4, depois da 024.

## Nível das partes

- **nucleo** (Sonnet): `containerDoCenario` e `rodarCenarioPelasRotas` (montagem do container e ordem das pausas e da aprovação pelas rotas).
- Resto: mecânica.

## Leitura para a construção

- `QA.md` §"Checkpoints": regras da rodada (só para atualizar a tabela).
- `src/app/_rotas/fluxo-de-run.test.ts`: como os testes já chamam os handlers com `Request` e `DepsDaRota`.
- `test/fixtures/cenarios/rodar.ts` e `montar.ts`: a rodada que esta spec espelha.

## Dependências

- Specs 014, 018, 019, 021, 022, 026.
- Nenhuma biblioteca nova.

## Riscos e trade-offs

- Não testa a camada HTTP do Next (cookies, CSP, middleware): fica com o E2E. Em troca, cada caso roda com o próprio relógio e clima, sem modo de teste novo no código de produção.
- A rodada do `c5-publico` gasta o mesmo que a do `c3-confiavel` (cerca de 300 chamadas); as três chaves de desenvolvimento da 026 cobrem.

## Edge cases e modos de falha

- Run que fica aberto (pausa sem resposta além de `MAXIMO_DE_RETOMADAS`): mesma regra de `rodarCenario` (`MOTIVO_PAUSA_ACIMA_DO_TETO`).
- `RunAbertoError` no `POST /api/runs` da segunda mensagem: falha de rota ("havia um run aberto"), com o status na checagem.
- Linha do NDJSON cortada ou inválida: `erroDeSchema` no passo e checagem de rota falsa; o caso segue para as outras checagens com o que veio.
- Banco fora do ar ou cota esgotada no meio: inconclusivo, como na 026.

## Resultado (definição de pronto)

- Critérios de aceite verdes e spec `implemented` com o hash.
- No fechamento da entrega 4, depois da 024: `npm run eval:llm -- --checkpoint c5-publico` (⚠️, com `--retomar` até zero inconclusivos ou até o limite do dia), depois `npm run readme` para os blocos do README incluírem o `c5-publico`, e só então o relatório do portão 4.

## Arquivos e diretórios envolvidos

- `evals/llm/checkpoints.ts`
- `scripts/eval-llm.ts`
- `scripts/lib/evals/casos.ts`, `historico.ts`, `comando.ts`, `relatorio.ts`, `rodar-rotas.ts` (novo) e testes
- `test/fixtures/cenarios/rotas.ts` (novo), `rotas.test.ts` (novo), `index.ts`
- `.docs/QA.md`, `.plans/DECISOES-AUTONOMAS.md`
