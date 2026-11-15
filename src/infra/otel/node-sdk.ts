import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { NodeSDK } from "@opentelemetry/sdk-node"
import { optionalEnv } from "@/infra/env"

// SDK de OTel para scripts: só liga com OTEL_EXPORTER_OTLP_ENDPOINT. O container não importa este módulo.
export function iniciarOtelNode(): { encerrar(): Promise<void> } | undefined {
  if (optionalEnv("OTEL_EXPORTER_OTLP_ENDPOINT") === undefined) return undefined
  const sdk = new NodeSDK({
    serviceName: optionalEnv("OTEL_SERVICE_NAME") ?? "ritu",
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() })],
    logRecordProcessors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
  })
  sdk.start()
  return { encerrar: () => sdk.shutdown() }
}
