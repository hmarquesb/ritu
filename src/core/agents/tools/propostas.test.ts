import { describe, expect, it } from "vitest"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { sinaisVazios } from "@/core/knowledge/substitutos"
import type { ContextoDoRun, ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { listaPropor, memoriaPropor, validarListaPropor, validarMemoriaPropor } from "./propostas"

const CONTA = "conta-1"

const RUN_BASE: ContextoDoRun = {
  com_incomodo: false,
  tem_para_ter: false,
  nao_tem: ["gengibre", "limao"],
  candidatos: [
    {
      tipo: "pratica",
      id: "respiracao-lenta",
      nome: "Respiração lenta",
      alimentos: ["gengibre"],
    },
    {
      tipo: "refeicao",
      id: "arroz-com-legume",
      nome: "Arroz com legumes",
      alimentos: ["gengibre"],
    },
  ],
  na_lista: [],
  lista_recusada: [],
  notas_ativas: [],
}

function ambiente(filtro: FiltroPessoa = filtroVazio, run?: ContextoDoRun) {
  const clock = createFixedClock("2026-01-15T12:00:00Z")
  const stores = createMemoryStores(clock)
  const ctx: ToolContext = {
    kb: createMiniKnowledge(),
    filtro,
    sinais: sinaisVazios,
    clima: { fonte: createFakeWeather() },
    contaId: CONTA,
    stores,
    clock,
    telemetry: createMemoryTelemetry(),
    ...(run ? { run } : {}),
  }
  return { ctx, stores }
}

function comRun(run: ContextoDoRun, filtro: FiltroPessoa = filtroVazio) {
  return ambiente(filtro, run).ctx
}

function semRun() {
  return ambiente().ctx
}

const PEDIDO_MEMORIA = { tipo: "rotina" as const }

describe("memoria.propor", () => {
  it("propõe o fato de rotina como nota de rotina", async () => {
    const ctx = comRun({ ...RUN_BASE, fato_de_rotina: "Caminho antes do café" })
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)).toEqual({
      proposto: true,
      proposta: { tool: "memoria.propor", tipo: "rotina", texto: "Caminho antes do café" },
    })
  })

  it("recusa com sem_fato quando não há fato de rotina", async () => {
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, comRun(RUN_BASE))).toEqual({
      proposto: false,
      motivo: "sem_fato",
    })
  })

  it("recusa com fato_com_incomodo quando o fato contém palavra de incômodo da base", async () => {
    const kb = createMiniKnowledge()
    const incomodo = kb.incomodos.find((i) => i.id === "dor-de-cabeca")
    const palavra = incomodo?.palavras[0] ?? ""
    const ctx = comRun({ ...RUN_BASE, fato_de_rotina: `Acordo com ${palavra} de manhã` })
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)).toEqual({
      proposto: false,
      motivo: "fato_com_incomodo",
    })
  })

  it("recusa com ja_anotado quando o fato é igual a uma nota ativa, sem acento e maiúscula", async () => {
    const ctx = comRun({
      ...RUN_BASE,
      fato_de_rotina: "Caminhada à tarde",
      notas_ativas: ["Caminhada a Tarde"],
    })
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)).toEqual({
      proposto: false,
      motivo: "ja_anotado",
    })
  })

  it("recusa com com_incomodo quando o run tem incômodo", async () => {
    const ctx = comRun({ ...RUN_BASE, com_incomodo: true, fato_de_rotina: "Caminho cedo" })
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)).toEqual({
      proposto: false,
      motivo: "com_incomodo",
    })
  })

  it("recusa com rotina_cheia quando a conta já tem 30 notas ativas", async () => {
    const notas = Array.from({ length: 30 }, (_, i) => `Nota ${i}`)
    const ctx = comRun({ ...RUN_BASE, fato_de_rotina: "Caminho cedo", notas_ativas: notas })
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)).toEqual({
      proposto: false,
      motivo: "rotina_cheia",
    })
  })

  it("propõe com 29 notas ativas", async () => {
    const notas = Array.from({ length: 29 }, (_, i) => `Nota ${i}`)
    const ctx = comRun({ ...RUN_BASE, fato_de_rotina: "Caminho cedo", notas_ativas: notas })
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)).toEqual({
      proposto: true,
      proposta: { tool: "memoria.propor", tipo: "rotina", texto: "Caminho cedo" },
    })
  })

  it("sem ctx.run usa o run vazio e recusa com sem_fato", async () => {
    expect(await memoriaPropor.execute(PEDIDO_MEMORIA, semRun())).toEqual({
      proposto: false,
      motivo: "sem_fato",
    })
  })

  it("resume como proposto ou recusado com o código, sem o texto da pessoa", () => {
    expect(
      memoriaPropor.resumir?.({
        proposto: true,
        proposta: { tool: "memoria.propor", tipo: "rotina", texto: "Caminho cedo" },
      }),
    ).toBe("proposto")
    expect(memoriaPropor.resumir?.({ proposto: false, motivo: "sem_fato" })).toBe(
      "recusado: sem_fato",
    )
  })

  it("rejeita entrada fora do schema", () => {
    expect(memoriaPropor.input.safeParse({ tipo: "outro" }).success).toBe(false)
    expect(memoriaPropor.input.safeParse({ tipo: "rotina", extra: 1 }).success).toBe(false)
  })

  it("validarMemoriaPropor devolve o primeiro código da ordem", () => {
    const kb: KnowledgeBase = createMiniKnowledge()
    expect(validarMemoriaPropor({ ...RUN_BASE, com_incomodo: true }, kb)).toBe("com_incomodo")
    expect(
      validarMemoriaPropor({ ...RUN_BASE, fato_de_rotina: "Caminho cedo" }, kb),
    ).toBeUndefined()
  })
})

