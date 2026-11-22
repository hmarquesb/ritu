import { describe, expect, it } from "vitest"
import type { Candidato } from "@/core/ranking/tipos"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { completarEntrega, emTermosDaEscolha } from "./completar"
import type { EntradaDoAcompanhante } from "./entrada"
import { type DadosDoPreparo, preparar } from "./preparo"
import type { EscolhaDoModelo } from "./saida"
import { validarEntrega } from "./validador"

const kb = createMiniKnowledge()

async function dadosDe(
  parcial: Partial<EntradaDoAcompanhante>,
  iso = "2026-11-15T18:00:00.000Z",
): Promise<DadosDoPreparo> {
  const clock = createFixedClock(iso)
  const stores = createMemoryStores(clock)
  const deps = { stores, kb, clock, telemetry: createMemoryTelemetry() }
  const entrada = { intencoes: ["momento"], estados: [], evitar_da_mensagem: [], ...parcial }
  return preparar(deps, "conta-1", entrada as EntradaDoAcompanhante)
}

const item = (alimento_id: string, funcao: string): Candidato["itens"][number] =>
  ({
    alimento_id,
    nome: alimento_id,
    funcao,
    casa: "confirmado",
    contribui: ["quente"],
    linha_base: `alimentos:${alimento_id}`,
  }) as never

function refeicao(): Candidato {
  return {
    tipo: "refeicao",
    id: "leite-morno-com-especiaria",
    nome: "Leite morno",
    itens: [item("leite", "liquido"), item("canela", "tempero")],
    opcoes: {
      liquido: [item("leite", "liquido")],
      tempero: [item("canela", "tempero"), item("cardamomo", "tempero")],
    },
    contribui: ["quente"],
    linha_base: "preparos:leite-morno-com-especiaria",
    adequacao: 1,
    nota: 1,
    gosta: false,
    ajudou: 0,
    novidade: true,
    no_fim: false,
  }
}

async function comRefeicao(mudar: Partial<DadosDoPreparo> = {}): Promise<DadosDoPreparo> {
  const base = await dadosDe({ estados: ["com_frio"] })
  return {
    ...base,
    candidatos: [refeicao()],
    casa: { confirmados: ["leite", "canela", "cardamomo"], incertos: [] },
    ...mudar,
  }
}

const sinais = { em_casa: ["leite", "canela", "cardamomo", "gengibre"], gosta: [], ajudou: {} }
const minima = (c: Candidato): EscolhaDoModelo => ({
  resposta: "Algo morno pode ajudar agora.",
  sugestoes: [{ tipo: c.tipo, id: c.id, motivo: "Aquece." }],
  incertos: [],
})

