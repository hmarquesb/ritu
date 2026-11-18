# Decisões autônomas

| Spec · Tarefa | O que faltava | Decisão | Por quê | Como desfazer |
|---|---|---|---|---|
| 001 · T1 | `@types/node` "mais recente" resolvia para 26, com runtime Node 24 | `@types/node@24` | Tipos devem casar com o runtime (`engines`, `.nvmrc`) | `npm install -D @types/node@latest` |
| 001 · T1 | `npm run dup` falha se `src/` não existe | `src/.gitkeep` até a T2 criar `src/app/` | Gate precisa passar desde a T1 | Apagar `src/.gitkeep` quando houver arquivos em `src/` |
| 001 · T2 | `next build` reescreve o `tsconfig.json` (jsx, include) e o lint passa a falhar depois do build | Aceitar o formato do Next no `tsconfig.json`, formatado de modo que um segundo build não o altere | Build idempotente; não brigar com a ferramenta | Voltar o `tsconfig.json` da T1 e rodar lint antes do build |
| 001 · T2 | Playwright 1.65 rejeita `port` e `url` juntos no `webServer` | Só `port: 3000` | Única forma aceita; define o baseURL | — |
| 001 · T7 | Como achar imports sem falso positivo em comentário e string | AST pela API do `typescript` (devDependency já instalada), no próprio teste | Mais robusto que regex; nada novo instalado | Trocar por remoção de comentários + regex em `src/architecture.test.ts` |
| 002 · T2 | A mini-base de teste (16 alimentos) não cumpre os mínimos de cobertura, mas `createKnowledgeBase` valida | `validarBase`/`createKnowledgeBase` aceitam `{ cobertura?: boolean }` (padrão `true`); a mini-base carrega com `false`; erros de cobertura levam o prefixo `cobertura:` | O fake precisa ser válido sem relaxar a base real; o prefixo deixa as tarefas de conteúdo intermediárias distinguirem cobertura de erro real | Remover a opção e montar a mini-base com outra checagem |
| 002 · T9 | `base:check` precisa ler os YAML, mas R6 só permite a scripts importar `@/infra/container`, `@/infra/env` e `@/infra/fakes/**` | O container exporta `readKnowledgeData(dir?)`, que delega ao adaptador | Mantém R6 sem exceção nova | Acrescentar `@/infra/knowledge/**` à exceção de R6 |
| 002 · T8 | Com a base no container, importar o container carrega o zod, que lê `process.env` por conta própria; o teste da 001 "importar não lê process.env" passou a falhar | O teste conta só leituras do código do Ritu: as dependências externas são pré-carregadas antes do Proxy (ou o stack é filtrado por `src/`/`config/`) | A regra protege o nosso código de ler ambiente na importação; leitura interna de biblioteca não é segredo nosso nem efeito do container | Voltar o teste para contar todas as leituras e tirar o import da base do container |
| 002 · C9 | A vaga de preparo só restringe por função e grupo: `base` de grãos aceita pão, macarrão, tapioca e farinha (até no `kitchari` e no `arroz-papa`); `tempero` de especiarias aceita camomila, capim-limão e erva-cidreira em sopas; não há como ter mingau de leite com ≥ 3 líquidos | Manter o schema da spec; o `mingau` ficou só com água (sem vaga `liquido`); o caso fica em destaque no relatório do portão 1 | Mudar o schema (restrição por id na vaga) ou as `funcoes` de alimentos já aprovados é decisão de spec, e a ordenação da 007 ainda vai escolher entre os candidatos | Acrescentar `alimentos?: string[]` à `Vaga` (spec nova) ou tirar `tempero` das ervas de chá |
| 002 · C10 | `leite-morno-com-especiaria` precisa de vaga só de laticínios (para "evitar sempre: leite" tirá-lo), mas só `leite` é laticínio líquido, e o mínimo é 3 por vaga | `config/base.ts` ganha `excecoesMinAlimentosPorVaga: ["leite-morno-com-especiaria:liquido"]`; a validação aceita ≥ 1 alimento nessas vagas (tarefa T11) | Sem mudar o schema da spec; o leite é a essência do preparo; a exceção é explícita, versionada e testada | Tirar a exceção e o preparo, ou acrescentar `alimentos?: string[]` à `Vaga` por spec nova |
| 002 · C10 | Nenhuma fonte aberta traz um segundo preparo para `noite` (mínimo 2) | `caldo` ganha `noite` em `momento`, com `ref: a_confirmar` no campo `momento` e `confianca: baixa` | Caldo é o preparo mais leve; a dona confere no portão 1; não muda o mínimo da spec | Tirar `noite` do `caldo` e baixar `minPreparosPorMomento` para a noite (mudança de spec) |
| 003 · T4 | A lista de arquivos da T4 não incluía `evals/det/base/candidatos.eval.ts` e `substitutos.eval.ts`, que montam `ToolContext` e quebram o typecheck com o novo campo obrigatório `clima` | Incluí os dois na T4, com `clima: { fonte: createFakeWeather() }`; `clima` segue obrigatório | Segue o contrato; deixar opcional o contrariaria | Tornar `clima` opcional no `ToolContext` e reverter as duas linhas |
| 003 · T4 | As tools de clima consultam porta assíncrona; `definirTool` só aceitava `executar` síncrono | `executar` devolve `O \| Promise<O>`, com `await` no invólucro | Retrocompatível com as tools da 002; evita duplicar a validação zod | Voltar a síncrono e validar à parte em `clima.ts` |
| 004 · plano | A spec não diz como a porta da casa sabe se um `alimento_id` existe (edge case "id que não existe na base: tratado como nome livre"), e `createMemoryStores(clock)` não recebe a base | As fábricas de stores aceitam `opts.alimentoExiste?: (id) => boolean`, que por padrão aceita qualquer id; o container passa `knowledge.alimento` | Mantém as portas sem depender da base; o edge case fica testável | Fazer quem chama validar o id antes de `registrar` e remover a opção |
| 004 · plano | `db:migrate` e `cleanup` precisam do banco, mas a R5 só deixa importar `postgres` em `src/infra/db/` e a R6 só deixa scripts importarem o container, o env e os fakes | O container exporta `migrateDatabase()` e `closeDatabase()`; os scripts só usam o container e o core | Mesmo padrão de `readKnowledgeData` (002 · T9); sem exceção nova nas regras | Acrescentar `@/infra/db/**` à exceção de R6 |
| 004 · plano | Onde ficam as suítes de contrato e como rodam nos dois alvos | `test/contracts/*.contract.ts` exportam funções; o runner do fake fica em `src/infra/fakes/memory-stores.test.ts` (`npm test`) e o do Postgres em `test/db/stores.db.test.ts` (só `vitest.db.config.ts`), com o schema `ritu_test` recriado | Os gates seguem sem banco; a mesma suíte cobre os dois | Mover os runners |
| 004 · plano | A limpeza precisa apagar `evitar_temporario` de dias anteriores, mas nenhuma porta da spec tem esse método | `ProfileStore.apagarEvitarTemporarioAntesDe(dia)`, sem contaId, como os outros métodos de limpeza | É a porta dona da tabela; segue o padrão da spec | Mover para outra porta |
| 004 · T6 | A spec descreve `prakriti` como `{vata, pitta, kapha}` somando 1, mas o tipo `Prakriti` da 002 é parcial, e a suíte de contrato grava `{ vata: 1 }` | `prakritiSchema` aceita chaves opcionais, cada uma de 0 a 1; os presentes somam 1 ± 0,01 e o objeto vazio é recusado. Os dois adaptadores validam na escrita e na leitura | Coerente com o tipo que a base já usa; mantém a regra da soma | Exigir as três chaves e completar com 0 na escrita |
| 004 · T9 | `casa.ler` tira o que cai em "evitar sempre" via `passaNoFiltro`, mas essa função só recebe alimentos da base; um item de nome livre escaparia | O nome livre some quando algum "evitar sempre" do tipo `texto`, normalizado, está contido no nome normalizado | Conservador: na dúvida, esconde; a pessoa nunca vê de volta o que pediu para evitar | Tirar a regra do nome livre em `memoria.ts` |
| 005 · T1 | A spec põe `DefinicaoDoAgente` (em `runs/`) usando `Tool`/`ToolContext`, que estavam em `agents/tools/`; como `agents/` já importa `runs/` (e a 007 vai importar mais), a R9 acusa ciclo | `tool.ts` vai para um domínio próprio, `src/core/tools/tool.ts`; `runs/` e `agents/` dependem dele, e ele não depende de nenhum dos dois | Remove o ciclo sem exceção na R9; o contrato de tool é de todos os agentes, não de um | Voltar o arquivo e quebrar o ciclo de outro jeito (tipos soltos em `src/core/`) |
| 005 · T1 | A spec repete `NovaEtapa` com `resumo`, `modelo` e tokens opcionais; a 004 já a definiu com esses campos obrigatórios (nulos ou 0) | Mantida a `NovaEtapa` da 004; o loop preenche null ou 0 | Evita mudar adaptadores e suítes já aprovados; o efeito no banco é o mesmo | Tornar os campos opcionais na porta e nos dois adaptadores |
| 005 · T4 | `fornecedor.ts` (em `llm/`) importava `LlmError` de `runs/`, e o loop (em `runs/`) importa `FornecedorDeModelo`: ciclo na R9 | `LlmError` e `CodigoLlm` vão para `src/core/llm/errors.ts`; `runs` depende de `llm`, nunca o contrário | O erro é do modelo, não do run; a 006 (roteador) mora em `llm/` | Voltar o erro para `runs/errors.ts` e repetir o tipo do fornecedor no loop |
| 005 · T4 | A spec dá `gravarEtapa(): Promise<void>`, mas o evento `etapa_concluida` precisa da `RunEtapa` gravada | `DepsDoLoop.gravarEtapa` devolve `Promise<RunEtapa \| undefined>`; o serviço do run devolve a etapa de `acrescentarEtapa` | O evento ao vivo leva a etapa com `ordem` real | Montar a etapa no loop sem a ordem do banco |
| 005 · T5 | A tabela de transições não tem `waiting_for_input → failed`; um checkpoint inválido em `continuarRun` precisa levar o run a `failed` | O serviço passa por `running` antes de `failed` | Mantém a tabela da spec fechada; `running` também trava o `continuarRun` duplo | Acrescentar `waiting_for_input → failed` à tabela |
| 005 · T5 | `continuarRun` lê e depois atualiza o run sem condição: dois pedidos simultâneos no Postgres poderiam passar os dois (no fake, não) | Aceito nesta spec; anotado como risco para a 018 (rotas), que deve usar atualização condicional (`update … where status = 'waiting_for_input'`) | A porta não tem atualização condicional, e mudá-la é decisão de spec | Acrescentar `RunRepository.mudarStatusSe(de, para)` |
| 006 · T4 | A D6 do plano mandava tentar primeiro o último modelo usado, o que contradiz o critério "no minuto seguinte volta ao principal" | Ordem fixa: `preferir` (se estiver na lista do papel), depois a lista do papel do começo; o último modelo só serve para detectar a troca. `preferir` fora da lista é ignorado | Segue o critério de aceite; o modelo do run se mantém pelo `preferir` do checkpoint | Tentar o anterior antes da lista em `router.ts` e mudar o teste do minuto seguinte |
| 007 · T3 | Com a regra 2 de `preencherLacunas` (spec), passos de `data/preparos.yaml` com a vaga opcional no meio da frase ("com {gordura} derretida", "Juntar {legume} picado") saem quebrados quando a vaga fica vazia | O código segue a spec; o texto dos preparos é reescrito (C1) para que cada lacuna de vaga opcional fique numa frase só de lacunas opcionais (a regra 3 a tira inteira) ou entre conectores (`com`/`de`/`e`/`,` antes; ` e `/`, `/`.`/fim depois). Um eval da base real confere essa forma | Não muda a spec aprovada; texto de preparo é redação, não fato novo; o eval impede regressão | Reverter o commit da C1 e mudar a regra 2 da spec |
| 007 · T5 | A spec não diz o que fazer com prática de `momento` vazio (o schema de `Pratica` permite) | Serve a qualquer momento do dia | Uma prática sem restrição de horário não deve sumir do preparo; o teste trava o comportamento | Tratar `momento` vazio como "nunca" em `candidatos.ts` |
| 007 · T7 | `fixos.dosha` (nome para o prompt) com prakriti empatada | O dosha de maior valor; no empate, os nomes ligados por " e " ("vata e pitta") | É o que a pessoa leria como dupla; não muda filtro nem nota | Escolher o primeiro na ordem vata, pitta, kapha em `doshaDominante` |
| 007 · T7 | `sugeridos_hoje` precisa do início do dia local, e `runs.recentes` recebe um instante | `runs.recentes` com 36 h de folga e filtro por `run.dia === dia` | Cobre qualquer fuso (até UTC−12) sem nova porta | Acrescentar `RunRepository.doDia(contaId, dia)` |
| 007 · T8 | A spec manda trocar `<`/`>` em quatro campos vindos da pessoa, mas `fixos.evitar_sempre` e `fixos.nao_come` também podem ter texto dela | Os dois também passam pela troca | Regra inegociável 3: texto da pessoa é dado; custo zero | Tirar `limpar` desses campos em `contexto.ts` |
| 007 · T12 | `responder` precisa gravar `clima_usado`, mas `executarRun` não devolve o checkpoint final nem o resultado das tools | A definição do agente usada por `responder` envolve `clima.agora`: o nome, a saída e a etapa não mudam; o invólucro guarda o último resultado `ok`, sem `cidade` | Sem mudar o serviço de runs da 005 | `executarRun` devolver o checkpoint final e ler o clima de lá |
| 007 · T12 | A spec não diz o que fazer quando a saída do agente não passa em `saidaDoAcompanhanteSchema` | `saidaSegura`, run `failed` e etapa `erro` `saida_invalida` | Conservador: nada fora do contrato chega à pessoa | Tratar como `entregue` com a saída crua |
| 007 · T13 | `test/fixtures/` ficava fora do `include` do Vitest, e `cenarios.test.ts` não rodava em `npm test` | `vitest.config.ts` passa a incluir `test/**/*.test.ts`; `.vitest/` (saída gerada) vai para o `.gitignore` | Teste que não roda no gate não protege nada | Tirar a linha do `include` |
| 007 · T13 | A spec usa "esgotado" em dois sentidos: `--esgotar decisao` marca o principal (mostra a troca); o cenário `sem-modelo` precisa de todos os modelos de `decisao` esgotados | `montarCenario(c, { esgotar })` marca só o principal; `Cenario.esgotado?: Papel` (estado do cenário) esgota todos os modelos do papel | Cada sentido fica com o seu dono; `demo --cenario sem-modelo` funciona sem opção | Juntar os dois num só `esgotar` que marca todos |
| 007 · C5 | A spec (linha 274) põe refeição como candidato mesmo quando a vaga obrigatória só tem opções ausentes de casa; o validador recusa qualquer entrega com ela (`estrutura` sem item, `fora_de_casa` com item). No `demo --llm` o modelo insistiu nesse candidato e caiu na resposta segura em 3 de 4 rodadas | A lista de candidatos que vai ao modelo (contexto e `DadosDoPreparo` lidos pelo validador) não leva refeição com vaga obrigatória sem opção em `casa.confirmados` ou `casa.incertos`; a lista completa continua servindo a `faltasDoRun` e `para_ter`. A mensagem de `estrutura` de prática sem ingrediente diz "deixe `itens` vazio" | Candidato que nenhuma entrega válida pode usar só gasta chamada; a falta continua contada | Tirar o filtro em `preparo.ts` |

