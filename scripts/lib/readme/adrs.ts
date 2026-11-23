// Lê as ADRs de `.adrs/` para o bloco `adrs` do README (spec 024).
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { RituError } from "@/core/errors"
import type { Adr } from "./blocos"

const ARQUIVO_DE_ADR = /^(\d{4})-.*\.md$/

// Tira o prefixo do número do título: "ADR 0001: " (como as ADRs escrevem) ou "0001. ".
function semPrefixo(titulo: string): string {
  return titulo.replace(/^ADR \d{4}: /, "").replace(/^\d{4}\. /, "")
}

function tituloDe(caminho: string, arquivo: string): string {
  const titulo = readFileSync(caminho, "utf8").match(/^# (.+)$/m)?.[1]
  if (!titulo) throw new RituError("adr_sem_titulo", `ADR sem linha "# " de título: ${arquivo}`)
  return semPrefixo(titulo.trim())
}

export function lerAdrs(pasta: string): Adr[] {
  return readdirSync(pasta)
    .flatMap((arquivo) => {
      const numero = ARQUIVO_DE_ADR.exec(arquivo)?.[1]
      if (!numero) return []
      return [{ numero, arquivo, titulo: tituloDe(join(pasta, arquivo), arquivo) }]
    })
    .sort((a, b) => a.numero.localeCompare(b.numero))
}
