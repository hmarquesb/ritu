# ADR 0003: Base estruturada em YAML consultada por tools, sem RAG

## Status

Aceito · 2026-11-14

## Contexto

Todo motivo dado à pessoa precisa vir de uma fonte conferível. Momento, clima, doshas, alimentos e práticas precisam ser cruzados de forma previsível, e o Juiz precisa conseguir conferir o que o agente disse. Texto livre recuperado por similaridade não dá essa garantia.

## Decisão

1. A base ayurvédica fica em arquivos YAML em `data/` (alimentos, preparos, práticas, combinações, doshas, incômodos, vocabulário, fontes), validados por schema zod.
2. Tudo fala um vocabulário único e fechado: 12 qualidades (seis pares). Momento, clima, doshas e alimentos são cruzados por tabela.
3. O agente consulta a base por tools (`ayurveda.*`) e cita o id da linha em cada motivo.
4. O agente só sugere o que está na base. Uma refeição sugerida é sempre um preparo mais alimentos da base.
5. Toda linha tem fonte. Sem fonte confirmada, a linha entra como `a_confirmar` com confiança baixa.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| RAG sobre livros e artigos | Motivo não conferível; o modelo pode misturar trechos; difícil para o Juiz |
| Conhecimento do próprio modelo | Sem fonte, sem controle de vocabulário, alucinação |
| Banco relacional para a base | Mais atrito para curadoria e revisão humana do que arquivos versionados |

## Consequências

- A curadoria é trabalho explícito e revisado no portão 1.
- O agente diz que não sabe quando a base não cobre o caso.
- Alimento fora da base não entra em sugestões; a base cresce pelo que as pessoas registram.
