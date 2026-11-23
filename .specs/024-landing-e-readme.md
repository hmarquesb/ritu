---
title: Landing, Sobre e README
status: implemented
implemented: bfb6d16
entrega: 4
created: 2026-11-15
---

# Landing, Sobre e README

> Fecha o Ritu para quem chega de fora. A **Entrada** ganha, abaixo do cartão da 017, o que o Ritu é: como funciona, uma conversa de exemplo, o que faz e não faz e o que tem por dentro. A tela **Sobre** (`/sobre`) traz o projeto, a autoria, as fontes e a **política de privacidade**. O **README** passa a ter versão em português e em inglês, com prints gerados por script e blocos de números e de ADRs gerados das fontes de verdade. Junto vêm o rodapé público, metadados de compartilhamento, `robots.txt` e `sitemap.xml`.

## Contexto

A 017 fez a Entrada como porta de entrada: ilustração, logo e um cartão com a demonstração e o Google. Quem chega por um link (portfólio, LinkedIn, README) não tem como saber o que o Ritu faz antes de clicar. `BUSINESS.md` §7 pede a tela Sobre com "o projeto, privacidade, link do repositório", e §14 pede que ela diga com clareza que o provedor de IA pode usar as mensagens. O README atual é o da 001 ("em construção"), sem números nem prints; o portão 4 pede o README pronto.

Os números já têm fonte única: `evals/resultados/historico.json` (014), que gera `COMPARACAO.md` e os gráficos de Bastidores (023). As ADRs têm o índice em `.adrs/README.md`. O README não pode virar uma terceira cópia escrita à mão.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Landing:** a primeira dobra da Entrada fica como na 017; o texto vem rolando abaixo do cartão, com um rodapé Sobre · Bastidores · GitHub.
- **Contato de privacidade:** e-mail na variável `CONTATO_PRIVACIDADE`, fora do repositório.
- **README:** `README.md` em português, `README.en.md` em inglês, com link de um para o outro no topo.
- **Assinatura:** "Helena Marques Batista", com GitHub (`github.com/hmarquesb`) e LinkedIn (`linkedin.com/in/hmarquesb`).
- **Licença:** código sob MIT (`LICENSE`, na raiz); a base ayurvédica (`data/`) com todos os direitos reservados (`data/LICENSE.md`). Os dois arquivos já foram criados em 2026-11-15; esta spec só os cita.

Uma regra de fora entra aqui: os termos adicionais da API do Gemini pedem que o serviço não seja voltado para menores de 18 anos, e no plano gratuito o Google pode usar o conteúdo e pessoas revisoras podem lê-lo (`ai.google.dev/terms`, consultado em 2026-11-15). A política diz as duas coisas.

## Objetivo

- Quem abre a Entrada sem sessão entende, rolando, o que o Ritu faz e não faz, vê uma conversa real de exemplo e chega a Bastidores, ao MCP e ao código, sem perder o caminho da demonstração em dois toques.
- Quem quer saber o que acontece com os dados lê, em `/sobre#privacidade`, o que é guardado, por quanto tempo, com quem passa, os cookies, os direitos e o contato, em linguagem simples, coerente com o que o código faz.
- Quem abre o repositório no GitHub vê em uma tela o que é o Ritu, um print, os números dos evals e o link para o site; em inglês, pelo `README.en.md`.
- Nenhum número do README é digitado à mão: um comando refaz os blocos, e um eval determinístico falha se o README estiver desatualizado.

## Escopo

- **Dentro:**
  - Seções da Entrada abaixo do cartão: Como funciona, Uma conversa de exemplo, O que faz e não faz, Por dentro, chamada final.
  - Rodapé público (`RodapePublico`) na Entrada, em Sobre e em Bastidores (troca o rodapé da 023).
  - Página `/sobre` com O projeto, Quem fez, Como foi feito, Fontes e créditos, Cuidados e Privacidade.
  - Variável `CONTATO_PRIVACIDADE` (obrigatória em produção) e `contatoDePrivacidade`.
  - Linha "Para maiores de 18 anos." no aviso da Entrada.
  - Links para `/sobre#privacidade` no Aviso inicial (017) e em Você › Conta (020).
  - `id="mcp"` na seção do MCP em Bastidores (023), alvo dos links.
  - Metadados (título, descrição, Open Graph), imagem de compartilhamento, ícone do site, `robots.txt`, `sitemap.xml`; `config/publico.ts` com a URL do site.
  - `README.md` e `README.en.md` reescritos; `npm run readme` (blocos gerados) e o eval que confere; `npm run prints` (prints por Playwright no modo e2e) e os prints em `.docs/prints/`.
  - Checagem de `/sobre` no smoke da 022.
  - ADR, docs vivos, E2E.
- **Fora:**
  - Rodar o `c5-publico`: no fechamento da entrega 4, depois desta spec (ordem em "Resultado").
  - Escrever ou mudar `LICENSE` e `data/LICENSE.md`: já existem; a spec só os cita no README e no Sobre.
  - Domínio próprio: o site fica em `*.vercel.app` (ADR 0020).
  - Versão em inglês do site: só o README.
  - Banner de cookies: os dois cookies são necessários ao funcionamento (sessão e tema); não há cookie de análise nem de propaganda.
  - Mudar o cartão da Entrada além da linha de idade: o resto é da 017.

## Necessidade de negócio

A Entrada e o README são o que um avaliador vê primeiro: o projeto precisa se explicar em segundos e levar à demonstração. A política de privacidade é exigência da LGPD para um site que guarda dados de pessoas, e é o que torna verdadeira a promessa "nada escondido" (`BUSINESS.md` §2.6). Números gerados das mesmas fontes de Bastidores mantêm o README honesto ao longo do tempo.

## Critérios de aceite

### Entrada pública

