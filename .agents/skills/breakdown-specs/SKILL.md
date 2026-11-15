---
name: breakdown-specs
description: Decompõe um prompt grande ou de alto nível em várias specs pequenas e independentes — uma feature por vez — usando a skill create-spec. Recebe o prompt inicial (ex.: "autenticação completa", "CRUD de produtos e users"), identifica as unidades de trabalho (sign-in, sign-up, confirm-account, forgot-password, etc.), ordena por dependências, numera sequencialmente e gera cada spec em ./.specs/ seguindo o template. Use SEMPRE que o usuário pedir para quebrar, dividir, decompor ou fazer breakdown de um prompt/feature em múltiplas specs, ou quando o prompt descrever várias features de uma vez: "quebra em specs", "divide em várias specs", "breakdown", "decompõe o prompt", "cria as specs de <feature grande>", "decompor em specs menores". Não use para um único fluxo pequeno — nesse caso use create-spec direto.
metadata:
  author: coders-university
  version: "1.0.0"
---

# Breakdown Specs

Converte um prompt amplo em **um conjunto ordenado de specs pequenas**, cada uma implementando uma feature por vez. Você é o arquiteto da decomposição: entende o prompt inteiro, encontra as fronteiras de features, decide a ordem e delega a redação de cada spec ao `create-spec`.

O objetivo é entregar specs que o `construir-entrega` consiga consumir uma a uma, na ordem, sem que nenhuma dependa de outra ainda não escrita. Specs grandes demais viram implementação lenta, review difuso e retrabalho — a decomposição existe para evitar isso.

## Quando NÃO usar

- O prompt já descreve **uma única feature pequena** (ex.: "spec de sign-in"). Isso é trabalho do `create-spec` direto.
- O prompt pede para implementar, não para especificar. A quebra é especificação; implementação é do `construir-entrega`.

## Convenções do projeto

- **Specs:** `./.specs/[number]-<nome>.md`, numeração sequencial global em 3 dígitos (`001-sign-in.md`), continuando do maior número existente na pasta.
- **Template:** `./.specs/_template.md` (estrutura canônica — todas as child specs devem segui-lo à risca).
- **Contexto:** `AGENTS.md` e documentos em `.docs/` (mapa em `AGENTS.md`).
- **Elicitação:** skill `feature-concept` (entrevista uma pergunta por vez).
- **Redação:** skill `create-spec` (por child spec).

## Fluxo

### 1. Entender o prompt inteiro

