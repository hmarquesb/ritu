import { describe, expect, it } from "vitest"
import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import { gravarResposta } from "@/core/runs/gravar-resposta"
import type { Pergunta, RespostaDaPessoa } from "@/core/runs/pergunta"
import type { Transactor } from "@/core/stores"
import {
  type Cenario,
  cenarios,
  cenariosDeConversa,
  type DepsDoCenario,
  montarCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"

// Entrega do momento frio-agitada (sem conversa, pelo Acompanhante): o que a entrega grava e o que não grava.
// Faltas do dia do frio-agitada: batata-doce e tofu (teria_entrado). Retornos e "já sugerido" saem da saída entregue.

const DIA = "2026-06-15"

// Uma recusa pela validação: id fora dos candidatos (o validador recusa e o run pede correção).
const recusa: Cenario["roteiro"][number] = {
  texto: "Vou montar a resposta com o chá.",
  chamadas: [
    {
      nome: "finalizar",
      argumentos: {
        resposta: "Um chá de hortelã morno ajuda a refrescar agora.",
        sugestoes: [
          {
            tipo: "cha",
            id: "cha-inexistente",
            motivo: "Refresca o corpo quando há calor.",
          },
        ],
        incertos: [],
      },
    },
  ],
}

function frioAgitada(): Cenario {
  const c = cenarios["frio-agitada"]
  if (!c) throw new Error("cenário frio-agitada ausente")
  return c
}

async function entregar(c: Cenario) {
  const { contaId, deps } = await montarCenario(c)
  const r = await deps.companion.responder(contaId, c.entrada)
  return { contaId, deps, r }
}

async function faltasDeHoje(deps: DepsDoCenario, contaId: string) {
  return (await deps.stores.shortages.diasComFalta(contaId, DIA)).filter(
    (f) => f.ultimo_dia === DIA,
  )
}

describe("entrega grava retornos aguardando, um por sugestão", () => {
  it("cada sugestão entregue vira um retorno aguardando e leva o id na saída", async () => {
    const { contaId, deps, r } = await entregar(frioAgitada())
    const sugestoes = r.saida?.sugestoes ?? []
    const pendentes = await deps.stores.outcomes.pendentes(contaId)

    expect(sugestoes).toHaveLength(3)
    expect(pendentes.map((p) => p.id).sort()).toEqual(
      sugestoes.map((s) => s.retorno_id ?? "").sort(),
    )
    for (const p of pendentes) {
      expect(p).toMatchObject({
        status: "aguardando",
        resultado: null,
        origem: null,
        run_id: r.run_id,
      })
    }
    expect(pendentes.map((p) => p.sugestao.titulo).sort()).toEqual(
      sugestoes.map((s) => s.titulo).sort(),
    )
  })

  it("a sugestão ganha o id do retorno e os alimentos efetivos", async () => {
    const { deps, contaId, r } = await entregar(frioAgitada())
    const pendentes = await deps.stores.outcomes.pendentes(contaId)
    const cha = r.saida?.sugestoes.find((s) => s.tipo === "cha")
    const retorno = pendentes.find((p) => p.id === cha?.retorno_id)

    expect(retorno?.sugestao).toEqual({
      tipo: "cha",
      pratica_id: "cha-gengibre-limao-mel",
      alimentos: ["gengibre", "limao", "mel"],
      titulo: cha?.titulo,
    })
  })
})

describe("entrega marca o já sugerido", () => {
  it("prática, preparo e alimentos entregues ganham a hora da entrega", async () => {
    const c = frioAgitada()
    const { contaId, deps } = await entregar(c)
    const prefs = await deps.stores.preferences.ler(contaId)
    const sugeridoEm = (tipo: string, id: string) =>
      prefs.find((p) => p.item_tipo === tipo && p.item_id === id)?.ultima_sugestao_em

    expect(sugeridoEm("pratica", "cha-gengibre-limao-mel")).toBe(c.agora)
    expect(sugeridoEm("preparo", "arroz-com-legume")).toBe(c.agora)
    expect(sugeridoEm("pratica", "comer-sentada-sem-tela")).toBe(c.agora)
    expect(sugeridoEm("alimento", "gengibre")).toBe(c.agora)
  })

  it("item que não foi sugerido não ganha a marca", async () => {
    const { contaId, deps } = await entregar(frioAgitada())
    const prefs = await deps.stores.preferences.ler(contaId)

    expect(prefs.find((p) => p.item_id === "cardamomo")).toBeUndefined()
  })
})

describe("entrega grava as faltas do run como teria_entrado", () => {
  it("as faltas do run entram no dia local, uma por alimento", async () => {
    const { contaId, deps } = await entregar(frioAgitada())
    const hoje = await faltasDeHoje(deps, contaId)

    expect(hoje.map((f) => f.alimento_id).sort()).toEqual(["batata-doce", "tofu"])
    expect(hoje.every((f) => f.dias === 1)).toBe(true)
  })

  it("cada falta gravada soma ritu_faltas_total com origem teria_entrado", async () => {
    const { deps } = await entregar(frioAgitada())
    const contagens = deps.telemetry.metricas.filter(
      (m) => m.nome === "ritu_faltas_total" && m.rotulos.origem === "teria_entrado",
    )

    expect(contagens).toHaveLength(2)
  })

  it("a mesma falta no mesmo dia conta uma vez no dia", async () => {
    const c = frioAgitada()
    const dobrado: Cenario = { ...c, roteiro: [...c.roteiro, ...c.roteiro] }
    const { contaId, deps } = await montarCenario(dobrado)
    await deps.companion.responder(contaId, dobrado.entrada)
    await deps.companion.responder(contaId, dobrado.entrada)
    const hoje = await faltasDeHoje(deps, contaId)

    expect(hoje.map((f) => f.alimento_id).sort()).toEqual(["batata-doce", "tofu"])
    expect(hoje.every((f) => f.dias === 1)).toBe(true)
  })
})

describe("entrega não grava nada quando a saída não é a do agente", () => {
  it("saída segura (limite de recusas): nenhum retorno, nenhuma marca, nenhuma falta", async () => {
    const c: Cenario = { ...frioAgitada(), roteiro: [recusa, recusa, recusa] }
    const { contaId, deps, r } = await entregar(c)

    expect(r.fim).toBe("limite")
    expect(r.saida?.origem).toBe("segura")
    expect(await deps.stores.outcomes.pendentes(contaId)).toEqual([])
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    expect(await faltasDeHoje(deps, contaId)).toEqual([])
  })

  it("run failed (erro do modelo): nenhum retorno, nenhuma marca, nenhuma falta", async () => {
    const c: Cenario = {
      ...frioAgitada(),
      roteiro: [{ texto: "Vou responder.", erro: "resposta_invalida" }],
    }
    const { contaId, deps, r } = await entregar(c)

    expect(r.status).toBe("failed")
    expect(await deps.stores.outcomes.pendentes(contaId)).toEqual([])
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    expect(await faltasDeHoje(deps, contaId)).toEqual([])
  })

  it("saída de código (ofensa): não grava retorno nem falta, e os retornos que já existiam seguem", async () => {
    const ofensa = cenariosDeConversa.ofensa
    if (!ofensa) throw new Error("cenário ofensa ausente")
    const semente = {
      ...ofensa,
      retornos: [
        {
          sugestao: {
            tipo: "cha" as const,
            pratica_id: "cha-gengibre",
            alimentos: ["gengibre"],
            titulo: "Chá de gengibre",
          },
          diasAtras: 1,
        },
      ],
    }
    const { contaId, deps } = await montarCenario(semente)
    const rodada = await rodarCenario(deps, contaId, semente)
    const saida: SaidaDoAcompanhante | undefined = rodada.final.saida

    expect(saida?.origem).toBe("codigo")
    expect(await deps.stores.outcomes.pendentes(contaId)).toHaveLength(1)
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    expect(await faltasDeHoje(deps, contaId)).toEqual([])
  })
})

describe("'Tenho' durante o run tira a falta de hoje", () => {
  it("a resposta 'tenho' a uma pergunta de casa do mesmo run tira o alimento das faltas", async () => {
    const { contaId, deps, r } = await entregar(frioAgitada())
    expect((await faltasDeHoje(deps, contaId)).map((f) => f.alimento_id)).toContain("batata-doce")

    const pergunta: Pergunta = {
      tipo: "casa",
      texto: "Você tem batata-doce em casa?",
      itens: [{ alimento_id: "batata-doce", nome: "batata-doce" }],
    }
    const resposta: RespostaDaPessoa = {
      tipo: "casa",
      itens: [{ alimento_id: "batata-doce", resposta: "tenho" }],
    }
    // O mesmo caminho da resposta de casa do run: a transação é a das stores em memória.
    const tx: Transactor = { emTransacao: (fn) => fn(deps.stores) }
    await gravarResposta(
      { tx, telemetry: deps.telemetry },
      contaId,
      r.run_id,
      DIA,
      pergunta,
      resposta,
    )

    expect((await faltasDeHoje(deps, contaId)).map((f) => f.alimento_id)).toEqual(["tofu"])
  })
})

describe("entrega é tudo ou nada", () => {
  it("falha no meio da gravação: nenhum retorno, nenhuma marca e nenhuma falta ficam gravados", async () => {
    const c = frioAgitada()
    const { contaId, deps } = await montarCenario(c)
    // Falha depois de criar os retornos: o que já foi escrito na transação deve voltar.
    deps.stores.preferences.marcarSugerido = async () => {
      throw new Error("falha simulada")
    }
    const r = await deps.companion.responder(contaId, c.entrada)

    expect(r.status).toBe("done")
    expect(r.saida?.sugestoes.every((s) => s.retorno_id === undefined)).toBe(true)
    expect(await deps.stores.outcomes.pendentes(contaId)).toEqual([])
    expect(await deps.stores.preferences.ler(contaId)).toEqual([])
    expect(await faltasDeHoje(deps, contaId)).toEqual([])
    const etapas = await deps.stores.runs.etapas(contaId, r.run_id)
    expect(etapas.some((e) => e.tipo === "erro" && e.nome === "registro_da_entrega")).toBe(true)
  })
})
