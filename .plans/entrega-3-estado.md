# Entrega 3 · Estado

> A dona autorizou (2026-11-16) seguir até 96% da janela de 5 horas nesta sessão.
> Trilha adiantada (worktree `../ritu-worktrees/entrega-3`, branch `entrega-3`), aberta em 2026-11-16.
> Pré-condição da trilha: só spec `approved` cujas dependências estão `implemented` na `main`. Em 2026-11-16, só a 016 (depende de 001). 017 depende de 016; 018 a 020 dependem de 008–013 (013 ainda não está `implemented` na `main`).
> `npm run lint` pelo rtk dá falso erro de JSON: usar `rtk bypass npm run lint`.
> E2E neste worktree: `CI=1 npm run test:e2e`.
> 016 fechada (2026-11-16) em f4ad97d: gates 1 a 6 verdes e `npm run dup` com 0 clones, sobre a `main` juntada (cd63c49; o clone do intérprete × juiz saiu na `main`, cd1196f). Flakes de carga, que passam isolados: um teste que importa `./container` no `npm test` e `marca.spec.ts` › teclado › abas trocam com as setas (desktop) no E2E. Na junção, conferir se a `main` não usou o número 0039 de ADR.
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
