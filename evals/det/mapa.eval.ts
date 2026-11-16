import { existsSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { mapa } from "./mapa"

// A raiz do repositório: evals/det/mapa.eval.ts está dois níveis abaixo dela.
const RAIZ = fileURLToPath(new URL("../../", import.meta.url))

// Todo *.eval.ts de evals/det, em caminho relativo à raiz (ex.: evals/det/base/base-valida.eval.ts).
function evalsNoDisco(): string[] {
  const nomes = readdirSync(new URL("./", import.meta.url), { recursive: true }) as string[]
  return nomes
    .filter((nome) => nome.endsWith(".eval.ts"))
    .map((nome) => `evals/det/${nome.split("\\").join("/")}`)
    .sort()
}

describe("mapa das linhas de evals determinísticos", () => {
  it("toda entrada que já vale (desde até 2) tem pelo menos um arquivo", () => {
    const semArquivo = mapa.filter((e) => e.desde <= 2 && e.arquivos.length === 0)
    expect(semArquivo.map((e) => e.linha)).toEqual([])
  })

  it("todo arquivo citado no mapa existe na raiz", () => {
    const ausentes = mapa
      .flatMap((e) => e.arquivos)
      .filter((arquivo) => !existsSync(RAIZ + arquivo))
    expect(ausentes).toEqual([])
  })

  it("todo *.eval.ts de evals/det aparece em alguma entrada", () => {
    const citados = new Set(mapa.flatMap((e) => e.arquivos))
    const soltos = evalsNoDisco().filter((arquivo) => !citados.has(arquivo))
    expect(soltos).toEqual([])
  })

  it("nenhuma linha se repete", () => {
    const linhas = mapa.map((e) => e.linha)
    expect(linhas.filter((linha, i) => linhas.indexOf(linha) !== i)).toEqual([])
  })
})
