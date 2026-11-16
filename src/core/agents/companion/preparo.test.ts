import { describe, expect, it } from "vitest"
import type { Candidato } from "@/core/ranking/tipos"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import type { EntradaDoAcompanhante } from "./entrada"
import { dadosDoPreparoSchema, entregaveis, preparar } from "./preparo"

const CONTA = "conta-1"
const HOJE = "2026-11-15"
const kb = createMiniKnowledge()

function montar(iso = "2026-11-15T18:00:00.000Z") {
  const clock = createFixedClock(iso)
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const deps = { stores, kb, clock, telemetry }
  return {
    stores,
    telemetry,
    run: (e: Partial<EntradaDoAcompanhante>, opts?: { perguntasFeitas?: number }) =>
      preparar(deps, CONTA, entrada(e), opts),
  }
}

function entrada(parcial: Partial<EntradaDoAcompanhante>): EntradaDoAcompanhante {
  return { intencoes: ["momento"], estados: [], evitar_da_mensagem: [], ...parcial }
}

describe("preparar", () => {
  it("com_frio e agitada buscam quente e estavel e devolvem dados válidos", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio", "agitada"] })
    expect(dados.qualidades.buscadas).toEqual(expect.arrayContaining(["quente", "estavel"]))
    expect(dados.candidatos.length).toBeGreaterThan(0)
    expect(dados.dia).toBe(HOJE)
    expect(dados.geral).toBe(true)
    expect(dadosDoPreparoSchema.safeParse(dados).success).toBe(true)
  })

  it("item da mensagem filtra no mesmo run e fica em evitar_temporario, sem motivo", async () => {
    const { run, stores } = montar()
    const dados = await run({ estados: ["com_frio"], evitar_da_mensagem: ["gengibre"] })
    expect(dados.filtro.evitar).toContainEqual({ tipo: "alimento", valor: "gengibre" })
    const ids = dados.candidatos.flatMap((c) => c.itens.map((i) => i.alimento_id))
    expect(ids).not.toContain("gengibre")
    expect(await stores.profiles.evitarTemporario(CONTA, HOJE)).toEqual([
      { tipo: "alimento", valor: "gengibre" },
    ])
  })

  it("texto fora da base vai para evitar_textos", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"], evitar_da_mensagem: ["coentro fresco"] })
    expect(dados.evitar_textos).toEqual(["coentro fresco"])
  })

  it("pergunta sem estados não tem candidatos nem faltas", async () => {
    const { run } = montar()
    const dados = await run({ intencoes: ["pergunta"] })
    expect(dados.candidatos).toEqual([])
    expect(dados.faltas_do_run).toEqual([])
    expect(dados.para_ter).toBeUndefined()
  })

  it("com três dias de falta nos últimos 30, devolve para_ter; com incômodo, não", async () => {
    const { run, stores } = montar()
    const falta = [{ alimento_id: "gengibre", origem: "nao_tenho" as const }]
    await stores.shortages.registrar(CONTA, falta, "2026-11-13")
    await stores.shortages.registrar(CONTA, falta, "2026-11-14")
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.faltas_do_run).toContain("gengibre")
    expect(dados.para_ter?.alimento_id).toBe("gengibre")
    expect(dados.para_ter?.vezes).toBe(3)

    const comIncomodo = await run({
      estados: ["com_frio"],
      incomodo: { id: "gases", variante: "unica" },
    })
    expect(comIncomodo.com_incomodo).toBe(true)
    expect(comIncomodo.para_ter).toBeUndefined()
  })

  it("o que já foi sugerido hoje sai dos candidatos", async () => {
    const { run, stores } = montar()
    const antes = await run({ estados: ["com_frio"] })
    expect(antes.candidatos.some((c) => c.id === "cha-gengibre")).toBe(true)
    const criado = await stores.runs.criar(CONTA, {
      caminho: "acompanhante",
      intencoes: ["momento"],
      dia: HOJE,
    })
    await stores.runs.atualizar(CONTA, criado.id, {
      status: "done",
      saida: { sugestoes: [{ tipo: "cha", pratica_id: "cha-gengibre" }] },
    })
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.sugeridos_hoje).toEqual(["praticas:cha-gengibre"])
    expect(dados.candidatos.some((c) => c.id === "cha-gengibre")).toBe(false)
  })

  it("casa e fixos: confirmados, nomes da base e texto do não como", async () => {
    const { run, stores } = montar()
    await stores.pantry.registrar(CONTA, [{ alimento_id: "gengibre" }], "tela")
    await stores.profiles.definirNaoCome(CONTA, [
      { tipo: "alimento", valor: "banana" },
      { tipo: "texto", valor: "coentro" },
    ])
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.casa.confirmados).toContain("gengibre")
    expect(dados.fixos.nao_come).toEqual(["Banana", "coentro"])
    expect(dados.sinais.itens_confirmados_em_casa).toBe(1)
  })

  it("o span preparo leva os atributos e nenhum nome de alimento", async () => {
    const { run, telemetry } = montar()
    const dados = await run({ estados: ["com_frio"] })
    const span = telemetry.spans.find((s) => s.nome === "preparo")
    expect(span?.atributos["candidatos.total"]).toBe(dados.candidatos.length)
    expect(span?.atributos["faltas.registradas"]).toBe(dados.faltas_do_run.length)
    expect(typeof span?.atributos["para_ter.candidato"]).toBe("boolean")
    expect(JSON.stringify(span?.atributos)).not.toContain("gengibre")
  })
})

