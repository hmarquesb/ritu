# ADR 0045: Limites de uso decididos na borda

## Status

Aceito · 2026-11-17

## Contexto

O Ritu tem limites de mensagem (por conta, por demonstração e por IP) e de toque, mais a cota de IA do dia, que pode acabar para todos. A pessoa nunca deve ficar sem nada: quando as mensagens acabam, os atalhos seguem; quando a cota de IA acaba, ela é avisada antes de escrever. Há ainda o tester (a dona e quem ela indica), que não tem limite, e o sinal de alerta, que deve ser atendido mesmo com o limite estourado.

O núcleo do agente (`conversar`) cuida de runs, e conta comum, tester e IP são assuntos de produto e de rede. Se o núcleo os conhecesse, cada caminho de teste e cada demonstração do agente dependeria de contas, e-mails e hashes de IP que não são dele.

## Decisão

1. O limite de mensagem é decidido na rota `POST /api/runs`, antes de `conversar`, por `decidirMensagem`. `conversar` só ganha o modo `semModelo: "limite"` e não conhece conta comum, tester nem IP.
2. Ordem de `decidirMensagem`: tester segue; cota de IA do dia esgotada em todos os modelos de `decisao` segue, sem consumir; consome a chave da conta (ou da demonstração) e a do IP numa chamada só. Passou: segue. Barrou, em ordem: só atalhos vira `so_atalhos`; texto com alerta por código vira `alerta`; o resto é recusado com `429` e o código do motivo.
3. O alerta vem antes do limite: segurança pesa mais que cota, e `conferirEntrada` é código, sem modelo. O alerta segue para `conversar` sem contar, e o guardrail por código responde.
4. O limite de toque fica dentro de `criarRota` e `criarRotaDeFluxo`, decidido pelo método (todo `POST` com conta, menos `POST /api/runs`), para nenhuma rota esquecer. `consumirToque` consome o minuto antes do dia; cada consumo é atômico em si.
5. O tester é reconhecido pelo e-mail em `TESTER_IDS` só ao entrar com Google (`entrarComGoogle` grava `contas.tester`); o e-mail continua servindo apenas para entrar, e o limite lê o campo da conta.
6. O `UsageLimiter.consumir` recebe um início próprio por chave e é tudo ou nada. No Postgres, o consumo roda numa transação: `insert … on conflict do nothing` e `select … for update` por par (chave, início), em ordem fixa; confere os tetos sob trava e só então soma. Se algum par está no teto, nada sobe. A ordem fixa evita deadlock (decisão autônoma A7 da 021).
7. `src/core/limits/` declara `ContaDoLimite`, com só os campos de `Conta` que os limites leem, porque `accounts` já importa `UsageLimiter` de `limits` e o ciclo é proibido pela R9 (A8).
8. A rota obtém IP, escopo e teto de `DepsDaRota.quemPede(request)`, implementado em `src/infra/auth/next.ts`, porque a R3 só deixa `src/app/` importar `@/infra/container` e `@/infra/auth/next` (A9). Escopo e teto só existem com `RITU_MODO=e2e`.
9. Toques e `retryAfterS` usam o fuso padrão (`clima.fusoPadrao`); só a hora da virada da cota de IA usa o fuso da cidade da pessoa (A3).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Decidir o limite dentro de `conversar` | O núcleo passaria a conhecer conta comum, tester e IP, e cada teste do agente carregaria esse peso |
| Lista de rotas que contam como toque | Rota nova ficaria de fora sem ninguém perceber; a regra pelo método não depende de lista |
| Recusar tudo depois do limite, inclusive alerta | A pessoa em sofrimento ou com sinal físico ficaria sem o texto de alerta por causa de cota |
| Consumir antes de checar a cota de IA | A pessoa perderia mensagem por falta de modelo, que não é culpa dela |
| Marcar tester por e-mail a cada pedido | Espalharia o e-mail pelo sistema; ele serve só para entrar |
| Um comando SQL atômico com início por linha | Difícil de ler e de travar em ordem; a transação com trava ordenada é mais clara |
| Faixa também com a cota do minuto esgotada | A cota do minuto volta em segundos; a faixa piscaria |

## Consequências

- A pessoa nunca fica sem resposta: os atalhos seguem com práticas por código e o alerta passa antes de qualquer recusa.
- Toda rota nova de `POST` com conta já conta um toque, sem lembrar de registrar.
- O núcleo do agente fica sem noção de limites; mudar um teto é mexer em `config/limites.ts`.
- O consumo atômico custa uma transação com travas por pedido de limite; o contrato do `UsageLimiter` passou a exigir o início por chave e a limpeza das janelas de minuto.
- O IP só entra como hash, nunca em chave de métrica, span ou log.
- O modo e2e ganha dois headers (`x-ritu-e2e-teto`, `x-ritu-e2e-cota`) que só valem com `RITU_MODO=e2e`.
