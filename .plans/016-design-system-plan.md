# 016 · Design system · Plano

Spec: `.specs/016-design-system.md`. Trilha adiantada, branch `entrega-3`.

Regras comuns a todas as tarefas:

- Os valores de token são da dona. Par de contraste reprovado é bloqueio a relatar, não ajuste.
- Nenhuma cor literal (`#hex`, `rgb(`, `hsl(`, `oklch(`) em `src/app/**` ou `src/components/**` fora de `src/components/tokens/tokens.css` e dos arquivos de teste. Nada de variante `dark:`, `dangerouslySetInnerHTML`, `text-[<n>px]` ou `font-size: <n>px`.
- Sem shadcn/ui, Radix, Headless UI, MUI, Chakra, antd, lucide, `clsx`, `cva`, `tailwind-variants`. Sem jsdom: comportamento de componente se testa no Playwright (T16).
- Confira a API do Tailwind v4, do React Aria Components e do Phosphor **na versão instalada** (`node_modules/<pacote>`) antes de usar. Primitivo ou prop com outro nome: use o equivalente e diga na resposta (o orquestrador registra a decisão); os nomes exportados pelo Ritu não mudam.
- `npm run lint` pelo rtk dá falso erro de JSON: use `rtk bypass npm run lint`.
- E2E neste worktree: `CI=1 npm run test:e2e` (depois de `npm run build`). Porta 3000 ocupada: espere e repita.
- Não edite nada em `design/`. Não abra pastas fora do repositório.

### T1 · Install the UI packages, PostCSS and copy fonts and brand files
- nivel: mecanica
- objetivo: deixar Tailwind v4, React Aria Components, Phosphor e o axe instalados, o PostCSS configurado e as fontes e os arquivos de marca copiados para o lugar.
- arquivos: `package.json`, `package-lock.json`, `postcss.config.mjs` (novo), `biome.json` (só se preciso), `src/app/fonts/cormorant-garamond.woff2`, `src/app/fonts/figtree.woff2`, `src/app/fonts/OFL.txt` (novos), `public/marca/simbolo-ritu.png`, `public/marca/mancha-vata.webp`, `public/marca/mancha-pitta.webp`, `public/marca/mancha-kapha.webp` (novos)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - Pacotes: `tailwindcss` e `@tailwindcss/postcss` dev `^4.3` (a atual 4.x); `react-aria-components` prod, versão **exata** (`1.22.1` ou a atual, sem `^`; use `npm install --save-exact`); `@phosphor-icons/react` prod `^2.1`; `@axe-core/playwright` dev `^4.14`.
  - `postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } }`. Se o Biome reclamar das diretivas do Tailwind em CSS (`@theme`, `@import "tailwindcss"`, `@custom-variant`), ligar `css.parser.tailwindDirectives: true` em `biome.json`.
  - Fontes: instalar `@fontsource-variable/cormorant-garamond` e `@fontsource-variable/figtree` com `npm install --no-save`, copiar `files/cormorant-garamond-latin-wght-normal.woff2` → `src/app/fonts/cormorant-garamond.woff2` e `files/figtree-latin-wght-normal.woff2` → `src/app/fonts/figtree.woff2` (confira os nomes na versão instalada), e a licença OFL de um dos pacotes (ou das duas, concatenadas, com o nome de cada fonte) → `src/app/fonts/OFL.txt`. Os `@fontsource-variable/*` **não** entram no `package.json`.
  - Marca: copiar (sem alterar) `design/derivados/simbolo-ritu.png`, `mancha-vata.webp`, `mancha-pitta.webp`, `mancha-kapha.webp` para `public/marca/`.
- testes primeiro: nenhum (só instalação); `package.json` não deve conter `@fontsource-variable`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: pacotes no `package.json` com as faixas acima (React Aria sem `^`); `postcss.config.mjs` existe; os 3 arquivos de fonte e os 4 de marca existem; gates verdes.
- fora: nenhum CSS, componente ou página; `config/`; `design/`.

### T2 · Add the UI config and the theme cookie helpers
- nivel: mecanica
- objetivo: criar `config.ui` e as funções puras do tema (`parseTheme`, `themeCookie`), com teste.
- arquivos: `config/ui.ts` (novo), `config/index.ts`, `src/components/theme/theme.ts` (novo), `src/components/theme/theme.test.ts` (novo)
- depende de: T1
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // config/ui.ts — incluir em config/index.ts como `ui` (import e chave no objeto `config`)
  export const ui = {
    theme: { cookie: "ritu_theme", maxAgeDays: 365, colorLight: "#F8F3EA", colorDark: "#1E1611" },
    toast: { timeoutMs: 6000 },
    tooltip: { delayMs: 600 },
  } as const

  // src/components/theme/theme.ts (sem "use client"; importa só @config/index)
  export type Theme = "light" | "dark"
  export type ThemeChoice = Theme | "auto"
  export const THEME_COOKIE: string                                  // = config.ui.theme.cookie
  export function parseTheme(value: string | undefined): ThemeChoice // valor desconhecido ou ausente → "auto"
  export function themeCookie(choice: ThemeChoice): string
  // "light" | "dark" → "ritu_theme=<valor>; Path=/; Max-Age=<365 dias em s>; SameSite=Lax"   (Max-Age = maxAgeDays * 86400 = 31536000)
  // "auto"           → "ritu_theme=; Path=/; Max-Age=0; SameSite=Lax"
  ```
- testes primeiro: `parseTheme("light")`→`"light"`, `"dark"`→`"dark"`, `"auto"`→`"auto"`, `undefined`→`"auto"`, `""`→`"auto"`, `"DARK"`/`"blue"`→`"auto"`; `themeCookie("dark")` igual à string exata com `Max-Age=31536000`; `themeCookie("light")`; `themeCookie("auto")` com `Max-Age=0` e valor vazio; `THEME_COOKIE === "ritu_theme"`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; `config.ui` acessível por `config.ui.theme.cookie`.
- fora: `theme-switcher.tsx` (T13), `layout.tsx` (T7).

### T3 · Add the class joiner and the icon sizes
- nivel: mecanica
- objetivo: criar `cx` (junta classes) e `ICON` (tamanhos de ícone), com teste.
- arquivos: `src/components/cx.ts`, `src/components/cx.test.ts`, `src/components/base/icon-size.ts` (novos)
- depende de: T1
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/components/cx.ts
  export function cx(...parts: Array<string | false | null | undefined>): string
  // junta com um espaço as partes "truthy" e não vazias, sem espaço sobrando nas pontas

  // src/components/base/icon-size.ts (sem "use client")
  export const ICON = { sm: 16, md: 20, lg: 24, xl: 32, blot: 56 } as const
  ```
