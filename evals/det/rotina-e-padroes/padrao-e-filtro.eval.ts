import { describe, expect, it } from "vitest"
import type { PedidoDePasso } from "@/core/runs/agent-runtime"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import {
  type DepsDoCenario,
  montarCenario,
  type RodadaDoCenario,
  rodarCenario,
} from "../../../test/fixtures/cenarios"
import {
  padraoConfirmado,
  roteiroDoJantar,
} from "../../../test/fixtures/cenarios/padrao-confirmado"
import type { Cenario } from "../../../test/fixtures/cenarios/tipos"

// Padrão e filtro: um padrão confirmado ou candidato que a pessoa passou a barrar (evitar sempre, não como, não gosto,
// restrição) não vai ao prompt do Acompanhante nem ao bloco de aprovação. Sem a barreira, o mesmo padrão entra.

type Contexto = { padroes?: string[] }

// O contexto que vai na primeira mensagem de cada passo do Acompanhante (o mesmo que os evals de decisão e de nota leem).
function contextoDo(pedido: PedidoDePasso | undefined): Contexto | undefined {
  const mensagem = pedido?.mensagens[0]
  const conteudo = mensagem && mensagem.papel === "pessoa" ? mensagem.conteudo : ""
  const m = /^<contexto>\n([\s\S]*)\n<\/contexto>/.exec(conteudo)
  return m ? (JSON.parse(m[1] ?? "") as Contexto) : undefined
}

type Padrao = { chave: string; frase: string }

const CHA_CANELA: Padrao = {
  chave: "com_frio+agitada|pratica:cha-gengibre-canela",
  frase: "Quando você está com frio e agitada, chá de gengibre com canela costuma te ajudar.",
}

const CHA_LIMAO_MEL: Padrao = {
  chave: "com_frio|pratica:cha-gengibre-limao-mel",
  frase: "Quando você está com frio, chá de gengibre com limão e mel costuma te ajudar.",
}

// Cada barreira põe a pessoa contra um padrão (o chá de gengibre com canela, ou o de limão e mel, que tem "vegana" em nunca_sugerir_se).
type Barreira = {
  nome: string
  padrao: Padrao
  barrar: (deps: DepsDoCenario, contaId: string) => Promise<void>
}

const BARREIRAS: Barreira[] = [
  {
    nome: "evitar sempre",
    padrao: CHA_CANELA,
    barrar: (deps, contaId) =>
      deps.stores.profiles.acrescentarEvitarSempre(contaId, [
        { tipo: "alimento", valor: "gengibre" },
      ]),
  },
  {
    nome: "não como",
    padrao: CHA_CANELA,
    barrar: (deps, contaId) =>
      deps.stores.profiles.definirNaoCome(contaId, [{ tipo: "alimento", valor: "gengibre" }]),
  },
  {
    nome: "não gosto",
    padrao: CHA_CANELA,
    barrar: (deps, contaId) =>
      deps.stores.preferences.definirGosto(
        contaId,
        { tipo: "alimento", id: "gengibre" },
        "nao_gosta",
      ),
  },
  {
    nome: "restrição",
    padrao: CHA_LIMAO_MEL,
    barrar: (deps, contaId) => deps.stores.profiles.definirRestricoes(contaId, ["vegana"]),
  },
]

// Cenário do momento com frio e agitada, sem histórico nem detecção: o padrão entra semeado com o status dado.
function cenarioCom(status: "confirmado" | "candidato", padrao: Padrao): Cenario {
  return {
    ...padraoConfirmado,
    historico: undefined,
    detectar: undefined,
    aprovacao: undefined,
    depois: undefined,
    padroes: [
      {
        tipo: "ajuda_em_estado",
        chave: padrao.chave,
        frase: padrao.frase,
        ocorrencias: 3,
        status,
      },
    ],
  }
}

// A segunda mensagem do cenário (o jantar, sem gengibre na resposta): com o chá barrado, a resposta do agente precisa continuar
// sendo do agente, senão o bloco some por outro motivo e o teste passaria sem provar a barreira.
function cenarioDoJantar(padrao: Padrao): Cenario {
  const jantar = padraoConfirmado.depois
  if (!jantar) throw new Error("cenário padrao-confirmado sem a segunda mensagem")
  return {
    ...cenarioCom("candidato", padrao),
    mensagem: jantar.mensagem,
    interpretacao: jantar.interpretacao,
    // Arroz com legume segue entre os candidatos mesmo com a restrição vegana (legumes assados pedem gordura, e o ghee sai).
    roteiro: roteiroDoJantar("arroz-com-legume"),
  }
}

// Monta e roda o cenário; com barreira, a barreira entra depois de montado e antes da mensagem.
async function rodar(c: Cenario, barreira?: Barreira) {
  const runtime = createScriptedRuntime(c.roteiro)
  const { contaId, deps } = await montarCenario(c, { runtime })
  if (barreira) await barreira.barrar(deps, contaId)
  const rodada: RodadaDoCenario = await rodarCenario(deps, contaId, c)
  return { contaId, deps, runtime, rodada }
}

function ferramentasDoBloco(rodada: RodadaDoCenario): string[] {
  return (rodada.final.saida?.propostas ?? []).map((p) => p.tool)
}

describe("padrão confirmado barrado não vai ao prompt", () => {
  it.each(BARREIRAS)(
    "$nome: sem a barreira, a frase vai ao contexto; com ela, o contexto sai sem a frase",
    async (b) => {
      const c = cenarioCom("confirmado", b.padrao)

      const sem = await rodar(c)
      expect(contextoDo(sem.runtime.pedidos[0])?.padroes).toEqual([b.padrao.frase])

      const com = await rodar(c, b)
      const contexto = contextoDo(com.runtime.pedidos[0])
      expect(contexto).toBeDefined()
      expect(contexto?.padroes ?? []).toEqual([])
    },
  )
})

describe("candidato barrado não vai ao bloco de aprovação", () => {
  it.each(BARREIRAS)(
    "$nome: sem a barreira, a linha padrao.confirmar entra no bloco; com ela, não entra e o padrão segue candidato",
    async (b) => {
      const c = cenarioDoJantar(b.padrao)

      const sem = await rodar(c)
      expect(sem.rodada.final.saida?.origem).toBe("agente")
      expect(ferramentasDoBloco(sem.rodada)).toContain("padrao.confirmar")

      const com = await rodar(c, b)
      expect(com.rodada.final.saida?.origem).toBe("agente")
      expect(ferramentasDoBloco(com.rodada)).not.toContain("padrao.confirmar")
      expect(await com.deps.stores.patterns.listar(com.contaId, "candidato")).toHaveLength(1)
    },
  )
})
