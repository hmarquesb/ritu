# 021 · Limites e degradação · Plano

Spec: `.specs/021-limites-e-degradacao.md`. Trilha adiantada (branch `entrega-4`, que saiu da `entrega-3`), com a exceção da dona (2026-11-16): a 018 vale como `implemented` pela `entrega-3`.

Lacunas resolvidas pelo orquestrador (registradas em `DECISOES-AUTONOMAS.md`, 021 A1 a A5):

- **A1** A 019 e a 020 não estão nesta branch (não há `useCasa`, hook de Como ficou?, `useVoce` nem as rotas delas). O limite de toque entra em `criarRota` e `criarRotaDeFluxo` pelo método (padrão `toque` em `POST`), então as rotas da 019 e da 020 herdam o limite quando chegarem. O `toast` de toque desta spec vai para a Conversa e o onboarding; o E2E de toques usa a Conversa (voto) no lugar de Minha casa. Na junção com a 019/020, uma tarefa de correção põe `textoDoLimite` + `toast` nos hooks delas.
- **A2** As rotas recebem IP, escopo e teto do e2e por uma função nova em `DepsDaRota`: `quemPede(request)`. `depsReais()` a implementa com `ipDoPedido`, `hashDoIp` e `RITU_MODO`; os testes passam um fake.
- **A3** Toques e `retryAfterS` usam o fuso padrão (`config.clima.fusoPadrao`), sem ler o perfil em cada `POST`. Só `estadoDosLimites` (hora da virada) usa `perfil.cidade_fuso ?? fusoPadrao`.
- **A4** `test:db` é ⚠️ e não roda na trilha adiantada (como na 017 e na 018): o contrato estendido roda contra o fake em memória; o Postgres fica para a junção.
- **A5** `x-ritu-e2e-cota` entra por um embrulho do router em `src/infra/e2e/cota.ts` (`createRouterE2e`), ligado no container só com `RITU_MODO=e2e`, como o ledger por escopo.

Contratos comuns (copiados da spec, valem para várias tarefas):

```ts
// src/core/limits/estado.ts (tipos)
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

// src/core/limits/erros.ts
export class LimiteError extends RituError {}
// code: "limite_mensagens" | "limite_demo" | "limite_ip" | "limite_toques"; campo `retryAfterS: number`
```

Chaves da tabela `limites` (o `escopo` do modo e2e entra como prefixo `${escopo}:`, como em `src/core/accounts/entrar.ts`):

| Chave | Janela | `inicio` | Teto |
|---|---|---|---|
| `msg:conta:<id>` | dia | `diaLocal(agora, fusoPadrao)` | `googlePorDia` |
| `msg:demo:<id>` | dia | `diaLocal(conta.criado_em, fusoPadrao)` | `demoPorConta` |
| `msg:ip:<hmac>` | dia | hoje | `porIpPorDia` |
| `toque:conta:<id>` | minuto | `janelaDoMinuto(agora)` | `porContaPorMinuto` |
| `toque:conta:<id>` | dia | hoje | `porContaPorDia` |
| `toque:ip:<hmac>` | dia | hoje | `porIpPorDia` |

---

### T1 · Add the usage limits and the limit texts to the config
- nivel: mecanica
- objetivo: pôr os números dos limites de mensagem e de toque e os textos das telas de limite na configuração.
- arquivos: `config/limites.ts`, `config/textos-limites.ts` (novo), `config/index.ts`, `config/index.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // config/limites.ts: acrescentar, sem mudar o que existe
  mensagens: { googlePorDia: 30, demoPorConta: 12, porIpPorDia: 60, avisarComRestantes: 3 },
  toques: { porContaPorMinuto: 60, porContaPorDia: 300, porIpPorDia: 1500 },
  ```
  `config/textos-limites.ts` exporta `textosLimites` (`as const`), incluído em `config/index.ts` como `textosLimites`, com estas chaves aninhadas e textos exatos:
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
- testes primeiro: em `config/index.test.ts`, `config.limites.mensagens` e `config.limites.toques` com os valores acima; `config.textosLimites.cota.faixa` contém `{hora}`; `restam.varias` e `restam.variasDemo` contêm `{n}`; nenhum texto vazio.
- comandos: `npm run typecheck`, `npx vitest run config`, `rtk bypass npm run lint`
- pronto quando: testes verdes; valores e textos exatamente como acima.
- fora: qualquer arquivo de `src/`.

