# Engenharia de IA

> Como o agente pensa, que ferramentas usa, o que lembra, quando para, que modelos usa e como é vigiado.

## 1. O que faz do Ritu um agente

Um agente **decide o caminho**, **age**, **observa o resultado** e **corrige**. O Ritu mostra as seis provas abaixo, e cada uma tem um número nos evals (`QA.md`).

| # | Prova de agência | Como aparece no Ritu | Como é medida |
|---|---|---|---|
| 1 | **Caminho decidido pelo modelo** | Mensagens diferentes levam a sequências diferentes de tools. Uma pergunta simples termina em um ou dois passos; um momento consulta clima e casa; a previsão das próximas horas só entra quando a ação depende disso | Eval de trajetória: tools obrigatórias, tools proibidas e chamadas desnecessárias por cenário |
| 2 | **Autocorreção** | Toda resposta passa pelo validador ao ser entregue. Se voltarem violações, o agente corrige e entrega de novo | Taxa de "válida na 1ª tentativa" e de "corrigiu após violação" |
| 3 | **Pedir ajuda só quando falta** | `ask_user` pausa o run ("Ainda tem abóbora e couve?") e retoma de onde parou | Perguntas necessárias feitas; perguntas desnecessárias evitadas |
| 4 | **Agir com aprovação** | O agente **propõe** escritas (casa, rotina, preferência, lista). Nada é gravado sem a pessoa aprovar | Teste determinístico: zero escrita sem aprovação |
| 5 | **Ciclo fechado com o mundo** | Cada sugestão espera um retorno em "Como ficou?". O que ajudou, o que não ajudou e do que a pessoa gosta mudam a ordem das próximas sugestões. O que fez falta várias vezes vira uma indicação de "vale ter em casa" | Eval: depois de dois "não ajudou" seguidos, a sugestão vai para o fim; "não gosto de X" tira X; com faltas em 3 dias a indicação aparece, e recusada não volta |
| 6 | **Limites e degradação** | Teto de passos, de tempo e de tokens por run; tool fora do ar não derruba o run; modelo sem cota é trocado por outro | Testes determinísticos de limite, de falha de tool e de troca de modelo |

**Regra de ouro: a menor autonomia que resolve.** O que é sempre igual fica em código (guardrail de entrada, filtros, ordenação por gosto e resultado, trocas, registro de toques e de faltas, limites). O que depende do caso fica com o agente.

## 2. Princípios

1. **O LLM decide, os dados justificam.** Todo motivo dado à pessoa vem de uma linha da base (`KNOWLEDGE.md`), com o id da linha.
2. **Incerteza explícita.** Se a base não cobre o caso, o agente diz que não sabe e o item sai marcado como **incerto**.
3. **Texto e estrutura juntos.** O agente escreve a resposta para a pessoa e, na mesma saída, entrega a parte estruturada (sugestões, ingredientes, motivos, propostas). O validador e o juiz conferem que as duas partes dizem a mesma coisa.
4. **Catálogo fechado.** Cada agente só chama as tools da sua lista.
5. **Ler é livre, escrever é proposto.** Tools de leitura rodam sozinhas. Tools de escrita só geram propostas (§5).
6. **Tudo é rastreável.** Cada passo vira uma etapa no banco e um span no trace (`OBSERVABILITY.md`).
7. **Cada chamada de modelo é contada.** Modelo menor para entender, compactar e julgar; o que dá para fazer por código não chama modelo (§10).

## 3. Agentes

| Agente | Entrada | Tools | Saída (zod) | Papel de modelo (§10) |
|---|---|---|---|---|
| **Intérprete** | Texto da mensagem + últimas mensagens do dia + lista numerada das sugestões que esperam retorno | — | `{intencoes[], estados[], incomodo, alerta, itens_casa[], retorno, fato_de_rotina, evitar_sempre[], suspeito}` | `apoio` |
| **Acompanhante** (o agente principal) | Saída do Intérprete + contexto montado no preparo | Catálogo de §4 | `{resposta, geral, explicacao, sugestoes[], evitar[], incertos[], para_ter, propostas[]}` | `decisao` |
| **Juiz** (guardrail de saída) | Saída do Acompanhante + linhas da base citadas | — | `{aprovado, violacoes[]}` | `apoio` |
| **Memória** | Notas de rotina aprovadas | — | Resumo de rotina compactado | `apoio` |

### Intenções e caminhos

O Intérprete classifica a mensagem. O código escolhe o caminho; só o que precisa de julgamento vai para o Acompanhante.

