import { config } from "@config/index"
import type { EvitarItem } from "@/core/knowledge/filtros"
import { identificarAlimento, normalizar, resolverEvitar } from "@/core/knowledge/identificar"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { ESTADOS, type Estado, RESTRICOES, type Restricao } from "@/core/knowledge/vocab"
import type { Retorno } from "@/core/outcomes/ports"
import type { IntencaoInterpretada, SaidaDoInterprete } from "./saida"

export type ItemDeCasaCitado = { alimento_id?: string; nome: string; acao: "tem" | "acabou" }
export type RetornoCitado = {
  resultado: "ajudou" | "nao_ajudou" | "nao_fez"
  retorno_id?: string
  titulo?: string
}
export type Interpretacao = {
  intencoes: IntencaoInterpretada[]
  estados: Estado[]
  incomodo?: { id: string; variante?: string }
  alerta?: "fisico" | "emocional"
  itens_casa: ItemDeCasaCitado[]
  retorno?: RetornoCitado
  fato_de_rotina?: string
  evitar: EvitarItem[]
  nao_come: { alimento_id?: string; nome: string }[]
  gosta: { alimento_id: string; nome: string }[]
  restricoes: Restricao[]
  suspeito: boolean
}

type Citado = { alimento_id?: string; nome: string }
type SemIntencoes = Omit<Interpretacao, "intencoes">

function cortar(texto: string, max: number): string {
  return Array.from(texto.trim()).slice(0, max).join("")
}

// Sem repetir: a chave diz quem é o mesmo; o último valor de cada chave vence, na posição da primeira ocorrência.
function semRepetir<T>(itens: T[], chave: (item: T) => string, max: number): T[] {
  const porChave = new Map<string, T>()
  for (const item of itens) porChave.set(chave(item), item)
  return [...porChave.values()].slice(0, max)
}

function chaveDoCitado(citado: Citado): string {
  return citado.alimento_id ? `alimento:${citado.alimento_id}` : `nome:${normalizar(citado.nome)}`
}

function alimentoDaBase(
  texto: string,
  kb: KnowledgeBase,
): { alimento_id: string; nome: string } | undefined {
  const identificado = identificarAlimento(texto, kb)
  if (identificado.tipo !== "alimento") return undefined
  return { alimento_id: identificado.id, nome: kb.alimento(identificado.id)?.nome ?? texto }
}

// Nome da base leva o id; nome livre é cortado. Texto vazio não vira item.
function citarAlimento(texto: string, kb: KnowledgeBase): Citado | undefined {
  const limpo = texto.trim()
  if (limpo === "") return undefined
  const daBase = alimentoDaBase(limpo, kb)
  if (daBase) return daBase
  return { nome: cortar(limpo, config.conversa.maxNomeLivre) }
}

function itensDeCasa(
  itens: SaidaDoInterprete["itens_casa"],
  kb: KnowledgeBase,
): ItemDeCasaCitado[] {
  const citados = itens.flatMap((item) => {
    const citado = citarAlimento(item.nome, kb)
    return citado ? [{ ...citado, acao: item.acao }] : []
  })
  return semRepetir(citados, chaveDoCitado, config.conversa.maxItensDeCasa)
}

function evitarDaSaida(textos: string[], kb: KnowledgeBase): EvitarItem[] {
  const itens = textos
    .map((texto) => texto.trim())
    .filter((texto) => texto !== "")
    .map((texto) => resolverEvitar(texto, kb))
  return semRepetir(itens, (item) => `${item.tipo}:${item.valor}`, config.conversa.maxEvitar)
}

function naoComeDaSaida(textos: string[], kb: KnowledgeBase): Citado[] {
  const citados = textos.flatMap((texto) => {
    const citado = citarAlimento(texto, kb)
    return citado ? [citado] : []
  })
  return semRepetir(citados, chaveDoCitado, config.conversa.maxEvitar)
}

function gostaDaSaida(
  textos: string[],
  kb: KnowledgeBase,
  evitar: EvitarItem[],
  naoCome: Citado[],
): { alimento_id: string; nome: string }[] {
  const excluidos = new Set([
    ...evitar.filter((item) => item.tipo === "alimento").map((item) => item.valor),
    ...naoCome.flatMap((citado) => (citado.alimento_id ? [citado.alimento_id] : [])),
  ])
  const daBase = textos.flatMap((texto) => {
    const alimento = alimentoDaBase(texto.trim(), kb)
    return alimento && !excluidos.has(alimento.alimento_id) ? [alimento] : []
  })
  return semRepetir(daBase, (alimento) => alimento.alimento_id, config.conversa.maxEvitar)
}

