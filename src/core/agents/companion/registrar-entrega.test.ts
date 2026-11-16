import { describe, expect, it } from "vitest"
import type { Stores, Transactor } from "@/core/stores"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createMiniKnowledge } from "@/infra/fakes/mini-knowledge"
import { type DadosDoPreparo, preparar } from "./preparo"
import { idEfetivo, registrarEntrega, sugestaoRegistrada } from "./registrar-entrega"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "./saida"
import { saidaSegura } from "./saida"

const kb = createMiniKnowledge()

function item(alimento_id: string, troca?: string): SugestaoEntregue["itens"][number] {
  return {
    alimento_id,
    nome: alimento_id,
    contribui: ["quente"],
    verbos: [],
    linha_base: `alimentos:${alimento_id}`,
    casa: "confirmado",
    ...(troca
      ? {
          troca: {
            alimento_id: troca,
            nome: troca,
            contribui: ["quente"],
            verbos: [],
            linha_base: `alimentos:${troca}`,
            frase: "x",
            anteriores: [],
          },
        }
      : {}),
  }
}

function sugestao(p: Partial<SugestaoEntregue> & { titulo: string }): SugestaoEntregue {
  return {
    tipo: "cha",
    como_fazer: "",
    itens: [],
    verbos: [],
    motivo: "",
    linhas_base: [],
    novidade: false,
    ...p,
  }
}

type ChamadaDeFalta = Parameters<Stores["shortages"]["registrar"]>
const faltasMedidas = (t: { metricas: { nome: string; rotulos: unknown }[] }) =>
  t.metricas.filter((x) => x.nome === "ritu_faltas_total")

async function montar(opts: { falhaNasFaltas?: boolean } = {}) {
  const clock = createFixedClock("2026-11-15T18:00:00.000Z")
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const conta = await stores.accounts.criar({ tipo: "demo" })
  const dados0 = await preparar({ stores, kb, clock, telemetry }, conta.id, {
    intencoes: ["pergunta"],
    estados: [],
    evitar_da_mensagem: [],
  })
  const dados: DadosDoPreparo = {
    ...dados0,
    casa: { confirmados: ["gengibre"], incertos: ["canela"] },
    faltas_do_run: [],
  }
  const run = await stores.runs.criar(conta.id, {
    caminho: "acompanhante",
    intencoes: ["pergunta"],
    dia: "2026-11-15",
  })
  const chamadas: ChamadaDeFalta[] = []
  const tx: Transactor = {
    emTransacao: (fn) =>
      stores.emTransacao((s) =>
        fn({
          ...s,
          shortages: {
            ...s.shortages,
            async registrar(...a: ChamadaDeFalta) {
              if (opts.falhaNasFaltas) throw new Error("falha_nas_faltas")
              chamadas.push(a)
              return s.shortages.registrar(...a)
            },
          },
        }),
      ),
  }
  const saida = (s: SugestaoEntregue[], origem: SaidaDoAcompanhante["origem"] = "agente") =>
    ({ ...saidaSegura(dados), origem, sugestoes: s }) as SaidaDoAcompanhante
  const rodar = (s: SaidaDoAcompanhante, d = dados) =>
    registrarEntrega(
      { tx, telemetry },
      { contaId: conta.id, runId: run.id, dia: "2026-11-15", saida: s, dados: d },
    )
  const marcados = async () =>
    (
      await stores.preferences.ler(conta.id, [
        { tipo: "pratica", id: "cha-a" },
        { tipo: "preparo", id: "kitchari" },
        { tipo: "alimento", id: "gengibre" },
        { tipo: "alimento", id: "arroz" },
        { tipo: "alimento", id: "leite" },
      ])
    )
      .filter((p) => p.ultima_sugestao_em)
      .map((p) => p.item_id)
      .sort()
  return { stores, telemetry, conta, dados, run, saida, rodar, chamadas, marcados }
}

const tres = [
  sugestao({ titulo: "A", pratica_id: "cha-a", itens: [item("gengibre"), item("leite", "arroz")] }),
  sugestao({ titulo: "B", tipo: "refeicao", preparo_id: "kitchari", itens: [item("gengibre")] }),
  sugestao({ titulo: "C", tipo: "oleo", pratica_id: "oleo-c", itens: [] }),
]