describe("completarEntrega", () => {
  const cenarios: [string, Partial<EntradaDoAcompanhante>, string][] = [
    ["frio", { estados: ["com_frio"] }, "2026-11-15T18:00:00.000Z"],
    ["frio e agitada", { estados: ["com_frio", "agitada"] }, "2026-11-15T12:00:00.000Z"],
    ["jantar", { estados: ["com_frio", "agitada"] }, "2026-11-15T22:00:00.000Z"],
  ]
  for (const [nome, entrada, iso] of cenarios) {
    it(`escolha mínima de cada candidato (${nome}) não tem violação de montagem`, async () => {
      const dados = await dadosDe(entrada, iso)
      for (const c of dados.candidatos) {
        const m = completarEntrega(minima(c), { dados, kb })
        expect(m.ok).toBe(true)
        if (!m.ok) continue
        const v = validarEntrega(m.entrega, { dados, kb, sinais })
        expect(v.filter((x) => x.origem === "montagem")).toEqual([])
      }
    })
  }

  it("monta tipo, ids, itens, linhas e novidade a partir do candidato", async () => {
    const dados = await comRefeicao()
    const m = completarEntrega(minima(refeicao()), { dados, kb })
    expect(m.ok).toBe(true)
    if (!m.ok) return
    const s = m.entrega.sugestoes[0]
    expect(s?.preparo_id).toBe("leite-morno-com-especiaria")
    expect(s?.pratica_id).toBeUndefined()
    expect(s?.itens.map((i) => i.alimento_id)).toEqual(["leite", "canela"])
    expect(s?.linhas_base).toEqual(["preparos:leite-morno-com-especiaria"])
    expect(s?.novidade).toBe(true)
  })

  it("id fora dos candidatos lista os aceitos", async () => {
    const dados = await comRefeicao()
    const m = completarEntrega(
      { ...minima(refeicao()), sugestoes: [{ tipo: "cha", id: "nada", motivo: "x" }] },
      { dados, kb },
    )
    expect(m.ok).toBe(false)
    if (m.ok) return
    expect(m.violacoes[0]).toMatchObject({
      codigo: "fora_dos_candidatos",
      onde: "sugestoes[0]",
      origem: "modelo",
    })
    expect(m.violacoes[0]?.mensagem).toContain("leite-morno-com-especiaria")
  })

  it("escolha de vaga troca o item e fora das opcoes é estrutura", async () => {
    const dados = await comRefeicao()
    const base = minima(refeicao())
    const boa = completarEntrega(
      {
        ...base,
        sugestoes: [
          {
            tipo: "refeicao",
            id: "leite-morno-com-especiaria",
            motivo: "x",
            escolhas: [{ funcao: "tempero", alimento_id: "cardamomo" }],
          },
        ],
      },
      { dados, kb },
    )
    expect(boa.ok && boa.entrega.sugestoes[0]?.itens.map((i) => i.alimento_id)).toEqual([
      "leite",
      "cardamomo",
    ])
    const ruim = completarEntrega(
      {
        ...base,
        sugestoes: [
          {
            tipo: "refeicao",
            id: "leite-morno-com-especiaria",
            motivo: "x",
            escolhas: [{ funcao: "tempero", alimento_id: "gengibre" }],
          },
        ],
      },
      { dados, kb },
    )
    expect(ruim.ok).toBe(false)
    if (!ruim.ok) {
      expect(ruim.violacoes[0]).toMatchObject({
        codigo: "estrutura",
        onde: "sugestoes[0].escolhas[0]",
      })
    }
  })

  it("funcao que o preparo não tem é estrutura", async () => {
    const dados = await comRefeicao()
    const m = completarEntrega(
      {
        ...minima(refeicao()),
        sugestoes: [
          {
            tipo: "refeicao",
            id: "leite-morno-com-especiaria",
            motivo: "x",
            escolhas: [{ funcao: "base", alimento_id: "arroz-branco" }],
          },
        ],
      },
      { dados, kb },
    )
    expect(!m.ok && m.violacoes[0]?.codigo).toBe("estrutura")
  })

  it("escolhas em prática e candidato sem opcoes são estrutura", async () => {
    const dados = await dadosDe({ estados: ["com_frio"] })
    const cha = dados.candidatos.find((c) => c.tipo === "cha") as Candidato
    const m = completarEntrega(
      {
        ...minima(cha),
        sugestoes: [
          {
            tipo: "cha",
            id: cha.id,
            motivo: "x",
            escolhas: [{ funcao: "tempero", alimento_id: "canela" }],
          },
        ],
      },
      { dados, kb },
    )
    expect(!m.ok && m.violacoes[0]?.codigo).toBe("estrutura")
    const semOpcoes = { ...refeicao(), opcoes: undefined }
    const d2 = await comRefeicao({ candidatos: [semOpcoes] })
    const m2 = completarEntrega(
      {
        ...minima(semOpcoes),
        sugestoes: [
          {
            tipo: "refeicao",
            id: semOpcoes.id,
            motivo: "x",
            escolhas: [{ funcao: "tempero", alimento_id: "canela" }],
          },
        ],
      },
      { dados: d2, kb },
    )
    expect(!m2.ok && m2.violacoes[0]?.mensagem).toBe(
      "esse candidato não tem opções; use o item padrão",
    )
  })

  it("trocas viram se_faltar em item incerto e são ignoradas em item confirmado", async () => {
    const dados = await comRefeicao({
      casa: { confirmados: ["leite", "cardamomo"], incertos: ["canela"] },
    })
    const m = completarEntrega(
      {
        ...minima(refeicao()),
        sugestoes: [
          {
            tipo: "refeicao",
            id: "leite-morno-com-especiaria",
            motivo: "x",
            trocas: [
              { alimento_id: "canela", se_faltar: "cardamomo" },
              { alimento_id: "leite", se_faltar: "mel" },
            ],
          },
        ],
      },
      { dados, kb },
    )
    expect(m.ok && m.entrega.sugestoes[0]?.itens.map((i) => i.se_faltar)).toEqual([
      undefined,
      "cardamomo",
    ])
  })

  it("para_ter true sem para_ter no contexto é violação; com, copia os campos", async () => {
    const dados = await comRefeicao()
    const pedido = { ...minima(refeicao()), para_ter: true as const }
    const sem = completarEntrega(pedido, { dados, kb })
    expect(!sem.ok && sem.violacoes[0]).toMatchObject({ codigo: "para_ter", origem: "modelo" })
    const para_ter = {
      alimento_id: "gengibre",
      nome: "Gengibre",
      vezes: 3,
      contribui: ["quente" as const],
      linha_base: "alimentos:gengibre",
    }
    const com = completarEntrega(pedido, { dados: { ...dados, para_ter }, kb })
    expect(com.ok && com.entrega.para_ter).toEqual({
      alimento_id: "gengibre",
      vezes: 3,
      contribui: ["quente"],
      linha_base: "alimentos:gengibre",
    })
  })

  it("citados saem da fala e o filtro de evitar sempre ainda aponta", async () => {
    const dados = await comRefeicao({
      filtro: {
        evitar: [{ tipo: "alimento", valor: "gengibre" }],
        restricoes: [],
        nao_come: [],
        nao_gosta: [],
      },
    })
    const m = completarEntrega(
      { ...minima(refeicao()), resposta: "Um pouco de gengibre também cai bem." },
      { dados, kb },
    )
    expect(m.ok && m.entrega.citados).toEqual(["alimentos:gengibre"])
    if (!m.ok) return
    const v = validarEntrega(m.entrega, { dados, kb, sinais })
    expect(v.map((x) => x.codigo)).toContain("evitar_sempre")
  })

  it("explicacao sem clima vem do momento; com clima soma gunas e opostos sem repetir", async () => {
    const dados = await comRefeicao()
    const sem = completarEntrega(minima(refeicao()), { dados, kb })
    expect(sem.ok && sem.entrega.explicacao).toEqual({
      qualidades_do_momento: dados.qualidades.presentes,
      qualidades_buscadas: dados.qualidades.buscadas,
    })
    const com = completarEntrega(minima(refeicao()), { dados, kb, clima: { gunas: ["frio"] } })
    expect(com.ok && com.entrega.explicacao.qualidades_do_momento).toContain("frio")
    expect(com.ok && com.entrega.explicacao.qualidades_buscadas).toContain("quente")
    if (com.ok) {
      const b = com.entrega.explicacao.qualidades_buscadas
      expect(new Set(b).size).toBe(b.length)
    }
  })

  it("evitar vem de todas as linhas do contexto", async () => {
    const dados = await comRefeicao()
    const m = completarEntrega(minima(refeicao()), { dados, kb })
    expect(m.ok && m.entrega.evitar).toEqual(dados.qualidades.evitar.map((e) => e.linha_base))
  })
})

