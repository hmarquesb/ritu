---
name: construir-entrega
description: Constrói uma ENTREGA inteira do Ritu sem interrupção humana. Recebe o número da entrega (1 a 4), lê as specs aprovadas dela, quebra cada spec em tarefas mastigadas, despacha cada tarefa para o subagente do nível dela (implementador em Haiku, implementador-nucleo e implementador-tela em Sonnet, redator-base em Opus), manda o verificador (Sonnet) rodar os gates e conferir o diff, faz um commit por tarefa aprovada direto na main e, ao fim, escreve o relatório do portão humano e para. Use quando a pessoa disser "construir entrega 1", "/construir-entrega 2", "roda a entrega 3", "continua a entrega", "retoma a construção" ou pedir para implementar várias specs de uma vez sem PR.
metadata:
  author: ritu
  version: "1.0.0"
---

# Construir entrega

Você é o **orquestrador**. Rode esta skill na sessão principal, em Opus. Você planeja, despacha, decide e commita. Você **não implementa** tarefas comuns: o seu contexto é o recurso mais caro da construção, e ele precisa durar a entrega inteira.

As regras do fluxo estão em `.docs/RULES.md`. Esta skill é o passo a passo.

## 0. Antes de começar

**Regra de contexto: leia o mínimo.** As specs trazem os contratos por extenso justamente para ninguém precisar reler os `.docs/`. Cada documento que você abre sem precisar encurta a entrega.

1. `AGENTS.md` já está no contexto (vem pelo `CLAUDE.md`); não releia. Leia `.docs/RULES.md` e `.docs/DEVELOPMENT.md`. **Não leia os outros `.docs/` agora.**
2. Descubra as specs da entrega em `.specs/README.md`. De cada uma, leia **só o cabeçalho** (`status`), para a pré-condição. O corpo de cada spec você lê quando chegar a vez dela (§1).
3. **Existe `.local/PASSAGEM.md` ou `.plans/entrega-N-estado.md`?** Então isto é uma retomada: leia a passagem (se houver) e o estado, confira com `git log --oneline -10` e `git status --short`, e continue da primeira tarefa não concluída. Não refaça o que já tem commit. Arquivo alterado ou novo fora de `.plans/` e sem commit é resto de uma tarefa interrompida: reverta (`git checkout -- <arquivos>`, `git clean -f -- <novos>`) e refaça a tarefa. Não releia specs já `implemented`.
4. Confira as pré-condições. Se alguma falhar, **pare e diga qual**:
   - todas as specs da entrega estão com `status: approved` (ou `implemented`);
   - a entrega anterior tem a tag `entrega-(N-1)` e o relatório dela foi aprovado pela dona (a partir da entrega 2);
   - `git status` limpo fora de `.plans/`, na `main`;
   - `npm run env:check -- --entrega N` passa (a partir da spec 001; nunca leia `.env.local`).
5. Leia `.local/uso.json` (§6). Acima do limite, nem comece.

## 1. Planejar uma spec

Para cada spec, na ordem das dependências:

1. Leia a spec inteira e **só** o que a seção "Leitura para a construção" dela lista (documento e seção). De `.local/REFERENCIAS.md`, leia só as linhas da tabela que servem à spec; os arquivos de referência quem abre é o subagente, não você.
2. Escreva `.plans/NNN-<nome>-plan.md` com as tarefas. Cada tarefa cabe em **um commit** e traz:

```
### T3 · <título no imperativo>
- nivel: mecanica | nucleo | tela | conteudo
- objetivo: uma frase
- arquivos: caminhos a criar ou alterar (e só esses)
- leitura: seções de .docs/ que o subagente precisa abrir (ex.: AI.md §5), ou "nenhuma". Nunca um documento inteiro por garantia
- skills: skills a carregar (ex.: mastra), ou "nenhuma"
- referencia: seção e linha de .local/REFERENCIAS.md a ler antes, quando houver (nunca o nome ou o caminho da pasta)
- contratos: schemas, assinaturas e nomes COPIADOS da spec, por extenso
- testes primeiro: os casos a escrever antes do código
- comandos: os gates que precisam passar
- pronto quando: critérios objetivos
- fora: o que esta tarefa não deve tocar
```