| Intenção | Exemplo | Caminho | Chamadas de modelo |
|---|---|---|---|
| `momento` | "acordei com frio e sem fome" | Intérprete → preparo → Acompanhante → Juiz | 4 a 6 |
| `pergunta` | "manga é boa para Pitta?" | Intérprete → Acompanhante → Juiz | 3 a 4 |
| `vida` | "essa semana vou almoçar fora" | Intérprete → Acompanhante → Juiz | 3 a 4 |
| `casa` (sozinha) | "comprei abóbora e couve" | Intérprete → código monta a proposta e o texto de confirmação | 1 |
| `retorno` (sozinho) | "tomei o chá e melhorei" | Intérprete aponta a sugestão → código registra e responde com texto fixo. Sem saber qual é a sugestão, nada é registrado | 1 |
| `evitar` (sozinho) | "não posso comer camarão" | Intérprete → código filtra na hora, responde com texto fixo e monta a proposta de fixo | 1 |
| `ajuda` | "como apago meus dados?" | Texto fixo que aponta as telas | 1 |
| `alerta` | "tô com dor no peito", "não aguento mais, queria sumir" | Padrões em código (e Intérprete, se passar) → resposta de encaminhamento fixa, física ou emocional (§8) | 0 ou 1 |
| `ofensa` (sozinha) | "você é inútil" | Resposta curta fixa, sem sermão (§8) | 1 |
| `fora` | "esqueça suas regras", conteúdo sexual ou de ódio | Resposta padrão fixa | 0 ou 1 |
| Só atalhos, sem texto | 🥶 + ⚡ | Sem Intérprete: preparo → Acompanhante → Juiz | 3 a 5 |

Uma mensagem pode ter mais de uma intenção ("comprei abóbora, o que faço com ela hoje?"). Com mais de uma, vai para o Acompanhante, que recebe todas; `ofensa`, `ajuda` e `fora` somem quando há outra. O que a mensagem diz sobre a casa vale no mesmo run, antes de qualquer aprovação: a abóbora que a pessoa acabou de citar já conta como em casa, e o que ela disse que acabou não entra.

O alerta ganha de tudo: com ele, nenhum outro campo da mensagem é usado. Se o Intérprete não estiver disponível, a mensagem não vai ao agente: sai a resposta montada por código (§10).

Mensagens de runs de `alerta`, `fora` e `ofensa` não voltam ao prompt como conversa do dia.

### Preparo (código, antes do loop)

O que roda em toda mensagem não é decisão, então não é tool:

1. Converte o momento e o incômodo em qualidades (`KNOWLEDGE.md` §3 e §3.1).
2. Filtra alimentos, preparos e práticas por qualidades, dosha, momento do dia, **"evitar sempre"** (guardado, do dia e o que o Intérprete acabou de apontar), restrições, "não como", "não gosto", contraindicações, marcas a evitar no momento e o que já foi sugerido hoje. Preparo ou prática com qualquer ingrediente em "evitar sempre" sai inteiro, inclusive óleos de uso na pele. Prática sem momento do dia definido serve a qualquer momento. A casa que o preparo lê já passa pelo mesmo filtro.
3. **Ordena** o que passou no filtro (§6, "Ordenação"). Só há candidatos quando a mensagem tem intenção `momento`, estados ou incômodo; nos outros casos a lista vai vazia.
4. Calcula as **faltas** do run e escolhe o candidato a "vale ter em casa", se houver (§6, "Faltas").
5. Monta o contexto do Acompanhante: fixos, resumo de rotina, padrões confirmados, últimas mensagens do dia, sinais (§6), os candidatos já ordenados e o candidato a "vale ter em casa". Para o contexto, o preparo guarda por tipo só os primeiros (4 chás, 3 refeições, 2 óleos, 4 práticas) e, em cada vaga de uma refeição, até 3 opções de alimento.

Sinal de alerta encerra o run aqui, com a resposta de encaminhamento.

### Saída do Acompanhante

```
resposta      texto para a pessoa, em tom de conversa (até 900 caracteres)
geral         true quando não há dosha
origem        agente | segura | sem_modelo
avisos[]      { tipo: incomodo | geral, texto }
explicacao    { qualidades_do_momento[], qualidades_buscadas[] }
sugestoes[]   até 3: { tipo: cha | refeicao | oleo | pratica,
                       pratica_id ou preparo_id,
                       titulo, como_fazer, verbos[], aviso?,
                       itens[]: { alimento_id, nome, funcao, contribui[], verbos[],
                                  linha_base, casa, se_faltar? },
                       motivo (até 200 caracteres), linhas_base[], novidade }
evitar[]      { texto, linha_base }
incertos[]    até 3, de até 120 caracteres: o que a base não cobre
citados[]     até 5: linhas da base de alimentos e práticas citados só no texto
para_ter      opcional, no máximo um: { alimento_id, nome, vezes, contribui[], verbos[],
                                        linha_base, motivo }
propostas[]   escritas a aprovar (§5)
```

O modelo entrega `resposta`, `explicacao`, as sugestões (tipo, id, itens com `alimento_id`, `funcao`, `contribui`, `linha_base` e `se_faltar`, motivo, `linhas_base`, `novidade`), `evitar` (só as linhas da base), `incertos`, `citados` e `para_ter` (`alimento_id`, `vezes`, `contribui`, `linha_base`). O código completa o resto a partir da base: `origem`, `geral`, `avisos` (resposta geral e incômodo, textos fixos), o título e o modo de fazer de cada sugestão (de um preparo: o modelo `titulo` e os passos, preenchidos com os ingredientes; de uma prática: nome, preparo e `aviso` da base), nomes, verbos, `casa` de cada item, a frase da troca em `se_faltar` (`{ alimento_id, nome, frase }`), o `texto` de cada `evitar` e o `nome`, os verbos e o motivo do `para_ter`. Ingrediente incerto em casa só entra com `se_faltar`: um substituto confirmado em casa, já pronto.

