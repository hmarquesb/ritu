---
title: Design system
status: approved
entrega: 3
created: 2026-11-15
---

# Design system

> Transforma `DESIGN.md` em código: tokens com valor fechado (cor, tipo, raio, sombra, movimento), duas fontes locais, tema claro e escuro com escolha manual, os componentes base sobre React Aria, a marca (logo e manchas dos doshas) e a página `/marca`, que mostra tudo. Entrega também o gate de acessibilidade (axe) que as telas 017 a 020 vão usar.

## Contexto

As entregas 1 e 2 não têm tela: `src/app/` tem um `layout.tsx` sem estilo e uma página de espera. `DESIGN.md` descreve a direção (calma, quente, papel e linho, terracota e âmbar, serifa fina nos títulos), mas deixa os valores "a fechar". Sem valores fechados, cada tela da entrega 3 escolheria os seus, e o `implementador-tela` não tem de onde copiar.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Primária:** terracota. Âmbar é destaque; sálvia é apoio.
- **Fontes:** Cormorant Garamond nos títulos e Figtree no texto, em arquivos locais.
- **Tema:** segue o aparelho, com escolha manual (Claro · Escuro · Automático) guardada em cookie.
- **Manchas dos doshas:** recorte das imagens de referência, sem o ícone (o ícone vem do Phosphor, por cima).

Os recortes já existem em `design/derivados/` (três manchas e o símbolo do logo), feitos a partir de `design/*.jpeg`.

## Objetivo

- Todo valor visual do site sai de um arquivo só (`tokens.css`); nenhum componente ou página escreve cor, raio ou sombra à mão.
- Todo par texto/fundo previsto passa em WCAG AA nos dois temas, conferido por teste sem navegador.
- Os dez componentes base de `DESIGN.md` §4 existem, com forma, foco e movimento do Ritu, e funcionam por teclado.
- `/marca` passa no axe sem violação `serious` ou `critical`, nos dois temas, em celular e desktop.
- As specs 017 a 020 testam acessibilidade e tema com duas funções de apoio, sem reescrever nada.

## Escopo

- **Dentro:**
  - Tailwind CSS v4, React Aria Components, Phosphor e `@axe-core/playwright` instalados e configurados.
  - `tokens.css` (cores nos dois temas, tipografia, raios, sombras, movimento, larguras) e `globals.css` (base, foco, movimento reduzido, textura de papel).
  - Fontes locais com `next/font/local`.
  - Tema: cookie, leitura no servidor, seletor de tema.
  - Componentes base: botão, botão de ícone, campo e área de texto, rótulos tocáveis, menu, diálogo, folha, abas, busca com sugestões, chave, caixa de seleção, aviso breve, dica, link de texto, superfície, indicador de carregamento e bloco de estado.
  - Marca: `Logo` e `DoshaBlot`; arquivos em `public/marca/`.
  - `layout.tsx` raiz (fontes, tema, link "Pular para o conteúdo", região de avisos) e a página `/` com os tokens, sem mudar o texto.
  - Página `/marca`.
  - Teste de contraste, teste de guarda do design, regra de pacote do teste de arquitetura.
  - Apoio de E2E (`usarTema`, `expectSemViolacoes`) e `e2e/marca.spec.ts`.
  - `DESIGN.md` §2 e §5 com os valores fechados; ADR nova.
- **Fora:**
  - Componentes "Do Ritu" de `DESIGN.md` §4 (carta de dosha, falas, etapas, bloco de sugestão, bloco de aprovação, itens de casa e de memória, linha do tempo): 017 a 020, cada um na spec da sua tela.
  - Navegação entre telas (abas, cabeçalho, faixa de demonstração): 017 e 018.
  - Tela de Entrada e o uso de `design/login-cover.jpeg`: 017.
  - CSP, headers e checagem de `Origin`: 017.
  - Onde o seletor de tema aparece no produto (Perfil): 020. Aqui ele só aparece em `/marca`.
  - Gráfico de evolução dos evals: 023.
  - Fotos (ervas, especiarias): o produto não usa foto além da imagem da Entrada.

## Necessidade de negócio

O Ritu "fala baixo": a confiança de quem chega vem de uma tela calma, legível e que não parece kit pronto. Um sistema fechado dá às quatro specs de tela a mesma voz visual, e o gate do axe garante que a conversa é usável por teclado e leitor de tela desde a primeira tela. Para quem avalia o projeto, `/marca` mostra o sistema inteiro em uma página.

## Critérios de aceite

