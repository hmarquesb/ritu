---
title: Chás híbridos
status: implemented
implemented: d4461e7
entrega: 4
created: 2026-11-17
---

# Chás híbridos

> Toda erva da base marcada como "pode ser chá" vira um chá simples, com as qualidades lidas da própria erva. As misturas fixas continuam. Os padrões de chá deixam de apontar para um chá específico: passam a dizer "um chá", e o agente escolhe a erva que casa com o momento e com a casa.

## Contexto

Hoje os chás são só os 20 de `data/praticas.yaml`. Isso gera dois problemas:

1. Uma erva que a pessoa tem em casa e que vira chá (louro, alecrim, manjericão, chá-preto…) nunca é sugerida como chá.
2. Os padrões de chá apontam para um chá específico. "Com frio e agitada, o chá de gengibre com canela costuma ajudar" não vale num dia em que a regra da base barra esse chá (`agitada` barra a guna `movel`; decisão 2 do portão 2). O que ajuda a pessoa nesses momentos é tomar **um chá**, e a erva depende do dia.

As regras R1 (chás pelas ervas) e R2 (chás pelo virya) de `KNOWLEDGE.md` §8.1 já dizem como as qualidades de um chá saem das ervas. Esta spec aplica as duas a chás de uma erva só, gerados por código.

## Objetivo

- Seis ervas da base passam a ter chá simples derivado: louro, alecrim, manjericão, chá-preto, chá-mate e chá verde.
- Toda a cadeia (candidatos, casa, "evitar sempre", retorno, gosto, "vale ter em casa", validador, Juiz, Como pensei) trata o chá derivado como qualquer prática de chá, sem código especial fora da base e dos padrões.
- O padrão de chá vira genérico (`…|cha`): no caso `com_frio + agitada`, o agente sugere um chá que passa no filtro (ex.: louro), em vez de perder o padrão.

## Escopo

- **Dentro:** campo `cha` em `alimentos.yaml`; derivação dos chás simples ao montar a base; regra R9 e validações novas; item de padrão `cha`; migração das chaves de padrão já gravadas; prompt `acompanhante.v7`; evals determinísticos e casos com LLM no `c3`.
- **Fora:** misturas montadas pelo agente (só as fixas de `praticas.yaml`); tela nova (o chá derivado aparece como qualquer chá na 018–020); ervas fora da lista acima (noz-moscada, alho, cebola, sal, cebolinha, coentro fresco, orégano, salsinha e pimenta-do-reino ficam sem chá).

## Necessidade de negócio

A pessoa recebe chás com o que tem em casa, e não só com o que uma lista fixa previu. Isso deixa a indicação mais útil no dia a dia. A memória também passa a dizer o que de fato ajuda a pessoa (tomar um chá naquele estado) sem ficar presa a uma erva que nem sempre serve.

## Critérios de aceite

- [ ] `kb.praticas` tem 44 práticas fixas e 6 chás derivados (50 no total), e `kb.pratica("cha-louro")` devolve o chá de louro.
- [ ] Os campos do chá derivado seguem a tabela de derivação (Contratos). Teste de tabela cobre as seis ervas, com os valores esperados de `favorece_estados`, `contraindicacoes` e `momento`.
- [ ] Chá derivado nunca substitui um fixo: uma erva com campo `cha` cujo id derivado já existe em `praticas.yaml` é erro de validação.
- [ ] Erva com `cha` fora dos grupos `especiarias` e `bebidas`, ou cujo `favorece_estados` derivado sairia vazio, é erro de validação.
- [ ] Toda prática `tipo: cha` (fixa ou derivada) tem id começando com `cha-`. Toda prática de outro tipo, não.
- [ ] Com `com_frio + agitada`, à tarde, e só louro em casa entre as ervas: `cha-louro` está entre os candidatos de chá, e `cha-gengibre-canela` não está.
- [ ] Com louro como `acabou` ou "não tenho", `cha-louro` sai dos candidatos e a falta conta para o "vale ter em casa" (decisão 3 do portão 2).
- [ ] Com "evitar sempre" de uma erva, o chá derivado dela nunca é candidato.
- [ ] Chá-preto, chá-mate e chá verde só aparecem de manhã e à tarde, e nunca com `agitada` (marca `estimulante`).
- [ ] Retornos de qualquer chá (fixo ou derivado) contam para a chave `<estados>|cha`. A frase é "Quando você está {estados}, um chá costuma te ajudar."
- [ ] `padraoVale` de um padrão `…|cha` é verdadeiro quando pelo menos um chá da base passa no filtro da pessoa.
- [ ] A migração `0005_padroes_de_cha.sql` converte as chaves `…|pratica:cha-*` já gravadas para `…|cha`, junta as duplicadas e reescreve a frase. Teste de banco (`test:db`) cobre a junção.
- [ ] O Acompanhante usa `acompanhante.v7`, e os testes de prompt passam.
- [ ] `npm run base:check -- --producao` passa sem bloqueios, e `npm test` passa (fora a falha conhecida de `rota.test.ts` na VM).

