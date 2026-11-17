import { describe, expect, it } from "vitest"
import { type FiltroPessoa, filtroVazio } from "@/core/knowledge/filtros"
import { createKnowledgeBase, type KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Pratica } from "@/core/knowledge/schemas"
import { verbosDasGunas } from "@/core/knowledge/verbos"
import type { Estado, MomentoDoDia } from "@/core/knowledge/vocab"
import { miniDados } from "@/infra/fakes/mini-knowledge"
import { respostaSemModelo } from "./sem-modelo"
import { TEXTO_COM_ATALHOS, TEXTO_LIMITE_COM_ATALHOS, TEXTO_SO_TEXTO } from "./textos"

const modeloBase = miniDados.praticas.find((p) => p.id === "respiracao-lenta") as Pratica

function praticaTeste(id: string, extra: Partial<Pratica> = {}): Pratica {
  return {
    ...modeloBase,
    id,
    nome: `Prática ${id}`,
    ingredientes: [],
    gunas: ["leve"],
    favorece_estados: ["com_frio"],
    momento: ["manha", "tarde", "noite"],
    contraindicacoes: [],
    nunca_sugerir_se: [],
    ...extra,
  }
}

function baseCom(...extras: Pratica[]): KnowledgeBase {
  return createKnowledgeBase(
    { ...miniDados, praticas: [...miniDados.praticas, ...extras] },
    { cobertura: false },
  )
}

function pedido(
  estados: Estado[],
  momento: MomentoDoDia = "tarde",
  filtro: FiltroPessoa = filtroVazio,
) {
  return { estados, momento_do_dia: momento, filtro }
}

describe("textos da resposta sem modelo", () => {
  it("usam exatamente os textos aprovados na spec", () => {
    expect(TEXTO_COM_ATALHOS).toBe(
      "Meu limite de conversas de hoje acabou, então não consigo pensar na sua mensagem com calma. Para você não ficar sem nada, separei direto da base o que costuma ajudar quando a pessoa está {estados}:",
    )
    expect(TEXTO_SO_TEXTO).toBe(
      "Meu limite de conversas de hoje acabou e não consigo ler sua mensagem agora. Se você marcar como está nos atalhos, eu separo direto da base o que costuma ajudar. Minha casa, Como ficou? e as trocas continuam funcionando.",
    )
  })
})

