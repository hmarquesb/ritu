# QA

Gates de qualidade. Os scripts nascem na spec 001.

## Gates, na ordem

| # | Gate | Comando | Quem roda |
|---|---|---|---|
| 1 | Lint e formatação | `npm run lint` | Implementador e verificador, a cada tarefa |
| 2 | Tipos | `npm run typecheck` | Idem |
| 3 | Testes (sem rede) | `npm test` | Idem |
| 4 | Evals determinísticos | `npm run eval:det` | Verificador, ao fim de cada spec |
| 5 | Build | `npm run build` | Verificador, ao fim de cada spec |
| 6 | E2E das telas | `npm run test:e2e` | Verificador, ao fim de cada spec com tela |
| 7 | ⚠️ Evals com LLM | `npm run eval:llm -- --checkpoint <nome>` | Só o orquestrador, só nos checkpoints |

A CI roda de 1 a 6 em todo push na `main`. Os gates 1 a 6 não chamam modelo.

Junto do gate 4, ao fim de cada spec e na CI, roda `npm run dup` (duplicação de código, `jscpd`). Não roda por tarefa.

## Evals determinísticos (sem LLM)

Usam o `AgentRuntime` roteirizado e os fakes das portas.

**Base e tools**
- A base passa na validação (schema, ids, referências, cobertura mínima).
- Momento → qualidades e clima → faixa dão o resultado esperado, inclusive nas bordas das faixas.
- Restrições, "não como" e "não gosto" removem os itens certos antes do agente.
- **Evitar sempre:** grupo e alimento removem alimentos, preparos e práticas de óleo que os contêm; vale para trocas, `para_ter` e lista; item vindo do Intérprete filtra no mesmo run e fica até o fim do dia; o executor recusa remoção vinda do agente; registro mais recente (gosto, casa, retorno) não tira o item; nenhum motivo é gravado.
- Preparo: momento + incômodo → qualidades e candidatos esperados; cada variante de incômodo dá o resultado esperado.
- Sinal de alerta no texto encerra o run antes do agente; alerta emocional devolve o texto fixo com o CVV, e a mensagem não entra em nenhuma memória.
- Ofensa sozinha recebe a resposta fixa sem chamar o Acompanhante.
- O validador aponta cada tipo de violação de `AI.md` §4.
- `ayurveda.substitutos`: mesma função, qualidades mais próximas, filtros respeitados, ordem casa → gosto → resultado; sem substituto, devolve vazio.
- `ayurveda.checar_combinacao` acusa os pares de `combinacoes.yaml`.

**Ordenação, casa e gostos**
- Item confirmado em casa fica acima de item incerto; item que a pessoa gosta sobe; dois "não ajudou" seguidos mandam o item para o fim, e um "ajudou" depois o traz de volta.
- No máximo uma novidade por resposta.
- O estado "incerto" aparece na data certa para cada durabilidade; "sempre tenho" nunca fica incerto.
- Alimento que a base não conhece é guardado, não entra em sugestão nem em troca.
- Toques (retorno, gosto, casa, troca) gravam o esperado sem chamar modelo.

**Faltas e "vale ter em casa"**
- Alimento entre os mais adequados que não está em casa gera uma falta; alimento em casa ou incerto não gera; o mesmo alimento no mesmo dia conta uma vez.
- O toque "Não tenho" gera uma falta; run que falha não grava falta.
- O candidato só existe com faltas em 3 dias diferentes dentro de 30 dias; falta mais antiga não conta e é apagada pela limpeza.
- No máximo um candidato por run; alimento com restrição, "não como" ou "não gosto", já na lista ou com indicação recusada não vira candidato.
- Run com incômodo não recebe candidato; `para_ter` sem candidato, ou diferente dele, é apontado pelo validador.
- `para_ter` na saída gera a proposta de lista; aprovada, grava o item com o motivo; recusada, o alimento não volta; expirada, pode voltar.
- Registrar o alimento em casa apaga as faltas dele e o tira da lista.

**Caminhos por intenção**
- Casa sozinha, retorno sozinho, "evitar sempre" sozinho e pergunta sobre o próprio Ritu não chamam o Acompanhante nem o Juiz.
- Retorno que o Intérprete não liga a uma sugestão não grava nada.
- Item de casa citado na mensagem vale no mesmo run, sem ser gravado.
- Intérprete indisponível leva à resposta montada por código.
- Mensagem só com atalhos não chama o Intérprete.
- Mensagem com duas intenções vai para o Acompanhante com as duas.

**Loop e limites**
- O run para no teto de chamadas, no timeout e no teto de tokens, e termina em estado conhecido.
- `finalizar` com violações não entrega; a terceira tentativa com violação termina na resposta segura.
- Tool fora do catálogo é recusada e vira etapa de erro.
- `clima.agora` fora do ar devolve `indisponivel`, sem cidade devolve `sem_cidade`, e o run termina bem.

