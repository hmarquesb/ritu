# ADR 0050: Toques da casa por uma rota, visão devolvida pela rota e relógio noturno no modo E2E

## Status

Aceito · 2026-11-17

## Contexto

Minha casa e Como ficou? (spec 019) são as duas telas em que a pessoa corrige à mão o que o Ritu sabe: o que tem, o que acabou, do que gosta, o que quer comprar e como ficou cada sugestão. São toques sem modelo, e cada um muda o que a resposta seguinte vai considerar.

Ao construir, apareceram três forças:

- a casa tem seis ações (adicionar, adicionar texto livre, tenho, acabou, sempre tenho, tirar), e cada uma muda a posição do item entre seções;
- a semente da demonstração gravava os retornos da conversa de ontem com a hora da cópia, e eles caíam em "Hoje";
- o momento do dia vem da hora do relógio, e os preparos com couve e leite só são candidatos à noite. Os testes e o E2E da pergunta de casa só passavam de madrugada.

## Decisão

1. A casa tem **uma rota**, `POST /api/casa`, com `acao` em união discriminada (`acaoDaCasaSchema`). Gosto e lista têm as suas (`/api/preferencias`, `/api/lista`), e o retorno, `POST /api/retornos/:id`.
2. Toda rota de toque **devolve a visão inteira** (`CasaNaTela`, ou o `RetornoNaTela` e o número de pendentes), e a tela troca o estado pela resposta. Não há atualização otimista.
3. A lógica de cada rota fica em `src/app/_rotas/casa.ts`, testada com o container em memória; cada `route.ts` só liga `depsReais()`.
4. `Container.lerCasa` e `Container.lerComoFicou` resolvem o fuso sozinhos (`cidade_fuso` do perfil, ou `config.clima.fusoPadrao`).
5. "Acabou" pela tela não grava falta. Pôr na lista por conta própria grava o motivo `pessoa` (migração `0004`).
6. `outcomes.criar` aceita `criadoEm`; a cópia da semente data os retornos no dia da conversa semeada.
7. Em `RITU_MODO=e2e`, o container usa um relógio que anda junto com o real, deslocado em horas inteiras para cair às 01h de `config.clima.fusoPadrao`. Testes de unidade que dependem do momento do dia fixam o relógio.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Uma rota por ação da casa | Seis `criarRota` iguais, com o mesmo schema de resposta; a união discriminada valida tudo num lugar |
| Atualização otimista na tela | Cada toque muda a seção do item e as regras moram no core; repetir as regras no cliente abriria divergência, e os toques são rápidos (sem modelo) |
| Roteiro do E2E com alimentos de qualquer hora | Mudaria o roteiro e as expectativas da 018 para contornar o relógio; o problema é o teste depender da hora real |
| Relógio do E2E parado num instante | A cota por minuto, as esperas e a ordem dos eventos precisam do tempo andando |
| Retornos da semente com a hora da cópia e a tela agrupando pela data do run | A visão agrupa por `criado_em` em todo lugar; corrigir na origem mantém uma regra só |

## Consequências

- A tela de casa é fina: chama a rota, troca o estado, move o foco para a seção nova.
- Cada toque custa uma leitura completa da casa; com as contagens de uma casa real, isso é barato.
- O servidor do E2E mostra datas do dia seguinte durante o dia real. Depois de cerca de 4 horas contínuas do mesmo servidor, o relógio recalcula o deslocamento e pode recuar 4 horas; numa rodada de E2E isso não acontece.
- Teste novo que dependa do momento do dia deve fixar o relógio.
