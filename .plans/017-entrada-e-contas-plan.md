# 017 · Entrada e contas · Plano

Spec: `.specs/017-entrada-e-contas.md`. Trilha adiantada (branch `entrega-3`).

Lacunas resolvidas pelo orquestrador (registradas em `DECISOES-AUTONOMAS.md`, 017 A1 a A4):

- **A1** `evals/det/mapa.ts` não existe (vem da 014, ainda não implementada). Esta spec não cria o mapa; na junção com a 014, as linhas "Rota sem sessão", "Duas demonstrações", "POST com `Origin`" e "31ª demonstração" ganham os arquivos de `evals/det/seguranca/`.
- **A2** `LOGS` não existe (vem da 015). O `criarRota` registra `telemetry.log("error", "erro_inesperado")`, sem campos.
- **A3** Rótulos de `ritu_entrada_total`: `conta.tipo` (já permitido) e `entrada.resultado` (novo em `ATRIBUTOS_PERMITIDOS`).
- **A4** Handlers das rotas ficam em `src/app/_rotas/` (funções que recebem `DepsDaRota`), para os evals chamarem com os stores em memória; os `route.ts` só ligam o handler às dependências reais de `src/app/_lib/deps.ts`.

---

### T1 · Install next-auth, add RITU_MODO and trace the seed folder
- nivel: mecanica
- objetivo: instalar `next-auth` v5 com versão exata, cadastrar a variável `RITU_MODO` e incluir `seed/` no rastreio de arquivos do Next.
- arquivos: `package.json`, `package-lock.json`, `src/infra/env.ts`, `src/infra/env.test.ts`, `.env.example`, `next.config.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `npm install --save-exact next-auth@5.0.0-beta.32` (se essa não existir, a beta v5 mais recente; sempre sem `^`). Confira em `node_modules/next-auth/package.json` os `peerDependencies` contra o `next` instalado; incompatível é bloqueio: pare e relate, não troque de biblioteca.
  - Em `ENV_VARS`: `{ name: "RITU_MODO", entrega: 3, obrigatoria: false, descricao: "e2e: stores em memória para o Playwright. Recusada em produção." }`, logo depois de `AUTH_GOOGLE_SECRET`. No `.env.example`, a linha `RITU_MODO=` com um comentário de uma linha, no mesmo estilo das outras.
  - `next.config.ts`: `outputFileTracingIncludes: { "/**": ["./data/**/*", "./seed/**/*"] }`.
- testes primeiro: `env.test.ts`: `RITU_MODO` está em `ENV_VARS`, opcional, entrega 3; o check da entrega 3 não falha sem ela.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: `next-auth` sem `^` no `package.json`; testes verdes; build passa.
- fora: qualquer uso de `next-auth` em código (outras tarefas).

### T2 · Add the limits, quiz and entry text configs
- nivel: mecanica
- objetivo: criar as três configurações da spec e incluí-las em `config/index.ts`.
- arquivos: `config/limites.ts`, `config/quiz.ts`, `config/textos-entrada.ts`, `config/index.ts`, `config/index.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
```ts
// config/limites.ts (em config/index.ts como `limites`)
export const limites = {
  demo: { porIpPorDia: 5, globalPorDia: 30, duracaoHoras: 24 },
  sessao: { dias: 30 },
  corpoMaximoBytes: 16_384,
  evitar: { maxItens: 20, textoLivreCaracteres: 40 },
  buscaDeAlimento: { minimoCaracteres: 2, maximoResultados: 8 },
} as const
// config/quiz.ts (como `quiz`)
export const quiz = { diferencaDual: 1 } as const
```
  `config/textos-entrada.ts` exporta `textosEntrada` (em `config/index.ts` como `textosEntrada`), um objeto aninhado `as const` com estas chaves e textos, **exatos**:

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
| `avisoInicial.saude` | `{ forte: "Não é orientação médica.", resto: "O Ritu sugere conforto com alimentos, ervas de cozinha, óleos comuns e práticas leves. Ele não diagnostica, não trata e não substitui um profissional de saúde." }` |
| `avisoInicial.ia` | `{ forte: "Suas mensagens passam por um serviço de IA.", resto: "O Ritu usa o Gemini, do Google, no plano gratuito. Nesse plano, o Google pode usar as mensagens para melhorar os produtos dele. Não escreva o que você não quer compartilhar." }` |
| `avisoInicial.memoria` | `{ forte: "Você vê e apaga o que o Ritu guarda.", resto: "Tudo o que ele anota aparece em \"O que sei sobre você\", e você pode apagar seus dados quando quiser." }` |
| `avisoInicial.demo` | Esta demonstração expira em 24 horas e depois é apagada. |
| `avisoInicial.botao` | Entendi, quero começar |
| `evitar.titulo` | Tem algum alimento que você nunca pode comer? |
| `evitar.apoio` | O Ritu nunca vai sugerir o que estiver aqui, nem em chá, refeição ou óleo. Não precisa dizer o motivo. |
| `evitar.botoes` | `{ pronto: "Pronto", nenhum: "Nenhum", pular: "Pular" }` |
| `dosha.titulo` | Quer descobrir seu dosha? |
| `dosha.apoio` | Dosha é o seu jeito de base, na Ayurveda. Com ele, o Ritu acerta mais. Sem ele, responde com o seu momento e o clima. |
| `dosha.opcoes` | `{ quiz: "Fazer o quiz", sei: "Já sei meu dosha", adiar: "Agora não" }` |
| `cidade.titulo` | Em que cidade você está? |
| `cidade.apoio` | O Ritu olha o clima da sua cidade na hora de sugerir. Ele nunca usa a localização do aparelho. Você pode pular. |
| `quiz.progresso` | Pergunta {n} de 8 |
| `quiz.resultado` | Seu dosha é {nome} |
| `faixa.botao` | Criar meu perfil |
| `conversa.vazia` | A conversa começa aqui. |

  (Os três do Aviso são `forte` + `resto` porque a tela põe `forte` em `<strong>`.) Placeholders `{n}` e `{nome}` ficam no texto; quem usa substitui.
- testes primeiro: `config/index.test.ts`: `config.limites.demo.porIpPorDia === 5`, `globalPorDia === 30`, `config.quiz.diferencaDual === 1`; nenhum texto de `textosEntrada` contém `<`, `>` nem a palavra "alergia".
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: as três chaves em `config`; testes verdes.
- fora: qualquer código que use os textos.

### T3 · Add the UsageLimiter port, the limites table, the Postgres adapter and the memory fake
- nivel: nucleo
- objetivo: limitador genérico por chave e janela, com contrato rodado contra Postgres e contra o fake.
- arquivos: `db/migrations/0003_limites.sql`, `src/core/limits/ports.ts`, `src/infra/db/limits.ts`, `src/infra/fakes/memory-limiter.ts`, `src/infra/fakes/memory-limiter.test.ts`, `test/contracts/limits.contract.ts`, `test/db/stores.db.test.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · "Rate limit no Postgres com IP em HMAC" (padrão de contador atômico; porte a ideia, não o código)
- contratos:
  - Tabela `limites`: `chave text not null`, `janela text not null` (check em `minuto`, `dia`), `inicio text not null`, `total int not null`; pk (`chave`, `janela`, `inicio`). Siga o estilo de `0002_llm_uso.sql`.
```ts
// src/core/limits/ports.ts
export type Janela = "minuto" | "dia"
export interface UsageLimiter {
  // Soma 1 em todas as chaves, ou em nenhuma: se alguma já está no teto, devolve a primeira que barrou.
  consumir(pedidos: { chave: string; teto: number }[], janela: Janela, inicio: string): Promise<{ ok: true } | { ok: false; chave: string }>
  usado(chave: string, janela: Janela, inicio: string): Promise<number>
  apagarAntesDe(inicio: string): Promise<number>     // linhas da janela "dia" com início menor
}
```
  - Adaptador `createPgLimiter(sql)` em `src/infra/db/limits.ts`: uma transação por `consumir`, com trava das linhas (`select … for update` depois de `insert … on conflict do nothing`, ou equivalente atômico); se alguma estiver no teto, não soma nenhuma. Siga o estilo de `src/infra/db/usage-ledger.ts`.
  - Fake `createMemoryLimiter(): UsageLimiter` em `src/infra/fakes/memory-limiter.ts`.
  - `test/contracts/limits.contract.ts` exporta `runLimitsContract(make: () => Promise<{ limiter: UsageLimiter; reset?: () => Promise<void> }>)` no estilo de `usage-ledger.contract.ts`; rodado em `memory-limiter.test.ts` e em `test/db/stores.db.test.ts`.
- testes primeiro (contrato): consumir até o teto e a seguinte barra devolvendo a chave; duas chaves com uma no teto não somam em nenhuma; a primeira que barrou é a devolvida; `usado` de chave nunca vista é 0; janelas e inícios diferentes não se misturam; `apagarAntesDe("2026-11-15")` apaga só linhas `dia` com `inicio` menor e devolve a contagem; 10 `consumir` concorrentes com teto 5 somam exatamente 5 (no Postgres).
- comandos: `npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run test:db` só se o Postgres do `docker compose` estiver no ar (diga se rodou)
- pronto quando: contrato verde no fake; `test:db` verde ou explicitamente não rodado.
- fora: container, limpeza, demonstração.

### T4 · Add PantryStore.semear with an explicit confirmation date
- nivel: mecanica
- objetivo: método novo na casa para gravar itens com `confirmado_em` no passado (itens incertos da demonstração).
- arquivos: `src/core/pantry/ports.ts`, `src/infra/db/pantry.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/pantry.contract.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
```ts
// em PantryStore
semear(contaId: string, itens: { alimento_id?: string; nome_livre?: string; confirmado_em: Date; sempre_tenho?: boolean }[]): Promise<void>
// estado "tem", origem "tela"; não apaga faltas nem mexe na lista. Coberto pela suíte de contrato da casa.
```
  Comportamento como o de `registrar` para identificar o item (alimento da base ou nome livre), mas com `confirmado_em` dado e `sempre_tenho` quando vier (padrão `false`).
