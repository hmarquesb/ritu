import { describe, expect, it } from "vitest"
import type { RunEtapa } from "@/core/runs/ports"
import { type Cenario, cenarios, montarCenario } from "../../../test/fixtures/cenarios"

type Trajetoria = {
  status: "done"
  origem: "agente" | "sem_modelo"
  etapas: string[]
}

// Chamada de modelo aparece só como "llm" (o roteador escolhe o modelo); as demais, por tipo, nome e status.
const comoEtapa = (e: RunEtapa): string =>
  e.tipo === "llm" ? "llm" : `${e.tipo}:${e.nome}:${e.status}`

const ESPERADAS: Record<string, Trajetoria> = {
  "frio-agitada": {
    status: "done",
    origem: "agente",
    etapas: [
      "llm",
      "tool:clima.agora:ok",
      "llm",
      "tool:casa.ler:ok",
      "llm",
      "tool:ayurveda.checar_combinacao:ok",
      "llm",
      "validacao:finalizar:ok",
    ],
  },
  "pergunta-manga": {
    status: "done",
    origem: "agente",
    etapas: ["llm", "tool:ayurveda.alimento:ok", "llm", "validacao:finalizar:ok"],
  },
  autocorrecao: {
    status: "done",
    origem: "agente",
    etapas: [
      "llm",
      "tool:casa.ler:ok",
      "llm",
      "validacao:finalizar:recusado",
      "llm",
      "validacao:finalizar:ok",
    ],
  },
  "estomago-pesado": {
    status: "done",
    origem: "agente",
    etapas: ["llm", "tool:clima.agora:ok", "llm", "validacao:finalizar:ok"],
  },
  "sem-modelo": {
    status: "done",
    origem: "sem_modelo",
    etapas: [],
  },
}

function cenario(nome: string): Cenario {
  const c = cenarios[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

describe("trajetória: a tabela cobre os cinco cenários", () => {
  it("as chaves da tabela são as da demonstração", () => {
    expect(Object.keys(ESPERADAS).sort()).toEqual(Object.keys(cenarios).sort())
  })
})

describe("trajetória: cada cenário termina no status, na origem e nas etapas esperadas", () => {
  it.each(Object.keys(ESPERADAS))("%s", async (nome) => {
    const esperada = ESPERADAS[nome]
    if (!esperada) throw new Error(`sem trajetória para ${nome}`)
    const c = cenario(nome)
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)

    expect(r.status).toBe(esperada.status)
    expect(r.saida.origem).toBe(esperada.origem)
    expect(etapas.map(comoEtapa)).toEqual(esperada.etapas)
  })
})

describe("trajetória: casos de forma", () => {
  it("pergunta simples termina em 2 chamadas de modelo", async () => {
    const c = cenario("pergunta-manga")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)

    expect(etapas.filter((e) => e.tipo === "llm")).toHaveLength(2)
  })

  it("estômago pesado sai com os avisos incomodo e geral", async () => {
    const c = cenario("estomago-pesado")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const tipos = r.saida.avisos.map((a) => a.tipo)

    expect(tipos).toEqual(expect.arrayContaining(["incomodo", "geral"]))
  })

  it("frio e agitada sai com para_ter preenchido", async () => {
    const c = cenario("frio-agitada")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)

    expect(r.saida.para_ter).toBeDefined()
    expect(r.saida.para_ter?.alimento_id).toBe("cardamomo")
  })
})
