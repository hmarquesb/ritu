// `npm run readme`: refaz os blocos gerados de README.md e README.en.md a partir do histórico, das ADRs e do site (spec 024).
// Sem rede, sem chave, sem banco. Só grava os dois arquivos se os dois passarem.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { publico } from "@config/index"
import { RituError } from "@/core/errors"
import { historicoSchema } from "@/core/evals/historico"
import { lerAdrs } from "./lib/readme/adrs"
import { aplicarBlocos } from "./lib/readme/aplicar"
import { blocosDoReadme, type Idioma } from "./lib/readme/blocos"

const RAIZ = process.cwd()
const READMES: { idioma: Idioma; arquivo: string }[] = [
  { idioma: "pt", arquivo: "README.md" },
  { idioma: "en", arquivo: "README.en.md" },
]

function lerHistorico() {
  const bruto: unknown = JSON.parse(
    readFileSync(join(RAIZ, "evals/resultados/historico.json"), "utf8"),
  )
  const lido = historicoSchema.safeParse(bruto)
  if (!lido.success) {
    throw new RituError("historico_invalido", "evals/resultados/historico.json não passa no schema")
  }
  return lido.data
}

function main(): number {
  try {
    const historico = lerHistorico()
    const adrs = lerAdrs(join(RAIZ, ".adrs"))
    const novos = READMES.map(({ idioma, arquivo }) => {
      const caminho = join(RAIZ, arquivo)
      const blocos = blocosDoReadme({ historico, adrs, siteUrl: publico.siteUrl, idioma })
      return { caminho, texto: aplicarBlocos(readFileSync(caminho, "utf8"), blocos) }
    })
    for (const { caminho, texto } of novos) writeFileSync(caminho, texto)
    console.log("README.md e README.en.md atualizados.")
    return 0
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro))
    return 1
  }
}

process.exitCode = main()
