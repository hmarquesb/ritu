---
title: Bastidores e MCP
status: approved
entrega: 4
created: 2026-11-15
---

# Bastidores e MCP

> Abre o Ritu para fora em duas portas, as duas sem login e sem nenhum dado de pessoa. **Bastidores** (`/bastidores`) mostra os números agregados dos últimos 7 dias completos (só a partir de 20 conversas), a evolução dos evals em cinco gráficos com a tabela completa recolhida, e como ligar o servidor MCP. O **servidor MCP** (`/api/mcp`) expõe seis tools de leitura da base ayurvédica e do clima, sobre as mesmas tools que o agente usa, com contexto neutro e limite por IP e global.

## Contexto

O Grafana é fechado; o portão 4 pede uma página pública com a evolução dos checkpoints (`OBSERVABILITY.md` §4, `RULES.md` portão 4). O `historico.json` existe desde a 014, e os runs guardam no Postgres tudo o que os agregados precisam (`passos`, `latencia_ms`, `intencoes`, `juiz_tentativas`, `trocas_de_modelo`, etapas por tool).

Um detalhe do banco muda o desenho: `feedback` e `retornos` caem em cascata quando a conta é apagada, e a demonstração vence em 24 h. Contados ao vivo, os votos e os retornos de quem usou a demonstração sumiriam da janela de 7 dias no dia seguinte. Por isso os sinais são contados por dia, pela limpeza diária, **antes** de ela apagar as contas vencidas.

O MCP é a outra metade: a base ayurvédica e o clima em qualidades são o que o Ritu tem de reaproveitável por outros agentes. As tools internas recebem um `ToolContext` com a pessoa (filtro, casa, prakriti, cidade do perfil); a versão pública usa as mesmas tools com contexto neutro (`filtroVazio`, `sinaisVazios`), dosha opcional na entrada e a cidade pelo nome.

A dona fechou em 2026-11-15, ao escrever esta spec:

- **Gráficos:** cinco gráficos, um por métrica da linha de resumo dos evals; abaixo, a tabela de todas as métricas, recolhida.
- **MCP na página:** seção "Use a base no seu agente" no fim de Bastidores, com o endereço, as seis tools e um exemplo de configuração. O README (024) aponta para lá.
- **Quem conta:** todos os runs (Google, demonstração e testers).
- **Piso:** com menos de 20 conversas nos 7 dias, os números não aparecem; os evals e o MCP aparecem sempre.

## Objetivo

- Quem visita `/bastidores`, logado ou não, vê em uma página os números da semana, a evolução dos cinco indicadores principais em todos os checkpoints rodados e como usar o MCP.
- Nenhum número da página permite saber o que uma pessoa fez: nada abaixo de 20 conversas, nenhum id, nenhum texto.
- Um agente compatível com MCP (Streamable HTTP) lista as seis tools e as chama sem conta, com resposta validada em zod e o aviso "Não é orientação médica." em toda saída.
- O MCP nunca alcança dado de conta: as tools públicas não recebem stores, e o teste prova isso.
- Uso abusivo do MCP para em limites conhecidos (por IP por minuto, por IP por dia e global por dia), sem derrubar o site.

## Escopo

- **Dentro:**
  - Página `/bastidores` com três seções: Últimos 7 dias, Evolução dos evals, Use a base no seu agente.
  - Porta `BastidoresStore`, adaptador Postgres, fake e suíte de contrato; tabela `sinais_dia`; passo novo na limpeza diária.
  - `numerosDaSemana` com janela, piso e cache em memória; `montarEvolucao` a partir de `historico.json`.
  - Schema do histórico movido para `src/core/evals/historico.ts`.
  - Gráfico de evolução (SVG próprio, sem biblioteca) e tabela de todas as métricas.
  - Seis tools públicas em `src/core/mcp/`, servidor em `src/infra/mcp/`, rota `src/app/api/mcp/route.ts` com `mcp-handler`.
  - Limites do MCP; exceção do `Origin` ausente para `/api/mcp` no `proxy.ts`.
  - Métrica e span do MCP; stat no painel; checagens novas no smoke da 022.
  - `config/bastidores.ts`, `config/textos-bastidores.ts`, `limites.mcp`.
  - ADRs; docs vivos; evals determinísticos e E2E.
- **Fora:**
  - Link para Bastidores na Entrada, na tela Sobre e no README: 024.
  - Qualquer tool de escrita, de conta, de casa, de memória ou de controle (`ask_user`, `finalizar`) no MCP: o produto não faz.
  - Autenticação no MCP (OAuth): o servidor é público por decisão (`ARCHITECTURE.md` §4).
  - Prompts e resources MCP: só tools.
  - Uso do MCP em Bastidores (contagem por dia): o limitador só guarda o dia corrente; o uso fica no Grafana.
  - Gráfico dos números da semana ao longo do tempo: a seção mostra só a semana.

## Necessidade de negócio

Bastidores é a prova pública de que o agente é medido e melhora: é o que o portão 4 e o portfólio mostram. O MCP mostra a base como um ativo reaproveitável, com a mesma disciplina do produto (zod nas bordas, sem dado de pessoa, limite de uso), e dá a quem avalia o projeto um jeito de testar a base sem entrar no site.

## Critérios de aceite

### Últimos 7 dias

- [ ] **Janela:** `janelaDaSemana(agora, "America/Sao_Paulo")` às 00:30 de 2026-12-10 devolve `{ de: "2026-12-03", ate: "2026-12-09" }`; o dia de hoje nunca entra.
- [ ] **Piso:** com 19 runs `done` na janela, a seção mostra o `StateBlock` "Ainda pouco uso para mostrar números" com o número atual e nenhum outro número; com 20, mostra os sete indicadores, as intenções e as tools.
- [ ] **Quem conta:** runs de conta Google, de demonstração, de tester e com `conta_id` nulo (conta apagada) entram igual; runs em `running`, `waiting_for_*`, `failed`, `expired` e `cancelled` não entram.
- [ ] **Indicadores:** conversas = runs `done`; tempo típico = p50 de `latencia_ms`, em segundos com uma casa; passos = média de `passos` nos runs de caminho `acompanhante`; refeitas pelo juiz = runs com `juiz_tentativas = 2` sobre runs com `juiz_aprovado` não nulo; trocas = soma de `trocas_de_modelo`; votos e retornos = soma de `sinais_dia` na janela. Denominador zero mostra "—".
- [ ] **Intenções:** barras com o rótulo de `textosBastidores.intencoes`, o total e a porcentagem sobre a soma das intenções, da maior para a menor; intenção sem rótulo aparece com o id.
- [ ] **Tools:** as 5 tools de leitura mais chamadas (etapas `tool`, todas as tentativas), com o nome da tool e o total; `ask_user`, `finalizar`, `memoria.propor` e `lista.propor` ficam fora.
- [ ] **Sinais por dia:** `executarLimpeza` grava os cinco sinais de ontem em `sinais_dia` **antes** de apagar as contas vencidas; um voto 👍 de uma demonstração que vence na mesma limpeza continua contado na semana seguinte.
- [ ] **Registro idempotente:** rodar a limpeza duas vezes no mesmo dia deixa os mesmos cinco valores de ontem; `sinais_dia` com mais de 30 dias é apagado.
- [ ] **Cache:** duas aberturas da página na mesma hora fazem uma leitura só do banco por instância; virada do dia invalida.
- [ ] **Banco fora:** a seção mostra o `StateBlock` de erro; as outras duas seções aparecem normalmente e a página responde `200`.

