import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parse } from "yaml"
import { type DemoSeed, demoSeedSchema } from "@/core/demo-seed"
import { KnowledgeInvalidError } from "@/core/knowledge/knowledge-base"

// Único lugar do projeto que lê seed/demo.yaml. Só lê, faz parse e valida o schema; a conferência contra a base fica em validarSeed.
const ARQUIVO = "demo.yaml"

function lerTexto(caminho: string): string {
  try {
    return readFileSync(caminho, "utf8")
  } catch {
    throw new KnowledgeInvalidError([`${ARQUIVO}: arquivo ausente ou ilegível`])
  }
}

function lerYaml(texto: string): unknown {
  try {
    return parse(texto)
  } catch (erro) {
    const linha = erro instanceof Error ? erro.message.split("\n")[0] : "erro desconhecido"
    throw new KnowledgeInvalidError([`${ARQUIVO}: YAML inválido (${linha})`])
  }
}

export function loadDemoSeed(dir = "seed"): DemoSeed {
  const valor = lerYaml(lerTexto(join(dir, ARQUIVO)))
  const resultado = demoSeedSchema.safeParse(valor)
  if (!resultado.success) {
    const erros = resultado.error.issues.map((issue) => {
      const caminho = issue.path.length > 0 ? issue.path.join(".") : "raiz"
      return `${caminho}: ${issue.message}`
    })
    throw new KnowledgeInvalidError(erros)
  }
  return resultado.data
}
