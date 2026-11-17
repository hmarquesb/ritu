import { z } from "zod"
import { calcularQuiz, nomeDoDosha, prakritiDeclarada } from "@/core/accounts/dosha"
import { proximoPasso, ROTA_DO_PASSO } from "@/core/accounts/onboarding"
import { RituError } from "@/core/errors"
import { doshaSchema } from "@/core/knowledge/vocab"
import type { Container } from "@/infra/container"
import { criarRota, type DepsDaRota } from "../_lib/rota"

const ROTA_DO_QUIZ = "/comecar/quiz"

// A checagem contra a base roda na hora da leitura do corpo, não na criação das rotas.
function schemaDoEvitar(container: Container) {
  const { limites } = container.config
  const itemDeEvitar = z.discriminatedUnion("tipo", [
    z.strictObject({
      tipo: z.literal("grupo"),
      valor: z
        .string()
        .refine(
          (id) => container.knowledge.gruposEvitar.some((g) => g.id === id),
          "grupo_desconhecido",
        ),
    }),
    z.strictObject({
      tipo: z.literal("alimento"),
      valor: z
        .string()
        .refine((id) => Boolean(container.knowledge.alimento(id)), "alimento_desconhecido"),
    }),
    z.strictObject({
      tipo: z.literal("texto"),
      valor: z.string().trim().min(1).max(limites.evitar.textoLivreCaracteres),
    }),
  ])
  return z.union([
    z.strictObject({
      passo: z.literal("pronto"),
      itens: z.array(itemDeEvitar).min(1).max(limites.evitar.maxItens),
    }),
    z.strictObject({ passo: z.enum(["nenhum", "pulou"]) }),
  ])
}

const fusoValido = (fuso: string): boolean => {
  try {
    Intl.DateTimeFormat("pt-BR", { timeZone: fuso }).resolvedOptions()
    return true
  } catch {
    return false
  }
}

const cidadeSchema = z.strictObject({
  nome: z.string().trim().min(1).max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  fuso: z.string().refine(fusoValido, "fuso_invalido"),
})

const perfilSchema = z.strictObject({
  dosha: z.union([z.literal("quiz"), z.literal("adiado"), z.array(doshaSchema)]),
  cidade: cidadeSchema.nullable(),
})

function schemaDoQuiz(container: Container) {
  const itemDoQuiz = z.strictObject({ pergunta_id: z.string(), dosha: doshaSchema })
  return z.strictObject({
    respostas: z.array(itemDoQuiz).superRefine((respostas, ctx) => {
      const ids = container.knowledge.quiz.map((pergunta) => pergunta.id)
      const enviados = respostas.map((r) => r.pergunta_id)
      const completo =
        enviados.length === ids.length &&
        new Set(enviados).size === enviados.length &&
        enviados.every((id) => ids.includes(id))
      if (!completo) ctx.addIssue({ code: "custom", message: "respostas_do_quiz_invalidas" })
    }),
  })
}

// Lido depois da gravação: o passo seguinte depende do que acabou de ser marcado.
async function proximoDepois(container: Container, contaId: string): Promise<string> {
  const conta = await container.stores.accounts.buscar(contaId)
  if (!conta) throw new RituError("conta_inexistente", "A conta sumiu durante o onboarding")
  const perfil = await container.stores.profiles.ler(contaId)
  return ROTA_DO_PASSO[proximoPasso(conta, perfil)]
}

export function rotasDeOnboarding(deps: DepsDaRota) {
  const aviso = criarRota(deps, {}, async ({ conta, container }) => {
    await container.stores.accounts.marcar(conta.id, { aviso_aceito_em: agoraIso(container) })
    return { proximo: await proximoDepois(container, conta.id) }
  })

  const evitar = criarRota(
    deps,
    { corpo: schemaDoEvitar(deps.container) },
    async ({ conta, corpo, container }) => {
      if (corpo.passo === "pronto") {
        await container.stores.profiles.acrescentarEvitarSempre(conta.id, corpo.itens)
      }
      await container.stores.accounts.marcar(conta.id, { evitar_passo: corpo.passo })
      return { proximo: await proximoDepois(container, conta.id) }
    },
  )

  const perfil = criarRota(deps, { corpo: perfilSchema }, async ({ conta, corpo, container }) => {
    // Valida a lista antes de gravar qualquer coisa.
    const prakriti = Array.isArray(corpo.dosha) ? prakritiDeclarada(corpo.dosha) : undefined
    if (corpo.cidade) await container.stores.profiles.definirCidade(conta.id, corpo.cidade)
    if (prakriti) await container.stores.profiles.definirPrakriti(conta.id, prakriti, "declarado")
    if (corpo.dosha === "adiado") {
      await container.stores.accounts.marcar(conta.id, { dosha_adiado_em: agoraIso(container) })
    }
    if (corpo.dosha === "quiz") return { proximo: ROTA_DO_QUIZ }
    return { proximo: await proximoDepois(container, conta.id) }
  })

  const quiz = criarRota(
    deps,
    { corpo: schemaDoQuiz(deps.container) },
    async ({ conta, corpo, container }) => {
      const resultado = calcularQuiz(corpo.respostas.map((r) => r.dosha))
      await container.stores.profiles.definirPrakriti(conta.id, resultado.prakriti, "quiz")
      return {
        nome: nomeDoDosha(resultado.prakriti, container.knowledge),
        doshas: resultado.doshas,
        dual: resultado.dual,
      }
    },
  )

  return { aviso, evitar, perfil, quiz }
}

function agoraIso(container: Container): string {
  return container.clock.now().toISOString()
}
