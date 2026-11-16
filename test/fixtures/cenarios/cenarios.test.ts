import { describe, expect, it } from "vitest"
import { preparar } from "@/core/agents/companion/preparo"
import { createContainer } from "@/infra/container"
import {
  cenarios,
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeConversa,
  montarCenario,
} from "./index"
import type { DepsDoCenario } from "./montar"
import { rodarCenario } from "./rodar"

const NOVOS_COM_PAUSA = Object.keys(cenariosComPausa)

// Preparo da mensagem "e no jantar?" (momento, sem estados): o mesmo que o Acompanhante roda na segunda mensagem.
function preparoDaSegunda(deps: DepsDoCenario, contaId: string) {
  return preparar(
    {
      stores: deps.stores,
      kb: createContainer().knowledge,
      clock: deps.clock,
      telemetry: deps.telemetry,
    },
    contaId,
    { intencoes: ["momento"], estados: [], evitar_da_mensagem: [] },
  )
}

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

describe("cenários com aprovação", () => {
  it("aprovacao-parcial tem casa e rotina no bloco, grava só a casa e não anota a rotina", async () => {
    const c = cenariosComAprovacao["aprovacao-parcial"]
    if (!c) throw new Error("cenário ausente: aprovacao-parcial")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.bloco?.propostas.map((p) => p.tool)).toEqual(["casa.propor", "memoria.propor"])
    expect(rodada.bloco?.aprovadas).toHaveLength(1)
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["casa.propor"])
    const itens = await deps.stores.pantry.listar(contaId)
    expect(itens.some((i) => i.alimento_id === "abobora")).toBe(true)
    expect(await deps.stores.routine.notasAtivas(contaId)).toEqual([])
  })

  it("faltou-hoje pausa pela casa e põe o gengibre na lista depois de aprovar", async () => {
    const c = cenariosComAprovacao["faltou-hoje"]
    if (!c) throw new Error("cenário ausente: faltou-hoje")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.perguntas).toHaveLength(1)
    const textos = rodada.bloco?.propostas.map((p) => p.texto) ?? []
    expect(textos).toHaveLength(1)
    expect(textos[0]?.startsWith('Gengibre na lista "Para ter em casa" (faltou para ')).toBe(true)
    const lista = await deps.stores.shortages.lista(contaId)
    expect(lista.map((i) => i.alimento_id)).toEqual(["gengibre"])
  })

  it("vegetariana: Agora não não grava a restrição e a segunda mensagem sai sem o que ela barra", async () => {
    const c = cenariosComAprovacao.vegetariana
    if (!c) throw new Error("cenário ausente: vegetariana")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.bloco?.propostas.map((p) => p.texto)).toEqual(["Sua alimentação é vegetariana"])
    expect(rodada.bloco?.aprovadas).toEqual([])
    const perfil = await deps.stores.profiles.ler(contaId)
    expect(perfil.restricoes).toEqual([])
    expect(rodada.depois?.final.status).toBe("done")
    // A restrição de hoje está na lista do dia, que a primeira mensagem gravou; o preparo da segunda a lê.
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.filtro.restricoes).toContain("vegetariana")
    expect(dados.candidatos.length).toBeGreaterThan(0)
  })

  it("vegetariana: antes da primeira mensagem, o preparo não traz a restrição do dia (controle)", async () => {
    const c = cenariosComAprovacao.vegetariana
    if (!c) throw new Error("cenário ausente: vegetariana")
    const { contaId, deps } = await montarCenario(c)
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.filtro.restricoes).not.toContain("vegetariana")
  })

  it("casa-sozinha aprova o bloco e Minha casa tem abóbora, couve e pitaia", async () => {
    const c = cenariosDeConversa["casa-sozinha"]
    if (!c) throw new Error("cenário ausente: casa-sozinha")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.bloco?.resultado.gravadas).toHaveLength(1)
    const itens = await deps.stores.pantry.listar(contaId)
    const ids = itens.map((i) => i.alimento_id)
    expect(ids).toEqual(expect.arrayContaining(["abobora", "couve"]))
    expect(itens.some((i) => i.nome_livre === "pitaia")).toBe(true)
  })

  it("o registro de aprovação tem os três novos e a conversa segue com sete", () => {
    expect(Object.keys(cenariosComAprovacao).sort()).toEqual([
      "aprovacao-parcial",
      "faltou-hoje",
      "vegetariana",
    ])
    expect(Object.keys(cenariosDeConversa)).toHaveLength(7)
  })
})