## O que fazer

- Acrescentar o campo opcional `cha` ao schema de alimento e preenchê-lo nas seis ervas.
- Escrever `derivarChas` como função pura, com TDD, e chamá-la em `montar` (`knowledge-base.ts`) depois da validação dos dados crus.
- Acrescentar as regras de validação novas em `validate.ts`, numeradas depois das existentes.
- Trocar `ItemDoPadrao` para aceitar `{ tipo: "cha" }` e mapear para ele, na leitura dos retornos (`job.ts`), toda sugestão cuja prática é `tipo: cha`.
- Escrever a migração das chaves e a ADR 0049 ("Chás simples derivados das ervas e padrão de chá genérico").
- Criar `acompanhante.v7` a partir da v6, mudando só a linha de `padroes`.
- Atualizar `KNOWLEDGE.md` (§5.1 campo `cha`, §5.3 contagem e derivação, §8.1 regra R9) e `AI.md` na seção dos padrões, se ela citar o item do padrão.

## O que não fazer

- Não gravar os chás derivados em `praticas.yaml` (eles saem da erva; duplicar abriria divergência).
- Não deixar o agente montar mistura de ervas fora das fixas.
- Não mudar a frase dos padrões de preparo e de prática que não é chá.
- Não rodar `eval:llm` fora de checkpoint: os casos novos rodam na rodada nova do `c3-confiavel`, que já está pendente.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Ervas com chá derivado | Louro, alecrim, manjericão, chá-preto, chá-mate, chá verde | Escolha da dona. Noz-moscada fica fora por segurança; as demais não são chá caseiro comum |
| Onde nasce o chá derivado | Na montagem da base (`montar`), depois da validação | O resto do sistema lê `kb.praticas` e passa a tratar o derivado sem mudança |
| Chá fixo × derivado | Fixo vence; colisão de id é erro de validação | Os fixos têm momento e aviso revisados à mão |
| Id e nome | Id `cha-<id>` (ou o próprio id, se já começa com `cha-`); nome "Chá de {nome em minúscula}" (ou o próprio nome, se já começa com "Chá") | `cha-louro`, `cha-preto`; "Chá de louro", "Chá preto" |
| Momento | Erva com marca `estimulante`: manhã e tarde (R2). As outras: os cinco momentos | R2; sem fonte de horário para chá de erva |
| Padrão de chá | Item `cha` sem erva: chave `<estados>\|cha`, frase com "um chá" | Decisão do portão 2: o agente escolhe a erva |
| Padrões já gravados | Migração converte e junta (status: `confirmado` > `recusado` > `candidato`; soma as ocorrências) | Produção já tem dados; a conta não perde o que confirmou |
| Evals com LLM | Casos novos na pasta `c3` | Rodam na rodada nova do `c3-confiavel`, que já está pendente, sem chamada a mais |

## Contratos

**Cria**