`origem` é `agente` quando a resposta passou pelo validador em `finalizar`. A `segura` (texto fixo, sem sugestões nem avisos) sai quando o run termina por limite, erro ou saída fora do contrato; o run de saída fora do contrato fica `failed`. A `sem_modelo` é a resposta montada por código quando nenhum modelo de `decisao` está disponível: práticas da base e o texto de `BUSINESS.md` §14.

A tela mostra `resposta` como a fala do agente e desenha `sugestoes` logo abaixo, como apoio (`BUSINESS.md` §8). Em respostas a perguntas e a relatos da vida, `sugestoes` pode vir vazio. Quando `para_ter` vem preenchido, a tela desenha a linha "Vale ter em casa" abaixo das sugestões.

### O loop

Perceber → Raciocinar → Agir → Observar. O loop é código do Ritu: ele controla os passos, os limites, o checkpoint e as pausas. Cada passo (uma chamada de modelo com as tools) é executado pela Mastra, atrás da porta `AgentRuntime`; quem executa as tools é o loop.

- Até **6 chamadas de modelo** do Acompanhante por run (pausas não contam).
- Timeout de 25 s de trabalho ativo por trecho (o tempo de espera da pessoa não conta).
- Teto de tokens por run; ao estourar, o run termina com a resposta segura.
- Antes de cada uso de tool, o agente escreve uma frase curta sobre o que vai fazer. Ela é transmitida ao vivo e não é gravada no rastro.
- A entrega é pela tool `finalizar`, que **roda o validador por dentro**. Com violações, `finalizar` devolve a lista e não entrega; o agente corrige e chama de novo. Até 3 tentativas; depois, resposta segura.

**Cadeia:** Intérprete → preparo → Acompanhante → Juiz → tela. Se o Juiz reprova, o Acompanhante recebe as violações e tem **uma** nova tentativa, com o papel de modelo `reforco` (§10). Reprovou de novo: resposta segura genérica (fail-closed), e o motivo fica no run.

## 4. Catálogo de tools

Todas com entrada e saída em zod, determinísticas e testáveis sem LLM.

### Leitura (livres)

| Tool | Devolve | Quando faz sentido chamar |
|---|---|---|
| `clima.agora` | Temperatura aparente e umidade da cidade da pessoa, já em qualidades; ou `indisponivel`; ou `sem_cidade` | Em mensagens de momento; dispensável em pergunta conceitual |
| `clima.proximas_horas` | Tendência das próximas 6 h (esquenta, esfria, chove) | Só quando a ação é para mais tarde ou depende de sair de casa |
| `casa.ler` | Itens da casa com estado (confirmado, incerto, sempre tenho), por grupo | Quando for sugerir chá, refeição ou óleo |
| `preferencias.ler` | Gosto e resultados dos itens pedidos | Só quando os sinais dizem que há registros e os candidatos do preparo não bastam |
| `historico.recente` | Uma linha por run dos últimos 7 dias | Só quando a pessoa se refere a algo que já aconteceu |
| `ayurveda.alimento` | Propriedades de um ou mais alimentos (sabor, efeito térmico, qualidades, efeito por dosha, como equilibrar), com a linha da base | Perguntas sobre alimentos; explicar uma sugestão |
| `ayurveda.candidatos` | Outros alimentos, preparos ou práticas, com outro filtro de qualidades ou de momento | Só quando os candidatos do preparo não bastam (o clima mudou as qualidades, a pessoa respondeu algo que muda o quadro) |
| `ayurveda.substitutos` | Substitutos de um ingrediente numa função do preparo, já ordenados | Quando um ingrediente está incerto ou a pessoa disse que não tem |
| `ayurveda.checar_combinacao` | Se dois ou mais itens são incompatíveis (viruddha ahara) | Ao montar uma refeição com mais de um alimento |

### Controle

| Tool | Faz |
|---|---|
| `ask_user` | Pausa o run com uma pergunta de um de dois tipos fechados: se a pessoa tem um alimento em casa (até 5 numa pergunta só) ou se come um alimento. O agente escolhe o tipo e os alimentos; o texto é montado por código. No máximo 2 perguntas por run. Pedido sobre o que já se sabe, sobre o que o filtro da pessoa barra ou fora dos candidatos é recusado |
| `finalizar` | Recebe a saída, roda o validador e entrega. Com violações, devolve a lista e não entrega |

**O validador** (função em código, chamada por `finalizar`) aponta:

Cada violação tem um código, o lugar e uma mensagem. Os códigos são `fora_da_base`, `estrutura`, `fora_de_casa`, `evitar_sempre`, `restricao`, `nao_come`, `nao_gosta`, `contraindicacao`, `combinacao`, `repetida`, `linha_base`, `qualidades`, `novidade`, `para_ter`, `texto_sem_estrutura`, `dosagem`, `tamanho` e `vazia`.