### T2 · Let the usage limiter take a start per key and clean minute rows
- nivel: mecanica
- objetivo: o `UsageLimiter` aceita `inicio` próprio por chave e a limpeza apaga também as linhas de minuto de dias anteriores.
- arquivos: `src/core/limits/ports.ts`, `src/infra/fakes/memory-limiter.ts`, `src/infra/fakes/memory-limiter.test.ts`, `src/infra/db/limits.ts`, `test/contracts/limits.contract.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1, linha 23 (rate limit no Postgres com IP em HMAC)
- contratos:
  ```ts
  consumir(
    pedidos: { chave: string; teto: number; inicio?: string }[],   // `inicio` próprio por chave; sem ele, vale o da chamada
    janela: Janela,
    inicio: string,
  ): Promise<{ ok: true } | { ok: false; chave: string }>
  apagarAntesDe(inicio: string): Promise<number>     // linhas "dia" com início menor e linhas "minuto" de dias anteriores
  ```
  Atomicidade continua: soma 1 em todas as chaves ou em nenhuma. `inicio` de dia é `AAAA-MM-DD`; o de minuto é ISO (`2026-11-16T13:05:00.000Z`); "minuto de dia anterior" = início de minuto cujo dia (os 10 primeiros caracteres) é menor que `inicio`.
- testes primeiro: na suíte de contrato `test/contracts/limits.contract.ts` (roda contra o fake no `npm test` e contra o Postgres no `test:db`): `inicio` por chave (duas chaves, dois inícios, `usado` de cada um no seu início); atomicidade com dois inícios diferentes (uma no teto → nenhuma soma); `apagarAntesDe("2026-11-16")` apaga dia `2026-11-15`, minuto `2026-11-15T23:59:00.000Z`, e mantém dia `2026-11-16` e minuto `2026-11-16T00:01:00.000Z`.
- comandos: `npm run typecheck`, `npx vitest run src/infra/fakes test/contracts`, `rtk bypass npm run lint`. **Não** rodar `npm run test:db` (⚠️; fica para a junção).
- pronto quando: contrato verde no fake; o adaptador Postgres implementa o mesmo (SQL com `inicio` por linha num único comando atômico, como hoje); quem chama `consumir` sem `inicio` por chave continua igual.
- fora: `src/core/accounts/`, migrações (a tabela não muda).

### T3 · Tell when the day quota of a role is gone and when it comes back
- nivel: mecanica
- objetivo: `ModelRouter.cotaDoDiaEsgotada`, `viradaDaCota` e `horaLocal` em texto.
- arquivos: `src/core/llm/router.ts`, `src/core/llm/router.test.ts`, `src/core/llm/janelas.ts`, `src/core/llm/janelas.test.ts`, `evals/det/modelos/sem-modelo.eval.ts`, e todo arquivo que monta um objeto tipado como `ModelRouter` e passe a falhar no typecheck (hoje: `src/core/agents/companion/responder.test.ts`, `src/core/conversation/continuar.test.ts`; procure com `grep -rn "ModelRouter" src evals scripts`)
- depende de: nenhuma
- leitura: `AI.md` §10, só a parte "Regras" (dia da cota e 429)
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // ModelRouter ganha
  cotaDoDiaEsgotada(papel: Papel): Promise<boolean>
  // verdadeiro quando todo modelo do papel tem `uso.dia.pedidos >= rpd` ou `esgotado_ate === "dia"`. A cota do minuto não conta.

  // src/core/llm/janelas.ts acrescenta
  export function viradaDaCota(agora: Date): Date                 // próxima meia-noite em llmCotas.fusoDoDia
  export function horaLocal(data: Date, fuso: string): string     // "5h"; com minutos, "5h30"; "13h30" em Asia/Kolkata
  ```
  `UsoDoModelo` vem de `src/core/llm/ledger.ts` (`dia`, `esgotado_ate`). `horaLocal` de `janelas.ts` não é a de `src/core/weather/hora-local.ts` (que devolve número): não mexa nesta.
- testes primeiro: `cotaDoDiaEsgotada("decisao")` falso com a cota do minuto cheia em todos; verdadeiro com a cota do dia cheia em todos; falso com um modelo do papel ainda livre; verdadeiro com `esgotado_ate: "dia"` em todos. `viradaDaCota` devolve a próxima meia-noite de `America/Los_Angeles`; `horaLocal(viradaDaCota(agora), "America/Sao_Paulo")` é `"5h"` numa data de horário padrão do Pacífico (ex.: 2026-01-15) e `"4h"` numa de horário de verão (ex.: 2026-07-15); `Asia/Kolkata` dá minutos (`"13h30"`). Os quatro casos de `cotaDoDiaEsgotada` também entram em `evals/det/modelos/sem-modelo.eval.ts`.
- comandos: `npm run typecheck`, `npx vitest run src/core/llm`, `npm run eval:det -- evals/det/modelos`, `rtk bypass npm run lint`
- pronto quando: testes e eval verdes; nenhum `new Date()` no core (use o `agora` recebido).
- fora: `src/core/llm/sem-modelo.ts`, `src/core/llm/textos.ts`, `src/infra/`.

### T4 · Add the limit metric and its panel stat
- nivel: mecanica
- objetivo: métrica `ritu_limite_total` e o stat "Limites atingidos" no painel.
- arquivos: `src/core/telemetry/nomes.ts`, `scripts/lib/painel.ts`, `scripts/lib/painel.test.ts` (se travar contagem de painéis), `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml` (gerados por `npm run painel:gerar`), e o teste que trava a lista de métricas, se houver (`grep -rn "ritu_fallback_sem_llm_total" src/core/telemetry evals/det/telemetria`)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `METRICAS` ganha `ritu_limite_total: { tipo: "contador", rotulos: ["tipo", "motivo", "resultado"] }` (`tipo`: `mensagem`, `toque`; `motivo`: `conta`, `demo`, `ip`, `minuto`, `dia`; `resultado`: `barrado`, `so_atalhos`, `alerta`). `ATRIBUTOS_PERMITIDOS` não muda. Painel, linha "1. Saúde": novo stat "Limites atingidos", consulta `TOTAL(ritu_limite_total, resultado)` (use o mesmo ajudante de soma que os outros stats da linha usam, com `por = ["resultado"]`). Nenhum span e nenhum log novos.
- testes primeiro: a métrica existe com os três rótulos; o painel gerado tem o stat na linha 1; o teste que trava o gerado continua verde depois de `npm run painel:gerar`.
- comandos: `npm run painel:gerar`, `npm run typecheck`, `npx vitest run src/core/telemetry scripts/lib`, `npm run eval:det -- evals/det/telemetria`, `rtk bypass npm run lint`
- pronto quando: tudo verde; os gerados não editados à mão.
- fora: emitir a métrica em qualquer lugar (isso é T6/T7).

