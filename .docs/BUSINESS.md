# Negócio e produto

> Fonte de verdade sobre **o que** o produto faz e **para quem**. O **como** fica em `ARCHITECTURE.md` e `AI.md`.

## 1. O problema

Quem se interessa por Ayurveda sabe que "o que é bom para mim" depende da constituição, do momento e do clima. A pergunta do dia a dia é:

**"Estou assim agora. O que eu faço com o que tenho em casa?"**

A resposta precisa ser imediata e usar o que a pessoa já tem. Comprar algo não resolve o momento: até chegar e ser preparado, o momento passou. O que a compra resolve são as próximas vezes: quando um alimento teria servido em vários momentos e nunca está em casa, vale a pessoa saber disso. Precisa considerar o clima de verdade (um dia frio e úmido pede outra coisa que um dia quente e seco) e precisa conhecer a pessoa: do que ela gosta, o que já funcionou para ela, como é a rotina dela.

O Ritu é um **site** (responsivo, pensado primeiro para o celular).

## 2. Princípios do produto

1. **A pessoa fala do jeito dela.** A entrada é uma conversa em texto livre. Ela pode dizer como está, perguntar sobre um alimento, contar do dia ou avisar que foi à feira.
2. **O agente responde como gente.** Toda resposta é um texto do agente, falando com a pessoa. Listas e blocos visuais só apoiam a resposta.
3. **Parte do que há em casa.** A recomendação usa os alimentos que a pessoa tem, e cada ingrediente pode ser trocado por outro equivalente.
4. **Explica o porquê.** A resposta diz quais qualidades o momento pede, o que cada alimento traz e por que eles combinam.
5. **Lembra e aprende.** O que a pessoa tem, o que gosta, o que funcionou e como é a rotina dela pesam nas próximas respostas. O que fez falta várias vezes vira uma indicação do que vale ter em casa.
6. **Nada escondido.** Tudo o que o Ritu sabe sobre a pessoa aparece na tela e pode ser corrigido ou apagado por ela.
7. **Valor antes do cadastro.** A primeira resposta vem sem perfil preenchido.

## 3. Como funciona

| | |
|---|---|
| Entrada | Mensagem livre, com atalhos de check-in opcionais (§8) |
| Base ayurvédica | **Vikriti** (o desequilíbrio do momento), ponderado pela **prakriti** (a constituição) |
| O que o agente consulta | Clima da cidade da pessoa, o que ela tem em casa, do que gosta, o que já funcionou, a rotina, a conversa do dia e a base de alimentos e práticas |
| Saída | Um texto do agente e, quando houver ação concreta, até 3 sugestões (chá, refeição, óleo, prática) com ingredientes, motivo e troca. Quando um alimento já fez falta várias vezes, uma indicação de "vale ter em casa" (§9) |
| Depois da resposta | O agente **propõe** o que anotar (casa, preferência, rotina, item para ter em casa). Nada é gravado sem a pessoa aprovar |
| Retorno | Cada sugestão fica na área **"Como ficou?"**. A pessoa responde se quiser, com um toque |
| Quem começa | Sempre a pessoa. O produto não manda mensagens, e-mails nem notificações |

## 4. Quem usa

| Persona | O que quer | Implicação |
|---|---|---|
| **Pessoa curiosa por Ayurveda** | Respostas simples, com motivo, que caibam na rotina e na cozinha dela | Linguagem leve; termos em sânscrito só com explicação |
| **Visitante** | Experimentar sem criar conta nem preencher nada | Botão **"Testar com perfil de demonstração"**, que entra com dados prontos e uma mensagem sugerida (§6) |
| **Testers** | Usar sem limites | Lista de testers em variável de ambiente |

## 5. Glossário

