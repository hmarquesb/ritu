export type MotivoDaLista = "faltou_hoje" | "fez_falta" | "pessoa"

export type ItemDaLista = {
  conta_id: string
  alimento_id: string
  motivo: MotivoDaLista
  detalhe: string
  criado_em: string
}

export interface ShortageStore {
  registrar(
    contaId: string,
    faltas: { alimento_id: string; origem: "teria_entrado" | "nao_tenho"; run_id?: string }[],
    dia: string,
  ): Promise<void>
  diasComFalta(
    contaId: string,
    desdeDia: string,
  ): Promise<{ alimento_id: string; dias: number; ultimo_dia: string }[]>
  apagarDoAlimento(contaId: string, alimentoId: string): Promise<void>
  lista(contaId: string): Promise<ItemDaLista[]>
  porNaLista(
    contaId: string,
    item: { alimento_id: string; motivo: MotivoDaLista; detalhe: string },
  ): Promise<void>
  tirarDaLista(contaId: string, alimentoId: string): Promise<void>
  /** Sem contaId. */
  apagarFaltasAntesDe(dia: string): Promise<number>
}