`alimentos.yaml`: campo opcional novo, depois de `marcas`.

```yaml
cha:
  parte: folha            # folha | flor | semente | casca | raiz | bebida
  aviso: ""               # opcional; texto extra obrigatório, lido pela pessoa
```

Preenchimento:

| Erva | `cha.parte` |
|---|---|
| `louro` | folha |
| `alecrim` | folha |
| `manjericao` | folha |
| `cha-preto` | bebida |
| `cha-mate` | bebida |
| `cha-verde` | bebida |

Schema (`src/core/knowledge/schemas.ts`):

```ts
export const PARTES_DE_CHA = ["folha", "flor", "semente", "casca", "raiz", "bebida"] as const
export const chaDaErvaSchema = z.strictObject({
  parte: z.enum(PARTES_DE_CHA),
  aviso: z.string().max(200).optional(),
})
// em alimentoSchema:
cha: chaDaErvaSchema.optional(),
```

Derivação (`src/core/knowledge/chas.ts`):

```ts
export function idDoChaDerivado(erva: Alimento): string   // erva.id começa com "cha-" ? erva.id : `cha-${erva.id}`
export function derivarChas(
  alimentos: readonly Alimento[],
  estados: readonly EstadoInfo[],
): Pratica[]   // um chá por alimento com `cha`, na ordem de alimentos.yaml
```

| Campo da prática | Valor |
|---|---|
| `id` | `idDoChaDerivado(erva)` |
| `tipo` | `cha` |
| `nome` | `erva.nome` se começa com "Chá"; senão `Chá de ${minúscula(erva.nome)}` |
| `ingredientes` | `[erva.id]` |
| `preparo` | Pela parte. `folha` e `flor`: "Abafar {erva} em água quente por 5 a 10 minutos. Coar e beber morno." `semente`, `casca` e `raiz`: "Ferver {erva} em água por 5 a 10 minutos. Coar e beber morno." `bebida`: "Preparar sem açúcar e beber morno." `{erva}` = nome da erva em minúscula. Textos aprovados pela dona; ficam em `config/chas.ts` |
| `gunas` | `erva.gunas` (R1) |
| `efeito` | `erva.efeito` (R1) |
| `contraindicacoes` | `[com_calor]` se `virya: quente`; `[com_frio]` se `virya: frio` (R2) |
| `favorece_estados` | Estados (ordem de `ESTADOS`) que não estão em `contraindicacoes`, cujo `favorecer` tem alguma guna da erva, cujo `evitar_gunas` não tem nenhuma e cujo `evitar_marcas` não tem marca da erva (R1 e R7) |
| `momento` | Com marca `estimulante`: `[manha, tarde]`. Sem: os cinco momentos (R2) |
| `nunca_sugerir_se` | `erva.restricoes` |
| `aviso` | `erva.cha.aviso ?? ""` |
| `fontes` | `erva.fontes` + `{ ref: ritu-regras-da-base, campos: [gunas, efeito, favorece_estados, contraindicacoes, momento] }` |
| `confianca` | `erva.confianca` |

Valores esperados (teste de tabela):

| Chá | `favorece_estados` | `contraindicacoes` | `momento` |
|---|---|---|---|
| `cha-louro` | com_frio, pesada, agitada, sem_energia | com_calor | todos |
| `cha-alecrim` | com_frio, pesada, sem_energia | com_calor | todos |
| `cha-manjericao` | pesada, sem_energia | com_frio | todos |
| `cha-preto` | pesada, sem_energia | com_calor | manha, tarde |
| `cha-mate` | pesada, sem_energia | com_calor | manha, tarde |
| `cha-verde` | pesada, sem_energia | com_calor | manha, tarde |

Regras de validação novas (`validate.ts`, numeradas depois da última):

- `cha` só em alimento dos grupos `especiarias` ou `bebidas`.
- Id derivado não pode existir em `praticas.yaml`.
- `favorece_estados` derivado não pode sair vazio.
- Prática `tipo: cha` tem id com prefixo `cha-`; prática de outro tipo, não.

