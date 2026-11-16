import { neutralizar } from "@/core/neutralizar"

// Forma estrutural (D2): uma NotaDeRotina[] passa direto, sem o agente importar o domínio routine.
export type NotaParaResumo = { texto: string; criado_em: string }

// Da mais antiga para a mais recente (cópia; a entrada não muda).
export function ordenarNotas(notas: NotaParaResumo[]): NotaParaResumo[] {
  return [...notas].sort((a, b) => a.criado_em.localeCompare(b.criado_em))
}

// As notas da mais antiga para a mais recente, numeradas, com o dia; o texto da pessoa vai neutralizado.
export function montarEntradaDaMemoria(notas: NotaParaResumo[]): string {
  const linhas = ordenarNotas(notas).map(
    (nota, i) => `${i + 1}. (${nota.criado_em.slice(0, 10)}) ${neutralizar(nota.texto)}`,
  )
  return ["<notas_de_rotina>", ...linhas, "</notas_de_rotina>"].join("\n")
}
