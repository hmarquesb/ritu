---
title: Você, memória e Como pensei
status: approved
entrega: 3
created: 2026-11-15
---

# Você, memória e Como pensei

> Preenche as duas páginas que a 018 deixa vazias: **Você** (a carta do dosha, "O que sei sobre você" com todos os níveis da memória, corrigíveis e apagáveis item por item, e a Conta, com tema, sair e "Apagar meus dados") e **Como pensei** (a linha do tempo de um run, em frases de gente, com os detalhes técnicos recolhidos). Junto vêm "Refazer o quiz", as rotas de perfil e de memória e o resumo das violações na etapa de validação. Fecha as telas da entrega 3.

## Contexto

A 018 cria a barra com a aba "Você" e o link "Como pensei" em toda resposta, mas as duas páginas mostram "Esta parte chega em breve.". A 012 deixa prontas no core as funções que a pessoa usa para corrigir a memória (`apagarNota`, `corrigirNota`, `decidirPadrao`, `apagarPadrao`), sem rota nem tela. A 017 calcula o quiz e grava o dosha no onboarding, sem caminho para refazer. O rastro de cada run está em `run_etapas` desde a 005, mas só o Grafana o mostra.

Duas promessas do produto dependem desta spec. A primeira é a da memória visível: "Você vê e apaga o que o Ritu guarda" (Aviso inicial, 017; `BUSINESS.md` §11 e §14). A segunda é a do agente que se explica: "Como pensei" é a observabilidade que a pessoa enxerga (`OBSERVABILITY.md` §2).

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Uma página só em "Você":** a carta do dosha no topo, depois "O que sei sobre você" com todos os níveis (os fixos são editados ali mesmo) e, no fim, "Conta" (tema, sair, apagar meus dados). O Perfil deixa de ser uma tela própria; os docs que falam em "Perfil" são corrigidos.
- **Como pensei:** frases de gente por padrão; cada passo e o total do run têm "Detalhes", recolhidos, com modelo, tokens e tempo.
- **Casa e Conversa em "O que sei":** resumo com atalho. Casa: contagens e "Ver Minha casa". Conversa: uma linha por dia, com a contagem de mensagens e "Apagar".

## Objetivo

- Na demonstração, em "Você": a carta mostra o dosha do seed com a proporção do quiz; "O que sei sobre você" mostra os sete níveis preenchidos; confirmar o padrão do seed, corrigir uma nota de rotina e apagar uma falta acontecem com um toque cada, sem recarregar.
- Toda mudança feita aqui vale na próxima resposta da Conversa: alimento posto em "evitar sempre" ou em "não como" sai das sugestões; restrição nova filtra; padrão confirmado vai ao prompt; nota apagada sai do resumo de rotina.
- Tirar um item de "evitar sempre" só acontece depois da confirmação com a frase de `BUSINESS.md` §11.
- "Apagar meus dados" apaga a conta e tudo dela, encerra a sessão e volta à Entrada com "Seus dados foram apagados.".
- "Como pensei" de uma resposta da demonstração (modo e2e) mostra, em ordem, o que o agente entendeu, consultou, conferiu, corrigiu, propôs e o que a revisão disse, e o total do run nos detalhes.
- As páginas passam no axe nos dois temas, em celular e desktop, em cada estado (cheia, vazia, folha aberta, confirmação aberta).

## Escopo

- **Dentro:**
  - Visões puras: `painelDoDosha`, `visaoDaMemoria`, `linhaDoTempo`.
  - Ações da pessoa no core: `tocarPerfil` (fixos e quiz) e `tocarMemoria` (gostos e resultados, faltas, rotina, padrões e conversa).
  - Apagar a conversa de um dia: métodos novos em `MessageRepository` e `RunRepository`, coluna `runs.fora_da_conversa` e o ajuste em `conversaDoDia` (018).
  - Resumo da etapa de validação com os códigos das violações.
  - Rotas: `GET /api/voce`, `POST /api/perfil`, `POST /api/memoria`. Ação de servidor `apagarMeusDados`.
  - Páginas `/voce`, `/voce/quiz` e `/como-pensei/[runId]`, e os componentes do Ritu delas (`DESIGN.md` §4): carta de dosha, item de memória, busca de cidade no lugar de uso, linha do tempo.
  - Aviso `dados_apagados` na Entrada.
  - Métricas `ritu_memoria_edicoes_total` e `ritu_conta_apagada_total`, no painel.
  - E2E das duas páginas e evals determinísticos das rotas.
- **Fora:**
  - Casa item por item, a lista "Para ter em casa" e os retornos pendentes: Minha casa e Como ficou? (019). Aqui só o resumo com o atalho.
  - Limite de toques por conta e telas de cota esgotada: 021. Corrigir uma nota de rotina pode chamar o modelo (resumo da 012) e funciona sem ele.
  - Levar a memória da demonstração para a conta Google: o produto não faz.
  - Exportar os dados num arquivo: o produto não faz; a página mostra tudo.
  - Mostrar o texto da mensagem da pessoa em Como pensei: a página diz o dia e a hora; o texto fica na Conversa.
  - Rodar o `c4-site`: no fechamento da entrega 3, pelas rotas da 018.
  - Tela Sobre e política de privacidade: 024.

## Necessidade de negócio

Personalização só gera confiança quando a pessoa vê o que está sendo guardado e consegue mudar. Sem esta spec, a memória do Ritu é uma caixa-preta e "Apagar meus dados" (LGPD, `BUSINESS.md` §14) não existe. "Como pensei" é o que distingue o Ritu de um chat qualquer para quem avalia o projeto: mostra que há um agente que consulta, confere, corrige e pede revisão, e quanto isso custa.

## Critérios de aceite

### Carta do dosha

- [ ] **Com um dosha:** `section` com `h2` visualmente escondido "Seu dosha"; carta em `Surface tone="paper" radius="card"` com `DoshaBlot` grande (com ícone), o nome em `font-title`, o `resumo`, "Elementos: ar e espaço" e "Qualidades: frio, seco, leve, estimulante, áspero" (nomes de `vocabulario.yaml`), e três blocos (Corpo · Mente · Digestão), "O que costuma te desequilibrar" e "O que te equilibra", de `data/doshas.yaml`.
- [ ] **Misto:** a carta de cabeçalho mostra as duas manchas sobrepostas e o nome de `nomeDoDosha` ("Vata-Pitta"); quando a origem é `quiz`, a linha "60% Vata · 30% Pitta · 10% Kapha" e uma barra fina com um segmento por dosha (cor do dosha e o nome escrito). Embaixo, `Tabs` com uma aba por dosha do nome, cada uma com o conteúdo da carta simples. Origem `declarado`: sem porcentagem, com "Você escolheu".
- [ ] **Sem dosha:** a carta mostra as três manchas pequenas, o título "Descubra seu dosha", o texto de `textosVoce.semDosha.texto`, uma linha por dosha (nome e `resumo`) e os botões "Fazer o quiz" (`primary`) e "Já sei meu dosha".
- [ ] **Ações:** com dosha, "Refazer o quiz" (link para `/voce/quiz`) e "Mudar" (abre a folha "Já sei meu dosha"). A folha tem Vata · Pitta · Kapha · Misto num grupo de escolha única; "Misto" pede dois (`Checkbox`, exatamente dois) e "Salvar" só vale com a escolha completa.
- [ ] **Refazer o quiz:** `/voce/quiz` mostra o quiz da 017 com as 8 perguntas; ao fim, grava pelo `POST /api/perfil` (`acao: "quiz"`), mostra o resultado e o botão "Voltar para Você". Sair no meio não muda nada.

### O que sei sobre você

