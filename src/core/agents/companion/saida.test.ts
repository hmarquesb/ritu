import { describe, expect, it } from "vitest"
import { respostaSemModelo } from "@/core/llm/sem-modelo"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { DadosDoPreparo } from "./preparo"
import {
  type Anotacao,
  completarSaida,
  type EntregaDoModelo,
  saidaDeCodigo,
  saidaDoAcompanhanteSchema,
  saidaSegura,
  saidaSemModelo,
} from "./saida"
import { textosDoAcompanhante } from "./textos"

const kb = createMiniKnowledge()

function dados(mudar: Partial<DadosDoPreparo> = {}): DadosDoPreparo {
  return {
    versao: 1,
    intencoes: ["momento"],
    estados: ["com_frio"],
    com_incomodo: false,
    dia: "2026-11-15",
    momento_do_dia: "tarde",
    geral: false,
    qualidades: {
      presentes: ["frio"],
      buscadas: ["quente"],
      evitar_gunas: ["frio"],
      evitar_marcas: [],
      evitar: [{ texto: "gelados e crus", linha_base: "estados:com_frio" }],
      conflitos: [],
      linhas_base: ["estados:com_frio"],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: ["gengibre", "leite", "canela"], incertos: ["cardamomo"] },
    candidatos: [],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: 3,
      itens_incertos_em_casa: 1,
      registros_de_gosto: 0,
      registros_de_resultado: 0,
      retornos_pendentes: 0,
      tem_cidade: true,
    },
    fixos: { evitar_sempre: [], restricoes: [], nao_come: [] },
    padroes: [],
    mensagens_do_dia: [],
    perguntas: { feitas: 0, alimentos: [] },
    nao_come_do_run: [],
    candidatos_completos: [],
    acabou: [],
    nao_tem_do_run: [],
    candidatos_do_preparo: [],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: [],
    ...mudar,
  }
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá ajuda agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

describe("completarSaida", () => {
  it("refeição ganha título, nomes, verbos, modo de fazer e casa", () => {
    const saida = completarSaida(
      entrega({
        sugestoes: [
          {
            tipo: "refeicao",
            preparo_id: "leite-morno-com-especiaria",
            itens: [
              {
                alimento_id: "leite",
                funcao: "liquido",
                contribui: ["pesado"],
                linha_base: "alimentos:leite",
              },
              {
                alimento_id: "canela",
                funcao: "tempero",
                contribui: ["quente"],
                linha_base: "alimentos:canela",
              },
              {
                alimento_id: "mel",
                funcao: "adocante",
                contribui: ["pesado"],
                linha_base: "alimentos:mel",
              },
              {
                alimento_id: "cardamomo",
                contribui: ["quente", "aspero"],
                linha_base: "alimentos:cardamomo",
              },
            ],
            motivo: "Aquece.",
            linhas_base: ["preparos:leite-morno-com-especiaria"],
            novidade: false,
          },
        ],
      }),
      dados(),
      kb,
    )
    const s = saida.sugestoes[0]
    expect(saida.origem).toBe("agente")
    expect(saida.anotacoes).toEqual([])
    expect(s?.titulo).toBe("Leite morno com canela")
    expect(s?.como_fazer).toBe("Aqueça o leite sem deixar ferver, junte canela e, se quiser, mel.")
    expect(s?.itens.map((i) => [i.nome, i.casa])).toEqual([
      ["Leite", "confirmado"],
      ["Canela", "confirmado"],
      ["Mel", "ausente"],
      ["Cardamomo", "incerto"],
    ])
    expect(s?.itens[3]?.verbos).toEqual(["aquece"])
    expect(s?.verbos).toEqual(["nutre", "aquece"])
    expect(s?.aviso).toBeUndefined()
    expect(saidaDoAcompanhanteSchema.safeParse(saida).success).toBe(true)
  })

  it("prática traz nome, preparo, se_faltar com a frase da troca e aviso quando existe", () => {
    const pratica = kb.pratica("cha-gengibre")
    expect(pratica).toBeDefined()
    const saida = completarSaida(
      entrega({
        sugestoes: [
          {
            tipo: "cha",
            pratica_id: "cha-gengibre",
            itens: [
              {
                alimento_id: "gengibre",
                contribui: ["quente"],
                linha_base: "alimentos:gengibre",
                se_faltar: "canela",
              },
            ],
            motivo: "Aquece.",
            linhas_base: ["praticas:cha-gengibre"],
            novidade: true,
          },
        ],
      }),
      dados(),
      kb,
    )
    const s = saida.sugestoes[0]
    expect(s?.titulo).toBe("Chá de gengibre")
    expect(s?.como_fazer).toBe(pratica?.preparo)
    expect(s?.novidade).toBe(true)
    expect(s?.itens[0]?.se_faltar).toEqual({
      alimento_id: "canela",
      nome: "Canela",
      frase: expect.stringMatching(/^Troquei gengibre por canela/),
    })
    expect(saidaDoAcompanhanteSchema.safeParse(saida).success).toBe(true)
  })

  it("avisos por código: incomodo e geral vêm dos textos fixos", () => {
    const saida = completarSaida(entrega(), dados({ com_incomodo: true, geral: true }), kb)
    expect(saida.geral).toBe(true)
    expect(saida.avisos).toEqual([
      { tipo: "incomodo", texto: textosDoAcompanhante.avisoIncomodo },
      { tipo: "geral", texto: textosDoAcompanhante.avisoGeral },
    ])
    expect(completarSaida(entrega(), dados(), kb).avisos).toEqual([])
  })

  it("evitar ganha o texto da linha da base e para_ter ganha verbos e motivo", () => {
    const saida = completarSaida(
      entrega({
        evitar: ["estados:com_frio"],
        para_ter: {
          alimento_id: "gengibre",
          vezes: 3,
          contribui: ["quente"],
          linha_base: "alimentos:gengibre",
        },
      }),
      dados({
        para_ter: {
          alimento_id: "gengibre",
          nome: "Gengibre",
          vezes: 3,
          contribui: ["quente"],
          linha_base: "alimentos:gengibre",
        },
      }),
      kb,
    )
    expect(saida.evitar).toEqual([{ texto: "gelados e crus", linha_base: "estados:com_frio" }])
    expect(saida.para_ter).toEqual({
      alimento_id: "gengibre",
      nome: "Gengibre",
      vezes: 3,
      contribui: ["quente"],
      linha_base: "alimentos:gengibre",
      verbos: ["aquece"],
      motivo: "fez falta 3 vezes nos últimos 30 dias",
    })
  })
})

