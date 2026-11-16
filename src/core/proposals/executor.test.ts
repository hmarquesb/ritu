import { describe, expect, it } from "vitest"
import { executarProposta } from "@/core/proposals/executor"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"

const kb = createMiniKnowledge()

async function ambiente() {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const stores = createMemoryStores(clock)
  const a = (await stores.accounts.criar({ tipo: "google", google_sub: "a", email: "a@e.com" })).id
  const b = (await stores.accounts.criar({ tipo: "google", google_sub: "b", email: "b@e.com" })).id
  return { stores, a, b }
}

describe("executarProposta", () => {
  it("casa tem: grava item da base e item livre", async () => {
    const { stores, a } = await ambiente()
    const ok = await executarProposta(
      stores,
      a,
      "casa.propor",
      { acao: "tem", itens: [{ alimento_id: "gengibre", nome: "gengibre" }, { nome: "abóbora" }] },
      kb,
    )
    expect(ok).toBe(true)
    const itens = await stores.pantry.listar(a)
    expect(itens.map((i) => i.alimento_id ?? i.nome_livre).sort()).toEqual(["abóbora", "gengibre"])
    expect(itens.every((i) => i.estado === "tem")).toBe(true)
  })

  it("casa acabou marca como acabou", async () => {
    const { stores, a } = await ambiente()
    await stores.pantry.registrar(a, [{ alimento_id: "leite" }], "tela")
    const ok = await executarProposta(
      stores,
      a,
      "casa.propor",
      { acao: "acabou", itens: [{ alimento_id: "leite", nome: "leite" }] },
      kb,
    )
    expect(ok).toBe(true)
    const itens = await stores.pantry.listar(a)
    expect(itens.find((i) => i.alimento_id === "leite")?.estado).not.toBe("tem")
  })

  it("registrar em casa tira da lista e apaga as faltas", async () => {
    const { stores, a } = await ambiente()
    await stores.shortages.porNaLista(a, {
      alimento_id: "gengibre",
      motivo: "faltou_hoje",
      detalhe: "chá",
    })
    await executarProposta(
      stores,
      a,
      "casa.propor",
      { acao: "tem", itens: [{ alimento_id: "gengibre", nome: "gengibre" }] },
      kb,
    )
    expect(await stores.shortages.lista(a)).toEqual([])
  })

  it("evitar sempre acrescenta sem duplicar", async () => {
    const { stores, a } = await ambiente()
    await stores.profiles.acrescentarEvitarSempre(a, [{ tipo: "grupo", valor: "amendoim" }])
    const ok = await executarProposta(
      stores,
      a,
      "memoria.propor",
      {
        tipo: "evitar_sempre",
        itens: [
          { tipo: "grupo", valor: "amendoim" },
          { tipo: "alimento", valor: "leite" },
          { tipo: "texto", valor: "coentro" },
        ],
      },
      kb,
    )
    expect(ok).toBe(true)
    const p = await stores.profiles.ler(a)
    expect(p.evitar_sempre.map((i) => `${i.tipo}:${i.valor}`).sort()).toEqual([
      "alimento:leite",
      "grupo:amendoim",
      "texto:coentro",
    ])
  })

  it("restrição une com as atuais sem repetir", async () => {
    const { stores, a } = await ambiente()
    await stores.profiles.definirRestricoes(a, ["sem_gluten"])
    await executarProposta(
      stores,
      a,
      "memoria.propor",
      { tipo: "restricao", itens: ["sem_gluten", "vegetariana"] },
      kb,
    )
    expect((await stores.profiles.ler(a)).restricoes.sort()).toEqual(["sem_gluten", "vegetariana"])
  })

  it("não como une alimento e nome livre sem repetir", async () => {
    const { stores, a } = await ambiente()
    await stores.profiles.definirNaoCome(a, [{ tipo: "alimento", valor: "leite" }])
    const ok = await executarProposta(
      stores,
      a,
      "memoria.propor",
      {
        tipo: "nao_come",
        itens: [
          { alimento_id: "leite", nome: "leite" },
          { alimento_id: "banana", nome: "banana" },
          { nome: "jiló" },
        ],
      },
      kb,
    )
    expect(ok).toBe(true)
    const nc = (await stores.profiles.ler(a)).nao_come.map((i) => `${i.tipo}:${i.valor}`).sort()
    expect(nc).toEqual(["alimento:banana", "alimento:leite", "texto:jiló"])
  })

  it("gosta grava a preferência de cada item", async () => {
    const { stores, a } = await ambiente()
    const ok = await executarProposta(
      stores,
      a,
      "memoria.propor",
      {
        tipo: "gosta",
        itens: [
          { alimento_id: "banana", nome: "banana" },
          { alimento_id: "mel", nome: "mel" },
        ],
      },
      kb,
    )
    expect(ok).toBe(true)
    const prefs = await stores.preferences.ler(a)
    expect(prefs.map((p) => `${p.item_id}:${p.gosto}`).sort()).toEqual([
      "banana:gosta",
      "mel:gosta",
    ])
  })

  it("rotina anota o texto", async () => {
    const { stores, a } = await ambiente()
    const ok = await executarProposta(
      stores,
      a,
      "memoria.propor",
      { tipo: "rotina", texto: "almoça fora" },
      kb,
    )
    expect(ok).toBe(true)
    expect(await stores.routine.notasAtivas(a)).toEqual([
      expect.objectContaining({ texto: "almoça fora" }),
    ])
  })

  it("lista põe o item na lista", async () => {
    const { stores, a } = await ambiente()
    const ok = await executarProposta(
      stores,
      a,
      "lista.propor",
      { alimento_id: "gengibre", motivo: "faltou_hoje", detalhe: "chá" },
      kb,
    )
    expect(ok).toBe(true)
    expect(await stores.shortages.lista(a)).toEqual([
      expect.objectContaining({ alimento_id: "gengibre", motivo: "faltou_hoje", detalhe: "chá" }),
    ])
  })

  it("recusa sem gravar: campo a mais, remover, tool desconhecida, fora da base", async () => {
    const { stores, a } = await ambiente()
    const casos: [string, unknown][] = [
      ["casa.propor", { acao: "tem", itens: [{ nome: "x" }], extra: 1 }],
      ["memoria.propor", { tipo: "rotina", texto: "x", acao: "remover" }],
      ["casa.propor", { acao: "remover", itens: [{ nome: "x" }] }],
      ["memoria.remover", { tipo: "rotina", texto: "x" }],
      [
        "casa.propor",
        { acao: "tem", itens: [{ nome: "x" }, { alimento_id: "nao-existe", nome: "y" }] },
      ],
      [
        "memoria.propor",
        { tipo: "evitar_sempre", itens: [{ tipo: "grupo", valor: "inexistente" }] },
      ],
      [
        "memoria.propor",
        { tipo: "evitar_sempre", itens: [{ tipo: "alimento", valor: "nao-existe" }] },
      ],
      ["lista.propor", { alimento_id: "nao-existe", motivo: "fez_falta", detalhe: "2" }],
    ]
    for (const [tool, conteudo] of casos) {
      expect(await executarProposta(stores, a, tool, conteudo, kb)).toBe(false)
    }
    expect(await stores.pantry.listar(a)).toEqual([])
    expect((await stores.profiles.ler(a)).evitar_sempre).toEqual([])
    expect(await stores.routine.notasAtivas(a)).toEqual([])
    expect(await stores.shortages.lista(a)).toEqual([])
  })

  it("não toca outra conta", async () => {
    const { stores, a, b } = await ambiente()
    await executarProposta(
      stores,
      a,
      "memoria.propor",
      { tipo: "restricao", itens: ["vegetariana"] },
      kb,
    )
    await executarProposta(stores, a, "casa.propor", { acao: "tem", itens: [{ nome: "x" }] }, kb)
    expect((await stores.profiles.ler(b)).restricoes).toEqual([])
    expect(await stores.pantry.listar(b)).toEqual([])
  })
})
