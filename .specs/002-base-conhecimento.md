---
title: Base de conhecimento
status: implemented
implemented: eb3226a
entrega: 1
created: 2026-11-14
---

# Base de conhecimento

> Entrega a base ayurvédica do Ritu: os arquivos de `data/` com schema e validação, o conteúdo (130 alimentos, 30 preparos, 44 práticas e as tabelas de apoio), as funções puras que cruzam momento, qualidades e alimentos, e as quatro tools `ayurveda.*`. É de onde sai todo motivo que o agente dá à pessoa.

## Contexto

O Ritu não deixa o modelo "saber" Ayurveda: todo motivo vem de uma linha de tabela, com id e fonte (`AI.md` §2). O momento, o clima, os doshas, os alimentos e as práticas falam a mesma língua, as qualidades, e o cruzamento é feito por código. Sem a base e sem essas funções, nenhuma das specs seguintes (preparo, validador, trocas, juiz) tem o que consultar nem como conferir.

## Objetivo

Depois desta spec:

- `npm run base:check` valida `data/` inteiro e termina com código 0, com os mínimos de cobertura atendidos.
- Qualquer código do core recebe a base pelo container (`getContainer().knowledge`) e chama as funções e tools desta spec sem rede, sem banco e sem LLM.
- Um conjunto de estados do momento vira qualidades buscadas, e delas saem candidatos, substitutos e conflitos de combinação, sempre com a linha da base.

## Escopo

- **Dentro:**
  - Vocabulário fechado (qualidades, sabores, estados, funções, grupos, momentos do dia).
  - Schemas zod e validação cruzada de `alimentos`, `preparos`, `praticas`, `combinacoes`, `doshas`, `estados`, `incomodos`, `quiz`, `grupos_evitar`, `vocabulario` e `fontes`.
  - Conteúdo de todos esses arquivos.
  - Porta `KnowledgeBase`, adaptador que lê os YAML, fake com mini-tabela, registro no container.
  - Funções puras: qualidades do momento, nota de adequação, filtros da pessoa, substitutos, combinação, identificação de alimento pelo nome, momento do dia pela hora.
  - Contrato de tool e as tools `ayurveda.alimento`, `ayurveda.candidatos`, `ayurveda.substitutos`, `ayurveda.checar_combinacao`.
  - Script `base:check` e evals determinísticos da base.
- **Fora:**
  - Clima → qualidades e fuso da cidade (003). Aqui as qualidades do clima entram como parâmetro.
  - Casa, gostos, resultados e "evitar sempre" guardados (004). Aqui chegam como estruturas simples.
  - Preparo completo, ordenação com casa, gosto e resultado, novidade, faltas e validador (007).
  - Lista de sinais de alerta e padrões de injection (013).
  - Cálculo do resultado do quiz e telas (017 e 020).
  - Registro das tools na Mastra (005 e 007).

## Necessidade de negócio

"Explica o porquê" e "parte do que há em casa" (`BUSINESS.md` §2) só existem se cada alimento tiver qualidades conferíveis e se a troca de ingrediente for feita por tabela. A base grande (o dobro do mínimo necessário para funcionar) faz o agente achar o que a pessoa tem em casa na maior parte das vezes, e mostra grounding de verdade em vez de conhecimento do modelo.

## Critérios de aceite

- [ ] `npm run base:check` termina com código 0 e imprime: contagem por arquivo, contagem por grupo de alimento e por tipo de prática, número de linhas com `a_confirmar` e a lista de erros (vazia).
- [ ] `npm run base:check -- --producao` termina com código 1 enquanto existir linha com `ref: a_confirmar`.
- [ ] `data/alimentos.yaml` tem exatamente os 130 ids da lista de "Contratos"; `data/preparos.yaml`, os 30; `data/praticas.yaml`, os 44.
- [ ] O schema recusa qualidade fora das 12 (`umido`, `estimulante` e `nutritivo` são recusados), alimento com as duas qualidades de um mesmo par, e `efeito` fora de -2 a +2.
- [ ] A validação cruzada acusa, cada um com teste próprio: id repetido; `ref` de fonte inexistente; ingrediente de prática ou item de combinação que não existe; placeholder de `passos` ou de `titulo` sem vaga correspondente; `titulo` sem lacuna de vaga obrigatória; vaga de preparo com menos de 3 alimentos possíveis; prática `oleo` sem ingrediente do grupo `oleos`; alimento de laticínio, ovo, oleaginosa, trigo ou soja sem o `grupos_evitar` certo; óleo vegetal sem `observacao`; pergunta do quiz sem uma opção por dosha; estado ou qualidade sem linha em `estados.yaml` ou `vocabulario.yaml`; mínimos de cobertura não atendidos.
- [ ] Nenhuma `ref` diferente de `a_confirmar` aparece numa linha sem estar em `fontes.yaml`; toda fonte com `url` tem `acessado_em`.
- [ ] `qualidadesDoMomento` devolve, para cada um dos 7 estados, as qualidades presentes e buscadas de `estados.yaml`; para `com_calor` + `pesada` devolve o conflito `quente`/`frio`; para dor de cabeça sem variante devolve `precisa_variante` com as 3 opções.
- [ ] `notaAdequacao` dá nota maior a um alimento com duas qualidades buscadas do que a um com uma, e menor a um com qualidade oposta; sem prakriti, o campo `efeito` não muda a nota.
- [ ] `passaNoFiltro`: grupo `leite` em "evitar sempre" tira leite, iogurte, queijo, ricota, manteiga e ghee, o preparo `leite-morno-com-especiaria` e toda prática com esses ingredientes; `gergelim` tira `oleo-pes-gergelim`, `oleo-barriga-gergelim` e `oleo-corpo-gergelim`; item do tipo `texto` tira o alimento cujo nome ou sinônimo bate.
- [ ] `ayurveda.substitutos`: devolve só alimentos da mesma função, com o mesmo efeito térmico, ordenados por qualidades em comum e, no empate, casa → gosta → ajudou; respeita os filtros e as combinações com os outros itens; sem substituto devolve lista vazia; o motivo sai no formato "Troquei canela por cardamomo: os dois aquecem."
- [ ] `ayurveda.checar_combinacao` acusa cada linha de `combinacoes.yaml` (por alimento, por grupo e por marca) e devolve `compativel: true` quando não há conflito.
- [ ] `ayurveda.alimento` aceita id, nome ou sinônimo, com ou sem acento e maiúscula, e devolve os não encontrados em `desconhecidos`.
- [ ] Toda saída de tool traz `linha_base` no formato `<tabela>:<id>`, e `kb.linha(ref)` devolve a linha para todas elas.
- [ ] `getContainer().knowledge` carrega a base uma vez só e não lê arquivo na importação do módulo.
- [ ] `npm test` e `npm run eval:det` passam sem rede; os evals de "Evals" existem e passam com a base real.

