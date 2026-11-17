import { config } from "@config/index"
import type { TipoDeEtapa } from "@/core/runs/ports"

export type FraseDeEtapa = { chave: string; texto: string }

type EtapaParaFrase = { tipo: TipoDeEtapa; nome: string }

type ChaveDeFrase = keyof typeof config.textosConversa.etapas

// Tools de leitura e de base pela forma do nome; as demais tools e os outros tipos vêm da tabela direta.
const TIPO_PARA_CHAVE: Partial<Record<TipoDeEtapa, ChaveDeFrase>> = {
  interprete: "entendendo",
  guardrail: "cuidado",
  validacao: "conferindo",
  juiz: "revisando",
  memoria: "memoria",
}

const TOOL_PARA_CHAVE: Record<string, ChaveDeFrase> = {
  "casa.ler": "casa",
  "preferencias.ler": "lembrando",
  "historico.recente": "lembrando",
  "resultado.registrar": "retorno",
}

const PREFIXO_DE_TOOL_PARA_CHAVE: [prefixo: string, chave: ChaveDeFrase][] = [
  ["clima.", "clima"],
  ["ayurveda.", "base"],
]

function chaveDaTool(nome: string): ChaveDeFrase | undefined {
  const exata = TOOL_PARA_CHAVE[nome]
  if (exata) return exata
  return PREFIXO_DE_TOOL_PARA_CHAVE.find(([prefixo]) => nome.startsWith(prefixo))?.[1]
}

function chaveDaEtapa(etapa: EtapaParaFrase): ChaveDeFrase | undefined {
  if (etapa.tipo === "tool") return chaveDaTool(etapa.nome)
  return TIPO_PARA_CHAVE[etapa.tipo]
}

export function fraseDaEtapa(etapa: EtapaParaFrase): FraseDeEtapa | undefined {
  const chave = chaveDaEtapa(etapa)
  if (!chave) return undefined
  return { chave, texto: config.textosConversa.etapas[chave] }
}

export function frasesDoRun(etapas: EtapaParaFrase[]): FraseDeEtapa[] {
  const frases: FraseDeEtapa[] = []
  for (const etapa of etapas) {
    const frase = fraseDaEtapa(etapa)
    if (!frase) continue
    if (frases.at(-1)?.chave === frase.chave) continue
    frases.push(frase)
  }
  return frases
}
