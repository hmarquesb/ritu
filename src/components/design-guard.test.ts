import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

type Achado = { arquivo: string; linha: number; regra: string }
type Regra = { id: string; acusa: (linha: string) => boolean }

const ROOT = fileURLToPath(new URL("../..", import.meta.url))
const VARRIDAS = ["src/app", "src/components"]
const EXTENSOES = [".ts", ".tsx", ".css"]
const EXCLUIDOS = new Set(["src/components/tokens/tokens.css"])
const TESTE = /\.test\.tsx?$/

// `#` seguido de 3 a 8 hexadecimais, sem letra ou dígito colado (não é `#conteudo`).
const COR_HEX = /(?<![\w&-])#[0-9a-fA-F]{3,8}(?![\w-])/
const COR_FUNCAO = /(?<![\w-])(?:rgba?|hsla?|oklch)\(/
// `href="#…"` e `id="#…"` são âncora ou id, não cor.
const ATRIBUTO_ID = /(?<![\w-])(?:href|id)\s*=\s*\{?\s*(["'`])#[^"'`]*\1/g
const MODULO = /\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g
const PACOTES_PROIBIDOS = [
  "@radix-ui",
  "@headlessui",
  "@mui",
  "@chakra-ui",
  "antd",
  "lucide-react",
  "class-variance-authority",
  "tailwind-variants",
]
const TEXTO_PX = /(?<![\w-])text-\[\d+(?:\.\d+)?px\]|font-size\s*:\s*\d+(?:\.\d+)?px/

const ehPacoteProibido = (modulo: string): boolean =>
  PACOTES_PROIBIDOS.some((pacote) => modulo === pacote || modulo.startsWith(`${pacote}/`))

const REGRAS: Regra[] = [
  {
    id: "G1",
    acusa: (linha) => {
      const semAncora = linha.replace(ATRIBUTO_ID, "")
      return COR_HEX.test(semAncora) || COR_FUNCAO.test(semAncora)
    },
  },
  { id: "G2", acusa: (linha) => /(?<![\w-])dark:(?=[\w[-])/.test(linha) },
  { id: "G3", acusa: (linha) => linha.includes("dangerouslySetInnerHTML") },
  {
    id: "G4",
    acusa: (linha) => [...linha.matchAll(MODULO)].some((m) => ehPacoteProibido(m[1] ?? "")),
  },
  { id: "G5", acusa: (linha) => TEXTO_PX.test(linha) },
]

// Função pura: recebe o caminho e o texto, devolve um achado por linha e regra.
export function acharViolacoes(arquivo: string, texto: string): Achado[] {
  return texto.split("\n").flatMap((conteudo, indice) =>
    REGRAS.filter((regra) => regra.acusa(conteudo)).map((regra) => ({
      arquivo,
      linha: indice + 1,
      regra: regra.id,
    })),
  )
}

const formatar = (achado: Achado): string => `${achado.arquivo}:${achado.linha}: ${achado.regra}`
const regrasEm = (texto: string): string[] =>
  acharViolacoes("src/components/x.tsx", texto).map((achado) => achado.regra)

describe("G1 · cor literal", () => {
  it("hex dentro de classe Tailwind é cor", () => {
    expect(regrasEm('<div className="bg-[#fff]" />')).toEqual(["G1"])
  })

  it("rgb( é cor", () => {
    expect(regrasEm("color: rgb(0 0 0);")).toEqual(["G1"])
  })

  it("oklch( é cor", () => {
    expect(regrasEm("background: oklch(0.9 0.02 80);")).toEqual(["G1"])
  })

  it("hsl( é cor", () => {
    expect(regrasEm("color: hsl(0 0% 0%);")).toEqual(["G1"])
  })

  it("href com âncora não é cor", () => {
    expect(regrasEm('<a href="#conteudo">pular</a>')).toEqual([])
    expect(regrasEm('<a href="#ade">ir</a>')).toEqual([])
  })

  it("id com # não é cor", () => {
    expect(regrasEm('<main id="#fff">')).toEqual([])
  })

  it("hex dentro de comentário conta como cor", () => {
    expect(regrasEm("// use #fff aqui")).toEqual(["G1"])
  })

  it("seletor de id em CSS com nome que não é hex não é cor", () => {
    expect(regrasEm("#conteudo { color: var(--ink); }")).toEqual([])
  })
})

describe("G2 · variante dark:", () => {
  it("dark: em classe é violação", () => {
    expect(regrasEm('<p className="dark:bg-ink" />')).toEqual(["G2"])
  })

  it("dark: como chave de objeto não é violação", () => {
    expect(regrasEm('const tema = { dark: "x" }')).toEqual([])
  })
})

describe("G3 · dangerouslySetInnerHTML", () => {
  it("uso é violação", () => {
    expect(regrasEm("<div dangerouslySetInnerHTML={{ __html: x }} />")).toEqual(["G3"])
  })
})

describe("G4 · pacote de UI proibido", () => {
  it("import de @radix-ui é violação", () => {
    expect(regrasEm('import x from "@radix-ui/react-dialog"')).toEqual(["G4"])
  })

  it("import de lucide-react é violação", () => {
    expect(regrasEm('import { Sun } from "lucide-react"')).toEqual(["G4"])
  })

  it("import de react-aria-components não é violação de G4", () => {
    expect(regrasEm('import { Button } from "react-aria-components"')).toEqual([])
  })

  it("import de cva e tailwind-variants é violação", () => {
    expect(regrasEm('import { cva } from "class-variance-authority"')).toEqual(["G4"])
    expect(regrasEm('import { tv } from "tailwind-variants"')).toEqual(["G4"])
  })
})

describe("G5 · texto em px", () => {
  it("text-[14px] é violação", () => {
    expect(regrasEm('<p className="text-[14px]" />')).toEqual(["G5"])
  })

  it("font-size em px é violação", () => {
    expect(regrasEm("font-size: 12px;")).toEqual(["G5"])
  })

  it("text-body (token) não é violação", () => {
    expect(regrasEm('<p className="text-body" />')).toEqual([])
  })
})

// Varredura real: passeio no disco, fora dos arquivos de teste e do tokens.css.
function arquivosDe(dir: string): string[] {
  const absoluto = join(ROOT, dir)
  if (!existsSync(absoluto)) return []
  return readdirSync(absoluto, { withFileTypes: true }).flatMap((entrada) => {
    const relativo = `${dir}/${entrada.name}`
    if (entrada.isDirectory()) return arquivosDe(relativo)
    const varrido =
      EXTENSOES.some((ext) => relativo.endsWith(ext)) &&
      !TESTE.test(relativo) &&
      !EXCLUIDOS.has(relativo)
    return varrido ? [relativo] : []
  })
}

describe("varredura do repositório", () => {
  it("src/app e src/components não têm achados de G1 a G5", () => {
    const achados = VARRIDAS.flatMap(arquivosDe).flatMap((arquivo) =>
      acharViolacoes(arquivo, readFileSync(join(ROOT, arquivo), "utf8")).map(formatar),
    )
    expect(achados).toEqual([])
  })
})
