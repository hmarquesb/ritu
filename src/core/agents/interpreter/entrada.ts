import { config } from "@config/index"
import { rotulosDeRestricao } from "@/core/conversation/rotulos"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Incomodo } from "@/core/knowledge/schemas"
import type { Estado } from "@/core/knowledge/vocab"
import type { MensagemNoPrompt } from "@/core/messages/para-o-prompt"
import { neutralizar } from "@/core/neutralizar"
import type { Retorno } from "@/core/outcomes/ports"

export type { MensagemNoPrompt } from "@/core/messages/para-o-prompt"

export type EntradaDoInterprete = {
  texto: string
  atalhos: Estado[]
  conversa: MensagemNoPrompt[]
  pendentes: Retorno[]
  kb: KnowledgeBase
}

// Um bloco vazio não entra: sem linhas, nem a tag.
function bloco(nome: string, linhas: string[]): string[] {
  if (linhas.length === 0) return []
  return [`<${nome}>`, ...linhas, `</${nome}>`]
}

// A variante "unica" não aparece: ela só existe para o incômodo que tem uma variante.
function linhaDeIncomodo(i: Incomodo): string {
  const palavras = i.palavras.join(", ")
  const variantes = i.variantes.filter((v) => v.id !== "unica").map((v) => v.id)
  if (variantes.length === 0) return `${i.id}: ${palavras}`
  return `${i.id}: ${palavras} | variantes: ${variantes.join(", ")}`
}

function linhasDeConversa(conversa: MensagemNoPrompt[]): string[] {
  const limite = config.conversa.interprete.maxCaracteresPorMensagem
  return conversa.map((m) => `${m.autor}: ${neutralizar(m.texto.slice(0, limite))}`)
}

function linhasDePendentes(pendentes: Retorno[]): string[] {
  return pendentes.map((r, i) => `${i + 1}. ${r.sugestao.tipo}: ${r.sugestao.titulo}`)
}

function blocoDeAtalhos(atalhos: Estado[]): string[] {
  if (atalhos.length === 0) return []
  return [`<atalhos>${atalhos.join(", ")}</atalhos>`]
}

// Monta a entrada do Intérprete em blocos, na ordem da spec. Texto da pessoa e da conversa é dado.
export function montarEntradaDoInterprete(p: EntradaDoInterprete): string {
  const secoes: string[][] = [
    bloco(
      "estados",
      p.kb.estados.map((e) => `${e.id}: ${e.rotulo}`),
    ),
    bloco("incomodos", p.kb.incomodos.map(linhaDeIncomodo)),
    bloco(
      "restricoes",
      Object.entries(rotulosDeRestricao).map(([id, rotulo]) => `${id}: ${rotulo}`),
    ),
    bloco("pendentes", linhasDePendentes(p.pendentes)),
    bloco("conversa_do_dia", linhasDeConversa(p.conversa)),
    blocoDeAtalhos(p.atalhos),
    bloco("mensagem_da_pessoa", p.texto ? [neutralizar(p.texto)] : []),
  ]
  return secoes.flat().join("\n")
}