- [ ] **Estrutura:** `h2` "O que sei sobre você" e o texto "Tudo o que eu guardo para acertar nas sugestões. Você corrige ou apaga o que quiser."; depois, os níveis, cada um como `section` com `h3`, nesta ordem: Fixos · Casa · Gostos e resultados · O que fez falta · Rotina · Padrões · Conversa. Cada nível tem a linha de como é anotado (`textosVoce.nivel.<nivel>.como`), que no desktop fica na margem à esquerda dos itens e no celular logo abaixo do `h3`.
- [ ] **Fixos:** linhas Dosha, Cidade, Evitar sempre, Restrições e Não como. Dosha: o nome e a origem ("pelo quiz", "você escolheu", ou "ainda não sei") com "Mudar" (mesma folha da carta). Cidade: nome com "Mudar" (folha com a busca de cidade da 017 e "Tirar a cidade"). Restrições: quatro `ToggleChip` (vegetariana, vegana, sem lactose, sem glúten) que gravam no toque.
- [ ] **Evitar sempre:** os itens em `TagList` (grupo pelo nome de `grupos_evitar.yaml`, alimento pelo nome da base, texto como foi escrito) e o botão "Adicionar", que abre a folha com a escolha do passo da 017 (grupos, busca de alimento e texto livre) e "Salvar".
- [ ] **Tirar de evitar sempre:** remover uma tag abre um `Dialog role="alertdialog"` com "Tirar amendoim de Evitar sempre? O Ritu vai voltar a sugerir." e os botões "Tirar" (`danger`) e "Manter"; só "Tirar" grava (`removerEvitarSempre` com `confirmado: true`). Fechar com Esc é "Manter" (E2E).
- [ ] **Não como:** `TagList` removível e "Adicionar" (busca de alimento e texto livre; o texto passa por `identificarAlimento`). Tirar não pede confirmação.
- [ ] **Casa:** uma linha com "N itens · M para confirmar · K acabaram" e, quando houver, "· L na lista Para ter em casa", e o `TextLink` "Ver Minha casa". Casa vazia: "Nada anotado na sua casa ainda.".
- [ ] **Gostos e resultados:** uma linha por item da base com gosto ou com algum resultado, em ordem alfabética, com o tipo (alimento, prática, preparo), o gosto ("você gosta", "você não gosta") e os resultados em palavras ("ajudou 3 vezes · não ajudou 1 vez · não fez 1 vez", só os diferentes de zero). Ações: Gosto · Não gosto (`ToggleChip` exclusivos, tocar no marcado limpa) e "Esquecer" (`quiet`), que apaga a linha inteira (gosto e resultados).
- [ ] **O que fez falta:** uma linha por alimento com falta nos últimos 30 dias, do de mais dias para o de menos: "Cardamomo · fez falta em 3 dias nos últimos 30", com "na lista" quando estiver em "Para ter em casa", e "Apagar". Apagar apaga as faltas do alimento e não tira da lista.
- [ ] **Rotina:** o resumo atual ("Como eu resumo sua rotina", em `text-prose`) e as notas ativas, da mais recente para a mais antiga, com a data ("anotado em 3 nov."), "Corrigir" (folha com `TextField multiline`, rótulo "Nota de rotina", até 200 caracteres, contador) e "Apagar". Depois de corrigir ou apagar, o resumo mostrado é o novo, na mesma resposta (E2E).
- [ ] **Padrões:** os candidatos que valem hoje (`padraoVale`), com a frase e "Está certo" · "Não está"; os confirmados, com a frase, "confirmado em 12 nov." e "Apagar"; os recusados, com a frase, "você disse que não" e "Apagar". Apagar um recusado mostra o aviso "Apagado. Se eu notar de novo, pergunto de novo.".
- [ ] **Conversa:** uma linha por dia com mensagens nos últimos 7 dias ("Hoje · 4 mensagens", "Ontem · 6 mensagens", "Há N dias · …"), com "Apagar". Apagar abre `alertdialog` com "Apagar a conversa de ontem? As mensagens somem; o que você aprovou continua anotado." e "Apagar" (`danger`) · "Manter". Com um run aberto naquele dia, a rota recusa com `conversa_em_andamento` e a tela diz "Espere o Ritu terminar esta conversa para apagar.".
- [ ] **Depois de apagar a conversa de hoje:** a Conversa abre vazia (sem falas e sem respostas daquele dia); os retornos daquele dia continuam em Como ficou?; o que foi aprovado continua anotado (E2E).
- [ ] **O que eu não guardo:** no fim do nível Conversa, o texto fixo de `textosVoce.naoGuardo` (incômodos de saúde, o motivo de evitar um alimento, o e-mail fora do login).
- [ ] **Vazios:** cada nível sem item mostra uma linha em `ink-muted` com o texto de `textosVoce.nivel.<nivel>.vazio`; nenhum nível some.
- [ ] **Depois de cada toque:** a tela mostra a visão que a rota devolveu (sem atualização otimista); o botão tocado fica `isPending`; o aviso breve confirma em palavras ("Anotei: vegetariana."). Item que sai da lista devolve o foco ao `h3` do nível.

### Conta

- [ ] **Conta:** `h2` "Conta"; Google: "Você entrou com o Google." (sem o e-mail); demonstração: "Este é um perfil de demonstração. Ele some em {h} horas." e, com Google disponível, "Criar meu perfil". Depois, o `ThemeSwitcher` (016) com o rótulo visível "Tema", o botão "Sair" (`secondary`) e "Apagar meus dados" (`danger`).
- [ ] **Apagar meus dados:** abre `alertdialog` com "Apagar todos os seus dados?", "Apago seu perfil, sua casa, seus gostos, sua rotina, os padrões e a conversa. Não tem volta." e "Apagar tudo" (`danger`) · "Cancelar". "Apagar tudo" chama `apagarMeusDados`: a conta some (`accounts.apagar`), a sessão é encerrada e a Entrada mostra "Seus dados foram apagados." em `role="status"` (E2E). Um pedido seguinte com o cookie antigo recebe `401`.

### Como pensei

- [ ] **Cabeçalho:** `h1` "Como pensei", a linha "Mensagem de hoje, 8:42" ("ontem", "em 12 nov.") no fuso da pessoa e o `TextLink` "Voltar para a conversa".
- [ ] **Linha do tempo:** `ol` com um item por passo de `linhaDoTempo`, cada um com o ícone do tipo (decorativo), a frase em `text-base` e, quando houver, o detalhe em `ink-muted`. Passos `corrigido` têm a marca "corrigido no passo seguinte" em texto; passos `falhou`, "não deu certo" em `danger`. A cor nunca é o único sinal.
- [ ] **Frases:** cada etapa vira a frase da tabela de `linhaDoTempo`, com os dados do próprio run (estados do momento, clima usado, propostas e decisões); etapas sem frase (`llm`, tools de controle e de proposta) não aparecem na linha, só nos detalhes. O último item diz como o run terminou.
- [ ] **Detalhes:** cada passo tem um `details` "Detalhes" com modelo, tokens de entrada e de saída e duração (só os que existem). No fim, um `details` "Detalhes do run" com passos, tempo total, tokens, modelos por papel, trocas de modelo, versão do prompt e tentativas da revisão. Fechados por padrão.
- [ ] **Estados:** run de outra conta ou inexistente → `notFound()` (página 404 da aplicação); run aberto → `StateBlock kind="waiting"` com "Ainda estou pensando nesta mensagem." e o link para a conversa; run sem etapas (semeado) → `StateBlock kind="empty"` com "Esta conversa veio pronta com a demonstração e não tem o rastro guardado."; run com a conversa apagada → a linha do tempo aparece e a última linha diz "A conversa deste dia foi apagada.".
- [ ] **Validação no rastro:** a etapa `validacao` de `finalizar` grava `resumo` `ok` quando aprova e os códigos das violações, sem repetir, na ordem em que apareceram, separados por vírgula, quando recusa (`fora_de_casa,evitar_sempre`). Nunca nome de alimento (teste de canários).
- [ ] **Na demonstração (modo e2e, roteiro `demo` da 018):** "Como pensei" da primeira resposta mostra, nesta ordem, "Entendi…", "Vi o clima…", "Olhei sua casa…", "Consultei a base ayurvédica…", "Conferi a resposta…", a revisão, "Propus anotar…" e o fim; "Detalhes do run" tem o total de passos (E2E).

### Rotas e segurança

- [ ] **Sem sessão:** `GET /api/voce`, `POST /api/perfil` e `POST /api/memoria` respondem `401 { erro: "sem_sessao" }`; `apagarMeusDados` sem sessão volta à Entrada sem apagar nada (eval).
- [ ] **Outra conta:** nota, padrão, dia de conversa ou item de outra conta → `400 { erro: "toque_invalido" }` (ou `nota_invalida`, `padrao_invalido` da 012) e nada muda; `GET /api/voce` não traz nada de outra conta; `/como-pensei/<run de outra conta>` → 404 (eval e E2E).
- [ ] **Corpo:** ação fora do schema → `400 { erro: "corpo_invalido" }`; `evitar_tirar` sem `confirmado: true` → `400 { erro: "corpo_invalido" }` (eval); `alimento_id`, grupo ou item de preferência fora da base → `toque_invalido`.
- [ ] **Origem:** `POST /api/perfil` com `Origin` de outro site → `403` (proxy da 017; E2E).
- [ ] **Apagar:** depois de `apagarMeusDados`, a suíte de contrato `delete-account` passa (nada da conta em nenhuma tabela; runs anonimizados) e a conta não entra mais (eval).
- [ ] **Privacidade:** nenhum span, métrica ou log leva nome de alimento, texto de nota, frase de padrão, nome de cidade ou texto livre; as ações novas entram no teste de canários da 015.
- [ ] **Acessibilidade:** `/voce`, `/voce/quiz` e `/como-pensei/<run>` passam em `expectSemViolacoes` nos dois temas, em `celular` e `desktop`, nos estados cheia (seed), vazia (conta nova do modo e2e), com cada folha aberta e com cada confirmação aberta; com 200% de zoom em 1280 px, sem rolagem horizontal; tudo alcançável só com teclado.
- [ ] Gates 1 a 6 verdes, `npm run dup` limpo, `test:db` verde com a migração e as suítes de mensagens e de runs.

## O que fazer

