import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { stringify } from "yaml"
import { KnowledgeInvalidError } from "@/core/knowledge/knowledge-base"
import type { DadosDaBase } from "@/core/knowledge/schemas"
import { miniDados } from "@/infra/fakes/mini-knowledge"
import { loadKnowledgeBase, readDadosDaBase } from "./yaml-knowledge"

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

let dir: string

function escrever(arquivo: string, conteudo: string): void {
  writeFileSync(join(dir, arquivo), conteudo, "utf8")
}

function escreverMini(): void {
  for (const chave of Object.keys(ARQUIVOS) as (keyof DadosDaBase)[]) {
    escrever(ARQUIVOS[chave], stringify(miniDados[chave]))
  }
}

function errosDe(fn: () => unknown): string[] {
  try {
    fn()
  } catch (erro) {
    if (erro instanceof KnowledgeInvalidError) return erro.erros
    throw erro
  }
  throw new Error("esperava KnowledgeInvalidError")
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ritu-kb-"))
  escreverMini()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("readDadosDaBase", () => {
  it("lê os 11 arquivos e devolve os mesmos dados", () => {
    expect(readDadosDaBase(dir)).toEqual(miniDados)
  })

  it("arquivo vazio ou só com comentário vira lista vazia", () => {
    escrever(ARQUIVOS.alimentos, "")
    escrever(ARQUIVOS.preparos, "# nada ainda\n")
    escrever(ARQUIVOS.praticas, "[]\n")

    const dados = readDadosDaBase(dir)

    expect(dados.alimentos).toEqual([])
    expect(dados.preparos).toEqual([])
    expect(dados.praticas).toEqual([])
  })

  it("arquivo ausente gera KnowledgeInvalidError com o nome do arquivo", () => {
    unlinkSync(join(dir, ARQUIVOS.alimentos))

    const erros = errosDe(() => readDadosDaBase(dir))

    expect(erros.some((erro) => erro.includes("alimentos.yaml"))).toBe(true)
  })

  it("YAML malformado gera KnowledgeInvalidError com o nome do arquivo", () => {
    escrever(ARQUIVOS.preparos, "- : [")

    const erros = errosDe(() => readDadosDaBase(dir))

    expect(erros.some((erro) => erro.includes("preparos.yaml"))).toBe(true)
  })

  it("arquivo que não é uma lista gera KnowledgeInvalidError com o nome do arquivo", () => {
    escrever(ARQUIVOS.doshas, "chave: valor\n")

    const erros = errosDe(() => readDadosDaBase(dir))

    expect(erros.some((erro) => erro.includes("doshas.yaml"))).toBe(true)
  })
})

describe("loadKnowledgeBase", () => {
  it("a mini-base não cumpre os mínimos e falha com erros de cobertura", () => {
    const erros = errosDe(() => loadKnowledgeBase(dir))

    expect(erros.some((erro) => erro.startsWith("cobertura:"))).toBe(true)
  })

  it("arquivo malformado falha antes da validação", () => {
    escrever(ARQUIVOS.quiz, "- : [")

    const erros = errosDe(() => loadKnowledgeBase(dir))

    expect(erros.some((erro) => erro.includes("quiz.yaml"))).toBe(true)
  })
})