## O que fazer

- Escrever primeiro vocabulário, schemas, validação e a mini-base de teste; depois as funções e as tools, com TDD sobre a mini-base; por último o conteúdo.
- Despachar o conteúdo ao `redator-base` em lotes pequenos: um grupo de alimentos por tarefa, preparos em dois lotes, práticas por tipo, e uma tarefa para cada arquivo de apoio. Cada tarefa leva o schema, a lista de ids do lote e o comando `npm run base:check`.
- No conteúdo, consultar as fontes pela internet **uma vez**, nesta spec: o redator abre as páginas das fontes permitidas, registra cada uma em `fontes.yaml` com a URL aberta e a data, e cita a `ref` só nas linhas cujo valor estava na página.
- Dar ao subagente `redator-base` as ferramentas de busca e leitura de páginas (`WebSearch`, `WebFetch`).
- Atualizar `KNOWLEDGE.md` no fechamento, se algum schema mudar durante a construção.

## O que não fazer

- Não escrever título, página, edição ou URL de memória. Sem página aberta nesta tarefa, a linha entra com `fontes: [{ ref: a_confirmar, campos: [...] }]` e `confianca: baixa`.
- Não usar fonte fora da lista permitida como `ref` confirmada. Página útil de outro site entra em `fontes.yaml` com `aprovada: false`, e as linhas que a citam ficam com `confianca: baixa`.
- Não incluir carnes, peixes, frutos do mar, suplementos, fitoterápicos nem óleos essenciais.
- Não escrever promessa de saúde, dosagem ou linguagem de tratamento em nenhum texto da base.
- Não importar `yaml` nem `node:fs` no core.
- Não criar tool de escrita, nem tool que leia casa, clima ou histórico.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Vocabulário de qualidades | 12 ids fechados, em 6 pares. "Úmido" é `oleoso`, "estimulante" é `movel`, "nutritivo" é `pesado` | Decisão da dona. Um vocabulário só para momento, clima, alimento e prática; a pessoa vê verbos, não ids |
| Carnes e peixes | Fora da base | Decisão da dona. As fontes de culinária ayurvédica são vegetarianas; proteína vem de ovos, laticínios e leguminosas. Os grupos `peixe` e `frutos_do_mar` continuam em `grupos_evitar.yaml` |
| Tamanho | 130 alimentos, 30 preparos, 44 práticas, com ids fixados nesta spec | Decisão da dona: a busca do conteúdo é feita uma vez, então não vale economizar |
| Óleos | Todo óleo vegetal leva `observacao` com "prensado a frio"; o texto das práticas de óleo diz o mesmo | Decisão da dona |
| Verbos das qualidades | Tabela de `vocabulario.yaml` em "Contratos" | Aprovada pela dona |
| Tabela do momento | Arquivo próprio, `data/estados.yaml` | Cada linha precisa de fonte, como o resto da base; não é número de configuração |
| Momentos do dia | `manha`, `almoco`, `tarde`, `jantar`, `noite`, pela hora local, com as faixas em `config/momento-do-dia.ts` | Os exemplos dos docs misturavam refeição e período; um conjunto só serve a preparos e práticas |
| Grupos para combinações | `grupo:<grupo>`, `marca:<marca>` e `alimento:<id>`; marcas fechadas: `fruta_azeda`, `fruta_doce`, `fermentado`, `estimulante` | "Frutas azedas" não é grupo; a marca `estimulante` também serve ao "evitar" dos estados |
| Linha da base | Texto `<tabela>:<id>` (`alimentos:abobora`, `incomodos:dor-de-cabeca/latejante`) | O validador e o Juiz conferem a existência com `kb.linha()` |
| Leitura do YAML | Pacote `yaml`, só em `src/infra/knowledge/`; carregada uma vez por processo; `next.config.ts` inclui `data/**` no rastreamento de arquivos | O core fica só com zod; na Vercel os arquivos precisam ir junto com a função |
| Fontes pela internet | Permitidas: páginas do Ayurvedic Institute (`ayurveda.com`) e da Banyan Botanicals (`banyanbotanicals.com`). Livro sem página aberta = `a_confirmar` | `KNOWLEDGE.md` §7 e §8: nada de fonte de memória |
| `a_confirmar` em produção | A linha é usada em desenvolvimento, testes e evals; `base:check --producao` falha enquanto houver alguma, e a spec 022 roda esse comando antes de publicar | A dona confere no portão 1; a trava fica no caminho de produção, não no carregamento |
| Nota de adequação | Função desta spec, com pesos em `config/adequacao.ts`; a ordenação completa (casa, gosto, resultado) é da 007 e soma por cima | `ayurveda.candidatos` e `ayurveda.substitutos` precisam ordenar sem depender da 007 |
| Contrato de tool | Tipo `Tool` em `src/core/agents/tools/tool.ts`, criado aqui | Esta é a primeira spec com tools; as seguintes usam o mesmo tipo |
| Nome não reconhecido | `identificarAlimento` devolve `desconhecido`; nada é adivinhado por semelhança | "Em dúvida, o Ritu não sugere" (`BUSINESS.md` §12) |

## Contratos

### Cria