- [ ] **Tokens únicos:** `src/components/tokens/tokens.css` define todos os tokens da tabela "Cores" com `light-dark()`, e o `@theme` zera a paleta, os raios, as sombras e os tamanhos de texto padrão do Tailwind (`bg-red-500`, `rounded-xl` e `text-lg` não geram classe).
- [ ] **Contraste por teste:** `npm test` roda `tokens.test.ts`, que lê `tokens.css` e confere, nos dois temas, todos os pares da tabela "Pares de contraste" (≥ 4,5 para texto, ≥ 3 para borda de campo, foco e cor de dosha).
- [ ] **Guarda do design:** `design-guard.test.ts` falha, com `<arquivo>:<linha>: G<n>`, em cor literal fora de `tokens.css` (G1), variante `dark:` (G2), `dangerouslySetInnerHTML` (G3), import de biblioteca de UI com visual pronto (G4) e tamanho de texto em `px` (G5).
- [ ] **React Aria só nos componentes:** o teste de arquitetura acusa R5 se `react-aria-components` for importado fora de `src/components/`.
- [ ] **Fontes locais:** títulos em Cormorant Garamond e texto em Figtree; o carregamento de `/marca` não faz nenhum pedido a outra origem (E2E).
- [ ] **Tema automático:** sem cookie, a página segue `prefers-color-scheme` (E2E com `colorScheme: "dark"`: o fundo computado do `body` é `rgb(30, 22, 17)`).
- [ ] **Tema manual:** tocar em "Escuro" no seletor muda a página na hora, grava `ritu_theme=dark` e continua escuro depois de recarregar, sem piscar o tema claro (o `html` já chega do servidor com `data-theme="dark"`). "Automático" apaga o cookie.
- [ ] **Componentes base:** os componentes da seção "Contratos" existem em `src/components/base/`, com as props listadas, e aparecem em `/marca` em todos os estados (normal, foco, desabilitado, pendente, inválido, selecionado, quando existem).
- [ ] **Teclado:** em `/marca`, `Tab` chega a todo controle com anel de foco visível; o diálogo abre com `Enter`, prende o foco, fecha com `Esc` e devolve o foco ao botão; o menu navega com as setas; as abas trocam com as setas.
- [ ] **Alvos de toque:** no projeto `celular`, todo `button`, `[role="tab"]`, `[role="switch"]`, `[role="checkbox"]`, `[role="menuitem"]`, `[role="option"]` e `a[href]` sem `data-inline` em `/marca` tem pelo menos 44 × 44 px.
- [ ] **Reflow:** com a janela em 320 px de largura, `/marca` não tem rolagem horizontal.
- [ ] **Movimento reduzido:** com `prefers-reduced-motion: reduce`, nenhuma transição ou animação de `/marca` dura mais de 0,01 s.
- [ ] **Axe:** `/marca` sem violação `serious` ou `critical` nos dois temas, em `celular` e `desktop`, com a página parada e com cada sobreposição aberta (menu, diálogo, folha, lista da busca, dica, aviso breve).
- [ ] **Marca:** `Logo` desenha o símbolo na cor do texto nos dois temas; as três manchas aparecem em superfície `paper`, com o ícone do dosha por cima e o nome escrito.
- [ ] **Fumaça:** `e2e/smoke.spec.ts` continua passando sem alteração.
- [ ] Gates 1 a 6 verdes e `npm run dup` sem duplicação.

## O que fazer

- Instalar e configurar Tailwind v4 pelo PostCSS, com a paleta padrão desligada.
- Escrever `tokens.css` exatamente com os nomes e valores dos contratos.
- Copiar os arquivos de `design/derivados/` para `public/marca/` e as fontes para `src/app/fonts/`, com a licença.
- Escrever cada componente base sobre o primitivo do React Aria indicado, estilizado só com classes de token e variantes de `data-*`.
- Carregar `frontend-design` antes de escrever componente ou página e `web-design-guidelines` antes de entregar.
- Conferir a API do Tailwind, do React Aria e do Phosphor na versão instalada em `node_modules` antes de usar.
- Tirar screenshots de `/marca` (claro e escuro, celular e desktop) para a dona conferir.
- Atualizar `DESIGN.md` §2 e §5 e escrever a ADR no fechamento.

## O que não fazer

