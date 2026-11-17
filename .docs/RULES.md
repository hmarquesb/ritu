# Regras do fluxo de construção

> A dona decide **tudo antes**, os agentes constroem **sem interrupção**, e ela confere em **quatro portões**.

## 1. Papéis

| Papel | Quem | Faz | Não faz |
|---|---|---|---|
| **Dona** | Helena | Fecha `PREPARO.md`, aprova as specs, confere cada portão | Aprovar commits ou tarefas |
| **Orquestrador** | Sessão principal do Claude Code, em Opus, com a skill `construir-entrega` | Lê specs, quebra em tarefas e ondas, despacha, decide desvios, faz os commits, escreve ADRs e relatórios | Implementar tarefas comuns |
| **Implementador** | Subagente `implementador` (Haiku) | Uma tarefa mecânica por vez, com teste primeiro | Decidir arquitetura, commitar |
| **Implementador de núcleo** | Subagente `implementador-nucleo` (Sonnet) | Tarefas marcadas `nucleo`: loop, pausas, aprovação, runtime, telemetria, auth | Idem |
| **Implementador de tela** | Subagente `implementador-tela` (Sonnet) | Tarefas marcadas `tela`: componentes, páginas, estilo, com as skills de design | Idem |
| **Redator da base** | Subagente `redator-base` (Opus) | Tarefas marcadas `conteudo`: linhas da base ayurvédica e textos semeados | Inventar fonte, mudar schema ou código |
| **Verificador** | Subagente `verificador` (Sonnet) | Roda os gates (uma vez por onda), lê o diff contra a tarefa e a spec, dá veredito por tarefa | Editar código |

## 2. Antes de construir (com a dona presente)

1. `PREPARO.md` fechado: contas, chaves no `.env.local`, base e design definidos.
2. As specs da entrega escritas com `create-spec`, `refine-spec` e `breakdown-specs`, todas com `status: approved`. Cada spec traz **por extenso** os contratos que cria e usa. As specs das entregas seguintes podem ser escritas enquanto uma entrega é construída; quem as escreve lê o código já commitado, e não só as specs anteriores.
3. Dúvida se resolve **aqui**. Depois de começar, ninguém pergunta.

## 3. Construir uma entrega

`/construir-entrega N` (skill em `.agents/skills/construir-entrega/`). Resumo:

1. O orquestrador lê `AGENTS.md`, os docs do mapa e as specs da entrega.
2. Para cada spec, na ordem das dependências, escreve o plano em `.plans/NNN-<nome>-plan.md`: tarefas pequenas e **mastigadas** (objetivo, arquivos, de quais tarefas depende, leitura mínima, contratos copiados da spec, testes a escrever primeiro, comandos, critério de pronto, nível `mecanica`, `nucleo`, `tela` ou `conteudo`) e as **ondas** em que elas rodam.
3. Para cada onda: implementadores → verificadores. Reprovou: a tarefa volta ao implementador dela com a lista do verificador. **Duas reprovações:** o orquestrador sobe a tarefa para `nucleo` ou a refaz ele mesmo.
4. Aprovada: o orquestrador faz **um commit** com os arquivos da tarefa.
5. Fim da spec: gates 1 a 6, ADRs, docs vivos, spec `implemented` com o hash do último commit, `git push`.
6. Fim da entrega: relatório em `.plans/entrega-N-relatorio.md`, tag `entrega-N`, e **para**.

### Ondas

Uma onda são tarefas que rodam ao mesmo tempo, na mesma pasta (ADR 0038).

