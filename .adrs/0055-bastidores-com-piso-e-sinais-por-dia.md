# ADR 0055: Bastidores com piso de conversas e sinais agregados por dia

## Status

Aceito · 2026-11-22

## Contexto

`/bastidores` é pública e sem login, e mostra o agente medido. Dois problemas pedem desenho: números pequenos podem descrever uma pessoa só, e `feedback` e `retornos` caem em cascata quando a conta é apagada (a demonstração vence em 24 h), então votos e retornos contados ao vivo sumiriam da janela de 7 dias no dia seguinte.

## Decisão

1. **Janela e piso:** os números são dos 7 dias completos até ontem, no fuso padrão. Com menos de 20 runs `done` na janela, a seção mostra só o total atual e nenhum outro número, nem escondido no HTML. Os evals e o MCP aparecem sempre.
2. **Sinais por dia:** a tabela `sinais_dia` (`dia`, `sinal`, `total`) guarda cinco sinais (`feedback_up`, `feedback_down`, `retorno_ajudou`, `retorno_nao_ajudou`, `retorno_nao_fez`). A limpeza diária grava os de ontem **antes** de apagar as contas vencidas, com upsert (idempotente, zeros incluídos), e apaga o que tem mais de 30 dias (`retencaoSinaisDias`). Falha do registro vira o log `sinais_dia_falhou` e a limpeza segue. A semana soma `sinais_dia`; nunca lê `feedback` nem `retornos` ao vivo.
3. **Runs ao vivo:** o resto vem de `runs` e `run_etapas`, que sobrevivem à conta (`conta_id` vira nulo). Todos entram igual (Google, demonstração, testers, conta apagada); só `done` conta.
4. **Porta:** `BastidoresStore` (`agregadosDosRuns`, `sinais`, `registrarSinaisDoDia`, `apagarSinaisAntesDe`), com adaptador Postgres, fake em memória e suíte de contrato.
5. **Cache:** em memória por instância, 1 h, com chave `janela.ate`. Sem ISR nem `revalidate`: a CSP com nonce exige render dinâmico. Erro do store sobe e não é guardado; a seção mostra o estado de erro e o resto da página responde `200`.
6. **Evolução dos evals:** lida de `evals/resultados/historico.json` em tempo de execução, validada com o schema em `src/core/evals/historico.ts`. Cinco gráficos (`bastidores.destaques`), um ponto por checkpoint, com meta tracejada e "⚠" nos pontos abaixo dela; abaixo, a tabela de todas as métricas, recolhida. Histórico ausente ou inválido vira erro só nessa seção.
7. **Gráfico:** SVG renderizado no servidor, sem biblioteca, com os tokens e o tema; cada gráfico é `role="img"` com `aria-label`.
8. **Componentes de cliente:** dois. `use-o-mcp.tsx` (copiar o endereço) e `tabela-metricas.tsx`, porque o `Disclosure` do React Aria exige cliente e não há base `Disclosure` no design system. A tabela recebe o texto já formatado, e `UseOMcp` recebe as descrições das tools por prop, para o `core/mcp` não ir para o bundle.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Contar votos e retornos ao vivo | Somem em 24 h com a demonstração |
| Mostrar números abaixo do piso | Intenção e voto podem descrever uma pessoa só |
| ISR com `revalidate` | Incompatível com a CSP com nonce |
| Biblioteca de gráfico | JavaScript no cliente e dependência sem ganho |
| Tabela no servidor com ilha só no botão | Exigiria um `Disclosure` base novo; fica como evolução possível |

## Consequências

- Os números da semana são iguais para todo mundo e estáveis durante o dia.
- O uso do MCP não aparece em Bastidores (o limitador só guarda o dia corrente); fica no Grafana.
- O valor de cada ponto dos gráficos bate com `evals/COMPARACAO.md`, gerado do mesmo `historico.json`.
