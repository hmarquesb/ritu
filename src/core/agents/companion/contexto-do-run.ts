import type { ContextoDoRun } from "@/core/tools/tool"
import type { DadosDoPreparo } from "./preparo"

// Pura: o que as tools de proposta leem do run. Nada disto vai ao contexto do modelo.
export function contextoDoRun(dados: DadosDoPreparo): ContextoDoRun {
  return {
    ...(dados.fato_de_rotina ? { fato_de_rotina: dados.fato_de_rotina } : {}),
    com_incomodo: dados.com_incomodo,
    tem_para_ter: dados.para_ter !== undefined,
    nao_tem: dados.nao_tem_do_run,
    candidatos: dados.candidatos_do_preparo,
    na_lista: dados.na_lista,
    lista_recusada: dados.lista_recusada,
    notas_ativas: dados.notas_ativas,
  }
}
