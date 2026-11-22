export type AgregadosDosRuns = {
  runs: number // status done, dia em [de, ate]
  duracao_p50_ms: number | null // percentile_cont(0.5) de latencia_ms
  passos_medios: number | null // avg(passos) com caminho = 'acompanhante'
  juiz: { julgados: number; refeitas: number } // juiz_aprovado não nulo; juiz_tentativas = 2
  trocas_de_modelo: number // soma
  intencoes: { intencao: string; total: number }[] // unnest(intencoes), desc por total, depois id
  tools: { tool: string; total: number }[] // etapas tipo 'tool' fora de toolsFora, desc, até topTools
}

export type SinaisDaSemana = {
  feedback: { up: number; down: number }
  retornos: { ajudou: number; nao_ajudou: number; nao_fez: number }
}

export interface BastidoresStore {
  agregadosDosRuns(
    de: string,
    ate: string,
    opcoes: { topTools: number; toolsFora: readonly string[] },
  ): Promise<AgregadosDosRuns>
  sinais(de: string, ate: string): Promise<SinaisDaSemana> // soma de sinais_dia
  registrarSinaisDoDia(dia: string, fuso: string): Promise<number> // upsert dos 5 sinais (zeros também); devolve 5
  apagarSinaisAntesDe(dia: string): Promise<number>
}
