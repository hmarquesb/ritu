import { config, textosBastidores } from "@config/index"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { NumerosDaSemana } from "@/components/ritu/bastidores/numeros-da-semana"
import { formatarMetrica } from "@/core/bastidores/evolucao"
import { criarNumerosDaSemana, type NumerosDaSemana as Numeros } from "@/core/bastidores/numeros"
import { executarLimpeza } from "@/core/cleanup"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryBastidores } from "@/infra/fakes/memory-bastidores"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryLedger, createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"

// Números da semana (spec 023): o piso, o dia de hoje fora da janela, o voto de demonstração que sobrevive à
// limpeza e a ausência de dado de pessoa no JSON e no HTML. Sem rede, banco nem chave: fakes em memória.

// 00:30 de 10/12 em São Paulo: hoje é 10, a janela é de 03/12 a 09/12.
const AGORA = "2026-12-10T03:30:00Z"
const DIA_DA_JANELA = "2026-12-05"
const HOJE = "2026-12-10"
const JANELA = { de: "2026-12-03", ate: "2026-12-09" }

// Canários: textos que não podem sair nem no JSON nem no HTML da seção.
const EMAIL_CANARIO = "canario-email-7731@exemplo.test"
const CIDADE_CANARIO = "cidadecanario7731"
const MENSAGEM_CANARIA = "mensagemcanaria7731"
const INTENCAO_CANARIA = "intencaocanaria7731"
const TOOL_CANARIA = "toolcanaria7731"

function montar(iso: string = AGORA) {
  const clock = createFixedClock(iso)
  const stores = createMemoryStores(clock)
  return {
    clock,
    stores,
    telemetry: createMemoryTelemetry(),
    bastidores: createMemoryBastidores(stores),
    ledger: createMemoryLedger(clock),
    limiter: createMemoryLimiter(),
  }
}

type Montado = ReturnType<typeof montar>

// Runs fechados por status done, um depois do outro: o run aberto da conta impede o próximo.
// Devolve os ids, na ordem de criação.
async function concluirRuns(
  m: Montado,
  contaId: string,
  quantidade: number,
  dia: string,
  intencoes: string[] = ["momento"],
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < quantidade; i++) {
    const run = await m.stores.runs.criar(contaId, { caminho: "acompanhante", intencoes, dia })
    await m.stores.runs.atualizar(contaId, run.id, {
      status: "done",
      latencia_ms: 1000 + i,
      passos: 3,
      juiz_tentativas: 1,
      juiz_aprovado: true,
    })
    ids.push(run.id)
  }
  return ids
}

// Como a página lê: uma instância nova, sem cache de uma leitura anterior.
function numerosAgora(m: Montado): Promise<Numeros> {
  return criarNumerosDaSemana({ store: m.bastidores, clock: m.clock })()
}

function htmlDaSecao(numeros: Numeros): string {
  return renderToStaticMarkup(createElement(NumerosDaSemana, { numeros, formatarMetrica }))
}

describe("piso dos números da semana", () => {
  it("com 19 runs done na janela, mostra só o total; com 20, mostra os números", async () => {
    const m = montar()
    const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "sub-piso" })
    const ids = await concluirRuns(m, conta.id, 19, DIA_DA_JANELA, [INTENCAO_CANARIA])
    // Tool e voto plantados nos runs abaixo do piso: nada disso pode aparecer.
    await m.stores.runs.acrescentarEtapa(conta.id, ids[0] ?? "", {
      tipo: "tool",
      nome: TOOL_CANARIA,
      status: "ok",
      duracao_ms: 5,
      modelo: null,
      tokens_entrada: 0,
      tokens_saida: 0,
      resumo: null,
    })
    await m.stores.runs.votar(conta.id, ids[0] ?? "", "up")
    // Um run de hoje não entra na janela, mesmo com o piso já alcançado sem ele.
    await concluirRuns(m, conta.id, 3, HOJE)

    const dezenove = await numerosAgora(m)
    expect(dezenove).toEqual({
      tipo: "poucos",
      janela: JANELA,
      runs: 19,
      minimo: config.bastidores.minimoDeRuns,
    })
    const htmlDezenove = htmlDaSecao(dezenove)
    expect(htmlDezenove).toContain("Por enquanto são 19.")
    const proibidosAbaixoDoPiso = [
      INTENCAO_CANARIA,
      TOOL_CANARIA,
      "<dl",
      textosBastidores.tile.votos.rotulo,
      textosBastidores.tile.duracao.rotulo,
      textosBastidores.intencoes.titulo,
      textosBastidores.tools.titulo,
    ]
    for (const texto of proibidosAbaixoDoPiso) {
      expect(htmlDezenove, `HTML abaixo do piso com ${texto}`).not.toContain(texto)
    }

    await concluirRuns(m, conta.id, 1, DIA_DA_JANELA)
    const vinte = await numerosAgora(m)
    expect(vinte.tipo).toBe("ok")
    if (vinte.tipo !== "ok") throw new Error("esperava ok")
    expect(vinte.janela).toEqual(JANELA)
    expect(vinte.runs.runs).toBe(20)
  })
})