`KNOWLEDGE.md` §8.1, regra nova:

> **R9. Chás simples pelas ervas.** Erva ou especiaria com o campo `cha` vira um chá de uma erva só, montado por código: gunas e efeito da erva (R1), contraindicação e momento pelo virya e pela marca `estimulante` (R2), e estados favorecidos pela tabela de §3, como nos hábitos (R7). O chá fixo de `praticas.yaml` vence o derivado.

Padrões (`src/core/patterns/textos.ts`):

```ts
export type ItemDoPadrao = { tipo: "pratica" | "preparo"; id: string } | { tipo: "cha" }
// chaveDeAjuda(estados, { tipo: "cha" }) === `${estados}|cha`
// itemValido("cha") → { tipo: "cha" }
export const MODELO_AJUDA_CHA = "Quando você está {estados}, um chá costuma te ajudar."
export function fraseDeAjudaCha(estados: Estado[]): string
```

- `job.ts`, na leitura dos retornos: `sugestao.pratica_id` cuja prática na base é `tipo: cha` vira `{ tipo: "cha" }`. Prática que não está mais na base é ignorada.
- `detectar.ts`: grupo com item `cha` usa `fraseDeAjudaCha`.
- `padraoVale` (`vale.ts`): item `cha` vale se `kb.praticas.some(p => p.tipo === "cha" && passaNoFiltro(p, filtro, kb).passa)`.
- `semOsGuardados` e `estadosPorItem`: a chave do item `cha` é `"cha"`.

Migração `db/migrations/0005_padroes_de_cha.sql`, em uma transação:

1. Para cada `padroes` com `tipo = 'ajuda_em_estado'` e `chave ~ '\|pratica:cha-'`, calcular a chave nova (`split_part(chave, '|', 1) || '|cha'`).
2. Por `(conta_id, chave nova)`, manter uma linha: status por prioridade `confirmado` > `recusado` > `candidato`, `ocorrencias` somadas, `criado_em` o menor, `decidido_em` o da linha mantida.
3. Apagar as outras e gravar a chave nova e a frase nova, montada em SQL pelo mesmo modelo (os estados com os rótulos de `NA_FRASE`, unidos por " e ").

Prompt `src/core/agents/prompts/acompanhante.v7.ts`: igual à v6, com a linha de `padroes` trocada por:

> - padroes: regularidades que a pessoa confirmou. Quando um padrão fala do momento de agora e o que ele aponta está entre os candidatos, dê preferência a ele e diga isso em uma frase. Quando o padrão fala de "um chá", escolha entre os chás candidatos o que casa com o momento e com a casa. Padrão não autoriza nada fora dos candidatos.

`agente.ts` passa a importar `acompanhanteV7`.

**Usa**

- `KnowledgeBase`, `Pratica`, `Alimento`, `EstadoInfo`, `passaNoFiltro` (002).
- Candidatos com casa, gosto, resultado e faltas (007, 011; correção do portão 2 na 012).
- `ItemDoPadrao`, `chaveDeAjuda`, `lerChave`, `padraoVale`, `detectarPadroes`, job diário (012); cron (022).
- `RetornoRegistrado` e `sugestao.pratica_id` (011).

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos novos (`evals/det/base` e `evals/det/rotina-e-padroes`):

- `cha-derivado-campos`: a tabela de valores esperados das seis ervas.
- `cha-derivado-frio-agitada`: momento `com_frio + agitada`, tarde, casa com louro e canela → `cha-louro` entre os candidatos; nenhum chá com guna `movel`.
- `cha-derivado-acabou`: louro `acabou` → `cha-louro` fora dos candidatos e falta de louro registrada.
- `cha-estimulante-noite`: noite → nenhum entre `cha-preto`, `cha-mate` e `cha-verde`.
- `padrao-cha-generico`: 3 retornos `ajudou` com frio e agitada, um de chá de gengibre com canela e dois de chá de louro → um padrão `com_frio+agitada|cha` com a frase de "um chá".

