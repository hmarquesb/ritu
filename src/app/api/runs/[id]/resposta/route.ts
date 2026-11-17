import { depsReais } from "@/app/_lib/deps"
import { rotasDeFluxoDeRun } from "@/app/_rotas/fluxo-de-run"

// Valor literal de `telaConversa.rotaMaxDurationS` (o Next lê o segmento sem executar o módulo).
export const maxDuration = 60

export const POST = rotasDeFluxoDeRun(depsReais()).responder
