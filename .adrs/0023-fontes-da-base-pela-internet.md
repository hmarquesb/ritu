# ADR 0023: Fontes da base consultadas pela internet, com registro da página

## Status

Aceito · 2026-11-15

## Contexto

Todo motivo dado à pessoa vem de uma linha da base, e toda linha precisa de fonte. Agentes de código escrevem a base; se escreverem título, página ou URL de memória, a fonte fica inventada e ninguém percebe.

## Decisão

1. As fontes são consultadas pela internet uma única vez, na construção da base, só nas páginas do Ayurvedic Institute (`ayurveda.com`) e da Banyan Botanicals (`banyanbotanicals.com`).
2. Cada página aberta entra em `data/fontes.yaml` com a URL e a data de acesso. Uma linha cita a `ref` só nos campos cujo valor estava na página.
3. Sem página aberta que traga o valor, o campo entra como `ref: a_confirmar` e a linha fica com `confianca: baixa`. Nada é escrito de memória.
4. Linhas `a_confirmar` valem em desenvolvimento, nos testes e nos evals; `npm run base:check -- --producao` falha enquanto houver alguma ou houver fonte não aprovada, e é rodado antes de publicar.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Citar os livros (Lad) de memória | Fonte inventada, sem como conferir |
| Só livros conferidos à mão pela dona antes da construção | Atrasa a base inteira; a conferência fica para o portão 1, com as linhas marcadas |
| Qualquer site de Ayurveda | Qualidade desigual; muita página com promessa de saúde |

## Consequências

- A maior parte das linhas sai `a_confirmar` nos campos que as páginas não dão por alimento (virya, vipaka, gunas); o portão 1 revisa.
- As páginas foram lidas pelo resumo automático da ferramenta de busca, que pode distorcer tabelas; a conferência da dona é obrigatória antes da produção.
- A trava fica no caminho de produção, não no carregamento.
