import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { nomeDoEvitar } from "@/core/knowledge/nomes"
import { rotulosDeRestricao } from "@/core/knowledge/rotulos"
import type { Alimento, EstadoInfo, Incomodo, Pratica, Preparo } from "@/core/knowledge/schemas"
import { verbosDasGunas } from "@/core/knowledge/verbos"
import { neutralizar } from "@/core/neutralizar"

type Efeito = { vata: number; pitta: number; kapha: number }
type Variante = Incomodo["variantes"][number]

const NENHUM = "nenhum"

function lista(valores: readonly string[]): string {
  return valores.length > 0 ? valores.join(", ") : NENHUM
}

function efeito(e: Efeito): string {
  return `vata ${e.vata}, pitta ${e.pitta}, kapha ${e.kapha}`
}

// Separa "tabela:id" no primeiro dois-pontos; sem dois-pontos, não há ref.
function separarRef(ref: string): [tabela: string, id: string] | undefined {
  const corte = ref.indexOf(":")
  if (corte < 0) return undefined
  return [ref.slice(0, corte), ref.slice(corte + 1)]
}

function quando<T>(valor: T | undefined, formatar: (v: T) => string): string | undefined {
  return valor === undefined ? undefined : formatar(valor)
}

function rotuloDoEstado(id: string, kb: KnowledgeBase): string {
  return kb.estados.find((estado) => estado.id === id)?.rotulo ?? id
}

function linhaDoAlimento(alimento: Alimento, kb: KnowledgeBase): string {
  const verbos = verbosDasGunas(alimento.gunas, kb)
  return `${alimento.nome} | gunas: ${lista(alimento.gunas)} | verbos: ${lista(verbos)} | virya: ${alimento.virya} | efeito: ${efeito(alimento.efeito)}`
}

function linhaDaPratica(pratica: Pratica, kb: KnowledgeBase): string {
  const verbos = verbosDasGunas(pratica.gunas, kb)
  const favorece = pratica.favorece_estados.map((id) => rotuloDoEstado(id, kb))
  return `${pratica.nome} | gunas: ${lista(pratica.gunas)} | verbos: ${lista(verbos)} | efeito: ${efeito(pratica.efeito)} | favorece: ${lista(favorece)}`
}

function linhaDoPreparo(preparo: Preparo, kb: KnowledgeBase): string {
  const verbos = verbosDasGunas(preparo.gunas_do_preparo, kb)
  return `${preparo.nome} | gunas: ${lista(preparo.gunas_do_preparo)} | verbos: ${lista(verbos)}`
}

function linhaDoEstado(estado: EstadoInfo): string {
  return `${estado.rotulo} | presentes: ${lista(estado.presentes)} | favorecer: ${lista(estado.favorecer)} | evitar: ${lista(estado.evitar_gunas)}`
}

function linhaDaVariante(incomodo: Incomodo, variante: Variante): string {
  return `${incomodo.nome}: ${variante.opcao} | presentes: ${lista(variante.presentes)} | favorecer: ${lista(variante.favorecer)} | evitar: ${lista(variante.evitar_gunas)}`
}

function linhaDoIncomodo(id: string, kb: KnowledgeBase): string | undefined {
  const corte = id.indexOf("/")
  const incomodoId = corte < 0 ? id : id.slice(0, corte)
  const incomodo = kb.incomodos.find((i) => i.id === incomodoId)
  if (incomodo === undefined) return undefined
  if (corte < 0) {
    const unica = incomodo.variantes.find((v) => v.id === "unica")
    return unica ? linhaDaVariante(incomodo, unica) : incomodo.nome
  }
  const variante = incomodo.variantes.find((v) => v.id === id.slice(corte + 1))
  return quando(variante, (v) => linhaDaVariante(incomodo, v))
}

// Linha da base que o Juiz lê, sem o prefixo "tabela:id" (quem põe o prefixo é montarEntradaDoJuiz).
export function linhaParaOJuiz(ref: string, kb: KnowledgeBase): string | undefined {
  const partes = separarRef(ref)
  if (partes === undefined) return undefined
  const [tabela, id] = partes
  switch (tabela) {
    case "alimentos":
      return quando(kb.alimento(id), (a) => linhaDoAlimento(a, kb))
    case "praticas":
      return quando(kb.pratica(id), (p) => linhaDaPratica(p, kb))
    case "preparos":
      return quando(kb.preparo(id), (p) => linhaDoPreparo(p, kb))
    case "estados":
      return quando(
        kb.estados.find((e) => e.id === id),
        linhaDoEstado,
      )
    case "incomodos":
      return linhaDoIncomodo(id, kb)
    default:
      return undefined
  }
}

