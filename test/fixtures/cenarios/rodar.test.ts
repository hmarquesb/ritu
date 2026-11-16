import { describe, expect, it, vi } from "vitest"
import { cenariosComAprovacao } from "./index"
import { montarCenario } from "./montar"
import { rodarCenario } from "./rodar"
import type { Cenario, Toque } from "./tipos"

const cha = {
  tipo: "cha" as const,
  pratica_id: "cha-gengibre-canela",
  alimentos: ["gengibre", "canela"],
  titulo: "Chá de gengibre com canela",
}

// Cenário de aprovação com toques acrescentados: o bloco é decidido como no próprio cenário.
function comToques(nome: "faltou-hoje" | "vegetariana", toques: Toque[]): Cenario {
  const c = cenariosComAprovacao[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  return { ...c, toques }
}

describe("rodarCenario: toques", () => {
  it("toque de gosto grava a preferência e a rodada registra o toque", async () => {
    const c = comToques("faltou-hoje", [
      { tipo: "gosto", item: { tipo: "alimento", id: "abobora" }, gosto: "gosta" },
    ])
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.toques).toEqual([{ tipo: "gosto" }])
    const [pref] = await deps.stores.preferences.ler(contaId, [{ tipo: "alimento", id: "abobora" }])
    expect(pref?.gosto).toBe("gosta")
  })

  it("toque de retorno na sugestão 0 fecha o retorno com origem toque", async () => {
    const c = comToques("faltou-hoje", [{ tipo: "retorno", sugestao: 0, resultado: "ajudou" }])
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const toque = rodada.toques?.[0]
    if (toque?.tipo !== "retorno") throw new Error("toque de retorno ausente")
    expect(toque.retorno.status).toBe("respondido")
    expect(toque.retorno.origem).toBe("toque")
    expect(toque.retorno.resultado).toBe("ajudou")
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes.some((r) => r.id === toque.retorno.id)).toBe(false)
  })

  it("toque semeado fecha o retorno semeado, pela posição em retornos", async () => {
    const base = cenariosComAprovacao["faltou-hoje"]
    if (!base) throw new Error("cenário ausente: faltou-hoje")
    const c: Cenario = {
      ...base,
      retornos: [{ sugestao: cha, diasAtras: 1 }],
      toques: [{ tipo: "retorno", sugestao: 0, semeado: true, resultado: "nao_ajudou" }],
    }
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const toque = rodada.toques?.[0]
    if (toque?.tipo !== "retorno") throw new Error("toque de retorno ausente")
    expect(toque.retorno.id).toBe(deps.retornosSemeados[0])
    expect(toque.retorno.resultado).toBe("nao_ajudou")
    expect(toque.retorno.origem).toBe("toque")
  })

  it("toque de retorno sem id na saída lança erro com o nome do cenário", async () => {
    const c = comToques("faltou-hoje", [{ tipo: "retorno", sugestao: 5, resultado: "ajudou" }])
    const { contaId, deps } = await montarCenario(c)
    await expect(rodarCenario(deps, contaId, c)).rejects.toThrow("faltou-hoje")
  })

  it("troca com resposta chama responderTroca com o candidato da pergunta", async () => {
    const c = comToques("faltou-hoje", [
      {
        tipo: "troca",
        sugestao: 0,
        alimento_id: "abobora",
        motivo: "trocar",
        resposta: "tenho",
      },
    ])
    const { contaId, deps } = await montarCenario(c)
    const trocar = vi.spyOn(deps.touches, "trocarIngrediente")
    const responder = vi.spyOn(deps.touches, "responderTroca")
    const rodada = await rodarCenario(deps, contaId, c)
    expect(trocar).toHaveBeenCalledTimes(1)
    const toque = rodada.toques?.[0]
    if (toque?.tipo !== "troca") throw new Error("toque de troca ausente")
    // Com a base real, a troca da abóbora pergunta por um candidato antes de trocar.
    if (toque.resultado.resultado !== "perguntar") throw new Error("a troca devia perguntar")
    expect(responder).toHaveBeenCalledWith(
      contaId,
      expect.objectContaining({
        candidato: toque.resultado.pergunta.alimento_id,
        resposta: "tenho",
      }),
    )
    expect(toque.resposta?.resultado).toBeDefined()
  })

  it("os toques rodam depois da aprovação e antes de depois", async () => {
    const c = comToques("vegetariana", [
      { tipo: "gosto", item: { tipo: "alimento", id: "abobora" }, gosto: "gosta" },
    ])
    const { contaId, deps } = await montarCenario(c)
    const conversar = vi.spyOn(deps.conversation, "conversar")
    const gosto = vi.spyOn(deps.touches, "tocarGosto")
    await rodarCenario(deps, contaId, c)
    expect(conversar).toHaveBeenCalledTimes(2)
    const [primeira, segunda] = conversar.mock.invocationCallOrder
    const [toque] = gosto.mock.invocationCallOrder
    expect(primeira).toBeLessThan(toque ?? 0)
    expect(toque ?? 0).toBeLessThan(segunda ?? 0)
  })

  it("sem toques, a rodada não tem a chave toques", async () => {
    const c = cenariosComAprovacao["faltou-hoje"]
    if (!c) throw new Error("cenário ausente: faltou-hoje")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect("toques" in rodada).toBe(false)
  })
})
