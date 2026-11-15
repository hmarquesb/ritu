import { describe, expect, it } from "vitest"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { nomeDoCitado, nomeDoEvitar } from "./nomes"

const kb = createMiniKnowledge()

describe("nomeDoCitado", () => {
  it("usa o nome da base quando o citado tem alimento_id", () => {
    expect(nomeDoCitado({ alimento_id: "abobora", nome: "jerimum" }, kb)).toBe("Abóbora")
  })

  it("usa o nome livre, sem colchetes angulares, quando não tem alimento_id", () => {
    expect(nomeDoCitado({ nome: "<pão de forma>" }, kb)).toBe("‹pão de forma›")
  })

  it("cai no nome livre quando o alimento_id não existe na base", () => {
    expect(nomeDoCitado({ alimento_id: "nao-existe", nome: "Quinoa" }, kb)).toBe("Quinoa")
  })
})

describe("nomeDoEvitar", () => {
  it("usa o nome do alimento na base", () => {
    expect(nomeDoEvitar({ tipo: "alimento", valor: "cardamomo" }, kb)).toBe("Cardamomo")
  })

  it("usa o nome do grupo", () => {
    expect(nomeDoEvitar({ tipo: "grupo", valor: "amendoim" }, kb)).toBe("Amendoim")
  })

  it("devolve o id do grupo que não existe na base", () => {
    expect(nomeDoEvitar({ tipo: "grupo", valor: "grupo-fantasma" }, kb)).toBe("grupo-fantasma")
  })

  it("neutraliza o texto livre", () => {
    expect(nomeDoEvitar({ tipo: "texto", valor: "<script>" }, kb)).toBe("‹script›")
  })
})
