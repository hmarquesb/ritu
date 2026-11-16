import type { Atributos, SpanAtivo, Telemetry } from "@/core/telemetry/ports"
import type { MemoryTelemetry } from "./memory-telemetry"

// Espelho: a `memoria` fica com o que os testes e evals leem e repassa tudo à `outra`.
// A `memoria` recebe primeiro: se ela barrar (atributo ou rótulo inválido), a `outra` não vê.
export function createTeeTelemetry(memoria: MemoryTelemetry, outra: Telemetry): MemoryTelemetry {
  return {
    span(nome, atributos: Atributos, fn, opts) {
      return memoria.span(
        nome,
        atributos,
        (a) =>
          outra.span(
            nome,
            atributos,
            (b) => {
              const juntos: SpanAtivo = {
                atribuir(x) {
                  a.atribuir(x)
                  b.atribuir(x)
                },
                falhar(codigo) {
                  a.falhar(codigo)
                  b.falhar(codigo)
                },
              }
              return fn(juntos)
            },
            opts,
          ),
        opts,
      )
    },
    evento(nome, atributos) {
      memoria.evento(nome, atributos)
      outra.evento(nome, atributos)
    },
    contador(nome, rotulos, valor) {
      memoria.contador(nome, rotulos, valor)
      outra.contador(nome, rotulos, valor)
    },
    histograma(nome, valor, rotulos) {
      memoria.histograma(nome, valor, rotulos)
      outra.histograma(nome, valor, rotulos)
    },
    medidor(nome, valor, rotulos) {
      memoria.medidor(nome, valor, rotulos)
      outra.medidor(nome, valor, rotulos)
    },
    atribuirAoSpanAtual(a) {
      memoria.atribuirAoSpanAtual(a)
      outra.atribuirAoSpanAtual(a)
    },
    log(codigo, campos) {
      memoria.log(codigo, campos)
      outra.log(codigo, campos)
    },
    traceparentAtual: () => outra.traceparentAtual() ?? memoria.traceparentAtual(),
    async encerrar() {
      await memoria.encerrar()
      await outra.encerrar()
    },
    get spans() {
      return memoria.spans
    },
    get eventos() {
      return memoria.eventos
    },
    get metricas() {
      return memoria.metricas
    },
    get logs() {
      return memoria.logs
    },
  }
}
