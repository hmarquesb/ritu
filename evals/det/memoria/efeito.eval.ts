import { describe, expect, it } from "vitest"
import { rotasDoVoce } from "@/app/_rotas/voce"
import { type DadosDoPreparo, preparar } from "@/core/agents/companion/preparo"
import { diaLocal } from "@/core/time/dia-local"
import { createContainer, getContainer } from "@/infra/container"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { cenarios, montarCenario } from "../../../test/fixtures/cenarios"

// Efeito da memória no preparo seguinte: "evitar sempre", "não como", restrição, nota de rotina, padrão, "esquecer"
// e a conversa de hoje. Os toques passam pelas rotas do Você; o preparo é o mesmo do run. Perfil semeado: o
// frio-agitada (casa com abóbora, arroz, ghee, gengibre e canela). O relógio é o do cenário, então o dia não muda.

const kb = getContainer().knowledge
const FUSO = "America/Sao_Paulo"
// Chave de um padrão de frio-agitada com o chá de gengibre e canela (a forma que o padrão tem no banco).
const CHAVE = "com_frio+agitada|pratica:cha-gengibre-canela"

function frioAgitada() {
  const c = cenarios["frio-agitada"]
  if (!c?.entrada) throw new Error("cenário frio-agitada ausente")
  return c
}

// O container do Você sobre os stores e o relógio do cenário: as rotas e as leituras usam o mesmo estado.
async function montar() {
  const c = frioAgitada()
  const { contaId, deps } = await montarCenario(c)
  const container = createContainer({
    clock: deps.clock,
    stores: deps.stores,
    tx: { emTransacao: (fn) => fn(deps.stores) },
    telemetry: deps.telemetry,
    limiter: createMemoryLimiter(),
  })
  const rotas = rotasDoVoce({
    contaDaSessao: async () => contaId,
    container,
    quemPede: () => ({ ipHash: "h" }),
  })
  const dia = diaLocal(new Date(c.agora), FUSO)
  return { contaId, deps, rotas, dia }
}

type Montagem = Awaited<ReturnType<typeof montar>>

// O preparo da mensagem do momento frio-agitada, sem gravar nada.
function preparoSeguinte(m: Montagem): Promise<DadosDoPreparo> {
  return preparar(
    { stores: m.deps.stores, kb, clock: m.deps.clock, telemetry: m.deps.telemetry },
    m.contaId,
    frioAgitada().entrada,
  )
}

const alimentosNosCandidatos = (p: DadosDoPreparo): string[] =>
  p.candidatos.flatMap((cand) => cand.itens.map((i) => i.alimento_id))

const pedido = (url: string, corpo: unknown): Request =>
  new Request(url, { method: "POST", body: JSON.stringify(corpo) })

async function comStatus200(resposta: Response): Promise<void> {
  expect(resposta.status).toBe(200)
}

describe("evitar sempre e não como tiram o alimento do preparo seguinte", () => {
  it("alimento em evitar sempre sai dos candidatos", async () => {
    const m = await montar()
    expect(alimentosNosCandidatos(await preparoSeguinte(m))).toContain("gengibre")

    const resposta = await m.rotas.tocarPerfil(
      pedido("http://x/api/perfil", {
        acao: "evitar_acrescentar",
        itens: [{ tipo: "alimento", valor: "gengibre" }],
      }),
    )

    await comStatus200(resposta)
    expect(alimentosNosCandidatos(await preparoSeguinte(m))).not.toContain("gengibre")
  })

  it("alimento em não como sai dos candidatos e entra no filtro do preparo", async () => {
    const m = await montar()
    expect(alimentosNosCandidatos(await preparoSeguinte(m))).toContain("gengibre")

    const resposta = await m.rotas.tocarPerfil(
      pedido("http://x/api/perfil", { acao: "nao_come_acrescentar", alimento_id: "gengibre" }),
    )

    await comStatus200(resposta)
    const depois = await preparoSeguinte(m)
    expect(alimentosNosCandidatos(depois)).not.toContain("gengibre")
    expect(depois.filtro.nao_come).toContain("gengibre")
  })
})

describe("restrição tira o grupo do preparo seguinte", () => {
  it('"vegana" tira do preparo os alimentos que a base marca como vegana-excluídos', async () => {
    const m = await montar()
    const naoVeganos = kb.alimentos.filter((a) => a.restricoes.includes("vegana")).map((a) => a.id)
    const deNaoVeganos = (p: DadosDoPreparo) =>
      alimentosNosCandidatos(p).filter((id) => naoVeganos.includes(id))
    expect(deNaoVeganos(await preparoSeguinte(m))).not.toEqual([])

    const resposta = await m.rotas.tocarPerfil(
      pedido("http://x/api/perfil", { acao: "restricoes", restricoes: ["vegana"] }),
    )

    await comStatus200(resposta)
    const depois = await preparoSeguinte(m)
    expect(deNaoVeganos(depois)).toEqual([])
    expect(depois.filtro.restricoes).toContain("vegana")
  })
})