- Entram na mesma onda tarefas cujas dependências já têm commit e que **não têm arquivo em comum**. No máximo **5** por onda.
- Roda sozinha a tarefa que instala biblioteca, mexe em `package.json`, em configuração (`tsconfig`, Biome, Vitest, Next) ou em migração, ou que muda uma assinatura usada fora dos arquivos dela.
- Na dúvida se uma tarefa depende de outra, depende.
- Durante a onda, cada implementador roda os gates só nos arquivos dele. Depois, um verificador por tarefa lê o diff dela, e um verificador roda os gates completos uma vez.
- Um commit por tarefa aprovada, na ordem do plano. A onda seguinte só começa com a atual resolvida (commit, reversão ou bloqueio de cada tarefa).

### Trilha adiantada

Enquanto a sessão principal fecha uma entrega, uma segunda sessão pode construir specs da entrega seguinte (ADR 0038).

- Roda num git worktree em `../ritu-worktrees/entrega-N`, na branch `entrega-N`, com `/construir-entrega N adiantada`.
- Só constrói spec `approved` cujas specs de "Depende de" (`.specs/README.md`) estão todas `implemented` na `main`.
- Commits na branch, com as mesmas ondas, o mesmo verificador e o estado em `.plans/entrega-N-estado.md`. A cada spec, junta a `main` na branch (`git merge main`, nunca rebase).
- Não roda nada com ⚠️, não cria tag e não fecha a entrega.
- A branch entra na `main` (`git merge --no-ff entrega-N`) só depois do portão da entrega anterior, como primeiro passo de `/construir-entrega N`.

## 4. Autonomia: quando não perguntar e quando parar

Durante uma entrega o orquestrador **não pergunta nada à dona**. Diante de uma lacuna:

- Escolhe a opção mais conservadora e mais próxima das referências locais (`.local/REFERENCIAS.md`).
- Em tela, a referência é só `DESIGN.md`: aparência e componentes não vêm de outro projeto.
- Registra em `.plans/DECISOES-AUTONOMAS.md`: o que faltava, o que decidiu, por quê, como desfazer.
- Segue.

Só para antes do portão se:

- falta um segredo ou uma conta que só a dona pode criar;
- a ação é destrutiva ou irreversível fora do repositório;
- a spec contradiz uma regra inegociável do `AGENTS.md`.

Nesses casos registra em `.plans/BLOQUEIOS.md`, pula o que depende do bloqueio e continua o resto.

## 5. Commits e git

- Direto na `main`; a trilha adiantada commita na branch `entrega-N` dela (§3). Conventional Commits, em inglês, com o número da spec no corpo.
- `git add` com caminhos explícitos, nunca `-A`.
- `git push` ao fim de cada spec. A CI roda a cada push; CI vermelha é a primeira tarefa da próxima rodada.
- Proibido: `push --force`, `reset --hard`, `rebase`, reescrever histórico, mexer em qualquer pasta fora desta (a não ser o worktree da trilha adiantada).
- Tag `entrega-N` no portão.
- **Referências locais ficam fora do repositório.** `.local/` nunca entra em `git add`. Nenhum commit, spec, plano, ADR, comentário, README ou relatório cita o nome ou o caminho das pastas de referência; no plano, o campo `referencia` aponta só para a seção e a linha de `.local/REFERENCIAS.md`.

## 6. Orçamento de LLM

- Testes e evals determinísticos não chamam LLM. São eles que conferem cada tarefa e cada spec.
- ⚠️ `npm run eval:llm` roda **só nos cinco checkpoints** de `QA.md` (fim da entrega 1, depois da spec 011, fim das entregas 2, 3 e 4), e só pelo orquestrador. Nunca a cada mudança.
- ⚠️ `npm run demo` com LLM real: só o orquestrador, uma vez ao fim das specs 007, 009 e 010, para conferir que o caminho real funciona, e no fechamento de cada entrega.
- Toda chamada passa pelo `ModelRouter`, com a chave de desenvolvimento. Não rodar duas rodadas completas do mesmo checkpoint no mesmo dia: `--extra` só a pedido da dona.
- ⚠️ `npm run eval:llm -- --checkpoint <nome> --caso <id>` roda um caso só, sem gravar nada: é a fumaça do orquestrador no fechamento de uma spec que mexe no runner ou nos casos. `--listar` não chama modelo.
- Quem muda a lista de evals determinísticos de `QA.md` atualiza `evals/det/mapa.ts`.
- Erro 429 persistente: a rodada para, guarda o que fez e é retomada no dia seguinte. O relatório da entrega anota.
- Cada rodada de checkpoint entra em `evals/COMPARACAO.md`: é o registro da evolução.