**Vocabulário (`src/core/knowledge/vocab.ts`)**, cada um como `as const` com o tipo e o schema zod:

| Constante | Valores |
|---|---|
| `GUNAS` | `quente`, `frio`, `pesado`, `leve`, `oleoso`, `seco`, `estavel`, `movel`, `suave`, `aspero`, `intenso`, `brando` |
| `OPOSTO` | `quente↔frio`, `pesado↔leve`, `oleoso↔seco`, `estavel↔movel`, `suave↔aspero`, `intenso↔brando` |
| `RASAS` | `doce`, `azedo`, `salgado`, `picante`, `amargo`, `adstringente` |
| `VIRYAS` | `quente`, `frio` |
| `VIPAKAS` | `doce`, `azedo`, `picante` |
| `DOSHAS` | `vata`, `pitta`, `kapha` |
| `ESTADOS` | `com_frio`, `com_calor`, `pesada`, `seca`, `agitada`, `irritada`, `sem_energia` |
| `MOMENTOS_DO_DIA` | `manha`, `almoco`, `tarde`, `jantar`, `noite` |
| `FUNCOES` | `base`, `legume`, `folha`, `proteina`, `gordura`, `tempero`, `liquido`, `fruta`, `adocante` |
| `GRUPOS` | `frutas`, `folhas`, `legumes`, `raizes`, `graos`, `leguminosas`, `laticinios`, `ovos`, `oleaginosas`, `oleos`, `especiarias`, `adocantes`, `bebidas` |
| `DURABILIDADES` | `curta`, `media`, `longa` |
| `RESTRICOES` | `vegetariana`, `vegana`, `sem_lactose`, `sem_gluten` |
| `GRUPOS_EVITAR` | `amendoim`, `castanhas`, `leite`, `ovo`, `soja`, `trigo`, `gergelim`, `peixe`, `frutos_do_mar` |
| `MARCAS` | `fruta_azeda`, `fruta_doce`, `fermentado`, `estimulante` |
| `TIPOS_PRATICA` | `cha`, `oleo`, `pratica` |
| `CONFIANCAS` | `alta`, `media`, `baixa` |
| `TEMAS_QUIZ` | `corpo`, `pele`, `apetite_digestao`, `sono`, `clima`, `estresse`, `ritmo_energia`, `peso` |

Ids são kebab-case sem acento (`^[a-z0-9]+(-[a-z0-9]+)*$`), exceto os de `ESTADOS`.

**Schemas (`src/core/knowledge/schemas.ts`)**

```ts
type FonteRef = { ref: string; campos: string[] }           // ref existe em fontes.yaml, ou "a_confirmar"

type Alimento = {
  id: string; nome: string; sinonimos: string[]
  grupo: Grupo; durabilidade: Durabilidade
  funcoes: Funcao[]                                           // 1 ou mais
  rasa: Rasa[]; virya: Virya; vipaka: Vipaka                  // rasa: 1 ou mais
  gunas: Guna[]                                               // 1 a 4, nunca os dois de um par
  efeito: { vata: number; pitta: number; kapha: number }      // inteiros de -2 (equilibra muito) a +2 (agrava muito)
  como_equilibrar: Partial<Record<Dosha, string>>             // frase curta, até 120 caracteres
  restricoes: Restricao[]                                     // quem evita este alimento
  grupos_evitar: GrupoEvitar[]
  marcas: Marca[]
  observacao?: string                                         // lida pela pessoa, até 120 caracteres
  fontes: FonteRef[]; confianca: Confianca; notas: string     // fontes: 1 ou mais
}

type Vaga = { funcao: Funcao; obrigatoria: boolean; maximo: number; grupos?: Grupo[] }  // maximo padrão 1
type Preparo = {
  id: string; nome: string
  titulo: string                                              // até 60 caracteres; lacunas {funcao} só de vagas existentes, com pelo menos uma de vaga obrigatória
  vagas: Vaga[]                                               // 1 ou mais obrigatória
  gunas_do_preparo: Guna[]
  passos: string                                              // até 400 caracteres; placeholders {funcao} só de vagas existentes
  momento: MomentoDoDia[]                                     // 1 ou mais
  contraindicacoes: Estado[]
  fontes: FonteRef[]; confianca: Confianca
}

type Pratica = {
  id: string; tipo: TipoPratica; nome: string
  ingredientes: string[]                                      // ids de alimentos; vazio só em tipo "pratica"
  preparo: string                                             // como fazer, até 300 caracteres
  gunas: Guna[]
  favorece_estados: Estado[]                                  // 1 ou mais
  efeito: { vata: number; pitta: number; kapha: number }
  momento: MomentoDoDia[]
  contraindicacoes: Estado[]
  nunca_sugerir_se: Restricao[]
  aviso: string                                               // texto extra obrigatório, ou ""
  fontes: FonteRef[]; confianca: Confianca
}

type Combinacao = { id: string; itens: string[]; motivo: string; fontes: FonteRef[]; confianca: Confianca }
// itens: 2 ou mais, cada um "alimento:<id>" | "grupo:<grupo>" | "marca:<marca>"

type DoshaInfo = {
  id: Dosha; nome: string; elementos: string[]; resumo: string
  gunas: Guna[]; equilibra_gunas: Guna[]; equilibra_rasas: Rasa[]
  caracteristicas: { corpo: string; mente: string; digestao: string }
  desequilibra: string; equilibra: string
  fontes: FonteRef[]
}

type EstadoInfo = {
  id: Estado; rotulo: string; emoji: string; eixo: "temperatura" | "corpo" | "mente"
  presentes: Guna[]; favorecer: Guna[]; evitar_gunas: Guna[]; evitar_marcas: Marca[]
  evitar_texto: string                                        // "gelados e crus"; vira o "Evite agora"
  fontes: FonteRef[]; confianca: Confianca
}

type Incomodo = {
  id: string; nome: string; palavras: string[]                // como a pessoa costuma dizer
  pergunta?: string                                           // obrigatória com mais de uma variante
  variantes: {                                                // 1 ou mais; com uma só, id "unica"
    id: string; opcao: string
    presentes: Guna[]; favorecer: Guna[]; evitar_gunas: Guna[]; evitar_marcas: Marca[]; evitar_texto: string
  }[]
  fontes: FonteRef[]; confianca: Confianca
}

type PerguntaQuiz = {
  id: string; tema: TemaQuiz; texto: string
  opcoes: { dosha: Dosha; texto: string }[]                   // exatamente 3, uma por dosha
  fontes: FonteRef[]
}

type GrupoEvitarInfo = { id: GrupoEvitar; nome: string; palavras: string[] }
type VocabuloGuna = { guna: Guna; nome: string; verbo: string | null }
type Fonte = { ref: string; titulo: string; autor: string; edicao?: string; pagina?: string; url?: string; acessado_em?: string; aprovada: boolean }
```