describe("nota de rotina apagada", () => {
  const NOTA = "trabalho em casa pela manhã"

  it("sai das notas do preparo e do resumo de rotina", async () => {
    const m = await montar()
    const nota = await m.deps.stores.routine.anotar(m.contaId, NOTA)
    await m.deps.stores.routine.gravarResumo(m.contaId, `Você trabalha em casa pela manhã.`)
    const antes = await preparoSeguinte(m)
    expect(antes.notas_ativas.join(" ")).toContain(NOTA)
    expect(antes.resumo_de_rotina).toContain("trabalha em casa")

    const resposta = await m.rotas.tocarMemoria(
      pedido("http://x/api/memoria", { acao: "nota_apagar", nota_id: nota.id }),
    )

    await comStatus200(resposta)
    const depois = await preparoSeguinte(m)
    expect(depois.notas_ativas.join(" ")).not.toContain(NOTA)
    expect(depois.resumo_de_rotina ?? "").not.toContain("trabalha em casa")
  })
})

describe("padrões do prompt", () => {
  const FRASE = "Quando você está com frio e agitada, um chá quente costuma ajudar."

  it("padrão confirmado entra nos padrões do prompt", async () => {
    const m = await montar()
    const padrao = await m.deps.stores.patterns.propor(m.contaId, {
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
    })
    if (!padrao) throw new Error("padrão não criado")
    expect((await preparoSeguinte(m)).padroes).not.toContain(FRASE)

    const resposta = await m.rotas.tocarMemoria(
      pedido("http://x/api/memoria", {
        acao: "padrao_decidir",
        padrao_id: padrao.id,
        decisao: "confirmado",
      }),
    )

    await comStatus200(resposta)
    expect((await preparoSeguinte(m)).padroes).toContain(FRASE)
  })

  it("padrão recusado não volta ao bloco nem aos padrões do prompt", async () => {
    const m = await montar()
    const padrao = await m.deps.stores.patterns.propor(m.contaId, {
      tipo: "ajuda_em_estado",
      chave: CHAVE,
      frase: FRASE,
      ocorrencias: 3,
    })
    if (!padrao) throw new Error("padrão não criado")

    const resposta = await m.rotas.tocarMemoria(
      pedido("http://x/api/memoria", {
        acao: "padrao_decidir",
        padrao_id: padrao.id,
        decisao: "recusado",
      }),
    )

    await comStatus200(resposta)
    const candidatos = await m.deps.stores.patterns.listar(m.contaId, "candidato")
    expect(candidatos.map((p) => p.id)).not.toContain(padrao.id)
    expect((await preparoSeguinte(m)).padroes).not.toContain(FRASE)
    expect(
      await m.deps.stores.patterns.propor(m.contaId, {
        tipo: "ajuda_em_estado",
        chave: CHAVE,
        frase: FRASE,
        ocorrencias: 3,
      }),
    ).toBeUndefined()
  })
})

describe("esquecer um gosto", () => {
  // Os candidatos com o gosto de cada um: a ordenação do preparo depende disso (o gosto do chá vale pela pratica dele).
  const gostos = (p: DadosDoPreparo): string[] => p.candidatos.map((c) => `${c.id}:${c.gosta}`)

  it("esquecer tira o ponto de gosto e a ordenação volta ao que era sem ele", async () => {
    const m = await montar()
    const base = await preparoSeguinte(m)
    const alvo = base.candidatos[0]
    if (!alvo) throw new Error("preparo sem candidatos")
    const item = { item_tipo: alvo.tipo === "refeicao" ? "preparo" : "pratica", item_id: alvo.id }
    const gostoDoAlvo = (p: DadosDoPreparo) => p.candidatos.find((c) => c.id === alvo.id)?.gosta

    const gosta = await m.rotas.tocarMemoria(
      pedido("http://x/api/memoria", { acao: "gosto", ...item, gosto: "gosta" }),
    )
    await comStatus200(gosta)
    expect(gostoDoAlvo(await preparoSeguinte(m))).toBe(true)

    const esquecer = await m.rotas.tocarMemoria(
      pedido("http://x/api/memoria", { acao: "esquecer", ...item }),
    )

    await comStatus200(esquecer)
    const pontos = await m.deps.stores.preferences.ler(m.contaId)
    expect(pontos.map((p) => p.item_id)).not.toContain(alvo.id)
    expect(gostos(await preparoSeguinte(m))).toEqual(gostos(base))
  })
})

describe("apagar a conversa de hoje", () => {
  const TEXTO = "mensagem da conversa de hoje"

  it("tira as mensagens do contexto do agente e o dia da conversa na tela", async () => {
    const m = await montar()
    await m.deps.stores.messages.gravar(m.contaId, {
      autor: "pessoa",
      texto: TEXTO,
      com_incomodo: false,
      dia: m.dia,
    })
    expect((await preparoSeguinte(m)).mensagens_do_dia.map((x) => x.texto)).toContain(TEXTO)
    expect(
      (await m.deps.stores.messages.contarPorDia(m.contaId, m.dia)).map((d) => d.dia),
    ).toContain(m.dia)

    const resposta = await m.rotas.tocarMemoria(
      pedido("http://x/api/memoria", { acao: "conversa_apagar", dia: m.dia }),
    )

    await comStatus200(resposta)
    expect((await preparoSeguinte(m)).mensagens_do_dia.map((x) => x.texto)).not.toContain(TEXTO)
    expect(
      (await m.deps.stores.messages.contarPorDia(m.contaId, m.dia)).map((d) => d.dia),
    ).not.toContain(m.dia)
  })
})