- Carregar a skill `frontend-design` antes de escrever as telas e seguir a direção visual desta spec dentro de `DESIGN.md` e dos tokens da 016; carregar `web-design-guidelines` antes de entregar.
- Escrever primeiro as funções puras (`painelDoDosha`, `visaoDaMemoria`, `linhaDoTempo` e os textos) e os testes; depois as ações e as rotas com os stores em memória; por último as telas.
- Reusar: `calcularQuiz`, `prakritiDeclarada`, `nomeDoDosha`, a busca de cidade, a busca de alimento e a escolha de "evitar sempre" (017); `apagarNota`, `corrigirNota`, `decidirPadrao`, `apagarPadrao`, `padraoVale`, `montarFiltro` e as frases dos estados (012); `tocarGosto` (011); `textoDaProposta` (010); `visaoDaCasa` (019); `criarRota`, `exigirPasso`, `contaAtual` (017); `ThemeSwitcher`, `DoshaBlot` e os componentes base (016).
- Se a 017 deixou o quiz, a escolha de "evitar sempre" ou a busca de cidade dentro das páginas de `/comecar`, extraí-los para `src/components/ritu/` antes de usar aqui, sem mudar o comportamento do onboarding.
- Registrar no mapa dos evals os arquivos novos.
- Atualizar os docs no fechamento.

## O que não fazer

- Não chamar modelo, a Open-Meteo nem o Postgres em `npm test`, `eval:det` ou `test:e2e`.
- Não tirar item de "evitar sempre" sem `confirmado: true` vindo da confirmação da tela; nenhuma outra ação remove.
- Não mostrar o e-mail da conta.
- Não guardar o motivo de "evitar sempre" nem perguntar por ele.
- Não reescrever o texto das etapas com o modelo: toda frase de Como pensei é montada por código.
- Não pôr nome de alimento, texto de nota, frase de padrão ou nome de cidade em span, métrica, log ou `resumo` de etapa.
- Não atualizar a tela antes da resposta da rota.
- Não apagar a conversa de um dia com run aberto.
- Não criar tela "Perfil" separada nem link para ela.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Estrutura de "Você" | Uma página: carta do dosha → O que sei sobre você (todos os níveis, fixos editados ali) → Conta (dona) | Tira a duplicação entre Perfil e O que sei; a pessoa vê e muda tudo num lugar |
| Perfil | Deixa de ser tela; os fixos ficam no nível Fixos e a conta em "Conta" (dona) | Os docs pediam os mesmos campos em duas telas |
| Como pensei | Frases de gente; detalhes técnicos recolhidos por passo e no total (dona) | Quem usa lê a história; quem avalia abre modelo, tokens e tempo |
| Casa e Conversa em O que sei | Resumo com atalho; Conversa por dia, com "Apagar" por dia (dona) | Casa já tem tela própria (019); listar cada mensagem repete a Conversa |
| Dosha misto | Carta de cabeçalho com as duas manchas e a proporção; uma aba por dosha | Duas cartas inteiras empilhadas ficam longas no celular; as abas mantêm cada dosha inteiro |
| Proporção | Só com origem `quiz` | Quem declarou "Misto" não escolheu porcentagem; inventar 50/50 seria falso |
| Refazer o quiz | Página `/voce/quiz` com o quiz da 017, gravando por `POST /api/perfil` | O passo de onboarding exige `proximoPasso` igual a `dosha`; refazer não é onboarding |
| Rotas | `POST /api/perfil` (fixos e quiz) e `POST /api/memoria` (demais níveis), cada uma com `acao` (união discriminada); a `/api/padroes/:id` de `ARCHITECTURE.md` §3 sai | Mesmo padrão da `/api/casa` (019); duas portas de escrita, uma por tabela de origem |
| Apagar meus dados | Ação de servidor, com confirmação, que apaga e encerra a sessão | O `signOut` do Auth.js é do servidor; ação de servidor já confere a origem |
| Apagar a conversa de um dia | Apaga as mensagens; os runs fechados do dia saem da conversa (`fora_da_conversa`) e perdem `saida`, `checkpoint`, `pendencia` e `clima_usado`; retornos, aprovações e etapas ficam | O texto da resposta também é conversa; o que a pessoa aprovou é memória de outro nível |
| Rastro de dia apagado | Como pensei continua, sem os dados da saída | As etapas não guardam texto da pessoa; o rastro é do agente |
| Violações no rastro | `resumo` da validação com os códigos | Códigos não são dado da pessoa; sem eles, Como pensei não diz o que foi corrigido |
| Nomes em Como pensei | Vêm do run e das propostas na hora de ler, nunca do `resumo` | A tela é da própria conta; telemetria e `resumo` continuam sem nome |
| Padrões recusados | Aparecem, com "Apagar" | São memória (o Ritu guarda para não perguntar de novo); a pessoa pode deixar que pergunte |
| "Esquecer" em gostos | Apaga a linha inteira (gosto e resultados) | Corrigir só o gosto já existe nos dois botões; "Esquecer" é o apagar do nível |
| Métricas novas | `ritu_memoria_edicoes_total{nivel, acao}` e `ritu_conta_apagada_total{tipo}`, na linha Memória do painel | Mostra se a transparência é usada; o painel da 015 exige toda métrica nele |

### Direção visual (com a skill `frontend-design`, dentro da 016)

- **Assinatura de "Você": a carta.** É o único lugar do site, com o quiz, em formato de carta (`DESIGN.md` §2): `paper` nos dois temas, `radius="card"`, sombra `lift`, a mancha de aquarela grande no canto de cima e o nome do dosha em Cormorant Garamond `text-3xl`, peso 500. No misto, as duas manchas se sobrepõem com 30% de sobreposição, a do dosha principal na frente. A barra da proporção tem 4px de altura e cantos retos, com o nome de cada dosha escrito embaixo do seu segmento.
- **"O que sei" como caderno:** cada nível tem uma margem: no desktop, uma coluna de 11rem à esquerda com o `h3` (Cormorant `text-xl`) e a linha de como é anotado (Figtree `text-sm`, `ink-muted`), separada dos itens por uma linha vertical de 1px em `line`; no celular, a linha vertical vira um fio à esquerda do bloco e a margem vai para cima dos itens. É o que diz, em cada nível, como aquilo chegou ali.
- **Itens de memória:** linhas com divisórias `line`, o texto do item em `ink`, o complemento (datas, contagens) em `ink-muted` `text-sm`, ações `quiet` `size="sm"` à direita (no celular, embaixo, alinhadas à esquerda). Nada de cartões dentro do caderno.
- **Conta:** `Surface tone="sunken"`, sem sombra. "Apagar meus dados" é o único botão `danger` da página e fica por último.
- **Como pensei: o fio.** Uma linha vertical de 1px em `line-strong` liga os passos; cada passo é um nó de 2rem com o ícone em traço fino sobre `surface`; o passo corrigido tem o nó em `amber-soft`, o que falhou em `danger-soft`. O fim do fio é um nó maior, com o ícone `Flag`. As frases ficam na largura `prose`. "Detalhes" em Figtree `text-sm`, com os números em algarismos tabulares (`font-variant-numeric: tabular-nums`).
- **Movimento:** nada entra animado. Abrir "Detalhes" não anima a altura. A troca de conteúdo depois de um toque é só opacidade (`--ritu-fast`), nada com movimento reduzido.
- **Escrita:** os rótulos dizem o que a pessoa faz ("Corrigir", "Apagar", "Esquecer", "Está certo"); a confirmação repete a ação ("Nota corrigida.", "Apagado."); erro diz o que houve e que nada mudou.

## Contratos

### Cria

**Migração (`db/migrations/<próximo número>_runs_fora_da_conversa.sql`)**

```sql
alter table runs add column fora_da_conversa boolean not null default false;
```

**`MessageRepository` (004) ganha**

```ts
contarPorDia(contaId: string, desdeDia: string): Promise<{ dia: string; total: number }[]>   // mais recente primeiro; só dias com mensagem
apagarDoDia(contaId: string, dia: string): Promise<number>
```

**`RunRepository` (004) ganha**

```ts
/** Runs fechados do dia: fora_da_conversa = true e saida, checkpoint, pendencia e clima_usado nulos. Devolve quantos. */
tirarDaConversa(contaId: string, dia: string): Promise<number>
```

`Run` ganha `fora_da_conversa: boolean`. `doDia` (018) deixa de devolver os runs com `fora_da_conversa`. Suítes de contrato: contagem por dia; apagar um dia não toca outro dia nem outra conta; `tirarDaConversa` não toca run aberto.

**Validação no rastro (`src/core/agents/tools/finalizar.ts` e o despacho de controle em `src/core/runs/loop-passo.ts`)**

`finalizar` devolve, junto do resultado, o resumo da etapa: `ok` quando entrega; os códigos das violações, únicos, na ordem, unidos por `,`, quando recusa. O despacho de tools de controle passa esse resumo para `registrarEtapa`. Nada mais muda no loop.

**Configuração (`config/textos-voce.ts`, em `config/index.ts` como `textosVoce`)**

