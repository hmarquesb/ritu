---
title: Limites e degradação
status: implemented
implemented: 6660c47
entrega: 4
created: 2026-11-15
---

# Limites e degradação

> Põe os limites de uso de `BUSINESS.md` §14 no site: mensagens por conta (30 por dia no Google, 12 na demonstração) e por IP, toques por conta (60 por minuto, 300 por dia) e por IP, testers sem limite, e as telas para quando algo acaba. Quem esgota as mensagens continua com os atalhos de check-in, que devolvem práticas gerais montadas por código; quando a cota de IA do site acaba, a Conversa avisa antes do envio. Sinal de alerta nunca é barrado por limite.

## Contexto

A 017 criou a porta `UsageLimiter` e a usa só para as demonstrações. A 018, a 019 e a 020 abriram todas as rotas do site sem limite nenhum: uma conta (ou um script) pode mandar mensagens até acabar a cota gratuita do Gemini de todo mundo, e tocar nas rotas de toque sem freio. O site vai a público na 022; antes disso, os limites precisam existir.

A degradação por cota já existe no núcleo: sem modelo de `decisao`, o run sai pelo caminho `sem_modelo` com a resposta montada por código (006, 007, 008). Falta a tela saber disso antes do envio, e falta o caminho para quem esgotou as próprias mensagens.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Testers:** `TESTER_IDS` lista e-mails do Google; quem está na lista fica **sem limite nenhum** de mensagem, toque ou IP. A cota do Gemini continua valendo para todos. (Corrige a 001, que dizia "limite ampliado".)
- **Mensagens esgotadas:** a caixa de texto dá lugar a um aviso; os atalhos de check-in continuam e devolvem práticas gerais montadas por código, sem contar.
- **Cota de IA esgotada:** faixa no topo da Conversa antes do envio, com a hora em que a cota volta; enviar continua funcionando e cai na resposta por código.
- **Fim da demonstração:** o aviso convida a entrar com Google, com o botão.

## Objetivo

- Nenhuma conta comum passa de 30 mensagens por dia (Google) ou 12 no total (demonstração), e nenhum IP passa de 60 mensagens por dia, com contagem atômica.
- Nenhuma conta comum passa de 60 toques por minuto ou 300 por dia, e nenhum IP de 1500 toques por dia.
- Uma mensagem com sinal de alerta reconhecido por código recebe o texto de alerta mesmo com todos os limites esgotados.
- Com as mensagens esgotadas, marcar atalhos e tocar em "Ver práticas" devolve até 3 práticas da base, sem chamar modelo e sem contar.
- Com a cota do dia de `decisao` esgotada, a Conversa mostra a faixa já ao abrir, sem a pessoa precisar enviar nada.
- Toda tela nova passa no axe nos dois temas, em celular e desktop.

## Escopo

- **Dentro:**
  - Limite de mensagens por conta e por IP em `POST /api/runs`, com a ordem de decisão desta spec.
  - Limite de toques por conta (minuto e dia) e por IP (dia) em toda rota `POST` com conta, menos `POST /api/runs`.
  - Testers: `TESTER_IDS` com e-mails, conferido ao entrar com Google, gravado em `contas.tester`.
  - Mensagens esgotadas: atalhos com práticas gerais por código (`conversar` com `semModelo: "limite"`) e o texto de abertura próprio.
  - Estado dos limites (`estadoDosLimites`) na leitura da Conversa e no fim de cada fluxo.
  - Cota do dia esgotada no `ModelRouter` (`cotaDoDiaEsgotada`) e a hora da virada no fuso da pessoa.
  - Telas: faixa de cota de IA, caixa com mensagens esgotadas (conta, demonstração, IP), aviso de mensagens restantes, aviso breve de toques esgotados em todas as telas com toque.
  - `429` com `Retry-After` nas rotas.
  - Métrica `ritu_limite_total` e o painel.
  - Modo e2e: tetos e cota esgotada controlados por header.
- **Fora:**
  - Limite das demonstrações por IP e teto global: já na 017.
  - Limite das rotas `GET` (`/api/cidades`, `/api/alimentos`, leituras): não contam (ver Riscos).
  - Limite do servidor MCP público: 023.
  - Cron de limpeza em produção: 022 (a limpeza já apaga a tabela `limites`, 017).
  - Teto de tamanho da mensagem (1000 caracteres): já na 008.
  - Limites por run (passos, tempo, tokens): já na 005.

## Necessidade de negócio

O Ritu roda no plano gratuito do Gemini, com cota por projeto. Sem limite por pessoa, uma conta esgota a cota de todos e o site inteiro passa a responder só por código. Os limites dividem a cota entre quem visita; os testers deixam a dona e quem avalia usar sem freio. Degradar com graça (atalhos com práticas, faixa clara, convite ao Google no fim da demonstração) mantém o produto útil mesmo quando algo acaba, e mostra a quem avalia que o limite foi pensado, não descoberto.

## Critérios de aceite