### T5 · Recognize testers by Google e-mail at sign-in
- nivel: mecanica
- objetivo: `TESTER_IDS` com e-mails; `entrarComGoogle` grava `contas.tester` ao entrar.
- arquivos: `src/core/accounts/email.ts` (novo), `src/core/accounts/email.test.ts` (novo), `src/core/accounts/entrar.ts`, `src/core/accounts/entrar.test.ts`, `src/core/accounts/ports.ts`, `src/infra/db/accounts.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/accounts.contract.ts`, `src/infra/env.ts`, `src/infra/env.test.ts`, `src/infra/auth/next.ts`, `.env.example`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `normalizarEmail(e: string): string` em `src/core/accounts/email.ts`: minúsculas, sem espaços nas pontas.
  - `entrarComGoogle` recebe nas dependências `testers: string[]` (e-mails já normalizados): `deps: { stores: Stores; telemetry: Telemetry; testers: string[] }`. Depois de achar ou criar a conta (inclusive no caminho da corrida), se `testers.includes(normalizarEmail(email)) !== conta.tester`, chama `accounts.marcar(id, { tester })` e devolve a conta com o `tester` novo.
  - `AccountRepository.marcar` aceita `tester` no `Partial<Pick<Conta, …>>`; Postgres e fake gravam.
  - `src/infra/env.ts`: `testers(env: EnvSource = process.env): string[]` lê `TESTER_IDS` separado por vírgula, com `normalizarEmail`, sem itens vazios. A descrição no catálogo passa a ser "E-mails do Google, separados por vírgula, sem limite de uso." O nome da variável não muda. `.env.example`: o comentário de `TESTER_IDS` com o mesmo texto.
  - `src/infra/auth/next.ts` passa `testers: testers()` a `entrarComGoogle`.
- testes primeiro: `normalizarEmail(" Ana@X.com ")` → `"ana@x.com"`; `testers` com `" A@x.com, ,b@y.com"` → `["a@x.com","b@y.com"]`, ausente ou vazio → `[]`; entrar com e-mail na lista (maiúsculas e espaços) → `tester: true`; conta tester que sai da lista → `tester: false` na próxima entrada; sem mudança → `marcar` não é chamado; contrato: `marcar(id, { tester: true })` e `buscar` devolve `tester: true`.
- comandos: `npm run typecheck`, `npx vitest run src/core/accounts src/infra/env.test.ts src/infra/fakes test/contracts`, `npm run env:check`, `rtk bypass npm run lint`
- pronto quando: tudo verde; e-mail só é comparado dentro de `entrarComGoogle`.
- fora: `src/core/limits/`, rotas.

### T6 · Write the limit keys, the limit error and the touch limit
- nivel: mecanica
- objetivo: funções puras de chave, o erro de limite, os tipos do estado e `consumirToque`.
- arquivos: `src/core/limits/erros.ts`, `src/core/limits/chaves.ts`, `src/core/limits/chaves.test.ts`, `src/core/limits/estado.ts` (só os tipos), `src/core/limits/toques.ts`, `src/core/limits/toques.test.ts` (todos novos), e `evals/det/telemetria/cobertura.eval.ts` (um cenário de toque barrado que emite `ritu_limite_total`, 021 A6)
- depende de: T1, T2, T4
- leitura: `BUSINESS.md` §14
- skills: nenhuma
- referencia: nenhuma
- contratos: os "Contratos comuns" e a tabela de chaves do topo deste plano (copie os tipos para `estado.ts` e `erros.ts`; `LimiteError` recebe `(code, retryAfterS)` e expõe `retryAfterS: number`), e:
  ```ts
  // chaves.ts (puras). Pedido = { chave: string; teto: number; inicio?: string } (o pedido de `UsageLimiter.consumir`)
  export function chavesDeMensagem(conta: Conta, ipHash: string, agora: Date, escopo?: string, teto?: number): { conta: Pedido; ip: Pedido }
  // conta comum: msg:conta:<id>, inicio hoje, teto googlePorDia; demo: msg:demo:<id>, inicio diaLocal(criado_em, fusoPadrao), teto demoPorConta
  export function chavesDeToque(conta: Conta, ipHash: string, agora: Date, escopo?: string, teto?: number): { minuto: Pedido; dia: Pedido; ip: Pedido }
  export function segundosAte(agora: Date, alvo: Date): number     // arredonda para cima; mínimo 1

  // toques.ts
  export function consumirToque(deps: DepsDosLimites, q: QuemPede): Promise<{ ok: true } | { ok: false; erro: LimiteError }>
  ```
  Ordem de `consumirToque`: `conta.tester` → `ok` (sem consumir). `limiter.consumir([minuto], "minuto", janelaDoMinuto(agora))`; barrou: `LimiteError("limite_toques", segundosAte(agora, próximo minuto))`. `limiter.consumir([dia, ip], "dia", hoje)`; barrou: erro com `retryAfterS` até a próxima meia-noite local no fuso padrão. Barrado soma `telemetry.contador("ritu_limite_total", { tipo: "toque", motivo: "minuto" | "dia" | "ip", resultado: "barrado" })` (motivo `ip` quando a chave que barrou é a do IP). `hoje = diaLocal(agora, config.clima.fusoPadrao)` (`src/core/time/dia-local.ts`); `janelaDoMinuto` de `src/core/llm/janelas.ts`. Tempo só pelo `clock`.
- testes primeiro (com `createMemoryLimiter`, `createMemoryTelemetry`, clock fixo): chaves com e sem escopo; demo com `criado_em` às 23h50 do dia anterior usa o dia da criação; `teto` substitui todos os tetos; `segundosAte` arredonda para cima e nunca dá 0; 61º toque no minuto barrado com `retryAfterS` até o próximo minuto; 301º do dia barrado com `retryAfterS` até a meia-noite; IP com teto reduzido barra com motivo `ip`; tester nunca barra nem soma; rótulos da métrica só `tipo`, `motivo`, `resultado`.
- comandos: `npm run typecheck`, `npx vitest run src/core/limits`, `rtk bypass npm run lint`
- pronto quando: tudo verde; nada de IP, hash ou conta em rótulo.
- fora: `mensagens.ts` e `estadoDosLimites` (T7), rotas.