- testes primeiro (`pantry.contract.ts`): item semeado aparece em `listar` com o `confirmado_em` dado, estado `tem`, origem `tela`; `sempre_tenho: true` grava; uma falta do mesmo alimento continua existindo; semear não mexe na lista "Para ter em casa"; outra conta não vê.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`; ⚠️ `npm run test:db` se o Postgres estiver no ar
- pronto quando: contrato verde no fake (e no Postgres, se rodou).
- fora: `registrar` e os demais métodos.

### T5 · Add the onboarding step, quiz, dosha name and entry state functions
- nivel: mecanica
- objetivo: funções puras do onboarding, do quiz e da Entrada, com TDD.
- arquivos: `src/core/accounts/onboarding.ts`, `src/core/accounts/onboarding.test.ts`, `src/core/accounts/dosha.ts`, `src/core/accounts/dosha.test.ts`, `src/core/accounts/entrada.ts`, `src/core/accounts/entrada.test.ts`
- depende de: T2
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos (tipos existentes: `Conta`, `Perfil` em `src/core/accounts/types.ts`; `Dosha` em `src/core/knowledge/vocab.ts`; `Prakriti` em `src/core/knowledge/adequacao.ts`; `KnowledgeBase` em `src/core/knowledge/knowledge-base.ts`, com `doshas` de `data/doshas.yaml`, cada um com `nome`; `RituError` em `src/core/errors.ts`):
```ts
// onboarding.ts
export type Passo = "aviso" | "evitar" | "dosha" | "pronto"
export function proximoPasso(conta: Conta, perfil: Perfil): Passo
// aviso_aceito_em nulo → "aviso"; evitar_passo nulo → "evitar"; prakriti nula e dosha_adiado_em nulo → "dosha"; senão "pronto".
export const ROTA_DO_PASSO: Record<Passo, string>     // aviso → /comecar/aviso, evitar → /comecar/evitar, dosha → /comecar/dosha, pronto → /conversa

// dosha.ts
export type ResultadoDoQuiz = { prakriti: Prakriti; doshas: Dosha[]; dual: boolean }     // doshas: 1 ou 2, o maior primeiro
export function calcularQuiz(respostas: Dosha[]): ResultadoDoQuiz
// Conta por dosha; prakriti = contagem / total, com os três. Ordena por contagem e, no empate, vata, pitta, kapha.
// dual quando primeiro − segundo ≤ config.quiz.diferencaDual e o segundo > 0.
export function prakritiDeclarada(doshas: Dosha[]): Prakriti       // 1 dosha → { d: 1 }; 2 → 0.5 cada; outro tamanho ou repetido: lança RituError("dosha_invalido")
export function nomeDoDosha(prakriti: Prakriti, kb: KnowledgeBase): string
// "Vata", ou "Vata-Pitta" quando o segundo tem pelo menos 0.3 e a diferença para o primeiro é de até 0.15. Usa o `nome` de data/doshas.yaml.