- [ ] **Mensagens da conta Google:** a 31ª mensagem do dia de uma conta comum é recusada com `429 { erro: "limite_mensagens" }` antes de o fluxo abrir, sem criar run nem gravar mensagem (eval).
- [ ] **Mensagens da demonstração:** a 13ª mensagem de uma demonstração é recusada com `limite_demo`, mesmo que a conta tenha atravessado a meia-noite (eval com o relógio no dia seguinte).
- [ ] **Mensagens por IP:** com 60 mensagens do mesmo IP no dia, somando contas diferentes, a seguinte é recusada com `limite_ip`; a conta que barrou não soma nada (eval).
- [ ] **Atômico:** quando o IP barra, a contagem da conta não sobe, e vice-versa (contrato do `UsageLimiter` e eval).
- [ ] **Só atalhos depois do limite:** com as mensagens esgotadas, uma mensagem só com atalhos segue com `conversar(..., { semModelo: "limite" })`: run `done` com caminho `sem_modelo`, nenhuma chamada ao `LlmClient`, até 3 práticas, o texto de abertura de "limite", nada contado; soma `ritu_limite_total{tipo: "mensagem", resultado: "so_atalhos"}` e **não** soma `ritu_fallback_sem_llm_total` (eval).
- [ ] **Alerta passa:** com as mensagens esgotadas, "tô com uma dor forte no peito" e "não aguento mais, queria sumir" recebem o texto de alerta físico e o emocional, sem contar e sem chamar modelo; "quero um chá" é recusada com `limite_mensagens` (eval).
- [ ] **Run em andamento não gasta:** com um run em `running` na conta, `POST /api/runs` responde `409 run_aberto` e a contagem não sobe (eval).
- [ ] **Cota de IA esgotada não gasta:** com todos os modelos de `decisao` sem cota do dia, a mensagem segue sem consumir o limite da conta (eval).
- [ ] **Toques:** o 61º toque no mesmo minuto recebe `429 { erro: "limite_toques" }` com `Retry-After` até o próximo minuto; o 301º do dia, com `Retry-After` até a meia-noite local (fuso padrão); nenhum dos dois grava nada (eval, com `POST /api/casa`, `POST /api/runs/:id/voto` e `POST /api/runs/:id/aprovacao`).
- [ ] **Toques por IP:** com 1500 toques do mesmo IP no dia, o seguinte é recusado (eval com teto reduzido).
- [ ] **Quem conta como toque:** toda rota `POST` com conta conta um toque, menos `POST /api/runs`; nenhuma rota `GET` conta (teste do `criarRota` e eval que percorre a lista de rotas).
- [ ] **Testers:** conta Google cujo e-mail está em `TESTER_IDS` (sem diferença de maiúsculas e espaços) entra com `tester: true` e não é barrada por mensagem, toque nem IP, e não soma nos contadores; tirar o e-mail da lista vale na próxima entrada (eval).
- [ ] **Cota do dia:** `cotaDoDiaEsgotada("decisao")` é verdadeiro só quando todo modelo do papel tem a cota do dia cheia ou está fora até a virada do dia (`esgotado_ate: "dia"`); cota do minuto cheia não conta (teste).
- [ ] **Hora da virada:** `viradaDaCota` devolve a próxima meia-noite de `America/Los_Angeles`; em `America/Sao_Paulo`, aparece como "5h" no horário padrão do Pacífico e "4h" no de verão (teste com as duas datas).
- [ ] **Estado na leitura:** `GET /api/conversa` e a página `/conversa` trazem `limites`; o evento `fim` de todo fluxo traz `limites` recalculado.
- [ ] **Faixa da cota:** com a cota do dia esgotada, `/conversa` abre com a faixa "Minha cota de IA de hoje acabou…" com a hora local; a caixa continua aceitando texto; quando a cota volta, o próximo `fim` tira a faixa (E2E).
- [ ] **Caixa esgotada (conta):** com as mensagens esgotadas, o campo de texto sai, aparece o `StateBlock kind="quota"` com o título e a descrição de `esgotadas.conta`, os atalhos continuam e o botão vira "Ver práticas"; marcar um atalho e tocar mostra a resposta com práticas (E2E).
- [ ] **Caixa esgotada (demonstração):** o bloco usa `esgotadas.demo` e tem o botão "Entrar com Google" quando o Google está configurado; sem o Google, o botão não aparece (E2E nos dois modos).
- [ ] **Restantes:** com 3 ou menos mensagens restantes, o texto "Restam N mensagens hoje." (ou a forma da demonstração e o singular) aparece abaixo da caixa e é atualizado a cada `fim`; tester não vê o texto (E2E).
- [ ] **Recusa no meio:** se `POST /api/runs` volta `429` (outra aba gastou), a tela passa ao estado esgotado sem recarregar e o texto escrito fica visível, só leitura, abaixo do bloco (E2E).
- [ ] **Toques na tela:** `429 limite_toques` em Conversa, Minha casa, Como ficou?, Você e no onboarding mostra o aviso breve com o texto do minuto ou do dia, e a tela não muda (E2E em Minha casa com teto reduzido).
- [ ] **Acessibilidade:** a faixa e o bloco esgotado passam em `expectSemViolacoes` nos dois temas, em `celular` e `desktop`; a faixa que aparece no meio da conversa é anunciada uma vez pela região de anúncio da 018; o bloco esgotado é texto parado, com o botão alcançável por teclado.
- [ ] **Privacidade:** `ritu_limite_total` só tem os rótulos `tipo`, `motivo` e `resultado`; nenhuma chave, IP, hash ou conta vai para span, métrica ou log; a tabela `limites` nunca guarda IP (eval de privacidade da 015 estendido).
- [ ] Gates 1 a 6 verdes, `npm run dup` limpo, `test:db` verde com o contrato do `UsageLimiter` estendido.

## O que fazer