| Termo | Significado no projeto |
|---|---|
| **Dosha** | Cada um dos três princípios: **Vata** (ar e espaço), **Pitta** (fogo e água), **Kapha** (terra e água) |
| **Prakriti** | Constituição de nascença, a combinação de doshas da pessoa. Vem do **quiz** ou é declarada |
| **Vikriti** | Desequilíbrio do momento. Vem da conversa |
| **Gunas** | Qualidades em pares (pesado/leve, oleoso/seco, frio/quente…). São o **vocabulário comum** entre o estado da pessoa, o clima, os alimentos e as práticas (`KNOWLEDGE.md`) |
| **Rasa** | Os 6 sabores: doce, azedo, salgado, picante, amargo, adstringente |
| **Virya** | Efeito térmico de um alimento: quente ou frio |
| **Vipaka** | Efeito depois da digestão: doce, azedo ou picante |
| **Abhyanga** | Automassagem com óleo |
| **Ritucharya** | Rotina sazonal. Aqui, adaptada ao **clima real** da cidade da pessoa |
| **Viruddha ahara** | Combinações incompatíveis de alimentos |
| **Minha casa** | O que a pessoa tem em casa: alimentos, ervas, especiarias, óleos. Serve de base; o agente confirma o que estiver incerto |
| **Momento** | O que a pessoa conta sobre como está agora |
| **Sugestão** | Uma ação concreta dentro de uma resposta: chá, refeição, óleo ou prática |
| **Evitar sempre** | Alimentos ou grupos de alimentos que a pessoa nunca pode comer nem usar na pele (amendoim, castanhas, leite, ovo, soja, trigo, gergelim, peixe, frutos do mar, ou um alimento específico). É o filtro mais rígido do Ritu. Guarda só o alimento, nunca o motivo |
| **Retorno** | O que a pessoa conta sobre uma sugestão: ajudou, não ajudou, não fez |
| **Falta** | O registro de que um alimento teria entrado numa resposta e não estava em casa (§9) |
| **Vale ter em casa** | Indicação, dentro de uma resposta, de um alimento que fez falta várias vezes. Vai para a lista "Para ter em casa" se a pessoa aprovar |
| **Run** | Uma execução do agente para uma mensagem, com rastro das etapas |

## 6. Entrada no site

| Opção | Como funciona |
|---|---|
| **Testar com perfil de demonstração** | Cria uma **conta temporária** com a cópia de um perfil semeado (dosha, cidade, casa, gostos, faltas, rotina, retornos e conversas anteriores). Cada visitante tem a sua; expira em 24 h |
| **Entrar com Google** | Perfil e memória salvos e disponíveis em qualquer dispositivo |

### Caminho da demonstração

Meta: **primeira resposta em menos de 1 minuto, sem preencher nenhum campo.**

1. Na Entrada, o botão **"Testar com perfil de demonstração"** é o primeiro e o mais visível.
2. Um toque. Sem formulário: a cópia do perfil semeado é criada e a pessoa já entra.
3. Aparece o **Aviso inicial** (§12), que a demonstração também vê. O botão do Aviso é o segundo toque: são **dois toques** até a conversa, sem preencher nada.
4. Cai na tela **Conversa**, com:
   - uma faixa: *"Você está no perfil de demonstração: Vata-Pitta, no Rio, com gengibre, canela, abóbora e arroz em casa · [Criar meu perfil]"*;
   - uma **mensagem sugerida já escrita** (ex.: "acordei com frio e agitada, o que eu como?"), que pode ser trocada. Basta tocar em **Enviar**.
5. Vê o progresso ao vivo, a resposta do agente, as sugestões e o botão **"Como pensei"**.
6. Abaixo da resposta aparece o que o agente propõe anotar.
7. A demo já vem com itens em **"Como ficou?"**, com itens incertos em **Minha casa**, com um alimento que já fez falta várias vezes e com a página **"O que sei sobre você"** preenchida.

"Criar meu perfil" sai da demo e leva ao login com Google.

## 7. Telas

| Tela | Conteúdo |
|---|---|
| **Entrada** | O que é, aviso de que não é orientação médica, demonstração em destaque e Google |
| **Aviso inicial** | O aviso de §12 e, para conta nova, a pergunta do dosha e da cidade. Uma vez só |
| **Conversa** (tela inicial depois de entrar) | Mensagens do dia; caixa de texto; atalhos de check-in; etapas do agente ao vivo; pergunta do agente; resposta em texto com sugestões de apoio; indicação de "vale ter em casa"; o que o agente propõe anotar; indicador discreto de "Como ficou?" |
| **Minha casa** (aba) | Uma página: seção **"Ainda tem?"** no topo, com o que ficou incerto; o que a pessoa tem em **prateleiras** por grupo, com os itens como rótulos ("sempre tenho" e gosto marcados no rótulo; um toque abre as opções); prateleira **"Acabou"**; lista **"Para ter em casa"**, com o motivo de cada item |
| **Como ficou?** | Sugestões recebidas que ainda não têm retorno. Um toque em cada: Ajudou · Não ajudou · Não fiz |
| **Carta do dosha** (no topo de Você) | Dosha, características, o que desequilibra e o que equilibra. Dosha misto: uma aba por dosha; a proporção só aparece para quem fez o quiz. Sem dosha: "Descubra seu dosha" |
| **Evitar sempre** (passo do onboarding) | "Tem algum alimento que você nunca pode comer?" Grupos para tocar, busca de alimento, Nenhum · Pular (§13) |
| **Quiz** | As 8 perguntas do dosha |
| **Como pensei** | Linha do tempo do rastro: o que o agente entendeu, consultou, corrigiu, perguntou e propôs, e o que o juiz disse. Os detalhes técnicos (modelo, tokens, tempo) ficam recolhidos, por passo e no total |
| **O que sei sobre você** (em Você) | Tudo o que o Ritu guarda, por nível (§11), editável e apagável item por item. Os fixos (dosha, cidade, **evitar sempre**, restrições, "não como") mudam aqui mesmo |
| **Conta** (em Você) | Como a pessoa entrou (Google ou demonstração, com "Criar meu perfil"), tema, **Sair** e **Apagar meus dados** |
| **Bastidores** (pública) | Números agregados do agente e a evolução dos evals (`OBSERVABILITY.md` §4) |
| **Sobre** | O projeto, privacidade, link do repositório |

