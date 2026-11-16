import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { contrastRatio, parseTokens } from "./contrast"

const TOKENS_CSS = join(fileURLToPath(new URL(".", import.meta.url)), "tokens.css")
const tokens = parseTokens(readFileSync(TOKENS_CSS, "utf8"))

const TOKENS_ESPERADOS = [
  "canvas",
  "sunken",
  "surface",
  "raised",
  "line",
  "line-strong",
  "ink",
  "ink-muted",
  "primary",
  "primary-hover",
  "primary-pressed",
  "on-primary",
  "primary-soft",
  "amber",
  "amber-ink",
  "amber-soft",
  "sage",
  "sage-ink",
  "sage-soft",
  "danger",
  "danger-soft",
  "focus",
  "vata",
  "pitta",
  "kapha",
  "paper",
  "paper-ink",
  "scrim",
  "shadow",
]

const FUNDOS = ["canvas", "sunken", "surface", "raised"]
const FUNDOS_SOFT = ["primary-soft", "amber-soft", "sage-soft", "danger-soft"]

type Tema = "light" | "dark"
type Regra = { texto: string; frente: string; fundo: string[]; minimo: number }

const REGRAS_TEXTO: Regra[] = [
  { texto: "ink", frente: "ink", fundo: FUNDOS, minimo: 4.5 },
  { texto: "ink-muted", frente: "ink-muted", fundo: FUNDOS, minimo: 4.5 },
  { texto: "primary", frente: "primary", fundo: FUNDOS, minimo: 4.5 },
  { texto: "danger", frente: "danger", fundo: FUNDOS, minimo: 4.5 },
  { texto: "sage-ink", frente: "sage-ink", fundo: FUNDOS, minimo: 4.5 },
  { texto: "amber-ink", frente: "amber-ink", fundo: FUNDOS, minimo: 4.5 },
  {
    texto: "on-primary",
    frente: "on-primary",
    fundo: ["primary", "primary-hover", "primary-pressed"],
    minimo: 4.5,
  },
  { texto: "ink", frente: "ink", fundo: FUNDOS_SOFT, minimo: 4.5 },
  { texto: "ink-muted", frente: "ink-muted", fundo: FUNDOS_SOFT, minimo: 4.5 },
  { texto: "primary", frente: "primary", fundo: ["primary-soft"], minimo: 4.5 },
  { texto: "sage-ink", frente: "sage-ink", fundo: ["sage-soft"], minimo: 4.5 },
  { texto: "amber-ink", frente: "amber-ink", fundo: ["amber-soft"], minimo: 4.5 },
  { texto: "danger", frente: "danger", fundo: ["danger-soft"], minimo: 4.5 },
  { texto: "paper-ink", frente: "paper-ink", fundo: ["paper"], minimo: 4.5 },
]

const REGRAS_NAO_TEXTO: Regra[] = [
  { texto: "line-strong", frente: "line-strong", fundo: FUNDOS, minimo: 3 },
  { texto: "focus", frente: "focus", fundo: FUNDOS, minimo: 3 },
  { texto: "vata", frente: "vata", fundo: FUNDOS, minimo: 3 },
  { texto: "pitta", frente: "pitta", fundo: FUNDOS, minimo: 3 },
  { texto: "kapha", frente: "kapha", fundo: FUNDOS, minimo: 3 },
]

const TEMAS: Tema[] = ["light", "dark"]

function corDoTema(nome: string, tema: Tema): string {
  const token = tokens[nome]
  if (!token) throw new Error(`token ausente: ${nome}`)
  return token[tema]
}

function casosDe(regras: Regra[]): Array<[string, Tema, string, string, number]> {
  const casos: Array<[string, Tema, string, string, number]> = []
  for (const tema of TEMAS) {
    for (const regra of regras) {
      for (const fundo of regra.fundo) {
        casos.push([`${regra.texto} sobre ${fundo}`, tema, regra.frente, fundo, regra.minimo])
      }
    }
  }
  return casos
}

describe("contrastRatio", () => {
  it("preto sobre branco dá 21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1)
  })

  it("branco sobre branco dá 1", () => {
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1)
  })

  it("é simétrico e aceita maiúsculas e minúsculas", () => {
    const ab = contrastRatio("#9e4b2b", "#f8f3ea")
    expect(contrastRatio("#f8f3ea", "#9E4B2B")).toBeCloseTo(ab, 10)
  })
})

describe("parseTokens", () => {
  it("lê cada light-dark em light e dark, com a chave sem o prefixo", () => {
    const css = `
      :root {
        --ritu-canvas: light-dark(#f8f3ea, #1e1611);
        --ritu-scrim: light-dark(rgb(51 36 26 / 0.45), rgb(0 0 0 / 0.6));
        --ritu-fast: 120ms;
      }
    `
    expect(parseTokens(css)).toEqual({
      canvas: { light: "#f8f3ea", dark: "#1e1611" },
      scrim: { light: "rgb(51 36 26 / 0.45)", dark: "rgb(0 0 0 / 0.6)" },
    })
  })
})

describe("tokens.css", () => {
  it.each(TOKENS_ESPERADOS)("tem o token %s nos dois temas", (nome) => {
    for (const tema of TEMAS) {
      expect(tokens[nome], `${nome} ausente`).toBeDefined()
      expect(corDoTema(nome, tema), `${nome} sem valor em ${tema}`).toBeTruthy()
    }
  })

  describe.each(TEMAS)("tema %s, texto com ≥ 4,5", (tema) => {
    it.each(casosDe(REGRAS_TEXTO).filter(([, t]) => t === tema))(
      "%s",
      (_nome, _t, frente, fundo, minimo) => {
        const razao = contrastRatio(corDoTema(frente, tema), corDoTema(fundo, tema))
        expect(
          razao,
          `par ${frente} sobre ${fundo}, tema ${tema}: razão ${razao.toFixed(2)}, mínimo ${minimo}`,
        ).toBeGreaterThanOrEqual(minimo)
      },
    )
  })

  describe.each(TEMAS)("tema %s, não texto com ≥ 3", (tema) => {
    it.each(casosDe(REGRAS_NAO_TEXTO).filter(([, t]) => t === tema))(
      "%s",
      (_nome, _t, frente, fundo, minimo) => {
        const razao = contrastRatio(corDoTema(frente, tema), corDoTema(fundo, tema))
        expect(
          razao,
          `par ${frente} sobre ${fundo}, tema ${tema}: razão ${razao.toFixed(2)}, mínimo ${minimo}`,
        ).toBeGreaterThanOrEqual(minimo)
      },
    )
  })
})