- Escrever primeiro as funções puras (`chavesDeMensagem`, `chavesDeToque`, `restantes`, `viradaDaCota`, `horaDaVirada`) e os testes; depois `decidirMensagem`, `consumirToque` e `estadoDosLimites` com os fakes; por último rotas e telas.
- Decidir o limite da mensagem **na rota**, antes de `conversar`; `conversar` só ganha o modo `semModelo: "limite"`.
- Pôr o limite de toque dentro de `criarRota` e `criarRotaDeFluxo`, decidido pelo método e pela opção `limite`, para nenhuma rota esquecer.
- Usar `conferirEntrada` (013) para o alerta por código depois do limite: a mesma função do guardrail, sem regra nova.
- Usar os componentes da 016 (`StateBlock kind="quota"`, `Surface`, `Button`, `toast`) e carregar `frontend-design` antes das telas e `web-design-guidelines` antes de entregar.
- Registrar no mapa dos evals os arquivos novos.
- Atualizar os docs e escrever a ADR no fechamento.

## O que não fazer

- Não barrar mensagem com sinal de alerta reconhecido por código.
- Não contar mensagem que não chega a rodar: run em andamento, corpo inválido, cota de IA esgotada, tester.
- Não guardar IP, hash de IP, e-mail ou id de conta em rótulo de métrica, atributo de span ou log.
- Não ler `TESTER_IDS` a cada pedido nem comparar e-mail fora da entrada: o e-mail só serve para entrar.
- Não esconder os atalhos quando as mensagens acabam.
- Não chamar modelo para montar o estado dos limites nem a faixa.
- Não mudar o limite das demonstrações da 017.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Testers | E-mails do Google em `TESTER_IDS`, sem limite de mensagem, toque nem IP (dona) | `BUSINESS.md` §14; e-mail é o que a dona sabe de quem testa |
| Quando o tester é reconhecido | Ao entrar com Google: `entrarComGoogle` grava `contas.tester` | O e-mail continua servindo só para entrar; tirar alguém da lista vale na próxima entrada |
| Mensagens esgotadas | Texto fecha, atalhos seguem com práticas por código, sem contar (dona) | A pessoa nunca fica sem nada; atalhos não chamam modelo nesse modo |
| Cota de IA esgotada | Faixa antes do envio com a hora da volta; enviar segue e cai na resposta por código (dona) | A pessoa sabe antes de escrever; nada fica travado |
| Fim da demonstração | Aviso com o botão "Entrar com Google" (dona) | É o momento natural de converter a visita |
| Onde o limite de mensagem é decidido | Na rota `POST /api/runs`, antes de `conversar` | Limite é borda do produto; o núcleo do agente não conhece conta comum, tester nem IP |
| Ordem da decisão | Tester → cota de IA do dia esgotada → consumir conta e IP → barrou: só atalhos, alerta ou recusa | Nada que não gasta modelo consome o limite da pessoa |
| Alerta depois do limite | `conferirEntrada` (013) por código; alerta segue para `conversar` sem contar | Segurança antes de cota; o guardrail por código não chama modelo |
| Mensagens por IP | 60 por dia | Cinco demonstrações de 12, que é o máximo de um IP pela 017; rede compartilhada com contas Google ainda cabe |
| Mensagens da demonstração | 12 no total, numa chave com o dia da criação da conta | A conta vive 24 h e pode atravessar a meia-noite; o total não se renova |
| Atalhos dentro do limite | Contam como mensagem | Chamam o Acompanhante com modelo |
| Resposta à pergunta e aprovação | Contam como toque | Continuam o mesmo run; não são mensagem nova |
| Quem é toque | Todo `POST` com conta, menos `POST /api/runs`; `GET` nunca | Regra que não depende de lista; nenhuma rota fica de fora |
| Toques por IP | 1500 por dia | Cinco contas de 300 |
| Janelas dos toques | Minuto consumido antes do dia; cada um atômico em si | A porta consome uma janela por vez; um toque barrado no dia depois de passar no minuto soma 1 no minuto, sem efeito prático |
| Código HTTP | `429` com `Retry-After` em segundos | Padrão; a tela escolhe o texto pelo código |
| Faixa | Só com a cota **do dia** esgotada em todos os modelos de `decisao` | A cota do minuto volta sozinha em segundos; faixa piscando seria ruído |
| Hora da virada | Próxima meia-noite de `America/Los_Angeles`, mostrada no fuso da cidade da pessoa (ou no padrão) como "5h" | É quando o Gemini renova a cota (`AI.md` §10) |
| Aviso de restantes | Abaixo da caixa, com 3 ou menos | Avisa sem pesar nas primeiras mensagens |
| Texto da resposta sem modelo por limite | Abertura própria ("Suas mensagens de hoje acabaram…") | A de cota diz "meu limite acabou", o que não é verdade aqui |
| `ritu_fallback_sem_llm_total` | Não soma no modo `limite` | A métrica mede a falta de modelo, não o limite da pessoa |
| Modo e2e | Headers `x-ritu-e2e-teto` e `x-ritu-e2e-cota`, aceitos só com `RITU_MODO=e2e` | O E2E chega ao limite em poucos envios sem mudar a configuração de todos os testes |

## Contratos

### Cria

**Configuração (`config/limites.ts`, acréscimos à 017)**

```ts
export const limites = {
  // … o que a 017 já tem (demo, sessao, corpoMaximoBytes, evitar, buscaDeAlimento)
  mensagens: { googlePorDia: 30, demoPorConta: 12, porIpPorDia: 60, avisarComRestantes: 3 },
  toques: { porContaPorMinuto: 60, porContaPorDia: 300, porIpPorDia: 1500 },
} as const
```

**Chaves da tabela `limites`** (o `escopo` do modo e2e entra como prefixo, como na 017)

