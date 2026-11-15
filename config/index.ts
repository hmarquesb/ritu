import { adequacao } from "./adequacao"
import { app } from "./app"
import { base } from "./base"
import { clima } from "./clima"
import { momentoDoDia } from "./momento-do-dia"

export const config = { app, base, momentoDoDia, adequacao, clima } as const

export type AppConfig = typeof config
