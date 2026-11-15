import { describe, expect, it } from "vitest"
import type { PedidoDePasso } from "@/core/runs/agent-runtime"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com } from "./apoio"

type ItemLido = { alimento_id: string | null; nome: string; estado: string }

// O que o casa.ler devolveu ao Acompanhante: vem no último pedido, como resultado de tool.
function casaLida(pedidos: PedidoDePasso[]): ItemLido[] {
  const chamada = pedidos.at(-1)?.mensagens.find((m) => m.papel === "tool" && m.nome === "casa.ler")
  if (chamada?.papel !== "tool") return []
  const resultado = chamada.resultado as { itens?: ItemLido[] }
  return resultado.itens ?? []
}

async function rodar(c: CenarioDeConversa) {
  const llm = createFakeLlm(c.interpretacao ? [c.interpretacao] : [])
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  const naCasa = await deps.stores.pantry.listar(contaId)
  return { resposta, run, runtime, naCasa }
}

describe("casa da mensagem: 'tem' vale no run, sem gravar em Minha casa", () => {
  it("o item que chegou aparece confirmado para o Acompanhante, e a despensa não muda", async () => {
    const c = cenario("duas-intencoes")
    const { runtime, naCasa } = await rodar(c)
    const lidos = casaLida(runtime.pedidos)

    expect(lidos).toContainEqual(
      expect.objectContaining({ alimento_id: "abobora", estado: "confirmado" }),
    )
    expect(naCasa.map((i) => i.alimento_id)).not.toContain("abobora")
    expect(naCasa).toHaveLength(c.casa.length)
  })
})

describe("casa da mensagem: 'acabou' sai de confirmados e de incertos", () => {
  it("o item que acabou não aparece na casa lida, e a despensa continua com ele", async () => {
    // so-atalhos traz a casa com abóbora e o roteiro com casa.ler.
    const c = com(cenario("so-atalhos"), "acabou a abóbora, o que faço hoje?", {
      intencoes: ["casa", "momento"],
      itens_casa: [{ nome: "abóbora", acao: "acabou" }],
    })
    const { runtime, naCasa } = await rodar(c)
    const lidos = casaLida(runtime.pedidos)

    expect(lidos.length).toBeGreaterThan(0)
    expect(lidos.filter((i) => i.alimento_id === "abobora")).toEqual([])
    expect(naCasa.map((i) => i.alimento_id)).toContain("abobora")
  })
})

describe("casa da mensagem: item em 'evitar sempre' não entra em confirmados", () => {
  it("a abóbora da mensagem fica de fora da casa lida quando está em evitar sempre", async () => {
    const base = cenario("duas-intencoes")
    const c = com(
      {
        ...base,
        perfil: { ...base.perfil, evitar_sempre: [{ tipo: "alimento", valor: "abobora" }] },
      },
      "comprei abóbora, o que faço hoje?",
      { intencoes: ["casa", "momento"], itens_casa: [{ nome: "abóbora", acao: "tem" }] },
    )
    const { runtime, naCasa } = await rodar(c)

    expect(casaLida(runtime.pedidos).length).toBeGreaterThan(0)
    expect(casaLida(runtime.pedidos).filter((i) => i.alimento_id === "abobora")).toEqual([])
    expect(naCasa.map((i) => i.alimento_id)).not.toContain("abobora")
  })
})

describe("casa da mensagem: item desconhecido fica só na anotação", () => {
  it("a pitaia, fora da base, vai na anotação sem id e não entra na despensa", async () => {
    const { resposta, naCasa } = await rodar(cenario("casa-sozinha"))
    const anotado = resposta.saida.anotacoes.find((a) => a.tipo === "casa_tem")
    const pitaia = anotado?.itens.find((i) => i.nome === "pitaia")

    expect(pitaia).toBeDefined()
    expect(pitaia?.alimento_id).toBeUndefined()
    expect(naCasa.some((i) => i.nome_livre === "pitaia")).toBe(false)
    expect(naCasa).toHaveLength(cenario("casa-sozinha").casa.length)
  })
})