- [ ] **Primeira dobra igual:** no celular e no desktop, a ilustração, o logo e o cartão da 017 ocupam a altura da tela (`min-height: 100dvh`) como antes; os E2E da 017 continuam verdes sem mudança além do texto do aviso.
- [ ] **Convite para rolar:** no pé da primeira dobra, o link "Conheça o Ritu" leva a `#conheca` (foco vai para o `h2` "Como funciona"); com movimento reduzido, sem rolagem suave.
- [ ] **Seções, nesta ordem, cada uma com `h2`:** Como funciona (três passos numerados) · Uma conversa de exemplo · O que ele faz / O que ele não faz · Por dentro · chamada final. Os textos são os de `textosLanding` (abaixo).
- [ ] **Conversa de exemplo:** usa `FalaDaPessoa`, `FalaDoAgente` e `BlocoDeSugestao` da 018 com `exemplo`; os nomes das três sugestões vêm da base pelos ids de `exemploDaLanding` (teste: os ids existem e os nomes aparecem no texto do agente); nada nela é tocável além do texto; abaixo, "Não é orientação médica." e a nota do perfil de demonstração.
- [ ] **Chamada final:** com `estadoDaEntrada(...).demo`, o mesmo botão "Testar com perfil de demonstração" do cartão (mesma ação de servidor, E2E: cria a demonstração e cai no Aviso); sem demonstração e com Google, "Entrar com Google"; sem os dois, só o texto de `estadoDaEntrada`.
- [ ] **Por dentro:** links para `/bastidores`, `/bastidores#mcp` e o repositório (`publico.repositorio`), abrindo na mesma aba (o do GitHub em nova aba, com `rel="noopener"` e o texto "(abre em nova aba)" oculto para leitor de tela).
- [ ] **Aviso de idade:** `entrada.aviso` passa a ser "Projeto de estudo. Não é orientação médica. Para maiores de 18 anos." (o smoke da 022 continua achando "Não é orientação médica").
- [ ] **Com sessão:** `/` continua redirecionando como na 017; as seções novas não são renderizadas para quem tem conta válida.

### Rodapé público

- [ ] `RodapePublico` aparece no fim da Entrada, de `/sobre` e de `/bastidores` (no lugar do `footer` da 023): `nav` com `aria-label="Links do Ritu"` e os links "Sobre e privacidade" (`/sobre`), "Bastidores" (`/bastidores`) e "Código no GitHub"; abaixo, "Projeto de estudo de Helena Marques Batista. Não é orientação médica.". O link da página atual leva `aria-current="page"`.

### Sobre

- [ ] `/sobre` abre sem sessão, com sessão e na demonstração, sem redirecionar (`dynamic = "force-dynamic"`, `metadata.title` "Sobre · Ritu").
- [ ] **Estrutura:** `header` com o logo como link para `/`; `main#conteudo` com `h1` "Sobre o Ritu" e as seções O projeto · Quem fez · Como foi feito · Fontes e créditos · Cuidados · Privacidade, cada uma `section` com `h2` (`aria-labelledby`); `RodapePublico`.
- [ ] **Índice:** abaixo do `h1`, uma `nav` "Nesta página" com link para cada seção; no desktop (a partir de 64rem) fica fixa à esquerda (`position: sticky`), no celular é uma lista no topo.
- [ ] **Privacidade:** `section#privacidade` com "Atualizada em {data}" (`textosSobre.privacidade.atualizadaEm`, formato "1 de dezembro de 2026") e as nove partes de `textosSobre.privacidade`, cada uma com `h3`.
- [ ] **Contato:** com `CONTATO_PRIVACIDADE` válida, "Quem cuida dos seus dados" mostra o e-mail como link `mailto:`; sem ela (ou inválida), mostra `privacidade.semContato` e nenhum `mailto:` (E2E sem a variável; teste de `contatoDePrivacidade`).
- [ ] **Cuidados:** o texto do sinal de alerta e o do sofrimento emocional são os de `BUSINESS.md` §12, lidos dos mesmos textos fixos que o agente usa (teste: mesma string).
- [ ] **Coerência com o código (teste `sobre.test.ts`):** os prazos citados vêm de `config/memoria.ts` (mensagens, faltas, retornos), da duração da demonstração (017) e de `maxAge` da sessão e do cookie de tema (016 e 017), interpolados, nunca digitados no texto.
- [ ] **Âncora:** `/sobre#privacidade` rola até a seção com o `h2` visível abaixo de qualquer cabeçalho fixo (`scroll-margin-top`).

### Links de dentro do app

- [ ] **Aviso inicial (017):** depois das três frases, o `TextLink` "Leia a política de privacidade" para `/sobre#privacidade`; voltar do Sobre cai no mesmo passo (o passo está no banco; `exigirPasso` devolve a pessoa ao Aviso).
- [ ] **Você › Conta (020):** acima de "Sair", o `TextLink` "Sobre o Ritu e privacidade" para `/sobre`.

### Metadados e indexação

- [ ] `metadata` raiz: `title` com o padrão "%s · Ritu" e padrão "Ritu · agente ayurvédico para o seu momento"; `description` = `entrada.oQueE`; `openGraph` (tipo `website`, `locale` `pt_BR`, imagem `/marca/og.jpg` 1200×630 com `alt`); `twitter.card` `summary_large_image`; `metadataBase` = `publico.siteUrl` quando houver.
- [ ] **Imagem de compartilhamento:** `public/marca/og.jpg`, 1200×630, até 200 KB, recorte de `design/login-cover.jpeg` com o logo `full` sobre um campo `canvas` à direita, gerada por `npm run marca:og` (sharp) e versionada.
- [ ] **Ícone:** `src/app/icon.svg` (a marca do logo, sem o nome, em `primary` sobre transparente) e `src/app/apple-icon.png` 180×180 sobre `canvas`.
- [ ] **`robots.txt`** (`src/app/robots.ts`): permite `/`, `/sobre` e `/bastidores`; bloqueia `/api/`, `/comecar/`, `/conversa`, `/casa`, `/como-ficou`, `/voce` e `/marca`; com `publico.siteUrl`, aponta o `sitemap`.
- [ ] **`sitemap.xml`** (`src/app/sitemap.ts`): com `publico.siteUrl`, as três páginas públicas; sem, lista vazia.
- [ ] Páginas de quem entrou (`(comecar)` e `(app)`) levam `robots: { index: false }`.

### README

