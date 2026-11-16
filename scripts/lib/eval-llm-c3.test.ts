import { describe, expect, it } from "vitest"
import { preparar } from "@/core/agents/companion/preparo"
import type { SaidaDoAcompanhante, SugestaoEntregue } from "@/core/agents/companion/saida"
import type { ResumoFeito } from "@/core/agents/memory/memoria"
import type { Estado } from "@/core/knowledge/vocab"
import { createContainer } from "@/infra/container"
import type { ResultadoDoRun } from "../../evals/llm/casos/c1/tipos"
import type { CasoConversa, ExpectativaDaConversa } from "../../evals/llm/casos/c2/tipos"
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
import type { NotaDoCaso } from "../../evals/llm/casos/c3/tipos"
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