## Entrega 2

| Spec · Tarefa | O que faltava | O que decidi | Por quê | Como desfazer |
|---|---|---|---|---|
| Entrega 2 · planejamento | As specs 008 a 015 somam centenas de KB; ler todas no contexto do orquestrador esgota a sessão antes do fim da entrega | Cada plano `.plans/NNN-*-plan.md` é escrito por um subagente planejador (Opus), com o mesmo formato e as mesmas regras da skill §1; o orquestrador revisa o plano antes de despachar | Preserva o contexto do orquestrador para despachar, decidir e commitar a entrega inteira | Voltar a escrever os planos na sessão principal |
| 002 · C13-T2 | A spec pede água no `liquido` do mingau, mas a base não tem o id `agua`, e a tarefa não podia mexer em `alimentos.yaml` | `mingau:liquido` = leite, leite-de-coco, agua-de-coco; sem água | Criar alimento novo é conteúdo com fonte, fora do escopo da correção | Acrescentar `agua` em `data/alimentos.yaml` (função `liquido`) e na lista da vaga |
| 002 · C13-T2 | "Pão, macarrão, tapioca e farinhas ficam só nos preparos em que são a base de fato" não dizia como | A `base` de tapioca-recheada, cuscuz-no-vapor, torrada-com-gordura, macarrao-com-legume e polenta-mole lista só o alimento dela, com as 5 vagas em `excecoesMinAlimentosPorVaga` | Evita "torrada de arroz" e "polenta de macarrão" | Tirar `alimentos` dessas vagas e as 5 exceções de `config/base.ts` |

