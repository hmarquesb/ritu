import { describe, expect, it } from "vitest"
import { cenarios, cenariosComPausa, cenariosDeConversa, montarCenario } from "./index"
import { rodarCenario } from "./rodar"

const NOVOS_COM_PAUSA = Object.keys(cenariosComPausa)

async function rodarNovo(nome: string) {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { ...rodada, contaId, deps, c }
}

const origens: Record<string, "agente" | "sem_modelo"> = {
  "frio-agitada": "agente",
  "pergunta-manga": "agente",
  autocorrecao: "agente",
  "estomago-pesado": "agente",
  "sem-modelo": "sem_modelo",
}

describe("cenários de demonstração", () => {
  it.each(Object.keys(cenarios))("%s termina em done com a origem esperada", async (nome) => {
    const c = cenarios[nome]
    if (!c) throw new Error(`cenário ausente: ${nome}`)
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    expect(r.status).toBe("done")
    expect(r.saida?.origem).toBe(origens[nome])
  })

  it("frio-agitada com o principal de decisao esgotado troca de modelo e termina em done", async () => {
    const c = cenarios["frio-agitada"]
    if (!c) throw new Error("cenário ausente: frio-agitada")
    const { contaId, deps } = await montarCenario(c, { esgotar: "decisao" })
    const r = await deps.companion.responder(contaId, c.entrada)
    expect(r.status).toBe("done")
    expect(r.saida?.origem).toBe("agente")
    const run = await deps.stores.runs.buscar(contaId, r.run_id)
    expect(run?.trocas_de_modelo).toBeGreaterThanOrEqual(1)
  })

  it("autocorrecao tem duas etapas de validação: recusada e depois ok", async () => {
    const c = cenarios.autocorrecao
    if (!c) throw new Error("cenário ausente: autocorrecao")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    const validacoes = etapas.filter((e) => e.tipo === "validacao")
    expect(validacoes.map((e) => e.status)).toEqual(["recusado", "ok"])
  })
})

// Cenários cujas anotações viram proposta: o run termina esperando a aprovação.
const COM_BLOCO_DE_APROVACAO = ["casa-sozinha", "evitar-sozinho", "duas-intencoes"]

describe("cenários com pausa", () => {
  it.each(NOVOS_COM_PAUSA)("%s roda até done com origem do agente", async (nome) => {
    const { final } = await rodarNovo(nome)
    expect(final.status).toBe("done")
    expect(final.saida?.origem).toBe("agente")
  })

  it("casa-incerta pausa uma vez pela abóbora e pela couve", async () => {
    const { perguntas } = await rodarNovo("casa-incerta")
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]?.pergunta.tipo).toBe("casa")
    expect(perguntas[0]?.pergunta.texto).toBe("Ainda tem abóbora e couve?")
  })

  it("casa-vazia pausa uma vez com a pergunta da casa sobre os 5 itens", async () => {
    const { perguntas } = await rodarNovo("casa-vazia")
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]?.pergunta.texto).toBe(
      "Você tem mandioca, batata-doce, inhame, ghee e azeite em casa?",
    )
  })

  it("dor-de-cabeca pausa uma vez pela variante, por código", async () => {
    const { perguntas } = await rodarNovo("dor-de-cabeca")
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]?.pergunta.tipo).toBe("variante")
    expect(perguntas[0]?.pergunta.texto).toBe("Como está essa dor de cabeça?")
  })

  it("pergunta-recusada não pausa e recusa o ask_user por já confirmado", async () => {
    const { perguntas, final, contaId, deps } = await rodarNovo("pergunta-recusada")
    expect(perguntas).toHaveLength(0)
    const etapas = await deps.stores.runs.etapas(contaId, final.run_id)
    const recusas = etapas.filter((e) => e.tipo === "validacao" && e.nome === "ask_user")
    expect(recusas.map((e) => e.status)).toEqual(["recusado"])
  })

  it("cenários de conversa anteriores continuam terminando em done sem pausa", async () => {
    const anteriores = Object.keys(cenariosDeConversa).filter((n) => !NOVOS_COM_PAUSA.includes(n))
    expect(anteriores).toHaveLength(7)
    for (const nome of anteriores) {
      const c = cenariosDeConversa[nome]
      if (!c) throw new Error(`cenário ausente: ${nome}`)
      const { contaId, deps } = await montarCenario(c)
      const rodada = await rodarCenario(deps, contaId, c)
      expect(rodada.final.status, nome).toBe(
        COM_BLOCO_DE_APROVACAO.includes(nome) ? "waiting_for_approval" : "done",
      )
      expect(rodada.perguntas, nome).toHaveLength(0)
    }
  })
})
