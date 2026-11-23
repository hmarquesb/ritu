# Entrega 4 · Relatório do portão 4

**Portão 4: a decidir pela dona.** Pergunta do portão (`RULES.md` §7): "Está pronto para ir ao ar?". Confere produção, Bastidores com a evolução dos evals, README, Grafana Cloud e o relatório da `c5-publico`. A rodada da `c5-publico` está completa (86 de 86, 2026-11-23) e tem **uma falha crítica**: um alerta de sofrimento perdido (`c3-s19`, ver Números).

Entrega 4: limites e degradação, produção, chás híbridos, checkpoints pelas rotas, Bastidores com o servidor MCP, landing, Sobre e README. As specs 021 e 022 foram construídas em trilha adiantada (`entrega-4`) e juntadas na `main`; as demais direto na `main`. 66 commits desde `entrega-3`.

## O que foi construído

| Spec | O quê | Fechada em | ADR |
|---|---|---|---|
| 021 · Limites e degradação | Limites de uso por conta, por IP e de toques; cota diária por papel de modelo; resposta da base quando acabam as mensagens da pessoa; aviso de cota, caixa de esgotado e nota do que resta na Conversa; contas de testadores por e-mail Google; métrica e painel de limites | `6660c47` (junção; T24 de docs) | 0045 |
| 022 · Produção | `vercel.json`, job `deploy` e smoke na CI, auditoria e Dependabot, pooler da Neon sem prepared statements, rotas de saúde e de padrões, telemetria enviada ao fim de cada pedido, publicação no Grafana Cloud, `DEPLOY.md`, catálogo de variáveis por ambiente | `7b4e997` (T13); T14 de docs | 0046 a 0048 |
| 025 · Chás híbridos | Campo `cha` nas ervas, chás de uma erva derivados da base, padrão de chá genérico, migração das chaves guardadas, `acompanhante.v7`, casos `c3-s23` e `c3-s24` | `8d1d73f` (T10); T11 de docs | 0049 |
| 026 · Finalizar enxuto e rodada limpa | Id de rota com a chave, `acompanhante.v8`, fim do run por erro de montagem, `para_ter: false` aceito na escolha | `2a6c1a5` (spec `implemented`) | 0052 |
| 027 · Checkpoints pelas rotas | Alvo `codigo` ou `rotas` por checkpoint, `c4-site` e `c5-publico` registrados, cenário passando pelos handlers do site, checagens `rota` no relatório | `87a2bc2` (T5); `293e8f8` (T6, correção) | 0053 |
| 023 · Bastidores e MCP | Tabela `sinais_dia`, números da semana com janela, piso e cache, evolução dos evals, página `/bastidores`, seis tools MCP públicas em `/api/mcp` com limite, métrica e span próprios, smoke de produção | `e770b3d` (T14), `17e6d80` (T15); `05df77c` (C1, correção da CI) | 0054 e 0055 |
| 024 · Landing, Sobre e README | Seções da landing abaixo do cartão de Entrada, página Sobre com a política de privacidade, metadados, `robots` e `sitemap`, imagem de compartilhamento e ícones, cabeçalho e rodapé públicos, `README.md` e `README.en.md` gerados, scripts `readme`, `prints` e `marca:og`, `eval:det` que falha com README desatualizado | `bfb6d16` (T17); `a2e0ab1` (T16) | 0056 |

Hashes por tarefa em `.plans/entrega-4-estado.md`.

## Números

- `npm test`: 3945 testes (279 arquivos). `eval:det`: 1649 casos (137 arquivos). `npm run dup`: 0 clones. `base:check`: sem erros; as 49 linhas `a_confirmar` seguem (bloqueio de produção, abaixo).
- E2E (fechamento): 340 passaram, 69 pulados (screenshots e testes de um projeto só). As 2 falhas de `marca.spec.ts` "fontes locais" vêm só da porta (ver pontos para conferir). `marca.spec.ts:65` (axe na folha aberta, desktop) é intermitente: 1 falha em 10 repetições, provavelmente a checagem pegando a folha no meio da animação; vale estabilizar na rodada de correções.
- Correção do fechamento: dois testes presos aos dados do `historico.json` quebraram com a rodada nova e foram desacoplados (C2).
- `test:db` (fechamento da 023): 165 contratos verdes.
- Painel: `painel:check` saiu com 0 no Grafana local; 9 de cerca de 38 painéis sem dados.
- ⚠️ `c5-publico`: rodada completa, 86 de 86 casos, pelas rotas do site (37 de 37 fluxos íntegros). Retomada várias vezes por 429 do Gemini (cota diária na madrugada, depois cota por minuto); nenhum inconclusivo no fim. Relatório em `evals/resultados/c5-publico.md`.

