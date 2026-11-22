import { config } from "@config/index"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { DepsDaRota } from "@/app/_lib/rota"
import { rotasDeFluxoDeRun } from "@/app/_rotas/fluxo-de-run"
import type { Conta } from "@/core/accounts/types"
import type { EventoDaTela } from "@/core/conversation/eventos"
import type { Estado } from "@/core/knowledge/vocab"
import { decidirMensagem } from "@/core/limits/mensagens"
import { diaLocal } from "@/core/time/dia-local"
import { createContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createFixedClock } from "@/infra/fakes/fixed-clock"
import { createMemoryLimiter } from "@/infra/fakes/memory-limiter"
import { createMemoryStores } from "@/infra/fakes/memory-stores"
import { createMemoryTelemetry } from "@/infra/fakes/memory-telemetry"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { montarCenario } from "../../../test/fixtures/cenarios"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"
import { cenario, com } from "./apoio"

const TEXTO = "estou com frio"
// 16h em São Paulo: há práticas "pratica" para o frio nessa faixa (as de chá são de outro tipo e não entram sem modelo).
const TARDE = "2026-06-15T19:00:00.000Z"

function base(atalhos: Estado[]): CenarioDeConversa {
  return {
    ...com(cenario("so-atalhos"), TEXTO, { intencoes: ["momento"], estados: ["com_frio"] }),
    agora: TARDE,
    mensagem: { texto: TEXTO, atalhos },
  }
}

// Mensagem com texto e atalhos, em que o papel do Intérprete (apoio) está esgotado no dia.
function semModelo(atalhos: Estado[]): CenarioDeConversa {
  return { ...base(atalhos), esgotado: "apoio" }
}

// Mensagem com texto e atalhos, em que o Intérprete responde com erro.
function comErro(atalhos: Estado[]): CenarioDeConversa {
  return base(atalhos)
}

async function rodar(c: CenarioDeConversa, respostas: unknown[]) {
  const llm = createFakeLlm(respostas)
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { llm, runtime })
  const resposta = await deps.conversation.conversar(contaId, c.mensagem)
  const run = await deps.stores.runs.buscar(contaId, resposta.run_id)
  const etapas = await deps.stores.runs.etapas(contaId, resposta.run_id)
  const fallback = deps.telemetry.metricas.filter((m) => m.nome === "ritu_fallback_sem_llm_total")
  return { resposta, run, etapas, runtime, fallback, llm }
}

const CASOS: [string, Estado[]][] = [
  ["com atalhos", ["com_frio"]],
  ["sem atalhos", []],
]

describe.each([
  ["Intérprete sem modelo (papel apoio esgotado)", (atalhos: Estado[]) => semModelo(atalhos), []],
  [
    "Intérprete com erro (indisponível)",
    (atalhos: Estado[]) => comErro(atalhos),
    [{ erro: "indisponivel" }],
  ],
] as const)("%s", (_, montar, respostas) => {
  it.each(CASOS)("%s: o run cai em sem_modelo, sem chamar o runtime", async (_nome, atalhos) => {
    const { run, runtime, resposta } = await rodar(montar(atalhos), [...respostas])

    expect(run?.caminho).toBe("sem_modelo")
    expect(resposta.saida?.origem).toBe("sem_modelo")
    expect(resposta.saida?.resposta.length).toBeGreaterThan(0)
    expect(runtime.pedidos).toHaveLength(0)
  })

  it.each(CASOS)("%s: a etapa do Intérprete fica como falha", async (_nome, atalhos) => {
    const { etapas } = await rodar(montar(atalhos), [...respostas])
    const interprete = etapas.find((e) => e.tipo === "interprete")

    expect(interprete?.status).toBe("falhou")
  })

  it.each(CASOS)("%s: ritu_fallback_sem_llm_total soma 1", async (_nome, atalhos) => {
    const { fallback } = await rodar(montar(atalhos), [...respostas])

    expect(fallback).toHaveLength(1)
  })

  it("com atalhos, a resposta sem modelo traz práticas; sem atalhos, não traz", async () => {
    const com = await rodar(montar(["com_frio"]), [...respostas])
    const sem = await rodar(montar([]), [...respostas])

    expect(com.resposta.saida?.sugestoes.some((s) => s.tipo === "pratica")).toBe(true)
    expect(sem.resposta.saida?.sugestoes.some((s) => s.tipo === "pratica")).toBe(false)
  })
})

// Depois do limite de mensagens: a mensagem não conta. Só os atalhos seguem, sem modelo; o alerta segue com o
// texto de alerta; texto comum é recusado. Passa pela rota, que é quem decide (`decidirMensagem`).
const AGORA_TARDE = "2026-06-15T19:00:00.000Z" // 16h em São Paulo: há práticas para o frio
const IP_LIMITE = "ip-degradacao"
const FUSO = config.clima.fusoPadrao

function montarLimite() {
  vi.stubEnv("RITU_MODO", "e2e")
  const clock = createFixedClock(AGORA_TARDE)
  const stores = createMemoryStores(clock)
  const telemetry = createMemoryTelemetry()
  const limiter = createMemoryLimiter()
  const llm = createFakeLlm([])
  const runtime = createScriptedRuntime([])
  const container = createContainer({ clock, stores, tx: stores, limiter, telemetry, llm, runtime })
  return { container, stores, clock, telemetry, limiter, llm, runtime }
}