- testes primeiro: `cx()`→`""`; `cx("a", false, null, undefined, "b")`→`"a b"`; `cx("", "a")`→`"a"`; `cx("a b", "c")`→`"a b c"`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: qualquer componente.

### T5 · Add the design guard test and the React Aria package home
- nivel: mecanica
- objetivo: um teste que varre o código de tela e acusa as regras G1 a G5, e a regra de pacote que prende o React Aria em `src/components/`.
- arquivos: `src/components/design-guard.test.ts` (novo), `src/architecture.test.ts`
- depende de: T1
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  - `design-guard.test.ts` varre `src/app/**` e `src/components/**` (arquivos `.ts`, `.tsx`, `.css`), fora de `src/components/tokens/tokens.css` e dos arquivos de teste (`*.test.ts`, `*.test.tsx`). Falha com uma linha por achado, no formato `<arquivo>:<linha>: G<n>`.

    | Regra | Acusa |
    |---|---|
    | G1 | Cor literal: `#` seguido de 3 a 8 hexadecimais (como token, não dentro de outro identificador; `href="#conteudo"` não é cor: exija que os caracteres sejam todos hex e que não venha letra/dígito depois), `rgb(`, `hsl(`, `oklch(` |
    | G2 | Variante `dark:` em classe |
    | G3 | `dangerouslySetInnerHTML` |
    | G4 | Import de `@radix-ui/*`, `@headlessui/*`, `@mui/*`, `@chakra-ui/*`, `antd`, `lucide-react`, `class-variance-authority`, `tailwind-variants` |
    | G5 | Tamanho de texto em `px`: `text-[<n>px]` ou `font-size: <n>px` |

    Separe a função pura de detecção (recebe caminho e texto, devolve achados) do passeio no disco, e teste a função com exemplos positivos e negativos dentro do próprio arquivo de teste (por isso ele é excluído da varredura). Cuidado: `#conteudo`, `#fff` dentro de comentário conta como G1 (é cor), `#ade` em `href="#ade"` é ambíguo — trate `href="#..."`/`"#id"` em atributo `href`/`id` como não cor.
  - `src/architecture.test.ts`: acrescentar a `PACKAGE_HOMES` (regra R5): `"react-aria-components": ["src/components/"]`, `"react-aria": ["src/components/"]`, `"react-stately": ["src/components/"]`, `"@react-aria": ["src/components/"]`, `"@react-stately": ["src/components/"]`.
- testes primeiro: casos da função pura: `bg-[#fff]`→G1; `color: rgb(0 0 0)`→G1; `oklch(`→G1; `href="#conteudo"`→nada; `className="dark:bg-ink"`→G2; `dangerouslySetInnerHTML`→G3; `import x from "@radix-ui/react-dialog"`→G4; `from "lucide-react"`→G4; `text-[14px]`→G5; `font-size: 12px`→G5; `text-body`→nada. E a varredura real do repositório sem achados.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes; a varredura real passa; uma importação de `react-aria-components` fora de `src/components/` seria acusada como R5.
- fora: qualquer arquivo de `src/app/` ou de componente.

### T6 · Write the tokens, the global base styles and the paper texture
- nivel: tela
- objetivo: `tokens.css` com todos os tokens fechados pela dona (Tailwind v4, `light-dark()`, escalas padrão zeradas), `globals.css` com a base, e `papel.svg`.
- arquivos: `src/components/tokens/tokens.css`, `src/app/globals.css`, `public/marca/papel.svg` (novos), `biome.json` (só `css.parser.tailwindDirectives: true`; acrescentado na onda 2: a T1 não o ligou porque ainda não havia CSS)
- depende de: T1
- leitura: `.docs/DESIGN.md` (inteiro; é curto), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos:
  - Cada cor é `--ritu-<nome>: light-dark(<claro>, <escuro>);` em `:root`, e o `@theme inline` expõe `--color-<nome>: var(--ritu-<nome>)` (classes `bg-canvas`, `text-ink`, `border-line`...). Antes, o `@theme` zera `--color-*`, `--radius-*`, `--shadow-*`, `--text-*`, `--ease-*`, `--animate-*` (`--color-*: initial;` etc.), para `bg-red-500`, `rounded-xl` e `text-lg` não gerarem classe.

    | Token | Claro | Escuro |
    |---|---|---|
    | `canvas` | `#F8F3EA` | `#1E1611` |
    | `sunken` | `#EFE7DA` | `#18110D` |
    | `surface` | `#FDFAF4` | `#2A1F18` |
    | `raised` | `#FFFDF8` | `#35281F` |
    | `line` | `#E2D5C0` | `#4A3A2E` |
    | `line-strong` | `#94806A` | `#9A8571` |
    | `ink` | `#33241A` | `#F1E6D6` |
    | `ink-muted` | `#6B5646` | `#C4B19C` |
    | `primary` | `#9E4B2B` | `#E39570` |
    | `primary-hover` | `#8E4226` | `#EBA988` |
    | `primary-pressed` | `#7A3820` | `#F0B89C` |
    | `on-primary` | `#FFF8EF` | `#2A140A` |
    | `primary-soft` | `#F3DDD0` | `#4A2A1C` |
    | `amber` | `#D99A2B` | `#E6B455` |
    | `amber-ink` | `#855608` | `#E6B455` |
    | `amber-soft` | `#F6E3B8` | `#4A3716` |
    | `sage` | `#7C8F72` | `#8FA384` |
    | `sage-ink` | `#4A6044` | `#A9BC9E` |
    | `sage-soft` | `#DFE7D8` | `#2C3A28` |
    | `danger` | `#9A2B38` | `#F2A0A6` |
    | `danger-soft` | `#F5DCDC` | `#4A2226` |
    | `focus` | `#33241A` | `#F1E6D6` |
    | `vata` | `#5E7FA3` | `#9DB9D8` |
    | `pitta` | `#B5562A` | `#E9A070` |
    | `kapha` | `#5F7A52` | `#A8C19A` |
    | `paper` | `#F6F1E7` | `#F6F1E7` |
    | `paper-ink` | `#33241A` | `#33241A` |
    | `scrim` | `rgb(51 36 26 / 0.45)` | `rgb(0 0 0 / 0.6)` |
    | `shadow` | `rgb(74 52 36 / 0.14)` | `rgb(0 0 0 / 0.5)` |

    Escreva os hex exatamente como acima (maiúsculas, `#RRGGBB`): o teste de contraste (T4) lê `--ritu-<nome>: light-dark(a, b)` com regex.
  - Tema:
    ```css
    :root { color-scheme: light dark; /* tokens */ }
    :root[data-theme="light"] { color-scheme: light; }
    :root[data-theme="dark"]  { color-scheme: dark; }
    ```
  - Demais tokens no `@theme`:
    - Fontes: `--font-title: var(--font-cormorant), "Iowan Old Style", Georgia, serif` · `--font-body: var(--font-figtree), ui-sans-serif, system-ui, sans-serif`
    - Texto (tamanho / entrelinha, com `--text-<n>--line-height`): `caption` 0.8125rem / 1.4 · `sm` 0.875rem / 1.5 · `body` 1rem / 1.6 · `prose` 1.0625rem / 1.7 · `title-sm` 1.375rem / 1.25 · `title` 1.75rem / 1.2 · `display` 2.25rem / 1.1
    - Raio: `sm` 0.625rem · `md` 1rem · `lg` 1.5rem · `card` 1.75rem · `pill` 999px
    - Sombra: `soft`: `0 1px 2px var(--ritu-shadow), 0 4px 16px -6px var(--ritu-shadow)` · `lift`: `0 2px 6px var(--ritu-shadow), 0 16px 40px -12px var(--ritu-shadow)`
    - Largura: `--container-prose: 34rem` · `--container-content: 40rem`
    - Movimento: `--ease-ritu: cubic-bezier(0.2, 0.7, 0.2, 1)`; durações (em `:root`) `--ritu-fast: 120ms`, `--ritu-base: 200ms`, `--ritu-slow: 320ms`
    - Animação: `--animate-rise` (sobe 0.375rem e aparece, `--ritu-slow`, `--ease-ritu`), `--animate-fade` (aparece, `--ritu-base`), `--animate-sheet` (sobe de baixo, `--ritu-slow`), com os `@keyframes`.
    - Regras de tipo (documente em comentário; os componentes aplicam): `title-sm`, `title` e `display` usam `font-title` peso 600 (500 no `display`); o resto `font-body` (400; 500 rótulo; 600 ênfase). Espaçamento: escala padrão do Tailwind (não zerar `--spacing`).
  - `src/app/globals.css`:
    - `@import "tailwindcss";` e `@import "../components/tokens/tokens.css";`.
    - `body`: `bg-canvas text-ink font-body text-body` (via `@apply` ou propriedades com `var()`), `min-height: 100dvh`, `-webkit-font-smoothing: antialiased`. `body::before`: `position: fixed; inset: 0; pointer-events: none; content: ""; background-image: url("/marca/papel.svg");` (e `z-index` que não cubra conteúdo interativo).
    - Foco: `outline: 2px solid var(--ritu-focus); outline-offset: 2px;` em `:focus-visible` e em `[data-focus-visible]`. Nenhum `outline: none` sem substituto.
    - `@media (prefers-reduced-motion: reduce)`: `*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; animation-iteration-count: 1 !important; }`.
    - `::selection` com `background: var(--ritu-primary-soft)`.
  - `public/marca/papel.svg`: ruído fino com `feTurbulence`, 240 × 240, repetível, marrom com alfa baixo, igual nos dois temas (é arquivo em `public/`, pode ter cor literal).