- [ ] `README.md` (português) e `README.en.md` (inglês) com as seções de "Contratos › README", nesta ordem; o topo de cada um tem o link para o outro ("Read in English" / "Leia em português").
- [ ] **Blocos gerados:** entre os marcadores `<!-- ritu:<bloco> -->` e `<!-- /ritu:<bloco> -->`, os blocos `site`, `numeros` e `adrs` são escritos por `npm run readme` nos dois arquivos; o texto fora dos marcadores não muda (teste com um README de fixture).
- [ ] **Números:** o bloco `numeros` traz, para as cinco métricas de `bastidores.destaques`, o valor do primeiro checkpoint, o do último com valor e a meta, formatados por `formatarMetrica` (023); "—" para `null`; "⚠" no valor abaixo da meta; a linha com a quantidade de checkpoints e o período; links para `evals/COMPARACAO.md` e para Bastidores.
- [ ] **ADRs:** o bloco `adrs` lista todas as ADRs de `.adrs/` (número com link e título, da linha `# ` de cada arquivo), na ordem do número; em inglês, com a nota "ADRs are written in Portuguese."
- [ ] **Site:** com `publico.siteUrl`, o bloco `site` é o link "Experimente: <url>" / "Try it: <url>"; sem, "No ar em breve." / "Coming soon.".
- [ ] **Em dia:** `evals/det/publico/readme.eval.ts` roda o gerador em memória e falha se o resultado for diferente dos arquivos, com a mensagem "README desatualizado: rode npm run readme". Uma ADR nova ou uma rodada nova no histórico sem `npm run readme` deixa o `eval:det` vermelho.
- [ ] **Prints:** `.docs/prints/` tem os arquivos de "Contratos › Prints", em `.webp`, cada um com até 250 KB, todos citados nos dois READMEs com `alt` descritivo; o painel do Grafana (`painel.webp`) entra no fechamento.
- [ ] **Sem segredo nem referência local:** nenhum README cita e-mail, URL de banco, token, `.local/` ou nome de pasta de referência (o eval procura `@`, `postgres://`, `.local` e os nomes de `.local/REFERENCIAS.md` quando o arquivo existe).

### Geral

- [ ] axe sem violação na Entrada (rolada até o fim) e em `/sobre`, nos dois temas, em `celular` e `desktop`; Bastidores continua sem violação com o rodapé novo.
- [ ] Zoom de 200% sem rolagem horizontal na Entrada e em `/sobre` (E2E com `viewport` de 640 px e `deviceScaleFactor` 2).
- [ ] Smoke da 022: `GET /sobre` → `200` com "Privacidade" e "Não é orientação médica".
- [ ] `CONTATO_PRIVACIDADE` no catálogo de variáveis como `obrigatoria` em produção: `env:producao` falha sem ela.
- [ ] Gates verdes: lint, typecheck, `npm test`, `eval:det`, `dup`, build, E2E e o teste de arquitetura.

## O que fazer

- Usar as skills `frontend-design` e `web-design-guidelines` na Entrada e no Sobre. A Entrada rolada tem que parecer a continuação da primeira dobra, não um site de modelo.
- Escrever primeiro as funções puras com teste: `contatoDePrivacidade`, `blocosDoReadme`, `aplicarBlocos`, `prazosDaPolitica`, `linksPublicos`; depois as páginas.
- Reaproveitar os componentes da 018 na conversa de exemplo (com a prop `exemplo`) e o `estadoDaEntrada` e as ações da 017 na chamada final.
- Ler os prazos e durações da configuração; o texto da política tem só marcadores.
- Ao mudar qualquer parte de `textosSobre.privacidade`, mudar `atualizadaEm` junto (está em "O que não fazer" do `AGENTS.md`, por esta spec).
- Escrever o README em português primeiro; o inglês é tradução fiel, no mesmo tom (conteudo).
- Atualizar docs, `AGENTS.md` (comandos e status), `DEPLOY.md` e escrever a ADR no fechamento.

## O que não fazer

- Não mudar a primeira dobra da Entrada nem o cartão além do aviso.
- Não pôr o e-mail de contato, nem nenhum outro e-mail, no repositório: só a variável.
- Não escrever número de eval, prazo de retenção ou duração no texto à mão.
- Não usar imagem de banco de imagens, foto de pessoa ou ilustração nova: a landing usa a ilustração da Entrada, as manchas dos doshas e os componentes da conversa.
- Não pôr script de terceiros (analytics, fonte remota, embed): a CSP da 017 continua igual.
- Não prometer no texto o que o produto não faz (ex.: "criptografia de ponta a ponta", "seus dados nunca saem do Brasil").
- Não rodar `npm run prints` na CI nem nos gates.
- Não mexer em `data/`.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Landing | Seções abaixo do cartão da Entrada; primeira dobra intacta (dona) | Quem já sabe o que quer entra em dois toques; quem não sabe rola |
| Contato LGPD | E-mail em `CONTATO_PRIVACIDADE`, obrigatória em produção (dona) | A LGPD pede um canal; o e-mail fica fora do repositório público |
| README | `README.md` em português, `README.en.md` em inglês (dona) | O produto é em português; o inglês abre o portfólio |
| Assinatura | Helena Marques Batista, GitHub e LinkedIn (dona) | Autoria clara no Sobre e no README |
| Idade | "Para maiores de 18 anos." no aviso da Entrada e na política | Exigência dos termos adicionais da API do Gemini |
| Onde fica a política | Seção `#privacidade` do Sobre, não página própria | `BUSINESS.md` §7 põe privacidade no Sobre; um link só para todos os lugares |
| Texto da política | Em `config/textos-sobre.ts`, com os prazos interpolados da configuração | Muda junto com o código; teste garante que não diverge |
| Conversa de exemplo | Componentes reais da 018, conteúdo fixo, nomes vindos da base | Mostra a cara real do produto sem chamar modelo |
| Blocos do README | Gerados por `npm run readme`, conferidos no `eval:det` | Uma fonte só para os números e as ADRs, como Bastidores |
| Prints | Playwright no modo e2e, com o runtime roteirizado, em `.webp` | Reproduzíveis sem chave e sem banco; leves no repositório |
| Indexação | Só as três páginas públicas; o resto com `noindex` | Telas de conta não têm o que fazer num buscador |
| Licença | MIT no código; `data/` com todos os direitos reservados (dona escolheu MIT; a base, por recomendação) | MIT é o que quem avalia o projeto reconhece; a base é o ativo ligado a planos futuros |

