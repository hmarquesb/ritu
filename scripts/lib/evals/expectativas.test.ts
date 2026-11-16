import { describe, expect, it } from "vitest"
import type { ResultadoDoRun } from "../../../evals/llm/casos/c1"
import {
  apareceNasSugestoes,
  apontaComoFicou,
  chamouResultadoRegistrar,
  fechouRetorno,
  naoAparece,
  naoFechou,
  nenhumRetornoFechado,
  primeiroDoTipoNao,
} from "../../../evals/llm/casos/c2/aprendizado/expectativas"
import {
  caminho,
  campoVazio,
  ehSuspeito,
  evitaGrupo,
  itemDeCasa,
  naoCaminho,
  naoComeAlimento,
  retorno,
  semAlerta,
  semEstados,
  semIntencao,
  semMotivo,
  semPendente,
  semVariante,
  temAlerta,
  temCampo,
  temEstado,
  temIncomodo,
  temIntencao,
  temRestricao,
  temUmaDe,
} from "../../../evals/llm/casos/c2/intencao/expectativas"
import { comParaTer, semParaTer } from "../../../evals/llm/casos/c2/para-ter/expectativas"
import {
  itensNaPergunta,
  naoGostaDoPrimeiroTenhoOsOutros,
  naoPerguntou,
  naoTenhoATudo,
  nuncaPerguntou,
  pausouSemDecisao,
  perguntouCasa,
  perguntouNoMaximo,
  semItemNaoGostado,
  semItemNaSaida,
  semSegundaPerguntaSobre,
  sugestaoQueRefresca,
  temAvisoDeIncomodo,
  tenhoATudo,
  terminou,
} from "../../../evals/llm/casos/c2/perguntas/expectativas"
import {
  blocoComRestricao,
  blocoComRotina,
  chamouMemoriaPropor,
  listaNoMaximoUma,
  listaSoDe,
  nenhumaListaAceita,
  nenhumaProposta,
  semAlimentoBarrado,
} from "../../../evals/llm/casos/c2/propostas/expectativas"
import type {
  ExpectativaDaConversa,
  ExpectativaDoInterprete,
} from "../../../evals/llm/casos/c2/tipos"
import type {
  SaidaDoAcompanhante,
  SugestaoEntregue,
} from "../../../src/core/agents/companion/saida"
import type { Interpretacao } from "../../../src/core/agents/interpreter/interpretacao"
import type { PropostaNaSaida } from "../../../src/core/proposals/conteudo"
import type { Pergunta } from "../../../src/core/runs/pergunta"
import type { Caminho } from "../../../src/core/runs/ports"

const base: Interpretacao = {
  intencoes: ["momento"],
  estados: ["com_frio"],
  itens_casa: [],
  evitar: [],
  nao_come: [],
  gosta: [],
  restricoes: [],
  suspeito: false,
}

const passa = (
  e: ExpectativaDoInterprete,
  r: Partial<Interpretacao> & { caminho?: Caminho } = {},
): boolean => {
  const { caminho: c = "acompanhante", ...dados } = r
  return e.confere({ interpretacao: { ...base, ...dados }, caminho: c })
}