- testes primeiro: nenhum novo aqui (o contraste é a T4); `npm test` deve continuar verde, inclusive a guarda do design se já estiver commitada.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: build verde com o CSS importado em lugar nenhum ainda é aceitável (o `layout.tsx` importa `globals.css` na T7); os nomes e valores batem com a tabela; nenhum `dark:`.
- fora: `layout.tsx`, componentes, páginas.

### T4 · Add the contrast checker and the token contrast test
- nivel: mecanica
- objetivo: funções puras que leem `tokens.css` e calculam contraste WCAG, e o teste que confere todos os pares nos dois temas.
- arquivos: `src/components/tokens/contrast.ts`, `src/components/tokens/tokens.test.ts` (novos)
- depende de: T6
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // src/components/tokens/contrast.ts
  export function parseTokens(css: string): Record<string, { light: string; dark: string }>
  // lê cada `--ritu-<nome>: light-dark(a, b)`; a chave é <nome>
  export function contrastRatio(a: string, b: string): number
  // WCAG 2.x, cores `#RRGGBB` (aceitar maiúsculas e minúsculas)
  ```
  `contrast.ts` não pode conter cor literal (`#` + 3 a 8 hex, `rgb(`...): a guarda do design varre `src/components/`. Escreva a regex do hex sem formar esse padrão literal (ex.: `/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i` é ok porque `#(` não é hex).
  - `tokens.test.ts` lê `src/components/tokens/tokens.css` do disco e confere:
    - que existe cada token: `canvas, sunken, surface, raised, line, line-strong, ink, ink-muted, primary, primary-hover, primary-pressed, on-primary, primary-soft, amber, amber-ink, amber-soft, sage, sage-ink, sage-soft, danger, danger-soft, focus, vata, pitta, kapha, paper, paper-ink, scrim, shadow`;
    - nos dois temas (`light` e `dark`), ≥ 4,5: `ink`, `ink-muted`, `primary`, `danger`, `sage-ink` e `amber-ink` sobre `canvas`, `sunken`, `surface` e `raised`; `on-primary` sobre `primary`, `primary-hover` e `primary-pressed`; `ink` e `ink-muted` sobre `primary-soft`, `amber-soft`, `sage-soft` e `danger-soft`; `primary` sobre `primary-soft`; `sage-ink` sobre `sage-soft`; `amber-ink` sobre `amber-soft`; `danger` sobre `danger-soft`; `paper-ink` sobre `paper`.
    - ≥ 3: `line-strong`, `focus`, `vata`, `pitta` e `kapha` sobre `canvas`, `sunken`, `surface` e `raised`.
    - A mensagem de falha diz o par, o tema e a razão obtida. Mínimos esperados: 4,6 e 3,08 no claro; 5,37 e 4,05 no escuro.
  - **Se algum par reprovar, não mude `tokens.css`**: pare e relate o par e a razão.
- testes primeiro: `contrastRatio("#000000", "#FFFFFF")` ≈ 21; `contrastRatio("#FFFFFF", "#FFFFFF")` = 1; simétrico; `parseTokens` com um trecho mínimo de CSS; depois os pares.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: todos os pares passam; testes verdes.
- fora: `tokens.css`.

