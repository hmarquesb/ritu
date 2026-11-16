// Runners dos casos de apoio do eval com LLM: Intérprete, Memória e Juiz. Cada um roda uma chamada de agente
// sobre o caso e devolve o resultado e o colhido. Sem container: as dependências entram por parâmetro.
import type { CasoInterprete } from "../../../evals/llm/casos/c2"
import type { CasoJuiz, CasoMemoria } from "../../../evals/llm/casos/c3"
import { createInterpreter } from "../../../src/core/agents/interpreter/interpretar"
import { createJudge } from "../../../src/core/agents/judge/julgar"
import type { NotaParaResumo } from "../../../src/core/agents/memory/entrada"
import { createMemoryAgent, type ResumoFeito } from "../../../src/core/agents/memory/memoria"
import type { Clock } from "../../../src/core/clock"
import type { KnowledgeBase } from "../../../src/core/knowledge/knowledge-base"
import type { LlmClient } from "../../../src/core/llm/client"
import { createModelRouter } from "../../../src/core/llm/router"
import { escolherCaminho } from "../../../src/core/runs/caminhos"
import { createMemoryLedger } from "../../../src/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "../../../src/infra/fakes/memory-telemetry"
import { conferir, retornosFalsos } from "./colher"
import { type Checagem, type Colhido, calcularAcertou, type ResultadoDoCaso } from "./resultado"
import type { CasoRodado } from "./rodar-run"

export type DepsDeApoio = { client: LlmClient; kb: KnowledgeBase; clock: Clock }

const DIA_EM_MS = 24 * 60 * 60 * 1000

const falsas = (lista: "deve" | "nao_pode", expectativas: { descricao: string }[]): Checagem[] =>
  expectativas.map((e) => ({ lista, descricao: e.descricao, ok: false }))

/** Monta o resultado com `acertou` calculado; `erro` só entra quando há erro. */
function montar(base: Omit<ResultadoDoCaso, "acertou" | "erro">, erro?: string): ResultadoDoCaso {
  const acertou = calcularAcertou({ checagens: base.checagens, erro })
  return erro === undefined ? { ...base, acertou } : { ...base, acertou, erro }
}

function roteadorDeApoio(deps: DepsDeApoio) {
  const telemetry = createMemoryTelemetry()
  const router = createModelRouter({
    ledger: createMemoryLedger(deps.clock),
    clock: deps.clock,
    telemetry,
  })
  return { router, telemetry }
}

/** Uma chamada do Intérprete: a interpretação conferida por deve e naoPode, com o caminho que ela leva. */
export async function rodarInterprete(
  caso: CasoInterprete,
  deps: DepsDeApoio,
): Promise<CasoRodado> {
  const { router, telemetry } = roteadorDeApoio(deps)
  const interpreter = createInterpreter({ ...deps, router, telemetry })
  const r = await interpreter.interpretar({
    texto: caso.mensagem,
    atalhos: caso.atalhos ?? [],
    conversa: caso.conversa ?? [],
    pendentes: retornosFalsos(caso.pendentes ?? [], deps.clock.now().toISOString()),
  })
  const base = {
    id: caso.id,
    titulo: caso.titulo,
    tipo: "interprete" as const,
    familias: caso.familias,
    marcas: caso.marcas ?? [],
    latenciaMs: r.duracao_ms,
  }
  if (!r.ok) {
    return {
      resultado: montar(
        {
          ...base,
          checagens: [...falsas("deve", caso.deve), ...falsas("nao_pode", caso.naoPode)],
          uso: {},
          trocas: 0,
          modelos: [],
        },
        r.motivo,
      ),
      colhido: { mensagem: caso.mensagem, texto: "", etapas: [] },
    }
  }
  const entrada = {
    interpretacao: r.interpretacao,
    caminho: escolherCaminho(r.interpretacao).caminho,
  }
  return {
    resultado: montar({
      ...base,
      checagens: [
        ...conferir("deve", caso.deve, entrada),
        ...conferir("nao_pode", caso.naoPode, entrada),
      ],
      uso: {
        apoio: { chamadas: 1, tokens_entrada: r.tokens.entrada, tokens_saida: r.tokens.saida },
      },
      trocas: r.trocas,
      modelos: [r.modelo],
    }),
    colhido: { mensagem: caso.mensagem, texto: "", etapas: [] },
  }
}

