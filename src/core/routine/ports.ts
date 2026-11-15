export type NotaDeRotina = {
  id: string
  conta_id: string
  texto: string
  ativa: boolean
  criado_em: string
}

export type ResumoDeRotina = {
  conta_id: string
  versao: number
  texto: string
  criado_em: string
}

export interface RoutineStore {
  notasAtivas(contaId: string): Promise<NotaDeRotina[]>
  anotar(contaId: string, texto: string): Promise<NotaDeRotina>
  desativar(contaId: string, notaId: string): Promise<void>
  /** A versão mais nova. */
  resumo(contaId: string): Promise<ResumoDeRotina | undefined>
  /** Versão anterior + 1. */
  gravarResumo(contaId: string, texto: string): Promise<ResumoDeRotina>
}
