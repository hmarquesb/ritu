# ADR 0028: O que a mensagem traz vale no mesmo run, sem gravar

## Status

Aceito · 2026-11-15

## Contexto

Uma mensagem pode citar itens de casa ("trouxe abóbora"), algo a evitar sempre ("sou alérgica a camarão"), algo que a pessoa não come ("não como coentro") ou uma restrição ("sou vegetariana"), muitas vezes junto com um pedido para agora. O agente só grava por proposta aprovada (regra 4), mas a resposta do mesmo run não pode ignorar o que a pessoa acabou de dizer. O temporário do dia (`evitar_temporario`) só guardava `EvitarItem` (`grupo | alimento | texto`), e a spec 008 não permite migração.

## Decisão

1. Itens de casa citados entram no run como `casa_da_mensagem` (`preparar` e `casa.ler` os consideram), mas a casa não é gravada; o que vira registro é a proposta, aprovada pela pessoa.
2. "Evitar sempre", "não como" (com id de alimento) e restrição citados vão ao temporário do dia antes de chamar o Acompanhante, e o filtro do run lê o temporário. Assim valem no mesmo run e no resto do dia, sem tocar o perfil.
3. O temporário do dia passa a guardar `ItemDoDia = EvitarItem | { tipo: "restricao"; valor: Restricao } | { tipo: "nao_come"; valor: string }`. A coluna `tipo` já é `text`: não há migração. `montarFiltro` separa por tipo.
4. "Não como" com nome livre (sem id) vale só no run, como o "não como" livre do perfil, que também não filtra alimentos.
5. Para o prompt, `evitar_da_mensagem` leva só os itens de tipo `texto` (as palavras da pessoa); os itens resolvidos já estão no filtro.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Gravar direto no perfil ou na casa | Fere a regra 4: o agente só grava por proposta aprovada |
| Valer só depois da aprovação | A resposta do mesmo run sugeriria o que a pessoa acabou de dizer que não come |
| Tabela ou colunas novas para restrição e "não como" do dia | Migração sem ganho: a coluna `tipo` já é texto livre |

## Consequências

- O que a pessoa diz numa mensagem vale para o resto do dia mesmo que ela não aprove a proposta; no dia seguinte, só o que foi aprovado continua.
- Leitores do temporário precisam tratar os três tipos novos (`montarFiltro` é o único hoje).
- Desfazer: voltar a porta para `EvitarItem[]`; restrição e "não como" passariam a valer só no run.
