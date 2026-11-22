# ADR 0052: Finalizar enxuto, montagem por código e rodada de eval sem ruído de infraestrutura

## Status

Aceito · 2026-11-22

## Contexto

A "Válida na 1ª tentativa" ficou em 15% nos três checkpoints. O modelo de `decisao` tinha de copiar de volta, em `finalizar`, dados que o preparo já calculou (`qualidades_do_momento`, `qualidades_buscadas`, `contribui` e `linha_base` de cada item, `linhas_base`, `novidade`, `evitar`, `citados`, os campos do `para_ter`). As violações mais comuns da 1ª entrega eram justamente dessas cópias. O prompt também citava `qualidades.*`, mas o contexto entrega o bloco como `momento`.

Na rodada do `c3-confiavel` de 2026-11-22, cerca de 16 das 29 falhas não testaram o agente: Postgres desligado, cota, Juiz sem cota, timeout antes de qualquer decisão. O número do portão misturava agente e infraestrutura.

## Decisão

1. `finalizar` recebe só a escolha do agente (`EscolhaDoModelo`): `resposta`, sugestões com `tipo`, `id` de um candidato, `escolhas` (só refeição, trocando o item padrão de uma vaga por uma das `opcoes`), `trocas` (`se_faltar`) e `motivo`, `incertos` e `para_ter: true`. `EntregaDoModelo` continua como tipo interno.
2. `completarEntrega` monta a `EntregaDoModelo` a partir de `dados.candidatos`, da base e do clima do run, sem chamar modelo. Sugestão fora dos candidatos é recusada (`fora_dos_candidatos`).
3. Cada violação do validador tem `origem`: `modelo` ou `montagem`. As de montagem (`qualidades`, `novidade`, `linha_base`, `para_ter`, `texto_sem_estrutura`, estrutura de prática) são invariantes: se aparecerem, o run fecha com a resposta `segura`, a etapa `validacao` registra `erro_de_montagem` e a telemetria loga `resposta_segura` com `motivo: "montagem"`. O loop ganha a forma de controle `encerrar` para isso. As do modelo voltam a ele, escritas em termos da escolha.
4. Prompt `acompanhante.v8`: sem instruções de cópia e com os nomes reais `momento.*`.
5. Só em desenvolvimento, `GEMINI_API_KEY_2` e `_3` acrescentam rotas ao `ModelRouter`: a fila do papel é modelo × chave, com o mesmo modelo nas chaves seguintes antes de trocar de modelo. O id da rota é `<modelo>@<n>` (com uma chave só, `<modelo>`, e o banco de produção não muda); o registro de uso conta cada rota; a telemetria usa o modelo sem sufixo.
6. O runner dos evals faz uma checagem prévia (Postgres e cada chave) antes do 1º caso, e cada caso termina `acertou`, `falhou` ou `inconclusivo` (`banco`, `sem_etapas`, `cota`, `juiz_indisponivel`, `timeout_sem_decisao`). Inconclusivo não entra nas métricas; `--retomar` o refaz. O relatório só diz "rodada completa" com zero inconclusivos.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter a entrega inteira e só melhorar o prompt | O modelo `flash-lite` segue copiando errado; o validador gasta chamadas sem chance de acerto |
| Devolver violação de montagem ao modelo | É bug de código; a nova tentativa não pode corrigir |
| Montar também a fala e a ordem das sugestões | Tiraria do agente o julgamento que o produto quer dele |
| Rodar os evals com uma chave só e esperar a cota | A rodada fica lenta e o número mede a cota, não o agente |
| Juiz tolerante a indisponibilidade | Em produção ele continua fail-closed; só o eval classifica isso como inconclusivo |

## Consequências

- Os campos copiados passam a ser corretos por construção; a medida da 1ª tentativa passa a refletir julgamento.
- Sugestão só sai de `dados.candidatos`: o agente não pode mais propor algo que o preparo não calculou.
- `citados` derivados da fala pegam também citações negativas ("evite café"), como a checagem de texto já fazia.
- As chaves extras deixam a rodada mais rápida, mas não mudam a cota de produção.
- Testes, evals e roteiros do e2e mandam a escolha, e os ids saem dos candidatos reais das fixtures e do seed.
