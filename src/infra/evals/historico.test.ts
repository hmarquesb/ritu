import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { historicoSchema } from "@/core/evals/historico"
import { lerHistorico } from "./historico"

const raizDoRepo = fileURLToPath(new URL("../../..", import.meta.url))

function raizComArquivo(conteudo: string): string {
  const raiz = mkdtempSync(join(tmpdir(), "ritu-historico-"))
  mkdirSync(join(raiz, "evals", "resultados"), { recursive: true })
  writeFileSync(join(raiz, "evals", "resultados", "historico.json"), conteudo)
  return raiz
}

describe("lerHistorico", () => {
  it("lê o arquivo real do repositório e ele valida no schema", () => {
    const lido = lerHistorico(raizDoRepo)
    expect(lido).toBeDefined()
    expect(historicoSchema.safeParse(lido).success).toBe(true)
  })

  it("pasta sem o arquivo devolve undefined", () => {
    const raiz = mkdtempSync(join(tmpdir(), "ritu-historico-vazio-"))
    expect(lerHistorico(raiz)).toBeUndefined()
  })

  it("JSON inválido devolve undefined", () => {
    expect(lerHistorico(raizComArquivo("{não é json"))).toBeUndefined()
  })

  it("JSON que não passa no schema devolve undefined", () => {
    expect(
      lerHistorico(raizComArquivo(JSON.stringify({ versao: 2, checkpoints: [] }))),
    ).toBeUndefined()
  })

  it("JSON válido no schema devolve o histórico", () => {
    const h = { versao: 1, checkpoints: [] }
    expect(lerHistorico(raizComArquivo(JSON.stringify(h)))).toEqual(h)
  })
})
