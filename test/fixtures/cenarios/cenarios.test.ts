import { describe, expect, it } from "vitest"
import { preparar } from "@/core/agents/companion/preparo"
import { contemIncomodo } from "@/core/knowledge/incomodo-no-texto"
import { createContainer } from "@/infra/container"
import {
  cenarios,
  cenariosComAprovacao,
  cenariosComPausa,
  cenariosDeAprendizado,
  cenariosDeConversa,
  cenariosDeMemoria,
  montarCenario,
} from "./index"
import type { DepsDoCenario } from "./montar"
import { rodarCenario } from "./rodar"

const NOVOS_COM_PAUSA = Object.keys(cenariosComPausa)

// Preparo da mensagem "e no jantar?" (momento, sem estados): o mesmo que o Acompanhante roda na segunda mensagem.
function preparoDaSegunda(deps: DepsDoCenario, contaId: string) {
  return preparar(
    {
      stores: deps.stores,
      kb: createContainer().knowledge,
      clock: deps.clock,
      telemetry: deps.telemetry,
    },
    contaId,
    { intencoes: ["momento"], estados: [], evitar_da_mensagem: [] },
  )
}

async function rodarNovo(nome: string) {
  const c = cenariosComPausa[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { ...rodada, contaId, deps, c }
}

const origens: Record<string, "agente" | "sem_modelo"> = {
  "frio-agitada": "agente",
  "pergunta-manga": "agente",
  autocorrecao: "agente",
  "estomago-pesado": "agente",
  "sem-modelo": "sem_modelo",
}

describe("cenários de demonstração", () => {
  it.each(Object.keys(cenarios))("%s termina em done com a origem esperada", async (nome) => {
    const c = cenarios[nome]
    if (!c) throw new Error(`cenário ausente: ${nome}`)
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    expect(r.status).toBe("done")
    expect(r.saida?.origem).toBe(origens[nome])
  })

  it("frio-agitada com o principal de decisao esgotado troca de modelo e termina em done", async () => {
    const c = cenarios["frio-agitada"]
    if (!c) throw new Error("cenário ausente: frio-agitada")
    const { contaId, deps } = await montarCenario(c, { esgotar: "decisao" })
    const r = await deps.companion.responder(contaId, c.entrada)
    expect(r.status).toBe("done")
    expect(r.saida?.origem).toBe("agente")
    const run = await deps.stores.runs.buscar(contaId, r.run_id)
    expect(run?.trocas_de_modelo).toBeGreaterThanOrEqual(1)
  })

  it("autocorrecao tem duas etapas de validação: recusada e depois ok", async () => {
    const c = cenarios.autocorrecao
    if (!c) throw new Error("cenário ausente: autocorrecao")
    const { contaId, deps } = await montarCenario(c)
    const r = await deps.companion.responder(contaId, c.entrada)
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    const validacoes = etapas.filter((e) => e.tipo === "validacao")
    expect(validacoes.map((e) => e.status)).toEqual(["recusado", "ok"])
  })
})

// Cenários cujas anotações viram proposta: o run termina esperando a aprovação.
const COM_BLOCO_DE_APROVACAO = ["casa-sozinha", "evitar-sozinho", "duas-intencoes", "so-atalhos"]

describe("cenários com pausa", () => {
  it.each(NOVOS_COM_PAUSA)("%s roda até done com origem do agente", async (nome) => {
    const { final } = await rodarNovo(nome)
    expect(final.status).toBe("done")
    expect(final.saida?.origem).toBe("agente")
  })

  it("casa-incerta pausa uma vez pela abóbora e pela couve", async () => {
    const { perguntas } = await rodarNovo("casa-incerta")
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]?.pergunta.tipo).toBe("casa")
    expect(perguntas[0]?.pergunta.texto).toBe("Ainda tem abóbora e couve?")
  })

  it("casa-vazia pausa uma vez com a pergunta da casa sobre os 5 itens", async () => {
    const { perguntas } = await rodarNovo("casa-vazia")
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]?.pergunta.texto).toBe(
      "Você tem mandioca, batata-doce, inhame, ghee e azeite em casa?",
    )
  })

  it("dor-de-cabeca pausa uma vez pela variante, por código", async () => {
    const { perguntas } = await rodarNovo("dor-de-cabeca")
    expect(perguntas).toHaveLength(1)
    expect(perguntas[0]?.pergunta.tipo).toBe("variante")
    expect(perguntas[0]?.pergunta.texto).toBe("Como está essa dor de cabeça?")
  })

  it("pergunta-recusada não pausa e recusa o ask_user por já confirmado", async () => {
    const { perguntas, final, contaId, deps } = await rodarNovo("pergunta-recusada")
    expect(perguntas).toHaveLength(0)
    const etapas = await deps.stores.runs.etapas(contaId, final.run_id)
    const recusas = etapas.filter((e) => e.tipo === "validacao" && e.nome === "ask_user")
    expect(recusas.map((e) => e.status)).toEqual(["recusado"])
  })

  it("cenários de conversa anteriores continuam terminando em done sem pausa", async () => {
    const anteriores = Object.keys(cenariosDeConversa).filter((n) => !NOVOS_COM_PAUSA.includes(n))
    expect(anteriores).toHaveLength(7)
    for (const nome of anteriores) {
      const c = cenariosDeConversa[nome]
      if (!c) throw new Error(`cenário ausente: ${nome}`)
      const { contaId, deps } = await montarCenario(c)
      const rodada = await rodarCenario(deps, contaId, c)
      expect(rodada.final.status, nome).toBe(
        COM_BLOCO_DE_APROVACAO.includes(nome) ? "waiting_for_approval" : "done",
      )
      expect(rodada.perguntas, nome).toHaveLength(0)
    }
  })
})

