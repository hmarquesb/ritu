import { describe, expect, it } from "vitest"
import { preparar } from "@/core/agents/companion/preparo"
import {
  type SaidaDoAcompanhante,
  type SugestaoEntregue,
  saidaDoAcompanhanteSchema,
} from "@/core/agents/companion/saida"
import { montarEntradaDoJuiz } from "@/core/agents/judge/entrada"
import type { Veredito } from "@/core/agents/judge/julgar"
import type { MotivoDoJuiz } from "@/core/agents/judge/saida"
import type { ResumoFeito } from "@/core/agents/memory/memoria"
import { textosDaConversa } from "@/core/conversation/textos"
import { conferirEntrada } from "@/core/guardrails/entrada"
import type { Estado } from "@/core/knowledge/vocab"
import { createContainer } from "@/infra/container"
import type { ResultadoDoRun } from "../../evals/llm/casos/c1/tipos"
import type { CasoConversa, ExpectativaDaConversa } from "../../evals/llm/casos/c2/tipos"
import { casosC3 } from "../../evals/llm/casos/c3"
import {
  aponta,
  aprovado,
  naoAponta,
  nenhumApontamento,
  reprovado,
  vereditoValido,
} from "../../evals/llm/casos/c3/juiz/expectativas"
import { casoMemoria06 } from "../../evals/llm/casos/c3/memoria/06-almoco-fora-sem-cozinhar"
import { casoMemoria07 } from "../../evals/llm/casos/c3/memoria/07-cha-com-padrao"
import { casoMemoria08 } from "../../evals/llm/casos/c3/memoria/08-cha-fora-dos-candidatos"
import {
  ateTeto,
  dizQueCostumaAjudar,
  naoSugere,
  origem,
  resumoFala,
  resumoNaoFala,
  resumoNaoVazio,
  semRefeicao,
  soDosCandidatos,
  sugere,
  trazAsMaisRecentes,
  umaFraseSobre,
} from "../../evals/llm/casos/c3/memoria/expectativas"
import {
  aprovadoPeloJuiz,
  caminho,
  comAvisoDeIncomodo,
  juizNaoApontou,
  semDosagem,
  semPromessa,
  semTexto,
  textoFixo,
} from "../../evals/llm/casos/c3/seguranca/expectativas"
import type { CasoJuiz, NotaDoCaso } from "../../evals/llm/casos/c3/tipos"
import { montarCenario } from "../../test/fixtures/cenarios/montar"

type EntradaDaConversa = Parameters<ExpectativaDaConversa["confere"]>[0]

const resumoCom = (
  texto: string,
  origemDoResumo: ResumoFeito["origem"] = "modelo",
): ResumoFeito => ({
  texto,
  origem: origemDoResumo,
  tokens: { entrada: 0, saida: 0 },
  trocas: 0,
  duracao_ms: 0,
})

// Um resumo e as notas do caso, para as expectativas de Memória.
const entradaMemoria = (
  texto: string,
  notas: NotaDoCaso[] = [],
  origemDoResumo?: ResumoFeito["origem"],
) => ({
  resumo: resumoCom(texto, origemDoResumo),
  notas,
})

const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
  origem: "agente",
  resposta: "Um chá morno.",
  geral: false,
  avisos: [],
  explicacao: { qualidades_do_momento: [], qualidades_buscadas: [] },
  sugestoes: [],
  evitar: [],
  incertos: [],
  citados: [],
  anotacoes: [],
  propostas: [],
  ...p,
})

const cha = (praticaId: string): SugestaoEntregue => ({
  tipo: "cha",
  pratica_id: praticaId,
  titulo: "Chá",
  como_fazer: "Ferva e sirva.",
  motivo: "Aquece.",
  linhas_base: [],
  novidade: false,
  verbos: [],
  itens: [],
})

const refeicao: SugestaoEntregue = {
  tipo: "refeicao",
  preparo_id: "arroz-com-legume",
  titulo: "Arroz com legumes",
  como_fazer: "Cozinhe e sirva morno.",
  motivo: "Acalma.",
  linhas_base: [],
  novidade: false,
  verbos: [],
  itens: [],
}

const resultadoCom = (saida: SaidaDoAcompanhante): ResultadoDoRun => ({
  saida,
  status: "done",
  tools: [],
  chamadasDeModelo: 1,
  validacoes: ["ok"],
})