### T7 · Decide each message and read the limits state
- nivel: mecanica
- objetivo: `decidirMensagem` e `estadoDosLimites`.
- arquivos: `src/core/limits/mensagens.ts`, `src/core/limits/mensagens.test.ts` (novos), `src/core/limits/estado.ts`, `src/core/limits/estado.test.ts` (novo)
- depende de: T3, T6
- leitura: `BUSINESS.md` §14
- skills: nenhuma
- referencia: nenhuma
- contratos: os "Contratos comuns" do topo deste plano, e:
  ```ts
  // estado.ts
  export function estadoDosLimites(deps: DepsDosLimites, q: QuemPede): Promise<EstadoDosLimites>
  // Tester: mensagens "livre". Senão lê `usado` das chaves de mensagem; restantes = menor de (teto − usado) entre a conta (ou a demo) e o IP;
  // 0 ou menos: "esgotadas", com o motivo da conta (conta ou demo) antes do IP. cota_ia por `router.cotaDoDiaEsgotada("decisao")`;
  // esgotada: volta_as = horaLocal(viradaDaCota(agora), q.fuso). Não chama modelo.

  // mensagens.ts
  export type DecisaoDaMensagem =
    | { seguir: "normal" }                                        // contou, tester ou cota de IA esgotada
    | { seguir: "so_atalhos"; motivo: MotivoDoLimite }            // não contou; `conversar` com semModelo "limite"
    | { seguir: "alerta"; motivo: MotivoDoLimite }                // não contou; `conversar` normal (o guardrail por código responde)
    | { barrar: LimiteError }
  export function decidirMensagem(deps: DepsDosLimites, q: QuemPede, m: MensagemRecebida): Promise<DecisaoDaMensagem>
  ```
  `MensagemRecebida` vem de `src/core/conversation/conversar.ts` (reexporta de `src/core/messages/texto`); importe de `@/core/messages/texto` para não criar ciclo de domínio. Ordem:
  1. `conta.tester`: `normal`.
  2. `router.cotaDoDiaEsgotada("decisao")`: `normal`, sem consumir.
  3. `limiter.consumir([conta ou demo, ip], "dia", hoje)` (com `chavesDeMensagem`). Passou: `normal`.
  4. Barrou (motivo pela chave: `msg:conta` → `conta`, `msg:demo` → `demo`, `msg:ip` → `ip`): sem texto (só atalhos) → `so_atalhos`; com texto e `conferirEntrada(texto).resultado === "alerta"` (`src/core/guardrails/entrada.ts`) → `alerta`; senão → `barrar` com `limite_mensagens`, `limite_demo` ou `limite_ip` e `retryAfterS` até a meia-noite local (fuso padrão; para a demonstração, até `conta.expira_em`).
  5. Soma `ritu_limite_total{tipo: "mensagem", motivo, resultado}` nos casos do passo 4 (`so_atalhos`, `alerta`, `barrado`).
- testes primeiro: 31ª mensagem Google barrada `limite_mensagens`; 13ª da demo barrada `limite_demo` com o clock no dia seguinte; IP com 60 de contas diferentes barra `limite_ip` e a conta não soma; conta barra e o IP não soma; tester `normal` sem somar; cota do dia esgotada `normal` sem somar; só atalhos depois do limite → `so_atalhos`; "tô com uma dor forte no peito" e "não aguento mais, queria sumir" → `alerta`; "quero um chá" → `barrar`; `estadoDosLimites`: tester `livre`; restantes pela menor folga; esgotadas com motivo conta antes do IP; `cota_ia` esgotada com `volta_as` "5h" em `America/Sao_Paulo` em janeiro.
- comandos: `npm run typecheck`, `npx vitest run src/core/limits`, `npm test -- src/architecture`, `rtk bypass npm run lint`
- pronto quando: tudo verde; teste de arquitetura sem ciclo novo.
- fora: rotas, `conversar`.

### T8 · Answer from the base when the person's messages ran out
- nivel: nucleo
- objetivo: modo `semModelo: "limite"` em `conversar`, `companion.responder` e `respostaSemModelo`.
- arquivos: `src/core/llm/sem-modelo.ts`, `src/core/llm/sem-modelo.test.ts`, `src/core/llm/textos.ts`, `src/core/agents/companion/responder.ts`, `src/core/agents/companion/fim-do-run.ts`, `src/core/agents/companion/responder.test.ts`, `src/core/conversation/conversar.ts`, `src/core/conversation/conversar.test.ts` (ou o arquivo de teste existente de `conversar`)
- depende de: T3
- leitura: `AI.md` §3, só o caminho `sem_modelo`
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `respostaSemModelo` ganha `motivo?: "cota" | "limite"` na entrada (padrão `cota`). Com `limite` e estados, a abertura (nova constante em `src/core/llm/textos.ts`) é exatamente: "Suas mensagens de hoje acabaram, mas os atalhos continuam. Separei direto da base o que costuma ajudar quando a pessoa está {estados}:". Sem estados, o texto é o mesmo de `cota`.
  - `conversar(contaId, m, opts)`: `opts` ganha `semModelo?: "limite"`. Com ele, `conversar` cria o run como sempre, pula o guardrail e o Intérprete e vai direto ao passo sem modelo, passando `motivo: "limite"` a `companion.responder`. Mensagem com texto e `semModelo: "limite"` lança `RituError("mensagem_invalida", …)`.
  - `companion.responder` passa o `motivo` a `respostaSemModelo` e só soma `ritu_fallback_sem_llm_total` quando o motivo não é `limite` (hoje a soma está em `responder.ts` e em `fim-do-run.ts`: as duas obedecem).
  - Run em `waiting_for_input` ou `waiting_for_approval`: enviar só atalhos com `semModelo: "limite"` cancela a pendência como no caminho normal.
