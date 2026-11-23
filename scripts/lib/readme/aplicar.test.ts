import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { RituError } from "@/core/errors"
import { aplicarBlocos } from "./aplicar"

const FIXTURE = readFileSync(
  fileURLToPath(new URL("./fixtures/README.md", import.meta.url)),
  "utf8",
)
const BLOCOS = { site: "NOVO SITE", numeros: "| tabela |", adrs: "- [0001](.adrs/0001-a.md) A" }

describe("aplicarBlocos", () => {
  it("troca só o conteúdo entre os marcadores e deixa o texto de fora", () => {
    expect(aplicarBlocos(FIXTURE, BLOCOS)).toBe(`# Ritu

Texto antes dos blocos.

<!-- ritu:site -->
NOVO SITE
<!-- /ritu:site -->

Meio do texto.

<!-- ritu:numeros -->
| tabela |
<!-- /ritu:numeros -->

<!-- ritu:adrs -->
- [0001](.adrs/0001-a.md) A
<!-- /ritu:adrs -->

Texto depois dos blocos.
`)
  })

  it("é idempotente", () => {
    const uma = aplicarBlocos(FIXTURE, BLOCOS)
    expect(aplicarBlocos(uma, BLOCOS)).toBe(uma)
  })

  it("não interpreta padrões especiais do replace", () => {
    const texto = aplicarBlocos(FIXTURE, { ...BLOCOS, site: "a $& b $1" })
    expect(texto).toContain("a $& b $1")
  })

  it("marcador ausente lança readme_sem_marcador com o bloco", () => {
    const sem = FIXTURE.replace("<!-- ritu:adrs -->", "").replace("<!-- /ritu:adrs -->", "")
    expect(() => aplicarBlocos(sem, BLOCOS)).toThrowError(RituError)
    try {
      aplicarBlocos(sem, BLOCOS)
    } catch (erro) {
      expect((erro as RituError).code).toBe("readme_sem_marcador")
      expect((erro as RituError & { bloco?: string }).bloco).toBe("adrs")
    }
  })

  it("marcador repetido lança readme_sem_marcador com o bloco", () => {
    const repetido = `${FIXTURE}\n<!-- ritu:site -->\n<!-- /ritu:site -->\n`
    try {
      aplicarBlocos(repetido, BLOCOS)
      expect.unreachable()
    } catch (erro) {
      expect((erro as RituError).code).toBe("readme_sem_marcador")
      expect((erro as RituError & { bloco?: string }).bloco).toBe("site")
    }
  })
})