const entradaConversa = (saida: SaidaDoAcompanhante): EntradaDaConversa => ({
  resposta: { run_id: "run-eval", status: "done", caminho: "acompanhante" },
  resultado: resultadoCom(saida),
  perguntas: [],
  recusadas: 0,
  llmAntesDaPrimeiraPausa: 0,
  propostas: [],
  propostasRecusadas: 0,
  retornosFechados: [],
  juiz: { tentativas: 0, aprovado: null, motivos: [] },
})

// Notas com uma palavra própria cada (a marca), e o resto igual: a marca é o que a expectativa procura.
const notaComMarca = (marca: string, diasAtras: number): NotaDoCaso => ({
  texto: `Ela fez ${marca} na rotina desta semana.`,
  diasAtras,
})

describe("expectativas da Memória (resumo)", () => {
  it("resumoFala passa quando o resumo traz a palavra, sem acento e sem caixa", () => {
    expect(resumoFala("casa").confere(entradaMemoria("Almoça em Casa."))).toBe(true)
    expect(resumoFala("casa").confere(entradaMemoria("Almoça fora."))).toBe(false)
  })

  it("resumoNaoFala passa quando o resumo não traz a palavra", () => {
    expect(resumoNaoFala("fora").confere(entradaMemoria("Almoça em casa."))).toBe(true)
    expect(resumoNaoFala("fora").confere(entradaMemoria("Almoça fora."))).toBe(false)
  })

  it("resumoNaoVazio passa com texto e falha com resumo vazio", () => {
    expect(resumoNaoVazio().confere(entradaMemoria("Gosta de caminhar."))).toBe(true)
    expect(resumoNaoVazio().confere(entradaMemoria("   "))).toBe(false)
  })

  it("ateTeto passa até 1200 caracteres e falha acima", () => {
    expect(ateTeto().confere(entradaMemoria("a".repeat(1200)))).toBe(true)
    expect(ateTeto().confere(entradaMemoria("a".repeat(1201)))).toBe(false)
  })

  it("trazAsMaisRecentes(2) passa quando o resumo traz a marca das duas notas mais recentes", () => {
    const notas = [
      notaComMarca("caminhada", 1),
      notaComMarca("leitura", 2),
      notaComMarca("pilates", 9),
    ]
    const exp = trazAsMaisRecentes(2)
    expect(exp.confere(entradaMemoria("Faz caminhada e leitura.", notas))).toBe(true)
    expect(exp.confere(entradaMemoria("Faz caminhada e pilates.", notas))).toBe(false)
  })

  it("umaFraseSobre passa quando só uma frase traz a palavra", () => {
    const exp = umaFraseSobre("cedo")
    expect(exp.confere(entradaMemoria("Acorda cedo. Dorme tarde."))).toBe(true)
    expect(exp.confere(entradaMemoria("Acorda cedo. Levanta cedo."))).toBe(false)
    expect(exp.confere(entradaMemoria("Dorme tarde."))).toBe(false)
  })

  it("origem confere a origem do resumo", () => {
    expect(origem("modelo").confere(entradaMemoria("Gosta de chá.", [], "modelo"))).toBe(true)
    expect(origem("modelo").confere(entradaMemoria("Gosta de chá.", [], "codigo"))).toBe(false)
  })
})

describe("expectativas da conversa (sugestões)", () => {
  it("sugere passa quando há sugestão com esse pratica_id, e falha sem ela", () => {
    const com = entradaConversa(saidaPronta({ sugestoes: [cha("cha-gengibre-canela")] }))
    const sem = entradaConversa(saidaPronta({ sugestoes: [refeicao] }))
    expect(sugere("cha-gengibre-canela").confere(com)).toBe(true)
    expect(sugere("cha-gengibre-canela").confere(sem)).toBe(false)
  })

  it("naoSugere é o contrário de sugere", () => {
    const com = entradaConversa(saidaPronta({ sugestoes: [cha("cha-gengibre-canela")] }))
    const sem = entradaConversa(saidaPronta({ sugestoes: [refeicao] }))
    expect(naoSugere("cha-gengibre-canela").confere(com)).toBe(false)
    expect(naoSugere("cha-gengibre-canela").confere(sem)).toBe(true)
  })

  it("semRefeicao passa sem sugestão de refeição e falha com uma", () => {
    expect(
      semRefeicao().confere(
        entradaConversa(saidaPronta({ sugestoes: [cha("cha-gengibre-canela")] })),
      ),
    ).toBe(true)
    expect(semRefeicao().confere(entradaConversa(saidaPronta({ sugestoes: [refeicao] })))).toBe(
      false,
    )
  })

  it("dizQueCostumaAjudar passa quando a resposta diz que costuma ajudar", () => {
    expect(
      dizQueCostumaAjudar().confere(
        entradaConversa(saidaPronta({ resposta: "Esse chá costuma ajudar." })),
      ),
    ).toBe(true)
    expect(
      dizQueCostumaAjudar().confere(entradaConversa(saidaPronta({ resposta: "Esse chá ajuda." }))),
    ).toBe(false)
  })

  it("soDosCandidatos passa com ids da base e falha com um id inventado", () => {
    const ok = saidaPronta({ sugestoes: [cha("cha-gengibre-canela")] })
    const inventada = saidaPronta({ sugestoes: [cha("cha-inventado-xyz")] })
    expect(soDosCandidatos().confere(entradaConversa(ok))).toBe(true)
    expect(soDosCandidatos().confere(entradaConversa(inventada))).toBe(false)
  })
})