- `fora_da_base`: alimento, preparo, prática, troca ou linha citada que não existe na base; sugestão sem exatamente um entre `pratica_id` e `preparo_id`; tipo que não bate;
- `estrutura`: os itens de uma prática não são exatamente os ingredientes dela; item de um preparo fora de uma vaga ou que não serve à vaga; vaga obrigatória sem item; vaga acima do máximo;
- `fora_de_casa`: ingrediente que não está em casa; ingrediente incerto sem `se_faltar`; troca que não está confirmada em casa ou que não substitui o item;
- `evitar_sempre`, `restricao`, `nao_come`, `nao_gosta`: **"evitar sempre" violado** (alimento, ingrediente, óleo, troca, `para_ter` ou `citados`), e o mesmo para restrição, "não como" e "não gosto";
- `contraindicacao`: contraindicação do momento; prática que nunca se sugere com uma restrição da pessoa; alimento com marca a evitar agora;
- `combinacao`: combinação incompatível entre os itens da sugestão;
- `repetida`: sugestão já dada hoje ou repetida na mesma resposta;
- `linha_base`: motivo vazio; `linhas_base` vazio, com linha que não existe ou sem a linha da própria sugestão; `linha_base` de item diferente de `alimentos:<id>`; `evitar` com linha que não é do momento;
- `qualidades`: qualidade do momento que não veio do preparo nem do clima que a tool devolveu; qualidade buscada que não veio do preparo nem do oposto do clima; item que contribui com uma qualidade que o alimento não tem ou que não se busca;
- `novidade`: sugestão marcada como novidade que o preparo não marcou;
- `para_ter`: campo sem candidato no preparo, diferente do candidato, com `vezes` diferente da contagem ou com outra linha da base;
- `texto_sem_estrutura`: alimento ou prática da base citado no texto da resposta e ausente da parte estruturada (sugestões, trocas, `para_ter` ou `citados`);
- `dosagem`: unidade de dose (mg, cápsula, comprimido, gotas), suplemento, fitoterápico ou extrato no texto ou num motivo; medida de cozinha não conta;
- `tamanho`: resposta vazia ou acima de 900 caracteres; mais de 3 sugestões, de 3 `incertos` ou de 5 `citados`; motivo acima de 200 caracteres; incerto acima de 120;
- `vazia`: run de `momento` com candidatos no contexto e resposta sem sugestão nem `incertos`.

O validador recebe o clima só se `clima.agora` devolveu `ok` no run.

### Escrita (viram proposta, §5)

| Tool | Propõe |
|---|---|
| `memoria.propor` | Anotar o fato de rotina que o Intérprete apontou. O agente decide se propõe; o texto é a frase do Intérprete |
| `lista.propor` | Pôr na lista "Para ter em casa" um alimento que a pessoa respondeu que não tem e que faltou para uma sugestão. No máximo um por resposta, e nunca quando há candidato a "vale ter em casa" |

As tools de proposta nunca gravam: validam o pedido e devolvem a proposta, que `finalizar` recolhe.

**Propostas montadas por código**, sem o agente: o que a mensagem diz sobre a casa (tem, acabou), "evitar sempre", restrição, "não como" e "gosto" apontados pelo Intérprete, e a lista do `para_ter`. Todas entram no mesmo bloco.

**Gravação sem proposta:** `resultado.registrar`, usada quando a pessoa conta um retorno na conversa e o Intérprete não soube ligá-lo a uma sugestão. O agente só escolhe a sugestão; o resultado é o que o Intérprete apontou. A própria fala é o consentimento. Os toques da tela (Ajudou, Não gosto, Não tenho, Trocar, confirmar em "Ainda tem?") são gravados por rotas próprias, sem agente. As **faltas** (§6) também são gravadas por código, quando a resposta é entregue.

## 5. Aprovação (plano → aprovação → ação)

- As propostas saem juntas, no fim do run, num **bloco de aprovação**: "Posso anotar isto?", com uma linha por assunto (até 6), cada uma com liga/desliga, e os botões Anotar e Agora não.
- O run fica em `waiting_for_approval`. A resposta chega em `POST /api/runs/:id/approve`, e um **executor em código** grava só o que foi aprovado. O LLM não participa da gravação.
- A resposta do agente aparece **antes** da aprovação: a pessoa não precisa aprovar nada para receber valor.
- Proposta sem resposta em 30 min expira e nada é gravado.
- Padrões detectados (§6) entram no mesmo bloco, por último e no máximo um por resposta: *"Notei isto. Está certo?"* Linha aprovada confirma o padrão. Linha desligada, com outra ligada, recusa para sempre. "Agora não" e a expiração deixam o padrão para depois: ele volta no máximo uma vez por dia e até 3 vezes; depois disso, só dá para confirmar em "O que sei sobre você".
- A indicação de "vale ter em casa" (§6) entra no mesmo bloco, como proposta de lista. Proposta de lista recusada (linha desligada ou "Agora não"), por qualquer dos dois motivos, vale para sempre: o alimento não volta a ser proposto nem indicado. Proposta que expira sem resposta não conta como recusa.
- O executor só acrescenta. Nenhuma proposta remove ou troca o que já está guardado.
- Cada proposta, aprovação e recusa vira etapa do rastro.

