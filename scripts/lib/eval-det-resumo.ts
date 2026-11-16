import { z } from "zod"

const arquivoSchema = z.object({
  name: z.string(),
  status: z.string(),
  assertionResults: z.array(z.object({ status: z.string() })),
})

const relatorioSchema = z.object({ testResults: z.array(arquivoSchema) })

type Arquivo = z.infer<typeof arquivoSchema>

type Linha = { grupo: string; arquivos: number; casos: number; falhas: number }

const MARCA_DA_PASTA = "evals/det/"
const GRUPO_DA_RAIZ = "(raiz)"

function grupoDoArquivo(caminho: string): string {
  const inicio = caminho.indexOf(MARCA_DA_PASTA)
  if (inicio === -1) throw new Error("Arquivo do relatório fora de evals/det/")
  const resto = caminho.slice(inicio + MARCA_DA_PASTA.length)
  return resto.includes("/") ? (resto.split("/")[0] ?? GRUPO_DA_RAIZ) : GRUPO_DA_RAIZ
}

// Um arquivo que quebra antes de rodar os casos não tem caso falho; conta como uma falha.
function falhasDo(arquivo: Arquivo): number {
  const falhas = arquivo.assertionResults.filter((a) => a.status === "failed").length
  return Math.max(falhas, arquivo.status === "failed" ? 1 : 0)
}

function linhasPorGrupo(arquivos: Arquivo[]): Linha[] {
  const grupos = new Map<string, Linha>()
  for (const arquivo of arquivos) {
    const grupo = grupoDoArquivo(arquivo.name)
    const linha = grupos.get(grupo) ?? { grupo, arquivos: 0, casos: 0, falhas: 0 }
    linha.arquivos += 1
    linha.casos += arquivo.assertionResults.length
    linha.falhas += falhasDo(arquivo)
    grupos.set(grupo, linha)
  }
  return [...grupos.values()].sort((a, b) => (a.grupo < b.grupo ? -1 : 1))
}

function somar(linhas: Linha[]): Omit<Linha, "grupo"> {
  return linhas.reduce(
    (total, l) => ({
      arquivos: total.arquivos + l.arquivos,
      casos: total.casos + l.casos,
      falhas: total.falhas + l.falhas,
    }),
    { arquivos: 0, casos: 0, falhas: 0 },
  )
}

export function resumirEvalDet(json: unknown): string {
  const { testResults } = relatorioSchema.parse(json)
  const linhas = linhasPorGrupo(testResults)
  const total = somar(linhas)
  return [
    "## Evals determinísticos",
    "",
    "| Grupo | Arquivos | Casos | Falhas |",
    "| --- | ---: | ---: | ---: |",
    ...linhas.map((l) => `| ${l.grupo} | ${l.arquivos} | ${l.casos} | ${l.falhas} |`),
    `| **Total** | ${total.arquivos} | ${total.casos} | ${total.falhas} |`,
  ].join("\n")
}
