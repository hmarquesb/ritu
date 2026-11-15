# Base de conhecimento ayurvédica

> Tabelas estruturadas, versionadas em `data/`, consultadas por tools. **Não é RAG.**
> ⚠️ Os valores nos exemplos abaixo são **ilustrativos**: cada linha real precisa vir de uma fonte citada.

## 1. A ideia central: um vocabulário só

O momento da pessoa, o clima, os doshas, os alimentos e as práticas falam a **mesma língua: as qualidades (gunas)**. Assim o agente cruza tudo por tabela, sem regra escondida no prompt, e o Juiz consegue conferir.

Qualidades usadas (pares):

| Par | Uso |
|---|---|
| frio ↔ quente | Temperatura do corpo, do clima e efeito térmico do alimento |
| pesado ↔ leve | Sensação do corpo; digestibilidade |
| oleoso ↔ seco | Pele, clima, alimento |
| estável ↔ móvel | Mente agitada vs calma |
| suave ↔ áspero | Textura; ressecamento |
| intenso ↔ brando | Irritação, picância |

O vocabulário é **fechado**: 12 qualidades, as duas de cada par. Nos arquivos de `data/` só valem os ids `quente`, `frio`, `pesado`, `leve`, `oleoso`, `seco`, `estavel`, `movel`, `suave`, `aspero`, `intenso`, `brando`. Nos textos deste documento, "úmido" é a qualidade `oleoso`, "estimulante" é `movel` e "nutritivo" é `pesado`.

Princípio do Ayurveda: **semelhante aumenta, oposto equilibra.** Quem está "com frio" se equilibra com o que é quente.

## 2. Doshas → qualidades

| Dosha | Qualidades | Equilibra com | Sabores que equilibram |
|---|---|---|---|
| Vata | frio, seco, leve, móvel, áspero | quente, oleoso, pesado/estável, úmido | doce, azedo, salgado |
| Pitta | quente, intenso, levemente oleoso | frio, brando | doce, amargo, adstringente |
| Kapha | pesado, frio, oleoso, estável | leve, seco, quente, estimulante | picante, amargo, adstringente |

Prakriti dual (ex.: Vata-Pitta) pesa os dois pela proporção do quiz.

**Sem prakriti** (a pessoa ainda não informou o dosha): o agente usa só o momento e o clima, ignora o campo `efeito` por dosha e marca a resposta como **geral**.

## 3. Momento → qualidades

| Estado (atalho do check-in ou o que o Intérprete entende do texto) | Qualidades presentes | Favorecer | Evitar |
|---|---|---|---|
| 🥶 Com frio | frio | quente | frio, gelado, cru |
| 🥵 Com calor | quente | frio, brando | quente, picante, frito |
| 🪨 Pesada, inchada | pesado, oleoso | leve, seco, quente | pesado, oleoso, doce em excesso |
| 🍂 Seca, ressecada | seco, áspero | oleoso, suave, úmido | seco, cru |
| ⚡ Agitada, ansiosa | móvel | estável, quente, pesado/nutritivo | estimulantes (café), cru, frio |
| 🔥 Irritada | intenso, quente | frio, brando | picante, azedo, fermentado |
| 😴 Sem energia | pesado, estável | leve, quente, estimulante | pesado, doce, frio |

Combinações conflitantes (ex.: "com calor" + "pesada") são resolvidas pelo agente, que **explica a escolha**.

### 3.1 Incômodos leves → qualidades

O incômodo é mais um eixo do momento: vira qualidades e entra no mesmo cruzamento. Quando o mesmo incômodo tem variantes com qualidades opostas e a pessoa não disse qual é, o código pergunta antes de o agente rodar. ⚠️ Valores ilustrativos: cada linha precisa de fonte (§8).

| Incômodo | Variante (pergunta do código) | Qualidades presentes | Favorecer | Evitar |
|---|---|---|---|---|
| Dor de cabeça | Latejante, com calor ou irritação | quente, intenso | frio, brando | picante, frito, sol forte |
| | Tensa, com cansaço, ansiedade ou sono ruim | móvel, seco | estável, oleoso, quente | jejum longo, café, frio |
| | Pesada, com nariz entupido | pesado, oleoso | leve, quente | laticínios, doce, frio |
| Estômago pesado | — | pesado, frio | leve, quente | pesado, cru, gelado |
| Gases, estufamento | — | móvel, seco | quente, suave | cru, gelado, feijão mal cozido |
| Cansaço | — | pesado, estável | leve, quente | pesado, doce |
| Dificuldade para dormir | — | móvel | estável, quente, nutritivo | estimulantes à noite, telas |
| Nariz entupido | — | pesado, oleoso, frio | quente, leve, seco | laticínios, gelado |
| Cólica leve | — | móvel, frio | quente, oleoso | gelado, cru |