| Chave | Texto |
|---|---|
| `titulo` | Você |
| `dosha.titulo` | Seu dosha |
| `dosha.elementos` | Elementos: {lista} |
| `dosha.qualidades` | Qualidades: {lista} |
| `dosha.corpo`, `dosha.mente`, `dosha.digestao` | Corpo · Mente · Digestão |
| `dosha.desequilibra` | O que costuma te desequilibrar |
| `dosha.equilibra` | O que te equilibra |
| `dosha.proporcao` | {n}% {Dosha} (unidos por " · ") |
| `dosha.escolhido` | Você escolheu |
| `dosha.refazer` | Refazer o quiz |
| `dosha.mudar` | Mudar |
| `dosha.folhaTitulo` | Já sei meu dosha |
| `dosha.misto` | Misto |
| `dosha.mistoAjuda` | Escolha dois. |
| `dosha.salvar` | Salvar |
| `semDosha.titulo` | Descubra seu dosha |
| `semDosha.texto` | Dosha é o jeito como o Ayurveda descreve a sua natureza: o que costuma te tirar do eixo e o que te traz de volta. Sabendo o seu, eu acerto mais nas sugestões. |
| `semDosha.quiz` | Fazer o quiz |
| `semDosha.jaSei` | Já sei meu dosha |
| `quiz.voltar` | Voltar para Você |
| `memoria.titulo` | O que sei sobre você |
| `memoria.texto` | Tudo o que eu guardo para acertar nas sugestões. Você corrige ou apaga o que quiser. |
| `nivel.fixos.titulo` · `.como` · `.vazio` | Fixos · Você me contou ou aprovou. · — (Fixos nunca está vazio: cada linha mostra "nenhum" ou "ainda não sei") |
| `nivel.casa.titulo` · `.como` · `.vazio` | Casa · Com a sua aprovação ou quando você muda em Minha casa. · Nada anotado na sua casa ainda. |
| `nivel.gostos.titulo` · `.como` · `.vazio` | Gostos e resultados · Pelos seus toques e retornos. · Nenhum gosto ou retorno anotado ainda. |
| `nivel.faltas.titulo` · `.como` · `.vazio` | O que fez falta · Anoto sozinho quando algo teria entrado numa sugestão e não estava em casa. Some depois de 30 dias. · Nada fez falta nos últimos 30 dias. |
| `nivel.rotina.titulo` · `.como` · `.vazio` | Rotina · Só com a sua aprovação. · Nada anotado sobre sua rotina. Quando você contar algo que muda as sugestões, eu pergunto se posso anotar. |
| `nivel.padroes.titulo` · `.como` · `.vazio` | Padrões · Percebo nos seus registros e só uso depois do seu sim. · Nenhum padrão por enquanto. |
| `nivel.conversa.titulo` · `.como` · `.vazio` | Conversa · Guardo as mensagens dos últimos 7 dias. · Nenhuma mensagem nos últimos 7 dias. |
| `fixos.dosha`, `fixos.cidade`, `fixos.evitar`, `fixos.restricoes`, `fixos.naoCome` | Dosha · Cidade · Evitar sempre · Restrições · Não como |
| `fixos.origemQuiz`, `fixos.origemDeclarado`, `fixos.semDosha` | pelo quiz · você escolheu · ainda não sei |
| `fixos.semCidade` | nenhuma; respondo sem o clima |
| `fixos.nenhum` | nenhum |
| `fixos.adicionar` | Adicionar |
| `fixos.mudar` | Mudar |
| `fixos.tirarCidade` | Tirar a cidade |
| `evitar.confirmaTitulo` | Tirar {item} de Evitar sempre? |
| `evitar.confirmaTexto` | O Ritu vai voltar a sugerir. |
| `evitar.tirar` · `evitar.manter` | Tirar · Manter |
| `casa.resumo` | {n} itens · {incertos} para confirmar · {acabou} acabaram (partes com zero saem; com 1: "1 item") |
| `casa.lista` | {n} na lista Para ter em casa |
| `casa.link` | Ver Minha casa |
| `gostos.tipo.alimento`, `.pratica`, `.preparo` | alimento · prática · preparo |
| `gostos.gosta`, `gostos.naoGosta` | você gosta · você não gosta |
| `gostos.ajudou`, `gostos.naoAjudou`, `gostos.naoFez` | ajudou {n} vezes · não ajudou {n} vezes · não fez {n} vezes (com 1: "vez") |
| `gostos.esquecer` | Esquecer |
| `faltas.linha` | fez falta em {n} dias nos últimos 30 (com 1: "1 dia") |
| `faltas.naLista` | na lista |
| `rotina.resumo` | Como eu resumo sua rotina |
| `rotina.data` | anotado em {data} |
| `rotina.corrigir` · `rotina.campo` · `rotina.salvar` | Corrigir · Nota de rotina · Salvar |
| `padroes.certo` · `padroes.naoEsta` | Está certo · Não está |
| `padroes.confirmado` | confirmado em {data} |
| `padroes.recusado` | você disse que não |
| `padroes.apagadoRecusado` | Apagado. Se eu notar de novo, pergunto de novo. |
| `conversa.linha` | {dia} · {n} mensagens (com 1: "1 mensagem") |
| `conversa.confirmaTitulo` | Apagar a conversa de {dia}? |
| `conversa.confirmaTexto` | As mensagens somem; o que você aprovou continua anotado. |
| `conversa.emAndamento` | Espere o Ritu terminar esta conversa para apagar. |
| `apagar` · `manter` | Apagar · Manter |
| `naoGuardo` | O que eu não guardo: incômodos de saúde, o motivo de você evitar um alimento e o seu e-mail, que serve só para entrar. |
| `conta.titulo` | Conta |
| `conta.google` | Você entrou com o Google. |
| `conta.demo` | Este é um perfil de demonstração. Ele some em {h} horas. (com menos de 1: "em menos de 1 hora") |
| `conta.tema` | Tema |
| `conta.sair` | Sair |
| `conta.apagar` | Apagar meus dados |
| `conta.confirmaTitulo` | Apagar todos os seus dados? |
| `conta.confirmaTexto` | Apago seu perfil, sua casa, seus gostos, sua rotina, os padrões e a conversa. Não tem volta. |
| `conta.apagarTudo` · `conta.cancelar` | Apagar tudo · Cancelar |
| `confirma.*` | Anotei: {item}. · {Item} saiu. · Nota corrigida. · Nota apagada. · Padrão confirmado. · Não vou usar este padrão. · Apagado. · Esqueci {item}. · Conversa de {dia} apagada. · Cidade: {cidade}. · Sem cidade agora. · Dosha: {nome}. |
| `erro` | Não consegui anotar agora. Nada mudou; tente de novo. |

`textosEntrada` (017) ganha `aviso.dados_apagados`: "Seus dados foram apagados.". `AvisoDaEntrada` ganha `"dados_apagados"`.

**Textos de Como pensei (`config/textos-como-pensei.ts`, como `textosComoPensei`)**

| Chave | Texto |
|---|---|
| `titulo` | Como pensei |
| `quando` | Mensagem de {dia}, {hora} ("hoje", "ontem" ou "em 12 nov.") |
| `voltar` | Voltar para a conversa |
| `detalhes` · `detalhesDoRun` | Detalhes · Detalhes do run |
| `corrigido` · `falhou` | corrigido no passo seguinte · não deu certo |
| `aberto` | Ainda estou pensando nesta mensagem. |
| `semRastro` | Esta conversa veio pronta com a demonstração e não tem o rastro guardado. |
| `apagada` | A conversa deste dia foi apagada. |
| `tecnico.*` | Modelo · Tokens (entrada / saída) · Tempo · Passos · Tempo total · Modelos por papel · Trocas de modelo · Versão do prompt · Tentativas da revisão |

**Painel do dosha (`src/core/accounts/painel.ts`)**

```ts
export type CartaDeDosha = {
  dosha: Dosha; nome: string; resumo: string
  elementos: string[]; qualidades: string[]              // nomes para a tela (elementos por tabela fixa; gunas por vocabulario.yaml)
  corpo: string; mente: string; digestao: string; desequilibra: string; equilibra: string
}
export type PainelDoDosha =
  | { tem: true; nome: string; origem: "quiz" | "declarado"; proporcao: { dosha: Dosha; porcento: number }[] | null; cartas: CartaDeDosha[] }
  | { tem: false; linhas: { dosha: Dosha; nome: string; resumo: string }[] }
export function painelDoDosha(perfil: Perfil, kb: KnowledgeBase): PainelDoDosha
```

`cartas`: os doshas do nome de `nomeDoDosha`, na ordem do nome (um ou dois). `proporcao`: só com origem `quiz`, os três doshas do maior para o menor, porcentagens inteiras que somam 100 (arredondamento pelo maior resto). Elementos: `ar` → "ar", `espaco` → "espaço", `fogo` → "fogo", `agua` → "água", `terra` → "terra"; a lista em texto usa "e" antes do último.

**Visão da memória (`src/core/memory/visao.ts`)**

