import { RituError } from "@/core/errors"

const CODIGOS_DE_RECUSA = new Set(["ECONNREFUSED", "ENOTFOUND"])

// Erros de conexão do driver postgres e do Node. A mensagem original pode trazer a URL do banco.
export function isConnectionError(erro: unknown): boolean {
  if (typeof erro !== "object" || erro === null || !("code" in erro)) return false
  const codigo = erro.code
  return (
    typeof codigo === "string" &&
    (CODIGOS_DE_RECUSA.has(codigo) || codigo.startsWith("CONNECTION_"))
  )
}

// Erro de conexão vira RituError sem a mensagem original; os demais erros passam sem mudança.
export function toDbError<E>(erro: E): E | RituError {
  if (isConnectionError(erro)) {
    return new RituError("banco_indisponivel", "Banco indisponível")
  }
  return erro
}
