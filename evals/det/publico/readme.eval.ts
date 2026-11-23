import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { publico } from "@config/index"
import { describe, expect, it } from "vitest"
import { historicoSchema } from "@/core/evals/historico"
import { lerAdrs } from "../../../scripts/lib/readme/adrs"
import { aplicarBlocos, MarcadorDoReadmeError } from "../../../scripts/lib/readme/aplicar"
import { blocosDoReadme, type Idioma } from "../../../scripts/lib/readme/blocos"

// README em dia (spec 024): o gerador roda em memória sobre os dois READMEs e o resultado tem de ser igual ao
// que está no arquivo. Também confere que nenhum README cita segredo, URL de banco nem referência local.

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url))
const MENSAGEM = "README desatualizado: rode npm run readme"
const BLOCOS = ["site", "numeros", "adrs"] as const

const READMES: { idioma: Idioma; arquivo: string }[] = [
  { idioma: "pt", arquivo: "README.md" },
  { idioma: "en", arquivo: "README.en.md" },
]

const historico = historicoSchema.parse(
  JSON.parse(readFileSync(join(RAIZ, "evals/resultados/historico.json"), "utf8")),
)
const adrs = lerAdrs(join(RAIZ, ".adrs"))

const lerReadme = (arquivo: string) => readFileSync(join(RAIZ, arquivo), "utf8")

// O texto que o gerador escreveria, a partir de `original` (os blocos são trocados, o resto fica).
function gerado(idioma: Idioma, original: string): string {
  return aplicarBlocos(
    original,
    blocosDoReadme({ historico, adrs, siteUrl: publico.siteUrl, idioma }),
  )
}

function conferir(atual: string, esperado: string): void {
  if (atual !== esperado) throw new Error(MENSAGEM)
}

// Pastas de referência: os `../nome/` de `.local/REFERENCIAS.md`, lidos em tempo de execução. Sem o arquivo, nenhuma.
// Os nomes não entram no código nem na mensagem de falha.
function pastasDeReferencia(): string[] {
  const caminho = join(RAIZ, ".local/REFERENCIAS.md")
  if (!existsSync(caminho)) return []
  return [...readFileSync(caminho, "utf8").matchAll(/`\.\.\/([^`/]+)\/`/g)]
    .map((m) => m[1] ?? "")
    .filter((nome) => nome.length >= 3)
}

const MERMAID = /```mermaid[\s\S]*?```/g
// Nome de pacote com escopo (`@escopo/pacote`): não é e-mail nem segredo.
const PACOTE_COM_ESCOPO = /(?<![\w.-])@[\w.-]+\/[\w.-]+/g

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Devolve o que o README cita de proibido, sem repetir o texto achado nem o nome de pasta de referência.
function achados(texto: string, referencias: string[]): string[] {
  const semMermaid = texto.replace(MERMAID, "")
  const semEscopo = semMermaid.replace(PACOTE_COM_ESCOPO, "")
  const encontrados: string[] = []
  if (semEscopo.includes("@")) encontrados.push("@ (e-mail ou segredo)")
  if (/postgres(ql)?:\/\//i.test(texto)) encontrados.push("URL de banco")
  if (texto.includes(".local/")) encontrados.push(".local/")
  for (const nome of referencias) {
    const padrao = new RegExp(`(?<![\\w-])${escaparRegex(nome)}(?![\\w-])`, "i")
    if (padrao.test(texto)) encontrados.push("referência local")
  }
  return [...new Set(encontrados)]
}

describe("README em dia", () => {
  it.each(READMES)("$arquivo bate com o gerador", ({ idioma, arquivo }) => {
    const atual = lerReadme(arquivo)
    conferir(atual, gerado(idioma, atual))
  })

  it.each(READMES)("$arquivo tem cada marcador uma vez", ({ arquivo }) => {
    const atual = lerReadme(arquivo)
    for (const bloco of BLOCOS) {
      expect(atual.split(`<!-- ritu:${bloco} -->`).length, bloco).toBe(2)
      expect(atual.split(`<!-- /ritu:${bloco} -->`).length, bloco).toBe(2)
    }
  })

  it("bloco alterado à mão falha com a mensagem", () => {
    const original = lerReadme("README.md")
    const alterado = original.replace(
      "<!-- ritu:numeros -->",
      "<!-- ritu:numeros -->\nEditado à mão.",
    )
    expect(() => conferir(alterado, gerado("pt", original))).toThrow(MENSAGEM)
  })

  it("marcador repetido falha", () => {
    const original = lerReadme("README.md")
    const repetido = `${original}\n<!-- ritu:adrs -->\n`
    expect(() => gerado("pt", repetido)).toThrow(MarcadorDoReadmeError)
  })
})

describe("sem segredo nem referência local", () => {
  it.each(READMES)(
    "$arquivo não cita e-mail, URL de banco, .local nem pasta de referência",
    ({ arquivo }) => {
      expect(achados(lerReadme(arquivo), pastasDeReferencia())).toEqual([])
    },
  )

  it("a busca de @ ignora bloco Mermaid e pacote com escopo, e pega o e-mail", () => {
    const texto = "```mermaid\nA@B\n```\nInstale @escopo/pacote e fale com a@exemplo.test"
    expect(achados(texto, [])).toEqual(["@ (e-mail ou segredo)"])
    expect(achados("```mermaid\nA@B\n```\n@escopo/pacote", [])).toEqual([])
  })

  it("pega URL de banco, .local/ e nome de pasta de referência, sem o nome na saída", () => {
    const nome = "pasta-fictícia"
    const texto = `postgres://u:p@h/db e .local/REFERENCIAS.md e ${nome}`
    expect(achados(texto, [nome])).toEqual([
      "@ (e-mail ou segredo)",
      "URL de banco",
      ".local/",
      "referência local",
    ])
  })

  it("nome de referência dentro de outra palavra não conta", () => {
    expect(achados("sobrepasta-fictícia", ["pasta-fictícia"])).toEqual([])
  })
})
