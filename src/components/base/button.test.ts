import { describe, expect, it } from "vitest"
import { removeOrphanAnnouncements } from "@/components/base/button"

function fakeDoc(present: string[], labelledby: string[]) {
  const removed: string[] = []
  const nodes = labelledby.map((value) => ({
    getAttribute: () => value,
    remove: () => removed.push(value),
  }))
  const doc = {
    querySelectorAll: () => nodes,
    getElementById: (id: string) => (present.includes(id) ? {} : null),
  } as unknown as Pick<Document, "querySelectorAll" | "getElementById">
  return { doc, removed }
}

describe("removeOrphanAnnouncements", () => {
  it("remove o anúncio cujo botão saiu da página", () => {
    const { doc, removed } = fakeDoc(["vivo"], ["morto", "vivo"])
    removeOrphanAnnouncements(doc)
    expect(removed).toEqual(["morto"])
  })

  it("remove o anúncio quando um dos nomes sumiu", () => {
    const { doc, removed } = fakeDoc(["a"], ["a b"])
    removeOrphanAnnouncements(doc)
    expect(removed).toEqual(["a b"])
  })
})
