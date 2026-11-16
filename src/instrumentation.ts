import { optionalEnv } from "@/infra/env"

// Sem OTEL_EXPORTER_OTLP_ENDPOINT, nada de OTel é carregado nem abre conexão.
export async function register(): Promise<void> {
  if (optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined) return
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { registerOTel } = await import("@vercel/otel")
  const { opcoesDoOtel } = await import("./infra/otel/opcoes")
  const o = opcoesDoOtel()
  registerOTel({
    serviceName: optionalEnv("OTEL_SERVICE_NAME") ?? "ritu",
    traceExporter: o.traceExporter,
    metricReaders: [o.metricReader],
    logRecordProcessors: [o.logRecordProcessor],
    attributes: { "service.instance.id": String(o.resource.attributes["service.instance.id"]) },
  })
}
