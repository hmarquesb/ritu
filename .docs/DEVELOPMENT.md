# Desenvolvimento

Padrões para qualquer código deste repositório.

## Princípios

- **Clean code e SOLID com bom senso:** abstração só com um segundo uso real. Uma porta por necessidade, não uma interface genérica.
- **Um domínio por pasta** (`src/core/<domínio>/`, vertical slice). Domínios não formam ciclo de importação (R9). Coisas de todos os domínios ficam soltas em `src/core/`. O adaptador de uma porta fica na pasta da tecnologia (R5), com o nome do domínio.
- **DRY:** antes de escrever uma função de apoio, procure no domínio uma que já exista. Duplicação é conferida pelo `npm run dup` no fechamento da spec; complexidade, pelo lint.
- **Lógica em `src/core/`, sem framework.** Next, Auth.js, banco, Mastra, OTel e SDK de LLM ficam em `src/infra/` e `src/app/`.
- **Portas e adaptadores** (`ARCHITECTURE.md` §5), com um único composition root.
- **Funções puras onde der:** momento → qualidades, clima → faixa, filtros, ordenação dos candidatos, substitutos, validador, estado dos itens da casa, detecção de padrões, executor de propostas. São as partes mais testadas.
- **Antes de escrever fundação, olhe as referências locais** (`.local/REFERENCIAS.md`), quando existirem.

## Camadas e importações

| Pasta | Pode importar | Não pode importar |
|---|---|---|
| `src/core/` | `src/core/`, `config/`, zod | `next`, `next-auth`, `postgres`, `@mastra/*`, `@opentelemetry/*`, SDK de LLM |
| `src/infra/` | `src/core/`, bibliotecas externas | `src/app/` |
| `src/app/` | `src/core/`, composition root | Adaptadores diretamente |
| `scripts/` | composition root | — |

O teste de arquitetura garante a tabela.

## Regras

