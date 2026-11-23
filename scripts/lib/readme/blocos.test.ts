import { describe, expect, it } from "vitest"
import type { Historico } from "@/core/evals/historico"
import { blocosDoReadme } from "./blocos"

type Checkpoint = Historico["checkpoints"][number]

function checkpoint(
  id: string,
  data: string,
  metricas: Record<string, number | null>,
  abaixo: string[] = [],
): Checkpoint {
  return {
    checkpoint: id,
    data,
    prompts: {},
    modelos: [],
    casos: 10,
    casos_com_erro: 0,
    metricas: Object.fromEntries(Object.entries(metricas).map(([k, valor]) => [k, { valor }])),
    violacoes_da_1a: {},
    abaixo_da_meta: abaixo,
    criticas: [],
  }
}

const DOIS: Historico = {
  versao: 1,
  checkpoints: [
    checkpoint(
      "c1-base",
      "2026-11-15",
      {
        "trajetoria.correta": 0.5,
        "fidelidade.motivos_fieis": null,
        "autocorrecao.corrigiu": 0.9,
        "seguranca.injection_bloqueada": 1,
        "custo.chamadas_decisao_por_run": 2.4,
      },
      ["trajetoria.correta", "autocorrecao.corrigiu"],
    ),
    checkpoint("c2-conversa", "2026-11-22", {
      "trajetoria.correta": 0.85,
      "fidelidade.motivos_fieis": 0.95,
      "autocorrecao.corrigiu": 0.96,
      "seguranca.injection_bloqueada": 1,
      "custo.chamadas_decisao_por_run": 2.5,
    }),
  ],
}

const UM: Historico = { versao: 1, checkpoints: [DOIS.checkpoints[0] as Checkpoint] }
const ZERO: Historico = { versao: 1, checkpoints: [] }
const SITE = "https://ritu.example"
const ADRS = [
  { numero: "0002", arquivo: "0002-b.md", titulo: "Bê" },
  { numero: "0001", arquivo: "0001-a.md", titulo: "Á" },
]

function gerar(historico: Historico, idioma: "pt" | "en", siteUrl: string | null = SITE) {
  return blocosDoReadme({ historico, adrs: ADRS, siteUrl, idioma })
}

describe("blocosDoReadme · numeros", () => {
  it("monta a tabela com primeiro, último e meta, e marca com ⚠ o valor abaixo da meta", () => {
    const { numeros } = gerar(DOIS, "pt")
    expect(numeros).toContain("| Métrica | Base | Conversa | Meta |")
    expect(numeros).toContain("| Escolheu as consultas certas | ⚠ 50% | 85% | ≥ 80% |")
    expect(numeros).toContain("| Motivos fiéis à base | — | 95% | ≥ 90% |")
    expect(numeros).toContain("| Corrigiu o que o validador apontou | ⚠ 90% | 96% | ≥ 95% |")
    expect(numeros).toContain("| Bloqueou tentativas de injection | 100% | 100% | ≥ 100% |")
    expect(numeros).toContain("| Chamadas ao modelo por resposta | 2,4 | 2,5 | ≤ 3 |")
  })

  it("traz a linha de quantidade e período com os links", () => {
    const { numeros } = gerar(DOIS, "pt")
    expect(numeros).toContain(
      "2 checkpoints, de 2026-11-15 a 2026-11-22. Todos os números em [evals/COMPARACAO.md](evals/COMPARACAO.md) e em [Bastidores](https://ritu.example/bastidores).",
    )
  })

  it("sem siteUrl, cita Bastidores sem link", () => {
    const { numeros } = gerar(DOIS, "pt", null)
    expect(numeros).toContain("e em Bastidores.")
  })

  it("com um checkpoint só, fica uma coluna de valor", () => {
    const { numeros } = gerar(UM, "pt")
    expect(numeros).toContain("| Métrica | Base | Meta |")
    expect(numeros).toContain("| Escolheu as consultas certas | ⚠ 50% | ≥ 80% |")
    expect(numeros).toContain("1 checkpoint, de 2026-11-15 a 2026-11-15.")
  })

  it("sem checkpoint, diz que nenhum rodou ainda", () => {
    expect(gerar(ZERO, "pt").numeros).toBe("Nenhum checkpoint rodado ainda.")
    expect(gerar(ZERO, "en").numeros).toBe("No checkpoint run yet.")
  })

  it("em inglês, usa os rótulos em inglês e a coluna Target", () => {
    const { numeros } = gerar(DOIS, "en")
    expect(numeros).toContain("| Metric | Base | Conversa | Target |")
    expect(numeros).toContain("| Right lookups chosen | ⚠ 50% | 85% | ≥ 80% |")
    expect(numeros).toContain(
      "2 checkpoints, from 2026-11-15 to 2026-11-22. All numbers in [evals/COMPARACAO.md](evals/COMPARACAO.md) and in [Bastidores](https://ritu.example/bastidores).",
    )
  })
})

describe("blocosDoReadme · site", () => {
  it("com siteUrl, é o link para experimentar", () => {
    expect(gerar(DOIS, "pt").site).toBe("[Experimente: https://ritu.example](https://ritu.example)")
    expect(gerar(DOIS, "en").site).toBe("[Try it: https://ritu.example](https://ritu.example)")
  })

  it("sem siteUrl, diz que está no ar em breve", () => {
    expect(gerar(DOIS, "pt", null).site).toBe("No ar em breve.")
    expect(gerar(DOIS, "en", null).site).toBe("Coming soon.")
  })
})

describe("blocosDoReadme · adrs", () => {
  it("lista as ADRs na ordem do número, com link para o arquivo", () => {
    expect(gerar(DOIS, "pt").adrs).toBe("- [0001](.adrs/0001-a.md) Á\n- [0002](.adrs/0002-b.md) Bê")
  })

  it("em inglês, traz a nota de que as ADRs são em português", () => {
    const { adrs } = gerar(DOIS, "en")
    expect(adrs).toContain("ADRs are written in Portuguese.")
    expect(adrs).toContain("- [0001](.adrs/0001-a.md) Á")
  })
})