| Chave | Janela | `inicio` | Teto |
|---|---|---|---|
| `msg:conta:<id>` | dia | Dia local de hoje (`clima.fusoPadrao`) | `googlePorDia` |
| `msg:demo:<id>` | dia | Dia local da criação da conta (`criado_em`, fuso padrão) | `demoPorConta` |
| `msg:ip:<hmac>` | dia | Hoje | `porIpPorDia` |
| `toque:conta:<id>` | minuto | `janelaDoMinuto(agora)` (006) | `porContaPorMinuto` |
| `toque:conta:<id>` | dia | Hoje | `porContaPorDia` |
| `toque:ip:<hmac>` | dia | Hoje | `porIpPorDia` |

A limpeza da 017 apaga a janela `dia` com início antes de ontem; a chave da demonstração vive no máximo até o segundo dia, quando a conta já venceu. A janela `minuto` entra na mesma limpeza (`apagarAntesDe` passa a apagar também as linhas de minuto com início antes de hoje).

**`UsageLimiter` (017) muda**

```ts
consumir(
  pedidos: { chave: string; teto: number; inicio?: string }[],   // `inicio` próprio por chave; sem ele, vale o da chamada
  janela: Janela,
  inicio: string,
): Promise<{ ok: true } | { ok: false; chave: string }>
apagarAntesDe(inicio: string): Promise<number>     // linhas "dia" com início menor e linhas "minuto" de dias anteriores
```

A suíte `test/contracts/limits.contract.ts` ganha: `inicio` por chave; atomicidade com dois inícios diferentes; limpeza das linhas de minuto.

**Limites (`src/core/limits/`)**

```ts
// erros.ts
export class LimiteError extends RituError {}
// code: "limite_mensagens" | "limite_demo" | "limite_ip" | "limite_toques"; campo `retryAfterS: number`

// estado.ts
export type MotivoDoLimite = "conta" | "demo" | "ip"
export type EstadoDasMensagens =
  | { tipo: "livre" }                                           // tester
  | { tipo: "contando"; restantes: number; demo: boolean }      // menor folga entre conta e IP
  | { tipo: "esgotadas"; motivo: MotivoDoLimite }
export type EstadoDaCota = { esgotada: false } | { esgotada: true; volta_as: string }   // "5h"
export type EstadoDosLimites = { mensagens: EstadoDasMensagens; cota_ia: EstadoDaCota }

export type DepsDosLimites = { limiter: UsageLimiter; router: ModelRouter; clock: Clock; telemetry: Telemetry }
export type QuemPede = { conta: Conta; ipHash: string; fuso: string; escopo?: string; teto?: number }
// `fuso`: o da cidade do perfil ou `clima.fusoPadrao` (só para a hora da virada)
// `teto`: só no modo e2e; substitui todos os tetos de mensagem e de toque deste pedido

export function estadoDosLimites(deps: DepsDosLimites, q: QuemPede): Promise<EstadoDosLimites>
// Tester: mensagens "livre". Senão lê `usado` das chaves de mensagem; restantes = menor de (teto − usado) entre a conta (ou a demo) e o IP;
// 0 ou menos: "esgotadas", com o motivo da conta (conta ou demo) antes do IP. cota_ia por `router.cotaDoDiaEsgotada("decisao")`.

// mensagens.ts
export type DecisaoDaMensagem =
  | { seguir: "normal" }                                        // contou, tester ou cota de IA esgotada
  | { seguir: "so_atalhos"; motivo: MotivoDoLimite }            // não contou; `conversar` com semModelo "limite"
  | { seguir: "alerta"; motivo: MotivoDoLimite }                // não contou; `conversar` normal (o guardrail por código responde)
  | { barrar: LimiteError }
export function decidirMensagem(deps: DepsDosLimites, q: QuemPede, m: MensagemRecebida): Promise<DecisaoDaMensagem>
```

Ordem de `decidirMensagem`:

1. `conta.tester`: `normal`.
2. `router.cotaDoDiaEsgotada("decisao")`: `normal`, sem consumir.
3. `limiter.consumir([conta ou demo, ip], "dia", hoje)`. Passou: `normal`.
4. Barrou (motivo pela chave): sem texto (só atalhos) → `so_atalhos`; com texto e `conferirEntrada(texto).resultado === "alerta"` → `alerta`; senão → `barrar` com o código do motivo (`limite_mensagens`, `limite_demo` ou `limite_ip`) e `retryAfterS` até a meia-noite local (fuso padrão; para a demonstração, até `expira_em`).
5. Soma `ritu_limite_total{tipo: "mensagem", motivo, resultado}` nos casos 4 (`so_atalhos`, `alerta`, `barrado`).

```ts
// toques.ts
export function consumirToque(deps: DepsDosLimites, q: QuemPede): Promise<{ ok: true } | { ok: false; erro: LimiteError }>
```

Ordem: tester → `ok`. `consumir([toque:conta], "minuto", janelaDoMinuto(agora))`; barrou: erro com `retryAfterS` até o próximo minuto. `consumir([toque:conta, toque:ip], "dia", hoje)`; barrou: erro com `retryAfterS` até a meia-noite local (fuso padrão). Barrado: soma `ritu_limite_total{tipo: "toque", motivo: "minuto" | "dia" | "ip", resultado: "barrado"}`.

