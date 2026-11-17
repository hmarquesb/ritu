# ADR 0044: Etapas por fluxo NDJSON no POST, run independente da conexão e visão do run por projeção

## Status

Aceito · 2026-11-17

## Contexto

A tela Conversa precisa mostrar as etapas do agente enquanto ele trabalha e a resposta no mesmo pedido, sem recarregar. Enviar uma mensagem é um `POST` com corpo e sessão. Um run pode passar de alguns segundos, e a pessoa pode fechar a aba no meio. A saída do Acompanhante e o run guardam campos internos (linhas da base, citados, checkpoint, clima usado, tokens, modelos) que não podem chegar ao navegador.

## Decisão

1. `POST /api/runs` e `POST /api/runs/:id/resposta` respondem com um fluxo `application/x-ndjson`: uma linha por evento `EventoDaTela` (`inicio`, `etapa`, `fim`, `erro`). `criarRotaDeFluxo` faz as mesmas checagens de `criarRota` (sessão, conta, tamanho, corpo) e só abre o fluxo na primeira emissão; erro conhecido antes disso sai como JSON com o status do código (`statusDoErro`), e depois disso como evento `erro`. Headers `Cache-Control: no-store` e `X-Accel-Buffering: no`; `maxDuration = 60`.
2. O run não depende da conexão: `request.signal` não é ligado ao trabalho, e escrever num fluxo fechado é ignorado. A tela recarregada lê o run em andamento com `GET /api/runs/:id` a cada 2 s, por até 90 s.
3. As frases das etapas são montadas por código (`fraseDaEtapa`), a partir do tipo e do nome da etapa; etapa sem frase não aparece.
4. A tela recebe só a `VisaoDoRun`, uma projeção montada campo a campo por `visaoDoRun` (função pura) e por `visaoDoRunDaConta`, usada pela conversa do dia, pelas rotas JSON e pelas de fluxo. A resposta aparece inteira, sem efeito de digitação.
5. O leitor do fluxo (`lerEventos`) fica junto da tela, em `src/components/ritu/conversa/`, porque `src/components/` só importa tipos do core (R4). O tipo dos eventos e `codificarEvento` ficam no core.
6. `RituError` carrega a marca `Symbol.for("ritu.error")`, e `ehRituError` reconhece por ela os erros do Ritu criados por outra cópia do módulo (no build do Next, o container do modo e2e vive em `globalThis`). Erro sem a marca, mesmo com `code`, continua `500 erro_inesperado`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `EventSource` (SSE) | Só faz `GET`, sem corpo; a mensagem e a sessão iriam por outro pedido |
| WebSocket | Um canal próprio para algo que um pedido resolve; não cabe bem em função serverless |
| Consultar o run por intervalo desde o envio | As etapas chegariam atrasadas e o servidor receberia pedidos à toa |
| Cancelar o run quando a pessoa sai | Perderia uma resposta já paga em cota; o resultado fica no dia da pessoa |
| Mandar a saída inteira e esconder campos na tela | Os campos internos chegariam ao navegador |
| Simular digitação da resposta | A resposta sai pronta de `finalizar`; quem mostra o trabalho são as etapas |
| Reconhecer `RituError` só por `code` | Erro de driver ou do Node com `code` viraria 400 com código interno e sem log |

## Consequências

- As etapas e a resposta chegam no mesmo pedido, e um proxy que segure o fluxo só tira as etapas: a resposta continua certa.
- Um run longo segue gastando cota mesmo sem ninguém na tela; o resultado fica na conversa do dia.
- Cada campo novo da saída precisa entrar em `visaoDoRun` para aparecer na tela.
- Um run que estoure os 60 s fica `running` até a limpeza marcar `expired`; a tela mostra "ainda respondendo" e depois o erro.
