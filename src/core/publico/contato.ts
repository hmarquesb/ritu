import { z } from "zod"

/**
 * E-mail de contato de privacidade (CONTATO_PRIVACIDADE), aparado. Vazio, ausente
 * ou inválido vira null. Não loga o valor.
 */
export function contatoDePrivacidade(valor: string | undefined): string | null {
  const aparado = valor?.trim() ?? ""
  if (aparado === "") return null
  const resultado = z.email().safeParse(aparado)
  return resultado.success ? resultado.data : null
}
