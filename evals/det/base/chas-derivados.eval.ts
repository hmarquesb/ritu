import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { EntradaDoAcompanhante } from "@/core/agents/companion/entrada"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { MOMENTOS_DO_DIA, type MomentoDoDia } from "@/core/knowledge/vocab"
import { getContainer } from "@/infra/container"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Os chás derivados de ervas com `cha` na base real: campos, candidatos por momento e estado, "acabou", "evitar sempre" e os estimulantes.

const kb = getContainer().knowledge
const CONTA = "conta-1"
const DIA = "2026-11-15"
const FRIO_AGITADA: EntradaDoAcompanhante["estados"] = ["com_frio", "agitada"]
const ESTIMULANTES = ["cha-preto", "cha-mate", "cha-verde"]

// Hora local de São Paulo (UTC-3) no início de cada momento do dia.
function isoNoMomento(momento: MomentoDoDia): string {
  const utc = config.momentoDoDia[momento].inicio + 3
  const dia = utc >= 24 ? "2026-11-16" : DIA
  return `${dia}T${String(utc % 24).padStart(2, "0")}:00:00.000Z`
}

const TARDE = isoNoMomento("tarde")
const NOITE = isoNoMomento("noite")

const DERIVADOS = [
  {
    id: "cha-louro",
    favorece: ["com_frio", "pesada", "agitada", "sem_energia"],
    contraindicacoes: ["com_calor"],
    momento: MOMENTOS_DO_DIA,
  },
  {
    id: "cha-alecrim",
    favorece: ["com_frio", "pesada", "sem_energia"],
    contraindicacoes: ["com_calor"],
    momento: MOMENTOS_DO_DIA,
  },
  {
    id: "cha-manjericao",
    favorece: ["pesada", "sem_energia"],
    contraindicacoes: ["com_frio"],
    momento: MOMENTOS_DO_DIA,
  },
  {
    id: "cha-preto",
    favorece: ["pesada", "sem_energia"],
    contraindicacoes: ["com_calor"],
    momento: ["manha", "tarde"],
  },
  {
    id: "cha-mate",
    favorece: ["pesada", "sem_energia"],
    contraindicacoes: ["com_calor"],
    momento: ["manha", "tarde"],
  },
  {
    id: "cha-verde",
    favorece: ["pesada", "sem_energia"],
    contraindicacoes: ["com_calor"],
    momento: ["manha", "tarde"],
  },
] as const

function montar(iso: string) {
  const clock = createFixedClock(iso)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const run = (parcial: Partial<EntradaDoAcompanhante> = {}): Promise<DadosDoPreparo> =>
    preparar(deps, CONTA, {
      intencoes: ["momento"],
      estados: [],
      evitar_da_mensagem: [],
      ...parcial,
    })
  return { stores, run }
}

const idsDeCha = (dados: DadosDoPreparo): string[] =>
  dados.candidatos.filter((c) => c.tipo === "cha").map((c) => c.id)

const ordenado = (lista: readonly string[]): string[] => [...lista].sort()

describe("chás derivados: campos da base real", () => {
  it("a base tem 50 práticas: 44 fixas e 6 derivadas", () => {
    expect(kb.praticas).toHaveLength(50)
    const derivadas: string[] = DERIVADOS.map((d) => d.id)
    expect(kb.praticas.filter((p) => !derivadas.includes(p.id))).toHaveLength(44)
  })

  it('nome: louro e preto saem como "Chá de louro" e "Chá preto"', () => {
    expect(kb.pratica("cha-louro")?.nome).toBe("Chá de louro")
    expect(kb.pratica("cha-preto")?.nome).toBe("Chá preto")
  })

  it.each(DERIVADOS)("$id: qualidades, estados e momentos da tabela", (esperado) => {
    const pratica = kb.pratica(esperado.id)
    expect(pratica, esperado.id).toBeDefined()
    expect(pratica?.tipo).toBe("cha")
    expect(ordenado(pratica?.favorece_estados ?? [])).toEqual(ordenado(esperado.favorece))
    expect(ordenado(pratica?.contraindicacoes ?? [])).toEqual(ordenado(esperado.contraindicacoes))
    expect(ordenado(pratica?.momento ?? [])).toEqual(ordenado(esperado.momento))
  })

  it("o chá derivado de louro tem a linha da base e a fonte das regras", () => {
    expect(kb.linha("praticas:cha-louro")).toMatchObject({ tipo: "cha" })
    expect(kb.pratica("cha-louro")?.fontes.map((f) => f.ref)).toContain("ritu-regras-da-base")
  })
})