## Contratos

### Cria

**Configuração (`config/publico.ts`, incluída em `config/index.ts` como `publico`)**

```ts
export const publico = {
  siteUrl: null as string | null,           // a dona preenche depois do primeiro deploy (DEPLOY.md); ex.: "https://ritu.vercel.app"
  repositorio: "https://github.com/hmarquesb/ritu",
  autoria: {
    nome: "Helena Marques Batista",
    github: "https://github.com/hmarquesb",
    linkedin: "https://www.linkedin.com/in/hmarquesb",
  },
  idadeMinima: 18,
} as const
```

`siteUrl`, quando preenchida, é `https://` e sem barra final (teste).

**Variável de ambiente**

| Variável | `producao` | Descrição (catálogo e `.env.example`) |
|---|---|---|
| `CONTATO_PRIVACIDADE` | obrigatoria | E-mail mostrado na política de privacidade. Nova, entrega 4, não obrigatória fora de produção |

**Contato (`src/core/publico/contato.ts`)**

```ts
export function contatoDePrivacidade(valor: string | undefined): string | null
// apara espaços; e-mail válido pelo z.email() → o e-mail; vazio, ausente ou inválido → null. Nunca loga o valor.
```

A página lê `process.env.CONTATO_PRIVACIDADE` pelo `env` da 001 (nunca `process.env` direto fora de `src/infra/env`).

**Prazos da política (`src/core/publico/prazos.ts`)**

```ts
export type PrazosDaPolitica = {
  mensagensDias: number          // config/memoria.ts
  faltasDias: number             // config/memoria.ts
  retornosDias: number           // config/memoria.ts
  demonstracaoHoras: number      // 017
  sessaoDias: number             // 017 (maxAge do JWT)
  temaDias: number               // 016 (config.ui.theme.maxAgeDays)
}
export function prazosDaPolitica(): PrazosDaPolitica
export function preencher(texto: string, valores: Record<string, string | number>): string
// troca {chave}; chave sem valor → lança RituError("texto_sem_valor") (teste com todos os textos de textosSobre)
```

**Textos da landing (`config/textos-landing.ts`, incluídos como `textosLanding`)**

| Chave | Texto |
|---|---|
| `conheca` | Conheça o Ritu |
| `como.titulo` | Como funciona |
| `como.1.titulo` · `.texto` | Conte como você está · Do seu jeito: "acordei com frio e agitada", "comi demais no almoço", "fui à feira e trouxe abóbora". |
| `como.2.titulo` · `.texto` | O Ritu junta o que importa · Seu dosha, o clima de agora na sua cidade, o que você tem em casa e o que já funcionou para você. |
| `como.3.titulo` · `.texto` | Você recebe o que fazer agora · Um chá, uma refeição simples, um óleo ou uma prática, com o porquê em poucas palavras. |
| `exemplo.titulo` | Uma conversa de exemplo |
| `exemplo.nota` | Do perfil de demonstração: Vata-Pitta, no Rio, com gengibre, canela, abóbora e arroz em casa. |
| `exemplo.pessoa` | acordei com frio e agitada, o que eu como? |
| `exemplo.agente` | Frio e agitação pedem o contrário: calor, peso e calma.<br><br>Para agora, um chá de gengibre com canela, morno, tomado devagar. No café, um mingau de arroz com abóbora e uma pitada de canela: quente, macio e levemente doce, ele assenta sem pesar.<br><br>Se der, antes de começar o dia, cinco minutos de respiração lenta. |
| `exemplo.aviso` | Não é orientação médica. |
| `faz.titulo` | O que ele faz |
| `faz.itens` | Explica o porquê de cada sugestão. · Troca um ingrediente que você não tem ou não gosta. · Lembra do que funcionou e do que você não come. · Avisa o que vale ter em casa para as próximas vezes. · Só anota algo sobre você com a sua aprovação. |
| `naoFaz.titulo` | O que ele não faz |
| `naoFaz.itens` | Não orienta sobre doença, gestação ou remédio. · Não usa a localização do seu aparelho: o clima vem da cidade que você escolhe. · Não manda notificações nem e-mails. · Não indica marca, loja nem preço. |
| `dentro.titulo` | Por dentro |
| `dentro.texto` | O Ritu é um projeto de estudo de agentes de IA. Cada resposta consulta uma base ayurvédica com fontes, confere o próprio trabalho e passa por um juiz antes de chegar a você. Tudo isso é medido, e os números são públicos. |
| `dentro.bastidores` · `.mcp` · `.codigo` | Ver os bastidores · Usar a base no seu agente (MCP) · Ver o código no GitHub |
| `final.titulo` | Quer ver com os seus olhos? |
| `final.texto` | A demonstração já vem com casa, gostos e conversa. Sem cadastro, em dois toques. |
| `rodape.sobre` · `.bastidores` · `.codigo` | Sobre e privacidade · Bastidores · Código no GitHub |
| `rodape.assinatura` | Projeto de estudo de {nome}. Não é orientação médica. |
| `novaAba` | (abre em nova aba) |

`<br><br>` marca parágrafo (a `FalaDoAgente` separa por linha em branco).

**Conversa de exemplo (`config/textos-landing.ts`, `exemploDaLanding`)**

```ts
export const exemploDaLanding = {
  sugestoes: [
    { tipo: "pratica", id: "cha-gengibre-canela" },
    { tipo: "preparo", id: "mingau", ingredientes: ["arroz", "abobora", "canela"] },
    { tipo: "pratica", id: "respiracao-lenta" },
  ],
} as const
```

Os ids de alimento são os da base (o teste confere `kb.alimento(id)` e corrige a grafia aqui se o id real for outro). `BlocoDeSugestao` (018) ganha `exemplo?: boolean`: sem menu do ingrediente (os ingredientes viram `Tag` parada), sem verbos, sem "Por quê?", sem 👍/👎; título, ícone do tipo e "como fazer" da base continuam.

**Textos do Sobre (`config/textos-sobre.ts`, incluídos como `textosSobre`)**

