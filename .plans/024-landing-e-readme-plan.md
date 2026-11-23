# Plano · 024 Landing, Sobre e README

Spec: `.specs/024-landing-e-readme.md`. Entrega 4, na `main`. Nos campos `contratos`, "spec 024 › X" aponta uma seção da spec que o subagente lê e copia por extenso. Nenhuma tarefa abre outro trecho da spec.

### T1 · Add the public config and the landing, Sobre and README texts
- nivel: mecanica
- objetivo: `config/publico.ts`, `config/textos-landing.ts` (`textosLanding`, `exemploDaLanding`), `config/textos-sobre.ts` (`textosSobre`), `config/readme.ts` (`rotulosEn`) incluídos em `config/index.ts`; textos mudados da 017 e da 020.
- arquivos: `config/publico.ts`, `config/textos-landing.ts`, `config/textos-sobre.ts`, `config/readme.ts`, `config/index.ts`, `config/index.test.ts`, `config/textos-entrada.ts` (`entrada.aviso` e `avisoInicial.politica`), `config/textos-voce.ts` (`conta.sobre`), e os testes e E2E que travam o texto antigo de `entrada.aviso` (procure com grep por "Projeto de estudo. Não é orientação médica.")
- depende de: nenhuma
- leitura: spec 024 › Contratos › "Configuração", "Textos da landing", "Conversa de exemplo", "Textos do Sobre" (com as partes de `privacidade`) e "Mudanças em textos de outras specs"; em "Gerador do README", o item `numeros` (o que é `rotulosEn`)
- skills: nenhuma
- contratos: os textos da spec, por extenso e sem mudar uma palavra. Itens separados por " · " viram arrays. `<br><br>` vira parágrafo, no formato que a `FalaDoAgente` já separa (linha em branco: confira em `src/components/ritu/conversa/fala.tsx`). Os marcadores `{chave}` ficam no texto. `cuidados.alerta` e `cuidados.emocional` não são copiados: referenciam os textos fixos que o agente usa (procure em `config/` ou `src/core/` o texto de alerta e o de sofrimento emocional, `BUSINESS.md` §12) e reexportam a mesma string. `privacidade.atualizadaEm` = `"2026-11-23"`. `rotulosEn`: um rótulo curto em inglês por métrica de `bastidores.destaques` (`config/bastidores.ts`), equivalente ao de `textosBastidores.metricas`. Ids de `exemploDaLanding` conferidos na base (`data/`). Se um id não existir, use o id real da mesma coisa e anote no relatório.
- testes primeiro: `siteUrl` nulo ou `https://` sem barra final; `exemploDaLanding` só com ids que existem na base; `entrada.aviso` com "Para maiores de 18 anos."; `cuidados.alerta` igual ao texto do agente.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run eval:det`
- pronto quando: testes verdes.
- fora: páginas e componentes.

### T2 · Add CONTATO_PRIVACIDADE and contatoDePrivacidade
- nivel: mecanica
- objetivo: variável nova no catálogo (obrigatória em produção) e no `.env.example`, e a função pura que a valida.
- arquivos: `src/infra/env.ts`, o teste dele, `.env.example`, `src/core/publico/contato.ts`, `src/core/publico/contato.test.ts`, os testes que travam a contagem ou a lista do catálogo (por exemplo o de `env:producao` e o de `env:check`)
- depende de: nenhuma
- leitura: spec 024 › Contratos › "Variável de ambiente" e "Contato"; critério "Contato" e o de `env:producao` em "Geral"; edge case de `CONTATO_PRIVACIDADE`
- skills: nenhuma
- contratos: `contatoDePrivacidade(valor: string | undefined): string | null`. Apara os espaços e valida com `z.email()`: válido, devolve o e-mail; vazio, ausente ou inválido, devolve `null`. Nunca loga o valor. No catálogo de `src/infra/env.ts`: `CONTATO_PRIVACIDADE`, `producao: "obrigatoria"`, entrega 4, não obrigatória fora de produção. Exporte também um leitor (`contatoPrivacidade()`, no estilo de `testers()`), que devolve o valor cru: `env.ts` não importa `contato.ts`, porque o teste "não lê process.env ao ser importado" acusaria o zod.
- testes primeiro: espaços e maiúsculas aparados; inválido → `null`; ausente → `null`; o catálogo marca a variável como obrigatória em produção; `env:producao` acusa a falta dela.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: a página do Sobre.

### T3 · Add prazosDaPolitica and preencher
- nivel: mecanica
- objetivo: prazos da política lidos da configuração e a interpolação dos marcadores, com o teste de coerência.
- arquivos: `src/core/publico/prazos.ts`, `src/core/publico/prazos.test.ts`
- depende de: T1
- leitura: spec 024 › Contratos › "Prazos da política"; critério "Coerência com o código"
- skills: nenhuma
- contratos: `PrazosDaPolitica` e as duas funções, por extenso da spec. `mensagensDias`, `faltasDias` e `retornosDias` vêm de `config/memoria.ts`. `demonstracaoHoras` vem da duração da demonstração (017: procure em `config/`). `sessaoDias` vem do `maxAge` da sessão (017). `temaDias` vem de `config.ui.theme.maxAgeDays`. Se algum desses prazos estiver fora de `config/` (por exemplo no código do Auth.js), mova só a constante para `config/` e anote no relatório. Isso vale como arquivo da tarefa: liste-o. `preencher` troca `{chave}`; chave sem valor lança `RituError("texto_sem_valor")`.
- testes primeiro: cada prazo igual ao da configuração; `preencher` com todos os textos de `textosSobre` e os valores completos não lança; marcador sem valor lança `texto_sem_valor`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: páginas.

### T4 · Write the README block generator
- nivel: mecanica
- objetivo: `blocosDoReadme`, `aplicarBlocos` e `lerAdrs`, puros e testados, e o script que grava os dois READMEs.
- arquivos: `scripts/lib/readme/` (`blocos.ts`, `aplicar.ts`, `adrs.ts` e testes, com um README de fixture), `scripts/readme.ts`
- depende de: T1
- leitura: spec 024 › Contratos › "Gerador do README" (inteiro); critérios "Blocos gerados", "Números", "ADRs" e "Site"; edge cases de `historico.json` e de ADR sem `# `
- skills: nenhuma
- contratos: os da spec, por extenso. O histórico vem de `src/core/evals/historico.ts`, a formatação de `formatarMetrica` e as métricas de `bastidores.destaques` (023: procure os nomes em `src/core/bastidores/`). Os marcadores são `<!-- ritu:<bloco> -->` e `<!-- /ritu:<bloco> -->`. `scripts/readme.ts` lê `evals/resultados/historico.json`, `.adrs/` e `publico.siteUrl`, e grava `README.md` e `README.en.md` só se os dois passarem. Com histórico inválido, falha sem tocar nos arquivos. Não mexa em `package.json`: o comando `npm run readme` entra na T7. Rode o script com `npx tsx scripts/readme.ts`.
- testes primeiro: o texto fora dos marcadores não muda (fixture); marcador ausente ou repetido lança `readme_sem_marcador` com o bloco; `numeros` com primeiro, último e meta, "—" para `null` e "⚠" abaixo da meta; um checkpoint só dá uma coluna; zero checkpoints dá "Nenhum checkpoint rodado ainda." / "No checkpoint run yet."; `adrs` em ordem, sem `README.md` e `_template.md`, com o título sem o prefixo "NNNN. "; ADR sem `# ` falha com o nome do arquivo; `site` com e sem `siteUrl`, nos dois idiomas; nota "ADRs are written in Portuguese." em inglês.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: o texto dos READMEs (T16) e o eval (T17).

