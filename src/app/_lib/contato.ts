import { contatoDePrivacidade } from "@/core/publico/contato"

/** E-mail de contato de privacidade da implantação, ou null quando falta ou é inválido. */
export function contatoDaImplantacao(): string | null {
  return contatoDePrivacidade(process.env.CONTATO_PRIVACIDADE)
}
