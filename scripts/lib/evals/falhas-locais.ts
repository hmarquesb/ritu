// Arquivo local das falhas do eval com LLM: fora do git, por isso aqui pode ir o texto dos casos (spec 014).
import type { Colhido, ResultadoDoCaso } from "./resultado"

export function cabecalhoDasFalhas(checkpoint: string, data: string): string {
  return `# Falhas do ${checkpoint} (${data})\n\nArquivo local, fora do git.\n`
}

const itensOuNenhum = (linhas: string[]): string[] => (linhas.length === 0 ? ["- nenhum"] : linhas)

function sugestoesDe(colhido: Colhido): string[] {
  const sugestoes = colhido.saida?.sugestoes ?? []
  return itensOuNenhum(
    sugestoes.map(
      (s) => `- ${s.titulo}: ${s.itens.map((item) => item.nome).join(", ")}. Motivo: ${s.motivo}`,
    ),
  )
}

function etapasDe(colhido: Colhido): string[] {
  return itensOuNenhum(
    colhido.etapas.map(
      (etapa, posicao) =>
        `${posicao + 1}. ${etapa.tipo} · ${etapa.nome} · ${etapa.status} · ${etapa.resumo ?? "—"}`,
    ),
  )
}

function checagensFalsasDe(resultado: ResultadoDoCaso): string[] {
  return itensOuNenhum(
    resultado.checagens
      .filter((checagem) => checagem.ok === false)
      .map((checagem) => `- ${checagem.lista}: ${checagem.descricao}`),
  )
}

/** Texto de um caso que falhou. Só as checagens falsas entram. */
export function formatarFalha(resultado: ResultadoDoCaso, colhido: Colhido): string {
  const linhas = [`## ${resultado.id} · ${resultado.titulo}`, ""]
  if (colhido.mensagem !== undefined) linhas.push(`Mensagem: ${colhido.mensagem}`, "")
  linhas.push(`Resposta: ${colhido.texto}`, "")
  linhas.push("Sugestões:", ...sugestoesDe(colhido), "")
  linhas.push("Etapas:", ...etapasDe(colhido), "")
  linhas.push("Checagens falsas:", ...checagensFalsasDe(resultado), "")
  if (resultado.erro !== undefined) linhas.push(`Erro: ${resultado.erro}`, "")
  return `${linhas.join("\n")}\n`
}
