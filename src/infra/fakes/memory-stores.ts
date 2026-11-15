import type { AccountRepository, ProfileStore } from "@/core/accounts/ports"
import type { Conta, Perfil } from "@/core/accounts/types"
import type { Clock } from "@/core/clock"
import { RituError } from "@/core/errors"
import type { EvitarItem } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import type { PantryStore, ReferenciaDeItem } from "@/core/pantry/ports"
import type { ItemDaCasa } from "@/core/pantry/types"
import type { ItemTipo, PreferenceStore, Preferencia } from "@/core/preferences/ports"
import type { ItemDaLista, ShortageStore } from "@/core/shortages/ports"
import type { Stores, Transactor } from "@/core/stores"

export type OpcoesMemoria = {
  /** Diz se o id é um alimento da base. Padrão: aceita qualquer id. */
  alimentoExiste?: (id: string) => boolean
}

type Falta = {
  conta_id: string
  alimento_id: string
  origem: "teria_entrado" | "nao_tenho"
  run_id: string | null
  dia: string
}

type EvitarDoDia = EvitarItem & { conta_id: string; dia: string }

type Estado = {
  contas: Conta[]
  perfis: Perfil[]
  itensCasa: ItemDaCasa[]
  desconhecidos: Record<string, number>
  faltas: Falta[]
  lista: ItemDaLista[]
  preferencias: Preferencia[]
  evitarDoDia: EvitarDoDia[]
}

/** Guarda o estado atual. A transação troca o estado por uma cópia e volta se falhar. */
type Db = { estado: Estado }

type Ref = { alimento: string } | { livre: string }

const naoImplementado = (): never => {
  throw new Error("não implementado")
}

function estadoVazio(): Estado {
  return {
    contas: [],
    perfis: [],
    itensCasa: [],
    desconhecidos: {},
    faltas: [],
    lista: [],
    preferencias: [],
    evitarDoDia: [],
  }
}

const copia = <T>(valor: T): T => structuredClone(valor)

const mesmoEvitar = (a: EvitarItem, b: EvitarItem): boolean =>
  a.tipo === b.tipo && normalizar(a.valor) === normalizar(b.valor)

const estaVencida = (conta: Conta, clock: Clock): boolean =>
  conta.tipo === "demo" &&
  conta.expira_em !== null &&
  Date.parse(conta.expira_em) <= clock.now().getTime()

const arredonda2 = (n: number): number => Math.round(n * 100) / 100

/** Datas no formato AAAA-MM-DD comparam pela ordem das letras. */
function maisRecente(a: string, b: string): string {
  if (b > a) return b
  return a
}

function novoPerfil(contaId: string, agora: string): Perfil {
  return {
    conta_id: contaId,
    prakriti: null,
    origem: null,
    evitar_sempre: [],
    restricoes: [],
    nao_come: [],
    cidade_nome: null,
    cidade_lat: null,
    cidade_lon: null,
    cidade_fuso: null,
    atualizado_em: agora,
  }
}

/** Remove, do estado, tudo o que é da conta. A limpeza de runs entra com a spec 004 (T4). */
function apagarDadosDaConta(e: Estado, contaId: string): void {
  e.contas = e.contas.filter((c) => c.id !== contaId)
  e.perfis = e.perfis.filter((p) => p.conta_id !== contaId)
  e.itensCasa = e.itensCasa.filter((i) => i.conta_id !== contaId)
  e.faltas = e.faltas.filter((f) => f.conta_id !== contaId)
  e.lista = e.lista.filter((l) => l.conta_id !== contaId)
  e.preferencias = e.preferencias.filter((p) => p.conta_id !== contaId)
  e.evitarDoDia = e.evitarDoDia.filter((x) => x.conta_id !== contaId)
}

function criarAccounts(db: Db, clock: Clock): AccountRepository {
  return {
    async criar(dados) {
      const conta: Conta = {
        id: crypto.randomUUID(),
        tipo: dados.tipo,
        google_sub: dados.google_sub ?? null,
        email: dados.email ?? null,
        expira_em: dados.expira_em?.toISOString() ?? null,
        tester: false,
        aviso_aceito_em: null,
        evitar_passo: null,
        evitar_lembrete_em: null,
        dosha_adiado_em: null,
        criado_em: clock.now().toISOString(),
      }
      db.estado.contas.push(conta)
      return copia(conta)
    },
    async buscar(contaId) {
      const conta = db.estado.contas.find((c) => c.id === contaId)
      if (!conta || estaVencida(conta, clock)) return undefined
      return copia(conta)
    },
    async buscarPorGoogleSub(sub) {
      const conta = db.estado.contas.find((c) => c.google_sub === sub)
      return conta ? copia(conta) : undefined
    },
    async marcar(contaId, campos) {
      const conta = db.estado.contas.find((c) => c.id === contaId)
      if (conta) Object.assign(conta, campos)
    },
    async apagar(contaId) {
      apagarDadosDaConta(db.estado, contaId)
    },
    async apagarDemosVencidas() {
      const vencidas = db.estado.contas.filter((c) => estaVencida(c, clock))
      for (const conta of vencidas) apagarDadosDaConta(db.estado, conta.id)
      return vencidas.length
    },
  }
}