```ts
// chaves.ts (puras)
export function chavesDeMensagem(conta: Conta, ipHash: string, agora: Date, escopo?: string, teto?: number): { conta: Pedido; ip: Pedido }
export function chavesDeToque(conta: Conta, ipHash: string, agora: Date, escopo?: string, teto?: number): { minuto: Pedido; dia: Pedido; ip: Pedido }
export function segundosAte(agora: Date, alvo: Date): number     // arredonda para cima; mínimo 1
```

**`ModelRouter` (006) ganha**

```ts
cotaDoDiaEsgotada(papel: Papel): Promise<boolean>
// verdadeiro quando todo modelo do papel tem `uso.dia.pedidos >= rpd` ou `esgotado_ate === "dia"`. A cota do minuto não conta.
```

**Janelas (`src/core/llm/janelas.ts`, acréscimos)**

```ts
export function viradaDaCota(agora: Date): Date                 // próxima meia-noite em llmCotas.fusoDoDia
export function horaLocal(data: Date, fuso: string): string     // "5h"; com minutos, "5h30"
```

**Resposta sem modelo (006) muda**

`respostaSemModelo` ganha `motivo?: "cota" | "limite"` (padrão `cota`). Com `limite` e estados, a abertura (em `src/core/llm/textos.ts`) é:

"Suas mensagens de hoje acabaram, mas os atalhos continuam. Separei direto da base o que costuma ajudar quando a pessoa está {estados}:"

Sem estados, o texto é o mesmo de `cota` (não acontece pela rota: o modo `limite` só roda com atalhos).

**`conversar` (008) muda**

`opts` ganha `semModelo?: "limite"`. Com ele, `conversar` cria o run como sempre, pula o guardrail e o Intérprete e vai direto ao passo sem modelo, passando `motivo: "limite"` a `companion.responder`. `companion.responder` (007) passa o `motivo` a `respostaSemModelo` e só soma `ritu_fallback_sem_llm_total` quando o motivo não é `limite`. Mensagem com texto e `semModelo: "limite"` é erro de programação (`mensagem_invalida`).

**Testers**

- `entrarComGoogle` (017) recebe nas dependências `testers: string[]` (e-mails já normalizados). Depois de achar ou criar a conta, se `testers.includes(normalizarEmail(email)) !== conta.tester`, chama `accounts.marcar(id, { tester })`.
- `AccountRepository.marcar` (004) aceita `tester`.
- `src/infra/env.ts`: `testers(): string[]` lê `TESTER_IDS` separado por vírgula, com `normalizarEmail` (minúsculas, sem espaços nas pontas), sem itens vazios. A descrição no catálogo passa a ser "E-mails do Google, separados por vírgula, sem limite de uso." O nome da variável não muda.
- `normalizarEmail(e: string): string` em `src/core/accounts/email.ts`.

**Rotas**

`criarRota` e `criarRotaDeFluxo` (017, 018) ganham `opts.limite?: "toque" | "nenhum"`. Padrão: `toque` para `POST`, `nenhum` para os outros métodos. Com `toque`, depois da sessão, da conta e do corpo válidos e antes de `fn`, chamam `consumirToque`; barrado: `429 { erro: "limite_toques" }` com o header `Retry-After`. `LimiteError` lançado por `fn` também vira `429` com o mesmo header e `{ erro: <code> }`. `ctx` ganha `ipHash: string` e `escopo?: string` (do modo e2e, como na 017).

`POST /api/runs` (018) usa `limite: "nenhum"` e, antes de abrir o fluxo:

1. `runs.aberto(conta.id)` com status `running`: `409 { erro: "run_aberto" }`, sem consumir.
2. `decidirMensagem`. `barrar`: `429 { erro: <code>, limites: EstadoDosLimites }` com `Retry-After`.
3. Abre o fluxo; `so_atalhos` chama `conversar(…, { semModelo: "limite", aoVivo, aoCriar })`; `normal` e `alerta`, como na 018.
4. O evento `fim` leva `limites` (`estadoDosLimites` depois do run).

| Rota | Muda |
|---|---|
| `GET /api/conversa` | Resposta `ConversaDoDia` com `limites` |
| `POST /api/runs` | Decisão acima; `fim` com `limites` |
| `POST /api/runs/:id/resposta` | Conta como toque (padrão); `fim` com `limites` |
| Demais `POST` com conta (017 a 020) | Contam como toque (padrão), sem mudança no corpo nem na resposta de sucesso |
| `GET /api/cron/limpeza`, `/api/auth/*` | Não passam por `criarRota`; sem limite |

**Conversa (018) muda**

```ts
export type ConversaDoDia = { /* … o que a 018 tem */ limites: EstadoDosLimites }
export type EventoDaTela = /* … */ | { tipo: "fim"; visao: VisaoDoRun; pendentes: number; limites: EstadoDosLimites }
export function conversaDoDia(deps: { stores: Stores; clock: Clock; seed: DemoSeed; limiter: UsageLimiter; router: ModelRouter; telemetry: Telemetry }, conta: Conta, perfil: Perfil, quem: { ipHash: string; escopo?: string; teto?: number }): Promise<ConversaDoDia>
```

A página `/conversa` tira o IP de `headers()` com `ipDoPedido` e `hashDoIp` (017).

**Textos (`config/textos-limites.ts`, incluídos em `config/index.ts` como `textosLimites`)**

