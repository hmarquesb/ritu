# 020 · Você, memória e Como pensei · Plano

Spec: `.specs/020-perfil-memoria-e-rastro.md` (666 linhas). Trilha adiantada, branch `entrega-3`.

Notas do orquestrador:

- **Contratos por linha da spec.** A spec traz os contratos por extenso e é longa demais para copiar em cada tarefa sem estourar o plano. Cada tarefa diz, em `contratos`, o intervalo de linhas da spec que é o contrato dela: o subagente lê **só** essas linhas (`Read` com `offset`/`limit`). Decisão A6 em `DECISOES-AUTONOMAS.md`.
- Rotas no padrão da 018/019: lógica e teste em `src/app/_rotas/<nome>.ts` com `criarRota`; cada `route.ts` só liga `depsReais()` (ver `src/app/_rotas/casa.ts` e `src/app/api/casa/route.ts`).
- R4: `src/components/` só importa **tipos** do core (`import type`); textos vêm de `config/`. React Aria só em `src/components/`.
- Testes que dependem do momento do dia fixam o relógio (`createContainer({ clock })`); o servidor do E2E roda às 01h de Brasília (ADR 0050).
- Frases de Como pensei (tabelas das linhas 441–488 da spec) são texto lido pela pessoa: ficam em `config/textos-como-pensei.ts` (chave `passos`), e `linhaDoTempo` só as preenche. Decisão A7.
- A migração é a `0005`.

### T1 · Add the day count and day deletion to messages and runs
- nivel: mecanica
- objetivo: portas, adaptadores, fakes e suítes de contrato ganham `contarPorDia`, `apagarDoDia`, `tirarDaConversa` e `Run.fora_da_conversa`; `doDia` deixa de devolver runs fora da conversa.
- arquivos: `db/migrations/0005_runs_fora_da_conversa.sql` (novo), `src/core/messages/ports.ts`, `src/core/runs/ports.ts`, `src/infra/db/messages.ts`, `src/infra/db/runs.ts`, `src/infra/fakes/memory-stores.ts`, `test/contracts/messages.contract.ts`, `test/contracts/runs.contract.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 168–188.
- testes primeiro: suítes de contrato: contagem por dia (mais recente primeiro, só dias com mensagem); apagar um dia não toca outro dia nem outra conta; `tirarDaConversa` zera `saida`, `checkpoint`, `pendencia`, `clima_usado`, marca `fora_da_conversa` e não toca run aberto; `doDia` não devolve run fora da conversa.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`. `test:db` não roda (sem Postgres): confira a SQL lendo.
- pronto quando: gates verdes; fake e adaptador seguem o mesmo contrato.
- fora: core de conversa, telas.

### C5 · Cover criadoEm in the outcomes contract suite
- nivel: mecanica
- objetivo: a suíte de contrato de `outcomes` cobre `criar(..., { criadoEm })` (019 C4), no fake e no Postgres.
- arquivos: `test/contracts/outcomes.contract.ts`
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: `criar(contaId: string, runId: string, sugestoes: SugestaoRegistrada[], opts?: { criadoEm?: Date }): Promise<Retorno[]>`; sem `criadoEm`, usa o relógio.
- testes primeiro: com `criadoEm`, o `criado_em` gravado é ele; sem, é o do relógio; `pendentes` ordena por `criado_em desc` respeitando o valor passado.
- comandos: `npm test` (roda a suíte contra o fake), `rtk bypass npm run lint`.
- pronto quando: casos novos verdes no fake.
- fora: código de `src/`.

### T2 · Add the Você and Como pensei texts
- nivel: mecanica
- objetivo: `textosVoce`, `textosComoPensei` (com as frases dos passos) e o aviso `dados_apagados` na configuração.
- arquivos: `config/textos-voce.ts`, `config/textos-como-pensei.ts` (novos), `config/index.ts`, `config/index.test.ts`, `config/textos-entrada.ts`, `src/core/accounts/entrada.ts` (só o tipo `AvisoDaEntrada`)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 194–285 (textos de Você, aviso da Entrada, textos de Como pensei) e 441–488 (frases dos passos, intenções, códigos da validação e motivos do Juiz em palavras, frases do fim). As frases dos passos entram em `textosComoPensei.passos` como modelos com `{chave}` (siga o estilo de `config/textos-casa.ts`, com plurais por chave separada para 1). Leia `config/textos-casa.ts` e `config/textos-como-ficou.ts` para o formato.
- testes primeiro: `config/index.test.ts`: as chaves novas existem; nenhum texto vazio; todo `{chave}` dos modelos está na lista de chaves esperadas.
- comandos: `npm run typecheck`, `npm test -- config`, `rtk bypass npm run lint`
- pronto quando: textos e tipos no `config`, testes verdes.
- fora: componentes, core além do tipo do aviso.