function criarProfiles(db: Db, clock: Clock): ProfileStore {
  const editar = (contaId: string, mudar: (perfil: Perfil) => void): void => {
    const agora = clock.now().toISOString()
    let perfil = db.estado.perfis.find((p) => p.conta_id === contaId)
    if (!perfil) {
      perfil = novoPerfil(contaId, agora)
      db.estado.perfis.push(perfil)
    }
    mudar(perfil)
    perfil.atualizado_em = agora
  }

  return {
    async ler(contaId) {
      const perfil = db.estado.perfis.find((p) => p.conta_id === contaId)
      return copia(perfil ?? novoPerfil(contaId, clock.now().toISOString()))
    },
    async definirPrakriti(contaId, prakriti, origem) {
      editar(contaId, (p) => {
        p.prakriti = prakriti
        p.origem = origem
      })
    },
    async definirCidade(contaId, cidade) {
      editar(contaId, (p) => {
        p.cidade_nome = cidade?.nome ?? null
        p.cidade_lat = cidade ? arredonda2(cidade.lat) : null
        p.cidade_lon = cidade ? arredonda2(cidade.lon) : null
        p.cidade_fuso = cidade?.fuso ?? null
      })
    },
    async definirRestricoes(contaId, restricoes) {
      editar(contaId, (p) => {
        p.restricoes = [...restricoes]
      })
    },
    async definirNaoCome(contaId, itens) {
      editar(contaId, (p) => {
        p.nao_come = copia(itens)
      })
    },
    async acrescentarEvitarSempre(contaId, itens) {
      editar(contaId, (p) => {
        for (const item of itens) {
          if (p.evitar_sempre.some((x) => mesmoEvitar(x, item))) continue
          p.evitar_sempre.push({
            tipo: item.tipo,
            valor: item.valor,
            desde: clock.now().toISOString(),
          })
        }
      })
    },
    async removerEvitarSempre(contaId, item, opts) {
      if (opts?.confirmado !== true) {
        throw new RituError("confirmacao_necessaria", "Remover de evitar sempre exige confirmação")
      }
      editar(contaId, (p) => {
        p.evitar_sempre = p.evitar_sempre.filter((x) => !mesmoEvitar(x, item))
      })
    },
    async evitarTemporario(contaId, dia) {
      return copia(
        db.estado.evitarDoDia
          .filter((x) => x.conta_id === contaId && x.dia === dia)
          .map(({ tipo, valor }) => ({ tipo, valor })),
      )
    },
    async acrescentarEvitarTemporario(contaId, dia, itens) {
      const e = db.estado
      for (const item of itens) {
        const ja = e.evitarDoDia.some(
          (x) => x.conta_id === contaId && x.dia === dia && mesmoEvitar(x, item),
        )
        if (!ja) e.evitarDoDia.push({ conta_id: contaId, dia, tipo: item.tipo, valor: item.valor })
      }
    },
  }
}

/** Resolve a referência: id da base vira alimento; id desconhecido vira nome livre (o id é o nome). */
function resolverRef(ref: ReferenciaDeItem, existe: (id: string) => boolean): Ref {
  if (ref.alimento_id !== undefined) {
    return existe(ref.alimento_id) ? { alimento: ref.alimento_id } : { livre: ref.alimento_id }
  }
  return { livre: ref.nome_livre ?? "" }
}

function acharItem(e: Estado, contaId: string, ref: Ref): ItemDaCasa | undefined {
  return e.itensCasa.find((i) => {
    if (i.conta_id !== contaId) return false
    if ("alimento" in ref) return i.alimento_id === ref.alimento
    return i.nome_normalizado === normalizar(ref.livre)
  })
}

function marcarTem(item: ItemDaCasa, origem: ItemDaCasa["origem"], agora: string): void {
  item.estado = "tem"
  item.confirmado_em = agora
  item.origem = origem
}

