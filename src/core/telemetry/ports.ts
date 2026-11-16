import type {
  AtributoPermitido,
  CodigoDeLog,
  NomeDeContador,
  NomeDeHistograma,
  NomeDeMedidor,
  NomeDeSpan,
} from "./nomes"

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
  contador(nome: NomeDeContador, rotulos?: Atributos, valor?: number): void
  histograma(nome: NomeDeHistograma, valor: number, rotulos?: Atributos): void
  medidor(nome: NomeDeMedidor, valor: number, rotulos?: Atributos): void
  atribuirAoSpanAtual(a: Atributos): void
  log(codigo: CodigoDeLog, campos?: Atributos): void
  traceparentAtual(): string | undefined
  encerrar(): Promise<void> // envia o que falta
}
