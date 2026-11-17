import { RituError } from "@/core/errors"
import { normalizar } from "@/core/knowledge/identificar"
import { criarRota, type DepsDaRota } from "../_lib/rota"

function consulta(request: Request, minimo: number, maximo: number): string {
  const q = new URL(request.url).searchParams.get("q") ?? ""
  if (q.length < minimo || q.length > maximo)
    throw new RituError("corpo_invalido", "Busca inválida.")
  return q
}

export function rotasDeBusca(deps: DepsDaRota): {
  cidades: (request: Request) => Promise<Response>
  alimentos: (request: Request) => Promise<Response>
} {
  const buscaCidades = criarRota(deps, {}, async ({ request, container }) => {
    const q = consulta(request, 2, 60)
    return { cidades: await container.cities.buscar(q) }
  })

  const alimentos = criarRota(deps, {}, async ({ request, container }) => {
    const { minimoCaracteres, maximoResultados } = container.config.limites.buscaDeAlimento
    const q = normalizar(consulta(request, minimoCaracteres, 40))
    const achados = container.knowledge.alimentos
      .filter((a) => normalizar(a.nome).includes(q))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt"))
      .slice(0, maximoResultados)
    return { alimentos: achados.map(({ id, nome }) => ({ id, nome })) }
  })

  return {
    // Indisponibilidade da busca de cidade é 503, não o 400 padrão dos erros de domínio.
    cidades: async (request) => {
      const r = await buscaCidades(request)
      if (r.status !== 400) return r
      const corpo = await r.clone().json()
      if (corpo?.erro !== "cidades_indisponivel") return r
      return Response.json(corpo, { status: 503 })
    },
    alimentos,
  }
}
