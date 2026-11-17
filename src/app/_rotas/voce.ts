import { calcularQuiz } from "@/core/accounts/dosha"
import { acaoDaMemoriaSchema, acaoDoPerfilSchema } from "@/core/touches"
import { criarRota, type DepsDaRota } from "../_lib/rota"

export function rotasDoVoce(deps: DepsDaRota) {
  const lerVoce = criarRota(deps, {}, async ({ conta, container }) => ({
    voce: await container.lerVoce(conta),
  }))

  // O quiz devolve também o resultado (nome, doshas e dual) para a tela mostrar o que mudou.
  const tocarPerfil = criarRota(
    deps,
    { corpo: acaoDoPerfilSchema },
    async ({ conta, corpo, container }) => {
      const { nome } = await container.touches.tocarPerfil(conta.id, corpo)
      const voce = await container.lerVoce(conta)
      if (corpo.acao !== "quiz") return { voce, nome }
      const { doshas, dual } = calcularQuiz(corpo.respostas.map((r) => r.dosha))
      return { voce, nome, resultado: { nome, doshas, dual } }
    },
  )

  const tocarMemoria = criarRota(
    deps,
    { corpo: acaoDaMemoriaSchema },
    async ({ conta, corpo, container }) => {
      const { nome } = await container.touches.tocarMemoria(conta.id, corpo)
      return { voce: await container.lerVoce(conta), nome }
    },
  )

  return { lerVoce, tocarPerfil, tocarMemoria }
}