- Não usar shadcn/ui, Radix, Headless UI, MUI, nem copiar componente, layout ou token de outro projeto.
- Não usar a variante `dark:` nem cor literal em componente: o tema troca pelos tokens.
- Não mudar valor de token para "ficar melhor": os valores são da dona. Par de contraste reprovado é bloqueio a relatar, não ajuste a fazer.
- Não usar `disabled` onde o contrato pede `aria-disabled`; não esconder o anel de foco.
- Não usar Cormorant Garamond abaixo de 1,25 rem nem em texto corrido.
- Não pôr `DoshaBlot` fora de uma superfície `paper`.
- Não criar rota de servidor para o tema; não guardar o tema em `localStorage`.
- Não escrever teste de componente com DOM simulado (jsdom): comportamento se testa no Playwright.
- Não construir componente "Do Ritu" nem navegação nesta spec.
- Não editar os arquivos de `design/`.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Cor primária | Terracota `#9E4B2B` (dona) | Texto claro sobre ela passa AA com folga; âmbar não passa sem texto escuro |
| Fontes | Cormorant Garamond (títulos) + Figtree (texto) (dona) | A Cormorant é a mais próxima do logo e das cartas; a Figtree lê bem no celular |
| Origem das fontes | Arquivos `woff2` variáveis, subconjunto `latin`, em `src/app/fonts/`, com `next/font/local` | Nenhum pedido a terceiros, build sem rede, CSP simples |
| Tema | `light-dark()` em cada token; `color-scheme` decide; `data-theme` no `html` força (dona: sistema + manual) | Um bloco de tokens só, sem duplicar o tema escuro, sem `dark:` |
| Onde fica a escolha do tema | Cookie `ritu_theme`, gravado pelo cliente, lido pelo `layout.tsx` no servidor | O HTML já chega no tema certo, sem script inline (a CSP da 017 usa nonce) e sem piscar |
| Tailwind | v4, configurado em CSS (`@theme`), paleta e escalas padrão zeradas | O que não é token não vira classe: o erro aparece no build |
| Nomes dos tokens | Semânticos e em inglês (`canvas`, `ink`, `primary`); nomes de produto onde são o conceito (`vata`, `pitta`, `kapha`, `amber`, `sage`) | Regra de idioma do `DEVELOPMENT.md` |
| Variantes de estado | Atributos `data-*` do React Aria (`data-pressed:`, `data-focus-visible:`) | Sem plugin a mais |
| Composição de classes | Função própria `cx` e mapas de variante em objeto | Sem `clsx`, `cva` nem `tailwind-variants` para dez componentes |
| Aviso breve | `UNSTABLE_ToastRegion` do React Aria, isolado em `toast.tsx`; `react-aria-components` com versão exata | Foco e anúncio já resolvidos; a API instável fica em um arquivo |
| Manchas | WebP com transparência, recortadas das referências, ícone removido (dona) | A aquarela de verdade; o ícone do Phosphor fica nítido em qualquer tamanho |
| Carta em tema escuro | A superfície `paper` e o texto sobre ela têm a mesma cor nos dois temas | A aquarela só funciona sobre papel claro |
| Logo | Símbolo como máscara (PNG com alfa) pintada com `currentColor`; "Ritu" escrito na fonte de título | O logo é um JPEG com fundo; a máscara serve aos dois temas sem redesenhar |
| Textura de papel | Um SVG de ruído em `public/marca/papel.svg`, sobre o `body`, igual nos dois temas | Arquivo da própria origem: não pede exceção na CSP |
| Teste de componente | Lógica pura no Vitest; comportamento e acessibilidade no Playwright, em `/marca` | Sem jsdom no projeto; o axe precisa de navegador de verdade |
| `/marca` | Pública, sem login, `noindex`, fica em produção | É a vitrine do sistema e o alvo do gate |
| Ícones | Phosphor `light` em 16, 20 e 24 px; `thin` de 32 px para cima | `DESIGN.md` §2 |

## Contratos

### Cria

**Pacotes** (versões de 2026-11-15; instalar a atual)

| Pacote | Tipo | Versão |
|---|---|---|
| `tailwindcss`, `@tailwindcss/postcss` | dev | `^4.3` |
| `react-aria-components` | prod | exata (`1.22.1` ou a atual, sem `^`) |
| `@phosphor-icons/react` | prod | `^2.1` |
| `@axe-core/playwright` | dev | `^4.14` |

`postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } }`. Se o Biome reclamar das diretivas do Tailwind no CSS, ligar `css.parser.tailwindDirectives` em `biome.json`.

**Configuração (`config/ui.ts`, incluída em `config/index.ts` como `ui`)**

```ts
export const ui = {
  theme: { cookie: "ritu_theme", maxAgeDays: 365, colorLight: "#F8F3EA", colorDark: "#1E1611" },
  toast: { timeoutMs: 6000 },
  tooltip: { delayMs: 600 },
} as const
```

**Cores (`src/components/tokens/tokens.css`)**

Cada token é `--ritu-<nome>: light-dark(<claro>, <escuro>);` em `:root`, e o `@theme inline` expõe `--color-<nome>: var(--ritu-<nome>)`. As classes ficam `bg-canvas`, `text-ink`, `border-line`.

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `canvas` | `#F8F3EA` | `#1E1611` | Fundo da página (papel; no escuro, marrom profundo) |
| `sunken` | `#EFE7DA` | `#18110D` | Faixas e áreas rebaixadas (linho) |
| `surface` | `#FDFAF4` | `#2A1F18` | Blocos e campos |
| `raised` | `#FFFDF8` | `#35281F` | Menu, diálogo, folha, dica |
| `line` | `#E2D5C0` | `#4A3A2E` | Divisória decorativa (areia) |
| `line-strong` | `#94806A` | `#9A8571` | Borda de campo e de controle (3:1) |
| `ink` | `#33241A` | `#F1E6D6` | Texto (marrom-café) |
| `ink-muted` | `#6B5646` | `#C4B19C` | Texto secundário |
| `primary` | `#9E4B2B` | `#E39570` | Botão principal, link, seleção (terracota) |
| `primary-hover` | `#8E4226` | `#EBA988` | Primária sob o ponteiro |
| `primary-pressed` | `#7A3820` | `#F0B89C` | Primária pressionada |
| `on-primary` | `#FFF8EF` | `#2A140A` | Texto sobre a primária |
| `primary-soft` | `#F3DDD0` | `#4A2A1C` | Fundo de item selecionado |
| `amber` | `#D99A2B` | `#E6B455` | Destaque decorativo (cúrcuma); nunca texto |
| `amber-ink` | `#855608` | `#E6B455` | Texto de destaque (marca de novidade) |
| `amber-soft` | `#F6E3B8` | `#4A3716` | Fundo de destaque |
| `sage` | `#7C8F72` | `#8FA384` | Detalhe decorativo (sálvia); nunca texto |
| `sage-ink` | `#4A6044` | `#A9BC9E` | Texto de confirmação |
| `sage-soft` | `#DFE7D8` | `#2C3A28` | Fundo de confirmação |
| `danger` | `#9A2B38` | `#F2A0A6` | Erro e ação destrutiva |
| `danger-soft` | `#F5DCDC` | `#4A2226` | Fundo de erro |
| `focus` | `#33241A` | `#F1E6D6` | Anel de foco |
| `vata` | `#5E7FA3` | `#9DB9D8` | Borda e ícone do dosha; nunca texto pequeno, nunca o único sinal |
| `pitta` | `#B5562A` | `#E9A070` | Idem |
| `kapha` | `#5F7A52` | `#A8C19A` | Idem |
| `paper` | `#F6F1E7` | `#F6F1E7` | Superfície das cartas, igual nos dois temas |
| `paper-ink` | `#33241A` | `#33241A` | Texto e ícone sobre `paper` |
| `scrim` | `rgb(51 36 26 / 0.45)` | `rgb(0 0 0 / 0.6)` | Véu atrás de diálogo e folha |
| `shadow` | `rgb(74 52 36 / 0.14)` | `rgb(0 0 0 / 0.5)` | Cor das sombras |

