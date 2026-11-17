import { comDescarga, type DepsDaRotaDeCron, recusaDeCron } from "./cron"

// Saúde para monitor externo: 200 com banco ok, 503 com banco falhou. Mesmo CRON_SECRET do cron.
export function rotaDaSaude(deps: DepsDaRotaDeCron): (request: Request) => Promise<Response> {
  const { container } = deps
  return comDescarga(container, async (request) => {
    const recusa = recusaDeCron(request, deps.segredo)
    if (recusa) return recusa
    const saude = await container.saude()
    return Response.json(saude, { status: saude.banco === "ok" ? 200 : 503 })
  })
}
