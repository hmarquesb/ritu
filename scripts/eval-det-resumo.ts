import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { resumirEvalDet } from "./lib/eval-det-resumo"

const RELATORIO = resolve(".vitest/eval-det.json")

if (!existsSync(RELATORIO)) {
  console.log("Sem resultado dos evals determinísticos.")
} else {
  console.log(resumirEvalDet(JSON.parse(readFileSync(RELATORIO, "utf8"))))
}
