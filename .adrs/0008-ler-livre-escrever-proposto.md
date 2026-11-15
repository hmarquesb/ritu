# ADR 0008: Ler é livre, escrever é proposto

## Status

Aceito · 2026-11-14

## Contexto

O Ritu lembra da pessoa: casa, gostos, rotina, "evitar sempre", lista do que ter em casa. Se o modelo gravasse direto, um erro de interpretação ou um texto malicioso viraria memória permanente sem a pessoa saber. Ao mesmo tempo, pedir aprovação para cada toque simples ("não tenho", "ajudou") seria cansativo.

## Decisão

1. Tools de leitura rodam livremente.
2. Tools de escrita do agente só geram propostas. No fim do run, as propostas aparecem num bloco "Posso anotar isto?", uma linha por assunto, e o run fica em `waiting_for_approval`.
3. Um executor em código grava só o que a pessoa aprovou. O modelo não participa da gravação. O executor só acrescenta: nenhuma proposta remove ou troca o que está guardado.
4. A resposta aparece antes da aprovação; aprovar não é condição para receber valor. Proposta sem resposta em 30 min expira.
5. Toques diretos da pessoa na tela (casa, gosto, retorno, lista, padrão) gravam na hora, por rotas próprias, sem agente: o toque é o consentimento.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Agente grava direto | Memória sem consentimento; risco de injeção virar dado permanente |
| Aprovação também para toques | Atrito desnecessário; o toque já é a decisão |
| Pergunta de aprovação a cada proposta, no meio do run | Interrompe a resposta; um bloco no fim é mais leve |

## Consequências

- Zero escrita sem aprovação é um teste determinístico.
- O executor de propostas é função pura e o único caminho de escrita do agente.
- Toques precisam de rotas próprias, com limite de uso.
