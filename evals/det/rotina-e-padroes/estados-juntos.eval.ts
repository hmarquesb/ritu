import { describe, expect, it } from "vitest"
import type { Estado } from "@/core/knowledge/vocab"
import { detectarEstadosJuntos, type MomentoRegistrado } from "@/core/patterns/detectar"

// "Estados que andam juntos": as bordas, os dias (e não os runs), um sentido só por par, e estados de runs diferentes do mesmo dia não contam como juntos.

// Um momento (um run) no dia `n` de outubro, com os estados dados.
function em(n: number, ...estados: Estado[]): MomentoRegistrado {
  return { dia: `2026-10-${String(n).padStart(2, "0")}`, estados }
}

function chaves(momentos: MomentoRegistrado[]): string[] {
  return detectarEstadosJuntos(momentos).map((p) => p.chave)
}

describe("estados juntos: as bordas de ocorrências e de consistência", () => {
  it("3 dias com os dois estados juntos, de 3 dias com o primeiro, vale com ocorrências 3", () => {
    const padroes = detectarEstadosJuntos([
      em(1, "com_frio", "agitada"),
      em(2, "com_frio", "agitada"),
      em(3, "com_frio", "agitada"),
    ])

    expect(padroes).toEqual([
      {
        tipo: "estados_juntos",
        chave: "com_frio>agitada",
        frase: "Quando você está com frio, costuma estar também agitada.",
        ocorrencias: 3,
      },
    ])
  })

  it("2 dias juntos (100%) não valem: o mínimo é 3 ocorrências", () => {
    expect(
      detectarEstadosJuntos([em(1, "com_frio", "agitada"), em(2, "com_frio", "agitada")]),
    ).toEqual([])
  })

  it("3 de 4 dias do primeiro estado (75%, na borda) vale, e o sentido contrário não", () => {
    const padroes = detectarEstadosJuntos([
      em(1, "com_frio", "agitada"),
      em(2, "com_frio", "agitada"),
      em(3, "com_frio", "agitada"),
      em(4, "com_frio"),
      em(5, "agitada"),
      em(6, "agitada"),
    ])

    expect(padroes.map((p) => p.chave)).toEqual(["com_frio>agitada"])
  })

  it("3 de 5 dias (60%) não vale, nos dois sentidos", () => {
    expect(
      chaves([
        em(1, "com_frio", "agitada"),
        em(2, "com_frio", "agitada"),
        em(3, "com_frio", "agitada"),
        em(4, "com_frio"),
        em(5, "com_frio"),
        em(6, "agitada"),
        em(7, "agitada"),
      ]),
    ).toEqual([])
  })
})

describe("estados juntos: conta dias, não runs", () => {
  it("dois runs no mesmo dia contam um dia: 3 dias juntos valem mesmo com runs soltos do primeiro estado", () => {
    const padroes = detectarEstadosJuntos([
      em(1, "com_frio", "agitada"),
      em(1, "com_frio"),
      em(2, "com_frio", "agitada"),
      em(2, "com_frio"),
      em(3, "com_frio", "agitada"),
      em(3, "com_frio"),
    ])

    expect(padroes).toEqual([
      expect.objectContaining({ chave: "com_frio>agitada", ocorrencias: 3 }),
    ])
  })

  it("as ocorrências são dias: o mesmo par em 3 dias dá 3, não o número de runs", () => {
    const padroes = detectarEstadosJuntos([
      em(1, "com_frio", "agitada"),
      em(1, "com_frio"),
      em(1, "agitada"),
      em(2, "com_frio", "agitada"),
      em(3, "com_frio", "agitada"),
    ])

    expect(padroes.map((p) => p.ocorrencias)).toEqual([3])
  })
})

describe("estados juntos: dois sentidos do mesmo par valendo ficam um", () => {
  it("os dois sentidos com 100%: fica um só, o de `a` antes em ESTADOS (com_frio>agitada)", () => {
    const padroes = detectarEstadosJuntos([
      em(1, "com_frio", "agitada"),
      em(2, "com_frio", "agitada"),
      em(3, "com_frio", "agitada"),
    ])

    expect(padroes).toHaveLength(1)
    expect(padroes[0]?.chave).toBe("com_frio>agitada")
  })

  it("com proporções diferentes (100% contra 75%), fica o de maior proporção: agitada>com_frio, e com_frio>agitada não aparece", () => {
    const padroes = detectarEstadosJuntos([
      em(1, "com_frio", "agitada"),
      em(2, "com_frio", "agitada"),
      em(3, "com_frio", "agitada"),
      em(4, "com_frio"),
    ])

    const chavesDoPar = padroes.map((p) => p.chave)
    expect(chavesDoPar).toEqual(["agitada>com_frio"])
    expect(chavesDoPar).not.toContain("com_frio>agitada")
  })
})

describe("estados juntos: estados de runs diferentes do mesmo dia não são juntos", () => {
  it("cada estado sozinho em runs separados de um mesmo dia não forma par", () => {
    expect(
      chaves([
        em(1, "com_frio"),
        em(1, "agitada"),
        em(2, "com_frio"),
        em(2, "agitada"),
        em(3, "com_frio"),
        em(3, "agitada"),
      ]),
    ).toEqual([])
  })
})
