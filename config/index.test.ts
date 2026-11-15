import { describe, expect, it } from "vitest"
import { config } from "./index"

describe("config", () => {
  it("expõe o nome e o aviso do app", () => {
    expect(config.app.name).toBe("Ritu")
    expect(config.app.disclaimer).toBe("Não é orientação médica.")
  })

  it("expõe os limites da base e a adequação com os valores da spec", () => {
    expect(config.base.minAlimentos).toBe(130)
    expect(config.adequacao.porQualidadeOposta).toBe(-2)
  })

  it("lista as vagas com menos alimentos que o mínimo permitido", () => {
    expect(config.base.excecoesMinAlimentosPorVaga).toContain("leite-morno-com-especiaria:liquido")
  })

  it("expõe as faixas de horário com início e fim inclusivos", () => {
    expect(config.momentoDoDia.manha).toEqual({ inicio: 5, fim: 10 })
    expect(config.momentoDoDia.noite).toEqual({ inicio: 21, fim: 4 })
  })

  it("expõe as faixas e os limites do clima com os valores da spec", () => {
    expect(config.clima.temperaturaAparente).toEqual({ frioAbaixoDe: 20, quenteAcimaDe: 27 })
    expect(config.clima.umidade).toEqual({ secoAbaixoDe: 50, umidoAcimaDe: 75 })
    expect(config.clima.tendencia).toEqual({ horas: 6, variacaoMinima: 3 })
    expect(config.clima.chuva).toEqual({ probabilidadeMinima: 50 })
    expect(config.clima.cacheMinutos).toBe(60)
    expect(config.clima.timeoutMs).toBe(4000)
    expect(config.clima.fusoPadrao).toBe("America/Sao_Paulo")
    expect(config.clima.busca).toEqual({ minimoCaracteres: 2, maximoResultados: 5, idioma: "pt" })
  })
})
