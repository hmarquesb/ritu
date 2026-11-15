import { loop } from "@config/loop"
import { describe, expect, it } from "vitest"
import { type Cenario, cenarios, montarCenario } from "../../../test/fixtures/cenarios"

function cenario(nome: string): Cenario {
  const c = cenarios[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return c
}

// Entrega com uma prática que não existe na base: o validador recusa (fora_da_base).
const entregaRecusada: Cenario["roteiro"][number] = {
  texto: "Vou montar a resposta com o chá.",
  chamadas: [
    {
      nome: "finalizar",
      argumentos: {
        resposta: "Um chá de hortelã morno ajuda a refrescar agora.",
        explicacao: { qualidades_do_momento: ["quente"], qualidades_buscadas: ["frio"] },
        sugestoes: [
          {
            tipo: "cha",
            pratica_id: "cha-inexistente",
            itens: [
              { alimento_id: "hortela", contribui: ["frio"], linha_base: "alimentos:hortela" },
            ],
            motivo: "Refresca o corpo quando há calor.",
            linhas_base: ["praticas:cha-inexistente"],
            novidade: false,
          },
        ],
        evitar: [],
        incertos: [],
        citados: [],
      },
    },
  ],
}

const passoDeClima: Cenario["roteiro"][number] = {
  texto: "Vou ver o clima antes de responder.",
  chamadas: [{ nome: "clima.agora", argumentos: {} }],
}

describe("entrega: violação, correção e entrega", () => {
  it("a primeira entrega é recusada, a correção é aceita e a pessoa recebe a versão corrigida", async () => {
    const c = cenario("autocorrecao")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)

    expect(etapas.filter((e) => e.tipo === "validacao").map((e) => e.status)).toEqual([
      "recusado",
      "ok",
    ])
    expect(r.status).toBe("done")
    expect(r.saida.origem).toBe("agente")
    expect(r.saida.sugestoes.flatMap((s) => s.itens.map((i) => i.alimento_id))).toEqual(["hortela"])
  })
})

describe("entrega: teto de recusas", () => {
  it("terceira recusa seguida vira resposta segura, sem sugestão", async () => {
    const c: Cenario = {
      ...cenario("autocorrecao"),
      roteiro: [entregaRecusada, entregaRecusada, entregaRecusada],
    }
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)

    expect(etapas.filter((e) => e.tipo === "validacao").map((e) => e.status)).toEqual([
      "recusado",
      "recusado",
      "recusado",
    ])
    expect(r.fim).toBe("limite")
    expect(r.motivo).toBe("validacao")
    expect(r.status).toBe("done")
    expect(r.saida.origem).toBe("segura")
    expect(r.saida.sugestoes).toEqual([])
  })
})

describe("entrega: teto de chamadas de modelo", () => {
  it("ao bater no limite de chamadas, a resposta sai segura", async () => {
    const c: Cenario = {
      ...cenario("pergunta-manga"),
      roteiro: Array.from({ length: loop.maxChamadasDeModelo }, () => passoDeClima),
    }
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)

    expect(etapas.filter((e) => e.tipo === "llm")).toHaveLength(loop.maxChamadasDeModelo)
    expect(r.fim).toBe("limite")
    expect(r.motivo).toBe("chamadas")
    expect(r.status).toBe("done")
    expect(r.saida.origem).toBe("segura")
  })
})