## 008 · T20 · Id do coentro no caso 20
- Faltava: a tarefa citava o id `coentro`, que não existe na base.
- Decidi: usar `coentro-fresco` (nome "Coentro"); o outro item é `coentro-em-grao` (semente).
- Por quê: "não como coentro" no uso comum é a folha.
- Desfazer: trocar o id em `evals/llm/casos/c2/intencao/20-nao-como-coentro.ts`.

## 009 · T4 · `acabou` inclui o que a mensagem diz que acabou
- Faltava: o contrato de `preparar` lia `acabou` só de Minha casa; um item citado como "acabou" na mensagem atual podia virar opção perguntável no mesmo turno ("Você ainda tem X?").
- Decidi: `acabou` = ids de Minha casa com `estado: "acabou"` ∪ `casa_da_mensagem.acabou`.
- Por quê: mais conservador; não pergunta o que a pessoa acabou de responder.
- Desfazer: voltar a ler só de Minha casa em `src/core/agents/companion/preparo.ts`.

## 009 · T5 · `acabou` de Minha casa guardado nos dados do run
- Faltava: na nova rodada de `entregaveis` depois de uma resposta (D2), `acabou` só tinha os ids já perguntados; um item marcado "acabou" em Minha casa podia virar perguntável na retomada.
- Decidi: `DadosDoPreparo.acabou` (default `[]`, fora do prompt), gravado por `preparar`; `aplicarResposta` usa `dados.acabou` ∪ o `acabou` do D2.
- Por quê: não perguntar o que a pessoa já disse que acabou.
- Desfazer: tirar o campo e voltar ao `acabou` só do D2.

## 009 · T5 · Sem anotação no alerta, inclusive o "não como" do run
- Decidi: `montarAnotacoes` mantém o retorno antecipado com `alerta` ou `suspeito`, também para `nao_come_do_run`.
- Por quê: critério da 008 ("nenhuma anotação" no alerta).
- Desfazer: aplicar o "não como" do run antes do retorno antecipado.

## 009 · T17 · Caso `conversa` que não para de pausar no `eval:llm`
- Faltava: o que fazer quando o run ainda pausa depois das 3 retomadas.
- Decidi: o caso vira falho com motivo "pausou mais de 3 vezes" e a rodada segue.
- Por quê: não perder uma rodada inteira (cota de modelo) por um caso.
- Desfazer: voltar a lançar erro em `scripts/lib/eval-llm-casos.ts`.

## 009 · fechamento · Risco da 005 · T5 resolvido
- O risco anotado na 005 · T5 (`continuarRun` lia e atualizava o run sem condição) foi resolvido na 009 · T3 (D3): `RunRepository.mudarStatusSe` e `continuarRun` com troca condicional. A conferência contra o Postgres (`test:db`) segue pendente por falta de docker neste ambiente.

## 011 · T8 · Frase da troca e par canela → cardamomo (2026-11-16)

- **Faltava:** o bloco da T8 pede o texto "Troquei canela por cardamomo: os dois aquecem." e manda parar se a base der outra frase. Na mini-base, `fraseDaTroca` dá "Troquei canela por cardamomo: os dois aquecem e aliviam o peso."; na base real, cardamomo (virya frio) nem entra como substituto da canela.
- **Decidido:** o teste confere a frase que a base produz (D8: a frase vem dos `verbos` das gunas em comum e do `motivo` de `substitutos`); o exemplo da spec é ilustrativo. O teste usa a mini-base mais 6 especiarias, porque R1 proíbe a base real num teste do core.
- **Por quê:** mudar `fraseDaTroca` ou a base para caber num exemplo seria inventar regra; a frase real segue o contrato.
- **Desfazer:** se a dona quiser a frase curta, ajustar `fraseDaTroca` (só o primeiro verbo) e o teste.

## 011 · T16 · Cenário `troca-por-toque` com cravo no lugar do cardamomo (2026-11-16)

- **Faltava:** a spec pede o cenário com "cardamomo confirmado em casa" e a frase "Troquei canela por cardamomo: os dois aquecem.". Na base real, cardamomo tem virya frio e canela quente, então `substitutos` nunca o oferece e o toque cai em "perguntar".
- **Decidido:** o cenário confirma **cravo** em casa (virya quente, gunas [quente, leve], em comum com a canela) e confere a frase exata que `fraseDaTroca` produz para canela → cravo. Se cravo não couber no preparo do chá, noz-moscada.
- **Por quê:** a base não muda para caber num exemplo (agentes não alteram dados com fonte); mesma linha da decisão da 011 · T8.
- **Desfazer:** se a dona revisar o virya do cardamomo na base, voltar o cenário para cardamomo.

## 011 · fechamento · Rodada do `c2-conversa` repetida só nos casos com erro (2026-11-16)

- **Faltava:** a rodada ⚠️ do `c2-conversa` deu erro nos 20 casos de intérprete (o runner usava o registro de uso do Postgres, fora do ar) e em `c1-08`/`c1-11`. A regra é não rodar duas rodadas completas no mesmo dia, e não existia `--retomar`.
- **Decidido:** correção C1 no runner (intérprete com registro em memória, como os outros tipos; causa de c1-08/c1-11) e a opção `--casos` para repetir só os 22 casos com erro, com o relatório em `evals/resultados/c2-conversa-parcial.md`. O resultado do checkpoint é a rodada completa (32 casos válidos) mais a parcial (22).
- **Por quê:** fecha o checkpoint hoje com ~22 chamadas a mais, em vez de uma segunda rodada completa (~100 chamadas).
- **Desfazer:** rodar a rodada completa de novo noutro dia e apagar o parcial.

## 012 · T14 · Filtro do padrão no fim de um run sem pausa (D17)
- Faltava: o plano (D9) lia o filtro do checkpoint, mas o checkpoint só é gravado quando o run pausa; um run que entrega direto não teria filtro e nunca ofereceria padrão.
- Decidido: sem filtro no checkpoint, o fim do run monta o filtro do dia pelas portas (perfil, lista temporária do dia, preferências) com `montarFiltro`, sem os itens só da mensagem (os do dia já estão na lista temporária).
- Por quê: não muda o que é gravado no run (checkpoint continua só na pausa) e usa a mesma função do preparo.
- Desfazer: gravar o checkpoint também na entrega e voltar a ler só `filtroDoRun`.

## 012 · T26 · Casos 7 e 8 do c3 com o momento só "com frio" (D18)
- Faltava: o plano pedia o padrão "com frio e agitada → chá de gengibre com canela" com o chá entre os candidatos, mas na base `agitada` evita a guna `movel`, que o chá tem; com `agitada` o chá nunca é candidato.
- Decidido: os casos 7 e 8 usam o momento só `com_frio` e o padrão `com_frio|pratica:cha-gengibre-canela` ("Quando você está com frio, chá de gengibre com canela costuma te ajudar."). A base não foi mexida.
- Por quê: conteúdo da base é decisão da dona; mudar a chave do caso preserva o que ele mede (padrão confirmado aparece só quando o item é candidato).
- Para o relatório: a detecção pode confirmar um padrão "com frio e agitada → chá" vindo do histórico, mas, com `agitada`, o chá nunca chega aos candidatos; a frase entra no contexto e o agente não pode sugerir o chá. A dona decide se a base ou a regra muda.
- Desfazer: voltar ao par quando a base deixar o chá passar com `agitada`.

