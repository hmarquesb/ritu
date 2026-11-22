import { beforeEach, describe, expect, it } from "vitest"
import type { BastidoresStore } from "@/core/bastidores/ports"
import type { Caminho } from "@/core/runs/ports"
import type { Stores } from "@/core/stores"
import type { ContractEnv } from "./env"

export type BastidoresEnv = ContractEnv & { bastidores: BastidoresStore }

const DIA = "2026-01-15"
const OPCOES = {
  topTools: 5,
  toolsFora: ["ask_user", "finalizar", "memoria.propor", "lista.propor"],
}
const SUGESTAO = { tipo: "cha" as const, alimentos: ["gengibre"], titulo: "Chá de gengibre" }

type Fixture = {
  caminho?: Caminho
  status?: "done" | "failed" | "cancelled" | "running"
  dia?: string
  intencoes?: string[]
  latencia_ms?: number
  passos?: number
  juiz_aprovado?: boolean | null
  juiz_tentativas?: number
  trocas_de_modelo?: number
}

let contas = 0

/** Uma conta nova por chamada: runs abertos são um por conta. */
async function novaConta(stores: Stores): Promise<string> {
  contas += 1
  const conta = await stores.accounts.criar({
    tipo: "google",
    google_sub: `sub-bastidores-${contas}`,
    email: `bastidores${contas}@exemplo.com`,
  })
  return conta.id
}

async function criarRun(stores: Stores, conta: string, f: Fixture = {}): Promise<string> {
  const run = await stores.runs.criar(conta, {
    caminho: f.caminho ?? "acompanhante",
    intencoes: f.intencoes ?? ["pergunta"],
    dia: f.dia ?? DIA,
  })
  await stores.runs.atualizar(conta, run.id, {
    status: f.status ?? "done",
    latencia_ms: f.latencia_ms ?? 1000,
    passos: f.passos ?? 1,
    juiz_aprovado: f.juiz_aprovado ?? null,
    juiz_tentativas: f.juiz_tentativas ?? 0,
    trocas_de_modelo: f.trocas_de_modelo ?? 0,
  })
  return run.id
}

async function runConcluido(
  stores: Stores,
  f: Fixture = {},
): Promise<{ conta: string; run: string }> {
  const conta = await novaConta(stores)
  return { conta, run: await criarRun(stores, conta, f) }
}

async function etapaTool(stores: Stores, conta: string, run: string, nome: string): Promise<void> {
  await stores.runs.acrescentarEtapa(conta, run, {
    tipo: "tool",
    nome,
    resumo: null,
    status: "ok",
    duracao_ms: 5,
    modelo: null,
    tokens_entrada: 0,
    tokens_saida: 0,
  })
}

