import { depsReais } from "@/app/_lib/deps"
import { rotasDeBusca } from "@/app/_rotas/busca"

export const dynamic = "force-dynamic"

export const GET = (request: Request) => rotasDeBusca(depsReais()).cidades(request)
