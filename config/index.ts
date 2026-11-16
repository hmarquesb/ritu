import { adequacao } from "./adequacao"
import { app } from "./app"
import { aprovacao } from "./aprovacao"
import { base } from "./base"
import { casa } from "./casa"
import { clima } from "./clima"
import { conversa } from "./conversa"
import { llmCotas } from "./llm-cotas"
import { loop } from "./loop"
import { memoria } from "./memoria"
import { momentoDoDia } from "./momento-do-dia"
import { pausas } from "./pausas"
import { ranking } from "./ranking"
import { resposta } from "./resposta"
import { toques } from "./toques"

export type { Papel } from "./llm-cotas"
export { llmCotas } from "./llm-cotas"

export const config = {
  app,
  base,
  momentoDoDia,
  adequacao,
  clima,
  memoria,
  pausas,
  aprovacao,
  casa,
  conversa,
  loop,
  llmCotas,
  ranking,
  resposta,
  toques,
} as const

export type AppConfig = typeof config