### T3 · Record the validation violation codes in the run trace
- nivel: nucleo
- objetivo: a etapa `validacao` de `finalizar` grava `resumo` `ok` ou os códigos das violações.
- arquivos: `src/core/agents/tools/finalizar.ts`, `src/core/runs/loop-passo.ts` e os testes deles
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 190–192 e 98. Códigos únicos, na ordem em que apareceram, unidos por `,` (ex.: `fora_de_casa,evitar_sempre`); nunca nome de alimento.
- testes primeiro: aprovado → `ok`; recusado com duas violações iguais e uma diferente → dois códigos na ordem; o despacho de controle passa o resumo para `registrarEtapa`; teste de canários (`evals/det/telemetria/privacidade.eval.ts` já percorre? se não, diga) sem nome de alimento no `resumo`.
- comandos: `npm run typecheck`, `npm test`, `npm run eval:det`, `rtk bypass npm run lint`
- pronto quando: gates verdes; nada mais no loop muda.
- fora: telas, linha do tempo.

### T4 · Write the dosha panel
- nivel: mecanica
- objetivo: `painelDoDosha` monta a carta (um dosha, misto com e sem quiz, sem dosha).
- arquivos: `src/core/accounts/painel.ts`, `src/core/accounts/painel.test.ts` (novos)
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 287–301 e 60–66.
- testes primeiro: um dosha; misto com quiz (porcentagens inteiras que somam 100, maior resto, do maior para o menor); misto declarado sem proporção; sem dosha (três linhas); elementos em palavras com "e" antes do último; qualidades pelos nomes de `vocabulario.yaml`.
- comandos: `npm run typecheck`, `npm test -- src/core/accounts`, `rtk bypass npm run lint`
- pronto quando: função pura, testes verdes.
- fora: telas, container.

### T5 · Add the memory edit and account deletion metrics
- nivel: mecanica
- objetivo: `ritu_memoria_edicoes_total` e `ritu_conta_apagada_total` no registro, os valores novos de `toque.tipo`/`toque.acao`, o painel e as regras regerados.
- arquivos: `src/core/telemetry/` (o arquivo do registro `METRICAS` e o de atributos; diga quais), `evals/det/telemetria/cobertura.eval.ts` (exceção temporária, A8), `scripts/lib/painel.ts`, `observability/dashboards/ritu.json`, `observability/grafana/alerting/ritu.yaml` (gerados por `npm run painel:gerar`), os testes que travam contagem de métricas e de painéis
- depende de: nenhuma
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 511–518 e 404 (rótulos `nivel` em `fixos`, `gostos`, `faltas`, `rotina`, `padroes`, `conversa`; `acao` é o valor de `acao` das duas uniões das linhas 347–356 e 378–387; `tipo` em `google`, `demo`). Os painéis novos vão na linha Memória.
- testes primeiro: os testes de registro e de painel que já existem, atualizados.
- comandos: `npm run painel:gerar`, `npm run typecheck`, `npm test`, `npm run eval:det -- evals/det/telemetria`, `rtk bypass npm run lint`
- pronto quando: gerados batem com o gerador; gates verdes.
- fora: quem emite as métricas (T8, T9, T10).

### T6 · Write the memory view
- nivel: mecanica
- objetivo: `visaoDaMemoria` monta os sete níveis de "O que sei sobre você".
- arquivos: `src/core/memory/visao.ts`, `src/core/memory/visao.test.ts` (novos)
- depende de: T1, T2
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 303–332 e 68–83. `CasaNaTela` de `src/core/pantry/visao.ts`; `diasEntre`/`diaLocal` de `src/core/time/dia-local.ts`; nomes "Hoje"/"Ontem"/"Há N dias" de `config` (veja como `src/core/outcomes/visao.ts` faz).
- testes primeiro: os de `visaoDaMemoria` da spec linha 559 (cada nível cheio e vazio; gostos sem linha zerada; falta de alimento fora da base; candidato barrado pelo filtro some; ordem dos padrões; dias da conversa no fuso).
- comandos: `npm run typecheck`, `npm test -- src/core/memory`, `rtk bypass npm run lint`
- pronto quando: função pura, sem lançar, testes verdes.
- fora: stores, container, telas.

