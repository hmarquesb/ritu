import { describe, expect, it } from "vitest"
import { falaDeSaude } from "./saude"

describe("falaDeSaude", () => {
  it.each([
    "esse chá cura gastrite?",
    "Tô tomando remédio",
    "tenho refluxo",
    "Pressão alta, o que como?",
  ])("casa: %s", (t) => expect(falaDeSaude(t)).toBe(true))
  it.each([
    "do que se trata o kitchari?",
    "curry de legumes",
    "vou procurar um chá",
    "estou com frio",
  ])("não casa: %s", (t) => expect(falaDeSaude(t)).toBe(false))
})
