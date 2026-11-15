import { citadoNoPerfilDoNaoCome, itemNoPerfilDoEvitar } from "@/core/accounts/no-perfil"
import type { Perfil } from "@/core/accounts/types"
import type { EvitarItem } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { juntarNomes } from "@/core/knowledge/lacunas"
import { rotulosDeRestricao } from "@/core/knowledge/rotulos"
import type { Restricao } from "@/core/knowledge/vocab"
import { neutralizar } from "@/core/neutralizar"

export { rotulosDeRestricao } from "@/core/knowledge/rotulos"

// Formas estruturais do que vem do Intérprete. Não importamos de agents: agents já importa conversation (R9).
// Interpretacao, ItemDeCasaCitado e RetornoCitado atendem a estes tipos sem conversão.
type ItemDeCasaCitado = { alimento_id?: string; nome: string; acao: "tem" | "acabou" }
type RetornoCitado = {
  resultado: "ajudou" | "nao_ajudou" | "nao_fez"
  retorno_id?: string
  titulo?: string
}
type Interpretacao = {
  evitar: EvitarItem[]
  nao_come: { alimento_id?: string; nome: string }[]
  restricoes: Restricao[]
}

// Textos fixos dos caminhos sem agente. {itens} e {titulo} são trocados pelos montadores abaixo.
export const textosDaConversa = {
  fora: "Isso foge do que eu sei fazer. Eu ajudo com alimentação, rotina e Ayurveda: me conta como você está agora, ou pergunta sobre um alimento.",
  ofensa:
    "Tudo bem, tem dia que é assim. Se quiser, me conta como você está agora que eu tento ajudar.",
  ajuda:
    'Tudo o que eu guardo sobre você aparece em "O que sei sobre você", e lá dá para corrigir e apagar. Dosha, cidade, Evitar sempre e apagar seus dados ficam no Perfil. O que você tem em casa fica em Minha casa.',
  alertaFisico:
    "O que você descreveu pede o olhar de um profissional de saúde, e eu não devo sugerir nada para isso. Se for forte, repentino ou estiver piorando, procure um atendimento de urgência ou ligue 192.",
  alertaEmocional:
    "Sinto muito que você esteja passando por isso. Você não precisa enfrentar isso só. O CVV atende de graça, 24 horas, pelo telefone 188 ou pelo chat em cvv.org.br. Se você estiver em perigo agora, ligue 192.",
  casaTem: "Boa, {itens} em casa. Confirma abaixo que eu guardo em Minha casa.",
  casaAcabou: "Entendi, acabou {itens}. Confirma abaixo que eu atualizo Minha casa.",
  casaDesconhecido: "Ainda não conheço {itens}: guardo na sua casa, mas não uso em sugestões.",
  retornoAjudou: "Que bom que {titulo} ajudou. Anotei: vai aparecer mais vezes por aqui.",
  retornoNaoAjudou:
    "Anotei que {titulo} não ajudou desta vez. Se quiser, me conta como você está agora que eu penso em outra coisa.",
  retornoNaoFez: "Tudo bem, anotei que você não fez {titulo}.",
  retornoSemLigacao:
    'Não consegui achar de qual sugestão você está falando, então não anotei nada. Se quiser, marque em "Como ficou?".',
  evitar:
    "Entendi. A partir de agora não sugiro {itens}, nem nada que leve isso. Já vale para hoje; confirma abaixo para eu guardar em Evitar sempre.",
  evitarDesconhecido: "Ainda não conheço {itens}, mas vou levar isso em conta nas respostas.",
  evitarJaGuardado: "Isso já está em Evitar sempre: continuo sem sugerir {itens}.",
  naoCome: "Entendi, você não come {itens}. Já vale para hoje; confirma abaixo para eu guardar.",
  restricao:
    "Entendi: sua alimentação é {itens}. Já vale para hoje; confirma abaixo para eu guardar.",
  fixoJaGuardado: "Isso eu já tinha guardado: {itens}.",
} as const

type Citado = { alimento_id?: string; nome: string }