describe("entregaveis", () => {
  const item = (alimento_id: string, casa: "confirmado" | "incerto" | "ausente") => ({
    alimento_id,
    nome: alimento_id,
    casa,
    contribui: [],
    linha_base: "",
  })
  const refeicao = (opcoes: Candidato["opcoes"]): Candidato => ({
    tipo: "refeicao",
    id: "pure-de-raiz",
    nome: "Purê de raiz",
    itens: [],
    opcoes,
    contribui: [],
    linha_base: "",
    adequacao: 1,
    nota: 1,
    gosta: false,
    ajudou: 0,
    novidade: false,
    no_fim: false,
  })
  const vazia: { confirmados: string[]; incertos: string[] } = { confirmados: [], incertos: [] }

  const com = (perguntasRestantes: number, casa = vazia, acabou: string[] = []) => ({
    casa,
    acabou,
    perguntasRestantes,
  })

  it("sai a refeição cuja vaga obrigatória só tem opção ausente e não há pergunta restante", () => {
    const c = refeicao({
      base: [item("abobora", "ausente")],
      gordura: [item("ghee", "confirmado")],
    })
    const casa = { confirmados: ["ghee"], incertos: [] }
    expect(entregaveis([c], com(0, casa), kb)).toEqual([])
  })

  it("com pergunta restante, a refeição que só depende de um ausente fica marcada", () => {
    const c = refeicao({
      base: [item("abobora", "ausente")],
      gordura: [item("ghee", "confirmado")],
    })
    const casa = { confirmados: ["ghee"], incertos: [] }
    expect(entregaveis([c], com(2, casa), kb)).toEqual([{ ...c, depende_de_pergunta: true }])
  })

  it("fica com opção confirmada ou incerta em cada vaga obrigatória, sem o campo", () => {
    const c = refeicao({
      base: [item("abobora", "ausente"), item("cenoura", "incerto")],
      gordura: [item("ghee", "confirmado")],
    })
    const casa = { confirmados: ["ghee"], incertos: ["cenoura"] }
    const [saida] = entregaveis([c], com(0, casa), kb)
    expect(saida).toEqual(c)
    expect(saida).not.toHaveProperty("depende_de_pergunta")
  })

  it("no máximo duas refeições marcadas, na ordem; a terceira sai", () => {
    const c1 = {
      ...refeicao({ base: [item("abobora", "ausente")], gordura: [item("ghee", "ausente")] }),
      id: "pure-de-raiz",
    }
    const c2 = {
      ...refeicao({
        base: [item("abobora", "ausente")],
        legume: [item("cenoura", "ausente")],
        gordura: [item("ghee", "ausente")],
      }),
      id: "arroz-com-legume",
    }
    const c3 = {
      ...refeicao({ liquido: [item("leite", "ausente")], tempero: [item("canela", "ausente")] }),
      id: "leite-morno-com-especiaria",
    }
    const saida = entregaveis([c1, c2, c3], com(5), kb)
    expect(saida.map((c) => c.id)).toEqual(["pure-de-raiz", "arroz-com-legume"])
    expect(saida.every((c) => c.depende_de_pergunta === true)).toBe(true)
  })

  it("item em acabou não segura refeição", () => {
    const c = refeicao({
      base: [item("abobora", "ausente")],
      gordura: [item("ghee", "confirmado")],
    })
    const casa = { confirmados: ["ghee"], incertos: [] }
    expect(entregaveis([c], com(2, casa, ["abobora"]), kb)).toEqual([])
  })

  it("não mexe em chá, óleo nem prática", () => {
    const cha = { ...refeicao({}), tipo: "cha" as const, id: "cha-gengibre" }
    expect(entregaveis([cha], com(0), kb)).toEqual([cha])
  })

  it("rodar de novo dá o mesmo resultado e descarta a marca anterior", () => {
    const c = refeicao({
      base: [item("abobora", "ausente")],
      gordura: [item("ghee", "confirmado")],
    })
    const casa = { confirmados: ["ghee"], incertos: [] }
    const primeira = entregaveis([c], com(2, casa), kb)
    expect(entregaveis(primeira, com(2, casa), kb)).toEqual(primeira)

    const confirmada = { confirmados: ["ghee", "abobora"], incertos: [] }
    const [saida] = entregaveis(primeira, com(2, confirmada), kb)
    expect(saida).toEqual(c)
    expect(saida).not.toHaveProperty("depende_de_pergunta")
  })
})