describe("emTermosDaEscolha", () => {
  it("reescreve o onde em escolhas, trocas e sugestão", async () => {
    const dados = await comRefeicao({
      casa: { confirmados: ["leite", "cardamomo"], incertos: ["canela"] },
    })
    const escolha: EscolhaDoModelo = {
      ...minima(refeicao()),
      sugestoes: [
        {
          tipo: "refeicao",
          id: "leite-morno-com-especiaria",
          motivo: "x",
          escolhas: [{ funcao: "tempero", alimento_id: "cardamomo" }],
        },
      ],
    }
    const m = completarEntrega(escolha, { dados, kb })
    if (!m.ok) throw new Error("montagem")
    const base = { codigo: "fora_de_casa" as const, origem: "modelo" as const, mensagem: "m" }
    const r = emTermosDaEscolha(
      [
        { ...base, onde: "sugestoes[0].itens[1]" },
        { ...base, onde: "sugestoes[0].itens[0]" },
        { ...base, onde: "sugestoes[0].itens[1].se_faltar" },
        { ...base, codigo: "qualidades", origem: "montagem", onde: "sugestoes[0].itens[1]" },
      ],
      escolha,
      m.entrega,
    )
    expect(r.map((x) => x.onde)).toEqual([
      "sugestoes[0].escolhas[0]",
      "sugestoes[0]",
      "sugestoes[0]",
      "sugestoes[0].itens[1]",
    ])
  })
})