- testes primeiro: com `semModelo: "limite"` e atalhos: run `done`, caminho `sem_modelo`, nenhuma chamada ao fake de LLM nem ao runtime, até 3 práticas, abertura de "limite", `ritu_fallback_sem_llm_total` parado; com texto → `mensagem_invalida`; sem a opção, os caminhos da 008 seguem iguais (testes existentes verdes).
- comandos: `npm run typecheck`, `npx vitest run src/core/llm src/core/agents/companion src/core/conversation`, `npm run eval:det -- evals/det/conversa evals/det/modelos`, `rtk bypass npm run lint`
- pronto quando: tudo verde; `conversar` não conhece conta comum, tester nem IP.
- fora: `src/core/limits/`, rotas, `router.ts`.

### T9 · Count a touch in every POST route and answer 429
- nivel: nucleo
- objetivo: `criarRota` e `criarRotaDeFluxo` consomem um toque em todo `POST` com conta e convertem `LimiteError` em `429` com `Retry-After`.
- arquivos: `src/app/_lib/rota.ts`, `src/app/_lib/rota.test.ts`, `src/app/_lib/fluxo.ts`, `src/app/_lib/fluxo.test.ts`, `src/app/_lib/deps.ts`, e os testes e evals que montam `DepsDaRota` (`src/app/_rotas/conversa.test.ts`, `src/app/_rotas/onboarding.test.ts`, `src/app/_rotas/fluxo-de-run.test.ts`, `src/app/_rotas/busca.test.ts`, `evals/det/seguranca/sessao.eval.ts`, `evals/det/seguranca/conversa.eval.ts`), só para acrescentar `quemPede`
- depende de: T6
- leitura: `ARCHITECTURE.md` §4 ("Proteção do site"); `DEVELOPMENT.md` §"Camadas e importações"
- skills: `next-best-practices` (só `route-handlers.md`)
- referencia: nenhuma
- contratos:
  - `DepsDaRota` ganha `quemPede(request: Request): { ipHash: string; escopo?: string; teto?: number }`. `depsReais()` implementa: `modoE2e = optionalEnv("RITU_MODO") === "e2e"`; `ipHash = hashDoIp(ipDoPedido(request.headers, modoE2e), requireEnv("IP_HMAC_SECRET"))` (de `src/infra/auth/ip.ts`); `escopo` = header `x-ritu-e2e` só no modo e2e; `teto` = header `x-ritu-e2e-teto` (inteiro de 1 a 100) só no modo e2e. Fora do modo e2e, os dois headers são ignorados.
  - `criarRota` e `criarRotaDeFluxo` ganham `opts.limite?: "toque" | "nenhum"`. Padrão: `toque` para `POST` (`request.method`), `nenhum` para os outros. Com `toque`, depois da sessão, da conta e do corpo válidos e antes de `fn`, chamam `consumirToque({ limiter, router, clock, telemetry } do container, { conta, ipHash, fuso: config.clima.fusoPadrao, escopo, teto })`; barrado: `429 { erro: "limite_toques" }` com o header `Retry-After: <retryAfterS>`; nada de `fn` roda.
  - `LimiteError` lançado por `fn` também vira `429` com `Retry-After` e `{ erro: <code> }` (reconheça pelo `ehRituError` e leia `retryAfterS` do objeto, porque o Next carrega cópias dos módulos). Em `statusDoErro`, os quatro códigos `limite_*` → 429.
  - `Contexto` (e o contexto de fluxo) ganha `ipHash: string`, `escopo?: string` e `teto?: number`.
- testes primeiro: `POST` com teto 0 (limiter cheio) → `429 limite_toques` com `Retry-After`, `fn` não roda; `GET` nunca consome; `limite: "nenhum"` não consome; tester não consome; `fn` lançando `LimiteError("limite_ip", 30)` → `429` com `Retry-After: 30`; corpo inválido → `400` sem consumir; `criarRotaDeFluxo` com toque barrado responde `429` JSON antes de abrir o fluxo.
- comandos: `npm run typecheck`, `npx vitest run src/app`, `npm run eval:det -- evals/det/seguranca`, `npm test -- src/architecture`, `rtk bypass npm run lint`
- pronto quando: tudo verde; nenhum IP, hash ou conta em log, span ou métrica.
- fora: `POST /api/runs` (T10), telas.

### T10 · Decide the message limit in POST /api/runs and send limits to the screen
- nivel: nucleo
- objetivo: `POST /api/runs` decide o limite antes do fluxo; `GET /api/conversa`, a página `/conversa` e o evento `fim` levam `limites`.
- arquivos: `src/app/_rotas/fluxo-de-run.ts`, `src/app/_rotas/fluxo-de-run.test.ts`, `src/app/_rotas/conversa.ts`, `src/app/_rotas/conversa.test.ts`, `src/core/conversation/do-dia.ts`, `src/core/conversation/do-dia.test.ts` (se existir), `src/core/conversation/eventos.ts`, `src/app/(app)/conversa/page.tsx`
- depende de: T7, T8, T9
- leitura: `ARCHITECTURE.md` §3, passos 2 e 3 do fluxo de um run
- skills: `next-best-practices` (só `route-handlers.md`)
- referencia: nenhuma
- contratos:
  ```ts
  export type ConversaDoDia = { /* … o que já tem */ limites: EstadoDosLimites }
  export type EventoDaTela = /* … */ | { tipo: "fim"; visao: VisaoDoRun; pendentes: number; limites: EstadoDosLimites }
  export function conversaDoDia(deps: { stores: Stores; clock: Clock; seed: DemoSeed; limiter: UsageLimiter; router: ModelRouter; telemetry: Telemetry }, conta: Conta, perfil: Perfil, quem: { ipHash: string; escopo?: string; teto?: number }): Promise<ConversaDoDia>
  ```
  - `fuso` do `QuemPede` em `estadoDosLimites`: `perfil.cidade_fuso ?? config.clima.fusoPadrao` (no `emitirFim`, leia o perfil pelo store de perfis).
  - `POST /api/runs` usa `criarRotaDeFluxo(…, { corpo: mensagemRecebidaSchema, limite: "nenhum" }, …)` e, antes de emitir qualquer coisa:
    1. `stores.runs.aberto(conta.id)` com status `running`: lança o erro `run_aberto` (`409`), sem consumir.
    2. `decidirMensagem`. `barrar`: resposta `429 { erro: <code>, limites: EstadoDosLimites }` com `Retry-After` (o corpo leva `limites`, então trate esse caso antes de abrir o fluxo, sem passar pelo `falhar` genérico).
    3. `so_atalhos` chama `conversar(…, { semModelo: "limite", aoVivo, aoCriar })`; `normal` e `alerta`, como hoje.
    4. O evento `fim` leva `limites` (`estadoDosLimites` depois do run).
  - `POST /api/runs/:id/resposta`: conta como toque (padrão); `fim` com `limites`.
  - `GET /api/conversa` e a página `/conversa` passam `quem` (a página tira o IP de `headers()` com `ipDoPedido` e `hashDoIp`, e escopo e teto como em `depsReais().quemPede`; reaproveite um ajudante comum se couber, sem duplicar).