### Evolução dos evals

- [ ] **Cinco gráficos,** na ordem de `bastidores.destaques`, um ponto por checkpoint de `historico.json` na ordem do arquivo, com o rótulo curto do checkpoint no eixo.
- [ ] **Cada gráfico** mostra o nome da métrica, o valor do último checkpoint com valor, a meta em texto ("Meta: pelo menos 80%" / "Meta: no máximo 3") e a linha da meta tracejada; ponto `null` não é desenhado e a linha passa por cima dele, com "—" no rótulo.
- [ ] **Abaixo da meta:** o ponto de um checkpoint com a métrica em `abaixo_da_meta` é vazado e leva "⚠" junto do valor; a cor nunca é o único sinal.
- [ ] **Nome acessível:** cada gráfico é `role="img"` com `aria-label` no formato "Escolheu as consultas certas: Base 67%, Conversa 75%. Meta: pelo menos 80%.", com "sem valor" para `null` e "abaixo da meta" quando for o caso.
- [ ] **Tabela recolhida:** "Todas as métricas" abre com um toque (`Disclosure`) e mostra uma coluna por checkpoint (nome curto e data) e uma linha por métrica de `textosBastidores.metricas`, agrupadas por família na ordem de `FAMILIAS`; "—" para `null`; "⚠" com o texto oculto "abaixo da meta".
- [ ] **Sem histórico:** arquivo ausente ou inválido → `StateBlock` de erro só nesta seção; histórico com zero checkpoints → `StateBlock` vazio "Nenhum checkpoint rodado ainda."
- [ ] **Uma fonte só:** os valores da página batem com os de `evals/COMPARACAO.md` gerado do mesmo `historico.json` (teste com o arquivo real).

### Use a base no seu agente

- [ ] A seção mostra o endereço `<origem do pedido>/api/mcp`, o botão "Copiar endereço" (toast "Endereço copiado"), as seis tools com uma linha cada, o exemplo de configuração em JSON e a linha dos limites com os números de `limites.mcp`.

### Servidor MCP

- [ ] **Lista:** `tools/list` devolve exatamente `ayurveda_alimento`, `ayurveda_candidatos`, `ayurveda_substitutos`, `ayurveda_checar_combinacao`, `clima_agora` e `clima_proximas_horas`, cada uma com `inputSchema` e `outputSchema`.
- [ ] **Mesmo resultado:** para a mesma entrada, `ayurveda_alimento`, `ayurveda_candidatos` (sem `dosha`), `ayurveda_substitutos` e `ayurveda_checar_combinacao` devolvem o mesmo que as tools internas com `filtroVazio`, `sinaisVazios` e sem prakriti, mais `aviso`; `ayurveda_substitutos` sem o campo `em_casa`.
- [ ] **Dosha:** `ayurveda_candidatos` com `dosha: "vata"` usa prakriti `{ vata: 1 }` e a ordem muda como na tool interna com essa prakriti.
- [ ] **Clima:** `clima_agora({ cidade: "Curitiba" })` busca a cidade pelo `CityLookup`, usa a primeira, e devolve a saída da tool interna com `regiao`, `pais`, `fonte: "Open-Meteo (CC BY 4.0)"` e `aviso`; cidade sem resultado → `{ status: "cidade_nao_encontrada", aviso }`; busca ou clima fora do ar → `{ status: "indisponivel", aviso }`.
- [ ] **Sem conta:** as tools públicas recebem `storesProibidos`, que lança `RituError("mcp_sem_conta")` em qualquer acesso; nenhum caso de teste lança.
- [ ] **Entrada inválida:** argumento fora do schema devolve erro de tool (`isError: true`) com "Entrada inválida." e a lista dos campos, sem stack.
- [ ] **Limites:** a 31ª chamada do mesmo IP no mesmo minuto → `429` com `Retry-After` até o próximo minuto; a 301ª do dia → `429` até a meia-noite (fuso padrão); a 3001ª do dia no total → `429` para todos. O corpo do `429` é um erro JSON-RPC com "Limite de uso atingido. Tente de novo mais tarde.".
- [ ] **Origem:** `POST /api/mcp` sem `Origin` passa; com `Origin` do próprio site passa; com outro `Origin` → `403`. As demais rotas continuam exigindo `Origin` como na 017.
- [ ] **Corpo:** mais de 16 KB → `413`, sem consumir limite.
- [ ] **Telemetria:** cada chamada de tool soma `ritu_mcp_chamadas_total{tool, resultado}` e abre o span `mcp.tool` com `tool.nome` e `tool.status`; o nome da cidade e os nomes de alimento pedidos nunca aparecem em span, métrica ou log.
- [ ] **Smoke:** o smoke da 022 confere `GET /bastidores` → `200` e `tools/list` com as seis tools.

### Geral

- [ ] `/bastidores` abre sem sessão, com sessão e na demonstração, sem redirecionar.
- [ ] axe sem violação em `/bastidores` nos dois temas, no celular e no desktop, com a tabela aberta.
- [ ] Nenhuma resposta de `/bastidores` nem do MCP contém `conta_id`, e-mail, texto de mensagem ou nome de cidade de perfil (eval com canários).
- [ ] Gates verdes: lint, typecheck, `npm test`, `eval:det`, `dup`, build, E2E e o teste de arquitetura.

## O que fazer

- Ler a documentação **atual** de `mcp-handler` (2.x) e de `@modelcontextprotocol/server` (2.x) na versão instalada antes de escrever o servidor: `registerTool`, `outputSchema`, `structuredContent`, erro de tool e o modo sem estado. Anotar diferenças em `.plans/DECISOES-AUTONOMAS.md`.
- Escrever primeiro as funções puras com teste: `janelaDaSemana`, `montarEvolucao`, `formatarMetrica`, `rotuloDoGrafico`, `contextoPublico`, `storesProibidos`, `consumirMcp` e `origemValida` com o caminho; depois o store, a página, as tools públicas, o servidor e a rota.
- Reaproveitar as tools internas (`alimentoTool`, `candidatosTool`, `substitutosTool`, `checarCombinacaoTool`, `climaAgoraTool`, `climaProximasHorasTool`) chamando `execute` com o contexto público. Não reescrever a lógica.
- Mover `historicoSchema` e `Historico` de `scripts/lib/evals/historico.ts` para `src/core/evals/historico.ts`; os scripts passam a importar de lá.
- Usar as skills `frontend-design` e `web-design-guidelines` na página.
- Atualizar docs, comandos do `AGENTS.md` e escrever as ADRs no fechamento.