export function bastidoresContract(make: () => Promise<BastidoresEnv> | BastidoresEnv): void {
  describe("contrato: BastidoresStore", () => {
    let env: BastidoresEnv

    beforeEach(async () => {
      env = await make()
      await env.reset?.()
    })

    it("janela inclusiva: os dois extremos entram e o dia de fora não", async () => {
      await runConcluido(env.stores, { dia: "2026-01-10" })
      await runConcluido(env.stores, { dia: "2026-01-16" })
      await runConcluido(env.stores, { dia: "2026-01-17" })
      await runConcluido(env.stores, { dia: "2026-01-09" })

      const agregados = await env.bastidores.agregadosDosRuns("2026-01-10", "2026-01-16", OPCOES)
      expect(agregados.runs).toBe(2)
    })

    it("status fora: só run done conta", async () => {
      await runConcluido(env.stores, { status: "done" })
      await runConcluido(env.stores, { status: "failed" })
      await runConcluido(env.stores, { status: "cancelled" })
      await runConcluido(env.stores, { status: "running" })

      const agregados = await env.bastidores.agregadosDosRuns(DIA, DIA, OPCOES)
      expect(agregados.runs).toBe(1)
    })

    it("caminho fora: passos médios só dos runs de acompanhante", async () => {
      await runConcluido(env.stores, { caminho: "acompanhante", passos: 2 })
      await runConcluido(env.stores, { caminho: "acompanhante", passos: 4 })
      await runConcluido(env.stores, { caminho: "casa", passos: 10 })

      const agregados = await env.bastidores.agregadosDosRuns(DIA, DIA, OPCOES)
      expect(agregados.passos_medios).toBe(3)
    })

    it("passos e duração são nulos sem run de acompanhante ou sem run", async () => {
      await runConcluido(env.stores, { caminho: "casa" })

      const semAcompanhante = await env.bastidores.agregadosDosRuns(DIA, DIA, OPCOES)
      expect(semAcompanhante.passos_medios).toBeNull()

      const vazio = await env.bastidores.agregadosDosRuns("2030-01-01", "2030-01-02", OPCOES)
      expect(vazio).toMatchObject({ runs: 0, duracao_p50_ms: null, passos_medios: null })
    })

    it("juiz nulo fora: julgados e refeitas só contam runs com juiz_aprovado não nulo", async () => {
      await runConcluido(env.stores, { juiz_aprovado: null, juiz_tentativas: 0 })
      await runConcluido(env.stores, { juiz_aprovado: true, juiz_tentativas: 1 })
      await runConcluido(env.stores, { juiz_aprovado: false, juiz_tentativas: 2 })

      const agregados = await env.bastidores.agregadosDosRuns(DIA, DIA, OPCOES)
      expect(agregados.juiz).toEqual({ julgados: 2, refeitas: 1 })
    })

    it("toolsFora: ask_user e finalizar não aparecem nas tools, e o limite vale", async () => {
      const { conta, run } = await runConcluido(env.stores)
      await etapaTool(env.stores, conta, run, "ask_user")
      await etapaTool(env.stores, conta, run, "finalizar")
      await etapaTool(env.stores, conta, run, "ayurveda.alimento")
      await etapaTool(env.stores, conta, run, "clima.agora")

      const agregados = await env.bastidores.agregadosDosRuns(DIA, DIA, {
        topTools: 1,
        toolsFora: OPCOES.toolsFora,
      })
      expect(agregados.tools).toEqual([{ tool: "ayurveda.alimento", total: 1 }])
    })

    it("empate por id: intenções e tools com o mesmo total saem pelo nome", async () => {
      const { conta, run } = await runConcluido(env.stores, { intencoes: ["vida", "casa"] })
      await etapaTool(env.stores, conta, run, "clima.agora")
      await etapaTool(env.stores, conta, run, "ayurveda.alimento")

      const agregados = await env.bastidores.agregadosDosRuns(DIA, DIA, OPCOES)
      expect(agregados.intencoes).toEqual([
        { intencao: "casa", total: 1 },
        { intencao: "vida", total: 1 },
      ])
      expect(agregados.tools.map((t) => t.tool)).toEqual(["ayurveda.alimento", "clima.agora"])
    })

    it("sinais: registrar o dia conta votos e retornos e devolve os cinco sinais", async () => {
      const { conta, run } = await runConcluido(env.stores)
      await env.stores.runs.votar(conta, run, "up")
      const [retorno] = await env.stores.outcomes.criar(conta, run, [SUGESTAO])
      if (!retorno) throw new Error("retorno não criado")
      await env.stores.outcomes.responder(conta, retorno.id, "ajudou", "toque")

      const gravados = await env.bastidores.registrarSinaisDoDia(DIA, "America/Sao_Paulo")
      expect(gravados).toBe(5)

      expect(await env.bastidores.sinais(DIA, DIA)).toEqual({
        feedback: { up: 1, down: 0 },
        retornos: { ajudou: 1, nao_ajudou: 0, nao_fez: 0 },
      })
    })

    it("idempotência do registro: rodar duas vezes deixa os mesmos valores", async () => {
      const { conta, run } = await runConcluido(env.stores)
      await env.stores.runs.votar(conta, run, "down")

      await env.bastidores.registrarSinaisDoDia(DIA, "America/Sao_Paulo")
      const primeira = await env.bastidores.sinais(DIA, DIA)
      await env.bastidores.registrarSinaisDoDia(DIA, "America/Sao_Paulo")
      const segunda = await env.bastidores.sinais(DIA, DIA)

      expect(segunda).toEqual(primeira)
      expect(segunda.feedback).toEqual({ up: 0, down: 1 })
    })

    it("dia local: voto de 23:30 em São Paulo conta no dia de São Paulo", async () => {
      env.clock.set("2026-01-16T02:30:00.000Z")
      const { conta, run } = await runConcluido(env.stores, { dia: DIA })
      await env.stores.runs.votar(conta, run, "up")

      await env.bastidores.registrarSinaisDoDia("2026-01-15", "America/Sao_Paulo")
      await env.bastidores.registrarSinaisDoDia("2026-01-16", "America/Sao_Paulo")

      expect((await env.bastidores.sinais("2026-01-15", "2026-01-15")).feedback.up).toBe(1)
      expect((await env.bastidores.sinais("2026-01-16", "2026-01-16")).feedback.up).toBe(0)
    })

    it("voto de conta apagada depois do registro continua contado na semana", async () => {
      const { conta, run } = await runConcluido(env.stores)
      await env.stores.runs.votar(conta, run, "up")
      await env.bastidores.registrarSinaisDoDia(DIA, "America/Sao_Paulo")

      await env.stores.accounts.apagar(conta)

      expect(await env.bastidores.sinais(DIA, DIA)).toMatchObject({ feedback: { up: 1, down: 0 } })
    })

    it("apagarSinaisAntesDe apaga os dias antes do corte e devolve quantos sinais saíram", async () => {
      const { conta, run } = await runConcluido(env.stores)
      await env.stores.runs.votar(conta, run, "up")
      await env.bastidores.registrarSinaisDoDia(DIA, "America/Sao_Paulo")

      expect(await env.bastidores.apagarSinaisAntesDe(DIA)).toBe(0)
      expect(await env.bastidores.apagarSinaisAntesDe("2026-01-16")).toBe(5)
      expect((await env.bastidores.sinais(DIA, DIA)).feedback.up).toBe(0)
    })
  })
}
