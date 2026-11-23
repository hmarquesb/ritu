# ADR 0056: Páginas públicas e README a partir das fontes de verdade

## Status

Aceito · 2026-11-22

## Contexto

A Entrada, o Sobre e o README são o que quem chega de fora vê primeiro. Três coisas nele podem divergir do que o produto faz: os prazos da política de privacidade (o código apaga mensagens, faltas e retornos em prazos próprios), os números dos evals e a lista de ADRs no README, e os prints das telas. Se cada uma for escrita à mão, vira uma cópia que envelhece.

## Decisão

1. **Política com prazos da configuração:** o texto de `textosSobre.privacidade` (`config/textos-sobre.ts`) só tem marcadores `{chave}`. `prazosDaPolitica()` os lê de `config/memoria.ts` (mensagens, faltas, retornos), da duração da demonstração, do `maxAge` da sessão e de `config.ui.theme.maxAgeDays`; `preencher` lança `RituError("texto_sem_valor")` para marcador sem valor. `evals/det/publico/politica.eval.ts` amarra: todo marcador tem valor, os prazos batem com a configuração, os textos de alerta e de sofrimento emocional são os do agente (`config/textos-alertas.ts`), e a página sem contato não tem `mailto:`. Ao mudar a política, muda-se `atualizadaEm` junto (regra no `AGENTS.md`).
2. **Blocos do README gerados:** entre `<!-- ritu:<bloco> -->` e `<!-- /ritu:<bloco> -->`, os blocos `site`, `numeros` e `adrs` de `README.md` e `README.en.md` são escritos por `npm run readme` (`scripts/lib/readme/`), a partir de `historico.json`, de `.adrs/` e de `publico.siteUrl`. `evals/det/publico/readme.eval.ts` roda o gerador em memória e falha com "README desatualizado: rode npm run readme"; confere também que nenhum README cita e-mail, URL de banco, token nem referência local.
3. **Prints por script:** `npm run prints` sobe o build em modo e2e (runtime roteirizado, relógio fixo), entra na demonstração e grava `.webp` em `.docs/prints/` (até 250 KB cada). Fica fora da CI e dos gates; o `painel.webp` entra no fechamento da entrega.
4. **Só três páginas indexadas:** `/`, `/sobre` e `/bastidores` entram no `sitemap.xml` (com `publico.siteUrl`) e no `robots.txt`; `/api/`, `/comecar/`, `/conversa`, `/casa`, `/como-ficou`, `/voce` e `/marca` ficam bloqueadas, e as páginas de quem entrou levam `noindex`.
5. **Contato da LGPD só por variável:** o e-mail vem de `CONTATO_PRIVACIDADE` (obrigatória em produção), validado por `contatoDePrivacidade`, e nunca entra no repositório. Sem ela ou inválida, a política mostra o texto `semContato`, sem `mailto:`.

### Decisões autônomas da construção

- O id do exemplo da landing é `arroz-branco`, o que existe na base.
- Os textos fixos de alerta físico e emocional foram para `config/textos-alertas.ts` (`config/` não importa de `src/core/`); `src/core/conversation/textos.ts` os lê de lá, com a mesma string.
- `contatoDePrivacidade` apara só os espaços e mantém a caixa; `contatoPrivacidade()` em `src/infra/env.ts` devolve o valor cru.
- O Sobre lê a variável por `src/app/_lib/contato.ts`, no padrão das rotas de cron com `CRON_SECRET`, porque o R3 proíbe `src/app/` de importar `@/infra/env`.
- As manchas da chamada final ficam em um `div` no fluxo, acima do título, para não cobrir texto; a landing tem um botão de envio próprio em `src/components/ritu/landing/envio.tsx`, porque componente não importa de `src/app/`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Prazos digitados no texto da política | Divergem do código sem aviso |
| README escrito à mão | Números e ADRs viram uma terceira cópia |
| Prints tirados à mão | Não são reproduzíveis nem atualizam quando a tela muda |
| Indexar o site todo | Telas de conta não têm o que fazer num buscador |
| E-mail de contato no repositório | O repositório é público; a variável o mantém fora |

## Consequências

- Mudar um prazo em `config/memoria.ts` muda a política sozinho; mudar o sentido do texto exige mudar `atualizadaEm`.
- Uma ADR nova ou uma rodada nova no histórico deixa o `eval:det` vermelho até `npm run readme`.
- Os prints envelhecem com as telas; o fechamento de cada spec de tela posterior deve rodar `npm run prints`.
- A política não é revisada por advogado; o texto diz só o que o código faz.