```ts
export type ItemFixo = { tipo: "grupo" | "alimento" | "texto"; valor: string; nome: string }
export type MemoriaNaTela = {
  fixos: {
    dosha: { nome: string; origem: "quiz" | "declarado" } | null
    cidade: string | null
    evitar: ItemFixo[]                                                  // na ordem de "desde"
    restricoes: Restricao[]
    nao_come: ItemFixo[]                                                // tipo "alimento" ou "texto"
  }
  casa: { itens: number; incertos: number; acabou: number; na_lista: number }
  gostos: { item_tipo: ItemTipo; item_id: string; nome: string; gosto: "gosta" | "nao_gosta" | null; ajudou: number; nao_ajudou: number; nao_fez: number }[]
  faltas: { alimento_id: string; nome: string; dias: number; na_lista: boolean }[]
  rotina: { resumo: string | null; notas: { id: string; texto: string; criado_em: string }[] }
  padroes: { id: string; frase: string; status: StatusPadrao; decidido_em: string | null }[]   // candidatos (só os que valem hoje), confirmados, recusados
  conversa: { dia: string; nome: string; total: number }[]
}
export function visaoDaMemoria(p: {
  perfil: Perfil; casa: CasaNaTela; preferencias: Preferencia[]
  faltas: { alimento_id: string; dias: number }[]; lista: ItemDaLista[]
  notas: NotaDeRotina[]; resumo: ResumoDeRotina | undefined
  padroes: Padrao[]; filtro: FiltroPessoa
  conversa: { dia: string; total: number }[]
  kb: KnowledgeBase; agora: Date; fuso: string
}): MemoriaNaTela
```

Pura e sem lançar. Gostos: só linhas com gosto ou algum contador diferente de zero e com item que existe na base; ordem alfabética `pt-BR`. Faltas: alimento que não existe mais na base sai. Padrões: candidatos que `padraoVale` aprova, do mais antigo para o mais novo, depois confirmados e recusados, do mais recente para o mais antigo. Conversa: os dias de `contarPorDia` nos últimos `config.memoria.mensagensDias` (7), com `nome` "Hoje", "Ontem" ou "Há N dias".

**Leitura (`src/core/memory/ler.ts`)**

```ts
export type VoceNaTela = { painel: PainelDoDosha; memoria: MemoriaNaTela; conta: { tipo: "google" | "demo"; horas_restantes: number | null } }
export function lerVoce(deps: { stores: Stores; kb: KnowledgeBase; clock: Clock }, conta: Conta, fuso: string): Promise<VoceNaTela>
```

Lê perfil, `lerCasa` (019), preferências, `diasComFalta` (hoje − (`config.memoria.faltasDias` − 1)), lista, notas ativas, resumo, padrões, `contarPorDia` (hoje − 6); monta o filtro com `montarFiltro` (sem temporários e sem itens da mensagem). `horas_restantes`: só na demonstração, arredondado para baixo, mínimo 0.

**Ações de perfil (`src/core/touches/perfil.ts`, `Deps` da 011 mais `tx`)**

```ts
const cidadeSchema = /* o mesmo de POST /api/onboarding/perfil (017) */
export const acaoDoPerfilSchema = z.discriminatedUnion("acao", [
  z.strictObject({ acao: z.literal("dosha"), doshas: z.array(doshaSchema).min(1).max(2) }),
  z.strictObject({ acao: z.literal("quiz"), respostas: z.array(z.strictObject({ pergunta_id: z.string().max(60), dosha: doshaSchema })) }),
  z.strictObject({ acao: z.literal("cidade"), cidade: cidadeSchema.nullable() }),
  z.strictObject({ acao: z.literal("evitar_acrescentar"), itens: z.array(evitarItemSchema).min(1).max(20) }),   // como na 017
  z.strictObject({ acao: z.literal("evitar_tirar"), item: evitarItemSchema, confirmado: z.literal(true) }),
  z.strictObject({ acao: z.literal("restricoes"), restricoes: z.array(restricaoSchema).max(4) }),
  z.strictObject({ acao: z.literal("nao_come_acrescentar"), alimento_id: z.string().min(1).max(60).optional(), texto: z.string().trim().min(2).max(40).optional() }),   // exatamente um dos dois
  z.strictObject({ acao: z.literal("nao_come_tirar"), item: z.strictObject({ tipo: z.enum(["alimento", "texto"]), valor: z.string().max(60) }) }),
])
export function tocarPerfil(deps: Deps, contaId: string, acao: AcaoDoPerfil): Promise<{ nome: string }>
```

Numa transação, dentro do span `toque` (`tipo: "perfil"`, `toque.acao`: o valor de `acao`):

| Ação | Faz | Recusa |
|---|---|---|
| `dosha` | `definirPrakriti(prakritiDeclarada(doshas), "declarado")` | `dosha_invalido` (017) |
| `quiz` | Uma resposta por pergunta de `kb.quiz`, todas; `calcularQuiz`, `definirPrakriti(…, "quiz")` | Faltando ou sobrando pergunta: `corpo_invalido` |
| `cidade` | `definirCidade` | — |
| `evitar_acrescentar` | `acrescentarEvitarSempre` | Grupo ou alimento fora da base: `toque_invalido` |
| `evitar_tirar` | `removerEvitarSempre(…, { confirmado: true })` | Item que não está na lista: `toque_invalido` |
| `restricoes` | `definirRestricoes` (sem repetir) | — |
| `nao_come_acrescentar` | Com `texto`: `identificarAlimento`; achou → alimento, não → texto. Acrescenta sem duplicar (`definirNaoCome` com a lista nova) | Os dois ou nenhum: `corpo_invalido`; alimento fora da base: `toque_invalido` |
| `nao_come_tirar` | `definirNaoCome` sem o item | Item que não está: `toque_invalido` |

O nome devolvido serve só para a frase de confirmação: nome do dosha, nome da cidade, nome do item.

**Ações de memória (`src/core/touches/memoria.ts`)**

```ts
export const acaoDaMemoriaSchema = z.discriminatedUnion("acao", [
  z.strictObject({ acao: z.literal("gosto"), item_tipo: z.enum(["alimento", "pratica", "preparo"]), item_id: z.string().max(60), gosto: z.enum(["gosta", "nao_gosta"]).nullable() }),
  z.strictObject({ acao: z.literal("esquecer"), item_tipo: z.enum(["alimento", "pratica", "preparo"]), item_id: z.string().max(60) }),
  z.strictObject({ acao: z.literal("falta_apagar"), alimento_id: z.string().max(60) }),
  z.strictObject({ acao: z.literal("nota_corrigir"), nota_id: z.uuid(), texto: z.string().max(400) }),     // o limite de 200 é da 012, depois de aparar
  z.strictObject({ acao: z.literal("nota_apagar"), nota_id: z.uuid() }),
  z.strictObject({ acao: z.literal("padrao_decidir"), padrao_id: z.uuid(), decisao: z.enum(["confirmado", "recusado"]) }),
  z.strictObject({ acao: z.literal("padrao_apagar"), padrao_id: z.uuid() }),
  z.strictObject({ acao: z.literal("conversa_apagar"), dia: z.iso.date() }),
])
export function tocarMemoria(deps: Deps & { routine: ContainerRoutine; patterns: ContainerPatterns }, contaId: string, acao: AcaoDaMemoria, fuso: string): Promise<{ nome: string }>
```

Dentro do span `toque` (`tipo: "memoria"`, `toque.acao`):

| Ação | Faz | Recusa |
|---|---|---|
| `gosto` | `tocarGosto` (011) com o tipo e o id | Item fora da base: `toque_invalido` |
| `esquecer` | `preferences.apagar` | Item fora da base: `toque_invalido` |
| `falta_apagar` | `shortages.apagarDoAlimento` | Alimento fora da base: `toque_invalido` |
| `nota_corrigir` | `corrigirNota` (012) | `nota_invalida` |
| `nota_apagar` | `apagarNota` (012) | `nota_invalida` |
| `padrao_decidir` | `decidirPadrao` (012) | `padrao_invalido` |
| `padrao_apagar` | `apagarPadrao` (012) | `padrao_invalido` |
| `conversa_apagar` | Dia dentro dos últimos 7 (no fuso); `runs.aberto` com esse dia → recusa; numa transação, `messages.apagarDoDia` e `runs.tirarDaConversa` | Dia fora da janela: `toque_invalido`; run aberto no dia: `conversa_em_andamento` (409) |

Cada ação que grava soma `ritu_memoria_edicoes_total{nivel, acao}`: `nivel` em `fixos`, `gostos`, `faltas`, `rotina`, `padroes`, `conversa` (as de perfil contam como `fixos`); `acao` é o valor de `acao`. Rótulos sem nome, id ou texto.

**Apagar meus dados (`src/core/accounts/apagar.ts` e `src/app/_acoes/sessao.ts`)**

```ts
export function apagarConta(deps: { stores: Stores; telemetry: Telemetry }, conta: Conta): Promise<void>
// accounts.apagar(conta.id); ritu_conta_apagada_total{tipo: conta.tipo}

export async function apagarMeusDados(): Promise<void>
// contaAtual(); sem conta → redirect("/"). apagarConta → signOut({ redirectTo: "/?aviso=dados_apagados" }).
```

**Linha do tempo (`src/core/runs/linha-do-tempo.ts`)**