| Chave | Texto |
|---|---|
| `titulo` | Sobre o Ritu |
| `indice` | Nesta página |
| `projeto.titulo` | O projeto |
| `projeto.texto` | O Ritu é um agente ayurvédico para o dia a dia. Você conta como está e ele sugere o que fazer agora com o que você tem em casa e com o clima da sua cidade.<br><br>É um projeto de estudo: mostra como construir um agente de IA que consulta uma base com fontes, pergunta quando falta algo, pede aprovação antes de anotar, confere o próprio trabalho e é medido. Não é um produto comercial e não vende nada. |
| `autoria.titulo` | Quem fez |
| `autoria.texto` | Feito por {nome}. |
| `autoria.github` · `.linkedin` | GitHub · LinkedIn |
| `feito.titulo` | Como foi feito |
| `feito.texto` | Next.js, TypeScript e Postgres. Modelos Gemini escolhidos por papel, com troca automática quando a cota de um acaba. Evals a cada etapa da construção, com os resultados registrados. As decisões de arquitetura estão no repositório, e os números do agente, em Bastidores. |
| `feito.licenca` | O código está sob a licença MIT. A base ayurvédica tem todos os direitos reservados. |
| `feito.links` | Ver o código · Ver as decisões (ADRs) · Ver os bastidores |
| `fontes.titulo` | Fontes e créditos |
| `fontes.texto` | Cada linha da base ayurvédica cita a sua fonte; a lista completa está no repositório. O clima vem da Open-Meteo, sob a licença CC BY 4.0. Ícones: Phosphor (MIT). Fontes tipográficas: Cormorant Garamond e Figtree (SIL Open Font License). |
| `fontes.links` | Ver as fontes da base · Open-Meteo |
| `cuidados.titulo` | Cuidados |
| `cuidados.texto` | O Ritu sugere conforto com alimentos, ervas de cozinha, óleos comuns e práticas leves. Ele não diagnostica, não trata e não substitui um profissional de saúde. |
| `cuidados.alerta` | (texto fixo do sinal de alerta, `BUSINESS.md` §12, o mesmo do agente) |
| `cuidados.emocional` | (texto fixo do sofrimento emocional, `BUSINESS.md` §12, o mesmo do agente) |
| `privacidade.titulo` | Privacidade |
| `privacidade.atualizadaEm` | data ISO do dia em que a construção desta spec termina; mostrada como "Atualizada em 1 de dezembro de 2026." |
| `privacidade.intro` | Esta é a política de privacidade do Ritu. Ela diz o que eu guardo, por quanto tempo, com quem os dados passam e como você vê e apaga tudo. |

Partes de `privacidade` (cada uma com `h3`; listas com `ul`):

| Chave | Título | Texto |
|---|---|---|
| `quem` | Quem cuida dos seus dados | {nome}, que mantém o Ritu como projeto pessoal de estudo. Para pedidos sobre seus dados, escreva para {email}. |
| `semContato` | (substitui a segunda frase de `quem` sem a variável) | Para ver, corrigir ou apagar seus dados, use a aba Você, dentro do Ritu. |
| `guardo` | O que eu guardo | Da conta Google: um identificador e o e-mail, que serve só para entrar. Ele não aparece na tela, não vai para a IA e não recebe mensagens. · Seu perfil: dosha, a cidade que você escolheu (nome e coordenadas aproximadas), o que você evita sempre, restrições e o que você não come. · Sua casa, seus gostos e como ficaram as sugestões. · O que fez falta, por {faltasDias} dias. · Notas sobre a sua rotina e padrões, só os que você aprovou. · As mensagens da conversa, por {mensagensDias} dias. As que falam de um incômodo ou de um sinal de alerta, só até o dia seguinte. · Um registro de cada resposta: o que o Ritu consultou, quanto tempo levou e o que o juiz disse. Ele serve para conferir e medir o agente. |
| `naoGuardo` | O que eu não guardo | Telefone, foto ou nome da conta Google, nem a localização do seu aparelho. · O seu endereço IP. Para contar os limites de uso, guardo um código calculado a partir dele, que não permite voltar ao IP. · Nada de propaganda nem de rastreamento de outras empresas. |
| `tempo` | Por quanto tempo | Na demonstração, tudo some em {demonstracaoHoras} horas. Com a conta Google, até você apagar, fora os prazos acima. Retornos que ficaram sem resposta somem em {retornosDias} dias.<br><br>Quando você apaga seus dados, a conta e tudo dela somem na hora. Os registros das respostas ficam sem ligação com você e sem nenhum texto, só para os números agregados de Bastidores. |
| `passa` | Com quem os dados passam | Google, para você entrar com a sua conta. · Gemini, do Google: suas mensagens e o que ajuda a responder (dosha, casa, gostos, rotina, clima) vão para o modelo de IA. O Ritu usa o plano gratuito. Nele, o Google pode usar esse conteúdo para melhorar os produtos dele, e pessoas revisoras podem lê-lo. Não escreva nada que você não queira que outra pessoa leia. Esses dados podem ser processados fora do Brasil. · Open-Meteo: recebe o nome da cidade buscada e as coordenadas, sem nada que identifique você. · Vercel (hospedagem) e Neon (banco de dados), em São Paulo. · Grafana Cloud: recebe números de funcionamento, como tempo e contagens, nunca texto seu. |
| `cookies` | Cookies | Dois, os dois necessários: o da sessão, que mantém você conectada por até {sessaoDias} dias, e o do tema, que lembra se você prefere claro ou escuro por {temaDias} dias. Nenhum de propaganda ou de análise. |
| `direitos` | Seus direitos | Pela LGPD, você pode ver, corrigir e apagar seus dados. No Ritu: "O que sei sobre você" mostra tudo o que ele guarda; cada item pode ser corrigido ou apagado; "Apagar meus dados" apaga tudo de uma vez. Para outros pedidos, como uma cópia dos seus dados, use o contato acima. |
| `idade` | Idade | O Ritu é para maiores de {idadeMinima} anos. |
| `mudancas` | Mudanças | Se esta política mudar, a data no topo muda junto. |

`{nome}` vem de `publico.autoria.nome`; `{email}` de `contatoDePrivacidade`; os prazos de `prazosDaPolitica()`; `{idadeMinima}` de `publico`. Os itens separados por " · " são itens de lista.