1. Leia o prompt sem interromper. Separe o que está **dito** do que está **implícito**.
2. Se a ideia estiver vaga ou com lacunas materiais, carregue a skill `feature-concept` e conduza a entrevista no nível do prompt **inteiro** (uma pergunta por vez, com resposta recomendada) até a fronteira de decisões esvaziar. Não entreviste por spec individual ainda.
3. Adquira contexto: leia `AGENTS.md` e os documentos do mapa relevantes (`BUSINESS.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, etc.). Se a documentação já responde algo, use-a — não pergunte.

### 2. Mapear as features

1. Enumere **tudo** que o prompt pede — o dito e o implícito (ex.: "auth" implica sessão, token e guards, mesmo que não ditos).
2. Agrupe por afinidade: domínio, entidade, fluxo de usuário, integração.
3. Para cada grupo, decida se é uma spec só ou se quebra em várias (ver **Heurísticas de quebra** abaixo). Recursivamente: uma quebra pode revelar sub-quebras dentro de outra.
4. Produza uma **lista achatada** de specs candidatas — a hierarquia pai/filho vive apenas no campo `Dependências`, não na estrutura de arquivos.

### 3. Definir granularidade (heurísticas de quebra)

Uma spec deve ser a menor unidade que **entregue valor verificável sozinha**. Decida pelas regras:

**Merece spec própria quando:**

- É um fluxo de usuário completo e testável de ponta a ponta (ex.: sign-in, sign-up, confirm-account, forgot-password, refresh de token, logout).
- É uma entidade de domínio com CRUD coeso e verificável (ex.: CRUD de produtos, CRUD de users).
- É uma capacidade transversal com fronteira clara (ex.: sessão/guards de rota, rate limiting, storage).
- Várias specs dependem de uma base comum (ex.: schema das tabelas, entidades, infra do domínio) — nesse caso crie uma **spec-base** do domínio antes das features que a consomem.

**NÃO quebrar por:**

- Arquivo, classe, controller ou endpoint individual — fronteiras técnicas não são fronteiras de feature.
- Operação trivial que faz parte de um fluxo maior (ex.: "criar tabela users" não é spec separada — é parte da spec-base ou do sign-up).
- Fluxo atômico que não entrega valor sem o resto (ex.: separar "página" de "validação" do mesmo fluxo).

**Exemplos de decomposição:**

| Prompt                   | Quebra resultante                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação completa    | `001-auth-schema` (spec-base) → `002-sign-up` → `003-confirm-account` → `004-sign-in` → `005-forgot-password` → `006-refresh-token-session`                                      |
| CRUD de produtos         | `001-products-schema` (spec-base) → `002-product-create` → `003-product-list` → `004-product-update` → `005-product-delete` — ou uma spec única de CRUD se o domínio for simples |
| Loja com produtos e auth | `001-schema-base` → `002-sign-up` → `003-sign-in` → `004-product-crud` → ...                                                                                                     |

Use o bom senso do domínio: produto simples com 3 campos vira uma spec de CRUD só; produto complexo (variantes, estoque, permissões) vira schema + uma spec por operação.

### 4. Ordenar e numerar

1. **Ordem de dependências:** specs-base primeiro; features dependentes em seguida; features independentes em qualquer ordem (prefira a de maior valor de negócio).
2. **Numerar sequencialmente** em 3 dígitos, continuando do maior número já existente em `./.specs/`. Nunca renumere specs existentes.
3. Cada spec deve declarar em `Dependências` as specs anteriores das quais depende (por nome de arquivo, ex.: `001-auth-schema.md`).

### 5. Apresentar o plano de breakdown e aprovar

1. Imprima o **plano de breakdown**: lista ordenada com número, nome do arquivo, uma linha de resumo e dependências de cada spec.
2. Destaque: total de specs, ordem de implementação sugerida e qualquer feature que já tenha spec existente (reutilize em vez de duplicar — confirme com o usuário).
3. **Aguarde a aprovação antes de gerar qualquer spec.**

### 6. Gerar as child specs

1. Para cada spec da lista, carregue a skill `create-spec` e siga o fluxo dela (template `_template.md`, contexto de `.docs/`, decisões explícitas, português BR, não sobrescrever).
2. Use o entendimento consolidado do passo 1 como insumo — não re-entreviste o usuário por spec; apenas preencha lacunas pontuais que surgirem.
3. Garanta consistência entre specs: critérios de aceite complementares, sem contradição de escopo, e `Dependências` corretas.

### 7. Apresentar o resumo consolidado

1. Imprima o resultado final: cada arquivo criado, resumo de uma linha e a ordem de implementação sugerida (pronta para `construir-entrega`).
2. Encerre. Não implemente nada.

## Regras

- **Não implemente.** A quebra entrega o conjunto de specs; a execução é do `construir-entrega`, spec por spec, na ordem.
- **Não altere nem renumere specs existentes** — apenas adicione as novas. Se uma feature já tem spec, reutilize-a e avise o usuário.
- **Não burocratize prompts pequenos.** Um fluxo único vai direto para o `create-spec`, não passa por aqui.
- **Uma feature por spec.** Se uma spec ainda parece "duas features", quebre de novo.
- **Não invente contexto técnico.** Decisões de stack devem estar alinhadas a `.docs/`. Marque como "em aberto" o que não for confirmável.
- **Use a linguagem do projeto** (português BR) nos documentos, independentemente do idioma do prompt.