### T5 · Generate the share image and the site icons
- nivel: mecanica
- objetivo: `scripts/marca-og.ts` (sharp) gera `public/marca/og.jpg` e `src/app/apple-icon.png`, e `src/app/icon.svg` é escrito à mão.
- arquivos: `scripts/marca-og.ts`, `public/marca/og.jpg`, `src/app/apple-icon.png`, `src/app/icon.svg`
- depende de: nenhuma
- leitura: spec 024 › Contratos, critérios "Imagem de compartilhamento" e "Ícone"
- skills: nenhuma
- contratos: `og.jpg` com 1200×630 e até 200 KB: recorte de `design/login-cover.jpeg` com o logo `full` (procure o SVG do logo em `design/` ou em `src/components/`) sobre um campo `canvas` à direita (a cor vem do token `canvas` de `src/components/tokens/tokens.css`, tema claro). `apple-icon.png` com 180×180, a marca sobre `canvas`. `icon.svg` é a marca do logo sem o nome, em `primary` sobre transparente. Não mexa em `package.json`: o comando `npm run marca:og` entra na T7. Rode com `npx tsx scripts/marca-og.ts` e versione as imagens geradas.
- testes primeiro: nenhum teste unitário. Confira com o sharp (`metadata`) as dimensões e o tamanho, e diga os números no relatório.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`
- pronto quando: as três imagens existem com as dimensões e o tamanho pedidos.
- fora: metadados do layout (T8).

### T6 · Write the prints script and generate the prints
- nivel: mecanica
- objetivo: `scripts/prints.ts` gera os prints de `.docs/prints/` em WebP, no modo e2e.
- arquivos: `scripts/prints.ts`, `.docs/prints/*.webp` (fora o `painel.webp`)
- depende de: T10, T11
- leitura: spec 024 › Contratos › "Prints" (inteiro); critério "Prints"
- skills: nenhuma
- contratos: os da spec, por extenso. Copie de `playwright.config.ts` o jeito de subir o servidor (`RITU_MODO=e2e`, `npm run start` sobre o build). Use `entrarNaDemo` (procure em `e2e/`) e a mensagem sugerida que o roteiro do modo e2e responde (procure em `e2e/roteiros/`). Para Bastidores acima do piso, use o header `x-ritu-e2e-bastidores: ok`. O script faz uma tentativa por arquivo e falha com o nome do arquivo que não coube em 250 KB. Não mexa em `package.json`: o comando `npm run prints` entra na T7. Rode uma vez com `npm run build && npx tsx scripts/prints.ts` e versione os `.webp`.
- testes primeiro: extraia para uma função pura testada a regra da qualidade: começa em 80 e desce de 5 em 5 até caber em 250 KB, ou falha.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: os sete `.webp` existem, cada um com até 250 KB.
- fora: CI e gates (o script não roda neles).

### T7 · Add the readme, prints and marca:og scripts to package.json
- nivel: mecanica
- objetivo: os três comandos no `package.json`.
- arquivos: `package.json`
- depende de: T4, T5, T6
- leitura: spec 024 › Contratos › "Scripts (`package.json`)"
- skills: nenhuma
- contratos: `"readme": "tsx scripts/readme.ts"`, `"prints": "tsx scripts/prints.ts"` e `"marca:og": "tsx scripts/marca-og.ts"`, no estilo dos scripts que já existem (confira se usam `tsx` ou `node --import`).
- testes primeiro: nenhum. Rode `npm run readme` e confira que nada mudou depois da T16, se ela já tiver commit.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`
- pronto quando: os três comandos rodam.
- fora: tudo o resto.

### T8 · Add the metadata, robots and sitemap
- nivel: mecanica
- objetivo: `metadata` raiz com Open Graph, `robots.ts`, `sitemap.ts` e `noindex` nas páginas de quem entrou.
- arquivos: `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`, os testes deles (`src/app/robots.test.ts`, `src/app/sitemap.test.ts`), `src/app/(comecar)/layout.tsx`, `src/app/(app)/layout.tsx`
- depende de: T1
- leitura: spec 024 › Critérios › "Metadados e indexação" (inteiro); edge case de `publico.siteUrl` nulo
- skills: `next-best-practices`
- contratos: os da spec, por extenso. A `description` vem de `entrada.oQueE` (`config/textos-entrada.ts`). A imagem é `/marca/og.jpg` (1200×630, com `alt`). `metadataBase` só entra com `publico.siteUrl`. Os layouts de `(comecar)` e `(app)` exportam `metadata` com `robots: { index: false }`. Se um deles for componente de cliente, ponha o `metadata` no arquivo de servidor mais próximo e diga qual.
- testes primeiro: `robots()` sem e com `siteUrl` (permite `/`, `/sobre` e `/bastidores`; bloqueia `/api/`, `/comecar/`, `/conversa`, `/casa`, `/como-ficou`, `/voce` e `/marca`; `sitemap` só com `siteUrl`); `sitemap()` vazio sem `siteUrl` e com as três páginas com ela.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes e build verdes.
- fora: `src/app/page.tsx` (T11).

### T9 · Check /sobre in the production smoke
- nivel: mecanica
- objetivo: checagem `sobre` no smoke: `GET /sobre` responde `200` e contém "Privacidade" e "Não é orientação médica".
- arquivos: `scripts/lib/smoke.ts`, `scripts/lib/smoke.test.ts`, `scripts/smoke.ts`
- depende de: nenhuma
- leitura: spec 024 › Contratos › "Smoke (022, acréscimo)"; critério "Smoke da 022" em "Geral"
- skills: nenhuma
- contratos: a checagem entra no grupo `publico` (criado pela 023, ao lado de `bastidores` e `mcp tools/list`), com o nome `sobre`.
- testes primeiro: 200 com as duas frases → ok; falta "Privacidade" → falha; 500 → falha.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: rodar contra produção.

### T10 · Build the public header and footer and use them in Bastidores
- nivel: tela
- objetivo: `RodapePublico` e `CabecalhoPublico` em `src/components/ritu/publico/`; Bastidores passa a usá-los, e a seção do MCP ganha `id="mcp"`.
- arquivos: `src/components/ritu/publico/rodape.tsx`, `src/components/ritu/publico/cabecalho.tsx`, o teste deles, `src/app/bastidores/page.tsx` (só o cabeçalho, o rodapé e o `id`), `src/components/ritu/bastidores/use-o-mcp.tsx` (só o `id="mcp"`, se a seção estiver lá), `e2e/bastidores.spec.ts` (só o que o rodapé novo mudar)
- depende de: T1
- leitura: spec 024 › Critérios › "Rodapé público"; Contratos › "Páginas e componentes" (as linhas de `rodape.tsx` e `cabecalho.tsx`) e "Desenho"; `DESIGN.md` §3 "Acessibilidade"
- skills: `frontend-design`, `web-design-guidelines`
- contratos: `RodapePublico({ atual?: "sobre" | "bastidores" })`: `nav` com `aria-label="Links do Ritu"`, os três links de `textosLanding.rodape` (`/sobre`, `/bastidores` e `publico.repositorio`, este em nova aba com `rel="noopener"` e `textosLanding.novaAba` oculto para leitor de tela) e a assinatura `rodape.assinatura` com `{nome}`. O link da página atual leva `aria-current="page"`. `CabecalhoPublico()`: `header` com o `Logo` (016) como link para `/`. Só classes de token; componentes do Ritu (`TextLink`).
- testes primeiro: o `aria-current` no link certo; o link do GitHub com `rel` e o texto oculto; o E2E de Bastidores segue verde, com o axe.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e -- e2e/bastidores.spec.ts`
- pronto quando: testes e E2E verdes.
- fora: Entrada e Sobre.

### T11 · Build the landing sections below the Entrada card
- nivel: tela
- objetivo: as seções da Entrada abaixo da primeira dobra, a prop `exemplo` do `BlocoDeSugestao` e o rodapé público na Entrada.
- arquivos: `src/components/ritu/landing/` (`secoes.tsx`, `como-funciona.tsx`, `exemplo.tsx`, `faz-nao-faz.tsx`, `por-dentro.tsx`, `chamada-final.tsx` e testes), `src/components/ritu/conversa/sugestao.tsx` e o teste dele (só a prop `exemplo`), `src/app/page.tsx`, e os E2E da Entrada (017) que mudarem só pelo texto do aviso
- depende de: T1, T10
- leitura: spec 024 › Critérios › "Entrada pública" (inteiro); Contratos › "Conversa de exemplo", "Páginas e componentes" (linhas de `page.tsx` e de `landing/`) e "Desenho"; `DESIGN.md` §1 "Sensação" e §3 "Regras"; `.specs/017-entrada-e-contas.md` "Entrada: layout"; `.specs/018-tela-conversa.md`, só as linhas de `fala.tsx` e `sugestao.tsx` na tabela de componentes; `.specs/016-design-system.md` "Contratos", só `Surface`, `DoshaBlot`, `rise` e `TextLink`
- skills: `frontend-design`, `web-design-guidelines`
- contratos: os da spec, por extenso. A primeira dobra não muda (`min-height: 100dvh`). "Conheça o Ritu" leva a `#conheca`, e o foco vai para o `h2` "Como funciona". Com movimento reduzido, sem rolagem suave. As seções ficam nesta ordem, cada uma com `h2`. A conversa de exemplo é um `figure` com `figcaption`, sem `role="log"` e sem nada tocável. Os nomes das sugestões vêm da base. A chamada final usa `estadoDaEntrada(...)` e as mesmas ações de servidor do cartão (017). Com sessão válida, `/` redireciona como antes e as seções não são renderizadas. Sem script de terceiros; a CSP não muda.
- testes primeiro: `BlocoDeSugestao exemplo` sem botões, sem menu e sem 👍/👎; a conversa de exemplo com os três nomes da base; `LandingSecoes` com os cinco `h2` em ordem; a chamada final nos três estados de `estadoDaEntrada`.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `CI=1 npm run test:e2e -- e2e/entrada` (os E2E da 017, pelo nome real do arquivo)
- pronto quando: testes, build e os E2E da Entrada verdes.
- fora: Sobre, `e2e/publico.spec.ts` (T14), metadados (T8).

### T12 · Build the Sobre page with the privacy policy
- nivel: tela
- objetivo: `/sobre`, com o índice, as seis seções e a política de privacidade.
- arquivos: `src/app/sobre/page.tsx`, `src/components/ritu/sobre/` (`indice.tsx`, `secao.tsx`, `politica.tsx` e testes)
- depende de: T1, T2, T3, T10
- leitura: spec 024 › Critérios › "Sobre" (inteiro); Contratos › "Textos do Sobre" (com as partes de `privacidade` e a regra de interpolação), "Contato", "Páginas e componentes" (linhas do Sobre) e "Desenho" (o item Sobre); `DESIGN.md` §3 "Regras"
- skills: `frontend-design`, `web-design-guidelines`
- contratos: os da spec, por extenso. `dynamic = "force-dynamic"`, `metadata.title` "Sobre". O padrão "%s · Ritu" vem da T8. Se ela ainda não tiver commit, ponha "Sobre" mesmo. O contato é `contatoDePrivacidade(contatoPrivacidade())`: o leitor da T2 (`src/infra/env.ts`) devolve o valor cru, e a validação vem de `src/core/publico/contato.ts`, por um caminho que respeite o R3: se a página não puder importar `@/infra/env`, leia pelo container ou por um apoio de `src/app/_lib`, como as outras páginas fazem. Os prazos vêm de `prazosDaPolitica()` e `preencher`. A data aparece como "Atualizada em 23 de novembro de 2026." (`Intl.DateTimeFormat("pt-BR")`, no fuso padrão). Sem contato, `privacidade.semContato` e nenhum `mailto:`. `section#privacidade` com `scroll-margin-top`. O índice fica fixo à esquerda a partir de 64rem.
- testes primeiro: com contato, `mailto:`; sem contato, nenhum `mailto:`; as nove partes com `h3`; os prazos interpolados batem com a configuração; "Cuidados" com os textos fixos do agente.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`, `npm run build`
- pronto quando: testes e build verdes; a página abre sem sessão (confira com `curl` no `npm run start` em modo e2e).
- fora: E2E (T14), Entrada.

### T13 · Link the privacy policy from the Aviso and from Você › Conta
- nivel: tela
- objetivo: `TextLink` "Leia a política de privacidade" no Aviso inicial e "Sobre o Ritu e privacidade" em Você › Conta.
- arquivos: `src/app/(comecar)/comecar/aviso/page.tsx`, `src/components/ritu/voce/conta.tsx`, os testes deles
- depende de: T1
- leitura: spec 024 › Critérios › "Links de dentro do app"
- skills: `frontend-design`, `web-design-guidelines`
- contratos: os textos `avisoInicial.politica` e `conta.sobre` (T1). Os links vão para `/sobre#privacidade` e `/sobre`. No Aviso, o link fica depois das três frases; em Conta, acima de "Sair". O passo do Aviso não muda: voltar do Sobre cai no Aviso.
- testes primeiro: os dois links com o `href` certo.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm test`
- pronto quando: testes verdes.
- fora: o E2E (T14).

### T14 · Cover the public pages end to end
- nivel: tela
- objetivo: `e2e/publico.spec.ts` com tudo o que a spec pede, em celular e desktop.
- arquivos: `e2e/publico.spec.ts`
- depende de: T8, T10, T11, T12, T13
- leitura: spec 024 › Evals, o parágrafo "E2E"; critérios "Geral" (axe e zoom de 200%) e "Âncora"
- skills: `web-design-guidelines`
- contratos: modo e2e, sem a variável `CONTATO_PRIVACIDADE`. Zoom de 200% = `viewport` de 640 px com `deviceScaleFactor` 2, sem rolagem horizontal (`scrollWidth <= clientWidth`). axe nos dois temas, com a Entrada rolada até o fim e com `/sobre`. Sem `waitForTimeout` fixo como única defesa.
- testes primeiro: todos os casos do parágrafo E2E.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm run build`, `CI=1 npm run test:e2e -- e2e/publico.spec.ts`
- pronto quando: E2E verde nos dois projetos. Se um caso acusar um defeito de tela, pare e diga qual: a correção volta à tarefa dona da tela.
- fora: código de `src/`.

### T15 · Cover the policy and the example with a deterministic eval
- nivel: mecanica
- objetivo: `evals/det/publico/politica.eval.ts`.
- arquivos: `evals/det/publico/politica.eval.ts`, `evals/det/mapa.ts` (só a entrada nova, `desde: 4`)
- depende de: T3, T11, T12
- leitura: spec 024 › Evals, o item `politica.eval.ts`
- skills: nenhuma
- contratos: renderize a política (`Politica`) e a conversa de exemplo com `renderToStaticMarkup`, como faz `evals/det/bastidores/numeros.eval.ts`.
- testes primeiro: todo marcador dos textos do Sobre tem valor; os prazos batem com a configuração; os textos de alerta e emocional são os mesmos do agente; sem a variável, nenhum `mailto:`; a conversa de exemplo cita os nomes da base das três sugestões.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm run eval:det`
- pronto quando: eval verde.
- fora: código de `src/`.

### T16 · Write README.md and README.en.md
- nivel: conteudo
- objetivo: os dois READMEs, com as quinze seções, os marcadores dos blocos gerados e os prints citados; revisão de `rotulosEn`.
- arquivos: `README.md`, `README.en.md`, `config/readme.ts` (só se `rotulosEn` precisar de ajuste)
- depende de: T4, T6
- leitura: spec 024 › Contratos › "README: seções" (inteiro) e "Gerador do README" (os marcadores); critérios de "README" (inteiro); `.docs/RULES.md` §5 (referências locais); o `README.md` atual (a seção "Como rodar"); `AGENTS.md` (os comandos de hoje)
- skills: nenhuma
- contratos: o português primeiro; o inglês é tradução fiel, no mesmo tom. O topo de cada um tem o link para o outro ("Read in English" / "Leia em português"). Os blocos `site`, `numeros` e `adrs` ficam entre `<!-- ritu:<bloco> -->` e `<!-- /ritu:<bloco> -->`, cada um uma vez. Depois de escrever, rode `npx tsx scripts/readme.ts` para preencher os blocos. Os prints vêm de `.docs/prints/`, com `alt` descritivo. `painel.webp` é citado mesmo sem existir ainda: ele entra no fechamento da entrega. O diagrama de um run vai em Mermaid. Nenhum e-mail, URL de banco, token, `.local` nem nome de pasta de referência. Nenhum número digitado fora do bloco `numeros`. Os cinco itens de "O que ele faz" são os de `textosLanding.faz.itens`.
- testes primeiro: nenhum (o eval vem na T17).
- comandos: `npx tsx scripts/readme.ts` (deixa os blocos em dia); `rtk bypass npm run lint`
- pronto quando: os dois arquivos completos, com os blocos preenchidos pelo gerador.
- fora: código.

### T17 · Fail eval:det when the README is out of date
- nivel: mecanica
- objetivo: `evals/det/publico/readme.eval.ts`.
- arquivos: `evals/det/publico/readme.eval.ts`, `evals/det/mapa.ts` (só a entrada nova, `desde: 4`)
- depende de: T4, T16
- leitura: spec 024 › Evals, o item `readme.eval.ts`; critérios "Em dia" e "Sem segredo nem referência local"
- skills: nenhuma
- contratos: roda o gerador em memória (`blocosDoReadme` + `aplicarBlocos` sobre os arquivos) e falha com "README desatualizado: rode npm run readme" se o resultado diferir. Procura `@`, `postgres://`, `.local/` (com a barra, para não acusar um `.env.local` legítimo) e, quando `.local/REFERENCIAS.md` existir, os nomes de pasta listados nele, sem imprimir esses nomes na mensagem de falha. A busca de `@` ignora os blocos Mermaid e os links de pacotes com escopo, se houver: liste no relatório o que ignorou.
- testes primeiro: README em dia passa; bloco alterado falha com a mensagem; marcador repetido falha.
- comandos: `rtk bypass npm run lint`, `npm run typecheck`, `npm run eval:det`
- pronto quando: eval verde.
- fora: o texto dos READMEs.

## Ondas

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1, T2, T5, T9 | Sem dependência; sem arquivo em comum (config; env; imagens; smoke) |
| 2 | T3, T4, T8, T10, T13 | Dependem de T1; arquivos separados |
| 3 | T11, T12 | Telas da Entrada e do Sobre; dependem de T10; sem arquivo em comum |
| 4 | T6, T14, T15 | Prints, E2E público e eval da política; `mapa.ts` só na T15 |
| 5 | T16 | README (conteúdo), depois dos prints e do gerador |
| 6 | T7 | `package.json`: sozinha |
| 7 | T17 | Eval do README; `mapa.ts` |

Fechamento (orquestrador): gates 1 a 6 e `dup`; ADR "Páginas públicas e README a partir das fontes de verdade"; docs vivos (`BUSINESS.md` §7 e §14; `ARCHITECTURE.md` §1 e §7; `DATA-SOURCES.md`; `QA.md`; `DEVELOPMENT.md`; `DEPLOY.md`; `AGENTS.md`, com os comandos, o status e a regra de `atualizadaEm` em "Regras"; `.specs/README.md`); spec `implemented`.
