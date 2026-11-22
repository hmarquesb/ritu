// Lista fechada de spans, métricas, logs e atributos (OBSERVABILITY.md §3).
// Qualquer nome fora daqui é recusado pelo fake de telemetria: é a trava de privacidade.

export const SPANS = {
  run: ["run.id", "run.caminho", "run.intencoes", "conta.tipo", "run.status", "run.passos"],
  "guardrail.entrada": ["guardrail.resultado"],
  interprete: [],
  preparo: ["candidatos.total", "faltas.registradas", "para_ter.candidato"],
  "agente.passo": ["passo.ordem"],
  "llm.chamada": [
    "llm.papel",
    "gen_ai.request.model",
    "llm.troca_de_modelo",
    "gen_ai.usage.input_tokens",
    "gen_ai.usage.output_tokens",
    "llm.tentativas",
  ],
  "tool.chamada": ["tool.nome", "tool.status"],
  validacao: ["validacao.ok", "validacao.violacoes", "validacao.tentativa"],
  juiz: ["juiz.aprovado", "juiz.tentativa"],
  "aprovacao.execucao": ["propostas.total", "propostas.aprovadas"],
  toque: ["tipo"],
  "memoria.resumo": ["resumo.origem"],
  "padroes.deteccao": ["padroes.contas", "padroes.propostos"],
} as const satisfies Record<string, readonly AtributoPermitido[]>
// Valores: atributos obrigatórios num span que termina sem falha.
// Condicionais: `prompt.versao` em `run` com agente; `cache.hit` em `tool.chamada` de `clima.*`;
// `motivo` e `resultado` em `toque` de troca (011).

export type NomeDeSpan = keyof typeof SPANS

export const METRICAS = {
  ritu_run_duracao_ms: { tipo: "histograma", rotulos: ["caminho", "status"] },
  ritu_run_passos: { tipo: "histograma", rotulos: ["caminho", "status"] },
  ritu_run_intencao_total: { tipo: "contador", rotulos: ["intencao"] },
  ritu_tokens_total: { tipo: "contador", rotulos: ["modelo", "papel", "direcao"] },
  ritu_llm_chamadas_total: { tipo: "contador", rotulos: ["modelo", "papel"] },
  ritu_llm_duracao_ms: { tipo: "histograma", rotulos: ["modelo", "papel"] },
  ritu_llm_cota_usada: { tipo: "medidor", rotulos: ["modelo", "janela"] },
  ritu_llm_troca_de_modelo_total: { tipo: "contador", rotulos: ["papel", "de", "para", "motivo"] },
  ritu_llm_erros_total: { tipo: "contador", rotulos: ["modelo", "papel", "codigo"] },
  ritu_fallback_sem_llm_total: { tipo: "contador", rotulos: [] },
  ritu_limite_total: { tipo: "contador", rotulos: ["tipo", "motivo", "resultado"] },
  ritu_tool_chamadas_total: { tipo: "contador", rotulos: ["tool", "status"] },
  ritu_tool_duracao_ms: { tipo: "histograma", rotulos: ["tool"] },
  ritu_validacao_violacoes_total: { tipo: "contador", rotulos: ["violacao"] },
  ritu_guardrail_total: { tipo: "contador", rotulos: ["resultado", "origem"] },
  ritu_juiz_total: { tipo: "contador", rotulos: ["resultado"] },
  ritu_juiz_reprovacoes_total: { tipo: "contador", rotulos: ["motivo"] },
  ritu_juiz_avisos_total: { tipo: "contador", rotulos: ["motivo"] },
  ritu_pausas_total: { tipo: "contador", rotulos: ["tipo"] },
  ritu_propostas_total: { tipo: "contador", rotulos: ["tool", "decisao"] },
  ritu_rotina_resumo_total: { tipo: "contador", rotulos: ["origem"] },
  ritu_padroes_total: { tipo: "contador", rotulos: ["tipo", "etapa"] },
  ritu_feedback_total: { tipo: "contador", rotulos: ["voto"] },
  ritu_retorno_total: { tipo: "contador", rotulos: ["resultado", "origem"] },
  ritu_troca_ingrediente_total: { tipo: "contador", rotulos: ["resultado"] },
  ritu_gosto_total: { tipo: "contador", rotulos: ["gosto"] },
  ritu_faltas_total: { tipo: "contador", rotulos: ["origem"] },
  ritu_para_ter_total: { tipo: "contador", rotulos: ["etapa"] },
  ritu_entrada_total: { tipo: "contador", rotulos: ["conta.tipo", "entrada.resultado"] },
  ritu_memoria_edicoes_total: { tipo: "contador", rotulos: ["nivel", "acao"] },
  ritu_conta_apagada_total: { tipo: "contador", rotulos: ["tipo"] },
} as const satisfies Record<
  string,
  { tipo: "contador" | "histograma" | "medidor"; rotulos: readonly AtributoPermitido[] }