describe("lista.propor", () => {
  const PEDIDO_COM_PRATICA = { alimento_id: "gengibre", pratica_id: "respiracao-lenta" }

  it("propõe pôr o alimento na lista com o nome do candidato indicado como detalhe", async () => {
    expect(await listaPropor.execute(PEDIDO_COM_PRATICA, comRun(RUN_BASE))).toEqual({
      proposto: true,
      proposta: {
        tool: "lista.propor",
        alimento_id: "gengibre",
        motivo: "faltou_hoje",
        detalhe: "Respiração lenta",
      },
    })
  })

  it("aceita preparo_id e usa o nome da refeição como detalhe", async () => {
    expect(
      await listaPropor.execute(
        { alimento_id: "gengibre", preparo_id: "arroz-com-legume" },
        comRun(RUN_BASE),
      ),
    ).toEqual({
      proposto: true,
      proposta: {
        tool: "lista.propor",
        alimento_id: "gengibre",
        motivo: "faltou_hoje",
        detalhe: "Arroz com legumes",
      },
    })
  })

  it("recusa com fora_da_base quando o alimento não existe", async () => {
    const ctx = comRun({ ...RUN_BASE, nao_tem: ["inexistente"] })
    expect(
      await listaPropor.execute(
        { alimento_id: "inexistente", pratica_id: "respiracao-lenta" },
        ctx,
      ),
    ).toEqual({
      proposto: false,
      motivo: "fora_da_base",
    })
  })

  it("recusa com sem_nao_tenho quando o alimento não está em nao_tem", async () => {
    expect(
      await listaPropor.execute(
        { alimento_id: "canela", pratica_id: "respiracao-lenta" },
        comRun(RUN_BASE),
      ),
    ).toEqual({ proposto: false, motivo: "sem_nao_tenho" })
  })

  it("recusa com com_para_ter quando a casa já tem itens para ter", async () => {
    const ctx = comRun({ ...RUN_BASE, tem_para_ter: true })
    expect(await listaPropor.execute(PEDIDO_COM_PRATICA, ctx)).toEqual({
      proposto: false,
      motivo: "com_para_ter",
    })
  })

  it("recusa com fora_do_candidato quando não há pratica_id nem preparo_id", async () => {
    expect(await listaPropor.execute({ alimento_id: "gengibre" }, comRun(RUN_BASE))).toEqual({
      proposto: false,
      motivo: "fora_do_candidato",
    })
  })

  it("recusa com fora_do_candidato quando vêm os dois ids", async () => {
    expect(
      await listaPropor.execute(
        { alimento_id: "gengibre", pratica_id: "respiracao-lenta", preparo_id: "arroz-com-legume" },
        comRun(RUN_BASE),
      ),
    ).toEqual({ proposto: false, motivo: "fora_do_candidato" })
  })

  it("recusa com fora_do_candidato quando o candidato indicado não usa o alimento", async () => {
    expect(
      await listaPropor.execute(
        { alimento_id: "canela", pratica_id: "respiracao-lenta" },
        comRun({ ...RUN_BASE, nao_tem: ["canela"] }),
      ),
    ).toEqual({ proposto: false, motivo: "fora_do_candidato" })
  })

  it("recusa com ja_na_lista quando o alimento já está na lista", async () => {
    const ctx = comRun({ ...RUN_BASE, na_lista: ["gengibre"] })
    expect(await listaPropor.execute(PEDIDO_COM_PRATICA, ctx)).toEqual({
      proposto: false,
      motivo: "ja_na_lista",
    })
  })

  it("recusa com ja_recusado quando o alimento foi recusado antes", async () => {
    const ctx = comRun({ ...RUN_BASE, lista_recusada: ["gengibre"] })
    expect(await listaPropor.execute(PEDIDO_COM_PRATICA, ctx)).toEqual({
      proposto: false,
      motivo: "ja_recusado",
    })
  })

  it("recusa com filtrado quando o filtro da pessoa barra o alimento", async () => {
    const filtro: FiltroPessoa = {
      ...filtroVazio,
      evitar: [{ tipo: "alimento", valor: "gengibre" }],
    }
    expect(await listaPropor.execute(PEDIDO_COM_PRATICA, comRun(RUN_BASE, filtro))).toEqual({
      proposto: false,
      motivo: "filtrado",
    })
  })

  it("recusa com com_incomodo quando o run tem incômodo", async () => {
    const ctx = comRun({ ...RUN_BASE, com_incomodo: true })
    expect(await listaPropor.execute(PEDIDO_COM_PRATICA, ctx)).toEqual({
      proposto: false,
      motivo: "com_incomodo",
    })
  })

  it("sem ctx.run usa o run vazio: alimento fora da base dá fora_da_base, e um da base dá sem_nao_tenho", async () => {
    expect(
      await listaPropor.execute({ alimento_id: "inexistente", pratica_id: "x" }, semRun()),
    ).toEqual({
      proposto: false,
      motivo: "fora_da_base",
    })
    expect(
      await listaPropor.execute({ alimento_id: "gengibre", pratica_id: "x" }, semRun()),
    ).toEqual({
      proposto: false,
      motivo: "sem_nao_tenho",
    })
  })

  it("resume como proposto ou recusado com o código", () => {
    expect(
      listaPropor.resumir?.({
        proposto: true,
        proposta: {
          tool: "lista.propor",
          alimento_id: "gengibre",
          motivo: "faltou_hoje",
          detalhe: "x",
        },
      }),
    ).toBe("proposto")
    expect(listaPropor.resumir?.({ proposto: false, motivo: "ja_na_lista" })).toBe(
      "recusado: ja_na_lista",
    )
  })

  it("rejeita entrada fora do schema", () => {
    expect(listaPropor.input.safeParse({ alimento_id: "gengibre", extra: 1 }).success).toBe(false)
    expect(listaPropor.input.safeParse({}).success).toBe(false)
  })

  it("validarListaPropor devolve o código pela ordem da tabela", () => {
    const kb = createMiniKnowledge()
    expect(
      validarListaPropor(
        PEDIDO_COM_PRATICA,
        { ...RUN_BASE, com_incomodo: true, tem_para_ter: true },
        filtroVazio,
        kb,
      ),
    ).toBe("com_incomodo")
    expect(validarListaPropor(PEDIDO_COM_PRATICA, RUN_BASE, filtroVazio, kb)).toBeUndefined()
  })
})

describe("propostas não escrevem nos stores", () => {
  it("chamar as duas tools não muda o estado dos stores", async () => {
    const { ctx, stores } = ambiente(filtroVazio, {
      ...RUN_BASE,
      fato_de_rotina: "Caminho antes do café",
    })
    await stores.pantry.registrar(CONTA, [{ alimento_id: "gengibre" }], "tela")
    const estado = async () =>
      JSON.stringify([
        await stores.pantry.listar(CONTA),
        await stores.profiles.ler(CONTA),
        await stores.routine.notasAtivas(CONTA),
        await stores.shortages.lista(CONTA),
        await stores.proposals.doRun(CONTA, "run-1"),
      ])
    const antes = await estado()
    await memoriaPropor.execute(PEDIDO_MEMORIA, ctx)
    await listaPropor.execute({ alimento_id: "gengibre", pratica_id: "respiracao-lenta" }, ctx)
    expect(await estado()).toBe(antes)
  })
})
