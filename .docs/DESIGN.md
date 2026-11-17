# Design

> Direção visual, a partir das imagens de referência em `design/`. As imagens servem de inspiração para cores, texturas e ilustração; **não definem o formato das telas**. Os valores vivem em `src/components/tokens/tokens.css` e aparecem todos na página `/marca`.

## 1. Sensação

Calma, quente e natural. Luz de fim de tarde, linho, madeira, cerâmica. Nada clínico, nada místico demais. O produto fala baixo.

A tela principal é uma **conversa**: o agente fala em texto, como uma pessoa. Blocos visuais apoiam a fala, nunca a substituem.

## 2. Elementos e valores

Os valores abaixo são os de `src/components/tokens/tokens.css` (claro · escuro). Nenhum componente ou página escreve cor, raio ou sombra à mão.

| Elemento | Direção | Valor |
|---|---|---|
| Fundo | Off-white quente, cor de papel ou linho; no escuro, marrom profundo | `canvas` `#F8F3EA` · `#1E1611`; faixas em `sunken` `#EFE7DA` · `#18110D` |
| Superfícies | Cantos bem arredondados, sombra suave, leve textura de papel (`public/marca/papel.svg`, igual nos dois temas). O formato de "carta" fica para o dosha e o quiz | `surface` `#FDFAF4` · `#2A1F18`; `raised` `#FFFDF8` · `#35281F` (menu, diálogo, folha, dica); raios `sm` 0.625rem, `md` 1rem, `lg` 1.5rem, `card` 1.75rem, `pill`; sombras `soft` e `lift` |
| Cor de apoio | Areia e bege | `line` `#E2D5C0` · `#4A3A2E` (divisória); `line-strong` `#94806A` · `#9A8571` (borda de campo, 3:1) |
| Primária | Terracota: botão principal, link, seleção | `primary` `#9E4B2B` · `#E39570`, com `primary-hover`, `primary-pressed`, `on-primary` e `primary-soft` |
| Destaque | Âmbar (cúrcuma), nunca como texto | `amber` `#D99A2B` · `#E6B455`; texto em `amber-ink`, fundo em `amber-soft` |
| Natureza | Verde-sálvia, em pouca quantidade, nunca como texto | `sage` `#7C8F72` · `#8FA384`; confirmação em `sage-ink` e `sage-soft` |
| Texto | Marrom-café bem escuro, em vez de preto | `ink` `#33241A` · `#F1E6D6`; secundário `ink-muted` `#6B5646` · `#C4B19C`; foco `focus` igual ao texto |
| Erro | Vermelho de barro | `danger` `#9A2B38` · `#F2A0A6`; fundo `danger-soft` |
| Doshas | Uma cor por dosha, para borda e ícone; nunca o único sinal | `vata` `#5E7FA3` · `#9DB9D8`; `pitta` `#B5562A` · `#E9A070`; `kapha` `#5F7A52` · `#A8C19A` |
| Carta | A aquarela só funciona sobre papel claro | `paper` `#F6F1E7` e `paper-ink` `#33241A`, iguais nos dois temas |
| Ícones | Phosphor, peso `light` (traço fino); `thin` em tamanhos grandes | 16, 20 e 24 px em `light`; 32 px para cima em `thin` (`ICON` em `src/components/base/icon-size.ts`) |
| Ilustração | Mancha de aquarela com um ícone de traço fino por cima | `DoshaBlot`: mancha de `public/marca/` com Wind (Vata), Fire (Pitta) ou Drop (Kapha), sempre sobre `paper` |
| Títulos | Serifada elegante, de traço fino | Cormorant Garamond, peso 600 (500 no `display`), só de `title-sm` (1.375rem) para cima |
| Texto corrido | Sem serifa, legível no celular | Figtree; `body` 1rem / 1.6; fala do agente em `prose` 1.0625rem / 1.7, largura `prose` 34rem |
| Movimento | Curto e discreto | `ease-ritu`; 120, 200 e 320 ms; animações `rise`, `fade` e `sheet` |
| Layout | Coluna da conversa e altura da barra de navegação | `--container-shell` 62rem (`max-w-shell`), a largura do cabeçalho, da faixa de demonstração e do corpo do app; `--ritu-bar-h` 3.5rem, a barra embaixo no celular e o espaço que ela ocupa |
| Fotos | Ervas, especiarias, óleo, luz quente | Só a imagem da Entrada |

