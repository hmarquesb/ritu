import { describe, expect, it } from "vitest"
import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { linhaParaOJuiz, montarEntradaDoJuiz, nuncaCitar } from "./entrada"

const kb = createMiniKnowledge()

const BASE: SaidaDoAcompanhante = {
  origem: "agente",
  resposta: "",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
}

function saidaCom(parcial: Partial<SaidaDoAcompanhante>): SaidaDoAcompanhante {
  return { ...BASE, ...parcial }
}

type Item = SugestaoEntregue["itens"][number]

function item(parcial: Partial<Item> & Pick<Item, "nome" | "linha_base">): Item {
  return { alimento_id: parcial.nome, contribui: [], verbos: [], casa: "confirmado", ...parcial }
}

function sugestao(parcial: Partial<SugestaoEntregue>): SugestaoEntregue {
  return {
    tipo: "cha",
    titulo: "Chá de gengibre com canela",
    como_fazer: "",
    itens: [],
    verbos: [],
    motivo: "",
    linhas_base: [],
    novidade: false,
    ...parcial,
  }
}

function dadosCom(filtro: Partial<DadosDoPreparo["filtro"]>, evitarTextos: string[] = []) {
  return {
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [], ...filtro },
    evitar_textos: evitarTextos,
  } as DadosDoPreparo
}

describe("linhaParaOJuiz", () => {
  it("alimento começa com o nome e traz virya e efeito", () => {
    const linha = linhaParaOJuiz("alimentos:gengibre", kb)
    expect(linha?.startsWith(kb.alimento("gengibre")?.nome ?? "x")).toBe(true)
    expect(linha).toContain("virya:")
    expect(linha).toContain("efeito: vata")
  })

  it("prática traz favorece com os rótulos dos estados", () => {
    const linha = linhaParaOJuiz("praticas:cha-gengibre", kb)
    expect(linha).toContain("favorece:")
  })

  it("estado traz rótulo, presentes, favorecer e evitar", () => {
    const linha = linhaParaOJuiz("estados:com_frio", kb)
    const rotulo = kb.estados.find((e) => e.id === "com_frio")?.rotulo ?? "x"
    expect(linha?.startsWith(rotulo)).toBe(true)
    expect(linha).toContain("presentes:")
    expect(linha).toContain("favorecer:")
    expect(linha).toContain("evitar:")
  })

  it("incômodo com variante traz o nome, a opção e os campos de qualidade", () => {
    const linha = linhaParaOJuiz("incomodos:dor-de-cabeca/latejante", kb)
    expect(linha?.startsWith("Dor de cabeça: Latejante")).toBe(true)
    expect(linha).toContain("presentes:")
    expect(linha).toContain("evitar:")
  })

  it("incômodo sem variante com uma só variante usa a unica", () => {
    const linha = linhaParaOJuiz("incomodos:gases", kb)
    expect(linha).toContain("presentes:")
  })

  it("incômodo sem variante com mais de uma variante traz só o nome", () => {
    expect(linhaParaOJuiz("incomodos:dor-de-cabeca", kb)).toBe("Dor de cabeça")
  })

  it("fontes e ref inexistente não têm linha", () => {
    expect(linhaParaOJuiz("fontes:x", kb)).toBeUndefined()
    expect(linhaParaOJuiz("alimentos:nao-existe", kb)).toBeUndefined()
    expect(linhaParaOJuiz("incomodos:dor-de-cabeca/nao-existe", kb)).toBeUndefined()
  })
})

describe("nuncaCitar", () => {
  it("junta alimento, grupo, texto livre neutralizado, restrição, não come e evitar_textos sem repetir", () => {
    const dados = dadosCom(
      {
        evitar: [
          { tipo: "alimento", valor: "gengibre" },
          { tipo: "grupo", valor: "castanhas" },
          { tipo: "texto", valor: "<b>" },
        ],
        restricoes: ["vegetariana"],
        nao_come: ["canela"],
      },
      ["<b>", "gelados"],
    )
    expect(nuncaCitar(dados, kb)).toEqual([
      kb.alimento("gengibre")?.nome,
      "Castanhas",
      "‹b›",
      "fora da dieta vegetariana",
      kb.alimento("canela")?.nome,
      "gelados",
    ])
  })
})

