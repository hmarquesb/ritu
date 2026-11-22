// O quiz pede uma resposta por pergunta, sem repetir nem sobrar (017 e 020).
export function quizCompleto(perguntaIds: readonly string[], enviados: readonly string[]): boolean {
  return (
    enviados.length === perguntaIds.length &&
    new Set(enviados).size === enviados.length &&
    enviados.every((id) => perguntaIds.includes(id))
  )
}