describe("preparar: casa, mensagem e perguntas", () => {
  it("as faltas e o para_ter não mudam com o filtro", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.faltas_do_run).toEqual(expect.arrayContaining(["gengibre"]))
    expect(dados.candidatos.length).toBeGreaterThan(0)
  })

  it("tem da mensagem entra em confirmados sem gravar na casa", async () => {
    const { run, stores } = montar()
    const dados = await run({
      estados: ["com_frio"],
      casa_da_mensagem: { tem: ["abobora"], acabou: [] },
    })
    expect(dados.casa.confirmados).toContain("abobora")
    expect(dados.sinais.itens_confirmados_em_casa).toBe(dados.casa.confirmados.length)
    expect(dados.casa_da_mensagem).toEqual({ tem: ["Abóbora"], acabou: [] })
    expect(await stores.pantry.listar(CONTA)).toEqual([])
  })

  it("acabou tira de confirmados e de incertos; tem de item evitado não entra", async () => {
    const { run, stores } = montar()
    await stores.pantry.registrar(CONTA, [{ alimento_id: "canela" }], "conversa")
    const dados = await run({
      estados: ["com_frio"],
      evitar_da_mensagem: ["gengibre"],
      casa_da_mensagem: { tem: ["gengibre"], acabou: ["canela"] },
    })
    expect(dados.casa.confirmados).not.toContain("canela")
    expect(dados.casa.incertos).not.toContain("canela")
    expect(dados.casa.confirmados).not.toContain("gengibre")
  })

  it("não como e restrição da mensagem filtram no run e ficam no temporário do dia", async () => {
    const { run, stores } = montar()
    const dados = await run({
      estados: ["com_frio"],
      nao_come_da_mensagem: [{ alimento_id: "canela", nome: "canela" }, { nome: "coentro" }],
      restricoes_da_mensagem: ["vegana"],
    })
    expect(dados.filtro.nao_come).toContain("canela")
    expect(dados.filtro.restricoes).toContain("vegana")
    const ids = dados.candidatos.flatMap((c) => c.itens.map((i) => i.alimento_id))
    expect(ids).not.toContain("canela")
    expect(ids).not.toContain("leite")
    expect(await stores.profiles.evitarTemporario(CONTA, HOJE)).toEqual([
      { tipo: "nao_come", valor: "canela" },
      { tipo: "nao_come_texto", valor: "coentro" },
      { tipo: "restricao", valor: "vegana" },
    ])
  })

  it("não como em texto livre da mensagem vai para evitar_textos e fica no temporário do dia", async () => {
    const { run, stores } = montar()
    const dados = await run({ estados: ["com_frio"], nao_come_da_mensagem: [{ nome: "jiló" }] })
    expect(dados.evitar_textos).toEqual(["jiló"])
    expect(await stores.profiles.evitarTemporario(CONTA, HOJE)).toEqual([
      { tipo: "nao_come_texto", valor: "jiló" },
    ])
  })

  it("mensagens_do_dia sem as do run atual e sem as de run alerta", async () => {
    const { stores, telemetry } = montar()
    const clock = createFixedClock("2026-11-15T18:00:00.000Z")
    const deps = { stores, kb, clock, telemetry }
    const mk = async (caminho: "acompanhante" | "alerta", texto: string) => {
      const r = await stores.runs.criar(CONTA, { caminho, intencoes: [], dia: HOJE })
      await stores.messages.gravar(CONTA, {
        run_id: r.id,
        autor: "pessoa",
        texto,
        com_incomodo: false,
        dia: HOJE,
      })
      return r
    }
    for (const [caminho, texto] of [
      ["acompanhante", "antiga"],
      ["alerta", "barrada"],
    ] as const) {
      const r = await mk(caminho, texto)
      await stores.runs.atualizar(CONTA, r.id, { status: "done" })
    }
    const atual = await mk("acompanhante", "atual")
    const dados = await preparar(deps, CONTA, entrada({ estados: ["com_frio"] }), {
      runId: atual.id,
    })
    expect(dados.mensagens_do_dia.map((m) => m.texto)).toEqual(["antiga"])
    expect(dados.sinais.mensagens_hoje).toBe(3)
  })
})