>

export type NomeDeMetrica = keyof typeof METRICAS

export type NomeDeContador = {
  [K in NomeDeMetrica]: (typeof METRICAS)[K]["tipo"] extends "contador" ? K : never
}[NomeDeMetrica]

export type NomeDeHistograma = {
  [K in NomeDeMetrica]: (typeof METRICAS)[K]["tipo"] extends "histograma" ? K : never
}[NomeDeMetrica]

export type NomeDeMedidor = {
  [K in NomeDeMetrica]: (typeof METRICAS)[K]["tipo"] extends "medidor" ? K : never
}[NomeDeMetrica]

export const LOGS = {
  run_inicio: "info", // campos: — (run.id e trace_id vêm do contexto)
  run_retomado: "info", // pausa.tipo
  run_fim: "info", // run.status, run.caminho, run.passos
  clima_indisponivel: "warn", // erro.codigo
  troca_de_modelo: "warn", // papel, de, para, motivo
  sem_modelo: "warn", // papel
  llm_erro: "warn", // modelo, papel, codigo
  resposta_segura: "warn", // motivo
  atributo_proibido: "warn", // erro.codigo
  run_falhou: "error", // erro.codigo
  padroes_conta_falhou: "error", // erro.codigo (012; D1)
  erro_inesperado: "error", // erro.codigo
} as const

export type CodigoDeLog = keyof typeof LOGS

export const ATRIBUTOS_PERMITIDOS = [
  // atributos da árvore de spans
  "run.id",
  "run.intencoes",
  "run.caminho",
  "conta.tipo",
  "prompt.versao",
  "run.status",
  "run.passos",
  "guardrail.resultado",
  "llm.papel",
  "gen_ai.request.model",
  "llm.troca_de_modelo",
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.output_tokens",
  "llm.tentativas",
  "candidatos.total",
  "faltas.registradas",
  "para_ter.candidato",
  "passo.ordem",
  "tool.nome",
  "tool.status",
  "cache.hit",
  "validacao.ok",
  "validacao.violacoes",
  "validacao.tentativa",
  "pausa.tipo",
  "juiz.aprovado",
  "juiz.tentativa",
  "propostas.total",
  "propostas.aprovadas",
  "resumo.origem",
  "padroes.contas",
  "padroes.propostos",
  "entrada.resultado",
  // rótulos da tabela de métricas
  "caminho",
  "status",
  "intencao",
  "modelo",
  "papel",
  "direcao",
  "janela",
  "de",
  "para",
  "motivo",
  "tool",
  "violacao",
  "tipo",
  "decisao",
  "codigo",
  "voto",
  "resultado",
  "origem",
  "gosto",
  "etapa",
  "nivel",
  "acao",
  // extras
  "erro.codigo",
  "trace_id",
] as const

export type AtributoPermitido = (typeof ATRIBUTOS_PERMITIDOS)[number]

export const MAX_TEXTO_ATRIBUTO = 64
