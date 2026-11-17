---
title: Entrada e contas
status: implemented
implemented: 70cdd07
entrega: 3
created: 2026-11-15
---

# Entrada e contas

> Abre a porta do site: tela de Entrada, sessão com Google e com a demonstração de um clique (conta nova com o perfil semeado), Aviso inicial, os passos "Evitar sempre" e "Dosha e cidade" com o quiz, e a moldura das telas de quem entrou. Junto vem a proteção do site: CSP com nonce, headers, checagem de `Origin`, limite de demonstrações, rota da limpeza diária e o modo de E2E sem banco.

## Contexto

As entregas 1 e 2 constroem o agente sem tela e sem conta de verdade: os cenários criam a conta em memória. A 016 dá ao site tokens e componentes, mas `/` ainda é uma página de espera. Falta quem a pessoa é: sessão, conta, perfil inicial e o caminho até a Conversa.

A promessa do produto para quem visita é "primeira resposta em menos de 1 minuto, sem preencher nenhum campo" (`BUSINESS.md` §6): por isso a demonstração cria uma conta por clique, já com memória. E a proteção do site entra aqui porque as rotas que mudam estado nascem nesta spec.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Aviso na demonstração:** a conta de demonstração também passa pela tela de Aviso inicial (um toque em "Entendi, quero começar") antes da Conversa.
- **Quiz:** o cálculo e a tela das 8 perguntas entram aqui, dentro do onboarding. A 020 reaproveita em "Refazer o quiz" e faz o painel do dosha.
- **Entrada:** ilustração com corte diagonal e o logo por cima, como em `design/login-screen-reference.jpeg`. O que vale da referência é o corte e o logo; o cartão da referência (e-mail e senha) é genérico e não é o do Ritu.

## Objetivo

- Da Entrada à tela Conversa em **dois toques** pela demonstração ("Testar com perfil de demonstração" → "Entendi, quero começar"), sem digitar nada.
- Conta Google nova chega à Conversa em no máximo quatro telas (Aviso, Evitar sempre, Dosha e cidade, e o quiz se ela quiser), e conta que volta cai direto na Conversa.
- Nenhuma rota de dado responde sem sessão, e nenhuma conta lê dado de outra.
- Toda resposta do site sai com a CSP e os headers de `ARCHITECTURE.md` §4; todo pedido que muda estado com `Origin` de fora recebe `403`.
- A 6ª demonstração do dia no mesmo IP e a 31ª do dia no site são recusadas, com uma frase na Entrada.
- As specs 018 a 020 escrevem E2E com login de demonstração sem Postgres, sem rede e sem chave.

## Escopo

- **Dentro:**
  - Auth.js (`next-auth` v5): Google e o provedor `demo`; sessão em JWT só com o id da conta.
  - `entrarComGoogle`, `criarDemonstracao` e a cópia do perfil semeado; `seed/demo.yaml`, com schema e validação contra a base.
  - Porta `UsageLimiter`, tabela `limites`, limite de demonstrações por IP (HMAC) e teto global.
  - `src/proxy.ts`: CSP com nonce, headers de segurança e checagem de `Origin`.
  - Apoio das rotas (`criarRota`): sessão → conta, corpo em zod com tamanho máximo, erro sem detalhe interno.
  - Rotas: Aviso, Evitar sempre, Dosha e cidade, quiz, busca de cidade, busca de alimento, limpeza diária (`CRON_SECRET`).
  - Funções puras: `proximoPasso`, `calcularQuiz`, `prakritiDeclarada`, `nomeDoDosha`, `montarCsp`, `origemValida`, `estadoDaEntrada`.
  - Telas: Entrada, Aviso inicial, Evitar sempre, Dosha e cidade, Quiz (perguntas e resultado).
  - Moldura de quem entrou (`(app)/layout.tsx`): cabeçalho com logo e menu "Sair", faixa de demonstração com "Criar meu perfil", e a página `/conversa` só com a moldura.
  - Modo de E2E (`RITU_MODO=e2e`): stores, limitador e cidades em memória.
  - Evals determinísticos de segurança da entrega 3 e E2E da entrada.
- **Fora:**
  - Conteúdo da Conversa (mensagens, caixa, etapas, uso da mensagem sugerida) e as abas de navegação: 018 e 019.
  - Rotas de toque, `/api/runs` e o streaming: 018 e 019.
  - Perfil (trocar dosha, cidade, evitar sempre, apagar meus dados), "Refazer o quiz", painel do dosha, "O que sei sobre você" e onde o seletor de tema aparece: 020.
  - Limite de mensagens e de toques por conta e por IP, testers (`TESTER_IDS`) e telas de cota esgotada: 021.
  - Agendamento do cron na Vercel, detecção de padrões no cron, Google com a URL de produção, HSTS conferido em produção: 022.
  - Tela Sobre com a política de privacidade e a Entrada pública com mais texto: 024.
  - Levar os dados da demonstração para a conta Google: o produto não faz. "Criar meu perfil" começa uma conta nova.

## Necessidade de negócio

Quem avalia o projeto precisa ver memória e personalização funcionando no primeiro minuto, sem cadastro; a demonstração de um clique é o que entrega isso. Quem fica precisa confiar: o aviso de que não é orientação médica e de que as mensagens passam por um serviço de IA vem antes da primeira mensagem, para todas as contas. E o passo "Evitar sempre" vem antes da primeira resposta porque é o filtro mais rígido do produto. Os limites de demonstração protegem a cota gratuita de IA, que é o recurso mais escasso do Ritu.

## Critérios de aceite

