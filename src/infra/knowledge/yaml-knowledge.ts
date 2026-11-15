import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "yaml"
import {
  createKnowledgeBase,
  type KnowledgeBase,
  KnowledgeInvalidError,
} from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"

// Único lugar do projeto que lê data/*.yaml. Só lê e faz parse; a validação fica no core.
const ARQUIVOS: Record<keyof DadosDaBase, string> = {
  alimentos: "alimentos.yaml",
  preparos: "preparos.yaml",
  praticas: "praticas.yaml",
  combinacoes: "combinacoes.yaml",
  doshas: "doshas.yaml",
  estados: "estados.yaml",
  incomodos: "incomodos.yaml",
  quiz: "quiz.yaml",
  gruposEvitar: "grupos_evitar.yaml",
  vocabulario: "vocabulario.yaml",
  fontes: "fontes.yaml",
}

function lerLista(dir: string, arquivo: string): unknown[] {
  let texto: string
  try {
    texto = readFileSync(join(dir, arquivo), "utf8")
  } catch {
    throw new KnowledgeInvalidError([`${arquivo}: arquivo ausente ou ilegível`])
  }

  let valor: unknown
  try {
    valor = parse(texto)
  } catch (erro) {
    const linha = erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"
    throw new KnowledgeInvalidError([`${arquivo}: YAML inválido (${linha})`])
  }

  if (valor === null || valor === undefined) return []
  if (!Array.isArray(valor)) throw new KnowledgeInvalidError([`${arquivo}: deve ser uma lista`])
  return valor
}

export function readDadosDaBase(dir: string = join(process.cwd(), "data")): DadosDaBase {
  const pares = Object.entries(ARQUIVOS).map(
    ([chave, arquivo]) => [chave, lerLista(dir, arquivo)] as const,
  )
  return Object.fromEntries(pares) as DadosDaBase
}

export function loadKnowledgeBase(dir?: string): KnowledgeBase {
  return createKnowledgeBase(readDadosDaBase(dir))
}