// entrada.ts
export type AvisoDaEntrada = "demo_limite_ip" | "demo_limite_global" | "demo_expirou" | "erro_google"
export function estadoDaEntrada(p: { google: boolean; demosHoje: number; tetoGlobal: number; aviso?: string; erro?: string }): { demo: boolean; google: boolean; aviso?: AvisoDaEntrada }
// demo = demosHoje < tetoGlobal; teto atingido força aviso "demo_limite_global"; aviso desconhecido é ignorado; erro do Auth.js (`erro`, vindo de ?error=) vira "erro_google".
```
  Confira o construtor de `RituError` em `src/core/errors.ts` antes de usar.
- testes primeiro: `proximoPasso` nos quatro casos e com cidade vazia (não segura o passo); `calcularQuiz` com 8-0-0 (simples, prakriti `{vata:1,pitta:0,kapha:0}`), 4-3-1 (dual), 5-3-0 (simples: diferença 2), 3-3-2 (dual, empate vata antes de pitta), 4-2-2 (simples); proporções somam 1; `prakritiDeclarada` com 1, 2, 0, 3 e repetido; `nomeDoDosha` com `{vata:.45,pitta:.45,kapha:.1}` → "Vata-Pitta", `{pitta:1}` → "Pitta", `{vata:.6,pitta:.4}` → "Vata" (diferença .2), `{vata:.5,pitta:.5}` → "Vata-Pitta"; `estadoDaEntrada` com teto atingido, aviso desconhecido, `erro` presente, Google ausente.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; funções puras, sem `new Date()`.
- fora: rotas e telas.

### T6 · Add the CSP, security headers, Origin check and the proxy
- nivel: nucleo
- objetivo: funções puras de proteção e o `src/proxy.ts` do Next 16 que aplica CSP com nonce, headers e checagem de `Origin`; teste de arquitetura com as duas regras novas.
- arquivos: `src/core/security/csp.ts`, `src/core/security/csp.test.ts`, `src/core/security/origem.ts`, `src/core/security/origem.test.ts`, `src/proxy.ts`, `src/architecture.test.ts`
- depende de: nenhuma
- leitura: `.docs/ARCHITECTURE.md` §4 (só a parte "Proteção do site"); `node_modules/next/dist/docs/` (proxy e Content Security Policy com nonce, na versão instalada)
- skills: `next-best-practices`
- referencia: nenhuma
- contratos:
```ts
// csp.ts
export function montarCsp(p: { nonce: string; dev: boolean }): string
export function headersDeSeguranca(p: { nonce: string; dev: boolean; https: boolean }): Record<string, string>
// origem.ts
export function origemValida(p: { metodo: string; origin: string | null; host: string | null }): boolean
// GET, HEAD e OPTIONS: sempre true. Demais: origin presente, URL válida e `new URL(origin).host === host`.
```
  CSP: `default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic'` (mais `'unsafe-eval'` só com `dev`)`; style-src 'self' 'nonce-<n>'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; form-action 'self' https://accounts.google.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'`. Demais headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` e, com `https`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`. `headersDeSeguranca` inclui `Content-Security-Policy`.

  `src/proxy.ts` (em todas as rotas, menos `_next/static`, `_next/image` e arquivos de `public/`, via `config.matcher`):
  1. `host` = `x-forwarded-host` ou `host`. `origemValida` falso → `403` JSON `{ "erro": "origem_invalida" }`, já com os headers.
  2. Gera o nonce (16 bytes aleatórios, base64), passa adiante no header de pedido `x-nonce` e na `Content-Security-Policy` do pedido (como a doc do Next manda, para ele aplicar o nonce nos scripts dele), e põe os headers de `headersDeSeguranca` na resposta. `dev` = `process.env.NODE_ENV !== "production"`; `https` = protocolo do pedido (ou `x-forwarded-proto`) é `https`.
  3. Não lê sessão nem banco. Só importa de `@/core/security/` e de `next/server`.

  `src/architecture.test.ts`: (a) R3 passa a liberar também `@/infra/auth/next` em `src/app/**` (além de `@/infra/container`), com um caso de teste; (b) regra nova: `src/proxy.ts` só importa de `@/core/security/` (e `next/server`), com um caso que acusa outra importação. Siga o formato das regras existentes (`RULE_R3`, `expectOnly`).
- testes primeiro: `montarCsp` tem `'nonce-abc'` em `script-src` e `style-src`, não tem `unsafe-inline` em `script-src`, tem `frame-ancestors 'none'`, só tem `unsafe-eval` com `dev`; `headersDeSeguranca` com e sem `https`; `origemValida`: outro site → false, sem `Origin` em POST → false, `Origin` inválido → false, mesmo host (com porta) → true, `GET` sem `Origin` → true, `HEAD`/`OPTIONS` → true.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e` (o `/marca` não pode ter violação de CSP; se tiver, relate o que bloqueia, sem relaxar a CSP)
- pronto quando: testes verdes; build passa; `curl -sI localhost:3000/` (com `npm run start`) mostra os headers e nonce diferente a cada pedido; E2E da `/marca` verde.
- fora: sessão, rotas de API.

### T7 · Add the demo seed schema, its validator and the YAML reader
- nivel: mecanica
- objetivo: schema zod e `validarSeed` do perfil semeado, leitor do `seed/demo.yaml` e `base:check` imprimindo o resultado do seed.
- arquivos: `src/core/demo-seed.ts`, `src/core/demo-seed.test.ts`, `src/infra/knowledge/yaml-seed.ts`, `src/infra/knowledge/yaml-seed.test.ts`, `scripts/base-check.ts`, `src/infra/container.ts` (só uma função exportada `readDemoSeed(dir?)` ao lado de `readKnowledgeData`, para o script; nada no tipo `Container`)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
```ts
export const demoSeedSchema = z.strictObject({
  faixa: z.string().max(140),
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
  Onde estão os schemas usados: `prakritiSchema` em `src/core/memory-schemas.ts`; `restricaoSchema`, `estadoSchema`, `momentoDoDiaSchema`, `gunaSchema` em `src/core/knowledge/vocab.ts`; `saidaDoAcompanhanteSchema` em `src/core/agents/companion/saida.ts`. `cidadeDaPessoaSchema` não existe: defina no próprio `demo-seed.ts` para o tipo `CidadeDaPessoa` de `src/core/weather/ports.ts` (`{ nome, lat, lon, fuso }`). `evitarItemSchema` não tem uma casa central (há cópias locais): defina no `demo-seed.ts` para `EvitarItem` (`src/core/knowledge/filtros.ts`), com `tipo` em `grupo | alimento | texto`.

  `validarSeed` confere, um erro legível por falha: todo id (alimentos, práticas, preparos, grupos de evitar, ids de `saida`) existe na base; nenhum item de casa, preferência, falta ou sugestão bate em `evitar_sempre` (`passaNoFiltro` de `src/core/knowledge/filtros.ts`); `resultados` tem o tamanho de `saida.sugestoes`; com as durabilidades da base (veja como a 004 calcula o estado dos itens: `src/core/pantry/`), a casa tem de 5 a 12 itens confirmados e de 2 a 4 incertos em `agora`; algum alimento tem falta em 3 dias diferentes ou mais; pelo menos 2 retornos `aguardando`; pelo menos 3 conversas do histórico têm todos os `padrao.estados` e o `padrao.item` entre as sugestões com resultado `ajudou`; nenhuma `mensagem` nem `saida.resposta` contém palavra de incômodo (`contemIncomodo`, de `src/core/routine/notas.ts`); nenhum texto do seed contém `<` ou `>`.

  `src/infra/knowledge/yaml-seed.ts`: `loadDemoSeed(dir = "seed"): DemoSeed` lê `<dir>/demo.yaml`, valida com `demoSeedSchema` e lança `KnowledgeInvalidError` (de `src/core/knowledge/knowledge-base.ts`) com os erros do zod. Siga `yaml-knowledge.ts`.

  `scripts/base-check.ts`: depois do relatório da base, lê o seed (`readDemoSeed`) e roda `validarSeed(seed, kb, new Date())`; imprime `seed: ok` ou uma linha por erro e sai com código 1. Seed ausente ou inválido no schema também é erro (`seed: <mensagem>`).
- testes primeiro: `demo-seed.test.ts` com um seed mínimo válido montado no teste (ids reais da base, carregada com `loadKnowledgeBase()` de `src/infra/knowledge/yaml-knowledge.ts`… ou pelo caminho que os testes do core já usam para ler a base; veja um teste existente de `src/core/knowledge/`) e uma variação por regra que deve falhar; `yaml-seed.test.ts` com um diretório temporário: arquivo válido, inválido (lança `KnowledgeInvalidError`) e ausente.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes. O `npm run base:check` vai acusar `seed:` ausente até a T8; isso é esperado.
- fora: `seed/demo.yaml` (T8), cópia do seed (T10), o tipo `Container`.

### T8 · Write the demo profile seed
- nivel: conteudo
- objetivo: escrever `seed/demo.yaml`, o perfil semeado da demonstração, válido no schema e no `validarSeed`.
- arquivos: `seed/demo.yaml`
- depende de: T7
- leitura: `.docs/BUSINESS.md` §6 (caminho da demonstração); o schema em `src/core/demo-seed.ts` e `saidaDoAcompanhanteSchema` em `src/core/agents/companion/saida.ts`
- skills: nenhuma
- referencia: nenhuma
- contratos: os fatos são estes (o redator escreve as frases):

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

  Regras do texto: português do Brasil, voz do Ritu (calorosa, simples, sem jargão), respostas em texto corrido; nenhuma palavra de incômodo de saúde nas mensagens nem nas respostas (o `validarSeed` acusa); sem `<` nem `>`; sem diagnóstico, cura, tratamento ou dosagem; respostas terminam com o aviso que o schema exigir (confira `saidaDoAcompanhanteSchema`). Ids sempre conferidos em `data/*.yaml`; se um id da tabela não existir, use o mais próximo que existe e registre no fim da resposta. Não mude schema nem código.
- testes primeiro: nenhum (conteúdo). Verificação: `npm run base:check` imprime `seed: ok`.
- comandos: `npm run base:check`, `npm run lint`
- pronto quando: `seed: ok`.
- fora: código, schema, `data/`.

### T9 · Wire the limiter, the demo seed and the E2E mode into the container
- nivel: nucleo
- objetivo: `Container` ganha `limiter` e `demoSeed`; com `RITU_MODO=e2e`, stores, transação, limitador e cidades em memória, guardados em `globalThis`, e recusa em produção.
- arquivos: `src/infra/container.ts`, `src/infra/container.test.ts`
- depende de: T1, T3, T7
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `Container` ganha `limiter: UsageLimiter` (Postgres: `createPgLimiter(bancoPreguicoso().sql)`, preguiçoso como os outros) e `demoSeed: DemoSeed` (`loadDemoSeed()`, carregado na primeira leitura).
  - Modo de E2E: `createContainer` lê `optionalEnv("RITU_MODO")`. Com `"e2e"`: `stores` e `tx` vêm de um único `createMemoryStores(clock, { alimentoExiste: (id) => Boolean(container.knowledge.alimento(id)) })` (de `src/infra/fakes/memory-stores.ts`; confira a assinatura de `OpcoesMemoria`), `limiter` de `createMemoryLimiter()`, `cities` de `createFakeCities()` (`src/infra/fakes/fake-cities.ts`), `telemetry` de `createNullTelemetry()`. Com `VERCEL_ENV=production` e `RITU_MODO=e2e`, `createContainer` lança `RituError("modo_e2e_em_producao")`. Outro valor de `RITU_MODO`: ignorado.
  - No modo e2e, `getContainer()` guarda a instância em `globalThis` (chave `__rituContainerE2e`), para o servidor do Next não perder os stores em memória entre módulos.
  - `ledger` no modo e2e: use o fake de ledger em memória que já existe (`createMemoryLedger` em `memory-stores.ts`), para a limpeza rodar sem banco.
- testes primeiro: `container.test.ts`: criar o container não lê `data/` nem `seed/` nem abre banco (como os testes existentes); `demoSeed` carrega o seed real na primeira leitura; com `RITU_MODO=e2e` (env controlado no teste), `stores`, `limiter` e `cities` são os fakes e duas chamadas de `getContainer()` devolvem a mesma instância; com `RITU_MODO=e2e` e `VERCEL_ENV=production`, `createContainer` lança `modo_e2e_em_producao`; com `RITU_MODO=outro`, os adaptadores reais.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; nenhum outro arquivo tocado.
- fora: auth, rotas, limpeza.

### T10 · Add the demo creation, seed copy and Google sign-in services
- nivel: nucleo
- objetivo: `entrarComGoogle`, `criarDemonstracao` e `copiarSeed` no core, com a métrica `ritu_entrada_total`.
- arquivos: `src/core/accounts/entrar.ts`, `src/core/accounts/entrar.test.ts`, `src/core/accounts/copiar-seed.ts`, `src/core/accounts/copiar-seed.test.ts`, `src/core/telemetry/nomes.ts`, `src/core/telemetry/nomes.test.ts`
- depende de: T2, T3, T4, T7, T8
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · "Login Google + conta demo por clique"
- contratos:
```ts
// entrar.ts
export function entrarComGoogle(deps: { stores: Stores; telemetry: Telemetry }, dados: { sub: string; email: string }): Promise<Conta>
// buscarPorGoogleSub; sem conta, cria (tipo google). Se criar falhar por google_sub duplicado (corrida), busca de novo e usa a encontrada. Conta `ritu_entrada_total` com resultado "nova" ou "retorno".

export class LimiteDeDemonstracaoError extends RituError {}     // code: "demo_limite_ip" | "demo_limite_global"
export function criarDemonstracao(
  deps: { tx: Transactor; limiter: UsageLimiter; clock: Clock; kb: KnowledgeBase; seed: DemoSeed; telemetry: Telemetry },
  dados: { ipHash: string; escopo?: string; semSeed?: boolean },   // escopo: só no modo e2e, prefixo das chaves; semSeed: só no modo e2e (conta nova sem perfil)
): Promise<Conta>
// 1. limiter.consumir([{ chave: `${p}demo:ip:${ipHash}`, teto: porIpPorDia }, { chave: `${p}demo:global`, teto: globalPorDia }], "dia", hoje), p = escopo ? `${escopo}:` : "". Barrou: lança o erro da chave.
// 2. tx.emTransacao: accounts.criar({ tipo: "demo", expira_em: agora + duracaoHoras }) → copiarSeed → accounts.marcar({ evitar_passo: "pronto" }). Com semSeed: só accounts.criar.
// 3. Conta `ritu_entrada_total` (tipo demo; resultado nova, limite_ip ou limite_global).

// copiar-seed.ts
export function copiarSeed(stores: Stores, contaId: string, seed: DemoSeed, deps: { clock: Clock; kb: KnowledgeBase }): Promise<void>
```
  `hoje` do limite = `diaLocal(agora)` (fuso padrão; `src/core/time/dia-local.ts`). Limites em `config.limites.demo`.

  `copiarSeed`, na ordem: `profiles.definirPrakriti(…, "quiz")`, `definirCidade`, `acrescentarEvitarSempre`, `definirRestricoes`, `definirNaoCome` → `pantry.semear` (`confirmado_em = agora − dias_atras` dias) → `preferences.definirGosto` e `contarResultado` (uma chamada por unidade do contador) → `shortages.registrar` (origem `teria_entrado`, dia = `diasAtras(hoje, n)`) → `routine.anotar` de cada nota e `routine.gravarResumo(resumoPorCodigo(notas))` (`src/core/routine/resumo.ts`) → para cada conversa do histórico, da mais antiga para a mais nova: `runs.criar` (caminho `acompanhante`, intenções `["momento"]`, dia) e `runs.atualizar` (`status: "done"`, `momento`, `saida`, `prompt_versao: "semente"`, `juiz_aprovado: true`), `messages.gravar` da pessoa e do agente, `outcomes.criar` com `saida.sugestoes.map(sugestaoRegistrada)` (veja `src/core/agents/companion/registrar-entrega.ts`) e `outcomes.responder(…, "toque")` nos que não estão `aguardando` → `patterns.propor` com `chaveDeAjuda` e `fraseDeAjuda` (`src/core/patterns/textos.ts`; o título é o da sugestão do retorno mais recente). `hoje` aqui é o dia local no fuso da cidade do seed. Nenhuma telemetria de retorno, gosto ou falta é contada na cópia. Confira as assinaturas exatas de cada store em `src/core/*/ports.ts` antes de escrever; datas dos runs e mensagens no dia certo (pelo `Clock` deslocado ou pelos campos que os stores aceitam).

  Telemetria: `METRICAS` ganha `"ritu_entrada_total"`; `ATRIBUTOS_PERMITIDOS` ganha `"entrada.resultado"`. Rótulos: `{ "conta.tipo": "google" | "demo", "entrada.resultado": "nova" | "retorno" | "limite_ip" | "limite_global" }`. Nunca conta, IP nem hash.
- testes primeiro (com `createMemoryStores`, `createMemoryLimiter`, `createFixedClock`, `createMemoryTelemetry` e o seed real `loadDemoSeed()`): `validarSeed` do seed real sem erros; depois de `criarDemonstracao`, a conta tem prakriti Vata-Pitta, cidade Rio, "castanhas" em evitar sempre, itens confirmados e incertos em casa, gostos, resultados, cardamomo com falta em 3 dias, notas de rotina com resumo, um padrão `candidato`, mensagens de dias anteriores, retornos aguardando e `evitar_passo = "pronto"`; `expira_em` = agora + 24 h; 6ª demonstração do mesmo `ipHash` no dia lança `demo_limite_ip` sem criar conta; 31ª do dia (IPs diferentes) lança `demo_limite_global`; com `escopo`, as chaves levam o prefixo; `semSeed` cria conta sem perfil; falha no meio da cópia (store que lança) não deixa conta; `entrarComGoogle` cria na primeira e acha a mesma na segunda; métrica com os rótulos certos.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: auth, container, rotas.

### T11 · Clean the old limits in the daily cleanup
- nivel: mecanica
- objetivo: `executarLimpeza` recebe `limiter` e apaga os limites de antes de ontem.
- arquivos: `src/core/cleanup.ts`, `src/core/cleanup.test.ts`, `scripts/cleanup.ts`, `src/core/conversation/conversar.test.ts`, `evals/det/guardrails/alerta-por-codigo.eval.ts`, `evals/det/aprovacao/restricao-no-run.eval.ts`, `evals/det/aprovacao/expiracao.eval.ts`, `evals/det/conversa/alerta.eval.ts`, `evals/det/memoria/limpeza.eval.ts`, `evals/det/pausas/mensagens.eval.ts`
- depende de: T3, T9
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `executarLimpeza(deps: { stores; clock; ledger; limiter: UsageLimiter })`; `ResultadoLimpeza` ganha `limites: number` = `limiter.apagarAntesDe(diasAtras(hoje, 1))` (hoje no fuso padrão). `scripts/cleanup.ts` passa `getContainer().limiter`. Os outros chamadores passam `createMemoryLimiter()` (`src/infra/fakes/memory-limiter.ts`).
- testes primeiro: `cleanup.test.ts`: limites de hoje e de ontem ficam, os de anteontem saem; `limites` conta as linhas apagadas.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: tudo verde; só a assinatura nova nos chamadores.
- fora: rota do cron (T15).

### T12 · Add the Auth.js session, the demo provider and the session actions
- nivel: nucleo
- objetivo: sessão com Google e com o provedor `demo`, JWT só com `contaId` e `tipo`, IP em HMAC, rota do Auth.js e ações de servidor de entrar e sair.
- arquivos: `src/infra/auth/next.ts`, `src/infra/auth/callbacks.ts`, `src/infra/auth/callbacks.test.ts`, `src/infra/auth/ip.ts`, `src/infra/auth/ip.test.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/_acoes/sessao.ts`
- depende de: T1, T9, T10
- leitura: `.docs/ARCHITECTURE.md` §4 (autenticação e demonstração); tipos de `node_modules/next-auth` (v5) instalados
- skills: `next-best-practices`
- referencia: `.local/REFERENCIAS.md` §1 · "Login Google + conta demo por clique"
- contratos:
  - `next.ts`: único arquivo que importa `next-auth`. Exporta `handlers`, `auth`, `signIn`, `signOut` e `googleDisponivel(): boolean` (as duas variáveis `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` presentes, via `optionalEnv`). Config: `session: { strategy: "jwt", maxAge: config.limites.sessao.dias * 86400 }`, `trustHost: true`, `pages: { signIn: "/", error: "/" }`, `secret` de `AUTH_SECRET`. Cookie `httpOnly`, `SameSite=Lax` (padrão do Auth.js; confira). Google (escopo `openid email`) só com as duas variáveis; recusa perfil sem `sub` ou com `email_verified` falso; no `signIn`/`jwt` do Google chama `entrarComGoogle(container, { sub, email })`. Provedor de credenciais `demo`, sem campos: `authorize(_, request)` calcula `ipHash = hashDoIp(ipDoPedido(request.headers, modoE2e), requireEnv("IP_HMAC_SECRET"))` e chama `criarDemonstracao` com o container; no modo e2e (`RITU_MODO=e2e`), `escopo` = header `x-ritu-e2e` (se houver) e `semSeed` = header `x-ritu-e2e-conta` igual a `nova`; fora do modo e2e esses headers são ignorados. `LimiteDeDemonstracaoError` vira um `CredentialsSignin` com `code` igual ao do erro.
  - `callbacks.ts` (puro, testável sem `next-auth`): `jwt`: no login grava `contaId` e `tipo` e apaga `name`, `email` e `picture`; `session`: expõe só `contaId` e `tipo`. O `next.ts` usa essas funções.
  - `ip.ts`: `ipDoPedido(headers: Headers, modoE2e: boolean): string` (primeiro de `x-forwarded-for`, sem espaços; no modo e2e, `x-ritu-e2e` quando presente; sem nada, `"desconhecido"`) e `hashDoIp(ip: string, segredo: string): string` (HMAC-SHA256 de `node:crypto`, hexadecimal, 32 primeiros caracteres).
  - `src/app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers`.
  - `src/app/_acoes/sessao.ts` (`"use server"`):
```ts
export async function entrarNaDemonstracao(): Promise<void>     // signIn("demo", { redirectTo: "/comecar/aviso" }); limite → redirect("/?aviso=<code>"); outro erro de credencial → redirect("/?aviso=erro_demo")
export async function entrarComGoogleAcao(): Promise<void>      // signIn("google", { redirectTo: "/conversa" })
export async function sair(): Promise<void>                     // signOut({ redirectTo: "/" })
```
    Lembre: `redirect` do Next lança; não o engula no `catch`.
  - Nunca e-mail, nome ou foto no token, em log, span ou métrica. A sessão em JWT; nenhuma tabela de sessão.
- testes primeiro: `callbacks.test.ts`: token depois do login tem `contaId` e `tipo` e não tem `name`, `email`, `picture`; sessão só com `contaId` e `tipo`. `ip.test.ts`: primeiro de `x-forwarded-for` com espaços; sem header → `"desconhecido"`; `x-ritu-e2e` só no modo e2e; `hashDoIp` determinístico, 32 caracteres hex, muda com o segredo e nunca contém o IP.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes verdes; build passa; nenhum `next-auth` fora de `src/infra/auth/next.ts` (o teste de arquitetura R5, se não cobrir, o verificador confere por grep).
- fora: páginas, rotas de onboarding.

### T13 · Add the account and route helpers for pages and API routes
- nivel: nucleo
- objetivo: `contaAtual`, `exigirPasso`, `criarRota` e as dependências reais das rotas.
- arquivos: `src/app/_lib/conta.ts`, `src/app/_lib/rota.ts`, `src/app/_lib/rota.test.ts`, `src/app/_lib/deps.ts`
- depende de: T5, T9, T12
- leitura: nenhuma
- skills: `next-best-practices` (`route-handlers.md`, `rsc-boundaries.md`)
- referencia: nenhuma
- contratos:
```ts
// conta.ts
export function contaAtual(): Promise<{ conta: Conta; perfil: Perfil } | undefined>     // auth() → accounts.buscar → profiles.ler
export function exigirPasso(passo: Passo): Promise<{ conta: Conta; perfil: Perfil }>
// Sem conta: redirect("/"), com ?aviso=demo_expirou quando o token é de demonstração (sessão existe, conta não). Passo diferente do atual: redirect(ROTA_DO_PASSO[atual]).