// Nomes que a resposta nunca pode citar (D11): evitar, restrições, não come e os textos de evitar do dia.
export function nuncaCitar(dados: DadosDoPreparo, kb: KnowledgeBase): string[] {
  const itens = [
    ...dados.filtro.evitar.map((item) => nomeDoEvitar(item, kb)),
    ...dados.filtro.restricoes.map((r) => `fora da dieta ${rotulosDeRestricao[r]}`),
    ...dados.filtro.nao_come.map((id) => kb.alimento(id)?.nome ?? id),
    ...dados.evitar_textos,
  ]
  return [...new Set(itens.map(neutralizar))]
}

function nomeDoItem(item: SugestaoEntregue["itens"][number]): string {
  return item.troca ? `${item.nome} (trocado por ${item.troca.nome})` : item.nome
}

function linhaDaSugestao(sugestao: SugestaoEntregue, numero: number): string {
  const itens = sugestao.itens.map(nomeDoItem).join(", ")
  return `${numero}. ${sugestao.tipo}: ${sugestao.titulo} | itens: ${itens} | motivo: ${sugestao.motivo}`
}

// Nome de um citado: o da base quando a linha resolve; a própria linha, quando não.
function nomeDaLinha(linha: string, kb: KnowledgeBase): string {
  const partes = separarRef(linha)
  if (partes === undefined) return linha
  const [tabela, id] = partes
  if (tabela === "alimentos") return kb.alimento(id)?.nome ?? linha
  if (tabela === "praticas") return kb.pratica(id)?.nome ?? linha
  if (tabela === "preparos") return kb.preparo(id)?.nome ?? linha
  return linha
}

// Refs da base citadas pela saída, sem repetir, na ordem em que aparecem.
function refsDaBase(saida: SaidaDoAcompanhante): string[] {
  const refs = saida.sugestoes.flatMap((sugestao) => [
    ...sugestao.linhas_base,
    ...sugestao.itens.flatMap((item) => [
      item.linha_base,
      ...(item.troca ? [item.troca.linha_base] : []),
    ]),
  ])
  refs.push(...saida.evitar.map((e) => e.linha_base))
  if (saida.para_ter) refs.push(saida.para_ter.linha_base)
  return [...new Set(refs)]
}

function linhasDaBase(saida: SaidaDoAcompanhante, kb: KnowledgeBase): string[] {
  return refsDaBase(saida).flatMap((ref) => {
    const linha = linhaParaOJuiz(ref, kb)
    return linha === undefined ? [] : [`${ref}: ${linha}`]
  })
}

// Bloco com um item por linha; vazio não entra. O conteúdo é neutralizado; as tags não.
function blocoEmLinhas(tag: string, linhas: string[]): string {
  const preenchidas = linhas.filter((linha) => linha.trim() !== "")
  if (preenchidas.length === 0) return ""
  const corpo = preenchidas.map(neutralizar).join("\n")
  return `<${tag}>\n${corpo}\n</${tag}>`
}

// Bloco numa linha só; vazio não entra.
function blocoNumaLinha(tag: string, texto: string): string {
  if (texto.trim() === "") return ""
  return `<${tag}>${neutralizar(texto)}</${tag}>`
}

type Entrada = {
  saida: SaidaDoAcompanhante
  evitar: string[]
  nota_de_rotina?: string
  kb: KnowledgeBase
}

// Entrada do Juiz: a resposta e o que ela carrega, com as linhas da base citadas e o que nunca pode aparecer.
export function montarEntradaDoJuiz(p: Entrada): string {
  const { saida, kb } = p
  const sugestoes = saida.sugestoes.map((s, i) => linhaDaSugestao(s, i + 1))
  const blocos = [
    blocoEmLinhas("resposta", [saida.resposta]),
    blocoEmLinhas("sugestoes", sugestoes),
    blocoNumaLinha("evitar_agora", saida.evitar.map((e) => e.texto).join(", ")),
    blocoNumaLinha(
      "para_ter",
      saida.para_ter ? `${saida.para_ter.nome}: ${saida.para_ter.motivo}` : "",
    ),
    blocoNumaLinha("citados", saida.citados.map((c) => nomeDaLinha(c, kb)).join(", ")),
    blocoEmLinhas("incertos", saida.incertos),
    blocoNumaLinha("avisos", saida.avisos.map((a) => a.tipo).join(", ")),
    blocoEmLinhas("linhas_da_base", linhasDaBase(saida, kb)),
    blocoNumaLinha("nunca_citar", p.evitar.join(", ")),
    blocoNumaLinha("nota_de_rotina", p.nota_de_rotina ?? ""),
  ]
  return blocos.filter((bloco) => bloco !== "").join("\n")
}