**Arquivos de `data/`**: `alimentos.yaml`, `preparos.yaml`, `praticas.yaml`, `combinacoes.yaml`, `doshas.yaml`, `estados.yaml`, `incomodos.yaml`, `quiz.yaml`, `grupos_evitar.yaml`, `vocabulario.yaml`, `fontes.yaml`. Cada um é uma lista do tipo correspondente.

**Alimentos (130 ids, por grupo)**

| Grupo | Durabilidade | Ids |
|---|---|---|
| `frutas` (21) | curta; `tamara`, `uva-passa` e `ameixa-seca`: longa | `banana`, `maca`, `pera`, `mamao`, `manga`, `laranja`, `tangerina`, `limao`, `abacate`, `abacaxi`, `melancia`, `melao`, `uva`, `morango`, `goiaba`, `maracuja`, `caqui`, `coco`, `tamara`, `uva-passa`, `ameixa-seca` |
| `folhas` (8) | curta | `couve`, `espinafre`, `alface`, `rucula`, `agriao`, `repolho`, `acelga`, `escarola` |
| `legumes` (14) | curta | `abobora`, `abobrinha`, `chuchu`, `quiabo`, `tomate`, `pepino`, `vagem`, `berinjela`, `pimentao`, `brocolis`, `couve-flor`, `milho-verde`, `ervilha`, `jilo` |
| `raizes` (9) | media | `cenoura`, `beterraba`, `batata-doce`, `batata`, `mandioca`, `inhame`, `mandioquinha`, `nabo`, `rabanete` |
| `graos` (11) | longa; `pao`: media | `arroz-branco`, `arroz-integral`, `aveia`, `fuba`, `cuscuz-de-milho`, `canjica`, `tapioca`, `farinha-de-mandioca`, `pao`, `macarrao`, `quinoa` |
| `leguminosas` (9) | longa; `tofu`: media | `feijao-preto`, `feijao-carioca`, `feijao-fradinho`, `lentilha`, `lentilha-vermelha`, `grao-de-bico`, `feijao-mungo`, `ervilha-partida`, `tofu` |
| `laticinios` (5) | media | `leite`, `iogurte-natural`, `queijo-minas`, `ricota`, `manteiga` |
| `ovos` (1) | media | `ovo` |
| `oleaginosas` (10) | longa | `castanha-de-caju`, `castanha-do-para`, `amendoa`, `noz`, `amendoim`, `gergelim`, `linhaca`, `chia`, `semente-de-girassol`, `semente-de-abobora` |
| `oleos` (5) | longa | `ghee`, `azeite`, `oleo-de-coco`, `oleo-de-gergelim`, `oleo-de-girassol` |
| `especiarias` (27) | longa; ervas frescas (`hortela`, `coentro-fresco`, `salsinha`, `cebolinha`, `manjericao`, `pimenta-fresca`): curta; `gengibre`, `alho` e `cebola`: media | `gengibre`, `canela`, `cardamomo`, `cominho`, `coentro-em-grao`, `erva-doce`, `curcuma`, `pimenta-do-reino`, `cravo`, `noz-moscada`, `mostarda-em-grao`, `louro`, `anis-estrelado`, `pimenta-fresca`, `hortela`, `camomila`, `capim-limao`, `erva-cidreira`, `coentro-fresco`, `salsinha`, `cebolinha`, `manjericao`, `alecrim`, `oregano`, `alho`, `cebola`, `sal` |
| `adocantes` (4) | longa | `mel`, `acucar-mascavo`, `rapadura`, `melado` |
| `bebidas` (6) | longa; `agua-de-coco` e `leite-de-coco`: media | `agua-de-coco`, `leite-de-coco`, `cafe`, `cha-preto`, `cha-mate`, `cha-verde` |

Regras fixas do conteúdo dos alimentos:

- `grupos_evitar`: `leite` em todos os laticínios e no `ghee`; `ovo` no `ovo`; `soja` no `tofu`; `trigo` em `pao` e `macarrao`; `amendoim` no `amendoim`; `castanhas` em `castanha-de-caju`, `castanha-do-para`, `amendoa` e `noz`; `gergelim` em `gergelim` e `oleo-de-gergelim`.
- `restricoes`: `vegana` em laticínios, `ghee`, `ovo` e `mel`; `sem_lactose` em laticínios, exceto `ghee` e `manteiga`; `sem_gluten` em `pao`, `macarrao` e `aveia`.
- `marcas`: `estimulante` em `cafe`, `cha-preto`, `cha-mate` e `cha-verde`; `fermentado` em `iogurte-natural`; `fruta_azeda` e `fruta_doce` conforme a fonte.
- `observacao` em `azeite` ("Prefira o extravirgem, prensado a frio.") e em `oleo-de-coco`, `oleo-de-gergelim` e `oleo-de-girassol` ("Prefira o prensado a frio."; no de gergelim, acrescentar "e não torrado").

**Preparos (30 ids)**