describe("saidaDeCodigo", () => {
  it("leva a resposta e as anotações, com origem codigo e listas vazias", () => {
    const anotacoes: Anotacao[] = [
      { tipo: "casa_tem", itens: [{ alimento_id: "canela", nome: "Canela" }] },
    ]
    const saida = saidaDeCodigo("Boa, canela em casa.", anotacoes)
    expect(saida).toEqual({
      origem: "codigo",
      resposta: "Boa, canela em casa.",
      geral: false,
      avisos: [],
      explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
      sugestoes: [],
      evitar: [],
      incertos: [],
      citados: [],
      anotacoes,
    })
    expect(saidaDoAcompanhanteSchema.safeParse(saida).success).toBe(true)
  })

  it("aceita todos os tipos de anotação no schema", () => {
    const anotacoes: Anotacao[] = [
      { tipo: "casa_tem", itens: [{ alimento_id: "canela", nome: "Canela" }] },
      { tipo: "casa_acabou", itens: [{ nome: "pitaia" }] },
      { tipo: "evitar_sempre", itens: [{ tipo: "texto", valor: "gelados" }] },
      { tipo: "nao_come", itens: [{ alimento_id: "mel", nome: "Mel" }] },
      { tipo: "gosta", itens: [{ alimento_id: "leite", nome: "Leite" }] },
      { tipo: "restricao", itens: ["vegana"] },
    ]
    expect(saidaDoAcompanhanteSchema.safeParse(saidaDeCodigo("Ok.", anotacoes)).success).toBe(true)
  })
})

describe("saidaSegura", () => {
  it("devolve o texto aprovado, listas vazias e geral dos dados ou false", () => {
    expect(saidaSegura()).toEqual({
      origem: "segura",
      resposta: textosDoAcompanhante.respostaSegura,
      geral: false,
      avisos: [],
      explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
      sugestoes: [],
      evitar: [],
      incertos: [],
      citados: [],
      anotacoes: [],
    })
    expect(saidaSegura(dados({ geral: true })).geral).toBe(true)
    expect(saidaDoAcompanhanteSchema.safeParse(saidaSegura()).success).toBe(true)
  })
})

describe("saidaSemModelo", () => {
  it("vira práticas com motivo vazio e a linha delas", () => {
    const r = respostaSemModelo(
      {
        estados: ["agitada"],
        momento_do_dia: "tarde",
        filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
      },
      kb,
    )
    expect(r.praticas.length).toBeGreaterThan(0)
    const saida = saidaSemModelo(r, dados({ geral: true }), kb)
    expect(saida.origem).toBe("sem_modelo")
    expect(saida.anotacoes).toEqual([])
    expect(saida.resposta).toBe(r.resposta)
    expect(saida.geral).toBe(true)
    expect(saida.sugestoes.map((s) => [s.pratica_id, s.titulo, s.motivo, s.linhas_base])).toEqual(
      r.praticas.map((p) => [p.pratica_id, p.nome, "", [p.linha_base]]),
    )
    expect(saida.sugestoes[0]?.verbos).toEqual(r.praticas[0]?.verbos)
    expect(saidaDoAcompanhanteSchema.safeParse(saida).success).toBe(true)
  })
})
