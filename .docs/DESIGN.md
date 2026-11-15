# Design

> Direção visual, a partir das imagens de referência em `design/`. As imagens servem de inspiração para cores, texturas e ilustração; **não definem o formato das telas**. Os valores exatos são fechados em `PREPARO.md` §5, e a spec 016 transforma isto em tokens.

## 1. Sensação

Calma, quente e natural. Luz de fim de tarde, linho, madeira, cerâmica. Nada clínico, nada místico demais. O produto fala baixo.

A tela principal é uma **conversa**: o agente fala em texto, como uma pessoa. Blocos visuais apoiam a fala, nunca a substituem.

## 2. Elementos percebidos nas referências

| Elemento | Direção | Valor a fechar em `PREPARO.md` §5 |
|---|---|---|
| Fundo | Off-white quente, cor de papel ou linho | Valor exato |
| Superfícies | Cantos bem arredondados, sombra suave, leve textura de papel. O formato de "carta" fica para o dosha e o quiz | Raio e sombra |
| Cor de apoio | Areia e bege | Valores |
| Destaque | Terracota e âmbar (cúrcuma) | Valores; qual é o primário |
| Natureza | Verde-sálvia, em pouca quantidade | Valor |
| Texto | Marrom-café bem escuro, em vez de preto | Valor; contraste AA |
| Ícones | Phosphor, peso `light` (traço fino); `thin` em tamanhos grandes | Tamanhos |
| Ilustração | Mancha de aquarela com um ícone de traço fino por cima (como a chama do Pitta) | Uma mancha por dosha: Vata, Pitta, Kapha |
| Títulos | Serifada elegante, de traço fino | Qual fonte |
| Texto corrido | Sem serifa, legível no celular | Qual fonte |
| Fotos | Ervas, especiarias, óleo, luz quente | Onde entram |

## 3. Regras

- Celular primeiro. Uma coluna, toques grandes.
- Tema claro e escuro, com o mesmo cuidado (o escuro é marrom profundo, não preto).
- Contraste WCAG AA em todo texto.
- Cada dosha tem a sua cor de mancha; a cor nunca é o único sinal.
- A fala do agente é texto corrido, com boa leitura no celular: largura confortável, entrelinha generosa, sem moldura pesada.
- As sugestões aparecem abaixo da fala, em blocos leves e compactos. Ingredientes são pequenos rótulos tocáveis.
- Animação curta e discreta: etapas do agente aparecendo, texto chegando. Respeitar `prefers-reduced-motion`.
- Emojis dos atalhos de check-in podem dar lugar a ícones de traço fino.
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

Escritos no Ritu sobre **React Aria Components**, que trazem comportamento e acessibilidade e nenhum estilo. Todo o visual vem dos tokens.

| Componente | Primitivo do React Aria |
|---|---|
| Botão, botão de ícone | `Button` |
| Campo de texto, área de texto | `TextField` |
| Rótulo tocável (ingrediente, atalho) | `ToggleButton`, `TagGroup` |
| Menu | `MenuTrigger`, `Menu` |
| Diálogo e folha que sobe de baixo | `DialogTrigger`, `Modal` |
| Abas | `Tabs` |
| Busca com sugestões | `ComboBox` |
| Chave liga/desliga, caixa de seleção | `Switch`, `Checkbox` |
| Aviso breve | `UNSTABLE_ToastRegion` ou componente próprio com `aria-live` (conferir a versão instalada) |
| Dica | `TooltipTrigger` |

### Do Ritu

| Componente | Onde |
|---|---|
| Carta de dosha | Painel do dosha, resultado do quiz |
| Fala do agente e fala da pessoa | Conversa |
| Caixa de mensagem com atalhos de check-in | Conversa |
| Etapas ao vivo | Conversa, enquanto o agente trabalha |
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

## 5. Arquivos

*A preencher em `PREPARO.md` §5:* logo, imagem da Entrada, cartas dos doshas, demais referências.