| Chave | Texto |
|---|---|
| `cota.faixa` | Minha cota de IA de hoje acabou. Até por volta das {hora}, respondo com práticas da base: marque como você está nos atalhos. |
| `cota.rotulo` | Aviso |
| `restam.varias` | Restam {n} mensagens hoje. |
| `restam.uma` | Resta 1 mensagem hoje. |
| `restam.variasDemo` | Restam {n} mensagens na demonstração. |
| `restam.umaDemo` | Resta 1 mensagem na demonstração. |
| `esgotadas.conta.titulo` | Suas mensagens de hoje acabaram |
| `esgotadas.conta.texto` | Amanhã tem mais. Os atalhos continuam: marque como você está e eu separo práticas da base. |
| `esgotadas.demo.titulo` | Sua demonstração chegou ao fim das mensagens |
| `esgotadas.demo.texto` | Entre com Google para continuar com sua própria conta. Os atalhos continuam funcionando aqui. |
| `esgotadas.demo.google` | Entrar com Google |
| `esgotadas.ip.titulo` | As mensagens desta conexão acabaram hoje |
| `esgotadas.ip.texto` | Muita gente usou o Ritu pela mesma rede. Amanhã tem mais; os atalhos continuam. |
| `esgotadas.textoGuardado` | O que você escreveu: |
| `atalhos.enviar` | Ver práticas |
| `toques.minuto` | Muitos toques seguidos. Espere um minuto e tente de novo. |
| `toques.dia` | Você chegou ao limite de toques de hoje. Amanhã tem mais. |

**Tela (`src/components/ritu/conversa/` e apoio)**

| Arquivo | Exporta | O que é |
|---|---|---|
| `faixa-cota.tsx` | `FaixaDeCota({ voltaAs })` | `aside` com `aria-label` de `cota.rotulo`, `Surface` em `amber-soft`, ícone `Hourglass` (Phosphor, `light`) e o texto `cota.faixa`; logo abaixo do `DemoBanner`, acima da lista. Texto parado; quando aparece depois do carregamento (pelo `fim`), o texto vai uma vez para a região de anúncio da 018 |
| `caixa-esgotada.tsx` | `CaixaEsgotada({ motivo, googleDisponivel, textoGuardado? })` | `StateBlock kind="quota"` com título e texto do motivo; na demonstração com Google, o botão `esgotadas.demo.google` (`entrarComGoogleAcao`, 017); com `textoGuardado`, o rótulo `esgotadas.textoGuardado` e o texto em `surface-sunken`, só leitura e selecionável |
| `restantes.tsx` | `MensagensRestantes({ estado })` | Texto `ink-muted` abaixo da caixa, ligado ao campo por `aria-describedby`; só com `contando` e `restantes <= avisarComRestantes` |
| `src/components/ritu/limites.ts` | `textoDoLimite(erro: string, retryAfterS?: number): string \| undefined` | `limite_toques` com `Retry-After` de até 60 s → `toques.minuto`; maior → `toques.dia`; outros códigos → `undefined` |

- `CaixaDeMensagem` (018) recebe `limites`. Com `esgotadas`, o `TextField` e o contador saem, `CaixaEsgotada` entra acima dos atalhos, e o botão vira `atalhos.enviar` (com `aria-disabled` sem atalho marcado, motivo `caixa.vazia` da 018).
- `useConversa` (018) guarda `limites` da leitura inicial e de cada `fim`; `429` com `limites` no corpo troca o estado sem recarregar e guarda o texto escrito em `textoGuardado` (só em memória).
- `FaixaDeCota` aparece com `limites.cota_ia.esgotada` e some no `fim` que trouxer `esgotada: false`.
- `useConversa`, `useCasa` (019), o hook de Como ficou? (019), `useVoce` (020) e os formulários do onboarding (017): `429` com `textoDoLimite` definido → `toast` com o texto; a tela não muda.

**Telemetria**

- `METRICAS` ganha `ritu_limite_total` (contador; `tipo`: `mensagem`, `toque`; `motivo`: `conta`, `demo`, `ip`, `minuto`, `dia`; `resultado`: `barrado`, `so_atalhos`, `alerta`). `ATRIBUTOS_PERMITIDOS` não muda.
- Painel (015), linha 1 "Saúde": novo stat "Limites atingidos", `TOTAL(ritu_limite_total, resultado)`.
- Nenhum span e nenhum log novos.

**Modo e2e (acréscimos à 017 e à 018)**

- Só com `RITU_MODO=e2e`: o header `x-ritu-e2e-teto` (inteiro de 1 a 100) vira `QuemPede.teto` e substitui todos os tetos de mensagem e de toque daquele pedido; `x-ritu-e2e-cota: esgotada` faz o router do container e2e responder `cotaDoDiaEsgotada("decisao") === true` e `temModelo("decisao") === false` naquele pedido. Fora do modo e2e, os dois headers são ignorados (teste).
- Tester não tem E2E: o modo e2e entra só pela demonstração (017); o tester é coberto pelo eval.

**ADR** (próximo número livre): "Limites de uso decididos na borda", com a ordem de `decidirMensagem`, o alerta antes do limite e o porquê de `conversar` não conhecer conta comum, tester nem IP.

### Usa