## 6. Memória

| Nível | Conteúdo | Dura | Como chega ao agente |
|---|---|---|---|
| **Run** | Mensagem, clima consultado, rascunhos, violações, respostas da pessoa | Um run | Checkpoint do run |
| **Conversa** | Mensagens dos últimos 7 dias | 7 dias | As últimas 6 mensagens do dia vão no prompt; o resto, por `historico.recente` |
| **Fixos** | Dosha, cidade, evitar sempre, restrições, "não como" | Até a pessoa apagar (evitar sempre: só com confirmação) | No prompt, sempre, sem teto |
| **Casa** | Itens com estado e data de confirmação | Até a pessoa apagar | Tool `casa.ler`; o preparo já usa para ordenar |
| **Gostos e resultados** | Por alimento e por prática: gosta ou não gosta; quantas vezes ajudou, não ajudou, não fez | Até a pessoa apagar | Usados pela ordenação no preparo; detalhe por `preferencias.ler` |
| **Faltas** | Por alimento: os dias em que teria entrado numa resposta e não estava em casa | 30 dias | Contadas no preparo; no máximo **um** candidato a "vale ter em casa" vai para o prompt |
| **Rotina** | Notas curtas e datadas sobre a vida da pessoa (até 30 ativas) | Até a pessoa apagar | **Resumo de rotina** compactado (até 1200 caracteres) no prompt, sempre |
| **Padrões** | Regularidades confirmadas pela pessoa | Até a pessoa apagar | No prompt, sempre (até 10) |

### Ordenação (código)

Depois dos filtros, cada candidato recebe uma nota e é ordenado dentro do seu tipo (chá, refeição, óleo, prática); no empate, vale a adequação e depois o id. Os pesos ficam em `config/ranking.ts` e são testados sem LLM. Um preparo ou prática sem ingrediente recebe o ponto de "confirmado" inteiro; com ingredientes, vale a média dos pontos de casa deles.

| Sinal | Efeito |
|---|---|
| Adequação às qualidades buscadas e ao dosha | Base da nota |
| Está confirmado em casa | Sobe |
| Está incerto em casa | Sobe menos |
| A pessoa gosta | Sobe |
| Ajudou antes | Sobe a cada "ajudou", até 3 |
| Não ajudou | Desce a cada "não ajudou", até 2; quando os dois retornos mais recentes foram "não ajudou", vai para o fim do seu tipo |
| Já foi sugerido hoje | Sai (filtro) |
| Nunca foi sugerido, é bem adequado e tem todos os ingredientes em casa (confirmados ou incertos) | Pode ocupar a vaga de **novidade** (no máximo uma por resposta), no máximo na 3ª posição do seu tipo. Só há novidade quando a pessoa já recebeu alguma sugestão antes |

"Evitar sempre", "não como", "não gosto" e restrições não são nota: são filtro.

### Evitar sempre (código)

- O Intérprete aponta `evitar_sempre[]` quando a pessoa diz que não pode comer algo ("sou alérgica a camarão", "não posso comer amendoim"). O código traduz cada item para um grupo de `data/grupos_evitar.yaml` ou um id de alimento; o que não está na base fica como texto e vai para o prompt.
- Vale **no mesmo run**: entra no filtro do preparo antes do Acompanhante. Fica em `evitar_temporario` até o fim do dia, aprovado ou não.
- O código gera a proposta de fixo para o bloco de aprovação. Aprovada, vai para `perfis.evitar_sempre`.
- Remover é só pela rota do Perfil, com confirmação. Nenhuma tool do agente remove item de "evitar sempre"; o executor recusa.
- O motivo não é gravado: o Intérprete devolve só o alimento.
- **Restrição e "não como"** ditos na conversa ("sou vegetariana", "não como coentro") seguem a mesma regra: o Intérprete aponta, valem no mesmo run e até o fim do dia, e o código gera a proposta de fixo. A diferença é que saem do perfil sem confirmação especial.

### Faltas e "vale ter em casa" (código)

