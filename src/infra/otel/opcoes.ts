import { randomUUID } from "node:crypto"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { optionalEnv } from "@/infra/env"

// Um id por processo: distingue as instâncias nas séries do painel.
const INSTANCIA = randomUUID()

// Exportadores e recurso do OTel num ponto só. Endpoint e headers vêm das variáveis padrão do OTel.
export function opcoesDoOtel({ intervaloMs }: { intervaloMs?: number } = {}) {
  return {
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      ...(intervaloMs === undefined ? {} : { exportIntervalMillis: intervaloMs }),
    }),
    logRecordProcessor: new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    resource: resourceFromAttributes({
      "service.name": optionalEnv("OTEL_SERVICE_NAME") ?? "ritu",
      "service.instance.id": INSTANCIA,
    }),
  }
}