describe("cenários com aprovação", () => {
  it("aprovacao-parcial tem casa e rotina no bloco, grava só a casa e não anota a rotina", async () => {
    const c = cenariosComAprovacao["aprovacao-parcial"]
    if (!c) throw new Error("cenário ausente: aprovacao-parcial")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.bloco?.propostas.map((p) => p.tool)).toEqual(["casa.propor", "memoria.propor"])
    expect(rodada.bloco?.aprovadas).toHaveLength(1)
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["casa.propor"])
    const itens = await deps.stores.pantry.listar(contaId)
    expect(itens.some((i) => i.alimento_id === "abobora")).toBe(true)
    expect(await deps.stores.routine.notasAtivas(contaId)).toEqual([])
  })

  it("faltou-hoje pausa pela casa e põe o gengibre na lista depois de aprovar", async () => {
    const c = cenariosComAprovacao["faltou-hoje"]
    if (!c) throw new Error("cenário ausente: faltou-hoje")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.perguntas).toHaveLength(1)
    const textos = rodada.bloco?.propostas.map((p) => p.texto) ?? []
    expect(textos).toHaveLength(1)
    expect(textos[0]?.startsWith('Gengibre na lista "Para ter em casa" (faltou para ')).toBe(true)
    const lista = await deps.stores.shortages.lista(contaId)
    expect(lista.map((i) => i.alimento_id)).toEqual(["gengibre"])
  })

  it("vegetariana: Agora não não grava a restrição e a segunda mensagem sai sem o que ela barra", async () => {
    const c = cenariosComAprovacao.vegetariana
    if (!c) throw new Error("cenário ausente: vegetariana")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.bloco?.propostas.map((p) => p.texto)).toEqual(["Sua alimentação é vegetariana"])
    expect(rodada.bloco?.aprovadas).toEqual([])
    const perfil = await deps.stores.profiles.ler(contaId)
    expect(perfil.restricoes).toEqual([])
    expect(rodada.depois?.final.status).toBe("done")
    // A restrição de hoje está na lista do dia, que a primeira mensagem gravou; o preparo da segunda a lê.
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.filtro.restricoes).toContain("vegetariana")
    expect(dados.candidatos.length).toBeGreaterThan(0)
  })

  it("vegetariana: antes da primeira mensagem, o preparo não traz a restrição do dia (controle)", async () => {
    const c = cenariosComAprovacao.vegetariana
    if (!c) throw new Error("cenário ausente: vegetariana")
    const { contaId, deps } = await montarCenario(c)
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.filtro.restricoes).not.toContain("vegetariana")
  })

  it("casa-sozinha aprova o bloco e Minha casa tem abóbora, couve e pitaia", async () => {
    const c = cenariosDeConversa["casa-sozinha"]
    if (!c) throw new Error("cenário ausente: casa-sozinha")
    const { contaId, deps } = await montarCenario(c)
    const rodada = await rodarCenario(deps, contaId, c)
    expect(rodada.bloco?.resultado.gravadas).toHaveLength(1)
    const itens = await deps.stores.pantry.listar(contaId)
    const ids = itens.map((i) => i.alimento_id)
    expect(ids).toEqual(expect.arrayContaining(["abobora", "couve"]))
    expect(itens.some((i) => i.nome_livre === "pitaia")).toBe(true)
  })

  it("o registro de aprovação tem os três novos e a conversa segue com sete", () => {
    expect(Object.keys(cenariosComAprovacao).sort()).toEqual([
      "aprovacao-parcial",
      "faltou-hoje",
      "vegetariana",
    ])
    expect(Object.keys(cenariosDeConversa)).toHaveLength(7)
  })
})