```ts
export type TipoDoPasso = "entendi" | "cuidado" | "clima" | "casa" | "lembrei" | "base" | "retorno" | "conferi" | "perguntei" | "propus" | "aprovacao" | "memoria" | "revisao" | "troca" | "erro" | "fim"
export type PassoNaTela = {
  tipo: TipoDoPasso
  frase: string
  detalhe?: string
  marca?: "corrigido" | "falhou"
  tecnico: { modelo?: string; tokens_entrada?: number; tokens_saida?: number; duracao_ms?: number }
}
export type LinhaDoTempo =
  | { estado: "aberto" }
  | { estado: "sem_rastro" }
  | { estado: "pronto"; quando: string; passos: PassoNaTela[]; total: TotalDoRun }
export type TotalDoRun = {
  passos: number; latencia_ms: number; tokens_entrada: number; tokens_saida: number
  modelos: { papel: string; modelos: string[] }[]; trocas_de_modelo: number
  prompt_versao: string | null; juiz_tentativas: number
}
export function linhaDoTempo(p: { run: Run; etapas: RunEtapa[]; propostas: Proposta[]; kb: KnowledgeBase; agora: Date; fuso: string }): LinhaDoTempo
```

Pura e sem lançar. Run `running`, `waiting_for_input` ou `waiting_for_approval` sem etapas → `aberto`; `running` com etapas também é `aberto`. Run fechado sem etapas → `sem_rastro`. Etapas na ordem de `ordem`. Uma etapa vira no máximo um passo; `tecnico` vem da própria etapa. Etapas `llm` não viram passo; o modelo e os tokens delas somam no `total` (que vem dos totais do run, `ARCHITECTURE.md` §6).

| Etapa (`tipo` / `nome` / `resumo`) | `tipo` do passo | Frase | Detalhe |
|---|---|---|---|
| `interprete` | `entendi` | Entendi que você falou de {intenções}. | Com `run.momento.estados`: "Você estava {estados}." (frases dos estados da 012) |
| `guardrail` / `alerta_fisico` ou `alerta_emocional` | `cuidado` | Percebi um sinal de cuidado e respondi só com o aviso. | — |
| `guardrail` / `injection` | `cuidado` | Li sua mensagem como conversa, não como instrução. | — |
| `tool` / `clima.agora`, `ok` | `clima` | Vi o clima: {temperatura} °C, {umidade}% de umidade. | "Isso pede algo {gunas}." com os nomes das gunas do clima usado |
| `tool` / `clima.agora`, `sem cidade` | `clima` | Sem cidade escolhida, respondi sem o clima. | — |
| `tool` / `clima.agora`, `indisponível` | `clima` | O clima não respondeu; segui sem ele. | — |
| `tool` / `clima.proximas_horas` | `clima` | Olhei o clima das próximas horas. | — |
| `tool` / `casa.ler` | `casa` | Olhei sua casa: {resumo}. | — |
| `tool` / `preferencias.ler` | `lembrei` | Lembrei do que você gosta e do que funcionou. | — |
| `tool` / `historico.recente` | `lembrei` | Lembrei das últimas conversas: {resumo}. | — |
| `tool` / `ayurveda.*` | `base` | Consultei a base ayurvédica: {resumo}. | — |
| `tool` / `resultado.registrar` | `retorno` | Anotei seu retorno. | — |
| `validacao`, `ok`, sem `recusado` antes | `conferi` | Conferi a resposta: tudo certo. | — |
| `validacao`, `ok`, com `recusado` antes | `conferi` | Corrigi e conferi de novo: tudo certo. | — |
| `validacao`, `recusado` | `conferi` (marca `corrigido`) | Conferi a resposta e achei {n} problema(s). | Os códigos em palavras (tabela abaixo), unidos por "; " |
| `pergunta`, `casa: N itens` | `perguntei` | Perguntei se você tinha {N} itens. | — |
| `pergunta`, `come` · `variante` | `perguntei` | Perguntei se você come um alimento. · Perguntei como era o incômodo. | — |
| `proposta` | `propus` | Propus anotar: {texto da linha}. | A decisão: "Você aprovou.", "Você não aprovou." ou "A proposta expirou." |
| `aprovacao` | `aprovacao` | Você aprovou {resumo}. | — |
| `memoria` / `resumo_de_rotina` | `memoria` | Atualizei o resumo da sua rotina. | — |
| `juiz`, `aprovado` | `revisao` | Revisei a resposta com cuidado: aprovada. | — |
| `juiz`, `aprovado; registros: …` | `revisao` | Revisei a resposta com cuidado: aprovada, com uma nota de linguagem. | — |
| `juiz`, `reprovado: …` | `revisao` (marca `corrigido`) | Revisei a resposta e pedi outra versão. | Os motivos em palavras (tabela abaixo) |
| `juiz`, `indisponivel` | `revisao` (marca `falhou`) | A revisão não respondeu; entreguei uma resposta segura. | — |
| `troca_de_modelo`, `cota` · `429` | `troca` | Troquei de modelo: a cota do anterior acabou. · Troquei de modelo: o anterior não respondeu. | — |
| `erro` | `erro` (marca `falhou`) | Tive um problema neste passo. | — |
| Qualquer etapa com `status: "falhou"` não listada acima | o da linha | A frase da linha | marca `falhou` |
| Outras (`llm`, tools de controle e de proposta) | — | Sem passo | — |

`{intenções}`: `momento` → "como você está agora", `pergunta` → "uma pergunta", `vida` → "sua rotina", `casa` → "o que tem em casa", `retorno` → "como ficou uma sugestão", `evitar` → "algo que você não pode comer", `ajuda` → "como eu funciono", `ofensa` → "algo que não era sobre você", `fora` → "um assunto fora do que eu sei"; o `resumo` da etapa é a lista de ids; unidas por vírgula e "e". `{texto da linha}`: `textoDaProposta` (010) do conteúdo da proposta do run com o mesmo tipo, na ordem.

Códigos da validação em palavras: `fora_da_base` algo fora da base · `estrutura` a resposta fora do formato · `fora_de_casa` um ingrediente que você não tem · `evitar_sempre` algo que você evita sempre · `restricao` algo fora da sua restrição · `nao_come` algo que você não come · `nao_gosta` algo de que você não gosta · `contraindicacao` algo que não combina com o seu momento · `combinacao` uma combinação que não vai bem · `repetida` uma sugestão repetida de hoje · `linha_base` um motivo fora da base · `qualidades` qualidades que não batem com o momento · `novidade` a novidade fora das regras · `para_ter` a indicação de "vale ter em casa" fora das regras · `texto_sem_estrutura` o texto citando algo fora das sugestões · `tamanho` a resposta longa demais · `vazia` a resposta vazia.

Motivos do Juiz em palavras: `promessa` uma promessa de cura · `dosagem` uma dose · `conselho` um conselho fora do meu papel · `evitar_sempre` algo que você evita sempre · `texto_diferente` o texto diferente das sugestões · `motivo_sem_base` um motivo sem base · `para_ter` a indicação de "vale ter em casa" · `vulgar` uma palavra imprópria · `tom` o tom · `saude_na_proposta` saúde numa proposta de anotação.

Último passo (`fim`), pelo `status` e pela `saida` do run:

| Situação | Frase |
|---|---|
| `fora_da_conversa` | A conversa deste dia foi apagada. |
| `done`, `saida.origem` `agente` | Entreguei a resposta com {n} sugestões. (com 0: "Entreguei a resposta.") |
| `done`, `segura` | Entreguei uma resposta segura. |
| `done`, `sem_modelo` | Sem modelo disponível, montei a resposta por código. |
| `done`, `codigo` | Respondi direto, sem o agente. |
| `done` sem `saida` válida | Entreguei a resposta. |
| `failed` · `expired` · `cancelled` | Não consegui terminar. · A pergunta expirou. · Você seguiu a conversa. |

Nenhum texto desta tabela vem do modelo. Valor de `run.saida` ou `run.clima_usado` que não passa no schema é ignorado (o passo sai sem o detalhe).

**Leitura de Como pensei (`src/core/runs/ler-como-pensei.ts`)**

```ts
export function lerComoPensei(deps: { stores: Stores; kb: KnowledgeBase; clock: Clock }, contaId: string, runId: string, fuso: string): Promise<LinhaDoTempo | undefined>
// runs.buscar (conta) → undefined se não achar; runs.etapas; proposals.doRun → linhaDoTempo
```

`Container` ganha `lerVoce`, `lerComoPensei`, `touches.tocarPerfil`, `touches.tocarMemoria` e `accounts.apagarConta`.

**Rotas (todas por `criarRota`)**

| Rota | Corpo | Faz | Resposta |
|---|---|---|---|
| `GET /api/voce` | — | `lerVoce` | `{ voce: VoceNaTela }` |
| `POST /api/perfil` | `acaoDoPerfilSchema` | `tocarPerfil` e `lerVoce` | `{ voce, nome }`; com `acao: "quiz"`, mais `{ resultado: { nome, doshas, dual } }` |
| `POST /api/memoria` | `acaoDaMemoriaSchema` | `tocarMemoria` e `lerVoce` | `{ voce, nome }` |

`RituError` novo: `conversa_em_andamento` (409).

**Métricas (`METRICAS`, 015)**

| Métrica | Tipo | Rótulos |
|---|---|---|
| `ritu_memoria_edicoes_total` | contador | `nivel`, `acao` |
| `ritu_conta_apagada_total` | contador | `tipo` (google, demo) |

