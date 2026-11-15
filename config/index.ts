import { app } from "./app"

export const config = { app } as const

export type AppConfig = typeof config
