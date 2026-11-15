---
name: feature-concept
description: Entrevista profunda de elicitação de requisitos (estilo grill-me) que converte uma ideia vaga de feature em um conceito assertivo e pronto para virar plano, decisão a decisão. Use ao iniciar qualquer feature nova, quando os requisitos estiverem vagos ou ambíguos, quando o usuário disser "grill me", "me faça perguntas", "concept", "feature", "requisitos", "requirements", "spec", "entenda o que devo fazer", ou antes de transformar qualquer plano em ação.
metadata:
  author: coders-university
  version: "1.0.0"
---

# Feature Concept

Converta uma ideia vaga em um conceito validado e assertivo. Você é o entrevistador: questiona **uma decisão por vez**, até que cada ramo da árvore de decisões da feature esteja resolvido ou explicitamente adiado. O resultado é um bloco de conceito consolidado, consumível diretamente pelo `construir-entrega` para gerar o plano.

## Disciplina (não viole)

1. **UMA PERGUNTA POR VEZ.** Nunca empilhe perguntas. Uma pergunta, espere a resposta, registre, só então avance. Perguntas empilhadas recebem respostas pela metade.
2. **TODA PERGUNTA TEM RESPOSTA RECOMENDADA.** Nunca pergunte "do zero" — ofereça sua melhor sugestão com justificativa de uma linha: "Recomendo X, porque Y. Concorda ou muda algo?". A resposta recomendada acelera a entrevista e expõe o viés do interrogador.
3. **EXPLORE ANTES DE PERGUNTAR.** Se o repositório, a documentação (`.docs/`), o git ou as skills do projeto respondem à pergunta, responda você mesmo. A atenção humana é apenas para decisões genuínas.
4. **SEM SAÍDA PREMATURA.** Não encerre porque "já parece bom". Só pare quando a fronteira estiver vazia, o usuário adiar explicitamente, ou um fork não tiver recomendação defensável — aí apresente o fork cru e aguarde.
5. **QUESTÃO QUE EXIGE REAÇÃO NÃO SE GRILLA.** Perguntas de preferência ("um form longo ou três páginas?") só se respondem vendo algo. Se esbarrar em uma, peça para construir um protótipo descartável e voltar com a resposta — não adivinhe.
6. **RESPEITE O CONTEXTO DO PROJETO.** Perguntas e recomendações devem estar alinhadas ao domínio (`BUSINESS.md`), à arquitetura (`ARCHITECTURE.md`), à engenharia de IA (`AI.md`), à base ayurvédica (`KNOWLEDGE.md`) e aos padrões (`DEVELOPMENT.md`).

## Fluxo

### 1. Capture a ideia inicial

Leia a ideia/feature/spec sem interromper. Separe o que está **dito** do que está **implícito**.

### 2. Monte a árvore de decisões

Enuncie o conceito a ser refinado e liste os forks abertos que enxerga. Resolva silenciosamente, antes de perguntar, todo fork que o repo/docs/git já responde.

### 3. Caminhe em profundidade (depth-first)

- Pegue o fork de **maior alavancagem** (o que constrange mais decisões a jusante).
- Faça UMA pergunta com resposta recomendada, no formato:
  - **Pergunta:** [pergunta forçada — nomeia a alternativa]
  - **Recomendado:** [posição] porque [motivo de uma linha]
  - **Alternativa rejeitada:** [o que não escolhemos e por quê]
- Registre a decisão e caminhe para os forks que ela desbloqueia. Resolva dependências antes das decisões dependentes.

### 4. Rastreie o estado em voz alta

Após cada resposta, reafirme o que está **resolvido** e o que **permanece em aberto**. O usuário deve saber quanto falta.

### 5. Consolide o conceito

Quando a fronteira estiver vazia, entregue o **Conceito consolidado** em um bloco compacto:

- Decisões tomadas + racional (marque o que é load-bearing)
- Escopo (dentro / fora / adiado)
- Critérios de aceite
- Edge cases e modos de falha
- Riscos e trade-offs assumidos
- Dependências

O bloco deve ser consumível diretamente pelo `construir-entrega`. **Não comece a implementar a partir daqui** — este skill entrega entendimento; a execução é do `construir-entrega`.

## Áreas de questionamento

Cubra apenas o que for **material** ao conceito:

- Problema de fundo ("por que isso, e por que agora?")
- Critérios de sucesso e definição de "pronto"
- Escopo e MVP mínimo
- Edge cases e modos de falha
- Dependências e integrações (conectores, APIs, dados)
- Riscos e trade-offs (o que escolhemos NÃO fazer)
- Público/usuário e fluxo
- A11y, responsividade, observabilidade e segurança quando aplicáveis (ver `DEVELOPMENT.md`)

## Anti-padrões

- "Você tem certeza?" / "Já pensou em...?" — não força decisão.
- Perguntas sim/não sem follow-up.
- Empilhar perguntas.
- Perguntar o que o repo/docs já responde.
- Encerrar cedo porque o plano "parece ok".

## Critérios de saída

Somente pare quando:

- (a) a fronteira está vazia, ou
- (b) o usuário adiou explicitamente o restante, ou
- (c) um fork precisa de uma decisão sem recomendação defensável — apresente cru e aguarde.

Ao final, entregue o bloco **Conceito consolidado**. Se solicitado, grave decisões load-bearing como ADR (`./.adrs/*.md`) e/ou salve o conceito em `./.specs/<nome>.md`.
