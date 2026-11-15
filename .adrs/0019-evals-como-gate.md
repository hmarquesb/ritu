# ADR 0019: Evals como gate, com registro da evolução

## Status

Aceito · 2026-11-14

## Contexto

O valor do Ritu como portfólio está em mostrar engenharia de agentes medida. Testar o agente só com LLM é caro na cota gratuita e não é determinístico; não testar com LLM deixa de fora o que só o modelo faz.

## Decisão

1. Evals determinísticos (sem LLM, com o `AgentRuntime` roteirizado e fakes) rodam sempre: em cada spec e na CI, como gate.
2. Evals com LLM rodam só em cinco checkpoints fixos (fim da entrega 1, depois da spec 011, fim das entregas 2, 3 e 4), nunca a cada mudança.
3. Os casos com LLM são organizados por família (intenção, conteúdo, fidelidade, trajetória, autocorreção, segurança, custo e outras), cada uma com a sua métrica.
4. Cada rodada é guardada (`evals/resultados/`, `evals/COMPARACAO.md`, `historico.json`) para mostrar a evolução.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Evals com LLM a cada push | Esgota a cota gratuita; resultados ruidosos |
| Só testes determinísticos | Não mede o que depende do modelo |
| Avaliação manual | Não reproduzível, não mostra evolução |

## Consequências

- O comportamento do agente é conferido sem rede na maior parte do tempo.
- Regressões do modelo só aparecem nos checkpoints.
- A evolução é pública, na página Bastidores e no README.