3. Regras para quebrar:
   - Uma tarefa não depende de uma decisão que não esteja escrita nela ou na spec.
   - O nível vem da seção "Nível das partes" da spec. `nucleo`: loop do agente, checkpoint, pausa e retomada, aprovação, adaptador da Mastra, roteador de modelos, telemetria, autenticação. `tela`: qualquer componente, página ou estilo. `conteudo`: linhas da base ayurvédica e textos semeados lidos pela pessoa. O resto é `mecanica`.
   - Separe conteúdo de código: o schema e o validador de um YAML são uma tarefa (`mecanica`); as linhas do YAML são outra (`conteudo`), em lotes que caibam numa resposta (por exemplo, 20 alimentos por tarefa).
   - A tarefa é **autossuficiente**: quem a recebe não abre a spec. Se um contrato não coube na tarefa, a tarefa está grande demais.
4. Acrescente as tarefas em `.plans/entrega-N-estado.md` com status `pendente`.

## 2. Executar uma tarefa

1. Marque a tarefa como `em andamento` no estado.
2. Despache para o subagente do nível: `mecanica` → `implementador`; `nucleo` → `implementador-nucleo`; `tela` → `implementador-tela`; `conteudo` → `redator-base`. O prompt é **só o bloco da tarefa**, mais o caminho da spec (para o caso de o campo `leitura` apontar para ela). Não cole trechos de docs nem contexto desta conversa: o subagente não vê esta conversa e não precisa dela.
3. Quando ele voltar, despache o `verificador` com: o bloco da tarefa, o caminho da spec e a lista de arquivos que o implementador disse ter tocado. **Você não lê o diff nem os arquivos**: isso é trabalho do verificador.
4. Veredito:
   - **APROVADO** → passo 5.
   - **REPROVADO** → devolva ao mesmo implementador a lista de problemas do verificador, sem resumir. Segunda reprovação: se era `mecanica`, mande para `implementador-nucleo`; se era `nucleo`, `tela` ou `conteudo`, resolva você mesmo e passe de novo pelo verificador.
   - Depois disso, se ainda falhar: registre em `.plans/BLOQUEIOS.md`, reverta os arquivos da tarefa (`git checkout -- <arquivos>` e `git clean -f -- <arquivos novos>`), marque `bloqueada`, pule as tarefas que dependem dela e siga.
5. Commit, feito por você:
   - `git add <caminhos explícitos da tarefa>`; nunca `-A`;
   - mensagem em Conventional Commits, em inglês, com `Spec: NNN` e `Task: T3` no corpo;
   - marque `concluida` no estado, com o hash.

**Uma tarefa por vez.** Não despache subagentes em paralelo.

6. Antes de despachar a próxima tarefa, confira o uso (§6).

## 3. Fechar uma spec

1. Mande o `verificador` rodar os gates 1 a 6 de `QA.md` e o `npm run dup` no repositório inteiro. Falhou: abra tarefas de correção e volte ao passo 2.
2. Escreva as ADRs da spec em `.adrs/` e atualize o índice.
3. Atualize os `.docs/` que mudaram e a seção de comandos do `AGENTS.md`. Descreva o que o produto faz; não registre histórico de mudança nos docs.
4. Marque a spec como `implemented`, com o hash.
5. Commit de documentação (inclui `.plans/` da spec e o estado) e `git push`. Confira a CI com `gh run list --limit 1`; se estiver vermelha, a correção é a próxima tarefa.
6. ⚠️ Rode LLM de verdade só se `RULES.md` §6 permitir para esta spec. Evals com LLM só nos checkpoints de `QA.md`; nunca para conferir uma tarefa ou uma mudança pequena.

## 4. Lacunas e desvios

Você **não pergunta nada à dona durante a entrega**. Faltou uma decisão:

1. Escolha a opção mais conservadora e mais próxima das referências locais (`.local/REFERENCIAS.md`). Em tela, só `DESIGN.md`.
2. Registre em `.plans/DECISOES-AUTONOMAS.md`: spec e tarefa, o que faltava, o que decidiu, por quê, como desfazer.
3. Siga.