Todo par de texto e fundo previsto passa em AA nos dois temas, conferido por `src/components/tokens/tokens.test.ts`.

## 3. Regras

- Celular primeiro. Uma coluna, toques grandes.
- Tema claro e escuro, com o mesmo cuidado (o escuro é marrom profundo, não preto). O tema segue o aparelho, com escolha manual (Claro · Escuro · Automático) guardada no cookie `ritu_theme` e lida no servidor.
- Contraste WCAG AA em todo texto.
- Cada dosha tem a sua cor de mancha; a cor nunca é o único sinal.
- A fala do agente é texto corrido, com boa leitura no celular: largura confortável, entrelinha generosa, sem moldura pesada.
- As sugestões aparecem abaixo da fala, em blocos leves e compactos. Ingredientes são pequenos rótulos tocáveis.
- Animação curta e discreta: etapas do agente aparecendo. A resposta aparece inteira, numa transição de opacidade; com `prefers-reduced-motion`, sem transição.
- Os atalhos de check-in são ícones de traço fino.
- No celular, o painel fixo da conversa (retornos, atalhos e caixa) fica acima da barra de navegação. Nada da conversa fica escondido atrás dele.
- Nada que lembre marca existente de bem-estar ou de aplicativo de meditação.
- Nada com cara de kit de componentes pronto: forma, raio, sombra, foco e movimento de cada componente são do Ritu.

### Acessibilidade

Meta: **WCAG 2.2 AA**, medida pelo axe no E2E (`QA.md`).

- `lang="pt-BR"`, títulos em ordem, regiões `header`, `main` e `nav`.
- Contraste AA nos dois temas, inclusive texto sobre as manchas de aquarela e sobre a imagem da Entrada. Foco visível com contraste de 3:1.
- Alvos de toque de pelo menos 44 × 44 px.
- Texto em `rem`; com zoom de 200%, nada some e não há rolagem horizontal.
- Todo botão de ícone e todo atalho de check-in tem nome acessível ("Com frio", não o emoji). Imagem decorativa com `alt=""`; cartas dos doshas com texto alternativo.
- **Conversa:** a lista de mensagens tem `role="log"`. As etapas ao vivo ficam numa região `aria-live="polite"` que anuncia só a etapa nova. O texto que chega aos pedaços não é anunciado pedaço a pedaço: a resposta é anunciada inteira quando termina. `aria-busy="true"` enquanto o agente trabalha.
- **Caixa de mensagem durante a resposta:** `aria-disabled` (não `disabled`), com o motivo visível e anunciado ("O Ritu está respondendo"). O foco não sai da caixa.
- Pergunta do agente e bloco de aprovação: cada opção e cada chave tem um rótulo que diz o item ("Anotar: abóbora em Minha casa").
- Diálogos e folhas prendem o foco e o devolvem ao fechar (o React Aria faz; não quebrar).
- Nada pisca; animações respeitam `prefers-reduced-motion`.
- Proposta que expira diz que expira, e expirar não perde nada além da proposta.

## 4. Componentes

### Base

Escritos no Ritu sobre **React Aria Components**, que trazem comportamento e acessibilidade e nenhum estilo. Todo o visual vem dos tokens. Ficam em `src/components/base/`, um arquivo por componente, e aparecem em `/marca` com todos os estados. Todo controle tem pelo menos 44 px de altura (ou de área de toque, no tamanho `sm`).

