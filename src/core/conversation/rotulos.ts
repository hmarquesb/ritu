import type { Restricao } from "@/core/knowledge/vocab"

// Rótulos das restrições alimentares. Mora aqui para o Intérprete não depender dos textos da conversa.
export const rotulosDeRestricao: Record<Restricao, string> = {
  vegetariana: "vegetariana",
  vegana: "vegana",
  sem_lactose: "sem lactose",
  sem_gluten: "sem glúten",
}
