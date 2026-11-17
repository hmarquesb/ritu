import type { SaidaDoInterprete } from "@/core/agents/interpreter/saida"
import type { PassoRoteirizado } from "@/infra/fakes/scripted-runtime"

// Um roteiro do modo e2e: a mensagem exata que o escolhe, a leitura do Intérprete e os passos do Acompanhante.
export type Roteiro = {
  nome: string
  mensagem: string
  interpretacao: SaidaDoInterprete
  passos: PassoRoteirizado[]
}

export const SEM_NADA: Omit<SaidaDoInterprete, "intencoes" | "estados"> = {
  itens_casa: [],
  evitar_sempre: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}