describe("janela e dia de hoje", () => {
  it("o dia de hoje nunca entra nos números, nem nos runs nem nos sinais", async () => {
    const m = montar()
    const conta = await m.stores.accounts.criar({ tipo: "google", google_sub: "sub-hoje" })
    await concluirRuns(m, conta.id, 20, DIA_DA_JANELA)
    const [runDeHoje] = await concluirRuns(m, conta.id, 1, HOJE)
    // Voto de um run de hoje, já gravado como sinal do dia de hoje: a janela fecha em ontem e não o soma.
    await m.stores.runs.votar(conta.id, runDeHoje ?? "", "up")
    await m.bastidores.registrarSinaisDoDia(HOJE, config.clima.fusoPadrao)

    const numeros = await numerosAgora(m)
    if (numeros.tipo !== "ok") throw new Error("esperava ok")
    expect(numeros.runs.runs).toBe(20)
    expect(numeros.sinais.feedback.up).toBe(0)
  })
})

describe("voto de demonstração depois da limpeza", () => {
  it("um voto para cima de demonstração que vence na mesma limpeza continua contado na semana seguinte", async () => {
    // 12:00 de 09/12 em São Paulo: o voto é do dia 09, o último dia da janela de 10/12.
    const m = montar("2026-12-09T15:00:00Z")
    const outra = await m.stores.accounts.criar({ tipo: "google", google_sub: "sub-outra" })
    await concluirRuns(m, outra.id, 19, DIA_DA_JANELA)

    const demo = await m.stores.accounts.criar({
      tipo: "demo",
      expira_em: new Date("2026-12-10T02:00:00Z"),
    })
    const run = await m.stores.runs.criar(demo.id, {
      caminho: "acompanhante",
      intencoes: ["momento"],
      dia: "2026-12-09",
    })
    await m.stores.runs.atualizar(demo.id, run.id, { status: "done", latencia_ms: 900 })
    await m.stores.runs.votar(demo.id, run.id, "up")

    // Agora é 00:30 de 10/12: a demonstração venceu e a limpeza apaga a conta.
    m.clock.set(AGORA)
    const antes = await numerosAgora(m)
    if (antes.tipo !== "ok") throw new Error("esperava ok antes da limpeza")
    expect(antes.sinais.feedback.up).toBe(0)

    const limpeza = await executarLimpeza({
      stores: m.stores,
      clock: m.clock,
      ledger: m.ledger,
      limiter: m.limiter,
      bastidores: m.bastidores,
      telemetry: m.telemetry,
    })
    expect(limpeza.demos).toBe(1)
    expect(limpeza.sinais_registrados).toBe(5)

    const depois = await numerosAgora(m)
    if (depois.tipo !== "ok") throw new Error("esperava ok depois da limpeza")
    expect(depois.sinais.feedback.up).toBe(1)
    expect(JSON.stringify(depois)).not.toContain(demo.id)
    expect(htmlDaSecao(depois)).not.toContain(demo.id)
  })
})

describe("privacidade dos números da semana", () => {
  it("o JSON e o HTML não têm conta_id, e-mail nem canários plantados", async () => {
    const m = montar()
    const conta = await m.stores.accounts.criar({
      tipo: "google",
      google_sub: "sub-privacidade",
      email: EMAIL_CANARIO,
    })
    await m.stores.profiles.definirCidade(conta.id, {
      nome: CIDADE_CANARIO,
      lat: -22.9,
      lon: -43.2,
      fuso: "America/Sao_Paulo",
    })
    await concluirRuns(m, conta.id, 20, DIA_DA_JANELA)
    await m.stores.messages.gravar(conta.id, {
      autor: "pessoa",
      texto: `hoje estou com ${MENSAGEM_CANARIA} na cabeça`,
      com_incomodo: false,
      dia: DIA_DA_JANELA,
    })

    const numeros = await numerosAgora(m)
    expect(numeros.tipo).toBe("ok")
    const json = JSON.stringify(numeros)
    const html = htmlDaSecao(numeros)

    const proibidos = [conta.id, EMAIL_CANARIO, CIDADE_CANARIO, MENSAGEM_CANARIA]
    for (const texto of proibidos) {
      expect(json, `JSON com ${texto}`).not.toContain(texto)
      expect(html, `HTML com ${texto}`).not.toContain(texto)
    }
    expect(json).not.toContain("conta_id")
    expect(html).not.toContain("conta_id")
  })
})
