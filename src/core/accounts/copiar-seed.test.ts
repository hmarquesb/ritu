import { describe, expect, it } from "vitest"
import type { DemoSeed } from "@/core/demo-seed"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { copiarSeed } from "./copiar-seed"

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
    cidade: { nome: "Rio de Janeiro", lat: -22.9, lon: -43.17, fuso: "America/Sao_Paulo" },
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

async function nova() {
  const stores = createMemoryStores(clock)
  const conta = await stores.accounts.criar({ tipo: "demo", expira_em: clock.now() })
  return { stores, conta }
}

describe("copiarSeed", () => {
  it("copia perfil, casa, gostos, faltas, rotina e padrão", async () => {
    const { stores, conta } = await nova()
    await copiarSeed(stores, conta.id, seed, { clock, kb })

    const perfil = await stores.profiles.ler(conta.id)
    expect(perfil.origem).toBe("quiz")
    expect(perfil.prakriti).toEqual(seed.perfil.prakriti)
    expect(perfil.cidade_nome).toBe("Rio de Janeiro")
    expect(perfil.evitar_sempre.map((e) => e.valor)).toEqual(["castanhas"])
    expect(await stores.pantry.listar(conta.id)).toHaveLength(2)
    const [pref] = await stores.preferences.ler(conta.id)
    expect(pref).toMatchObject({ gosto: "gosta", ajudou: 2, nao_fez: 1 })
    const faltas = await stores.shortages.diasComFalta(conta.id, "2026-03-01")
    expect(faltas).toEqual([{ alimento_id: "cardamomo", dias: 3, ultimo_dia: "2026-03-09" }])
    expect((await stores.routine.notasAtivas(conta.id)).map((n) => n.texto)).toEqual(seed.rotina)
    expect((await stores.routine.resumo(conta.id))?.texto).toBe("Janto tarde. Acordo cedo.")
    const padroes = await stores.patterns.listar(conta.id, "candidato")
    expect(padroes).toHaveLength(1)
    expect(padroes[0]?.frase).toBe("Quando você está com frio, chá de gengibre costuma te ajudar.")
  })

  it("copia o histórico nos dias certos, com retornos respondidos e aguardando", async () => {
    const { stores, conta } = await nova()
    await copiarSeed(stores, conta.id, seed, { clock, kb })

    expect((await stores.messages.doDia(conta.id, "2026-03-09")).map((m) => m.autor)).toEqual([
      "pessoa",
      "agente",
    ])
    expect(await stores.messages.doDia(conta.id, "2026-03-05")).toHaveLength(2)
    const pendentes = await stores.outcomes.pendentes(conta.id)
    expect(pendentes).toHaveLength(1)
    const recentes = await stores.runs.recentes(conta.id, new Date("2026-01-01"), 10)
    expect(recentes).toHaveLength(3)
    expect(recentes[0]).toMatchObject({ caminho: "acompanhante", prompt_versao: "semente" })
    expect(recentes[0]?.juiz_aprovado).toBe(true)
  })

  it("com padrão de chá, grava a chave com cha e a frase genérica", async () => {
    const { stores, conta } = await nova()
    const comCha: DemoSeed = {
      ...seed,
      padrao: { estados: ["com_frio", "agitada"], item: { tipo: "cha" }, ocorrencias: 3 },
    }
    await copiarSeed(stores, conta.id, comCha, { clock, kb })

    const [padrao] = await stores.patterns.listar(conta.id, "candidato")
    expect(padrao?.chave).toBe("com_frio+agitada|cha")
    expect(padrao?.frase).toBe("Quando você está com frio e agitada, um chá costuma te ajudar.")
  })

  it("falha no meio propaga o erro", async () => {
    const { stores, conta } = await nova()
    stores.shortages.registrar = async () => {
      throw new Error("falhou")
    }
    await expect(copiarSeed(stores, conta.id, seed, { clock, kb })).rejects.toThrow("falhou")
  })
})
