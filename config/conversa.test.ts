import { describe, expect, it } from "vitest"
import { config } from "./index"

describe("config.conversa", () => {
  it("expõe os limites da conversa com os valores da spec", () => {
    expect(config.conversa.maxCaracteres).toBe(1000)
    expect(config.conversa.interprete).toEqual({
      mensagensNoContexto: 4,
      maxCaracteresPorMensagem: 300,
      pendentesNoContexto: 5,
    })
    expect(config.conversa.maxItensDeCasa).toBe(10)
    expect(config.conversa.maxEvitar).toBe(5)
    expect(config.conversa.maxFatoDeRotina).toBe(200)
    expect(config.conversa.maxNomeLivre).toBe(40)
  })

  it("lista os caminhos que ficam fora do prompt do acompanhante", () => {
    expect(config.conversa.caminhosForaDoPrompt).toEqual(["alerta", "fora", "ofensa"])
  })
})