// Os seis da 011: cada um confere o que a coluna "Mostra" pede, nos stores, na saída, nas etapas e no checkpoint.
async function rodarAprendizado(nome: string) {
  const c = cenariosDeAprendizado[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { c, contaId, deps, rodada }
}

describe("cenários de aprendizado (011)", () => {
  it("o registro de aprendizado tem os seis e a conversa segue com sete", () => {
    expect(Object.keys(cenariosDeAprendizado).sort()).toEqual([
      "dois-nao-ajudou",
      "entrega-registrada",
      "gosto-escrito",
      "nao-tenho-com-pergunta",
      "retorno-pelo-agente",
      "troca-por-toque",
    ])
    expect(Object.keys(cenariosDeConversa)).toHaveLength(7)
  })

  it("entrega-registrada: três retornos aguardando, faltas gravadas, cardamomo aprovado na lista", async () => {
    const { contaId, deps, rodada } = await rodarAprendizado("entrega-registrada")
    expect(rodada.final.status).toBe("waiting_for_approval")
    expect(rodada.bloco?.propostas.map((p) => p.tool)).toEqual(["lista.propor"])
    expect(rodada.bloco?.propostas[0]?.texto.startsWith("Cardamomo na lista")).toBe(true)
    expect(rodada.bloco?.resultado.gravadas).toHaveLength(1)
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    expect(pendentes).toHaveLength(3)
    const lista = await deps.stores.shortages.lista(contaId)
    expect(lista.map((i) => [i.alimento_id, i.motivo, i.detalhe])).toEqual([
      ["cardamomo", "fez_falta", "3"],
    ])
    // O cardamomo já tinha três faltas (nao_tenho) e não entra de novo nas faltas de hoje: o que a entrega grava é o que faltou no preparo.
    const faltas = await deps.stores.shortages.diasComFalta(contaId, "2026-06-15")
    expect(faltas.map((f) => f.alimento_id).sort()).toEqual(["mandioca", "tofu"])
    expect(faltas.every((f) => f.ultimo_dia === "2026-06-15")).toBe(true)
    const sugeridos = await deps.stores.preferences.ler(contaId, [
      { tipo: "pratica", id: "cha-gengibre-canela" },
    ])
    expect(sugeridos[0]?.ultima_sugestao_em).not.toBeNull()
  })

  it("troca-por-toque: canela troca por cravo na hora, sem etapa llm nova", async () => {
    const c = cenariosDeAprendizado["troca-por-toque"]
    if (!c) throw new Error("cenário ausente: troca-por-toque")
    const { contaId, deps } = await montarCenario(c)
    const semToque = { ...c, toques: undefined }
    const antes = await rodarCenario(deps, contaId, semToque)
    const llmAntes = (await deps.stores.runs.etapas(contaId, antes.final.run_id)).filter(
      (e) => e.tipo === "llm",
    )
    const resultado = await deps.touches.trocarIngrediente(contaId, {
      runId: antes.final.run_id,
      sugestao: 0,
      alimento_id: "canela",
      motivo: "trocar",
    })
    expect(resultado.resultado).toBe("trocou")
    if (resultado.resultado !== "trocou") throw new Error("troca não aconteceu")
    const item = resultado.sugestao.itens.find((i) => i.alimento_id === "canela")
    expect(item?.troca?.alimento_id).toBe("cravo")
    expect(item?.troca?.frase).toBe("Troquei canela por cravo: os dois aquecem e aliviam o peso.")
    const llmDepois = (await deps.stores.runs.etapas(contaId, antes.final.run_id)).filter(
      (e) => e.tipo === "llm",
    )
    expect(llmDepois).toHaveLength(llmAntes.length)
    const retornoId = antes.final.saida?.sugestoes[0]?.retorno_id
    const aguardando = (await deps.stores.outcomes.pendentes(contaId)).find(
      (r) => r.id === retornoId,
    )
    expect(aguardando?.sugestao.alimentos).toEqual(expect.arrayContaining(["cravo", "gengibre"]))
    expect(aguardando?.sugestao.alimentos).not.toContain("canela")
  })

  it("troca-por-toque: o toque de rodarCenario grava a troca e o cenário termina", async () => {
    const { rodada } = await rodarAprendizado("troca-por-toque")
    expect(rodada.toques?.[0]).toMatchObject({ tipo: "troca", resultado: { resultado: "trocou" } })
  })

  it("nao-tenho-com-pergunta: gengibre acabou, pergunta pelo candidato, Não tenho nele, semSubstituto", async () => {
    const { contaId, deps, rodada } = await rodarAprendizado("nao-tenho-com-pergunta")
    const [toque] = rodada.toques ?? []
    expect(toque?.tipo).toBe("troca")
    if (toque?.tipo !== "troca") throw new Error("toque ausente")
    expect(toque.resultado.resultado).toBe("perguntar")
    if (toque.resultado.resultado !== "perguntar") throw new Error("sem pergunta")
    const candidato = toque.resultado.pergunta.alimento_id
    expect(toque.resultado.pergunta.texto).toBe(
      `Você tem ${toque.resultado.pergunta.nome.toLowerCase()} em casa?`,
    )
    expect(toque.resposta).toEqual({
      resultado: "sem_substituto",
      texto: "Não achei uma troca para gengibre com o que você tem em casa.",
    })
    const casa = await deps.stores.pantry.listar(contaId)
    expect(casa.find((i) => i.alimento_id === "gengibre")?.estado).toBe("acabou")
    const faltas = await deps.stores.shortages.diasComFalta(contaId, "2026-01-01")
    expect(faltas.map((f) => f.alimento_id)).toEqual(
      expect.arrayContaining(["gengibre", candidato]),
    )
    const metricas = deps.telemetry.metricas
    expect(
      metricas.filter(
        (m) =>
          m.nome === "ritu_troca_ingrediente_total" && m.rotulos?.resultado === "sem_substituto",
      ),
    ).toHaveLength(1)
    expect(
      metricas.filter((m) => m.nome === "ritu_faltas_total" && m.rotulos?.origem === "nao_tenho"),
    ).toHaveLength(2)
  })

  it("dois-nao-ajudou: o chá sai da primeira resposta e vai para o fim do seu tipo no preparo seguinte", async () => {
    const { contaId, deps, rodada } = await rodarAprendizado("dois-nao-ajudou")
    expect(rodada.toques?.map((t) => t.tipo === "retorno" && t.retorno.resultado)).toEqual([
      "nao_ajudou",
      "nao_ajudou",
    ])
    const pratica = await deps.stores.preferences.ler(contaId, [
      { tipo: "pratica", id: "cha-gengibre" },
    ])
    expect(pratica[0]?.nao_ajudou).toBe(2)
    const sugeridos = rodada.final.saida?.sugestoes.map((s) => s.pratica_id) ?? []
    expect(sugeridos).not.toContain("cha-gengibre")
    expect(rodada.depois?.final.status).toBe("done")
    // O preparo da mensagem seguinte (com_frio), como o da segunda mensagem do cenário; o checkpoint do run encerrado não guarda o preparo.
    const dados = await preparar(
      {
        stores: deps.stores,
        kb: createContainer().knowledge,
        clock: deps.clock,
        telemetry: deps.telemetry,
      },
      contaId,
      { intencoes: ["momento"], estados: ["com_frio"], evitar_da_mensagem: [] },
    )
    // A ordem completa (candidatos_completos) põe o chá com dois "não ajudou" seguidos no fim dos chás; o corte por tipo o tira do contexto.
    const chasNaOrdem = dados.candidatos_completos.filter((id) => id.startsWith("cha-"))
    expect(chasNaOrdem.length).toBeGreaterThanOrEqual(2)
    expect(chasNaOrdem[chasNaOrdem.length - 1]).toBe("cha-gengibre")
    expect(dados.candidatos.some((c) => c.id === "cha-gengibre")).toBe(false)
  })

  it("retorno-pelo-agente: o ajudou da mensagem fecha o pendente 1 com origem conversa", async () => {
    const { contaId, deps, rodada } = await rodarAprendizado("retorno-pelo-agente")
    expect(rodada.final.status).toBe("done")
    // O pendente 1 é o arroz (o mais recente); o chá da própria resposta também fica aguardando.
    const pendentes = (await deps.stores.outcomes.pendentes(contaId)).map((r) => r.id)
    expect(pendentes).not.toContain(deps.retornosSemeados[0])
    expect(pendentes).toContain(deps.retornosSemeados[1])
    const conversa = deps.telemetry.metricas.filter(
      (m) =>
        m.nome === "ritu_retorno_total" &&
        m.rotulos?.resultado === "ajudou" &&
        m.rotulos?.origem === "conversa",
    )
    expect(conversa).toHaveLength(1)
  })

  it("gosto-escrito: a linha Você gosta de gengibre vai no bloco, é aprovada e grava a preferência", async () => {
    const { contaId, deps, rodada } = await rodarAprendizado("gosto-escrito")
    expect(rodada.bloco?.propostas.map((p) => p.texto)).toEqual(["Você gosta de gengibre"])
    expect(rodada.bloco?.aprovadas).toHaveLength(1)
    const [pref] = await deps.stores.preferences.ler(contaId, [
      { tipo: "alimento", id: "gengibre" },
    ])
    expect(pref?.gosto).toBe("gosta")
  })
})

// Os seis da 012 (rotina e padrões): cada um confere o que a coluna "Mostra" pede, nos stores, nas etapas, no bloco e no contexto.
const FRASE_DO_CHA =
  "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar."

async function rodarDeMemoria(nome: string) {
  const c = cenariosDeMemoria[nome]
  if (!c) throw new Error(`cenário ausente: ${nome}`)
  const { contaId, deps } = await montarCenario(c)
  const rodada = await rodarCenario(deps, contaId, c)
  return { c, contaId, deps, rodada }
}

describe("cenários de rotina e padrões (012)", () => {
  it("o registro de memória tem os seis e a conversa segue com sete", () => {
    expect(Object.keys(cenariosDeMemoria).sort()).toEqual([
      "estados-juntos",
      "padrao-agora-nao",
      "padrao-confirmado",
      "padrao-recusado",
      "rotina-resumida",
      "rotina-sem-modelo",
    ])
    expect(Object.keys(cenariosDeConversa)).toHaveLength(7)
  })

  it("rotina-resumida: a linha da rotina vai no bloco, é aprovada e o resumo novo sai sem o almoço fora", async () => {
    const { contaId, deps, rodada } = await rodarDeMemoria("rotina-resumida")
    expect(rodada.final.status).toBe("waiting_for_approval")
    expect(rodada.bloco?.propostas.map((p) => p.texto)).toEqual([
      "Você voltou a almoçar em casa todo dia",
    ])
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["memoria.propor"])
    const resumo = await deps.stores.routine.resumo(contaId)
    expect(resumo?.texto).toBe(
      "Você voltou a almoçar em casa todo dia. Você acorda às 5 h às terças.",
    )
    expect(resumo?.texto).not.toContain("almoça fora")
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    expect(etapas.filter((e) => e.tipo === "memoria").map((e) => e.resumo)).toEqual(["modelo"])
    expect(rodada.depois?.final.status).toBe("done")
    // O contexto da segunda mensagem: o preparo lê o resumo novo (o checkpoint de um run sem pausa não guarda o preparo).
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.resumo_de_rotina).toBe(resumo?.texto)
  })

  it("rotina-sem-modelo: o resumo é o de código, com as três notas, a mais recente primeiro; a aprovação termina em done", async () => {
    const { contaId, deps, rodada } = await rodarDeMemoria("rotina-sem-modelo")
    expect(rodada.bloco?.resultado.status).toBe("done")
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["memoria.propor"])
    const resumo = await deps.stores.routine.resumo(contaId)
    expect(resumo?.texto).toBe(
      "Você voltou a almoçar em casa todo dia. Você acorda às 5 h às terças. Você almoça fora durante a semana.",
    )
    const etapas = await deps.stores.runs.etapas(contaId, rodada.final.run_id)
    expect(etapas.filter((e) => e.tipo === "memoria").map((e) => e.resumo)).toEqual(["codigo"])
  })

  it("padrao-confirmado: a linha do padrão vai no bloco, é aprovada e a segunda mensagem leva a frase em padroes", async () => {
    const { contaId, deps, rodada } = await rodarDeMemoria("padrao-confirmado")
    expect(rodada.bloco?.propostas.map((p) => p.texto)).toEqual([
      `Notei isto. Está certo? ${FRASE_DO_CHA}`,
    ])
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["padrao.confirmar"])
    const padroes = await deps.stores.patterns.listar(contaId)
    expect(padroes.map((p) => [p.chave, p.status])).toEqual([
      ["com_frio+agitada|pratica:cha-gengibre-canela", "confirmado"],
    ])
    expect(rodada.depois?.final.status).toBe("done")
    const dados = await preparoDaSegunda(deps, contaId)
    expect(dados.padroes).toContain(FRASE_DO_CHA)
  })

  it("padrao-recusado: a linha da casa é aprovada, o padrão vira recusado e a detecção de novo não propõe", async () => {
    const { contaId, deps, rodada } = await rodarDeMemoria("padrao-recusado")
    expect(rodada.bloco?.propostas.map((p) => p.tool)).toEqual(["casa.propor", "padrao.confirmar"])
    expect(rodada.bloco?.aprovadas).toHaveLength(1)
    expect(rodada.bloco?.resultado.gravadas.map((p) => p.tool)).toEqual(["casa.propor"])
    const padroes = await deps.stores.patterns.listar(contaId)
    expect(padroes.map((p) => p.status)).toEqual(["recusado"])
    expect(await deps.patterns.detectarPadroesDaConta(contaId)).toBe(0)
  })

  it("padrao-agora-nao: o padrão continua candidato e a segunda resposta, no mesmo dia, não traz a linha", async () => {
    const { contaId, deps, rodada } = await rodarDeMemoria("padrao-agora-nao")
    expect(rodada.bloco?.resultado.gravadas).toEqual([])
    expect(rodada.final.saida?.propostas.map((p) => p.tool)).toContain("padrao.confirmar")
    const padroes = await deps.stores.patterns.listar(contaId)
    expect(padroes.map((p) => p.status)).toEqual(["candidato"])
    expect(rodada.depois?.final.status).toBe("done")
    const tools = rodada.depois?.final.saida?.propostas.map((p) => p.tool) ?? []
    expect(tools).not.toContain("padrao.confirmar")
  })

  it("estados-juntos: a linha de pesada com sem energia vai no bloco, que fica aberto", async () => {
    const { contaId, deps, rodada } = await rodarDeMemoria("estados-juntos")
    expect(rodada.final.status).toBe("waiting_for_approval")
    expect(rodada.final.saida?.propostas.map((p) => p.texto)).toEqual([
      "Notei isto. Está certo? Quando você está pesada, costuma estar também sem energia.",
    ])
    const padroes = await deps.stores.patterns.listar(contaId)
    expect(padroes.map((p) => [p.tipo, p.chave, p.status])).toEqual([
      ["estados_juntos", "pesada>sem_energia", "candidato"],
    ])
  })

  it("nenhuma linha de rotina, resumo ou padrão dos seis tem palavra de incômodo", async () => {
    const kb = createContainer().knowledge
    for (const nome of Object.keys(cenariosDeMemoria)) {
      const { contaId, deps } = await rodarDeMemoria(nome)
      const textos = [
        ...(await deps.stores.routine.notasAtivas(contaId)).map((n) => n.texto),
        (await deps.stores.routine.resumo(contaId))?.texto ?? "",
        ...(await deps.stores.patterns.listar(contaId)).map((p) => p.frase),
      ]
      for (const texto of textos) {
        expect(contemIncomodo(texto, kb), `${nome}: ${texto}`).toBe(false)
      }
    }
  })
})
