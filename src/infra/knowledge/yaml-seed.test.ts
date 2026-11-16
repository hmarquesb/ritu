import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { stringify } from "yaml"
import type { DemoSeed } from "@/core/demo-seed"
import { KnowledgeInvalidError } from "@/core/knowledge/knowledge-base"
import { loadDemoSeed } from "./yaml-seed"

type Conversa = DemoSeed["historico"][number]

const saida: Conversa["saida"] = {
  origem: "agente",
  resposta: "Um chá morno combina com o começo do dia.",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
}

const conversa = (dias_atras: number): Conversa => ({
  dias_atras,
  mensagem: "Estou com frio de manhã",
  estados: ["com_frio"],
  momento_do_dia: "manha",
  gunas_buscadas: ["quente"],
  saida,
  resultados: [],
})

// Seed que passa no schema (a conferência contra a base fica com validarSeed).
const seedMinimo: DemoSeed = {
  faixa: "Manhã fria",
  mensagem_sugerida: "Estou com frio hoje cedo",
  perfil: {
    prakriti: { vata: 1 },
    cidade: { nome: "Curitiba", lat: -25.43, lon: -49.27, fuso: "America/Sao_Paulo" },
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
  },
  casa: [],
  preferencias: [],
  faltas: [],
  rotina: [],
  padrao: {
    estados: ["com_frio"],
    item: { tipo: "pratica", id: "cha-gengibre" },
    ocorrencias: 3,
  },
  historico: [conversa(1), conversa(2), conversa(3)],
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ritu-seed-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function errosDe(fn: () => unknown): string[] {
  try {
    fn()
  } catch (erro) {
    if (erro instanceof KnowledgeInvalidError) return erro.erros
    throw erro
  }
  throw new Error("esperava KnowledgeInvalidError")
}

describe("loadDemoSeed", () => {
  it("lê e valida um demo.yaml válido", () => {
    writeFileSync(join(dir, "demo.yaml"), stringify(seedMinimo), "utf8")
    expect(loadDemoSeed(dir)).toEqual(seedMinimo)
  })

  it("lança KnowledgeInvalidError com os erros do schema", () => {
    writeFileSync(join(dir, "demo.yaml"), stringify({ ...seedMinimo, faixa: 42 }), "utf8")
    const erros = errosDe(() => loadDemoSeed(dir))
    expect(erros.some((erro) => erro.includes("faixa"))).toBe(true)
  })

  it("lança KnowledgeInvalidError quando o arquivo está ausente", () => {
    const erros = errosDe(() => loadDemoSeed(dir))
    expect(erros).toEqual(["demo.yaml: arquivo ausente ou ilegível"])
  })
})
