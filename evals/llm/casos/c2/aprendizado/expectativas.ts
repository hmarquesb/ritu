import { normalizar } from "@/core/knowledge/identificar"
import { semItemNaSaida } from "../perguntas/expectativas"
import type { ExpectativaDaConversa } from "../tipos"

type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

const exp = (descricao: string, confere: (r: Entrada) => boolean): ExpectativaDaConversa => ({
  descricao,
  confere,
})

const sugestoes = (r: Entrada) => r.resultado.saida.sugestoes

// O item saiu nas sugestões do run (não basta citar o nome no texto).
export const apareceNasSugestoes = (alimentoId: string): ExpectativaDaConversa =>
  exp(`aparece nas sugestões: ${alimentoId}`, (r) =>
    sugestoes(r).some((s) => s.itens.some((i) => i.alimento_id === alimentoId)),
  )

// O alimento não sai na saída: nem num item, nem citado, nem pelo nome no texto.
export const naoAparece = (alimentoId: string): ExpectativaDaConversa => semItemNaSaida(alimentoId)

// Na primeira sugestão do tipo, o chá (ou o preparo) dado não aparece; sem sugestão desse tipo, passa.
export const primeiroDoTipoNao = (id: string, tipo: string): ExpectativaDaConversa =>
  exp(`o primeiro ${tipo} não é ${id}`, (r) => {
    const primeira = sugestoes(r).find((s) => s.tipo === tipo)
    return primeira === undefined || (primeira.pratica_id !== id && primeira.preparo_id !== id)
  })

export const chamouResultadoRegistrar = (): ExpectativaDaConversa =>
  exp("chamou resultado.registrar", (r) => r.resultado.tools.includes("resultado.registrar"))

// O retorno com este título saiu de outcomes.pendentes no fim do caso.
export const fechouRetorno = (titulo: string): ExpectativaDaConversa =>
  exp(`fecha o retorno "${titulo}"`, (r) => r.retornosFechados.includes(titulo))

export const naoFechou = (titulo: string): ExpectativaDaConversa =>
  exp(`não fecha o retorno "${titulo}"`, (r) => !r.retornosFechados.includes(titulo))

export const nenhumRetornoFechado = (): ExpectativaDaConversa =>
  exp("nenhum retorno fechado", (r) => r.retornosFechados.length === 0)

// Sem pista do retorno, o texto pergunta "Como ficou?" para a pessoa dizer qual era.
export const apontaComoFicou = (): ExpectativaDaConversa =>
  exp('o texto aponta "Como ficou?"', (r) =>
    normalizar(r.resultado.saida.resposta).includes("como ficou"),
  )
