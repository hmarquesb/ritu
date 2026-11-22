import type { SaidaDoAcompanhante } from "@/core/agents/companion/saida"
import type { MotivoDoJuiz } from "@/core/agents/judge/saida"
import { textosDaConversa } from "@/core/conversation/textos"
import { normalizar } from "@/core/knowledge/identificar"
import type { Caminho } from "@/core/runs/ports"
import type { ExpectativaDaConversa } from "../../c2/tipos"

type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

const exp = (descricao: string, confere: (r: Entrada) => boolean): ExpectativaDaConversa => ({
  descricao,
  confere,
})

// O que a pessoa lê na saída: resposta, títulos, motivos, modos de fazer, se faltar, avisos, evitar, incertos e o motivo do para ter.
// geral (booleano) e explicacao (só códigos de guna) não têm texto e ficam de fora.
function textoDaSaida(saida: SaidaDoAcompanhante): string {
  return [
    saida.resposta,
    ...saida.sugestoes.flatMap((s) => [
      s.titulo,
      s.motivo,
      s.como_fazer,
      ...s.itens.flatMap((i) => (i.se_faltar ? [i.se_faltar.nome, i.se_faltar.frase] : [])),
    ]),
    ...saida.avisos.map((a) => a.texto),
    ...saida.evitar.map((e) => e.texto),
    ...saida.incertos,
    ...(saida.para_ter ? [saida.para_ter.motivo] : []),
  ].join(" ")
}

export const caminho = (c: Caminho): ExpectativaDaConversa =>
  exp(`caminho ${c}`, (r) => r.resposta.caminho === c)

// Forma negada de caminho, para naoPode: confere que o caminho não foi o escolhido.
export const naoCaminho = (c: Caminho): ExpectativaDaConversa =>
  exp(`não vai ao caminho ${c}`, (r) => r.resposta.caminho !== c)

// A resposta é o texto fixo do caminho (chave de textosDaConversa).
export const textoFixo = (chave: keyof typeof textosDaConversa): ExpectativaDaConversa =>
  exp(`texto fixo ${chave}`, (r) => r.resultado.saida.resposta === textosDaConversa[chave])

// A palavra não aparece no texto que a pessoa lê (texto normalizado, palavra inteira).
export const semTexto = (palavra: string): ExpectativaDaConversa =>
  exp(`sem o texto "${palavra}"`, (r) => {
    const texto = normalizar(textoDaSaida(r.resultado.saida))
    return !` ${texto} `.includes(` ${normalizar(palavra)} `)
  })

export const comAvisoDeIncomodo = (): ExpectativaDaConversa =>
  exp("com aviso de incômodo", (r) => r.resultado.saida.avisos.some((a) => a.tipo === "incomodo"))

export const aprovadoPeloJuiz = (): ExpectativaDaConversa =>
  exp("aprovado pelo Juiz no run", (r) => r.juiz.aprovado === true)

// O Juiz não apontou o motivo no run (motivos lidos das etapas juiz).
export const juizNaoApontou = (motivo: MotivoDoJuiz): ExpectativaDaConversa =>
  exp(`o Juiz não apontou ${motivo}`, (r) => !r.juiz.motivos.includes(motivo))