// rota.ts
export type DepsDaRota = { contaDaSessao(): Promise<string | undefined>; container: Container }
export function criarRota<B, R>(deps: DepsDaRota, opts: { corpo?: z.ZodType<B> }, fn: (ctx: { conta: Conta; corpo: B; request: Request; container: Container }) => Promise<R>): (request: Request) => Promise<Response>

// deps.ts
export function depsReais(): DepsDaRota      // contaDaSessao: (await auth())?.contaId; container: getContainer()
```
  `criarRota`: sem sessão ou conta inexistente (`accounts.buscar` devolve `undefined`, inclusive demonstração vencida) → `401 { erro: "sem_sessao" }`; corpo acima de `config.limites.corpoMaximoBytes` → `413 { erro: "corpo_grande" }` (confira `content-length` e o tamanho lido); JSON ou schema inválido → `400 { erro: "corpo_invalido" }`; `RituError` conhecido → `400` (ou `409` para códigos de conflito; nesta spec, todos `400`) com `{ erro: <code> }`; qualquer outro erro → `500 { erro: "erro_inesperado" }` e `container.telemetry.log("error", "erro_inesperado")`, sem mensagem interna. Sem `opts.corpo` (GET), não lê corpo. Sucesso: `200` com o JSON de `fn`. `Passo` e `ROTA_DO_PASSO` vêm de `src/core/accounts/onboarding.ts`; `auth` de `@/infra/auth/next`.
- testes primeiro (`rota.test.ts`, com `createContainer({ stores, tx, ... })` em memória e `contaDaSessao` fingido): 401 sem sessão; 401 com conta de demonstração vencida; 413; 400 com JSON quebrado e com schema inválido; 400 com `RituError`; 500 sem detalhe (o corpo não contém a mensagem do erro) e o log chamado; 200 com o JSON.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: páginas e as rotas concretas.

### T14 · Add the onboarding routes
- nivel: mecanica
- objetivo: as quatro rotas de onboarding, com handlers testáveis.
- arquivos: `src/app/_rotas/onboarding.ts`, `src/app/_rotas/onboarding.test.ts`, `src/app/api/onboarding/aviso/route.ts`, `src/app/api/onboarding/evitar/route.ts`, `src/app/api/onboarding/perfil/route.ts`, `src/app/api/onboarding/quiz/route.ts`
- depende de: T13
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `src/app/_rotas/onboarding.ts` exporta `rotasDeOnboarding(deps: DepsDaRota): { aviso; evitar; perfil; quiz }`, cada uma o resultado de `criarRota` (`src/app/_lib/rota.ts`). Cada `route.ts` faz `export const POST = rotasDeOnboarding(depsReais()).<nome>` (com `depsReais` de `src/app/_lib/deps.ts`; se a criação precisar ser preguiçosa, use uma função que cria na primeira chamada).

| Rota | Corpo | Faz | Resposta |
|---|---|---|---|
| `POST /api/onboarding/aviso` | `{}` | `accounts.marcar({ aviso_aceito_em: agora })` | `{ proximo }` |
| `POST /api/onboarding/evitar` | `{ passo: "pronto"; itens: EvitarItem[] }` (1 a 20; `texto` com até 40 caracteres; `grupo` existe em `kb.gruposEvitar` e `alimento` em `kb.alimento(id)`) ou `{ passo: "nenhum" \| "pulou" }` | `profiles.acrescentarEvitarSempre` (só com `pronto`) e `accounts.marcar({ evitar_passo })` | `{ proximo }` |
| `POST /api/onboarding/perfil` | `{ dosha: "quiz" \| "adiado" \| Dosha[]; cidade: CidadeDaPessoa \| null }` (latitude de −90 a 90, longitude de −180 a 180, fuso aceito por `Intl.DateTimeFormat`, nome com até 80 caracteres) | Grava a cidade, se veio (`profiles.definirCidade`). Lista: `definirPrakriti(prakritiDeclarada(…), "declarado")`. `adiado`: `marcar({ dosha_adiado_em: agora })`. `quiz`: não marca nada | `{ proximo }`; com `quiz`, `proximo` é `/comecar/quiz` |
| `POST /api/onboarding/quiz` | `{ respostas: { pergunta_id: string; dosha: Dosha }[] }` (uma por pergunta de `kb.quiz`, todas, sem repetir nem id desconhecido; senão `400 corpo_invalido` e nada gravado) | `calcularQuiz` e `definirPrakriti(…, "quiz")` | `{ nome, doshas, dual }` (`nome` de `nomeDoDosha`) |

  `proximo` é `ROTA_DO_PASSO[proximoPasso(conta, perfil)]`, lido depois da gravação. As rotas aceitam ser chamadas de novo sem erro. Texto livre de evitar é guardado como texto, sem interpretar. `agora` = `container.clock.now()`. Funções de `src/core/accounts/onboarding.ts` e `dosha.ts`. Não use a palavra "alergia".
- testes primeiro (`onboarding.test.ts`, container em memória, `contaDaSessao` fingido): cada rota sem sessão → 401; aviso → `proximo` `/comecar/evitar`; evitar com grupo, alimento e texto → grava sem duplicar e `proximo` `/comecar/dosha`; evitar `pronto` sem itens → 400; grupo desconhecido → 400; 21 itens → 400; `nenhum` e `pulou` sem itens; perfil com `["vata","pitta"]` → 0,5 cada, origem `declarado`, `proximo` `/conversa`; `adiado` → `dosha_adiado_em`; `quiz` → `proximo` `/comecar/quiz` sem gravar; cidade com fuso inválido → 400; quiz completo → prakriti gravada, origem `quiz`; quiz com pergunta faltando ou repetida → 400 sem gravar; uma conta não muda o onboarding de outra.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: telas.

### T15 · Add the city and food search routes and the cleanup cron route
- nivel: nucleo
- objetivo: busca de cidade, busca de alimento e a rota da limpeza diária protegida por `CRON_SECRET`.
- arquivos: `src/app/_rotas/busca.ts`, `src/app/_rotas/busca.test.ts`, `src/app/_rotas/cron.ts`, `src/app/_rotas/cron.test.ts`, `src/app/api/cidades/route.ts`, `src/app/api/alimentos/route.ts`, `src/app/api/cron/limpeza/route.ts`
- depende de: T11, T13
- leitura: nenhuma
- skills: nenhuma
- referencia: `.local/REFERENCIAS.md` §1 · "Limpeza diária"
- contratos:

| Rota | Consulta | Faz | Resposta |
|---|---|---|---|
| `GET /api/cidades?q=` | `q` com 2 a 60 caracteres (senão `400 corpo_invalido`) | `container.cities.buscar(q)`; `CityLookupUnavailableError` → `503 { erro: "cidades_indisponivel" }` | `{ cidades: Cidade[] }` |
| `GET /api/alimentos?q=` | `q` com 2 a 40 caracteres | Alimentos da base cujo nome normalizado contém `q` normalizado (sem acento, minúsculo; use a `normalizar` já existente em `src/core/knowledge/identificar.ts` se servir), por ordem alfabética do nome, até `config.limites.buscaDeAlimento.maximoResultados` | `{ alimentos: { id, nome }[] }` |
| `GET /api/cron/limpeza` | `Authorization: Bearer <CRON_SECRET>` (comparação em tempo constante, `timingSafeEqual` com tamanhos iguais) | `executarLimpeza({ stores, clock, ledger, limiter })` | `ResultadoLimpeza`; sem o header certo, `401 { erro: "sem_autorizacao" }` |

  `busca.ts` exporta `rotasDeBusca(deps: DepsDaRota): { cidades; alimentos }` via `criarRota` (com sessão: sem sessão → 401). `cron.ts` exporta `rotaDaLimpeza(deps: { container: Container; segredo: () => string })` (sem sessão; não passa por `criarRota`); o `route.ts` passa `() => requireEnv("CRON_SECRET")`. Os `route.ts` com `export const dynamic = "force-dynamic"` se preciso.
- testes primeiro: cidades com `createFakeCities()` (inclusive `foraDoAr(true)` → 503); `q` curto → 400; alimentos com acento ("abóbora" acha `abobora`), limite de 8, ordem alfabética; sem sessão → 401; cron sem header, com header errado, com tamanho diferente → 401; com o certo → contagens com `limites`.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: telas.

### T16 · Configure Playwright for the E2E mode and add the session fixture
- nivel: tela
- objetivo: o servidor do E2E sobe em modo e2e, sem Postgres, rede nem chave, e os testes ganham a fixture que isola cada teste por header e o atalho `entrarNaDemo`.
- arquivos: `playwright.config.ts`, `e2e/apoio/sessao.ts`
- depende de: T12
- leitura: nenhuma
- skills: `playwright`
- referencia: nenhuma
- contratos:
  - `playwright.config.ts`: `webServer.env` com `RITU_MODO: "e2e"`, `AUTH_SECRET` e `IP_HMAC_SECRET` de teste (valores fixos no arquivo, que não são segredo, com um comentário dizendo isso) e sem as variáveis do Google (`AUTH_GOOGLE_ID: ""`, `AUTH_GOOGLE_SECRET: ""`, para não herdar do ambiente). Mantém `reuseExistingServer: !process.env.CI` e os projetos `celular` e `desktop`.
```ts
// e2e/apoio/sessao.ts
export const test: typeof base     // fixture: cada teste manda `x-ritu-e2e: <id único>` em todos os pedidos (extraHTTPHeaders do contexto)
export async function entrarNaDemo(page: Page): Promise<void>            // Entrada → botão "Testar com perfil de demonstração" → "Entendi, quero começar" → espera /conversa
export async function entrarComContaNova(page: Page): Promise<void>       // igual, mas com o header `x-ritu-e2e-conta: nova` antes do clique: cria conta sem perfil e para em /comecar/aviso
export { expect }
```
- testes primeiro: nenhum novo (as telas ainda não existem); a fixture é usada nas T21 e T22. Confira que `e2e/marca.spec.ts` e `e2e/smoke.spec.ts` continuam verdes com o servidor em modo e2e.
- comandos: `npm run lint`, `npm run typecheck`, `npm run build`, `CI=1 npm run test:e2e`
- pronto quando: E2E existente verde com o novo `webServer`.
- fora: specs de E2E novos.

### T17 · Build the entry page with the diagonal illustration
- nivel: tela
- objetivo: a Entrada (`/`), com a ilustração em corte diagonal, o logo e o cartão do Ritu.
- arquivos: `public/marca/entrada.webp`, `src/app/page.tsx`, `src/app/_entrada/cartao-de-entrada.tsx`
- depende de: T5, T12, T13
- leitura: `.docs/DESIGN.md` §3; `.docs/BUSINESS.md` §6; `design/login-screen-reference.jpeg` e `design/login-cover.jpeg` (abra as imagens)
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos:
  - `public/marca/entrada.webp` gerado de `design/login-cover.jpeg`: 1600 px de largura, até 250 KB (use `sharp` se já estiver em `node_modules` via Next, ou `cwebp`/`sips` do sistema; não instale pacote). Não edite `design/`.
  - `src/app/page.tsx` (servidor): com conta válida (`contaAtual()` de `src/app/_lib/conta.ts`), `redirect(ROTA_DO_PASSO[proximoPasso(conta, perfil)])`. Senão lê `container.limiter.usado("demo:global", "dia", diaLocal(agora))`, `googleDisponivel()` (de `@/infra/auth/next`) e `searchParams` (`aviso`, `error`), e monta `estadoDaEntrada({ google, demosHoje, tetoGlobal: config.limites.demo.globalPorDia, aviso, erro })`.
  - Textos de `config.textosEntrada` (`entrada.*` e `aviso.*`). `aviso=erro_demo` (falha inesperada na criação, vinda da ação) não passa por `estadoDaEntrada`: a página trata à parte e mostra "Não consegui abrir a demonstração agora. Tente de novo." no mesmo bloco de aviso.
  - **Layout desktop (a partir de 64rem):** ilustração à esquerda, do topo ao pé, 63% da largura, `clip-path: polygon(0 0, 43% 0, 100% 100%, 0 100%)`. `Logo variant="full" size="lg"` sobre o fundo `canvas`, centrado no meio da tela, no terço de cima, sem tocar a ilustração. Cartão à direita, centrado na vertical, com até 26rem.
  - **Celular:** ilustração no topo com 42dvh e `clip-path: polygon(0 0, 100% 0, 100% 58%, 0 100%)`; logo `full`, `md`, sobre o `canvas` no canto livre do corte (embaixo, à direita); cartão abaixo, na largura da tela menos a margem.
  - `object-fit: cover`, `object-position: 30% 60%`. Imagem decorativa, `alt=""`. Mesma ilustração nos dois temas.
  - **Cartão:** `Surface tone="raised" radius="lg" shadow="lift"`: `h1` "Entrar" e o subtítulo em `font-title`; `entrada.oQueE`; o aviso do estado, quando houver, em bloco `amber-soft` com `role="status"`, acima dos botões; botão da demonstração (`Button` `primary`, largura inteira) dentro de um `<form action={entrarNaDemonstracao}>` (funciona sem JavaScript), com `entrada.demoApoio`; com Google, botão `secondary` em `<form action={entrarComGoogleAcao}>` com `entrada.googleApoio`; `entrada.aviso` em `ink-muted`. Sem campo de e-mail nem senha. Com `demo` falso, sem o botão da demonstração. Estado de envio: o botão fica `isPending` (componente cliente pequeno com `useFormStatus`, em `cartao-de-entrada.tsx`).
  - Só componentes de `src/components/` (016) e classes de token; nada de React Aria direto em `src/app/`.
- testes primeiro: nenhum unitário; a T21 cobre no E2E. Confira à mão com `npm run build && RITU_MODO=e2e AUTH_SECRET=x IP_HMAC_SECRET=y npm run start` nos dois tamanhos e temas.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: a Entrada abre nos dois temas e tamanhos; a demonstração leva a `/comecar/aviso` (a página pode ainda não existir se a T18 não terminou); imagem com até 250 KB.
- fora: E2E (T21), outras telas.

### T18 · Build the onboarding layout, the notice and the always-avoid step
- nivel: tela
- objetivo: moldura do onboarding, Aviso inicial e o passo "Evitar sempre".
- arquivos: `src/app/(comecar)/layout.tsx`, `src/app/(comecar)/comecar/aviso/page.tsx`, `src/app/(comecar)/comecar/aviso/aceitar.tsx`, `src/app/(comecar)/comecar/evitar/page.tsx`, `src/app/(comecar)/comecar/evitar/escolher-evitar.tsx`
- depende de: T13, T14
- leitura: `.docs/DESIGN.md` §3; `.docs/BUSINESS.md` §12 e §13
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos:
  - `(comecar)/layout.tsx`: coluna `content` centrada, `Logo variant="full" size="sm"` no topo, `main#conteudo`. Cada página chama `exigirPasso(<passo>)` (`src/app/_lib/conta.ts`), que redireciona quem está em outro passo.
  - `/comecar/aviso`: `h1` `avisoInicial.titulo`; as três frases com `forte` em `<strong>` e `resto` em seguida; em conta `demo`, também `avisoInicial.demo`; botão `primary` `avisoInicial.botao` → `POST /api/onboarding/aviso` com `{}` e `router.push(proximo)`; link "Sair" (form com a ação `sair` de `src/app/_acoes/sessao.ts`). `noscript` dizendo que a tela precisa de JavaScript.
  - `/comecar/evitar`: `h1` `evitar.titulo`, `evitar.apoio`; grupos de `kb.gruposEvitar` em `ToggleChip`; `ComboBox` de alimento que busca em `GET /api/alimentos?q=` (a partir de 2 letras) e acrescenta o escolhido; campo de texto livre (`TextField`, até 40 caracteres) com "Adicionar"; os escolhidos em `TagList` removível (sem duplicar); botões `Pronto` (`aria-disabled` sem item), `Nenhum`, `Pular` → `POST /api/onboarding/evitar` com `{ passo: "pronto", itens }` / `{ passo: "nenhum" }` / `{ passo: "pulou" }`, e `router.push(proximo)`. Até 20 itens. Não pergunte o motivo; não use a palavra "alergia".
  - Estados: botão `isPending` durante o envio; erro de rede → texto de erro com nova tentativa, sem perder as escolhas; `401` → `window.location` para `/`.
  - Textos de `config.textosEntrada`. Só componentes de `src/components/` e classes de token.