- **001:** `RituError`, catálogo de variáveis (`TESTER_IDS`, `IP_HMAC_SECRET`), teste de arquitetura.
- **004:** `Conta` (`tester`, `tipo`, `criado_em`, `expira_em`), `AccountRepository.marcar`, `RunRepository.aberto`, `diaLocal`.
- **006:** `ModelRouter`, `UsoDoModelo` (`dia`, `esgotado_ate`), `janelaDoMinuto`, `diaDaCota`, `llmCotas.fusoDoDia`, `respostaSemModelo`, `createMemoryLedger`.
- **007:** `companion.responder` com `semModelo`, `saidaSemModelo`.
- **008:** `createConversation` (`conversar`), `MensagemRecebida`, `mensagemRecebidaSchema`.
- **013:** `conferirEntrada`, textos de alerta.
- **015:** `METRICAS`, painel como código, teste de privacidade, `Telemetry`.
- **016:** `StateBlock` (`kind: "quota"`), `Surface`, `Button`, `TextLink`, `TextField`, `toast`, `ICON`, tokens (`amber-soft`, `amber-ink`, `surface-sunken`, `ink-muted`), `expectSemViolacoes`.
- **017:** `UsageLimiter`, tabela `limites`, `config/limites.ts`, `ipDoPedido`, `hashDoIp`, `entrarComGoogle`, `entrarComGoogleAcao`, `googleDisponivel`, `criarRota`, `DemoBanner`, modo e2e e `escopo`, `executarLimpeza`.
- **018:** `criarRotaDeFluxo`, `POST /api/runs` e `/resposta`, `ConversaDoDia`, `conversaDoDia`, `EventoDaTela`, `useConversa`, `CaixaDeMensagem`, região de anúncio, `textosConversa` (`caixa.vazia`).
- **019:** `useCasa`, o hook de Como ficou?, rotas de toque.
- **020:** `useVoce`, rotas de perfil e de memória.

## Evals (quando a spec toca agente, prompt, tool ou base)

- `evals/det/seguranca/limites.eval.ts`: 31ª mensagem Google; 13ª da demonstração atravessando a meia-noite; 61ª do IP com contas diferentes; atomicidade conta e IP; run em `running` não consome; cota de IA esgotada não consome; tester sem limite e sem contagem; tester tirado da lista na entrada seguinte; 61º toque do minuto e 301º do dia com `Retry-After`; toques por IP com teto reduzido; nenhuma gravação nas rotas barradas; toda rota `POST` com conta da lista de rotas conta toque, menos `POST /api/runs`, e nenhuma `GET` conta.
- `evals/det/conversa/degradacao.eval.ts` (existente) ganha: só atalhos depois do limite (caminho `sem_modelo`, nenhum pedido ao fake de LLM, abertura de "limite", até 3 práticas, nada barrado pelo filtro da pessoa, `ritu_limite_total{resultado: "so_atalhos"}`, `ritu_fallback_sem_llm_total` parado); alerta físico e emocional depois do limite; texto comum depois do limite recusado.
- `evals/det/modelos/sem-modelo.eval.ts` (existente) ganha: `cotaDoDiaEsgotada` com cota do minuto cheia (falso), com cota do dia cheia em todos (verdadeiro), com um modelo do papel ainda livre (falso), com `esgotado_ate: "dia"` (verdadeiro).
- Privacidade (015): a suíte passa também pelos caminhos de limite; nenhum rótulo, atributo ou log com chave, hash, IP ou conta.
- Nenhum caso com LLM novo.

## Nível das partes

- **nucleo** (Sonnet): `criarRota` e `criarRotaDeFluxo` com o limite de toque e o `429`; a decisão em `POST /api/runs` (ordem, fluxo e `fim` com `limites`); o modo `semModelo: "limite"` em `conversar` e em `companion.responder`; `useConversa` (estado dos limites, `429` no meio, texto guardado); os headers do modo e2e no container.
- **tela** (Sonnet): `FaixaDeCota`, `CaixaEsgotada`, `MensagensRestantes`, as mudanças em `CaixaDeMensagem`, o `toast` de toque nas telas da 017, 019 e 020, e `e2e/limites.spec.ts`.
- Todo o resto é `mecanica`: configuração, textos, chaves, `decidirMensagem`, `consumirToque`, `estadoDosLimites`, `cotaDoDiaEsgotada`, `viradaDaCota`, `horaLocal`, mudanças no `UsageLimiter` e no contrato, testers e `env.ts`, métrica e painel, evals determinísticos, mapa, docs e ADR.

## Leitura para a construção

- `BUSINESS.md` §14 (regras de negócio).
- `ARCHITECTURE.md` §3 (fluxo de um run, passos 2 e 3) e §4 ("Proteção do site").
- `AI.md` §10, "Regras" (dia da cota e 429).
- `DESIGN.md` §3 (regras e acessibilidade).
- `DEVELOPMENT.md` §"UI" e §"Camadas e importações".
- Skills: `frontend-design` e `web-design-guidelines` (tela); `next-best-practices` (`route-handlers.md`).

## Dependências

- Specs 017 (porta `UsageLimiter`, `criarRota`, IP em HMAC, `entrarComGoogle`), 018 (rotas de run e tela da Conversa), 019 e 020 (rotas de toque e hooks das telas), 013 (`conferirEntrada`), 006 (router e resposta sem modelo), 015 (métricas e painel).
- Nenhuma biblioteca nova.

## Riscos e trade-offs

- **Limite por IP é fraco:** rede compartilhada divide o contador, e quem troca de IP escapa. O que protege a cota de verdade é o teto por conta somado ao teto global de demonstrações (017) e à troca de modelo (006).
- **Rotas `GET` sem limite:** `/api/cidades` chama a Open-Meteo a cada busca. A busca tem mínimo de caracteres e a Open-Meteo é gratuita e sem chave; se virar abuso, um limite por IP nas buscas é uma spec de correção.
- **Alerta depois do limite:** com as mensagens esgotadas o campo de texto some, então só chega texto de uma aba antiga ou de um envio que cruzou o limite. Nesses casos, o alerta reconhecido **por código** passa; o que só o Intérprete reconheceria é recusado com o texto de limite. O Ritu não é canal de urgência: os textos de alerta (008) já mandam procurar atendimento.
- **Tester só na entrada:** tirar alguém de `TESTER_IDS` vale na próxima entrada, que pode demorar até 30 dias de sessão. É o preço de o e-mail servir só para entrar.
- **Contagem do minuto antes do dia:** um toque barrado no dia soma 1 no minuto. Sem efeito prático.
- **Cota esgotada entre a decisão e o run:** a mensagem conta e o run sai por código. Raro e barato.

