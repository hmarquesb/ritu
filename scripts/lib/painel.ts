import { telemetria } from "@config/telemetria"

export type Fonte = "metricas" | "logs" | "traces"

export type Painel = {
  titulo: string
  descricao: string
  tipo: "timeseries" | "stat" | "barchart" | "bargauge" | "table" | "logs"
  fonte: Fonte
  consultas: { expr: string; legenda?: string }[]
  unidade?: "ms" | "percentunit" | "short"
  limites?: { amarelo: number; vermelho: number }
}

export type Linha = { titulo: string; paineis: Painel[] }

export type Alerta = { uid: string; titulo: string; expr: string; para: string; resumo: string }

/** Total do período de uma métrica de contador, agrupado pelos rótulos dados. */
export function TOTAL(m: string, ...por: string[]): string {
  if (por.length === 0) return `sum(max_over_time(${m}[$__range]))`
  return `sum by (${por.join(", ")}) (max_over_time(${m}[$__range]))`
}

const LIMITE_PERCENTUAL = { amarelo: 0.05, vermelho: 0.1 }
const LIMITE_COTA = { amarelo: 0.8, vermelho: 1 }
const LIMITE_UNITARIO = { amarelo: 1, vermelho: 1 }

const { alertas } = telemetria

export const PAINEL: { uid: string; titulo: "Ritu"; linhas: Linha[] } = {
  uid: telemetria.grafana.uidDoPainel,
  titulo: "Ritu",
  linhas: [
    {
      titulo: "1. Saúde",
      paineis: [
        {
          titulo: "Runs por hora",
          descricao: "Quantos runs terminaram por hora, e com qual status?",
          tipo: "timeseries",
          fonte: "metricas",
          consultas: [{ expr: `sum by (status) (increase(ritu_run_passos_count[1h]))` }],
        },
        {
          titulo: "Espera por resposta, p50 e p95",
          descricao: "Quanto a pessoa espera por uma resposta, no p50 e no p95?",
          tipo: "timeseries",
          fonte: "metricas",
          unidade: "ms",
          consultas: [
            {
              expr: `histogram_quantile(0.5, sum by (le) (rate(ritu_run_duracao_ms_bucket[$__rate_interval])))`,
              legenda: "p50",
            },
            {
              expr: `histogram_quantile(0.95, sum by (le) (rate(ritu_run_duracao_ms_bucket[$__rate_interval])))`,
              legenda: "p95",
            },
          ],
        },
        {
          titulo: "Runs que falharam",
          descricao: "Qual a fração de runs que falharam no período?",
          tipo: "stat",
          fonte: "metricas",
          unidade: "percentunit",
          limites: LIMITE_PERCENTUAL,
          consultas: [
            {
              expr:
                TOTAL('ritu_run_passos_count{status="failed"}') +
                " / " +
                TOTAL("ritu_run_passos_count"),
            },
          ],
        },
        {
          titulo: "429 do modelo",
          descricao: "Quantas vezes o modelo respondeu com limite de taxa (429) no período?",
          tipo: "stat",
          fonte: "metricas",
          consultas: [{ expr: TOTAL('ritu_llm_erros_total{codigo="rate_limit"}') }],
        },
        {
          titulo: "Latência do modelo, p95",
          descricao: "Quanto cada modelo demora para responder, no p95?",
          tipo: "timeseries",
          fonte: "metricas",
          unidade: "ms",
          consultas: [
            {
              expr: `histogram_quantile(0.95, sum by (le, modelo) (rate(ritu_llm_duracao_ms_bucket[$__rate_interval])))`,
            },
          ],
        },
        {
          titulo: "Latência das tools, p95",
          descricao: "Qual tool é a mais lenta, no p95?",
          tipo: "barchart",
          fonte: "metricas",
          unidade: "ms",
          consultas: [
            {
              expr: `histogram_quantile(0.95, sum by (le, tool) (increase(ritu_tool_duracao_ms_bucket[$__range])))`,
            },
          ],
        },
      ],
    },
    {
      titulo: "2. Agente",
      paineis: [
        {
          titulo: "Intenções",
          descricao: "Quais intenções as mensagens tiveram no período?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_run_intencao_total", "intencao") }],
        },
        {
          titulo: "Caminhos",
          descricao: "Por qual caminho os runs passaram?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_run_passos_count", "caminho") }],
        },
        {
          titulo: "Passos por run",
          descricao: "Quantos passos um run leva em média, por caminho?",
          tipo: "timeseries",
          fonte: "metricas",
          consultas: [
            {
              expr: `sum by (caminho) (rate(ritu_run_passos_sum[$__rate_interval])) / sum by (caminho) (rate(ritu_run_passos_count[$__rate_interval]))`,
            },
          ],
        },
        {
          titulo: "Tools",
          descricao: "Quais tools o agente chamou, e com que resultado?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_tool_chamadas_total", "tool", "status") }],
        },
        {
          titulo: "Violações do validador",
          descricao: "Que regras o validador da resposta mais barrou?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_validacao_violacoes_total", "violacao") }],
        },
        {
          titulo: "Juiz",
          descricao: "Como o Juiz julgou as respostas, e por quais motivos reprovou ou avisou?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [
            { expr: TOTAL("ritu_juiz_total", "resultado") },
            { expr: TOTAL("ritu_juiz_reprovacoes_total", "motivo") },
            { expr: TOTAL("ritu_juiz_avisos_total", "motivo") },
          ],
        },
        {
          titulo: "Guardrail",
          descricao: "Quantas mensagens o guardrail deixou passar ou tratou, e por qual origem?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_guardrail_total", "resultado", "origem") }],
        },
        {
          titulo: "Pausas",
          descricao: "Quantas vezes o run pausou para pedir algo à pessoa, e de que tipo?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_pausas_total", "tipo") }],
        },
        {
          titulo: "Memória",
          descricao: "Quantos resumos de rotina e padrões foram gerados, e de onde vieram?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [
            { expr: TOTAL("ritu_rotina_resumo_total", "origem") },
            { expr: TOTAL("ritu_padroes_total", "tipo", "etapa") },
          ],
        },
      ],
    },
    {
      titulo: "3. Modelos e cota",
      paineis: [
        {
          titulo: "Chamadas por modelo e papel",
          descricao: "Quantas chamadas cada modelo recebeu em cada papel na última hora?",
          tipo: "timeseries",
          fonte: "metricas",
          consultas: [{ expr: `sum by (modelo, papel) (increase(ritu_llm_chamadas_total[1h]))` }],
        },
        {
          titulo: "Tokens",
          descricao: "Quantos tokens de entrada e de saída cada modelo consumiu?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_tokens_total", "modelo", "direcao") }],
        },
        {
          titulo: "Cota do dia",
          descricao: "Quanto da cota diária de cada modelo já foi usado?",
          tipo: "bargauge",
          fonte: "metricas",
          unidade: "percentunit",
          limites: LIMITE_COTA,
          consultas: [
            {
              expr: `max by (modelo) (last_over_time(ritu_llm_cota_usada{janela="dia"}[$__range]))`,
            },
          ],
        },
        {
          titulo: "Cota do minuto",
          descricao: "Como está a cota do minuto de cada modelo?",
          tipo: "timeseries",
          fonte: "metricas",
          unidade: "percentunit",
          consultas: [{ expr: `max by (modelo) (ritu_llm_cota_usada{janela="minuto"})` }],
        },
        {
          titulo: "Trocas de modelo",
          descricao: "Quando e por que o roteador trocou de modelo?",
          tipo: "table",
          fonte: "metricas",
          consultas: [
            { expr: TOTAL("ritu_llm_troca_de_modelo_total", "papel", "de", "para", "motivo") },
          ],
        },
        {
          titulo: "Respostas sem modelo",
          descricao: "Quantas respostas foram montadas sem modelo?",
          tipo: "stat",
          fonte: "metricas",
          limites: LIMITE_UNITARIO,
          consultas: [{ expr: TOTAL("ritu_fallback_sem_llm_total") }],
        },
        {
          titulo: "Erros do modelo",
          descricao: "Quais erros os modelos devolveram, por modelo e código?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_llm_erros_total", "modelo", "codigo") }],
        },
      ],
    },
    {
      titulo: "4. Qualidade",
      paineis: [
        {
          titulo: "👍/👎",
          descricao: "Como a pessoa avaliou as respostas?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_feedback_total", "voto") }],
        },
        {
          titulo: "Retornos",
          descricao: "Como foram os retornos da pessoa sobre o que foi sugerido, e de onde vieram?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_retorno_total", "resultado", "origem") }],
        },
        {
          titulo: "Trocas de ingrediente",
          descricao: "As trocas de ingrediente deram certo?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_troca_ingrediente_total", "resultado") }],
        },
        {
          titulo: "Gostos",
          descricao: "Quais gostos a pessoa registrou?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_gosto_total", "gosto") }],
        },
        {
          titulo: "Faltas",
          descricao: "Que itens faltaram em casa, e de qual origem veio o aviso?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_faltas_total", "origem") }],
        },
        {
          titulo: "Propostas",
          descricao: "Quais propostas o agente fez, e o que a pessoa decidiu?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_propostas_total", "tool", "decisao") }],
        },
        {
          titulo: "Vale ter em casa",
          descricao: "Em que etapa está a indicação de vale ter em casa?",
          tipo: "barchart",
          fonte: "metricas",
          consultas: [{ expr: TOTAL("ritu_para_ter_total", "etapa") }],
        },
        {
          titulo: "Entradas",
          descricao: "Quantas entradas houve, por tipo de conta, e quantas o limite recusou?",
          tipo: "barchart",
          fonte: "metricas",
          // Rótulos com ponto chegam ao Prometheus com sublinhado.
          consultas: [{ expr: TOTAL("ritu_entrada_total", "conta_tipo", "entrada_resultado") }],
        },
      ],
    },
    {
      titulo: "5. Rastro",
      paineis: [
        {
          titulo: "Runs recentes",
          descricao: "Quais foram os runs recentes, com caminho, status, passos e duração?",
          tipo: "table",
          fonte: "traces",
          consultas: [{ expr: `{ name = "run" }` }],
        },
        {
          titulo: "Avisos e erros",
          descricao: "Quais avisos e erros aconteceram recentemente?",
          tipo: "logs",
          fonte: "logs",
          consultas: [{ expr: `{service_name="ritu"} | severity_text=~"WARN|ERROR"` }],
        },
      ],
    },
  ],
}