**Mudanças em textos de outras specs**

| Chave | Antes | Depois |
|---|---|---|
| `entrada.aviso` (017) | Projeto de estudo. Não é orientação médica. | Projeto de estudo. Não é orientação médica. Para maiores de 18 anos. |
| `avisoInicial.politica` (017, nova) | — | Leia a política de privacidade |
| `conta.sobre` (020, nova) | — | Sobre o Ritu e privacidade |

**Páginas e componentes**

| Arquivo | Exporta | O que é |
|---|---|---|
| `src/app/page.tsx` (017) | — | Sem conta válida: a primeira dobra (017) e, abaixo, `<LandingSecoes estado={...} />` e `RodapePublico` |
| `src/components/ritu/landing/secoes.tsx` | `LandingSecoes({ estado })` | `div#conheca` com as seções. Coluna de até 64rem; Como funciona em três colunas a partir de 48rem; Faz e Não faz lado a lado a partir de 48rem |
| `src/components/ritu/landing/como-funciona.tsx` | `ComoFunciona()` | `ol` com os três passos; número em Cormorant Garamond `text-display` `primary`, título em `h3` |
| `src/components/ritu/landing/exemplo.tsx` | `ConversaDeExemplo()` | Componente de servidor; lê a base para os nomes; `Surface tone="surface" radius="lg"` com borda `line`, largura `prose`; `FalaDaPessoa`, `FalaDoAgente`, três `BlocoDeSugestao exemplo`, aviso e nota em `ink-muted`. Sem `role="log"`: é um `figure` com `figcaption` = `exemplo.nota` |
| `src/components/ritu/landing/faz-nao-faz.tsx` | `FazENaoFaz()` | Duas listas; ícone `Check` e `Prohibit` (Phosphor `light`) por item, decorativos; os títulos dizem o sentido, não a cor |
| `src/components/ritu/landing/por-dentro.tsx` | `PorDentro()` | Texto e três links com ícone (`ChartLine`, `Plugs`, `GithubLogo`) |
| `src/components/ritu/landing/chamada-final.tsx` | `ChamadaFinal({ estado })` | `Surface tone="paper" radius="card"` com as três manchas dos doshas (016) pequenas no canto, título, texto e o botão de `estadoDaEntrada` |
| `src/components/ritu/publico/rodape.tsx` | `RodapePublico({ atual? })` | O rodapé público |
| `src/components/ritu/publico/cabecalho.tsx` | `CabecalhoPublico()` | `header` com o logo como link para `/`; usado por Sobre e Bastidores (troca o da 023) |
| `src/app/sobre/page.tsx` | — | A página |
| `src/components/ritu/sobre/` | `IndiceDoSobre`, `SecaoDoSobre`, `Politica` | Índice, seção com `h2` e `aria-labelledby`, a política com as nove partes |
| `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/marca/og.jpg` | — | Indexação e ícones |

**Desenho (para as skills de tela)**

- **Assinatura da landing: o papel continua.** As seções ficam sobre o mesmo `canvas` com a textura de papel da 016; entre a primeira dobra e "Como funciona", uma linha de 1px em `line` com a mancha do Vata pequena no meio, como um selo. Nenhum fundo novo, nenhum gradiente.
- Títulos das seções em Cormorant Garamond `text-title`; textos em Figtree na largura `prose`. Espaço vertical generoso (`space-12` entre seções no desktop, `space-8` no celular).
- A conversa de exemplo é o ponto alto da página: centrada, com sombra `soft`, e é o único bloco com superfície elevada.
- Animação: as seções sobem com `rise` (016) ao entrar na tela, uma vez; nada com movimento reduzido.
- Sobre: leitura longa; coluna `prose`, índice à esquerda no desktop; `h3` da política em Figtree 600 `text-lg`; listas com marcador discreto em `ink-muted`.

**Gerador do README (`scripts/readme.ts`, `scripts/lib/readme/`)**

```ts
export type Idioma = "pt" | "en"
export type Blocos = { site: string; numeros: string; adrs: string }
export function blocosDoReadme(p: { historico: Historico; adrs: { numero: string; arquivo: string; titulo: string }[]; siteUrl: string | null; idioma: Idioma }): Blocos
export function aplicarBlocos(readme: string, blocos: Blocos): string
// troca o conteúdo entre <!-- ritu:<bloco> --> e <!-- /ritu:<bloco> -->; marcador ausente ou repetido → lança RituError("readme_sem_marcador", { bloco })
export function lerAdrs(pasta: string): { numero: string; arquivo: string; titulo: string }[]
// arquivos NNNN-*.md (fora README.md e _template.md); título = linha "# " sem o prefixo "NNNN. " se houver
```

- `numeros`: tabela Markdown "Métrica | {primeiro} | {último} | Meta" (inglês: "Metric | … | Target"); rótulos de `textosBastidores.metricas` em português e de `config/readme.ts` (`rotulosEn`, um por métrica de `bastidores.destaques`) em inglês; depois, a linha "{n} checkpoints, de {data} a {data}. Todos os números em [evals/COMPARACAO.md](evals/COMPARACAO.md) e em Bastidores." (inglês equivalente). Com um checkpoint só, as colunas primeiro e último são a mesma, e fica uma coluna.
- `adrs`: lista "- [NNNN](.adrs/<arquivo>) Título".
- `npm run readme`: lê `historico.json` (023, `src/core/evals/historico.ts`), `.adrs/` e `publico.siteUrl`, e grava os dois arquivos. Sem rede, sem chave, sem banco.

**README: seções** (português; o inglês segue a mesma ordem)

