import { describe, expect, it } from "vitest"
import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import type { EntregaDoModelo } from "@/core/agents/companion/saida"
import { filtroVazio } from "@/core/knowledge/filtros"
import type { MensagemDoLoop } from "@/core/runs/agent-runtime"
import type { Checkpoint } from "@/core/runs/checkpoint"
import type { ToolContext } from "@/core/tools/tool"
import { createFakeWeather } from "@/infra/fakes/fake-weather"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { finalizar } from "./finalizar"

const kb = createMiniKnowledge()
const CONFIRMADOS = ["gengibre", "canela", "cardamomo", "leite", "mel", "arroz-branco", "ghee"]

function dados(): DadosDoPreparo {
  return {
    versao: 1,
    intencoes: ["momento"],
    estados: ["com_frio"],
    com_incomodo: false,
    dia: "2026-11-15",
    momento_do_dia: "tarde",
    geral: false,
    qualidades: {
      presentes: ["frio"],
      buscadas: ["quente"],
      evitar_gunas: ["frio"],
      evitar_marcas: [],
      evitar: [],
      conflitos: [],
      linhas_base: ["estados:com_frio"],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: CONFIRMADOS, incertos: [] },
    candidatos: [
      {
        tipo: "cha",
        id: "cha-gengibre",
        nome: "cha-gengibre",
        itens: [],
        contribui: ["quente"],
        linha_base: "praticas:cha-gengibre",
        adequacao: 1,
        nota: 1,
        gosta: false,
        ajudou: 0,
        novidade: false,
        no_fim: false,
      },
    ],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: 7,
      itens_incertos_em_casa: 0,
      registros_de_gosto: 0,
      registros_de_resultado: 0,
      retornos_pendentes: 0,
      tem_cidade: true,
    },
    fixos: { evitar_sempre: [], restricoes: [], nao_come: [] },
    padroes: [],
    mensagens_do_dia: [],
  }
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá morno pode ajudar você a se sentir mais aquecida agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [
      {
        tipo: "cha",
        pratica_id: "cha-gengibre",
        itens: [
          { alimento_id: "gengibre", contribui: ["quente"], linha_base: "alimentos:gengibre" },
        ],
        motivo: "Aquece o corpo.",
        linhas_base: ["praticas:cha-gengibre", "alimentos:gengibre"],
        novidade: false,
      },
    ],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

function estado(mensagens: MensagemDoLoop[] = [], dadosDoRun: unknown = dados()): Checkpoint {
  return {
    versao: 1,
    agente: "acompanhante",
    prompt_versao: "acompanhante.v1",
    mensagens,
    chamadas_de_modelo: 0,
    tokens: { entrada: 0, saida: 0 },
    entregas_recusadas: 1,
    pausas: 0,
    ativo_ms: 0,
    dados: dadosDoRun,
  }
}

function ctx() {
  const telemetry = createMemoryTelemetry()
  const clock = createFixedClock("2026-11-15T12:00:00Z")
  const c: ToolContext = {
    kb,
    filtro: filtroVazio,
    sinais: { em_casa: CONFIRMADOS, gosta: [], ajudou: {} },
    clima: { fonte: createFakeWeather() },
    contaId: "conta-1",
    stores: createMemoryStores(clock),
    clock,
    telemetry,
  }
  return { c, telemetry }
}

const climaMsg = (resultado: unknown, id = "c1"): MensagemDoLoop => ({
  papel: "tool",
  chamada_id: id,
  nome: "clima.agora",
  resultado,
})

const comQuente = entrega({
  explicacao: { qualidades_do_momento: ["frio", "quente"], qualidades_buscadas: ["quente"] },
})

describe("finalizar", () => {
  it("tem nome, descrição e entrada da spec", () => {
    expect(finalizar.name).toBe("finalizar")
    expect(finalizar.input.safeParse(entrega()).success).toBe(true)
  })

  it("entrega limpa devolve a saída completa e registra o span", async () => {
    const { c, telemetry } = ctx()

    const r = await finalizar.tratar(entrega(), c, estado())

    expect(r.tipo).toBe("entregar")
    if (r.tipo === "entregar") {
      expect((r.saida as { origem: string }).origem).toBe("agente")
    }
    const span = telemetry.spans.find((s) => s.nome === "validacao")
    expect(span?.atributos).toEqual({
      "validacao.tentativa": 2,
      "validacao.ok": true,
      "validacao.violacoes": 0,
    })
    expect(telemetry.metricas).toHaveLength(0)
  })

  it("entrega com violação recusa e soma a métrica por código", async () => {
    const { c, telemetry } = ctx()

    const r = await finalizar.tratar(entrega({ resposta: "" }), c, estado())

    expect(r.tipo).toBe("recusar")
    const res = (r as { resultado: { entregue: boolean; violacoes: { codigo: string }[] } })
      .resultado
    expect(res.entregue).toBe(false)
    expect(res.violacoes.map((v) => v.codigo)).toContain("tamanho")
    expect(telemetry.metricas).toContainEqual(
      expect.objectContaining({
        nome: "ritu_validacao_violacoes_total",
        rotulos: { violacao: "tamanho" },
      }),
    )
    const span = telemetry.spans.find((s) => s.nome === "validacao")
    expect(span?.atributos["validacao.ok"]).toBe(false)
  })

  it("clima ok mais recente vale para as qualidades; sem ele a entrega é recusada", async () => {
    const quente = climaMsg({ status: "ok", gunas: ["quente"] })

    const sem = await finalizar.tratar(comQuente, ctx().c, estado())
    const com = await finalizar.tratar(comQuente, ctx().c, estado([quente]))
    const indisponivelDepois = await finalizar.tratar(
      comQuente,
      ctx().c,
      estado([quente, climaMsg({ status: "indisponivel" }, "c2")]),
    )

    expect(sem.tipo).toBe("recusar")
    expect(com.tipo).toBe("entregar")
    expect(indisponivelDepois.tipo).toBe("entregar")
  })

  it("dados fora do schema lançam", async () => {
    await expect(finalizar.tratar(entrega(), ctx().c, estado([], { versao: 2 }))).rejects.toThrow()
  })

  it("o span não leva texto da pessoa", async () => {
    const { c, telemetry } = ctx()

    await finalizar.tratar(entrega(), c, estado())

    const texto = JSON.stringify(telemetry.spans)
    expect(texto).not.toContain("Um chá morno")
  })
})