`mingau`, `sopa`, `sopa-creme`, `caldo`, `arroz-papa`, `arroz-com-legume`, `kitchari`, `leguminosa-cozida`, `arroz-com-leguminosa`, `refogado`, `folhas-refogadas`, `legumes-no-vapor`, `legumes-assados`, `pure-de-raiz`, `raiz-cozida`, `salada-morna`, `salada-crua`, `fruta-cozida-com-especiaria`, `fruta-assada`, `fruta-fresca`, `ovo-mexido`, `omelete-com-legume`, `leite-morno-com-especiaria`, `iogurte-batido-com-especiaria`, `tapioca-recheada`, `cuscuz-no-vapor`, `torrada-com-gordura`, `macarrao-com-legume`, `polenta-mole`, `oleaginosas-de-molho`.

`titulo` é o modelo do nome da refeição na resposta, com as mesmas lacunas de `passos` (ex.: `arroz-com-legume`: "Arroz bem cozido com {legume} e {gordura}"); quem preenche é a spec 007. Vaga com `grupos` restringe quem a preenche (ex.: a `base` de `pure-de-raiz` só aceita `raizes`). Nenhum preparo combina laticínio com fruta.

**Práticas (44 ids)**

| Tipo | Ids |
|---|---|
| `cha` (20) | `cha-gengibre`, `cha-gengibre-canela`, `cha-gengibre-limao-mel`, `cha-canela`, `cha-canela-cardamomo`, `cha-cardamomo`, `cha-cravo-canela`, `cha-erva-doce`, `cha-cominho-coentro-erva-doce`, `cha-coentro-em-grao`, `cha-hortela`, `cha-hortela-erva-doce`, `cha-camomila`, `cha-camomila-erva-doce`, `cha-capim-limao`, `cha-capim-limao-hortela`, `cha-erva-cidreira`, `cha-curcuma-gengibre`, `cha-anis-estrelado`, `agua-morna-com-limao` |
| `oleo` (7) | `oleo-pes-gergelim`, `oleo-pes-coco`, `oleo-barriga-gergelim`, `oleo-corpo-gergelim`, `oleo-corpo-coco`, `oleo-corpo-girassol`, `oleo-couro-cabeludo-coco` |
| `pratica` (17) | `agua-morna-ao-acordar`, `agua-morna-ao-longo-do-dia`, `caminhada-leve-apos-refeicao`, `caminhada-leve-de-manha`, `respiracao-lenta`, `pausa-em-silencio`, `alongamento-leve`, `pes-aquecidos`, `escalda-pes-morno`, `banho-morno`, `rosto-com-agua-fresca`, `bolsa-morna-na-barriga`, `comer-sentada-sem-tela`, `almoco-como-refeicao-principal`, `jantar-leve-e-cedo`, `telas-desligadas-antes-de-dormir`, `dormir-cedo` |

Regras fixas: o `preparo` de toda prática `oleo` diz "óleo prensado a frio" e que é para uso na pele; chá com `mel` diz para juntar o mel só depois de amornar; nenhuma quantidade em gramas, gotas ou "x vezes ao dia".

**Tabelas de apoio**

- `estados.yaml`: os 7 estados, com `rotulo` e `emoji` dos atalhos de `BUSINESS.md` §8 e as qualidades de `KNOWLEDGE.md` §3, já no vocabulário fechado.
- `incomodos.yaml`: os 7 de `KNOWLEDGE.md` §3.1 com ids `dor-de-cabeca` (variantes `latejante`, `tensa`, `pesada`), `estomago-pesado`, `gases`, `cansaco`, `dificuldade-para-dormir`, `nariz-entupido`, `colica-leve`.
- `combinacoes.yaml`: pelo menos 8 linhas, incluindo leite com fruta azeda, leite com banana, melão com qualquer outro alimento, mel aquecido (como nota de preparo) e iogurte à noite só se a fonte trouxer.
- `doshas.yaml`: 3 linhas. `gunas`, `equilibra_gunas` e `equilibra_rasas` iguais à tabela de `KNOWLEDGE.md` §2, no vocabulário fechado.
- `quiz.yaml`: 8 perguntas, uma por tema de `TEMAS_QUIZ`.
- `grupos_evitar.yaml`: os 9 grupos, com `nome` para a tela e pelo menos 4 `palavras` cada (ex.: `frutos_do_mar`: camarão, lagosta, siri, caranguejo, marisco, lula, polvo, ostra).
- `vocabulario.yaml`:

| `guna` | `nome` | `verbo` |
|---|---|---|
| `quente` | quente | aquece |
| `frio` | frio | refresca |
| `oleoso` | úmido | umedece |
| `seco` | seco | seca |
| `pesado` | nutritivo | nutre |
| `leve` | leve | alivia o peso |
| `estavel` | estável | assenta |
| `movel` | estimulante | estimula |
| `suave` | suave | suaviza |
| `brando` | brando | acalma |
| `intenso` | intenso | desperta |
| `aspero` | áspero | `null` (nunca aparece como benefício) |

- `fontes.yaml`: uma linha por página aberta ou livro confirmado. `ref` em kebab-case. `a_confirmar` não entra no arquivo.

**Mínimos de cobertura (`config/base.ts`)**

```ts
export const base = {
  minAlimentos: 130, minPreparos: 30,
  minPraticas: { cha: 20, oleo: 7, pratica: 17 },
  minAlimentosPorVaga: 3,
  minPraticasPorEstado: 3,          // práticas com o estado em favorece_estados
  minPreparosPorEstado: 3,          // preparos não contraindicados com alguma qualidade favorecida
  minPreparosPorMomento: 2, minPraticasPorMomento: 3,
  minCombinacoes: 8,
} as const
```

**Outros arquivos de `config/`**

- `config/momento-do-dia.ts`: `manha` 5h–10h59, `almoco` 11h–14h59, `tarde` 15h–17h59, `jantar` 18h–20h59, `noite` 21h–4h59.
- `config/adequacao.ts`: `{ porQualidadeBuscada: 2, porQualidadeOposta: -2, porPontoDeEfeito: -1, maximoGunasPreparo: 2 }`.
- Os três entram em `config/index.ts`.

**Porta (`src/core/knowledge/knowledge-base.ts`)**