describe("respostaSemModelo", () => {
  it("com um estado, põe o rótulo em minúsculas no texto e devolve até 3 práticas válidas", () => {
    const kb = baseCom(
      praticaTeste("pratica-a"),
      praticaTeste("pratica-b"),
      praticaTeste("pratica-c"),
      praticaTeste("pratica-d"),
    )
    const r = respostaSemModelo(pedido(["com_frio"]), kb)

    expect(r.resposta).toBe(TEXTO_COM_ATALHOS.replace("{estados}", "com frio"))
    expect(r.praticas).toHaveLength(3)
    for (const item of r.praticas) {
      expect(item.pratica_id).toMatch(/^pratica-/)
      expect(item.nome).toBe(`Prática ${item.pratica_id}`)
      expect(item.linha_base).toBe(`praticas:${item.pratica_id}`)
      expect(kb.linha(item.linha_base)).toBeDefined()
      expect(Array.isArray(item.verbos)).toBe(true)
    }
    expect(r.praticas[0]?.verbos).toEqual(verbosDasGunas(["leve"], kb))
  })

  it("junta dois estados com 'e'", () => {
    const r = respostaSemModelo(pedido(["com_frio", "sem_energia"]), baseCom())
    expect(r.resposta).toBe(TEXTO_COM_ATALHOS.replace("{estados}", "com frio e sem energia"))
  })

  it("junta três estados com vírgula e 'e' no último", () => {
    const r = respostaSemModelo(pedido(["com_frio", "pesada", "sem_energia"]), baseCom())
    expect(r.resposta).toBe(
      TEXTO_COM_ATALHOS.replace("{estados}", "com frio, pesada e sem energia"),
    )
  })

  it("só usa práticas do tipo pratica (sem chá nem óleo) que favorecem o estado", () => {
    const r = respostaSemModelo(
      pedido(["com_frio"]),
      createKnowledgeBase(miniDados, { cobertura: false }),
    )
    expect(r.praticas.map((p) => p.pratica_id)).not.toContain("cha-gengibre")
    expect(r.praticas.map((p) => p.pratica_id)).not.toContain("oleo-pes-coco")
  })

  it("nunca devolve prática contraindicada para os estados", () => {
    const kb = baseCom(
      praticaTeste("contraindicada", { contraindicacoes: ["com_frio"] }),
      praticaTeste("liberada"),
    )
    const r = respostaSemModelo(pedido(["com_frio"]), kb)
    expect(r.praticas.map((p) => p.pratica_id)).toEqual(["liberada"])
  })

  it("nunca devolve prática que não cabe no momento do dia", () => {
    const kb = baseCom(
      praticaTeste("so-de-manha", { momento: ["manha"] }),
      praticaTeste("liberada"),
    )
    const r = respostaSemModelo(pedido(["com_frio"], "noite"), kb)
    expect(r.praticas.map((p) => p.pratica_id)).toEqual(["liberada"])
  })

  it("nunca devolve prática barrada pelo filtro da pessoa", () => {
    const kb = baseCom(
      praticaTeste("so-vegana", { nunca_sugerir_se: ["vegana"] }),
      praticaTeste("com-gengibre", { ingredientes: ["gengibre"] }),
      praticaTeste("liberada"),
    )
    const filtro: FiltroPessoa = {
      ...filtroVazio,
      restricoes: ["vegana"],
      nao_come: ["gengibre"],
    }
    const r = respostaSemModelo(pedido(["com_frio"], "tarde", filtro), kb)
    expect(r.praticas.map((p) => p.pratica_id)).toEqual(["liberada"])
  })

  it("com o filtro tirando todas as práticas, devolve o texto com os estados e lista vazia", () => {
    const kb = baseCom(praticaTeste("so-vegana", { nunca_sugerir_se: ["vegana"] }))
    const filtro: FiltroPessoa = { ...filtroVazio, restricoes: ["vegana"] }
    const r = respostaSemModelo(pedido(["com_frio"], "tarde", filtro), kb)
    expect(r.resposta).toBe(TEXTO_COM_ATALHOS.replace("{estados}", "com frio"))
    expect(r.praticas).toEqual([])
  })

  it("ordena pelo que mais combina com os estados, pela nota de adequação", () => {
    const kb = baseCom(
      praticaTeste("sem-combinar", { gunas: ["pesado"] }),
      praticaTeste("combina", { gunas: ["quente"] }),
    )
    const r = respostaSemModelo(pedido(["com_frio"]), kb)
    expect(r.praticas.map((p) => p.pratica_id)).toEqual(["combina", "sem-combinar"])
  })

  it("sem estados, devolve o texto só texto e nenhuma prática", () => {
    const r = respostaSemModelo(pedido([]), baseCom(praticaTeste("liberada")))
    expect(r.resposta).toBe(TEXTO_SO_TEXTO)
    expect(r.praticas).toEqual([])
  })
})

describe("respostaSemModelo com motivo limite", () => {
  it("usa a abertura do limite com estados e as mesmas práticas", () => {
    const kb = baseCom(praticaTeste("pratica-a"))
    const r = respostaSemModelo({ ...pedido(["com_frio"]), motivo: "limite" }, kb)
    expect(TEXTO_LIMITE_COM_ATALHOS).toBe(
      "Suas mensagens de hoje acabaram, mas os atalhos continuam. Separei direto da base o que costuma ajudar quando a pessoa está {estados}:",
    )
    expect(r.resposta).toBe(TEXTO_LIMITE_COM_ATALHOS.replace("{estados}", "com frio"))
    expect(r.praticas.length).toBeGreaterThan(0)
    expect(r.praticas.length).toBeLessThanOrEqual(3)
  })

  it("sem estados, o texto é o mesmo de cota", () => {
    const r = respostaSemModelo({ ...pedido([]), motivo: "limite" }, baseCom())
    expect(r).toEqual({ resposta: TEXTO_SO_TEXTO, praticas: [] })
  })
})
