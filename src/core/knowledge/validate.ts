import { config } from "@config/index"
import type { z } from "zod"
import {
  alimentoSchema,
  combinacaoSchema,
  type DadosDaBase,
  doshaInfoSchema,
  estadoInfoSchema,
  type FonteRef,
  fonteSchema,
  grupoEvitarInfoSchema,
  incomodoSchema,
  perguntaQuizSchema,
  praticaSchema,
  preparoSchema,
  vocabuloGunaSchema,
} from "./schemas"
import {
  ESTADOS,
  type Estado,
  GRUPOS,
  type Grupo,
  type GrupoEvitar,
  MARCAS,
  MOMENTOS_DO_DIA,
  type MomentoDoDia,
  TIPOS_PRATICA,
  type TipoPratica,
} from "./vocab"

export type Contagens = {
  porArquivo: Record<string, number>
  alimentosPorGrupo: Record<Grupo, number>
  praticasPorTipo: Record<TipoPratica, number>
  aConfirmar: number
}

export type OpcoesValidacao = { cobertura?: boolean }

export type ResultadoValidacao = { erros: string[]; avisos: string[]; contagens: Contagens }

export type AnaliseBase = ResultadoValidacao & { dados: DadosDaBase }

type Chave = keyof DadosDaBase
type Brutos = Record<Chave, unknown[]>
type Ids = Record<Chave, Set<string>>

type Tabela = {
  chave: Chave
  arquivo: string
  chaveId: string
  schema: z.ZodType
}

const REF_A_CONFIRMAR = "a_confirmar"

const TABELAS: readonly Tabela[] = [
  { chave: "alimentos", arquivo: "alimentos", chaveId: "id", schema: alimentoSchema },
  { chave: "preparos", arquivo: "preparos", chaveId: "id", schema: preparoSchema },
  { chave: "praticas", arquivo: "praticas", chaveId: "id", schema: praticaSchema },
  { chave: "combinacoes", arquivo: "combinacoes", chaveId: "id", schema: combinacaoSchema },
  { chave: "doshas", arquivo: "doshas", chaveId: "id", schema: doshaInfoSchema },
  { chave: "estados", arquivo: "estados", chaveId: "id", schema: estadoInfoSchema },
  { chave: "incomodos", arquivo: "incomodos", chaveId: "id", schema: incomodoSchema },
  { chave: "quiz", arquivo: "quiz", chaveId: "id", schema: perguntaQuizSchema },
  {
    chave: "gruposEvitar",
    arquivo: "grupos_evitar",
    chaveId: "id",
    schema: grupoEvitarInfoSchema,
  },
  { chave: "vocabulario", arquivo: "vocabulario", chaveId: "guna", schema: vocabuloGunaSchema },
  { chave: "fontes", arquivo: "fontes", chaveId: "ref", schema: fonteSchema },
]

// Chaves por tabela, com uma única conversão de tipo na borda.
function porChave<T>(doTipo: (tabela: Tabela) => T): Record<Chave, T> {
  return Object.fromEntries(TABELAS.map((tabela) => [tabela.chave, doTipo(tabela)])) as Record<
    Chave,
    T
  >
}

function idDe(tabela: Tabela, item: unknown): string | undefined {
  if (typeof item !== "object" || item === null) return undefined
  const valor: unknown = (item as Record<string, unknown>)[tabela.chaveId]
  return typeof valor === "string" ? valor : undefined
}

function lerListas(dados: unknown, erros: string[]): Brutos {
  const objeto = (typeof dados === "object" && dados !== null ? dados : {}) as Record<
    string,
    unknown
  >
  if (typeof dados !== "object" || dados === null) erros.push("base precisa ser um objeto")
  return porChave((tabela) => {
    const valor = objeto[tabela.chave]
    if (Array.isArray(valor)) return valor
    erros.push(`${tabela.chave} precisa ser uma lista`)
    return []
  })
}

function caminhoDe(caminho: PropertyKey[]): string {
  return caminho.map((parte) => String(parte)).join(".") || "item"
}

