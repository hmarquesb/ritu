import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Barras } from "@/components/ritu/bastidores/barras"
import { GraficoEvolucao } from "@/components/ritu/bastidores/grafico-evolucao"
import { NumerosDaSemana } from "@/components/ritu/bastidores/numeros-da-semana"
import type { Grafico } from "@/core/bastidores/evolucao"

const fmt = (valor: number | null, formato: string) =>
  valor === null
    ? "—"
    : formato === "pct"
      ? `${Math.round(valor * 100)}%`
      : formato === "ms"
        ? `${(valor / 1000).toFixed(1).replace(".", ",")} s`
        : String(valor).replace(".", ",")

const JANELA = { de: "2026-11-02", ate: "2026-11-08" }

describe("NumerosDaSemana", () => {
  it("abaixo do piso mostra só o número atual", () => {
    const html = renderToStaticMarkup(
      <NumerosDaSemana
        formatarMetrica={fmt}
        numeros={{ tipo: "poucos", janela: JANELA, runs: 19, minimo: 20 }}
      />,
    )
    expect(html).toContain("Ainda pouco uso para mostrar números")
    expect(html).toContain("Por enquanto são 19.")
    expect(html).not.toContain("<dl")
  })

  it("sem números mostra o erro", () => {
    expect(
      renderToStaticMarkup(<NumerosDaSemana formatarMetrica={fmt} numeros={undefined} />),
    ).toContain("Não consegui ler os números agora.")
  })

  it("acima do piso mostra os sete indicadores e usa '—' no denominador zero", () => {
    const html = renderToStaticMarkup(
      <NumerosDaSemana
        formatarMetrica={fmt}
        numeros={{
          tipo: "ok",
          janela: JANELA,
          runs: {
            runs: 20,
            duracao_p50_ms: null,
            passos_medios: 4.5,
            juiz: { julgados: 0, refeitas: 0 },
            trocas_de_modelo: 1,
            intencoes: [
              { intencao: "momento", total: 3 },
              { intencao: "inedita", total: 1 },
            ],
            tools: [{ tool: "clima.agora", total: 5 }],
          },
          sinais: {
            feedback: { up: 2, down: 1 },
            retornos: { ajudou: 3, nao_ajudou: 0, nao_fez: 1 },
          },
        }}
      />,
    )
    expect(html.match(/<dt/g)).toHaveLength(7)
    expect(html).toContain("De 2 de nov. a 8 de nov., dias completos.")
    expect(html).toContain("Como estou agora")
    expect(html).toContain("inedita")
    expect(html).toContain("75%")
    expect(html).toContain("clima.agora")
    expect(html).toContain("—")
  })
})

describe("Barras", () => {
  it("diz o total e a porcentagem em texto e deixa a barra decorativa", () => {
    const html = renderToStaticMarkup(
      <Barras titulo="Tools" itens={[{ rotulo: "a", total: 4, porcentagem: 80 }]} />,
    )
    expect(html).toContain("4 · 80%")
    expect(html).toContain('aria-hidden="true"')
  })
})

const formatar = (valor: number | null) => (valor === null ? "—" : `${Math.round(valor * 100)}%`)

const GRAFICO: Grafico = {
  id: "trajetoria.correta",
  rotulo: "Escolheu as consultas certas",
  formato: "pct",
  meta: { tipo: "min", valor: 0.8 },
  pontos: [
    { checkpoint: "c1-base", curto: "Base", data: "2026-11-01", valor: 0.67, abaixo: true },
    {
      checkpoint: "c2-conversa",
      curto: "Conversa",
      data: "2026-11-02",
      valor: null,
      abaixo: false,
    },
    {
      checkpoint: "c3-confiavel",
      curto: "Confiável",
      data: "2026-11-03",
      valor: 0.75,
      abaixo: false,
    },
  ],
  atual: {
    checkpoint: "c3-confiavel",
    curto: "Confiável",
    data: "2026-11-03",
    valor: 0.75,
    abaixo: false,
  },
}

describe("GraficoEvolucao", () => {
  it("é uma imagem com o nome recebido e marca o ponto abaixo da meta", () => {
    const html = renderToStaticMarkup(
      <GraficoEvolucao grafico={GRAFICO} rotulo="nome do gráfico" formatarMetrica={formatar} />,
    )
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="nome do gráfico"')
    expect(html).toContain("⚠ 67%")
    expect(html).toContain("stroke-dasharray")
    expect(html).toContain("Meta: pelo menos 80%")
    expect(html.match(/<circle/g)).toHaveLength(2)
  })
})
