import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  contaAtual: vi.fn(),
  signOut: vi.fn(),
  apagarConta: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock("next/navigation", () => ({ redirect: m.redirect }))
vi.mock("@/app/_lib/conta", () => ({ contaAtual: m.contaAtual }))
vi.mock("@/infra/auth/next", () => ({
  codigoDoErroDeEntrada: vi.fn(),
  signIn: vi.fn(),
  signOut: m.signOut,
}))
vi.mock("@/infra/container", () => ({
  getContainer: () => ({ accounts: { apagarConta: m.apagarConta } }),
}))

import { apagarMeusDados } from "./sessao"

describe("apagarMeusDados", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT")
    })
  })

  it("sem conta, volta à Entrada sem apagar", async () => {
    m.contaAtual.mockResolvedValue(undefined)
    await expect(apagarMeusDados()).rejects.toThrow("NEXT_REDIRECT")
    expect(m.redirect).toHaveBeenCalledWith("/")
    expect(m.apagarConta).not.toHaveBeenCalled()
    expect(m.signOut).not.toHaveBeenCalled()
  })

  it("com conta, apaga e encerra a sessão com o aviso", async () => {
    const conta = { id: "c1" }
    m.contaAtual.mockResolvedValue({ conta, perfil: {} })
    await apagarMeusDados()
    expect(m.apagarConta).toHaveBeenCalledWith(conta)
    expect(m.signOut).toHaveBeenCalledWith({ redirectTo: "/?aviso=dados_apagados" })
  })

  it("falha ao apagar: a sessão continua e o erro sobe", async () => {
    m.contaAtual.mockResolvedValue({ conta: { id: "c1" }, perfil: {} })
    m.apagarConta.mockRejectedValue(new Error("banco"))
    await expect(apagarMeusDados()).rejects.toThrow("banco")
    expect(m.signOut).not.toHaveBeenCalled()
  })
})