## 7. Portões humanos

| Portão | Depois de | A dona confere | Como |
|---|---|---|---|
| **1** | Entrega 1 | O agente pensa direito? A base está certa? A troca de modelo funciona? | `npm run demo` em três cenários; trace no Grafana local; leitura de `data/*.yaml`; relatório do checkpoint `c1-base` |
| **2** | Entrega 2 | Ele entende a conversa, pergunta, propõe, aprende e é barrado quando deve? | Relatórios de `c2-conversa` e `c3-confiavel`, com a comparação; demo de conversa, pausa, aprovação e retorno no terminal; painel |
| **3** | Entrega 3 | As telas estão bonitas e claras? A conversa soa como gente? | Screenshots em celular e desktop; navegação real; caminho da demonstração; relatório de `c4-site` |
| **4** | Entrega 4 | Está pronto para ir ao ar? | Produção; Bastidores com a evolução dos evals; README; Grafana Cloud; relatório de `c5-publico` |

O relatório de cada entrega traz: o que foi feito, números, decisões autônomas, bloqueios, e um **roteiro de conferência** com passos numerados. A dona responde "aprovado" ou lista ajustes. Ajuste vira spec nova ou tarefa de correção, e só então começa a entrega seguinte.

## 8. Ao fim de cada spec

1. ADR em `.adrs/NNNN-<nome>.md` para cada decisão de arquitetura.
2. `.docs/` atualizado se o comportamento mudou.
3. Spec com `status: implemented` e o hash.
4. Linha no relatório da entrega: arquivos, bibliotecas, gates, decisões.

## 9. Retomar

O estado vive em arquivos, não na conversa: `.plans/entrega-N-estado.md` lista cada tarefa e seu status. Se a sessão cair, o contexto encher ou a conta mudar, `/construir-entrega N` relê o estado (e `.local/PASSAGEM.md`, se houver) e continua de onde parou.

## 10. Contexto mínimo e limite de uso

**Contexto.** Token gasto com leitura repetida é entrega que não termina.

- `AGENTS.md` chega sozinho a toda sessão e a todo subagente. Ninguém o relê.
- A spec traz os contratos por extenso e a lista "Leitura para a construção". O orquestrador lê a spec e só essa lista.
- A tarefa traz os contratos copiados. O subagente lê a tarefa, `DEVELOPMENT.md` e só as seções do campo `leitura`. Não abre a spec nem outros docs por conta própria.
- O prompt de um subagente é o bloco da tarefa, e mais nada (em onda, mais a linha que diz isso). A resposta dele tem no máximo 15 linhas (20 para o verificador).
- O orquestrador não lê diff nem código: quem lê é o verificador.
- Skills são carregadas sob demanda, só as que a tarefa cita.
- Gates com saída curta; só as falhas são lidas.

**Limite de uso.** A barra de status (`.claude/statusline.mjs`) grava em `.local/uso.json` o percentual usado da janela de 5 horas e da semana. Antes de cada onda o orquestrador lê esse arquivo. Com **85%** da janela de 5 horas ou **95%** da semana, ele não começa onda nova: termina ou reverte a que está em curso, escreve `.local/PASSAGEM.md` (onde parou, a próxima tarefa, o que ainda não está em arquivo nenhum, como retomar) e para. A dona troca de conta (`/login`) ou espera a janela renovar, abre uma sessão nova e roda `/construir-entrega N`. Passo a passo na skill `construir-entrega` §6.