type MontagemLimite = ReturnType<typeof montarLimite>

function rotaDoLimite(m: MontagemLimite, contaId: string, teto = 1): DepsDaRota {
  return {
    contaDaSessao: async () => contaId,
    quemPede: () => ({ ipHash: IP_LIMITE, teto }),
    container: m.container,
  }
}

// Gasta o teto de uma mensagem pela mesma decisão da rota, sem conversa nem modelo.
async function gastarOLimite(m: MontagemLimite, conta: Conta) {
  const d = await decidirMensagem(
    { limiter: m.limiter, router: m.container.router, clock: m.clock, telemetry: m.telemetry },
    { conta, fuso: FUSO, ipHash: IP_LIMITE, teto: 1 },
    { texto: "quero um chá", atalhos: [] },
  )
  if (!("seguir" in d) || d.seguir !== "normal") throw new Error("a primeira mensagem devia passar")
}

const pedidoDeMensagem = (corpo: unknown) =>
  new Request("http://x/api/runs", { method: "POST", body: JSON.stringify(corpo) })

async function eventosDe(r: Response): Promise<EventoDaTela[]> {
  return (await r.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as EventoDaTela)
}

function contar(m: MontagemLimite, nome: string, rotulos: Record<string, string> = {}): number {
  return m.telemetry.metricas.filter((x) => {
    const lidos = x.rotulos as Record<string, unknown>
    return x.nome === nome && Object.entries(rotulos).every(([k, v]) => lidos[k] === v)
  }).length
}

async function contaGoogle(m: MontagemLimite, nome: string): Promise<Conta> {
  return m.stores.accounts.criar({
    tipo: "google",
    google_sub: `deg-${nome}`,
    email: `${nome}@x.test`,
  })
}

describe("depois do limite de mensagens", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("só atalhos: caminho sem modelo, nenhum pedido ao LLM, abertura de limite, até 3 práticas, sem fallback", async () => {
    const m = montarLimite()
    const conta = await contaGoogle(m, "so-atalhos")
    await gastarOLimite(m, conta)
    const fallbackAntes = contar(m, "ritu_fallback_sem_llm_total")
    const limiteAntes = contar(m, "ritu_limite_total", { resultado: "so_atalhos" })

    const r = await rotasDeFluxoDeRun(rotaDoLimite(m, conta.id)).iniciar(
      pedidoDeMensagem({ atalhos: ["com_frio"] }),
    )
    expect(r.status).toBe(200)
    const fim = (await eventosDe(r)).at(-1)
    if (fim?.tipo !== "fim") throw new Error("sem fim")

    expect(fim.visao.caminho).toBe("sem_modelo")
    expect(fim.visao.resposta).toMatch(/mensagens de hoje acabaram/)
    // Só práticas, até três. Nada foi barrado: a sugestão que sai é a que a pessoa recebe.
    expect(fim.visao.sugestoes.length).toBeGreaterThanOrEqual(1)
    expect(fim.visao.sugestoes.length).toBeLessThanOrEqual(3)
    expect(fim.visao.sugestoes.every((s) => s.tipo === "pratica")).toBe(true)

    expect(m.llm.pedidos).toHaveLength(0)
    expect(m.runtime.pedidos).toHaveLength(0)
    expect(contar(m, "ritu_limite_total", { resultado: "so_atalhos" }) - limiteAntes).toBe(1)
    expect(contar(m, "ritu_fallback_sem_llm_total")).toBe(fallbackAntes)
  })

  it.each([
    ["físico", "estou com dor no peito"],
    ["emocional", "quero morrer"],
  ])(
    "alerta %s depois do limite segue com o texto de alerta, sem 429 e sem LLM",
    async (_, texto) => {
      const m = montarLimite()
      const conta = await contaGoogle(m, `alerta-${texto.length}`)
      await gastarOLimite(m, conta)

      const r = await rotasDeFluxoDeRun(rotaDoLimite(m, conta.id)).iniciar(
        pedidoDeMensagem({ texto, atalhos: [] }),
      )
      expect(r.status).toBe(200)
      const fim = (await eventosDe(r)).at(-1)
      if (fim?.tipo !== "fim") throw new Error("sem fim")

      expect(fim.visao.caminho).toBe("alerta")
      expect(fim.visao.resposta).toBeTruthy()
      expect(m.llm.pedidos).toHaveLength(0)
      expect(contar(m, "ritu_limite_total", { resultado: "alerta" })).toBe(1)
    },
  )

  it("texto comum depois do limite é recusado com 429 limite_mensagens, sem run gravado", async () => {
    const m = montarLimite()
    const conta = await contaGoogle(m, "comum")
    await gastarOLimite(m, conta)

    const r = await rotasDeFluxoDeRun(rotaDoLimite(m, conta.id)).iniciar(
      pedidoDeMensagem({ texto: "quero um chá", atalhos: [] }),
    )
    expect(r.status).toBe(429)
    expect(((await r.json()) as { erro: string }).erro).toBe("limite_mensagens")
    expect(contar(m, "ritu_limite_total", { resultado: "barrado" })).toBe(1)
    expect(await m.stores.runs.aberto(conta.id)).toBeUndefined()
    expect(await m.stores.runs.doDia(conta.id, diaLocal(m.clock.now()))).toEqual([])
  })
})
