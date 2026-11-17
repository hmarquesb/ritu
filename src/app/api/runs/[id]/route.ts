import { depsReais } from "@/app/_lib/deps"
import { rotasDaConversa } from "@/app/_rotas/conversa"

export const GET = rotasDaConversa(depsReais()).run