describe("expectativas do Intérprete", () => {
  it("temIntencao e semIntencao", () => {
    expect(passa(temIntencao("momento"), {})).toBe(true)
    expect(passa(temIntencao("casa"), {})).toBe(false)
    expect(passa(semIntencao("momento"), {})).toBe(false)
    expect(passa(semIntencao("casa"), {})).toBe(true)
  })

  it("temUmaDe passa se alguma das intenções está", () => {
    expect(passa(temUmaDe("vida", "momento"), {})).toBe(true)
    expect(passa(temUmaDe("vida", "pergunta"), {})).toBe(false)
  })

  it("temEstado e semEstados", () => {
    expect(passa(temEstado("com_frio"), {})).toBe(true)
    expect(passa(temEstado("sem_energia"), {})).toBe(false)
    expect(passa(semEstados(), { estados: [] })).toBe(true)
    expect(passa(semEstados(), {})).toBe(false)
  })

  it("temAlerta e semAlerta, com ou sem tipo", () => {
    expect(passa(temAlerta(), { alerta: "fisico" })).toBe(true)
    expect(passa(temAlerta(), {})).toBe(false)
    expect(passa(temAlerta("fisico"), { alerta: "emocional" })).toBe(false)
    expect(passa(semAlerta(), {})).toBe(true)
    expect(passa(semAlerta(), { alerta: "emocional" })).toBe(false)
  })

  it("temIncomodo e semVariante", () => {
    expect(passa(temIncomodo("dor-de-cabeca"), { incomodo: { id: "dor-de-cabeca" } })).toBe(true)
    expect(passa(temIncomodo("dor-de-cabeca"), {})).toBe(false)
    expect(passa(semVariante(), { incomodo: { id: "dor-de-cabeca" } })).toBe(true)
    expect(passa(semVariante(), { incomodo: { id: "dor-de-cabeca", variante: "tensa" } })).toBe(
      false,
    )
  })

  it("itemDeCasa confere alimento e ação", () => {
    const item = { alimento_id: "abobora", nome: "abóbora", acao: "tem" as const }
    expect(passa(itemDeCasa("abobora", "tem"), { itens_casa: [item] })).toBe(true)
    expect(passa(itemDeCasa("abobora", "acabou"), { itens_casa: [item] })).toBe(false)
    expect(passa(itemDeCasa("couve", "tem"), { itens_casa: [item] })).toBe(false)
  })

  it("retorno confere resultado e, se pedido, o pendente pela posição", () => {
    const r = { resultado: "ajudou" as const, retorno_id: "p1", titulo: "Chá" }
    expect(passa(retorno("ajudou"), { retorno: r })).toBe(true)
    expect(passa(retorno("ajudou", 1), { retorno: r })).toBe(true)
    expect(passa(retorno("ajudou", 2), { retorno: r })).toBe(false)
    expect(passa(retorno("nao_ajudou"), { retorno: r })).toBe(false)
    expect(passa(retorno("ajudou"), {})).toBe(false)
  })

  it("semPendente passa quando o retorno não aponta pendente", () => {
    expect(passa(semPendente(), { retorno: { resultado: "ajudou" } })).toBe(true)
    expect(passa(semPendente(), { retorno: { resultado: "ajudou", retorno_id: "p1" } })).toBe(false)
  })

  it("evitaGrupo confere o grupo em evitar", () => {
    const evitar = [{ tipo: "grupo" as const, valor: "frutos_do_mar" }]
    expect(passa(evitaGrupo("frutos_do_mar"), { evitar })).toBe(true)
    expect(passa(evitaGrupo("peixe"), { evitar })).toBe(false)
  })

  it("semMotivo procura as palavras em qualquer texto, sem acento nem caixa", () => {
    const evitar = [{ tipo: "grupo" as const, valor: "frutos_do_mar" }]
    expect(passa(semMotivo(["alergica", "alergia"]), { evitar })).toBe(true)
    expect(passa(semMotivo(["alergica", "alergia"]), { fato_de_rotina: "Sou ALÉRGICA" })).toBe(
      false,
    )
    expect(passa(semMotivo(["alergia"]), { nao_come: [{ nome: "alergia a leite" }] })).toBe(false)
  })

  it("naoComeAlimento confere o alimento em nao_come", () => {
    const nao_come = [{ alimento_id: "coentro-fresco", nome: "Coentro" }]
    expect(passa(naoComeAlimento("coentro-fresco"), { nao_come })).toBe(true)
    expect(passa(naoComeAlimento("manga"), { nao_come })).toBe(false)
  })

  it("temRestricao confere a restrição", () => {
    expect(passa(temRestricao("vegetariana"), { restricoes: ["vegetariana"] })).toBe(true)
    expect(passa(temRestricao("vegana"), { restricoes: ["vegetariana"] })).toBe(false)
  })

  it("caminho e naoCaminho conferem o caminho recebido", () => {
    expect(passa(caminho("acompanhante"), {})).toBe(true)
    expect(passa(caminho("fora"), {})).toBe(false)
    expect(passa(naoCaminho("fora"), {})).toBe(true)
    expect(passa(naoCaminho("acompanhante"), {})).toBe(false)
  })

  it("campoVazio e temCampo olham o campo da interpretação", () => {
    expect(passa(campoVazio("alerta"), {})).toBe(true)
    expect(passa(campoVazio("alerta"), { alerta: "fisico" })).toBe(false)
    expect(passa(campoVazio("evitar"), { evitar: [] })).toBe(true)
    expect(passa(temCampo("fato_de_rotina"), { fato_de_rotina: "almoço pesado" })).toBe(true)
    expect(passa(temCampo("fato_de_rotina"), {})).toBe(false)
  })

  it("ehSuspeito confere o flag suspeito", () => {
    expect(passa(ehSuspeito(), { suspeito: true })).toBe(true)
    expect(passa(ehSuspeito(), {})).toBe(false)
  })
})

