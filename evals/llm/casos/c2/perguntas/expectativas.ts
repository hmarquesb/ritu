import { normalizar } from "@/core/knowledge/identificar"
import type { Pergunta, RespostaDaPessoa, RespostaDeCasa } from "@/core/runs/pergunta"
import { createContainer } from "@/infra/container"
import type { ExpectativaDaConversa } from "../tipos"

// Base real, lida só quando uma expectativa precisa do nome de um alimento (criar o container não lê data/).
const containerDoEval = createContainer()

type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]
type PerguntaDeCasa = Extract<Pergunta, { tipo: "casa" }>

const exp = (descricao: string, confere: (r: Entrada) => boolean): ExpectativaDaConversa => ({
  descricao,
  confere,
})

const nomeDo = (id: string): string => containerDoEval.knowledge.alimento(id)?.nome ?? id

const perguntasDeCasa = (r: Entrada): PerguntaDeCasa[] =>
  r.perguntas.map((p) => p.pergunta).filter((p): p is PerguntaDeCasa => p.tipo === "casa")

const idsDaPergunta = (p: Pergunta): string[] => {
  if (p.tipo === "casa") return p.itens.map((item) => item.alimento_id)
  if (p.tipo === "come") return [p.alimento_id]
  return []
}

// O id aparece na saída: num item de sugestão, num citado (tabela:id) ou pelo nome no texto (palavra inteira).
function apareceNaSaida(r: Entrada, id: string): boolean {
  const saida = r.resultado.saida
  const porId =
    saida.sugestoes.some((s) => s.itens.some((i) => i.alimento_id === id)) ||
    saida.citados.some((c) => c.endsWith(`:${id}`))
  const texto = normalizar(
    [saida.resposta, ...saida.sugestoes.flatMap((s) => [s.titulo, s.motivo, s.como_fazer])].join(
      " ",
    ),
  )
  return porId || ` ${texto} `.includes(` ${normalizar(nomeDo(id))} `)
}

const REFRESCAM = ["frio", "brando"]

export const perguntouCasa = (): ExpectativaDaConversa =>
  exp("faz pergunta de casa", (r) => perguntasDeCasa(r).length > 0)

export const naoPerguntou = (): ExpectativaDaConversa =>
  exp("não faz nenhuma pergunta", (r) => r.perguntas.length === 0)

export const perguntouNoMaximo = (n: number): ExpectativaDaConversa =>
  exp(`faz no máximo ${n} pergunta(s)`, (r) => r.perguntas.length <= n)

export const itensNaPergunta = (max: number): ExpectativaDaConversa =>
  exp(`cada pergunta de casa tem de 1 a ${max} itens`, (r) => {
    const casas = perguntasDeCasa(r)
    return casas.length > 0 && casas.every((p) => p.itens.length >= 1 && p.itens.length <= max)
  })

export const nuncaPerguntou = (id: string): ExpectativaDaConversa =>
  exp(`nunca pergunta sobre ${nomeDo(id)}`, (r) =>
    r.perguntas.every((p) => !idsDaPergunta(p.pergunta).includes(id)),
  )

export const semItemNaSaida = (id: string): ExpectativaDaConversa =>
  exp(`não traz ${nomeDo(id)} na saída`, (r) => !apareceNaSaida(r, id))

export const semSegundaPerguntaSobre = (ids: string[]): ExpectativaDaConversa =>
  exp(`não pergunta de novo sobre ${ids.map(nomeDo).join(", ")}`, (r) =>
    ids.every((id) => perguntasDeCasa(r).filter((p) => idsDaPergunta(p).includes(id)).length <= 1),
  )

export const pausouSemDecisao = (): ExpectativaDaConversa =>
  exp("pausa sem chamada de decisão, com a pergunta de variante primeiro", (r) => {
    const primeira = r.perguntas[0]?.pergunta
    return r.llmAntesDaPrimeiraPausa === 0 && primeira?.tipo === "variante"
  })

export const temAvisoDeIncomodo = (): ExpectativaDaConversa =>
  exp("tem aviso de incômodo", (r) => r.resultado.saida.avisos.some((a) => a.tipo === "incomodo"))

export const sugestaoQueRefresca = (): ExpectativaDaConversa =>
  exp("tem sugestão que refresca (frio ou brando)", (r) =>
    r.resultado.saida.sugestoes.some(
      (s) =>
        s.verbos.some((v) => REFRESCAM.includes(v)) ||
        s.itens.some((i) => i.contribui.some((g) => REFRESCAM.includes(g))),
    ),
  )

// O runner não aprova: o run termina done ou parado no bloco de aprovação.
export const terminou = (): ExpectativaDaConversa =>
  exp("termina o run", (r) => ["done", "waiting_for_approval"].includes(r.resposta.status))

// O item que a pessoa marcou como "não gosto" não sai na saída.
export const semItemNaoGostado = (): ExpectativaDaConversa =>
  exp("não traz o item marcado como não gosto", (r) => {
    const naoGosto = r.perguntas.flatMap((p) =>
      p.resposta.tipo === "casa"
        ? p.resposta.itens.filter((i) => i.resposta === "nao_gosto").map((i) => i.alimento_id)
        : [],
    )
    return naoGosto.every((id) => !apareceNaSaida(r, id))
  })

// Respostas montadas na hora, com os itens da pergunta que saiu (campo `respostas` aceita função).
const respondeTodos =
  (resposta: RespostaDeCasa) =>
  (p: Pergunta): RespostaDaPessoa => {
    if (p.tipo !== "casa") return { tipo: "pular" }
    return { tipo: "casa", itens: p.itens.map((i) => ({ alimento_id: i.alimento_id, resposta })) }
  }

export const tenhoATudo = respondeTodos("tenho")
export const naoTenhoATudo = respondeTodos("nao_tenho")

// Não gosto do primeiro item da pergunta; tenho nos outros.
export const naoGostaDoPrimeiroTenhoOsOutros = (p: Pergunta): RespostaDaPessoa => {
  if (p.tipo !== "casa") return { tipo: "pular" }
  return {
    tipo: "casa",
    itens: p.itens.map((i, n) => ({
      alimento_id: i.alimento_id,
      resposta: n === 0 ? "nao_gosto" : "tenho",
    })),
  }
}
