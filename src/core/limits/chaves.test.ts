import { config } from "@config/index"
import { describe, expect, it } from "vitest"
import type { Conta } from "@/core/accounts/types"
import { chavesDeMensagem, chavesDeToque, segundosAte } from "./chaves"
import type { ContaDoLimite } from "./estado"

const AGORA = new Date("2026-01-15T15:00:00Z") // 12h em São Paulo

function conta(extra: Partial<Conta> = {}): Conta {
  return {
    id: "c1",
    tipo: "google",
    google_sub: "sub",
    email: "a@b.c",
    expira_em: null,
    tester: false,
    aviso_aceito_em: null,
    evitar_passo: null,
    evitar_lembrete_em: null,
    dosha_adiado_em: null,
    criado_em: "2026-01-10T12:00:00Z",
    ...extra,
  }
}

describe("ContaDoLimite", () => {
  it("uma Conta real é atribuível ao tipo estrutural dos limites", () => {
    const deLimite: ContaDoLimite = conta()
    expect(deLimite.id).toBe("c1")
  })
})

describe("chavesDeMensagem", () => {
  it("conta Google: chave da conta no dia de hoje e chave do IP", () => {
    const r = chavesDeMensagem(conta(), "hash1", AGORA)
    expect(r.conta).toEqual({
      chave: "msg:conta:c1",
      teto: config.limites.mensagens.googlePorDia,
      inicio: "2026-01-15",
    })
    expect(r.ip).toEqual({
      chave: "msg:ip:hash1",
      teto: config.limites.mensagens.porIpPorDia,
      inicio: "2026-01-15",
    })
  })

  it("com escopo, todas as chaves ganham o prefixo", () => {
    const r = chavesDeMensagem(conta(), "hash1", AGORA, "e2e")
    expect(r.conta.chave).toBe("e2e:msg:conta:c1")
    expect(r.ip.chave).toBe("e2e:msg:ip:hash1")
  })

  it("demo usa o dia da criação, mesmo quando a criação foi às 23h50 do dia anterior", () => {
    // 2026-01-15T02:50Z é 23h50 de 14/01 em São Paulo.
    const demo = conta({ id: "d1", tipo: "demo", criado_em: "2026-01-15T02:50:00Z" })
    const r = chavesDeMensagem(demo, "hash1", AGORA)
    expect(r.conta).toEqual({
      chave: "msg:demo:d1",
      teto: config.limites.mensagens.demoPorConta,
      inicio: "2026-01-14",
    })
  })

  it("teto substitui o de conta e o do IP", () => {
    const r = chavesDeMensagem(conta(), "hash1", AGORA, undefined, 2)
    expect(r.conta.teto).toBe(2)
    expect(r.ip.teto).toBe(2)
  })
})

describe("chavesDeToque", () => {
  it("minuto, dia e IP com as janelas e os tetos de config", () => {
    const r = chavesDeToque(conta(), "hash1", AGORA)
    expect(r.minuto).toEqual({
      chave: "toque:conta:c1",
      teto: 60,
      inicio: "2026-01-15T15:00:00.000Z",
    })
    expect(r.dia).toEqual({ chave: "toque:conta:c1", teto: 300, inicio: "2026-01-15" })
    expect(r.ip).toEqual({ chave: "toque:ip:hash1", teto: 1500, inicio: "2026-01-15" })
  })

  it("com escopo, o prefixo entra em todas as chaves", () => {
    const r = chavesDeToque(conta(), "hash1", AGORA, "e2e")
    expect(r.minuto.chave).toBe("e2e:toque:conta:c1")
    expect(r.dia.chave).toBe("e2e:toque:conta:c1")
    expect(r.ip.chave).toBe("e2e:toque:ip:hash1")
  })

  it("teto substitui os três tetos", () => {
    const r = chavesDeToque(conta(), "hash1", AGORA, undefined, 3)
    expect([r.minuto.teto, r.dia.teto, r.ip.teto]).toEqual([3, 3, 3])
  })
})

describe("segundosAte", () => {
  it("arredonda para cima", () => {
    const agora = new Date("2026-01-15T15:00:00.500Z")
    expect(segundosAte(agora, new Date("2026-01-15T15:00:01.000Z"))).toBe(1)
    expect(segundosAte(agora, new Date("2026-01-15T15:00:03.001Z"))).toBe(3)
  })

  it("nunca dá zero, nem para um instante passado", () => {
    const agora = new Date("2026-01-15T15:00:00.000Z")
    expect(segundosAte(agora, agora)).toBe(1)
    expect(segundosAte(agora, new Date("2026-01-15T14:00:00.000Z"))).toBe(1)
  })
})
