import { frioAgitada } from "./frio-agitada"
import { historicoDoCha, roteiroDoJantar, roteiroDoMomento } from "./padrao-confirmado"
import type { Cenario } from "./tipos"

// O histórico do chá, "Agora não" no bloco e uma segunda mensagem no mesmo dia: o padrão segue candidato e não volta no dia.
export const padraoAgoraNao: Cenario = {
  nome: "padrao-agora-nao",
  descricao:
    "O mesmo histórico do chá; Agora não no bloco deixa o padrão candidato, e a segunda mensagem do mesmo dia não traz a linha",
  agora: frioAgitada.agora,
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  historico: historicoDoCha,
  detectar: true,
  mensagem: { texto: "Estou com frio e agitada depois do trabalho.", atalhos: [] },
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
  aprovacao: "agora_nao",
  roteiro: roteiroDoMomento,
  depois: {
    mensagem: { texto: "e no jantar?", atalhos: [] },
    interpretacao: {
      intencoes: ["momento"],
      estados: [],
      itens_casa: [],
      evitar_sempre: [],
      nao_come: [],
      gosta: [],
      restricoes: [],
      suspeito: false,
    },
    roteiro: roteiroDoJantar,
  },
}