Quem entrou navega por quatro destinos: **Conversa**, **Minha casa**, **Como ficou?** e **Você**. A barra fica embaixo no celular e na lateral no desktop. **Você** junta a carta do dosha, o que o Ritu sabe sobre a pessoa e a Conta.

## 8. A conversa

### O que a pessoa pode dizer

Qualquer coisa. O agente entende a intenção de cada mensagem, e uma mensagem pode ter mais de uma.

| A pessoa diz | O que o Ritu faz |
|---|---|
| Como está agora ("acordei com frio e sem fome") | Responde com o que fazer já, usando o que há em casa |
| Uma pergunta ("manga é boa para Pitta?", "por que gengibre aquece?") | Explica, a partir da base, e relaciona com a pessoa quando fizer sentido |
| Algo sobre a casa ("fui à feira, trouxe abóbora e couve", "acabou o arroz") | Propõe atualizar Minha casa |
| Um retorno ("tomei o chá e melhorei") | Registra o resultado e ajusta as próximas sugestões. Se não ajudou, convida a contar como está agora. Se não der para saber de qual sugestão ela fala, não registra e aponta "Como ficou?" |
| Algo que nunca pode comer ("não posso comer camarão"), que não come ("não como coentro") ou uma restrição ("sou vegetariana") | Para de sugerir na hora, pelo resto do dia, e propõe guardar (§11) |
| Uma dúvida sobre o próprio Ritu ("como apago meus dados?", "o que você sabe de mim?") | Resposta curta que aponta onde fica: "O que sei sobre você", a Conta ou Minha casa |
| Algo da vida ("essa semana vou almoçar fora todo dia") | Acolhe, usa na resposta e pode propor anotar a rotina |
| Um incômodo leve ("tô com dor de cabeça, o que como no almoço?") | Recomenda conforto, com aviso reforçado (§12) |
| Um sinal de alerta, físico ou emocional | Não recomenda; encaminha para um profissional, urgência ou CVV (§12) |
| Um desabafo com palavrão ("que dia de merda") | Responde normalmente ao que a pessoa contou, sem repetir o palavrão |
| Uma ofensa ao Ritu ("você é inútil") | Resposta curta, sem sermão: *"Tudo bem, tem dia que é assim. Se quiser, me conta como você está agora que eu tento ajudar."* Com algo mais na mensagem, responde ao resto |
| Algo fora do assunto, conteúdo sexual ou de ódio, ou tentativa de mudar as regras | Resposta padrão, sem executar nada |

### Atalhos de check-in

Ficam acima da caixa de texto, com ícone de traço fino, e são opcionais. Marcar um atalho equivale a dizer aquilo por escrito, e pode ser combinado com texto.

| Eixo | Opções |
|---|---|
| Temperatura | Com frio · Com calor |
| Corpo | Pesada, inchada · Seca, ressecada |
| Mente | Agitada, ansiosa · Irritada · Sem energia |

### Fluxo de uma mensagem

1. A pessoa escreve (ou marca atalhos) e envia. Na demonstração, a caixa vem com uma mensagem sugerida, só enquanto não há mensagem no dia. Na conta Google, ela começa vazia.
2. A tela mostra as **etapas ao vivo**, com frases do produto: "entendendo sua mensagem… vendo o clima… olhando sua casa… conferindo a resposta…". Etapas sem frase não aparecem.
3. Se faltar algo que muda a resposta, o agente **pergunta na própria tela**, com botões. No máximo duas perguntas por mensagem. Perguntas sobre a casa vêm agrupadas: *"Ainda tem abóbora, couve e ovos?"*, com Tenho · Não tenho · Não gosto em cada item. Toda pergunta tem **Pular**. A pergunta vale por 30 minutos; escrever outra mensagem a deixa de lado.
4. A resposta aparece inteira, como **texto do agente**, com as sugestões logo abaixo. As etapas recolhem em **"Pensei em N passos"**, e "Como pensei" leva ao rastro:

```
Com esse frio úmido de hoje e a agitação que você contou, o seu corpo
pede coisas quentes, úmidas e que assentem. Você tem abóbora e arroz
em casa: um arroz bem cozido com abóbora e um fio de ghee faz isso.
O gengibre entra para aquecer. Da última vez, o chá de gengibre com
canela te ajudou, então ele abre a lista.

Para as próximas vezes: o cardamomo já fez falta 4 vezes por aqui.
Vale ter em casa.

☕ Chá de gengibre com canela                          [por quê?]
   gengibre · canela                     aquece · assenta
🍲 Arroz bem cozido com abóbora e ghee                 [por quê?]
   arroz · abóbora · ghee [trocar]       aquece · umedece · assenta
🧘 Pés aquecidos e 5 minutos de respiração lenta

Evite agora: gelados e crus.

🛒 Vale ter em casa: cardamomo                         [por quê?]
   fez falta 4 vezes nos últimos 30 dias               aquece

Não é orientação médica.              [👍] [👎]   [Como pensei]
```

5. Em cada ingrediente, a pessoa pode tocar em **Trocar**, **Não tenho** ou **Não gosto** (§9).
6. Quando um alimento já fez falta várias vezes, a resposta traz uma indicação de **"vale ter em casa"**: uma frase no fim do texto e uma linha abaixo das sugestões. É para as próximas vezes, e vem no máximo uma por resposta (§9).
7. Logo abaixo, o que o agente **propõe anotar**:

```
Posso anotar isto?
[x] Você tem couve e abóbora em casa
[x] Cardamomo na lista "Para ter em casa" (já fez falta 4 vezes)
[x] Durante a semana você almoça fora
                                   [Agora não] [Anotar]
```

O texto de cada linha é montado pelo Ritu, e o que a pessoa lê é o que é gravado. Os modelos são: *Você tem {itens} em casa*, *Acabou: {itens}*, *Não sugerir mais {itens} (Evitar sempre)*, *Sua alimentação é {itens}*, *Você não come {itens}*, *Você gosta de {itens}*, *{Item} na lista "Para ter em casa" (faltou para {detalhe})* e *{Item} na lista "Para ter em casa" (já fez falta {detalhe} vezes)*. A nota de rotina é a frase da pessoa, com a primeira letra maiúscula.

Regras do bloco:

- Uma linha por assunto, no máximo 6, nesta ordem: "evitar sempre", restrição, "não como", gosto, casa (tem), casa (acabou), lista e rotina. Cada linha liga e desliga; **Anotar** grava as ligadas e **Agora não** não grava nenhuma.
- A resposta do agente vem antes do bloco e não fala dele. A pessoa não precisa decidir para receber a resposta.
- Sem resposta em 30 minutos, ou ao escrever outra mensagem, o bloco expira e nada é gravado.
- Com incômodo de saúde na mensagem, não há bloco: nada é proposto.

8. As sugestões da resposta entram na área **"Como ficou?"**.

Se a pessoa já conversou hoje, o agente leva isso em conta: não repete a mesma sugestão e comenta a mudança. Se o clima não estiver disponível ou a pessoa não tiver escolhido a cidade, a resposta sai mesmo assim e diz isso.

### Sem dosha

O agente responde com o momento e o clima, e avisa: *"Resposta geral. Descubra seu dosha para eu acertar mais."*

## 9. Minha casa, trocas e gostos

### Minha casa

É a base do que a pessoa tem. **Não é a verdade absoluta:** a comida acaba e a pessoa não avisa. Por isso cada item tem uma data de confirmação e um estado.

| Estado | Quando | O que o agente faz |
|---|---|---|
| **Confirmado** | A pessoa disse que tem, dentro da validade do grupo | Usa sem perguntar |
| **Incerto** | Passou a validade do grupo desde a última confirmação | Pergunta antes de usar, ou sugere já com uma troca pronta |
| **Acabou** | A pessoa disse que não tem | Não usa; pode propor pôr na lista "Para ter em casa" |
| **Sempre tenho** | A pessoa marcou o item como básico da casa | Usa sem perguntar; nunca fica incerto |

Validade por grupo, contada da última confirmação:

| Duração | Grupos | Fica incerto depois de |
|---|---|---|
| Curta | Folhas, frutas, legumes e verduras frescos, ervas frescas | 5 dias |
| Média | Raízes e tubérculos, ovos, laticínios, pães | 14 dias |
| Longa | Grãos, leguminosas secas, especiarias, ervas secas, óleos, oleaginosas, adoçantes | 90 dias |

Como a casa é atualizada:

- **Pela conversa:** "comprei…", "acabou…". O agente propõe e a pessoa aprova.
- **Respondendo a uma pergunta do agente:** Tenho, Não tenho e Não gosto são gravados na hora, antes de o agente retomar; o toque é o consentimento. "Não como", na pergunta sobre um alimento, vale no mesmo run e vira proposta de anotação.
- **Pela aba Minha casa:** a pessoa adiciona (pela busca ou por texto livre), tira, marca "sempre tenho", marca "acabou" e resolve a seção "Ainda tem?" com um toque por item. **"Acabou" pela aba não é falta:** o item vai para a prateleira "Acabou", de onde a pessoa marca "Tenho de novo" ou o põe na lista. Falta é só o que fez falta para uma sugestão.
- **Alimento que a base não conhece:** fica guardado na casa com a marca *"ainda não conheço este alimento"*. O agente não o usa em sugestões e diz isso quando for o caso.