```ts
export interface KnowledgeBase {
  readonly alimentos: readonly Alimento[]
  readonly preparos: readonly Preparo[]
  readonly praticas: readonly Pratica[]
  readonly combinacoes: readonly Combinacao[]
  readonly doshas: readonly DoshaInfo[]
  readonly estados: readonly EstadoInfo[]
  readonly incomodos: readonly Incomodo[]
  readonly quiz: readonly PerguntaQuiz[]
  readonly gruposEvitar: readonly GrupoEvitarInfo[]
  readonly vocabulario: readonly VocabuloGuna[]
  readonly fontes: readonly Fonte[]
  alimento(id: string): Alimento | undefined
  preparo(id: string): Preparo | undefined
  pratica(id: string): Pratica | undefined
  linha(ref: string): unknown | undefined        // "<tabela>:<id>"; incômodo: "incomodos:<id>/<variante>"
  verbo(guna: Guna): string | null
}
export function createKnowledgeBase(dados: DadosDaBase): KnowledgeBase    // valida e indexa; lança KnowledgeInvalidError
export function validarBase(dados: unknown): { erros: string[]; avisos: string[]; contagens: Contagens }
export class KnowledgeInvalidError extends RituError {}                    // code: "base_invalida"; .erros: string[]
```

- Adaptador: `src/infra/knowledge/yaml-knowledge.ts` exporta `loadKnowledgeBase(dir?: string): KnowledgeBase` (padrão `<cwd>/data`). Único lugar que importa `yaml` e `node:fs`.
- Fake: `src/infra/fakes/mini-knowledge.ts` exporta `createMiniKnowledge(): KnowledgeBase`, com 16 alimentos, 4 preparos, 6 práticas (duas de óleo) e 2 combinações, escritos em TypeScript.
- Container: `Container` ganha `knowledge: KnowledgeBase`, carregado na primeira leitura.
- Teste de arquitetura: o mapa de R5 ganha `yaml` → `src/infra/knowledge/`.

**Funções puras (`src/core/knowledge/`)**

```ts
// momento.ts
type MomentoEntrada = { estados: Estado[]; incomodo?: { id: string; variante?: string }; gunasDoClima?: Guna[] }
type MomentoQualidades = {
  presentes: Guna[]; buscadas: Guna[]
  evitar_gunas: Guna[]; evitar_marcas: Marca[]
  evitar: { texto: string; linha_base: string }[]
  conflitos: [Guna, Guna][]                       // pares em que as duas qualidades foram pedidas
  linhas_base: string[]
  precisa_variante?: { incomodo: string; pergunta: string; opcoes: { id: string; texto: string }[] }
}
function qualidadesDoMomento(entrada: MomentoEntrada, kb: KnowledgeBase): MomentoQualidades
function momentoDoDia(hora: number): MomentoDoDia          // hora local, 0 a 23

// adequacao.ts
function notaAdequacao(item: { gunas: Guna[]; efeito?: Record<Dosha, number> }, buscadas: Guna[], prakriti?: Prakriti): { nota: number; contribui: Guna[] }
type Prakriti = Partial<Record<Dosha, number>>              // proporções que somam 1

// filtros.ts
type EvitarItem = { tipo: "grupo" | "alimento" | "texto"; valor: string }
type FiltroPessoa = { evitar: EvitarItem[]; restricoes: Restricao[]; nao_come: string[]; nao_gosta: string[] }   // nao_come e nao_gosta: ids
function passaNoFiltro(alvo: Alimento | Preparo | Pratica, filtro: FiltroPessoa, kb: KnowledgeBase): { passa: boolean; motivo?: "evitar_sempre" | "restricao" | "nao_come" | "nao_gosta" }
// Prática: reprova se qualquer ingrediente reprova. Preparo: reprova se alguma vaga obrigatória fica sem nenhum alimento aprovado.

// identificar.ts
function normalizar(texto: string): string                  // minúsculas, sem acento, sem pontuação, espaços simples
function identificarAlimento(nome: string, kb: KnowledgeBase): { tipo: "alimento"; id: string } | { tipo: "desconhecido"; nome: string }
function resolverEvitar(texto: string, kb: KnowledgeBase): EvitarItem   // grupo pelas palavras → alimento pelo nome ou sinônimo → texto

// substitutos.ts
type SinaisPessoa = { em_casa: string[]; gosta: string[]; ajudou: Record<string, number> }
function substitutos(p: { alimento_id: string; funcao?: Funcao; preparo_id?: string; outros_itens: string[]; filtro: FiltroPessoa; sinais: SinaisPessoa; limite: number }, kb: KnowledgeBase): Substituto[]
type Substituto = { alimento_id: string; nome: string; em_comum: Guna[]; em_casa: boolean; motivo: string; linha_base: string }
function fraseDaTroca(de: Alimento, para: Alimento, emComum: Guna[], kb: KnowledgeBase): string

// combinacoes.ts
function checarCombinacao(ids: string[], kb: KnowledgeBase): { compativel: boolean; conflitos: { itens: [string, string]; motivo: string; linha_base: string }[] }
```

Regras:

- `qualidadesDoMomento`: `presentes` é a união das qualidades dos estados, do incômodo e do clima; `buscadas` é a união de `favorecer`. Quando uma qualidade e a oposta ficam em `buscadas`, o par vai para `conflitos` e as duas continuam na lista (quem resolve e explica é o agente). Qualidade do clima entra em `presentes` e a oposta em `buscadas`. Incômodo com mais de uma variante e sem `variante` informada preenche `precisa_variante` e não acrescenta qualidades.
- `notaAdequacao`: soma `porQualidadeBuscada` por qualidade do item em `buscadas`, `porQualidadeOposta` por qualidade oposta a uma buscada, e, com prakriti, `porPontoDeEfeito × efeito[dosha] × proporção` de cada dosha. `contribui` são as qualidades do item que estão em `buscadas`.
- `substitutos`: candidatos são alimentos com a mesma função (com `preparo_id`, respeitando `grupos` da vaga; sem função, alimentos do mesmo grupo), mesma `virya`, pelo menos uma qualidade em comum, aprovados em `passaNoFiltro` e compatíveis com `outros_itens`. Ordem: mais qualidades em comum → está em casa → a pessoa gosta → mais vezes ajudou → nome. O próprio alimento nunca é devolvido.
- `fraseDaTroca`: "Troquei {de} por {para}: os dois {verbo}." com até dois verbos ligados por "e"; sem verbo em comum, "Troquei {de} por {para}: têm a mesma função no preparo."

