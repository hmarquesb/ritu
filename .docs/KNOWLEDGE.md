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

**127 alimentos** comuns numa cozinha brasileira, cobrindo todos os grupos: frutas, verduras e folhas, legumes, raízes e tubérculos, grãos e féculas, leguminosas, laticínios, ovos, oleaginosas e sementes, óleos e gorduras, especiarias e ervas, adoçantes, bebidas. A base não tem carnes, peixes nem frutos do mar. Todo óleo vegetal leva a observação de preferir o prensado a frio. A base cresce pelos alimentos que as pessoas registram em casa e ela ainda não conhece.

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
  # cha: { parte: folha }       # opcional, só em especiarias e bebidas: a erva vira um chá simples (R9)
  fontes:
    - { ref: lad-food-guidelines, campos: [efeito] }
  confianca: media              # alta | media | baixa
  notas: ""
```

O campo `cha` marca a erva ou especiaria que vira um chá de uma erva só (§8.1, R9). Ele existe só nos grupos `especiarias` e `bebidas`. `parte` diz o que vai na água e decide o modo de preparo: `folha`, `flor`, `semente`, `casca`, `raiz` ou `bebida` (a erva que já é vendida como chá). `aviso` é opcional, tem até 200 caracteres, é lido pela pessoa e só existe com um cuidado que uma fonte registrada afirma; a fonte da erva cita então o campo `cha`. Têm `cha` o louro, o alecrim e o manjericão (`folha`) e o chá-preto, o chá-mate e o chá verde (`bebida`).

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

Chás, óleos e práticas. `praticas.yaml` tem 44: 19 chás, 7 de óleo e 18 práticas leves. A base monta mais um chá simples por erva com o campo `cha` (6, pela R9 de §8.1), e são 50 no total. O chá fixo de `praticas.yaml` vence o derivado, e um id fixo igual ao de um derivado é erro de validação. Toda prática do `tipo: cha` tem id começado por `cha-`, e só ela. O preparo do chá simples sai da `parte` da erva, com os textos de `config/chas.ts`.

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

As fontes têm pesos diferentes:

| Peso | Fontes |
|---|---|
| Alto | Textos clássicos e suas traduções (Charaka Samhita, Ashtanga Hridaya, Madanapala Nighantu) e artigos revisados (JAIMS, WJPR) |
| Médio-alto | Easy Ayurveda (Dr. J. V. Hebbar), que cita os clássicos; The Ayurvedic Institute |
| Médio | Banyan Botanicals; Ask Ayurveda (só os artigos "X in Ayurveda"); AyurTimes; outras organizações que estudam Ayurveda (Maharishi Ayurveda, Kripalu, AyurVAID, The Ayurveda Experience, LifeSpa) |
| Só apoio | Satyori e portais de saúde (1mg, PharmEasy, Apollo); nunca sustentam um campo sozinhos |

Cada página aberta entra em `data/fontes.yaml` com a URL e a data de acesso. Livro sem página aberta fica como `a_confirmar`.

Duas refs de `fontes.yaml` não são páginas: `ritu-regras-da-base` marca o campo derivado por uma regra de §8.1, e `ritu-textos-revisados` marca o texto que a pessoa lê (preparo, passos, aviso) lido e aprovado pela dona.

## 8. Curadoria

- **Toda linha tem fonte.** Sem fonte, não entra.
- **Uma fonte que confirma** o valor da base basta: o campo fica com o valor e a fonte registrada, e a linha com `confianca: media`.
- **Uma fonte que contradiz** a base corrige o campo para o valor da fonte.
- **Fontes que divergem entre si:** vence a de mais peso (§7). Clássico e Easy Ayurveda vencem Ask Ayurveda e Banyan. A divergência fica na `nota` da linha.
- **Parte de um campo sem fonte** (ex.: uma das gunas) sai do campo; fica só o que a fonte confirma.
- **`confianca`:** `media` quando todo campo tem fonte ou regra; `baixa` enquanto algum campo seguir `a_confirmar`; `alta` só com duas fontes independentes em todos os campos.
- **Validação automática:** schema zod, ids únicos, referências existentes (fontes, alimentos citados em práticas e combinações), toda vaga de preparo com pelo menos 3 alimentos possíveis (as exceções ficam listadas em `config/base.ts`, como a vaga de leite do `leite-morno-com-especiaria`, que aceita só o leite, e a base dos preparos em que pão, tapioca, cuscuz, macarrão ou fubá são a base de fato), cobertura mínima por grupo, por tipo de prática e por estado do momento.
- **Crescimento guiado por dados:** os alimentos "ainda não conheço", os itens "incertos" e os 👎 indicam onde a base precisa crescer.
- **Mudança na base = commit próprio.**
- **Agentes de código não inventam fonte.** Se o agente não tem a fonte confirmada de uma linha, ela entra com `confianca: baixa` e `fontes: [{ ref: a_confirmar }]`, e a dona revisa no portão 1. Nenhum título, página ou URL é escrito de memória. Linha com `a_confirmar` vale em desenvolvimento e nos evals; `npm run base:check -- --producao` falha enquanto houver alguma, e é rodado antes de publicar.

### 8.1 Regras de derivação

Alguns campos não são fatos que uma fonte afirma item por item. Eles saem de uma regra, e a linha cita `ritu-regras-da-base` (ou a página da regra) nesses campos.

**Vipaka pelo sabor.** Quando nenhuma fonte dá o vipaka de um alimento, ele sai da regra clássica do sabor ([Easy Ayurveda, Avastha paka](https://www.easyayurveda.com/avastha-paka/), ref `ea-avastha-paka`):

| Rasa | Vipaka |
|---|---|
| doce, salgado | doce |
| azedo | azedo |
| picante, amargo, adstringente | picante |

Com mais de um sabor, vale o sabor principal, o primeiro do `rasa`. Uma fonte que dê o vipaka vence a regra. O campo fica com `confianca: media` quando o rasa tem fonte; se o rasa ainda é `a_confirmar`, a linha segue `baixa`.

**R1. Chás pelas ervas.** As gunas, os estados que um chá favorece e o efeito por dosha são a soma das ervas e especiarias dele, lidas em `alimentos.yaml`.

**R2. Chás pelo virya.** Chá de virya quente não vai para quem está `com_calor`; chá de virya frio não vai para quem está `com_frio`. Chá com a marca `estimulante` só de manhã e à tarde.

**R3. Preparos pelo modo de cozinhar.** O `gunas_do_preparo` sai do modo de preparo:

| Modo | Acrescenta |
|---|---|
| Assar | quente, seco |
| Refogar ou cozinhar com gordura | oleoso |
| Vapor ou cozido em água | suave |
| Com leite ou creme | pesado |

**R4. Preparos pelo peso.** O momento de um preparo segue a leveza: preparo leve vai para a manhã e o jantar; preparo pesado, para o almoço, quando a digestão está mais forte.

**R5. Pelo sabor.** Quando nenhuma fonte dá as gunas ou o efeito de um alimento, eles saem do sabor principal, o primeiro do `rasa` ([JAIMS, Shad Rasa](https://jaims.in/jaims/article/download/1575/1555), ref `jaims-shad-rasa`; [Charak Samhita Online, Rasa](https://www.carakasamhitaonline.com/index.php/Rasa), ref `caraka-rasa`). Uma fonte do próprio alimento vence a regra, e o campo pode ficar só com a parte que a regra confirma.

| Rasa | Gunas | Vata | Pitta | Kapha |
|---|---|---|---|---|
| doce | pesado, oleoso, frio | acalma | acalma | agrava |
| azedo | leve, oleoso, quente | acalma | agrava | agrava |
| salgado | oleoso, quente | acalma | agrava | agrava |
| picante | leve, seco, quente | agrava | agrava | acalma |
| amargo | leve, seco, frio | agrava | acalma | acalma |
| adstringente | seco, frio | agrava | acalma | acalma |

A temperatura das gunas segue o `virya` da linha. O efeito por dosha soma os sabores do `rasa` (agrava +1, acalma −1) e fica em −1, 0 ou +1 pelo sinal da soma.

**R6. Marcas das frutas.** Fruta com azedo no `rasa` leva a marca `fruta_azeda`; fruta com doce e sem azedo leva `fruta_doce`.

**R7. Hábitos pelo calor e pela hora.** Prática com a qualidade `quente` não vai para quem está `com_calor`, como o chá de virya quente (R2). Os estados que ela favorece são os que pedem as qualidades dela (tabela de §3). Sem fonte de horário: hábito ligado à refeição vale nos momentos de refeição; hábito "ao longo do dia" vale de manhã, no almoço e à tarde; calor no corpo sem hora própria vale de manhã, à tarde e à noite.

**R8. Farinha de mandioca.** A farinha herda o sabor da mandioca. Torrada, é seca e áspera, e por isso agrava vata (o semelhante aumenta).

**R9. Chás simples pelas ervas.** Erva ou especiaria com o campo `cha` vira um chá de uma erva só, montado por código: gunas e efeito da erva (R1), contraindicação e momento pelo virya e pela marca `estimulante` (R2), e estados favorecidos pela tabela de §3, como nos hábitos (R7). O chá fixo de `praticas.yaml` vence o derivado.

**Fontes mais fracas, aceitas pela dona.** Para itens sem página nas fontes de §7, valem Satyori e textos do Ask Ayurveda fora do formato "X in Ayurveda" (artigo ou resposta de médico na página): maracujá, acelga, mandioca, tapioca, abobrinha, cebolinha, erva-cidreira e chá-mate. Chuchu, jiló e mandioquinha não têm fonte nenhuma e ficam fora da base.

**Hábitos pelos doshas.** Um hábito (prática do tipo `pratica`) se lê pelo que ele faz com cada dosha. O `efeito` vem da fonte que trata do dosha. As `gunas` são as qualidades por trás desse efeito (o que sobe e o que desce), e os `favorece_estados` são os estados que pedem essas qualidades.

- Água morna (ao acordar e ao longo do dia) acalma vata e kapha; água gelada agrava os dois.
- Banho morno acalma vata e kapha, de manhã e à noite; a água na cabeça é morna ou fresca, nunca quente. Água fresca no rosto acalma pitta e não vai para quem está `com_frio`.
- Exercício traz leveza, tira o peso e acalma kapha, mas em excesso agrava vata e pitta. Por isso a caminhada da manhã não acalma vata (vata 0), não vai para quem está `agitada` e leva óleo de gergelim no corpo antes e banho morno depois, na ordem clássica da manhã: óleo, exercício, banho. A manhã, hora de kapha, é a melhor hora para se mexer.
- Caminhar devagar depois de comer não é exercício: ajuda a digestão (kapha −1) sem mexer em vata. Exercício logo depois de comer fica fora da base.
- Dormir cedo acalma vata (ficar acordada à noite resseca e agrava vata) e pitta (das 22h às 2h é a hora de pitta).
- Respiração lenta, pausa em silêncio e alongamento leve acalmam vata. Telas desligadas antes de dormir acalmam vata e pitta.
- Almoço como refeição principal e jantar leve e cedo seguem o ritmo do dia: a refeição maior na hora de pitta.
- Pés aquecidos, escalda-pés morno e bolsa morna acalmam vata pelo calor (vata é frio). O escalda-pés vai para a noite, antes de dormir (AyurVAID); os horários dos outros dois e os estados e cuidados dos três saem de R7.
- Comer sentada, com calma e sem tela, ajuda a digestão (The Ayurveda Experience) e acalma vata, que é móvel, pela estabilidade.

## 9. Cuidados

- Aviso em toda resposta, na Entrada e no Aviso inicial.
- Sem diagnóstico, dosagem, suplemento ou fitoterápico; só o vocabulário fechado de §5.
- O produto **não pergunta** sobre gestação, doenças ou medicamentos. Práticas com cuidado conhecido levam o campo `aviso`, ou ficam fora da base.
- "Evitar sempre" (por `grupos_evitar` e por id), `contraindicacoes`, `nunca_sugerir_se` e `restricoes` são aplicados **por código**, no preparo (`AI.md` §3), e conferidos de novo pelo validador.
- Incômodos leves viram recomendação de conforto com aviso reforçado; sinais de alerta não viram recomendação (`BUSINESS.md` §12).