- testes primeiro: nenhum unitário; a T22 cobre no E2E. Confira à mão no servidor em modo e2e (com a T16, `entrarComContaNova`).
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: as duas telas funcionam com teclado e mouse nos dois temas.
- fora: dosha, quiz, (app).

### T19 · Build the dosha and city step and the quiz
- nivel: tela
- objetivo: passo "Dosha e cidade" e o quiz de 8 perguntas com o resultado.
- arquivos: `src/app/(comecar)/comecar/dosha/page.tsx`, `src/app/(comecar)/comecar/dosha/escolher-dosha.tsx`, `src/app/(comecar)/comecar/quiz/page.tsx`, `src/app/(comecar)/comecar/quiz/quiz.tsx`
- depende de: T13, T14, T15, T18
- leitura: `.docs/DESIGN.md` §3; `.docs/BUSINESS.md` §13
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos:
  - `/comecar/dosha` (`exigirPasso("dosha")`): `h1` `dosha.titulo`, `dosha.apoio`; grupo de escolha única com `dosha.opcoes`: "Fazer o quiz", "Já sei meu dosha" (abre Vata · Pitta · Kapha · Misto; "Misto" pede dois dos três) e "Agora não"; abaixo, `h2` `cidade.titulo`, `cidade.apoio` e a busca de cidade (`ComboBox` com `GET /api/cidades?q=`, mostrando nome, região e país) com "Pular a cidade"; botão "Continuar" → `POST /api/onboarding/perfil` com `{ dosha: "quiz" | "adiado" | Dosha[], cidade: { nome, lat, lon, fuso } | null }` e `router.push(proximo)`. Busca fora do ar (`503`): "Não consegui buscar a cidade agora." e a pessoa segue sem cidade. Confira em `src/core/weather/ports.ts` os campos de `Cidade`.
  - `/comecar/quiz` (`exigirPasso("dosha")`): perguntas de `kb.quiz` (veja `data/quiz.yaml` para o formato), uma por vez, três opções em grupo de rádio, "Voltar" e "Próxima", progresso `quiz.progresso` com `{n}`; ao fim, `POST /api/onboarding/quiz` e o resultado: `DoshaBlot` de cada dosha de `doshas` em `Surface tone="paper"`, `quiz.resultado` com `{nome}`, o `resumo` de cada dosha da base e "Continuar" (`/conversa`). Sair no meio não grava nada. Foco vai para o título da pergunta a cada troca.
  - Estados de carregando e erro como na T18. Grupos de rádio e de escolha: componentes da 016 (se não houver `RadioGroup` em `src/components/base/`, use `ToggleChip` com `role` coerente, ou relate a falta; não importe React Aria em `src/app/`).
