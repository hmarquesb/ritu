import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { Deps } from "./deps"
import { type AcaoDoPerfil, acaoDoPerfilSchema, tocarPerfil } from "./perfil"

function montar() {
  const clock = createFixedClock("2026-05-10T12:00:00Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const kb = createMiniKnowledge()
  const deps: Deps = { tx: stores, stores, kb, clock, telemetry }
  return { stores, telemetry, deps, kb }
}

async function erroDe(promessa: Promise<unknown>): Promise<unknown> {
  try {
    await promessa
  } catch (erro) {
    return erro
  }
  throw new Error("deveria ter lançado")
}

const CIDADE = { nome: "Curitiba", lat: -25.4284, lon: -49.2733, fuso: "America/Sao_Paulo" }

describe("acaoDoPerfilSchema", () => {
  it("aceita as oito ações com o formato do contrato", () => {
    expect(acaoDoPerfilSchema.safeParse({ acao: "dosha", doshas: ["vata"] }).success).toBe(true)
    expect(
      acaoDoPerfilSchema.safeParse({
        acao: "quiz",
        respostas: [{ pergunta_id: "corpo-1", dosha: "pitta" }],
      }).success,
    ).toBe(true)
    expect(acaoDoPerfilSchema.safeParse({ acao: "cidade", cidade: CIDADE }).success).toBe(true)
    expect(acaoDoPerfilSchema.safeParse({ acao: "cidade", cidade: null }).success).toBe(true)
    expect(
      acaoDoPerfilSchema.safeParse({
        acao: "evitar_acrescentar",
        itens: [{ tipo: "grupo", valor: "leite" }],
      }).success,
    ).toBe(true)
    expect(
      acaoDoPerfilSchema.safeParse({
        acao: "evitar_tirar",
        item: { tipo: "grupo", valor: "leite" },
        confirmado: true,
      }).success,
    ).toBe(true)
    expect(
      acaoDoPerfilSchema.safeParse({ acao: "restricoes", restricoes: ["vegana"] }).success,
    ).toBe(true)
    expect(
      acaoDoPerfilSchema.safeParse({ acao: "nao_come_acrescentar", texto: "jiló" }).success,
    ).toBe(true)
    expect(
      acaoDoPerfilSchema.safeParse({
        acao: "nao_come_tirar",
        item: { tipo: "texto", valor: "jiló" },
      }).success,
    ).toBe(true)
  })

  it("recusa evitar_tirar sem confirmação, dosha com três itens e campo extra", () => {
    expect(
      acaoDoPerfilSchema.safeParse({
        acao: "evitar_tirar",
        item: { tipo: "grupo", valor: "leite" },
        confirmado: false,
      }).success,
    ).toBe(false)
    expect(
      acaoDoPerfilSchema.safeParse({ acao: "dosha", doshas: ["vata", "pitta", "kapha"] }).success,
    ).toBe(false)
    expect(
      acaoDoPerfilSchema.safeParse({ acao: "dosha", doshas: ["vata"], extra: 1 }).success,
    ).toBe(false)
  })
})

describe("tocarPerfil: dosha", () => {
  it("um dosha declarado vale 1 e grava a origem declarado", async () => {
    const { stores, deps } = montar()
    const r = await tocarPerfil(deps, "c1", { acao: "dosha", doshas: ["vata"] })
    expect(r.nome).toBeTypeOf("string")
    const perfil = await stores.profiles.ler("c1")
    expect(perfil.prakriti).toEqual({ vata: 1 })
    expect(perfil.origem).toBe("declarado")
  })

  it("dois doshas valem 0,5 cada", async () => {
    const { stores, deps } = montar()
    await tocarPerfil(deps, "c1", { acao: "dosha", doshas: ["pitta", "kapha"] })
    expect((await stores.profiles.ler("c1")).prakriti).toEqual({ pitta: 0.5, kapha: 0.5 })
  })

  it("dosha repetido recusa com dosha_invalido e não grava", async () => {
    const { stores, deps } = montar()
    const erro = await erroDe(tocarPerfil(deps, "c1", { acao: "dosha", doshas: ["vata", "vata"] }))
    expect(erro).toBeInstanceOf(RituError)
    expect(erro).toMatchObject({ code: "dosha_invalido" })
    expect((await stores.profiles.ler("c1")).prakriti).toBeNull()
  })
})

describe("tocarPerfil: quiz", () => {
  it("uma resposta por pergunta calcula a prakriti e grava a origem quiz", async () => {
    const { stores, deps, kb } = montar()
    const respostas = kb.quiz.map((p) => ({ pergunta_id: p.id, dosha: "pitta" as const }))
    await tocarPerfil(deps, "c1", { acao: "quiz", respostas })
    const perfil = await stores.profiles.ler("c1")
    expect(perfil.origem).toBe("quiz")
    expect(perfil.prakriti?.pitta).toBe(1)
  })

  it("devolve o nome, os doshas e o dual que o quiz já calculou", async () => {
    const { deps, kb } = montar()
    const respostas = kb.quiz.map((p) => ({ pergunta_id: p.id, dosha: "vata" as const }))
    const r = await tocarPerfil(deps, "c1", { acao: "quiz", respostas })
    expect(r).toEqual({ nome: expect.any(String), doshas: ["vata"], dual: false })
  })

  it("pergunta faltando recusa com corpo_invalido", async () => {
    const { deps, kb } = montar()
    const respostas = kb.quiz.slice(1).map((p) => ({ pergunta_id: p.id, dosha: "vata" as const }))
    const erro = await erroDe(tocarPerfil(deps, "c1", { acao: "quiz", respostas }))
    expect(erro).toMatchObject({ code: "corpo_invalido" })
  })

  it("pergunta sobrando recusa com corpo_invalido", async () => {
    const { deps, kb } = montar()
    const respostas = [
      ...kb.quiz.map((p) => ({ pergunta_id: p.id, dosha: "vata" as const })),
      { pergunta_id: "nao-existe", dosha: "vata" as const },
    ]
    const erro = await erroDe(tocarPerfil(deps, "c1", { acao: "quiz", respostas }))
    expect(erro).toMatchObject({ code: "corpo_invalido" })
  })
})

describe("tocarPerfil: cidade", () => {
  it("grava a cidade e devolve o nome; null tira a cidade", async () => {
    const { stores, deps } = montar()
    const r = await tocarPerfil(deps, "c1", { acao: "cidade", cidade: CIDADE })
    expect(r).toEqual({ nome: "Curitiba" })
    expect((await stores.profiles.ler("c1")).cidade_nome).toBe("Curitiba")
    await tocarPerfil(deps, "c1", { acao: "cidade", cidade: null })
    expect((await stores.profiles.ler("c1")).cidade_nome).toBeNull()
  })
})

describe("tocarPerfil: evitar sempre", () => {
  it("acrescenta grupo e alimento da base sem duplicar", async () => {
    const { stores, deps } = montar()
    const acao: AcaoDoPerfil = {
      acao: "evitar_acrescentar",
      itens: [
        { tipo: "grupo", valor: "leite" },
        { tipo: "alimento", valor: "abobora" },
      ],
    }
    await tocarPerfil(deps, "c1", acao)
    await tocarPerfil(deps, "c1", acao)
    const lista = (await stores.profiles.ler("c1")).evitar_sempre
    expect(lista).toHaveLength(2)
    expect(lista.map((i) => i.valor).sort()).toEqual(["abobora", "leite"])
  })

  it("grupo fora da base recusa com toque_invalido e não grava", async () => {
    const { stores, deps } = montar()
    const erro = await erroDe(
      tocarPerfil(deps, "c1", {
        acao: "evitar_acrescentar",
        itens: [{ tipo: "grupo", valor: "nao-existe" }],
      }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
    expect((await stores.profiles.ler("c1")).evitar_sempre).toHaveLength(0)
  })

  it("alimento fora da base recusa com toque_invalido", async () => {
    const { deps } = montar()
    const erro = await erroDe(
      tocarPerfil(deps, "c1", {
        acao: "evitar_acrescentar",
        itens: [{ tipo: "alimento", valor: "nao-existe" }],
      }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
  })

  it("evitar_tirar tira o item da lista", async () => {
    const { stores, deps } = montar()
    await tocarPerfil(deps, "c1", {
      acao: "evitar_acrescentar",
      itens: [{ tipo: "grupo", valor: "leite" }],
    })
    await tocarPerfil(deps, "c1", {
      acao: "evitar_tirar",
      item: { tipo: "grupo", valor: "leite" },
      confirmado: true,
    })
    expect((await stores.profiles.ler("c1")).evitar_sempre).toHaveLength(0)
  })

  it("evitar_tirar de item que não está recusa com toque_invalido", async () => {
    const { deps } = montar()
    const erro = await erroDe(
      tocarPerfil(deps, "c1", {
        acao: "evitar_tirar",
        item: { tipo: "grupo", valor: "leite" },
        confirmado: true,
      }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
  })
})

describe("tocarPerfil: restrições", () => {
  it("grava as restrições sem repetir", async () => {
    const { stores, deps } = montar()
    await tocarPerfil(deps, "c1", {
      acao: "restricoes",
      restricoes: ["vegana", "vegana", "sem_gluten"],
    })
    expect((await stores.profiles.ler("c1")).restricoes).toEqual(["vegana", "sem_gluten"])
  })
})

describe("tocarPerfil: não como", () => {
  it("texto que a base conhece vira alimento; o que ela não conhece fica como texto", async () => {
    const { stores, deps } = montar()
    await tocarPerfil(deps, "c1", { acao: "nao_come_acrescentar", texto: "abóbora" })
    await tocarPerfil(deps, "c1", { acao: "nao_come_acrescentar", texto: "jiló" })
    expect((await stores.profiles.ler("c1")).nao_come).toEqual([
      { tipo: "alimento", valor: "abobora" },
      { tipo: "texto", valor: "jiló" },
    ])
  })

  it("alimento_id da base acrescenta sem duplicar", async () => {
    const { stores, deps } = montar()
    const acao: AcaoDoPerfil = { acao: "nao_come_acrescentar", alimento_id: "abobora" }
    await tocarPerfil(deps, "c1", acao)
    await tocarPerfil(deps, "c1", acao)
    expect((await stores.profiles.ler("c1")).nao_come).toEqual([
      { tipo: "alimento", valor: "abobora" },
    ])
  })

  it("os dois ou nenhum recusa com corpo_invalido", async () => {
    const { deps } = montar()
    const dois = await erroDe(
      tocarPerfil(deps, "c1", {
        acao: "nao_come_acrescentar",
        alimento_id: "abobora",
        texto: "jiló",
      }),
    )
    expect(dois).toMatchObject({ code: "corpo_invalido" })
    const nenhum = await erroDe(tocarPerfil(deps, "c1", { acao: "nao_come_acrescentar" }))
    expect(nenhum).toMatchObject({ code: "corpo_invalido" })
  })

  it("alimento_id fora da base recusa com toque_invalido", async () => {
    const { deps } = montar()
    const erro = await erroDe(
      tocarPerfil(deps, "c1", { acao: "nao_come_acrescentar", alimento_id: "nao-existe" }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
  })

  it("nao_come_tirar tira o item; item ausente recusa com toque_invalido", async () => {
    const { stores, deps } = montar()
    await tocarPerfil(deps, "c1", { acao: "nao_come_acrescentar", texto: "jiló" })
    await tocarPerfil(deps, "c1", {
      acao: "nao_come_tirar",
      item: { tipo: "texto", valor: "jiló" },
    })
    expect((await stores.profiles.ler("c1")).nao_come).toHaveLength(0)
    const erro = await erroDe(
      tocarPerfil(deps, "c1", { acao: "nao_come_tirar", item: { tipo: "texto", valor: "jiló" } }),
    )
    expect(erro).toMatchObject({ code: "toque_invalido" })
  })
})

describe("tocarPerfil: telemetria", () => {
  it("abre o span toque com tipo perfil e a ação", async () => {
    const { telemetry, deps } = montar()
    await tocarPerfil(deps, "c1", { acao: "restricoes", restricoes: [] })
    const span = telemetry.spans.find((s) => s.nome === "toque")
    expect(span?.atributos).toEqual({ tipo: "perfil", acao: "restricoes" })
  })

  it("soma ritu_memoria_edicoes_total com nivel fixos e a ação, sem nome nem id", async () => {
    const { telemetry, deps } = montar()
    await tocarPerfil(deps, "c1", { acao: "cidade", cidade: CIDADE })
    const metricas = telemetry.metricas.filter((m) => m.nome === "ritu_memoria_edicoes_total")
    expect(metricas).toHaveLength(1)
    expect(metricas[0]?.rotulos).toEqual({ nivel: "fixos", acao: "cidade" })
  })

  it("recusa não soma métrica", async () => {
    const { telemetry, deps } = montar()
    await erroDe(tocarPerfil(deps, "c1", { acao: "dosha", doshas: ["vata", "vata"] }))
    expect(telemetry.metricas.filter((m) => m.nome === "ritu_memoria_edicoes_total")).toHaveLength(
      0,
    )
  })
})