- [ ] **Demonstração em dois toques:** na Entrada, "Testar com perfil de demonstração" cria a conta, e a pessoa vê o Aviso inicial; "Entendi, quero começar" leva a `/conversa`, com a faixa de demonstração (E2E, só com cliques e só com teclado).
- [ ] **Perfil semeado copiado:** logo depois de `criarDemonstracao`, a conta tem prakriti Vata-Pitta, cidade Rio de Janeiro, "castanhas" em evitar sempre, itens confirmados e incertos em casa, gostos, resultados, cardamomo com falta em 3 dias, notas de rotina com resumo, um padrão `candidato`, conversas de dias anteriores e retornos aguardando (eval com os stores em memória).
- [ ] **Demonstrações isoladas:** duas demonstrações criadas em seguida não leem casa, mensagens, runs, retornos nem rotina uma da outra.
- [ ] **Demonstração vence:** conta de demonstração com mais de 24 h some em `accounts.buscar`, é apagada por `executarLimpeza`, e quem ainda tem o cookie volta à Entrada com "Sua demonstração expirou. Você pode abrir outra."
- [ ] **Limite por IP:** a 6ª demonstração do dia com o mesmo IP é recusada sem criar conta, e a Entrada mostra a frase do limite (eval e E2E).
- [ ] **Teto global:** a 31ª demonstração do dia é recusada; com o teto atingido, a Entrada não mostra o botão da demonstração e mostra a frase do teto (eval).
- [ ] **IP em HMAC:** a tabela `limites` nunca guarda IP; a chave leva o HMAC-SHA256 do IP com `IP_HMAC_SECRET`.
- [ ] **Google opcional:** sem `AUTH_GOOGLE_ID` ou `AUTH_GOOGLE_SECRET`, a Entrada não mostra "Entrar com Google" nem "Criar meu perfil", e o site funciona só com a demonstração.
- [ ] **Google:** o primeiro login cria a conta com `google_sub` e e-mail; o segundo acha a mesma conta. O token da sessão leva só `contaId` e `tipo` (teste confere que não há nome, e-mail nem foto).
- [ ] **Onboarding da conta nova:** conta Google nova passa por Aviso → Evitar sempre → Dosha e cidade → Conversa; quem recarrega no meio volta ao passo em que estava; quem já terminou e abre `/comecar/...` vai para `/conversa`.
- [ ] **Evitar sempre:** "Pronto" grava os itens tocados (grupo, alimento da base ou texto livre) e `evitar_passo = pronto`; "Nenhum" e "Pular" gravam `nenhum` e `pulou` sem itens. "Pronto" sem item fica com `aria-disabled`.
- [ ] **Dosha declarado:** um dosha grava `{ <dosha>: 1 }`; "Misto" com dois grava `0,5` para cada; origem `declarado`. "Agora não" grava `dosha_adiado_em`. A cidade é opcional e grava nome, coordenadas com duas casas e fuso.
- [ ] **Quiz:** as 8 respostas viram proporções que somam 1; o resultado é dual quando a diferença entre os dois primeiros é de até 1 resposta; a tela de resultado mostra o nome ("Vata-Pitta") e o resumo de cada dosha da base; origem `quiz`.
- [ ] **Sem sessão:** toda rota de `/api/` desta spec, menos `/api/auth/*` e `/api/cron/*`, responde `401 { "erro": "sem_sessao" }` sem sessão ou com conta vencida; toda página de `(app)` e de `(comecar)` redireciona para `/`.
- [ ] **Origin:** `POST` com `Origin` de outro site, ou sem `Origin`, recebe `403` antes de chegar à rota (eval da função e E2E no servidor).
- [ ] **Headers:** `/`, `/marca`, `/conversa` e uma rota de `/api/` respondem com `Content-Security-Policy` (nonce novo a cada pedido, sem `unsafe-inline` em `script-src`, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy` (E2E); nenhuma violação de CSP no console em nenhuma tela desta spec nem em `/marca`.
- [ ] **Cron:** `GET /api/cron/limpeza` sem `Authorization: Bearer <CRON_SECRET>` responde `401`; com ele, roda a limpeza e devolve as contagens.
- [ ] **Entrada como a referência:** no desktop, ilustração à esquerda com corte diagonal, logo sobre o fundo ao lado do corte e cartão à direita; no celular, ilustração no topo com o corte diagonal embaixo, logo no canto livre e o cartão abaixo. Screenshots nos dois temas e nos dois tamanhos para a dona conferir.
- [ ] **Acessibilidade:** Entrada, Aviso, Evitar sempre, Dosha e cidade, Quiz, resultado do quiz e `/conversa` passam em `expectSemViolacoes` nos dois temas, em `celular` e `desktop`.
- [ ] **Modo E2E:** com `RITU_MODO=e2e`, `npm run test:e2e` roda sem Postgres, sem rede e sem chave; com `VERCEL_ENV=production`, o modo é recusado na criação do container.
- [ ] `e2e/smoke.spec.ts` atualizado para a Entrada (nome e aviso continuam visíveis). Gates 1 a 6 verdes, `npm run dup` limpo e `test:db` verde com a tabela `limites` e o `semear` da casa.

## O que fazer

- Conferir a API do `next-auth` v5, do `proxy.ts` e da CSP com nonce na versão instalada (`node_modules/next/dist/docs/` e os tipos do pacote) antes de escrever.
- Escrever primeiro as funções puras e os testes delas; depois os serviços com os stores em memória; por último as rotas e as telas.
- Fazer a cópia do perfil semeado numa transação só (`Transactor`): conta e perfil completos, ou nada.
- Consumir o limite de demonstração antes de criar a conta, as duas chaves juntas (IP e global) ou nenhuma.
- Validar `seed/demo.yaml` com zod e contra a base no `npm test` e no `npm run base:check`.
- Usar só os componentes base da 016 nas telas; carregar `frontend-design` antes e `web-design-guidelines` antes de entregar.
- Gerar `public/marca/entrada.webp` a partir de `design/login-cover.jpeg` (1600 px de largura, até 250 KB).
- Registrar no mapa dos evals (`evals/det/mapa.ts`) os arquivos novos nas linhas de "Segurança e privacidade".
- Atualizar os docs e escrever a ADR no fechamento.

## O que não fazer

- Não guardar nome, foto nem token do Google; não pôr e-mail na sessão, em log, span ou métrica.
- Não guardar IP em claro em lugar nenhum.
- Não perguntar o motivo de um "evitar sempre" nem usar a palavra "alergia" nas telas.
- Não deixar a demonstração pular o Aviso inicial; não mostrar a ela os passos Evitar sempre e Dosha (o perfil semeado já traz).
- Não criar script inline sem nonce; não relaxar a CSP para uma tela funcionar (é bloqueio a relatar).
- Não importar `next-auth` fora de `src/infra/auth/`, nem `@/infra/**` em `src/app/**` além do que os contratos liberam.
- Não chamar modelo, Open-Meteo de verdade nem Postgres em `npm test`, `eval:det` ou `test:e2e`.
- Não ligar o modo de E2E por nenhum caminho que não seja a variável `RITU_MODO`.
- Não construir a caixa de mensagem, as abas nem o Perfil.
- Não editar os arquivos de `design/`.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Aviso na demonstração | Passa pela tela de Aviso inicial (dona) | O aviso médico e o do provedor de IA valem para toda conta antes da primeira mensagem |
| Onde fica o quiz | Cálculo e tela nesta spec (dona) | O onboarding oferece "Fazer o quiz"; sem ele o botão não levaria a lugar nenhum |
| Layout da Entrada | Corte diagonal na ilustração e logo por cima, como a referência; cartão próprio do Ritu (dona) | A referência define o corte e o logo; o conteúdo do cartão é a demonstração e o Google |
| Biblioteca de sessão | `next-auth` v5 (hoje `5.0.0-beta.32`), versão exata, sem `^` | `ARCHITECTURE.md` §2. A v5 ainda é beta: a versão fica fixa e a troca é tarefa consciente |
| Sessão | JWT em cookie `httpOnly`, `SameSite=Lax`, 30 dias; token só com `contaId` e `tipo` | Sem tabela de sessão; a conta é conferida no banco a cada pedido |
| Demonstração | Provedor de credenciais `demo`, sem campos; `authorize` consome o limite e cria a conta | Um caminho só de sessão para os dois tipos de conta |
| Aceite do aviso | `contas.aviso_aceito_em`, gravado no toque, para Google e demonstração | Coluna da 004 |
| Passo "Dosha e cidade" concluído | `perfis.prakriti` preenchida ou `contas.dosha_adiado_em` preenchido | Sem coluna nova; a cidade é opcional e não segura o passo |
| Resultado dual do quiz | Diferença de até 1 resposta entre os dois primeiros (`config.quiz.diferencaDual`) | "Quando os dois primeiros ficam próximos" (`BUSINESS.md` §13), com número ajustável |
| Prakriti do quiz | Proporção das 8 respostas, com os três doshas | `KNOWLEDGE.md`: o dual pesa pela proporção do quiz |
| Limites | Porta `UsageLimiter` genérica (chave, janela, início, teto) sobre a tabela `limites` | A 021 usa a mesma porta para mensagens e toques |
| Dia do limite | Dia local no fuso padrão (`clima.fusoPadrao`) | O mesmo corte da limpeza diária |
| IP | Primeiro endereço de `x-forwarded-for`; sem header, `"desconhecido"`; sempre em HMAC | A Vercel preenche o header; sem ele todos dividem um contador, que é o lado conservador |
| Checagem de `Origin` | No `proxy.ts`, para todo método que não seja `GET`, `HEAD` ou `OPTIONS`: o host do `Origin` tem que ser o host do pedido | Um lugar só cobre rotas, ações de servidor e `/api/auth/*`; funciona em URL de preview |
| Mutações | Rotas `POST /api/...` com JSON e zod; entrar e sair são ações de servidor (idioma do Auth.js) | "A tela só chama rotas do servidor"; `signIn` precisa rodar no servidor |
| "Criar meu perfil" | Chama `signIn("google")` direto; a conta de demonstração fica para trás e vence sozinha | `BUSINESS.md` §6; nada é migrado |
| Perfil semeado | `seed/demo.yaml`, validado com zod e contra a base; datas relativas (`dias_atras`) | A cópia acontece em qualquer dia e o perfil tem que parecer recente |
| Runs semeados | Runs `done` com `momento` e `saida` completos, sem etapas | `historico.recente` e a detecção de padrões leem isso; rastro inventado seria mentira no "Como pensei" |
| Casa com data antiga | `PantryStore.semear`, método novo com `confirmado_em` explícito | `registrar` sempre confirma agora; a demonstração precisa de itens incertos |
| E2E sem banco | `RITU_MODO=e2e`: stores, limitador e cidades em memória, guardados em `globalThis`; recusado em produção | O gate 6 roda na CI sem Postgres; o login acontece no servidor e não dá para simular pelo navegador |
| Isolamento no E2E | No modo e2e, o header `x-ritu-e2e` entra como IP e como prefixo das chaves do limitador | Testes em paralelo não disputam o limite de 5 por IP nem o teto de 30 |
| `/conversa` nesta spec | Página só com a moldura e um bloco de estado vazio | É o destino do login; a 018 troca o conteúdo |

## Contratos

### Cria

**Pacotes**

| Pacote | Tipo | Versão |
|---|---|---|
| `next-auth` | prod | exata (`5.0.0-beta.32` ou a v5 atual, sem `^`) |

**Variável de ambiente** (entra em `ENV_VARS` e no `.env.example`)

| Variável | Entrega | Obrigatória | Para quê |
|---|---|---|---|
| `RITU_MODO` | 3 | Não | `e2e`: stores em memória para o Playwright. Recusada em produção |

`AUTH_SECRET`, `IP_HMAC_SECRET`, `CRON_SECRET`, `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` já estão no catálogo (001) e passam a ser lidas aqui.

**Configuração**

```ts
// config/limites.ts (incluída em config/index.ts como `limites`)
export const limites = {
  demo: { porIpPorDia: 5, globalPorDia: 30, duracaoHoras: 24 },
  sessao: { dias: 30 },
  corpoMaximoBytes: 16_384,
  evitar: { maxItens: 20, textoLivreCaracteres: 40 },
  buscaDeAlimento: { minimoCaracteres: 2, maximoResultados: 8 },
} as const
// config/quiz.ts (incluída como `quiz`)
export const quiz = { diferencaDual: 1 } as const
```

**Tabela** (`db/migrations/NNNN_limites.sql`, com o próximo número livre)

| Tabela | Colunas |
|---|---|
| `limites` | `chave text`, `janela text` (minuto, dia), `inicio text`, `total int`; pk (`chave`, `janela`, `inicio`) |

Chaves desta spec: `demo:global` e `demo:ip:<hmac>`. `inicio` da janela `dia` é o dia local (`AAAA-MM-DD`) no fuso padrão.

**Porta `UsageLimiter` (`src/core/limits/ports.ts`)**

```ts
export type Janela = "minuto" | "dia"
export interface UsageLimiter {
  // Soma 1 em todas as chaves, ou em nenhuma: se alguma já está no teto, devolve a primeira que barrou.
  consumir(pedidos: { chave: string; teto: number }[], janela: Janela, inicio: string): Promise<{ ok: true } | { ok: false; chave: string }>
  usado(chave: string, janela: Janela, inicio: string): Promise<number>
  apagarAntesDe(inicio: string): Promise<number>     // linhas da janela "dia" com início menor
}
```

- Adaptador `src/infra/db/limits.ts` (uma transação por `consumir`); fake `createMemoryLimiter()` em `src/infra/fakes/memory-limiter.ts`; suíte `test/contracts/limits.contract.ts` contra os dois.
- `Container` ganha `limiter: UsageLimiter` e `demoSeed: DemoSeed` (carregado na primeira leitura).
- `executarLimpeza` recebe `limiter` e apaga os limites de antes de ontem; `ResultadoLimpeza` ganha `limites: number`.

**`PantryStore` (004) ganha**

```ts
semear(contaId: string, itens: { alimento_id?: string; nome_livre?: string; confirmado_em: Date; sempre_tenho?: boolean }[]): Promise<void>
// estado "tem", origem "tela"; não apaga faltas nem mexe na lista. Coberto pela suíte de contrato da casa.
```

**Perfil semeado (`src/core/accounts/demo-seed.ts` e `seed/demo.yaml`)**

```ts
export const demoSeedSchema = z.strictObject({
  faixa: z.string().max(140),                       // texto da faixa de demonstração
  mensagem_sugerida: z.string().max(200),
  perfil: z.strictObject({
    prakriti: prakritiSchema, cidade: cidadeDaPessoaSchema,
    evitar_sempre: z.array(evitarItemSchema), restricoes: z.array(restricaoSchema),
    nao_come: z.array(z.strictObject({ tipo: z.enum(["alimento", "texto"]), valor: z.string() })),
  }),
  casa: z.array(z.strictObject({ alimento_id: z.string(), dias_atras: z.number().int().min(0), sempre_tenho: z.boolean().optional() })),
  preferencias: z.array(z.strictObject({
    tipo: z.enum(["alimento", "pratica", "preparo"]), id: z.string(),
    gosto: z.enum(["gosta", "nao_gosta"]).optional(),
    ajudou: z.number().int().min(0).optional(), nao_ajudou: z.number().int().min(0).optional(), nao_fez: z.number().int().min(0).optional(),
  })),
  faltas: z.array(z.strictObject({ alimento_id: z.string(), dias_atras: z.number().int().min(1).max(29) })),
  rotina: z.array(z.string().max(200)).max(5),
  padrao: z.strictObject({ estados: z.array(estadoSchema).min(1).max(2), item: z.strictObject({ tipo: z.enum(["pratica", "preparo"]), id: z.string() }), ocorrencias: z.number().int().min(3) }),
  historico: z.array(z.strictObject({
    dias_atras: z.number().int().min(1).max(6),
    mensagem: z.string().max(1000),
    estados: z.array(estadoSchema), momento_do_dia: momentoDoDiaSchema, gunas_buscadas: z.array(gunaSchema),
    saida: saidaDoAcompanhanteSchema,               // a resposta é saida.resposta
    resultados: z.array(z.enum(["ajudou", "nao_ajudou", "nao_fez", "aguardando"])),   // um por sugestão de saida.sugestoes
  })).min(3).max(6),
})
export type DemoSeed = z.infer<typeof demoSeedSchema>
export function validarSeed(seed: DemoSeed, kb: KnowledgeBase, agora: Date): string[]     // erros; vazio = válido
```

`validarSeed` confere: todo id existe na base; nenhum item de casa, preferência, falta ou sugestão bate em `evitar_sempre` (`passaNoFiltro`); `resultados` tem o tamanho de `saida.sugestoes`; com as durabilidades da base, a casa tem de 5 a 12 itens confirmados e de 2 a 4 incertos; algum alimento tem falta em 3 dias diferentes ou mais; pelo menos 2 retornos `aguardando`; pelo menos 3 conversas do histórico têm todos os `padrao.estados` e o `padrao.item` com `ajudou`; nenhuma `mensagem` nem `saida.resposta` contém palavra de incômodo (`contemIncomodo`, 012); nenhum texto contém `<` ou `>`.

Leitor: `src/infra/knowledge/yaml-seed.ts` (`loadDemoSeed(dir?)`: lê, valida o schema e lança `KnowledgeInvalidError`). `next.config.ts` inclui `./seed/**/*` em `outputFileTracingIncludes`. `npm run base:check` passa a rodar `validarSeed` e imprime `seed: ok` ou os erros.

Conteúdo de `seed/demo.yaml` (o redator escreve as frases; os fatos são estes):

| Parte | Conteúdo |
|---|---|
| `faixa` | "Você está no perfil de demonstração: Vata-Pitta, no Rio, com gengibre, canela, abóbora e arroz em casa" |
| `mensagem_sugerida` | "acordei com frio e agitada, o que eu como?" |
| `perfil` | Prakriti `{ vata: 0.45, pitta: 0.45, kapha: 0.1 }`; Rio de Janeiro (`-22.91`, `-43.21`, `America/Sao_Paulo`); evitar sempre: grupo `castanhas`; sem restrição e sem "não como" |
| `casa` | Confirmados: `gengibre`, `abobora`, `arroz-branco` (sempre tenho), `canela` (sempre tenho), `ghee`, `cominho`, `erva-doce`, `limao`, `aveia`. Incertos (com `dias_atras` acima da validade do grupo): `couve`, `banana`, `leite` |
| `preferencias` | Gosta: `canela`, `abobora`. Não gosta: `quiabo`. `cha-gengibre-canela`: ajudou 3. `escalda-pes-morno`: ajudou 1. `cha-camomila`: não ajudou 1 |
| `faltas` | `cardamomo`, há 1, 2 e 3 dias |
| `rotina` | "Almoça fora durante a semana" · "Acorda às 5 h às terças" · "Janta tarde, depois das 21 h" |
| `padrao` | Estados `com_frio` e `agitada`; item prática `cha-gengibre-canela`; 3 ocorrências |
| `historico` | Há 6, 4 e 2 dias: mensagem com frio e agitação, resposta com `cha-gengibre-canela`, resultado `ajudou`. Ontem: mensagem de fim de dia, resposta com duas sugestões (`escalda-pes-morno` e um preparo com `abobora` e `arroz-branco`), as duas `aguardando` |

**Serviços de conta (`src/core/accounts/`)**

```ts
// entrar.ts
export function entrarComGoogle(deps: { stores: Stores; telemetry: Telemetry }, dados: { sub: string; email: string }): Promise<Conta>
// buscarPorGoogleSub; sem conta, cria (tipo google). Conta `ritu_entrada_total` com resultado "nova" ou "retorno".

export class LimiteDeDemonstracaoError extends RituError {}     // code: "demo_limite_ip" | "demo_limite_global"
export function criarDemonstracao(
  deps: { tx: Transactor; limiter: UsageLimiter; clock: Clock; kb: KnowledgeBase; seed: DemoSeed; telemetry: Telemetry },
  dados: { ipHash: string; escopo?: string },                    // escopo: só no modo e2e, prefixo das chaves
): Promise<Conta>
// 1. limiter.consumir([{ demo:ip:<ipHash>, porIpPorDia }, { demo:global, globalPorDia }], "dia", hoje). Barrou: lança o erro da chave.
// 2. tx.emTransacao: accounts.criar({ tipo: "demo", expira_em: agora + duracaoHoras }) → copiarSeed → accounts.marcar({ evitar_passo: "pronto" }).
// 3. Conta `ritu_entrada_total` (tipo demo; resultado nova, limite_ip ou limite_global).

// copiar-seed.ts
export function copiarSeed(stores: Stores, contaId: string, seed: DemoSeed, deps: { clock: Clock; kb: KnowledgeBase }): Promise<void>
```

`copiarSeed`, na ordem: `profiles.definirPrakriti(…, "quiz")`, `definirCidade`, `acrescentarEvitarSempre`, `definirRestricoes`, `definirNaoCome` → `pantry.semear` (`confirmado_em = agora − dias_atras`) → `preferences.definirGosto` e `contarResultado` (uma chamada por unidade do contador) → `shortages.registrar` (origem `teria_entrado`, dia = `diasAtras(hoje, n)`) → `routine.anotar` de cada nota e `routine.gravarResumo(resumoPorCodigo(notas))` (012) → para cada conversa do histórico, da mais antiga para a mais nova: `runs.criar` (caminho `acompanhante`, intenções `["momento"]`, dia) e `runs.atualizar` (`status: "done"`, `momento`, `saida`, `prompt_versao: "semente"`, `juiz_aprovado: true`), `messages.gravar` da pessoa e do agente, `outcomes.criar` com `saida.sugestoes.map(sugestaoRegistrada)` (011) e `outcomes.responder(…, "toque")` nos que não estão `aguardando` → `patterns.propor` com `chaveDeAjuda` e `fraseDeAjuda` (012; o título é o da sugestão do retorno mais recente). `hoje` é o dia local no fuso da cidade do seed. Nenhuma telemetria de retorno, gosto ou falta é contada na cópia.

**Onboarding (`src/core/accounts/onboarding.ts`)**

```ts
export type Passo = "aviso" | "evitar" | "dosha" | "pronto"
export function proximoPasso(conta: Conta, perfil: Perfil): Passo
// aviso_aceito_em nulo → "aviso"; evitar_passo nulo → "evitar"; prakriti nula e dosha_adiado_em nulo → "dosha"; senão "pronto".
export const ROTA_DO_PASSO: Record<Passo, string>     // aviso → /comecar/aviso, evitar → /comecar/evitar, dosha → /comecar/dosha, pronto → /conversa
```

**Quiz e dosha (`src/core/accounts/dosha.ts`)**

```ts
export type ResultadoDoQuiz = { prakriti: Prakriti; doshas: Dosha[]; dual: boolean }     // doshas: 1 ou 2, o maior primeiro
export function calcularQuiz(respostas: Dosha[]): ResultadoDoQuiz
// Conta por dosha; prakriti = contagem / total, com os três. Ordena por contagem e, no empate, vata, pitta, kapha.
// dual quando primeiro − segundo ≤ config.quiz.diferencaDual e o segundo > 0.
export function prakritiDeclarada(doshas: Dosha[]): Prakriti       // 1 dosha → { d: 1 }; 2 → 0.5 cada; outro tamanho ou repetido: lança RituError("dosha_invalido")
export function nomeDoDosha(prakriti: Prakriti, kb: KnowledgeBase): string
// "Vata", ou "Vata-Pitta" quando o segundo tem pelo menos 0.3 e a diferença para o primeiro é de até 0.15. Usa o `nome` de data/doshas.yaml.
```

**Proteção (`src/core/security/`)**

```ts
// csp.ts
export function montarCsp(p: { nonce: string; dev: boolean }): string
export function headersDeSeguranca(p: { nonce: string; dev: boolean; https: boolean }): Record<string, string>
// origem.ts
export function origemValida(p: { metodo: string; origin: string | null; host: string | null }): boolean
// GET, HEAD e OPTIONS: sempre true. Demais: origin presente, URL válida e `new URL(origin).host === host`.
```

CSP: `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'` (mais `'unsafe-eval'` só com `dev`)`; style-src 'self' 'nonce-<n>'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. O `style-src-attr` é o que as sobreposições do React Aria pedem (016). Demais headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` e, com `https`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`.

**`src/proxy.ts`** (nome do Next 16; em todas as rotas, menos `_next/static`, `_next/image` e arquivos de `public/`)

1. `host` = `x-forwarded-host` ou `host`. `origemValida` falso → `403 { "erro": "origem_invalida" }`, já com os headers.
2. Gera o nonce (16 bytes, base64), passa adiante em `x-nonce` e na CSP do pedido, e põe os headers de `headersDeSeguranca` na resposta.
3. Não lê sessão nem banco.

**Sessão (`src/infra/auth/`)**

- `next.ts`: único arquivo que importa `next-auth`. Exporta `handlers`, `auth`, `signIn`, `signOut` e `googleDisponivel(): boolean`. Config: `session: { strategy: "jwt", maxAge: 30 dias }`, `trustHost: true`, `pages: { signIn: "/", error: "/" }`. Google (escopo `openid email`) só com as duas variáveis; recusa perfil sem `sub` ou com `email_verified` falso. Provedor de credenciais `demo`, sem campos: `authorize(_, request)` calcula o `ipHash` e chama `criarDemonstracao`; `LimiteDeDemonstracaoError` vira um `CredentialsSignin` com `code` igual ao do erro. `jwt`: no login grava `contaId` e `tipo` e apaga `name`, `email` e `picture`. `session`: expõe `contaId` e `tipo`.
- `ip.ts`: `ipDoPedido(headers: Headers, modoE2e: boolean): string` (primeiro de `x-forwarded-for`; no modo e2e, `x-ritu-e2e` quando presente; sem nada, `"desconhecido"`) e `hashDoIp(ip: string, segredo: string): string` (HMAC-SHA256, hexadecimal, 32 primeiros caracteres).
- **Teste de arquitetura:** R3 passa a liberar `@/infra/auth/next` em `src/app/**`. `src/proxy.ts` só importa de `@/core/security/`.

**Apoio das telas e das rotas (`src/app/_lib/`)**

```ts
// conta.ts
export function contaAtual(): Promise<{ conta: Conta; perfil: Perfil } | undefined>     // auth() → accounts.buscar → profiles.ler
export function exigirPasso(passo: Passo): Promise<{ conta: Conta; perfil: Perfil }>
// Sem conta: redirect("/"), com ?aviso=demo_expirou quando o token é de demonstração. Passo diferente do atual: redirect(ROTA_DO_PASSO[atual]).

// rota.ts
export type DepsDaRota = { contaDaSessao(): Promise<string | undefined>; container: Container }
export function criarRota<B, R>(deps: DepsDaRota, opts: { corpo?: z.ZodType<B> }, fn: (ctx: { conta: Conta; corpo: B; request: Request; container: Container }) => Promise<R>): (request: Request) => Promise<Response>
```

`criarRota`: sem sessão ou conta inexistente → `401 { erro: "sem_sessao" }`; corpo acima de `corpoMaximoBytes` → `413 { erro: "corpo_grande" }`; JSON ou schema inválido → `400 { erro: "corpo_invalido" }`; `RituError` conhecido → `400` ou `409` com `{ erro: <code> }`; qualquer outro erro → `500 { erro: "erro_inesperado" }` e log `erro_inesperado`, sem mensagem interna. Resposta de sucesso: `200` com o JSON de `fn`. Os arquivos `route.ts` chamam `criarRota` com as dependências reais; os evals, com os stores em memória.

**Rotas**

| Rota | Corpo ou consulta | Faz | Resposta |
|---|---|---|---|
| `GET, POST /api/auth/[...nextauth]` | — | `handlers` do Auth.js | — |
| `POST /api/onboarding/aviso` | `{}` | `accounts.marcar({ aviso_aceito_em: agora })` | `{ proximo }` |
| `POST /api/onboarding/evitar` | `{ passo: "pronto"; itens: EvitarItem[] }` (1 a 20; `texto` com até 40 caracteres; `grupo` e `alimento` existem na base) ou `{ passo: "nenhum" \| "pulou" }` | `profiles.acrescentarEvitarSempre` e `accounts.marcar({ evitar_passo })` | `{ proximo }` |
| `POST /api/onboarding/perfil` | `{ dosha: "quiz" \| "adiado" \| Dosha[]; cidade: CidadeDaPessoa \| null }` (latitude de −90 a 90, longitude de −180 a 180, fuso aceito por `Intl.DateTimeFormat`, nome com até 80 caracteres) | Grava a cidade, se veio. Lista: `definirPrakriti(prakritiDeclarada(…), "declarado")`. `adiado`: `marcar({ dosha_adiado_em })`. `quiz`: não marca nada | `{ proximo }` (`/comecar/quiz` quando `quiz`) |
| `POST /api/onboarding/quiz` | `{ respostas: { pergunta_id: string; dosha: Dosha }[] }` (uma por pergunta de `kb.quiz`, todas) | `calcularQuiz` e `definirPrakriti(…, "quiz")` | `{ nome, doshas, dual }` |
| `GET /api/cidades?q=` | `q` com 2 a 60 caracteres | `cities.buscar(q)`; `CityLookupUnavailableError` → `503 { erro: "cidades_indisponivel" }` | `{ cidades: Cidade[] }` |
| `GET /api/alimentos?q=` | `q` com 2 a 40 caracteres | Alimentos da base cujo nome normalizado contém `q` normalizado, por ordem alfabética, até 8 | `{ alimentos: { id, nome }[] }` |
| `GET /api/cron/limpeza` | `Authorization: Bearer <CRON_SECRET>` (comparação em tempo constante) | `executarLimpeza` | `ResultadoLimpeza`; sem o header certo, `401` |

`proximo` é `ROTA_DO_PASSO[proximoPasso(conta, perfil)]`, lido depois da gravação. As rotas de onboarding aceitam ser chamadas de novo sem erro (gravam o mesmo estado). Todas as rotas com conta passam por `criarRota`.

**Ações de servidor (`src/app/_acoes/sessao.ts`)**

```ts
export async function entrarNaDemonstracao(): Promise<void>     // signIn("demo", { redirectTo: "/comecar/aviso" }); limite → redirect("/?aviso=<code>")
export async function entrarComGoogleAcao(): Promise<void>      // signIn("google", { redirectTo: "/conversa" })
export async function sair(): Promise<void>                     // signOut({ redirectTo: "/" })
```

**Entrada (`src/core/accounts/entrada.ts`)**

```ts
export type AvisoDaEntrada = "demo_limite_ip" | "demo_limite_global" | "demo_expirou" | "erro_google"
export function estadoDaEntrada(p: { google: boolean; demosHoje: number; tetoGlobal: number; aviso?: string }): { demo: boolean; google: boolean; aviso?: AvisoDaEntrada }
// demo = demosHoje < tetoGlobal; teto atingido força aviso "demo_limite_global"; aviso desconhecido é ignorado; erro do Auth.js (?error=) vira "erro_google".
```

**Textos (`config/textos-entrada.ts`, incluídos como `textosEntrada`)**

| Chave | Texto |
|---|---|
| `entrada.titulo` | Entrar |
| `entrada.subtitulo` | Que bom ter você aqui |
| `entrada.oQueE` | Um agente ayurvédico para o seu momento. Conte como você está e o que tem em casa, e receba um chá, uma refeição simples ou uma prática para agora. |
| `entrada.aviso` | Projeto de estudo. Não é orientação médica. |
| `entrada.demo` | Testar com perfil de demonstração |
| `entrada.demoApoio` | Sem cadastro. Você entra com um perfil pronto, que expira em 24 horas. |
| `entrada.google` | Entrar com Google |
| `entrada.googleApoio` | Seu perfil e sua memória ficam salvos. O e-mail serve só para entrar. |
| `aviso.demo_limite_ip` | Você já abriu 5 demonstrações hoje. Entre com Google ou volte amanhã. |
| `aviso.demo_limite_global` | As demonstrações de hoje acabaram. Entre com Google ou volte amanhã. |
| `aviso.demo_expirou` | Sua demonstração expirou. Você pode abrir outra. |
| `aviso.erro_google` | Não consegui entrar com o Google agora. Tente de novo. |
| `avisoInicial.titulo` | Antes de começar |
| `avisoInicial.saude` | **Não é orientação médica.** O Ritu sugere conforto com alimentos, ervas de cozinha, óleos comuns e práticas leves. Ele não diagnostica, não trata e não substitui um profissional de saúde. |
| `avisoInicial.ia` | **Suas mensagens passam por um serviço de IA.** O Ritu usa o Gemini, do Google, no plano gratuito. Nesse plano, o Google pode usar as mensagens para melhorar os produtos dele. Não escreva o que você não quer compartilhar. |
| `avisoInicial.memoria` | **Você vê e apaga o que o Ritu guarda.** Tudo o que ele anota aparece em "O que sei sobre você", e você pode apagar seus dados quando quiser. |
| `avisoInicial.demo` | Esta demonstração expira em 24 horas e depois é apagada. |
| `avisoInicial.botao` | Entendi, quero começar |
| `evitar.titulo` | Tem algum alimento que você nunca pode comer? |
| `evitar.apoio` | O Ritu nunca vai sugerir o que estiver aqui, nem em chá, refeição ou óleo. Não precisa dizer o motivo. |
| `evitar.botoes` | Pronto · Nenhum · Pular |
| `dosha.titulo` | Quer descobrir seu dosha? |
| `dosha.apoio` | Dosha é o seu jeito de base, na Ayurveda. Com ele, o Ritu acerta mais. Sem ele, responde com o seu momento e o clima. |
| `dosha.opcoes` | Fazer o quiz · Já sei meu dosha · Agora não |
| `cidade.titulo` | Em que cidade você está? |
| `cidade.apoio` | O Ritu olha o clima da sua cidade na hora de sugerir. Ele nunca usa a localização do aparelho. Você pode pular. |
| `quiz.progresso` | Pergunta {n} de 8 |
| `quiz.resultado` | Seu dosha é {nome} |
| `faixa.botao` | Criar meu perfil |
| `conversa.vazia` | A conversa começa aqui. |

O negrito das três frases do Aviso é marcação do componente (`<strong>`), não texto.

**Telas**

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `/` | `src/app/page.tsx` | Entrada. Com conta válida: redireciona para `ROTA_DO_PASSO`. Lê `limiter.usado("demo:global", …)` e `googleDisponivel()` e monta `estadoDaEntrada` |
| `/comecar/aviso` | `src/app/(comecar)/comecar/aviso/page.tsx` | Aviso inicial: título, as três frases (e a da demonstração, quando for), botão, e o link "Sair" |
| `/comecar/evitar` | `…/evitar/page.tsx` | Grupos de `kb.gruposEvitar` em `ToggleChip`; `ComboBox` de alimento (`/api/alimentos`); campo de texto livre com "Adicionar"; os escolhidos em `TagList` removível; Pronto · Nenhum · Pular |
| `/comecar/dosha` | `…/dosha/page.tsx` | Três opções (grupo de escolha única): "Fazer o quiz", "Já sei meu dosha" (abre Vata · Pitta · Kapha · Misto; "Misto" pede dois) e "Agora não"; abaixo, a busca de cidade (`ComboBox` com `/api/cidades`, mostrando nome, região e país) com "Pular a cidade"; botão "Continuar" |
| `/comecar/quiz` | `…/quiz/page.tsx` | Uma pergunta por vez, três opções em grupo de rádio, "Voltar" e "Próxima", progresso em texto; ao fim, o resultado: `DoshaBlot` de cada dosha em `Surface tone="paper"`, o nome, o `resumo` de cada um e "Continuar" (`/conversa`). Só com `proximoPasso` igual a `dosha` |
| `/conversa` | `src/app/(app)/conversa/page.tsx` | `StateBlock kind="empty"` com `conversa.vazia` |

- `src/app/(comecar)/layout.tsx`: coluna `content` centrada, `Logo variant="full" size="sm"` no topo. Cada página chama `exigirPasso`.
- `src/app/(app)/layout.tsx`: `exigirPasso("pronto")`; `header` com `Logo` e um `Menu` (botão de ícone "Menu da conta") com o item "Sair"; em conta de demonstração, a `DemoBanner` logo abaixo; `main#conteudo`.
- `src/components/ritu/demo-banner.tsx`: `DemoBanner({ texto, podeCriarPerfil })`: faixa em `amber-soft` com o texto do seed e, com Google disponível, o botão "Criar meu perfil" (`entrarComGoogleAcao`). É texto parado, sem `role="status"`, dentro de um `aside` com `aria-label="Demonstração"`.
- Toda tela tem os estados de carregando (botão `isPending`) e de erro (`StateBlock kind="error"` ou texto de erro no campo, com nova tentativa). Erro de rede numa rota de onboarding não perde o que a pessoa escolheu.

**Entrada: layout** (referência: `design/login-screen-reference.jpeg`; imagem: `public/marca/entrada.webp`, decorativa, `alt=""`)

- **Desktop (a partir de 64rem):** a ilustração ocupa a esquerda, do topo ao pé, com 63% da largura da tela e `clip-path: polygon(0 0, 43% 0, 100% 100%, 0 100%)` (o corte desce da esquerda para a direita, como na referência). O `Logo variant="full" size="lg"` fica sobre o fundo `canvas`, centrado no meio da tela, no terço de cima, sem tocar a ilustração. O cartão fica à direita, centrado na vertical, com até 26rem.
- **Celular:** a ilustração fica no topo, com 42dvh e `clip-path: polygon(0 0, 100% 0, 100% 58%, 0 100%)`; o logo `full`, tamanho `md`, fica sobre o `canvas` no canto livre do corte (embaixo, à direita); o cartão vem abaixo, na largura da tela menos a margem.
- `object-fit: cover` com `object-position: 30% 60%`: pilão, frascos e gengibre sempre aparecem.
- **Cartão:** `Surface tone="raised" radius="lg" shadow="lift"`: `h1` "Entrar" e o subtítulo em `font-title`; `entrada.oQueE`; o botão da demonstração (`primary`, largura inteira) com o apoio; o botão do Google (`secondary`, largura inteira) com o apoio; `entrada.aviso` em `ink-muted`; o aviso do estado, quando houver, em bloco `amber-soft` com `role="status"`, acima dos botões. Sem campo de e-mail nem de senha.
- Nos dois temas a ilustração é a mesma; o fundo e o logo seguem os tokens.

**Telemetria**

- `METRICAS` ganha `ritu_entrada_total` (contador; `tipo`: google, demo; `resultado`: nova, retorno, limite_ip, limite_global).
- Nenhum span novo. Nenhum log novo além do `erro_inesperado` do `criarRota`. Rótulo nunca leva conta, IP nem hash.

**Modo de E2E**

- `createContainer`: com `RITU_MODO=e2e`, `stores` e `tx` vêm de `createMemoryStores`, `limiter` de `createMemoryLimiter`, `cities` de `fake-cities`, telemetria nula; a instância fica em `globalThis`. Com `VERCEL_ENV=production`, lança `RituError("modo_e2e_em_producao")`.
- `playwright.config.ts`: o `webServer` sobe com `RITU_MODO=e2e`, `AUTH_SECRET` e `IP_HMAC_SECRET` de teste (valores fixos no arquivo, que não são segredo) e sem as variáveis do Google.
- `e2e/apoio/sessao.ts`:

```ts
export const test: typeof base     // fixture: cada teste manda `x-ritu-e2e: <id único>` em todos os pedidos
export async function entrarNaDemo(page: Page): Promise<void>            // Entrada → botão da demonstração → "Entendi, quero começar" → espera /conversa
```

**Testes e evals**

- `npm test`: `proximoPasso`, `calcularQuiz` (8-0-0, 4-3-1 dual, 5-3-0 simples, 3-3-2, 4-2-2), `prakritiDeclarada`, `nomeDoDosha`, `estadoDaEntrada`, `montarCsp`, `origemValida`, `hashDoIp`, `validarSeed` com o `seed/demo.yaml` real, `copiarSeed` e `criarDemonstracao` com os stores em memória, `criarRota` (401, 400, 413, 500 sem detalhe), o callback `jwt` (token sem nome, e-mail e foto).
- `evals/det/seguranca/sessao.eval.ts`: cada rota desta spec sem sessão → `401`; conta vencida → `401`; uma conta não muda o onboarding de outra.
- `evals/det/seguranca/demonstracao.eval.ts`: duas demonstrações não se enxergam (casa, mensagens, runs, retornos, rotina, padrões); a 6ª do IP e a 31ª do dia são recusadas sem criar conta; demonstração vencida some e é apagada pela limpeza; a tabela de limites não tem IP.
- `evals/det/seguranca/origem-e-headers.eval.ts`: `origemValida` (outro site, sem `Origin`, mesmo host, `GET`); a CSP tem nonce, não tem `unsafe-inline` em `script-src` e tem `frame-ancestors 'none'`; os quatro headers.
- `evals/det/mapa.ts`: as linhas "Rota sem sessão", "Duas demonstrações", "POST com `Origin`" e a da 31ª demonstração ganham estes arquivos.
- `e2e/entrada.spec.ts`: demonstração em dois toques, só com cliques e só com teclado; limite por IP (6ª tentativa mostra a frase); sem Google, o botão não aparece; headers e nonce em `/`, `/marca`, `/conversa` e `/api/alimentos`; `POST /api/onboarding/aviso` com `Origin` de outro site → `403`; nenhuma violação de CSP no console; "Sair" volta à Entrada; axe nas telas, nos dois temas.
- `e2e/comecar.spec.ts`: o onboarding de conta nova precisa de uma conta sem perfil. No modo e2e, o provedor `demo` aceita o header `x-ritu-e2e-conta: nova` e cria a conta **sem** copiar o seed e sem marcar `evitar_passo`. Cobre: Aviso → Evitar sempre (um grupo, um alimento da busca, um texto livre; e "Nenhum") → Dosha ("Misto" com dois; "Agora não"; cidade pela busca e pulada) → Conversa; quiz completo com resultado dual; recarregar no meio; axe em cada tela.

### Usa

- **001:** `RituError`, `Clock`, `requireEnv`, `optionalEnv`, `ENV_VARS`, container, teste de arquitetura (R3, R5), Playwright, CI.
- **002:** `KnowledgeBase` (`quiz`, `doshas`, `gruposEvitar`, `alimentos`), `Dosha`, `Prakriti`, `EvitarItem`, `Restricao`, `Estado`, `Guna`, `passaNoFiltro`, `normalizar`, `KnowledgeInvalidError`, `base:check`.
- **003:** `CityLookup`, `Cidade`, `CidadeDaPessoa`, `CityLookupUnavailableError`, `clima.fusoPadrao`, `fake-cities`.
- **004:** `Conta`, `Perfil`, `Stores`, `Transactor`, `AccountRepository`, `ProfileStore`, `PantryStore`, `PreferenceStore`, `ShortageStore`, `OutcomeStore`, `RoutineStore`, `PatternStore`, `MessageRepository`, `RunRepository`, `createMemoryStores`, `diaLocal`, `diasAtras`, `executarLimpeza`, suíte de contrato.
- **007:** `saidaDoAcompanhanteSchema`.
- **011:** `sugestaoRegistrada`.
- **012:** `resumoPorCodigo`, `chaveDeAjuda`, `fraseDeAjuda`, `contemIncomodo`.
- **015:** `METRICAS`, `LOGS` (`erro_inesperado`), `Telemetry`.
- **016:** tokens, `Button`, `IconButton`, `TextField`, `ToggleChip`, `TagList`, `ComboBox`, `Menu`, `Surface`, `StateBlock`, `Spinner`, `TextLink`, `Logo`, `DoshaBlot`, layout raiz, `usarTema`, `expectSemViolacoes`.

## Evals (quando a spec toca agente, prompt, tool ou base)

A spec não toca agente, prompt nem tool. Os evals determinísticos novos são os três de `evals/det/seguranca/` descritos em "Testes e evals". Nenhum caso com LLM: o `c4-site` roda no fim da entrega 3, pelas rotas da 018.

## Nível das partes

- **nucleo** (Sonnet): `src/infra/auth/` (config do Auth.js, callbacks, provedor `demo`, `ip.ts`), `criarDemonstracao` e `copiarSeed`, `UsageLimiter` (porta, adaptador, fake e contrato), `src/proxy.ts` com `montarCsp` e `origemValida`, `criarRota`, `contaAtual` e `exigirPasso`, a rota do cron, o modo de E2E no container e as ações de servidor.
- **tela** (Sonnet): Entrada, Aviso inicial, Evitar sempre, Dosha e cidade, Quiz e resultado, `(comecar)/layout.tsx`, `(app)/layout.tsx`, `DemoBanner`, `/conversa`, `entrada.webp`, `e2e/entrada.spec.ts`, `e2e/comecar.spec.ts` e `e2e/apoio/sessao.ts`.
- **conteudo** (Opus): `seed/demo.yaml` (mensagens, respostas e motivos do histórico, notas de rotina).
- Todo o resto é `mecanica`: configuração, migração, `demoSeedSchema` e `validarSeed`, leitor do seed, `PantryStore.semear`, `proximoPasso`, quiz e dosha, `estadoDaEntrada`, textos, rotas de onboarding e de busca, métrica, evals determinísticos, mapa.

## Leitura para a construção

- `BUSINESS.md` §6 (entrada e caminho da demonstração), §12 (cuidados: o que as telas não perguntam) e §13 (onboarding).
- `ARCHITECTURE.md` §4 (autenticação, demonstração e proteção do site).
- `DESIGN.md` §3 (regras e acessibilidade), para as tarefas de tela.
- `DEVELOPMENT.md` §"UI" e §"Camadas e importações".
- `design/login-screen-reference.jpeg` e `design/login-cover.jpeg`, para a Entrada.
- Skills: `frontend-design` e `web-design-guidelines` (tela); `next-best-practices` (`file-conventions.md`, `route-handlers.md`, `rsc-boundaries.md`).
- Documentação instalada: `node_modules/next/dist/docs/` (proxy e CSP) e os tipos do `next-auth`.

## Dependências

- Specs 004 e 016 (backlog); do código da entrega 2: 007 (`saidaDoAcompanhanteSchema`), 011 (`sugestaoRegistrada`), 012 (`resumoPorCodigo`, chave e frase do padrão) e 015 (`METRICAS`). A entrega 3 só começa com a 2 fechada.
- `next-auth` v5. Nenhum outro pacote.
- `AUTH_SECRET`, `IP_HMAC_SECRET` e `CRON_SECRET` no `.env.local` (obrigatórias a partir da entrega 3). `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` são opcionais: sem o cliente OAuth do `PREPARO.md` §3, a construção segue e o Google fica para a conferência do portão 3.
- Postgres só para `db:migrate` e `test:db`.

## Riscos e trade-offs

- **`next-auth` v5 em beta:** a API pode mudar entre betas e a compatibilidade com o Next 16 precisa ser conferida na instalação. Versão exata; se a v5 não funcionar com o Next instalado, é bloqueio a relatar, não troca de biblioteca por conta própria.
- **Sessão em JWT não é revogável:** apagar a conta invalida o acesso porque toda rota confere a conta no banco, mas o cookie continua existindo até vencer.
- **Limite por IP é fraco:** rede compartilhada divide o contador e quem troca de IP escapa. O teto global é a proteção real da cota.
- **Limite consumido mesmo se a criação falhar:** o contador soma antes da transação da conta. Erro de banco "gasta" uma demonstração; é o lado conservador.
- **Demonstração com um toque a mais:** o Aviso inicial acrescenta uma tela ao caminho de "menos de 1 minuto". Escolha da dona: o aviso vale mais que o toque.
- **Runs semeados sem etapas:** o "Como pensei" de uma conversa antiga da demonstração não tem rastro. A 020 mostra o estado vazio para esses runs.
- **Perfil semeado e código da entrega 2:** `saida` segue o schema da 007 a 013. Se o schema mudar, `validarSeed` quebra no `npm test`, que é o aviso certo.
- **`style-src-attr 'unsafe-inline'`:** exigência das sobreposições do React Aria. Não libera `<style>` nem script.
- **Modo de E2E no container:** um caminho de execução que só existe para teste. Fica atrás de uma variável, é recusado em produção e tem ADR.
- **Corte diagonal com `clip-path`:** em telas muito largas ou muito baixas o logo pode se aproximar do corte. Os screenshots do fechamento são para a dona conferir os dois tamanhos.
- **Páginas dinâmicas:** nonce e cookie tornam todas as páginas dinâmicas, como a 016 já previa.

## Edge cases e modos de falha

- Dois cliques seguidos em "Testar com perfil de demonstração": o botão fica `isPending`; se dois pedidos passarem, são duas contas e dois consumos do limite, e a sessão fica com a última.
- Cookie de conta que não existe mais (demonstração vencida, conta apagada): páginas voltam à Entrada (com a frase, se era demonstração) e rotas respondem `401`. A Entrada trata a pessoa como sem sessão.
- Pessoa com sessão válida abre `/`: vai para o passo dela ou para `/conversa`.
- Google devolve erro, a pessoa cancela ou o e-mail não é verificado: volta à Entrada com `aviso.erro_google`; nenhuma conta é criada.
- Mesmo `google_sub` entrando em dois aparelhos ao mesmo tempo no primeiro login: `google_sub` é único; quem perder a corrida busca de novo e usa a conta criada.
- `seed/demo.yaml` inválido: o site sobe, mas `criarDemonstracao` falha com `erro_inesperado` e a Entrada mostra erro com nova tentativa; `npm test` e `base:check` já teriam acusado.
- Falha no meio da cópia do seed: a transação desfaz tudo; nenhuma conta de demonstração fica pela metade.
- `x-forwarded-for` ausente: IP `"desconhecido"`, um contador só para todos.
- Busca de cidade fora do ar: o campo mostra "Não consegui buscar a cidade agora." e a pessoa segue sem cidade.
- Texto livre de "evitar sempre" com `<`, `>` ou instrução embutida: é guardado como texto e mostrado como texto; a neutralização no prompt é da 013.
- Mesmo item de "evitar sempre" escolhido duas vezes (grupo e alimento do grupo, ou repetido): `acrescentarEvitarSempre` não duplica.
- Quiz enviado com pergunta faltando, repetida ou desconhecida: `400 corpo_invalido`; nada é gravado.
- Pessoa sai do quiz no meio: nada é gravado; ela continua no passo "dosha".
- "Pular" em Evitar sempre: `evitar_passo = pulou`; o lembrete único na primeira resposta é do agente (`evitar_lembrete_em`), fora desta spec.
- JavaScript desligado: a Entrada funciona (os botões são formulários com ação de servidor); o Aviso e as telas de onboarding pedem JavaScript e mostram um `noscript` dizendo isso.
- `POST` sem `Origin` (ferramenta de linha de comando): `403`. O cron é `GET` e não passa por essa checagem.
- `RITU_MODO` com outro valor: ignorado. `x-ritu-e2e` fora do modo e2e: ignorado.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 6 verdes; `npm run dup` limpo; `test:db` verde.
- `npm run build && npm run start` com `RITU_MODO=e2e`: demonstração do começo ao fim no navegador; screenshots em `.plans/017-<tela>-<tema>-<projeto>.png` da Entrada (quatro arquivos) e do Aviso, Evitar sempre, Dosha e cidade e resultado do quiz (claro, celular).
- Com Postgres e sem `RITU_MODO`: `npm run db:migrate`, uma demonstração criada de verdade e `npm run cleanup` imprimindo a linha `limites`.
- `ARCHITECTURE.md`: §4 com o provedor `demo`, o token só com `contaId` e `tipo`, o Aviso também na demonstração e a checagem de `Origin` no proxy; §5 com `UsageLimiter` no lugar certo e o modo de E2E; §6 com a tabela `limites` como ela é; §7 com `src/proxy.ts`, `src/core/limits/`, `src/core/security/`, `src/infra/auth/` e `seed/`.
- `BUSINESS.md` §6: o caminho da demonstração com o passo do Aviso ("dois toques"); §13: o quiz dentro do onboarding. `DESIGN.md` §5: `login-screen-reference.jpeg` (referência do corte e do logo) e `public/marca/entrada.webp`.
- `OBSERVABILITY.md`: a métrica `ritu_entrada_total`. `QA.md`: nada muda no texto; o mapa aponta os arquivos.
- `DEVELOPMENT.md`: `RITU_MODO` na lista de variáveis; "E2E com o servidor no modo e2e" na seção de testes. `AGENTS.md`: a linha de `test:e2e` diz que o servidor sobe em modo e2e.
- `.specs/README.md`: a linha da 017 com o quiz; a da 020 sem o cálculo do quiz.
- ADR nova (próximo número livre): sessão em JWT só com o id da conta e demonstração como provedor de credenciais; limitador genérico em tabela; modo de E2E em memória.

## Arquivos e diretórios envolvidos

- `package.json`, `package-lock.json`, `.env.example`, `next.config.ts`, `playwright.config.ts`
- `config/limites.ts`, `config/quiz.ts`, `config/textos-entrada.ts` (novos), `config/index.ts`
- `db/migrations/NNNN_limites.sql` (novo)
- `seed/demo.yaml` (novo)
- `src/proxy.ts` (novo)
- `src/core/accounts/` (`entrar.ts`, `copiar-seed.ts`, `demo-seed.ts`, `onboarding.ts`, `dosha.ts`, `entrada.ts` e testes)
- `src/core/limits/ports.ts`, `src/core/security/csp.ts`, `src/core/security/origem.ts` (novos)
- `src/core/pantry/ports.ts`, `src/core/cleanup.ts`, `src/core/telemetry/nomes.ts`
- `src/infra/auth/next.ts`, `src/infra/auth/ip.ts` (novos)
- `src/infra/db/limits.ts`, `src/infra/db/pantry.ts`, `src/infra/fakes/memory-limiter.ts`, `src/infra/fakes/memory-stores.ts`
- `src/infra/knowledge/yaml-seed.ts` (novo), `src/infra/container.ts`, `src/infra/env.ts`
- `src/architecture.test.ts` (R3)
- `src/app/page.tsx`, `src/app/_lib/`, `src/app/_acoes/sessao.ts`
- `src/app/(comecar)/` e `src/app/(app)/` (novos)
- `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/onboarding/{aviso,evitar,perfil,quiz}/route.ts`, `src/app/api/cidades/route.ts`, `src/app/api/alimentos/route.ts`, `src/app/api/cron/limpeza/route.ts`
- `src/components/ritu/demo-banner.tsx` (novo)
- `public/marca/entrada.webp` (novo)
- `scripts/base-check.ts`, `scripts/cleanup.ts`
- `test/contracts/limits.contract.ts` (novo), `test/contracts/pantry.contract.ts`, `test/db/stores.db.test.ts`
- `evals/det/seguranca/` (três arquivos novos), `evals/det/mapa.ts`
- `e2e/apoio/sessao.ts`, `e2e/entrada.spec.ts`, `e2e/comecar.spec.ts` (novos), `e2e/smoke.spec.ts`
- `.docs/ARCHITECTURE.md`, `BUSINESS.md`, `DESIGN.md`, `OBSERVABILITY.md`, `DEVELOPMENT.md`; `AGENTS.md`; `.specs/README.md`; `.adrs/`
