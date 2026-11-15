import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { juntarNomes } from "@/core/knowledge/lacunas"
import { nomeDoCitado, nomeDoEvitar } from "@/core/knowledge/nomes"
import { rotulosDeRestricao } from "@/core/knowledge/rotulos"
import type { ConteudoDaProposta } from "./conteudo"

// Textos fixos das linhas do bloco "Posso anotar isto?". Os marcadores são trocados pelos montadores abaixo.
export const textosDasPropostas = {
  casaTem: "Você tem {itens} em casa",
  casaAcabou: "Acabou: {itens}",
  evitarSempre: "Não sugerir mais {itens} (Evitar sempre)",
  restricao: "Sua alimentação é {itens}",
  naoCome: "Você não come {itens}",
  gosta: "Você gosta de {itens}",
  listaFaltouHoje: '{Item} na lista "Para ter em casa" (faltou para {detalhe})',
  listaFezFalta: '{Item} na lista "Para ter em casa" (já fez falta {detalhe} vezes)',
  cabecalho: "Posso anotar isto?",
  agoraNao: "Agora não",
  anotar: "Anotar",
} as const

// Troca com função: o valor vindo da pessoa não é reinterpretado ($&, {itens}, {Item}).
function comItens(modelo: string, nomes: string[]): string {
  return modelo.replace("{itens}", () => juntarNomes(nomes))
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1)
}

type DaCasa = Extract<ConteudoDaProposta, { tool: "casa.propor" }>
type DaMemoria = Extract<ConteudoDaProposta, { tool: "memoria.propor" }>
type DaLista = Extract<ConteudoDaProposta, { tool: "lista.propor" }>

function textoDaCasa(c: DaCasa, kb: KnowledgeBase): string {
  const modelo = c.acao === "tem" ? textosDasPropostas.casaTem : textosDasPropostas.casaAcabou
  return comItens(
    modelo,
    c.itens.map((item) => nomeDoCitado(item, kb)),
  )
}

function textoDaMemoria(c: DaMemoria, kb: KnowledgeBase): string {
  switch (c.tipo) {
    case "evitar_sempre":
      return comItens(
        textosDasPropostas.evitarSempre,
        c.itens.map((item) => nomeDoEvitar(item, kb)),
      )
    case "restricao":
      return comItens(
        textosDasPropostas.restricao,
        c.itens.map((restricao) => rotulosDeRestricao[restricao]),
      )
    case "nao_come":
      return comItens(
        textosDasPropostas.naoCome,
        c.itens.map((item) => nomeDoCitado(item, kb)),
      )
    case "gosta":
      return comItens(
        textosDasPropostas.gosta,
        c.itens.map((item) => nomeDoCitado(item, kb)),
      )
    case "rotina":
      return maiuscula(c.texto)
  }
}

function textoDaLista(c: DaLista, kb: KnowledgeBase): string {
  const faltou = c.motivo === "faltou_hoje"
  const modelo = faltou ? textosDasPropostas.listaFaltouHoje : textosDasPropostas.listaFezFalta
  const item = maiuscula(kb.alimento(c.alimento_id)?.nome ?? c.alimento_id)
  const detalhe = faltou ? minuscula(c.detalhe) : c.detalhe
  // Uma passada só: o nome do item e o detalhe não são reinterpretados.
  return modelo.replace(/\{Item\}|\{detalhe\}/g, (marca) => (marca === "{Item}" ? item : detalhe))
}

// Uma linha do bloco, como o texto que a pessoa lê.
export function textoDaProposta(c: ConteudoDaProposta, kb: KnowledgeBase): string {
  switch (c.tool) {
    case "casa.propor":
      return textoDaCasa(c, kb)
    case "memoria.propor":
      return textoDaMemoria(c, kb)
    case "lista.propor":
      return textoDaLista(c, kb)
  }
}
