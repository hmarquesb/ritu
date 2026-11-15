export type StatusPadrao = "candidato" | "confirmado" | "recusado"

export type TipoPadrao = "ajuda_em_estado" | "estados_juntos"

export type Padrao = {
  id: string
  conta_id: string
  tipo: TipoPadrao
  chave: string
  frase: string
  ocorrencias: number
  status: StatusPadrao
  criado_em: string
  decidido_em: string | null
}

export interface PatternStore {
  listar(contaId: string, status?: StatusPadrao): Promise<Padrao[]>
  /** Recusado ou já existente: undefined. */
  propor(
    contaId: string,
    p: { tipo: TipoPadrao; chave: string; frase: string; ocorrencias: number },
  ): Promise<Padrao | undefined>
  decidir(contaId: string, padraoId: string, status: "confirmado" | "recusado"): Promise<void>
  apagar(contaId: string, padraoId: string): Promise<void>
}
