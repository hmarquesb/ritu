export type TipoDeConta = "google" | "demo"
export type LoginDaConta = { contaId: string; tipo: TipoDeConta }

type Token = Record<string, unknown>

// No login o token guarda só a conta; nome, e-mail e foto nunca ficam na sessão.
export function montarToken(token: Token, login: LoginDaConta | undefined): Token {
  if (!login) return token
  const { name: _name, email: _email, picture: _picture, ...resto } = token
  return { ...resto, contaId: login.contaId, tipo: login.tipo }
}

export function montarSessao(
  sessao: { expires: string },
  token: Token,
): { expires: string; contaId: unknown; tipo: unknown } {
  return { expires: sessao.expires, contaId: token.contaId, tipo: token.tipo }
}