- testes primeiro: 31ª mensagem → `429 limite_mensagens` com `limites` e `Retry-After`, sem run nem mensagem gravados; run `running` → `409 run_aberto` e a contagem não sobe; corpo inválido → `400` sem consumir; só atalhos depois do limite → fluxo com `fim` de caminho `sem_modelo`; alerta depois do limite → texto de alerta; cota do dia esgotada → não consome; `fim` traz `limites` com `restantes` atualizado; `GET /api/conversa` traz `limites`.
- comandos: `npm run typecheck`, `npx vitest run src/app src/core/conversation`, `npm run eval:det -- evals/det/conversa evals/det/seguranca`, `rtk bypass npm run lint`
- pronto quando: tudo verde; `conversar` não conhece limite.
- fora: telas, `src/infra/e2e/`.

### T11 · Let E2E tests force the day quota out per request
- nivel: nucleo
- objetivo: header `x-ritu-e2e-cota: esgotada` faz o router do container e2e responder cota do dia esgotada naquele pedido.
- arquivos: `src/infra/e2e/cota.ts`, `src/infra/e2e/cota.test.ts`, `src/infra/container.ts`, `src/infra/container.test.ts` (se precisar)
- depende de: T3
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `createRouterE2e(router: ModelRouter, cotaEsgotada: () => Promise<boolean>): ModelRouter` em `src/infra/e2e/cota.ts`: com `cotaEsgotada()` verdadeiro, `cotaDoDiaEsgotada("decisao") === true` e `temModelo("decisao") === false`; o resto delega. `cotaEsgotadaNoPedidoNext()` lê `x-ritu-e2e-cota === "esgotada"` dos `headers()` do Next (fora de pedido, `false`), como `escopoDoPedidoNext`. O container embrulha o router com isso **só** com `RITU_MODO=e2e`, antes de entregá-lo ao companion, ao intérprete e à conversa. Fora do modo e2e, o header é ignorado.
- testes primeiro: o embrulho com o leitor verdadeiro e falso; outros papéis não mudam; fora do e2e o container usa o router puro.
- comandos: `npm run typecheck`, `npx vitest run src/infra`, `rtk bypass npm run lint`
- pronto quando: tudo verde.
- fora: `src/app/`, `src/core/`.

### T12 · Build the quota banner, the spent box, the remaining note and the touch text
- nivel: tela
- objetivo: componentes `FaixaDeCota`, `CaixaEsgotada`, `MensagensRestantes` e a função `textoDoLimite`.
- arquivos: `src/components/ritu/conversa/faixa-cota.tsx`, `src/components/ritu/conversa/caixa-esgotada.tsx`, `src/components/ritu/conversa/restantes.tsx`, `src/components/ritu/limites.ts`, `src/components/ritu/limites.test.ts` (todos novos)
- depende de: T1, T6
- leitura: `DESIGN.md` §3 (regras e acessibilidade); `DEVELOPMENT.md` §"UI"
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos (textos de `config.textosLimites`, tipos de `@/core/limits/estado` com `import type`):
  | Arquivo | Exporta | O que é |
  |---|---|---|
  | `faixa-cota.tsx` | `FaixaDeCota({ voltaAs })` | `aside` com `aria-label` de `cota.rotulo`, `Surface` em `amber-soft`, ícone `Hourglass` (Phosphor, `light`) e o texto `cota.faixa` com `{hora}` trocado. Texto parado |
  | `caixa-esgotada.tsx` | `CaixaEsgotada({ motivo, googleDisponivel, entrarComGoogleAcao?, textoGuardado? })` | `StateBlock kind="quota"` com título e texto de `esgotadas.<motivo>`; na demonstração com Google, o botão `esgotadas.demo.google` num `form action={entrarComGoogleAcao}` (como em `src/components/ritu/demo-banner.tsx`); com `textoGuardado`, o rótulo `esgotadas.textoGuardado` e o texto em `surface-sunken`, só leitura e selecionável |
  | `restantes.tsx` | `MensagensRestantes({ estado, id })` | Texto `ink-muted` com `id` (para o `aria-describedby` do campo); só com `contando` e `restantes <= config.limites.mensagens.avisarComRestantes`; texto `restam.varias`/`uma`/`variasDemo`/`umaDemo` |
  | `src/components/ritu/limites.ts` | `textoDoLimite(erro: string, retryAfterS?: number): string \| undefined` | `limite_toques` com `Retry-After` de até 60 s → `toques.minuto`; maior → `toques.dia`; outros códigos → `undefined` |
  Componentes base de `src/components/base/` (`StateBlock`, `Surface`, `Button`); só classes de token; texto da pessoa como texto puro.
- testes primeiro: `limites.test.ts`: `textoDoLimite("limite_toques", 30)` → minuto; `("limite_toques", 3600)` → dia; `("limite_toques")` sem retry → dia; `("limite_ip")` → `undefined`.
- comandos: `npm run typecheck`, `npx vitest run src/components`, `npm test -- design-guard`, `rtk bypass npm run lint`
- pronto quando: tudo verde; nenhum `dark:`, cor literal nem `px` em texto.
- fora: `caixa.tsx`, `conversa.tsx`, `use-conversa.ts` (T13/T14).