- **zod em toda borda:** rotas, formulários, Open-Meteo, YAML da base, entrada e saída de tool, saída de agente, checkpoint do run.
- **Tools são funções puras com schema** no core. O adaptador da Mastra só as registra.
- **Escrita do agente só pelo executor de propostas** (`AI.md` §5). Nenhuma tool de escrita toca o banco. Toques da pessoa na tela gravam por rotas próprias, sem agente (`ARCHITECTURE.md` §3).
- **Toda chamada de modelo passa pelo `ModelRouter`** (`AI.md` §10). Nenhum código escolhe modelo por conta própria nem chama o SDK direto.
- **Números ajustáveis ficam em `config/`** (cotas, faixas de clima, pesos da ordenação, limites, durabilidade), nunca espalhados no código.
- **Prompts em arquivo** (`src/core/agents/prompts/`), com versão.
- **Telemetria pela porta `Telemetry`**, com os nomes da lista fechada de `src/core/telemetry/nomes.ts` (`OBSERVABILITY.md` §3): contador, histograma e medidor tipados pelo registro, rótulos só os declarados (o fake recusa os outros), e `log(codigo, campos)` com o nível vindo da lista. Nome novo entra em `nomes.ts` antes de ser emitido. Nunca texto da pessoa, prompt, saída do agente ou segredo em span, métrica ou log.
- **Tempo pela porta `Clock`**, nunca `new Date()` no core.
- **Segredos** só por variável de ambiente, lidos em `src/infra/env.ts`. O `.env.example` lista todas: `DATABASE_URL`, `GEMINI_API_KEY`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `IP_HMAC_SECRET`, `RITU_MODO`, `CRON_SECRET`, `TESTER_IDS`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME`.
- **Identificador de modelo não é segredo:** fica em `config/llm-cotas.ts`, versionado (`AI.md` §10), nunca em variável de ambiente.
- **Agentes de código não leem `.env.local`.** Para saber se uma variável existe, usam `npm run env:check`, que só diz presente ou ausente.
- **Idioma:** código e identificadores em inglês; mensagens à pessoa, docs, specs e ADRs em português. Nomes de tools, spans e métricas ficam em português, como em `AI.md` e `OBSERVABILITY.md`.
- **Erros:** tipados no core; a borda converte em mensagem amigável. A borda reconhece os erros do Ritu pela marca `Symbol.for("ritu.error")` (`ehRituError` em `src/app/_lib/rota.ts`), porque o Next carrega cópias separadas dos módulos; erro sem a marca vira `500` `erro_inesperado`.

## UI

- Toda mudança de tela carrega as skills `frontend-design` e `web-design-guidelines`, e segue `DESIGN.md`.
- Celular primeiro, responsivo, acessível: WCAG 2.2 AA, com as regras de `DESIGN.md` §3 "Acessibilidade", conferidas pelo axe no E2E.
- A resposta do agente e o texto da pessoa são sempre renderizados como texto puro (`ARCHITECTURE.md` §4, "Proteção do site").
- Componentes base escritos no Ritu sobre **React Aria Components** (`react-aria-components`), estilizados com Tailwind e os tokens de `DESIGN.md`. Sem shadcn/ui, sem Radix, sem biblioteca com visual pronto. Ícones: **Phosphor** (`@phosphor-icons/react`), peso `light`. Confira a API na versão instalada antes de usar.
- **Só classes de token.** Cor, raio, sombra, tamanho de texto, curva e animação saem de `src/components/tokens/tokens.css`; o Tailwind não gera as classes padrão (`bg-red-500`, `rounded-xl`, `text-lg`). Nada de variante `dark:`: o tema troca pelos tokens. `design-guard.test.ts` acusa cor literal, `dark:`, `dangerouslySetInnerHTML`, biblioteca de UI com visual pronto e texto em `px`.
- **React Aria só em `src/components/`** (regra R5 do teste de arquitetura). Páginas usam os componentes do Ritu.
- **Variantes em mapa de objeto, com `cx`.** Duas classes da mesma propriedade no mesmo elemento valem pela ordem da folha do Tailwind, não pela do `className`: tamanho, padding e texto ficam só no mapa de variante, nunca na base e na variante ao mesmo tempo.
- **Ícone em componente de servidor** vem da entrada SSR do Phosphor (`@phosphor-icons/react/ssr`).
- **`/marca` é a vitrine:** todo componente base aparece lá com todos os estados, e o E2E dela é o gate de acessibilidade do design system.
- A tela só chama rotas do servidor.
- Estados de carregamento, erro, vazio, "esperando você" e "cota esgotada" em toda tela.
- A resposta do agente é texto corrido, com as sugestões como apoio logo abaixo. Nenhuma tela mostra a resposta só como lista de cartões.

## Testes

- **Padrão sem rede, sem banco e sem chave:** fakes das portas, fixtures, `Clock` fixo.
- **TDD** nas funções puras, nas tools e no loop (com o `AgentRuntime` roteirizado).
- Telas com interação: **E2E (Playwright)** com rotas simuladas.
- **E2E com o servidor no modo e2e:** o Playwright sobe `npm run start` com `RITU_MODO=e2e` (stores, limitador e cidades em memória, sem banco nem rede; `x-ritu-e2e` separa os cenários). Com `CI=1` ele não reaproveita um servidor já no ar, que poderia ser de outra pasta.
- **Roteiros do modo e2e** (`e2e/roteiros/`): o Intérprete roteirizado escolhe o roteiro pelo texto exato da mensagem. Mensagem sem roteiro cai no caminho `sem_modelo`. Os roteiros são escritos contra o seed, e `src/infra/e2e/roteiros.test.ts` roda cada um pela conversa inteira. A cota de modelo é separada por `x-ritu-e2e`.
- O que toca serviço real (LLM, banco na nuvem, Open-Meteo) é script opt-in, marcado com ⚠️.
- Cada bug corrigido ganha um teste; cada 👎 relevante pode virar caso de eval.
- Evals com LLM não fazem parte do ciclo de uma tarefa: só rodam nos checkpoints (`QA.md`).

## Commits

Conventional Commits, direto na `main`, um por tarefa aprovada pelo verificador. Mensagem em inglês. Regras completas em `RULES.md`.
