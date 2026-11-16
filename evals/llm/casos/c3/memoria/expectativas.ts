import { config } from "@config/index"
import { normalizar } from "@/core/knowledge/identificar"
import { createContainer } from "@/infra/container"
import type { ExpectativaDaConversa } from "../../c2/tipos"
import type { ExpectativaDaMemoria, NotaDoCaso } from "../tipos"

// Base real, lida só quando uma expectativa precisa de um id da base (criar o container não lê data/).
const containerDoEval = createContainer()

type EntradaDaMemoria = Parameters<ExpectativaDaMemoria["confere"]>[0]
type EntradaDaConversa = Parameters<ExpectativaDaConversa["confere"]>[0]

const expMemoria = (
  descricao: string,
  confere: (r: EntradaDaMemoria) => boolean,
): ExpectativaDaMemoria => ({ descricao, confere })

const expConversa = (
  descricao: string,
  confere: (r: EntradaDaConversa) => boolean,
): ExpectativaDaConversa => ({ descricao, confere })

const textoDoResumo = (r: EntradaDaMemoria): string => normalizar(r.resumo.texto)

// Palavra da nota que nenhuma outra nota do caso tem: é a marca que o resumo deveria trazer.
function marcaDaNota(nota: NotaDoCaso, notas: NotaDoCaso[]): string | undefined {
  const outras = new Set(
    notas.filter((n) => n !== nota).flatMap((n) => normalizar(n.texto).split(" ")),
  )
  return normalizar(nota.texto)
    .split(" ")
    .find((t) => t.length >= 4 && !outras.has(t))
}

export const resumoFala = (palavra: string): ExpectativaDaMemoria =>
  expMemoria(`o resumo fala de "${palavra}"`, (r) => textoDoResumo(r).includes(normalizar(palavra)))

export const resumoNaoFala = (palavra: string): ExpectativaDaMemoria =>
  expMemoria(
    `o resumo não fala de "${palavra}"`,
    (r) => !textoDoResumo(r).includes(normalizar(palavra)),
  )

export const resumoNaoVazio = (): ExpectativaDaMemoria =>
  expMemoria("o resumo tem texto", (r) => r.resumo.texto.trim().length > 0)

export const ateTeto = (): ExpectativaDaMemoria =>
  expMemoria(
    `o resumo tem até ${config.memoria.resumoRotinaCaracteres} caracteres`,
    (r) => r.resumo.texto.length <= config.memoria.resumoRotinaCaracteres,
  )

// As n notas mais recentes (menor diasAtras) têm a marca no resumo.
export const trazAsMaisRecentes = (n: number): ExpectativaDaMemoria =>
  expMemoria(`traz as ${n} notas mais recentes`, (r) => {
    const maisRecentes = [...r.notas].sort((a, b) => a.diasAtras - b.diasAtras).slice(0, n)
    return maisRecentes.every((nota) => {
      const marca = marcaDaNota(nota, r.notas)
      return marca !== undefined && textoDoResumo(r).includes(marca)
    })
  })

// Só uma frase do resumo traz a palavra.
export const umaFraseSobre = (palavra: string): ExpectativaDaMemoria =>
  expMemoria(`uma frase só sobre "${palavra}"`, (r) => {
    const p = normalizar(palavra)
    const frases = r.resumo.texto.split(/[.!?]+/).filter((f) => normalizar(f).includes(p))
    return frases.length === 1
  })

export const origem = (o: EntradaDaMemoria["resumo"]["origem"]): ExpectativaDaMemoria =>
  expMemoria(`origem do resumo: ${o}`, (r) => r.resumo.origem === o)

export const semRefeicao = (): ExpectativaDaConversa =>
  expConversa("nenhuma sugestão de refeição", (r) =>
    r.resultado.saida.sugestoes.every((s) => s.tipo !== "refeicao"),
  )

export const sugere = (praticaId: string): ExpectativaDaConversa =>
  expConversa(`sugere a prática ${praticaId}`, (r) =>
    r.resultado.saida.sugestoes.some((s) => s.pratica_id === praticaId),
  )

export const naoSugere = (praticaId: string): ExpectativaDaConversa =>
  expConversa(`não sugere a prática ${praticaId}`, (r) =>
    r.resultado.saida.sugestoes.every((s) => s.pratica_id !== praticaId),
  )

// Proxy dos candidatos: o resultado do run não traz a lista de candidatos, então a expectativa confere que
// nenhuma sugestão aponta para um id fora da base (prática, preparo ou alimento). O caso de candidatos é
// coberto por montarCenario em expectativas.test.ts.
export const soDosCandidatos = (): ExpectativaDaConversa =>
  expConversa("nenhuma sugestão com id fora da base", (r) =>
    r.resultado.saida.sugestoes.every(
      (s) =>
        (s.pratica_id === undefined ||
          containerDoEval.knowledge.pratica(s.pratica_id) !== undefined) &&
        (s.preparo_id === undefined ||
          containerDoEval.knowledge.preparo(s.preparo_id) !== undefined) &&
        s.itens.every((i) => containerDoEval.knowledge.alimento(i.alimento_id) !== undefined),
    ),
  )