## O que não fazer

- Não expor no MCP nenhuma tool que leia ou escreva dado de conta, nem `ask_user` e `finalizar`.
- Não passar stores reais, `contaId` de verdade nem prakriti de alguém ao contexto público.
- Não usar biblioteca de gráfico: o gráfico é SVG próprio, com os tokens.
- Não mostrar número da semana abaixo do piso, nem por tooltip, nem no HTML escondido.
- Não contar votos e retornos ao vivo pelas tabelas `feedback` e `retornos`: a semana vem de `sinais_dia`.
- Não usar ISR nem `revalidate` na página (a CSP com nonce exige render dinâmico); o cache é dos dados.
- Não aceitar `Origin` de outro site no MCP; não abrir CORS.
- Não registrar o nome da cidade pedida, os nomes de alimento nem os argumentos das tools em span, métrica ou log.
- Não mexer em `data/`.

## Decisões

| Decisão | Opção escolhida | Racional |
| ------- | --------------- | -------- |
| Gráficos | Cinco, das métricas da linha de resumo; tabela completa recolhida (dona) | Cinco linhas contam a história; a tabela atende quem quer o detalhe |
| MCP na página | Seção "Use a base no seu agente" em Bastidores (dona) | Um endereço público precisa de uma página que explique; o README aponta para cá |
| Quem conta | Todos os runs, inclusive testers e de contas apagadas (dona) | É o uso real do site; o run sem conta já não tem dono |
| Piso | 20 runs `done` nos 7 dias (dona) | Abaixo disso, intenção e voto podem descrever uma pessoa só |
| Janela | 7 dias completos, até ontem, no fuso padrão | Números estáveis durante o dia e iguais para todo mundo; casam com os sinais gravados por dia |
| Sinais | Tabela `sinais_dia`, gravada pela limpeza antes de apagar contas | Votos e retornos de demonstração sumiriam em 24 h pela cascata |
| Números dos runs | Ao vivo, de `runs` e `run_etapas` | Runs não são apagados com a conta (`conta_id` vira nulo); uma consulta por hora basta |
| Cache | Em memória por instância, 1 h, chave = `janela.ate` | A CSP com nonce impede ISR; o Neon não acorda a cada visita |
| Histórico | Lido do arquivo em tempo de execução, validado em zod; `evals/resultados/historico.json` em `outputFileTracingIncludes` | Ausente ou inválido vira estado de erro da seção, sem derrubar a página |
| Gráfico | SVG renderizado no servidor, sem biblioteca | Sem JavaScript no cliente, sem dependência, com os tokens e o tema |
| Transporte do MCP | `mcp-handler` 2.x na rota `/api/mcp`, sem estado | Serve o protocolo atual e o Streamable HTTP de 2025 na mesma rota; cabe numa função da Vercel |
| Nomes das tools | `ayurveda_alimento` etc., com `_` | Vários clientes só aceitam `[a-zA-Z0-9_-]` em nome de tool |
| Contexto público | `filtroVazio`, `sinaisVazios`, `storesProibidos`, `contaId: "mcp"`, prakriti só por `dosha` na entrada | A mesma lógica das tools internas, sem nenhum caminho até dado de conta |
| Cidade no clima | Nome na entrada, primeiro resultado do `CityLookup`, com `regiao` e `pais` na saída | Sem perfil não há cidade; devolver a região mostra qual cidade foi usada |
| Origem no MCP | Sem `Origin` passa; outro `Origin` → `403` | Clientes MCP não mandam `Origin`; navegador de outro site não chama a rota (regra de DNS rebinding do protocolo) |
| Limites do MCP | 30 por IP por minuto, 300 por IP por dia, 3000 no total por dia; toda requisição `POST` conta | Protege o Neon (cada chamada escreve no limitador) e a cota da Open-Meteo |
| Atribuição | `fonte: "Open-Meteo (CC BY 4.0)"` nas tools de clima | A licença dos dados pede atribuição |

## Contratos

### Cria

**Configuração (`config/bastidores.ts`, incluída em `config/index.ts` como `bastidores`)**

```ts
export const bastidores = {
  dias: 7,
  minimoDeRuns: 20,
  topTools: 5,
  cacheMs: 3_600_000,
  retencaoSinaisDias: 30,
  toolsFora: ["ask_user", "finalizar", "memoria.propor", "lista.propor"],
  destaques: [
    "trajetoria.correta",
    "fidelidade.motivos_fieis",
    "autocorrecao.corrigiu",
    "seguranca.injection_bloqueada",
    "custo.chamadas_decisao_por_run",
  ],
  mcp: { caminho: "/api/mcp", corpoMaximoBytes: 16_384 },
} as const
```

**Limites (`config/limites.ts`, acréscimo)**

```ts
mcp: { porIpPorMinuto: 30, porIpPorDia: 300, globalPorDia: 3000 },
```

Chaves na tabela `limites`: `mcp:ip:<hmac>` (janelas `minuto` e `dia`) e `mcp:global` (`dia`). Início como na 021 (`janelaDoMinuto(agora)`; dia local no fuso padrão).

**Tabela `sinais_dia`** (migração `db/migrations/<próximo número>_sinais_dia.sql`)

```sql
create table sinais_dia (
  dia date not null,
  sinal text not null check (sinal in ('feedback_up', 'feedback_down', 'retorno_ajudou', 'retorno_nao_ajudou', 'retorno_nao_fez')),
  total integer not null,
  primary key (dia, sinal)
);
```

Só acrescenta (regra de migrações da 022).

**Porta (`src/core/bastidores/ports.ts`)**

```ts
export type AgregadosDosRuns = {
  runs: number                                     // status done, dia em [de, ate]
  duracao_p50_ms: number | null                    // percentile_cont(0.5) de latencia_ms
  passos_medios: number | null                     // avg(passos) com caminho = 'acompanhante'
  juiz: { julgados: number; refeitas: number }     // juiz_aprovado não nulo; juiz_tentativas = 2
  trocas_de_modelo: number                         // soma
  intencoes: { intencao: string; total: number }[] // unnest(intencoes), desc por total, depois id
  tools: { tool: string; total: number }[]         // etapas tipo 'tool' fora de toolsFora, desc, até topTools
}
export type SinaisDaSemana = {
  feedback: { up: number; down: number }
  retornos: { ajudou: number; nao_ajudou: number; nao_fez: number }
}
export interface BastidoresStore {
  agregadosDosRuns(de: string, ate: string, opcoes: { topTools: number; toolsFora: readonly string[] }): Promise<AgregadosDosRuns>
  sinais(de: string, ate: string): Promise<SinaisDaSemana>                  // soma de sinais_dia
  registrarSinaisDoDia(dia: string, fuso: string): Promise<number>          // upsert dos 5 sinais (zeros também); devolve 5
  apagarSinaisAntesDe(dia: string): Promise<number>
}
```

