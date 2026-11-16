import { describe, expect, it } from "vitest"
import type { Caminho } from "@/core/runs/ports"
import { diaLocal } from "@/core/time/dia-local"
import { cenariosDeConversa } from "./index"
import { montarCenario } from "./montar"
import type { Cenario } from "./tipos"

const AGORA = "2026-06-15T22:00:00.000Z"

const cha = {
  tipo: "cha" as const,
  pratica_id: "cha-gengibre-canela",
  alimentos: ["gengibre", "canela"],
  titulo: "Chá de gengibre com canela",
}

const refeicao = {
  tipo: "refeicao" as const,
  preparo_id: "arroz-com-legume",
  alimentos: ["arroz-branco", "abobora"],
  titulo: "Arroz bem cozido com abóbora e ghee",
}

const base: Omit<Cenario, "nome" | "descricao"> = {
  agora: AGORA,
  perfil: {},
  casa: [],
  roteiro: [],
  mensagem: { texto: "oi", atalhos: [] },
}

describe("montarCenario: retornos e mensagens anteriores", () => {
  it("cria os retornos aguardando e o mais recente fica na frente", async () => {
    const c: Cenario = {
      ...base,
      nome: "retornos",
      descricao: "dois retornos",
      retornos: [
        { sugestao: refeicao, diasAtras: 2 },
        { sugestao: cha, diasAtras: 0 },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes.map((r) => r.sugestao.titulo)).toEqual([cha.titulo, refeicao.titulo])
    expect(pendentes.every((r) => r.status === "aguardando")).toBe(true)
  })

  it("grava as mensagens anteriores no dia, com o caminho de cada run", async () => {
    const c: Cenario = {
      ...base,
      nome: "mensagens",
      descricao: "duas mensagens",
      mensagens: [
        { autor: "pessoa", texto: "oi" },
        { autor: "agente", texto: "olá", caminho: "ofensa" },
      ],
    }
    const { contaId, deps } = await montarCenario(c)
    const dia = diaLocal(new Date(AGORA))
    const doDia = await deps.stores.messages.doDia(contaId, dia)
    expect(doDia.map((m) => [m.autor, m.texto])).toEqual([
      ["pessoa", "oi"],
      ["agente", "olá"],
    ])
    const caminhos: (Caminho | undefined)[] = []
    for (const m of doDia) {
      const run = m.run_id ? await deps.stores.runs.buscar(contaId, m.run_id) : undefined
      expect(run?.status).toBe("done")
      caminhos.push(run?.caminho)
    }
    expect(caminhos).toEqual(["acompanhante", "ofensa"])
  })

  it("sem entrada e sem mensagem, lança erro", async () => {
    const c: Cenario = {
      nome: "vazio",
      descricao: "sem nada",
      agora: AGORA,
      perfil: {},
      casa: [],
      roteiro: [],
    }
    await expect(montarCenario(c)).rejects.toThrow()
  })
})

describe("cenários de conversa", () => {
  const esperados: Record<string, Caminho> = {
    "casa-sozinha": "casa",
    "retorno-conversa": "retorno",
    "evitar-sozinho": "evitar",
    "alerta-emocional": "alerta",
    ofensa: "ofensa",
    "duas-intencoes": "acompanhante",
    "so-atalhos": "acompanhante",
  }

  it("são os sete da lista", () => {
    expect(Object.keys(cenariosDeConversa).sort()).toEqual(Object.keys(esperados).sort())
  })

  it.each(Object.keys(esperados))("%s termina pelo caminho da tabela", async (nome) => {
    const c = cenariosDeConversa[nome]
    if (!c?.mensagem) throw new Error(`cenário sem mensagem: ${nome}`)
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.conversation.conversar(contaId, c.mensagem)
    const comBloco = ["casa-sozinha", "evitar-sozinho", "duas-intencoes"].includes(nome)
    expect(r.status).toBe(comBloco ? "waiting_for_approval" : "done")
    expect(r.caminho).toBe(esperados[nome])
  })

  it("duas-intencoes e so-atalhos chegam ao Acompanhante e a resposta vem do agente", async () => {
    for (const nome of ["duas-intencoes", "so-atalhos"]) {
      const c = cenariosDeConversa[nome]
      if (!c?.mensagem) throw new Error(`cenário sem mensagem: ${nome}`)
      const { contaId, deps } = await montarCenario(c)
      const r = await deps.conversation.conversar(contaId, c.mensagem)
      expect(r.saida?.origem).toBe("agente")
    }
  })

  it("retorno-conversa fecha o chá, que é o pendente 1", async () => {
    const c = cenariosDeConversa["retorno-conversa"]
    if (!c?.mensagem) throw new Error("cenário sem mensagem: retorno-conversa")
    const { contaId, deps } = await montarCenario(c)
    await deps.conversation.conversar(contaId, c.mensagem)
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes.map((r) => r.sugestao.titulo)).toEqual([refeicao.titulo])
  })
})
