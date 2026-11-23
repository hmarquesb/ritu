import { config } from "@config/index"
import { describe, expect, it, vi } from "vitest"
import { criarNumerosDaSemana, janelaDaSemana } from "@/core/bastidores/numeros"
import type { AgregadosDosRuns, BastidoresStore, SinaisDaSemana } from "@/core/bastidores/ports"
import type { Clock } from "@/core/clock"

const FUSO = "America/Sao_Paulo"

function agregados(runs: number): AgregadosDosRuns {
  return {
    runs,
    duracao_p50_ms: 1000,
    passos_medios: 2,
    juiz: { julgados: 0, refeitas: 0 },
    trocas_de_modelo: 0,
    intencoes: [],
    tools: [],
  }
}

const SINAIS: SinaisDaSemana = {
  feedback: { up: 1, down: 0 },
  retornos: { ajudou: 0, nao_ajudou: 0, nao_fez: 0 },
}

function criarStore(runs: number) {
  const agregadosDosRuns = vi.fn(async () => agregados(runs))
  const sinais = vi.fn(async () => SINAIS)
  const store: BastidoresStore = {
    agregadosDosRuns,
    sinais,
    registrarSinaisDoDia: vi.fn(async () => 5),
    apagarSinaisAntesDe: vi.fn(async () => 0),
  }
  return { store, agregadosDosRuns, sinais }
}

function criarRelogio(inicio: Date) {
  let agora = inicio
  const clock: Clock = { now: () => agora }
  return {
    clock,
    ajustar(novo: Date) {
      agora = novo
    },
  }
}

describe("janelaDaSemana", () => {
  it("devolve os 7 dias completos antes de hoje, no fuso dado", () => {
    // 00:30 de 2026-12-10 em São Paulo (UTC-3)
    const janela = janelaDaSemana(new Date("2026-12-10T03:30:00Z"), FUSO)
    expect(janela).toEqual({ de: "2026-12-03", ate: "2026-12-09" })
  })

  it("usa o fuso para decidir qual é hoje", () => {
    // 02:30 UTC de 2026-12-10 ainda é 23:30 de 2026-12-09 em São Paulo
    const emUtc = janelaDaSemana(new Date("2026-12-10T02:30:00Z"), "UTC")
    expect(emUtc).toEqual({ de: "2026-12-03", ate: "2026-12-09" })
    const emSp = janelaDaSemana(new Date("2026-12-10T02:30:00Z"), FUSO)
    expect(emSp).toEqual({ de: "2026-12-02", ate: "2026-12-08" })
  })

  it("aceita outro número de dias", () => {
    const janela = janelaDaSemana(new Date("2026-12-10T03:30:00Z"), FUSO, 3)
    expect(janela).toEqual({ de: "2026-12-07", ate: "2026-12-09" })
  })
})

describe("criarNumerosDaSemana", () => {
  const agora = new Date("2026-12-10T03:30:00Z")
  const opcoesEsperadas = {
    topTools: config.bastidores.topTools,
    toolsFora: config.bastidores.toolsFora,
  }

  it("com poucas conversas, mostra só o total e não lê os sinais", async () => {
    const { store, agregadosDosRuns, sinais } = criarStore(19)
    const { clock } = criarRelogio(agora)
    const numeros = await criarNumerosDaSemana({ store, clock })()

    expect(numeros).toEqual({
      tipo: "poucos",
      janela: { de: "2026-12-03", ate: "2026-12-09" },
      runs: 19,
      minimo: config.bastidores.minimoDeRuns,
    })
    expect(agregadosDosRuns).toHaveBeenCalledWith("2026-12-03", "2026-12-09", opcoesEsperadas)
    expect(sinais).not.toHaveBeenCalled()
  })

  it("com o mínimo de conversas, devolve os agregados e os sinais", async () => {
    const { store, sinais } = criarStore(20)
    const { clock } = criarRelogio(agora)
    const numeros = await criarNumerosDaSemana({ store, clock })()

    expect(numeros).toEqual({
      tipo: "ok",
      janela: { de: "2026-12-03", ate: "2026-12-09" },
      runs: agregados(20),
      sinais: SINAIS,
    })
    expect(sinais).toHaveBeenCalledWith("2026-12-03", "2026-12-09")
  })

  it("duas chamadas na mesma hora fazem uma leitura só do store", async () => {
    const { store, agregadosDosRuns } = criarStore(20)
    const relogio = criarRelogio(agora)
    const numeros = criarNumerosDaSemana({ store, clock: relogio.clock })

    await numeros()
    relogio.ajustar(new Date("2026-12-10T04:00:00Z"))
    await numeros()

    expect(agregadosDosRuns).toHaveBeenCalledTimes(1)
  })

  it("depois do tempo do cache, lê de novo", async () => {
    const { store, agregadosDosRuns } = criarStore(20)
    const relogio = criarRelogio(agora)
    const numeros = criarNumerosDaSemana({ store, clock: relogio.clock })

    await numeros()
    relogio.ajustar(new Date(agora.getTime() + config.bastidores.cacheMs))
    await numeros()

    expect(agregadosDosRuns).toHaveBeenCalledTimes(2)
  })

  it("na virada do dia, lê de novo mesmo dentro do tempo do cache", async () => {
    const { store, agregadosDosRuns } = criarStore(20)
    const relogio = criarRelogio(agora)
    const numeros = criarNumerosDaSemana({ store, clock: relogio.clock })

    await numeros()
    // 00:10 de 2026-12-11 em São Paulo: 40 minutos depois, dentro do cache de 1 hora
    relogio.ajustar(new Date("2026-12-11T03:10:00Z"))
    const depois = await numeros()

    expect(agregadosDosRuns).toHaveBeenCalledTimes(2)
    expect(depois.janela).toEqual({ de: "2026-12-04", ate: "2026-12-10" })
  })

  it("erro do store sobe e não fica guardado", async () => {
    const { store, agregadosDosRuns } = criarStore(20)
    agregadosDosRuns.mockRejectedValueOnce(new Error("banco fora"))
    const relogio = criarRelogio(agora)
    const numeros = criarNumerosDaSemana({ store, clock: relogio.clock })

    await expect(numeros()).rejects.toThrow("banco fora")
    const depois = await numeros()

    expect(depois.tipo).toBe("ok")
    expect(agregadosDosRuns).toHaveBeenCalledTimes(2)
  })
})
