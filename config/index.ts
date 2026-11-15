import { adequacao } from "./adequacao"
import { app } from "./app"
import { base } from "./base"
import { casa } from "./casa"
import { clima } from "./clima"
import { loop } from "./loop"
import { memoria } from "./memoria"
import { momentoDoDia } from "./momento-do-dia"

export const config = { app, base, momentoDoDia, adequacao, clima, memoria, casa, loop } as const

export type AppConfig = typeof config