1. `# Ritu`, o link "Read in English" e uma frase: o que é.
2. Print da conversa (`conversa-celular.webp` e `conversa-desktop.webp` lado a lado, numa tabela de duas colunas).
3. Bloco `site`.
4. **O que ele faz:** cinco itens, os mesmos de `faz.itens`, e a linha do que não faz.
5. **Como funciona por dentro:** diagrama Mermaid de um run (guardrail → Intérprete → caminho por intenção → Acompanhante com tools, pausa e `finalizar` com validador → Juiz → resposta e bloco de aprovação) e três frases sobre memória em níveis, modelos por papel e "ler é livre, escrever é proposto", com links para as ADRs 0006, 0008, 0012, 0013 e 0014.
6. **Números:** bloco `numeros` e o print de Bastidores.
7. **Telas:** os prints de Minha casa, Como pensei e Você.
8. **Observabilidade:** uma frase e o print do painel.
9. **Use a base no seu agente:** o endereço `/api/mcp` no site, as seis tools em uma linha e o link para `/bastidores#mcp`.
10. **Como foi construído:** specs → planos → orquestrador e subagentes, com portões humanos; links para `.docs/RULES.md`, `.specs/` e a ADR 0021.
11. **Decisões:** bloco `adrs`.
12. **Como rodar:** a seção atual, revisada para os comandos de hoje.
13. **Privacidade e cuidados:** uma frase e o link para `/sobre#privacidade` (ou "a tela Sobre", sem `siteUrl`); "Projeto de estudo. Não é orientação médica."
14. **Autoria:** nome, GitHub e LinkedIn.
15. **Licença:** código sob MIT ([`LICENSE`](LICENSE)); a base em `data/` com todos os direitos reservados ([`data/LICENSE.md`](data/LICENSE.md)).

**Prints (`scripts/prints.ts`, `npm run prints`)**

- Sobe o build com `RITU_MODO=e2e` (como o `webServer` do Playwright) e usa `entrarNaDemo` (017) e o runtime roteirizado do cenário da mensagem sugerida.
- Tema claro, salvo onde dito. Celular: 390×844; desktop: 1280×800; `deviceScaleFactor: 2`. PNG do Playwright convertido para WebP (sharp, qualidade 80, até 1600 px de largura); acima de 250 KB, a qualidade desce de 5 em 5 até caber ou o script falha.

| Arquivo | Tela | Tamanho |
|---|---|---|
| `entrada-desktop.webp` | Entrada, primeira dobra | desktop |
| `conversa-celular.webp` | Conversa com a resposta, as sugestões e o bloco de aprovação | celular |
| `conversa-desktop.webp` | O mesmo | desktop |
| `casa-celular.webp` | Minha casa com "Ainda tem?" | celular |
| `como-pensei-celular.webp` | Como pensei do run da resposta | celular |
| `voce-celular-escuro.webp` | Você, com a carta do dosha, tema escuro | celular |
| `bastidores-desktop.webp` | Bastidores com os gráficos (fake acima do piso) | desktop |
| `painel.webp` | Painel do Grafana (fechamento, como na 015) | — |

**Smoke (022, acréscimo):** checagem `sobre`: `GET /sobre` → `200`, contém "Privacidade" e "Não é orientação médica".

**Scripts (`package.json`)**

| Comando | Faz |
|---|---|
| `npm run readme` | Refaz os blocos gerados dos dois READMEs |
| `npm run prints` | Gera os prints de `.docs/prints/` (precisa do build e do Chromium do Playwright; fora da CI) |
| `npm run marca:og` | Gera `public/marca/og.jpg` e `src/app/apple-icon.png` a partir de `design/` |

### Usa

- **016:** tokens, `Surface`, `TextLink`, `Button`, `StateBlock`, `Logo`, `DoshaBlot`, `rise`, tema e `maxAgeDays` do cookie.
- **017:** `estadoDaEntrada`, as ações da demonstração e do Google, layout e textos da Entrada, Aviso inicial, `maxAge` da sessão, duração da demonstração, CSP com nonce, modo e2e, `entrarNaDemo`.
- **018:** `FalaDaPessoa`, `FalaDoAgente`, `BlocoDeSugestao`.
- **020:** `Conta` em Você.
- **022:** catálogo de variáveis, `env:producao`, smoke, `DEPLOY.md`.
- **023:** `bastidores.destaques`, `formatarMetrica`, `textosBastidores`, `src/core/evals/historico.ts`, página de Bastidores (cabeçalho e rodapé trocados, `id="mcp"`).
- **004:** `config/memoria.ts` (prazos).
- **013/BUSINESS §12:** textos fixos de alerta e de sofrimento emocional.

## Evals (quando a spec toca agente, prompt, tool ou base)

Nenhum caso com LLM novo: a spec não muda agente, prompt nem base. Determinísticos novos:

- `evals/det/publico/readme.eval.ts`: README em dia nos dois idiomas; marcadores presentes uma vez; nenhum e-mail, URL de banco, token, `.local` ou referência local.
- `evals/det/publico/politica.eval.ts`: todo marcador dos textos do Sobre tem valor; os prazos batem com a configuração; o texto de alerta e o emocional são os mesmos do agente; a página renderizada sem a variável não tem `mailto:`; a conversa de exemplo cita os nomes da base das três sugestões.
- `evals/det/mapa.ts` (014): entradas novas com `desde: 4`.

E2E (`e2e/publico.spec.ts`, celular e desktop, modo e2e): Entrada rolada até o fim; "Conheça o Ritu" leva o foco ao `h2`; a chamada final abre a demonstração até o Aviso; links do rodapé; `/sobre` sem sessão e com a demonstração; `/sobre#privacidade` com o `h2` visível; sem `mailto:`; link do Aviso inicial até a política e de volta ao Aviso; link em Você › Conta; `robots.txt` e `sitemap.xml` respondem; axe nos dois temas; zoom de 200%; só com teclado.

## Nível das partes

- **tela** (Sonnet): `src/components/ritu/landing/`, `src/components/ritu/publico/`, `src/components/ritu/sobre/`, `src/app/sobre/page.tsx`, a parte da landing em `src/app/page.tsx`, a prop `exemplo` do `BlocoDeSugestao`, os links no Aviso e em Conta, `icon.svg`, `e2e/publico.spec.ts`, com `frontend-design` e `web-design-guidelines`.
- **conteudo** (Opus): o texto dos dois READMEs (o português primeiro; o inglês como tradução fiel) e `rotulosEn`. Os textos da landing e do Sobre já estão nesta spec e entram como estão.
- Todo o resto é `mecanica` (Haiku): configuração, textos, `contatoDePrivacidade`, prazos, gerador do README, prints, `marca:og`, robots, sitemap, metadados, smoke, catálogo de variáveis, evals determinísticos.

## Leitura para a construção

