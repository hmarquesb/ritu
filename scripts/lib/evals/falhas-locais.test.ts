import { describe, expect, it } from "vitest"
import { cabecalhoDasFalhas, formatarFalha } from "./falhas-locais"
import type { Colhido, ResultadoDoCaso } from "./resultado"

function caso(extra: Partial<ResultadoDoCaso> = {}): ResultadoDoCaso {
  return {
    id: "c1-03",
    titulo: "Caso com falha",
    tipo: "acompanhante",
    familias: ["conteudo"],
    marcas: [],
    checagens: [
      { lista: "deve", descricao: "fala de chá", ok: true },
      { lista: "nao_pode", descricao: "cita dosagem", ok: false },
      { lista: "criterio", descricao: "sem promessa", ok: null },
    ],
    acertou: false,
    uso: {},
    trocas: 0,
    latenciaMs: 900,
    modelos: [],
    ...extra,
  }
}

const COLHIDO: Colhido = {
  mensagem: "mensagem da pessoa",
  texto: "resposta do agente",
  saida: {
    sugestoes: [
      {
        titulo: "Chá de gengibre",
        itens: [{ nome: "gengibre", linha_base: "linha" }],
        motivo: "motivo do chá",
      },
    ],
  } as unknown as Colhido["saida"],
  etapas: [{ tipo: "tool", nome: "clima", status: "ok", resumo: "resumo curto" }],
}

describe("cabecalhoDasFalhas", () => {
  it("diz o checkpoint, a data e que é arquivo local", () => {
    expect(cabecalhoDasFalhas("c1-base", "2026-11-16")).toBe(
      "# Falhas do c1-base (2026-11-16)\n\nArquivo local, fora do git.\n",
    )
  })
})

describe("formatarFalha", () => {
  it("tem o id, o título, a mensagem e a resposta", () => {
    const texto = formatarFalha(caso(), COLHIDO)
    expect(texto.startsWith("## c1-03 · Caso com falha\n")).toBe(true)
    expect(texto).toContain("mensagem da pessoa")
    expect(texto).toContain("resposta do agente")
  })

  it("lista só as checagens falsas", () => {
    const texto = formatarFalha(caso(), COLHIDO)
    expect(texto).toContain("- nao_pode: cita dosagem")
    expect(texto).not.toContain("fala de chá")
    expect(texto).not.toContain("sem promessa")
  })

  it("mostra as sugestões e as etapas", () => {
    const texto = formatarFalha(caso(), COLHIDO)
    expect(texto).toContain("Chá de gengibre")
    expect(texto).toContain("gengibre")
    expect(texto).toContain("motivo do chá")
    expect(texto).toContain("1. tool · clima · ok · resumo curto")
  })

  it("mostra o erro quando há", () => {
    const texto = formatarFalha(caso({ erro: "LlmError:rate_limit" }), {
      texto: "",
      etapas: [],
    })
    expect(texto).toContain("Erro: LlmError:rate_limit")
  })
})
