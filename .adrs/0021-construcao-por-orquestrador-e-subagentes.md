# ADR 0021: Construção por orquestrador e subagentes, com portões humanos

## Status

Aceito · 2026-11-14

## Contexto

O Ritu é construído por agentes de código. Revisar cada commit à mão anula o ganho; deixar os agentes sem controle arrisca código que não segue as specs. O contexto do modelo principal é o recurso mais caro da construção.

## Decisão

1. A dona decide tudo antes: specs aprovadas, contas e chaves prontas. Durante uma entrega, ninguém pergunta; lacunas viram decisões autônomas registradas.
2. Um orquestrador (sessão principal) quebra cada spec em tarefas autossuficientes, despacha cada uma para um subagente do nível dela (mecânica, núcleo, tela, conteúdo) e manda um verificador rodar os gates e conferir o diff.
3. Um commit por tarefa aprovada pelo verificador, direto na `main`, com caminhos explícitos. Sem `--force` e sem reescrever histórico.
4. Quatro portões humanos, um por entrega, com relatório e roteiro de conferência.
5. O estado vive em arquivos (`.plans/`), para retomar em outra sessão.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Pull request por tarefa com revisão humana | Interrompe a construção a cada passo |
| Um agente só, fazendo tudo | Contexto cheio, sem verificação independente |
| Branches por spec | Mais cerimônia sem ganho num projeto de uma pessoa |

## Consequências

- As specs precisam trazer os contratos por extenso.
- Os gates automáticos são a principal defesa de qualidade.
- Decisões autônomas e bloqueios ficam visíveis no relatório de cada entrega.