describe("sugestaoRegistrada", () => {
  it("usa o alimento da troca e leva só o que a sugestão tem", () => {
    expect(idEfetivo(item("leite", "arroz"))).toBe("arroz")
    expect(sugestaoRegistrada(tres[0] as SugestaoEntregue)).toEqual({
      tipo: "cha",
      pratica_id: "cha-a",
      alimentos: ["gengibre", "arroz"],
      titulo: "A",
    })
  })
})

describe("registrarEntrega", () => {
  it("cria um retorno por sugestão, na ordem, e devolve o retorno_id de cada uma", async () => {
    const m = await montar()
    const r = await m.rodar(m.saida(tres))
    const retornos = await m.stores.outcomes.doRun(m.conta.id, m.run.id)
    expect(retornos.map((x) => [x.sugestao.titulo, x.status])).toEqual([
      ["A", "aguardando"],
      ["B", "aguardando"],
      ["C", "aguardando"],
    ])
    for (const [i, s] of r.sugestoes.entries()) {
      expect(s.retorno_id).toBeDefined()
      expect(retornos.find((x) => x.id === s.retorno_id)?.sugestao.titulo).toBe(tres[i]?.titulo)
    }
  })

  it("marca o item e cada alimento como sugerido, com o id efetivo da troca", async () => {
    const m = await montar()
    await m.rodar(m.saida(tres))
    expect(await m.marcados()).toEqual(["arroz", "cha-a", "gengibre", "kitchari"])
  })

  it("grava faltas teria_entrado com o run_id, menos as que estão em casa, e mede cada uma", async () => {
    const m = await montar()
    const d = { ...m.dados, faltas_do_run: ["gengibre", "canela", "leite", "arroz"] }
    await m.rodar(m.saida(tres), d)
    expect(m.chamadas).toHaveLength(1)
    expect(m.chamadas[0]?.[1]).toEqual([
      { alimento_id: "leite", origem: "teria_entrado", run_id: m.run.id },
      { alimento_id: "arroz", origem: "teria_entrado", run_id: m.run.id },
    ])
    expect(faltasMedidas(m.telemetry).map((x) => x.rotulos)).toEqual([
      { origem: "teria_entrado" },
      { origem: "teria_entrado" },
    ])
  })

  it("duas entregas no mesmo dia deixam uma falta por alimento", async () => {
    const m = await montar()
    const d = { ...m.dados, faltas_do_run: ["leite"] }
    await m.rodar(m.saida([]), d)
    await m.rodar(m.saida([]), d)
    const faltas = await m.stores.shortages.diasComFalta(m.conta.id, "2026-11-01")
    expect(faltas).toEqual([{ alimento_id: "leite", dias: 1, ultimo_dia: "2026-11-15" }])
  })

  it("sem sugestão grava as faltas e nenhum retorno; sem faltas não chama o registro", async () => {
    const m = await montar()
    await m.rodar(m.saida([]), { ...m.dados, faltas_do_run: ["leite"] })
    expect(await m.stores.outcomes.doRun(m.conta.id, m.run.id)).toEqual([])
    expect(m.chamadas).toHaveLength(1)
    const n = await montar()
    await n.rodar(n.saida(tres))
    expect(n.chamadas).toHaveLength(0)
  })

  it("saída segura, de código e sem_modelo: só as duas últimas origens do agente gravam", async () => {
    const m = await montar()
    const d = { ...m.dados, faltas_do_run: ["leite"] }
    for (const origem of ["segura", "codigo"] as const) {
      const s = m.saida(tres, origem)
      expect(await m.rodar(s, d)).toBe(s)
    }
    expect(await m.stores.outcomes.doRun(m.conta.id, m.run.id)).toEqual([])
    expect(await m.marcados()).toEqual([])
    expect(m.chamadas).toHaveLength(0)
    expect(faltasMedidas(m.telemetry)).toHaveLength(0)
    await m.rodar(m.saida(tres, "sem_modelo"), d)
    expect(await m.stores.outcomes.doRun(m.conta.id, m.run.id)).toHaveLength(3)
  })

  it("falha nas faltas desfaz retornos e já sugerido, sobe o erro e não mede", async () => {
    const m = await montar({ falhaNasFaltas: true })
    const d = { ...m.dados, faltas_do_run: ["leite"] }
    await expect(m.rodar(m.saida(tres), d)).rejects.toThrow("falha_nas_faltas")
    expect(await m.stores.outcomes.doRun(m.conta.id, m.run.id)).toEqual([])
    expect(await m.marcados()).toEqual([])
    expect(faltasMedidas(m.telemetry)).toHaveLength(0)
  })
})