describe("cenários dos casos 6 a 8", () => {
  const ESTADOS_DO_CHA: Estado[] = ["com_frio"]

  // Monta o cenário (sem roteiro) e lê os candidatos que o preparo do momento daria, com os estados do Intérprete.
  async function preparoDoCaso(cenario: CasoConversa["cenario"], estados: Estado[]) {
    const { contaId, deps } = await montarCenario({ ...cenario, roteiro: [] })
    const dados = await preparar(
      {
        stores: deps.stores,
        kb: createContainer().knowledge,
        clock: deps.clock,
        telemetry: deps.telemetry,
      },
      contaId,
      { texto: cenario.mensagem.texto, intencoes: ["momento"], estados, evitar_da_mensagem: [] },
    )
    return dados
  }

  async function candidatosDoCaso(
    cenario: CasoConversa["cenario"],
    estados: Estado[],
  ): Promise<string[]> {
    return (await preparoDoCaso(cenario, estados)).candidatos.map((c) => c.id)
  }

  it("os casos 6 a 8 montam sem erro", async () => {
    for (const caso of [casoMemoria06, casoMemoria07, casoMemoria08]) {
      await expect(montarCenario({ ...caso.cenario, roteiro: [] })).resolves.toBeDefined()
    }
  })

  it("o chá está nos candidatos do caso 7", async () => {
    expect(await candidatosDoCaso(casoMemoria07.cenario, ESTADOS_DO_CHA)).toContain(
      "cha-gengibre-canela",
    )
  })

  it("o chá está fora dos candidatos do caso 8, à noite", async () => {
    expect(await candidatosDoCaso(casoMemoria08.cenario, ESTADOS_DO_CHA)).not.toContain(
      "cha-gengibre-canela",
    )
  })

  it("o caso 8 mantém o padrão em dados.padroes (saiu pelo horário, não pelo filtro)", async () => {
    const dados = await preparoDoCaso(casoMemoria08.cenario, ESTADOS_DO_CHA)
    expect(dados.padroes).toContain(casoMemoria08.cenario.padroes?.[0]?.frase)
  })

  it("controle: o mesmo caso à tarde põe o chá nos candidatos", async () => {
    const aTarde = { ...casoMemoria08.cenario, agora: "2026-06-15T19:30:00.000Z" }
    expect(await candidatosDoCaso(aTarde, ESTADOS_DO_CHA)).toContain("cha-gengibre-canela")
  })
})

// Veredito lido do Juiz, com os motivos apontados (ok: true), ou uma leitura que falhou.
const vereditoOk = (motivos: MotivoDoJuiz[] = [], aprovadoDoVeredito = true): Veredito => ({
  ok: true,
  aprovado: aprovadoDoVeredito,
  graves: [],
  registros: [],
  saude_na_proposta: false,
  apontamentos: motivos.map((motivo) => ({ motivo, trecho: "trecho" })),
  modelo: "modelo-teste",
  tokens: { entrada: 0, saida: 0 },
  trocas: 0,
  duracao_ms: 0,
})

const vereditoErro: Veredito = { ok: false, motivo: "erro", duracao_ms: 0 }

// Os casos do Juiz (1 a 13) e os de conversa novos (14 a 22), pelo id.
const casosJuiz = casosC3.filter((c): c is CasoJuiz => c.tipo === "juiz")
const novosDeConversa = casosC3.filter(
  (c): c is CasoConversa => c.tipo === "conversa" && /^c3-s\d{2}-/.test(c.id),
)

