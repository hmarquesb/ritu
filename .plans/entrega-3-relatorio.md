# Entrega 3 · Relatório do portão 3

Entrega 3: as telas do site (design system, entrada e contas, Conversa, Minha casa e Como ficou?, Você e Como pensei). Construída em trilha adiantada (`entrega-3`) e juntada na `main` em 2026-11-22 (`e1891a9`).

## O que foi construído

| Spec | O quê | Fechada em | ADR |
|---|---|---|---|
| 016 · Design system | Tokens, fontes locais, tema claro e escuro por cookie, componentes base sobre React Aria, `/marca` com todos os estados, gate do axe no E2E | `f4ad97d` | 0040 |
| 017 · Entrada e contas | Auth.js com Google e demonstração por clique, perfil semeado, limitador de demonstrações, CSP com nonce e headers, checagem de `Origin`, limpeza diária, Aviso, Evitar sempre, dosha com quiz, cidade | `70cdd07` | 0043 |
| 018 · Tela Conversa | Barra de navegação, mensagens, etapas ao vivo (NDJSON), pergunta do agente, fala com sugestões de apoio, "Vale ter em casa", menu do ingrediente, bloco de aprovação, 👍/👎, indicador de retornos | `9b018b4` | 0044 |
| 019 · Minha casa e Como ficou? | `/casa` (grupos, estados, "Ainda tem?", sempre tenho, gosto, "Para ter em casa") e `/como-ficou`, com as rotas de toque | `8ffd611` | 0050 |
| 020 · Você, memória e Como pensei | `/voce` (todos os níveis da memória, corrigir e apagar; perfil, evitar sempre, restrições, apagar dados; painel do dosha; refazer o quiz) e `/como-pensei/<run>` | `ced91d7` | 0051 |

Junção na `main`: `28770c2` (main → entrega-3, conflitos), `03d0431` (J1, E2E de Você), `e1891a9` (entrega-3 → main), `ca7ce1b` (teste da migração 0005 no `test:db`).

## Números

- `npm test`: 3596 testes (244 arquivos). `eval:det`: 1579 casos (125 arquivos). `npm run dup`: 0 clones.
- E2E (`CI=1`): 291 passaram, 69 pulados (screenshots e testes de um projeto só), 0 falhas. Com `SCREENSHOTS=1`: 354 passaram, 1 falha intermitente conhecida (`marca.spec.ts` › abas trocam com as setas, desktop, sob carga).
- ⚠️ `test:db` contra o Postgres local: 152/152, incluindo os contratos que ficaram pendentes desde a 017 (`limites`, `semear`, `RunRepository.doDia`, `votos`).
- Produção: migração `0005_padroes_de_cha.sql` aplicada pelo job `deploy` em 2026-11-22; smoke todo `ok`. A `0006_runs_fora_da_conversa.sql` (020) foi aplicada no deploy da junção (`1841d7b`), com o smoke `ok`: a entrega 3 está em produção.

### ⚠️ Rodada `c3-confiavel` de 2026-11-22 (86/86 casos)

A rodada parou três vezes: uma com o Postgres local desligado e duas com 429 do Gemini. Ela foi retomada com `--retomar` até o fim. Os modelos são `gemini-3.5-flash-lite` e `gemini-3.1-flash-lite`.

Metas abaixo, com a variação contra 2026-11-16:

| Família | Métrica | Hoje | Meta | Antes |
|---|---|---|---|---|
| Segurança | Bloqueio | 50% (3/6) | 100% | — |
| Segurança | Injection bloqueada | 75% (3/4) | 100% | — |
| Linguagem e sofrimento | Alertas perdidos | 1 | 0 | — |
| Autocorreção | Corrigiu após violação | 32% (11/34) | ≥ 95% | 57% |
| Autocorreção | Válida na 1ª tentativa | 15% (6/40) | ≥ 60% | 14% |
| Trajetória | Trajetória correta | 33% (2/6) | ≥ 80% | 50% |
| Explicação | Explicação completa | 17% (2/12) | ≥ 75% | — |
| Fidelidade | Texto bate com as sugestões | 58% (7/12) | ≥ 90% | 75% |
| Para ter em casa | Acerto | 0% (0/3) | ≥ 85% | — |
| Aprendizado | Acerto | 40% (2/5) | ≥ 85% | — |
| Memória | Acerto | 50% (5/10) | ≥ 85% | — |
| Incômodos | Acerto | 25% (1/4) | ≥ 85% | — |
| Juiz | Acerto por caso | 69% (9/13) | ≥ 80% | — |
| Conversa | Acerto · passos na pergunta simples | 67% · 3 | ≥ 80% · ≤ 2 | — |
| Conteúdo | Deve incluir | 83% (10/12) | ≥ 85% | 75% |
| Propostas | Recusadas por run | 0,33 | ≤ 0,3 | — |
| Custo | Latência p95 | 47 s | ≤ 20 s | — |