Tema:

```css
:root { color-scheme: light dark; /* tokens */ }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }
```

**Pares de contraste (conferidos por `tokens.test.ts`, nos dois temas)**

- ≥ 4,5: `ink`, `ink-muted`, `primary`, `danger`, `sage-ink` e `amber-ink` sobre `canvas`, `sunken`, `surface` e `raised`; `on-primary` sobre `primary`, `primary-hover` e `primary-pressed`; `ink` e `ink-muted` sobre `primary-soft`, `amber-soft`, `sage-soft` e `danger-soft`; `primary` sobre `primary-soft`; `sage-ink` sobre `sage-soft`; `amber-ink` sobre `amber-soft`; `danger` sobre `danger-soft`; `paper-ink` sobre `paper`.
- ≥ 3: `line-strong`, `focus`, `vata`, `pitta` e `kapha` sobre `canvas`, `sunken`, `surface` e `raised`.

Os valores acima passam em todos (mínimos: 4,6 e 3,08 no claro; 5,37 e 4,05 no escuro).

**Demais tokens (no `@theme`, com `--radius-*`, `--shadow-*`, `--text-*`, `--ease-*`, `--animate-*` e `--color-*` zerados antes)**

| Grupo | Token → valor |
|---|---|
| Fontes | `--font-title: var(--font-cormorant), "Iowan Old Style", Georgia, serif` · `--font-body: var(--font-figtree), ui-sans-serif, system-ui, sans-serif` |
| Texto (tamanho / entrelinha) | `caption` 0.8125rem / 1.4 · `sm` 0.875rem / 1.5 · `body` 1rem / 1.6 · `prose` 1.0625rem / 1.7 · `title-sm` 1.375rem / 1.25 · `title` 1.75rem / 1.2 · `display` 2.25rem / 1.1 |
| Raio | `sm` 0.625rem · `md` 1rem · `lg` 1.5rem · `card` 1.75rem · `pill` 999px |
| Sombra | `soft`: `0 1px 2px var(--ritu-shadow), 0 4px 16px -6px var(--ritu-shadow)` · `lift`: `0 2px 6px var(--ritu-shadow), 0 16px 40px -12px var(--ritu-shadow)` |
| Largura | `--container-prose: 34rem` (fala do agente) · `--container-content: 40rem` (coluna da tela) |
| Movimento | `--ease-ritu: cubic-bezier(0.2, 0.7, 0.2, 1)` · durações `--ritu-fast: 120ms`, `--ritu-base: 200ms`, `--ritu-slow: 320ms` |
| Animação | `rise` (sobe 0.375rem e aparece, `--ritu-slow`): etapas e blocos que chegam · `fade` (aparece, `--ritu-base`): sobreposições · `sheet` (sobe de baixo, `--ritu-slow`): folha |

Regras de tipo: `title-sm`, `title` e `display` usam `font-title` com peso 600 (500 no `display`); todo o resto usa `font-body` (400; 500 em rótulo; 600 em ênfase). Espaçamento: a escala padrão do Tailwind.

**Base (`src/app/globals.css`)**

- `@import "tailwindcss";` e `@import "../components/tokens/tokens.css";`.
- `body`: `bg-canvas text-ink font-body text-body`, `min-height: 100dvh`, `-webkit-font-smoothing: antialiased`. `body::before` fixo, sem eventos de ponteiro, com `background-image: url("/marca/papel.svg")`.
- Foco: `outline: 2px solid var(--ritu-focus); outline-offset: 2px;` em `:focus-visible` e em `[data-focus-visible]`. Nenhum `outline: none` sem substituto.
- `@media (prefers-reduced-motion: reduce)`: `animation-duration` e `transition-duration` em `0.01ms` e `animation-iteration-count: 1` para tudo.
- `::selection` com `primary-soft`.

