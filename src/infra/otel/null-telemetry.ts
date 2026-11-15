import type { SpanAtivo, Telemetry } from "@/core/telemetry/ports"

// Telemetria sem endpoint: testes, CI e quem clona o repositório. Não grava nada.
export function createNullTelemetry(): Telemetry {
  const spanNulo: SpanAtivo = {
    atribuir() {},
    falhar() {},
  }

  return {
    async span<T>(_nome: unknown, _atributos: unknown, fn: (s: SpanAtivo) => Promise<T>) {
      return fn(spanNulo)
    },
    evento() {},
    contador() {},
    histograma() {},
    medidor() {},
    log() {},
    traceparentAtual: () => undefined,
    async encerrar() {},
  }
}
