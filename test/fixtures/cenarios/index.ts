import { alertaEmocional } from "./alerta-emocional"
import { autocorrecao } from "./autocorrecao"
import { casaIncerta } from "./casa-incerta"
import { casaSozinha } from "./casa-sozinha"
import { casaVazia } from "./casa-vazia"
import { dorDeCabeca } from "./dor-de-cabeca"
import { duasIntencoes } from "./duas-intencoes"
import { estomagoPesado } from "./estomago-pesado"
import { evitarSozinho } from "./evitar-sozinho"
import { frioAgitada } from "./frio-agitada"
import { ofensa } from "./ofensa"
import { perguntaManga } from "./pergunta-manga"
import { perguntaRecusada } from "./pergunta-recusada"
import { retornoConversa } from "./retorno-conversa"
import { semModelo } from "./sem-modelo"
import { soAtalhos } from "./so-atalhos"
import type { Cenario as CenarioBase, CenarioComEntrada, CenarioDeConversa } from "./tipos"

// Os cenários da 007 têm entrada: é o tipo que os consumidores veem como Cenario.
export type Cenario = CenarioComEntrada

// Confere a entrada na montagem do registro; o tipo estreito vem daí, sem cast.
function comEntrada(c: CenarioBase): CenarioComEntrada {
  if (!c.entrada) throw new Error(`cenário ${c.nome} sem entrada`)
  return { ...c, entrada: c.entrada }
}

// Confere a mensagem na montagem do registro da conversa.
function comMensagem(c: CenarioBase): CenarioDeConversa {
  if (!c.mensagem) throw new Error(`cenário ${c.nome} sem mensagem`)
  return { ...c, mensagem: c.mensagem }
}

export const cenarios: Record<string, Cenario> = {
  "frio-agitada": comEntrada(frioAgitada),
  "pergunta-manga": comEntrada(perguntaManga),
  autocorrecao: comEntrada(autocorrecao),
  "estomago-pesado": comEntrada(estomagoPesado),
  "sem-modelo": comEntrada(semModelo),
}

// Os sete da conversa ficam fora de `cenarios`: os testes e evals do Acompanhante seguem com os cinco.
export const cenariosDeConversa: Record<string, CenarioDeConversa> = {
  "casa-sozinha": comMensagem(casaSozinha),
  "retorno-conversa": comMensagem(retornoConversa),
  "evitar-sozinho": comMensagem(evitarSozinho),
  "alerta-emocional": comMensagem(alertaEmocional),
  ofensa: comMensagem(ofensa),
  "duas-intencoes": comMensagem(duasIntencoes),
  "so-atalhos": comMensagem(soAtalhos),
}

// Os quatro com pausa (009): passam pela conversa e são rodados por `rodarCenario` até o fim.
export const cenariosComPausa: Record<string, CenarioDeConversa> = {
  "casa-incerta": comMensagem(casaIncerta),
  "casa-vazia": comMensagem(casaVazia),
  "dor-de-cabeca": comMensagem(dorDeCabeca),
  "pergunta-recusada": comMensagem(perguntaRecusada),
}

export { type DepsDoCenario, montarCenario, type OpcoesDoCenario } from "./montar"
export { type RodadaDoCenario, rodarCenario } from "./rodar"