describe("cha-derivado-frio-agitada: louro entra, canela não, nenhum chá é movel", () => {
  it("à tarde, com frio e agitada, casa com louro e canela: louro é candidato de chá", async () => {
    const { stores, run } = montar(TARDE)
    // Sem prakriti, a adequação do louro com frio e agitada é 0 (quente +2, leve -2). Com vata
    // dominante, o efeito do louro entra (vata -1 × porPontoDeEfeito -1 = +0.6), e ele sobe acima de zero.
    await stores.profiles.definirPrakriti(CONTA, { vata: 0.6, pitta: 0.2, kapha: 0.2 }, "declarado")
    await stores.pantry.registrar(
      CONTA,
      [{ alimento_id: "louro" }, { alimento_id: "canela" }],
      "tela",
    )
    const dados = await run({ estados: FRIO_AGITADA })
    const chas = idsDeCha(dados)

    expect(chas).toContain("cha-louro")
    expect(chas).not.toContain("cha-gengibre-canela")
    for (const id of chas) {
      expect(kb.pratica(id)?.gunas ?? [], id).not.toContain("movel")
    }
  })
})

// Controle: com frio, o louro é candidato de chá à tarde, então as exclusões abaixo têm efeito.
const ESTADO_DO_CONTROLE: EntradaDoAcompanhante["estados"] = ["com_frio"]

describe("cha-derivado-acabou: louro acabado sai dos candidatos e vira falta", () => {
  it("controle: sem acabou, com frio à tarde, cha-louro é candidato", async () => {
    const { run } = montar(TARDE)
    const dados = await run({ estados: ESTADO_DO_CONTROLE })
    expect(dados.candidatos_completos).toContain("cha-louro")
  })

  it("louro marcado como acabou: cha-louro sai e a falta fica registrada", async () => {
    const { stores, run } = montar(TARDE)
    await stores.pantry.marcarAcabou(CONTA, [{ alimento_id: "louro" }])
    await stores.shortages.registrar(CONTA, [{ alimento_id: "louro", origem: "nao_tenho" }], DIA)

    const dados = await run({ estados: ESTADO_DO_CONTROLE })
    expect(idsDeCha(dados)).not.toContain("cha-louro")

    const faltas = await stores.shortages.diasComFalta(CONTA, "2026-11-01")
    expect(faltas.map((f) => f.alimento_id)).toContain("louro")
  })
})

describe("cha-derivado-evitar-sempre: louro evitado nunca é candidato", () => {
  it("controle: sem evitar sempre, cha-louro é candidato com frio à tarde", async () => {
    const { run } = montar(TARDE)
    const dados = await run({ estados: ESTADO_DO_CONTROLE })
    expect(dados.candidatos_completos).toContain("cha-louro")
  })

  it("com louro em evitar sempre, cha-louro não aparece em nenhum momento", async () => {
    for (const momento of MOMENTOS_DO_DIA) {
      const { stores, run } = montar(isoNoMomento(momento))
      await stores.profiles.acrescentarEvitarSempre(CONTA, [{ tipo: "alimento", valor: "louro" }])
      const dados = await run({ estados: ESTADO_DO_CONTROLE })
      expect(idsDeCha(dados), momento).not.toContain("cha-louro")
    }
  })
})

describe("cha-estimulante-noite: chás estimulantes não servem à noite nem com agitada", () => {
  it("à noite, nenhum estimulante é candidato de chá", async () => {
    for (const id of ESTIMULANTES) expect(kb.pratica(id), id).toBeDefined()
    const { run } = montar(NOITE)
    const dados = await run({ estados: ["com_frio", "pesada", "sem_energia"] })

    for (const id of ESTIMULANTES) expect(idsDeCha(dados), id).not.toContain(id)
  })

  it("com agitada, nenhum estimulante é candidato em nenhum momento do dia", async () => {
    for (const momento of MOMENTOS_DO_DIA) {
      const { run } = montar(isoNoMomento(momento))
      const dados = await run({ estados: ["agitada"] })
      for (const id of ESTIMULANTES) expect(idsDeCha(dados), `${momento} ${id}`).not.toContain(id)
    }
  })
})
