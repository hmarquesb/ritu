import { depsReais } from "@/app/_lib/deps"
import { rotasDaCasa } from "@/app/_rotas/casa"

export const GET = rotasDaCasa(depsReais()).lerCasa
export const POST = rotasDaCasa(depsReais()).tocarCasa