// 19h em São Paulo: momento "jantar", em que a base mini tem refeições.
const JANTAR = "2026-11-15T22:00:00.000Z"

describe("preparar: perguntas do run", () => {
  it("item só em casa_da_mensagem.acabou não segura refeição perguntável no mesmo turno", async () => {
    const { run } = montar(JANTAR)
    const estados: EntradaDoAcompanhante["estados"] = ["com_frio", "agitada"]
    const base = await run({ estados })
    const alvo = base.candidatos.find((c) => c.depende_de_pergunta === true)
    expect(alvo, "há refeição que depende de pergunta").toBeDefined()
    if (!alvo) return
    const ids = Object.values(alvo.opcoes ?? {}).flatMap((l) => (l ?? []).map((i) => i.alimento_id))

    const dados = await run({ estados, casa_da_mensagem: { tem: [], acabou: ids } })
    expect(dados.candidatos.map((c) => c.id)).not.toContain(alvo.id)
  })

  it("grava em acabou os ids de Minha casa marcados como acabou e os da mensagem", async () => {
    const { run, stores } = montar(JANTAR)
    await stores.pantry.registrar(CONTA, [{ alimento_id: "canela" }], "conversa")
    await stores.pantry.marcarAcabou(CONTA, [{ alimento_id: "canela" }])
    const dados = await run({
      estados: ["com_frio"],
      casa_da_mensagem: { tem: [], acabou: ["mel"] },
    })
    expect(dados.acabou).toEqual(expect.arrayContaining(["canela", "mel"]))
  })

  it("grava perguntas.feitas e deixa nao_come_do_run vazio", async () => {
    const { run } = montar(JANTAR)
    const dados = await run({ estados: ["com_frio"] }, { perguntasFeitas: 1 })
    expect(dados.perguntas).toEqual({ feitas: 1, alimentos: [] })
    expect(dados.nao_come_do_run).toEqual([])
  })

  it("com pergunta disponível, alguma refeição fica marcada; sem pergunta, nenhuma", async () => {
    const { run } = montar(JANTAR)
    const estados: EntradaDoAcompanhante["estados"] = ["com_frio", "agitada"]
    const com = await run({ estados })
    expect(com.candidatos.some((c) => c.depende_de_pergunta === true)).toBe(true)
    const sem = await run({ estados }, { perguntasFeitas: 2 })
    expect(sem.candidatos.some((c) => c.depende_de_pergunta === true)).toBe(false)
  })

  it("candidatos_completos traz os ids de antes do filtro, na ordem", async () => {
    const { run } = montar(JANTAR)
    const dados = await run({ estados: ["com_frio", "agitada"] }, { perguntasFeitas: 2 })
    expect(dados.candidatos_completos.length).toBeGreaterThan(dados.candidatos.length)
    for (const c of dados.candidatos) expect(dados.candidatos_completos).toContain(c.id)
  })

  it("as faltas não mudam com as perguntas gastas", async () => {
    const { run } = montar(JANTAR)
    const e: Partial<EntradaDoAcompanhante> = { estados: ["com_frio"] }
    const comPerguntas = await run(e, { perguntasFeitas: 2 })
    expect(comPerguntas.faltas_do_run).toEqual((await run(e)).faltas_do_run)
  })

  it("aceita depende_de_pergunta no candidato; checkpoint sem os campos novos continua válido", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    const marcado = {
      ...dados,
      candidatos: dados.candidatos.map((c) => ({ ...c, depende_de_pergunta: true })),
    }
    expect(dadosDoPreparoSchema.safeParse(marcado).success).toBe(true)

    const { perguntas: _p, nao_come_do_run: _n, candidatos_completos: _c, ...antigo } = dados
    const lido = dadosDoPreparoSchema.parse(antigo)
    expect(lido.perguntas).toEqual({ feitas: 0, alimentos: [] })
    expect(lido.nao_come_do_run).toEqual([])
    expect(lido.candidatos_completos).toEqual([])
  })
})

