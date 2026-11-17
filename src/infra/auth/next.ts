import { config } from "@config/index"
import NextAuth, { AuthError, CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import {
  criarDemonstracao,
  entrarComGoogle,
  LimiteDeDemonstracaoError,
} from "@/core/accounts/entrar"
import { getContainer } from "@/infra/container"
import { optionalEnv, requireEnv } from "@/infra/env"
import { type LoginDaConta, montarSessao, montarToken, type TipoDeConta } from "./callbacks"
import { hashDoIp, ipDoPedido } from "./ip"

export function googleDisponivel(): boolean {
  return (
    optionalEnv("AUTH_GOOGLE_ID") !== undefined && optionalEnv("AUTH_GOOGLE_SECRET") !== undefined
  )
}

type UsuarioDaConta = { id: string } & LoginDaConta

function erroDeLimite(codigo: string): CredentialsSignin {
  const erro = new CredentialsSignin()
  erro.code = codigo
  return erro
}

async function autorizarDemonstracao(request: Request): Promise<UsuarioDaConta> {
  const container = getContainer()
  const modoE2e = optionalEnv("RITU_MODO") === "e2e"
  const ipHash = hashDoIp(ipDoPedido(request.headers, modoE2e), requireEnv("IP_HMAC_SECRET"))
  const escopo = modoE2e ? (request.headers.get("x-ritu-e2e") ?? undefined) : undefined
  const semSeed = modoE2e && request.headers.get("x-ritu-e2e-conta") === "nova"
  try {
    const conta = await criarDemonstracao(
      {
        tx: container.tx,
        limiter: container.limiter,
        clock: container.clock,
        kb: container.knowledge,
        seed: container.demoSeed,
        telemetry: container.telemetry,
      },
      {
        ipHash,
        ...(escopo ? { escopo } : {}),
        semSeed,
      },
    )
    return { id: conta.id, contaId: conta.id, tipo: "demo" }
  } catch (erro) {
    if (erro instanceof LimiteDeDemonstracaoError) throw erroDeLimite(erro.code)
    throw erro
  }
}

function providers() {
  const lista = [
    Credentials({
      id: "demo",
      credentials: {},
      authorize: async (_credenciais, request) => autorizarDemonstracao(request),
    }),
  ]
  if (googleDisponivel()) {
    lista.push(
      Google({
        clientId: requireEnv("AUTH_GOOGLE_ID"),
        clientSecret: requireEnv("AUTH_GOOGLE_SECRET"),
        authorization: { params: { scope: "openid email" } },
      }) as never,
    )
  }
  return lista
}

type PerfilGoogle = { sub?: string; email?: string | null; email_verified?: boolean }

function perfilValido(perfil: PerfilGoogle | undefined): perfil is { sub: string; email: string } {
  return Boolean(perfil?.sub && perfil.email && perfil.email_verified !== false)
}

async function loginDoJwt(
  user: unknown,
  account: { provider: string } | null | undefined,
  profile: PerfilGoogle | undefined,
): Promise<LoginDaConta | undefined> {
  if (account?.provider === "google") {
    if (!perfilValido(profile)) return undefined
    const conta = await entrarComGoogle(getContainer(), { sub: profile.sub, email: profile.email })
    return { contaId: conta.id, tipo: conta.tipo }
  }
  const usuario = user as Partial<UsuarioDaConta> | undefined
  if (usuario?.contaId && usuario.tipo) return { contaId: usuario.contaId, tipo: usuario.tipo }
  return undefined
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: providers(),
  session: { strategy: "jwt", maxAge: config.limites.sessao.dias * 86400 },
  trustHost: true,
  pages: { signIn: "/", error: "/" },
  secret: requireEnv("AUTH_SECRET"),
  callbacks: {
    signIn({ account, profile }) {
      if (account?.provider !== "google") return true
      return perfilValido(profile as PerfilGoogle | undefined)
    },
    async jwt({ token, user, account, profile }) {
      const login = await loginDoJwt(user, account, profile as PerfilGoogle | undefined)
      return montarToken(token, login) as typeof token
    },
    session({ session, token }) {
      return montarSessao(session, token) as unknown as typeof session
    },
  },
}))

// Código do erro de entrada: o do limite de demonstração ou "erro_demo"; undefined se não for erro do Auth.js.
export function codigoDoErroDeEntrada(erro: unknown): string | undefined {
  if (!(erro instanceof AuthError)) return undefined
  const alvo = erro.cause?.err ?? erro
  return alvo instanceof CredentialsSignin ? alvo.code : "erro_demo"
}

export type { TipoDeConta }
