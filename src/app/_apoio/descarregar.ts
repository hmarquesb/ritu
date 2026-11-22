import { after } from "next/server"
import type { Container } from "@/infra/container"

// Com a telemetria ligada, envia o que falta depois da resposta; com a nula, não faz nada.
export function descarregarDepois(
  container: Container,
  agendar: (f: () => Promise<void>) => void = after,
): void {
  if (!container.telemetriaLigada) return
  agendar(() => container.telemetry.encerrar())
}
