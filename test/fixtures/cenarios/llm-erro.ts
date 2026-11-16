import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Erro do modelo no Intérprete (015 T19): o eval põe o cliente com rate_limit antes da resposta (opts.llm), e o log llm_erro e a troca de modelo saem.
export const llmErro: Cenario = {
  nome: "llm-erro",
  descricao:
    "Momento do frio-agitada com o primeiro modelo do Intérprete em rate_limit: sai llm_erro e troca_de_modelo, e o modelo seguinte responde",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: {
    texto: "Estou com frio e agitada depois do trabalho. Tenho abóbora, arroz e ghee em casa.",
    atalhos: [],
  },
  interpretacao: {
    intencoes: ["momento"],
    estados: ["com_frio", "agitada"],
    itens_casa: [],
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: frioAgitada.roteiro,
}