Fica em `data/incomodos.yaml`, com os padrões de texto de cada incômodo. **Sinais de alerta** (`BUSINESS.md` §12) ficam em outra lista, aplicada por código antes de qualquer LLM.

## 4. Clima → qualidades

Dados da Open-Meteo para a cidade escolhida pela pessoa (`DATA-SOURCES.md`).

| Medida | Faixa | Qualidade |
|---|---|---|
| Temperatura aparente | < 20 °C | frio |
| | 20–27 °C | neutro |
| | > 27 °C | quente |
| Umidade relativa | < 50% | seco |
| | > 75% | úmido |

As faixas ficam em `config/clima.ts`. A tool `clima.agora` devolve o clima **deste momento** já convertido nessas qualidades. Sem cidade ou com a Open-Meteo fora do ar, o agente segue só com o momento e o perfil, e diz isso.

## 5. As tabelas

Vocabulário **fechado**: o agente só sugere alimentos de `alimentos.yaml`, preparos de `preparos.yaml` e práticas de `praticas.yaml`. Uma refeição sugerida é sempre **um preparo + alimentos da base**.

### 5.1 `data/alimentos.yaml`

**130 alimentos** comuns numa cozinha brasileira, cobrindo todos os grupos: frutas, verduras e folhas, legumes, raízes e tubérculos, grãos e féculas, leguminosas, laticínios, ovos, oleaginosas e sementes, óleos e gorduras, especiarias e ervas, adoçantes, bebidas. A base não tem carnes, peixes nem frutos do mar. Todo óleo vegetal leva a observação de preferir o prensado a frio. A base cresce pelos alimentos que as pessoas registram em casa e ela ainda não conhece.

```yaml
- id: abobora
  nome: Abóbora
  sinonimos: [jerimum, abóbora cabotiá, moranga]
  grupo: legumes
  durabilidade: curta           # curta | media | longa (BUSINESS.md §9)
  funcoes: [legume]             # papel num preparo: base | legume | folha | proteina | gordura | tempero | liquido | fruta | adocante
  rasa: [doce]                  # doce | azedo | salgado | picante | amargo | adstringente
  virya: quente                 # quente | frio
  vipaka: doce                  # doce | azedo | picante
  gunas: [pesado, oleoso]
  efeito: { vata: -1, pitta: 0, kapha: +1 }   # -2 equilibra muito … +2 agrava muito
  como_equilibrar:
    kapha: "Preparar com gengibre ou pimenta-do-reino."
  restricoes: []                # quem evita: vegetariana | vegana | sem_lactose | sem_gluten
  marcas: []                    # fruta_azeda | fruta_doce | fermentado | estimulante (usadas em combinações e no "evitar" do momento)
  observacao: ""                # opcional, lida pela pessoa (ex.: "Prefira o prensado a frio.")
  grupos_evitar: []             # grupos de data/grupos_evitar.yaml a que pertence: amendoim | castanhas | leite | ovo | soja | trigo | gergelim | peixe | frutos_do_mar
  fontes:
    - { ref: lad-food-guidelines, campos: [efeito] }
  confianca: media              # alta | media | baixa
  notas: ""
```

### 5.2 `data/preparos.yaml`

Formas simples de preparar, com **vagas** que os alimentos preenchem. Uma vaga restringe quem a preenche pela `funcao` e, opcionalmente, pelos `grupos` ou por uma lista explícita de `alimentos` (nunca os dois juntos). A base de um preparo cozido em grão aceita só grãos inteiros; o tempero de sopas, caldos e cozidos não aceita ervas de chá. São 30: mingau, sopas, caldo, arroz bem cozido com legumes, kitchari, leguminosa bem cozida, refogados, legumes no vapor e assados, purê e raiz cozida, salada morna, salada crua, fruta cozida, assada e fresca, ovo mexido, omelete, leite morno com especiaria, iogurte batido com especiaria, tapioca, cuscuz, torrada, macarrão com legume, polenta mole, oleaginosas de molho.

```yaml
- id: arroz-com-legume
  nome: Arroz bem cozido com legume
  titulo: "Arroz bem cozido com {legume} e {gordura}"   # nome da refeição na resposta; o código preenche e refaz na troca
  vagas:
    - { funcao: base, obrigatoria: true }
    - { funcao: legume, obrigatoria: true }
    - { funcao: gordura, obrigatoria: false }
    - { funcao: tempero, obrigatoria: false, maximo: 2 }
  gunas_do_preparo: [quente, oleoso, suave]     # o que o modo de preparo acrescenta
  passos: "Cozinhar {base} com mais água que o habitual. Juntar {legume} em cubos nos últimos 15 minutos. Finalizar com {gordura} e {tempero}."
  momento: [almoco, jantar]                    # manha | almoco | tarde | jantar | noite
  contraindicacoes: []
  fontes:
    - { ref: lad-cooking, campos: [passos] }
  confianca: media
```