- `registrarSinaisDoDia`: `feedback` por `voto` com `criado_em` no dia local; `retornos` com `status = 'respondido'` por `resultado`, com `respondido_em` no dia local. `on conflict (dia, sinal) do update set total = excluded.total`.
- Adaptador `src/infra/db/bastidores.ts`; fake `createMemoryBastidores(stores)` em `src/infra/fakes/memory-bastidores.ts`, que lê os mesmos stores em memória usados para semear (acrescentar a leitura interna que faltar); suíte `test/contracts/bastidores.contract.ts` contra os dois, semeando pelos repositórios: janela inclusiva, status fora, caminho fora, juiz nulo fora, `toolsFora`, empate por id, idempotência do registro, voto de conta apagada depois do registro.
- `Container` ganha `bastidores: BastidoresStore`.

**Números da semana (`src/core/bastidores/numeros.ts`)**

```ts
export type Janela = { de: string; ate: string }   // AAAA-MM-DD, inclusiva
export function janelaDaSemana(agora: Date, fuso: string, dias?: number): Janela   // ate = ontem; de = ate − (dias − 1)
export type NumerosDaSemana =
  | { tipo: "poucos"; janela: Janela; runs: number; minimo: number }
  | { tipo: "ok"; janela: Janela; runs: AgregadosDosRuns; sinais: SinaisDaSemana }
export type DepsDosNumeros = { store: BastidoresStore; clock: Clock }
export function criarNumerosDaSemana(deps: DepsDosNumeros): () => Promise<NumerosDaSemana>
// guarda em memória { ate, valor, lido_em }; devolve o guardado se ate igual e agora − lido_em < cacheMs;
// lê agregados; runs < minimoDeRuns → "poucos" (sem ler os sinais); senão lê os sinais.
// Erro do store sobe (não é guardado).
```

`Container` ganha `numerosDaSemana: () => Promise<NumerosDaSemana>` (uma instância por container, com `clima.fusoPadrao`).

**Limpeza (`src/core/cleanup.ts`, 004/017/021)**

`executarLimpeza` ganha, como **primeiro** passo: `bastidores.registrarSinaisDoDia(ontem, fusoPadrao)`; e, junto dos demais, `bastidores.apagarSinaisAntesDe(hoje − retencaoSinaisDias)`. `ResultadoLimpeza` ganha `sinais_registrados: number` e `sinais_apagados: number`. Falha do registro é logada (`erro.codigo`) e a limpeza segue.

**Histórico (`src/core/evals/historico.ts`, movido de `scripts/lib/evals/historico.ts`)**

`historicoSchema` e `type Historico = z.infer<typeof historicoSchema>`, sem mudança de forma (014). `scripts/lib/evals/historico.ts` mantém as funções de gravação e importa o schema daqui.

`src/infra/evals/historico.ts`:

```ts
export function lerHistorico(raiz?: string): Historico | undefined
// lê `evals/resultados/historico.json` a partir de process.cwd(); ausente ou inválido → undefined
```

`next.config.ts`: `outputFileTracingIncludes["/**"]` ganha `"./evals/resultados/historico.json"`. `Container` ganha `historico: () => Historico | undefined`.

**Evolução (`src/core/bastidores/evolucao.ts`)**

```ts
export type FormatoDaMetrica = "pct" | "num" | "ms" | "contagem"
export type Ponto = { checkpoint: string; curto: string; data: string; valor: number | null; abaixo: boolean }
export type Grafico = { id: string; rotulo: string; formato: FormatoDaMetrica; meta?: { tipo: "min" | "max"; valor: number }; pontos: Ponto[]; atual: Ponto | undefined }
export type LinhaDaTabela = { id: string; rotulo: string; formato: FormatoDaMetrica; valores: { valor: number | null; abaixo: boolean }[] }
export type Evolucao =
  | { tipo: "vazia" }
  | { tipo: "ok"; checkpoints: { checkpoint: string; curto: string; data: string }[]; graficos: Grafico[]; tabela: { familia: string; rotulo: string; linhas: LinhaDaTabela[] }[] }
export function montarEvolucao(h: Historico, metas: typeof evals.metas): Evolucao
export function formatarMetrica(valor: number | null, formato: FormatoDaMetrica): string
// pt-BR: pct → "83%" (valor × 100, sem casa); num → "2,5" (até 1 casa); ms → "3,4 s"; contagem → "2"; null → "—"
export function rotuloDoGrafico(g: Grafico): string    // o aria-label do critério de aceite
```

- `curto`: de `textosBastidores.checkpoints`; checkpoint sem rótulo usa o id.
- `abaixo`: o id está em `abaixo_da_meta` da entrada.
- `meta`: de `evals.metas[id]` (`min` ou `max`); sem meta, sem linha nem texto.
- `atual`: o último ponto com valor.
- Tabela: famílias na ordem de `FAMILIAS` (014), métricas na ordem de `textosBastidores.metricas`; métrica do histórico sem rótulo fica fora; família sem métrica fica fora.

**Textos (`config/textos-bastidores.ts`, incluídos em `config/index.ts` como `textosBastidores`)**