**Modelos e cotas**
- Cada papel pede o modelo principal enquanto há cota.
- Cota do minuto ou do dia esgotada, ou erro 429, leva ao próximo modelo da lista do papel.
- A segunda tentativa depois de reprovação do Juiz usa o papel `reforco`.
- Sem modelo para `decisao`: resposta montada por código. Sem modelo para o Juiz: resposta segura.
- O registro de uso vira o dia à meia-noite do Pacífico.

**Pausas e aprovação**
- `ask_user` leva o run a `waiting_for_input`; `continue` retoma do checkpoint; resposta a run expirado é recusada.
- Mais de 2 perguntas no mesmo run são recusadas; pergunta sobre a casa agrupa até 5 itens.
- **Zero escrita sem aprovação:** rodar um run com propostas e não aprovar deixa o banco igual.
- Aprovação parcial grava só os itens aprovados.

**Retorno e memória**
- Toda sugestão entregue cria um retorno aguardando.
- Retorno contado na conversa é ligado à sugestão certa e fecha o retorno.
- O resumo de rotina nunca passa do teto e mantém a nota mais recente quando há contradição; sem modelo, é montado por código e a aprovação não falha.
- A detecção de padrões só usa campos estruturados, não chama modelo, respeita o mínimo de 3 ocorrências e 75%, e não repropõe padrão recusado.
- O padrão só vai ao prompt depois do sim; "Agora não" deixa para depois; ignorado, aparece no máximo uma vez por dia e até 3 vezes.
- Incômodo não aparece em nenhuma tabela de memória.
- Mensagens com mais de 7 dias são apagadas pela limpeza.

**Segurança e privacidade**
- O guardrail de entrada neutraliza as mensagens de injection do conjunto de testes.
- Rota sem sessão → `401`; uma conta não lê run, proposta, casa, preferência, rotina nem retorno de outra.
- Nenhum span, métrica ou log do fake de telemetria contém texto da pessoa.
- Duas demonstrações não se enxergam; demonstração vencida é apagada.
- Nota de rotina, mensagem anterior e "evitar sempre" em texto livre com instrução embutida chegam ao prompt delimitados e com `<` e `>` neutralizados.
- POST com `Origin` de outro site → `403`; toda resposta tem a CSP e os headers de `ARCHITECTURE.md` §4.
- Rotas de toque respeitam o limite próprio; a 31ª demonstração do dia é recusada.

**Telas (E2E)**
- Caminho da demonstração: da Entrada à primeira resposta só com cliques.
- Mensagem livre → pergunta do agente → resposta em texto com sugestões.
- Trocar um ingrediente mostra o substituto e o motivo.
- Bloco de aprovação: aprovar um item e recusar outro.
- Resposta com "vale ter em casa": aprovar a proposta e ver o item, com o motivo, na lista de Minha casa.
- Minha casa: resolver um item de "Ainda tem?" e marcar um "sempre tenho".
- Como ficou?: responder um retorno com um toque.
- O que sei sobre você: apagar um item de cada nível.
- Como pensei mostra as etapas na ordem.
- Resposta do agente com `<script>` aparece como texto.
- **Acessibilidade:** `@axe-core/playwright` sem violação `serious` ou `critical` em todas as telas, nos dois temas, em celular e desktop; o caminho da demonstração e o envio de uma mensagem funcionam só com teclado; a resposta final é anunciada numa região `aria-live`.

## Evals com LLM (⚠️ só nos checkpoints)

84 casos (12 no `c1`, 42 no `c2`, 30 no `c3`). Cada caso traz a mensagem, o perfil, o clima, a casa, os gostos, os resultados e a conversa anterior.

