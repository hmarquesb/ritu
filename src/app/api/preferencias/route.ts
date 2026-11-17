import { depsReais } from "@/app/_lib/deps"
import { rotasDaCasa } from "@/app/_rotas/casa"

export const POST = rotasDaCasa(depsReais()).preferencias