export const ALERTAS: Alerta[] = [
  {
    uid: "ritu-cota-do-dia",
    titulo: `Cota do dia acima de ${Math.round(alertas.cotaDoDia * 100)}%`,
    expr: `max by (modelo) (ritu_llm_cota_usada{janela="dia"}) >= ${alertas.cotaDoDia}`,
    para: "0m",
    resumo:
      "Algum modelo passou do limite da cota diária: confira a cota por modelo antes que ela acabe.",
  },
  {
    uid: "ritu-runs-falhando",
    titulo: `Mais de ${Math.round(alertas.runsFalhando.taxa * 100)}% dos runs falhando em 1 h`,
    expr: `(sum(increase(ritu_run_passos_count{status="failed"}[${alertas.runsFalhando.janela}])) / sum(increase(ritu_run_passos_count[${alertas.runsFalhando.janela}]))) >= ${alertas.runsFalhando.taxa} and sum(increase(ritu_run_passos_count[${alertas.runsFalhando.janela}])) >= ${alertas.runsFalhando.minimoDeRuns}`,
    para: "0m",
    resumo:
      "Runs estão falhando acima do limite na última hora: veja os caminhos e os erros no rastro.",
  },
  {
    uid: "ritu-sem-modelo",
    titulo: "Resposta montada sem modelo",
    expr: `sum(increase(ritu_fallback_sem_llm_total[${alertas.semModelo.janela}])) >= ${alertas.semModelo.minimo}`,
    para: "0m",
    resumo:
      "Uma resposta foi montada sem modelo: veja os motivos do fallback e a saúde dos provedores.",
  },
  {
    uid: "ritu-juiz-reprovando",
    titulo: `Juiz reprovando acima de ${Math.round(alertas.juizReprovando.taxa * 100)}%`,
    expr: `(sum(increase(ritu_juiz_total{resultado="reprovado"}[${alertas.juizReprovando.janela}])) / sum(increase(ritu_juiz_total[${alertas.juizReprovando.janela}]))) >= ${alertas.juizReprovando.taxa} and sum(increase(ritu_juiz_total[${alertas.juizReprovando.janela}])) >= ${alertas.juizReprovando.minimoDeJulgamentos}`,
    para: "0m",
    resumo:
      "O Juiz está reprovando muitas respostas: veja os motivos de reprovação e as violações do validador.",
  },
  {
    uid: "ritu-429",
    titulo: "429 frequente",
    expr: `sum(increase(ritu_llm_erros_total{codigo="rate_limit"}[${alertas.rateLimit.janela}])) >= ${alertas.rateLimit.minimo}`,
    para: "0m",
    resumo: "O modelo está devolvendo muitos 429: veja as cotas e as trocas de modelo.",
  },
]