O painel ganha, na linha Memória, "Edições da memória pela pessoa" (por `nivel`) e "Contas apagadas" (por `tipo`); `painel.json` regenerado. `toque.tipo` aceita `perfil` e `memoria`; `toque.acao` entra no registro de atributos com os valores das duas uniões.

**Ícones (Phosphor, peso `light`)**

| Uso | Ícone |
|---|---|
| Passos: entendi · cuidado · clima · casa · lembrei · base · retorno | `ChatCircleText`, `ShieldCheck`, `CloudSun`, `House`, `BookOpen`, `Leaf`, `ArrowsClockwise` |
| Passos: conferi · perguntei · propus · aprovação · memória · revisão · troca · erro · fim | `CheckCircle`, `Question`, `NotePencil`, `HandPointing`, `Notebook`, `Scales`, `Swap`, `WarningCircle`, `Flag` |
| Corrigir · Apagar · Esquecer | `PencilSimple`, `Trash`, `Eraser` |
| Está certo · Não está | `Check`, `X` |
| Sair · Apagar meus dados | `SignOut`, `Trash` |

Conferir os nomes no pacote instalado; nome que não existir troca pelo mais próximo e entra na nota do plano.

**Componentes (`src/components/ritu/voce/` e `src/components/ritu/como-pensei/`, `"use client"` onde houver estado)**

| Arquivo | Exporta | O que é |
|---|---|---|
| `voce/use-voce.ts` | `useVoce(inicial: VoceNaTela)` | Estado da página; `perfil(acao)`, `memoria(acao)`; chama a rota, troca a visão pela resposta, dispara o `toast` de confirmação ou de erro |
| `voce/voce.tsx` | `Voce` | `h1`, a carta, O que sei sobre você, Conta |
| `voce/carta-dosha.tsx` | `CartaDoDosha` | Com e sem dosha; a proporção; `Tabs` no misto; "Refazer o quiz", "Mudar" e os botões do sem dosha |
| `voce/folha-dosha.tsx` | `FolhaDoDosha` | `Sheet` "Já sei meu dosha" |
| `voce/nivel.tsx` | `NivelDaMemoria` | `section` com o `h3`, a linha de como é anotado na margem e os itens; o estado vazio do nível |
| `voce/item-memoria.tsx` | `ItemDeMemoria` | Linha com texto, complemento e ações |
| `voce/fixos.tsx` | `Fixos` | As cinco linhas, as folhas de cidade, de "evitar sempre" e de "não como", e a confirmação de tirar |
| `voce/gostos.tsx`, `faltas.tsx`, `rotina.tsx`, `padroes.tsx`, `conversa.tsx`, `casa.tsx` | Um por nível | Os itens e as ações do nível; `rotina.tsx` tem a folha de corrigir; `conversa.tsx` tem a confirmação de apagar |
| `voce/conta.tsx` | `Conta` | Tipo da conta, `ThemeSwitcher`, "Sair", "Apagar meus dados" e a confirmação |
| `como-pensei/linha-do-tempo.tsx` | `LinhaDoTempoNaTela` | O fio, um `li` por passo com o nó, a frase, o detalhe, a marca e o `details` técnico |
| `como-pensei/total.tsx` | `TotalDoRun` | `details` "Detalhes do run" com uma `dl` |