| Chave | Texto |
|---|---|
| `titulo` | Bastidores |
| `intro` | Como o Ritu está se saindo, em números. Nada aqui identifica uma pessoa. |
| `semana.titulo` | Últimos 7 dias |
| `semana.janela` | De {de} a {ate}, dias completos. |
| `semana.poucos.titulo` | Ainda pouco uso para mostrar números |
| `semana.poucos.texto` | Os números aparecem a partir de {minimo} conversas em 7 dias. Por enquanto são {runs}. |
| `semana.erro` | Não consegui ler os números agora. |
| `tile.conversas` · `.nota` | Conversas · respostas entregues |
| `tile.duracao` · `.nota` | Tempo típico de resposta · metade sai em até isso |
| `tile.passos` · `.nota` | Passos por resposta · média, quando o agente trabalha |
| `tile.juiz` · `.nota` | Refeitas pelo juiz · o juiz reprovou a primeira versão |
| `tile.trocas` · `.nota` | Trocas de modelo · a cota de um modelo acabou e outro assumiu |
| `tile.votos` · `.valor` | Votos nas respostas · {up} gostaram · {down} não gostaram |
| `tile.retornos` · `.valor` | Como ficou? · Ajudou {ajudou} · Não ajudou {nao_ajudou} · Não fiz {nao_fez} |
| `intencoes.titulo` | O que as pessoas trazem |
| `intencoes.<id>` | `momento` Como estou agora · `pergunta` Pergunta · `vida` Rotina · `casa` Casa · `retorno` Retorno · `evitar` Evitar sempre · `ajuda` Como funciona · `ofensa` Ofensa · `alerta` Alerta · `fora` Fora do assunto |
| `tools.titulo` | Tools mais usadas |
| `evals.titulo` | Evolução dos evals |
| `evals.intro` | A cada checkpoint, o Ritu passa pelos mesmos casos de teste com IA de verdade. Cada ponto é uma rodada. |
| `evals.meta.min` · `.max` | Meta: pelo menos {valor} · Meta: no máximo {valor} |
| `evals.abaixo` | abaixo da meta |
| `evals.semValor` | sem valor |
| `evals.todas` | Todas as métricas |
| `evals.legenda` | Todas as métricas por checkpoint. ⚠ marca valor abaixo da meta. |
| `evals.erro` | A evolução dos evals não está disponível agora. |
| `evals.vazio` | Nenhum checkpoint rodado ainda. |
| `checkpoints.<id>` | `c1-base` Base · `c2-conversa` Conversa · `c3-confiavel` Confiável · `c4-site` Site · `c5-publico` Público |
| `mcp.titulo` | Use a base no seu agente |
| `mcp.texto` | O Ritu tem um servidor MCP público com a base ayurvédica e o clima em qualidades. Qualquer agente compatível com MCP pode consultar. Só leitura: sem conta e sem dado de ninguém. |
| `mcp.endereco` · `.copiar` · `.copiado` | Endereço · Copiar endereço · Endereço copiado |
| `mcp.tools` | O que dá para consultar |
| `mcp.exemplo` | Exemplo de configuração |
| `mcp.limites` | Até {minuto} chamadas por minuto e {dia} por dia por conexão. |
| `aviso` | Não é orientação médica. |

`textosBastidores.familias` (rótulo de cada `Familia` da 014): Intenção, Conteúdo, Fidelidade, Explicação, Trajetória, Autocorreção, Perguntas, Casa, Propostas, Para ter em casa, Aprendizado, Memória, Conversa, Segurança, Linguagem e sofrimento, Incômodos, Juiz, Custo.

`textosBastidores.metricas` (ordem da tabela; `formato` entre parênteses):

| Id | Rótulo |
|---|---|
| `intencao.acerto` | Entendeu a intenção (pct) |
| `conteudo.deve` | Trouxe o que devia (pct) |
| `conteudo.nao_pode` | Evitou o que não podia (pct) |
| `fidelidade.motivos_fieis` | Motivos fiéis à base (pct) |
| `fidelidade.texto_bate` | Texto bate com as sugestões (pct) |
| `explicacao.completa` | Explicação completa (pct) |
| `trajetoria.correta` | Escolheu as consultas certas (pct) |
| `trajetoria.desnecessarias_por_run` | Consultas desnecessárias por resposta (num) |
| `autocorrecao.valida_na_1a` | Válida na primeira tentativa (pct) |
| `autocorrecao.corrigiu` | Corrigiu o que o validador apontou (pct) |
| `perguntas.necessarias` | Perguntou quando precisava (pct) |
| `perguntas.desnecessarias_evitadas` | Não perguntou à toa (pct) |
| `perguntas.recusadas_por_run` | Perguntas recusadas por resposta (num) |
| `casa.acerto` | Usou a casa certo (pct) |
| `propostas.corretas` | Propôs anotar o certo (pct) |
| `propostas.recusadas_por_run` | Propostas recusadas por resposta (num) |
| `para_ter.acerto` | Indicou o que vale ter em casa (pct) |
| `aprendizado.acerto` | Aprendeu com os retornos (pct) |
| `memoria.acerto` | Usou a memória certo (pct) |
| `conversa.acerto` | Conduziu a conversa (pct) |
| `conversa.passos_pergunta_simples` | Passos numa pergunta simples (contagem) |
| `seguranca.bloqueio` | Bloqueou o que é perigoso (pct) |
| `seguranca.injection_bloqueada` | Bloqueou tentativas de injection (pct) |
| `linguagem.acerto` | Lidou com linguagem e sofrimento (pct) |
| `linguagem.alertas_perdidos` | Alertas perdidos (contagem) |
| `linguagem.falsos_alertas` | Alertas falsos (contagem) |
| `incomodos.acerto` | Cuidou dos incômodos (pct) |
| `incomodos.promessas_bloqueadas` | Não prometeu cura (pct) |
| `juiz.acerto` | Juiz acertou (pct) |
| `juiz.falsas_reprovacoes` | Reprovações falsas do juiz (contagem) |
| `custo.chamadas_decisao_por_run` | Chamadas ao modelo por resposta (num) |
| `custo.chamadas_apoio_por_run` | Chamadas de apoio por resposta (num) |
| `custo.chamadas_reforco_por_run` | Chamadas de reforço por resposta (num) |
| `custo.tokens_entrada_por_run` | Tokens de entrada por resposta (contagem) |
| `custo.tokens_saida_por_run` | Tokens de saída por resposta (contagem) |
| `custo.trocas` | Trocas de modelo (contagem) |
| `custo.latencia_p50_ms` | Latência típica (ms) |
| `custo.latencia_p95_ms` | Latência dos 5% mais lentos (ms) |

**Página (`src/app/bastidores/page.tsx`)**

- `export const dynamic = "force-dynamic"`; `metadata.title`: "Bastidores · Ritu". Sem sessão obrigatória; não chama `exigirPasso` nem redireciona.
- Lê `container.numerosDaSemana()` (erro → estado de erro da seção), `container.historico()` e a origem do pedido (`x-forwarded-proto` e `x-forwarded-host` ou `host` de `headers()`).
- Estrutura: `header` com o logo da Entrada (017) como link para `/`; `main#conteudo` com `h1`, a introdução e três `section` com `h2` (`aria-labelledby`); `footer` com `aviso`.
- Largura: coluna `--container-content` no celular; acima de 48rem, até 64rem, com os gráficos em duas colunas e os indicadores em grade.

**Componentes (`src/components/ritu/bastidores/`)**

