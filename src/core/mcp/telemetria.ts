import type { Telemetry } from "@/core/telemetry/ports"

export type StatusDaTool = "ok" | "invalido" | "erro"

// Embrulha uma chamada de tool pública: span `mcp.tool` (raiz, sem run) e `ritu_mcp_chamadas_total`.
// Só o nome da tool vai para telemetria; os argumentos e o resultado nunca saem daqui.
export async function medirChamadaMcp<T>(
  telemetry: Telemetry,
  tool: string,
  fn: () => Promise<T>,
  classificar: (resultado: T | undefined, erro?: unknown) => StatusDaTool,
): Promise<T> {
  let status: StatusDaTool = "erro"
  try {
    return await telemetry.span("mcp.tool", { "tool.nome": tool }, async (span) => {
      try {
        const resultado = await fn()
        status = classificar(resultado)
        span.atribuir({ "tool.status": status })
        return resultado
      } catch (erro) {
        status = classificar(undefined, erro)
        span.atribuir({ "tool.status": status })
        throw erro
      }
    })
  } finally {
    telemetry.contador("ritu_mcp_chamadas_total", { tool, resultado: status })
  }
}
