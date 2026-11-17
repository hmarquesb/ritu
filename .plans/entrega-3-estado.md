# Entrega 3 · Estado

> A dona autorizou (2026-11-16, 5ª sessão): seguir sozinho até 95% de uso; a partir de 85%, no máximo duas tarefas por onda. Autorizou também juntar a `entrega-3` (017) na `main` antes do portão 2 e começar a 018.
> A dona autorizou (2026-11-16, 2ª sessão) seguir sozinho até 95% (janela de 5 horas e contexto); a partir de 80%, no máximo duas tarefas por onda.
> 2026-11-16: `main` juntada (a0e68e4; 013 e 016 `implemented` na `main`). A 017 pode começar; 018 a 020 dependem dela.
> Sem `git push`: o remoto `origin` não está acessível (como na entrega 2); a branch `entrega-3` fica só local. Push e CI ficam para quando o repositório remoto existir.
> Trilha adiantada (worktree `../ritu-worktrees/entrega-3`, branch `entrega-3`), aberta em 2026-11-16.
> Pré-condição da trilha: só spec `approved` cujas dependências estão `implemented` na `main`. Em 2026-11-16, só a 016 (depende de 001). 017 depende de 016; 018 a 020 dependem de 008–013 (013 ainda não está `implemented` na `main`).
> `npm run lint` pelo rtk dá falso erro de JSON: usar `rtk bypass npm run lint`.
> E2E neste worktree: `CI=1 npm run test:e2e`.
> 016 fechada (2026-11-16) em f4ad97d: gates 1 a 6 verdes e `npm run dup` com 0 clones, sobre a `main` juntada (cd63c49; o clone do intérprete × juiz saiu na `main`, cd1196f). Flakes de carga, que passam isolados: um teste que importa `./container` no `npm test` e `marca.spec.ts` › teclado › abas trocam com as setas (desktop) no E2E. Na junção, a `main` já usava a 0039 (Juiz); a ADR da 016 virou 0040 na junção (2026-11-16).
> Para o relatório (016 T16): com a lista da busca aberta, o axe exclui `[aria-hidden="true"]` (o React Aria esconde o resto da página sem tirar o foco); o teste do `ThemeSwitcher` aceita papel `radio` ou `button`.
> `eval:det` completo tem timeouts de 5 s sob carga (arquivos diferentes a cada rodada, todos fora da 016; passam isolados). Visto nas ondas 2 e 3 da 016.
> 016 T9: duas reprovações (classes da mesma propriedade em `BASE` e `SIZE` do `Button` se anulavam pela ordem da folha); a 2ª correção foi feita pelo orquestrador. Lição para T11/T12/T15: tamanho, padding e texto só no mapa de variante.
> Para o relatório (016 T9): o `Button` `danger` usa `opacity` no hover e no pressionado (não há token de hover para `danger`).

## 016 · Design system

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Install the UI packages, PostCSS and copy fonts and brand files | concluida | c69938a |
| T2 · Add the UI config and the theme cookie helpers | concluida | 07cca37 |
| T3 · Add the class joiner and the icon sizes | concluida | b5f6697 |
| T5 · Add the design guard test and the React Aria package home | concluida | 59fa3bf |
| T6 · Write the tokens, the global base styles and the paper texture | concluida | e3bf219 |
| T4 · Add the contrast checker and the token contrast test | concluida | dc1b037 |
| T8 · Add the E2E helpers for theme and accessibility | concluida | e54594d |
| T9 · Build the button family, spinner, text link and surface | concluida | 8d6960f |
| T10 · Build the text field, checkbox, switch and chips | concluida | 51421cd |
| T13 · Build the logo, the dosha blot and the theme switcher | concluida | 9c2ec25 |
| T11 · Build the menu, the dialog and sheet, and the tooltip | concluida | 39765f1 |
| T12 · Build the tabs, combo box, toast and state block | concluida | 9cab0bc |
| T7 · Wire the fonts, the root layout and the home page | concluida | 882f688 |
| T14 · Build the /marca sections for tokens, type, surfaces, icons, states, brand, motion and theme | concluida | 8b04e96 |
| T15 · Build the /marca components section with every state and overlay | concluida | 694ed57 |
| T16 · Assemble /marca, write its E2E and take the screenshots | concluida | ee464fe |
| C1 · Fix the component and section defects revealed by the /marca E2E | concluida | d823d12 |
| C2 · Remove the duplication flagged by npm run dup | concluida | f4ad97d |

