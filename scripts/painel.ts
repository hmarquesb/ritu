// Gera o painel e os alertas do Grafana a partir de scripts/lib/painel.ts. Não fala com o Grafana.
//   npm run painel:gerar
// Grava observability/dashboards/ritu.json e observability/grafana/alerting/ritu.yaml (o YAML é JSON, que é YAML válido).
// Rodar de novo não muda nada. scripts/lib/painel.test.ts trava os arquivos commitados contra esta saída.
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { ALERTAS, PAINEL } from "./lib/painel"
import { gerarAlertas, gerarPainel } from "./lib/painel-grafana"

const RAIZ = fileURLToPath(new URL("../", import.meta.url))

async function gravar(caminho: string, conteudo: string): Promise<void> {
  const destino = resolve(RAIZ, caminho)
  await mkdir(dirname(destino), { recursive: true })
  await writeFile(destino, conteudo)
}

async function main(): Promise<void> {
  await gravar(
    "observability/dashboards/ritu.json",
    `${JSON.stringify(gerarPainel(PAINEL), null, 2)}\n`,
  )
  await gravar("observability/grafana/alerting/ritu.yaml", gerarAlertas(ALERTAS))
  console.log("Painel e alertas gerados em observability/.")
}

await main()
