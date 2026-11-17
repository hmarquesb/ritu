import type { FraseDeEtapa } from "./etapas"
import type { VisaoDoRun } from "./visao"

export type EventoDaTela =
  | { tipo: "inicio"; run_id: string }
  | { tipo: "etapa"; frase: FraseDeEtapa }
  | { tipo: "fim"; visao: VisaoDoRun; pendentes: number }
  | { tipo: "erro"; erro: string }

export function codificarEvento(e: EventoDaTela): string {
  return `${JSON.stringify(e)}\n`
}
