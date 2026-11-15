import type { AtributoPermitido, NomeDeMetrica, NomeDeSpan } from "./nomes"

export type Atributos = Partial<Record<AtributoPermitido, string | number | boolean>>

export interface SpanAtivo {
  atribuir(a: Atributos): void
  falhar(codigo: string): void
}

export interface Telemetry {
  span<T>(
    nome: NomeDeSpan,
    atributos: Atributos,
    fn: (s: SpanAtivo) => Promise<T>,
    opts?: { traceparent?: string },
  ): Promise<T>
  evento(nome: "pausa", atributos?: Atributos): void
  contador(nome: NomeDeMetrica, rotulos?: Atributos, valor?: number): void
  histograma(nome: NomeDeMetrica, valor: number, rotulos?: Atributos): void
  medidor(nome: NomeDeMetrica, valor: number, rotulos?: Atributos): void
  log(nivel: "info" | "warn" | "error", codigo: string, campos?: Atributos): void
  traceparentAtual(): string | undefined
  encerrar(): Promise<void> // envia o que falta
}
