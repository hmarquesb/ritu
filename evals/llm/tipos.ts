export const FAMILIAS = [
  "intencao",
  "conteudo",
  "fidelidade",
  "explicacao",
  "trajetoria",
  "autocorrecao",
  "perguntas",
  "casa",
  "propostas",
  "para_ter",
  "aprendizado",
  "memoria",
  "conversa",
  "seguranca",
  "linguagem",
  "incomodos",
  "juiz",
  "custo",
] as const

export const FAMILIAS_TRANSVERSAIS = ["trajetoria", "autocorrecao", "custo"] as const

export type Familia = (typeof FAMILIAS)[number]
export type FamiliaMarcada = Exclude<Familia, (typeof FAMILIAS_TRANSVERSAIS)[number]>

export const FAMILIAS_MARCADAS: readonly FamiliaMarcada[] = FAMILIAS.filter(
  (familia): familia is FamiliaMarcada =>
    !(FAMILIAS_TRANSVERSAIS as readonly string[]).includes(familia),
)

export const MARCAS = [
  "pergunta_necessaria",
  "pergunta_desnecessaria",
  "pergunta_simples",
  "alerta_devido",
  "falso_alerta",
  "injection",
  "promessa",
  "falsa_reprovacao",
] as const

export type Marca = (typeof MARCAS)[number]

/** Pergunta de sim ou não ao avaliador, com o valor esperado. */
export type Criterio = { descricao: string; pergunta: string; esperado: boolean }

export type TipoDeCaso = "acompanhante" | "interprete" | "conversa" | "memoria" | "juiz"

export type BaseDoCaso = {
  id: string
  titulo: string
  tipo: TipoDeCaso
  familias: FamiliaMarcada[]
  marcas?: Marca[]
  criterios?: Criterio[]
}

export const TITULO_DA_FAMILIA: Record<Familia, string> = {
  intencao: "Intenção",
  conteudo: "Conteúdo",
  fidelidade: "Fidelidade",
  explicacao: "Explicação",
  trajetoria: "Trajetória",
  autocorrecao: "Autocorreção",
  perguntas: "Perguntas",
  casa: "Casa",
  propostas: "Propostas",
  para_ter: "Para ter em casa",
  aprendizado: "Aprendizado",
  memoria: "Memória",
  conversa: "Conversa",
  seguranca: "Segurança",
  linguagem: "Linguagem e sofrimento",
  incomodos: "Incômodos",
  juiz: "Juiz",
  custo: "Custo",
}
