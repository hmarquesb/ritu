import { describe, expect, it } from "vitest"
import { copiarSeed } from "@/core/accounts/copiar-seed"
import type { Conta } from "@/core/accounts/types"
import type { DemoSeed } from "@/core/demo-seed"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { lerVoce } from "./ler"

const FUSO = "America/Sao_Paulo"
const kb = createMiniKnowledge()
const clock = createFixedClock("2026-03-10T15:00:00Z")

type Conversa = DemoSeed["historico"][number]

function conversa(dias_atras: number, resultado: Conversa["resultados"][number]): Conversa {
  return {
    dias_atras,
    mensagem: `mensagem ${dias_atras}`,
    estados: ["com_frio"],
    momento_do_dia: "manha",
    gunas_buscadas: ["quente"],
    resultados: [resultado],
    saida: {
      origem: "agente",
      resposta: `resposta ${dias_atras}`,
      geral: false,
      avisos: [],
      explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
      sugestoes: [
        {
          tipo: "cha",
          pratica_id: "cha-gengibre",
          titulo: "Chá de gengibre",
          como_fazer: "Ferva.",
          itens: [],
          verbos: [],
          motivo: "esquenta",
          linhas_base: [],
          novidade: false,
        },
      ],
      evitar: [],
      incertos: [],
      citados: [],
      anotacoes: [],
      propostas: [],
    },
  }
}

const seed: DemoSeed = {
  faixa: "Faixa",
  mensagem_sugerida: "Oi",
  perfil: {
    prakriti: { vata: 0.5, pitta: 0.5 },
    cidade: { nome: "Rio de Janeiro", lat: -22.9, lon: -43.17, fuso: FUSO },
    evitar_sempre: [{ tipo: "texto", valor: "castanhas" }],
    restricoes: [],
    nao_come: [],
  },
  casa: [
    { alimento_id: "gengibre", dias_atras: 1 },
    { alimento_id: "limao", dias_atras: 60 },
  ],
  preferencias: [{ tipo: "pratica", id: "cha-gengibre", gosto: "gosta", ajudou: 2, nao_fez: 1 }],
  faltas: [1, 2, 3].map((dias_atras) => ({ alimento_id: "cardamomo", dias_atras })),
  rotina: ["acordo cedo", "janto tarde"],
  padrao: { estados: ["com_frio"], item: { tipo: "pratica", id: "cha-gengibre" }, ocorrencias: 3 },
  historico: [conversa(1, "aguardando"), conversa(3, "ajudou"), conversa(5, "nao_ajudou")],
}

function ambiente() {
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock }
  return { stores, deps }
}

async function demo(
  stores: ReturnType<typeof createMemoryStores>,
  expira_em: Date,
): Promise<Conta> {
  return stores.accounts.criar({ tipo: "demo", expira_em })
}

describe("lerVoce", () => {
  it("com a demonstração semeada, os sete níveis vêm preenchidos", async () => {
    const { stores, deps } = ambiente()
    const conta = await demo(stores, new Date("2026-03-11T15:00:00Z"))
    await copiarSeed(stores, conta.id, seed, { clock, kb })

    const voce = await lerVoce(deps, conta, FUSO)

    expect(voce.painel.tem).toBe(true)
    expect(voce.memoria.fixos.dosha).not.toBeNull()
    expect(voce.memoria.fixos.cidade).toBe("Rio de Janeiro")
    expect(voce.memoria.fixos.evitar.map((item) => item.valor)).toEqual(["castanhas"])
    expect(voce.memoria.casa.itens).toBe(2)
    expect(voce.memoria.gostos).toEqual([
      expect.objectContaining({ item_tipo: "pratica", item_id: "cha-gengibre", gosto: "gosta" }),
    ])
    expect(voce.memoria.faltas).toEqual([
      expect.objectContaining({ alimento_id: "cardamomo", dias: 3 }),
    ])
    expect(voce.memoria.rotina.notas.map((nota) => nota.texto)).toEqual(seed.rotina)
    expect(voce.memoria.rotina.resumo).toBe("Janto tarde. Acordo cedo.")
    expect(voce.memoria.padroes).toHaveLength(1)
    expect(voce.memoria.conversa.map((dia) => dia.total)).toEqual([2, 2, 2])
    expect(voce.conta.tipo).toBe("demo")
    expect(voce.fuso).toBe(FUSO)
  })

  it("horas_restantes só na demonstração, arredondado para baixo", async () => {
    const { stores, deps } = ambiente()
    const conta = await demo(stores, new Date("2026-03-10T20:30:00Z"))

    const voce = await lerVoce(deps, conta, FUSO)

    expect(voce.conta).toEqual({ tipo: "demo", horas_restantes: 5 })
  })

  it("horas_restantes é zero quando a demonstração já venceu", async () => {
    const { stores, deps } = ambiente()
    const conta = await demo(stores, new Date("2026-03-09T12:00:00Z"))

    const voce = await lerVoce(deps, conta, FUSO)

    expect(voce.conta.horas_restantes).toBe(0)
  })

  it("conta Google não tem horas_restantes", async () => {
    const { stores, deps } = ambiente()
    const conta = await stores.accounts.criar({ tipo: "google", google_sub: "sub-1" })

    const voce = await lerVoce(deps, conta, FUSO)

    expect(voce.conta).toEqual({ tipo: "google", horas_restantes: null })
  })

  it("não traz dados de outra conta", async () => {
    const { stores, deps } = ambiente()
    const outra = await demo(stores, new Date("2026-03-11T15:00:00Z"))
    await copiarSeed(stores, outra.id, seed, { clock, kb })
    const minha = await stores.accounts.criar({ tipo: "google", google_sub: "sub-2" })

    const voce = await lerVoce(deps, minha, FUSO)

    expect(voce.painel).toEqual(expect.objectContaining({ tem: false }))
    expect(voce.memoria.fixos).toEqual({
      dosha: null,
      cidade: null,
      evitar: [],
      restricoes: [],
      nao_come: [],
    })
    expect(voce.memoria.casa).toEqual({ itens: 0, incertos: 0, acabou: 0, na_lista: 0 })
    expect(voce.memoria.gostos).toEqual([])
    expect(voce.memoria.faltas).toEqual([])
    expect(voce.memoria.rotina).toEqual({ resumo: null, notas: [] })
    expect(voce.memoria.padroes).toEqual([])
    expect(voce.memoria.conversa).toEqual([])
  })
})