function validarTabela(tabela: Tabela, lista: unknown[], erros: string[]): unknown[] {
  const validos: unknown[] = []
  for (const [indice, item] of lista.entries()) {
    const resultado = tabela.schema.safeParse(item)
    if (resultado.success) {
      validos.push(resultado.data)
      continue
    }
    const rotulo = idDe(tabela, item) ?? `#${indice}`
    for (const issue of resultado.error.issues) {
      erros.push(`${tabela.arquivo}:${rotulo}:${caminhoDe(issue.path)} ${issue.message}`)
    }
  }
  return validos
}

function idsBrutos(brutos: Brutos): Ids {
  return porChave(
    (tabela) => new Set(brutos[tabela.chave].flatMap((item) => idDe(tabela, item) ?? [])),
  )
}

// Regra 1
function regraIdsRepetidos(brutos: Brutos): string[] {
  return TABELAS.flatMap((tabela) => {
    const vistos = new Set<string>()
    const repetidos = new Set<string>()
    for (const item of brutos[tabela.chave]) {
      const id = idDe(tabela, item)
      if (id === undefined) continue
      if (vistos.has(id)) repetidos.add(id)
      vistos.add(id)
    }
    return [...repetidos].map((id) => `${tabela.arquivo}:${id}:id repetido`)
  })
}

type RegistroComFontes = { arquivo: string; id: string; fontes: FonteRef[] }

function registrosComFontes(d: DadosDaBase): RegistroComFontes[] {
  const listas: Array<[string, ReadonlyArray<{ id: string; fontes: FonteRef[] }>]> = [
    ["alimentos", d.alimentos],
    ["preparos", d.preparos],
    ["praticas", d.praticas],
    ["combinacoes", d.combinacoes],
    ["doshas", d.doshas],
    ["estados", d.estados],
    ["incomodos", d.incomodos],
    ["quiz", d.quiz],
  ]
  return listas.flatMap(([arquivo, itens]) =>
    itens.map((item) => ({ arquivo, id: item.id, fontes: item.fontes })),
  )
}

// Regra 2
function regraFontes(d: DadosDaBase, idsFontes: Set<string>): string[] {
  return registrosComFontes(d).flatMap((registro) =>
    registro.fontes
      .filter((fonte) => fonte.ref !== REF_A_CONFIRMAR && !idsFontes.has(fonte.ref))
      .map(
        (fonte) =>
          `${registro.arquivo}:${registro.id}:fontes ref "${fonte.ref}" não existe em fontes.yaml`,
      ),
  )
}

// Regra 3
function itemComProblema(item: string, idsAlimentos: Set<string>): string | undefined {
  const separador = item.indexOf(":")
  const tipo = item.slice(0, separador)
  const valor = item.slice(separador + 1)
  if (tipo === "alimento") {
    return idsAlimentos.has(valor) ? undefined : "não existe em alimentos.yaml"
  }
  const vocabulario: readonly string[] = tipo === "grupo" ? GRUPOS : MARCAS
  return vocabulario.includes(valor) ? undefined : "fora do vocabulário"
}

// Regra 3
function regraReferenciasDeItens(d: DadosDaBase, ids: Ids): string[] {
  const deIngredientes = d.praticas.flatMap((pratica) =>
    pratica.ingredientes
      .filter((ingrediente) => !ids.alimentos.has(ingrediente))
      .map(
        (ingrediente) =>
          `praticas:${pratica.id}:ingredientes "${ingrediente}" não existe em alimentos.yaml`,
      ),
  )
  const deCombinacoes = d.combinacoes.flatMap((combinacao) =>
    combinacao.itens.flatMap((item) => {
      const problema = itemComProblema(item, ids.alimentos)
      return problema ? [`combinacoes:${combinacao.id}:itens "${item}" ${problema}`] : []
    }),
  )
  return [...deIngredientes, ...deCombinacoes]
}

function lacunasDe(texto: string): string[] {
  return [...texto.matchAll(/\{(\w+)\}/g)].map((achado) => achado[1] ?? "")
}

