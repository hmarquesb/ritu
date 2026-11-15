import type { KnowledgeBase } from "./knowledge-base"
import { GUNAS, type Guna } from "./vocab"

// Verbos das gunas dadas, na ordem de GUNAS; gunas sem verbo ficam de fora.
export function verbosDasGunas(gunas: Guna[], kb: KnowledgeBase): string[] {
  return GUNAS.filter((g) => gunas.includes(g))
    .map((g) => kb.verbo(g))
    .filter((v): v is string => v !== null)
}