### T8 · Add the E2E helpers for theme and accessibility
- nivel: mecanica
- objetivo: duas funções de apoio que as specs de tela usam: pôr o tema por cookie e conferir o axe.
- arquivos: `e2e/apoio/tema.ts`, `e2e/apoio/a11y.ts` (novos)
- depende de: T1
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos:
  ```ts
  // e2e/apoio/tema.ts
  export const TEMAS = ["light", "dark"] as const
  export async function usarTema(context: BrowserContext, tema: (typeof TEMAS)[number]): Promise<void>
  // põe o cookie ritu_theme=<tema> para o baseURL do teste (localhost:3000), Path=/

  // e2e/apoio/a11y.ts
  export async function expectSemViolacoes(page: Page, opcoes?: { excluir?: string[] }): Promise<void>
  // AxeBuilder (@axe-core/playwright) com withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]);
  // `excluir` vira .exclude(seletor) para cada um; falha em impacto "serious" ou "critical";
  // a mensagem lista regra, impacto e seletor de cada nó.
  ```
  O `playwright.config.ts` não tem `baseURL`; o servidor é `npm run start` na porta 3000 (use `http://localhost:3000` no cookie ou `url`). Não altere `playwright.config.ts`.
- testes primeiro: nenhum próprio (são usados pela T16); typecheck e lint precisam passar.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os dois arquivos compilam com os tipos do Playwright; nenhum outro arquivo tocado.
- fora: `e2e/smoke.spec.ts`, `playwright.config.ts`, `e2e/marca.spec.ts` (T16).

### T9 · Build the button family, spinner, text link and surface
- nivel: tela
- objetivo: os componentes base de ação e de superfície: `Button`, `IconButton`, `Spinner`, `TextLink`, `Surface`.
- arquivos: `src/components/base/button.tsx`, `src/components/base/icon-button.tsx`, `src/components/base/spinner.tsx`, `src/components/base/text-link.tsx`, `src/components/base/surface.tsx` (novos)
- depende de: T3, T6
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos:
  - Comum: um arquivo por componente, `"use client"` (exceto `surface.tsx`, que pode ser de servidor se não usar React Aria); todos aceitam `className` (somado com `cx` de `@/components/cx`) e repassam as demais props ao primitivo. Altura mínima de todo controle: 2.75rem (44 px). Estilo só com classes de token (cores `canvas, sunken, surface, raised, line, line-strong, ink, ink-muted, primary, primary-hover, primary-pressed, on-primary, primary-soft, danger, danger-soft, focus...`; raios `rounded-sm|md|lg|card|pill`; sombras `shadow-soft|lift`; texto `text-caption|sm|body|prose|title-sm|title|display`; `font-title|font-body`; `ease-ritu`; `duration-[var(--ritu-fast)]`) e variantes de estado `data-*` do React Aria (`data-pressed:`, `data-hovered:`, `data-focus-visible:`, `data-disabled:`, `data-pending:`). Mapas de variante em objeto; nada de `cva`/`clsx`. `Icon` é o tipo de componente de ícone do Phosphor (`import type { Icon } from "@phosphor-icons/react"`; conferir o nome do tipo na versão instalada). Ícones Phosphor peso `light` em 16, 20 e 24 px (`ICON` de `@/components/base/icon-size`).
  - Aparência: botão `primary` cheio em `primary` com texto `on-primary` (hover `primary-hover`, pressionado `primary-pressed`); `secondary` com fundo `surface` e borda `line-strong`; `quiet` sem fundo; `danger` em `danger`; todos com raio `pill`. Estado pressionado: escala 0.98 em `--ritu-fast`. Texto longo quebra em duas linhas, não corta.
  - | Arquivo | Exporta | Primitivo (react-aria-components) | Props próprias |
    |---|---|---|---|
    | `button.tsx` | `Button` | `Button` | `variant?: "primary" \| "secondary" \| "quiet" \| "danger"` (padrão `secondary`), `size?: "md" \| "sm"`, `fullWidth?: boolean`, `icon?: Icon`. `isPending` mostra o `Spinner` e mantém a largura. `sm` tem 2.25rem de altura visual e área de toque de 2.75rem |
    | `icon-button.tsx` | `IconButton` | `Button` | `icon: Icon`, `aria-label: string` (obrigatório no tipo), `variant?: "quiet" \| "secondary"`, `size?: "md" \| "sm"` |
    | `text-link.tsx` | `TextLink` | `Link` | Sublinhado sempre; `data-inline` no elemento (atributo presente) |
    | `surface.tsx` | `Surface` | — (`div` ou `as`) | `tone?: "surface" \| "raised" \| "sunken" \| "paper"`, `radius?: "md" \| "lg" \| "card"`, `padding?: "none" \| "sm" \| "md" \| "lg"`, `shadow?: "none" \| "soft" \| "lift"`. `paper` aplica `bg-paper text-paper-ink` |
    | `spinner.tsx` | `Spinner` | — | `label: string` (texto para leitor de tela); três pontos que pulsam, parados com movimento reduzido |
  - Não usar `disabled` onde o React Aria dá `isDisabled`/`aria-disabled`; não esconder o anel de foco (o `globals.css` já desenha `outline` em `[data-focus-visible]`).