describe("casos novos do c3 (Juiz e segurança)", () => {
  it("casosC3 tem 30 casos, com ids únicos", () => {
    expect(casosC3).toHaveLength(30)
    expect(new Set(casosC3.map((c) => c.id)).size).toBe(30)
  })

  it("13 casos de Juiz, todos da família juiz", () => {
    expect(casosJuiz).toHaveLength(13)
    expect(casosJuiz.every((c) => c.familia === "juiz")).toBe(true)
  })

  it("9 casos de conversa novos, com as famílias da tabela", () => {
    expect(novosDeConversa).toHaveLength(9)
    const familias: Record<string, string> = {
      "14": "seguranca",
      "15": "seguranca",
      "16": "seguranca",
      "17": "incomodos",
      "18": "linguagem",
      "19": "linguagem",
      "20": "linguagem",
      "21": "linguagem",
      "22": "incomodos",
    }
    for (const [numero, familia] of Object.entries(familias)) {
      const caso = novosDeConversa.find((c) => c.id.startsWith(`c3-s${numero}-`))
      expect(caso?.familia).toBe(familia)
    }
  })

  it("os casos boa são 1, 3, 5 e 10", () => {
    const boa = casosJuiz.filter((c) => c.boa === true).map((c) => c.id.slice(0, 9))
    expect(boa).toEqual(["c3-j01-re", "c3-j03-po", "c3-j05-co", "c3-j10-is"])
  })

  it("as saídas dos casos de Juiz passam em saidaDoAcompanhanteSchema", () => {
    for (const caso of casosJuiz) {
      expect(saidaDoAcompanhanteSchema.safeParse(caso.saida).success).toBe(true)
    }
  })

  it("montarEntradaDoJuiz de cada caso de Juiz monta sem erro", () => {
    const kb = createContainer().knowledge
    for (const caso of casosJuiz) {
      const entrada = montarEntradaDoJuiz({
        saida: caso.saida,
        evitar: caso.evitar,
        nota_de_rotina: caso.nota_de_rotina,
        kb,
      })
      expect(entrada.length).toBeGreaterThan(0)
    }
  })

  it("os cenários dos casos 14 a 22 montam sem erro", async () => {
    for (const caso of novosDeConversa) {
      await expect(montarCenario({ ...caso.cenario, roteiro: [] })).resolves.toBeDefined()
    }
  })

  it("as frases dos casos 14 e 19 dão ok em conferirEntrada", () => {
    for (const numero of ["14", "19"]) {
      const caso = novosDeConversa.find((c) => c.id.startsWith(`c3-s${numero}-`))
      expect(conferirEntrada(caso?.cenario.mensagem.texto ?? "").resultado).toBe("ok")
    }
  })
})

describe("expectativas do Juiz", () => {
  it("vereditoValido passa com veredito ok e falha com erro de leitura", () => {
    expect(vereditoValido().confere(vereditoOk())).toBe(true)
    expect(vereditoValido().confere(vereditoErro)).toBe(false)
  })

  it("aponta passa quando o motivo foi apontado, e falha sem ele ou sem leitura", () => {
    expect(aponta("promessa").confere(vereditoOk(["promessa"]))).toBe(true)
    expect(aponta("promessa").confere(vereditoOk([]))).toBe(false)
    expect(aponta("promessa").confere(vereditoErro)).toBe(false)
  })

  it("naoAponta passa sem o motivo, e falha com ele", () => {
    expect(naoAponta("dosagem").confere(vereditoOk(["promessa"]))).toBe(true)
    expect(naoAponta("dosagem").confere(vereditoOk(["dosagem"]))).toBe(false)
  })

  it("aprovado passa com aprovação e falha com reprovação", () => {
    expect(aprovado().confere(vereditoOk([], true))).toBe(true)
    expect(aprovado().confere(vereditoOk(["promessa"], false))).toBe(false)
  })

  it("reprovado passa com reprovação e falha com aprovação", () => {
    expect(reprovado().confere(vereditoOk(["promessa"], false))).toBe(true)
    expect(reprovado().confere(vereditoOk([], true))).toBe(false)
  })

  it("nenhumApontamento passa sem apontamento e falha com um de registro", () => {
    expect(nenhumApontamento().confere(vereditoOk([]))).toBe(true)
    expect(nenhumApontamento().confere(vereditoOk(["jargao"]))).toBe(false)
  })
})

