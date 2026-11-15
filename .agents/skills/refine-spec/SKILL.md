---
name: refine-spec
description: Refina uma spec existente em ./.specs/, editando o arquivo no lugar. Localiza a spec, mapeia lacunas e ambiguidades contra o template ./.specs/_template.md e a documentação (.docs/), usa a skill feature-concept para resolver decisões genuínas e reescreve a spec seguindo o template. Não implementa — entrega apenas o arquivo de spec refinado. Use SEMPRE que o usuário pedir para refinar, melhorar ou revisar uma spec: "refina a spec", "refine a spec", "melhora a spec", "aprimora a spec <nome>", "a spec está fraca", "revisa a spec", "torna a spec mais assertiva".
metadata:
  author: coders-university
  version: "1.0.0"
---

# Refine Spec

Eleva a qualidade de uma spec existente: fecha lacunas, remove ambiguidades e alinha o documento ao template canônico do projeto, mantendo a intenção original da feature.

## Convenções do projeto

- **Specs:** `./.specs/NNN-<nome>.md`
- **Template:** `./.specs/_template.md` (estrutura canônica — alinhe a spec a ela).
- **Contexto:** `AGENTS.md` e documentos em `.docs/` (mapa em `AGENTS.md`).
- **Elicitação:** skill `feature-concept` (entrevista uma pergunta por vez).

## Fluxo

### 1. Localizar a spec

1. Tente `./.specs/NNN-<nome>.md` (pelo número ou pelo nome). Se não existir, busque pelo nome em `./.specs/`.
2. Se não achar, pergunte ao usuário o caminho.

### 2. Mapear contra o template

1. Leia a spec e o template `./.specs/_template.md`.
2. Liste, seção por seção, o que está ausente, vago, contraditório ou ambíguo (ex.: critério de aceite não verificável, "TODO", decisão implícita).
3. Leia só as seções de `.docs/` que a spec toca, para resolver silenciosamente o que a documentação já responde. Confira também se "Leitura para a construção" está no mínimo e se "Nível das partes" está preenchido.

### 3. Resolver lacunas genuínas

1. Para as lacunas que a documentação não responde, carregue a skill `feature-concept` e conduza a entrevista (uma pergunta por vez, com resposta recomendada) — apenas sobre as decisões que o refinamento realmente precisa.
2. Se a spec já estiver sólida, não burocratize: faça o refinamento direto.

### 4. Reescrever no lugar

1. Edite o arquivo da spec seguindo o template, preenchendo todas as seções com conteúdo real.
2. Preserve a intenção original da feature — refine, não mude o rumo.
3. Não invente decisões: o que não for confirmado marca-se como "em aberto".
4. Mantenha o idioma original da spec (português BR).

### 5. Reportar

1. Imprima um resumo do que mudou: seções preenchidas, ambiguidades removidas, decisões novas e pontos em aberto.
2. Não implemente nada a partir daqui.

## Regras

- **Não implemente.** Esta skill entrega o documento de spec refinado; a execução é do `construir-entrega`.
- **Não sobrescreva o template** nem outras specs.
- **Alinhe-se à documentação do projeto** (`.docs/`) antes de propor qualquer decisão técnica.