- testes primeiro: nenhum unitário; a T22 cobre no E2E.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: as duas telas funcionam com teclado e mouse nos dois temas; o quiz completo mostra o resultado dual quando for o caso.
- fora: (app), Perfil, "Refazer o quiz".

### T20 · Build the signed-in frame, the demo banner and the empty conversation page
- nivel: tela
- objetivo: moldura de quem entrou, com cabeçalho, menu "Sair" e a faixa de demonstração, e `/conversa` com o estado vazio.
- arquivos: `src/app/(app)/layout.tsx`, `src/app/(app)/conversa/page.tsx`, `src/components/ritu/demo-banner.tsx`, `src/app/(app)/menu-da-conta.tsx`
- depende de: T13
- leitura: `.docs/DESIGN.md` §3
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos:
  - `(app)/layout.tsx`: `exigirPasso("pronto")`; `header` com `Logo` e um `Menu` (botão de ícone "Menu da conta") com o item "Sair" (ação `sair`); em conta `demo`, a `DemoBanner` logo abaixo, com `texto = container.demoSeed.faixa` e `podeCriarPerfil = googleDisponivel()`; `main#conteudo`.
  - `src/components/ritu/demo-banner.tsx`: `DemoBanner({ texto, podeCriarPerfil })`: faixa em `amber-soft` com o texto e, com `podeCriarPerfil`, o botão "Criar meu perfil" (`faixa.botao`) num form com a ação `entrarComGoogleAcao` (recebida por prop, para o componente não importar `src/app/`). Texto parado, sem `role="status"`, dentro de um `aside aria-label="Demonstração"`.
  - `/conversa`: `StateBlock kind="empty"` com `conversa.vazia`.
  - Só componentes da 016 e classes de token.
