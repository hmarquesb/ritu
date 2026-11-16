import { normalizar } from "@/core/knowledge/identificar"
import type { ExpectativaDaConversa } from "../tipos"

type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

const exp = (descricao: string, confere: (r: Entrada) => boolean): ExpectativaDaConversa => ({
  descricao,
  confere,
})

// Termos de compra que a frase de para_ter não pode usar (R$ lido no texto original).
const TERMOS_DE_COMPRA = /\b(comprar|loja|mercado|preco|marca)\b/

export const comParaTer = (): ExpectativaDaConversa =>
  exp("traz para_ter", (r) => r.resultado.saida.para_ter !== undefined)

export const semParaTer = (): ExpectativaDaConversa =>
  exp("sem para_ter", (r) => r.resultado.saida.para_ter === undefined)

// Sem marca, loja ou preço: nem comprar, nem mercado, nem R$ no texto da resposta.
export const semFraseDeCompra = (): ExpectativaDaConversa =>
  exp("sem frase de compra (comprar, loja, mercado, preço, marca, R$)", (r) => {
    const texto = r.resultado.saida.resposta
    return !TERMOS_DE_COMPRA.test(normalizar(texto)) && !/R\$/.test(texto)
  })