describe("montarEntradaDoJuiz", () => {
  it("monta os blocos na ordem do formato, com a saída completa", () => {
    const saida = saidaCom({
      resposta: "Um chá de gengibre com canela pode ajudar.",
      sugestoes: [
        sugestao({
          titulo: "Chá de gengibre com canela",
          itens: [
            item({ nome: "gengibre", linha_base: "alimentos:gengibre" }),
            item({
              nome: "canela",
              linha_base: "alimentos:canela",
              troca: {
                alimento_id: "cardamomo",
                nome: "cardamomo",
                contribui: [],
                verbos: [],
                linha_base: "alimentos:cardamomo",
                frase: "",
                anteriores: [],
              },
            }),
          ],
          motivo: "combina com o frio",
          linhas_base: ["praticas:cha-gengibre"],
        }),
      ],
      evitar: [{ texto: "gelados e crus", linha_base: "estados:com_frio" }],
      para_ter: {
        alimento_id: "cardamomo",
        nome: "cardamomo",
        vezes: 4,
        contribui: [],
        linha_base: "alimentos:cardamomo",
        verbos: [],
        motivo: "fez falta 4 vezes nos últimos 30 dias",
      },
      citados: ["alimentos:banana"],
      incertos: ["se a canela está em casa"],
      avisos: [{ tipo: "incomodo", texto: "x" }],
    })
    const texto = montarEntradaDoJuiz({
      saida,
      evitar: ["castanhas", "camarão"],
      nota_de_rotina: "você almoça fora durante a semana",
      kb,
    })
    const ordem = [
      "<resposta>",
      "<sugestoes>",
      "<evitar_agora>gelados e crus</evitar_agora>",
      "<para_ter>cardamomo: fez falta 4 vezes nos últimos 30 dias</para_ter>",
      `<citados>${kb.alimento("banana")?.nome}</citados>`,
      "<incertos>",
      "<avisos>incomodo</avisos>",
      "<linhas_da_base>",
      "<nunca_citar>castanhas, camarão</nunca_citar>",
      "<nota_de_rotina>você almoça fora durante a semana</nota_de_rotina>",
    ]
    let posicao = -1
    for (const trecho of ordem) {
      const proxima = texto.indexOf(trecho, posicao + 1)
      expect(proxima, trecho).toBeGreaterThan(posicao)
      posicao = proxima
    }
    expect(texto).toContain(
      "1. cha: Chá de gengibre com canela | itens: gengibre, canela (trocado por cardamomo) | motivo: combina com o frio",
    )
    expect(texto).toContain("alimentos:gengibre: Gengibre")
    expect(texto).toContain("praticas:cha-gengibre: ")
  })

  it("saída sem para_ter, sem citados e sem nota não tem esses blocos", () => {
    const texto = montarEntradaDoJuiz({
      saida: saidaCom({ resposta: "Oi." }),
      evitar: [],
      kb,
    })
    expect(texto).toContain("<resposta>\nOi.\n</resposta>")
    expect(texto).not.toContain("<para_ter>")
    expect(texto).not.toContain("<citados>")
    expect(texto).not.toContain("<nota_de_rotina>")
    expect(texto).not.toContain("<nunca_citar>")
  })

  it("< e > da resposta, do motivo, do incerto, da nota e de nunca_citar saem como ‹ e ›", () => {
    const texto = montarEntradaDoJuiz({
      saida: saidaCom({
        resposta: "a < b > c",
        sugestoes: [sugestao({ motivo: "x<y>", itens: [] })],
        incertos: ["p<q>"],
      }),
      evitar: ["<z>"],
      nota_de_rotina: "n<m>",
      kb,
    })
    expect(texto).toContain("<resposta>\na ‹ b › c\n</resposta>")
    expect(texto).toContain("motivo: x‹y›")
    expect(texto).toContain("<incertos>\np‹q›\n</incertos>")
    expect(texto).toContain("<nota_de_rotina>n‹m›</nota_de_rotina>")
    expect(texto).toContain("<nunca_citar>‹z›</nunca_citar>")
  })

  it("linha da base repetida entra uma vez e a inexistente não entra", () => {
    const texto = montarEntradaDoJuiz({
      saida: saidaCom({
        sugestoes: [
          sugestao({
            itens: [item({ nome: "gengibre", linha_base: "alimentos:gengibre" })],
            linhas_base: ["alimentos:gengibre", "alimentos:nao-existe"],
          }),
        ],
        evitar: [{ texto: "x", linha_base: "alimentos:gengibre" }],
      }),
      evitar: [],
      kb,
    })
    const bloco = texto.slice(texto.indexOf("<linhas_da_base>"), texto.indexOf("</linhas_da_base>"))
    expect(bloco.split("alimentos:gengibre:").length - 1).toBe(1)
    expect(texto).not.toContain("alimentos:nao-existe")
  })
})
