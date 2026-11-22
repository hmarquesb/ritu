# ADR 0051: "Você" numa página, duas rotas de escrita da memória e conversa apagada fora da conversa

## Status

Aceito · 2026-11-17

## Contexto

A spec 020 junta o que os documentos pediam em duas telas (Perfil e "O que sei sobre você") e abre o rastro do agente para a pessoa em Como pensei. Ao construir, apareceram estas forças:

- os fixos (dosha, cidade, evitar sempre) e os níveis de memória (rotina, padrões, gostos, faltas, conversa) vêm de tabelas diferentes, e cada nível tem as suas ações;
- apagar a conversa de um dia precisa tirar o texto da resposta, mas o que a pessoa aprovou e os retornos são memória de outro nível;
- as frases de Como pensei precisam de nomes (propostas, itens da casa), e o `resumo` das etapas e a telemetria nunca levam nome nem texto da pessoa;
- a linha do tempo precisa de `proposals`, que já importa tipo de `runs`: pôr o leitor em `src/core/runs/` criaria um ciclo (R9).

## Decisão

1. "Você" é uma página só: carta do dosha, "O que sei sobre você" com todos os níveis (os fixos são editados ali) e "Conta". Perfil deixa de ser tela. Refazer o quiz é `/voce/quiz`, com o quiz da 017.
2. Duas rotas de escrita, cada uma com `acao` em união discriminada, como a `/api/casa`: `POST /api/perfil` (fixos e quiz) e `POST /api/memoria` (demais níveis). Ambas devolvem a visão inteira. `/api/padroes/:id` sai.
3. Tirar um alimento de "evitar sempre" só por `/api/perfil`, com confirmação na tela.
4. Apagar a conversa de um dia apaga as mensagens e marca os runs fechados do dia com `runs.fora_da_conversa`, limpando `saida`, `checkpoint`, `pendencia` e `clima_usado`. Etapas, aprovações e retornos ficam. Run em `waiting_for_input` recusa com `conversa_em_andamento`.
5. "Apagar meus dados" é ação de servidor, com confirmação, que apaga na transação da 004 e encerra a sessão.
6. Como pensei monta frases por código a partir das etapas (`src/core/como-pensei/`, que importa `runs` e `proposals` sem ciclo); os nomes vêm do run e das propostas na hora de ler. A validação grava no `resumo` só os códigos das violações. Os detalhes técnicos (modelo, tokens, tempo) ficam recolhidos por passo e no total.
7. Duas métricas: `ritu_memoria_edicoes_total{nivel, acao}` e `ritu_conta_apagada_total{tipo}`, na linha Memória do painel.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Perfil e "O que sei" como telas separadas | Os mesmos campos em dois lugares; a pessoa não sabe onde mudar |
| Uma rota por nível ou por ação | Muitas rotas iguais; a união discriminada valida num lugar, uma porta por tabela de origem |
| Apagar os runs do dia junto com as mensagens | Perderia o que a pessoa aprovou, os retornos e o rastro do agente |
| Guardar os nomes no `resumo` das etapas | O `resumo` alimenta telemetria; nome de alimento ou texto da pessoa não vai para lá |
| Leitor de Como pensei em `src/core/runs/` | Ciclo com `proposals` (R9) |
| Proporção 50/50 para quem declarou "Misto" | Ninguém escolheu porcentagem; só o quiz dá proporção |

## Consequências

- A pessoa vê e muda tudo o que o Ritu sabe num lugar, e cada toque devolve a visão nova (sem atualização otimista).
- Como pensei continua de pé num dia apagado, sem os dados da saída.
- Frase nova de Como pensei é código e texto em `config/textos-como-pensei.ts`; uma etapa sem frase cai no texto genérico.
- O E2E de Como pensei cobre as etapas que o roteiro da demonstração produz; o run semeado sem rastro fica nos testes de unidade.