As qualidades de uma refeição são as dos alimentos somadas às do preparo. Cozinhar aquece e umedece; cru esfria e resseca.

### 5.3 `data/praticas.yaml`

Chás, óleos e práticas. São 44: 20 chás, 7 de óleo e 17 práticas leves.

```yaml
- id: cha-gengibre-canela
  tipo: cha                     # cha | oleo | pratica
  nome: Chá de gengibre com canela
  ingredientes: [gengibre, canela]   # ids de alimentos.yaml; cruzados com Minha casa
  preparo: "Ferver rodelas de gengibre com um pau de canela por 5 a 10 minutos. Beber morno."
  gunas: [quente, movel]
  favorece_estados: [com_frio, sem_energia, pesada]
  efeito: { vata: -1, pitta: +1, kapha: -1 }
  momento: [manha, tarde]
  contraindicacoes: [com_calor, irritada]
  nunca_sugerir_se: []          # restrições do perfil ou estados que bloqueiam
  # "evitar sempre" é aplicado pelos ingredientes: prática de óleo lista o óleo em `ingredientes` (ex.: [oleo-gergelim])
  aviso: ""                     # texto extra obrigatório, quando houver
  fontes:
    - { ref: lad-cooking, campos: [efeito, preparo] }
  confianca: media
```

| Tipo | Inclui | Não inclui |
|---|---|---|
| `cha` | Ervas e especiarias culinárias: gengibre, canela, erva-doce, cominho, coentro em grão, cardamomo, hortelã, camomila, capim-limão | Fitoterápicos, suplementos, chás "medicinais" com contraindicação séria |
| `oleo` | Abhyanga com óleos comuns, prensados a frio: gergelim, coco, girassol | Óleos essenciais ingeridos |
| `pratica` | Água morna, caminhada leve, respiração lenta, pés aquecidos, horário de dormir | Exercício intenso, jejum, qualquer coisa com risco |

### 5.4 `data/combinacoes.yaml`

Combinações incompatíveis (viruddha ahara), por alimento ou por grupo. É o que `ayurveda.checar_combinacao` e o validador consultam.

```yaml
- id: laticinio-com-fruta-azeda
  itens: [grupo:laticinios, marca:fruta_azeda]   # alimento:<id> | grupo:<grupo> | marca:<marca>
  motivo: "..."
  fontes:
    - { ref: lad-cooking, campos: [motivo] }
  confianca: media
```

### 5.5 `data/doshas.yaml`

Texto do painel do dosha (`BUSINESS.md` §13). Um item por dosha, em linguagem leve, sem promessas de saúde.

```yaml
- id: vata
  nome: Vata
  elementos: [ar, espaco]
  resumo: "Movimento: leveza, criatividade e ritmo variável."
  gunas: [frio, seco, leve, movel, aspero]
  caracteristicas:
    corpo: "..."
    mente: "..."
    digestao: "..."
  desequilibra: "..."
  equilibra: "..."               # qualidades e sabores que equilibram (bate com §2)
  fontes:
    - { ref: lad-food-guidelines, campos: [caracteristicas] }
```

As qualidades e sabores daqui têm que bater com a tabela de §2 (validação automática).

### 5.5.1 `data/estados.yaml`

A tabela de §3, uma linha por estado, com rótulo e emoji do atalho, qualidades presentes, o que favorecer, o que evitar e a fonte.

### 5.6 `data/quiz.yaml`

As 8 perguntas do quiz do dosha, com 3 opções cada (uma por dosha) e a fonte de cada pergunta.

### 5.6.1 `data/grupos_evitar.yaml`

Os grupos do passo "Evitar sempre": id, nome na tela, palavras que o Intérprete reconhece ("camarão", "lagosta" → `frutos_do_mar`). Cada alimento declara os seus em `grupos_evitar`. Validação: todo alimento de laticínio, oleaginosa, ovo, trigo, soja, peixe ou fruto do mar tem o grupo certo; toda prática de óleo lista o óleo nos ingredientes.

### 5.7 `data/fontes.yaml`

Cada `ref` usada nas tabelas, com título, autor, edição e página ou URL.

## 6. Como a base vira resposta

### Explicar

