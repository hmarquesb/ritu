import { describe, expect, it } from "vitest"
import { codificarEvento, type EventoDaTela } from "./eventos"
import type { VisaoDoRun } from "./visao"

const visao: VisaoDoRun = {
  run_id: "run-1",
  status: "done",
  caminho: "acompanhante",
  frases: [{ chave: "entendendo", texto: "Entendendo o que você disse" }],
  avisos: [],
  sugestoes: [],
  evitar: [],
  geral: false,
  podeVotar: true,
}

const inicio: EventoDaTela = { tipo: "inicio", run_id: "run-1" }
const etapa: EventoDaTela = {
  tipo: "etapa",
  frase: { chave: "clima", texto: "Olhando o clima de hoje" },
}
const fim: EventoDaTela = { tipo: "fim", visao, pendentes: 2 }
const erro: EventoDaTela = { tipo: "erro", erro: "run_nao_encontrado" }

const EVENTOS: EventoDaTela[] = [inicio, etapa, fim, erro]

describe("codificarEvento", () => {
  it("termina a linha com quebra e gera JSON", () => {
    const texto = codificarEvento({ tipo: "erro", erro: "x" })
    expect(texto.endsWith("\n")).toBe(true)
    expect(JSON.parse(texto.trim())).toEqual({ tipo: "erro", erro: "x" })
  })

  it.each(EVENTOS.map((e) => [e.tipo, e] as const))("mantém o evento %s inteiro", (_t, e) => {
    expect(JSON.parse(codificarEvento(e))).toEqual(e)
  })
})