// Regras 4 e 5
function regraLacunas(d: DadosDaBase): string[] {
  return d.preparos.flatMap((preparo) => {
    const funcoesComVaga = new Set<string>(preparo.vagas.map((vaga) => vaga.funcao))
    const obrigatorias = new Set<string>(
      preparo.vagas.filter((vaga) => vaga.obrigatoria).map((vaga) => vaga.funcao),
    )
    const porLacuna = (["titulo", "passos"] as const).flatMap((campo) =>
      lacunasDe(preparo[campo])
        .filter((lacuna) => !funcoesComVaga.has(lacuna))
        .map(
          (lacuna) =>
            `preparos:${preparo.id}:${campo} placeholder {${lacuna}} sem vaga de ${lacuna}`,
        ),
    )
    const temObrigatoria = lacunasDe(preparo.titulo).some((lacuna) => obrigatorias.has(lacuna))
    return temObrigatoria
      ? porLacuna
      : [...porLacuna, `preparos:${preparo.id}:titulo sem lacuna de nenhuma vaga obrigatória`]
  })
}

// Regra 6
function regraVagas(d: DadosDaBase): string[] {
  const minimo = config.base.minAlimentosPorVaga
  return d.preparos.flatMap((preparo) =>
    preparo.vagas.flatMap((vaga) => {
      const possiveis = d.alimentos.filter(
        (alimento) =>
          alimento.funcoes.includes(vaga.funcao) && (vaga.grupos?.includes(alimento.grupo) ?? true),
      ).length
      return possiveis < minimo
        ? [
            `preparos:${preparo.id}:vagas vaga "${vaga.funcao}" tem poucos alimentos possíveis (${possiveis}, mínimo ${minimo})`,
          ]
        : []
    }),
  )
}

// Regra 7
function regraOleo(d: DadosDaBase): string[] {
  const idsOleos = new Set(d.alimentos.filter((a) => a.grupo === "oleos").map((a) => a.id))
  return d.praticas
    .filter((pratica) => pratica.tipo === "oleo")
    .filter((pratica) => !pratica.ingredientes.some((i) => idsOleos.has(i)))
    .map(
      (pratica) =>
        `praticas:${pratica.id}:ingredientes prática de óleo sem ingrediente do grupo oleos`,
    )
}

const EVITAR_POR_ID: Partial<Record<string, GrupoEvitar>> = {
  ghee: "leite",
  tofu: "soja",
  pao: "trigo",
  macarrao: "trigo",
  amendoim: "amendoim",
  "castanha-de-caju": "castanhas",
  "castanha-do-para": "castanhas",
  amendoa: "castanhas",
  noz: "castanhas",
  gergelim: "gergelim",
  "oleo-de-gergelim": "gergelim",
}

const EVITAR_POR_GRUPO: Partial<Record<Grupo, GrupoEvitar>> = {
  laticinios: "leite",
  ovos: "ovo",
}

// Regra 8
function regraGruposEvitar(d: DadosDaBase): string[] {
  return d.alimentos.flatMap((alimento) => {
    const exigido = EVITAR_POR_ID[alimento.id] ?? EVITAR_POR_GRUPO[alimento.grupo]
    return exigido && !alimento.grupos_evitar.includes(exigido)
      ? [`alimentos:${alimento.id}:grupos_evitar falta "${exigido}"`]
      : []
  })
}

// Regra 9
function regraOleosPrensados(d: DadosDaBase): string[] {
  return d.alimentos
    .filter((alimento) => alimento.grupo === "oleos" && alimento.id !== "ghee")
    .filter((alimento) => !(alimento.observacao ?? "").includes("prensado a frio"))
    .map((alimento) => `alimentos:${alimento.id}:observacao óleo sem "prensado a frio"`)
}

type Referencia = { arquivo: string; id: string; campo: string; valores: readonly string[] }

function referenciasDeEstado(d: DadosDaBase): Referencia[] {
  return [
    ...d.praticas.flatMap((p) => [
      { arquivo: "praticas", id: p.id, campo: "favorece_estados", valores: p.favorece_estados },
      { arquivo: "praticas", id: p.id, campo: "contraindicacoes", valores: p.contraindicacoes },
    ]),
    ...d.preparos.map((p) => ({
      arquivo: "preparos",
      id: p.id,
      campo: "contraindicacoes",
      valores: p.contraindicacoes,
    })),
  ]
}