function criarPantry(db: Db, clock: Clock, existe: (id: string) => boolean): PantryStore {
  const registrarAlimento = (contaId: string, alimento: string, origem: ItemDaCasa["origem"]) => {
    const e = db.estado
    const agora = clock.now().toISOString()
    const existente = acharItem(e, contaId, { alimento })
    if (existente) {
      marcarTem(existente, origem, agora)
    } else {
      e.itensCasa.push({
        id: crypto.randomUUID(),
        conta_id: contaId,
        alimento_id: alimento,
        nome_livre: null,
        nome_normalizado: null,
        estado: "tem",
        sempre_tenho: false,
        confirmado_em: agora,
        origem,
      })
    }
    e.faltas = e.faltas.filter((f) => !(f.conta_id === contaId && f.alimento_id === alimento))
    e.lista = e.lista.filter((l) => !(l.conta_id === contaId && l.alimento_id === alimento))
  }

  const registrarLivre = (contaId: string, nome: string, origem: ItemDaCasa["origem"]) => {
    const e = db.estado
    const agora = clock.now().toISOString()
    const normalizado = normalizar(nome)
    const existente = acharItem(e, contaId, { livre: nome })
    if (existente) {
      marcarTem(existente, origem, agora)
    } else {
      e.itensCasa.push({
        id: crypto.randomUUID(),
        conta_id: contaId,
        alimento_id: null,
        nome_livre: nome,
        nome_normalizado: normalizado,
        estado: "tem",
        sempre_tenho: false,
        confirmado_em: agora,
        origem,
      })
    }
    e.desconhecidos[normalizado] = (e.desconhecidos[normalizado] ?? 0) + 1
  }

  const mudarItens = (
    contaId: string,
    itens: ReferenciaDeItem[],
    mudar: (i: ItemDaCasa) => void,
  ) => {
    for (const ref of itens) {
      const item = acharItem(db.estado, contaId, resolverRef(ref, existe))
      if (item) mudar(item)
    }
  }

  return {
    async listar(contaId) {
      return copia(db.estado.itensCasa.filter((i) => i.conta_id === contaId))
    },
    async registrar(contaId, itens, origem) {
      for (const ref of itens) {
        const r = resolverRef(ref, existe)
        if ("alimento" in r) registrarAlimento(contaId, r.alimento, origem)
        else registrarLivre(contaId, r.livre, origem)
      }
    },
    async marcarAcabou(contaId, itens) {
      mudarItens(contaId, itens, (i) => {
        i.estado = "acabou"
      })
    },
    async definirSempreTenho(contaId, itemId, valor) {
      const item = db.estado.itensCasa.find((i) => i.id === itemId && i.conta_id === contaId)
      if (item) item.sempre_tenho = valor
    },
    async tirar(contaId, itemId) {
      db.estado.itensCasa = db.estado.itensCasa.filter(
        (i) => !(i.id === itemId && i.conta_id === contaId),
      )
    },
    async desconhecidos(limite) {
      return Object.entries(db.estado.desconhecidos)
        .map(([nome, vezes]) => ({ nome, vezes }))
        .sort((a, b) => b.vezes - a.vezes)
        .slice(0, limite)
    },
  }
}

function criarShortages(db: Db, clock: Clock): ShortageStore {
  return {
    async registrar(contaId, faltas, dia) {
      const e = db.estado
      for (const falta of faltas) {
        const ja = e.faltas.some(
          (f) => f.conta_id === contaId && f.alimento_id === falta.alimento_id && f.dia === dia,
        )
        if (!ja) {
          e.faltas.push({
            conta_id: contaId,
            alimento_id: falta.alimento_id,
            origem: falta.origem,
            run_id: falta.run_id ?? null,
            dia,
          })
        }
      }
    },
    async diasComFalta(contaId, desdeDia) {
      const dias = new Map<string, string[]>()
      for (const f of db.estado.faltas) {
        if (f.conta_id !== contaId || f.dia < desdeDia) continue
        dias.set(f.alimento_id, [...(dias.get(f.alimento_id) ?? []), f.dia])
      }
      return [...dias].map(([alimento_id, datas]) => ({
        alimento_id,
        dias: datas.length,
        ultimo_dia: datas.reduce(maisRecente),
      }))
    },
    async apagarDoAlimento(contaId, alimentoId) {
      db.estado.faltas = db.estado.faltas.filter(
        (f) => !(f.conta_id === contaId && f.alimento_id === alimentoId),
      )
    },
    async lista(contaId) {
      return copia(db.estado.lista.filter((l) => l.conta_id === contaId))
    },
    async porNaLista(contaId, item) {
      const agora = clock.now().toISOString()
      const e = db.estado
      const linha = e.lista.find(
        (l) => l.conta_id === contaId && l.alimento_id === item.alimento_id,
      )
      if (linha) {
        Object.assign(linha, { motivo: item.motivo, detalhe: item.detalhe, criado_em: agora })
      } else {
        e.lista.push({ conta_id: contaId, ...item, criado_em: agora })
      }
    },
    async tirarDaLista(contaId, alimentoId) {
      db.estado.lista = db.estado.lista.filter(
        (l) => !(l.conta_id === contaId && l.alimento_id === alimentoId),
      )
    },
    async apagarFaltasAntesDe(dia) {
      const e = db.estado
      const antigas = e.faltas.filter((f) => f.dia < dia).length
      e.faltas = e.faltas.filter((f) => f.dia >= dia)
      return antigas
    },
  }
}