describe("expectativas da conversa de Perguntas", () => {
  type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

  const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
    origem: "agente",
    resposta: "Um prato morno.",
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

  const sugestaoCom = (ids: string[], verbos: string[] = []): SugestaoEntregue => ({
    tipo: "refeicao",
    titulo: "Sopa morna",
    como_fazer: "Cozinhe e sirva quente.",
    motivo: "Esquenta.",
    linhas_base: [],
    novidade: false,
    verbos,
    itens: ids.map((id) => ({
      alimento_id: id,
      nome: id,
      contribui: [],
      verbos: [],
      linha_base: `alimentos:${id}`,
      casa: "confirmado",
    })),
  })

  const resultadoCom = (saida: SaidaDoAcompanhante): ResultadoDoRun => ({
    saida,
    status: "done",
    tools: [],
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  })

  const entrada = (p: Partial<Entrada> = {}): Entrada => ({
    resposta: { run_id: "run-eval", status: "done", caminho: "acompanhante" },
    resultado: resultadoCom(saidaPronta()),
    perguntas: [],
    recusadas: 0,
    llmAntesDaPrimeiraPausa: 0,
    propostas: [],
    propostasRecusadas: 0,
    retornosFechados: [],
    juiz: { tentativas: 0, aprovado: null, motivos: [] },
    ...p,
  })

  const casaCom = (ids: string[]): Entrada["perguntas"][number] => ({
    pergunta: {
      tipo: "casa",
      texto: "Você tem?",
      itens: ids.map((id) => ({ alimento_id: id, nome: id })),
    },
    resposta: { tipo: "pular" },
  })

  const variante: Entrada["perguntas"][number] = {
    pergunta: {
      tipo: "variante",
      texto: "Qual dor?",
      incomodo: "dor-de-cabeca",
      opcoes: [{ id: "latejante", texto: "latejante" }],
    },
    resposta: { tipo: "variante", variante: "latejante" },
  }

  const passa = (e: ExpectativaDaConversa, r: Partial<Entrada>): boolean => e.confere(entrada(r))

  it("perguntouCasa e naoPerguntou", () => {
    expect(passa(perguntouCasa(), { perguntas: [casaCom(["abobora"])] })).toBe(true)
    expect(passa(perguntouCasa(), {})).toBe(false)
    expect(passa(naoPerguntou(), {})).toBe(true)
    expect(passa(naoPerguntou(), { perguntas: [casaCom(["abobora"])] })).toBe(false)
  })

  it("perguntouNoMaximo conta as perguntas do run", () => {
    expect(passa(perguntouNoMaximo(1), { perguntas: [casaCom(["abobora"])] })).toBe(true)
    expect(
      passa(perguntouNoMaximo(1), { perguntas: [casaCom(["abobora"]), casaCom(["couve"])] }),
    ).toBe(false)
  })

  it("itensNaPergunta limita os itens de cada pergunta de casa", () => {
    const seis = ["a", "b", "c", "d", "e", "f"]
    expect(passa(itensNaPergunta(5), { perguntas: [casaCom(["a", "b", "c"])] })).toBe(true)
    expect(passa(itensNaPergunta(5), { perguntas: [casaCom(seis)] })).toBe(false)
    expect(passa(itensNaPergunta(5), {})).toBe(false)
  })

  it("nuncaPerguntou olha os itens das perguntas de casa", () => {
    expect(passa(nuncaPerguntou("gengibre"), { perguntas: [casaCom(["abobora"])] })).toBe(true)
    expect(passa(nuncaPerguntou("gengibre"), { perguntas: [casaCom(["gengibre"])] })).toBe(false)
  })

  it("semItemNaSaida procura o id em sugestão ou citado, e o nome no texto", () => {
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["arroz-branco"])] })),
      }),
    ).toBe(true)
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["abobora"])] })),
      }),
    ).toBe(false)
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ citados: ["alimentos:abobora"] })),
      }),
    ).toBe(false)
    expect(
      passa(semItemNaSaida("abobora"), {
        resultado: resultadoCom(saidaPronta({ resposta: "Use a abóbora." })),
      }),
    ).toBe(false)
  })

  it("semSegundaPerguntaSobre aceita uma pergunta por item e recusa duas", () => {
    expect(passa(semSegundaPerguntaSobre(["abobora"]), { perguntas: [casaCom(["abobora"])] })).toBe(
      true,
    )
    expect(
      passa(semSegundaPerguntaSobre(["abobora"]), {
        perguntas: [casaCom(["abobora"]), casaCom(["abobora", "couve"])],
      }),
    ).toBe(false)
  })

  it("pausouSemDecisao exige zero chamadas antes da variante", () => {
    expect(passa(pausouSemDecisao(), { perguntas: [variante] })).toBe(true)
    expect(passa(pausouSemDecisao(), { perguntas: [variante], llmAntesDaPrimeiraPausa: 1 })).toBe(
      false,
    )
    expect(passa(pausouSemDecisao(), { perguntas: [casaCom(["abobora"])] })).toBe(false)
  })

  it("temAvisoDeIncomodo confere o aviso de incômodo", () => {
    expect(
      passa(temAvisoDeIncomodo(), {
        resultado: resultadoCom(saidaPronta({ avisos: [{ tipo: "incomodo", texto: "Cuidado." }] })),
      }),
    ).toBe(true)
    expect(
      passa(temAvisoDeIncomodo(), {
        resultado: resultadoCom(saidaPronta({ avisos: [{ tipo: "geral", texto: "Oi." }] })),
      }),
    ).toBe(false)
  })

  it("sugestaoQueRefresca aceita frio ou brando em verbos ou contribui", () => {
    expect(
      passa(sugestaoQueRefresca(), {
        resultado: resultadoCom(
          saidaPronta({ sugestoes: [sugestaoCom(["melancia"], ["brando"])] }),
        ),
      }),
    ).toBe(true)
    expect(
      passa(sugestaoQueRefresca(), {
        resultado: resultadoCom(
          saidaPronta({ sugestoes: [sugestaoCom(["melancia"], ["quente"])] }),
        ),
      }),
    ).toBe(false)
  })

  it("terminou confere o status done", () => {
    expect(passa(terminou(), {})).toBe(true)
    const pausado: Partial<Entrada> = {
      resposta: { run_id: "run-eval", status: "waiting_for_input", caminho: "acompanhante" },
    }
    expect(passa(terminou(), pausado)).toBe(false)
  })

  it("terminou aceita o run parado no bloco de aprovação, que é onde o runner para", () => {
    const noBloco: Partial<Entrada> = {
      resposta: { run_id: "run-eval", status: "waiting_for_approval", caminho: "casa" },
    }
    expect(passa(terminou(), noBloco)).toBe(true)
  })

  it("semItemNaoGostado confere que o item marcado como não gosto não sai", () => {
    const naoGosto: Entrada["perguntas"][number] = {
      pergunta: {
        tipo: "casa",
        texto: "Você tem?",
        itens: [{ alimento_id: "abobora", nome: "abóbora" }],
      },
      resposta: { tipo: "casa", itens: [{ alimento_id: "abobora", resposta: "nao_gosto" }] },
    }
    expect(
      passa(semItemNaoGostado(), {
        perguntas: [naoGosto],
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["couve"])] })),
      }),
    ).toBe(true)
    expect(
      passa(semItemNaoGostado(), {
        perguntas: [naoGosto],
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["abobora"])] })),
      }),
    ).toBe(false)
  })

  it("as respostas montadas na hora seguem os itens da pergunta", () => {
    const casa: Pergunta = {
      tipo: "casa",
      texto: "Você tem?",
      itens: [
        { alimento_id: "abobora", nome: "abóbora" },
        { alimento_id: "couve", nome: "couve" },
      ],
    }
    expect(tenhoATudo(casa)).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "tenho" },
        { alimento_id: "couve", resposta: "tenho" },
      ],
    })
    expect(naoTenhoATudo(casa)).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "nao_tenho" },
        { alimento_id: "couve", resposta: "nao_tenho" },
      ],
    })
    expect(naoGostaDoPrimeiroTenhoOsOutros(casa)).toEqual({
      tipo: "casa",
      itens: [
        { alimento_id: "abobora", resposta: "nao_gosto" },
        { alimento_id: "couve", resposta: "tenho" },
      ],
    })
    expect(tenhoATudo(variante.pergunta)).toEqual({ tipo: "pular" })
  })
})

