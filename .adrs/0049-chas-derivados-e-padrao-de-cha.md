# ADR 0049: Chás simples derivados das ervas e padrão de chá genérico

## Status

Aceito · 2026-11-17

## Contexto

Os chás eram só os fixos de `data/praticas.yaml`. Uma erva que a pessoa tem em casa e que vira chá (louro, alecrim, manjericão, chá-preto, chá-mate, chá verde) nunca era sugerida como chá. O padrão de chá apontava para um chá específico ("com frio e agitada, o chá de gengibre com canela"), e num dia em que a regra da base barra esse chá (`agitada` barra a guna `movel`) o padrão deixava de valer, embora o que ajuda a pessoa seja tomar um chá. As regras R1 e R2 de `KNOWLEDGE.md` §8.1 já dizem como as qualidades de um chá saem das ervas.

## Decisão

1. O alimento ganha o campo opcional `cha` (`parte`, `aviso`), só nos grupos `especiarias` e `bebidas`.
2. A base monta, em `montar`, depois da validação, um chá de uma erva só por alimento com `cha` (`derivarChas`, função pura): gunas e efeito da erva, contraindicação e momento pelo virya e pela marca `estimulante`, estados favorecidos pela tabela de estados (regra R9). Os derivados não são gravados em `praticas.yaml`.
3. O chá fixo vence: id derivado igual a um fixo é erro de validação. Toda prática `tipo: cha`, e só ela, tem id `cha-…`.
4. O padrão de chá não tem erva: chave `<estados>|cha`, frase "Quando você está {estados}, um chá costuma te ajudar.". Retornos de qualquer chá contam para ele, e ele vale quando pelo menos um chá passa no filtro da pessoa. Na resposta, o agente escolhe entre os chás candidatos (`acompanhante.v7`).
5. A migração `0005` converte as chaves `…|pratica:cha-*` gravadas, junta as duplicadas por conta (`confirmado` > `recusado` > `candidato`, ocorrências somadas) e reescreve a frase. O seed da demonstração grava o padrão genérico.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Escrever os chás simples à mão em `praticas.yaml` | Duplicaria a erva e abriria divergência entre a erva e o chá |
| Deixar o agente montar misturas livres | Validação difícil e textos sem revisão; as misturas ficam só nas fixas |
| Manter o padrão por chá e trocar por outro chá quando barrado | O padrão continuaria afirmando uma erva que nem sempre serve |

## Consequências

- Qualquer erva marcada com `cha` vira sugestão sem código novo fora da base; candidatos, casa, "evitar sempre", gosto, retorno, "vale ter em casa", validador e Juiz tratam o derivado como qualquer chá.
- A memória deixa de dizer qual erva ajuda; o gosto (011) continua guardando a preferência por um chá específico.
- `agua-morna-com-limao` passou a `tipo: pratica`, para que o prefixo `cha-` identifique os chás.
- Mais chás disputam o corte por tipo do contexto; um chá penalizado sai antes.
