import { describe, expect, it, vi } from "vitest"
import { type ListarSdk, listarModelos } from "./listar-modelos"

function sdkCom(list: ListarSdk["models"]["list"]): ListarSdk {
  return { models: { list } }
}

describe("listarModelos", () => {
  it("usa a chave dada e pede a listagem de modelos", async () => {
    const list = vi.fn().mockResolvedValue({})
    const chaves: string[] = []

    await listarModelos("chave-2", (k) => {
      chaves.push(k)
      return sdkCom(list)
    })

    expect(chaves).toEqual(["chave-2"])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it("propaga a falha da listagem para a checagem decidir", async () => {
    const falha = listarModelos("x", () =>
      sdkCom(async () => {
        throw Object.assign(new Error("401"), { status: 401 })
      }),
    )

    await expect(falha).rejects.toThrow("401")
  })
})
