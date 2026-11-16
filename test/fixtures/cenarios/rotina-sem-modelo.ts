import { rotinaResumida } from "./rotina-resumida"
import type { Cenario } from "./tipos"

// O mesmo de rotina-resumida, com a Memória sem modelo no dia: o resumo sai pelo código (as notas, a mais recente primeiro).
export const rotinaSemModelo: Cenario = {
  ...rotinaResumida,
  nome: "rotina-sem-modelo",
  descricao:
    "O mesmo de rotina-resumida, com o papel apoio sem modelo: a linha é aprovada e o resumo sai pelo código, com as três notas",
  memoria: "sem_modelo",
}
