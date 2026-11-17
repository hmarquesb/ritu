import { adequacao } from "./adequacao"
import { app } from "./app"
import { aprovacao } from "./aprovacao"
import { base } from "./base"
import { casa } from "./casa"
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
import { quiz } from "./quiz"
import { ranking } from "./ranking"
import { resposta } from "./resposta"
import { telaConversa } from "./tela-conversa"
import { telemetria } from "./telemetria"
import { textosConversa } from "./textos-conversa"
import { textosEntrada } from "./textos-entrada"
import { textosLimites } from "./textos-limites"
import { toques } from "./toques"
import { ui } from "./ui"

export type { Papel } from "./llm-cotas"
export { llmCotas } from "./llm-cotas"
export { telaConversa } from "./tela-conversa"
export { textosConversa } from "./textos-conversa"
export { textosLimites } from "./textos-limites"

export const config = {
  app,
  base,
  momentoDoDia,
  adequacao,
  clima,
  memoria,
  padroes,
  pausas,
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
  textosConversa,
  textosEntrada,
  textosLimites,
  toques,
  ui,
} as const

export type AppConfig = typeof config