**Contrato de tool (`src/core/agents/tools/tool.ts`)**

```ts
export type ToolContext = { kb: KnowledgeBase; filtro: FiltroPessoa; sinais: SinaisPessoa; prakriti?: Prakriti }
export type Tool<I, O> = {
  name: string                    // em português, com ponto: "ayurveda.alimento"
  description: string             // o "quando faz sentido chamar" de AI.md §4
  input: z.ZodType<I>
  output: z.ZodType<O>
  execute(input: I, ctx: ToolContext): Promise<O>
}
```

As specs seguintes acrescentam campos a `ToolContext`; nenhuma tool lê nada fora dele.

**Tools (`src/core/agents/tools/ayurveda.ts`)**

| Tool | Entrada | Saída |
|---|---|---|
| `ayurveda.alimento` | `{ alimentos: string[] }` (1 a 5; id, nome ou sinônimo) | `{ alimentos: { id, nome, grupo, rasa, virya, vipaka, gunas, verbos: string[], efeito, como_equilibrar, observacao?, confianca, linha_base }[]; desconhecidos: string[] }` |
| `ayurveda.candidatos` | `{ tipo: "alimento" \| "preparo" \| "pratica"; buscadas: Guna[] (1 a 6); momento_do_dia?: MomentoDoDia; estados?: Estado[]; funcao?: Funcao; limite?: number (1 a 10, padrão 5) }` | `{ candidatos: { tipo, id, nome, gunas, contribui: Guna[], nota: number, linha_base }[] }` |
| `ayurveda.substitutos` | `{ alimento_id: string; funcao?: Funcao; preparo_id?: string; outros_itens?: string[]; limite?: number (1 a 5, padrão 3) }` | `{ substitutos: Substituto[] }` |
| `ayurveda.checar_combinacao` | `{ itens: string[] }` (2 a 8 ids de alimentos) | `{ compativel: boolean; conflitos: { itens: [string, string]; motivo: string; linha_base: string }[] }` |

- `ayurveda.candidatos` aplica sempre `ctx.filtro`, tira o que tem `contraindicacoes` em `estados` e o que não serve ao `momento_do_dia`, e ordena por `notaAdequacao` (para preparo, as qualidades são `gunas_do_preparo`; para prática, `gunas` e `efeito`). Nota menor ou igual a zero fica fora.
- Id inexistente em `substitutos` ou `checar_combinacao`: a tool devolve lista vazia e `compativel: true`, respectivamente, e o id vai em `desconhecidos: string[]` (campo presente nas duas saídas).
- Exporta `ayurvedaTools: Tool<unknown, unknown>[]` com as quatro.

**Script**

- `base:check`: `tsx scripts/base-check.ts`. Sem opção: valida e imprime o relatório; código 1 se houver erro. `--producao`: também falha com qualquer `a_confirmar` ou fonte com `aprovada: false`. A formatação é função pura em `scripts/lib/base-report.ts`.

### Usa

- Spec 001: `RituError`, `Container` e `createContainer`, `config/index.ts`, scripts `test` e `eval:det`, teste de arquitetura (R1 e R5).

### Correção C13: alimentos aceitos por vaga

Pendente; entra antes da spec 008.

```ts
// vagaSchema ganha
alimentos: z.array(idSchema).min(1).optional()
```

- Com `alimentos`, as opções da vaga são só esses ids (ainda passando pelo filtro da pessoa); `grupos` não pode vir junto.
- Validação: cada id existe e tem a `funcao` da vaga. O mínimo de 3 alimentos por vaga vale também aqui; `excecoesMinAlimentosPorVaga` continua.
- Conteúdo (`data/preparos.yaml`), vaga a vaga:
  - `base` de `kitchari`, `arroz-papa` e de todo preparo cozido em grão: só grãos em grão (arroz e os demais cereais inteiros da base). Pão, macarrão, tapioca e farinhas ficam só nos preparos em que são a base de fato.
  - `tempero` de sopas, caldos e cozidos: especiarias e ervas de cozinha. Camomila, capim-limão, erva-cidreira e as outras ervas de chá saem.
  - `mingau` ganha a vaga `liquido` (obrigatória) com água, leite e as bebidas vegetais da base.
  - `leite-morno-com-especiaria:liquido` passa a `alimentos: [leite]` e segue na lista de exceções do mínimo.
- Redação dos `passos`: lacuna seguida de adjetivo não pode pedir concordância ("{legume} picado" vira "{legume} em pedaços").
- Eval novo em `evals/det/base/vagas.eval.ts`: nenhuma vaga `base` de preparo cozido em grão aceita pão, macarrão, tapioca ou farinha; nenhuma vaga `tempero` aceita erva marcada só para chá; nenhum `passos` tem lacuna seguida de adjetivo no masculino ou no feminino.
- Nível: `mecanica` (schema, validação, eval) e `conteudo` (listas e redação). Gates e `base:check` verdes; os evals da 007 continuam passando.

## Evals (quando a spec toca agente, prompt, tool ou base)

Determinísticos, em `evals/det/base/`, com a base real pelo container:

- `base-valida.eval.ts`: `validarBase` sem erros; os 130, 30 e 44 ids conferem com as listas desta spec; mínimos de `config/base.ts`.
- `estados.eval.ts`: cada estado e cada variante de incômodo devolve as qualidades esperadas; `com_calor` + `pesada` devolve conflito; dor de cabeça sem variante pede a variante.
- `evitar-sempre.eval.ts`: para cada um dos 9 grupos, nenhum alimento, preparo ou prática aprovado contém item do grupo; grupo `gergelim` tira as práticas de óleo de gergelim; `peixe` e `frutos_do_mar` não tiram nada e não dão erro.
- `restricoes.eval.ts`: `vegana` tira laticínios, ghee, ovo e mel e o que depende deles; `sem_gluten` tira pão, macarrão e aveia.
- `substitutos.eval.ts`: canela → primeiro substituto tem `virya` quente e função `tempero`; com o substituto em "não gosto", ele some; com filtro que elimina todos, lista vazia.
- `combinacoes.eval.ts`: cada linha de `combinacoes.yaml` é acusada por `checarCombinacao` com um par de exemplo.
- `candidatos.eval.ts`: para cada estado, `ayurveda.candidatos` devolve pelo menos 3 práticas e 3 preparos, todos com `linha_base` existente e nenhum contraindicado.

Com LLM: nenhum caso novo nesta spec. As famílias Conteúdo e Fidelidade usam esta base a partir do checkpoint `c1-base`.

## Nível das partes

- **conteudo** (Opus, `redator-base`): todas as linhas de `data/*.yaml`.
- Todo o resto é `mecanica`.

## Leitura para a construção

- `DEVELOPMENT.md`, inteiro.
- `KNOWLEDGE.md` §1 a §3.1: qualidades, doshas, tabela do momento e dos incômodos (conteúdo de `estados.yaml`, `incomodos.yaml` e `doshas.yaml`).
- `KNOWLEDGE.md` §5.3 (tabela "Inclui / Não inclui"), §8 e §9: o que pode entrar e as regras de fonte. Só nas tarefas de conteúdo.
- `BUSINESS.md` §13, linha "Quiz": temas das perguntas. Só na tarefa do quiz.
- `BUSINESS.md` §12: linguagem de conforto. Só nas tarefas de conteúdo.

## Dependências

- Spec 001.
- Pacote `yaml` (estável mais recente).
- Acesso à internet para o `redator-base`, só nas tarefas de conteúdo.

## Riscos e trade-offs

- **Base grande com muitas linhas `a_confirmar`:** as fontes abertas cobrem bem efeito por dosha e pouco sabor, efeito térmico e preparo. A dona confere no portão 1; o que não for confirmado fica marcado e trava o `--producao`.
- **Alimentos brasileiros fora das fontes** (jiló, chuchu, mandioquinha, cuscuz, tapioca): entram com `confianca: baixa`. Preferimos isso a uma base que não reconhece a cozinha da pessoa.
- **"Úmido" igual a "oleoso":** perde a diferença entre óleo e água. Aceito, em troca de um vocabulário só.
- **Sem carnes e peixes:** `vegetariana`, `peixe` e `frutos_do_mar` não filtram nada hoje. Ficam guardados e passam a valer se a base crescer.
- **Nome não reconhecido não é adivinhado:** "abobrinha italiana" só casa se estiver nos sinônimos. O alimento fica como "ainda não conheço" e a lista de candidatos mostra o que acrescentar.
- **Ids fixados na spec:** trocar um alimento depois é mudar spec e base. É o que deixa os evals e a demonstração estáveis.

## Edge cases e modos de falha

- Arquivo de `data/` ausente ou YAML malformado: `loadKnowledgeBase` lança `KnowledgeInvalidError` com o nome do arquivo; `base:check` imprime e sai com 1.
- Vários erros na base: todos são listados de uma vez, com arquivo, id e campo.
- `qualidadesDoMomento` sem estado, sem incômodo e sem clima: devolve listas vazias.
- Incômodo com id inexistente: ignorado, sem erro.
- `buscadas` com qualidade e oposta: as duas pontuam; o conflito já foi informado por `qualidadesDoMomento`.
- Alimento em `nao_gosta` que é o único de uma vaga obrigatória: o preparo é reprovado com motivo `nao_gosta`.
- `resolverEvitar("camarão")` → grupo `frutos_do_mar`; `resolverEvitar("castanha de caju")` → alimento `castanha-de-caju` (o alimento ganha do grupo quando o nome bate inteiro); `resolverEvitar("pitaia")` → texto.
- Item `texto` em "evitar sempre" que não casa com nada: não filtra nada aqui; o texto segue para o prompt na 007.
- `ayurveda.alimento` com o mesmo alimento escrito de dois jeitos: devolve uma vez.
- `substitutos` de alimento com uma só qualidade: exige essa qualidade em comum.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 5 verdes.
- `base:check` com zero erros e o relatório de `a_confirmar` no relatório da entrega, para o portão 1.
- `KNOWLEDGE.md` coerente com os schemas finais.
- `AGENTS.md` com o comando `base:check`.
- ADR nova: "Vocabulário fechado de 12 qualidades" e "Fontes da base consultadas pela internet com registro da página".
- Spec com `status: implemented` e o hash.

## Arquivos e diretórios envolvidos

- `data/*.yaml` (11 arquivos)
- `src/core/knowledge/`: `vocab.ts`, `schemas.ts`, `knowledge-base.ts`, `validate.ts`, `momento.ts`, `adequacao.ts`, `filtros.ts`, `identificar.ts`, `substitutos.ts`, `combinacoes.ts` e os testes
- `src/core/agents/tools/tool.ts`, `src/core/agents/tools/ayurveda.ts` e os testes
- `src/infra/knowledge/yaml-knowledge.ts`, `src/infra/fakes/mini-knowledge.ts`
- `src/infra/container.ts`, `src/architecture.test.ts`, `next.config.ts`
- `config/base.ts`, `config/momento-do-dia.ts`, `config/adequacao.ts`, `config/index.ts`
- `scripts/base-check.ts`, `scripts/lib/base-report.ts`
- `evals/det/base/*.eval.ts`
- `package.json` (script `base:check`, pacote `yaml`)
- `.claude/agents/redator-base.md` (ferramentas de internet)
- `.docs/KNOWLEDGE.md`, `AGENTS.md`, `.adrs/`