| Arquivo | Exporta | O que é |
|---|---|---|
| `numeros-da-semana.tsx` | `NumerosDaSemana({ numeros })` | A seção 1. `ok`: texto da janela (datas "3 de dez."), os sete indicadores em `dl` (`dt` rótulo, `dd` valor em `font-title text-title` com `tabular-nums` e a nota em `ink-muted`), depois Intenções e Tools. `poucos`: `StateBlock kind="empty"`. Erro: `StateBlock kind="error"` |
| `barras.tsx` | `Barras({ titulo, itens })` | `h3` e uma lista; cada item com o rótulo, o total e a porcentagem em texto e uma barra de 0.5rem em `primary` sobre `sunken`, `radius` `pill`. A barra é decorativa (`aria-hidden`); o texto diz tudo |
| `grafico-evolucao.tsx` | `GraficoEvolucao({ grafico })` | `figure` em `Surface tone="surface" radius="lg"` com borda `line`: título (`h3`), valor atual grande, texto da meta; SVG `viewBox="0 0 320 140"`, largura 100%, `role="img"` com `rotuloDoGrafico`. Linha `primary` de 2px entre pontos com valor; ponto: círculo de raio 4, cheio em `primary`, vazado com borda `amber-ink` de 2px quando `abaixo`; valor acima de cada ponto em `text-caption tabular-nums` (com "⚠" quando `abaixo`); meta em linha tracejada `line-strong` de 1px com o texto "meta" à direita; eixo x com os rótulos curtos. `pct` vai de 0 a 100%; os demais de 0 ao maior valor entre os pontos e a meta, com 10% de folga |
| `tabela-metricas.tsx` | `TabelaMetricas({ evolucao })` | `Disclosure` (React Aria) com o botão `evals.todas`; dentro, `table` com `caption` `evals.legenda`, cabeçalho com o nome curto e a data de cada checkpoint, `tbody` por família com `th scope="rowgroup"`, `th scope="row"` no rótulo da métrica, primeira coluna fixa e rolagem horizontal só no contêiner da tabela; "⚠" com `<span class="sr-only">abaixo da meta</span>` |
| `use-o-mcp.tsx` | `UseOMcp({ endereco })` | A seção 3: texto, endereço em `Surface tone="sunken"` com `IconButton` (`Copy`, Phosphor `light`) que copia e chama `toast`; `dl` com as seis tools (nome e descrição curta de `DESCRICOES_PUBLICAS`); `pre` com o exemplo; linha dos limites |

Exemplo de configuração mostrado (o endereço é o do pedido):

```json
{
  "mcpServers": {
    "ritu": { "type": "http", "url": "https://<endereço>/api/mcp" }
  }
}
```

Só `use-o-mcp.tsx` é componente de cliente (`"use client"`); o resto renderiza no servidor.

**Tools públicas (`src/core/mcp/`)**

```ts
// contexto.ts
export type DepsPublicas = { kb: KnowledgeBase; clima: WeatherSource; cidades: CityLookup; clock: Clock; telemetry: Telemetry }
export const storesProibidos: ToolContext["stores"]   // Proxy: qualquer propriedade lança RituError("mcp_sem_conta")
export function contextoPublico(deps: DepsPublicas, extras?: { prakriti?: Prakriti; cidade?: CidadeDaPessoa }): ToolContext
// { kb, filtro: filtroVazio, sinais: sinaisVazios, prakriti, clima: { fonte: deps.clima, cidade }, contaId: "mcp",
//   stores: storesProibidos, clock, telemetry, fuso: cidade?.fuso }

// tools.ts
export const AVISO = "Não é orientação médica." as const
export const FONTE_CLIMA = "Open-Meteo (CC BY 4.0)" as const
export type ToolPublica<I, O> = { nome: string; descricao: string; curta: string; entrada: z.ZodType<I>; saida: z.ZodType<O>; executar(e: I, deps: DepsPublicas): Promise<O> }
export const TOOLS_PUBLICAS: ToolPublica<unknown, unknown>[]       // as seis, nesta ordem
export const DESCRICOES_PUBLICAS: { nome: string; curta: string }[]
```

| Nome | Entrada | Executa | Saída |
|---|---|---|---|
| `ayurveda_alimento` | A da tool interna `ayurveda.alimento` | `alimentoTool.execute` | A da interna + `aviso` |
| `ayurveda_candidatos` | A da interna `ayurveda.candidatos` + `dosha?: Dosha` | `candidatosTool.execute` com prakriti `{ [dosha]: 1 }` quando houver | A da interna + `aviso` |
| `ayurveda_substitutos` | A da interna `ayurveda.substitutos` | `substitutosTool.execute` | A da interna sem `em_casa` em cada substituto + `aviso` |
| `ayurveda_checar_combinacao` | A da interna `ayurveda.checar_combinacao` | `checarCombinacaoTool.execute` | A da interna + `aviso` |
| `clima_agora` | `{ cidade: string }` (2 a 80 caracteres, sem espaço nas pontas) | `cidades.buscar(cidade)`, primeira cidade; `climaAgoraTool.execute` com ela | `ok`: a da interna + `regiao?`, `pais`, `fonte`, `aviso`; `cidade_nao_encontrada` ou `indisponivel`: `{ status, aviso }` |
| `clima_proximas_horas` | `{ cidade: string }` | Idem, com `climaProximasHorasTool` | Idem |

`CityLookupUnavailableError` vira `indisponivel`. `descricao` (vai para o cliente MCP) e `curta` (vai para a página):

| Nome | `descricao` | `curta` |
|---|---|---|
| `ayurveda_alimento` | Qualidades (gunas), sabores (rasa), potência (virya), efeito pós-digestivo (vipaka), efeito nos doshas e como equilibrar de até 5 alimentos, pelo nome em português. | Qualidades e efeito de um alimento |
| `ayurveda_candidatos` | Alimentos, preparos ou práticas da base que atendem às qualidades buscadas, ordenados por adequação. Opcional: momento do dia, estados, função e o dosha da pessoa. | Sugestões para as qualidades que você busca |
| `ayurveda_substitutos` | Substitutos para um alimento, com as qualidades em comum e o motivo. | Substitutos de um ingrediente |
| `ayurveda_checar_combinacao` | Confere se os alimentos combinam entre si pela base (combinações a evitar), com o motivo de cada conflito. | Se os alimentos combinam |
| `clima_agora` | Temperatura aparente e umidade de uma cidade, já em faixas e qualidades (gunas). | Clima agora em qualidades |
| `clima_proximas_horas` | Tendência das próximas 6 horas numa cidade: esquenta, esfria, estável e se chove. | Tendência das próximas horas |

As descrições dos campos de entrada vão em `.describe()` nos schemas; os valores aceitos (gunas, estados, funções, momentos, doshas) saem do `enum` do zod.

**Servidor (`src/infra/mcp/servidor.ts`)**

```ts
export function criarHandlerMcp(container: Container): (req: Request) => Promise<Response>
```

- `createMcpHandler` do `mcp-handler`, sem estado, `basePath` que resulte em `/api/mcp`; `serverInfo: { name: "ritu", version: <package.json> }`; `instructions`: "Base ayurvédica do Ritu (alimentos, preparos, práticas e combinações) e clima em qualidades. Só leitura. Não é orientação médica."
- Para cada `TOOLS_PUBLICAS`: `registerTool(nome, { description, inputSchema, outputSchema, annotations: { readOnlyHint: true, openWorldHint: nome começa com "clima_" } }, fn)`. `fn` abre o span `mcp.tool`, executa, devolve `structuredContent` e um bloco `text` com o JSON; erro de validação → `isError: true` com "Entrada inválida." e os caminhos dos campos; outro erro → `isError: true` com "Não consegui responder agora.", log `error` com `erro.codigo`. Soma `ritu_mcp_chamadas_total{tool, resultado: "ok" | "invalido" | "erro"}`.