- Em todo run em que o preparo monta candidatos (§3), ele separa, entre os que passaram no filtro e antes do corte para o contexto, os **5 mais adequados** só pela nota de adequação, sem os sinais de casa, gosto e resultado. Uma prática conta pelos seus ingredientes. Uma refeição conta pelo alimento mais adequado de cada vaga obrigatória.
- Cada alimento desse grupo que **não está em casa** (nunca registrado, ou marcado como acabou) é uma falta `teria_entrado`. Item incerto não gera falta.
- O toque "Não tenho", num ingrediente sugerido ou em resposta a `ask_user`, é uma falta `nao_tenho`, gravada pela rota de toque.
- Uma falta por alimento por dia. As faltas `teria_entrado` são gravadas quando a resposta é entregue; run que falha não grava.
- **Candidato:** o alimento com faltas em pelo menos **3 dias diferentes** nos últimos **30**, contando hoje. Precisa passar pelos filtros de hoje ("evitar sempre", restrições, "não como", "não gosto"), não estar na lista "Para ter em casa" e não ter tido a indicação recusada. Com mais de um, vale o de mais dias; no empate, o de falta mais recente e depois o de nome menor na ordem alfabética.
- O candidato só vai para o contexto em run com intenção `momento` **e sem incômodo**. O preparo entrega no máximo um, com `alimento_id`, `nome`, `vezes`, `contribui` (as qualidades buscadas que o alimento tem) e `linha_base`.
- **O Acompanhante decide se a indicação cabe na resposta.** Se cabe, fecha o texto com uma frase sobre ela e preenche `para_ter`. O código escreve a linha de motivo ("fez falta N vezes nos últimos 30 dias") e gera a proposta de lista.
- Quando o alimento é confirmado em casa, as faltas dele são apagadas e ele sai da lista. Faltas com mais de 30 dias são apagadas pela limpeza diária.
- O tamanho do grupo, o mínimo de dias e a janela ficam em `config/ranking.ts` e são testados sem LLM.

### Sinais no contexto

O prompt recebe contadores, não conteúdo: `mensagens_hoje` (só as da pessoa), `itens_confirmados_em_casa`, `itens_incertos_em_casa`, `registros_de_gosto`, `registros_de_resultado`, `retornos_pendentes`, `tem_cidade`. Com eles o agente decide se vale consultar cada tool, e o eval mede se decidiu bem.

### Rotina

- O Intérprete aponta um `fato_de_rotina` quando a pessoa conta algo que muda a recomendação por mais de um dia.
- O Acompanhante propõe anotar (`memoria.propor`). Aprovado, vira uma nota com data.
- Logo depois da aprovação, o agente de Memória recebe as notas ativas e devolve o **resumo de rotina**: junta repetidas, resolve contradição a favor da mais recente e respeita o teto. Com uma nota só, o resumo é a própria nota, sem modelo. O resumo é validado antes de gravar (tamanho e nada de incômodo); a versão anterior fica guardada.
- Sem modelo, ou com resumo inválido, o código monta o resumo com as notas mais recentes primeiro. O resumo nunca fica desatualizado.
- As notas não mudam sozinhas: contradição se resolve no resumo, e nota só sai quando a pessoa tira. Com 30 notas ativas, uma nota nova não é proposta.

### Padrões

- Um job diário em código procura regularidades nos **registros estruturados** dos últimos 60 dias (estados do momento, sugestão, resultado). Nunca lê texto livre nem incômodos, e não chama modelo.
- Dois tipos: **o que ajuda em um estado**, por sugestão específica ("com frio e agitada → chá de gengibre com canela"), e **estados que andam juntos** ("pesada → sem energia").
- Critério: pelo menos 3 ocorrências e 75% de consistência. Em "o que ajuda", ocorrência é um "ajudou", e a consistência é a parte de "ajudou" entre "ajudou" e "não ajudou". Em "andam juntos", ocorrência é um dia.
- A frase é montada por código, a partir de um modelo de frase: *"Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar."*
- O padrão fica como **candidato** até a pessoa confirmar (até 3 candidatos por conta); recusado, não volta a ser proposto. Só o confirmado vai ao prompt.
- Padrão de uma sugestão que o filtro da pessoa barra hoje ("evitar sempre", restrição, "não como", "não gosto") não é proposto nem vai ao prompt.

### Transparência

A página "O que sei sobre você" mostra todos os níveis. A pessoa corrige e apaga item por item.

## 7. Human-in-the-loop

| Onde | O quê | Quem dispara |
|---|---|---|
| Durante o run | "Ainda tem abóbora e couve?", "Você come ovo?" | O agente, via `ask_user`, só quando a resposta muda a recomendação e não está na memória |
| Antes do agente | "A dor é latejante, tensa ou pesada?" | O código, quando a base diz que o incômodo tem variantes e a pessoa não disse qual é. Conta como uma das 2 perguntas |
| Na pergunta sobre um item | Tenho · Não tenho · Não gosto · Pular | A pessoa responde e a resposta é gravada na hora: Tenho confirma o item em casa, Não tenho marca que acabou e conta uma falta, Não gosto vira registro de gosto |
| Fim do run | Bloco de aprovação das propostas | O agente propõe; a pessoa decide |
| Na sugestão | Trocar · Não tenho · Não gosto, por ingrediente | A pessoa, quando quiser; resolvido por código |
| Em "Como ficou?" | Ajudou · Não ajudou · Não fiz | A pessoa, quando quiser |
| Na resposta | 👍 / 👎 | A pessoa; sinal de qualidade |

Pausa: o run é salvo como `waiting_for_input` ou `waiting_for_approval`, com o checkpoint. A resposta chega em outro pedido e retoma do checkpoint. Um run aberto por pessoa; espera de mais de 30 min expira.