## Edge cases e modos de falha

- Duas abas enviam ao mesmo tempo com 1 mensagem restante: o `consumir` atômico deixa passar uma; a outra recebe `429` e a tela passa ao estado esgotado.
- `POST /api/runs` com corpo inválido: `400` antes de decidir; nada consumido.
- Erro do banco no `consumir`: `500 erro_inesperado` (017); nada consumido.
- Demonstração criada às 23h50: a chave tem o dia da criação; as 12 valem até a conta vencer.
- `x-forwarded-for` ausente (desenvolvimento local): IP `"desconhecido"`, um contador só; a dona se põe em `TESTER_IDS` para não esbarrar nele.
- `TESTER_IDS` vazio ou ausente: ninguém é tester; nenhuma conta comum muda.
- Cota volta (virada do Pacífico) com a página aberta: a faixa fica até o próximo `fim` ou recarga; o envio já funciona com modelo.
- Fuso da pessoa com meia hora (ex.: `Asia/Kolkata`): a hora aparece com minutos ("13h30").
- Pergunta do agente ou bloco de aprovação aberto com os toques esgotados: o toque recebe `429` e o aviso; o run segue esperando e expira em 30 min (005).
- Mensagem só com atalhos depois do limite numa conta com todas as práticas barradas pelo filtro: a resposta sai com a abertura e a lista vazia, como na 006.
- Run em `waiting_for_input` ou `waiting_for_approval` com as mensagens esgotadas: enviar só atalhos cancela a pendência como na 018 e devolve as práticas.

## Resultado (definição de pronto)

- Todos os critérios de aceite marcados.
- `e2e/limites.spec.ts` verde: faixa da cota com a hora, caixa esgotada na conta e na demonstração (com e sem Google), práticas pelos atalhos depois do limite, restantes, `429` no meio com o texto guardado, aviso de toques em Minha casa, axe nos dois temas.
- `npm run demo -- --cenario alerta-emocional` e os demais cenários seguem iguais (o modo `limite` não muda os caminhos da 008).
- `.docs/` atualizados: `BUSINESS.md` §14 (mensagens por IP, atalhos depois do limite, testers por e-mail, faixa da cota, fim da demonstração com Google); `ARCHITECTURE.md` §3 (passo 3 com a ordem da decisão e o `429`) e §4 (limites de toque em todo `POST` com conta); `AI.md` §3 (`sem_modelo` com o motivo `limite`); `OBSERVABILITY.md` (`ritu_limite_total` e o stat do painel); `QA.md` ("Segurança e privacidade" e "Telas (E2E)" com os casos de limite); `DEVELOPMENT.md` (descrição de `TESTER_IDS`); a ADR nova.

## Arquivos e diretórios envolvidos

- `config/limites.ts`, `config/textos-limites.ts` (novo), `config/index.ts`
- `src/core/limits/` (`erros.ts`, `estado.ts`, `mensagens.ts`, `toques.ts`, `chaves.ts`, novos; `ports.ts` muda)
- `src/core/llm/router.ts`, `src/core/llm/janelas.ts`, `src/core/llm/sem-modelo.ts`, `src/core/llm/textos.ts`
- `src/core/conversation/conversar.ts`, `src/core/conversation/do-dia.ts`, `src/core/conversation/eventos.ts`
- `src/core/agents/companion/responder.ts`
- `src/core/accounts/entrar.ts`, `src/core/accounts/email.ts` (novo), `src/core/accounts/ports.ts`
- `src/core/telemetry/nomes.ts`, definição do painel (015)
- `src/infra/db/limits.ts`, `src/infra/db/accounts.ts`, `src/infra/fakes/memory-limiter.ts`, `src/infra/fakes/memory-stores.ts`, `src/infra/env.ts`, `src/infra/container.ts`, `src/infra/auth/`
- `src/app/_lib/` (`criarRota`, `fluxo.ts`), `src/app/api/runs/route.ts`, `src/app/api/conversa/route.ts`, `src/app/(app)/conversa/page.tsx`
- `src/components/ritu/conversa/` (`faixa-cota.tsx`, `caixa-esgotada.tsx`, `restantes.tsx`, novos; `caixa.tsx`, `conversa.tsx`, `use-conversa.ts` mudam), `src/components/ritu/limites.ts` (novo), hooks da 019 e da 020, formulários do onboarding (017)
- `test/contracts/limits.contract.ts`
- `evals/det/seguranca/limites.eval.ts` (novo), `evals/det/conversa/degradacao.eval.ts`, `evals/det/modelos/sem-modelo.eval.ts`, `evals/det/mapa.ts`
- `e2e/limites.spec.ts` (novo)
- `.env.example` (comentário de `TESTER_IDS`)
- `.docs/BUSINESS.md`, `.docs/ARCHITECTURE.md`, `.docs/AI.md`, `.docs/OBSERVABILITY.md`, `.docs/QA.md`, `.docs/DEVELOPMENT.md`, `.adrs/`
