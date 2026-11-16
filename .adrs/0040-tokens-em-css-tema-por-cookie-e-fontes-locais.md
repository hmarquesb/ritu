# ADR 0040: Tokens em CSS com Tailwind v4 e `light-dark()`, tema por cookie lido no servidor, fontes locais

## Status

Aceito · 2026-11-16 · Spec 016.

## Contexto

As entregas 1 e 2 não têm tela. `DESIGN.md` dava a direção (papel e linho, terracota e âmbar, serifa fina nos títulos), mas sem valores fechados. Sem um lugar único para os valores, cada tela da entrega 3 escolheria os seus, e o tema escuro viraria uma segunda cópia de cada cor.

O site precisa de tema claro e escuro, que siga o aparelho e aceite escolha manual, sem piscar o tema errado. A CSP da spec 017 usa nonce, então não pode haver script inline para aplicar o tema antes da pintura. A política de privacidade e a CSP também pedem que nada seja buscado em outra origem.

## Decisão

1. **Um arquivo de tokens.** `src/components/tokens/tokens.css` define cada cor como `--ritu-<nome>: light-dark(<claro>, <escuro>)` e expõe tudo ao Tailwind v4 pelo `@theme` (`bg-canvas`, `text-ink`, `rounded-card`, `shadow-lift`, `animate-rise`). O `@theme` zera a paleta, os raios, as sombras, os tamanhos de texto, as curvas e as animações padrão do Tailwind: o que não é token não gera classe. Fica a escala de espaçamento.
2. **O tema troca pelo `color-scheme`.** `:root` tem `color-scheme: light dark`; `data-theme="light"` ou `"dark"` no `html` força um dos dois. Nenhum componente usa a variante `dark:`.
3. **Escolha guardada em cookie, lida no servidor.** O seletor grava `ritu_theme` (`light`, `dark`; "Automático" apaga) pelo cliente. O `layout.tsx` lê o cookie com `cookies()` e já entrega o `html` com `data-theme`. Sem `localStorage`, sem script inline, sem rota de servidor.
4. **Fontes locais.** Cormorant Garamond (títulos) e Figtree (texto), em `woff2` variável `latin`, em `src/app/fonts/`, carregadas com `next/font/local`.
5. **Componentes base sobre React Aria Components**, estilizados só com classes de token e variantes `data-*` do React Aria. `react-aria-components` só pode ser importado em `src/components/` (regra R5 do teste de arquitetura).
6. **Guardas por teste.** `tokens.test.ts` confere o contraste de todos os pares previstos, nos dois temas. `design-guard.test.ts` acusa cor literal fora de `tokens.css`, `dark:`, `dangerouslySetInnerHTML`, biblioteca de UI com visual pronto e tamanho de texto em `px`. O axe roda no E2E de `/marca`, com cada sobreposição aberta.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Dois blocos de tokens (`:root` e `[data-theme=dark]`) | Duplica cada cor; os dois blocos se desencontram com o tempo |
| Variante `dark:` do Tailwind | Espalha o tema por todos os componentes e não lê a escolha manual sem configuração extra |
| Tema em `localStorage` com script no `<head>` | Pede script inline, que a CSP com nonce da 017 não aceita sem exceção; o HTML chega no tema errado sem ele |
| Fontes pelo Google Fonts | Pedido a terceiro em cada visita, build dependente de rede e exceção na CSP |
| Biblioteca com visual pronto (shadcn/ui, Radix, MUI) | O Ritu não pode ter cara de kit; os primitivos do React Aria resolvem foco e teclado sem impor aparência |
| `clsx`, `cva` ou `tailwind-variants` | Uma função `cx` e mapas de variante em objeto bastam para dez componentes |

## Consequências

- `light-dark()` pede Chrome 123, Safari 17.5 ou Firefox 120. Navegador mais velho fica sem cor de token.
- O `layout.tsx` lê cookie: todas as páginas são dinâmicas (a CSP com nonce da 017 já exige isso).
- No Tailwind v4, duas classes da mesma propriedade no mesmo elemento valem pela ordem da folha, não pela do `className`. Por isso tamanho, padding e texto ficam só no mapa de variante de cada componente.
- O `theme-color` do navegador segue o aparelho, não a escolha manual.
- O aviso breve usa a API instável do React Aria (`UNSTABLE_ToastRegion`), isolada em `toast.tsx`, com `react-aria-components` em versão exata.
- As sobreposições do React Aria são posicionadas por atributo `style`: a CSP da 017 precisa de `style-src-attr 'unsafe-inline'` ou equivalente.
- Com a lista da busca aberta, o React Aria esconde o resto da página com `aria-hidden` sem tirar o foco dos controles. O axe nesse estado exclui o conteúdo escondido, que já foi conferido com a página parada.
