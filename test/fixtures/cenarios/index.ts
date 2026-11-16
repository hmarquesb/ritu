import { alertaEmocional } from "./alerta-emocional"
import { alertaPorCodigo } from "./alerta-por-codigo"
import { aprovacaoParcial } from "./aprovacao-parcial"
import { autocorrecao } from "./autocorrecao"
import { casaIncerta } from "./casa-incerta"
import { casaSozinha } from "./casa-sozinha"
import { casaVazia } from "./casa-vazia"
import { doisNaoAjudou } from "./dois-nao-ajudou"
import { dorDeCabeca } from "./dor-de-cabeca"
import { duasIntencoes } from "./duas-intencoes"
import { entregaRegistrada } from "./entrega-registrada"
import { estadosJuntos } from "./estados-juntos"
import { estomagoPesado } from "./estomago-pesado"
import { evitarSozinho } from "./evitar-sozinho"
import { faltouHoje } from "./faltou-hoje"
import { frioAgitada } from "./frio-agitada"
import { gostoEscrito } from "./gosto-escrito"
import { injectionPorCodigo } from "./injection-por-codigo"
import { juizBarra } from "./juiz-barra"
import { juizCorrige } from "./juiz-corrige"
import { juizForaDoAr } from "./juiz-fora-do-ar"
import { naoTenhoComPergunta } from "./nao-tenho-com-pergunta"
import { notaComSaude } from "./nota-com-saude"
import { ofensa } from "./ofensa"
import { padraoAgoraNao } from "./padrao-agora-nao"
import { padraoConfirmado } from "./padrao-confirmado"
import { padraoRecusado } from "./padrao-recusado"
import { perguntaManga } from "./pergunta-manga"
import { perguntaRecusada } from "./pergunta-recusada"
import { retornoConversa } from "./retorno-conversa"
import { retornoPeloAgente } from "./retorno-pelo-agente"
import { rotinaResumida } from "./rotina-resumida"
import { rotinaSemModelo } from "./rotina-sem-modelo"
import { semModelo } from "./sem-modelo"
import { soAtalhos } from "./so-atalhos"
import { sumirPorCodigo } from "./sumir-por-codigo"
import type { Cenario as CenarioBase, CenarioComEntrada, CenarioDeConversa } from "./tipos"
import { trocaPorToque } from "./troca-por-toque"
import { vegetariana } from "./vegetariana"

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

// Os três da aprovação (D16): passam pela conversa, com decisão do bloco e, nos que têm `depois`, segunda mensagem.
export const cenariosComAprovacao: Record<string, CenarioDeConversa> = {
  "aprovacao-parcial": comMensagem(aprovacaoParcial),
  "faltou-hoje": comMensagem(faltouHoje),
  vegetariana: comMensagem(vegetariana),
}

// Os seis da 011 (aprendizado): passam pela conversa ou pela entrega, com toques e retornos semeados quando o cenário pede.
export const cenariosDeAprendizado: Record<string, CenarioDeConversa> = {
  "entrega-registrada": comMensagem(entregaRegistrada),
  "troca-por-toque": comMensagem(trocaPorToque),
  "nao-tenho-com-pergunta": comMensagem(naoTenhoComPergunta),
  "dois-nao-ajudou": comMensagem(doisNaoAjudou),
  "retorno-pelo-agente": comMensagem(retornoPeloAgente),
  "gosto-escrito": comMensagem(gostoEscrito),
}

// Os seis da 012 (rotina e padrões): passam pela conversa; a Memória e a detecção vêm do próprio cenário.
export const cenariosDeMemoria: Record<string, CenarioDeConversa> = {
  "rotina-resumida": comMensagem(rotinaResumida),
  "rotina-sem-modelo": comMensagem(rotinaSemModelo),
  "padrao-confirmado": comMensagem(padraoConfirmado),
  "padrao-recusado": comMensagem(padraoRecusado),
  "padrao-agora-nao": comMensagem(padraoAgoraNao),
  "estados-juntos": comMensagem(estadosJuntos),
}

// Os sete da 013 (guardrails e Juiz) ficam num registro próprio (D20). Os três de código não chamam modelo; os do Juiz usam `juiz` do cenário.
export const cenariosDeGuardrails: Record<string, CenarioDeConversa> = {
  "alerta-por-codigo": comMensagem(alertaPorCodigo),
  "sumir-por-codigo": comMensagem(sumirPorCodigo),
  "injection-por-codigo": comMensagem(injectionPorCodigo),
  "juiz-corrige": comMensagem(juizCorrige),
  "juiz-barra": comMensagem(juizBarra),
  "juiz-fora-do-ar": comMensagem(juizForaDoAr),
  "nota-com-saude": comMensagem(notaComSaude),
}

export { type DepsDoCenario, montarCenario, type OpcoesDoCenario } from "./montar"
export { type RodadaDoCenario, rodarCenario } from "./rodar"