**Rota (`src/app/api/mcp/route.ts`)**

- `export const dynamic = "force-dynamic"`; `runtime` Node; exporta `GET`, `POST` e `DELETE`. Não passa por `criarRota` (não há sessão).
- `POST`: `content-length` (ou corpo lido) acima de `corpoMaximoBytes` → `413`; `ipDoPedido` e `hashDoIp` (017); `consumirMcp`; barrado → `429` com `Retry-After` e `{ "jsonrpc": "2.0", "error": { "code": -32000, "message": "Limite de uso atingido. Tente de novo mais tarde." }, "id": null }`; senão, o handler. Agenda `descarregarDepois` (022).
- `GET` e `DELETE`: direto ao handler (que responde `405` no modo sem estado); não contam limite.

**Limites do MCP (`src/core/limits/mcp.ts`)**

```ts
export function consumirMcp(deps: { limiter: UsageLimiter; clock: Clock; telemetry: Telemetry }, ipHash: string): Promise<{ ok: true } | { ok: false; erro: LimiteError }>
```

Ordem: `consumir([mcp:ip], "minuto", janelaDoMinuto(agora))`; barrou → `retryAfterS` até o próximo minuto, motivo `minuto`. `consumir([mcp:ip, mcp:global], "dia", hoje)`; barrou pela chave do IP → motivo `ip`; pela global → motivo `global`; `retryAfterS` até a meia-noite local (fuso padrão). Barrado soma `ritu_limite_total{tipo: "mcp", motivo, resultado: "barrado"}`. `LimiteError.code` ganha `"limite_mcp"`.

**Origem (`src/core/security/`, 017)**

```ts
export function origemValida(p: { metodo: string; origin: string | null; host: string | null; caminho: string }): boolean
// caminho começando por bastidores.mcp.caminho: origin nulo → true; presente → host igual; demais caminhos: como na 017
```

`src/proxy.ts` passa `caminho` (`request.nextUrl.pathname`).

**Telemetria**

- `METRICAS` ganha `ritu_mcp_chamadas_total` (contador; `tool`, `resultado`). `ritu_limite_total` (021) aceita `tipo: "mcp"` e `motivo: "global"`.
- `SPANS` ganha `mcp.tool` (raiz, sem run), com `tool.nome` e `tool.status` (`ok`, `invalido`, `erro`). `ATRIBUTOS_PERMITIDOS` não muda.
- Painel (015), linha 1 "Saúde": stat "Chamadas MCP", `TOTAL(ritu_mcp_chamadas_total, resultado)`. Regenerar com `npm run painel:gerar`.

**Smoke (022, acréscimos em `scripts/lib/smoke.ts`)**

```ts
export function checarPublico(r: { bastidores: number; toolsDoMcp: string[] }): Checagem[]   // grupo novo "publico"
```

`GET /bastidores` → `200`; `POST /api/mcp` com `initialize` e `tools/list` (sem `Origin`) → as seis tools, em qualquer ordem. Conta 2 chamadas no limite do IP do runner.

**Arquitetura**

- `src/core/mcp/**` e `src/core/bastidores/**` seguem R1 (só `zod`). `mcp-handler` e `@modelcontextprotocol/server` só em `src/infra/mcp/**` e `src/app/api/mcp/**` (regra nova no teste de arquitetura, com um caso que viola e um que passa).
- `ARCHITECTURE.md` §7 troca a pasta `mcp/` por `src/core/mcp/` e `src/infra/mcp/`.

**Pacotes**

| Pacote | Tipo | Versão |
|---|---|---|
| `mcp-handler` | prod | `^2` (a atual no dia) |
| `@modelcontextprotocol/server` | prod | `^2` (a que o `mcp-handler` pede) |

### Usa

- **002:** `KnowledgeBase`, `filtroVazio`, `sinaisVazios`, `Prakriti`, `Dosha`, as tools `ayurveda.*` e seus schemas.
- **003:** `WeatherSource`, `CityLookup`, `CidadeDaPessoa`, `CityLookupUnavailableError`, as tools `clima.*`, cache de 1 h do clima.
- **004:** tabelas `runs`, `run_etapas`, `feedback`, `retornos`; `executarLimpeza` e `ResultadoLimpeza`; `RituError`; o `Transactor`.
- **005 e 015:** `Telemetry`, `METRICAS`, `SPANS`, `ATRIBUTOS_PERMITIDOS`, painel gerado.
- **008:** `Caminho`, intenções gravadas no run.
- **014:** `historicoSchema`, `FAMILIAS`, `config/evals.ts` (`metas`), `COMPARACAO.md`.
- **016:** `Surface`, `StateBlock`, `IconButton`, `toast`, tokens, tema.
- **017:** `UsageLimiter`, `ipDoPedido`, `hashDoIp`, `origemValida`, `src/proxy.ts`, logo da Entrada.
- **021:** `limites`, `LimiteError`, `janelaDoMinuto`, `segundosAte`, `ritu_limite_total`.
- **022:** `descarregarDepois`, `next.config.ts` (`outputFileTracingIncludes`), smoke (`Checagem`), regra das migrações.

## Evals (quando a spec toca agente, prompt, tool ou base)

Nenhum caso com LLM novo: a spec não muda agente nem prompt. Determinísticos novos:

- `evals/det/mcp/tools.eval.ts`: as seis tools e só elas; mesmo resultado das internas com contexto neutro (alimento, candidatos sem e com `dosha`, substitutos sem `em_casa`, combinação); clima com cidade achada, não achada e Open-Meteo fora; `aviso` em toda saída; nenhum caso toca `storesProibidos`; saída de toda tool passa no `outputSchema`.
- `evals/det/seguranca/mcp-rota.eval.ts`: limites por minuto, por dia e global com `Retry-After`; `Origin` de outro site `403`, sem `Origin` e do próprio site passam; `413` sem consumir; erro de tool sem stack; `GET` não consome.
- `evals/det/privacidade/` (eval de canários da 015): roda as seis tools com canário na cidade e nos nomes de alimento e confere span, métrica, log e console.
- `evals/det/bastidores/numeros.eval.ts`: piso (19 e 20); hoje fora da janela; voto de demonstração contado depois de a limpeza apagar a conta; o JSON de `NumerosDaSemana` e o HTML da página não têm `conta_id`, e-mail nem os canários plantados nas mensagens e no perfil do seed.
- `evals/det/bastidores/evolucao.eval.ts`: `montarEvolucao` com o `historico.json` real bate com `gerarComparacao` (mesmos valores formatados por métrica e checkpoint).
- `evals/det/mapa.ts` (014): entradas novas com `desde: 4`.

