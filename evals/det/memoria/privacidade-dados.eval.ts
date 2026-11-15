import { describe, expect, it } from "vitest"
import type { Stores } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"

const HOJE = "2026-01-15"
const DESDE_O_INICIO = "2000-01-01"
const DESDE_DATA = new Date(0)

async function criarConta(stores: Stores, sub: string): Promise<string> {
  const conta = await stores.accounts.criar({
    tipo: "google",
    google_sub: sub,
    email: `${sub}@exemplo.com`,
  })
  return conta.id
}

// Uma conta com dado em todas as portas que guardam algo da pessoa.
async function popularConta(stores: Stores, conta: string) {
  await stores.profiles.definirCidade(conta, {
    nome: "Rio de Janeiro",
    lat: -22.91,
    lon: -43.17,
    fuso: "America/Sao_Paulo",
  })
  await stores.profiles.acrescentarEvitarSempre(conta, [{ tipo: "alimento", valor: "banana" }])
  await stores.profiles.acrescentarEvitarTemporario(conta, HOJE, [{ tipo: "texto", valor: "x" }])
  await stores.pantry.registrar(conta, [{ alimento_id: "canela" }], "conversa")
  await stores.preferences.definirGosto(conta, { tipo: "alimento", id: "canela" }, "gosta")
  await stores.preferences.contarResultado(conta, { tipo: "alimento", id: "canela" }, "ajudou")
  await stores.shortages.registrar(conta, [{ alimento_id: "banana", origem: "nao_tenho" }], HOJE)
  await stores.shortages.porNaLista(conta, {
    alimento_id: "banana",
    motivo: "faltou_hoje",
    detalhe: "faltou hoje",
  })
  await stores.routine.anotar(conta, "Caminhada leve à tarde")
  await stores.routine.gravarResumo(conta, "Resumo da rotina")
  await stores.patterns.propor(conta, {
    tipo: "ajuda_em_estado",
    chave: "sem_energia|gengibre",
    frase: "Ajuda quando sem energia",
    ocorrencias: 3,
  })
  const feito = await stores.runs.criar(conta, { caminho: "casa", intencoes: [], dia: HOJE })
  await stores.runs.atualizar(conta, feito.id, {
    status: "done",
    momento: { estados: ["sem_energia"], momento_do_dia: "manha", gunas_buscadas: ["quente"] },
  })
  await stores.runs.acrescentarEtapa(conta, feito.id, {
    tipo: "tool",
    nome: "casa.ler",
    resumo: "leu a casa",
    status: "ok",
    duracao_ms: 5,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
  })
  await stores.messages.gravar(conta, {
    run_id: feito.id,
    autor: "pessoa",
    texto: "oi",
    com_incomodo: false,
    dia: HOJE,
  })
  const [retorno] = await stores.outcomes.criar(conta, feito.id, [
    { tipo: "cha", titulo: "Chá de gengibre", alimentos: ["gengibre"] },
  ])
  const [proposta] = await stores.proposals.criar(conta, feito.id, [
    { tool: "casa.registrar", conteudo: { itens: ["canela"] } },
  ])
  if (proposta) await stores.proposals.decidir(conta, proposta.id, "recusada")
  await stores.runs.criar(conta, { caminho: "casa", intencoes: [], dia: HOJE })
  return { feitoId: feito.id, retornoId: retorno?.id ?? "", propostaId: proposta?.id ?? "" }
}

