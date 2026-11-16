import { describe, expect, it } from "vitest"
import { config } from "./index"

function textosDe(valor: unknown): string[] {
  if (typeof valor === "string") return [valor]
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDe)
  return []
}

describe("config", () => {
  it("expõe os limites da entrada e das demonstrações com os valores da spec", () => {
    expect(config.limites.demo.porIpPorDia).toBe(5)
    expect(config.limites.demo.globalPorDia).toBe(30)
    expect(config.limites.demo.duracaoHoras).toBe(24)
    expect(config.limites.sessao.dias).toBe(30)
    expect(config.limites.corpoMaximoBytes).toBe(16_384)
    expect(config.limites.evitar).toEqual({ maxItens: 20, textoLivreCaracteres: 40 })
    expect(config.limites.buscaDeAlimento).toEqual({ minimoCaracteres: 2, maximoResultados: 8 })
  })

  it("expõe a diferença do quiz dual com o valor da spec", () => {
    expect(config.quiz.diferencaDual).toBe(1)
  })

  it("expõe os textos de entrada com as chaves da spec e sem marcação nem a palavra alergia", () => {
    expect(config.textosEntrada.entrada.titulo).toBe("Entrar")
    expect(config.textosEntrada.aviso.demo_limite_ip).toBe(
      "Você já abriu 5 demonstrações hoje. Entre com Google ou volte amanhã.",
    )
    expect(config.textosEntrada.avisoInicial.saude.forte).toBe("Não é orientação médica.")
    expect(config.textosEntrada.quiz.resultado).toBe("Seu dosha é {nome}")
    const textos = textosDe(config.textosEntrada)
    expect(textos.length).toBeGreaterThan(30)
    for (const texto of textos) {
      expect(texto).not.toMatch(/[<>]/)
      expect(texto.toLowerCase()).not.toContain("alergia")
    }
  })

  it("expõe a configuração de telemetria com o painel ritu", () => {
    expect(config.telemetria.grafana.uidDoPainel).toBe("ritu")
  })

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

  it("expõe os prazos de memória com os valores da spec", () => {
    expect(config.memoria.mensagensDias).toBe(7)
    expect(config.memoria.retornosDias).toBe(7)
    expect(config.memoria.faltasDias).toBe(30)
    expect(config.memoria.esperaMinutos).toBe(30)
    expect(config.memoria.historicoLinhas).toBe(20)
  })

  it("expõe os limites das pausas com os valores da spec", () => {
    expect(config.pausas).toEqual({
      maxPerguntasPorRun: 2,
      maxItensPorPergunta: 5,
      maxRefeicoesAPerguntar: 2,
    })
    expect(config.memoria.esperaMinutos).toBe(30)
  })

  it("expõe os limites da aprovação com os valores da spec, e o prazo continua na memória", () => {
    expect(config.aprovacao).toEqual({ maxLinhas: 6, maxFaltouHoje: 1 })
    expect(config.memoria.esperaMinutos).toBe(30)
  })

  it("expõe os limites do loop do agente com os valores da spec", () => {
    expect(config.loop).toEqual({
      maxChamadasDeModelo: 6,
      timeoutTrechoMs: 25_000,
      timeoutPassoMs: 15_000,
      maxTokensPorRun: 60_000,
      maxEntregasRecusadas: 3,
      maxToolsPorPasso: 4,
      maxResultadoDeToolCaracteres: 4_000,
    })
  })

  it("expõe a configuração do Juiz com os valores da spec", () => {
    expect(config.juiz).toEqual({
      maxTentativas: 2,
      chamadasDaNovaTentativa: 2,
      maxTrecho: 120,
      graves: [
        "promessa",
        "dosagem",
        "conselho",
        "evitar_sempre",
        "texto_diferente",
        "motivo_sem_base",
        "para_ter",
        "vulgar",
        "tom",
      ],
      registros: ["jargao"],
    })
  })

  it("expõe a validade da casa por durabilidade com os valores da spec", () => {
    expect(config.casa.validadeDias).toEqual({ curta: 5, media: 14, longa: 90 })
    expect(config.casa.durabilidadeDesconhecido).toBe("media")
  })

  it("expõe os limites dos toques com os valores da spec", () => {
    expect(config.toques).toEqual({ maxTrocasPorItem: 3, substitutosAvaliados: 8 })
  })

  it("expõe as pausas, o limite de erros e a estimativa de chamadas dos evals com os valores da spec", () => {
    expect(config.evals.pausaPorChamadaMs).toBe(4500)
    expect(config.evals.pausaMinimaMs).toBe(4000)
    expect(config.evals.maxErrosSeguidos).toBe(3)
    expect(config.evals.chamadasEstimadas).toEqual({
      acompanhante: 4,
      interprete: 1,
      conversa: 5,
      memoria: 1,
      juiz: 1,
      avaliador: 1,
    })
  })

  it("marca como críticas só as três metas de segurança, linguagem e incômodos", () => {
    const metas: Record<string, { min?: number; max?: number; critica?: boolean }> =
      config.evals.metas
    const criticas = Object.keys(metas).filter((nome) => metas[nome]?.critica === true)
    expect(criticas.sort()).toEqual(
      ["seguranca.bloqueio", "linguagem.alertas_perdidos", "incomodos.promessas_bloqueadas"].sort(),
    )
  })

  it("dá a cada meta de evals um min ou um max, nunca os dois", () => {
    for (const [nome, meta] of Object.entries(config.evals.metas)) {
      const temMin = "min" in meta
      const temMax = "max" in meta
      expect(temMin !== temMax, `meta ${nome} precisa de min ou max, não dos dois`).toBe(true)
    }
  })

  it("expõe os limites dos padrões com os valores da spec", () => {
    expect(config.padroes).toEqual({
      minimoDeOcorrencias: 3,
      consistencia: 0.75,
      janelaDias: 60,
      maxEstadosNaChave: 2,
      maxCandidatosAbertos: 3,
      runsPorConta: 400,
      bloco: { vezesSemResposta: 3 },
    })
  })
})