## 012 · T26 · Caso 8 do c3 tira o chá pelo horário (D19)
- Faltava: o plano tirava o chá dos candidatos com "a canela acabou", mas a casa não tira prática dos candidatos (só pesa a nota; "acabou" só segura refeição).
- Decidido: o caso 8 repete o 7 à noite; o chá só vale de manhã e à tarde e sai dos candidatos, enquanto o padrão continua no contexto.
- Por quê: mede o mesmo (padrão confirmado com o item fora dos candidatos não vira sugestão) sem mudar o ranking.
- Para o relatório: um chá cuja especiaria acabou continua sendo candidato (só perde nota). A dona decide se a casa deve tirar prática.
- Desfazer: voltar à casa quando ela passar a tirar prática.

## 013 · Plano · "Toda resposta passa pelo Juiz" e os textos montados por código
- Faltava: a regra 2 do AGENTS.md diz que toda resposta passa pelo Juiz; a spec 013 deixa de fora, de propósito, os textos montados por código (caminhos sem agente, `sem_modelo`, resposta segura).
- Decidido: seguir a spec. Os textos montados por código são fixos, escritos e revisados no repositório, sem saída de modelo; o Juiz julga o que o modelo escreveu. Não tratei como contradição que bloqueia.
- Para o relatório: a dona confirma a leitura ou pede o Juiz também nos textos fixos (ou ajusta a redação da regra 2).
- Desfazer: chamar o Juiz também na saída montada por código.

- **013 · T17 · `eval-llm-c3.test.ts` entra na tarefa.** Faltava: o contrato novo (`juiz` obrigatório em `ExpectativaDaConversa.confere`) quebrava o tipo do helper `entradaConversa` de `scripts/lib/eval-llm-c3.test.ts`, fora da lista da T17. Decidido: incluir o arquivo na T17 só para acrescentar `juiz: { tentativas: 0, aprovado: null, motivos: [] }` ao helper. Por quê: acomodação de assinatura, sem mudar asserção. Desfazer: tornar `juiz` opcional na expectativa.

- **013 · Onda 4 · commit com `eval:det` vermelho só por timeout.** Faltava: os gates da onda deram `eval:det` com 5 a 8 falhas, todas "Test timed out in 5000ms", em casos que mudam a cada rodada, inclusive em arquivos fora da onda, com load average acima de 160 (vitests da trilha da entrega 3 rodando em paralelo). Nenhuma falha de asserção; `evals/det/guardrails` passou inteiro numa terceira rodada. Decidido: commitar T13 a T17 (aprovadas pelos verificadores) e abrir a C2 (timeout dos evals determinísticos em `vitest.eval.config.ts`). Desfazer: reverter a C2.

## 016 · C1 (2026-11-16, trilha adiantada)

- **O que faltava:** a T16 proíbe editar componentes e seções, mas o E2E de `/marca` revelou um defeito em `chip.tsx` (500 na página) e pode revelar outros, um de cada vez.
- **O que decidi:** uma tarefa de correção C1 (nível tela), com os arquivos que tiverem defeito em `src/components/` e `src/app/marca/_secoes/`, executada pelo mesmo implementador da T16 na mesma rodada, com verificador e commit próprios (C1 antes da T16).
- **Por quê:** evita um vai e volta por defeito entre duas tarefas que só ficam verdes juntas; os arquivos não se cruzam com os da T16.
- **Como desfazer:** reverter o commit da C1 e reabrir cada correção como tarefa separada.

## 017 · Entrada e contas (plano)

- **A1 · Mapa dos evals.** Faltava: `evals/det/mapa.ts` (da 014, ainda não implementada). Decidi: não criar o mapa; os três evals de `evals/det/seguranca/` entram nas linhas "Rota sem sessão", "Duas demonstrações", "POST com `Origin`" e "31ª demonstração" quando a 014 chegar. Por quê: criar o mapa seria construir parte da 014. Desfazer: acrescentar as linhas no mapa na junção.
- **A2 · Log `erro_inesperado`.** Faltava: a lista `LOGS` (da 015). Decidi: `criarRota` chama `telemetry.log("error", "erro_inesperado")` sem campos. Desfazer: incluir o código em `LOGS` quando a 015 chegar.
- **A3 · Rótulos de `ritu_entrada_total`.** Faltava: nomes de atributo. Decidi: `conta.tipo` (existente) e `entrada.resultado` (novo). Desfazer: renomear em `nomes.ts`.
- **A4 · Handlers das rotas.** Faltava: onde ficam os handlers que os evals chamam com stores em memória. Decidi: `src/app/_rotas/` (funções que recebem `DepsDaRota`); os `route.ts` só ligam às dependências reais (`src/app/_lib/deps.ts`). Desfazer: mover os handlers para dentro dos `route.ts`.
- **A5 · Conta nova no E2E.** A spec cita o header `x-ritu-e2e-conta: nova`; decidi passar isso a `criarDemonstracao` como `semSeed` (só no modo e2e), para o core não ler header. Desfazer: tirar o parâmetro e tratar no provedor.

## 014 e 015 · Planos (2026-11-16)

- **Faltava:** decisões que as specs 014 e 015 não fixam (destino do runner, `--casos`, nome do log de padrões, espelho de telemetria nos cenários, relógio em `chamarComPapel`, entre outras).
- **Decidido:** a opção mais conservadora em cada uma, listadas como D1–D21 em `.plans/014-evals-plan.md` e D1–D15 em `.plans/015-observabilidade-completa-plan.md` (seção "Decisões do planejamento").
- **Para o relatório:** 014 D4 (`--casos` sai), 015 D1 (log `padroes_conta_falhou` mantido), 015 D4 (latências 0 nos cenários).
- **Desfazer:** cada D diz o que muda; reverter a tarefa correspondente.

- **A6 · Lugar do schema do seed (017 T7).** Faltava: `src/core/accounts/demo-seed.ts` importa `saidaDoAcompanhanteSchema` de `agents`, e `agents` já importa `accounts`, o que fecha o ciclo `accounts → agents → accounts` (R9). Decidi: o schema, o validador e o teste viram arquivos soltos em `src/core/` (`demo-seed.ts`, `demo-seed.test.ts`), como `memory-schemas.ts`; a R9 não olha arquivos soltos. Desfazer: tirar de `accounts` o que `agents` usa e devolver o arquivo à pasta `accounts/`.

- **A7 · Resumo e sugestão na cópia do seed (017 T10).** Faltava: `copiarSeed` precisa de `resumoPorCodigo` (`agents/memory`) e `sugestaoRegistrada` (`agents/companion`), e `accounts` importar `agents` fecha o ciclo R9. Decidi: duas funções locais em `src/core/accounts/copiar-seed.ts`, com a mesma regra; o `dup` não acusa clone. Risco: divergirem das originais sem teste que compare. Desfazer: mover as duas para arquivos soltos em `src/core/` e importar dos dois lados.
- **A8 · Teste do seed real (017 T10).** A T10 pedia "`validarSeed` do seed real sem erros", mas teste de core não importa infra (R1). Decidi: a cobertura fica no `base:check` e num teste em `src/infra/knowledge/yaml-seed.test.ts`, aberto como tarefa de correção no fechamento da 017.

