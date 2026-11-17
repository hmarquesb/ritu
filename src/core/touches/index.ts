import type { Resultado, Retorno } from "@/core/outcomes/ports"
import type { ItemTipo } from "@/core/preferences/ports"
import { type AcaoDaCasa, tocarCasa } from "./casa"
import type { Deps } from "./deps"
import { tocarGosto } from "./gosto"
import { type AcaoDaLista, tocarLista } from "./lista"
import { tocarRetorno } from "./retorno"
import {
  type MotivoDaTroca,
  type ResultadoDaTroca,
  responderTroca,
  trocarIngrediente,
} from "./troca"
import { tocarVoto } from "./voto"

export function createTouches(deps: Deps): {
  tocarRetorno(contaId: string, retornoId: string, resultado: Resultado): Promise<Retorno>
  tocarGosto(
    contaId: string,
    item: { tipo: ItemTipo; id: string },
    gosto: "gosta" | "nao_gosta" | null,
  ): Promise<void>
  tocarVoto(contaId: string, runId: string, voto: "up" | "down"): Promise<void>
  trocarIngrediente(
    contaId: string,
    p: { runId: string; sugestao: number; alimento_id: string; motivo: MotivoDaTroca },
  ): Promise<ResultadoDaTroca>
  responderTroca(
    contaId: string,
    p: {
      runId: string
      sugestao: number
      alimento_id: string
      candidato: string
      resposta: "tenho" | "nao_tenho"
    },
  ): Promise<ResultadoDaTroca>
  tocarCasa(contaId: string, acao: AcaoDaCasa): Promise<{ nome: string }>
  tocarLista(contaId: string, acao: AcaoDaLista): Promise<{ nome: string }>
} {
  return {
    tocarRetorno: (contaId, retornoId, resultado) =>
      tocarRetorno(deps, contaId, retornoId, resultado),
    tocarGosto: (contaId, item, gosto) => tocarGosto(deps, contaId, item, gosto),
    tocarVoto: (contaId, runId, voto) => tocarVoto(deps, contaId, runId, voto),
    trocarIngrediente: (contaId, p) => trocarIngrediente(deps, contaId, p),
    responderTroca: (contaId, p) => responderTroca(deps, contaId, p),
    tocarCasa: (contaId, acao) => tocarCasa(deps, contaId, acao),
    tocarLista: (contaId, acao) => tocarLista(deps, contaId, acao),
  }
}

export { type AcaoDaCasa, acaoDaCasaSchema } from "./casa"
export { type AcaoDaLista, acaoDaListaSchema } from "./lista"
export type { MotivoDaTroca, ResultadoDaTroca } from "./troca"