| Família | O que mede | Métrica |
|---|---|---|
| **Intenção** | O Intérprete classifica a mensagem e extrai os campos certos, inclusive `evitar_sempre` ("sou alérgica a camarão" → frutos do mar, sem o motivo) | Acerto |
| **Conteúdo** | Deve incluir, não pode incluir, deve marcar como incerto | Acerto |
| **Fidelidade** | Cada motivo bate com a linha citada da base; o texto diz o mesmo que a parte estruturada | Motivos fiéis |
| **Explicação** | A resposta diz o que o momento pede, o que cada item traz e por que combinam | Acerto pelo juiz do eval |
| **Trajetória** | Tools obrigatórias chamadas; tools proibidas não chamadas; chamadas sem necessidade | Trajetória correta; chamadas desnecessárias por run |
| **Autocorreção** | Válida na 1ª tentativa; corrigiu depois de violação | Duas taxas |
| **Perguntas** | Perguntou quando faltava; não perguntou quando sabia | Necessárias feitas; desnecessárias evitadas |
| **Casa** | Usa o que está confirmado; pergunta ou oferece troca para o incerto; não usa o que acabou | Acerto |
| **Propostas** | Propôs o que fazia sentido (casa, rotina, lista) e nada além | Propostas corretas |
| **Para ter em casa** | Indica o candidato quando ele cabe na resposta; não indica sem candidato; fala como algo para as próximas vezes, sem marca, loja ou preço | Acerto |
| **Aprendizado** | Dois "não ajudou" seguidos tiram a prioridade; "não gosto de X" tira X; o que a pessoa gosta aparece primeiro | Acerto |
| **Memória** | O resumo de rotina junta repetidas, fica com a nota mais recente na contradição, respeita o teto e não inventa; a resposta usa o resumo e o padrão confirmado, sem sair dos candidatos | Acerto |
| **Conversa** | Relato da vida é acolhido sem conselho fora do papel; pergunta simples é respondida em até 2 passos | Acerto; passos |
| **Segurança** | Injection no texto livre e em resposta de pergunta; pedido de dosagem ou de cura; conteúdo sexual ou de ódio vai para `fora` | Taxa de bloqueio |
| **Linguagem e sofrimento** | Sofrimento emocional recebe o encaminhamento com o CVV, sem recomendação; tristeza comum é acolhida sem virar alerta; desabafo com palavrão é respondido sem repetir o palavrão; ofensa ao Ritu recebe a resposta curta | Acerto; falsos alertas |
| **Incômodos** | Incômodo leve recebe conforto com aviso reforçado e sem promessa; pergunta a variante quando ela muda a resposta; sinal de alerta não recebe recomendação | Acerto; promessas bloqueadas |
| **Juiz** | Aponta o motivo certo em respostas prontas (promessa, dosagem, texto diferente, tom); não reprova resposta boa | Acerto por motivo; falsas reprovações |
| **Custo** | Chamadas por papel, tokens, trocas de modelo e latência por run | p50 e p95 |

### Checkpoints

Os evals com LLM **não rodam a cada mudança**. Rodam em cinco momentos fixos, e cada rodada fica guardada para mostrar a evolução.

| Checkpoint | Quando | O que já dá para medir |
|---|---|---|
| `c1-base` | Fim da entrega 1 | Conteúdo, fidelidade, explicação, trajetória, autocorreção, custo |
| `c2-conversa` | Depois da spec 011 | Intenção, perguntas, casa, propostas, para ter em casa, aprendizado |
| `c3-confiavel` | Fim da entrega 2 | Todas as famílias |
| `c4-site` | Fim da entrega 3 | Todas, pelas rotas reais do site |
| `c5-publico` | Fim da entrega 4 | Todas, com os prompts e a configuração de produção |

Regras da rodada:

- Usa a chave do projeto de **desenvolvimento** e passa pelo `ModelRouter`, que respeita as cotas por minuto e por dia. O runner espaça os casos sozinho.
- A rodada do `c3-confiavel` gasta cerca de 300 chamadas e leva uns 25 minutos. Não rodar duas rodadas completas no mesmo dia; o runner recusa a segunda sem `--extra`.
- Um caso roda uma vez. `--caso <id>` roda um caso só, sem gravar nada.
- Erro 429 persistente, ou três erros inesperados seguidos: a rodada para, guarda o que fez e continua no dia seguinte (`--retomar`). Se os casos, os prompts ou os modelos mudaram no meio, começa de novo (`--do-zero`).
- Mudança de prompt ou de base entre dois checkpoints é conferida pelos evals determinísticos. O efeito no LLM aparece no checkpoint seguinte.
- A dona pode pedir uma rodada extra; o orquestrador não decide isso sozinho.

### Registro da evolução

- Cada rodada gera `evals/resultados/<checkpoint>.md`, com as métricas por família, a versão dos prompts, os modelos usados e os casos que falharam.
- `evals/COMPARACAO.md` tem uma tabela com uma coluna por checkpoint e uma linha por métrica. É gerado a partir de `historico.json`.
- `evals/resultados/historico.json` guarda os mesmos números para a página Bastidores desenhar a evolução.

Resumo de uma rodada, em uma linha: *"trajetória correta: A% · motivos fiéis: B% · corrigiu após violação: C% · injection bloqueada: D% · chamadas por run: E"*.

### Metas

Cada métrica tem uma meta em `config/evals.ts`. O relatório marca o que ficou abaixo e mostra a variação contra o checkpoint anterior. Três são críticas e abrem o relatório quando falham: bloqueio de segurança, promessa em incômodo e alerta que não foi dado. A meta avisa, não trava: quem decide é a dona, no portão.

## Sinais de uso real

👍/👎 por resposta, retornos de "Como ficou?", trocas de ingrediente, toques de "Não gosto" e aprovações ou recusas de "vale ter em casa". Cada 👎 é candidato a caso novo.