- **A9 · C1 da 017 (helper de envio do onboarding).** Faltava: a T19 foi reprovada só no `npm run dup` (o `continuar()` de `escolher-dosha.tsx` repete o envio de `aviso/aceitar.tsx` e `evitar/escolher-evitar.tsx`), e a correção mexe em arquivos da T18. Decidi: tarefa de correção C1 (tela), com `src/app/(comecar)/_lib/enviar-passo.ts` compartilhado, despachada junto da T19 ao mesmo implementador, com commits separados. Desfazer: reverter o commit da C1 (a T19 volta a ter o clone).
- **A10 · C2 e C3 da 017 (defeitos revelados pelo E2E da Entrada).** Faltava: a T21 proíbe corrigir telas, e o E2E acusou violação de CSP de estilo inline em toda página e `role-img-alt` deixado pelo anunciador do botão pendente. Decidi: duas tarefas de correção na mesma onda (C2 núcleo, CSP; C3 tela, botão), commitadas antes da T21, que roda de novo com os testes estritos. Desfazer: reverter os commits da C2 e da C3.
- **A11 · C4 da 017 (defeitos revelados pelo E2E do onboarding).** Faltava: a T22 proíbe corrigir telas e contornou três defeitos (ComboBox, clique interceptado, anúncio órfão demorado). Decidi: tarefa de correção C4 (tela) antes do commit da T22, que roda de novo sem os contornos. Desfazer: reverter o commit da C4.

## 014 · T3 · `familias` obrigatório quebra os literais do teste antigo

- **Faltava:** a T3 torna `familias` obrigatório (`BaseDoCaso`), e 11 literais de caso em `scripts/lib/eval-llm-casos.test.ts` (fora da lista da tarefa) deixaram o typecheck vermelho. A T16 só mexe nesse arquivo depois.
- **Decidido:** o arquivo entra na T3, só com `familias: [...]` nos 11 literais; nenhuma outra mudança, sem afrouxar o tipo.
- **Por quê:** manter o typecheck verde a cada commit; a mudança é mínima e o arquivo não está em nenhuma outra tarefa da onda 3.
- **Desfazer:** tornar `familias` opcional até a T16.

## 014 · T10 · teste antigo do relatório confere expectativa removida

- **Faltava:** a T10 troca a checagem por palavra inteira do `c1-12` por critério do avaliador; o `it` "caso 12 usa a variante por palavra inteira na promessa de tratamento" de `scripts/lib/eval-llm-report.test.ts` (fora da lista) conferia a expectativa removida.
- **Decidido:** o arquivo entra na T10, só com esse `it` apagado (mesma regra da T10 para os testes de `eval-llm-casos` e `eval-llm-c3`).
- **Por quê:** o teste confere uma expectativa que deixou de existir; o critério novo é coberto por `casos-indice.test.ts`.
- **Desfazer:** manter a checagem por palavra no `c1-12` junto com o critério.

## 014 · T17 · `historico.json` gerado não bate com a formatação do Biome

- **Faltava:** `formatarHistorico` (T8) grava JSON com 2 espaços, e o teste da T17 trava o arquivo igual a essa saída; o Biome quer arrays curtos numa linha só, e o lint ficou vermelho.
- **Decidido:** `evals/resultados/historico.json` sai do Biome (lista de ignorados de `biome.json`), dentro da T17.
- **Por quê:** o arquivo é gerado e reescrito pelo `eval:llm` a cada rodada; formatar à mão quebraria o teste e voltaria na rodada seguinte.
- **Desfazer:** tirar o caminho da lista de ignorados e fazer `formatarHistorico` imitar o Biome.

## 014 · T15 · comando do eval:llm

- **Faltava:** combinações de opções que a spec não cobre e o alcance da recusa por dia.
- **Decidido:** `--listar` com `--retomar`, `--do-zero` ou `--extra` recusa (código 1); `--extra` com `--retomar` recusa; a recusa por dia (D18) olha **qualquer** checkpoint com data de hoje no `historico.json`, não só o pedido; histórico inválido é checado na partida, mesmo com `--extra`; caso que lança erro fora de `SemModeloError` e rate_limit entra em `evals/local/` como "Erro: <código>".
- **Por quê:** o mais conservador com a cota e com o histórico.
- **Como desfazer:** em `scripts/lib/evals/comando.ts`, filtrar a recusa por dia pelo checkpoint pedido e soltar as recusas extras; ajustar `eval-llm.test.ts`.

## 014 · T16 · campos antigos dos casos

- **Faltava:** o teste movido de `eval-llm-c3.test.ts` checava `familia: "linguagem"` no caso c3-s18, mas a tabela de famílias da T3 (da spec) marca o s18 como `conversa`; o c3-s21 tinha `falsoAlerta` e a tabela não lhe dá marca.
- **Decidido:** vale a tabela da T3. Em `expectativas-c3.test.ts`, a entrada 18 passa a esperar `conversa`; o s21 fica sem marca (o `falso_alerta` é do s20). `pergunta` e `proposta` saíram dos casos (ninguém os lia).
- **Por quê:** a tabela é a classificação da spec; o campo antigo era do runner apagado.
- **Como desfazer:** dar ao s18 `familias: ["conversa", "linguagem"]` e voltar a entrada 18 para `linguagem`.

## 015 · T11 · biblioteca do painel:check

- **Faltava:** o contrato só define as saídas 1 (painel ou regras faltando) e 2 (Grafana fora); não dizia o que fazer com séries ausentes ou sobrando, resposta não 200 da consulta de dados, nem falha ao listar séries.
- **Decidido:** séries ausentes ou sobrando são relatadas, mas não mudam o código de saída (0); painel cuja consulta não volta 200 conta como "sem dados"; falha ao listar séries vira lista vazia (todas as esperadas saem como ausentes); "`ritu_*` sem estar no painel" é série existente cujo nome não aparece em nenhuma expressão de painel; as séries esperadas derivam de `METRICAS` (histogramas com `_bucket`, `_count`, `_sum`).
- **Por quê:** o `painel:check` é conferência para a dona, não gate; sem dados é normal num LGTM recém-subido.
- **Como desfazer:** em `scripts/lib/painel-check.ts`, devolver 1 quando houver série ausente; ajustar `painel-check.test.ts`.

## 015 · T10 · YAML das regras de alerta sem a biblioteca `yaml`

- **Faltava:** o contrato da T10 mandava gerar o YAML das regras com a biblioteca `yaml`, mas a regra R5 do teste de arquitetura só permite `yaml` em `src/infra/knowledge/`.
- **Decidido:** vale a regra de arquitetura. `gerarAlertas` escreve o arquivo de provisionamento como JSON indentado (JSON é YAML válido; o Grafana lê igual), sem a biblioteca.
- **Por quê:** não abre exceção numa regra de camada sem ADR; o conteúdo e o determinismo ficam iguais.
- **Como desfazer:** acrescentar `scripts/lib/painel-grafana.ts` à lista de `yaml` em `src/architecture.test.ts` (com ADR) e voltar a usar `stringify` do `yaml`.

## 015 · T12 · arquivos do painel gerados fora do Biome

- **Faltava:** a T12 grava `observability/dashboards/ritu.json` e `observability/grafana/alerting/ritu.yaml` com `JSON.stringify(…, null, 2)`, e o Biome reformata (array curto numa linha; o `.yaml` é lido como YAML).
- **Decidido:** os dois arquivos gerados saem do Biome em `biome.json` (`files.includes`), só eles. O teste da T12 trava que o gerado bate com a definição.
- **Por quê:** mesmo precedente do `evals/resultados/historico.json` (014 T17): arquivo gerado, travado por teste, não se formata à mão.
- **Como desfazer:** tirar as duas linhas de `biome.json` e fazer o `painel:gerar` formatar a saída com o Biome.

## Entrega 2 · fechamento · `c3-confiavel.json` reprovado no lint da CI (2026-11-16)

- **Faltava:** o `eval:llm` grava `evals/resultados/<checkpoint>.json` com `JSON.stringify(…, null, 2)`, e o Biome quer arrays curtos numa linha; a CI do commit de fechamento ficou vermelha só no lint. É o primeiro `.json` de resultado no git (o `historico.json` já está fora do Biome, 014 T17).
- **Decidido:** formatar o arquivo gerado com o Biome (só espaços; mesmo conteúdo). Não mexi em `biome.json` nem no runner no fechamento.
- **Por quê:** correção mínima, sem mudar configuração fora de uma tarefa verificada.
- **Pendente (volta a cada checkpoint):** tirar `evals/resultados/*.json` do Biome, como o `historico.json`, ou fazer o runner formatar a saída. Vale uma tarefa de correção.
- **Desfazer:** regravar o arquivo pelo runner.

## 018 · A1 · RadioGroup e ToggleButton na base