### T13 · Keep the limits state in the conversation hook
- nivel: nucleo
- objetivo: `useConversa` e o redutor guardam `limites`, tratam `429` no envio e mostram o aviso de toques.
- arquivos: `src/components/ritu/conversa/estado.ts`, `src/components/ritu/conversa/estado.test.ts`, `src/components/ritu/conversa/use-conversa.ts`
- depende de: T10, T12
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - O estado ganha `limites: EstadoDosLimites` (da `ConversaDoDia` inicial e de cada evento `fim`) e `textoGuardado?: string` (só em memória).
  - `POST /api/runs` volta `429` com `limites` no corpo (outra aba gastou): o estado troca para esses `limites` sem recarregar, o texto escrito vai para `textoGuardado` e a fala otimista sai.
  - Qualquer `429` em toque da Conversa (resposta, aprovação, voto, troca) com `textoDoLimite(erro, Number(Retry-After))` definido → `toast` com o texto (`src/components/base/toast.tsx`); a tela não muda (a ação otimista é desfeita).
  - O hook expõe `limites` e `textoGuardado` para a tela.
- testes primeiro (redutor puro): inicial com `limites`; `fim` troca `limites`; recusa `429` com `limites` guarda o texto e desfaz a fala otimista.
- comandos: `npm run typecheck`, `npx vitest run src/components`, `rtk bypass npm run lint`
- pronto quando: tudo verde.
- fora: `caixa.tsx`, `conversa.tsx`.

### T14 · Show the limits in the conversation screen
- nivel: tela
- objetivo: a Conversa mostra a faixa da cota, a caixa esgotada com os atalhos e o aviso de restantes.
- arquivos: `src/components/ritu/conversa/caixa.tsx`, `src/components/ritu/conversa/conversa.tsx`, `src/app/(app)/conversa/page.tsx` (só para passar `googleDisponivel` e `entrarComGoogleAcao`, se ainda não chegam)
- depende de: T13
- leitura: `DESIGN.md` §3; `DEVELOPMENT.md` §"UI"
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos:
  - `CaixaDeMensagem` recebe `limites` e `textoGuardado`. Com `esgotadas`, o `TextField` e o contador saem, `CaixaEsgotada` entra acima dos atalhos, e o botão vira `textosLimites.atalhos.enviar` ("Ver práticas"), com `aria-disabled` sem atalho marcado (motivo `caixa.vazia` da 018). Os atalhos nunca somem.
  - `MensagensRestantes` abaixo da caixa, ligado ao campo por `aria-describedby`; tester (`livre`) não vê.
  - `FaixaDeCota` logo abaixo do `DemoBanner`, acima da lista, com `limites.cota_ia.esgotada`; some no `fim` com `esgotada: false`. Quando aparece depois do carregamento (pelo `fim`), o texto vai uma vez para a região de anúncio da 018.
  - Demonstração: `CaixaEsgotada` com `motivo: "demo"` mostra o botão Google só com `googleDisponivel`.
- testes primeiro: nenhum novo no Vitest (E2E na T16).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: tudo verde; o bloco esgotado é texto parado e o botão é alcançável por teclado.
- fora: `use-conversa.ts`, `estado.ts`.

### T15 · Show the touch limit notice in the onboarding
- nivel: tela
- objetivo: `429 limite_toques` nos passos do onboarding mostra o `toast` e a tela não muda.
- arquivos: `src/app/(comecar)/_lib/enviar-passo.ts`, `src/app/(comecar)/comecar/quiz/quiz.tsx` (e os outros componentes do onboarding que chamam `enviarPasso` ou `fetch` em `POST`, se precisarem tratar o retorno)
- depende de: T12
- leitura: `DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos: com `429` e `textoDoLimite(erro, Number(Retry-After))` definido (`src/components/ritu/limites.ts`), `toast(texto)` (`src/components/base/toast.tsx`) e o passo fica onde está (sem navegar, sem mensagem de erro genérica). Outros erros seguem como hoje.
- testes primeiro: nenhum novo no Vitest (E2E na T17).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`
- pronto quando: tudo verde.
- fora: as rotas.

### T16 · Cover the limits with deterministic evals
- nivel: mecanica
- objetivo: evals determinísticos dos limites, da degradação e da privacidade, e o mapa.
- arquivos: `evals/det/seguranca/limites.eval.ts` (novo), `evals/det/conversa/degradacao.eval.ts`, `evals/det/telemetria/privacidade.eval.ts`, `evals/det/mapa.ts`
- depende de: T5, T7, T8, T10
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: os handlers das rotas ficam em `src/app/_rotas/` (fábricas que recebem `DepsDaRota`: `contaDaSessao`, `container`, `quemPede`), testáveis com o container de stores em memória (veja como `evals/det/seguranca/conversa.eval.ts` monta). Casos:
  - `limites.eval.ts`: 31ª mensagem Google `429 limite_mensagens` sem run nem mensagem; 13ª da demonstração `limite_demo` com o clock no dia seguinte; 61ª do IP com contas diferentes `limite_ip`; atomicidade conta e IP; run em `running` → `409` sem consumir; cota de IA do dia esgotada não consome; tester (via `entrarComGoogle` com `testers`) sem limite e sem contagem; tester tirado da lista na entrada seguinte volta a contar; 61º toque do minuto e 301º do dia com `Retry-After` (em `POST /api/runs/:id/voto` e `POST /api/runs/:id/aprovacao`; `/api/casa` não existe nesta branch); toques por IP com teto reduzido; nada gravado nas rotas barradas; **lista de rotas:** o eval lê os `src/app/api/**/route.ts` e confere que todo arquivo que exporta `POST` está numa lista do eval, e para cada `POST` da lista, com teto de toque 0, responde `429 limite_toques`, menos `POST /api/runs`; nenhum `GET` consome.
  - `degradacao.eval.ts` ganha: só atalhos depois do limite (caminho `sem_modelo`, nenhum pedido ao fake de LLM, abertura de "limite", até 3 práticas, nada barrado pelo filtro da pessoa, `ritu_limite_total{resultado: "so_atalhos"}`, `ritu_fallback_sem_llm_total` parado); alerta físico e emocional depois do limite; texto comum depois do limite recusado.
  - Privacidade: a suíte passa também pelos caminhos de limite; nenhum rótulo, atributo ou log com chave, hash, IP ou conta.
  - `mapa.ts`: registra `limites.eval.ts` na família certa.