**Fontes (`src/app/fonts/`)**

`cormorant-garamond.woff2` (variável, peso 300 a 700, `latin`), `figtree.woff2` (variável, peso 300 a 900, `latin`) e `OFL.txt`. Vêm dos pacotes `@fontsource-variable/cormorant-garamond` e `@fontsource-variable/figtree` (arquivo `*-latin-wght-normal.woff2`), instalados com `--no-save` só para copiar. `src/app/fonts.ts` exporta `titleFont` (`variable: "--font-cormorant"`) e `bodyFont` (`variable: "--font-figtree"`), com `display: "swap"`.

**Tema (`src/components/theme/theme.ts`)**

```ts
export type Theme = "light" | "dark"
export type ThemeChoice = Theme | "auto"
export const THEME_COOKIE: string                                  // config.ui.theme.cookie
export function parseTheme(value: string | undefined): ThemeChoice // valor desconhecido ou ausente → "auto"
export function themeCookie(choice: ThemeChoice): string
// "light" | "dark" → "ritu_theme=<valor>; Path=/; Max-Age=<365 dias em s>; SameSite=Lax"
// "auto"           → "ritu_theme=; Path=/; Max-Age=0; SameSite=Lax"
```

- `src/app/layout.tsx` (assíncrono): lê o cookie com `cookies()` e põe `data-theme` no `html` só quando a escolha é `light` ou `dark`.
- `src/components/theme/theme-switcher.tsx` (`ThemeSwitcher({ initial: ThemeChoice })`): grupo de três botões "Claro" · "Escuro" · "Automático" (`ToggleButtonGroup`, seleção única e obrigatória, `aria-label="Tema"`). Ao escolher: grava `document.cookie = themeCookie(escolha)` e ajusta ou remove `data-theme` no `document.documentElement`.

**Layout raiz (`src/app/layout.tsx`)**

`<html lang="pt-BR" data-theme? className={fontes}>`; primeiro elemento do `body`: link "Pular para o conteúdo" (`href="#conteudo"`, visível só com foco); depois `children` e `<ToastRegion />`. Toda página tem `<main id="conteudo">`. `export const viewport`: `width: "device-width"`, `initialScale: 1` (sem travar o zoom) e `themeColor` com os dois valores de `config.ui.theme`, por `media`.

**Apoio (`src/components/cx.ts`)**

```ts
export function cx(...parts: Array<string | false | null | undefined>): string
```

**Componentes base (`src/components/base/`, um arquivo por componente, `"use client"`)**

Todos aceitam `className` (somado ao estilo do Ritu) e repassam as demais props ao primitivo. Altura mínima de todo controle: 2.75rem (44 px). Texto de erro em `danger`, com ícone.

| Arquivo | Exporta | Primitivo | Props próprias |
|---|---|---|---|
| `button.tsx` | `Button` | `Button` | `variant?: "primary" \| "secondary" \| "quiet" \| "danger"` (padrão `secondary`), `size?: "md" \| "sm"`, `fullWidth?: boolean`, `icon?: Icon`. `isPending` mostra o `Spinner` e mantém a largura. `sm` tem 2.25rem de altura visual e área de toque de 2.75rem |
| `icon-button.tsx` | `IconButton` | `Button` | `icon: Icon`, `aria-label: string` (obrigatório no tipo), `variant?: "quiet" \| "secondary"`, `size?: "md" \| "sm"` |
| `text-field.tsx` | `TextField` | `TextField` + `Input` ou `TextArea` | `label: string`, `hideLabel?: boolean`, `description?: string`, `errorMessage?: string`, `multiline?: boolean`, `rows?: number` (padrão 3) |
| `chip.tsx` | `Chip`, `ToggleChip`, `TagList`, `Tag` | `Button`, `ToggleButton`, `TagGroup` | `Chip` e `ToggleChip`: `icon?: Icon`. `TagList`: `label: string`, `items: { id: string; label: string }[]`, `onRemove?: (ids: Set<Key>) => void`, `emptyText?: string` |
| `menu.tsx` | `Menu`, `MenuItem` | `MenuTrigger`, `Popover`, `Menu` | `Menu`: `trigger: ReactElement`, `label: string`, `onAction: (id: Key) => void`. `MenuItem`: `id`, `icon?: Icon`, `tone?: "default" \| "danger"` |
| `dialog.tsx` | `Dialog`, `Sheet`, `DialogTrigger` | `DialogTrigger`, `ModalOverlay`, `Modal`, `Dialog` | `title: string`, `description?: string`, `role?: "dialog" \| "alertdialog"`, `isDismissable?: boolean` (padrão `true`), `isOpen?`, `onOpenChange?`, `children: ReactNode \| ((close: () => void) => ReactNode)`. `Sheet` sobe de baixo e ocupa a largura abaixo de 48rem; acima, vira diálogo centrado de 32rem. Botão "Fechar" com nome acessível nos dois |
| `tabs.tsx` | `Tabs`, `TabList`, `Tab`, `TabPanel` | `Tabs` | — (a aba selecionada tem traço em `primary` e peso 600: não depende só da cor) |
| `combo-box.tsx` | `ComboBox`, `ComboBoxItem` | `ComboBox` | `label: string`, `description?`, `errorMessage?`, `isLoading?: boolean`, `emptyText: string`, mais `items`, `inputValue`, `onInputChange` e `onSelectionChange` do primitivo |
| `switch.tsx` | `Switch` | `Switch` | `children` é o rótulo |
| `checkbox.tsx` | `Checkbox` | `Checkbox` | `children` é o rótulo; marca desenhada com ícone `Check` |
| `toast.tsx` | `ToastRegion`, `toast` | `UNSTABLE_ToastRegion`, `UNSTABLE_ToastQueue` | `toast(message: string, options?: { tone?: "neutral" \| "positive" \| "danger"; timeoutMs?: number }): void`. Tempo padrão de `config.ui.toast`; botão "Dispensar" |
| `tooltip.tsx` | `Tooltip` | `TooltipTrigger`, `Tooltip` | `text: string`, `children: ReactElement`; atraso de `config.ui.tooltip` |
| `text-link.tsx` | `TextLink` | `Link` | Sublinhado sempre; `data-inline` no elemento |
| `surface.tsx` | `Surface` | — (`div` ou `as`) | `tone?: "surface" \| "raised" \| "sunken" \| "paper"`, `radius?: "md" \| "lg" \| "card"`, `padding?: "none" \| "sm" \| "md" \| "lg"`, `shadow?: "none" \| "soft" \| "lift"`. `paper` aplica `text-paper-ink` |
| `spinner.tsx` | `Spinner` | — | `label: string` (texto para leitor de tela); três pontos que pulsam, parados com movimento reduzido |
| `state-block.tsx` | `StateBlock` | — | `kind: "loading" \| "error" \| "empty" \| "waiting" \| "quota"`, `title: string`, `description?: string`, `action?: ReactNode`. `loading` tem `role="status"`; `error` tem `role="alert"`; cada tipo tem o seu ícone |
| `icon-size.ts` | `ICON` | — | `{ sm: 16, md: 20, lg: 24, xl: 32, blot: 56 } as const` |

