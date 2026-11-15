import { normalizar } from "@/core/knowledge/identificar"
import type { Guna } from "@/core/knowledge/vocab"
import type { Expectativa, ResultadoDoRun } from "./tipos"

// Texto da resposta e das sugestões, normalizado, para conferir palavras-chave.
export function textoDoRun(r: ResultadoDoRun): string {
  const partes = [r.saida.resposta]
  for (const s of r.saida.sugestoes) partes.push(s.titulo, s.motivo, s.como_fazer)
  return normalizar(partes.join(" "))
}

export const temAlgumaPalavra = (r: ResultadoDoRun, palavras: string[]): boolean => {
  const texto = textoDoRun(r)
  return palavras.some((p) => texto.includes(normalizar(p)))
}

export const comPalavras = (descricao: string, palavras: string[]): Expectativa => ({
  descricao,
  confere: (r) => temAlgumaPalavra(r, palavras),
})

export const semPalavras = (descricao: string, palavras: string[]): Expectativa => ({
  descricao,
  confere: (r) => !temAlgumaPalavra(r, palavras),
})

export const alimentosDasSugestoes = (r: ResultadoDoRun): string[] =>
  r.saida.sugestoes.flatMap((s) => s.itens.map((i) => i.alimento_id))

export const idsDasSugestoes = (r: ResultadoDoRun): string[] =>
  r.saida.sugestoes.flatMap((s) => [s.pratica_id, s.preparo_id].filter((x): x is string => !!x))

export const trazGuna = (descricao: string, gunas: Guna[]): Expectativa => ({
  descricao,
  confere: (r) =>
    r.saida.sugestoes.some((s) =>
      s.itens.some((i) => i.contribui.some((g) => gunas.includes(g))),
    ) || r.saida.explicacao.qualidades_buscadas.some((g) => gunas.includes(g)),
})

export const usaItemDaCasa = (ids: string[]): Expectativa => ({
  descricao: "Usa item da casa",
  confere: (r) => alimentosDasSugestoes(r).some((a) => ids.includes(a)),
})

export const semAlimentos = (descricao: string, ids: string[]): Expectativa => ({
  descricao,
  confere: (r) => !alimentosDasSugestoes(r).some((a) => ids.includes(a)),
})

export const temAviso = (tipo: "geral" | "incomodo"): Expectativa => ({
  descricao: `Aviso ${tipo}`,
  confere: (r) => r.saida.avisos.some((a) => a.tipo === tipo),
})

export const temSugestao: Expectativa = {
  descricao: "Traz ao menos uma sugestão",
  confere: (r) => r.saida.sugestoes.length > 0,
}

export const semSugestaoDeRefeicao: Expectativa = {
  descricao: "Não sugere refeição",
  confere: (r) => !r.saida.sugestoes.some((s) => s.tipo === "refeicao"),
}

export const citou = (linha: string): Expectativa => ({
  descricao: `citados inclui ${linha}`,
  confere: (r) => r.saida.citados.includes(linha),
})
