import { telemetria } from "@config/telemetria"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { optionalEnv } from "@/infra/env"
import { opcoesDoOtel } from "./opcoes"

// SDK de OTel para scripts: só liga com OTEL_EXPORTER_OTLP_ENDPOINT. O container não importa este módulo.
export function iniciarOtelNode(): { encerrar(): Promise<void> } | undefined {
  if (optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined) return undefined
  const o = opcoesDoOtel({ intervaloMs: telemetria.exportacaoNosScriptsMs })
  const sdk = new NodeSDK({
    resource: o.resource,
    traceExporter: o.traceExporter,
    metricReaders: [o.metricReader],
    logRecordProcessors: [o.logRecordProcessor],
  })
  sdk.start()
  return { encerrar: () => sdk.shutdown() }
}