### Trocar um ingrediente

Cada ingrediente de uma sugestão pode ser trocado sem refazer a resposta. O substituto é o alimento com as qualidades mais próximas, na mesma função do preparo, que passe por "evitar sempre", pelas restrições e pelas combinações. A ordem de preferência é: tem em casa, gosta, já funcionou. A troca mostra o motivo: *"Troquei canela por cravo: os dois aquecem."* Se não houver substituto, a tela diz isso: *"Não achei uma troca para canela com o que você tem em casa."*

O substituto é sempre algo que está confirmado em casa. Quando não há, o Ritu pergunta se a pessoa tem o substituto mais próximo: com "Tenho", registra em casa e faz a troca; com "Não tenho", anota a falta, que conta para o "vale ter em casa". É no máximo uma pergunta por troca. Um alimento que a pessoa já disse que acabou não é oferecido. Cada ingrediente aceita até **três trocas**, sem repetir um que já saiu; depois disso, a tela diz que não há troca. "Não tenho" para um alimento que nunca foi registrado anota só a falta, e ele pode ser perguntado de novo numa troca seguinte.

Tocar em "Não tenho" ou em "Não gosto" num ingrediente anota e já faz a troca, no mesmo toque. O que foi anotado fica anotado mesmo quando não há substituto. O retorno da sugestão guarda o ingrediente que ficou.

A troca é feita por código, com a base de alimentos. Não chama o modelo.

### Gostos

Três informações diferentes por alimento ou prática, guardadas separadas:

| Informação | De onde vem | Efeito |
|---|---|---|
| **Tem em casa** | Minha casa | Decide se pode entrar agora |
| **Gosta / não gosta** | Toque em "Não gosto" num ingrediente, resposta a uma pergunta do agente ("Tenho" · "Não tenho" · "Não gosto"), marcação em Minha casa, ou o que a pessoa escreve ("adoro gengibre" vale na mesma resposta, sobe na ordem das opções, e só é guardado com aprovação; "não gosto de quiabo" entra como "não como") | Quem ela gosta sobe na ordem; quem ela não gosta deixa de ser sugerido |
| **Funcionou** | Retornos de "Como ficou?" | O que ajudou sobe; o que não ajudou nas duas últimas vezes vai para o fim |

Regra: **a adequação ayurvédica, "evitar sempre" e as restrições filtram; gosto e resultado só ordenam o que passou no filtro.** Gostar de um alimento nunca faz o agente sugeri-lo quando ele não serve para o momento.

Para as respostas não ficarem sempre iguais, quando há uma boa opção que a pessoa ainda não experimentou, **uma** sugestão pode vir marcada como *novidade*.

### O que fez falta

Às vezes o alimento mais indicado para o momento não está em casa. O Ritu anota isso, para saber o que vale a pessoa ter.

Uma **falta** é anotada em dois casos:

| Caso | Quando |
|---|---|
| **Teria entrado** | O alimento estava entre os mais adequados para o momento e não estava em casa (nunca foi registrado, ou acabou) |
| **Não tenho** | A pessoa tocou em "Não tenho" num ingrediente sugerido, ou respondeu "Não tenho" a uma pergunta do agente ou de uma troca |

- A falta "teria entrado" é gravada quando a resposta é entregue; resposta que não chega à pessoa não grava falta.
- Cada alimento conta no máximo **uma vez por dia**.
- Item incerto não conta como falta: a pessoa talvez ainda tenha.
- As faltas valem por **30 dias**. Depois disso, são apagadas.
- Quando a pessoa registra o alimento em casa, as faltas dele são apagadas.

### Vale ter em casa

Quando um alimento fez falta em **3 dias diferentes** nos últimos 30, o agente pode dizer isso na resposta: uma frase no fim do texto e uma linha abaixo das sugestões, com o número de vezes e o que o alimento traz.

- **No máximo uma indicação por resposta.** Entre vários alimentos, vale o que fez falta mais vezes.
- **É para as próximas vezes.** A resposta do momento continua sendo feita só com o que há em casa.
- Só aparece em resposta a um momento. Nunca em resposta a um incômodo ou a um sinal de alerta.
- O alimento passa pelos mesmos filtros das sugestões: "evitar sempre", restrições, "não como" e "não gosto".
- Só alimentos da base. Sem marca, loja ou preço.
- Junto vem a proposta de pôr o alimento na lista "Para ter em casa". **Aprovada:** ele entra na lista. **Recusada:** o Ritu não indica esse alimento de novo.
- Alimento que já está na lista não é indicado de novo.

