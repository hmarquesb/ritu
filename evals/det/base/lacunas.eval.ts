import { describe, expect, it } from "vitest"
import type { KnowledgeBase } from "@/core/knowledge/knowledge-base"
import { passosDoPreparo, tituloDoPreparo } from "@/core/knowledge/lacunas"
import type { Preparo, Vaga } from "@/core/knowledge/schemas"
import type { Funcao } from "@/core/knowledge/vocab"
import { getContainer } from "@/infra/container"

const kb: KnowledgeBase = getContainer().knowledge

type Item = { alimento_id: string; funcao: Funcao }
type Campo = "titulo" | "passos"

const LACUNA = /\{(\w+)\}/g

// Primeira opção válida de uma vaga: alimento da função (e do grupo, se a vaga pede).
function primeiraOpcao(vaga: Vaga): Item | undefined {
  const opcao = kb.alimentos.find(
    (a) => a.funcoes.includes(vaga.funcao) && (!vaga.grupos || vaga.grupos.includes(a.grupo)),
  )
  return opcao ? { alimento_id: opcao.id, funcao: vaga.funcao } : undefined
}

// Todas as combinações: obrigatórias sempre preenchidas (1ª opção); cada opcional vazia ou preenchida.
function combinacoes(p: Preparo): { rotulo: string; itens: Item[] }[] {
  const obrigatorios = p.vagas.filter((v) => v.obrigatoria)
  const opcionais = p.vagas.filter((v) => !v.obrigatoria)
  const base: Item[] = []
  for (const vaga of obrigatorios) {
    const item = primeiraOpcao(vaga)
    if (item) base.push(item)
  }
  const resultado: { rotulo: string; itens: Item[] }[] = []
  const total = 2 ** opcionais.length
  for (let mascara = 0; mascara < total; mascara++) {
    const itens = [...base]
    const rotulos: string[] = []
    opcionais.forEach((vaga, indice) => {
      if (!(mascara & (1 << indice))) {
        rotulos.push(`${vaga.funcao}=vazia`)
        return
      }
      const item = primeiraOpcao(vaga)
      if (!item) {
        rotulos.push(`${vaga.funcao}=vazia`)
        return
      }
      itens.push(item)
      rotulos.push(`${vaga.funcao}=${kb.alimento(item.alimento_id)?.nome ?? item.alimento_id}`)
    })
    resultado.push({ rotulo: rotulos.join(", ") || "sem vagas opcionais", itens })
  }
  return resultado
}

function frases(texto: string): string[] {
  return texto
    .split(/(?<=\.)/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0)
}

// Regra sobre o modelo (C1): em passos, frase com lacuna opcional tem exatamente uma lacuna;
// em titulo, cada lacuna opcional vem precedida por " com ", " de ", " e " ou ", " e seguida por " e ", ", ", "." ou fim.
function violacoesDoModelo(p: Preparo, campo: Campo, modelo: string): string[] {
  const opcionais = new Set<string>(p.vagas.filter((v) => !v.obrigatoria).map((v) => v.funcao))
  const achados: string[] = []
  if (campo === "passos") {
    for (const frase of frases(modelo)) {
      const lacunas = [...frase.matchAll(LACUNA)].map((m) => m[1] ?? "")
      const temOpcional = lacunas.some((f) => opcionais.has(f))
      if (temOpcional && lacunas.length !== 1) {
        achados.push(
          `${p.id} · passos · modelo: frase com lacuna opcional e ${lacunas.length} lacunas · trecho: "${frase}"`,
        )
      }
    }
    return achados
  }
  for (const m of modelo.matchAll(LACUNA)) {
    const funcao = m[1] ?? ""
    if (!opcionais.has(funcao)) continue
    const i = m.index ?? 0
    const antes = modelo.slice(0, i)
    const depois = modelo.slice(i + m[0].length)
    const precedida = /(?: com | de | e |, )$/.test(antes)
    const seguida = /^(?: e |, |\.|$)/.test(depois)
    if (!(precedida && seguida)) {
      achados.push(`${p.id} · titulo · modelo: lacuna {${funcao}} · trecho: "${modelo}"`)
    }
  }
  return achados
}

// Padrões do texto gerado (C1), em todas as combinações.
const PADROES_TEXTO: { nome: string; re: RegExp }[] = [
  { nome: "lacuna sobrando", re: /[{}]/ },
  { nome: "espaço duplo", re: / {2}/ },
  { nome: "' .'", re: / \./ },
  { nome: "',.'", re: /,\./ },
  { nome: "', .'", re: /, \./ },
  { nome: "' ,'", re: / ,/ },
  { nome: "', ,'", re: /, ,/ },
  { nome: "' e.'", re: / e\./ },
  { nome: "' com.'", re: / com\./ },
  { nome: "' de.'", re: / de\./ },
]
// "Deixar" + infinitivo é construção correta ("Deixar amornar"), por isso não conta.
const DOIS_VERBOS = /^\s*(?!deixar\s)[\p{L}]+(?:ar|er|ir)\s+[\p{L}]+(?:ar|er|ir)\b/iu

function problemasDoTexto(texto: string): string[] {
  const achados: string[] = []
  for (const { nome, re } of PADROES_TEXTO) {
    if (re.test(texto)) achados.push(nome)
  }
  for (const frase of frases(texto)) {
    if (DOIS_VERBOS.test(frase)) achados.push(`dois verbos colados no início: "${frase}"`)
  }
  return achados
}

describe("lacunas da base real", () => {
  for (const p of kb.preparos) {
    it(`${p.id}: regra sobre o modelo (titulo e passos)`, () => {
      expect([
        ...violacoesDoModelo(p, "titulo", p.titulo),
        ...violacoesDoModelo(p, "passos", p.passos),
      ]).toEqual([])
    })

    it(`${p.id}: texto gerado em todas as combinações de vagas opcionais`, () => {
      const achados: string[] = []
      for (const { rotulo, itens } of combinacoes(p)) {
        for (const [campo, texto] of [
          ["titulo", tituloDoPreparo(p, itens, kb)],
          ["passos", passosDoPreparo(p, itens, kb)],
        ] as const) {
          for (const problema of problemasDoTexto(texto)) {
            achados.push(`${p.id} · ${campo} · texto gerado [${rotulo}] · ${problema} · "${texto}"`)
          }
        }
      }
      expect(achados).toEqual([])
    })
  }
})
