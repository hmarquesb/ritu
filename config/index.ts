import { adequacao } from "./adequacao"
import { app } from "./app"
import { aprovacao } from "./aprovacao"
import { base } from "./base"
import { casa } from "./casa"
import { clima } from "./clima"
import { conversa } from "./conversa"
import { evals } from "./evals"
import { juiz } from "./juiz"
import { llmCotas } from "./llm-cotas"
import { loop } from "./loop"
import { memoria } from "./memoria"
import { momentoDoDia } from "./momento-do-dia"
import { padroes } from "./padroes"
import { pausas } from "./pausas"
import { ranking } from "./ranking"
import { resposta } from "./resposta"
import { telemetria } from "./telemetria"
import { toques } from "./toques"
import { ui } from "./ui"

export type { Papel } from "./llm-cotas"
export { llmCotas } from "./llm-cotas"

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
  loop,
  llmCotas,
  ranking,
  resposta,
  telemetria,
  toques,
  ui,
} as const

export type AppConfig = typeof config
