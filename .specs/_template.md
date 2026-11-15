---
title: <Nome da spec>
status: draft
entrega: <1-4>
created: <AAAA-MM-DD>
---

# <Nome da spec>

> Resumo em 1–2 frases: o que esta spec entrega e por quê.

## Contexto

Problema de fundo e motivação. Por que esta parte existe no produto.

## Objetivo

O que a feature deve alcançar, de forma mensurável quando possível.

## Escopo

- **Dentro:** o que esta spec cobre.
- **Fora:** o que ela não cobre, e em qual outra spec está (ou que o produto não faz).

## Necessidade de negócio

Valor esperado para o negócio e dor que resolve.

## Critérios de aceite

- [ ] Critério verificável e objetivo.
- [ ] ...

## O que fazer

- Ações que devem ser executadas.

## O que não fazer

- Ações que devem ser evitadas.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| ...     | ...             | ...      |

## Contratos

Por extenso, para a spec ser lida sem abrir código:

- **Cria:** schemas zod, portas (interfaces), formatos de mensagem, tabelas, variáveis de ambiente.
- **Usa:** contratos de specs anteriores (com o número da spec).

## Evals (quando a spec toca agente, prompt, tool ou base)

- Casos determinísticos novos.
- Casos com LLM novos e a expectativa de cada um (deve incluir / não pode incluir / incerto).

## Nível das partes

Tudo o que não for citado aqui é `mecanica` (Haiku).

- **nucleo** (Sonnet): loop, checkpoint, pausa, aprovação, Mastra, roteador de modelos, telemetria, auth.
- **tela** (Sonnet): qualquer componente, página ou estilo.
- **conteudo** (Opus): redação da base ayurvédica e de textos lidos pela pessoa (quiz, doshas, perfil de demonstração).

Se nada, escreva "tudo mecânica".

## Leitura para a construção

O mínimo que o orquestrador e os subagentes precisam ler além desta spec: documento e seção. Os contratos acima já vêm por extenso; não liste documento inteiro.

- `DOC.md` §N: para quê.

## Dependências

- Integrações, APIs, bibliotecas e specs anteriores.

## Riscos e trade-offs

- O que estamos escolhendo NÃO fazer e por quê.

## Edge cases e modos de falha

- Casos limites e como o sistema se comporta quando algo falha.

## Resultado (definição de pronto)

Condições objetivas que indicam que a feature está pronta.

## Arquivos e diretórios envolvidos

- Caminhos que esta spec impacta.