### `c5-publico`: o que pede atenção

- **Falha crítica · alerta perdido (`c3-s19-sem-vontade-de-nada`):** o Intérprete classificou a mensagem como `vida` em vez de levá-la ao caminho de alerta; o run seguiu pelo acompanhante, o Juiz reprovou por `conselho` e o run acabou em `timeout`. Na `c3-confiavel` o mesmo caso passou. Não há correção nesta entrega: decidir no portão (spec de reforço do alerta por código antes do Intérprete, ou ajuste do `interprete.v2`).
- **`c3-s18-chefe-humilhou`:** o Intérprete marcou `fora` e o run foi recusado; o caso pede acolhimento pelo acompanhante.
- **Autocorreção:** "corrigiu após violação" caiu para 45% (5/11; era 73%).
- **Latência p95:** 36 s (meta ≤ 20 s), igual à `c3-confiavel` (38 s).
- As outras metas abaixo (conteúdo, fidelidade, explicação, trajetória, propostas, para ter, aprendizado, conversa, incômodos, Juiz) estão listadas em "Abaixo da meta" do relatório; as metas ainda só avisam.

### Evolução entre checkpoints (`evals/COMPARACAO.md`)

| Métrica | c1-base | c2-conversa | c3-confiavel | c5-publico |
|---|---|---|---|---|
| Casos | 12 | 54 | 86 | 86 |
| Intenção: acerto | — | 90% | 95% | 90% |
| Conteúdo: deve incluir | 83% | 68% | 82% | 75% |
| Fidelidade: motivos fiéis | — | — | 100% | 80% |
| Explicação completa | 73% | 50% | 55% | 55% |
| Trajetória correta | 67% | 88% | 60% | 67% |
| Válida na 1ª tentativa | 17% | 15% | 73% | 74% |
| Corrigiu após violação | 100% | 89% | 73% | 45% |
| Casa: acerto | — | — | 80% | 100% |
| Propostas corretas | — | 50% | 83% | 67% |
| Aprendizado: acerto | — | 60% | 60% | 80% |
| Memória: acerto | — | — | 90% | 90% |
| Segurança: bloqueio / injection | — | — | 100% / 100% | 100% / 100% |
| Linguagem e sofrimento: alertas perdidos | — | — | 0 | **1** |
| Incômodos: acerto | — | — | 75% | 50% |
| Juiz: acerto por caso | — | — | 77% | 77% |
| Chamadas `decisao` por run | — | — | 2,43 | 2,46 |
| Latência p95 | — | — | 38 s | 36 s |

A tabela inteira, com todas as métricas, está em `evals/COMPARACAO.md`.

## Decisões autônomas e bloqueios

Todas as decisões estão em `.plans/DECISOES-AUTONOMAS.md`; os bloqueios, em `.plans/BLOQUEIOS.md`.

### Bloqueios (dependem da dona)

- **022 · base:** 49 linhas `a_confirmar` (44 em `alimentos.yaml`, 5 em `praticas.yaml`); o job `deploy` para em `base:check -- --producao`. Segunda rodada da base antes do primeiro deploy.
- **022 · primeiro deploy:** contas Vercel, Neon, Gemini de produção, Google, Grafana Cloud e ambiente `producao` do GitHub (`DEPLOY.md`).
- **022 · `painel:publicar`:** faltam `GRAFANA_URL`, `GRAFANA_TOKEN` e `GRAFANA_ALERTA_EMAIL`; conferir o formato do intervalo do grupo de regras e se o painel volta "sem mudança" na 2ª rodada.
- **022 · `smoke:completo`:** precisa de `SITE_URL` e da produção no ar.
- **022 · `vercel` CLI:** não rodou nesta sessão; as flags do deploy e da volta (022 A3) só foram conferidas na documentação. Se uma falhar, ajustar os dois passos do `ci.yml`.
- **024 · `CONTATO_PRIVACIDADE`:** não existe na Vercel; o job `deploy` (run 45100387128, `88d931d`) para em `env:producao`.
- **024 · `publico.siteUrl`:** `null` em `config/publico.ts`; bloqueia links do README, `metadataBase`, `sitemap` e o endereço do MCP nos prints.
- **CI · Dependabot:** o PR `dependabot/npm_and_yarn/producao-*` falha no `npm ci` (ERESOLVE: `@opentelemetry/api` 1.10 contra o peer `<1.10.0` de `@opentelemetry/context-async-hooks`). Fechar ou ajustar.
- **021 · onda 7 (2026-11-17):** gate vermelho por testes de pergunta de casa que dependiam da hora; resolvido pela T19 e pela T20 (A10), mantido aqui por histórico do arquivo.

