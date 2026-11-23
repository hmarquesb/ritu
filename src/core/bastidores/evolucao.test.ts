import { config, textosBastidores } from "@config/index"
import { describe, expect, it } from "vitest"
import { formatarMetrica, montarEvolucao, rotuloDoGrafico } from "@/core/bastidores/evolucao"
import type { Historico } from "@/core/evals/historico"

type Checkpoint = Historico["checkpoints"][number]

function checkpoint(
  nome: string,
  metricas: Checkpoint["metricas"],
  abaixo: string[] = [],
): Checkpoint {
  return {
    checkpoint: nome,
    data: "2026-11-22",
    prompts: {},
    modelos: [],
    casos: 10,
    casos_com_erro: 0,
    metricas,
    violacoes_da_1a: {},
    abaixo_da_meta: abaixo,
    criticas: [],
  }
}

function historico(...checkpoints: Checkpoint[]): Historico {
  return { versao: 1, checkpoints }
}

describe("formatarMetrica", () => {
  it("formata percentual, número, milissegundos e contagem em pt-BR", () => {
    expect(formatarMetrica(0.6666, "pct")).toBe("67%")
    expect(formatarMetrica(2.5, "num")).toBe("2,5")
    expect(formatarMetrica(2, "num")).toBe("2")
    expect(formatarMetrica(3400, "ms")).toBe("3,4 s")
    expect(formatarMetrica(2.4, "contagem")).toBe("2")
  })

  it("devolve travessão para null, em qualquer formato", () => {
    for (const formato of ["pct", "num", "ms", "contagem"] as const) {
      expect(formatarMetrica(null, formato)).toBe("—")
    }
  })
})

describe("montarEvolucao", () => {
  it("histórico sem checkpoint é vazio", () => {
    expect(montarEvolucao(historico(), config.evals.metas)).toEqual({ tipo: "vazia" })
  })

  it("um checkpoint só já monta os cinco gráficos, com o atual", () => {
    const h = historico(checkpoint("c1-base", { "trajetoria.correta": { valor: 0.5 } }))
    const evolucao = montarEvolucao(h, config.evals.metas)
    expect(evolucao.tipo).toBe("ok")
    if (evolucao.tipo !== "ok") return
    expect(evolucao.checkpoints).toHaveLength(1)
    expect(evolucao.graficos).toHaveLength(config.bastidores.destaques.length)
    const correta = evolucao.graficos.find((g) => g.id === "trajetoria.correta")
    expect(correta?.atual?.valor).toBe(0.5)
  })

  it("os gráficos seguem a ordem de config.bastidores.destaques", () => {
    const h = historico(checkpoint("c1-base", {}))
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    expect(evolucao.graficos.map((g) => g.id)).toEqual([...config.bastidores.destaques])
  })

  it("ponto null não entra em atual e fica no gráfico", () => {
    const h = historico(
      checkpoint("c1-base", { "trajetoria.correta": { valor: 0.5 } }),
      checkpoint("c2-conversa", { "trajetoria.correta": { valor: null } }),
    )
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const grafico = evolucao.graficos.find((g) => g.id === "trajetoria.correta")
    expect(grafico?.pontos.map((p) => p.valor)).toEqual([0.5, null])
    expect(grafico?.atual?.checkpoint).toBe("c1-base")
  })

  it("usa o rótulo curto do checkpoint e, sem rótulo, o próprio id", () => {
    const h = historico(checkpoint("c1-base", {}), checkpoint("c9-novo", {}))
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    expect(evolucao.checkpoints.map((c) => c.curto)).toEqual([
      textosBastidores.checkpoints["c1-base"],
      "c9-novo",
    ])
  })

  it("marca abaixo da meta a partir de abaixo_da_meta do checkpoint", () => {
    const h = historico(
      checkpoint("c1-base", { "trajetoria.correta": { valor: 0.5 } }, ["trajetoria.correta"]),
    )
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const grafico = evolucao.graficos.find((g) => g.id === "trajetoria.correta")
    expect(grafico?.pontos[0]?.abaixo).toBe(true)
  })

  it("a meta vem de config.evals.metas: min para pelo menos, max para no máximo", () => {
    const h = historico(checkpoint("c1-base", {}))
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const correta = evolucao.graficos.find((g) => g.id === "trajetoria.correta")
    expect(correta?.meta).toEqual({ tipo: "min", valor: 0.8 })
    const desnecessarias = montarEvolucao(h, config.evals.metas)
    if (desnecessarias.tipo !== "ok") throw new Error("esperava ok")
    const max = desnecessarias.graficos.find((g) => g.id === "custo.chamadas_decisao_por_run")
    expect(max?.meta).toEqual({ tipo: "max", valor: 3 })
  })

  it("tabela: uma coluna por checkpoint, famílias na ordem de textos, null onde falta a métrica", () => {
    const h = historico(
      checkpoint("c1-base", { "intencao.acerto": { valor: 0.9 } }),
      checkpoint("c2-conversa", {}),
    )
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const familias = evolucao.tabela.map((t) => t.familia)
    const ordem = Object.keys(textosBastidores.familias)
    expect(familias).toEqual(ordem.filter((f) => familias.includes(f)))
    const intencao = evolucao.tabela.find((t) => t.familia === "intencao")
    const linha = intencao?.linhas.find((l) => l.id === "intencao.acerto")
    expect(linha?.valores).toEqual([
      { valor: 0.9, abaixo: false },
      { valor: null, abaixo: false },
    ])
  })
})

describe("rotuloDoGrafico", () => {
  it("segue o formato do critério de aceite", () => {
    const h = historico(
      checkpoint("c1-base", { "trajetoria.correta": { valor: 2 / 3 } }),
      checkpoint("c2-conversa", { "trajetoria.correta": { valor: 0.75 } }),
    )
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const grafico = evolucao.graficos.find((g) => g.id === "trajetoria.correta")
    if (!grafico) throw new Error("gráfico ausente")
    expect(rotuloDoGrafico(grafico)).toBe(
      "Escolheu as consultas certas: Base 67%, Conversa 75%. Meta: pelo menos 80%.",
    )
  })

  it("diz 'sem valor' para null e 'abaixo da meta' quando for o caso", () => {
    const h = historico(
      checkpoint("c1-base", { "trajetoria.correta": { valor: 0.5 } }, ["trajetoria.correta"]),
      checkpoint("c2-conversa", { "trajetoria.correta": { valor: null } }),
    )
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const grafico = evolucao.graficos.find((g) => g.id === "trajetoria.correta")
    if (!grafico) throw new Error("gráfico ausente")
    expect(rotuloDoGrafico(grafico)).toBe(
      "Escolheu as consultas certas: Base 50% (abaixo da meta), Conversa sem valor. Meta: pelo menos 80%.",
    )
  })

  it("sem meta, não traz a frase da meta", () => {
    const h = historico(checkpoint("c1-base", {}))
    const evolucao = montarEvolucao(h, config.evals.metas)
    if (evolucao.tipo !== "ok") throw new Error("esperava ok")
    const grafico = evolucao.graficos.find((g) => g.id === "seguranca.injection_bloqueada")
    if (!grafico) throw new Error("gráfico ausente")
    const sem = { ...grafico, meta: undefined }
    expect(rotuloDoGrafico(sem)).not.toContain("Meta")
  })
})