- testes primeiro: nenhum unitário; a T21 cobre no E2E.
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: a demonstração chega a `/conversa` com a faixa; "Sair" volta à Entrada.
- fora: caixa de mensagem, abas, Perfil.

### T21 · Write the entry E2E and take the entry screenshots
- nivel: tela
- objetivo: E2E da Entrada, da demonstração, dos limites, dos headers e do `Origin`; screenshots da Entrada.
- arquivos: `e2e/entrada.spec.ts`, `e2e/smoke.spec.ts`, `.plans/017-entrada-light-celular.png`, `.plans/017-entrada-light-desktop.png`, `.plans/017-entrada-dark-celular.png`, `.plans/017-entrada-dark-desktop.png`
- depende de: T6, T16, T17, T18, T20
- leitura: nenhuma
- skills: `playwright`, `web-design-guidelines`
- referencia: nenhuma
- contratos: use `test`, `entrarNaDemo` de `e2e/apoio/sessao.ts`, `expectSemViolacoes` de `e2e/apoio/a11y.ts` e o tema de `e2e/apoio/tema.ts`. Casos:
  - demonstração em dois toques só com cliques e só com teclado (Tab/Enter), chegando a `/conversa` com a faixa "Demonstração";
  - limite por IP: com o mesmo `x-ritu-e2e`, 5 demonstrações passam e a 6ª volta à Entrada com `aviso.demo_limite_ip` (use `page.context().clearCookies()` entre elas);
  - sem Google, "Entrar com Google" não aparece;
  - headers e nonce: `/`, `/marca`, `/conversa` (logado) e `/api/alimentos?q=ab` respondem com `Content-Security-Policy` (nonce diferente em dois pedidos, sem `unsafe-inline` em `script-src`, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`;
  - `POST /api/onboarding/aviso` com `Origin: https://outro.exemplo` → `403`;
  - nenhuma violação de CSP no console (escute `console` e `pageerror`) em `/`, `/marca`, `/comecar/aviso` e `/conversa`;
  - "Sair" no menu da conta volta à Entrada;
  - axe (`expectSemViolacoes`) na Entrada, no Aviso e em `/conversa`, nos dois temas.
  - `e2e/smoke.spec.ts`: a Entrada mostra o nome (logo) e `entrada.aviso`.
  - Screenshots da Entrada nos dois temas e projetos, salvos nos caminhos da lista.
- testes primeiro: são os próprios.
- comandos: `npm run build`, `CI=1 npm run test:e2e` (porta 3000 ocupada: espere e repita)
- pronto quando: E2E verde nos dois projetos; os quatro screenshots existem. Defeito numa tela: relate arquivo e problema (o orquestrador abre a correção); não corrija tela fora desta lista.
- fora: arquivos das telas.

### T22 · Write the onboarding E2E and take the onboarding screenshots
- nivel: tela
- objetivo: E2E do onboarding de conta nova e do quiz; screenshots das telas de onboarding.
- arquivos: `e2e/comecar.spec.ts`, `.plans/017-aviso-light-celular.png`, `.plans/017-evitar-light-celular.png`, `.plans/017-dosha-light-celular.png`, `.plans/017-quiz-resultado-light-celular.png`
- depende de: T16, T18, T19, T20, T21
- leitura: nenhuma
- skills: `playwright`
- referencia: nenhuma
- contratos: use `test` e `entrarComContaNova` de `e2e/apoio/sessao.ts`. Cobre: Aviso → Evitar sempre (um grupo, um alimento da busca, um texto livre; e, noutro teste, "Nenhum") → Dosha ("Misto" com dois; noutro, "Agora não"; cidade pela busca — o modo e2e usa `fake-cities`, veja `src/infra/fakes/fake-cities.ts` para os nomes — e pulada) → `/conversa`; quiz completo com resultado dual (escolha respostas 4 vata, 3 pitta, 1 kapha); recarregar no meio volta ao mesmo passo; quem terminou e abre `/comecar/aviso` vai para `/conversa`; "Pronto" sem item tem `aria-disabled`; axe em cada tela nos dois temas. Screenshots nos caminhos da lista (claro, celular).
- testes primeiro: são os próprios.
- comandos: `npm run build`, `CI=1 npm run test:e2e`
- pronto quando: E2E verde nos dois projetos; screenshots existem. Defeito numa tela: relate (não corrija fora desta lista).
- fora: arquivos das telas.

### T23 · Add the security deterministic evals
- nivel: mecanica
- objetivo: os três evals determinísticos de segurança da entrega 3.
- arquivos: `evals/det/seguranca/sessao.eval.ts`, `evals/det/seguranca/demonstracao.eval.ts`, `evals/det/seguranca/origem-e-headers.eval.ts`
- depende de: T6, T10, T11, T14, T15
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: siga o formato de um eval existente em `evals/det/guardrails/`. Container em memória (`createContainer({ stores, tx, limiter: createMemoryLimiter(), ... })`), `contaDaSessao` fingido.
  - `sessao.eval.ts`: cada rota desta spec (`rotasDeOnboarding` aviso, evitar, perfil, quiz; `rotasDeBusca` cidades, alimentos) sem sessão → `401 { erro: "sem_sessao" }`; com conta de demonstração vencida (relógio adiantado 25 h) → `401`; a conta A não muda o onboarding da conta B.
  - `demonstracao.eval.ts`: duas demonstrações não se enxergam (casa, mensagens, runs, retornos, rotina, padrões lidos pela outra conta vêm vazios); a 6ª do mesmo IP e a 31ª do dia são recusadas sem criar conta; demonstração vencida some em `accounts.buscar` e é apagada por `executarLimpeza`; nenhuma chave do limitador contém o IP em claro (use um IP como `203.0.113.7` e `hashDoIp` de `src/infra/auth/ip.ts`; confira as chaves usadas consultando `limiter.usado`).
  - `origem-e-headers.eval.ts`: `origemValida` (outro site, sem `Origin`, mesmo host, `GET`); a CSP tem nonce, não tem `unsafe-inline` em `script-src` e tem `frame-ancestors 'none'`; os quatro headers de `headersDeSeguranca`.
- testes primeiro: são os próprios.
- comandos: `npm run lint`, `npm run typecheck`, `npm run eval:det`
- pronto quando: os três verdes.
- fora: `evals/det/mapa.ts` (não existe; decisão A1).

### C1 · Share the onboarding step submit helper
- nivel: tela
- objetivo: tirar a duplicação do envio de passo do onboarding (POST JSON, 401 → `/`, erro lança, sucesso devolve `proximo`) acusada pelo `npm run dup` na T19.
- arquivos: `src/app/(comecar)/_lib/enviar-passo.ts` (novo), `src/app/(comecar)/comecar/aviso/aceitar.tsx`, `src/app/(comecar)/comecar/evitar/escolher-evitar.tsx`, `src/app/(comecar)/comecar/dosha/escolher-dosha.tsx`, `src/app/(comecar)/comecar/quiz/quiz.tsx` (só se repetir a mesma sequência)
- depende de: T18, T19 (na mesma rodada, mesmo implementador)
- leitura: nenhuma
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos: `enviarPasso(url: string, corpo: unknown): Promise<string>` em código cliente: `fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) })`; `401` → `window.location.assign("/")` e devolve uma promessa que não resolve (ou lança um erro marcado que o chamador ignora); não-2xx → lança `Error`; 2xx → devolve `proximo` do JSON. Os chamadores fazem `router.push(await enviarPasso(...))` e, no `catch`, `setErro`. Comportamento visível igual ao de hoje.
- testes primeiro: nenhum unitário (a T22 cobre no E2E).
- comandos: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run dup` (0 clones)
- pronto quando: `npm run dup` sem clones em `src/app/(comecar)/`; as telas de aviso, evitar, dosha e quiz se comportam como antes.
- fora: textos, layout, rotas de API.

### C2 · Remove the inline style CSP violation on every page
- nivel: nucleo
- objetivo: nenhuma página (`/`, `/marca`, `/comecar/aviso`, `/conversa`) gera violação de CSP no console.
- arquivos: `src/core/security/csp.ts`, `src/core/security/csp.test.ts`, e, só se a origem estiver lá, o arquivo de `src/app/` ou `src/components/` que injeta o estilo (relate qual)
- depende de: T6, T21 (o E2E que acusa)
- leitura: nenhuma
- skills: `next-best-practices`
- referencia: nenhuma
- contratos: o E2E da T21 (`e2e/entrada.spec.ts`, sem commit, não edite) acusa no console, em toda página, "Applying inline style violates ... style-src 'self' 'nonce-…'", vindo do chunk compartilhado que contém o React Aria. A CSP atual (`montarCsp`) tem `style-src 'self' 'nonce-X'` e `style-src-attr 'unsafe-inline'`. Ache a origem (por exemplo, um `<style>` injetado em tempo de execução sem nonce, ou CSSOM) com o servidor de produção (`npm run build` e `npm start` com `RITU_MODO=e2e` como em `playwright.config.ts`, ou `CI=1 npx playwright test e2e/entrada.spec.ts -g "CSP"`). Corrija da forma mais estreita: preferir dar o nonce à origem; se a origem for de biblioteca e não aceitar nonce, liberar só o necessário em `style-src-elem`/`style-src-attr`, nunca `unsafe-inline` em `script-src`. Mantenha: nonce em `script-src` e `style-src`, sem `unsafe-inline` em `script-src`, `frame-ancestors 'none'` (testados também em `evals/det/seguranca/origem-e-headers.eval.ts`).
- testes primeiro: caso em `csp.test.ts` que trava a diretiva nova (se mudar a CSP).
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`, `npm run build`, e `CI=1 npx playwright test e2e/entrada.spec.ts -g "CSP"` (porta 3000 ocupada: espere e repita)
- pronto quando: os testes de CSP do `e2e/entrada.spec.ts` passam nos dois projetos.
- fora: `e2e/`, `src/components/base/button.tsx`.

### C3 · Name the pending button announcement
- nivel: tela
- objetivo: o botão em `isPending` não deixa na página um `role="img"` sem nome acessível.
- arquivos: `src/components/base/button.tsx` (e `spinner.tsx` se a origem for ele)
- depende de: T21 (o E2E que acusa)
- leitura: `.docs/DESIGN.md` §3 (só se precisar)
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar)
- referencia: nenhuma
- contratos: depois do clique em "Testar com perfil de demonstração" (botão `isPending`), sobra um `div[role=img][aria-labelledby=react-aria-…]` dentro de `div[role=log]` (o anunciador do React Aria), sem nome acessível; o axe acusa `role-img-alt` (serious) na página seguinte (Aviso, Conversa) na navegação sem recarregar. Faça o botão pendente anunciar com nome (por exemplo, `aria-label` no spinner ou texto "Carregando" visualmente escondido) de modo que o anúncio tenha nome, ou que não sobre `role="img"` sem nome. Comportamento visual igual.
- testes primeiro: caso no teste do botão (se existir `button.test.tsx`; senão, relate) que garante nome acessível no estado pendente.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: o elemento anunciado tem nome; os testes de axe da Entrada passam sem recarregar a página (a T21 confere).
- fora: `src/core/`, `e2e/`.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1 | Instala pacote e mexe em `next.config.ts`: sozinha |
| 2 | T3 | Migração: sozinha |
| 3 | T2, T4, T6, T7 | Sem dependência pendente e sem arquivo em comum |
| 4 | T5, T8, T9 | T5 precisa da T2; T8 do schema da T7; T9 da T1, T3 e T7 |
| 5 | T10, T11 | T10 precisa de T4, T7, T8; T11 do limitador no container (T9) |
| 6 | T12 | Auth sobre os serviços (T10) e o container (T9) |
| 7 | T13 | Apoio das rotas e páginas sobre a sessão |
| 8 | T16 | Mexe em `playwright.config.ts`: sozinha |
| 9 | T14, T15, T17, T20 | Rotas e telas sem arquivo em comum, todas sobre a T13 |
| 10 | T18, T23 | Onboarding precisa das rotas (T14); evals das rotas (T14, T15) |
| 11 | T19, C1 | T19 precisa da moldura (T18) e da busca (T15); C1 tira a duplicação que a T19 revelou: mesmo implementador, commits separados (T19, depois C1) |
| 12 | T21 | E2E da Entrada (Playwright na porta 3000: uma rodada por vez) |
| 12b | C2, C3 | Correções de tela e CSP reveladas pela T21; sem arquivo em comum. Depois, a T21 roda de novo e só então é commitada (C2 e C3 antes dela) |
| 13 | T22 | E2E do onboarding |