### Lista "Para ter em casa"

Fica na aba Minha casa. É um lembrete para a pessoa. Cada item mostra por que está ali:

| Como o item entra | Motivo mostrado |
|---|---|
| Faltou para uma sugestão de hoje, e a pessoa respondeu "Não tenho" quando o Ritu perguntou | "Faltou para o chá de gengibre com canela" |
| Fez falta várias vezes (indicação de "vale ter em casa") | "Fez falta 4 vezes nos últimos 30 dias" |
| A pessoa pôs na lista por conta própria | "Você pôs na lista" |

Os dois caminhos passam pela aprovação da pessoa. Recusada a proposta (linha desligada ou "Agora não"), o Ritu não propõe nem indica esse alimento de novo, **para sempre**; ela pode pôr na lista por conta própria. Proposta que expira sem resposta não conta como recusa, e o alimento pode voltar. Ela pode tirar um item da lista quando quiser; tirar também apaga as faltas daquele alimento, para o Ritu não indicá-lo de novo na resposta seguinte. Quando registra o alimento em casa ("Comprei"), ele sai da lista.

## 10. Como ficou?

- Toda sugestão entregue entra nesta área enquanto espera retorno, agrupada por dia (Hoje, Ontem, Há 3 dias), da mais recente para a mais antiga.
- A pessoa responde **se quiser**, com um toque: **Ajudou · Não ajudou · Não fiz**. O toque é gravado na hora, por código.
- Quem quiser pode escrever mais ("ajudou, mas achei forte"). Aí o agente lê, registra e pode ajustar as próximas sugestões.
- O retorno também pode vir pela conversa ("tomei o chá e melhorei"): o agente liga o comentário à sugestão certa e o registro vale como a resposta da pessoa. Se não dá para saber de qual sugestão ela fala, o Ritu diz que ela pode marcar em "Como ficou?" e não anota nada. O resultado ("ajudou", "não ajudou", "não fiz") é o que a pessoa disse, nunca uma dedução.
- Cada retorno vale uma vez. Se o toque e a conversa chegam ao mesmo tempo, só o primeiro conta.
- Depois do toque, a sugestão mostra "Anotado: ajudou." e fica na tela até a pessoa sair; na visita seguinte ela já não aparece. A área não vira histórico: o que funcionou aparece no efeito das sugestões.
- Sugestão sem retorno sai da área depois de **7 dias**, sem contar como "não fiz".
- O produto não cobra. A tela Conversa só mostra um indicador discreto: *"3 sugestões esperando seu retorno"*.
- O texto da área explica para que serve: *"Seu retorno me ajuda a acertar mais nas próximas vezes."*

## 11. O que o Ritu lembra

A memória tem níveis. Cada nível aparece na página **"O que sei sobre você"** e pode ser corrigido ou apagado item por item.

| Nível | O que é | Exemplo | Como é gravado |
|---|---|---|---|
| **Fixos** | Dosha, cidade, evitar sempre, restrições, "não como" | "Vata-Pitta · Rio de Janeiro · evitar sempre: castanhas · vegetariana · não como coentro" | A pessoa informa, ou aprova uma proposta |
| **Casa** | O que tem, com estado e data (§9) | "Abóbora: confirmada há 2 dias" | Aprovação ou edição direta |
| **Gostos e resultados** | Por alimento e por prática | "Gosta de canela · Chá de gengibre ajudou 3 vezes" | Toques da pessoa e retornos |
| **O que fez falta** | Alimentos que teriam entrado numa resposta e não estavam em casa (§9) | "Cardamomo: fez falta 4 vezes nos últimos 30 dias" | Automático, por código; apagado depois de 30 dias |
| **Rotina** | Fatos da vida que mudam a recomendação (até 30 notas ativas; o Ritu usa um resumo delas) | "Almoça fora durante a semana", "Acorda às 5 h às terças" | Só com aprovação; a pessoa corrige ou apaga cada nota |
| **Padrões** | Regularidades que o Ritu percebeu nos registros | "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar" | O Ritu pergunta *"Notei isto. Está certo?"*; só vale depois do sim. Sem resposta, a pergunta volta no máximo uma vez por dia e até 3 vezes |
| **Conversa** | As mensagens dos últimos 7 dias | — | Automático; apagado depois de 7 dias, ou antes, quando a pessoa apaga um dia |

Regras da memória:

