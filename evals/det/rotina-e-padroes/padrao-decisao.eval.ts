import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import { apagarPadrao, decidirPadrao } from "@/core/patterns/decidir"
import type { PedidoDePasso } from "@/core/runs/agent-runtime"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario, rodarCenario } from "../../../test/fixtures/cenarios"
import { padraoAgoraNao } from "../../../test/fixtures/cenarios/padrao-agora-nao"
import { padraoConfirmado } from "../../../test/fixtures/cenarios/padrao-confirmado"
import { padraoRecusado } from "../../../test/fixtures/cenarios/padrao-recusado"
import type { Cenario } from "../../../test/fixtures/cenarios/tipos"

// A decisão do padrão no bloco: sim confirma e a frase chega ao contexto; linha desligada com outra ligada recusa; "Agora não",
// expiração e mensagem nova deixam candidato; decidirPadrao e apagarPadrao só aceitam padrão candidato da própria conta.

const CHAVE = "com_frio+agitada|pratica:cha-gengibre-canela"
const FRASE = "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar."
const AGORA = "2026-11-15T18:00:00.000Z"

type Contexto = { padroes?: string[] }

// O contexto que vai na primeira mensagem de cada passo do Acompanhante (o mesmo que o eval de nota como dado lê).
function contextoDo(pedido: PedidoDePasso | undefined): Contexto | undefined {
  const mensagem = pedido?.mensagens[0]
  const conteudo = mensagem && mensagem.papel === "pessoa" ? mensagem.conteudo : ""
  const m = /^<contexto>\n([\s\S]*)\n<\/contexto>/.exec(conteudo)
  return m ? (JSON.parse(m[1] ?? "") as Contexto) : undefined
}

// Runtime com o roteiro da primeira mensagem e, se houver, o da segunda.
function roteiroCompleto(c: Cenario) {
  return createScriptedRuntime([...c.roteiro, ...(c.depois?.roteiro ?? [])])
}

describe("decisão do padrão: sim confirma e a frase chega ao contexto", () => {
  it("aprovada a linha do padrão, ele fica confirmado e a frase vai ao contexto da segunda mensagem", async () => {
    const c = padraoConfirmado
    const runtime = roteiroCompleto(c)
    const { contaId, deps } = await montarCenario(c, { runtime })

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.bloco?.resultado.gravadas.map((g) => g.tool)).toEqual(["padrao.confirmar"])
    const confirmados = await deps.stores.patterns.listar(contaId, "confirmado")
    expect(confirmados.map((p) => [p.chave, p.frase])).toEqual([[CHAVE, FRASE]])

    const primeiroDaSegunda = runtime.pedidos[c.roteiro.length]
    expect(contextoDo(primeiroDaSegunda)?.padroes).toEqual([FRASE])
    expect(contextoDo(runtime.pedidos[0])?.padroes ?? []).toEqual([])
  })
})

describe("decisão do padrão: a linha desligada", () => {
  it("com outra linha ligada, a linha do padrão desligada recusa o padrão", async () => {
    const c = { ...padraoRecusado }
    const { contaId, deps } = await montarCenario(c)

    const rodada = await rodarCenario(deps, contaId, c)

    const padrao = rodada.bloco?.propostas.find((p) => p.tool === "padrao.confirmar")
    expect(padrao).toBeDefined()
    expect(rodada.bloco?.resultado.recusadas).toEqual([padrao?.id])
    expect((await deps.stores.patterns.listar(contaId, "recusado")).map((p) => p.chave)).toEqual([
      CHAVE,
    ])
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toEqual([])
  })

  it("sozinha no bloco, desligada, o padrão segue candidato (nada foi ligado junto)", async () => {
    const c = { ...padraoConfirmado, aprovacao: undefined, depois: undefined }
    const { contaId, deps } = await montarCenario(c)

    const rodada = await rodarCenario(deps, contaId, c, { decidir: async () => [] })

    expect(rodada.bloco?.aprovadas).toEqual([])
    expect(await deps.stores.patterns.listar(contaId, "recusado")).toEqual([])
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })
})