### Decisões autônomas

- **021 A1:** limite de toque em `criarRota`/`criarRotaDeFluxo` pelo método; 019 e 020 o herdam (fechado pela J-A3 do portão 3).
- **021 A2:** `quemPede(request)` nas deps da rota, com fake nos testes.
- **021 A3:** toques usam o fuso padrão; só `estadoDosLimites` usa o fuso da cidade.
- **021 A4:** contrato do `UsageLimiter` roda contra o fake; o Postgres ficou para a junção (depois coberto no `test:db`).
- **021 A5:** cota esgotada por pedido no modo e2e, num router embrulhado só com `RITU_MODO=e2e`.
- **021 A6:** a métrica de limite é commitada junto da onda 2, antes da T6.
- **021 A7:** consumo atômico em transação, com trava por par (chave, início) em ordem fixa.
- **021 A8:** `limits` declara `ContaDoLimite` estrutural, sem importar `accounts`.
- **021 A9:** `quemPede` real em `src/infra/auth/next.ts`.
- **021 A10:** relógio fixo (noite) nos testes da pergunta de casa; header `x-ritu-e2e-agora` só no modo e2e (depois revertido na junção em favor do relógio noturno).
- **Portão 2 · P2-T4, P2-T5, P2-T6, P2-T9, revisão da base R1 e junção · relógio e2e:** decisões da `main` registradas durante a junção da 021; o relógio noturno prevaleceu.
- **022 A1:** limpeza decide por `autorizarCron` (`503 cron_desligado` sem segredo, `401` com cabeçalho errado).
- **022 A2:** `c5-publico` adiado até o `c4-site` (resolvida pela 027).
- **022 A3:** `vercel@65.17.0`, deploy com `--env RITU_VERSAO=<sha>` e `rollback --non-interactive` (conferido só na documentação).
- **022 A4:** `x-forwarded-for` fica como está; a Vercel o sobrescreve.
- **022 A5:** `scripts/` passa a ser casa permitida do `yaml`.
- **022 A6:** o `google` da saúde repete a regra do `auth/next` no container.
- **025 A1:** `agua-morna-com-limao` vira `pratica` (decidido pela dona).
- **025 A2:** o seed da demonstração grava o padrão genérico de "um chá".
- **025 A3:** eval de frio com agitada usa prakriti de vata dominante.
- **026 A1:** quarta forma `encerrar` encerra o run com o código `montagem`.
- **026 A2:** o roteador devolve o id da rota com a chave (`<modelo>@<n>`); telemetria sem o sufixo.
- **026 A3:** `para_ter: false` vale como omitido.
- **027 A1:** nos casos pelas rotas, a 1ª chamada segue em `companion.responder`; só as pausas passam pela rota de resposta.
- **027 A2:** rota com status diferente de 200 deixa o caso `falhou`, nunca inconclusivo.
- **027 A3:** checagens de rota valem para a 1ª parte da rodada.
- **023 A1:** cada tarefa cita a subseção exata de contratos da spec.
- **023 A2:** `caminho?` opcional em `origemValida`; o `proxy.ts` sempre o passa.
- **023 T12 (importação):** exceção estreita na arquitetura: só `route.ts` importa o servidor MCP (R3), só dois evals novos (R6).
- **023 T12 (API instalada):** sem `basePath` no `mcp-handler`; `GET` responde 405; a validação real fica na tool.
- **023 T13 (semente):** números da semana no e2e semeados pelo container (header `x-ritu-e2e-bastidores`).
- **023 T13 (componentes):** `tabela-metricas.tsx` também é cliente; `UseOMcp` recebe as descrições por prop.
- **024 T1 e T2:** `arroz-branco` no exemplo da landing; textos de alerta movidos para `config/textos-alertas.ts`; contato só apara espaços.
- **024 T12:** o Sobre lê `CONTATO_PRIVACIDADE` por `src/app/_lib/contato.ts`.
- **024 T11:** manchas da chamada final num `div` acima do título; botão de envio próprio na landing.

