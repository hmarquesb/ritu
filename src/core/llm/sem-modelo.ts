import { notaAdequacao, type Prakriti } from "@/core/knowledge/adequacao"
import { type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import type { Pratica } from "@/core/knowledge/schemas"
import { verbosDasGunas } from "@/core/knowledge/verbos"
import type { Estado, Guna, MomentoDoDia } from "@/core/knowledge/vocab"
import { TEXTO_COM_ATALHOS, TEXTO_LIMITE_COM_ATALHOS, TEXTO_SO_TEXTO } from "./textos"

export type RespostaSemModelo = {
  resposta: string
  praticas: { pratica_id: string; nome: string; verbos: string[]; linha_base: string }[] // 0 a 3
}

type Entrada = {
  estados: Estado[]
  momento_do_dia: MomentoDoDia
  filtro: FiltroPessoa
  prakriti?: Prakriti
  motivo?: "cota" | "limite"
}

const MAXIMO_DE_PRATICAS = 3

// "a", "a e b", "a, b e c".
function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("")
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`
}

function rotulosDos(estados: Estado[], kb: KnowledgeBase): string {
  const rotulos = estados.map((id) => {
    const info = kb.estados.find((e) => e.id === id)
    return (info?.rotulo ?? id).toLowerCase()
  })
  return juntar(rotulos)
}

function praticaCabe(pratica: Pratica, p: Entrada, kb: KnowledgeBase): boolean {
  if (pratica.tipo !== "pratica") return false
  if (!pratica.favorece_estados.some((e) => p.estados.includes(e))) return false
  if (pratica.contraindicacoes.some((e) => p.estados.includes(e))) return false
  if (!pratica.momento.includes(p.momento_do_dia)) return false
  return passaNoFiltro(pratica, p.filtro, kb).passa
}

function gunasBuscadas(estados: Estado[], kb: KnowledgeBase): Guna[] {
  const favorecidas = kb.estados.filter((e) => estados.includes(e.id)).flatMap((e) => e.favorecer)
  return [...new Set(favorecidas)]
}

function praticasParaEstados(p: Entrada, kb: KnowledgeBase): RespostaSemModelo["praticas"] {
  const buscadas = gunasBuscadas(p.estados, kb)
  return kb.praticas
    .filter((pratica) => praticaCabe(pratica, p, kb))
    .map((pratica) => ({
      pratica,
      nota: notaAdequacao({ gunas: pratica.gunas, efeito: pratica.efeito }, buscadas, p.prakriti)
        .nota,
    }))
    .sort((a, b) => b.nota - a.nota)
    .slice(0, MAXIMO_DE_PRATICAS)
    .map(({ pratica }) => ({
      pratica_id: pratica.id,
      nome: pratica.nome,
      verbos: verbosDasGunas(pratica.gunas, kb),
      linha_base: `praticas:${pratica.id}`,
    }))
}

// Resposta montada por código, sem modelo: texto aprovado e práticas gerais da base.
export function respostaSemModelo(p: Entrada, kb: KnowledgeBase): RespostaSemModelo {
  if (p.estados.length === 0) return { resposta: TEXTO_SO_TEXTO, praticas: [] }
  const abertura = p.motivo === "limite" ? TEXTO_LIMITE_COM_ATALHOS : TEXTO_COM_ATALHOS
  return {
    resposta: abertura.replace("{estados}", rotulosDos(p.estados, kb)),
    praticas: praticasParaEstados(p, kb),
  }
}
