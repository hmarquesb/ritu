import { describe, expect, it } from "vitest"
import { textosDaConversa } from "@/core/conversation/textos"
import { mensagensParaOPrompt } from "@/core/messages/para-o-prompt"
import type { Mensagem } from "@/core/messages/ports"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com, conteudoDaPessoa } from "./apoio"

type Entrada = { entrada: string }

async function montar(c: CenarioDeConversa, respostas: unknown[]) {
  const llm = createFakeLlm(respostas)
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  return { contaId, deps, llm, runtime }
}

// O bloco de conversa do dia que o Intérprete recebeu numa chamada.
function conversaDoDia(entrada: string): string {
  const bloco = entrada.match(/<conversa_do_dia>\n([\s\S]*?)\n<\/conversa_do_dia>/)
  return bloco?.[1] ?? ""
}

describe("gravação dos dois lados em todos os caminhos", () => {
  const casos: [string, CenarioDeConversa][] = [
    ["acompanhante", cenario("duas-intencoes")],
    ["casa", cenario("casa-sozinha")],
    ["evitar", cenario("evitar-sozinho")],
    ["retorno", cenario("retorno-conversa")],
    ["alerta", cenario("alerta-emocional")],
    ["ofensa", cenario("ofensa")],
    ["ajuda", com(cenario("ofensa"), "o que você guarda sobre mim?", { intencoes: ["ajuda"] })],
    ["fora", com(cenario("so-atalhos"), "qual a capital da França?", { intencoes: ["fora"] })],
  ]

  it.each(casos)("caminho %s: a pessoa e o agente ficam gravados no run", async (_, c) => {
    const { contaId, deps } = await montar(c, c.interpretacao ? [c.interpretacao] : [])
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const doRun = (await deps.stores.messages.doDia(contaId, "2026-06-15")).filter(
      (m) => m.run_id === resposta.run_id,
    )

    expect(doRun.find((m) => m.autor === "pessoa")?.texto).toContain(c.mensagem.texto ?? "")
    expect(doRun.find((m) => m.autor === "agente")?.texto).toBe(resposta.saida?.resposta)
  })
})

