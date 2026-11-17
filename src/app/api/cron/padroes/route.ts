import { rotaDosPadroes } from "@/app/_rotas/cron"
import { getContainer } from "@/infra/container"

export const dynamic = "force-dynamic"

export const GET = (request: Request) =>
  rotaDosPadroes({ container: getContainer(), segredo: () => process.env.CRON_SECRET ?? "" })(
    request,
  )