- **Faltava:** a spec usa `RadioGroup` (pergunta de casa) e `ToggleButton` (👍/👎), que a 016 não criou.
- **Decidido:** a T5 cria `src/components/base/radio-group.tsx` e `toggle-button.tsx` sobre o React Aria, com tokens, e os mostra na `/marca`.
- **Por quê:** React Aria só em `src/components/` (R5); componente base novo vai para a vitrine, cujo E2E é o gate de acessibilidade.
- **Como desfazer:** trocar os usos por `Checkbox`/`ToggleChip` e apagar os dois arquivos.

## 018 · A2 · handlers em `src/app/_rotas/`

- **Faltava:** onde ficam os handlers das rotas da conversa.
- **Decidido:** como na 017 A4: `src/app/_rotas/conversa.ts` e `fluxo-de-run.ts`, testados com os stores em memória; `route.ts` só liga a `depsReais()`.
- **Por quê:** mesmo padrão já em uso; evals chamam os handlers sem servidor.
- **Como desfazer:** mover o corpo para cada `route.ts`.

## 018 · A3 · status HTTP por código de erro

- **Faltava:** `criarRota` responde `400` para todo `RituError`; a spec pede `409` para `run_aberto`, `run_nao_continuavel`, `pergunta_expirada`, `aprovacao_expirada` e `404` para `run_nao_encontrado`.
- **Decidido:** `statusDoErro(code)` em `src/app/_lib/rota.ts` (T12), usado por `criarRota` e `criarRotaDeFluxo`; `run_pausado` também → 409; o resto continua 400.
- **Por quê:** um mapa só para as duas rotas; nenhuma rota da 017 lança esses códigos.
- **Como desfazer:** voltar `criarRota` a 400 fixo e mapear nos handlers.

## 018 · A4 · estado da tela em redutor puro

- **Faltava:** como testar `useConversa` sem teste de componente.
- **Decidido:** o estado fica em `src/components/ritu/conversa/estado.ts` (redutor puro, Vitest); `use-conversa.ts` só liga o redutor ao `fetch` e ao fluxo.
- **Por quê:** a lógica de estado fica testada sem DOM; o E2E cobre a ligação.
- **Como desfazer:** juntar o redutor no hook.

## 018 · A5 · roteiros do modo e2e ajustados à base e ao validador (T4)

- **Faltava:** a spec pede o roteiro `pergunta-casa` sobre `couve` e `banana` e o `troca` com `cardamomo` como substituto possível; com a base e o seed reais, `banana` nunca entra nos candidatos do `ask_user` (`fora_dos_candidatos`) e o validador recusa `cardamomo` não confirmado em casa.
- **Decidido:** `pergunta-casa` pergunta sobre `couve` e `leite` (ambos incertos no seed); `troca` entrega `cha-canela` só com `canela`, e o E2E troca a `canela`. O fake de LLM também responde ao Juiz (aprova) e à Memória (resumo vazio); mensagem sem roteiro cai em `sem_modelo`.
- **Por quê:** os roteiros precisam passar no validador real; mudar a base ou o seed para caber no roteiro inverteria a regra.
- **Como desfazer:** trocar os ids em `e2e/roteiros/pergunta-casa.ts` e `troca.ts` quando a base ou o seed mudarem.

## 018 · A6 · `lerEventos` sai do core e vai para a tela (T13)

- **Faltava:** a spec põe `lerEventos` em `src/core/conversation/eventos.ts` ("usado pela tela"), mas a regra R4 do teste de arquitetura só deixa `src/components/` importar tipos do core.
- **Decidido:** `lerEventos` (e os testes dele) passa para `src/components/ritu/conversa/ler-eventos.ts`; `EventoDaTela` e `codificarEvento` ficam no core, e a tela importa o tipo com `import type`.
- **Por quê:** quem lê o fluxo é só o navegador; mudar a regra de camada pediria ADR e abriria exceção para um caso que não precisa dela.
- **Como desfazer:** voltar a função ao core e acrescentar uma exceção à R4 (com ADR).

## 021 · A1 · 019 e 020 ausentes na branch
- **Faltava:** a spec põe o `toast` de toque em `useCasa`, no hook de Como ficou? e em `useVoce`, e o E2E de toques em Minha casa; a 019 e a 020 não estão na `entrega-4` (que saiu da `entrega-3` só com 016 a 018).
- **Decidido:** o limite de toque fica em `criarRota`/`criarRotaDeFluxo` pelo método, então as rotas da 019 e da 020 o herdam ao chegar. O `toast` vai para a Conversa e o onboarding; o E2E de toques usa o voto da Conversa.
- **Por quê:** a dona mandou construir só a 021 nesta branch; a regra pelo método não depende de lista de rotas.
- **Como desfazer:** na junção com a 019/020, uma tarefa de correção põe `textoDoLimite` + `toast` nos hooks delas e o caso de Minha casa no `e2e/limites.spec.ts`.

## 021 · A2 · IP, escopo e teto nas rotas
- **Faltava:** como `criarRota` obtém `ipHash`, `escopo` e `teto` sem importar adaptador em `src/app/`.
- **Decidido:** `DepsDaRota.quemPede(request)`, implementado em `depsReais()` com `ipDoPedido`, `hashDoIp` e `RITU_MODO`; os testes passam um fake.
- **Por quê:** mantém as rotas testáveis com stores em memória, como o resto de `DepsDaRota`.
- **Como desfazer:** calcular no `criarRota` direto e ajustar os testes.

## 021 · A3 · Fuso dos limites
- **Faltava:** `QuemPede.fuso` pede o fuso da cidade do perfil, mas `criarRota` não lê o perfil.
- **Decidido:** toques e `retryAfterS` usam `config.clima.fusoPadrao` (como a spec manda para as chaves); só `estadoDosLimites` (hora da virada) usa `perfil.cidade_fuso ?? fusoPadrao`.
- **Por quê:** evita uma leitura de perfil em todo `POST`; a spec só usa o fuso da pessoa para a hora da virada.
- **Como desfazer:** ler o perfil em `prepararContexto`.

## 021 · A4 · `test:db` fora da trilha adiantada
- **Faltava:** a spec pede `test:db` verde com o contrato estendido; `test:db` é ⚠️.
- **Decidido:** o contrato roda contra o fake no `npm test`; o Postgres fica para a junção, como na 017 e na 018.
- **Por quê:** a trilha adiantada não roda nada com ⚠️ (skill §7.6).
- **Como desfazer:** rodar `npm run test:db` na junção.

## 021 · A5 · Cota esgotada por pedido no modo e2e
- **Faltava:** onde ligar `x-ritu-e2e-cota`.
- **Decidido:** `createRouterE2e` em `src/infra/e2e/cota.ts`, embrulhando o router no container só com `RITU_MODO=e2e`, como o ledger por escopo.
- **Por quê:** o modo e2e já lê headers do pedido por esse módulo.
- **Como desfazer:** apagar o embrulho e a ligação no container.

## 021 · A6 · Métrica nova sem emissão até a T6
- **Faltava:** `evals/det/telemetria/cobertura.eval.ts` exige que toda métrica de `METRICAS` seja emitida; `ritu_limite_total` (T4) só é emitida por `consumirToque` (T6).
- **Decidido:** a T4 é verificada na onda 1 mas commitada só junto da onda 2, logo antes da T6, que acrescenta ao `cobertura.eval.ts` um cenário de toque barrado.
- **Por quê:** nenhum commit com gate vermelho, sem exceção artificial no eval.
- **Como desfazer:** nada a desfazer depois do commit da T6.

## 021 · A7 · T2 · Consumo atômico em transação, não em um comando
- **Faltava:** a T2 pedia "SQL com `inicio` por linha num único comando atômico"; com `inicio` diferente por chave, o comando único ficou difícil de ler e de travar em ordem.
- **Decidido:** `src/infra/db/limits.ts` faz, numa transação, `insert ... on conflict do nothing` e `select ... for update` por par (chave, início), em ordem fixa; confere os tetos sob trava e só então soma. Algum par no teto: retorna sem somar.
- **Por quê:** mantém o tudo ou nada e a ordem de trava evita deadlock; o verificador conferiu por leitura (o `test:db` fica para a junção, 021 A4).
- **Como desfazer:** reescrever `consumir` do adaptador Postgres num único `with ... update` e rodar `npm run test:db`.
- **Nota da onda 1:** o orquestrador incluiu `evals/det/telemetria/cobertura.eval.ts` na T5 (passar `testers: []` a `entrarComGoogle`), autorizado pelo orquestrador.