describe("com_incomodo: as duas mensagens do run marcadas com incômodo e com alerta", () => {
  it("incômodo citado no Acompanhante marca a pessoa e o agente", async () => {
    const c = com(cenario("so-atalhos"), "estou com dor de cabeça", {
      intencoes: ["momento"],
      estados: ["com_frio"],
      incomodo: { id: "dor-de-cabeca" },
    })
    const { contaId, deps } = await montar(c, [c.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const doRun = (await deps.stores.messages.doDia(contaId, "2026-06-15")).filter(
      (m) => m.run_id === resposta.run_id,
    )

    expect(doRun).toHaveLength(2)
    expect(doRun.every((m) => m.com_incomodo)).toBe(true)
  })

  it("alerta marca a pessoa e o agente", async () => {
    const c = cenario("alerta-emocional")
    const { contaId, deps } = await montar(c, [c.interpretacao])
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)
    const doRun = (await deps.stores.messages.doDia(contaId, "2026-06-15")).filter(
      (m) => m.run_id === resposta.run_id,
    )

    expect(doRun).toHaveLength(2)
    expect(doRun.every((m) => m.com_incomodo)).toBe(true)
  })

  it.each(["casa-sozinha", "ofensa"])(
    "controle: %s sem incômodo deixa as duas sem marca",
    async (nome) => {
      const c = cenario(nome)
      const { contaId, deps } = await montar(c, [c.interpretacao])
      const resposta = await deps.conversation.conversar(contaId, c.mensagem)
      const doRun = (await deps.stores.messages.doDia(contaId, "2026-06-15")).filter(
        (m) => m.run_id === resposta.run_id,
      )

      expect(doRun.length).toBeGreaterThan(0)
      expect(doRun.some((m) => m.com_incomodo)).toBe(false)
    },
  )
})

describe("mensagensParaOPrompt: sem o run atual, nem alerta, fora ou ofensa", () => {
  const mensagem = (
    texto: string,
    run_id: string | null,
    autor: "pessoa" | "agente" = "pessoa",
  ): Mensagem => ({
    id: texto,
    conta_id: "conta",
    run_id,
    autor,
    texto,
    com_incomodo: false,
    dia: "2026-06-15",
    criado_em: "2026-06-15T18:00:00.000Z",
  })

  const mensagens = [
    mensagem("da casa", "r-casa"),
    mensagem("do alerta", "r-alerta"),
    mensagem("da fora", "r-fora", "agente"),
    mensagem("da ofensa", "r-ofensa"),
    mensagem("da evitar", "r-evitar"),
    mensagem("do atual", "r-atual"),
    mensagem("sem run", null),
  ]
  const runs = [
    { id: "r-casa", caminho: "casa" as const },
    { id: "r-alerta", caminho: "alerta" as const },
    { id: "r-fora", caminho: "fora" as const },
    { id: "r-ofensa", caminho: "ofensa" as const },
    { id: "r-evitar", caminho: "evitar" as const },
    { id: "r-atual", caminho: "acompanhante" as const },
  ]

  it("tira o run atual e os de alerta, fora e ofensa; mantém os demais e as sem run", () => {
    const textos = mensagensParaOPrompt({
      mensagens,
      runs,
      runAtualId: "r-atual",
      limite: 10,
    }).map((m) => m.texto)

    expect(textos).toEqual(["da casa", "da evitar", "sem run"])
  })

  it("devolve só as últimas do limite, em ordem", () => {
    const textos = mensagensParaOPrompt({
      mensagens,
      runs,
      runAtualId: "r-atual",
      limite: 2,
    }).map((m) => m.texto)

    expect(textos).toEqual(["da evitar", "sem run"])
  })
})

describe("mensagensParaOPrompt no Intérprete: a conversa anterior sem alerta, fora nem ofensa", () => {
  it("a casa entra na conversa do dia; alerta, fora, ofensa e o run atual não entram", async () => {
    const casa = com(cenario("casa-sozinha"), "comprei couve", {
      intencoes: ["casa"],
      itens_casa: [{ nome: "couve", acao: "tem" }],
    })
    const alerta = cenario("alerta-emocional")
    const ofensa = cenario("ofensa")
    const fora = com(cenario("so-atalhos"), "qual a capital da França?", { intencoes: ["fora"] })
    const ajuda = com(cenario("ofensa"), "o que você guarda sobre mim?", { intencoes: ["ajuda"] })
    const { contaId, deps, llm } = await montar(casa, [
      casa.interpretacao,
      alerta.interpretacao,
      ofensa.interpretacao,
      fora.interpretacao,
      ajuda.interpretacao,
    ])

    await deps.conversation.conversar(contaId, casa.mensagem)
    await deps.conversation.conversar(contaId, alerta.mensagem)
    await deps.conversation.conversar(contaId, ofensa.mensagem)
    await deps.conversation.conversar(contaId, fora.mensagem)
    await deps.conversation.conversar(contaId, ajuda.mensagem)

    const pedidos = llm.pedidos as Entrada[]
    const primeiro = conversaDoDia(pedidos[0]?.entrada ?? "")
    const ultimo = conversaDoDia(pedidos[4]?.entrada ?? "")

    expect(primeiro).not.toContain("comprei couve")
    expect(ultimo).toContain("comprei couve")
    expect(ultimo).not.toContain(alerta.mensagem.texto ?? "")
    expect(ultimo).not.toContain(textosDaConversa.alertaEmocional)
    expect(ultimo).not.toContain(ofensa.mensagem.texto ?? "")
    expect(ultimo).not.toContain(textosDaConversa.ofensa)
    expect(ultimo).not.toContain(fora.mensagem.texto ?? "")
    expect(ultimo).not.toContain(textosDaConversa.fora)
  })
})

describe("< e > viram ‹ e › nos prompts do Intérprete e do Acompanhante", () => {
  it("o texto da pessoa chega neutralizado ao Intérprete e ao Acompanhante", async () => {
    const c = com(cenario("so-atalhos"), "<script>estou com frio</script>", {
      intencoes: ["momento"],
      estados: ["com_frio"],
    })
    const { contaId, deps, llm, runtime } = await montar(c, [c.interpretacao])
    await deps.conversation.conversar(contaId, c.mensagem)

    const entrada = (llm.pedidos as Entrada[])[0]?.entrada ?? ""
    expect(entrada).toContain("‹script›estou com frio‹/script›")
    expect(entrada).not.toContain("<script>")

    const pessoa = conteudoDaPessoa(runtime)
    expect(pessoa).toContain("‹script›estou com frio‹/script›")
    expect(pessoa).not.toContain("<script>")
  })

  it("a conversa do dia também sai neutralizada no prompt seguinte", async () => {
    const casa = com(cenario("casa-sozinha"), "<i>fui à feira</i>", {
      intencoes: ["casa"],
      itens_casa: [],
    })
    const ofensa = com(cenario("ofensa"), "você é inútil", { intencoes: ["ofensa"] })
    const { contaId, deps, llm } = await montar(casa, [casa.interpretacao, ofensa.interpretacao])
    await deps.conversation.conversar(contaId, casa.mensagem)
    await deps.conversation.conversar(contaId, ofensa.mensagem)

    const seguinte = (llm.pedidos as Entrada[])[1]?.entrada ?? ""
    expect(conversaDoDia(seguinte)).toContain("‹i›fui à feira‹/i›")
    expect(seguinte).not.toContain("<i>")
  })
})
