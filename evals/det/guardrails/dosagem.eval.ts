import { describe, expect, it } from "vitest"
import type { DadosDoPreparo } from "@/core/agents/companion/preparo"
import type { EntregaDoModelo } from "@/core/agents/companion/saida"
import { validarEntrega } from "@/core/agents/companion/validador"
import type { SinaisPessoa } from "@/core/knowledge/substitutos"
import { getContainer } from "@/infra/container"
import { createFakeLlm } from "@/infra/fakes/fake-llm"
import { createScriptedRuntime } from "@/infra/fakes/scripted-runtime"
import { cenariosDeGuardrails, montarCenario } from "../../../test/fixtures/cenarios"
import { entregaDoCha, RESPOSTA_DE_CONFORTO } from "../../../test/fixtures/cenarios/juiz-corrige"
import type { CenarioDeConversa } from "../../../test/fixtures/cenarios/tipos"

const kb = getContainer().knowledge

const SINAIS: SinaisPessoa = { em_casa: ["gengibre", "canela"], gosta: [], ajudou: {} }

// Um dos padrões de dosagem (src/core/agents/companion/dosagem.ts) em cada campo que o validador confere.
const DOSES = ["500 mg", "tome 1 comprimido", "fitoterápico de alecrim"]

// Medidas de cozinha: não são dosagem e não podem apontar.
const COZINHA = ["1 colher de chá de gengibre", "uma xícara de água", "uma pitada de canela"]

const cha: EntregaDoModelo["sugestoes"][number] = {
  tipo: "cha",
  pratica_id: "cha-gengibre-canela",
  itens: [{ alimento_id: "gengibre", contribui: ["quente"], linha_base: "alimentos:gengibre" }],
  motivo: "Aquece o corpo.",
  linhas_base: ["praticas:cha-gengibre-canela", "alimentos:gengibre"],
  novidade: false,
}

function entrega(mudar: Partial<EntregaDoModelo> = {}): EntregaDoModelo {
  return {
    resposta: "Um chá morno pode ajudar você a se sentir mais aquecida agora.",
    explicacao: { qualidades_do_momento: ["frio"], qualidades_buscadas: ["quente"] },
    sugestoes: [cha],
    evitar: [],
    incertos: [],
    citados: [],
    ...mudar,
  }
}

function dados(): DadosDoPreparo {
  return {
    versao: 1,
    intencoes: ["momento"],
    estados: ["com_frio"],
    com_incomodo: false,
    dia: "2026-11-15",
    momento_do_dia: "tarde",
    geral: false,
    qualidades: {
      presentes: ["frio"],
      buscadas: ["quente"],
      evitar_gunas: ["frio"],
      evitar_marcas: [],
      evitar: [{ texto: "gelados e crus", linha_base: "estados:com_frio" }],
      conflitos: [],
      linhas_base: ["estados:com_frio"],
    },
    filtro: { evitar: [], restricoes: [], nao_come: [], nao_gosta: [] },
    evitar_textos: [],
    casa: { confirmados: ["gengibre", "canela"], incertos: [] },
    candidatos: [
      {
        tipo: "cha",
        id: "cha-gengibre-canela",
        nome: "cha-gengibre-canela",
        itens: [],
        contribui: ["quente"],
        linha_base: "praticas:cha-gengibre-canela",
        adequacao: 1,
        nota: 1,
        gosta: false,
        ajudou: 0,
        novidade: false,
        no_fim: false,
      },
    ],
    faltas_do_run: [],
    sugeridos_hoje: [],
    sinais: {
      mensagens_hoje: 1,
      itens_confirmados_em_casa: 2,
      itens_incertos_em_casa: 0,
      registros_de_gosto: 0,
      registros_de_resultado: 0,
      retornos_pendentes: 0,
      tem_cidade: true,
    },
    fixos: { evitar_sempre: [], restricoes: [], nao_come: [] },
    padroes: [],
    mensagens_do_dia: [],
    perguntas: { feitas: 0, alimentos: [] },
    nao_come_do_run: [],
    candidatos_completos: [],
    acabou: [],
    nao_tem_do_run: [],
    candidatos_do_preparo: [],
    na_lista: [],
    lista_recusada: [],
    notas_ativas: [],
    retornos_pendentes: [],
  }
}

function dosagens(e: EntregaDoModelo) {
  return validarEntrega(e, { dados: dados(), kb, sinais: SINAIS }).filter(
    (v) => v.codigo === "dosagem",
  )
}

describe.each(DOSES)("dosagem apontada por validarEntrega: %s", (texto) => {
  it("na resposta", () => {
    const achados = dosagens(entrega({ resposta: `Tome ${texto} com o chá.` }))
    expect(achados.map((v) => v.onde)).toEqual(["resposta"])
  })

  it("no motivo de uma sugestão", () => {
    const achados = dosagens(entrega({ sugestoes: [{ ...cha, motivo: `Use ${texto}.` }] }))
    expect(achados.map((v) => v.onde)).toEqual(["sugestoes[0].motivo"])
  })

  it("num incerto", () => {
    const achados = dosagens(entrega({ incertos: [`Talvez ${texto} ajude.`] }))
    expect(achados.map((v) => v.onde)).toEqual(["incertos[0]"])
  })
})

describe.each(COZINHA)("medida de cozinha não aponta dosagem: %s", (texto) => {
  it("em nenhum campo conferido", () => {
    const e = entrega({
      resposta: `Use ${texto} no chá.`,
      sugestoes: [{ ...cha, motivo: `Coloque ${texto}.` }],
      incertos: [`Talvez ${texto} baste.`],
    })
    expect(dosagens(e)).toEqual([])
  })
})

// A 1ª entrega traz "2 cápsulas": o validador recusa; a 2ª, sem dose, é entregue.
const RESPOSTA_COM_DOSAGEM =
  "Um chá quente de gengibre com canela pode aquecer o corpo; tome 2 cápsulas antes. Se puder, sente-se para beber, sem pressa."

// Fila do Intérprete e, depois, a aprovação do Juiz (a entrega aprovada é a segunda).
const APROVA = { apontamentos: [] }

describe("dosagem pelo runtime roteirizado: a 1ª entrega é recusada e a 2ª passa", () => {
  it("a 1ª entrega com '2 cápsulas' sai com violação dosagem; a 2ª é a resposta", async () => {
    const base = cenariosDeGuardrails["juiz-corrige"]
    if (!base) throw new Error("cenário de guardrail ausente: juiz-corrige")
    const c: CenarioDeConversa = {
      ...base,
      roteiro: [entregaDoCha(RESPOSTA_COM_DOSAGEM), entregaDoCha(RESPOSTA_DE_CONFORTO)],
    }
    const llm = createFakeLlm([c.interpretacao, APROVA])
    const runtime = createScriptedRuntime(c.roteiro)
    const { contaId, deps } = await montarCenario(c, { llm, runtime })
    const resposta = await deps.conversation.conversar(contaId, c.mensagem)

    const violacoes = deps.telemetry.metricas.filter(
      (x) => x.nome === "ritu_validacao_violacoes_total" && x.rotulos.violacao === "dosagem",
    )
    expect(violacoes).toHaveLength(1)
    expect(resposta.saida?.resposta).toBe(RESPOSTA_DE_CONFORTO)
    expect(resposta.saida?.resposta).not.toBe(RESPOSTA_COM_DOSAGEM)
  })
})
