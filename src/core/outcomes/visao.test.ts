import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Retorno } from "./ports"
import { retornoNaTela, visaoComoFicou } from "./visao"

const kb = createMiniKnowledge()
const FUSO = "America/Sao_Paulo"
const AGORA = new Date("2026-11-17T15:00:00Z") // 12h de 17/11 em Brasília

function retorno(over: Partial<Retorno> & { criado_em: string }): Retorno {
  return {
    id: over.id ?? `r-${over.criado_em}`,
    conta_id: "conta-1",
    run_id: "run-1",
    sugestao: over.sugestao ?? {
      tipo: "cha",
      titulo: "Chá de gengibre",
      alimentos: ["gengibre", "leite"],
    },
    status: over.status ?? "aguardando",
    resultado: over.resultado ?? null,
    origem: over.origem ?? null,
    criado_em: over.criado_em,
    respondido_em: over.respondido_em ?? null,
  }
}

function visao(retornos: Retorno[]) {
  return visaoComoFicou({ retornos, kb, agora: AGORA, fuso: FUSO })
}

describe("retornoNaTela", () => {
  it("leva tipo, título e ingredientes pelo nome da base, na ordem", () => {
    const tela = retornoNaTela(retorno({ criado_em: "2026-11-17T13:00:00Z" }), kb)
    expect(tela.tipo).toBe("cha")
    expect(tela.titulo).toBe("Chá de gengibre")
    expect(tela.ingredientes).toEqual(["Gengibre", "Leite"])
    expect(tela.status).toBe("aguardando")
    expect(tela.resultado).toBeNull()
  })

  it("id fora da base fica de fora dos ingredientes", () => {
    const tela = retornoNaTela(
      retorno({
        criado_em: "2026-11-17T13:00:00Z",
        sugestao: { tipo: "cha", titulo: "Chá", alimentos: ["nao-existe", "canela"] },
      }),
      kb,
    )
    expect(tela.ingredientes).toEqual(["Canela"])
  })

  it("um respondido mantém o resultado e o status", () => {
    const tela = retornoNaTela(
      retorno({
        criado_em: "2026-11-17T13:00:00Z",
        status: "respondido",
        resultado: "ajudou",
        respondido_em: "2026-11-17T14:00:00Z",
      }),
      kb,
    )
    expect(tela.status).toBe("respondido")
    expect(tela.resultado).toBe("ajudou")
  })
})

describe("visaoComoFicou", () => {
  it("mostra só os aguardando", () => {
    const visaoDaTela = visao([
      retorno({ id: "a", criado_em: "2026-11-17T13:00:00Z" }),
      retorno({
        id: "b",
        criado_em: "2026-11-17T13:30:00Z",
        status: "respondido",
        resultado: "nao_fez",
        respondido_em: "2026-11-17T14:00:00Z",
      }),
    ])
    expect(visaoDaTela.total).toBe(1)
    expect(visaoDaTela.dias[0]?.retornos.map((r) => r.id)).toEqual(["a"])
  })

  it("sai o que passou de 7 dias e fica o que está dentro da janela", () => {
    const visaoDaTela = visao([
      retorno({ id: "dentro", criado_em: "2026-11-10T16:00:00Z" }),
      retorno({ id: "fora", criado_em: "2026-11-10T14:00:00Z" }),
    ])
    expect(visaoDaTela.total).toBe(1)
    expect(visaoDaTela.dias.flatMap((d) => d.retornos).map((r) => r.id)).toEqual(["dentro"])
  })

  it("o dia é o dia local: criado às 23h30 de Brasília cai no dia de Brasília", () => {
    // 23h30 de 15/11 em Brasília (UTC-3) é 02h30 de 16/11 em UTC.
    const visaoDaTela = visao([retorno({ criado_em: "2026-11-16T02:30:00Z" })])
    expect(visaoDaTela.dias[0]?.dia).toBe("2026-11-15")
  })

  it("nomes: Hoje, Ontem e Há n dias", () => {
    const visaoDaTela = visao([
      retorno({ id: "h", criado_em: "2026-11-17T13:00:00Z" }),
      retorno({ id: "o", criado_em: "2026-11-16T13:00:00Z" }),
      retorno({ id: "t", criado_em: "2026-11-14T13:00:00Z" }),
    ])
    expect(visaoDaTela.dias.map((d) => d.nome)).toEqual(["Hoje", "Ontem", "Há 3 dias"])
  })

  it("ordena dias e retornos do mais recente para o mais antigo", () => {
    const visaoDaTela = visao([
      retorno({ id: "antigo-dia", criado_em: "2026-11-14T09:00:00Z" }),
      retorno({ id: "hoje-cedo", criado_em: "2026-11-17T12:00:00Z" }),
      retorno({ id: "ontem", criado_em: "2026-11-16T13:00:00Z" }),
      retorno({ id: "hoje-tarde", criado_em: "2026-11-17T14:00:00Z" }),
    ])
    expect(visaoDaTela.dias.map((d) => d.dia)).toEqual(["2026-11-17", "2026-11-16", "2026-11-14"])
    expect(visaoDaTela.dias[0]?.retornos.map((r) => r.id)).toEqual(["hoje-tarde", "hoje-cedo"])
    expect(visaoDaTela.total).toBe(4)
  })

  it("sem retornos, a visão vem vazia", () => {
    expect(visao([])).toEqual({ dias: [], total: 0 })
  })
})