describe("decisão do padrão: Agora não, expiração e mensagem nova deixam candidato", () => {
  it("Agora não deixa o padrão candidato, e a segunda mensagem do dia não o traz de volta", async () => {
    const c = padraoAgoraNao
    const { contaId, deps } = await montarCenario(c)

    const rodada = await rodarCenario(deps, contaId, c)

    expect(rodada.bloco?.aprovadas).toEqual([])
    expect(await deps.stores.patterns.listar(contaId, "confirmado")).toEqual([])
    expect(await deps.stores.patterns.listar(contaId, "recusado")).toEqual([])
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
    expect(rodada.depois?.final.status).toBe("done")
    const tools = rodada.depois?.final.saida?.propostas.map((p) => p.tool) ?? []
    expect(tools).not.toContain("padrao.confirmar")
  })

  it("expirada a aprovação, a proposta vai a expirada e o padrão segue candidato", async () => {
    const c = { ...padraoConfirmado, aprovacao: undefined, depois: undefined }
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    const ids = (rodada.final.saida?.propostas ?? []).map((p) => p.id)

    const esperaMs = config.memoria.esperaMinutos * 60_000
    deps.clock.set(new Date(deps.clock.now().getTime() + esperaMs + 1000).toISOString())

    await expect(
      deps.conversation.aprovar(contaId, rodada.final.run_id, ids),
    ).rejects.toMatchObject({ code: "aprovacao_expirada" })
    const doRun = await deps.stores.proposals.doRun(contaId, rodada.final.run_id)
    expect(doRun.map((p) => [p.tool, p.decisao])).toEqual([["padrao.confirmar", "expirada"]])
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })

  it("uma mensagem nova com o bloco aberto expira a proposta, e o padrão segue candidato", async () => {
    const c = { ...padraoConfirmado, aprovacao: undefined }
    const runtime = roteiroCompleto(c)
    const { contaId, deps } = await montarCenario(c, { runtime })

    const rodada = await rodarCenario(deps, contaId, c)

    const doPrimeiro = await deps.stores.proposals.doRun(contaId, rodada.final.run_id)
    expect(doPrimeiro.map((p) => [p.tool, p.decisao])).toEqual([["padrao.confirmar", "expirada"]])
    expect(await deps.stores.patterns.listar(contaId, "confirmado")).toEqual([])
    expect(await deps.stores.patterns.listar(contaId, "candidato")).toHaveLength(1)
  })
})

describe("decidirPadrao e apagarPadrao: só padrão candidato da própria conta", () => {
  // Um padrão da conta c1 e outro da c2, ambos candidatos.
  function montar() {
    const clock = createFixedClock(AGORA)
    const stores = createMemoryStores(clock)
    const telemetry = createMemoryTelemetry()
    return { stores, telemetry }
  }

  async function candidatos(m: ReturnType<typeof montar>) {
    const meu = await m.stores.patterns.propor("c1", {
      tipo: "estados_juntos",
      chave: "com_frio>agitada",
      frase: "Quando você está com frio, costuma estar também agitada.",
      ocorrencias: 3,
    })
    const alheio = await m.stores.patterns.propor("c2", {
      tipo: "estados_juntos",
      chave: "pesada>seca",
      frase: "Quando você está pesada, costuma estar também seca.",
      ocorrencias: 3,
    })
    if (!meu || !alheio) throw new Error("padrão não criado")
    return { meu, alheio }
  }

  it("decidir: id inexistente é padrao_invalido", async () => {
    const m = montar()
    await candidatos(m)

    await expect(
      decidirPadrao({ stores: m.stores, telemetry: m.telemetry }, "c1", "nao-existe", "confirmado"),
    ).rejects.toMatchObject({ code: "padrao_invalido" })
  })

  it("decidir: padrão de outra conta é padrao_invalido, e o da outra conta segue candidato", async () => {
    const m = montar()
    const { alheio } = await candidatos(m)

    await expect(
      decidirPadrao({ stores: m.stores, telemetry: m.telemetry }, "c1", alheio.id, "confirmado"),
    ).rejects.toMatchObject({ code: "padrao_invalido" })
    expect((await m.stores.patterns.listar("c2", "candidato")).map((p) => p.id)).toEqual([
      alheio.id,
    ])
  })

  it("decidir: padrão já decidido é padrao_invalido, e a decisão anterior fica", async () => {
    const m = montar()
    const { meu } = await candidatos(m)
    await decidirPadrao({ stores: m.stores, telemetry: m.telemetry }, "c1", meu.id, "confirmado")

    await expect(
      decidirPadrao({ stores: m.stores, telemetry: m.telemetry }, "c1", meu.id, "recusado"),
    ).rejects.toMatchObject({ code: "padrao_invalido" })
    expect((await m.stores.patterns.listar("c1", "confirmado")).map((p) => p.id)).toEqual([meu.id])
  })

  it("decidir: candidato da própria conta recusa com sucesso", async () => {
    const m = montar()
    const { meu } = await candidatos(m)

    await decidirPadrao({ stores: m.stores, telemetry: m.telemetry }, "c1", meu.id, "recusado")

    expect((await m.stores.patterns.listar("c1", "recusado")).map((p) => p.id)).toEqual([meu.id])
  })

  it("apagar: id inexistente é padrao_invalido", async () => {
    const m = montar()
    await candidatos(m)

    await expect(apagarPadrao({ stores: m.stores }, "c1", "nao-existe")).rejects.toMatchObject({
      code: "padrao_invalido",
    })
  })

  it("apagar: padrão de outra conta é padrao_invalido, e o da outra conta fica", async () => {
    const m = montar()
    const { alheio } = await candidatos(m)

    await expect(apagarPadrao({ stores: m.stores }, "c1", alheio.id)).rejects.toMatchObject({
      code: "padrao_invalido",
    })
    expect(await m.stores.patterns.listar("c2")).toHaveLength(1)
  })

  it("apagar: padrão da própria conta some", async () => {
    const m = montar()
    const { meu } = await candidatos(m)

    await apagarPadrao({ stores: m.stores }, "c1", meu.id)

    expect(await m.stores.patterns.listar("c1")).toEqual([])
    expect(await m.stores.patterns.listar("c2")).toHaveLength(1)
  })
})
