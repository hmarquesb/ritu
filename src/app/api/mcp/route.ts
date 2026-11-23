import { descarregarDepois } from "@/app/_apoio/descarregar"
import { getContainer } from "@/infra/container"
import { criarHandlerMcp, criarPostMcp } from "@/infra/mcp/servidor"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

let handler: ((request: Request) => Promise<Response>) | undefined

function doContainer() {
  const container = getContainer()
  handler ??= criarHandlerMcp(container)
  return { container, handler }
}

export async function POST(request: Request): Promise<Response> {
  const { container, handler } = doContainer()
  try {
    return await criarPostMcp(container, handler)(request)
  } finally {
    descarregarDepois(container)
  }
}

export async function GET(request: Request): Promise<Response> {
  return doContainer().handler(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return doContainer().handler(request)
}
