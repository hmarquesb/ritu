import { rotaDaSaude } from "@/app/_rotas/saude"
import { getContainer } from "@/infra/container"

export const dynamic = "force-dynamic"

export const GET = (request: Request) =>
  rotaDaSaude({ container: getContainer(), segredo: () => process.env.CRON_SECRET ?? "" })(request)