- **Rotina, casa, fixos e padrões só são gravados com aprovação** ou quando a própria pessoa edita.
- **Apagar a conversa de um dia** (os últimos 7) apaga as mensagens dele e tira os runs dele da conversa; o rastro fica em Como pensei, que avisa que a conversa foi apagada. Não apaga com uma resposta em andamento naquele dia.
- **Toques diretos** (Não gosto, Não tenho, Ajudou) são gravados na hora: o toque é o consentimento.
- **Faltas** são anotadas por código, sem pergunta: guardam só o alimento e o dia. Pôr o alimento na lista "Para ter em casa" pede aprovação.
- **Incômodos de saúde nunca entram na memória.** O agente usa na resposta daquela mensagem e não anota. A mensagem em que o incômodo aparece e a resposta do agente ficam na conversa do dia e são apagadas no dia seguinte.
- **Restrição e "não como" ditos na conversa valem no dia**, na resposta daquela mensagem e nas seguintes, mesmo sem aprovação. Para ficar guardados, entram no bloco "Posso anotar isto?". Com "Agora não" ou sem resposta, deixam de valer no dia seguinte. O mesmo vale para o "Não como" respondido a uma pergunta do agente. Um nome que o Ritu não conhece é guardado como texto: aparece em "O que sei sobre você", mas não filtra sugestões.
- Quando dois registros se contradizem, vale o mais recente. **Exceção: "evitar sempre"** (abaixo).

### Evitar sempre

- Vem do passo do onboarding (§13), de "O que sei sobre você" ou da conversa ("não posso comer camarão", "amendoim me faz mal").
- **Pela conversa, vale na hora:** a resposta daquela mensagem já exclui o alimento, e ele continua excluído até o fim do dia mesmo sem aprovação. Para ficar guardado, entra no bloco "Posso anotar isto?" como qualquer fixo. Recusado ou expirado, deixa de valer no dia seguinte.
- **Sair da lista pede confirmação explícita.** Só em "O que sei sobre você", com a frase *"Tirar amendoim de Evitar sempre? O Ritu vai voltar a sugerir."* Se a pessoa disser na conversa que já pode comer, o agente não tira: mostra o caminho em "O que sei sobre você". Nenhum registro mais recente (gosto, "tenho em casa", retorno) tira um item daqui.
- Vale para tudo: alimentos, ingredientes de chás e refeições, **óleos de massagem e práticas na pele**, trocas, "vale ter em casa" e lista "Para ter em casa". Item de "evitar sempre" que esteja em Minha casa nunca entra numa sugestão.
- Guarda só o alimento ou o grupo, sem o motivo. O Ritu não pergunta por quê.

## 12. Cuidados de saúde

**Aviso inicial e em toda resposta:** "Não é orientação médica."

- **Incômodo leve** (dor de cabeça, estômago pesado, gases, cansaço, dificuldade para dormir, nariz entupido, cólica leve): o agente **recomenda conforto**. O incômodo vira qualidades (`KNOWLEDGE.md` §3.1) e entra no cruzamento. Quando o tipo do incômodo muda a resposta (ex.: dor de cabeça latejante com calor, ou tensa com cansaço), o agente pergunta. A resposta leva um aviso reforçado (*"Para conforto, não para tratar. Se piorar, durar mais de alguns dias ou vier com outros sinais, procure um profissional."*) e usa linguagem de conforto ("pode ajudar a aliviar a sensação de calor"), nunca de cura ("trata", "resolve a dor").
- **Sinal de alerta** (febre alta, dor no peito, falta de ar, dor muito forte ou súbita, desmaio, sangramento, confusão, sintoma que dura dias ou piora): o agente não recomenda nada. Responde com o aviso e sugere procurar um profissional ou atendimento de urgência. Na dúvida, conta como alerta.
- **Sofrimento emocional** (falar em sumir, em não aguentar mais, em se machucar ou em morrer): o agente não recomenda nada e não aconselha. Responde com o texto fixo: *"Sinto muito que você esteja passando por isso. Você não precisa enfrentar isso só. O CVV atende de graça, 24 horas, pelo telefone 188 ou pelo chat em cvv.org.br. Se você estiver em perigo agora, ligue 192."* Na dúvida, conta como alerta. Nada disso entra na memória, e a mensagem é apagada no dia seguinte. Tristeza ou cansaço comuns ("dia pesado", "tô pra baixo") não são alerta: o agente acolhe e segue.
- **Sem diagnóstico, sem promessas** ("cura", "trata", "emagrece"), **sem dosagens, sem suplementos ou fitoterápicos.** Só alimentos, ervas e especiarias culinárias, óleos de uso comum e práticas leves.
- O produto **não pergunta** sobre gestação, doenças ou remédios.
- **Restrições alimentares** (vegetariana, vegana, sem lactose, sem glúten) guardam só "evitar: X", sem o motivo.
- **Evitar sempre** (§11) guarda só o alimento ou o grupo. O produto não usa a palavra "alergia" nem pergunta o motivo; se a pessoa contar, o motivo não é anotado. Em dúvida se um preparo contém o alimento, o Ritu não sugere.

## 13. Onboarding e perfil aos poucos

