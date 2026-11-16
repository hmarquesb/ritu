// Texto da pergunta para o terminal e leitura da resposta digitada. Funções puras: o script só lê as linhas.

import type { PropostaNaSaida } from "@/core/proposals/conteudo"
import { textosDasPropostas } from "@/core/proposals/textos"
import type { Pergunta, RespostaDaPessoa, RespostaDeCasa } from "@/core/runs/pergunta"

const LETRAS_DE_CASA: Record<string, RespostaDeCasa> = {
  t: "tenho",
  n: "nao_tenho",
  g: "nao_gosto",
}

// Uma linha por item de casa; come e variante usam a primeira linha.
export function formatarPergunta(p: Pergunta): string {
  if (p.tipo === "casa") {
    const itens = p.itens.map(
      (item, i) =>
        `  ${i + 1}. ${item.nome}  [t] Tenho  [n] Não tenho  [g] Não gosto  [Enter] Pular`,
    )
    return [p.texto, ...itens].join("\n")
  }
  if (p.tipo === "come") {
    return [p.texto, "  1. Como  2. Não como  [Enter] Pular"].join("\n")
  }
  const opcoes = p.opcoes.map((opcao, i) => `  ${i + 1}. ${opcao.texto}`)
  return [p.texto, ...opcoes, "  [Enter] Pular"].join("\n")
}

function itemDeCasa(
  alimento_id: string,
  linha: string,
): { alimento_id: string; resposta: RespostaDeCasa } | undefined {
  const resposta = LETRAS_DE_CASA[linha.trim().toLowerCase()]
  return resposta ? { alimento_id, resposta } : undefined
}

// Número da opção (1 é a primeira); vazio, fora da faixa ou sem número vira undefined.
function numeroEscolhido(linha: string, quantidade: number): number | undefined {
  const numero = Number.parseInt(linha.trim(), 10)
  return Number.isInteger(numero) && numero >= 1 && numero <= quantidade ? numero : undefined
}

function respostaDeCasaDoTexto(
  p: Extract<Pergunta, { tipo: "casa" }>,
  linhas: string[],
): RespostaDaPessoa {
  const itens = p.itens.flatMap((item, i) => {
    const marcado = itemDeCasa(item.alimento_id, linhas[i] ?? "")
    return marcado ? [marcado] : []
  })
  return { tipo: "casa", itens }
}

function respostaDeComeDoTexto(linha: string): RespostaDaPessoa {
  const numero = numeroEscolhido(linha, 2)
  if (numero === 1) return { tipo: "come", resposta: "como" }
  if (numero === 2) return { tipo: "come", resposta: "nao_como" }
  return { tipo: "pular" }
}

function respostaDeVarianteDoTexto(
  p: Extract<Pergunta, { tipo: "variante" }>,
  linha: string,
): RespostaDaPessoa {
  const numero = numeroEscolhido(linha, p.opcoes.length)
  const opcao = numero === undefined ? undefined : p.opcoes[numero - 1]
  return opcao ? { tipo: "variante", variante: opcao.id } : { tipo: "pular" }
}

// casa: uma linha por item (t, n, g; vazio ou outra letra pula o item). come e variante: uma linha com o número.
export function respostaDoTexto(p: Pergunta, linhas: string[]): RespostaDaPessoa {
  if (p.tipo === "casa") return respostaDeCasaDoTexto(p, linhas)
  if (p.tipo === "come") return respostaDeComeDoTexto(linhas[0] ?? "")
  return respostaDeVarianteDoTexto(p, linhas[0] ?? "")
}

// Bloco de aprovação como o terminal mostra: cabeçalho, uma linha marcada por proposta e os dois botões.
export function formatarBloco(propostas: PropostaNaSaida[]): string {
  const linhas = propostas.map((p, i) => `  ${i + 1}. [x] ${p.texto}`)
  const botoes = `[${textosDasPropostas.agoraNao}] [${textosDasPropostas.anotar}]`
  return [textosDasPropostas.cabecalho, ...linhas, botoes].join("\n")
}

// Ids aprovados: Enter anota tudo; números separados por vírgula desligam essas linhas; n é Agora não;
// número fora da faixa não desliga nada.
export function aprovadasDoTexto(propostas: PropostaNaSaida[], linha: string): string[] {
  const texto = linha.trim()
  if (texto === "") return propostas.map((p) => p.id)
  if (texto.toLowerCase() === "n") return []
  const desligadas = new Set(
    texto.split(",").flatMap((parte) => {
      const numero = numeroEscolhido(parte, propostas.length)
      return numero === undefined ? [] : [numero]
    }),
  )
  return propostas.filter((_, i) => !desligadas.has(i + 1)).map((p) => p.id)
}