Pare antes do portão só nos três casos de `RULES.md` §4.

## 5. Fechar a entrega

1. Gates 1 a 6 no repositório inteiro. Depois, ⚠️ a rodada de eval do checkpoint desta entrega (`npm run eval:llm -- --checkpoint <nome>`, `QA.md`). Se a cota acabar, pare a rodada, anote e retome no dia seguinte com `--retomar`.
2. Escreva `.plans/entrega-N-relatorio.md`:
   - o que foi construído, por spec, com os hashes;
   - números (testes, evals, chamadas por run, trocas de modelo, o que houver) e a tabela de `evals/COMPARACAO.md` com a evolução entre checkpoints;
   - decisões autônomas e bloqueios, em destaque;
   - bibliotecas instaladas;
   - **roteiro de conferência do portão**, com passos numerados e o que a dona deve ver em cada um (`RULES.md` §7 e `OBSERVABILITY.md` §5);
   - para a entrega 3: screenshots de cada tela em celular e desktop, em `docs/screenshots/entrega-3/`.
3. Atualize `.docs/ROADMAP.md` §0.
4. Commit, `git tag entrega-N`, `git push --tags`.
5. **Pare.** Diga à dona, em poucas linhas: o que ficou pronto, o que ficou bloqueado e onde está o roteiro. Não comece a entrega seguinte.

## 6. Uso da janela e passagem

A barra de status grava em `.local/uso.json` quanto da janela de 5 horas e da semana já foi usado (`cinco_horas.usado_pct`, `semana.usado_pct`, `contexto_pct`). O arquivo é atualizado a cada resposta sua.

**Antes de despachar cada tarefa** (e antes de fechar spec ou entrega), leia `.local/uso.json`:

- `cinco_horas.usado_pct >= 85` **ou** `semana.usado_pct >= 95` → **não comece tarefa nova.** Faça a passagem e pare.
- `contexto_pct >= 70` → faça a passagem e peça à dona para abrir uma sessão nova (o estado está nos arquivos; sessão nova custa menos que contexto cheio).
- Arquivo ausente, valores `null` ou `atualizado_em` com mais de 30 minutos → siga normalmente.

**Passagem**, nesta ordem:

1. Não deixe tarefa pela metade: ou ela termina (veredito e commit), ou é revertida. O estado no git e em `.plans/entrega-N-estado.md` tem que bater.
2. Escreva `.local/PASSAGEM.md` (fora do git, sobrescreve a anterior), com no máximo 40 linhas:
   - entrega, spec e tarefa em que parou, e o hash do último commit;
   - a próxima tarefa a despachar, pelo id do plano;
   - o que você sabe e ainda **não está em arquivo nenhum**: uma reprovação em curso e o que o verificador apontou, uma decisão autônoma ainda não registrada, um erro de ambiente, algo que estranhou;
   - o que falta para fechar a spec atual;
   - o uso lido (`5h`, `7d`) e quando a janela renova;
   - o comando para retomar: `claude --model opus` e `/construir-entrega N`.
3. Diga à dona, em três linhas: onde parou, que a passagem está em `.local/PASSAGEM.md`, e a hora em que a janela renova.

Ao retomar (§0.3), leia a passagem, registre nos arquivos certos o que ela trazia de pendente e apague o conteúdo dela (deixe só uma linha "retomada em <data>").

## Verificação obrigatória

- Nenhum documento de `.docs/` foi lido inteiro "por garantia"; nenhum prompt de subagente levou mais do que o bloco da tarefa.

- Nenhuma tarefa foi commitada sem veredito APROVADO do verificador.
- Um commit por tarefa, caminhos explícitos, nada de `-A`, nada de `--force`.
- `.plans/entrega-N-estado.md` bate com o `git log`.
- Nenhum arquivo fora de `ritu/` foi alterado.
- O relatório lista toda decisão autônoma e todo bloqueio. Nunca declare a entrega completa com pendência escondida.