- testes primeiro: os próprios evals.
- comandos: `npm run eval:det`, `npm run typecheck`, `rtk bypass npm run lint`
- pronto quando: tudo verde; nenhum caso com LLM.
- fora: código de `src/`.

### T17 · Cover the limit screens end to end
- nivel: tela
- objetivo: `e2e/limites.spec.ts` com as telas de limite nos dois temas, em celular e desktop.
- arquivos: `e2e/limites.spec.ts` (novo); `e2e/apoio/` só se precisar de um ajudante novo (arquivo novo)
- depende de: T11, T14, T15
- leitura: `DEVELOPMENT.md` §"Testes" (modo e2e)
- skills: `playwright` não (os testes são `@playwright/test`); `web-design-guidelines`
- referencia: nenhuma
- contratos: modo e2e: `x-ritu-e2e` (escopo), `x-ritu-e2e-teto` (inteiro 1 a 100, substitui todos os tetos de mensagem e de toque do pedido), `x-ritu-e2e-cota: esgotada`. Entra pela demonstração (veja `e2e/conversa.spec.ts` e `e2e/apoio/`). Casos: faixa da cota com a hora ao abrir `/conversa`, a caixa aceita texto; caixa esgotada (demonstração) com e sem o botão Google (o E2E roda sem Google configurado: confira só a ausência, e a presença se o modo e2e permitir); práticas pelos atalhos depois do limite ("Ver práticas"); restantes ("Resta 1 mensagem na demonstração." com teto pequeno); `429` no meio com o texto guardado visível abaixo do bloco; aviso de toques na Conversa (voto) com teto reduzido; `expectSemViolacoes` na faixa e no bloco nos dois temas.
- testes primeiro: o próprio spec.
- comandos: `npm run build`, `CI=1 npm run test:e2e -- e2e/limites.spec.ts` (porta ocupada: espere e repita)
- pronto quando: verde em celular e desktop.
- fora: código de `src/` (falha de tela volta à T14 como correção).

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2, T3, T4, T5 | Sem dependências e sem arquivo em comum; cada uma muda só assinaturas cujos usos estão nos arquivos dela |
| 2 | T6, T8, T11 | T6 precisa de T1, T2, T4; T8 e T11 de T3; arquivos separados |
| 3 | T7, T9, T12 | T7 precisa de T3/T6; T9 e T12 de T6; arquivos separados |
| 4 | T10 | Junta T7, T8, T9; mexe em `eventos.ts` e `do-dia.ts`, usados pela tela |
| 5 | T13, T15, T16 | T13 precisa de T10/T12; T15 de T12; T16 de T5/T7/T8/T10; arquivos separados |
| 6 | T14 | Precisa de T13 |
| 7 | T17 | E2E de tudo |

### T18 · Make the privacy leak evals deterministic (correção)
- nivel: nucleo
- objetivo: o caso `expect(vazamentos(valores, termos)).toEqual([])` falhou em 2 de 3 rodadas completas de `npm run eval:det` (onda 6), sem mudança de código; achar a causa e tornar o eval determinístico, sem afrouxar a checagem.
- arquivos: `evals/det/guardrails/privacidade.eval.ts`, `evals/det/aprendizado/privacidade.eval.ts`, `evals/det/rotina-e-padroes/privacidade.eval.ts`, e o ajudante de `vazamentos` se estiver em outro arquivo de `evals/`
- depende de: nenhuma
- pronto quando: `npm run eval:det` verde em 3 rodadas seguidas; a causa explicada no relatório.
- fora: `src/` (se a causa for vazamento real em `src/`, pare e relate).

| 7 | T17, T18 | T18 entrou como correção de gate intermitente; arquivos separados |

### T19 · Fix the time-dependent house question tests (correção)
- nivel: nucleo
- objetivo: `src/app/_rotas/fluxo-de-run.test.ts` ("/resposta numa pergunta de casa segue até o fim") e `src/infra/e2e/roteiros.test.ts:48` ("pergunta-casa: pergunta de couve e leite e, com a resposta, entrega") falham com `expected 'waiting_for_approval' to be 'waiting_for_input'` às 08:12 UTC de 2026-11-17 (05:12 em São Paulo), de forma reproduzível isolada, e passavam nas ondas 5 e 6 sem mudança de `src/`. Hipótese: dependem do relógio real (momento do dia ou dia) em algum ponto do roteiro, do seed ou da rota. Achar a dependência e fixar o relógio no teste (ou corrigir o código, se a regressão for da 021, em especial a T10 `fluxo-de-run.ts`). Um terceiro arquivo falhou numa rodada e não foi identificado: rodar `npm test` completo e listar.
- arquivos: os dois testes acima e o que a causa exigir (descrever no relatório)
- depende de: nenhuma
- pronto quando: `npm test` verde; os dois testes passam com o relógio fixado em várias horas do dia (ex.: 03h, 05h, 12h, 21h em São Paulo).

| 8 | T19 | Correção de gate vermelho sem dono, sozinha |
| 9 | T17, T18 | Reaplicar `.local/patches/021-T18.patch` (aprovada) e refazer a T17 a partir de `.local/patches/021-T17-limites.spec.ts` com a reprovação |
