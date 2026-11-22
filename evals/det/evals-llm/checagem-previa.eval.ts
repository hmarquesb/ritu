import { describe, expect, it } from "vitest"
import { checarAntes } from "../../../scripts/lib/evals/checagem-previa"

// A checagem antes do 1º caso para sem Postgres e não chama nenhuma chave.
// Com fakes: não toca rede, banco nem chave.

describe("checagem antes do 1º caso", () => {
  it("sem Postgres, para com a mensagem e não lista modelos", async () => {
    let listou = false
    const r = await checarAntes({
      banco: async () => {
        throw new Error("ECONNREFUSED")
      },
      chaves: [
        {
          variavel: "GEMINI_API_KEY",
          listar: async () => {
            listou = true
          },
        },
      ],
    })

    expect(r).toEqual({ ok: false, mensagem: "Postgres não respondeu (docker compose up -d)" })
    expect(listou).toBe(false)
  })
})
