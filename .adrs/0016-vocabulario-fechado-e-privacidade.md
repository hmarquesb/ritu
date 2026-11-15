# ADR 0016: Vocabulário fechado, nenhuma pergunta sensível de saúde, privacidade por minimização

## Status

Aceito · 2026-11-14

## Contexto

O Ritu não é orientação médica. Perguntar sobre doenças, gestação ou remédios levaria o produto para um terreno que ele não pode ocupar e criaria dados sensíveis. Ao mesmo tempo, a pessoa pode contar um incômodo leve ou que não pode comer algo.

## Decisão

1. O agente só sugere o que está no vocabulário fechado da base: alimentos, ervas e especiarias culinárias, óleos de uso comum e práticas leves. Sem diagnóstico, cura, dosagem, suplemento ou fitoterápico.
2. O produto não pergunta sobre gestação, doenças ou remédios.
3. Incômodo leve recebe recomendação de conforto com aviso reforçado e nunca entra em nenhum nível de memória. Sinal de alerta, físico ou emocional, não recebe recomendação, só encaminhamento.
4. "Evitar sempre" e restrições guardam só o alimento ou o grupo, sem o motivo.
5. Privacidade por minimização: e-mail só para entrar, nada de telefone nem GPS, mensagens por 7 dias, faltas por 30, toda consulta com o `conta_id`, e a telemetria nunca leva texto da pessoa.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Anamnese de saúde no cadastro | Dado sensível; aproxima de orientação médica |
| Guardar o motivo das restrições | Dado de saúde sem necessidade |
| Lista aberta de sugestões pelo modelo | Sem controle sobre suplementos e fitoterápicos |

## Consequências

- Toda resposta leva "Não é orientação médica." e passa pelo Juiz.
- Os filtros de segurança rodam em código e são conferidos de novo pelo validador.
- "O que sei sobre você" mostra tudo e "Apagar meus dados" apaga tudo.
