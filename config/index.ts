import { adequacao } from "./adequacao"
import { app } from "./app"
import { aprovacao } from "./aprovacao"
import { base } from "./base"
import { bastidores } from "./bastidores"
import { casa } from "./casa"
import { textosChas } from "./chas"
import { clima } from "./clima"
import { conversa } from "./conversa"
import { evals } from "./evals"
import { juiz } from "./juiz"
import { limites } from "./limites"
import { llmCotas } from "./llm-cotas"
import { loop } from "./loop"
import { memoria } from "./memoria"
import { momentoDoDia } from "./momento-do-dia"
import { padroes } from "./padroes"
import { pausas } from "./pausas"
import { publico } from "./publico"
import { quiz } from "./quiz"
import { ranking } from "./ranking"
import { rotulosEn } from "./readme"
import { resposta } from "./resposta"
import { telaConversa } from "./tela-conversa"
import { telemetria } from "./telemetria"
import { textosBastidores } from "./textos-bastidores"
import { textosCasa } from "./textos-casa"
import { textosComoFicou } from "./textos-como-ficou"
import { textosComoPensei } from "./textos-como-pensei"
import { textosConversa } from "./textos-conversa"
import { textosEntrada } from "./textos-entrada"
import { exemploDaLanding, textosLanding } from "./textos-landing"
import { textosLimites } from "./textos-limites"
import { textosSobre } from "./textos-sobre"
import { textosVoce } from "./textos-voce"
import { toques } from "./toques"
import { ui } from "./ui"

export { textosChas } from "./chas"
export type { Papel } from "./llm-cotas"
export { llmCotas } from "./llm-cotas"
export { publico } from "./publico"
export { rotulosEn } from "./readme"
export { telaConversa } from "./tela-conversa"
export { textosBastidores } from "./textos-bastidores"
export { textosCasa } from "./textos-casa"
export { textosComoFicou } from "./textos-como-ficou"
export { textosComoPensei } from "./textos-como-pensei"
export { textosConversa } from "./textos-conversa"
export { exemploDaLanding, textosLanding } from "./textos-landing"
export { textosLimites } from "./textos-limites"
export { textosSobre } from "./textos-sobre"
export { textosVoce } from "./textos-voce"

export const config = {
  app,
  base,
  bastidores,
  momentoDoDia,
  adequacao,
  clima,
  memoria,
  padroes,
  pausas,
  publico,
  rotulosEn,
  aprovacao,
  casa,
  conversa,
  evals,
  juiz,
  limites,
  loop,
  llmCotas,
  quiz,
  ranking,
  resposta,
  telaConversa,
  telemetria,
  textosChas,
  textosCasa,
  textosComoFicou,
  textosComoPensei,
  textosConversa,
  textosEntrada,
  textosLanding,
  textosSobre,
  exemploDaLanding,
  textosVoce,
  textosBastidores,
  textosLimites,
  toques,
  ui,
} as const

export type AppConfig = typeof config