describe("preparar: dados das tools de proposta", () => {
  it("candidatos_do_preparo traz a lista completa, antes do corte, com os ids de candidatos_completos", async () => {
    const { run } = montar(JANTAR)
    const dados = await run({ estados: ["com_frio", "agitada"] }, { perguntasFeitas: 2 })
    expect(dados.candidatos_do_preparo.map((c) => c.id)).toEqual(dados.candidatos_completos)
    expect(dados.candidatos_do_preparo.length).toBeGreaterThan(dados.candidatos.length)
  })

  it("a refeição leva os alimentos de itens e de todas as opções, sem repetir", async () => {
    const { run } = montar(JANTAR)
    const dados = await run({ estados: ["com_frio", "agitada"] })
    const refeicao = dados.candidatos.find((c) => c.tipo === "refeicao" && c.opcoes)
    expect(refeicao).toBeDefined()
    const opcoesIds = Object.values(refeicao?.opcoes ?? {})
      .flatMap((lista) => lista ?? [])
      .map((item) => item.alimento_id)
    const doPreparo = dados.candidatos_do_preparo.find((c) => c.id === refeicao?.id)
    expect(doPreparo?.alimentos).toEqual(expect.arrayContaining(opcoesIds))
    for (const c of dados.candidatos_do_preparo) {
      expect(new Set(c.alimentos).size).toBe(c.alimentos.length)
    }
  })

  it("na_lista, lista_recusada e notas_ativas vêm das portas; nao_tem_do_run começa vazio", async () => {
    const { run, stores } = montar()
    await stores.shortages.porNaLista(CONTA, {
      alimento_id: "gengibre",
      motivo: "faltou_hoje",
      detalhe: "gengibre",
    })
    const [recusada] = await stores.proposals.criar(CONTA, "run-1", [
      { tool: "lista.propor", conteudo: { alimento_id: "canela" } },
    ])
    await stores.proposals.decidir(CONTA, recusada?.id ?? "", "recusada")
    await stores.routine.anotar(CONTA, "trabalho noturno")
    const dados = await run({ estados: ["com_frio"] })
    expect(dados.na_lista).toEqual(["gengibre"])
    expect(dados.lista_recusada).toEqual(["canela"])
    expect(dados.notas_ativas).toEqual(["trabalho noturno"])
    expect(dados.nao_tem_do_run).toEqual([])
  })

  it("checkpoint sem os campos novos continua válido, com listas vazias", async () => {
    const { run } = montar()
    const dados = await run({ estados: ["com_frio"] })
    const {
      candidatos_do_preparo: _c,
      na_lista: _n,
      lista_recusada: _l,
      notas_ativas: _o,
      nao_tem_do_run: _t,
      ...antigo
    } = dados
    const lido = dadosDoPreparoSchema.parse(antigo)
    expect(lido).toMatchObject({
      candidatos_do_preparo: [],
      na_lista: [],
      lista_recusada: [],
      notas_ativas: [],
      nao_tem_do_run: [],
    })
  })
})
