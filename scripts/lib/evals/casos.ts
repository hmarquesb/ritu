// Casos do eval com LLM: listagem por família, estimativa de chamadas e o despacho de cada caso com o avaliador.
// Sem container: as dependências entram por parâmetro.
import { evals } from "../../../config/evals"
import {
  type CasoC1,
  type CasoConversa,
  type CasoDeEval,
  type CasoInterprete,
  type CasoJuiz,
  type CasoMemoria,
  casosDoCheckpoint,
  type NomeDoCheckpoint,
} from "../../../evals/llm/casos"
import { checkpoints } from "../../../evals/llm/checkpoints"
import { FAMILIAS_MARCADAS, TITULO_DA_FAMILIA, type TipoDeCaso } from "../../../evals/llm/tipos"
import { aplicarAvaliacao, avaliar, type DepsDoAvaliador, montarPerguntas } from "./avaliador"
import { calcularAcertou, type ResultadoDoCaso } from "./resultado"
import type { CasoRodado } from "./rodar-run"

const TIPOS_DE_CASO: TipoDeCaso[] = ["acompanhante", "interprete", "conversa", "memoria", "juiz"]

const FAMILIAS_DO_ACOMPANHANTE: readonly string[] = ["explicacao", "fidelidade"]

const tipoDoCaso = (caso: CasoDeEval): TipoDeCaso => caso.tipo ?? "acompanhante"

export const ehCheckpoint = (nome: string): nome is NomeDoCheckpoint =>
  Object.keys(checkpoints).includes(nome)

export const nomesDeCheckpoint = (): string[] => Object.keys(checkpoints)

function temFamiliaDeAcompanhante(caso: CasoDeEval): boolean {
  const familias: readonly string[] = caso.familias
  return familias.some((familia) => FAMILIAS_DO_ACOMPANHANTE.includes(familia))
}

/** O caso tem pergunta para o avaliador: explicação ou fidelidade, ou algum critério. */
export function temPerguntaDoAvaliador(caso: CasoDeEval): boolean {
  return temFamiliaDeAcompanhante(caso) || (caso.criterios?.length ?? 0) > 0
}

export function chamadasEstimadasDoCaso(caso: CasoDeEval): number {
  return (
    evals.chamadasEstimadas[tipoDoCaso(caso)] +
    (temPerguntaDoAvaliador(caso) ? evals.chamadasEstimadas.avaliador : 0)
  )
}

/** Título, uma seção por família marcada com caso, contagem por tipo e chamadas estimadas. */
export function formatarListagem(checkpoint: NomeDoCheckpoint): string {
  const casos = casosDoCheckpoint(checkpoint)
  const secoes = FAMILIAS_MARCADAS.flatMap((familia) => {
    const dela = casos.filter((c) => c.familias.includes(familia))
    if (dela.length === 0) return []
    const linhas = dela.map((c) => `${c.id}  ${tipoDoCaso(c)}  ${c.titulo}`)
    return [`## ${TITULO_DA_FAMILIA[familia]} (${dela.length})\n${linhas.join("\n")}`]
  })
  const porTipo = [
    "Por tipo:",
    ...TIPOS_DE_CASO.map(
      (tipo) => `${tipo}: ${casos.filter((c) => tipoDoCaso(c) === tipo).length}`,
    ),
  ].join("\n")
  const soma = casos.reduce((total, c) => total + chamadasEstimadasDoCaso(c), 0)
  return [
    `Casos do ${checkpoint}: ${casos.length}`,
    ...secoes,
    porTipo,
    `Chamadas estimadas: ${soma}`,
  ].join("\n\n")
}

export type Rodadores = {
  acompanhante: (caso: CasoC1) => Promise<CasoRodado>
  interprete: (caso: CasoInterprete) => Promise<CasoRodado>
  conversa: (caso: CasoConversa) => Promise<CasoRodado>
  memoria: (caso: CasoMemoria) => Promise<CasoRodado>
  juiz: (caso: CasoJuiz) => Promise<CasoRodado>
}

export function despachar(caso: CasoDeEval, r: Rodadores): Promise<CasoRodado> {
  switch (caso.tipo) {
    case "interprete":
      return r.interprete(caso)
    case "conversa":
      return r.conversa(caso)
    case "memoria":
      return r.memoria(caso)
    case "juiz":
      return r.juiz(caso)
    default:
      return r.acompanhante(caso)
  }
}

const DESCRICAO_SEM_SAIDA = "O Acompanhante respondeu pelo agente"

/**
 * Caso da família do acompanhante sem saída do agente (saída segura, sem modelo ou de código): conta como
 * errado, sem o avaliador. As perguntas fixas de explicação e fidelidade ficam `false`; os critérios, `null`.
 */
function semSaidaDoAgente(caso: CasoDeEval, rodado: CasoRodado): CasoRodado {
  const familias: readonly string[] = caso.familias
  const perguntas = montarPerguntas(caso, rodado.colhido.saida)
  const base = aplicarAvaliacao(rodado.resultado, perguntas, { naoAvaliado: true })
  const resultado: ResultadoDoCaso = {
    ...base,
    checagens: [...base.checagens, { lista: "deve", descricao: DESCRICAO_SEM_SAIDA, ok: false }],
    avaliacao: {
      explicacao: familias.includes("explicacao") ? [false, false, false] : [],
      textoBate: familias.includes("fidelidade") ? false : null,
      motivos: [],
    },
  }
  return { ...rodado, resultado: { ...resultado, acertou: calcularAcertou(resultado) } }
}

/**
 * Roda um caso e, quando ele tem pergunta do avaliador, confere as perguntas. Caso da família do acompanhante
 * sem saída do agente não chama o avaliador e conta como errado.
 */
export function criarRodarCaso(p: {
  rodadores: Rodadores
  avaliador: DepsDoAvaliador
}): (caso: CasoDeEval) => Promise<CasoRodado> {
  return async (caso) => {
    const rodado = await despachar(caso, p.rodadores)
    if (!temPerguntaDoAvaliador(caso)) return rodado
    if (rodado.colhido.saida?.origem !== "agente" && temFamiliaDeAcompanhante(caso)) {
      return semSaidaDoAgente(caso, rodado)
    }
    const perguntas = montarPerguntas(caso, rodado.colhido.saida)
    if (perguntas.length === 0) return rodado
    const avaliado = await avaliar(p.avaliador, caso, rodado.colhido)
    return { ...rodado, resultado: aplicarAvaliacao(rodado.resultado, perguntas, avaliado) }
  }
}
