import { normalizar } from "@/core/knowledge/identificar"
import type { Estado, Restricao } from "@/core/knowledge/vocab"
import type { Caminho } from "@/core/runs/ports"
import type { Interpretacao } from "../../../../../src/core/agents/interpreter/interpretacao"
import type { ExpectativaDoInterprete } from "../tipos"

// Expectativas reutilizáveis dos casos do Intérprete. Cada uma confere a interpretação já normalizada e o caminho.
type IntencaoId = Interpretacao["intencoes"][number]

const exp = (
  descricao: string,
  confere: (r: { interpretacao: Interpretacao; caminho: Caminho }) => boolean,
): ExpectativaDoInterprete => ({ descricao, confere })

const vazio = (valor: unknown): boolean =>
  valor === undefined || (Array.isArray(valor) && valor.length === 0)

// Todos os textos da interpretação (valores, não chaves), para achar um motivo de saúde escondido em qualquer campo.
function textosDe(valor: unknown): string[] {
  if (typeof valor === "string") return [valor]
  if (Array.isArray(valor)) return valor.flatMap(textosDe)
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(textosDe)
  return []
}

export const temIntencao = (id: IntencaoId): ExpectativaDoInterprete =>
  exp(`tem a intenção ${id}`, (r) => r.interpretacao.intencoes.includes(id))

export const semIntencao = (id: IntencaoId): ExpectativaDoInterprete =>
  exp(`não tem a intenção ${id}`, (r) => !r.interpretacao.intencoes.includes(id))

export const temUmaDe = (...ids: IntencaoId[]): ExpectativaDoInterprete =>
  exp(`tem uma destas intenções: ${ids.join(", ")}`, (r) =>
    ids.some((id) => r.interpretacao.intencoes.includes(id)),
  )

export const temEstado = (id: Estado): ExpectativaDoInterprete =>
  exp(`tem o estado ${id}`, (r) => r.interpretacao.estados.includes(id))

export const semEstados = (): ExpectativaDoInterprete =>
  exp("não tem estado nenhum", (r) => r.interpretacao.estados.length === 0)

export const temAlerta = (tipo?: "fisico" | "emocional"): ExpectativaDoInterprete =>
  exp(
    tipo ? `tem alerta ${tipo}` : "tem algum alerta",
    (r) =>
      r.interpretacao.alerta !== undefined &&
      (tipo === undefined || r.interpretacao.alerta === tipo),
  )

export const semAlerta = (): ExpectativaDoInterprete =>
  exp("não tem alerta", (r) => r.interpretacao.alerta === undefined)

export const temIncomodo = (id: string): ExpectativaDoInterprete =>
  exp(`tem o incômodo ${id}`, (r) => r.interpretacao.incomodo?.id === id)

export const semVariante = (): ExpectativaDoInterprete =>
  exp("não escolhe variante do incômodo", (r) => r.interpretacao.incomodo?.variante === undefined)

export const itemDeCasa = (alimento_id: string, acao: "tem" | "acabou"): ExpectativaDoInterprete =>
  exp(`tem ${alimento_id} com ação ${acao} na casa`, (r) =>
    r.interpretacao.itens_casa.some((i) => i.alimento_id === alimento_id && i.acao === acao),
  )

export const retorno = (
  resultado: "ajudou" | "nao_ajudou" | "nao_fez",
  pendente?: number,
): ExpectativaDoInterprete =>
  exp(
    pendente === undefined
      ? `retorno ${resultado}`
      : `retorno ${resultado} sobre o pendente ${pendente}`,
    (r) =>
      r.interpretacao.retorno?.resultado === resultado &&
      (pendente === undefined || r.interpretacao.retorno.retorno_id === `p${pendente}`),
  )

export const semPendente = (): ExpectativaDoInterprete =>
  exp("não aponta nenhum pendente", (r) => r.interpretacao.retorno?.retorno_id === undefined)

export const evitaGrupo = (id: string): ExpectativaDoInterprete =>
  exp(`evita o grupo ${id}`, (r) =>
    r.interpretacao.evitar.some((i) => i.tipo === "grupo" && i.valor === id),
  )

export const semMotivo = (palavras: string[]): ExpectativaDoInterprete =>
  exp(`não guarda motivo de saúde (${palavras.join(", ")}) em nenhum campo`, (r) => {
    const texto = normalizar(textosDe(r.interpretacao).join(" "))
    return !palavras.some((p) => texto.includes(normalizar(p)))
  })

export const naoComeAlimento = (alimento_id: string): ExpectativaDoInterprete =>
  exp(`não come ${alimento_id}`, (r) =>
    r.interpretacao.nao_come.some((i) => i.alimento_id === alimento_id),
  )

export const temRestricao = (id: Restricao): ExpectativaDoInterprete =>
  exp(`tem a restrição ${id}`, (r) => r.interpretacao.restricoes.includes(id))

export const caminho = (c: Caminho): ExpectativaDoInterprete =>
  exp(`caminho ${c}`, (r) => r.caminho === c)

export const naoCaminho = (c: Caminho): ExpectativaDoInterprete =>
  exp(`não vai ao caminho ${c}`, (r) => r.caminho !== c)

export const campoVazio = (nome: keyof Interpretacao): ExpectativaDoInterprete =>
  exp(`${nome} vazio`, (r) => vazio(r.interpretacao[nome]))

export const temCampo = (nome: keyof Interpretacao): ExpectativaDoInterprete =>
  exp(`${nome} preenchido`, (r) => !vazio(r.interpretacao[nome]))

export const ehSuspeito = (): ExpectativaDoInterprete =>
  exp("marcado como suspeito", (r) => r.interpretacao.suspeito)