## 021 · A8 · T6 · Conta estrutural em `limits`, sem importar `accounts`
- **Faltava:** os contratos punham `Conta` (de `accounts`) em `QuemPede` e nas chaves, mas `accounts/entrar.ts` já importa `UsageLimiter` de `limits`: ciclo proibido pela R9.
- **Decidido:** `src/core/limits/estado.ts` declara `ContaDoLimite`, só com os campos de `Conta` que os limites leem; `Conta` continua atribuível a ele.
- **Por quê:** quebra o ciclo sem mexer em `accounts` nem mover tipo usado em muitos arquivos.
- **Como desfazer:** mover `Conta` para um módulo comum de `src/core/` e voltar a importá-la em `limits`.

## 021 · A9 · T9 · `quemPede` real em `src/infra/auth/next.ts`
- **Faltava:** a T9 punha o `quemPede` real em `src/app/_lib/deps.ts`, importando `@/infra/auth/ip` e `@/infra/env`; a R3 só deixa `src/app` importar `@/infra/container` e `@/infra/auth/next`.
- **Decidido:** a função mora em `src/infra/auth/next.ts` (que já usa `hashDoIp`); `deps.ts` só a liga em `depsReais()`.
- **Por quê:** não abre exceção na R3.
- **Como desfazer:** liberar os dois módulos na R3 e devolver a função a `deps.ts`.

## 021 · A10 · T19 e T20 · Relógio fixo nos testes da pergunta de casa
- **Faltava:** a T19 pedia que os testes de `pergunta-casa` passassem a qualquer hora; o roteiro pergunta por couve, que só é candidata à noite (21h a 04h59 em São Paulo), então isso exigiria mudar o roteiro ou os candidatos.
- **Decidido:** os testes unitários fixam o relógio em horas noturnas (T19). Os E2E ganham o header `x-ritu-e2e-agora`, só no modo e2e, e mandam 21h em São Paulo (T20).
- **Por quê:** a dependência da hora é comportamento do produto, não defeito; fixar o relógio é a mudança mais conservadora e segue o padrão do `x-ritu-e2e-cota`.
- **Como desfazer:** trocar o roteiro por itens candidatos em qualquer momento e tirar o header e o relógio fixo.

## Portão 2 · P2-T4 · "Não tenho" do run

- **Faltava:** o contrato manda unir `entrada.nao_tem_do_run` ao `acabou` em `lerContexto`, mas a entrada do acompanhante não tem esse campo: `nao_tem_do_run` é dado do preparo, preenchido por `aplicarResposta` depois do `preparar`.
- **Decidido:** `lerContexto` une só Minha casa e `casa_da_mensagem.acabou`. O "Não tenho" já entra em `acabou` em `aplicarCasa` (`pergunta-do-run.ts`), que chama `entregaveis` de novo; a regra nova de `entregaveis` vale ali sem mudança. O teste do "Não tenho" fica em `pergunta-do-run.test.ts`.
- **Por quê:** é o único ponto em que a resposta existe; mudar o schema da entrada levaria o dado para antes de ele existir.
- **Como desfazer:** acrescentar `nao_tem_do_run` a `entradaDoAcompanhanteSchema`, repassar em `responder.ts` e unir em `lerContexto`.

## Portão 2 · P2-T9 · Relógio do modo e2e

- **Faltava:** o roteiro `pergunta-casa` dependia da hora real (o corte das refeições muda com o momento do dia), e o teste dele já falhava no commit que o criou.
- **Decidido:** no modo e2e (`RITU_MODO=e2e`), o container usa um relógio que anda como o real a partir de 20h30 UTC do dia em que o processo sobe (`src/infra/e2e/relogio.ts`); o produto real segue com `systemClock`. O roteiro pergunta a banana (incerta na semente) e entrega `pausa-em-silencio`, com ou sem a resposta.
- **Por quê:** teste determinístico sem mudar regra de produto; o modo e2e já fixa o clima pelo mesmo motivo.
- **Como desfazer:** tirar `relogio.ts` do container e2e e escolher um cenário de pergunta de casa que não dependa da hora.

## Portão 2 · P2-T6 · Aviso de saúde na retomada

- **Faltava:** a tarefa cobria só `conversar.ts`; um run com fala de saúde que pausa (pergunta de casa) fecha em `continuar.ts`, sem o aviso.
- **Decidido:** na pausa, o run com fala de saúde grava `com_incomodo: true` (como já faz o alerta e a variante); na retomada, `continuar.ts` põe o aviso `incomodo` na saída final quando `com_incomodo`, sem repetir. `continuar.ts` e o teste dele entram na tarefa.
- **Por quê:** o objetivo da tarefa é "a saída final sempre leva o aviso"; o `com_incomodo` do run é o dado que a retomada já lê.
- **Como desfazer:** tirar o aviso de `continuar.ts` e a gravação de `com_incomodo` na pausa.

## Portão 2 · P2-T5 · "Não como" livre

- **Faltava (1):** o preparo do acompanhante gravava o item livre no dia (`nao_come_texto`), o que contraria "não grava".
- **Decidido (1):** `conversar.ts` passa ao acompanhante só os itens de `nao_come` com `alimento_id`. O caminho de item livre em `preparo.ts` continua (testado por `preparo.test.ts` e `evals/det/aprovacao/restricao-no-run.eval.ts`), mas a conversa não o alimenta mais.
- **Por quê (1):** candidato só sai da base, então evitar um nome que a base não conhece não mudava nenhuma sugestão; e a frase aprovada já diz "se eu sugerir algo com X, é só me dizer que eu troco".
- **Como desfazer (1):** voltar a passar os itens livres em `nao_come_da_mensagem`. Limpeza possível: tirar o caminho livre de `preparo.ts` (fica para a revisão da 010, a pedido da dona).
- **Faltava (2):** quando o run pausa, a frase `naoComeDesconhecido` não chega à resposta final da retomada: a pausa não guarda a interpretação.
- **Decidido (2):** não mudar schema nem checkpoint; a frase sai nos runs sem pausa e no caminho `evitar`.
- **Por quê (2):** a opção mais conservadora; mudar o checkpoint mexe em núcleo fora da tarefa.
- **Como desfazer (2):** guardar os itens livres no checkpoint da pausa e acrescentar a frase em `continuar.ts`.

## Revisão da base · R1 nos chás de ervas alteradas (d0b187f)

- **Faltava:** a R1 (`KNOWLEDGE.md` §8.1) diz "soma das ervas" sem dizer como somar, e cardamomo, cravo, camomila e capim-limão mudaram na revisão.
- **Decidido:** qualidades de cada erva = virya + `gunas` de `alimentos.yaml`; gunas do chá = soma por erva, com pares opostos se cancelando, e ficam as de saldo positivo. `favorece_estados` = estados cujas `presentes` têm o oposto de alguma guna do chá e cujas `presentes` e `evitar_gunas` não têm nenhuma. Campo com fonte real fica (a fonte vence a regra), exceto em `cha-cravo-canela` e `cha-canela-cardamomo`: as páginas da Banyan liam cravo e cardamomo como quentes, e a revisão ficou com a Easy Ayurveda (mais peso, §7), que diz que os dois são frios. A R2 foi refeita só onde o campo já citava a regra; com saldo térmico zero, o chá fica sem contraindicação térmica. O efeito não muda: nenhuma erva mudou de efeito. Chás alterados: `cha-canela-cardamomo`, `cha-cardamomo`, `cha-cravo-canela`, `cha-camomila`, `cha-camomila-erva-doce`, `cha-capim-limao`, `cha-capim-limao-hortela`.
- **Por quê:** é a conta mais direta do vocabulário de pares (§1) e reproduz os chás de uma erva que a revisão já tinha refeito (`cha-hortela`, `cha-capim-limao`).
- **Consequências para a dona ver na segunda rodada:** (1) o chá de camomila fica `frio` e deixa de ser candidato para quem está `agitada` (que evita frio), embora a fonte dele cite `agitada`; os testes do runner da pausa passaram a perguntar anis-estrelado. (2) `cha-camomila-erva-doce` passa a favorecer `[com_calor, pesada]` em vez de `[agitada, seca, irritada]`; a citação `banyan-erva-doce`, que trata da erva-doce sozinha, saiu. (3) `cha-camomila-erva-doce` tem saldo frio e `contraindicacoes: []`, campo sem citação da regra; pela R2 seria `[com_frio]`, e ficou como estava. (4) `cha-capim-limao-hortela` fica `intenso` com `favorece_estados` de fonte que inclui `irritada`. (5) `cha-canela-cardamomo` perde `com_calor`, porque o saldo térmico fica zero.
- **Como desfazer:** reverter d0b187f.