// Troca com função: o valor vindo da pessoa não é reinterpretado ($&, {itens}, {titulo}).
function trocar(modelo: string, marca: string, valor: string): string {
  return modelo.replace(marca, () => valor)
}

// Uma frase preenchida com os itens; vazia quando não há item.
function frase(modelo: string, itens: string[]): string {
  return itens.length === 0 ? "" : trocar(modelo, "{itens}", juntarNomes(itens))
}

function nomeDoCitado(citado: Citado, kb: KnowledgeBase): string {
  if (citado.alimento_id) return kb.alimento(citado.alimento_id)?.nome ?? neutralizar(citado.nome)
  return neutralizar(citado.nome)
}

function nomeDoEvitar(item: EvitarItem, kb: KnowledgeBase): string {
  if (item.tipo === "alimento") return kb.alimento(item.valor)?.nome ?? item.valor
  if (item.tipo === "grupo") {
    return kb.gruposEvitar.find((grupo) => grupo.id === item.valor)?.nome ?? item.valor
  }
  return neutralizar(item.valor)
}

export function textoDeCasa(itens: ItemDeCasaCitado[], kb: KnowledgeBase): string {
  const tem = itens.filter((item) => item.acao === "tem").map((item) => nomeDoCitado(item, kb))
  const acabou = itens
    .filter((item) => item.acao === "acabou")
    .map((item) => nomeDoCitado(item, kb))
  const desconhecidos = itens
    .filter((item) => !item.alimento_id)
    .map((item) => nomeDoCitado(item, kb))
  return [
    frase(textosDaConversa.casaTem, tem),
    frase(textosDaConversa.casaAcabou, acabou),
    frase(textosDaConversa.casaDesconhecido, desconhecidos),
  ]
    .filter((texto) => texto !== "")
    .join(" ")
}

export function textoDeRetorno(retorno: RetornoCitado): string {
  if (!retorno.retorno_id || !retorno.titulo) return textosDaConversa.retornoSemLigacao
  const titulo = retorno.titulo.charAt(0).toLowerCase() + retorno.titulo.slice(1)
  const modelo = {
    ajudou: textosDaConversa.retornoAjudou,
    nao_ajudou: textosDaConversa.retornoNaoAjudou,
    nao_fez: textosDaConversa.retornoNaoFez,
  }[retorno.resultado]
  return trocar(modelo, "{titulo}", titulo)
}

export function textoDeEvitar(i: Interpretacao, perfil: Perfil, kb: KnowledgeBase): string {
  const novos = i.evitar
    .filter((item) => !itemNoPerfilDoEvitar(item, perfil))
    .map((item) => nomeDoEvitar(item, kb))
  const jaGuardados = i.evitar
    .filter((item) => itemNoPerfilDoEvitar(item, perfil))
    .map((item) => nomeDoEvitar(item, kb))
  const desconhecidos = i.evitar
    .filter((item) => item.tipo === "texto")
    .map((item) => nomeDoEvitar(item, kb))
  const naoComeNovos = i.nao_come
    .filter((citado) => !citadoNoPerfilDoNaoCome(citado, perfil))
    .map((citado) => nomeDoCitado(citado, kb))
  const restricoesNovas = i.restricoes
    .filter((restricao) => !perfil.restricoes.includes(restricao))
    .map((restricao) => rotulosDeRestricao[restricao])
  const jaGuardadosFixos = [
    ...i.nao_come
      .filter((citado) => citadoNoPerfilDoNaoCome(citado, perfil))
      .map((citado) => nomeDoCitado(citado, kb)),
    ...i.restricoes
      .filter((restricao) => perfil.restricoes.includes(restricao))
      .map((restricao) => rotulosDeRestricao[restricao]),
  ]
  return [
    frase(textosDaConversa.evitar, novos),
    frase(textosDaConversa.evitarJaGuardado, jaGuardados),
    frase(textosDaConversa.evitarDesconhecido, desconhecidos),
    frase(textosDaConversa.naoCome, naoComeNovos),
    frase(textosDaConversa.restricao, restricoesNovas),
    frase(textosDaConversa.fixoJaGuardado, jaGuardadosFixos),
  ]
    .filter((texto) => texto !== "")
    .join(" ")
}