`Icon` é o tipo de componente de ícone do Phosphor. Em componente de servidor, o ícone vem da entrada SSR do pacote (conferir o caminho na versão instalada).

Aparência comum, que a skill `frontend-design` detalha sem sair dos tokens: botão `primary` cheio em `primary` com `on-primary`; `secondary` com fundo `surface` e borda `line-strong`; `quiet` sem fundo; todos com raio `pill`. Campo com fundo `surface`, borda `line-strong`, raio `md`. Rótulo tocável com raio `pill`, borda `line`; selecionado: fundo `primary-soft`, borda `primary` e ícone `Check`. Sobreposições em `raised`, raio `lg`, sombra `lift`. Estado pressionado: escala 0.98 em `--ritu-fast`.

**Marca (`src/components/brand/` e `public/marca/`)**

| Arquivo em `public/marca/` | Origem | O que é |
|---|---|---|
| `simbolo-ritu.png` | `design/derivados/simbolo-ritu.png` | Máscara do símbolo do logo, 640 × 640, só canal alfa |
| `mancha-vata.webp`, `mancha-pitta.webp`, `mancha-kapha.webp` | `design/derivados/` | Manchas de aquarela, 512 × 512, fundo transparente, sem ícone |
| `papel.svg` | Escrito nesta spec | Ruído fino (`feTurbulence`), 240 × 240, repetível, em marrom com alfa baixo |

```ts
// logo.tsx
export function Logo(props: { variant?: "symbol" | "full"; size?: "sm" | "md" | "lg"; className?: string }): ReactElement
// "symbol": um span com mask-image do símbolo e background-color: currentColor, role="img", aria-label="Ritu".
// "full": o símbolo (aria-hidden) e a palavra "Ritu" em font-title. Tamanhos do símbolo: 2rem, 3rem, 6rem.

// dosha-blot.tsx
export type Dosha = "vata" | "pitta" | "kapha"
export function DoshaBlot(props: { dosha: Dosha; size?: "sm" | "md" | "lg"; withIcon?: boolean; className?: string }): ReactElement
// Decorativo: aria-hidden, imagem com alt="". Tamanhos: 4rem, 8rem, 11rem.
// Ícone (withIcon, padrão true), Phosphor "thin", em paper-ink: vata → Wind, pitta → Fire, kapha → Drop.
```

**Página `/marca` (`src/app/marca/page.tsx`, pública, `robots: { index: false }`)**

Título "Marca" e as seções, nesta ordem, cada uma com `h2`: Cores (cada token com nome e amostra; os pares de texto escritos sobre o fundo) · Tipografia (os sete tamanhos e um parágrafo de fala do agente em `text-prose`, na largura `prose`) · Superfícies (tons, raios e sombras) · Ícones (os tamanhos de `ICON`) · Componentes (um bloco por componente base, com todos os estados e um botão que abre cada sobreposição) · Estados (os cinco `StateBlock`) · Marca (`Logo` nas duas variantes; as três manchas em `Surface tone="paper"`, com o nome do dosha) · Movimento (botão que repete `rise`) · Tema (`ThemeSwitcher`). Os textos de exemplo são do produto (alimentos, frases da conversa), nunca "lorem ipsum".