describe("expectativas de segurança e linguagem", () => {
  const comCaminho = (c: Parameters<typeof caminho>[0]): EntradaDaConversa => ({
    ...entradaConversa(saidaPronta()),
    resposta: { run_id: "run-eval", status: "done", caminho: c },
  })

  it("caminho passa com o caminho pedido e falha com outro", () => {
    expect(caminho("fora").confere(comCaminho("fora"))).toBe(true)
    expect(caminho("fora").confere(comCaminho("acompanhante"))).toBe(false)
  })

  it("textoFixo passa com o texto fixo da chave e falha com outro texto", () => {
    expect(
      textoFixo("fora").confere(entradaConversa(saidaPronta({ resposta: textosDaConversa.fora }))),
    ).toBe(true)
    expect(textoFixo("fora").confere(entradaConversa(saidaPronta()))).toBe(false)
  })

  it("semTexto passa sem a palavra e falha com ela, sem caixa nem acento", () => {
    expect(semTexto("jejum").confere(entradaConversa(saidaPronta()))).toBe(true)
    expect(
      semTexto("jejum").confere(entradaConversa(saidaPronta({ resposta: "Evite JEJUM longo." }))),
    ).toBe(false)
  })

  it("semDosagem passa sem dose e falha com cápsula", () => {
    expect(semDosagem().confere(entradaConversa(saidaPronta()))).toBe(true)
    expect(
      semDosagem().confere(
        entradaConversa(saidaPronta({ resposta: "Tome 2 cápsulas de ashwagandha." })),
      ),
    ).toBe(false)
  })

  it("semDosagem pega a dose só em como_fazer, só em incertos e só em para_ter.motivo", () => {
    const emComoFazer = { ...cha("x"), como_fazer: "Tome 2 cápsulas de ashwagandha." }
    const emIncertos = entradaConversa(
      saidaPronta({ incertos: ["Tome 2 cápsulas de ashwagandha."] }),
    )
    const emParaTer = entradaConversa(
      saidaPronta({
        para_ter: {
          alimento_id: "ashwagandha",
          nome: "Ashwagandha",
          vezes: 2,
          contribui: [],
          linha_base: "",
          verbos: [],
          motivo: "Tome 2 cápsulas de ashwagandha.",
        },
      }),
    )
    expect(semDosagem().confere(entradaConversa(saidaPronta({ sugestoes: [emComoFazer] })))).toBe(
      false,
    )
    expect(semDosagem().confere(emIncertos)).toBe(false)
    expect(semDosagem().confere(emParaTer)).toBe(false)
  })

  it("semPromessa pega a promessa só no titulo e só num aviso", () => {
    const noTitulo = entradaConversa(
      saidaPronta({ sugestoes: [{ ...cha("x"), titulo: "Esse chá cura" }] }),
    )
    const noAviso = entradaConversa(
      saidaPronta({ avisos: [{ tipo: "geral", texto: "Isso resolve a dor." }] }),
    )
    expect(semPromessa().confere(noTitulo)).toBe(false)
    expect(semPromessa().confere(noAviso)).toBe(false)
  })

  it("semPromessa passa com 'não cura' e falha com promessa de cura ou de resolver", () => {
    const passa = entradaConversa(saidaPronta({ resposta: "Esse chá pode ajudar, mas não cura." }))
    const cura = entradaConversa(saidaPronta({ resposta: "Esse chá cura gastrite." }))
    const resolve = entradaConversa(saidaPronta({ resposta: "Esse chá resolve a dor." }))
    expect(semPromessa().confere(passa)).toBe(true)
    expect(semPromessa().confere(cura)).toBe(false)
    expect(semPromessa().confere(resolve)).toBe(false)
  })

  it("comAvisoDeIncomodo passa com aviso de incômodo e falha só com aviso geral", () => {
    const com = entradaConversa(saidaPronta({ avisos: [{ tipo: "incomodo", texto: "Aviso." }] }))
    const geral = entradaConversa(saidaPronta({ avisos: [{ tipo: "geral", texto: "Aviso." }] }))
    expect(comAvisoDeIncomodo().confere(com)).toBe(true)
    expect(comAvisoDeIncomodo().confere(geral)).toBe(false)
  })

  it("aprovadoPeloJuiz passa com juiz aprovado e falha com reprovado", () => {
    const base = entradaConversa(saidaPronta())
    expect(
      aprovadoPeloJuiz().confere({ ...base, juiz: { tentativas: 1, aprovado: true, motivos: [] } }),
    ).toBe(true)
    expect(
      aprovadoPeloJuiz().confere({
        ...base,
        juiz: { tentativas: 1, aprovado: false, motivos: ["promessa"] },
      }),
    ).toBe(false)
  })

  it("juizNaoApontou passa sem o motivo e falha com ele", () => {
    const base = entradaConversa(saidaPronta())
    expect(
      juizNaoApontou("conselho").confere({ ...base, juiz: { ...base.juiz, motivos: ["tom"] } }),
    ).toBe(true)
    expect(
      juizNaoApontou("conselho").confere({
        ...base,
        juiz: { ...base.juiz, motivos: ["conselho"] },
      }),
    ).toBe(false)
  })
})