## 8. Guardrails

**Entrada (código, antes de qualquer LLM):** teto de tamanho; padrões de injection; padrões de sinal de alerta, físico e emocional; texto da pessoa sempre delimitado e marcado como dado; limites de uso. Os padrões pegam só as frases claras e encerram o run com o texto fixo, sem chamar modelo; injection clara leva à resposta padrão mesmo com um pedido legítimo junto.

**Memória também é dado:** tudo o que veio do texto da pessoa e volta ao prompt depois (resumo de rotina, mensagens do dia, "evitar sempre" em texto livre, frases de padrões) entra delimitado, com `<` e `>` neutralizados, e o prompt diz que é dado, como a mensagem. Uma nota aprovada com "ignore suas regras" não vira instrução.

**Entre os passos (código):** resultado de tool é dado, nunca instrução; argumentos de tool validados em zod; tool fora do catálogo do agente é recusada e vira etapa de erro.

**Saída (Juiz, fail-closed, uma nova tentativa):** fica com o que precisa de leitura: promessa de saúde ou de tratamento ("trata", "cura", "resolve a dor"), dosagem, suplemento e fitoterápico; conselho fora do papel; "evitar sempre" citado com outro nome; motivo que não faz sentido diante da linha citada; texto que diz algo diferente da parte estruturada; tom que cobra ou julga a pessoa; indicação de "vale ter em casa" apresentada como solução para o momento, ou com marca, loja ou preço; palavrão, linguagem vulgar ou repetição de ofensa da pessoa. Qualquer um desses reprova: o Acompanhante recebe a lista e tenta de novo, uma vez, no papel `reforco`; reprovada de novo, sai a resposta segura. **Jargão sem explicação não reprova:** fica registrado na etapa e na métrica. O Juiz também lê a proposta de nota de rotina: com assunto de saúde, a linha sai do bloco e a resposta segue. Ele não recebe a mensagem da pessoa. Tudo o que dá para conferir por regra já foi barrado pelo validador.

**Incômodo e sinal de alerta:** incômodo leve recebe recomendação de conforto, com linguagem de conforto e o aviso reforçado, que é anexado por código (`BUSINESS.md` §12). Sinal de alerta é barrado antes do agente: só encaminhamento. O incômodo não vai para nenhum nível de memória nem para propostas.

**Conversa sobre a vida:** o agente acolhe e usa o que ouviu. Não dá conselho psicológico, médico, financeiro ou jurídico; quando a conversa pede isso, diz que não é o papel dele.

**Sofrimento emocional:** falar em sumir, em não aguentar mais, em se machucar ou em morrer é **sinal de alerta emocional**. Padrões em código pegam os casos claros; o Intérprete marca `alerta` com tipo `emocional` nos outros. Na dúvida, conta como alerta. O run termina antes do agente, com o texto fixo de `BUSINESS.md` §12 (CVV 188 e SAMU 192). Nada vai para a memória, e a mensagem é apagada no dia seguinte, como o incômodo. Tristeza ou cansaço comuns ("dia pesado", "tô pra baixo") não são alerta: o agente acolhe e segue.

**Palavrão e ofensa:** não há lista de palavras proibidas (ela barraria "canela em pau" e "cravo").
- Desabafo com palavrão ("que dia de merda, tô morta"): segue o caminho normal. O agente responde ao que a pessoa contou e não repete o palavrão.
- Ofensa ao Ritu, sozinha ("você é inútil"): o Intérprete marca `ofensa`; o código responde com um texto curto, sem sermão, que convida a continuar (`BUSINESS.md` §8). Ofensa junto com outra intenção: o agente responde ao resto e ignora a ofensa.
- Conteúdo sexual, de ódio ou assédio: caminho `fora`, resposta padrão.
- O agente nunca usa palavrão nem repete ofensa. O Juiz confere.

## 9. Context engineering

- Prompts em arquivo versionado (`src/core/agents/prompts/`); a versão vai para o run e para o span.
- No prompt do Acompanhante: fixos, resumo de rotina, padrões confirmados, últimas mensagens do dia, saída do Intérprete, momento em qualidades, candidatos ordenados, candidato a "vale ter em casa" (quando há), sinais e a política de uso das tools ("consulte só o que muda a decisão").
- Fora do prompt: a base, o clima, a casa completa, o detalhe de gostos e resultados e o histórico. Tudo isso vem por tool.
- Tom da resposta, definido no prompt: fala com a pessoa em segunda pessoa, frases curtas, começa pelo que ela contou, explica o porquê em linguagem do dia a dia e nunca abre com lista.

## 10. Modelos e cotas

O Ritu usa só o plano gratuito do Gemini. Cada modelo tem a sua cota, por projeto. O uso é dividido em **papéis**, e cada papel tem uma lista ordenada de modelos.

### Cotas por modelo