**Testes sem navegador**

- `src/components/tokens/contrast.ts`: `parseTokens(css: string): Record<string, { light: string; dark: string }>` (lê `--ritu-<nome>: light-dark(a, b)`) e `contrastRatio(a: string, b: string): number` (WCAG 2.x, cores `#RRGGBB`). `tokens.test.ts` confere os pares e que todo token da tabela "Cores" existe.
- `src/components/theme/theme.test.ts`: `parseTheme` e `themeCookie`.
- `src/components/cx.test.ts`.
- `src/components/design-guard.test.ts`: varre `src/app/**` e `src/components/**` (`.ts`, `.tsx`, `.css`), fora de `tokens.css` e dos arquivos de teste.

| Regra | Acusa |
|---|---|
| G1 | Cor literal: `#` seguido de 3 a 8 hexadecimais, `rgb(`, `hsl(`, `oklch(` |
| G2 | Variante `dark:` em classe |
| G3 | `dangerouslySetInnerHTML` |
| G4 | Import de `@radix-ui/*`, `@headlessui/*`, `@mui/*`, `@chakra-ui/*`, `antd`, `lucide-react`, `class-variance-authority`, `tailwind-variants` |
| G5 | Tamanho de texto em `px`: `text-[<n>px]` ou `font-size: <n>px` |

**Teste de arquitetura:** acrescentar a `PACKAGE_HOMES` (regra R5): `"react-aria-components"`, `"react-aria"`, `"react-stately"`, `"@react-aria"` e `"@react-stately"` → `["src/components/"]`.

**Apoio de E2E (`e2e/apoio/`)**

```ts
// tema.ts
export const TEMAS = ["light", "dark"] as const
export async function usarTema(context: BrowserContext, tema: (typeof TEMAS)[number]): Promise<void> // põe o cookie ritu_theme

// a11y.ts
export async function expectSemViolacoes(page: Page, opcoes?: { excluir?: string[] }): Promise<void>
// AxeBuilder com as tags wcag2a, wcag2aa, wcag21a, wcag21aa e wcag22aa; falha em impacto "serious" ou "critical";
// a mensagem lista regra, impacto e seletor de cada nó.
```

Toda spec de tela (017 a 020) chama `expectSemViolacoes` em cada tela, para cada tema de `TEMAS`; os projetos `celular` e `desktop` do Playwright cobrem os dois tamanhos.

### Usa

- **001:** `config` e `config/index.ts`; aliases `@/` e `@config/`; regras R3 e R4 (componentes não importam infra, e do core só `import type`); `PACKAGE_HOMES` do teste de arquitetura; `playwright.config.ts` (projetos `celular` e `desktop`); `e2e/smoke.spec.ts`; passos da CI (não mudam).
- **`config.app`** (`name`, `disclaimer`), na página `/`.

## Evals (quando a spec toca agente, prompt, tool ou base)

Não se aplica: a spec não toca agente, prompt, tool nem base.

## Nível das partes

- **tela** (Sonnet): `tokens.css` e `globals.css`, `layout.tsx` e `fonts.ts`, todos os componentes de `src/components/base/`, `brand/` e `theme/theme-switcher.tsx`, `papel.svg`, a página `/`, a página `/marca` e `e2e/marca.spec.ts`.
- Todo o resto é `mecanica`: pacotes e `postcss.config.mjs`, `config/ui.ts`, cópia das fontes e dos arquivos de marca, `theme.ts`, `cx.ts`, `contrast.ts` e os testes sem navegador, `design-guard.test.ts`, `PACKAGE_HOMES`, `e2e/apoio/`.

## Leitura para a construção

- `DESIGN.md`, inteiro (é curto; o `implementador-tela` já o lê).
- `DEVELOPMENT.md` §"UI".
- `QA.md` §"Telas (E2E)", só a linha de acessibilidade.
- Skills `frontend-design` e `web-design-guidelines`; `next-best-practices` (`font.md`) na tarefa das fontes.

## Dependências

- Spec 001 construída. Nenhuma dependência das specs 008 a 015: pode ser construída em qualquer ponto depois da entrega 2.
- Pacotes novos da tabela acima; `@fontsource-variable/*` só para copiar os arquivos.
- `design/derivados/` (já no repositório de trabalho; entra no primeiro commit desta spec).
- Nenhuma variável de ambiente, nenhuma migração, nenhuma rota de servidor.

## Riscos e trade-offs