Com LLM novos (pasta `c3`, rodam na rodada nova do `c3-confiavel`):

- `c3-s23-padrao-cha-agitada`: padrão confirmado "com frio e agitada, um chá", momento igual, casa com louro e gengibre. **Deve incluir** uma sugestão de chá que passe no filtro (`cha-louro` ou outro chá válido). **Não pode incluir** `cha-gengibre-canela`.
- `c3-s24-cha-da-casa`: com frio, à noite, só alecrim entre as ervas de casa. **Deve incluir** `cha-alecrim`. **Incerto:** se o texto cita o alecrim pelo nome.

## Nível das partes

- **nucleo** (Sonnet): migração dos padrões com o teste de banco; item `cha` no detector e no job.
- **conteudo** (Opus): conferir o campo `cha` das seis ervas e a regra R9 no `KNOWLEDGE.md` (os textos de preparo já estão aprovados nesta spec).

O resto é mecânica.

## Leitura para a construção

- `KNOWLEDGE.md` §3 (tabela de estados), §5.3 (formato de `praticas.yaml`) e §8.1 (R1, R2, R7).
- `.specs/012-rotina-e-padroes.md`, seção "Chave e frase do padrão" e "Detecção".
- `.local/PORTAO-2-DECISOES.md`, decisões 2 e 3 e "Spec nova: chás híbridos".

## Dependências

- Specs 002, 007, 011, 012 (com as correções do portão 2) e 022 (migrações em produção pelo `db:migrate`).
- Sem biblioteca nova.

## Riscos e trade-offs

- **Sem mistura livre:** a pessoa que faz chá de duas ervas que não estão nas misturas fixas não recebe essa sugestão. A troca é validação simples e textos revisados.
- **Padrão genérico perde a erva:** a memória não diz mais "gengibre com canela ajuda". O gosto (011) continua guardando a preferência por um chá específico, e a ordenação usa o gosto.
- **Os estimulantes como chá:** chá-preto, chá-mate e chá verde passam a ser sugestão. R2 e a marca `estimulante` limitam o horário e barram `agitada`.

## Edge cases e modos de falha

- Erva com `cha` sem estado favorecido: a base não carrega (validação), e o `base:check` mostra a erva.
- Retorno antigo de um chá que saiu da base: ignorado no detector, como hoje.
- Padrão `…|cha` com nenhum chá no filtro da pessoa (ex.: "evitar sempre" de todas as ervas): `padraoVale` falso, e o padrão não entra no prompt.
- Migração com duas linhas `confirmado` para a mesma chave nova: mantém uma, com as ocorrências somadas.
- Conta com o padrão `…|cha` já `recusado`: o detector não propõe de novo (regra de `semOsGuardados`).

## Resultado (definição de pronto)

- Os critérios de aceite estão marcados, com testes e evals determinísticos passando na CI.
- A migração `0005` foi aplicada em produção (`db:migrate` com a URL unpooled), e o deploy foi feito com a `main`.
- `KNOWLEDGE.md`, ADR 0049, `.specs/README.md` e `ROADMAP.md` §0 estão atualizados, e o status da spec está como `implemented` com o hash.

## Arquivos e diretórios envolvidos

- `data/alimentos.yaml`
- `config/chas.ts`
- `src/core/knowledge/schemas.ts`, `chas.ts` (novo), `knowledge-base.ts`, `validate.ts`
- `src/core/patterns/textos.ts`, `detectar.ts`, `job.ts`, `vale.ts`
- `src/core/agents/prompts/acompanhante.v7.ts` (novo), `src/core/agents/companion/agente.ts`
- `db/migrations/0005_padroes_de_cha.sql`
- `evals/det/base/`, `evals/det/rotina-e-padroes/`, `evals/llm/casos/c3/`
- `.docs/KNOWLEDGE.md`, `.adrs/0049-chas-derivados-e-padrao-de-cha.md`
