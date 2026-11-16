// ⚠️ Fala com o Grafana local (docker compose, porta 3001). Opt-in, fora dos gates.
// Confere o painel, os alertas, os dados de cada painel e as séries de métricas.
//   npm run painel:check
// Sai com 0 quando está tudo no lugar, 1 quando falta painel, alerta ou série, 2 quando o Grafana não responde.
import { telemetria } from "@config/telemetria"
import { conferirPainel } from "./lib/painel-check"

const resultado = await conferirPainel({
  url: telemetria.grafana.url,
  busca: (url, init) => fetch(url, init),
  agora: Date.now(),
})

for (const linha of resultado.linhas) console.log(linha)
process.exitCode = resultado.codigo
