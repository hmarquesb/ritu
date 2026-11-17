import { RituError } from "@/core/errors"
import type { Prakriti } from "@/core/knowledge/adequacao"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { DoshaInfo } from "@/core/knowledge/schemas"
import { DOSHAS, type Dosha } from "@/core/knowledge/vocab"
import { nomeDoDosha } from "./dosha"
import type { Perfil } from "./types"

export type CartaDeDosha = {
  dosha: Dosha
  nome: string
  resumo: string
  elementos: string[]
  qualidades: string[]
  corpo: string
  mente: string
  digestao: string
  desequilibra: string
  equilibra: string
}

export type PainelDoDosha =
  | {
      tem: true
      nome: string
      origem: "quiz" | "declarado"
      proporcao: { dosha: Dosha; porcento: number }[] | null
      cartas: CartaDeDosha[]
    }
  | { tem: false; linhas: { dosha: Dosha; nome: string; resumo: string }[] }

// Elementos da base com o nome que a tela mostra.
const NOME_DE_ELEMENTO: Record<string, string> = {
  ar: "ar",
  espaco: "espaço",
  fogo: "fogo",
  agua: "água",
  terra: "terra",
}

export function painelDoDosha(perfil: Perfil, kb: KnowledgeBase): PainelDoDosha {
  if (perfil.prakriti === null) {
    return {
      tem: false,
      linhas: DOSHAS.map((dosha) => {
        const info = infoDe(dosha, kb)
        return { dosha, nome: info.nome, resumo: info.resumo }
      }),
    }
  }
  const nome = nomeDoDosha(perfil.prakriti, kb)
  const origem = perfil.origem ?? "declarado"
  return {
    tem: true,
    nome,
    origem,
    proporcao: origem === "quiz" ? proporcaoDoQuiz(perfil.prakriti) : null,
    cartas: nome.split("-").map((parte) => cartaDe(infoPorNome(parte, kb), kb)),
  }
}

// Une itens em palavras: "a", "a e b", "a, b e c".
export function listaEmPalavras(itens: string[]): string {
  if (itens.length <= 1) return itens.join("")
  return `${itens.slice(0, -1).join(", ")} e ${itens.slice(-1).join("")}`
}

// Três doshas do maior para o menor, com inteiros que somam 100; o resto vai para o maior resto.
function proporcaoDoQuiz(prakriti: Prakriti): { dosha: Dosha; porcento: number }[] {
  const ordenados = DOSHAS.map((dosha) => ({
    dosha,
    valor: Math.round((prakriti[dosha] ?? 0) * 100 * 1e6) / 1e6,
  })).sort((a, b) => b.valor - a.valor)
  const partes = ordenados.map((item) => ({
    ...item,
    inteiro: Math.floor(item.valor),
    resto: item.valor - Math.floor(item.valor),
  }))
  const faltam = 100 - partes.reduce((soma, parte) => soma + parte.inteiro, 0)
  const comResto = new Set(
    [...partes]
      .sort((a, b) => b.resto - a.resto)
      .slice(0, faltam)
      .map((parte) => parte.dosha),
  )
  return partes.map((parte) => ({
    dosha: parte.dosha,
    porcento: parte.inteiro + (comResto.has(parte.dosha) ? 1 : 0),
  }))
}

function cartaDe(info: DoshaInfo, kb: KnowledgeBase): CartaDeDosha {
  return {
    dosha: info.id,
    nome: info.nome,
    resumo: info.resumo,
    elementos: info.elementos.map((elemento) => NOME_DE_ELEMENTO[elemento] ?? elemento),
    qualidades: info.gunas.map((guna) => kb.vocabulario.find((v) => v.guna === guna)?.nome ?? guna),
    corpo: info.caracteristicas.corpo,
    mente: info.caracteristicas.mente,
    digestao: info.caracteristicas.digestao,
    desequilibra: info.desequilibra,
    equilibra: info.equilibra,
  }
}

function infoDe(dosha: Dosha, kb: KnowledgeBase): DoshaInfo {
  const info = kb.doshas.find((d) => d.id === dosha)
  if (!info) throw new RituError("dosha_invalido", `Dosha sem informação na base: ${dosha}`)
  return info
}

function infoPorNome(nome: string, kb: KnowledgeBase): DoshaInfo {
  const info = kb.doshas.find((d) => d.nome === nome)
  if (!info) throw new RituError("dosha_invalido", `Dosha sem informação na base: ${nome}`)
  return info
}