// As notas do caso com o dia calculado pelo relógio: agora menos os dias atrás (ids nota-1, nota-2, …).
function notasDoCaso(caso: CasoMemoria, clock: Clock): NotaParaResumo[] {
  const agora = clock.now().getTime()
  return caso.notas.map((nota, i) => ({
    id: `nota-${i + 1}`,
    texto: nota.texto,
    criado_em: new Date(agora - nota.diasAtras * DIA_EM_MS).toISOString(),
  }))
}

function resultadoDaMemoria(caso: CasoMemoria, resumo: ResumoFeito): ResultadoDoCaso {
  const alvo = { resumo, notas: caso.notas }
  return montar({
    id: caso.id,
    titulo: caso.titulo,
    tipo: "memoria",
    familias: caso.familias,
    marcas: caso.marcas ?? [],
    checagens: [...conferir("deve", caso.deve, alvo), ...conferir("nao_pode", caso.naoPode, alvo)],
    uso: {
      apoio: {
        chamadas: resumo.modelo !== undefined ? 1 : 0,
        tokens_entrada: resumo.tokens.entrada,
        tokens_saida: resumo.tokens.saida,
      },
    },
    trocas: resumo.trocas,
    latenciaMs: resumo.duracao_ms,
    modelos: resumo.modelo !== undefined ? [resumo.modelo] : [],
  })
}

/** Um caso da Memória: o resumo das notas pelo agente, conferido por deve e naoPode. */
export async function rodarMemoria(caso: CasoMemoria, deps: DepsDeApoio): Promise<CasoRodado> {
  const { router, telemetry } = roteadorDeApoio(deps)
  const agente = createMemoryAgent({
    router,
    client: deps.client,
    kb: deps.kb,
    telemetry,
    clock: deps.clock,
  })
  const resumo = await agente.resumir(notasDoCaso(caso, deps.clock))
  return {
    resultado: resultadoDaMemoria(caso, resumo),
    colhido: { texto: resumo.texto, etapas: [] },
  }
}

/** Um Juiz sobre a resposta pronta do caso: deve e naoPode sobre o veredito, e os motivos apontados. */
export async function rodarJuiz(caso: CasoJuiz, deps: DepsDeApoio): Promise<CasoRodado> {
  const { router, telemetry } = roteadorDeApoio(deps)
  const judge = createJudge({ ...deps, router, telemetry })
  const v = await judge.julgar({
    saida: caso.saida,
    evitar: caso.evitar,
    nota_de_rotina: caso.nota_de_rotina,
    tentativa: 1,
  })
  const colhido: Colhido = { texto: caso.saida.resposta, saida: caso.saida, etapas: [] }
  const base = {
    id: caso.id,
    titulo: caso.titulo,
    tipo: "juiz" as const,
    familias: caso.familias,
    marcas: caso.marcas ?? [],
    latenciaMs: v.duracao_ms,
  }
  if (!v.ok) {
    return {
      resultado: montar(
        {
          ...base,
          checagens: [...falsas("deve", caso.deve), ...falsas("nao_pode", caso.naoPode)],
          uso: {},
          trocas: 0,
          modelos: [],
        },
        v.motivo,
      ),
      colhido,
    }
  }
  return {
    resultado: montar({
      ...base,
      checagens: [...conferir("deve", caso.deve, v), ...conferir("nao_pode", caso.naoPode, v)],
      juiz: {
        esperados: caso.motivos,
        devolvidos: [...new Set([...v.graves, ...v.registros])],
        aprovado: v.aprovado,
      },
      uso: {
        apoio: { chamadas: 1, tokens_entrada: v.tokens.entrada, tokens_saida: v.tokens.saida },
      },
      trocas: v.trocas,
      modelos: [v.modelo],
    }),
    colhido,
  }
}
