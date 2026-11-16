import { describe, expect, it } from "vitest"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"
import {
  cenarios,
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeConversa,
  cenariosDeGuardrails,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import type {
  Cenario as CenarioBase,
  CenarioDeConversa,
} from "../../../test/fixtures/cenarios/tipos"

// Ordem da entrega (013, T16): retornos, faltas e propostas do agente só existem para a saída aprovada;
// o Juiz roda depois de pausa; caminhos sem agente e o sem_modelo não chamam o Juiz.

const PROMESSA = { motivo: "promessa", trecho: "resolve a dor" } as const

function pegar<T>(registro: Record<string, T>, nome: string): T {
  const c = registro[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// O passo que entrega a resposta (finalizar é sempre o último do roteiro dos cenários usados aqui).
function passoFinal(c: CenarioBase): PassoRoteirizado {
  const passo = c.roteiro.at(-1)
  if (!passo) throw new Error(`cenário ${c.nome} sem roteiro`)
  return passo
}

const faltou = pegar(cenariosComAprovacao, "faltou-hoje")

// Reprovada duas vezes: o Juiz reprova a primeira entrega e a nova tentativa também.
const faltouReprovada: CenarioDeConversa = {
  ...faltou,
  juiz: [{ apontamentos: [PROMESSA] }, { apontamentos: [PROMESSA] }],
  roteiro: [...faltou.roteiro, passoFinal(faltou)],
}

// Pausa de casa e reprovada uma vez: a nova tentativa passa.
const casaIncerta = pegar(cenariosComPausa, "casa-incerta")
const casaIncertaReprovada: CenarioDeConversa = {
  ...casaIncerta,
  juiz: [{ apontamentos: [PROMESSA] }, { apontamentos: [] }],
  roteiro: [...casaIncerta.roteiro, passoFinal(casaIncerta)],
}

async function rodar(c: CenarioBase) {
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { contaId, deps, rodada }
}

const spansDoJuiz = (deps: DepsDoCenario) => deps.telemetry.spans.filter((s) => s.nome === "juiz")

// Soma dos valores de ritu_faltas_total com origem teria_entrado (a falta que a entrega registra).
function faltasRegistradas(deps: DepsDoCenario): number {
  return deps.telemetry.metricas
    .filter((m) => m.nome === "ritu_faltas_total" && m.rotulos.origem === "teria_entrado")
    .reduce((soma, m) => soma + m.valor, 0)
}

describe("retornos, faltas e propostas só existem para a saída aprovada", () => {
  it("reprovada duas vezes: a saída é a segura, sem retorno, sem falta, sem proposta", async () => {
    const { contaId, deps, rodada } = await rodar(faltouReprovada)
    const final = rodada.final

    expect(final.saida?.origem).toBe("segura")
    expect(await deps.stores.outcomes.doRun(contaId, final.run_id)).toEqual([])
    expect(faltasRegistradas(deps)).toBe(0)
    expect(final.saida?.propostas ?? []).toEqual([])
    expect(rodada.bloco).toBeUndefined()
    expect(await deps.stores.shortages.lista(contaId)).toEqual([])
  })

  it("controle: aprovada na primeira, a mesma conversa grava retorno, falta e proposta", async () => {
    const { contaId, deps, rodada } = await rodar(faltou)
    const final = rodada.final

    expect(final.saida?.origem).toBe("agente")
    expect((await deps.stores.outcomes.doRun(contaId, final.run_id)).length).toBeGreaterThan(0)
    expect(faltasRegistradas(deps)).toBeGreaterThan(0)
    expect(rodada.bloco?.propostas.map((p) => p.tool)).toContain("lista.propor")
  })
})

describe("depois de pausa, o Juiz roda igual", () => {
  it.each(["casa-incerta", "dor-de-cabeca"])(
    "%s: o Juiz lê a entrega uma vez e aprova",
    async (nome) => {
      const { contaId, deps, rodada } = await rodar(pegar(cenariosComPausa, nome))
      const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
      expect(rodada.perguntas.length).toBeGreaterThan(0)
      expect(spansDoJuiz(deps)).toHaveLength(1)
      expect(run?.juiz_tentativas).toBe(1)
      expect(run?.juiz_aprovado).toBe(true)
    },
  )

  it("casa-incerta reprovada na primeira leitura: a nova tentativa é lida pelo Juiz de novo", async () => {
    const { contaId, deps, rodada } = await rodar(casaIncertaReprovada)
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)

    expect(rodada.perguntas.length).toBeGreaterThan(0)
    expect(spansDoJuiz(deps)).toHaveLength(2)
    expect(run?.juiz_tentativas).toBe(2)
    expect(run?.juiz_aprovado).toBe(true)
  })
})

describe("caminhos sem agente e sem_modelo não chamam o Juiz", () => {
  const CAMINHOS: [string, CenarioBase, string][] = [
    ["casa", pegar(cenariosDeConversa, "casa-sozinha"), "casa"],
    ["alerta", pegar(cenariosDeGuardrails, "alerta-por-codigo"), "alerta"],
    ["fora", pegar(cenariosDeGuardrails, "injection-por-codigo"), "fora"],
  ]

  it.each(CAMINHOS)("caminho %s: sem span juiz, sem etapa juiz", async (_, c, caminho) => {
    const { contaId, deps, rodada } = await rodar(c)
    const run = await deps.stores.runs.buscar(contaId, rodada.final.run_id)
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)

    expect(run?.caminho).toBe(caminho)
    expect(spansDoJuiz(deps)).toHaveLength(0)
    expect(etapas.some((e) => e.tipo === "juiz")).toBe(false)
    expect(run?.juiz_tentativas).toBe(0)
  })

  it("sem_modelo: o run acaba sem modelo e não chama o Juiz", async () => {
    const c = pegar(cenarios, "sem-modelo")
    const { contaId, deps } = await montarCenario(c)
    const final = await deps.companion.responder(contaId, c.entrada, {})
    const run = await deps.stores.runs.buscar(contaId, final.run_id)

    expect(final.fim).toBe("sem_modelo")
    expect(spansDoJuiz(deps)).toHaveLength(0)
    expect(run?.juiz_tentativas).toBe(0)
  })
})