Subiram: Intenção (100%), Casa (100%), Perguntas necessárias (100%) e Propostas corretas (83%).

**c3-s23 (padrão genérico do chá) e c3-s24 (chá com a erva da casa): falharam os dois.** A lógica dos chás não é a causa. Nos dois casos o validador recusou as primeiras saídas do modelo, e o run fechou sem sugestão nenhuma.

**Causa principal:** 30 dos 48 runs do agente fecharam com a resposta `segura`. Nesses runs o validador recusou as tentativas seguidas, e as violações mais comuns na 1ª entrega foram `qualidades` (30 runs), `novidade` (24) e `estrutura` (21). Daí a queda em Autocorreção, Trajetória, Explicação e nas famílias que dependem de uma resposta com sugestões. Desde a última rodada, o prompt do acompanhante passou de `v6` para `v7`, e o do Intérprete de `v1` para `v2`. O detalhe de cada falha está em `evals/local/c3-confiavel-falhas.md`, fora do git.

O `c4-site` não foi rodado porque não existe (J-A5, abaixo). A tabela de evolução entre checkpoints está em `evals/COMPARACAO.md`.

## Decisões autônomas e bloqueios

Da junção (registradas em `.plans/DECISOES-AUTONOMAS.md`):

- **J-A1:** ADRs da 019 e da 020 renumeradas para 0050 e 0051 (colidiam com as 0045 e 0046 da `main`).
- **J-A2:** migração da 020 renumerada para `0006` (a `0005` da `main` já está em produção).
- **J-A3:** limite de toques no quiz, no Evitar e em Você (fecha a 021 A1). O `gravar` do `EscolherEvitar` passa a devolver `boolean`. As rotas de Você entram no `limites.eval.ts`.
- **J-A4:** o "não como" livre segue a regra da `main` (não é guardado), em BUSINESS §8.
- **J-A5:** o `c4-site` não existe em `evals/llm/checkpoints.ts`. O portão vai com o `c3-confiavel` de hoje. O `c4-site` e o `c5-publico` ficam para decidir no portão.

Das specs, já relatadas nos fechamentos: 016 a 020 em `.plans/DECISOES-AUTONOMAS.md` (A1 a A11 da 019 e da 020, entre outras). Bloqueios novos: nenhum.

## Bibliotecas instaladas

`react-aria-components` 1.22.1, `@phosphor-icons/react`, `tailwindcss` e `@tailwindcss/postcss` 4.3, `next-auth` 5.0.0-beta.32, `@axe-core/playwright`.

## Roteiro de conferência do portão 3

Os screenshots ficam em `docs/screenshots/entrega-3/` (76 imagens: claro e escuro, celular e desktop). O onboarding da 017 só tem a versão de celular.

1. **Design system:** `016-marca-*`, ou `/marca` no navegador. Confira cores, tipografia, papel e os dois temas.
2. **Entrada:** `017-entrada-*`. Abra `/` e entre pela demonstração a um clique.
3. **Onboarding** (só celular): `017-aviso`, `017-evitar`, `017-dosha`, `017-quiz-resultado`. Numa conta nova, passe pelo Aviso, por Evitar sempre, pelo dosha (ou o quiz) e pela cidade.
4. **Conversa:** `018-vazia`, `018-respondendo`, `018-pergunta`, `018-resposta-bloco`. Mande a mensagem sugerida, veja as etapas ao vivo, a fala com as sugestões de apoio, a pergunta do agente e o bloco "Posso anotar isto?". A pergunta é se a conversa soa como gente.
5. **Minha casa:** `019-casa-vazia`, `019-casa-cheia`, `019-casa-folha`. Marque "acabou" e "sempre tenho", dê um gosto e tire um item da lista "Para ter em casa".
6. **Como ficou?:** `019-como-ficou-vazia`, `019-como-ficou-cheia`. Responda ao retorno de ontem.
7. **Você:** `020-voce-vazia`, `020-voce-cheia`, `020-voce-sem-dosha`, `020-voce-evitar`, `020-quiz-resultado`. Corrija e apague uma nota, confirme ou recuse um padrão, tire um item de Evitar sempre (com a confirmação), refaça o quiz e apague um dia da conversa.
8. **Como pensei:** `020-como-pensei-fechado`, `020-como-pensei-aberto`. Na resposta, abra "Como pensei" e leia a linha do tempo.
9. **Teclado e tema:** percorra uma tela só com Tab, Enter e Esc e troque o tema no menu.
10. **Eval:** leia a seção da rodada `c3-confiavel` acima e decida o que fazer com a queda da autocorreção e com o `c4-site` (J-A5).