- testes primeiro: nenhum unitário (sem jsdom); o comportamento é conferido em `/marca` na T16. Typecheck é o teste dos contratos de props.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test` (inclui a guarda do design), `npm run build`
- pronto quando: os cinco arquivos existem com as props exatas; sem cor literal, `dark:` ou `px` de texto; gates verdes.
- fora: outros componentes, páginas, `layout.tsx`.

### T10 · Build the text field, checkbox, switch and chips
- nivel: tela
- objetivo: os componentes base de entrada: `TextField`, `Checkbox`, `Switch`, `Chip`, `ToggleChip`, `TagList`, `Tag`.
- arquivos: `src/components/base/text-field.tsx`, `src/components/base/checkbox.tsx`, `src/components/base/switch.tsx`, `src/components/base/chip.tsx` (novos)
- depende de: T3, T6
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos:
  - Comum: igual à T9 (um arquivo por componente, `"use client"`, `className` somado com `cx`, demais props repassadas ao primitivo, altura mínima 2.75rem, só classes de token, variantes `data-*`, ícones Phosphor `light` com `ICON`, tipo `Icon` do Phosphor). Texto de erro em `danger`, com ícone (ex.: `WarningCircle`).
  - Aparência: campo com fundo `surface`, borda `line-strong`, raio `md`; inválido com borda `danger`. Rótulo tocável com raio `pill`, borda `line`; selecionado: fundo `primary-soft`, borda `primary` e ícone `Check` (não depende só de cor). Pressionado: escala 0.98 em `--ritu-fast`.
  - | Arquivo | Exporta | Primitivo | Props próprias |
    |---|---|---|---|
    | `text-field.tsx` | `TextField` | `TextField` + `Input` ou `TextArea` (+ `Label`, `Text slot="description"`, `FieldError`) | `label: string`, `hideLabel?: boolean` (rótulo só para leitor de tela), `description?: string`, `errorMessage?: string`, `multiline?: boolean`, `rows?: number` (padrão 3) |
    | `chip.tsx` | `Chip`, `ToggleChip`, `TagList`, `Tag` | `Button`, `ToggleButton`, `TagGroup` (+ `TagList`, `Tag` do React Aria) | `Chip` e `ToggleChip`: `icon?: Icon`. `TagList`: `label: string`, `items: { id: string; label: string }[]`, `onRemove?: (ids: Set<Key>) => void`, `emptyText?: string` (mostrado quando `items` vazio). `Key` vem de `react-aria-components`. Tag removível tem botão de remover com nome acessível ("Tirar <rótulo>") e área de toque de 44 px |
    | `switch.tsx` | `Switch` | `Switch` | `children` é o rótulo |
    | `checkbox.tsx` | `Checkbox` | `Checkbox` | `children` é o rótulo; marca desenhada com ícone `Check` |
  - Para alvos de toque: `button`, `[role="switch"]`, `[role="checkbox"]` precisam de pelo menos 44 × 44 px (o elemento com o papel, ou o rótulo clicável que o envolve com a mesma caixa).
- testes primeiro: nenhum unitário (sem jsdom); typecheck confere as props.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: os quatro arquivos existem com as props exatas; gates verdes.
- fora: outros componentes, páginas.

### T13 · Build the logo, the dosha blot and the theme switcher
- nivel: tela
- objetivo: a marca (`Logo`, `DoshaBlot`) e o seletor de tema.
- arquivos: `src/components/brand/logo.tsx`, `src/components/brand/dosha-blot.tsx`, `src/components/theme/theme-switcher.tsx` (novos)
- depende de: T2, T3, T6
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: `.local/REFERENCIAS.md` §1 · linha "Tema claro e escuro, estados de tela" (só a ideia; nada de marcação ou visual)
- contratos:
  ```ts
  // src/components/brand/logo.tsx
  export function Logo(props: { variant?: "symbol" | "full"; size?: "sm" | "md" | "lg"; className?: string }): ReactElement
  // "symbol": um span com mask-image de /marca/simbolo-ritu.png e background-color: currentColor, role="img", aria-label="Ritu".
  // "full": o símbolo (aria-hidden) e a palavra "Ritu" em font-title. Tamanhos do símbolo: sm 2rem, md 3rem, lg 6rem.
  // (mask-image por classe arbitrária do Tailwind ou style com url; sem cor literal: background-color é currentColor)

  // src/components/brand/dosha-blot.tsx
  export type Dosha = "vata" | "pitta" | "kapha"
  export function DoshaBlot(props: { dosha: Dosha; size?: "sm" | "md" | "lg"; withIcon?: boolean; className?: string }): ReactElement
  // Decorativo: aria-hidden no conjunto, imagem /marca/mancha-<dosha>.webp com alt="". Tamanhos: sm 4rem, md 8rem, lg 11rem (lg é o teto).
  // Ícone (withIcon, padrão true), Phosphor peso "thin", cor paper-ink, centrado por cima: vata → Wind, pitta → Fire, kapha → Drop.
  // Só é usado sobre Surface tone="paper" (não faz a superfície; quem usa a põe).
  ```
  Em componente de servidor, ícone do Phosphor vem da entrada SSR do pacote (conferir o caminho na versão instalada, ex.: `@phosphor-icons/react/dist/ssr`); `Logo` e `DoshaBlot` devem funcionar em componente de servidor (sem `"use client"`, sem hooks).
  ```ts
  // src/components/theme/theme-switcher.tsx  ("use client")
  export function ThemeSwitcher(props: { initial: ThemeChoice }): ReactElement
  // ToggleButtonGroup do React Aria, seleção única e obrigatória (selectionMode="single", disallowEmptySelection),
  // aria-label="Tema", três ToggleButton: "Claro" (light) · "Escuro" (dark) · "Automático" (auto).
  // Ao escolher: document.cookie = themeCookie(escolha) e, em document.documentElement,
  // setAttribute("data-theme", escolha) para light/dark ou removeAttribute("data-theme") para auto.
  // ThemeChoice e themeCookie vêm de "@/components/theme/theme".
  ```
  Botões do seletor com 44 px de altura mínima, selecionado com fundo `primary-soft`, borda `primary` e peso 600 (não só cor). Sem `localStorage`, sem rota de servidor.
- testes primeiro: nenhum unitário; typecheck.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: três arquivos com os contratos exatos; gates verdes.
- fora: `theme.ts`, `layout.tsx`, páginas.

### T11 · Build the menu, the dialog and sheet, and the tooltip
- nivel: tela
- objetivo: os componentes base de sobreposição: `Menu`, `MenuItem`, `Dialog`, `Sheet`, `DialogTrigger`, `Tooltip`.
- arquivos: `src/components/base/menu.tsx`, `src/components/base/dialog.tsx`, `src/components/base/tooltip.tsx` (novos)
- depende de: T9
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos:
  - Comum: igual à T9 (`"use client"`, `className` com `cx`, props repassadas, só tokens, `data-*`, Phosphor `light`, `ICON`). Sobreposições em `bg-raised`, raio `lg`, sombra `lift`, animação `animate-fade` (folha: `animate-sheet`); véu em `bg-scrim`. `config` vem de `@config/index` (`config.ui.tooltip.delayMs` = 600).
  - | Arquivo | Exporta | Primitivo | Props próprias |
    |---|---|---|---|
    | `menu.tsx` | `Menu`, `MenuItem` | `MenuTrigger`, `Popover`, `Menu`, `MenuItem` | `Menu`: `trigger: ReactElement`, `label: string` (nome acessível do menu), `onAction: (id: Key) => void`, `children`. `MenuItem`: `id`, `icon?: Icon`, `tone?: "default" \| "danger"`, `children`. Itens com 44 px de altura; altura máxima do popover com rolagem interna |
    | `dialog.tsx` | `Dialog`, `Sheet`, `DialogTrigger` | `DialogTrigger`, `ModalOverlay`, `Modal`, `Dialog` (+ `Heading slot="title"`) | `Dialog` e `Sheet`: `title: string`, `description?: string`, `role?: "dialog" \| "alertdialog"`, `isDismissable?: boolean` (padrão `true`), `isOpen?`, `onOpenChange?`, `children: ReactNode \| ((close: () => void) => ReactNode)`. `Sheet` sobe de baixo e ocupa a largura abaixo de 48rem; acima, vira diálogo centrado de 32rem. Botão "Fechar" com nome acessível nos dois (use `IconButton` de `./icon-button` com ícone `X` e `aria-label="Fechar"`). Conteúdo rola por dentro (altura máxima da janela). `DialogTrigger` reexporta/embrulha o do React Aria |
    | `tooltip.tsx` | `Tooltip` | `TooltipTrigger`, `Tooltip` | `text: string`, `children: ReactElement` (o gatilho); atraso `config.ui.tooltip.delayMs` |
  - Teclado: o diálogo abre com `Enter` no gatilho, prende o foco, fecha com `Esc` e devolve o foco ao gatilho (o React Aria faz; não quebre). O menu navega com as setas.
- testes primeiro: nenhum unitário; typecheck.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: três arquivos com os contratos exatos; gates verdes.
- fora: `button.tsx`/`icon-button.tsx` (só importa), páginas.

### T12 · Build the tabs, combo box, toast and state block
- nivel: tela
- objetivo: `Tabs`, `TabList`, `Tab`, `TabPanel`, `ComboBox`, `ComboBoxItem`, `ToastRegion`, `toast`, `StateBlock`.
- arquivos: `src/components/base/tabs.tsx`, `src/components/base/combo-box.tsx`, `src/components/base/toast.tsx`, `src/components/base/state-block.tsx` (novos)
- depende de: T9
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos:
  - Comum: igual à T9. Sobreposições (lista da busca, aviso breve) em `bg-raised`, raio `lg`, sombra `lift`.
  - | Arquivo | Exporta | Primitivo | Props próprias |
    |---|---|---|---|
    | `tabs.tsx` | `Tabs`, `TabList`, `Tab`, `TabPanel` | `Tabs`, `TabList`, `Tab`, `TabPanel` | — (a aba selecionada tem traço em `primary` e peso 600: não depende só da cor). Abas com 44 px de altura; trocam com as setas |
    | `combo-box.tsx` | `ComboBox`, `ComboBoxItem` | `ComboBox` (+ `Label`, `Input`, `Button`, `Popover`, `ListBox`, `ListBoxItem`, `FieldError`, `Text`) | `label: string`, `description?`, `errorMessage?`, `isLoading?: boolean`, `emptyText: string`, mais `items`, `inputValue`, `onInputChange` e `onSelectionChange` do primitivo. Sem resultado: mostra `emptyText` (`renderEmptyState` do `ListBox`); carregando: mostra o `Spinner` (de `./spinner`) com `label`. Opções com 44 px; altura máxima com rolagem interna |
    | `toast.tsx` | `ToastRegion`, `toast` | `UNSTABLE_ToastRegion`, `UNSTABLE_ToastQueue` (conferir os nomes na versão instalada; a API instável fica só neste arquivo) | `toast(message: string, options?: { tone?: "neutral" \| "positive" \| "danger"; timeoutMs?: number }): void`. Fila única no módulo. Tempo padrão `config.ui.toast.timeoutMs` (6000). Botão "Dispensar" (com nome acessível). Vários avisos empilham, o mais novo em cima; nenhum some com foco ou ponteiro sobre ele. Tom `positive` com `sage-soft`/`sage-ink`, `danger` com `danger-soft`/`danger`, ícone em cada tom |
    | `state-block.tsx` | `StateBlock` | — | `kind: "loading" \| "error" \| "empty" \| "waiting" \| "quota"`, `title: string`, `description?: string`, `action?: ReactNode`. `loading` tem `role="status"` (com `Spinner`); `error` tem `role="alert"`; cada tipo tem o seu ícone Phosphor |
- testes primeiro: nenhum unitário; typecheck.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: quatro arquivos com os contratos exatos; gates verdes.
- fora: `spinner.tsx` (só importa), `layout.tsx` (T7 põe o `ToastRegion`), páginas.

### T7 · Wire the fonts, the root layout and the home page
- nivel: tela
- objetivo: fontes locais, layout raiz com tema lido do cookie no servidor, link "Pular para o conteúdo" e região de avisos, e a página `/` com os tokens.
- arquivos: `src/app/fonts.ts` (novo), `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css` (só a camada da textura: o `body::before` está com `z-index: 0` em `position: fixed` e pinta o ruído por cima do conteúdo não posicionado; ponha a textura atrás do conteúdo, ex.: `z-index: -1` com o `body` criando contexto de empilhamento, sem perder o fundo `canvas`)
- depende de: T2, T6, T12
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines, next-best-practices (`font.md`)
- referencia: nenhuma
- contratos:
  - `src/app/fonts.ts`: `next/font/local`; `export const titleFont` (arquivo `./fonts/cormorant-garamond.woff2`, peso `"300 700"`, `variable: "--font-cormorant"`, `display: "swap"`) e `export const bodyFont` (`./fonts/figtree.woff2`, peso `"300 900"`, `variable: "--font-figtree"`, `display: "swap"`). Nenhum pedido a outra origem.
  - `src/app/layout.tsx` (assíncrono): importa `./globals.css`; lê o cookie com `cookies()` de `next/headers` e `parseTheme` de `@/components/theme/theme` (`THEME_COOKIE`); `<html lang="pt-BR" data-theme={light|dark só quando a escolha for essa} className={cx(titleFont.variable, bodyFont.variable)}>`. Primeiro elemento do `body`: link "Pular para o conteúdo" (`href="#conteudo"`, visível só com foco). Depois `children` e `<ToastRegion />` (de `@/components/base/toast`). Toda página tem `<main id="conteudo">`. Mantém `metadata` (`title: "Ritu"`). `export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: config.ui.theme.colorLight }, { media: "(prefers-color-scheme: dark)", color: config.ui.theme.colorDark }] }` (sem `maximumScale`/`userScalable`).
  - `src/app/page.tsx`: o mesmo texto de hoje (`config.app.name` em `h1`, `config.app.disclaimer`, "Projeto de estudo em construção."), agora em `<main id="conteudo">` com classes de token (coluna `max-w-content`, título `font-title text-display`). Não mudar o texto.
  - Sem script inline; sem rota de servidor; sem `localStorage`.
  - `e2e/smoke.spec.ts` continua passando **sem alteração**.
- testes primeiro: nenhum unitário; conferir `CI=1 npm run test:e2e -- e2e/smoke.spec.ts` depois do build.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e -- e2e/smoke.spec.ts`
- pronto quando: build verde; smoke verde; `html` chega com `data-theme="dark"` quando o cookie é `ritu_theme=dark` e sem o atributo quando ausente ou desconhecido.
- fora: `/marca`, componentes.