function referenciasDeGuna(d: DadosDaBase): Referencia[] {
  const doAlimento = d.alimentos.map((a) => ({
    arquivo: "alimentos",
    id: a.id,
    campo: "gunas",
    valores: a.gunas,
  }))
  const doPreparo = d.preparos.map((p) => ({
    arquivo: "preparos",
    id: p.id,
    campo: "gunas_do_preparo",
    valores: p.gunas_do_preparo,
  }))
  const daPratica = d.praticas.map((p) => ({
    arquivo: "praticas",
    id: p.id,
    campo: "gunas",
    valores: p.gunas,
  }))
  const deDosha = d.doshas.flatMap((x) => [
    { arquivo: "doshas", id: x.id, campo: "gunas", valores: x.gunas },
    { arquivo: "doshas", id: x.id, campo: "equilibra_gunas", valores: x.equilibra_gunas },
  ])
  const deEstado = d.estados.flatMap((e) => [
    { arquivo: "estados", id: e.id, campo: "presentes", valores: e.presentes },
    { arquivo: "estados", id: e.id, campo: "favorecer", valores: e.favorecer },
    { arquivo: "estados", id: e.id, campo: "evitar_gunas", valores: e.evitar_gunas },
  ])
  const deIncomodo = d.incomodos.flatMap((i) =>
    i.variantes.flatMap((v) => [
      {
        arquivo: "incomodos",
        id: i.id,
        campo: `variantes.${v.id}.presentes`,
        valores: v.presentes,
      },
      {
        arquivo: "incomodos",
        id: i.id,
        campo: `variantes.${v.id}.favorecer`,
        valores: v.favorecer,
      },
      {
        arquivo: "incomodos",
        id: i.id,
        campo: `variantes.${v.id}.evitar_gunas`,
        valores: v.evitar_gunas,
      },
    ]),
  )
  return [...doAlimento, ...doPreparo, ...daPratica, ...deDosha, ...deEstado, ...deIncomodo]
}

// Regra 11
function valoresSemLinha(
  referencias: Referencia[],
  existentes: Set<string>,
  arquivoAlvo: string,
  rotulo: string,
): string[] {
  return referencias.flatMap((r) =>
    r.valores
      .filter((valor) => !existentes.has(valor))
      .map(
        (valor) =>
          `${r.arquivo}:${r.id}:${r.campo} ${rotulo} "${valor}" sem linha em ${arquivoAlvo}`,
      ),
  )
}

// Regra 11
function regraEstadosEGunas(d: DadosDaBase, ids: Ids): string[] {
  return [
    ...valoresSemLinha(referenciasDeEstado(d), ids.estados, "estados.yaml", "estado"),
    ...valoresSemLinha(referenciasDeGuna(d), ids.vocabulario, "vocabulario.yaml", "guna"),
  ]
}

// Regra 12
function regraFontesComUrl(d: DadosDaBase): string[] {
  return d.fontes
    .filter((fonte) => fonte.url !== undefined && fonte.acessado_em === undefined)
    .map((fonte) => `fontes:${fonte.ref}:acessado_em ausente com url`)
}

function abaixoDoMinimo(nome: string, contagem: number, minimo: number): string[] {
  return contagem < minimo ? [`cobertura: ${nome} tem ${contagem}, mínimo ${minimo}`] : []
}

function preparosParaEstado(d: DadosDaBase, estado: Estado): number {
  const favorecidas = d.estados.find((e) => e.id === estado)?.favorecer ?? []
  return d.preparos.filter(
    (p) =>
      !p.contraindicacoes.includes(estado) &&
      p.gunas_do_preparo.some((g) => favorecidas.includes(g)),
  ).length
}

function contarNoMomento(itens: ReadonlyArray<{ momento: MomentoDoDia[] }>, momento: MomentoDoDia) {
  return itens.filter((item) => item.momento.includes(momento)).length
}