describe("expectativas da conversa de Propostas", () => {
  type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

  const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
    origem: "agente",
    resposta: "Um prato morno, sem tela.",
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

  const sugestaoCom = (ids: string[]): SugestaoEntregue => ({
    tipo: "refeicao",
    titulo: "Prato morno",
    como_fazer: "Cozinhe e sirva quente.",
    motivo: "Esquenta.",
    linhas_base: [],
    novidade: false,
    verbos: [],
    itens: ids.map((id) => ({
      alimento_id: id,
      nome: id,
      contribui: [],
      verbos: [],
      linha_base: `alimentos:${id}`,
      casa: "confirmado",
    })),
  })

  const resultadoCom = (saida: SaidaDoAcompanhante, tools: string[] = []): ResultadoDoRun => ({
    saida,
    status: "waiting_for_approval",
    tools,
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  })

  const proposta = (tool: PropostaNaSaida["tool"], texto: string): PropostaNaSaida => ({
    id: `${tool}-${texto}`,
    tool,
    texto,
  })

  const entrada = (p: Partial<Entrada> = {}): Entrada => ({
    resposta: { run_id: "run-eval", status: "waiting_for_approval", caminho: "acompanhante" },
    resultado: resultadoCom(saidaPronta()),
    perguntas: [],
    recusadas: 0,
    llmAntesDaPrimeiraPausa: 0,
    propostas: [],
    propostasRecusadas: 0,
    retornosFechados: [],
    juiz: { tentativas: 0, aprovado: null, motivos: [] },
    ...p,
  })

  const passa = (e: ExpectativaDaConversa, r: Partial<Entrada>): boolean => e.confere(entrada(r))

  it("chamouMemoriaPropor confere se memoria.propor foi chamada", () => {
    expect(
      passa(chamouMemoriaPropor(), { resultado: resultadoCom(saidaPronta(), ["memoria.propor"]) }),
    ).toBe(true)
    expect(
      passa(chamouMemoriaPropor(), { resultado: resultadoCom(saidaPronta(), ["lista.propor"]) }),
    ).toBe(false)
  })

  it("blocoComRotina exige memoria.propor com o fato e a primeira letra maiúscula", () => {
    const fato = "vou almoçar fora todo dia"
    expect(
      passa(blocoComRotina(fato), {
        propostas: [proposta("memoria.propor", "Vou almoçar fora todo dia")],
      }),
    ).toBe(true)
    expect(
      passa(blocoComRotina(fato), {
        propostas: [proposta("memoria.propor", "Almoço fora")],
      }),
    ).toBe(false)
    expect(
      passa(blocoComRotina(fato), {
        propostas: [proposta("lista.propor", 'Gengibre na lista "Para ter em casa"')],
      }),
    ).toBe(false)
  })

  it("nenhumaProposta passa sem proposta no bloco e recusa qualquer uma", () => {
    expect(passa(nenhumaProposta(), {})).toBe(true)
    expect(
      passa(nenhumaProposta(), { propostas: [proposta("memoria.propor", "Vou almoçar fora")] }),
    ).toBe(false)
  })

  it("listaNoMaximoUma aceita até uma lista.propor", () => {
    const lista = proposta("lista.propor", 'Gengibre na lista "Para ter em casa"')
    expect(passa(listaNoMaximoUma(), { propostas: [lista] })).toBe(true)
    expect(passa(listaNoMaximoUma(), { propostas: [lista, { ...lista, id: "outra" }] })).toBe(false)
  })

  it("listaSoDe exige que toda lista.propor cite o alimento pelo nome", () => {
    const gengibre = proposta(
      "lista.propor",
      'Gengibre na lista "Para ter em casa" (faltou para o chá)',
    )
    const abobora = proposta(
      "lista.propor",
      'Abóbora na lista "Para ter em casa" (faltou para o chá)',
    )
    expect(passa(listaSoDe("gengibre"), { propostas: [gengibre] })).toBe(true)
    expect(passa(listaSoDe("gengibre"), { propostas: [gengibre, abobora] })).toBe(false)
    expect(passa(listaSoDe("gengibre"), {})).toBe(true)
  })

  it("nenhumaListaAceita recusa qualquer lista.propor no bloco e aceita só as outras", () => {
    const rotina = proposta("memoria.propor", "Vou almoçar fora")
    const lista = proposta("lista.propor", 'Gengibre na lista "Para ter em casa"')
    expect(passa(nenhumaListaAceita(), { propostas: [rotina] })).toBe(true)
    expect(passa(nenhumaListaAceita(), { propostas: [rotina, lista] })).toBe(false)
  })

  it("blocoComRestricao procura a linha da restrição pelo rótulo", () => {
    const linha = proposta("memoria.propor", "Sua alimentação é vegetariana")
    expect(passa(blocoComRestricao("vegetariana"), { propostas: [linha] })).toBe(true)
    expect(passa(blocoComRestricao("vegana"), { propostas: [linha] })).toBe(false)
    expect(passa(blocoComRestricao("vegetariana"), {})).toBe(false)
  })

  it("semAlimentoBarrado recusa sugestão com alimento que a restrição barra", () => {
    // Leite é marcado como vegana e sem lactose na base; abóbora não é barrada por nenhuma delas.
    expect(
      passa(semAlimentoBarrado("vegana"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["abobora"])] })),
      }),
    ).toBe(true)
    expect(
      passa(semAlimentoBarrado("vegana"), {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestaoCom(["leite"])] })),
      }),
    ).toBe(false)
  })
})