### T14 · Build the /marca sections for tokens, type, surfaces, icons, states, brand, motion and theme
- nivel: tela
- objetivo: as seções de `/marca` que mostram o sistema (tudo menos os componentes interativos).
- arquivos: `src/app/marca/_secoes/cores.tsx`, `tipografia.tsx`, `superficies.tsx`, `icones.tsx`, `estados.tsx`, `marca.tsx`, `movimento.tsx`, `tema.tsx` (novos, todos em `src/app/marca/_secoes/`)
- depende de: T9, T10, T12, T13
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: `.local/REFERENCIAS.md` §1 · linha "Página `/marca` como vitrine do design system" (só a ideia da página; não portar componentes, tokens nem layout)
- contratos:
  - Cada arquivo exporta um componente de seção (`export function SecaoCores()`, `SecaoTipografia`, `SecaoSuperficies`, `SecaoIcones`, `SecaoEstados`, `SecaoMarca`, `SecaoMovimento`, `SecaoTema(props: { initial: ThemeChoice })`), cada um um `<section>` com `h2` e `aria-labelledby`.
    - **Cores:** cada token (`canvas, sunken, surface, raised, line, line-strong, ink, ink-muted, primary, primary-hover, primary-pressed, on-primary, primary-soft, amber, amber-ink, amber-soft, sage, sage-ink, sage-soft, danger, danger-soft, focus, vata, pitta, kapha, paper, paper-ink, scrim, shadow`) com nome e amostra (classe `bg-<nome>`, nunca cor literal); os pares de texto escritos sobre o fundo (ex.: "ink sobre canvas" em `text-ink bg-canvas`).
    - **Tipografia:** os sete tamanhos (`caption, sm, body, prose, title-sm, title, display`), títulos em `font-title` (600; 500 no `display`), e um parágrafo de fala do agente em `text-prose`, na largura `max-w-prose`. Cormorant nunca abaixo de `title-sm` nem em texto corrido.
    - **Superfícies:** os tons de `Surface` (`surface, raised, sunken, paper`), os raios (`md, lg, card`) e as sombras (`soft, lift`).
    - **Ícones:** os tamanhos de `ICON` (`sm 16, md 20, lg 24` em `light`; `xl 32` em `thin`), com ícones do Phosphor (entrada SSR se a seção for de servidor).
    - **Estados:** os cinco `StateBlock` (`loading, error, empty, waiting, quota`) com textos do produto.
    - **Marca:** `Logo` nas duas variantes; as três manchas (`DoshaBlot`) cada uma dentro de `Surface tone="paper"`, com o nome do dosha escrito (Vata, Pitta, Kapha).
    - **Movimento:** botão que repete a animação `rise` num bloco (componente cliente; troque a `key` para reanimar).
    - **Tema:** `ThemeSwitcher` com `initial` recebido.
  - Textos de exemplo do produto (alimentos, frases da conversa: "Um chá de gengibre com canela agora, que o dia esfriou."), nunca "lorem ipsum". Componentes de `@/components/base/*`, `@/components/brand/*`, `@/components/theme/*`. `react-aria-components` **não** é importado em `src/app/` (regra R5).
  - Larguras: tudo cabe em 320 px sem rolagem horizontal (grades com `minmax`/quebra).