## 017 · Entrada e contas

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Install next-auth, add RITU_MODO and trace the seed folder | concluida | ed2de1b |
| T3 · Add the UsageLimiter port, the limites table, the Postgres adapter and the memory fake | concluida | 64186b3 |
| T2 · Add the limits, quiz and entry text configs | concluida | ae2191f |
| T4 · Add PantryStore.semear with an explicit confirmation date | concluida | 65b9e17 |
| T6 · Add the CSP, security headers, Origin check and the proxy | concluida | c6ab80b |
| T7 · Add the demo seed schema, its validator and the YAML reader | concluida | ae432e9 |
| T5 · Add the onboarding step, quiz, dosha name and entry state functions | concluida | 08e23cb |
| T8 · Write the demo profile seed | concluida | e09383f |
| T9 · Wire the limiter, the demo seed and the E2E mode into the container | concluida | 80c88f5 |
| T10 · Add the demo creation, seed copy and Google sign-in services | concluida | f3ae7a0 |
| T11 · Clean the old limits in the daily cleanup | concluida | 94d1487 |
| T12 · Add the Auth.js session, the demo provider and the session actions | concluida | 20e6fbd |
| T13 · Add the account and route helpers for pages and API routes | concluida | f5caaa6 |
| T16 · Configure Playwright for the E2E mode and add the session fixture | concluida | 3a28de4 |
| T14 · Add the onboarding routes | concluida | 5937ef2 |
| T15 · Add the city and food search routes and the cleanup cron route | concluida | 497d5b1 |
| T17 · Build the entry page with the diagonal illustration | concluida | 4c5e762 |
| T20 · Build the signed-in frame, the demo banner and the empty conversation page | concluida | 5c637e1 |
| T18 · Build the onboarding layout, the notice and the always-avoid step | concluida | a86c2ba |
| T23 · Add the security deterministic evals | concluida | 31be27a |
| C1 · Share the onboarding step submit helper | concluida | dc55b5c |
| T19 · Build the dosha and city step and the quiz | concluida | 6dc0b55 |
| C2 · Remove the inline style CSP violation on every page | concluida | 3ca2c0f |
| C3 · Name the pending button announcement | concluida | 4885e18 |
| T21 · Write the entry E2E and take the entry screenshots | concluida | 81f248a |
| C4 · Fix the combo box opening and click, and the lingering pending announcement | concluida | 9b7dec5 |
| C5 · Keep the combo box closed after a choice clears the field | concluida | 8ca5e31 |
| C6 · Check the real demo seed against the real base in a test | concluida | 0488a9b |
| C7 · Show the entry metric on the dashboard | concluida | 70cdd07 |
| T22 · Write the onboarding E2E and take the onboarding screenshots | concluida |  |
> Para o relatório (017 T8): no `seed/demo.yaml`, a conversa de ontem traz o escalda-pés como 1ª sugestão, mas a resposta fala do jantar primeiro; inverter se a tela mostrar os cards junto do texto. As respostas semeadas não levam "Não é orientação médica" no texto (o schema não exige; conferir que a tela acrescenta o aviso nas conversas semeadas).
> 2026-11-16 (3ª sessão): vereditos da onda T14+T15 perdidos com o fim dos tokens; os verificadores rodaram de novo sobre os arquivos prontos (sem reimplementar). Resto da onda 9 (T17, T20) juntado com a onda 10 (T18, T23): sem arquivo em comum e dependências com commit.
> 017 T18 e T23: uma reprovação cada nos gates da onda (teste de arquitetura: R5, `react-aria-components` em `src/app/`; R6, eval importando `@/infra/auth/ip`). Corrigidas pelo mesmo implementador. Na re-rodada, o `eval:det` completo ficou inconclusivo por carga da máquina (load > 260, outras sessões): timeouts em arquivos fora da onda; os evals da T23 passam isolados e o `eval:det` inteiro já tinha passado na 1ª rodada da onda. Conferir de novo no fechamento da 017.
> Para o relatório (017 T23): `demonstracao.eval.ts` refaz o `hashDoIp` (HMAC sha256) dentro do eval, porque R6 proíbe importar `@/infra/auth/ip`; se o cálculo mudar em produção, a cópia não acompanha (o eval não testa o hash).
> 017 T19: implementada e reprovada só no `npm run dup` (o `continuar()` de `escolher-dosha.tsx` repete o POST + 401 + `router.push(proximo)` de `aviso/aceitar.tsx` e `evitar/escolher-evitar.tsx`; o resto aprovado pelo verificador, com lint, typecheck, test e build verdes). Interrompida na passagem (5 h em 91%): os 4 arquivos foram guardados em `.local/t19-pendente/` (fora do git) e retirados da árvore. Ver `.local/PASSAGEM.md`.
> 2026-11-16 (4ª sessão): retomada da passagem; T19 restaurada de `.local/t19-pendente/` e despachada com a C1 (A9).
> 017 C1: uma reprovação por processo (skills de tela não carregadas; o bloco da C1 dizia "nenhuma", corrigido no plano); nada mudou no código. C1 commitada antes da T19 porque `escolher-dosha.tsx` já usa o helper.
> Para o relatório (017 T19): no quiz, o último botão diz "Ver resultado" (a tarefa dizia "Próxima"); rótulos "Seu dosha", "Buscar cidade", "Misto", "Escolha dois dos três." e mensagens de erro ficam fixos nos componentes, fora de `config.textosEntrada`; a mensagem de 503 acrescenta "Você pode seguir sem ela.".
> 017 T21: implementada (sem commit); bloqueada em 2 casos de CSP e um axe `role-img-alt` (contornado com reload) por defeitos de tela → C2 e C3 (A10). Carga 260–330; Playwright rodou com `--timeout=120000` na linha de comando.
> 017 C2: a origem era o `<style>` que o React Aria injeta (usePress, `disableTextSelection`), que procura o nonce em `<meta name="csp-nonce">`; a correção ficou em `src/app/layout.tsx` (meta com o `x-nonce` do pedido), `csp.ts` intacto. C3: o anúncio do botão pendente (`role=img` com `aria-labelledby` do botão, 7 s no LiveAnnouncer) ficava órfão quando a navegação desmontava o botão; `button.tsx` remove os anúncios órfãos ao sair do pendente. Gates da onda verdes; `npm test` com 4 timeouts de carga (`test/fixtures/cenarios`, passa isolado).
> 017 T21: uma reprovação (axe intermitente no Aviso: anúncio órfão ainda não limpo e `<title>` não assentado; `.catch` engolindo erro de navegação). Corrigida com `aguardarAssentar` (espera observável; o `toHaveCount(0)` em 5 s só passa com a limpeza da C3, não com os 7 s do React Aria). 36/36 duas vezes. Observação do verificador: stack trace de `[WebServer]` durante a rodada, testes verdes; conferir no fechamento.
> 017 T22: implementada (sem commit), `comecar.spec.ts` 54/54 com `--repeat-each=3`, mas com contornos de defeitos de tela (ComboBox não abre com sugestões assíncronas; clique na opção interceptado pelo rótulo seguinte; anúncio órfão até 7 s, prazo subido a 10 s) → C4 (A11). `entrarComContaNova` termina em `/comecar/evitar` (não no Aviso): o spec criou `entrarNoAviso`. Suíte E2E inteira não rodou: servidor `next-server` órfão (PID 11746, `npm run start` deste worktree) travado na porta 3000; o classificador negou o `kill` ao subagente; levado à dona.
> 017 C4: aprovada só estaticamente (lint, typecheck, test, dup; build pelo implementador); clique interceptado sem causa confirmada; o E2E da T22 confere. Próximo: liberar a porta 3000 (servidor órfão PID 11746/11712, aguardando a dona), devolver a T22 ao implementador sem contornos (sem ArrowDown, `toHaveCount(0)` em 5 s, `CI=1`), verificar, commitar.
> 017 T22 (2ª rodada): sem contornos, o teste de Evitar falhou 10/10 por (a) lista reaberta após a escolha (`allowsEmptyCollection` da C4) → C5, feita pelo orquestrador (2ª falha de tela da C4); (b) clique "interceptado" pelo rótulo: o React Aria deixa o popover com `opacity: 0` e `clip-path` enquanto posiciona; não é defeito para a pessoa; o spec espera a opção ser o alvo do ponteiro. Com isso: `comecar.spec.ts` 54/54 (`--repeat-each=3`) e E2E inteiro 99/99. Servidor órfão da porta 3000 encerrado (pela sessão da C4, retomada pela dona).
> 2026-11-16: `main` juntada em 324041b (014 e 015). Conflitos: config, `METRICAS` (registro tipado; `ritu_entrada_total` acrescentada), DECISOES; acomodação `telemetry.log(codigo)` em rota/cron; `mapa.ts` com os evals de segurança da 017 e o `telemetria/voto.eval.ts` da `main`. A2 resolvida pela `main` (`erro_inesperado` em `LOGS`). Gates do merge: lint, typecheck, build, dup verdes; as duas falhas (contagem de métricas e mapa) corrigidas e reconferidas isoladas; gates completos no fechamento.
> 017 fechada (2026-11-16) em 70cdd07: gates 1 a 6 verdes no repositório inteiro (lint; typecheck; test 2851, a única falha — contagem de painéis da C7 — corrigida e `scripts/lib` reconferido 505/505; eval:det 1108; build; E2E 99 + 9 pulados; dup 0 clones). ADR 0043 (0042 ficou com a telemetria da trilha principal). Docs vivos atualizados (ARCHITECTURE §4–§7, BUSINESS §6 e §13, DESIGN §5, OBSERVABILITY, DEVELOPMENT, linha do `test:e2e` no AGENTS, linhas 017 e 020 do backlog); linhas de status ficam com a sessão principal.
> Para o relatório (017): não conferidos sem Postgres/rede — `test:db` (tabela `limites`, `semear`), demonstração com banco real e `npm run cleanup` imprimindo `limites`, login Google real. Critérios de aceite da spec seguem com `[ ]` (cobertos por E2E e testes, salvo os acima). No E2E, `[WebServer] [auth][error] CredentialsSignin` aparece no cenário de limite (6ª demonstração recusada), sem falha. Screenshots em `.plans/017-*.png`.