function criarPreferences(db: Db, clock: Clock): PreferenceStore {
  const achaOuCria = (contaId: string, item: { tipo: ItemTipo; id: string }): Preferencia => {
    const e = db.estado
    const existente = e.preferencias.find(
      (p) => p.conta_id === contaId && p.item_tipo === item.tipo && p.item_id === item.id,
    )
    if (existente) return existente
    const nova: Preferencia = {
      conta_id: contaId,
      item_tipo: item.tipo,
      item_id: item.id,
      gosto: null,
      ajudou: 0,
      nao_ajudou: 0,
      nao_fez: 0,
      ultimos_resultados: [],
      ultima_sugestao_em: null,
    }
    e.preferencias.push(nova)
    return nova
  }

  return {
    async ler(contaId, itens) {
      const da_conta = db.estado.preferencias.filter((p) => p.conta_id === contaId)
      if (itens === undefined) return copia(da_conta)
      return copia(
        da_conta.filter((p) => itens.some((i) => i.tipo === p.item_tipo && i.id === p.item_id)),
      )
    },
    async definirGosto(contaId, item, gosto) {
      achaOuCria(contaId, item).gosto = gosto
    },
    async contarResultado(contaId, item, resultado) {
      const pref = achaOuCria(contaId, item)
      if (resultado === "nao_fez") {
        pref.nao_fez += 1
        return
      }
      pref[resultado] += 1
      pref.ultimos_resultados = [resultado, ...pref.ultimos_resultados].slice(0, 2)
    },
    async marcarSugerido(contaId, itens) {
      const agora = clock.now().toISOString()
      for (const item of itens) achaOuCria(contaId, item).ultima_sugestao_em = agora
    },
    async contagem(contaId) {
      const da_conta = db.estado.preferencias.filter((p) => p.conta_id === contaId)
      return {
        de_gosto: da_conta.filter((p) => p.gosto !== null).length,
        de_resultado: da_conta.filter((p) => p.ajudou + p.nao_ajudou + p.nao_fez > 0).length,
      }
    },
    async apagar(contaId, item) {
      db.estado.preferencias = db.estado.preferencias.filter(
        (p) => !(p.conta_id === contaId && p.item_tipo === item.tipo && p.item_id === item.id),
      )
    },
  }
}

/**
 * Fake em memória das portas. Um estado só, para as regras cruzadas valerem também aqui.
 * As seis portas de outras áreas são stubs até a T4.
 */
export function createMemoryStores(clock: Clock, opts: OpcoesMemoria = {}): Stores & Transactor {
  const db: Db = { estado: estadoVazio() }
  const existe = opts.alimentoExiste ?? (() => true)

  const stores: Stores = {
    accounts: criarAccounts(db, clock),
    profiles: criarProfiles(db, clock),
    pantry: criarPantry(db, clock, existe),
    preferences: criarPreferences(db, clock),
    shortages: criarShortages(db, clock),
    outcomes: {
      criar: naoImplementado,
      pendentes: naoImplementado,
      responder: naoImplementado,
      doRun: naoImplementado,
      apagarAguardandoAntesDe: naoImplementado,
    },
    routine: {
      notasAtivas: naoImplementado,
      anotar: naoImplementado,
      desativar: naoImplementado,
      resumo: naoImplementado,
      gravarResumo: naoImplementado,
    },
    patterns: {
      listar: naoImplementado,
      propor: naoImplementado,
      decidir: naoImplementado,
      apagar: naoImplementado,
    },
    messages: {
      gravar: naoImplementado,
      doDia: naoImplementado,
      marcarIncomodoDoRun: naoImplementado,
      apagarAntesDe: naoImplementado,
      apagarComIncomodoAntesDoDia: naoImplementado,
    },
    runs: {
      criar: naoImplementado,
      buscar: naoImplementado,
      aberto: naoImplementado,
      atualizar: naoImplementado,
      acrescentarEtapa: naoImplementado,
      etapas: naoImplementado,
      recentes: naoImplementado,
      contarMensagensDoDia: naoImplementado,
      votar: naoImplementado,
      expirarEmEsperaAntesDe: naoImplementado,
    },
    proposals: {
      criar: naoImplementado,
      doRun: naoImplementado,
      decidir: naoImplementado,
      recusadas: naoImplementado,
      expirarDosRuns: naoImplementado,
    },
  }

  return {
    ...stores,
    async emTransacao<T>(fn: (s: Stores) => Promise<T>): Promise<T> {
      const antes = copia(db.estado)
      try {
        return await fn(stores)
      } catch (erro) {
        db.estado = antes
        throw erro
      }
    },
  }
}
