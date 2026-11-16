import { config } from "@config/index"
import { RituError } from "@/core/errors"
import type { Prakriti } from "@/core/knowledge/adequacao"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { DOSHAS, type Dosha } from "@/core/knowledge/vocab"

export type ResultadoDoQuiz = { prakriti: Prakriti; doshas: Dosha[]; dual: boolean }

// Nome composto: o segundo dosha pesa pelo menos isto, e a diferença para o primeiro é de até o limite abaixo.
const PESO_MINIMO_DO_SEGUNDO = 0.3
const DIFERENCA_MAXIMA_COMPOSTO = 0.15
const TOLERANCIA = 1e-9

// Conta as respostas por dosha. Empate: vata, pitta, kapha (ordem de DOSHAS).
export function calcularQuiz(respostas: Dosha[]): ResultadoDoQuiz {
  if (respostas.length === 0) throw new RituError("respostas_vazias", "O quiz precisa de respostas")
  const total = respostas.length
  const contagens = DOSHAS.map((dosha) => ({
    dosha,
    contagem: respostas.filter((r) => r === dosha).length,
  }))
  const [primeiro, segundo] = doisPrimeiros([...contagens].sort((a, b) => b.contagem - a.contagem))
  const dual =
    segundo.contagem > 0 && primeiro.contagem - segundo.contagem <= config.quiz.diferencaDual
  const doshas = dual ? [primeiro.dosha, segundo.dosha] : [primeiro.dosha]
  const prakriti: Prakriti = Object.fromEntries(
    contagens.map(({ dosha, contagem }) => [dosha, contagem / total]),
  )
  return { prakriti, doshas, dual }
}

// Prakriti declarada pela pessoa: um dosha vale 1; dois valem 0.5 cada.
export function prakritiDeclarada(doshas: Dosha[]): Prakriti {
  const distintos = new Set(doshas)
  if (distintos.size !== doshas.length || (doshas.length !== 1 && doshas.length !== 2)) {
    throw new RituError("dosha_invalido", "Escolha um dosha ou dois, sem repetir")
  }
  const peso = doshas.length === 1 ? 1 : 0.5
  return Object.fromEntries(doshas.map((dosha) => [dosha, peso]))
}

// "Vata", ou "Vata-Pitta" quando o segundo pesa o bastante e fica perto do primeiro.
export function nomeDoDosha(prakriti: Prakriti, kb: KnowledgeBase): string {
  const [primeiro, segundo] = doisPrimeiros(
    DOSHAS.map((dosha) => ({ dosha, peso: prakriti[dosha] ?? 0 })).sort((a, b) => b.peso - a.peso),
  )
  const composto =
    segundo.peso >= PESO_MINIMO_DO_SEGUNDO &&
    primeiro.peso - segundo.peso <= DIFERENCA_MAXIMA_COMPOSTO + TOLERANCIA
  const nomes = [primeiro, ...(composto ? [segundo] : [])].map(({ dosha }) => nomeDe(dosha, kb))
  return nomes.join("-")
}

function doisPrimeiros<T>(itens: readonly T[]): [T, T] {
  const [primeiro, segundo] = itens
  if (primeiro === undefined || segundo === undefined) {
    throw new RituError("dosha_invalido", "Faltam doshas para comparar")
  }
  return [primeiro, segundo]
}

function nomeDe(dosha: Dosha, kb: KnowledgeBase): string {
  return kb.doshas.find((info) => info.id === dosha)?.nome ?? dosha
}