**Páginas**

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/voce` | `src/app/(app)/voce/page.tsx` | Servidor: `exigirPasso("pronto")`, `lerVoce`, `<Voce inicial={…} googleDisponivel={…} />` |
| `/voce/quiz` | `src/app/(app)/voce/quiz/page.tsx` | Servidor: `exigirPasso("pronto")`; o quiz da 017 com destino `POST /api/perfil` e o botão "Voltar para Você" no resultado |
| `/como-pensei/[runId]` | `src/app/(app)/como-pensei/[runId]/page.tsx` | Servidor: `exigirPasso("pronto")`; `runId` não uuid ou `lerComoPensei` sem run → `notFound()`; senão, o estado da linha do tempo |
| Carregando | `loading.tsx` nas três | `StateBlock kind="loading"` |

**Testes**

- `npm test`: `painelDoDosha` (um dosha, misto com quiz e porcentagens que somam 100, misto declarado sem porcentagem, sem dosha), `visaoDaMemoria` (cada nível cheio e vazio; gostos sem linha zerada; falta de alimento fora da base; candidato barrado pelo filtro some; ordem dos padrões; dias da conversa no fuso), `linhaDoTempo` (cada linha das tabelas; validação recusada e depois aprovada; juiz reprovado e aprovado; run aberto; sem etapas; `fora_da_conversa`; `saida` inválida; `llm` só no total), `tocarPerfil` e `tocarMemoria` (cada ação e cada recusa; `evitar_tirar` sem item; `conversa_apagar` com run aberto e fora da janela), o resumo da validação em `finalizar`, rotas com os stores em memória (401, 400, 409, 413).
- `e2e/voce.spec.ts` (modo e2e, `entrarNaDemo`): carta do seed com a proporção e as abas; os sete níveis preenchidos; restrição "vegetariana" ligada; acrescentar e tirar de "evitar sempre" (com "Manter" e com "Tirar"); "não como" por texto livre; corrigir e apagar nota (o resumo muda); confirmar o padrão do seed; esquecer um gosto; apagar a falta de cardamomo; apagar a conversa de hoje e ver a Conversa vazia; trocar a cidade; refazer o quiz até o resultado; tema escuro pelo `ThemeSwitcher`; "Apagar meus dados" até a Entrada com o aviso; `Origin` de outro site → `403`; só com teclado; axe em cheia, vazia (conta nova), folhas e confirmações, nos dois temas.
- `e2e/como-pensei.spec.ts`: enviar a mensagem sugerida, abrir "Como pensei" pela resposta, conferir a ordem dos passos e abrir "Detalhes do run"; run semeado mostra o estado sem rastro; run de outra conta → 404; axe nos dois temas.

### Usa

- **002:** `KnowledgeBase` (`doshas`, `quiz`, `vocabulario`, `gruposEvitar`), `identificarAlimento`, `Dosha`, `Restricao`, `RESTRICOES`.
- **004:** `ProfileStore`, `Perfil`, `AccountRepository.apagar`, `PreferenceStore` (`ler`, `apagar`), `ShortageStore` (`diasComFalta`, `apagarDoAlimento`, `lista`), `RoutineStore`, `PatternStore`, `MessageRepository`, `RunRepository`, `ProposalStore.doRun`, `Run`, `RunEtapa`, `diaLocal`, `createMemoryStores`, suítes de contrato (inclusive `delete-account`), `config.memoria`.
- **005 e 006:** `TipoDeEtapa`, totais do run, `Troca.motivo`.
- **007:** `CodigoDeViolacao`, `finalizar`, `SaidaDoAcompanhante`, `saidaDoAcompanhanteSchema`.
- **008:** ids das intenções, `resumo` da etapa `interprete`.
- **009:** `resumo` da etapa `pergunta`.
- **010:** `textoDaProposta`, `Proposta`, `resumo` das etapas `proposta` e `aprovacao`.
- **011:** `Deps` dos toques, span `toque`, `tocarGosto`, `RituError` `toque_invalido`.
- **012:** `apagarNota`, `corrigirNota`, `decidirPadrao`, `apagarPadrao`, `padraoVale`, frases dos estados, etapa `memoria`.
- **013:** `MotivoDoJuiz`, `resumo` das etapas `juiz` e `guardrail`.
- **015:** `METRICAS`, registro de atributos, painel como código, teste de canários.
- **016:** tokens, `Button`, `IconButton`, `Chip`, `ToggleChip`, `TagList`, `Checkbox`, `Switch`, `Tabs`, `Sheet`, `Dialog`, `ComboBox`, `TextField`, `Surface`, `StateBlock`, `TextLink`, `toast`, `ICON`, `DoshaBlot`, `ThemeSwitcher`, `expectSemViolacoes`, `usarTema`.
- **017:** `criarRota`, `exigirPasso`, `contaAtual`, `calcularQuiz`, `prakritiDeclarada`, `nomeDoDosha`, quiz, busca de cidade, `GET /api/cidades`, `GET /api/alimentos`, escolha de "evitar sempre", `sair`, `signOut`, `AvisoDaEntrada`, modo e2e, `entrarNaDemo`, perfil semeado.
- **018:** páginas e barra de `(app)`, `conversaDoDia`, `doDia`, link "Como pensei", roteiro `demo` do modo e2e.
- **019:** `lerCasa`, `CasaNaTela`.

## Evals (quando a spec toca agente, prompt, tool ou base)

A spec não muda prompt, tool nem base; muda só o `resumo` da validação. Novos determinísticos:

- `evals/det/seguranca/voce.eval.ts`: cada rota sem sessão → `401`; nota, padrão, dia e item de outra conta → recusa e nada gravado; `GET /api/voce` não traz dado de outra conta; `lerComoPensei` com run de outra conta → `undefined`; `evitar_tirar` sem `confirmado` → `400`; `apagarConta` não deixa nada da conta e a conta não é mais achada.
- `evals/det/memoria/efeito.eval.ts`, com os stores em memória e o perfil semeado: alimento em "evitar sempre" e em "não como" sai dos candidatos do preparo seguinte; restrição "vegana" tira laticínios; nota apagada sai do resumo de rotina; padrão confirmado entra nos padrões do prompt; padrão recusado não volta ao bloco; "esquecer" tira o ponto de gosto da ordenação; apagar a conversa de hoje tira as mensagens do contexto do agente e a conversa da tela.
- `evals/det/conversa/como-pensei.eval.ts`: os cenários da 008 a 013 rodados com o runtime roteirizado viram linhas do tempo sem passo vazio, com o passo `fim` por último, e nenhuma frase é igual ao `resumo` cru de uma etapa; nenhum `resumo` de validação tem nome de alimento.

## Nível das partes

- **tela** (Sonnet): componentes de `src/components/ritu/voce/` e `src/components/ritu/como-pensei/`, as três páginas e os `loading.tsx`, a extração do quiz, da escolha de "evitar sempre" e da busca de cidade (se preciso), o aviso na Entrada, `e2e/voce.spec.ts` e `e2e/como-pensei.spec.ts`.
- **nucleo** (Sonnet): o resumo da validação em `finalizar` e no despacho de controle do loop; `apagarMeusDados` com o `signOut`.
- Todo o resto é `mecanica`: migração, métodos novos das portas e contratos, textos, `painelDoDosha`, `visaoDaMemoria`, `lerVoce`, `linhaDoTempo`, `lerComoPensei`, `tocarPerfil`, `tocarMemoria`, `apagarConta`, rotas, métricas e painel, evals determinísticos e mapa.

## Leitura para a construção

- `BUSINESS.md` §11 (níveis da memória e "evitar sempre") e §13 (painel do dosha).
- `OBSERVABILITY.md` §2 (rastro e Como pensei).
- `DESIGN.md` §3 (regras e acessibilidade) e §4 (componentes do Ritu).
- `DEVELOPMENT.md` §"UI" e §"Camadas e importações".
- Skills: `frontend-design` e `web-design-guidelines` (tela); `next-best-practices` (`route-handlers.md`, `rsc-boundaries.md`, `functions.md` para a ação de servidor).

## Dependências

- 017, 018 e 019 implementadas; 010 a 015 implementadas.
- Nenhum pacote novo. Nenhuma variável de ambiente nova.

## Riscos e trade-offs

- **Página longa no celular:** sete níveis e a carta. A carta vem primeiro porque é o que muda as respostas; os níveis com mais itens (gostos, faltas) começam pelos mais relevantes. Navegação interna por âncoras fica para depois do portão, se a dona pedir.
- **Corrigir nota chama o modelo:** o resumo de rotina usa o papel `apoio` (012). Sem cota, sai o resumo por código; a pessoa não percebe diferença além do texto.
- **Apagar a conversa tira a `saida` dos runs:** Como pensei daquele dia perde a contagem de sugestões e o clima; o rastro continua. É o preço de apagar de verdade o texto da resposta.
- **Sem desfazer:** "Esquecer", "Apagar" de nota, padrão e falta não têm desfazer; os mais destrutivos (evitar sempre, conversa, conta) pedem confirmação. Um desfazer no aviso breve fica para depois do portão.
- **Perfil some como tela:** quem procurar "Perfil" encontra "Você"; a barra já usa esse nome desde a 018.
- **Porcentagem só do quiz:** quem declarou "Misto" não vê proporção. É honesto com o que a pessoa informou.

## Edge cases e modos de falha

- Ação em duas abas ao mesmo tempo: a segunda recebe a visão como está; tirar o que já saiu → `toque_invalido`, e a tela relê `GET /api/voce` e mostra o aviso de erro.
- Padrão decidido pelo bloco da Conversa enquanto "Você" estava aberta: `padrao_invalido`; a tela relê.
- Cidade trocada: o fuso muda; "Hoje" e "Ontem" da conversa e as datas passam a usar o novo fuso na próxima leitura.
- Refazer o quiz com resultado igual: grava de novo, sem erro; o aviso diz o nome.
- Tirar todas as restrições: lista vazia é válida.
- Item de "evitar sempre" em texto livre: aparece como foi escrito; tirar pede a mesma confirmação.
- "Não como" com alimento que já está em "evitar sempre": grava; o filtro já tirava.
- Apagar a conversa de hoje com run em `waiting_for_input`: recusa com `conversa_em_andamento`.
- Apagar meus dados na demonstração: apaga a conta de demonstração e volta à Entrada; a cota de demonstrações do IP não volta.
- `apagarMeusDados` falha no banco: nada é apagado (transação da 004), a sessão continua e o aviso de erro aparece.
- Run com `clima_usado` ou `saida` de formato antigo: o passo sai sem o detalhe; nunca erro na página.
- Run com mais de 50 etapas: todas aparecem; o fio não tem limite.
- Conta de demonstração vencida no meio: a rota responde `401` e a tela volta à Entrada com o aviso da 017.
- JavaScript desligado: `/voce` e `/como-pensei` mostram o conteúdo do servidor, sem ações, com um `noscript` dizendo que mudar precisa de JavaScript; os `details` abrem sem JavaScript.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 6 verdes; `npm run dup` limpo; `test:db` verde.
- Screenshots em `.plans/020-<tela>-<estado>-<tema>-<projeto>.png` de `/voce` (cheia, vazia, sem dosha, confirmação de "evitar sempre"), `/voce/quiz` (resultado) e `/como-pensei/<run>` (com detalhes abertos e fechados), claro e escuro, celular e desktop, para a dona conferir.
- `BUSINESS.md` §7: a linha "Perfil" sai; "Painel do dosha" vira a carta no topo de "Você"; "O que sei sobre você" com os fixos editáveis e a Conta; Como pensei com os detalhes recolhidos. §11: tirar de "evitar sempre" só em "O que sei sobre você"; apagar a conversa de um dia. §13: "Muda no Perfil" → "Muda em Você".
- `AI.md` §6: remover "evitar sempre" é só pela rota de perfil, com confirmação.
- `ARCHITECTURE.md` §3: `/api/perfil` e `/api/memoria` com as ações; sai `/api/padroes/:id`; §6: `runs.fora_da_conversa`; §7: `src/components/ritu/voce/` e `como-pensei/`.
- `OBSERVABILITY.md` §2: Como pensei como é (frases por código, detalhes recolhidos, validação com códigos); §3: as duas métricas novas.
- `DESIGN.md` §4: carta de dosha em "Você", item de memória com a margem, busca de cidade em "Aviso inicial, Você", linha do tempo com o fio.
- `QA.md`: os E2E de "Você" e de Como pensei apontam para os arquivos novos.
- `.specs/README.md`: a linha da 020 como foi feita.

## Arquivos e diretórios envolvidos

- `db/migrations/<próximo>_runs_fora_da_conversa.sql` (novo)
- `src/core/messages/ports.ts`, `src/core/runs/ports.ts`, `src/infra/db/messages.ts`, `src/infra/db/runs.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/messages.contract.ts`, `test/contracts/runs.contract.ts`
- `src/core/agents/tools/finalizar.ts`, `src/core/runs/loop-passo.ts`
- `src/core/conversation/do-dia.ts` (018: runs fora da conversa)
- `config/textos-voce.ts`, `config/textos-como-pensei.ts` (novos), `config/index.ts`, `config/textos-entrada.ts`
- `src/core/accounts/painel.ts`, `src/core/accounts/apagar.ts`, `src/core/accounts/entrada.ts` (novos e mudança, com testes)
- `src/core/memory/visao.ts`, `src/core/memory/ler.ts` (novos, com testes)
- `src/core/runs/linha-do-tempo.ts`, `src/core/runs/ler-como-pensei.ts` (novos, com testes)
- `src/core/touches/perfil.ts`, `src/core/touches/memoria.ts` (novos, com testes)
- `src/core/telemetry/` (métricas e valores de `toque.tipo` e `toque.acao`), `observability/` (painel regenerado)
- `src/infra/container.ts`
- `src/app/api/voce/route.ts`, `src/app/api/perfil/route.ts`, `src/app/api/memoria/route.ts` (novos)
- `src/app/_acoes/sessao.ts` (`apagarMeusDados`)
- `src/app/(app)/voce/page.tsx`, `loading.tsx`; `src/app/(app)/voce/quiz/page.tsx`, `loading.tsx`; `src/app/(app)/como-pensei/[runId]/page.tsx`, `loading.tsx`
- `src/components/ritu/voce/`, `src/components/ritu/como-pensei/` (novos); `src/components/ritu/quiz/`, `evitar/`, `cidade/` (extraídos da 017, se preciso)
- `e2e/voce.spec.ts`, `e2e/como-pensei.spec.ts` (novos)
- `evals/det/seguranca/voce.eval.ts`, `evals/det/memoria/efeito.eval.ts`, `evals/det/conversa/como-pensei.eval.ts` (novos), `evals/det/mapa.ts`
- `.docs/BUSINESS.md`, `AI.md`, `ARCHITECTURE.md`, `OBSERVABILITY.md`, `DESIGN.md`, `QA.md`; `.specs/README.md`
