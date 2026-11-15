import type { Candidato, DadosDoPreparo, ItemDoCandidato } from "./preparo"

const TROCAS: Record<string, string> = { "<": "‹", ">": "›" }

function limpar(texto: string): string {
  return texto.replace(/[<>]/g, (c) => TROCAS[c] ?? c)
}

function preenchido(valor: unknown): boolean {
  if (valor === undefined || valor === null) return false
  if (Array.isArray(valor)) return valor.length > 0
  return valor !== ""
}

function compacto(campos: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => preenchido(v)))
}

function item(i: ItemDoCandidato): Record<string, unknown> {
  return compacto({
    alimento_id: i.alimento_id,
    nome: i.nome,
    funcao: i.funcao,
    casa: i.casa,
    contribui: i.contribui,
    linha_base: i.linha_base,
  })
}

function opcoes(c: Candidato): Record<string, unknown> | undefined {
  if (!c.opcoes) return undefined
  const mapa = Object.fromEntries(
    Object.entries(c.opcoes)
      .filter(([, lista]) => lista.length > 0)
      .map(([funcao, lista]) => [funcao, lista.map(item)]),
  )
  return Object.keys(mapa).length > 0 ? mapa : undefined
}

function candidato(c: Candidato): Record<string, unknown> {
  return compacto({
    tipo: c.tipo,
    id: c.id,
    nome: c.nome,
    contribui: c.contribui,
    linha_base: c.linha_base,
    novidade: c.novidade ? true : undefined,
    ajudou: c.ajudou > 0 ? c.ajudou : undefined,
    gosta: c.gosta ? true : undefined,
    itens: c.itens.map(item),
    opcoes: opcoes(c),
  })
}

function momento(dados: DadosDoPreparo): Record<string, unknown> {
  const q = dados.qualidades
  return compacto({
    estados: dados.estados,
    incomodo: dados.incomodo,
    momento_do_dia: dados.momento_do_dia,
    presentes: q.presentes,
    buscadas: q.buscadas,
    conflitos: q.conflitos,
    evitar: compacto({ gunas: q.evitar_gunas, marcas: q.evitar_marcas, itens: q.evitar }),
    precisa_variante: q.precisa_variante,
  })
}

function paraTer(dados: DadosDoPreparo): Record<string, unknown> | undefined {
  const p = dados.para_ter
  if (!p) return undefined
  return compacto({
    alimento_id: p.alimento_id,
    nome: p.nome,
    vezes: p.vezes,
    contribui: p.contribui,
    linha_base: p.linha_base,
  })
}

export function montarMensagemInicial(dados: DadosDoPreparo, texto?: string): string {
  const semTexto = texto === undefined || texto === ""
  const contexto = compacto({
    intencoes: dados.intencoes,
    momento: momento(dados),
    geral: dados.geral ? true : undefined,
    fixos: compacto({
      ...dados.fixos,
      evitar_sempre: dados.fixos.evitar_sempre.map(limpar),
      nao_come: dados.fixos.nao_come.map(limpar),
    }),
    evitar_textos: dados.evitar_textos.map(limpar),
    resumo_de_rotina: dados.resumo_de_rotina ? limpar(dados.resumo_de_rotina) : undefined,
    padroes: dados.padroes.map(limpar),
    mensagens_do_dia: dados.mensagens_do_dia.map((m) => ({
      autor: m.autor,
      texto: limpar(m.texto),
    })),
    sinais: dados.sinais,
    candidatos: dados.candidatos.map(candidato),
    para_ter: paraTer(dados),
    so_atalhos: semTexto ? true : undefined,
  })
  const blocoContexto = `<contexto>\n${JSON.stringify(contexto, null, 2)}\n</contexto>`
  if (semTexto) return blocoContexto
  return `${blocoContexto}\n<mensagem_da_pessoa>\n${limpar(texto)}\n</mensagem_da_pessoa>`
}
