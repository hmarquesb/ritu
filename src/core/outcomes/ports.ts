import type { SugestaoRegistrada } from "@/core/memory-schemas"

export type { SugestaoRegistrada }

export type Resultado = "ajudou" | "nao_ajudou" | "nao_fez"

export type Retorno = {
  id: string
  conta_id: string
  run_id: string
  sugestao: SugestaoRegistrada
  status: "aguardando" | "respondido"
  resultado: Resultado | null
  origem: "toque" | "conversa" | null
  criado_em: string
  respondido_em: string | null
}

export interface OutcomeStore {
  criar(contaId: string, runId: string, sugestoes: SugestaoRegistrada[]): Promise<Retorno[]>
  /** Mais recente primeiro. */
  pendentes(contaId: string): Promise<Retorno[]>
  /** Respondidos da conta com respondido_em a partir de desde. */
  respondidosDesde(contaId: string, desde: Date): Promise<Retorno[]>
  /** Só o aguardando muda; mudou diz se este chamado mudou. Retorno inexistente ou de outra conta: undefined. */
  responder(
    contaId: string,
    retornoId: string,
    resultado: Resultado,
    origem: "toque" | "conversa",
  ): Promise<{ retorno: Retorno; mudou: boolean } | undefined>
  /** Só troca a sugestão de um aguardando; devolve undefined se não mudou (respondido, outra conta ou inexistente). */
  atualizarSugestao(
    contaId: string,
    retornoId: string,
    sugestao: SugestaoRegistrada,
  ): Promise<Retorno | undefined>
  doRun(contaId: string, runId: string): Promise<Retorno[]>
  /** Sem contaId. */
  apagarAguardandoAntesDe(limite: Date): Promise<number>
}