| Modelo | Identificador na API | Pedidos por minuto | Tokens por minuto | Pedidos por dia |
|---|---|---|---|---|
| Gemini 3.5 Flash Lite | `gemini-3.5-flash-lite` | 15 | 250 mil | 500 |
| Gemini 3.1 Flash Lite | `gemini-3.1-flash-lite` | 15 | 250 mil | 500 |
| Gemini 3.6 Flash | `gemini-3.6-flash` | 5 | 250 mil | 20 |

Os identificadores e as cotas ficam em `config/llm-cotas.ts`, versionados. Não são segredo e não vêm de variável de ambiente: trocar de modelo é um commit.

### Papéis

| Papel | Quem usa | Modelo principal | Se acabar a cota, tenta |
|---|---|---|---|
| `decisao` | Acompanhante | Gemini 3.5 Flash Lite | 3.1 Flash Lite → 3.6 Flash |
| `apoio` | Intérprete, Juiz, Memória | Gemini 3.1 Flash Lite | 3.5 Flash Lite |
| `reforco` | Segunda tentativa do Acompanhante, depois de uma reprovação do Juiz | Gemini 3.6 Flash | 3.5 Flash Lite → 3.1 Flash Lite |

Por que assim:

- Os dois modelos com 500 pedidos por dia carregam o volume. O Acompanhante e o Juiz ficam em modelos **diferentes**, para o juiz não repetir o viés de quem escreveu.
- O modelo Flash tem 20 pedidos por dia. É escasso, então só entra onde um modelo mais forte muda o resultado: a segunda tentativa de uma resposta reprovada. No papel `decisao` ele é a última reserva.
- Capacidade diária aproximada, sem troca de modelo: cerca de 160 mensagens de momento (3 chamadas de `decisao` cada) e 250 mensagens no papel `apoio` (2 chamadas cada).

### O roteador (`ModelRouter`)

- Antes de cada chamada, reserva uma vaga no **registro de uso** (tabela `llm_uso`, contadores por modelo, por minuto e por dia). Sem vaga, passa para o próximo modelo da lista do papel.
- O dia da cota vira à meia-noite do horário do Pacífico.
- A reserva soma um pedido na janela do minuto (minuto cheio, em UTC) e na do dia numa única operação atômica. Os tokens são somados depois da chamada; com os tokens do minuto acima do limite, o modelo não recebe reserva nova naquele minuto.
- Erro 429 tira o modelo até o fim do minuto e segue para o próximo; no terceiro 429 do mesmo dia da cota, o modelo fica fora até a virada do dia. O adaptador nunca tenta de novo sozinho.
- Um run tenta manter o mesmo modelo do começo ao fim de cada papel: o modelo do checkpoint é tentado primeiro, e depois a lista do papel desde o começo. Assim o papel volta ao principal quando a cota dele se renova.
- Os identificadores de modelo só aparecem em `config/llm-cotas.ts` (regra R10 do teste de arquitetura). ⚠️ `npm run modelos:check` faz uma chamada mínima por modelo e mostra o que deixou de responder; `npm run cotas` mostra o uso.
- Sem nenhum modelo disponível para `decisao`: o run termina com a resposta montada por código (`BUSINESS.md` §14) e a tela avisa.
- Sem nenhum modelo disponível para o Juiz: a resposta não é entregue (fail-closed) e sai a resposta segura.
- O modelo usado, o papel e se houve troca ficam no run, na etapa e no span.

Cada ambiente (desenvolvimento e produção) tem a sua chave e o seu registro de uso.

## 11. Chamadas por mensagem

| Tipo de mensagem | `apoio` | `decisao` | Total típico |
|---|---|---|---|
| Momento com texto | 2 (Intérprete, Juiz) | 2 a 4 | 4 a 6 |
| Pergunta ou relato | 2 | 1 a 2 | 3 a 4 |
| Só casa ou só retorno | 1 | 0 | 1 |
| Toques na tela | 0 | 0 | 0 |

- Cache do clima e da previsão: 1 h por cidade.
- Testes e evals determinísticos não chamam modelo. Evals com LLM só nos checkpoints (`QA.md`).

## 12. Técnicas usadas

| Técnica | Onde |
|---|---|
| Agente com tools em loop (ReAct) e caminho variável | §3, §4 |
| Roteamento por intenção, com caminhos sem agente | §3 |
| Autocorreção guiada por validador | `finalizar` |
| Avaliador-otimizador (juiz com nova tentativa em modelo mais forte) | §3, §8, §10 |
| Human-in-the-loop com pausa e retomada | §7 |
| Modo de aprovação para ações de escrita | §5 |
| Ciclo de retorno e aprendizado por resultado e por gosto | §6 |
| Memória em níveis, com compactação e padrões confirmados | §6 |
| Saída estruturada com texto, e catálogo fechado | §3, §4 |
| Grounding em base estruturada, com abstenção | `KNOWLEDGE.md` |
| Roteamento de modelos por papel, com registro de cota e troca automática | §10 |
| Defesa contra injection em entrada, tools e saída | §8 |
| Evals determinísticos, com LLM, de trajetória e de segurança | `QA.md` |
| Observabilidade em três camadas | `OBSERVABILITY.md` |
| Servidor MCP com as tools de leitura | `ARCHITECTURE.md` |