E2E (`e2e/bastidores.spec.ts`, celular e desktop, no modo e2e com o fake): página sem sessão; axe nos dois temas com a tabela aberta; cinco `role="img"` com nome; "Todas as métricas" abre e fecha pelo teclado; "Copiar endereço" mostra o toast; com o fake abaixo do piso, o `StateBlock`; com o fake acima, os sete indicadores.

## Nível das partes

- **tela** (Sonnet): `src/app/bastidores/` e `src/components/ritu/bastidores/` (página, gráfico, tabela, barras, seção do MCP), com `frontend-design` e `web-design-guidelines`.
- **nucleo** (Sonnet): `origemValida` e `src/proxy.ts`; `src/app/api/mcp/route.ts` e `src/infra/mcp/servidor.ts`.
- Todo o resto é `mecanica` (Haiku): store, migração, limpeza, números, evolução, tools públicas, limites, telemetria, smoke, config e textos.

## Leitura para a construção

- `OBSERVABILITY.md` §3 "Privacidade": o que nunca vai para telemetria.
- `DESIGN.md` §3 "Acessibilidade": regras que o axe não pega (cor nunca como único sinal, zoom de 200%).
- `DEVELOPMENT.md`: padrões de código e camadas (é curto).
- `.specs/016-design-system.md` "Contratos": tokens e componentes base.
- `.specs/014-evals.md` "Métricas e metas" e "Arquivos de uma rodada completa": significado das métricas e forma do histórico.
- Documentação da versão instalada de `mcp-handler` e `@modelcontextprotocol/server`.

## Dependências

- Specs 002, 003, 004, 005, 008, 014, 015, 016, 017, 021 e 022.
- Pacotes `mcp-handler` e `@modelcontextprotocol/server` (novos).
- Open-Meteo (previsão e geocodificação), pelos adaptadores da 003.

## Riscos e trade-offs

- **Uso do Neon pelo MCP:** cada `POST` escreve no limitador e acorda o banco. O teto global de 3000 por dia limita o gasto de CU-h; quando ele chega, o MCP para para todos até a meia-noite. Aceito: o site não é afetado.
- **Ataque de muitos IPs:** só o teto global segura. Aceito para um projeto de estudo.
- **Primeira cidade do `CityLookup`:** "São José" pode cair na cidade errada. A saída traz `regiao` e `pais` para quem chama perceber.
- **Cache por instância:** duas instâncias podem mostrar números de horas diferentes do mesmo dia. Os números são da semana até ontem; a diferença só aparece na virada.
- **Sinais de um dia sem limpeza:** se o cron falhar num dia, os votos e retornos daquele dia ficam de fora (as contas de demonstração já vencidas na limpeza seguinte levam os deles). Aceito; a falha aparece no log `error` da rota do cron.
- **Piso fixo:** 20 conversas protege de leitura individual na maior parte dos casos, não em todos; não há ruído diferencial. Aceito: os números são contagens grossas.
- **Não usar biblioteca de gráfico:** mais código próprio, em troca de nenhum JavaScript no cliente e visual do Ritu.

## Edge cases e modos de falha

- `historico.json` ausente, ilegível ou com versão diferente: seção de evals em erro; o resto da página normal.
- Checkpoint no histórico que não está em `textosBastidores.checkpoints`: aparece com o id.
- Métrica `null` em todos os checkpoints: gráfico sem linha, valor atual "—", texto da meta mantido.
- Um checkpoint só: gráfico com um ponto, sem linha.
- `juiz.julgados` 0, `passos_medios` nulo ou `duracao_p50_ms` nulo: "—".
- Intenção nova (sem rótulo): mostra o id.
- Tool interna renomeada: some de "Tools mais usadas" até ter chamadas com o nome novo.
- MCP com JSON inválido ou método desconhecido: resposta JSON-RPC de erro do `mcp-handler`; conta no limite.
- `CityLookup` devolve cidade sem `regiao`: o campo fica de fora.
- IP `"desconhecido"` (sem `x-forwarded-for`): todos dividem a mesma chave; na Vercel o header sempre existe.
- Limpeza roda duas vezes no dia: o upsert deixa os mesmos valores.
- Banco fora durante a limpeza: o registro falha e é logado; a limpeza também falha como antes.

## Resultado (definição de pronto)

- `/bastidores` em produção mostra os números da semana (ou o piso), os cinco gráficos com o `c1-base` até o último checkpoint rodado e a seção do MCP com o endereço de produção.
- Um cliente MCP real (MCP Inspector) conectado a `https://<produção>/api/mcp` lista as seis tools e recebe resposta de `ayurveda_alimento` e `clima_agora`.
- O smoke da CI passa com o grupo `publico`.
- Os critérios de aceite acima passam nos gates; ADRs escritas; docs vivos atualizados.

## Arquivos e diretórios envolvidos

- `config/bastidores.ts`, `config/textos-bastidores.ts`, `config/limites.ts`, `config/index.ts`
- `db/migrations/<n>_sinais_dia.sql`
- `src/core/bastidores/` (`ports.ts`, `numeros.ts`, `evolucao.ts` e testes)
- `src/core/evals/historico.ts`; `scripts/lib/evals/historico.ts` (importa daqui)
- `src/core/mcp/` (`contexto.ts`, `tools.ts` e testes)
- `src/core/limits/mcp.ts`, `src/core/limits/erros.ts`
- `src/core/security/` (`origemValida`), `src/proxy.ts`
- `src/core/cleanup.ts`
- `src/core/telemetry/nomes.ts`, `observability/` (painel regenerado)
- `src/infra/db/bastidores.ts`, `src/infra/fakes/memory-bastidores.ts`, `src/infra/evals/historico.ts`, `src/infra/mcp/servidor.ts`, `src/infra/container.ts`
- `src/app/bastidores/page.tsx`, `src/app/api/mcp/route.ts`
- `src/components/ritu/bastidores/`
- `test/contracts/bastidores.contract.ts`, teste de arquitetura
- `scripts/lib/smoke.ts`, `scripts/smoke.ts`
- `next.config.ts`, `package.json`
- `evals/det/mcp/`, `evals/det/bastidores/`, `evals/det/seguranca/mcp-rota.eval.ts`, `evals/det/privacidade/`, `evals/det/mapa.ts`
- `e2e/bastidores.spec.ts`
- `.adrs/` (duas novas: "MCP público só de leitura" e "Bastidores com piso e sinais por dia"), `.adrs/README.md`
- `.docs/ARCHITECTURE.md` (§1 rota `/api/mcp`; §4 Servidor MCP com tools, limites e origem; §5 `BastidoresStore`; §6 `sinais_dia`; §7 pastas), `.docs/OBSERVABILITY.md` (§4 Bastidores: janela, piso, sinais por dia; métrica e span do MCP), `.docs/BUSINESS.md` (§7 linha de Bastidores; §14 limites do MCP), `.docs/DATA-SOURCES.md` (atribuição da Open-Meteo no MCP), `.docs/QA.md` (evals determinísticos novos), `AGENTS.md` (status)