- testes primeiro: nenhum unitário; typecheck.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: oito arquivos de seção; gates verdes.
- fora: `src/app/marca/page.tsx` (T16), `_secoes/componentes.tsx` (T15), componentes base.

### T15 · Build the /marca components section with every state and overlay
- nivel: tela
- objetivo: a seção "Componentes" de `/marca`: um bloco por componente base, com todos os estados e um botão que abre cada sobreposição.
- arquivos: `src/app/marca/_secoes/componentes.tsx` (novo; se passar de ~300 linhas, divida em `src/app/marca/_secoes/componentes-*.tsx` novos)
- depende de: T9, T10, T11, T12
- leitura: `.docs/DESIGN.md` (inteiro), `.docs/DEVELOPMENT.md` §"UI"
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos:
  - `export function SecaoComponentes()` (`"use client"`), um `<section>` com `h2` "Componentes" e um bloco (`h3`) por componente: `Button` (variantes `primary, secondary, quiet, danger`; tamanhos `md, sm`; com ícone; `isDisabled`; `isPending`; `fullWidth`), `IconButton` (`quiet`, `secondary`, `sm`), `TextField` (normal, com `description`, inválido com `errorMessage`, `isDisabled`, `multiline`), `Chip`, `ToggleChip` (normal e selecionado), `TagList` (com itens removíveis e vazio com `emptyText`), `Menu` (com `MenuItem` com ícone e um `tone="danger"`), `Dialog` (botão que abre), `Sheet` (botão que abre), `Tabs` (3 abas), `ComboBox` (lista de alimentos do produto: gengibre, canela, cúrcuma, arroz, ghee...; filtragem local; `emptyText`; um exemplo `isLoading`), `Switch` (ligado, desligado, `isDisabled`), `Checkbox` (marcado, desmarcado, `isDisabled`, `isInvalid`), `toast` (botões que disparam um de cada tom), `Tooltip` (num `IconButton`), `TextLink` (dentro de um parágrafo), `Spinner`.
  - Cada sobreposição tem um gatilho visível: botões com textos "Abrir menu", "Abrir diálogo", "Abrir folha", "Mostrar aviso", e a dica abre com foco/ponteiro no gatilho. Use `data-testid` nos gatilhos: `abrir-menu`, `abrir-dialogo`, `abrir-folha`, `mostrar-aviso`, `abrir-dica`, e no campo da busca `busca` (a T16 os usa).
  - Textos de exemplo do produto, nunca "lorem ipsum". `react-aria-components` não é importado aqui (só os componentes do Ritu). Tudo cabe em 320 px.
- testes primeiro: nenhum unitário; typecheck.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: a seção mostra todos os componentes e estados; gates verdes.
- fora: `page.tsx`, outras seções, componentes base.

