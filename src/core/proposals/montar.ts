import { config } from "@config/index"
import { z } from "zod"
import { normalizar } from "@/core/knowledge/identificar"
import type { Anotacao } from "@/core/proposals/anotacao"
import { type ConteudoDaProposta, conteudoDaPropostaSchema } from "@/core/proposals/conteudo"
import type { MensagemDoLoop } from "@/core/runs/agent-runtime"

const TOOLS_DE_PROPOSTA = new Set(["memoria.propor", "lista.propor"])

const resultadoDeProposta = z.object({
  proposto: z.literal(true),
  proposta: conteudoDaPropostaSchema,
})

function lerPropostasAceitas(mensagens: MensagemDoLoop[]): ConteudoDaProposta[] {
  return mensagens.flatMap((mensagem) => {
    if (mensagem.papel !== "tool" || !TOOLS_DE_PROPOSTA.has(mensagem.nome)) return []
    const lido = resultadoDeProposta.safeParse(mensagem.resultado)
    return lido.success ? [lido.data.proposta] : []
  })
}

/** Propostas aceitas pelo agente nas mensagens do loop, na ordem de chegada. */
export function propostasDoAgente(mensagens: MensagemDoLoop[]): ConteudoDaProposta[] {
  const rotinas = new Set<string>()
  let listas = 0
  return lerPropostasAceitas(mensagens).filter((proposta) => {
    if (proposta.tool === "lista.propor") return listas++ < config.aprovacao.maxFaltouHoje
    if (proposta.tool === "memoria.propor" && proposta.tipo === "rotina") {
      const chave = normalizar(proposta.texto)
      if (rotinas.has(chave)) return false
      rotinas.add(chave)
    }
    return true
  })
}

// Ordem do bloco: evitar sempre, restrição, não como, gosta, casa tem, casa acabou, lista, rotina.
const ORDEM = [
  "evitar_sempre",
  "restricao",
  "nao_come",
  "gosta",
  "casa_tem",
  "casa_acabou",
  "lista",
  "rotina",
] as const

type Chave = (typeof ORDEM)[number]

function chaveDaProposta(proposta: ConteudoDaProposta): Chave {
  if (proposta.tool === "casa.propor") return proposta.acao === "tem" ? "casa_tem" : "casa_acabou"
  if (proposta.tool === "lista.propor") return "lista"
  return proposta.tipo
}

function propostaDaAnotacao(anotacao: Anotacao): ConteudoDaProposta {
  switch (anotacao.tipo) {
    case "casa_tem":
      return { tool: "casa.propor", acao: "tem", itens: anotacao.itens }
    case "casa_acabou":
      return { tool: "casa.propor", acao: "acabou", itens: anotacao.itens }
    case "evitar_sempre":
      return { tool: "memoria.propor", tipo: "evitar_sempre", itens: anotacao.itens }
    case "restricao":
      return { tool: "memoria.propor", tipo: "restricao", itens: anotacao.itens }
    case "nao_come":
      return { tool: "memoria.propor", tipo: "nao_come", itens: anotacao.itens }
    case "gosta":
      return { tool: "memoria.propor", tipo: "gosta", itens: anotacao.itens }
  }
}

/** Uma linha por anotação com itens, mais as propostas do agente e as extras; ordenadas e cortadas no teto. */
export function montarPropostas(p: {
  anotacoes: Anotacao[]
  doAgente: ConteudoDaProposta[]
  extras?: ConteudoDaProposta[]
}): ConteudoDaProposta[] {
  const todas = [
    ...p.anotacoes.filter((a) => a.itens.length > 0).map(propostaDaAnotacao),
    ...p.doAgente,
    ...(p.extras ?? []),
  ]
  const ordenadas = [...todas].sort(
    (a, b) => ORDEM.indexOf(chaveDaProposta(a)) - ORDEM.indexOf(chaveDaProposta(b)),
  )
  return ordenadas.slice(0, config.aprovacao.maxLinhas)
}