// Regra 13
function regraCobertura(d: DadosDaBase): string[] {
  const { base } = config
  return [
    ...abaixoDoMinimo("alimentos", d.alimentos.length, base.minAlimentos),
    ...abaixoDoMinimo("preparos", d.preparos.length, base.minPreparos),
    ...TIPOS_PRATICA.flatMap((tipo) =>
      abaixoDoMinimo(
        `práticas do tipo ${tipo}`,
        d.praticas.filter((p) => p.tipo === tipo).length,
        base.minPraticas[tipo],
      ),
    ),
    ...ESTADOS.flatMap((estado) =>
      abaixoDoMinimo(
        `práticas que favorecem ${estado}`,
        d.praticas.filter((p) => p.favorece_estados.includes(estado)).length,
        base.minPraticasPorEstado,
      ),
    ),
    ...ESTADOS.flatMap((estado) =>
      abaixoDoMinimo(
        `preparos para ${estado}`,
        preparosParaEstado(d, estado),
        base.minPreparosPorEstado,
      ),
    ),
    ...MOMENTOS_DO_DIA.flatMap((momento) =>
      abaixoDoMinimo(
        `preparos para ${momento}`,
        contarNoMomento(d.preparos, momento),
        base.minPreparosPorMomento,
      ),
    ),
    ...MOMENTOS_DO_DIA.flatMap((momento) =>
      abaixoDoMinimo(
        `práticas para ${momento}`,
        contarNoMomento(d.praticas, momento),
        base.minPraticasPorMomento,
      ),
    ),
    ...abaixoDoMinimo("combinações", d.combinacoes.length, base.minCombinacoes),
  ]
}

function contarPor<K extends string>(chaves: readonly K[], valores: readonly string[]) {
  return Object.fromEntries(
    chaves.map((chave) => [chave, valores.filter((valor) => valor === chave).length]),
  ) as Record<K, number>
}

function contagensDe(d: DadosDaBase, brutos: Brutos): Contagens {
  return {
    porArquivo: Object.fromEntries(TABELAS.map((t) => [t.arquivo, brutos[t.chave].length])),
    alimentosPorGrupo: contarPor(
      GRUPOS,
      d.alimentos.map((a) => a.grupo),
    ),
    praticasPorTipo: contarPor(
      TIPOS_PRATICA,
      d.praticas.map((p) => p.tipo),
    ),
    aConfirmar: registrosComFontes(d).filter((r) => r.fontes.some((f) => f.ref === REF_A_CONFIRMAR))
      .length,
  }
}

function avisosDe(d: DadosDaBase): string[] {
  return [
    ...registrosComFontes(d)
      .filter((r) => r.fontes.some((f) => f.ref === REF_A_CONFIRMAR))
      .map((r) => `${r.arquivo}:${r.id}: linha com fonte a_confirmar`),
    ...d.fontes.filter((f) => !f.aprovada).map((f) => `fontes:${f.ref}: fonte não aprovada`),
  ]
}

export function analisarBase(dados: unknown, opcoes: OpcoesValidacao = {}): AnaliseBase {
  const erros: string[] = []
  const brutos = lerListas(dados, erros)
  const validos = porChave((tabela) => validarTabela(tabela, brutos[tabela.chave], erros))
  const d = validos as DadosDaBase
  const ids = idsBrutos(brutos)
  const porRegras = [
    regraIdsRepetidos(brutos),
    regraFontes(d, ids.fontes),
    regraReferenciasDeItens(d, ids),
    regraLacunas(d),
    regraVagas(d),
    regraOleo(d),
    regraGruposEvitar(d),
    regraOleosPrensados(d),
    regraEstadosEGunas(d, ids),
    regraFontesComUrl(d),
    opcoes.cobertura === false ? [] : regraCobertura(d),
  ]
  return {
    erros: [...erros, ...porRegras.flat()],
    avisos: avisosDe(d),
    contagens: contagensDe(d, brutos),
    dados: d,
  }
}

export function validarBase(dados: unknown, opcoes: OpcoesValidacao = {}): ResultadoValidacao {
  const { erros, avisos, contagens } = analisarBase(dados, opcoes)
  return { erros, avisos, contagens }
}
