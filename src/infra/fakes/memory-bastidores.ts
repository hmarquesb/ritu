import type { AgregadosDosRuns, BastidoresStore, SinaisDaSemana } from "@/core/bastidores/ports"
import type { Stores } from "@/core/stores"
import { diaLocal } from "@/core/time/dia-local"
import { bancoDaMemoria } from "./memory-stores"

type Opcoes = { topTools: number; toolsFora: readonly string[] }

const SINAIS_DO_DIA = [
  "feedback_up",
  "feedback_down",
  "retorno_ajudou",
  "retorno_nao_ajudou",
  "retorno_nao_fez",
] as const

/** Percentil 0,5 com interpolação linear, como percentile_cont. */
function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const posicao = (ordenados.length - 1) * 0.5
  const baixo = Math.floor(posicao)
  const alto = Math.ceil(posicao)
  const inicio = ordenados[baixo] ?? 0
  const fim = ordenados[alto] ?? inicio
  return inicio + (fim - inicio) * (posicao - baixo)
}

function contar<T extends string>(itens: T[]): Map<T, number> {
  const mapa = new Map<T, number>()
  for (const item of itens) mapa.set(item, (mapa.get(item) ?? 0) + 1)
  return mapa
}

/** Maior total primeiro; empate pelo id, em ordem crescente. */
function ordenarPorTotal(mapa: Map<string, number>): [string, number][] {
  return [...mapa.entries()].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
}

/**
 * Fake em memória de BastidoresStore. Lê runs, etapas, votos e retornos do mesmo estado que os
 * stores usam, e grava os sinais do dia no próprio estado (sobrevivem ao apagar a conta).
 */
export function createMemoryBastidores(stores: Stores): BastidoresStore {
  const db = bancoDaMemoria(stores)

  return {
    async agregadosDosRuns(de, ate, opcoes: Opcoes): Promise<AgregadosDosRuns> {
      const concluidas = db.estado.runs.filter(
        (r) => r.status === "done" && r.dia >= de && r.dia <= ate,
      )
      const ids = new Set(concluidas.map((r) => r.id))
      const comJuiz = concluidas.filter((r) => r.juiz_aprovado !== null)
      const acompanhante = concluidas.filter((r) => r.caminho === "acompanhante")
      const passos = acompanhante.reduce((soma, r) => soma + r.passos, 0)

      const intencoes = contar(concluidas.flatMap((r) => r.intencoes))
      const tools = contar(
        db.estado.etapas
          .filter(
            (e) => e.tipo === "tool" && ids.has(e.run_id) && !opcoes.toolsFora.includes(e.nome),
          )
          .map((e) => e.nome),
      )

      return {
        runs: concluidas.length,
        duracao_p50_ms: mediana(concluidas.map((r) => r.latencia_ms)),
        passos_medios: acompanhante.length === 0 ? null : passos / acompanhante.length,
        juiz: {
          julgados: comJuiz.length,
          refeitas: comJuiz.filter((r) => r.juiz_tentativas === 2).length,
        },
        trocas_de_modelo: concluidas.reduce((soma, r) => soma + r.trocas_de_modelo, 0),
        intencoes: ordenarPorTotal(intencoes).map(([intencao, total]) => ({ intencao, total })),
        tools: ordenarPorTotal(tools)
          .slice(0, opcoes.topTools)
          .map(([tool, total]) => ({ tool, total })),
      }
    },

    async sinais(de, ate): Promise<SinaisDaSemana> {
      const total = (sinal: string): number =>
        db.estado.sinaisDia
          .filter((s) => s.sinal === sinal && s.dia >= de && s.dia <= ate)
          .reduce((soma, s) => soma + s.total, 0)
      return {
        feedback: { up: total("feedback_up"), down: total("feedback_down") },
        retornos: {
          ajudou: total("retorno_ajudou"),
          nao_ajudou: total("retorno_nao_ajudou"),
          nao_fez: total("retorno_nao_fez"),
        },
      }
    },

    async registrarSinaisDoDia(dia, fuso): Promise<number> {
      const noDia = (iso: string | null): boolean =>
        iso !== null && diaLocal(new Date(iso), fuso) === dia
      const votos = db.estado.votos.filter((v) => noDia(v.criado_em))
      const retornos = db.estado.retornos.filter(
        (r) => r.status === "respondido" && noDia(r.respondido_em),
      )
      const totais: Record<(typeof SINAIS_DO_DIA)[number], number> = {
        feedback_up: votos.filter((v) => v.voto === "up").length,
        feedback_down: votos.filter((v) => v.voto === "down").length,
        retorno_ajudou: retornos.filter((r) => r.resultado === "ajudou").length,
        retorno_nao_ajudou: retornos.filter((r) => r.resultado === "nao_ajudou").length,
        retorno_nao_fez: retornos.filter((r) => r.resultado === "nao_fez").length,
      }
      for (const sinal of SINAIS_DO_DIA) {
        const existente = db.estado.sinaisDia.find((s) => s.dia === dia && s.sinal === sinal)
        if (existente) existente.total = totais[sinal]
        else db.estado.sinaisDia.push({ dia, sinal, total: totais[sinal] })
      }
      return SINAIS_DO_DIA.length
    },

    async apagarSinaisAntesDe(dia): Promise<number> {
      const antes = db.estado.sinaisDia.length
      db.estado.sinaisDia = db.estado.sinaisDia.filter((s) => s.dia >= dia)
      return antes - db.estado.sinaisDia.length
    },
  }
}