describe("expectativas de Aprendizado e Para ter em casa", () => {
  type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

  const saidaPronta = (p: Partial<SaidaDoAcompanhante> = {}): SaidaDoAcompanhante => ({
    origem: "agente",
    resposta: "Um prato morno, sem tela.",
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

  const sugestao = (
    tipo: SugestaoEntregue["tipo"],
    ids: string[],
    extra: Partial<SugestaoEntregue> = {},
  ): SugestaoEntregue => ({
    tipo,
    titulo: "Sugestão",
    como_fazer: "Prepare e sirva.",
    motivo: "Esquenta.",
    linhas_base: [],
    novidade: false,
    verbos: [],
    itens: ids.map((id) => ({
      alimento_id: id,
      nome: id,
      contribui: [],
      verbos: [],
      linha_base: `alimentos:${id}`,
      casa: "confirmado",
    })),
    ...extra,
  })

  const resultadoCom = (saida: SaidaDoAcompanhante, tools: string[] = []): ResultadoDoRun => ({
    saida,
    status: "done",
    tools,
    chamadasDeModelo: 1,
    validacoes: ["ok"],
  })

  const entrada = (p: Partial<Entrada> = {}): Entrada => ({
    resposta: { run_id: "run-eval", status: "done", caminho: "acompanhante" },
    resultado: resultadoCom(saidaPronta()),
    perguntas: [],
    recusadas: 0,
    llmAntesDaPrimeiraPausa: 0,
    propostas: [],
    propostasRecusadas: 0,
    retornosFechados: [],
    juiz: { tentativas: 0, aprovado: null, motivos: [] },
    ...p,
  })

  const passa = (e: ExpectativaDaConversa, r: Partial<Entrada>): boolean => e.confere(entrada(r))

  const paraTer = {
    alimento_id: "cardamomo",
    nome: "Cardamomo",
    vezes: 3,
    contribui: [],
    linha_base: "alimentos:cardamomo",
    verbos: [],
    motivo: "Faltou três vezes.",
  }

  it("primeiroDoTipoNao reprova o chá dado quando ele é o primeiro do seu tipo", () => {
    const outroPrimeiro = saidaPronta({
      sugestoes: [
        sugestao("cha", ["cardamomo"], { pratica_id: "cha-cardamomo" }),
        sugestao("cha", ["gengibre"], { pratica_id: "cha-gengibre-canela" }),
      ],
    })
    const primeiro = saidaPronta({
      sugestoes: [sugestao("cha", ["gengibre"], { pratica_id: "cha-gengibre-canela" })],
    })
    const exp = primeiroDoTipoNao("cha-gengibre-canela", "cha")
    expect(passa(exp, { resultado: resultadoCom(outroPrimeiro) })).toBe(true)
    expect(passa(exp, { resultado: resultadoCom(primeiro) })).toBe(false)
  })

  it("apareceNasSugestoes exige o alimento num item de sugestão", () => {
    const exp = apareceNasSugestoes("gengibre")
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestao("cha", ["gengibre"])] })),
      }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestao("cha", ["canela"])] })),
      }),
    ).toBe(false)
  })

  it("naoAparece reprova o alimento que sai num item, e passa quando ele não sai", () => {
    const exp = naoAparece("gengibre")
    expect(
      passa(exp, {
        resultado: resultadoCom(
          saidaPronta({
            resposta: "Uma refeição morna.",
            sugestoes: [sugestao("cha", ["canela"])],
          }),
        ),
      }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ sugestoes: [sugestao("cha", ["gengibre"])] })),
      }),
    ).toBe(false)
  })

  it("chamouResultadoRegistrar confere se resultado.registrar foi chamada", () => {
    const exp = chamouResultadoRegistrar()
    expect(passa(exp, { resultado: resultadoCom(saidaPronta(), ["resultado.registrar"]) })).toBe(
      true,
    )
    expect(passa(exp, { resultado: resultadoCom(saidaPronta(), ["memoria.propor"]) })).toBe(false)
  })

  it("fechouRetorno exige o título nos retornos fechados", () => {
    const exp = fechouRetorno("Arroz")
    expect(passa(exp, { retornosFechados: ["Arroz"] })).toBe(true)
    expect(passa(exp, { retornosFechados: ["Chá"] })).toBe(false)
  })

  it("naoFechou reprova o título que saiu dos pendentes", () => {
    const exp = naoFechou("Chá")
    expect(passa(exp, { retornosFechados: ["Arroz"] })).toBe(true)
    expect(passa(exp, { retornosFechados: ["Chá"] })).toBe(false)
  })

  it("nenhumRetornoFechado reprova quando algum retorno fechou", () => {
    const exp = nenhumRetornoFechado()
    expect(passa(exp, { retornosFechados: [] })).toBe(true)
    expect(passa(exp, { retornosFechados: ["Arroz"] })).toBe(false)
  })

  it("apontaComoFicou exige o texto com Como ficou", () => {
    const exp = apontaComoFicou()
    expect(
      passa(exp, { resultado: resultadoCom(saidaPronta({ resposta: "Como ficou aquilo?" })) }),
    ).toBe(true)
    expect(
      passa(exp, {
        resultado: resultadoCom(saidaPronta({ resposta: "Que bom, vou tomar um chá." })),
      }),
    ).toBe(false)
  })

  it("comParaTer exige o para_ter na saída", () => {
    const exp = comParaTer()
    expect(passa(exp, { resultado: resultadoCom(saidaPronta({ para_ter: paraTer })) })).toBe(true)
    expect(passa(exp, { resultado: resultadoCom(saidaPronta()) })).toBe(false)
  })

  it("semParaTer reprova quando há para_ter na saída", () => {
    const exp = semParaTer()
    expect(passa(exp, { resultado: resultadoCom(saidaPronta()) })).toBe(true)
    expect(passa(exp, { resultado: resultadoCom(saidaPronta({ para_ter: paraTer })) })).toBe(false)
  })
})