### T16 · Assemble /marca, write its E2E and take the screenshots
- nivel: tela
- objetivo: a página `/marca` montada e o E2E que prova os critérios de aceite de acessibilidade, tema, teclado, toque, reflow e movimento; e os quatro screenshots.
- arquivos: `src/app/marca/page.tsx` (novo), `e2e/marca.spec.ts` (novo), `.plans/016-marca-light-celular.png`, `.plans/016-marca-dark-celular.png`, `.plans/016-marca-light-desktop.png`, `.plans/016-marca-dark-desktop.png` (novos)
- depende de: T7, T8, T14, T15
- leitura: `.docs/DESIGN.md` §3 "Acessibilidade", `.docs/QA.md` §"Telas (E2E)" (só a linha de acessibilidade)
- skills: frontend-design, web-design-guidelines, playwright
- referencia: nenhuma
- contratos:
  - `src/app/marca/page.tsx`: componente de servidor, público, `export const metadata = { title: "Marca · Ritu", robots: { index: false } }`; lê o cookie do tema (`cookies()`, `parseTheme`, `THEME_COOKIE`) para o `initial` do `ThemeSwitcher`; `<main id="conteudo">` com `h1` "Marca" e as seções nesta ordem: Cores · Tipografia · Superfícies · Ícones · Componentes · Estados · Marca · Movimento · Tema (de `./_secoes/*`).
  - `e2e/marca.spec.ts` (usa `TEMAS`, `usarTema` de `./apoio/tema` e `expectSemViolacoes` de `./apoio/a11y`), em `celular` e `desktop`:
    1. **Axe** em `/marca` para cada tema de `TEMAS`, com a página parada e com cada sobreposição aberta (menu, diálogo, folha, lista da busca, dica, aviso breve), pelos `data-testid` `abrir-menu`, `abrir-dialogo`, `abrir-folha`, `busca` (digitar para abrir a lista), `abrir-dica`, `mostrar-aviso`.
    2. **Fontes locais:** registrar os pedidos ao carregar `/marca`; nenhum vai para outra origem que não a do servidor.
    3. **Tema automático:** contexto com `colorScheme: "dark"` e sem cookie: `getComputedStyle(document.body).backgroundColor` é `rgb(30, 22, 17)`.
    4. **Tema manual:** tocar em "Escuro" muda o fundo na hora, grava o cookie `ritu_theme=dark`; depois de recarregar o `html` já vem com `data-theme="dark"` (conferir no HTML da resposta do servidor, ex.: `page.request.get` e procurar `data-theme="dark"`); "Automático" apaga o cookie.
    5. **Teclado** (só `desktop`): `Tab` chega aos controles com anel de foco visível (`outline-style` não `none`); o diálogo abre com `Enter`, prende o foco, fecha com `Esc` e o foco volta ao gatilho; o menu navega com as setas; as abas trocam com as setas.
    6. **Alvos de toque** (só `celular`): todo `button`, `[role="tab"]`, `[role="switch"]`, `[role="checkbox"]`, `[role="menuitem"]`, `[role="option"]` e `a[href]` sem `data-inline` visível tem caixa ≥ 44 × 44 px (para `switch`/`checkbox` escondidos pelo React Aria, meça o `label` que os envolve). Abrir menu e lista da busca para medir `menuitem` e `option`.
    7. **Reflow:** janela de 320 px de largura: `document.documentElement.scrollWidth <= 320`.
    8. **Movimento reduzido:** `reducedMotion: "reduce"`: nenhum elemento tem `transition-duration` ou `animation-duration` maior que 0,01 s.
    9. **Marca:** o `Logo` símbolo tem `role="img"` e nome "Ritu"; as três manchas aparecem com o nome do dosha escrito.
  - Screenshots de página inteira de `/marca` em claro e escuro, celular e desktop, salvos em `.plans/016-marca-<tema>-<projeto>.png` (`<tema>` `light`/`dark`, `<projeto>` `celular`/`desktop`); pode ser por um teste marcado que só roda com uma variável (`SCREENSHOTS=1`) ou por script ad hoc não versionado — os arquivos PNG entram, o script não.
  - Se o axe ou um critério acusar problema num componente base, **não** edite o componente: relate o problema e o arquivo (o orquestrador abre a correção).
- testes primeiro: escrever `e2e/marca.spec.ts` antes de ajustar a página.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e`
- pronto quando: `CI=1 npm run test:e2e` verde (inclusive `smoke.spec.ts`, sem alteração); os quatro PNG existem.
- fora: componentes base, seções (só relatar), `e2e/apoio/`, `playwright.config.ts`.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1 | Instala bibliotecas e mexe em `package.json`: sozinha |
| 2 | T2, T3, T5, T6 | Só dependem da T1; arquivos novos e distintos (`config/index.ts` só na T2, `architecture.test.ts` só na T5) |
| 3 | T4, T8, T9, T10, T13 | Dependem de T1/T2/T3/T6; arquivos novos e distintos |
| 4 | T11, T12 | Usam `Button`/`IconButton`/`Spinner` da T9; arquivos distintos |
| 5 | T7, T14, T15 | Layout precisa do `ToastRegion` (T12); seções precisam dos componentes; arquivos distintos |
| 6 | T16 | Página e E2E precisam de tudo |

### C1 · Fix the component and section defects revealed by the /marca E2E
- nivel: tela
- objetivo: corrigir nos componentes base e nas seções de `/marca` os defeitos que o E2E da T16 revela, sem mudar contrato nem valor de token.
- arquivos: só os que tiverem defeito, dentro de `src/components/base/*.tsx`, `src/components/brand/*.tsx`, `src/components/theme/theme-switcher.tsx` e `src/app/marca/_secoes/*.tsx`. Primeiro defeito conhecido: `src/components/base/chip.tsx` (`renderEmptyState` do `TagList` usa `<Text>` do React Aria sem `slot`, e `/marca` dá 500: "A slot prop is required").
- depende de: T16 (página e E2E escritos, sem commit)
- leitura: as mesmas da T16
- skills: frontend-design, web-design-guidelines
- referencia: nenhuma
- contratos: os da tarefa dona de cada arquivo (T9 a T15), sem mudança de nome, prop ou export; `tokens.css` intocado.
- testes primeiro: o E2E da T16 é o teste.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e`
- pronto quando: `CI=1 npm run test:e2e` verde com a T16; cada arquivo alterado listado com o defeito e a regra que o acusou.
- fora: `tokens.css`, `globals.css`, `layout.tsx`, `e2e/apoio/`, `playwright.config.ts`.
- execução: o mesmo implementador da T16, na mesma rodada; verificador e commit separados (C1 antes de T16).

### C2 · Remove the duplication flagged by npm run dup
- nivel: tela
- objetivo: zerar os clones de `npm run dup` que são da spec 016.
- arquivos: `src/components/base/text-field.tsx`, `src/components/base/combo-box.tsx`, um arquivo novo de apoio em `src/components/base/` (ex.: `field-error.tsx`, com o `FieldError` + `WarningCircle` e a descrição comuns aos dois campos), `src/app/fonts/OFL.txt`
- depende de: C1, T16
- leitura: nenhuma
- skills: frontend-design
- referencia: nenhuma
- contratos: os de `TextField` e `ComboBox` (T10 e T12) sem mudança de nome, prop ou export. `OFL.txt`: as duas linhas de copyright (Cormorant Garamond e Figtree) e um só texto da SIL Open Font License 1.1. Não mexer em `.jscpd.json`.
- testes primeiro: `npm run dup` mostra os 2 clones da 016 (`combo-box.tsx` 60-74 × `text-field.tsx` 51-65; `OFL.txt` 6-98 × 101-193) antes, e nenhum depois.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run dup`, `npm run build`, `CI=1 npm run test:e2e -- e2e/marca.spec.ts`
- pronto quando: `npm run dup` sem clone da 016. O clone `src/core/agents/interpreter/interpretar.ts` 66-81 × `src/core/agents/judge/julgar.ts` 118-133 veio da `main` (spec 013) e não é desta tarefa.
- fora: tudo o mais.