- **`light-dark()`:** pede Chrome 123, Safari 17.5 ou Firefox 120 (2024). Navegador mais velho fica sem cor de token. É a escolha: um bloco só de tokens, sem duplicar o tema.
- **`layout.tsx` lê cookie:** todas as páginas passam a ser dinâmicas. A CSP com nonce da 017 já exige isso.
- **Cookie gravado pelo cliente:** não é `httpOnly`; guarda só `light` ou `dark`. Não é dado pessoal nem de sessão.
- **Estilo inline do React Aria:** as sobreposições são posicionadas com o atributo `style`. A CSP da 017 precisa de `style-src-attr 'unsafe-inline'` (ou equivalente); fica registrado aqui para aquela spec.
- **API instável do aviso breve:** a versão do `react-aria-components` fica exata; atualizar é tarefa consciente, com `toast.tsx` como único ponto a rever.
- **Manchas recortadas de JPEG:** Vata e Pitta têm cerca de 340 px de origem; acima de 11rem perdem nitidez. O tamanho `lg` é o teto.
- **Cormorant Garamond é fina:** só em título, de 1,25 rem para cima e peso 500 ou mais. Em tela de baixa densidade pode parecer leve; `/marca` mostra os tamanhos para a dona conferir.
- **`theme-color` do navegador** segue o aparelho, não a escolha manual: a barra do navegador pode ficar clara com a página escura. Aceito.
- **Sem teste unitário de componente:** regressão de comportamento só aparece no E2E, que roda no fim da spec e na CI.

## Edge cases e modos de falha

- Cookie `ritu_theme` com valor desconhecido: tratado como automático; o `html` sai sem `data-theme`.
- JavaScript desligado: a página funciona e segue o tema do cookie ou do aparelho; o seletor de tema não troca.
- Fonte que não carrega: a pilha de reserva (`Georgia`, `system-ui`) entra, com `display: swap`.
- Zoom de 200% ou janela de 320 px: uma coluna, sem rolagem horizontal; `Sheet` e `Dialog` rolam por dentro.
- Texto longo em botão ou rótulo: quebra em duas linhas, não corta nem estoura.
- `Menu` e lista do `ComboBox` perto da borda: o React Aria reposiciona; altura máxima com rolagem interna.
- `ComboBox` sem resultado: mostra `emptyText`; carregando: mostra o `Spinner` com `label`.
- Vários avisos breves seguidos: empilham, o mais novo em cima; nenhum some com o foco ou o ponteiro sobre ele.
- Imagem de mancha que falha: o ícone e o nome do dosha continuam; nada depende só da mancha.
- Modo de alto contraste do sistema (`forced-colors`): o anel de foco usa `outline`, que o sistema preserva; nenhum estado depende só de cor de fundo.
- Par de contraste reprovado no teste: a tarefa para e relata; ninguém muda valor de token.
- Primitivo ou prop do React Aria com outro nome na versão instalada: usar o equivalente e registrar em `.plans/DECISOES-AUTONOMAS.md`; os nomes exportados pelo Ritu não mudam.

## Resultado (definição de pronto)

- Critérios de aceite marcados; gates 1 a 6 verdes; `npm run dup` limpo.
- `npm run build && npm run start` e `/marca` aberta no celular e no desktop, nos dois temas, com screenshots em `.plans/016-marca-<tema>-<projeto>.png` (quatro arquivos).
- `DESIGN.md` §2 com a coluna de valores fechada (cores, fontes, ícones, raio e sombra, apontando para `tokens.css`) e sem menção a `PREPARO.md`; §5 com a lista de arquivos de `design/` e de `public/marca/` e o que cada um é. §3 ganha a linha do tema (automático, com escolha manual).
- `DEVELOPMENT.md` §"UI": classes só de token, sem `dark:`, React Aria só em `src/components/`, `/marca` como vitrine. `QA.md`: a linha dos testes de contraste e de guarda em "Evals determinísticos" não se aplica (são `npm test`); acrescentar em "Telas (E2E)": "`/marca` passa no axe com cada sobreposição aberta".
- `ARCHITECTURE.md` §7: `src/components/` com `tokens/`, `theme/`, `base/` e `brand/`; `e2e/apoio/`.
- ADR nova (próximo número livre): tokens em CSS com Tailwind v4 e `light-dark()`, tema por cookie lido no servidor, fontes locais.
- `AGENTS.md`: nenhuma mudança de comando.

## Arquivos e diretórios envolvidos

- `package.json`, `package-lock.json`, `postcss.config.mjs` (novo), `biome.json` (se preciso)
- `config/ui.ts` (novo), `config/index.ts`
- `src/app/globals.css` (novo), `src/app/layout.tsx`, `src/app/fonts.ts` (novo), `src/app/fonts/` (novo), `src/app/page.tsx`
- `src/app/marca/page.tsx` e `src/app/marca/_secoes/` (novos)
- `src/components/cx.ts`, `cx.test.ts`, `design-guard.test.ts` (novos)
- `src/components/tokens/tokens.css`, `contrast.ts`, `tokens.test.ts` (novos)
- `src/components/theme/theme.ts`, `theme.test.ts`, `theme-switcher.tsx` (novos)
- `src/components/base/` (novo, 17 arquivos da tabela)
- `src/components/brand/logo.tsx`, `dosha-blot.tsx` (novos)
- `public/marca/` (novo); `design/derivados/` (entra no git)
- `src/architecture.test.ts` (`PACKAGE_HOMES`)
- `e2e/apoio/tema.ts`, `e2e/apoio/a11y.ts`, `e2e/marca.spec.ts` (novos)
- `.docs/DESIGN.md`, `DEVELOPMENT.md`, `QA.md`, `ARCHITECTURE.md`; `.adrs/`
