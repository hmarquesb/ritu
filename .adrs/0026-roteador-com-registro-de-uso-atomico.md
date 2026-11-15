# ADR 0026: Roteador de modelos com registro de uso atômico por janela

## Status

Aceito · 2026-11-15

## Contexto

A ADR 0014 decidiu vários modelos por papel, com registro de cota e troca automática. Faltava dizer como contar o uso, quando um modelo sai da lista e como o run mantém o mesmo modelo. A cota do plano gratuito é por minuto (pedidos e tokens) e por dia (pedidos), e o dia vira à meia-noite do Pacífico. Pedidos simultâneos não podem passar do limite.

## Decisão

1. O registro de uso (`UsageLedger`, tabela `llm_uso`) guarda uma linha por modelo e janela: o minuto cheio do relógio, em UTC, e o dia da cota, no fuso `America/Los_Angeles`.
2. `reservar` soma um pedido nas duas janelas numa transação só. Ela garante as duas linhas, trava as duas com `select … for update` (sempre minuto e depois dia), confere os limites e só então soma. Ou soma nas duas, ou não soma em nenhuma.
3. Os tokens são somados depois da chamada. Um modelo com os tokens do minuto acima do limite não recebe reserva nova naquele minuto.
4. Um 429 tira o modelo até o fim do minuto. No terceiro 429 do mesmo dia da cota, o modelo fica fora até a virada do dia. Quem tenta de novo é o roteador ou `chamarComPapel`, nunca o adaptador.
5. A ordem de tentativa é fixa: o modelo `preferir` (guardado no checkpoint do run), depois a lista do papel desde o começo. Assim o run mantém o modelo, e o papel volta ao principal quando a cota dele se renova. A troca é detectada pelo último modelo devolvido.
6. Os identificadores de modelo só aparecem em `config/llm-cotas.ts`, garantido pela regra R10 do teste de arquitetura.
7. Sem modelo para `decisao`, a resposta é montada por código (`respostaSemModelo`): um texto fixo e até três práticas sem ingrediente.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Janela deslizante de 60 s | Exige guardar cada pedido; a diferença para o minuto fixo é coberta pelo tratamento do 429 |
| Contar só em memória | Cada instância serverless teria a sua contagem; o limite do provedor é por projeto |
| Tentar primeiro o último modelo usado | Depois de uma troca por cota, o papel ficaria preso no modelo de reserva, gastando os modelos escassos |
| Nova tentativa dentro do adaptador | Esconde a troca do rastro e conta pedidos sem passar pelo registro |

## Consequências

- Trocar de modelo ou de cota é um commit em `config/llm-cotas.ts` e uma linha em `AI.md` §10. ⚠️ `npm run modelos:check` mostra o que deixou de responder.
- Chamadas feitas fora do Ritu com a mesma chave não entram na contagem, e o 429 cobre essa diferença. Por isso cada ambiente tem a sua chave.
- Na virada do minuto podem sair até 2 × `rpm` pedidos em poucos segundos. O 429 resultante tira o modelo por um minuto só.
- A suíte de contrato do registro (ADR 0025) roda no fake e no Postgres, inclusive com 20 reservas simultâneas.
