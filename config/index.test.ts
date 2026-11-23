import { describe, expect, it } from "vitest"
import { checkpoints } from "../evals/llm/checkpoints"
import { FAMILIAS } from "../evals/llm/tipos"
import { textosDaConversa } from "../src/core/conversation/textos"
import { GRUPOS } from "../src/core/knowledge/vocab"
import { loadKnowledgeBase } from "../src/infra/knowledge/yaml-knowledge"
import {
  config,
  exemploDaLanding,
  telaConversa,
  textosBastidores,
  textosConversa,
  textosLimites,
} from "./index"
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

  it("expõe os limites de mensagem e de toque com os valores da spec 021", () => {
    expect(config.limites.mensagens).toEqual({
      googlePorDia: 30,
      demoPorConta: 12,
      porIpPorDia: 60,
      avisarComRestantes: 3,
    })
    expect(config.limites.toques).toEqual({
      porContaPorMinuto: 60,
      porContaPorDia: 300,
      porIpPorDia: 1500,
    })
  })

  it("expõe os textos de limite com as chaves e os textos da spec 021", () => {
    expect(textosLimites.cota.faixa).toContain("{hora}")
    expect(textosLimites.cota.rotulo).toBe("Aviso")
    expect(textosLimites.restam.varias).toBe("Restam {n} mensagens hoje.")
    expect(textosLimites.restam.uma).toBe("Resta 1 mensagem hoje.")
    expect(textosLimites.restam.variasDemo).toBe("Restam {n} mensagens na demonstração.")
    expect(textosLimites.restam.umaDemo).toBe("Resta 1 mensagem na demonstração.")
    expect(textosLimites.esgotadas.conta.titulo).toBe("Suas mensagens de hoje acabaram")
    expect(textosLimites.esgotadas.demo.google).toBe("Entrar com Google")
    expect(textosLimites.esgotadas.textoGuardado).toBe("O que você escreveu:")
    expect(textosLimites.atalhos.enviar).toBe("Ver práticas")
    expect(textosLimites.toques.minuto).toBe(
      "Muitos toques seguidos. Espere um minuto e tente de novo.",
    )
    expect(textosLimites.toques.dia).toBe(
      "Você chegou ao limite de toques de hoje. Amanhã tem mais.",
    )
  })

  it("mantém os textos de limite com placeholders e sem texto vazio", () => {
    expect(textosLimites.restam.varias).toContain("{n}")
    expect(textosLimites.restam.variasDemo).toContain("{n}")
    const textos = textosDe(config.textosLimites)
    expect(textos.length).toBeGreaterThan(15)
    for (const texto of textos) {
      expect(texto.trim().length).toBeGreaterThan(0)
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
    expect(config.base.minAlimentos).toBe(127)
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

describe("config do Bastidores e do MCP", () => {
  it("expõe a configuração do Bastidores com os valores da spec 023", () => {
    expect(config.bastidores.dias).toBe(7)
    expect(config.bastidores.minimoDeRuns).toBe(20)
    expect(config.bastidores.topTools).toBe(5)
    expect(config.bastidores.cacheMs).toBe(3_600_000)
    expect(config.bastidores.retencaoSinaisDias).toBe(30)
    expect(config.bastidores.toolsFora).toEqual([
      "ask_user",
      "finalizar",
      "memoria.propor",
      "lista.propor",
    ])
    expect(config.bastidores.mcp).toEqual({ caminho: "/api/mcp", corpoMaximoBytes: 16_384 })
  })

  it("expõe os limites do MCP com os valores da spec 023", () => {
    expect(config.limites.mcp).toEqual({ porIpPorMinuto: 30, porIpPorDia: 300, globalPorDia: 3000 })
  })

  it("tem como destaques só ids de métricas", () => {
    const ids = new Set(textosBastidores.metricas.map((metrica) => metrica.id))
    expect(config.bastidores.destaques.length).toBe(5)
    for (const destaque of config.bastidores.destaques) {
      expect(ids.has(destaque), `destaque ${destaque} fora de metricas`).toBe(true)
    }
  })

  it("cobre toda métrica com meta de config/evals.ts, com rótulo e formato válidos", () => {
    const ids: string[] = textosBastidores.metricas.map((metrica) => metrica.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const meta of Object.keys(config.evals.metas)) {
      expect(ids.includes(meta), `métrica ${meta} sem texto`).toBe(true)
    }
    for (const metrica of textosBastidores.metricas) {
      expect(metrica.rotulo.length).toBeGreaterThan(0)
      expect(["pct", "num", "ms", "contagem"]).toContain(metrica.formato)
    }
  })

  it("tem uma entrada de família para cada Familia de FAMILIAS", () => {
    expect(Object.keys(textosBastidores.familias).sort()).toEqual([...FAMILIAS].sort())
    for (const rotulo of Object.values(textosBastidores.familias)) {
      expect(rotulo.length).toBeGreaterThan(0)
    }
  })

  it("tem um texto de checkpoint para cada checkpoint de evals/llm/checkpoints.ts", () => {
    expect(Object.keys(textosBastidores.checkpoints).sort()).toEqual(
      Object.keys(checkpoints).sort(),
    )
  })

  it("expõe os textos do Bastidores com as chaves da spec e os marcadores de interpolação", () => {
    expect(textosBastidores.titulo).toBe("Bastidores")
    expect(textosBastidores.intro).toBe(
      "Como o Ritu está se saindo, em números. Nada aqui identifica uma pessoa.",
    )
    expect(textosBastidores.semana.janela).toBe("De {de} a {ate}, dias completos.")
    expect(textosBastidores.semana.poucos.texto).toContain("{minimo}")
    expect(textosBastidores.semana.poucos.texto).toContain("{runs}")
    expect(textosBastidores.tile.votos.valor).toBe("{up} gostaram · {down} não gostaram")
    expect(textosBastidores.tile.retornos.valor).toContain("{nao_fez}")
    expect(textosBastidores.evals.meta.min).toBe("Meta: pelo menos {valor}")
    expect(textosBastidores.evals.abaixo).toBe("abaixo da meta")
    expect(textosBastidores.mcp.limites).toBe(
      "Até {minuto} chamadas por minuto e {dia} por dia por conexão.",
    )
    expect(textosBastidores.aviso).toBe("Não é orientação médica.")
  })

  it("mantém os textos do Bastidores sem texto vazio nem marcação", () => {
    const textos = textosDe(config.textosBastidores)
    expect(textos.length).toBeGreaterThan(60)
    for (const texto of textos) {
      expect(texto.trim().length).toBeGreaterThan(0)
      expect(texto).not.toMatch(/[<>]/)
    }
  })
})

describe("config da landing, do Sobre e do README", () => {
  it("tem siteUrl nulo ou https sem barra final", () => {
    const url = config.publico.siteUrl
    if (url !== null) expect(url).toMatch(/^https:\/\/[^/\s]+$/)
  })

  it("usa só ids de prática, preparo e alimento que existem na base", () => {
    const kb = loadKnowledgeBase()
    for (const sugestao of exemploDaLanding.sugestoes) {
      if (sugestao.tipo === "pratica") {
        expect(kb.pratica(sugestao.id), sugestao.id).toBeDefined()
      } else {
        expect(kb.preparo(sugestao.id), sugestao.id).toBeDefined()
        for (const ingrediente of sugestao.ingredientes) {
          expect(kb.alimento(ingrediente), ingrediente).toBeDefined()
        }
      }
    }
  })

  it("mantém o aviso de idade na entrada", () => {
    expect(config.textosEntrada.entrada.aviso).toBe(
      "Projeto de estudo. Não é orientação médica. Para maiores de 18 anos.",
    )
    expect(config.textosEntrada.avisoInicial.politica).toBe("Leia a política de privacidade")
  })

  it("reexporta os textos fixos de alerta do agente em cuidados", () => {
    expect(config.textosSobre.cuidados.alerta).toBe(textosDaConversa.alertaFisico)
    expect(config.textosSobre.cuidados.emocional).toBe(textosDaConversa.alertaEmocional)
  })

  it("tem um rótulo em inglês para cada destaque de Bastidores", () => {
    for (const destaque of config.bastidores.destaques) {
      expect(config.rotulosEn[destaque], destaque).toBeTruthy()
    }
  })
})