| Componente | Primitivo do React Aria | Arquivo |
|---|---|---|
| Botão, botão de ícone | `Button` | `button.tsx`, `icon-button.tsx` |
| Campo de texto, área de texto | `TextField` | `text-field.tsx` |
| Rótulo tocável (ingrediente, atalho) | `ToggleButton`, `TagGroup` | `chip.tsx` |
| Botão de dois estados (👍 e 👎 na resposta) | `ToggleButton` | `toggle-button.tsx` |
| Escolha entre opções (pergunta do agente) | `RadioGroup`, `Radio` | `radio-group.tsx` |
| Menu | `MenuTrigger`, `Menu` | `menu.tsx` |
| Diálogo e folha que sobe de baixo | `DialogTrigger`, `Modal` | `dialog.tsx` |
| Abas | `Tabs` | `tabs.tsx` |
| Busca com sugestões | `ComboBox` | `combo-box.tsx` |
| Chave liga/desliga, caixa de seleção | `Switch`, `Checkbox` | `switch.tsx`, `checkbox.tsx` |
| Aviso breve | `UNSTABLE_ToastRegion` (API instável, isolada neste arquivo) | `toast.tsx` |
| Dica | `TooltipTrigger` | `tooltip.tsx` |
| Link de texto | `Link` | `text-link.tsx` |
| Superfície, indicador de carregamento, bloco de estado (carregando, erro, vazio, esperando você, cota esgotada) | — | `surface.tsx`, `spinner.tsx`, `state-block.tsx` |
| Logo e mancha do dosha | — | `src/components/brand/` |
| Seletor de tema | `ToggleButtonGroup` | `src/components/theme/theme-switcher.tsx` |

### Do Ritu

| Componente | Onde |
|---|---|
| Carta de dosha | Painel do dosha, resultado do quiz |
| Barra de navegação (Conversa · Minha casa · Como ficou? · Você), embaixo no celular e na lateral no desktop | Todas as telas de quem entrou (`src/components/ritu/abas.tsx`) |
| Fala do agente e fala da pessoa | Conversa |
| Caixa de mensagem com atalhos de check-in | Conversa |
| Etapas ao vivo | Conversa, enquanto o agente trabalha |
| Etapas recolhidas ("Pensei em N passos" e "Como pensei") | Conversa, depois da resposta |
| Pergunta do agente (com Tenho · Não tenho · Não gosto por item) | Conversa |
| Bloco de sugestão (ingredientes tocáveis, qualidades em verbos, "por quê?", marca de novidade) | Conversa |
| Linha "Vale ter em casa" (alimento, número de faltas, o que ele traz, "por quê?") | Conversa |
| Menu do ingrediente (Trocar · Não tenho · Não gosto) | Conversa |
| Bloco de aprovação | Conversa |
| Indicador de retornos pendentes | Conversa |
| Item da casa (estado, data, sempre tenho, gosto) e seção "Ainda tem?" | Minha casa |
| Item da lista "Para ter em casa" (com o motivo e o botão de tirar) | Minha casa |
| Item de retorno (Ajudou · Não ajudou · Não fiz) | Como ficou? |
| Item de memória, por nível, com corrigir e apagar | O que sei sobre você |
| Busca de cidade | Aviso inicial, Perfil |
| Linha do tempo | Como pensei |
| Gráfico de evolução dos evals | Bastidores |
| Faixa de demonstração | Todas as telas, na demonstração |

Os componentes da conversa ficam em `src/components/ritu/conversa/`, com o estado da tela em `estado.ts` e `use-conversa.ts`.

## 5. Arquivos

| Arquivo | O que é |
|---|---|
| `design/ritu-logo.jpeg` | Logo de referência (símbolo e palavra) |
| `design/vata-card.jpeg`, `design/pitta-card.jpeg`, `design/kapha-card.jpeg` | Cartas de referência dos doshas, de onde saem as manchas |
| `design/login-cover.jpeg` | Imagem da Entrada |
| `design/login-screen-reference.jpeg` | Referência do corte diagonal da Entrada e do logo |
| `design/derivados/` | Recortes feitos das referências: as três manchas e o símbolo do logo |
| `public/marca/simbolo-ritu.png` | Máscara do símbolo do logo (640 × 640, só alfa), pintada com a cor do texto pelo `Logo` |
| `public/marca/mancha-vata.webp`, `mancha-pitta.webp`, `mancha-kapha.webp` | Manchas de aquarela (512 × 512, fundo transparente, sem ícone), usadas pelo `DoshaBlot` |
| `public/marca/entrada.webp` | Imagem da Entrada, derivada de `design/login-cover.jpeg` |
| `public/marca/papel.svg` | Textura de papel (ruído fino, 240 × 240, repetível) sobre o fundo da página |
| `src/app/fonts/` | Cormorant Garamond e Figtree em `woff2` variável, com a licença OFL |