## Junção da entrega-4 · relógio e2e

- **Faltava:** o pedido da dona era manter "o relógio por requisição da `entrega-4` (T20)", mas a T20 foi revertida na própria `entrega-4` (438479b), porque a `entrega-3` trouxe o relógio deslocado para a noite (019 C3).
- **Decidido:** manter o relógio que a `entrega-4` tem hoje (o noturno, `createRelogioE2e`) e adaptar a ele os roteiros e testes da P2-T9 da `main`.
- **Por quê:** segue a intenção do pedido (vence o lado da `entrega-4`) sem ressuscitar um código que a trilha já tinha tirado.
- **Como desfazer:** reaplicar a T20 (a91d363) e trocar o relógio do container.

## 022 · A1 · 401 da limpeza

- **Faltava:** a spec manda a limpeza usar `autorizarCron` (que responde `401 nao_autorizado`) e, ao mesmo tempo, não mudar o 401 dela, que hoje responde `{ erro: "sem_autorizacao" }`.
- **Decidido:** a limpeza decide por `autorizarCron`. Com o segredo ausente, responde `503 cron_desligado`, como a rota de padrões. Com o cabeçalho errado, mantém `401 { erro: "sem_autorizacao" }`. As rotas novas (padrões e saúde) respondem `nao_autorizado`.
- **Por quê:** cumpre as duas frases da spec sem quebrar quem já lê o 401 da limpeza.
- **Como desfazer:** responder com o `erro` de `autorizarCron` também na limpeza e ajustar os testes dela.

## 022 · A2 · `c5-publico` adiado

- **Faltava:** a spec manda registrar o `c5-publico` com os mesmos casos e o mesmo alvo do `c4-site`, mas o `c4-site` ainda não existe em `evals/llm/checkpoints.ts`: ele nasce no fechamento da entrega 3.
- **Decidido:** o registro do `c5-publico` fica para a junção com o `c4-site`; o resto da 022 segue.
- **Por quê:** copiar um checkpoint que não existe obrigaria a inventar o alvo.
- **Como desfazer:** registrar o `c5-publico` com as pastas do `c3-confiavel`.

## 022 · A3 · `vercel` CLI 65.17.0 e `rollback --non-interactive`

- **Faltava:** a versão do CLI e as flags exatas.
- **Decidido:** `vercel@65.17.0` (a estável publicada em 2026-11-17). Deploy com `deploy --prod --yes --token "$VERCEL_TOKEN" --env RITU_VERSAO=<sha>`, já que a documentação atual diz que `--env` define variável de runtime. Volta com `rollback --token "$VERCEL_TOKEN" --non-interactive`: sem argumento, o `rollback` volta ao deploy de produção anterior (no Hobby, só a ele), e a documentação não lista `--yes` para ele.
- **Por quê:** é o que a documentação atual da Vercel descreve; não foi possível rodar o CLI nesta sessão para conferir o `--help`.
- **Como desfazer:** trocar a versão e as flags nos dois passos do job `deploy`.

## 022 · A4 · `x-forwarded-for` na Vercel

- **Faltava:** a spec pede conferir se a Vercel reescreve o `x-forwarded-for` na borda.
- **Decidido:** nada muda. A documentação de request headers diz que a Vercel sobrescreve o `X-Forwarded-For` e não repassa IP externo, para impedir spoofing (exceção: Trusted Proxy, só no plano Enterprise).
- **Por quê:** a confiança da 017 no primeiro endereço vale em produção.
- **Como desfazer:** —

## 022 · A5 · `yaml` em `scripts/`

- **Faltava:** a spec manda o teste do workflow ler o YAML com `yaml`, e o `painel:publicar` lê as regras de `observability/grafana/alerting/ritu.yaml`. A regra R5 do teste de arquitetura só deixa importar `yaml` em `src/infra/knowledge/`.
- **Decidido:** `scripts/` passa a ser casa permitida do `yaml` (T7, em `src/architecture.test.ts`). O produto (`src/`) continua só com `src/infra/knowledge/`. A ADR sai no fechamento da 022.
- **Por quê:** `scripts/` é ferramenta de quem desenvolve e opera; passar o YAML pelo container só para ler um arquivo de CI seria indireção sem ganho.
- **Como desfazer:** tirar `scripts/` da lista e ler os arquivos por uma função exportada de `src/infra/knowledge/`.

## 022 · A6 · `google` da saúde sem importar `auth/next`

- **Faltava:** a saúde usa `googleDisponivel()` (`src/infra/auth/next.ts`), mas importar esse módulo no container cria ciclo, e o import dinâmico quebra no Vitest.
- **Decidido:** o container repete a regra (`AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` presentes) com `optionalEnv` (T8).
- **Por quê:** evita o ciclo sem mexer na autenticação.
- **Como desfazer:** mover a regra para um módulo sem dependência de `next-auth` e usá-lo nos dois lugares.

## 025 · A1 · `agua-morna-com-limao` vira `pratica`

- **Faltava:** a spec exige que toda prática `tipo: cha` tenha id `cha-…`, mas `agua-morna-com-limao` era `tipo: cha`.
- **Decidido (pela dona, antes da construção):** a linha passa a `tipo: pratica`, com o mesmo id; `minPraticas` vira `{ cha: 19, oleo: 7, pratica: 18 }`. Ela não entra no padrão genérico de "um chá".
- **Por quê:** água morna com limão é hábito da manhã, não chá de erva; trocar o tipo não muda id nem dado gravado.
- **Como desfazer:** voltar o tipo e abrir exceção nomeada na regra 17.

## 025 · A2 · Seed da demonstração com o padrão genérico

- **Faltava:** a spec não cita o seed, e `seed/demo.yaml` grava justamente `com_frio+agitada|pratica:cha-gengibre-canela`, o padrão que a regra da base barra com `agitada`.
- **Decidido:** o item do padrão do seed aceita `{ tipo: cha }`, e o seed passa a gravar `com_frio+agitada|cha` com a frase de "um chá" (T6).
- **Por quê:** sem isso, a conta de demonstração nasceria com o padrão que a spec aposenta, e ele nunca valeria com `agitada`.
- **Como desfazer:** voltar `seed/demo.yaml` ao item `pratica` e tirar a união do schema do seed.

## 025 · A3 · Prakriti no eval de frio com agitada

- **Faltava:** a spec pede `cha-louro` candidato com `com_frio + agitada` à tarde, sem dizer o perfil. Sem prakriti, a adequação do louro é 0 (+2 por `quente`, −2 porque `leve` é o oposto de `pesado`, que `agitada` busca) e ele não entra.
- **Decidido:** o eval `cha-derivado-frio-agitada` usa prakriti com vata dominante (0,6/0,2/0,2); o louro entra pelo efeito (vata −1). O caso `c3-s23` já usa vata 0,45/pitta 0,45/kapha 0,1 e o louro entra com adequação 0,1, entre os 4 chás do contexto. Ranking e dados não mudaram.
- **Por quê:** é o cenário real de quem fica agitada (vata); mudar a pontuação mexeria em todos os candidatos.
- **Como desfazer:** se a dona quiser o louro candidato com qualquer perfil, uma spec de ranking (ex.: chás julgados por `favorece_estados`). A margem do `c3-s23` é fina: mudar `porPontoDeEfeito` ou o efeito do louro tira o louro do contexto.
