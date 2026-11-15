export type Mensagem = {
  id: string
  conta_id: string
  run_id: string | null
  autor: "pessoa" | "agente"
  texto: string
  com_incomodo: boolean
  dia: string
  criado_em: string
}

export interface MessageRepository {
  gravar(
    contaId: string,
    m: {
      run_id?: string
      autor: "pessoa" | "agente"
      texto: string
      com_incomodo: boolean
      dia: string
    },
  ): Promise<Mensagem>
  /** Em ordem. */
  doDia(contaId: string, dia: string): Promise<Mensagem[]>
  marcarIncomodoDoRun(contaId: string, runId: string): Promise<void>
  /** Sem contaId. */
  apagarAntesDe(limite: Date): Promise<number>
  /** Sem contaId. */
  apagarComIncomodoAntesDoDia(dia: string): Promise<number>
}