// Tudo o que cada porta devolve para a conta. Cada valor é uma lista: vazia quando não há dado.
async function leituras(stores: Stores, conta: string, feitoId: string) {
  const perfil = await stores.profiles.ler(conta)
  const contagem = await stores.preferences.contagem(conta)
  const feitosRecentes = await stores.runs.recentes(conta, DESDE_DATA, 10)
  return {
    perfil_cidade: perfil.cidade_nome === null ? [] : [perfil.cidade_nome],
    perfil_evitar_sempre: perfil.evitar_sempre,
    evitar_temporario: await stores.profiles.evitarTemporario(conta, HOJE),
    casa: await stores.pantry.listar(conta),
    preferencias: await stores.preferences.ler(conta),
    contagens: contagem.de_gosto + contagem.de_resultado > 0 ? [contagem] : [],
    faltas: await stores.shortages.diasComFalta(conta, DESDE_O_INICIO),
    lista: await stores.shortages.lista(conta),
    notas: await stores.routine.notasAtivas(conta),
    resumo: await stores.routine.resumo(conta).then((r) => (r ? [r] : [])),
    padroes: await stores.patterns.listar(conta),
    mensagens: await stores.messages.doDia(conta, HOJE),
    retornos_pendentes: await stores.outcomes.pendentes(conta),
    retornos_do_run: await stores.outcomes.doRun(conta, feitoId),
    run_aberto: await stores.runs.aberto(conta).then((r) => (r ? [r] : [])),
    runs_recentes: feitosRecentes,
    run_buscado: await stores.runs.buscar(conta, feitoId).then((r) => (r ? [r] : [])),
    etapas: await stores.runs.etapas(conta, feitoId),
    propostas: await stores.proposals.doRun(conta, feitoId),
    propostas_recusadas: await stores.proposals.recusadas(conta, "casa.registrar"),
  }
}

type Leituras = Awaited<ReturnType<typeof leituras>>

const comDados = (lidas: Leituras): string[] =>
  Object.entries(lidas)
    .filter(([, valor]) => valor.length > 0)
    .map(([porta]) => porta)

const semDados = (lidas: Leituras): string[] =>
  Object.entries(lidas)
    .filter(([, valor]) => valor.length === 0)
    .map(([porta]) => porta)

describe("privacidade entre contas", () => {
  it("uma conta sem dados não lê nada da outra, em nenhuma porta", async () => {
    const stores = createMemoryStores(createFixedClock("2026-01-15T12:00:00-03:00"))
    const a = await criarConta(stores, "sub-a")
    const b = await criarConta(stores, "sub-b")
    const { feitoId } = await popularConta(stores, a)

    const lidasDeA = await leituras(stores, a, feitoId)
    const lidasDeB = await leituras(stores, b, feitoId)

    expect(semDados(lidasDeA)).toEqual([])
    expect(comDados(lidasDeB)).toEqual([])
  })

  it("escrita com id da conta A feita pela conta B não muda nada de A", async () => {
    const stores = createMemoryStores(createFixedClock("2026-01-15T12:00:00-03:00"))
    const a = await criarConta(stores, "sub-a")
    const b = await criarConta(stores, "sub-b")
    const { feitoId, retornoId, propostaId } = await popularConta(stores, a)
    const antes = await leituras(stores, a, feitoId)
    const [item] = await stores.pantry.listar(a)

    await stores.outcomes.responder(b, retornoId, "ajudou", "toque")
    await stores.proposals.decidir(b, propostaId, "aprovada")
    await stores.pantry.tirar(b, item?.id ?? "")
    await stores.runs.atualizar(b, feitoId, { status: "failed" })

    expect(await leituras(stores, a, feitoId)).toEqual(antes)
  })
})

describe("apagar a conta", () => {
  it("depois de apagar, nenhuma porta tem linha da conta", async () => {
    const stores = createMemoryStores(createFixedClock("2026-01-15T12:00:00-03:00"))
    const a = await criarConta(stores, "sub-a")
    const { feitoId } = await popularConta(stores, a)
    expect(semDados(await leituras(stores, a, feitoId))).toEqual([])

    await stores.accounts.apagar(a)

    expect(await stores.accounts.buscar(a)).toBeUndefined()
    expect(comDados(await leituras(stores, a, feitoId))).toEqual([])
  })

  it("apagar a conta A não toca na conta B", async () => {
    const stores = createMemoryStores(createFixedClock("2026-01-15T12:00:00-03:00"))
    const a = await criarConta(stores, "sub-a")
    const b = await criarConta(stores, "sub-b")
    const { feitoId: feitoA } = await popularConta(stores, a)
    const { feitoId: feitoB } = await popularConta(stores, b)
    const antes = await leituras(stores, b, feitoB)

    await stores.accounts.apagar(a)

    expect(await leituras(stores, b, feitoB)).toEqual(antes)
    expect(await stores.runs.buscar(b, feitoA)).toBeUndefined()
  })
})