### T7 · Write the timeline of a run
- nivel: mecanica
- objetivo: `linhaDoTempo` transforma as etapas de um run em passos com frases de gente e o total.
- arquivos: `src/core/como-pensei/linha-do-tempo.ts`, `src/core/como-pensei/linha-do-tempo.test.ts` (novos; módulo próprio, decisão A9), `config/textos-como-pensei.ts` e o teste dele (só `dia.data`, A9)
- depende de: T1, T2, T3
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 416–490 e 91–99. As frases vêm de `config.textosComoPensei.passos` (T2); `textoDaProposta` (010) e as frases dos estados (012): ache-os com `grep`. O `resumo` da validação é cortado em 80 caracteres pelo loop: o último código pode vir partido; código desconhecido é ignorado na hora de virar palavras (e `{n}` conta só os conhecidos). Os textos dos códigos, motivos e intenções estão em `textosComoPensei.codigosValidacao`, `.motivosJuiz` e `.intencoes`; "Você estava {estados}" usa as frases dos estados da 012. Nota: o `resumo` da validação é cortado em 80 caracteres pelo loop (`RESUMO_MAX`); o último código pode vir partido e deve ser ignorado. "Você estava {estados}" usa as frases de estado da 012 (a T2 só deixou o modelo).
- testes primeiro: os de `linhaDoTempo` da spec linha 559 (cada linha das tabelas; validação recusada e depois aprovada; juiz reprovado e aprovado; run aberto; sem etapas; `fora_da_conversa`; `saida` inválida; `llm` só no total).
- comandos: `npm run typecheck`, `npm test -- src/core/runs`, `rtk bypass npm run lint`
- pronto quando: função pura, sem lançar, testes verdes.
- fora: stores, telas.

### T8 · Add the profile touches
- nivel: mecanica
- objetivo: `tocarPerfil` aplica as ações de perfil (dosha, quiz, cidade, evitar sempre, restrições, não como).
- arquivos: `src/core/touches/perfil.ts`, `src/core/touches/perfil.test.ts` (novos)
- depende de: T5
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 343–373 e 404. Siga `src/core/touches/casa.ts` (019) para `Deps`, transação, span `toque` e `toque_invalido`. Soma `ritu_memoria_edicoes_total{nivel: "fixos", acao}`.
- testes primeiro: cada ação e cada recusa da tabela; `evitar_tirar` de item que não está → `toque_invalido`; `quiz` com pergunta faltando ou sobrando → `corpo_invalido`; `nao_come_acrescentar` com os dois ou nenhum → `corpo_invalido`; métrica sem nome nem id.
- comandos: `npm run typecheck`, `npm test -- src/core/touches`, `rtk bypass npm run lint`
- pronto quando: testes verdes.
- fora: `src/core/touches/index.ts` e o container (T13).

