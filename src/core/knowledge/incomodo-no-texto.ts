import { normalizar } from "./identificar"
import type { KnowledgeBase } from "./knowledge-base"

// O texto (normalizado) contém alguma palavra de incômodo da base. Palavra vazia não conta.
export function contemIncomodo(texto: string, kb: KnowledgeBase): boolean {
  const textoNormal = normalizar(texto)
  return kb.incomodos.some((incomodo) =>
    incomodo.palavras.some((palavra) => {
      const alvo = normalizar(palavra)
      return alvo !== "" && textoNormal.includes(alvo)
    }),
  )
}
