# 002 · Correção C13: alimentos aceitos por vaga

Spec: `.specs/002-base-conhecimento.md`, seção "Correção C13". Entra antes da 008.

Hoje a vaga aceita qualquer alimento da `funcao` (e, se houver, de um dos `grupos`). Os três lugares que decidem isso:
`src/core/knowledge/filtros.ts` (`candidatosDaVaga`), `src/core/agents/companion/validador.ts:122` (violação `estrutura`) e `src/core/knowledge/validate.ts:244` (mínimo de alimentos por vaga).

### T1 · Add the explicit food list to preparation slots
- nivel: mecanica
- objetivo: a vaga de um preparo pode listar os alimentos aceitos (`alimentos`), e os três lugares que decidem se um alimento serve à vaga passam a usar uma única função.
- arquivos: `src/core/knowledge/schemas.ts`, `src/core/knowledge/schemas.test.ts`, `src/core/knowledge/filtros.ts`, `src/core/knowledge/filtros.test.ts`, `src/core/knowledge/validate.ts`, `src/core/knowledge/validate.test.ts`, `src/core/agents/companion/validador.ts`, `src/core/agents/companion/validador.test.ts` (se existir; senão o teste do validador que já cobre `estrutura`)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // vagaSchema ganha
  alimentos: z.array(idSchema).min(1).optional()
  // refine no vagaSchema (ou no preparoSchema): `alimentos` e `grupos` não vêm juntos
  // nova função pura, exportada de src/core/knowledge/filtros.ts
  export function serveAVaga(alimento: Alimento, vaga: Pick<Vaga, "funcao" | "grupos" | "alimentos">): boolean
  //  - com vaga.alimentos: alimento.id está na lista E alimento.funcoes inclui vaga.funcao
  //  - sem: alimento.funcoes inclui vaga.funcao E (sem grupos OU grupos inclui alimento.grupo)
  ```
  - `candidatosDaVaga`, o validador do Acompanhante (`estrutura`) e o mínimo de `validate.ts` passam a chamar `serveAVaga`; nenhum deles repete a regra.
  - Validação cruzada em `validate.ts` (`validarBase`): cada id de `vaga.alimentos` existe em `alimentos` e tem a `funcao` da vaga; senão, erro no formato dos outros erros do arquivo (ex.: `preparos:<id>:vagas[<i>].alimentos "<alimento>" não existe` / `... não tem a função "<funcao>"`). O mínimo `config.base.minAlimentosPorVaga` (3) vale também para vaga com `alimentos`; `excecoesMinAlimentosPorVaga` continua valendo.
- testes primeiro:
  - schema: vaga com `alimentos` válida; `alimentos: []` recusada; `alimentos` + `grupos` recusada.
  - `serveAVaga`: com lista, aceita só ids da lista com a função; recusa id da lista sem a função; sem lista, comportamento atual (função e grupo).
  - `validarBase`: id inexistente em `alimentos` gera erro; id sem a função gera erro; vaga com lista de 2 gera erro de mínimo, a não ser que esteja em `excecoesMinAlimentosPorVaga`.
  - validador do Acompanhante: item fora da lista da vaga gera violação `estrutura`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run base:check`
- pronto quando: todos verdes com o `data/` atual (que ainda não usa `alimentos`); a regra vive só em `serveAVaga`.
- fora: `data/*.yaml`, `evals/`, `config/`.

### T2 · Restrict slot foods in the preparations
- nivel: conteudo
- objetivo: aplicar `alimentos` nas vagas de `data/preparos.yaml` e corrigir a concordância dos `passos`.
- arquivos: `data/preparos.yaml`, `config/base.ts` (só se a lista `excecoesMinAlimentosPorVaga` mudar)
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Campo novo da vaga: `alimentos: [<ids de data/alimentos.yaml>]`, ao menos 1; não pode vir junto com `grupos` (tire `grupos` da vaga que ganhar `alimentos`). Cada id precisa existir e ter a `funcao` da vaga. Mínimo de 3 ids por vaga, exceto as vagas de `config/base.ts` `excecoesMinAlimentosPorVaga`.
  - Vaga a vaga:
    - `base` de `kitchari`, `arroz-papa` e de todo preparo cozido em grão (ex.: `arroz-com-legume`, `arroz-com-leguminosa`, `mingau` se a base for grão): só grãos em grão (arroz e os demais cereais inteiros da base). Pão, macarrão, tapioca e farinhas ficam só nos preparos em que são a base de fato (`tapioca-recheada`, `cuscuz-no-vapor`, `torrada-com-gordura`, `macarrao-com-legume`, `polenta-mole`).
    - `tempero` de sopas, caldos e cozidos (`sopa`, `sopa-creme`, `caldo`, `kitchari`, `leguminosa-cozida`, `arroz-*`, `refogado`, `folhas-refogadas` e afins): especiarias e ervas de cozinha. `camomila`, `capim-limao` e `erva-cidreira` saem.
    - `mingau` ganha a vaga `liquido` (`obrigatoria: true`) com água, leite e as bebidas vegetais da base (os ids com a função `liquido`). Ajuste os `passos` do mingau para usar a lacuna nova.
    - `leite-morno-com-especiaria:liquido` passa a `alimentos: [leite]` e segue em `excecoesMinAlimentosPorVaga`.
  - `passos`: lacuna seguida de adjetivo não pode pedir concordância (`{legume} picado` vira `{legume} em pedaços`; vale para masculino e feminino, singular e plural). Teto de 400 caracteres por `passos`.
  - Não invente fonte nem mude outro campo além de `vagas` e `passos`.
- testes primeiro: nenhum (conteúdo); a conferência é o `base:check` e os evals.
- comandos: `npm run base:check`, `npm test`, `npm run eval:det`
- pronto quando: `base:check` sem erros; todos os evals determinísticos existentes verdes (os da 007 inclusos).
- fora: `src/`, `evals/`, outros arquivos de `data/`.

### T3 · Add the slot eval
- nivel: mecanica
- objetivo: eval determinístico que protege a C13.
- arquivos: `evals/det/base/vagas.eval.ts`
- leitura: nenhuma
- skills: nenhuma
- referencia: os outros arquivos de `evals/det/base/` (padrão de carregar a base real pelo container)
- contratos:
  - Base real pelo container, como em `evals/det/base/base-valida.eval.ts`.
  - Opções de uma vaga = `candidatosDaVaga(vaga, kb)` (`src/core/knowledge/filtros.ts`).
  - Preparos cozidos em grão: `kitchari`, `arroz-papa`, `arroz-com-legume`, `arroz-com-leguminosa`. Na vaga `base` deles, nenhuma opção cujo id case com `/pao|macarrao|tapioca|farinha|cuscuz|polenta|torrada/`.
  - Ervas só de chá: `camomila`, `capim-limao`, `erva-cidreira` (constante no eval). Em nenhuma vaga `tempero` de nenhum preparo elas aparecem como opção.
  - `mingau` tem vaga `liquido` obrigatória, com opções só de ids com a função `liquido`.
  - Nenhum `passos` tem lacuna seguida de adjetivo: regex `/\}\s+(picad|cortad|ralad|amassad|fatiad|cozid|assad|refogad|picadinh)[oa]s?\b/`.
- testes primeiro: o próprio eval (deve passar depois da T2).
- comandos: `npm run lint`, `npm run typecheck`, `npm run eval:det`
- pronto quando: o eval passa com o `data/` atual.
- fora: `src/`, `data/`.