> 2026-11-16 (5ª sessão): `main` juntada na branch (fb91cd6, com a correção J1: o eval de cobertura de telemetria da 015 passa a emitir `ritu_entrada_total` pelos caminhos de entrada); gates 1 a 5 verdes. Depois, `entrega-3` juntada na `main` (a3dd60f) com autorização da dona; 017 `implemented` na `main`. Falha intermitente de carga em `guardrails/privacidade.eval.ts` (passa isolado 3/3).

## 018 · Tela Conversa

| Tarefa | Status | Commit |
|---|---|---|
| T1 · Add RunRepository.doDia and votos | concluida | 4730086 |
| T2 · Add the conversation screen configs and texts | concluida | dd149d3 |
| T3 · Call aoCriar when conversar creates the run | concluida | d9cf2e2 |
| T4 · Add the E2E mode scripts, the fixed weather and wire them in the container | concluida | 36a2e83 |
| T5 · Add the radio group and the toggle button to the base components | concluida | 3bea437 |
| T6 · Add the step sentences | concluida | 5347ed3 |
| T7 · Add the signed-in navigation and the empty tab pages | concluida | dab13d0 |
| T8 · Add the run view projection | concluida | 36d24c4 |
| T9 · Build the speech, steps, footer, returns indicator and message box | concluida | 9c77455 |
| T10 · Add the stream events codec | concluida | df53f2c |
| T11 · Add the conversation of the day | concluida | 569329d |
| T12 · Add the streaming route helper and the error status map | concluida | a7530a8 |
| T13 · Add the screen state reducer and the useConversa hook | concluida | 8442bc4 |
| T14 · Build the suggestion, ingredient, buy-later line, question and approval block | concluida | 8d2573f |
| T15 · Add the JSON routes of the conversation and the run | concluida | 025949e |
| T16 · Add the streaming run routes | concluida | e2dff2b |
| T17 · Build the conversation screen and page | concluida | 8dc9796 |
| T18 · Add the conversation deterministic evals | concluida | 47a8622 |
| T19 · Write the conversation E2E and take the screenshots | concluida | 9b018b4 |
| C1 · Isolate the model quota per E2E test | concluida | a016c14 |
| C3 · Align the header with the body on desktop and keep the message box above the bar on mobile | concluida | 8bef574 |
| C4 · Keep the fixed panel from covering the conversation and fix the returns link target | concluida | ff430d3 |
| C2 · Answer run_aberto with 409 when another run is running | concluida | 26b7595 |
> 018 T9: uma reprovação (voto com tipo próprio em vez de `"up" | "down"`; envio duplo pelo submit e pelo `onPress`; `aria-disabled` não chega ao `textarea`). Devolvida ao implementador, que pode tocar `src/components/base/text-field.tsx`.
> 018 T13: uma reprovação (conexão caída sem `fim` deixa a caixa travada; sem teste do caminho de consulta; R4: `use-conversa.ts` importa valor de `@/core/conversation/eventos`). Devolvida com A6 (`lerEventos` vai para `src/components/ritu/conversa/ler-eventos.ts`).
> Para o fechamento da 018: o E2E da 017 regrava `.plans/017-*.png` a cada rodada (screenshots sem condição); larguras arbitrárias (`max-w-[59rem]`, `max-w-[38rem]`, `max-w-[26rem]`) fora dos tokens: avaliar um token `--container-shell` no fechamento.
> Para o fechamento da 018 (T18): a linha nova do mapa "Visão do run sem campo interno" precisa entrar em `.docs/QA.md`; o `npm run eval:det:resumo` lê `.vitest/eval-det.json`, que o `npm run eval:det` não grava (só o comando da CI grava): a linha do AGENTS.md diz que o resumo "roda" os evals.
> 018 T19: E2E escrito (`e2e/conversa.spec.ts`, mapa, 16 screenshots), sem commit; travado em defeitos de produto → C1 (cota do modo e2e compartilhada entre testes), C2 (run aberto responde 500), C3 (cabeçalho desalinhado no desktop; caixa sob a barra no celular). Servidor órfão (PID 5150, deste worktree) encerrado pelo orquestrador. Divergências aceitas no teste: "conta nova" é demonstração sem semente (o E2E não simula Google), então a caixa vem com a mensagem sugerida; Trocar no roteiro `troca` leva canela→cominho direto.
> 018 C2: uma reprovação (`ehRituError` aceitava qualquer `Error` com `code`: erro do driver ou do Node viraria 400 com código interno, sem log). Devolvida com marca `Symbol.for("ritu.error")` na `RituError` (o `name` não serve: as subclasses o sobrescrevem). Causa do 500: no build, o container e2e no `globalThis` vem de outra cópia de `@/core/errors`, e o `instanceof` falha.
> 018 T19 (2ª rodada): `conversa.spec.ts` 186/6/48 em `--repeat-each=3`; suíte inteira 161/2/25. Falha: axe `target-size` no link de retornos (desktop), painel fixo cobrindo a resposta (desktop) e a pergunta (celular), faixa da demonstração desalinhada → C4. Duas falhas do próprio teste corrigidas na T19 (seletor duplicado pela região `aria-live`; sincronização do "run aberto" pela 1ª etapa: era a intermitência do `:311`).
> Para o relatório (018 T19): no desktop, a borda direita do cabeçalho (menu em x≈1100) e a do corpo da conversa (x≈1064) não coincidem (borda esquerda alinhada). No celular, o cabeçalho não é fixo e sai de vista ao rolar. No desktop e no celular, a parte de baixo de um cartão de sugestão fica sob o painel fixo até a pessoa rolar.
> 018 fechada (2026-11-17) em 9b018b4: gates 1 a 6 verdes depois da junção da `main` (05da929, fechamento da entrega 2): test 3007, eval:det 1347, E2E 163 + 25 pulados (screenshots), dup 0 clones. ADR 0044. Docs vivos (ARCHITECTURE §3 e §7, BUSINESS §7 e §8, DESIGN §2 a §4, QA, DEVELOPMENT, tabela da entrega 3 em `.specs/README.md`, Comandos do AGENTS); linhas de status ficam com a sessão principal. Screenshots em `.plans/018-*.png`.
> Para o relatório (018): não conferidos sem Postgres/rede/chave: `test:db` (`RunRepository.doDia` e `votos`), mensagem de verdade pela tela com banco e chave. Na tabela "Rotas de toque" do ARCHITECTURE §3 ficam rotas que a 019 cria (`/api/retornos/:id`, `/api/preferencias`, `/api/casa`, `/api/lista`, `/api/padroes/:id`) e assinaturas do core com `deps`: revisar na 019. O E2E da 017 regrava `.plans/017-*.png` a cada rodada (screenshots sem condição): vale pôr atrás de `SCREENSHOTS=1` numa correção.
