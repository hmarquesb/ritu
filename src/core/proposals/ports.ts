export type Proposta = {
  id: string
  run_id: string
  conta_id: string
  tool: string
  conteudo: unknown
  decisao: "pendente" | "aprovada" | "recusada" | "expirada"
  criado_em: string
  decidida_em: string | null
}

export interface ProposalStore {
  criar(
    contaId: string,
    runId: string,
    propostas: { tool: string; conteudo: unknown }[],
  ): Promise<Proposta[]>
  doRun(contaId: string, runId: string): Promise<Proposta[]>
  /** Só muda se pendente. */
  decidir(
    contaId: string,
    propostaId: string,
    decisao: "aprovada" | "recusada",
  ): Promise<Proposta | undefined>
  recusadas(contaId: string, tool: string): Promise<Proposta[]>
  /** Todas as decisões da tool, da mais recente para a mais antiga. */
  porTool(contaId: string, tool: string): Promise<Proposta[]>
  /** Sem contaId. */
  expirarDosRuns(runIds: string[]): Promise<number>
}