Toda sugestão carrega a cadeia que a justifica, e o texto do agente conta essa cadeia em linguagem do dia a dia:

1. **O que o momento traz:** estado e clima → qualidades presentes ("frio, úmido, móvel").
2. **O que equilibra:** as qualidades opostas ("quente, estável").
3. **O que cada alimento traz:** as qualidades do alimento e do preparo que atendem ao que se busca ("gengibre aquece; arroz bem cozido assenta").
4. **Por que juntos:** são compatíveis (`combinacoes.yaml`) e se completam (um aquece, outro umedece).

Na tela, as qualidades aparecem com verbos simples: *aquece, refresca, umedece, seca, nutre, alivia o peso, assenta, estimula, suaviza, acalma, desperta*. "Áspero" não tem verbo e nunca aparece como benefício. O mapeamento de qualidade para verbo fica em `data/vocabulario.yaml`.

### Substituir

O substituto de um ingrediente (`ayurveda.substitutos`) é escolhido por código:

1. Mesma **função** no preparo (ou, num chá, mesmo papel: o que aquece, o que refresca).
2. **Qualidades mais próximas**: mesmo efeito térmico e maior número de qualidades em comum.
3. Passa pelos filtros: "evitar sempre", restrições, "não como", "não gosto", contraindicações e combinações com os outros itens da sugestão.
4. Ordem de preferência entre os que sobram: confirmado em casa, a pessoa gosta, já ajudou.

O motivo da troca sai de um modelo de frase preenchido com as qualidades em comum: *"Troquei canela por cardamomo: os dois aquecem."*

### Alimento que a base não conhece

Quando a pessoa registra em casa um alimento que não está em `alimentos.yaml`, ele fica guardado com a marca "ainda não conheço". Não entra em sugestões nem em trocas. O nome vai para uma lista de candidatos a entrar na base.

## 7. Fontes

| Ref | Fonte | Uso |
|---|---|---|
| `lad-food-guidelines` | Vasant Lad, *Food Guidelines for Basic Constitutional Types* (The Ayurvedic Institute) | Efeito por dosha |
| `lad-cooking` | Usha e Vasant Lad, *Ayurvedic Cooking for Self-Healing* | Propriedades, preparo, combinações |
| `banyan-listas` | Listas de alimentos por dosha da Banyan Botanicals | Conferência cruzada |

Na construção da base, as fontes são consultadas pela internet uma única vez, só nas páginas do Ayurvedic Institute e da Banyan Botanicals. Cada página aberta entra em `data/fontes.yaml` com a URL e a data de acesso. Livro sem página aberta fica como `a_confirmar`.

## 8. Curadoria

- **Toda linha tem fonte.** Sem fonte, não entra.
- **Divergência entre fontes** → `confianca: media` ou `baixa` e uma nota.
- **Validação automática:** schema zod, ids únicos, referências existentes (fontes, alimentos citados em práticas e combinações), toda vaga de preparo com pelo menos 3 alimentos possíveis (as exceções ficam listadas em `config/base.ts`, como a vaga de leite do `leite-morno-com-especiaria`, que aceita só o leite, e a base dos preparos em que pão, tapioca, cuscuz, macarrão ou fubá são a base de fato), cobertura mínima por grupo, por tipo de prática e por estado do momento.
- **Crescimento guiado por dados:** os alimentos "ainda não conheço", os itens "incertos" e os 👎 indicam onde a base precisa crescer.
- **Mudança na base = commit próprio.**
- **Agentes de código não inventam fonte.** Se o agente não tem a fonte confirmada de uma linha, ela entra com `confianca: baixa` e `fontes: [{ ref: a_confirmar }]`, e a dona revisa no portão 1. Nenhum título, página ou URL é escrito de memória. Linha com `a_confirmar` vale em desenvolvimento e nos evals; `npm run base:check -- --producao` falha enquanto houver alguma, e é rodado antes de publicar.

## 9. Cuidados

- Aviso em toda resposta, na Entrada e no Aviso inicial.
- Sem diagnóstico, dosagem, suplemento ou fitoterápico; só o vocabulário fechado de §5.
- O produto **não pergunta** sobre gestação, doenças ou medicamentos. Práticas com cuidado conhecido levam o campo `aviso`, ou ficam fora da base.
- "Evitar sempre" (por `grupos_evitar` e por id), `contraindicacoes`, `nunca_sugerir_se` e `restricoes` são aplicados **por código**, no preparo (`AI.md` §3), e conferidos de novo pelo validador.
- Incômodos leves viram recomendação de conforto com aviso reforçado; sinais de alerta não viram recomendação (`BUSINESS.md` §12).
