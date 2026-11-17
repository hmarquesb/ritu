import { describe, expect, it } from "vitest"
import { GRUPOS } from "../src/core/knowledge/vocab"
import { config, telaConversa, textosConversa } from "./index"
import { formatar } from "./textos-conversa"

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

  it("expõe a configuração da tela de conversa com os valores da spec", () => {
    expect(telaConversa).toEqual({
      consultaDoRun: { intervaloMs: 2000, maximoMs: 90_000 },
      rotaMaxDurationS: 60,
      contadorAPartirDe: 800,
    })
  })

  it("expõe os textos da tela de conversa com as chaves e os textos da spec", () => {
    expect(textosConversa.caixa.rotulo).toBe("Sua mensagem")
    expect(textosConversa.caixa.longa).toBe("{n} de 1000 caracteres")
    expect(textosConversa.etapas.passos).toBe("Pensei em {n} passos")
    expect(textosConversa.etapas.passo).toBe("Pensei em 1 passo")
    expect(textosConversa.bloco.anotei).toBe("Anotei {n} de {m}.")
    expect(textosConversa.pergunta.opcoesCasa).toBe("Tenho · Não tenho · Não gosto")
    expect(textosConversa.sugestao.menuItens).toBe("Trocar · Não tenho · Não gosto")
    expect(textosConversa.abas.voce).toBe("Você")
    expect(textosConversa.emBreve).toBe("Esta parte chega em breve.")
    expect(textosConversa.erro.rede).toBe(
      "Não consegui falar com o Ritu agora. Sua mensagem continua aqui.",
    )
    expect(textosConversa.rodape.aviso).toBe("Não é orientação médica.")
  })

  it("expõe os textos de Minha casa com os grupos de GRUPOS e os placeholders da spec", () => {
    expect(Object.keys(config.textosCasa.grupos).sort()).toEqual([...GRUPOS].sort())
    expect(config.textosCasa.aindaTem.rotuloTenho).toContain("{item}")
    expect(config.textosCasa.adicionado).toBe("{Item} está na sua casa.")
  })

  it("expõe os textos de Como ficou? com o placeholder de dias da spec", () => {
    expect(config.textosComoFicou.dia.dias).toContain("{n}")
    expect(config.textosComoFicou.titulo).toBe("Como ficou?")
  })

  it("formata os placeholders e deixa literal a chave ausente", () => {
    expect(formatar("Anotei {n} de {m}.", { n: 2, m: 3 })).toBe("Anotei 2 de 3.")
    expect(formatar("Opções para {item}", {})).toBe("Opções para {item}")
    expect(formatar("Oi {nome}, {n} itens", { n: 4 })).toBe("Oi {nome}, 4 itens")
  })

  it("expõe os textos de Você com as chaves e os textos da spec", () => {
    expect(config.textosVoce.titulo).toBe("Você")
    expect(config.textosVoce.dosha.titulo).toBe("Seu dosha")
    expect(config.textosVoce.dosha.proporcao).toBe("{n}% {Dosha}")
    expect(config.textosVoce.nivel.casa.vazio).toBe("Nada anotado na sua casa ainda.")
    expect(config.textosVoce.nivel.fixos.titulo).toBe("Fixos")
    expect(config.textosVoce.conta.apagarTudo).toBe("Apagar tudo")
    expect(config.textosVoce.confirma.esqueci).toBe("Esqueci {item}.")
    expect(config.textosVoce.erro).toBe("Não consegui anotar agora. Nada mudou; tente de novo.")
  })

  it("expõe o aviso dados_apagados da Entrada com o texto da spec", () => {
    expect(config.textosEntrada.aviso.dados_apagados).toBe("Seus dados foram apagados.")
  })

  it("expõe os textos de Como pensei com as frases dos passos, as intenções e os códigos da spec", () => {
    expect(config.textosComoPensei.titulo).toBe("Como pensei")
    expect(config.textosComoPensei.passos.entendi.intencoes).toBe(
      "Entendi que você falou de {intencoes}.",
    )
    expect(config.textosComoPensei.passos.fim.semSugestoes).toBe("Entreguei a resposta.")
    expect(config.textosComoPensei.intencoes.retorno).toBe("como ficou uma sugestão")
    expect(config.textosComoPensei.codigosValidacao.fora_da_base).toBe("algo fora da base")
    expect(config.textosComoPensei.motivosJuiz.promessa).toBe("uma promessa de cura")
  })

  it("não deixa nenhum texto de Você nem de Como pensei vazio", () => {
    const textos = [
      ...textosDe(config.textosVoce),
      ...textosDe(config.textosComoPensei),
      config.textosEntrada.aviso.dados_apagados,
    ]
    expect(textos.length).toBeGreaterThan(80)
    for (const texto of textos) expect(texto.trim()).not.toBe("")
  })

  it("só usa nos modelos de Você e Como pensei as chaves de placeholder esperadas", () => {
    const esperadas = new Set([
      "lista",
      "Dosha",
      "n",
      "item",
      "Item",
      "dia",
      "hora",
      "data",
      "h",
      "cidade",
      "nome",
      "incertos",
      "acabou",
      "intencoes",
      "estados",
      "temperatura",
      "umidade",
      "gunas",
      "resumo",
      "texto",
    ])
    for (const modelo of [...textosDe(config.textosVoce), ...textosDe(config.textosComoPensei)]) {
      for (const casamento of modelo.matchAll(/\{(\w+)\}/g)) {
        const chave = casamento[1] ?? ""
        expect(esperadas.has(chave), `chave {${chave}} inesperada em "${modelo}"`).toBe(true)
      }
    }
  })
})