function ehEstado(valor: string): valor is Estado {
  return (ESTADOS as readonly string[]).includes(valor)
}

function ehRestricao(valor: string): valor is Restricao {
  return (RESTRICOES as readonly string[]).includes(valor)
}

function estadosDaSaida(atalhos: Estado[], estados: string[]): Estado[] {
  return [...new Set([...atalhos, ...estados.filter(ehEstado)])]
}

function incomodoDaSaida(
  incomodo: SaidaDoInterprete["incomodo"],
  kb: KnowledgeBase,
): Interpretacao["incomodo"] {
  if (!incomodo) return undefined
  const encontrado = kb.incomodos.find((item) => item.id === incomodo.id)
  if (!encontrado) return undefined
  const variante = encontrado.variantes.some((item) => item.id === incomodo.variante)
    ? incomodo.variante
    : undefined
  return variante ? { id: encontrado.id, variante } : { id: encontrado.id }
}

function retornoDaSaida(
  retorno: SaidaDoInterprete["retorno"],
  pendentes: Retorno[],
): RetornoCitado | undefined {
  if (!retorno) return undefined
  const numero = retorno.pendente
  const escolhido =
    numero !== undefined && Number.isInteger(numero) && numero >= 1 && numero <= pendentes.length
      ? pendentes[numero - 1]
      : undefined
  if (!escolhido) return { resultado: retorno.resultado }
  return {
    resultado: retorno.resultado,
    retorno_id: escolhido.id,
    titulo: escolhido.sugestao.titulo,
  }
}

function fatoDaSaida(fato: string | undefined): string | undefined {
  const texto = cortar(fato ?? "", config.conversa.maxFatoDeRotina)
  return texto === "" ? undefined : texto
}

// Intenção que o modelo marcou só vale se houver o que a sustenta.
function sustentada(intencao: IntencaoInterpretada, dados: SemIntencoes): boolean {
  if (intencao === "casa") return dados.itens_casa.length > 0
  if (intencao === "retorno") return dados.retorno !== undefined
  if (intencao === "evitar") return temAlgoAEvitar(dados)
  return true
}

function temAlgoAEvitar(dados: SemIntencoes): boolean {
  return dados.evitar.length + dados.nao_come.length + dados.restricoes.length > 0
}

function intencoesDeDados(dados: SemIntencoes): IntencaoInterpretada[] {
  const deduzidas: IntencaoInterpretada[] = []
  if (dados.itens_casa.length > 0) deduzidas.push("casa")
  if (dados.retorno) deduzidas.push("retorno")
  if (temAlgoAEvitar(dados)) deduzidas.push("evitar")
  if (dados.estados.length > 0 || dados.incomodo) deduzidas.push("momento")
  return deduzidas
}

function intencoesFinais(
  intencoes: IntencaoInterpretada[],
  dados: SemIntencoes,
): IntencaoInterpretada[] {
  const todas = [
    ...intencoes.filter((intencao) => sustentada(intencao, dados)),
    ...intencoesDeDados(dados),
  ]
  const unicas = [...new Set(todas)]
  return unicas.length > 0 ? unicas : ["vida"]
}

export function normalizarInterpretacao(
  saida: SaidaDoInterprete,
  p: { atalhos: Estado[]; pendentes: Retorno[]; kb: KnowledgeBase },
): Interpretacao {
  const naoCome = naoComeDaSaida(saida.nao_come, p.kb)
  const evitar = evitarDaSaida(saida.evitar_sempre, p.kb)
  const incomodo = incomodoDaSaida(saida.incomodo, p.kb)
  const retorno = retornoDaSaida(saida.retorno, p.pendentes)
  const fato = fatoDaSaida(saida.fato_de_rotina)
  const dados: SemIntencoes = {
    estados: estadosDaSaida(p.atalhos, saida.estados),
    itens_casa: itensDeCasa(saida.itens_casa, p.kb),
    evitar,
    nao_come: naoCome,
    gosta: gostaDaSaida(saida.gosta, p.kb, evitar, naoCome),
    restricoes: [...new Set(saida.restricoes.filter(ehRestricao))],
    suspeito: saida.suspeito,
    ...(incomodo && { incomodo }),
    ...(saida.alerta && { alerta: saida.alerta }),
    ...(retorno && { retorno }),
    ...(fato && { fato_de_rotina: fato }),
  }
  return { ...dados, intencoes: intencoesFinais(saida.intencoes, dados) }
}

export function interpretacaoDosAtalhos(atalhos: Estado[]): Interpretacao {
  return {
    intencoes: ["momento"],
    estados: [...new Set(atalhos)],
    itens_casa: [],
    evitar: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  }
}