- `DESIGN.md` §1 "Sensação" e §3 "Regras" (com "Acessibilidade").
- `.specs/016-design-system.md` "Contratos": tokens, componentes base, `DoshaBlot`, `rise`.
- `.specs/017-entrada-e-contas.md` "Textos" e "Entrada: layout"; "Modo de E2E".
- `.specs/018-tela-conversa.md`: a linha de `fala.tsx` e de `sugestao.tsx` na tabela de componentes.
- `.specs/023-bastidores-e-mcp.md` "Configuração", "Textos" e "Página".
- `.specs/022-producao.md`: o catálogo de variáveis e o passo de `DEPLOY.md` sobre a URL final.
- `BUSINESS.md` §12 (textos fixos) e §14 (privacidade).
- `RULES.md` §5: a regra das referências locais.

## Dependências

- Specs 004, 016, 017, 018, 020, 022 e 023.
- `sharp` e `@playwright/test`, já instalados (sem pacote novo).
- Termos adicionais da API do Gemini (idade mínima e uso no plano gratuito).

## Riscos e trade-offs

- **Política escrita por quem constrói:** não é revisada por advogado. Aceito para um projeto de estudo; o texto diz só o que o código faz, e o teste amarra os prazos.
- **E-mail público na página:** quem visitar vê o e-mail de contato. É o preço de um canal LGPD; fica fora do repositório.
- **README que depende de um comando:** quem esquecer `npm run readme` vê o `eval:det` vermelho. É o objetivo: o README nunca mente sobre os números.
- **Prints envelhecem:** mudam quando a tela muda. `npm run prints` refaz tudo; o fechamento de cada spec de tela posterior deve rodar.
- **Landing longa no celular:** cinco seções a mais. A primeira dobra continua sendo o caminho da demonstração; o resto é para quem quer.
- **MIT não volta atrás:** se o repositório ficar privado depois, quem já clonou mantém o código sob MIT. A base fica fora da MIT justamente por isso.

## Edge cases e modos de falha

- `CONTATO_PRIVACIDADE` com espaços ou maiúsculas: aparada; e-mail inválido conta como ausente (e `env:producao` falha antes do deploy).
- `publico.siteUrl` nulo: sem `metadataBase` (Open Graph com caminho relativo), sem `Sitemap` no `robots.txt`, sitemap vazio, README com "No ar em breve.".
- `historico.json` com zero checkpoints: bloco `numeros` com "Nenhum checkpoint rodado ainda." / "No checkpoint run yet."; inválido: `npm run readme` falha sem tocar nos arquivos.
- ADR sem linha `# `: o gerador falha com o nome do arquivo.
- Id da conversa de exemplo removido da base: o eval da política falha; a página não quebra em produção porque o build roda o `eval:det` antes (CI).
- Demonstração indisponível (teto global): a chamada final mostra o Google ou só o texto, igual ao cartão.
- Visitante com o cookie de demonstração vencida: vê a Entrada com o aviso da 017 e as seções novas.
- JavaScript desligado: a landing e o Sobre funcionam (só HTML e CSS; os botões são formulários de servidor); `rise` não acontece.
- Tela muito larga (acima de 1600 px): a coluna das seções continua em 64rem, centrada.

## Resultado (definição de pronto)

- Entrada, `/sobre`, rodapé, metadados, `robots.txt` e `sitemap.xml` no ar em produção, com o smoke verde.
- Os dois READMEs com os prints e os blocos gerados; `eval:det` verde.
- Os critérios de aceite passam nos gates; ADR escrita; docs vivos atualizados.
- **Fechamento da entrega 4, na ordem:** (1) a dona preenche `publico.siteUrl` e `CONTATO_PRIVACIDADE` (`DEPLOY.md`); (2) rodada ⚠️ `npm run eval:llm -- --checkpoint c5-publico`; (3) `npm run readme`; (4) `npm run prints` e o print do painel; (5) commit, deploy pela CI e relatório do portão 4 com os prints.

## Arquivos e diretórios envolvidos

- `config/publico.ts`, `config/textos-landing.ts`, `config/textos-sobre.ts`, `config/readme.ts`, `config/index.ts`; textos da 017 e da 020
- `src/core/publico/` (`contato.ts`, `prazos.ts` e testes)
- `src/app/page.tsx`, `src/app/layout.tsx` (metadados), `src/app/sobre/page.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/bastidores/page.tsx`, `src/app/(comecar)/` e `src/app/(app)/` (`noindex`; link no Aviso)
- `src/components/ritu/landing/`, `src/components/ritu/publico/`, `src/components/ritu/sobre/`, `src/components/ritu/conversa/sugestao.tsx`, `src/components/ritu/voce/conta.tsx`, `src/components/ritu/bastidores/` (`id="mcp"`)
- `public/marca/og.jpg`
- `scripts/readme.ts`, `scripts/lib/readme/`, `scripts/prints.ts`, `scripts/marca-og.ts`, `scripts/lib/smoke.ts`, `package.json`
- Catálogo de variáveis (022), `.env.example`
- `README.md`, `README.en.md`, `.docs/prints/`; `LICENSE` e `data/LICENSE.md` (já existem; só citados)
- `evals/det/publico/`, `evals/det/mapa.ts`, `e2e/publico.spec.ts`, teste de arquitetura
- `.adrs/` (uma nova: "Páginas públicas e README a partir das fontes de verdade": política com prazos da configuração, blocos do README gerados e conferidos, prints por script), `.adrs/README.md`
- `.docs/BUSINESS.md` (§7 Entrada com as seções e Sobre com a política; §14 idade mínima e contato), `.docs/ARCHITECTURE.md` (§1 rotas `/sobre`, `robots.txt`, `sitemap.xml`; §7 pastas), `.docs/DATA-SOURCES.md` (atribuição da Open-Meteo no Sobre), `.docs/QA.md` (evals e E2E públicos), `.docs/DEVELOPMENT.md` (`CONTATO_PRIVACIDADE`), `DEPLOY.md` (passo de `siteUrl` e `CONTATO_PRIVACIDADE`), `AGENTS.md` (comandos `readme`, `prints`, `marca:og`; status; regra de `atualizadaEm`), `.specs/README.md`