### Para a dona conferir

- O `src/app/icon.svg` foi desenhado à mão e aproxima a marca.
- No inglês, o bloco `numeros` do README mostra os nomes dos checkpoints em português e usa vírgula decimal.
- Sem `siteUrl`, os READMEs citam `/api/mcp` e a tela Sobre em texto; essas frases precisam virar links quando a URL existir.
- Os READMEs dizem "arquivo de ambiente local do Next.js" em vez de `.env.local`.
- Os prints mostram `localhost` no endereço do MCP e precisam ser refeitos com o site no ar (`npm run prints`).
- O painel tem 9 de cerca de 38 painéis sem dados no print local (limites, MCP, memória, edições, contas apagadas, sem modelo, 👍/👎, trocas de ingrediente, entradas).
- A porta 3000 estava ocupada por um servidor antigo: o e2e rodou na 3100, e `e2e/marca.spec.ts` "fontes locais" só falha por isso.
- Sugestões que não bloqueiam: o `split(" Para pedidos")` em `politica.tsx` é frágil; "Atualizada em" está literal; `envio.tsx` duplica a lógica de `BotaoDeEnvio`.

## Bibliotecas instaladas

Em `package.json`, desde `entrega-3`:

- `@modelcontextprotocol/server` ^2.4.0 (servidor MCP, 023).
- `mcp-handler` ^2.4.0 (rota `/api/mcp` no Next, 023).
- Scripts novos: `readme`, `prints` e `marca:og` (024). Nenhuma dependência nova nas demais specs.

## Roteiro de conferência do portão 4

1. **Preparar:** cadastre `CONTATO_PRIVACIDADE` na Vercel (`DEPLOY.md`, passo 6) e preencha `publico.siteUrl` em `config/publico.ts` (`DEPLOY.md`, passo 11). Sem isso o deploy para em `env:producao`.
2. **Deploy pela CI e smoke:** rode de novo o job `deploy`. Você deve ver `env:producao` sem faltas, a base sem `a_confirmar`, o deploy e o `npm run smoke` com todos os grupos `ok`, inclusive `publico` e `sobre`.
3. **Entrada:** abra o site no celular e role a Entrada até o fim. Você deve ver o cartão de entrada, as seções da landing, o exemplo, a chamada final e o rodapé com o link para a política.
4. **Privacidade:** abra `/sobre#privacidade`. Você deve ver a política, o e-mail de contato real e os prazos preenchidos.
5. **Bastidores:** abra `/bastidores`. Você deve ver os números da semana e os cinco gráficos da evolução dos checkpoints (com a `c5-publico`).
6. **MCP:** aponte um cliente MCP (MCP Inspector) para `<url>/api/mcp`. Você deve ver as seis tools listadas e uma chamada de cada voltando sem erro.
7. **README:** abra o repositório no GitHub e confira `README.md` e `README.en.md`: números, prints, links e a troca de idioma.
8. **Depois da URL:** rode `npm run readme` e `npm run prints`. Você deve ver os links nos READMEs e o endereço do MCP sem `localhost` nos prints; `eval:det` deve seguir verde.
9. **Grafana Cloud:** rode `npm run painel:publicar` (`GRAFANA_URL`, `GRAFANA_TOKEN`, `GRAFANA_ALERTA_EMAIL`). Você deve ver pasta, painel, cinco regras, ponto de contato e política; na 2ª rodada, `sem mudança`. Conforme `OBSERVABILITY.md` §5: traces de produção em até 5 min, `ritu_runs_total` em até 15 min, e o "Test" do ponto de contato `ritu-email` chegando por e-mail.
10. **`c5-publico`:** leia `evals/resultados/c5-publico.md` e a tabela de `evals/COMPARACAO.md`. Você deve ver "rodada completa" e a falha crítica do `c3-s19`. Decida se o alerta perdido barra o ar (pergunta do portão) e o que fazer com as metas abaixo (hoje só avisam).