**A primeira resposta vem antes de qualquer cadastro, com uma exceção: o passo "Evitar sempre".** Depois do aviso e desse passo, a pessoa já está na tela Conversa.

| Dado | Quando aparece |
|---|---|
| **Evitar sempre** | Logo depois do aviso, para toda conta nova, antes do dosha e mesmo para quem não fizer o quiz: *"Tem algum alimento que você nunca pode comer?"* Grupos para tocar (amendoim, castanhas, leite, ovo, soja, trigo, gergelim, peixe, frutos do mar), busca de alimento e campo livre. Botões: Pronto · Nenhum · Pular. Quem pula vê, uma única vez, na primeira resposta com sugestão de alimento: *"Se tiver algo que você não pode comer, me conta."* Muda em Você |
| **Dosha** | Depois do passo "Evitar sempre", só para conta nova: "Quer descobrir seu dosha?" → Fazer o quiz · Já sei meu dosha (Vata · Pitta · Kapha · Misto, escolhendo dois) · Agora não. Depois, a qualquer momento, pelo painel do dosha |
| **Quiz** | Dentro do onboarding: **8 perguntas**, uma por vez, 3 opções cada, uma por dosha. Temas: corpo, pele, apetite e digestão, sono, clima que incomoda, reação ao estresse, ritmo e energia, padrão de peso. **Resultado dual** quando os dois primeiros doshas ficam a até `config.quiz.diferencaDual` respostas de distância. O texto fica em `data/quiz.yaml` |
| **Cidade** | Junto com o dosha: a pessoa busca a cidade pelo nome. Pode pular; sem cidade, o agente responde sem o clima e avisa. Muda em Você |
| **Restrições e "não como"** | Em Você, pela conversa, ou quando o agente pergunta antes de sugerir algo que dependa disso |
| **Minha casa** | Começa vazia. Na primeira conversa, o agente pergunta o básico que precisa; o resto vem com o uso |

Quem escolhe "Agora não" não é perguntado de novo: o lembrete fica no botão do painel ("Descubra seu dosha") e na frase da resposta geral.

### Painel do dosha

| Com dosha | Sem dosha |
|---|---|
| Nome do dosha (ou os dois, com a proporção) e uma frase do que ele é | "Descubra seu dosha" + uma frase do que é dosha e por que ajuda |
| Elementos, qualidades, como costuma ser o corpo, a mente e a digestão | Os três doshas resumidos em uma linha cada |
| O que tende a desequilibrar e o que equilibra | Botões: Fazer o quiz · Já sei meu dosha |
| Botão "Refazer o quiz" | |

O texto vem de `data/doshas.yaml`, com fonte, em linguagem leve.

## 14. Regras de negócio

- **Limites por conta:** 30 mensagens por dia para conta Google; 12 mensagens por conta de demonstração; no máximo 5 contas de demonstração por IP por dia e, somando todos, **30 por dia** (atingido o teto, a Entrada mostra só o Google, com uma frase explicando). Toques (retorno, troca, gosto, casa) não contam nas mensagens, mas têm limite próprio: 60 por minuto e 300 por dia por conta. Mensagem com até 1000 caracteres. Os números ficam em configuração.
- **Testers** (lista em variável de ambiente): sem limites.
- **Quando a cota de IA acaba:** a tela avisa e continua funcionando no que não depende do modelo: Minha casa, Como ficou?, trocas, painel do dosha e práticas gerais para os atalhos de check-in, montadas por código.
- **Clima:** da cidade escolhida pela pessoa, consultado na hora, com cache curto. O produto nunca usa GPS nem localização do aparelho.
- **Privacidade (LGPD):** guarda o id da conta, o perfil, a cidade escolhida, a casa, os gostos, as faltas dos últimos 30 dias, os retornos, a rotina, os padrões confirmados, as mensagens dos últimos 7 dias e os runs. O e-mail do Google serve **só para entrar**. Nada de telefone. A página "Você" mostra tudo; "Apagar meus dados" apaga tudo. A telemetria nunca leva texto da pessoa.
- **Aviso sobre o provedor de IA:** no plano gratuito, o provedor pode usar as mensagens para melhorar os produtos dele. O Aviso inicial e a tela Sobre dizem isso com clareza.
- **Demonstração:** as contas expiram em 24 h e são apagadas.

## 15. O que o produto não faz

- Não manda notificações, e-mails ou lembretes.
- Não orienta sobre doença, gestação ou medicação, e não recomenda nada diante de um sinal de alerta.
- Não sugere compras para resolver o momento. A indicação de "vale ter em casa" é para as próximas vezes, e a lista "Para ter em casa" é só um lembrete para a pessoa.
- Não indica marca, loja nem preço, e não vende nada.
- Não conversa sobre assuntos fora de alimentação, rotina e Ayurveda.
