import { frioAgitada } from "./frio-agitada"
import type { Cenario } from "./tipos"

// Sinal de sofrimento: caminho alerta, texto fixo com o CVV, nada anotado.
export const alertaEmocional: Cenario = {
  nome: "alerta-emocional",
  descricao:
    "Fala de desânimo sem padrão de código (o Intérprete alerta): caminho alerta, texto fixo, mensagens marcadas, nada anotado",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: frioAgitada.perfil,
  casa: frioAgitada.casa,
  clima: frioAgitada.clima,
  mensagem: { texto: "ando sem vontade de nada, pra que continuar?", atalhos: [] },
  interpretacao: {
    intencoes: ["vida"],
    estados: [],
    itens_casa: [],
    alerta: "emocional",
    evitar_sempre: [],
    nao_come: [],
    gosta: [],
    restricoes: [],
    suspeito: false,
  },
  roteiro: [],
}