### T9 · Add the memory touches and the conversa_em_andamento error
- nivel: mecanica
- objetivo: `tocarMemoria` aplica as ações de memória, inclusive apagar a conversa de um dia.
- arquivos: `src/core/touches/memoria.ts`, `src/core/touches/memoria.test.ts` (novos), `src/core/errors.ts` (código `conversa_em_andamento`, 409), o mapa de status de erro das rotas (`grep -rn "run_aberto" src/app/_rotas` mostra onde; diga qual arquivo)
- depende de: T1, T5
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 375–404 e 509.
- testes primeiro: cada ação e cada recusa; `conversa_apagar` com run aberto no dia → `conversa_em_andamento`; fora da janela de 7 dias → `toque_invalido`; apaga mensagens e tira os runs do dia numa transação; métrica com `nivel` e `acao` certos.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`
- pronto quando: testes verdes.
- fora: `src/core/touches/index.ts` e o container (T13).

### T10 · Add the account deletion
- nivel: mecanica
- objetivo: `apagarConta` apaga a conta e soma a métrica.
- arquivos: `src/core/accounts/apagar.ts`, `src/core/accounts/apagar.test.ts` (novos)
- depende de: T5
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 406–411.
- testes primeiro: com os stores em memória, depois de `apagarConta` a suíte `test/contracts/delete-account.contract.ts` (veja o que ela confere) vale para a conta; a métrica sai com `tipo`.
- comandos: `npm run typecheck`, `npm test -- src/core/accounts`, `rtk bypass npm run lint`
- pronto quando: testes verdes.
- fora: ação de servidor (T14), container.

### T11 · Write the Você reader
- nivel: mecanica
- objetivo: `lerVoce` lê tudo da conta e monta `VoceNaTela`.
- arquivos: `src/core/memory/ler.ts`, `src/core/memory/ler.test.ts` (novos)
- depende de: T4, T6
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 334–341. `lerCasa` de `src/core/pantry/ler.ts`; `montarFiltro`: ache com `grep`.
- testes primeiro: com o perfil semeado da demonstração (`copiarSeed`, relógio fixo), os sete níveis vêm preenchidos; `horas_restantes` só na demonstração, arredondado para baixo, mínimo 0; nada de outra conta.
- comandos: `npm run typecheck`, `npm test -- src/core/memory`, `rtk bypass npm run lint`
- pronto quando: testes verdes.
- fora: container, rotas.

### T12 · Write the Como pensei reader
- nivel: mecanica
- objetivo: `lerComoPensei` busca o run da conta e devolve a linha do tempo.
- arquivos: `src/core/como-pensei/ler.ts`, `src/core/como-pensei/ler.test.ts` (novos; módulo próprio, decisão A9)
- depende de: T7
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 492–497.
- testes primeiro: run de outra conta → `undefined`; inexistente → `undefined`; run do roteiro demo (runtime roteirizado) → `pronto` com passos.
- comandos: `npm run typecheck`, `npm test -- src/core/runs`, `rtk bypass npm run lint`
- pronto quando: testes verdes.
- fora: container, página.

### T13 · Wire the Você readers and touches into the container and add the routes
- nivel: mecanica
- objetivo: o container expõe `lerVoce`, `lerComoPensei`, `touches.tocarPerfil`, `touches.tocarMemoria`, `accounts.apagarConta`; `GET /api/voce`, `POST /api/perfil` e `POST /api/memoria` respondem por `criarRota`.
- arquivos: `src/infra/container.ts`, `src/core/touches/index.ts` (e `index.test.ts`), `src/app/_rotas/voce.ts`, `src/app/_rotas/voce.test.ts` (novos), `src/app/api/voce/route.ts`, `src/app/api/perfil/route.ts`, `src/app/api/memoria/route.ts` (novos)
- depende de: T8, T9, T10, T11, T12
- leitura: nenhuma
- skills: `next-best-practices` (só `route-handlers.md`)
- referencia: nenhuma
- contratos: spec linhas 499–509 e 101–107. Fuso como `Container.lerCasa` faz (019). Com `acao: "quiz"`, a resposta traz `resultado: { nome, doshas, dual }` (veja o que `calcularQuiz` devolve).
- testes primeiro: cada rota sem sessão → 401; corpo fora do schema → 400 `corpo_invalido`; `evitar_tirar` sem `confirmado: true` → 400; item de outra conta → recusa; `conversa_em_andamento` → 409; corpo grande → 413; `GET /api/voce` sem nada de outra conta.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: rotas no build, testes verdes, teste de arquitetura verde.
- fora: telas, ação de servidor, evals.

### T14 · Add the delete-my-data server action
- nivel: nucleo
- objetivo: `apagarMeusDados` apaga a conta, encerra a sessão e volta à Entrada com o aviso.
- arquivos: `src/app/_acoes/sessao.ts` (e um teste, se o padrão do arquivo tiver)
- depende de: T13
- leitura: nenhuma
- skills: `next-best-practices` (só `functions.md`)
- referencia: nenhuma
- contratos: spec linhas 412–414, 89 e 627–628. `sair()` do mesmo arquivo é o modelo do `signOut`.
- testes primeiro: sem conta → `redirect("/")` sem apagar; com conta → `apagarConta` e `signOut({ redirectTo: "/?aviso=dados_apagados" })`; falha no apagar → nada apagado, sessão continua (erro sobe).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: gates verdes.
- fora: telas, Entrada.

### T15 · Add the deterministic evals for Você and Como pensei
- nivel: mecanica
- objetivo: evals de segurança, de efeito e do rastro, e as ações novas no teste de canários.
- arquivos: `evals/det/seguranca/voce.eval.ts`, `evals/det/memoria/efeito.eval.ts`, `evals/det/conversa/como-pensei.eval.ts` (novos), `evals/det/mapa.ts`, `evals/det/telemetria/privacidade.eval.ts`, `evals/det/telemetria/cobertura.eval.ts` (tira a lista `SEM_EMISSOR_AINDA` e faz a coleta emitir `ritu_memoria_edicoes_total` por `tocarMemoria` e `ritu_conta_apagada_total` por `apagarConta`, com os rótulos declarados; decisão A8)
- depende de: T13
- leitura: nenhuma (siga `evals/det/seguranca/toques-casa.eval.ts` e `evals/det/casa/efeito.eval.ts`, da 019)
- skills: nenhuma
- referencia: nenhuma
- contratos: spec linhas 581–587 e 108. Relógio fixo em todo eval (nada de hora real).
- testes primeiro: os próprios evals.
- comandos: `npm run eval:det`, `npx vitest run --config vitest.eval.config.ts evals/det/mapa`, `rtk bypass npm run lint`
- pronto quando: `eval:det` e o mapa verdes.
- fora: código de `src/`.

### T16 · Extract the quiz, the always-avoid choice and the city search from onboarding
- nivel: tela
- objetivo: quiz, escolha de "evitar sempre" e busca de cidade viram componentes reusáveis em `src/components/ritu/`, sem mudar o onboarding.
- arquivos: `src/components/ritu/quiz/`, `src/components/ritu/evitar/`, `src/components/ritu/cidade/` (novos), `src/app/(comecar)/comecar/quiz/quiz.tsx`, `src/app/(comecar)/comecar/evitar/escolher-evitar.tsx`, `src/app/(comecar)/comecar/dosha/escolher-dosha.tsx` (passam a usar os extraídos)
- depende de: nenhuma
- leitura: `.docs/DEVELOPMENT.md` §"UI"
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos: spec linhas 116–117. Cada componente recebe por props o destino da gravação (o onboarding grava nas rotas de `/api/onboarding/*`; Você gravará em `POST /api/perfil`) e o que fazer ao terminar. Textos continuam de `config`; os textos soltos que existirem nos três arquivos (por exemplo "Digite N letras ou mais") vão para `config` com `formatar`.
- testes primeiro: o E2E da entrada e do onboarding continua verde (`CI=1 npm run test:e2e -- e2e/comecar.spec.ts e2e/entrada.spec.ts`; confira os nomes em `e2e/`).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`, o E2E acima, `npm run dup`
- pronto quando: onboarding igual ao de antes, E2E verde, componentes prontos para reuso.
- fora: `/voce`, core.

### T17 · Show the data deleted notice on the entry page
- nivel: tela
- objetivo: a Entrada mostra "Seus dados foram apagados." com `?aviso=dados_apagados`.
- arquivos: `src/core/accounts/entrada.ts` (acrescentar `"dados_apagados"` à lista `AVISOS`; o tipo já tem) e o teste dele, a página da Entrada e o componente de aviso dela (`grep -rn "AvisoDaEntrada" src/app src/components` mostra onde)
- depende de: T2
- leitura: nenhuma
- skills: `frontend-design`
- referencia: nenhuma
- contratos: spec linhas 271 e 89 (`role="status"`). Siga como os outros avisos da Entrada aparecem.
- testes primeiro: um caso novo no E2E da Entrada (`e2e/entrada.spec.ts` ou o nome que existir): `/?aviso=dados_apagados` mostra o aviso em `role="status"`; axe nos dois temas.
- comandos: `npm run typecheck`, `rtk bypass npm run lint`, `npm run build`, o E2E da Entrada
- pronto quando: aviso visível e anunciado; E2E verde.
- fora: a ação de servidor.

### T18 · Build the memory levels of Você
- nivel: tela
- objetivo: os sete níveis de "O que sei sobre você", com as folhas e confirmações deles.
- arquivos: `src/components/ritu/voce/use-voce.ts`, `nivel.tsx`, `item-memoria.tsx`, `fixos.tsx`, `gostos.tsx`, `faltas.tsx`, `rotina.tsx`, `padroes.tsx`, `conversa.tsx`, `casa.tsx` (novos)
- depende de: T13, T16
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §11
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar), `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos: spec linhas 68–85 (critérios), 154–162 (direção visual), 520–546 (ícones e componentes), 299–332 (tipos de `MemoriaNaTela`). Siga `src/components/ritu/casa/use-casa.ts` (019) para o hook (rota, troca pela resposta, toast, `toque_invalido` relê `GET /api/voce`, `401` volta à Entrada).
- testes primeiro: nenhum de unidade (E2E na T22).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: gates verdes; componentes prontos para a página.
- fora: carta, conta, página, Como pensei.

### T19 · Build the dosha card, the account and the Você page
- nivel: tela
- objetivo: a carta do dosha, a folha "Já sei meu dosha", a Conta e a página `/voce` montada.
- arquivos: `src/components/ritu/voce/voce.tsx`, `carta-dosha.tsx`, `folha-dosha.tsx`, `conta.tsx` (novos), `src/app/(app)/voce/page.tsx`, `src/app/(app)/voce/loading.tsx`
- depende de: T14, T18
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/BUSINESS.md` §13
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar), `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos: spec linhas 60–66 e 86–89 (critérios), 154–162 (direção visual), 532–555 (componentes e páginas), 290–298 (`PainelDoDosha`). Nota: `VoceNaTela.painel` traz elementos e qualidades como listas; a carta os une em texto ("ar e espaço", vírgula e "e" antes do último). R4 proíbe importar valor do core: use uma função local em `src/components/` (a do core é `listaEmPalavras`, em `src/core/accounts/painel.ts`; se o `dup` acusar, mova-a para `src/lib/` e importe dos dois lados).
- testes primeiro: nenhum de unidade (E2E na T22).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: `/voce` renderiza a demonstração em modo e2e; gates verdes.
- fora: níveis (T18), quiz (T20), Como pensei.

### T20 · Build the quiz retake page
- nivel: tela
- objetivo: `/voce/quiz` refaz o quiz e grava por `POST /api/perfil`.
- arquivos: `src/app/(app)/voce/quiz/page.tsx`, `src/app/(app)/voce/quiz/loading.tsx` (novos)
- depende de: T13, T16
- leitura: nenhuma
- skills: `frontend-design`, `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos: spec linhas 66, 143 e 553.
- testes primeiro: nenhum de unidade (E2E na T22).
- comandos: `npm run typecheck`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: gates verdes.
- fora: onboarding, `/voce`.

### T21 · Build the Como pensei page
- nivel: tela
- objetivo: `/como-pensei/[runId]` mostra a linha do tempo com o fio e os detalhes recolhidos.
- arquivos: `src/components/ritu/como-pensei/linha-do-tempo.tsx`, `src/components/ritu/como-pensei/total.tsx` (novos), `src/app/(app)/como-pensei/[runId]/page.tsx`, `src/app/(app)/como-pensei/[runId]/loading.tsx`
- depende de: T13
- leitura: `.docs/DESIGN.md` §3 e §4; `.docs/OBSERVABILITY.md` §2
- skills: `frontend-design` (antes), `web-design-guidelines` (antes de entregar), `next-best-practices` (`rsc-boundaries.md`)
- referencia: nenhuma
- contratos: spec linhas 91–97 (critérios), 160–161 (direção visual), 419–435 (tipos), 520–555 (ícones, componentes, página). `notFound()` para `runId` não uuid ou run sem dono.
- testes primeiro: nenhum de unidade (E2E na T23).
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`, `npm run build`
- pronto quando: a página renderiza um run da demonstração em modo e2e; gates verdes.
- fora: Você.

### T22 · Write the Você E2E and take its screenshots
- nivel: tela
- objetivo: `e2e/voce.spec.ts` cobre os critérios de Você e do quiz e grava as screenshots com `SCREENSHOTS=1`.
- arquivos: `e2e/voce.spec.ts` (novo); correções pontuais em `src/components/ritu/voce/*` só se o E2E revelar defeito (diga quais)
- depende de: T17, T19, T20
- leitura: nenhuma (siga `e2e/casa.spec.ts` e `e2e/como-ficou.spec.ts`)
- skills: `web-design-guidelines`
- referencia: nenhuma
- contratos: spec linha 560 (o que o spec cobre), 109 (acessibilidade), 637 (screenshots: `.plans/020-voce-<cheia|vazia|sem-dosha|evitar>-<light|dark>-<celular|desktop>.png` e `.plans/020-quiz-resultado-…`). Nota: inclua o axe de `/voce` nos dois temas com o dosha misto (as abas da carta usam a tinta do papel no escuro; o contraste já quebrou uma vez, T19) e com uma folha aberta.
- testes primeiro: o próprio spec.
- comandos: `npm run build`, `CI=1 npm run test:e2e -- e2e/voce.spec.ts`, depois com `SCREENSHOTS=1`. Reverta `.plans/017-*.png` regravados.
- pronto quando: E2E verde nos dois projetos; screenshots gravadas.
- fora: Como pensei, core.

### T23 · Write the Como pensei E2E and take its screenshots
- nivel: tela
- objetivo: `e2e/como-pensei.spec.ts` cobre os critérios de Como pensei e grava as screenshots.
- arquivos: `e2e/como-pensei.spec.ts` (novo); correções pontuais em `src/components/ritu/como-pensei/*` só se o E2E revelar defeito (diga quais)
- depende de: T21, T22
- leitura: nenhuma (siga `e2e/conversa.spec.ts`)
- skills: `web-design-guidelines`
- referencia: nenhuma
- contratos: spec linhas 561, 99, 97 e 637 (`.plans/020-como-pensei-<fechado|aberto>-<light|dark>-<celular|desktop>.png`).
- testes primeiro: o próprio spec.
- comandos: `npm run build`, `CI=1 npm run test:e2e -- e2e/como-pensei.spec.ts`, depois com `SCREENSHOTS=1`. Reverta `.plans/017-*.png` regravados.
- pronto quando: E2E verde nos dois projetos; screenshots gravadas.
- fora: Você, core.

### C6 · Remove the rule copies left by the touches and the timeline
- nivel: mecanica
- objetivo: cada regra repetida nas tarefas da 020 passa a existir uma vez só, sem mudar comportamento.
- arquivos: `src/core/touches/index.ts`, `src/core/touches/perfil.ts`, `src/core/touches/memoria.ts`, `src/core/touches/gosto.ts` (e os testes deles, se precisarem), `src/infra/container.ts`, `src/app/_rotas/voce.ts`, `src/core/patterns/textos.ts`, `src/core/como-pensei/linha-do-tempo.ts`, e um arquivo novo do core se for o lugar certo para uma função compartilhada (diga qual)
- depende de: T13
- leitura: nenhuma
- skills: nenhuma
- referencia: nenhuma
- contratos: as assinaturas públicas e as respostas das rotas não mudam. As quatro cópias: (1) `fusoDaConta` existe em `src/infra/container.ts` e em `src/core/touches/index.ts` com o mesmo corpo: deixe uma no core e o container a importa. (2) `nomeDoItem` (`touches/memoria.ts`) repete o switch de `estaNaBase` (`touches/gosto.ts:7`): uma função só, por exemplo `nomeNaBase(kb, item)` em `src/core/touches/`, que devolve o nome ou `undefined`; `estaNaBase` passa a usá-la. (3) A rota `POST /api/perfil` com `acao: "quiz"` recalcula `calcularQuiz` (`src/app/_rotas/voce.ts`) além do toque: `tocarPerfil` devolve o resultado do quiz que já calculou (`{ nome, doshas, dual }`, só na ação `quiz`) e a rota o usa; a resposta HTTP fica igual. (4) `linha-do-tempo.ts` refaz as frases de estado da 012 a partir de `kb.estados`; exporte `NA_FRASE` (ou uma função que a use) de `src/core/patterns/textos.ts` e use-a; confira que as frases saem iguais.
- testes primeiro: os testes que já existem continuam verdes sem mudar o esperado; acrescente um teste de `nomeNaBase` e um da resposta do quiz vindo do toque.
- comandos: `npm run typecheck`, `npm test`, `npm run dup`, `rtk bypass npm run lint`
- pronto quando: as quatro cópias somem; gates verdes; nenhum contrato muda.
- fora: telas, evals, rotas novas.

### C7 · Show the memory dates in the person's time zone and finish the item labels and pending chips
- nivel: tela
- objetivo: as datas de Você saem no fuso da pessoa; todo botão repetido por linha diz o nome do item; o chip tocado fica `isPending`.
- arquivos: `src/core/memory/ler.ts` e `src/core/memory/ler.test.ts` (o `VoceNaTela` ganha `fuso: string`, o mesmo que `lerVoce` já recebe), `src/components/ritu/voce/item-memoria.tsx`, `rotina.tsx`, `padroes.tsx`, `gostos.tsx`, `fixos.tsx`, `use-voce.ts` (se o `isPending` por chip pedir), `config/textos-voce.ts` (só se um `aria-label` novo precisar de modelo de texto)
- depende de: T18
- leitura: nenhuma
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos: (1) spec linha 621: as datas seguem o fuso da pessoa depois de trocar a cidade. `dataCurta` em `item-memoria.tsx` usa hoje `config.clima.fusoPadrao`; passe a usar `voce.fuso`. (2) "Corrigir" e "Apagar" por nota em `rotina.tsx` e "Está certo", "Não está", "Apagar" em `padroes.tsx` ganham `aria-label` com o nome do item, como `gostos.tsx`, `faltas.tsx` e `conversa.tsx` já fazem; o texto visível não muda; modelos de texto em `config/textos-voce.ts`. (3) spec: "o botão tocado fica `isPending`": os `ToggleChip` de Gostos e de Restrições mostram o pendente do toque deles.
- testes primeiro: `ler.test.ts` confere `fuso` na visão; nas telas, a T22 cobre por E2E.
- comandos: `npm run typecheck`, `npm test`, `rtk bypass npm run lint`
- pronto quando: os três pontos resolvidos; gates verdes.
- fora: `voce.tsx`, `carta-dosha.tsx`, `folha-dosha.tsx`, `conta.tsx` e as páginas (T19).

### C8 · Give the toggle chip a real pending state
- nivel: tela
- objetivo: o `ToggleChip` base ganha `isPending` como o `Button`; os chips de Gostos e de Restrições o usam, e só o chip tocado fica pendente.
- arquivos: `src/components/base/chip.tsx` (e o teste dele, se houver), `src/components/ritu/voce/gostos.tsx`, `src/components/ritu/voce/fixos.tsx`, `src/components/ritu/voce/use-voce.ts` (só se a chave do pendente por chip pedir)
- depende de: C7
- leitura: nenhuma (siga `src/components/base/button.tsx`, `isPending`, perto da linha 104)
- skills: `frontend-design`, `web-design-guidelines`
- referencia: nenhuma
- contratos: spec: "o botão tocado fica `isPending`". Hoje (C7) o chip tocado recebe `aria-busy` e `opacity-60`, mas segue tocável (um segundo toque grava de novo) e `opacity-60` é o mesmo visual de `data-disabled`. (1) `ToggleChip` aceita `isPending?: boolean`: bloqueia o toque, expõe `data-pending` e `aria-busy`, com visual próprio de espera (cursor `progress`, como o `Button`), distinto do desabilitado; o foco não sai do chip. (2) Em Restrições, só o chip tocado fica pendente (hoje `pendente === "restricoes"` escurece o grupo). (3) Em Gostos, a lógica de alternância fica numa função só, usada pelo `onChange` e pela chave do pendente (`chaveGosto`). Tire o `aria-busy`/`opacity-60` manual da C7.
- testes primeiro: se `chip.tsx` tiver teste, o caso `isPending` (não dispara `onChange`, tem `data-pending`); o resto o E2E da T22 cobre.
- comandos: `npm run typecheck`, `npx vitest run src/components src/architecture.test.ts`, `rtk bypass npm run lint`, `npm run dup`
- pronto quando: os três pontos; gates verdes; a página `/marca` (que mostra o chip) não quebra.
- fora: outras telas.

## Ondas

A partir de 85% da janela de 5 horas, no máximo 2 tarefas por vez (autorização da dona): uma onda maior é despachada em partes.

| Onda | Tarefas | Por quê |
|---|---|---|
| 1 | T1 | Migração e portas: sozinha |
| 2 | T2, T3, T4, T5, C5 | Sem dependência e sem arquivo em comum |
| 3 | T6, T8, T10, T16, T17 | Dependem de T1/T2/T5; arquivos distintos |
| 4 | T7, T9, T11 | T7 depende de T3; T9 de T1/T5; T11 de T4/T6 |
| 5 | T12 | Depende de T7 |
| 6 | T13 | Container e rotas: usado por tudo que vem depois |
| 7 | T14, T15, T18, T20, T21 | Dependem de T13 (e T16); arquivos distintos |
| 8 | T19, C6, C7 | Monta a página com os níveis e a ação; C6 tira as cópias de regra; C7 acerta datas, rótulos e pendente dos níveis (sem arquivo em comum entre as três) |
| 9 | C8 | Chip base com `isPending` (mexe em componente base: sozinha) |
| 10 | T22 | E2E de Você (build e porta 3000) |
| 11 | T23 | E2E de Como pensei (build e porta 3000) |
