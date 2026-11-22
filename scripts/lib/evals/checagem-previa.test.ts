import { describe, expect, it } from "vitest"
import { type ChecagemPrevia, checarAntes } from "./checagem-previa"

function checagem(falhas: { banco?: boolean; chave?: string } = {}): {
  c: ChecagemPrevia
  chamadas: string[]
} {
  const chamadas: string[] = []
  const c: ChecagemPrevia = {
    banco: async () => {
      chamadas.push("banco")
      if (falhas.banco) throw new Error("postgres://usuario:senha@host falhou")
    },
    chaves: ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"].map((variavel) => ({
      variavel,
      listar: async () => {
        chamadas.push(variavel)
        if (variavel === falhas.chave) throw new Error("401 chave inválida")
      },
    })),
  }
  return { c, chamadas }
}

describe("checarAntes", () => {
  it("para no Postgres e não chama nenhuma chave", async () => {
    const { c, chamadas } = checagem({ banco: true })

    const r = await checarAntes(c)

    expect(r).toEqual({ ok: false, mensagem: "Postgres não respondeu (docker compose up -d)" })
    expect(chamadas).toEqual(["banco"])
  })

  it("a mensagem não repete o erro bruto do banco", async () => {
    const { c } = checagem({ banco: true })

    const r = await checarAntes(c)

    expect(JSON.stringify(r)).not.toContain("senha")
  })

  it("chave 2 que falha para a rodada e nomeia a variável; a 3 não é checada", async () => {
    const { c, chamadas } = checagem({ chave: "GEMINI_API_KEY_2" })

    const r = await checarAntes(c)

    expect(r).toEqual({
      ok: false,
      mensagem: "GEMINI_API_KEY_2 não respondeu à listagem de modelos",
    })
    expect(chamadas).toEqual(["banco", "GEMINI_API_KEY", "GEMINI_API_KEY_2"])
  })

  it("tudo ok: checa o banco e cada chave, na ordem", async () => {
    const { c, chamadas } = checagem()

    const r = await checarAntes(c)

    expect(r).toEqual({ ok: true })
    expect(chamadas).toEqual(["banco", "GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"])
  })

  it("sem chaves extras, só a principal é checada", async () => {
    const chamadas: string[] = []
    const r = await checarAntes({
      banco: async () => {},
      chaves: [{ variavel: "GEMINI_API_KEY", listar: async () => void chamadas.push("k1") }],
    })

    expect(r).toEqual({ ok: true })
    expect(chamadas).toEqual(["k1"])
  })
})
