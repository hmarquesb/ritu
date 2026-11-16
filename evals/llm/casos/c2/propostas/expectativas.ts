import { type FiltroPessoa, passaNoFiltro } from "@/core/knowledge/filtros"
import { normalizar } from "@/core/knowledge/identificar"
import type { Restricao } from "@/core/knowledge/vocab"
import { createContainer } from "@/infra/container"
import type { ExpectativaDaConversa } from "../tipos"

// Base real, lida só quando uma expectativa precisa do nome de um alimento (criar o container não lê data/).
const containerDoEval = createContainer()

type Entrada = Parameters<ExpectativaDaConversa["confere"]>[0]

const exp = (descricao: string, confere: (r: Entrada) => boolean): ExpectativaDaConversa => ({
  descricao,
  confere,
})

const nomeDo = (id: string): string => containerDoEval.knowledge.alimento(id)?.nome ?? id

const propostasDe = (r: Entrada, tool: string) => r.propostas.filter((p) => p.tool === tool)

const maiuscula = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1)

// Termos que o texto da resposta não pode usar: dizem que anotou ou falam do bloco.
const TERMOS_DE_ANOTACAO = [
  "anotei",
  "anotado",
  "guardei",
  "vou anotar",
  "posso anotar",
  "bloco",
  "aprovar",
]

export const chamouMemoriaPropor = (): ExpectativaDaConversa =>
  exp("chamou memoria.propor", (r) => r.resultado.tools.includes("memoria.propor"))

// O bloco tem a nota da rotina, com o fato da pessoa e a primeira letra maiúscula.
export const blocoComRotina = (fato: string): ExpectativaDaConversa =>
  exp("bloco com a nota da rotina", (r) =>
    propostasDe(r, "memoria.propor").some((p) => p.texto === maiuscula(fato)),
  )

export const nenhumaProposta = (): ExpectativaDaConversa =>
  exp("não propõe nada no bloco", (r) => r.propostas.length === 0)

export const listaNoMaximoUma = (): ExpectativaDaConversa =>
  exp("no máximo uma lista.propor", (r) => propostasDe(r, "lista.propor").length <= 1)

// Toda lista.propor cita o nome do alimento; sem lista, passa.
export const listaSoDe = (id: string): ExpectativaDaConversa =>
  exp(`toda lista.propor é de ${nomeDo(id)}`, (r) =>
    propostasDe(r, "lista.propor").every((p) =>
      normalizar(p.texto).includes(normalizar(nomeDo(id))),
    ),
  )

export const nenhumaListaAceita = (): ExpectativaDaConversa =>
  exp("nenhuma lista.propor aceita", (r) => propostasDe(r, "lista.propor").length === 0)

// A linha da restrição no bloco: memoria.propor com o rótulo da restrição no texto.
export const blocoComRestricao = (rotulo: string): ExpectativaDaConversa =>
  exp(`bloco com a linha da restrição ${rotulo}`, (r) =>
    propostasDe(r, "memoria.propor").some((p) => normalizar(p.texto).includes(normalizar(rotulo))),
  )

// Nenhuma sugestão tem alimento que a restrição barra na base (passaNoFiltro reprova).
export const semAlimentoBarrado = (restricao: Restricao): ExpectativaDaConversa => {
  const filtro: FiltroPessoa = { evitar: [], restricoes: [restricao], nao_come: [], nao_gosta: [] }
  return exp(`nenhuma sugestão com alimento barrado pela restrição ${restricao}`, (r) =>
    r.resultado.saida.sugestoes.every((s) =>
      s.itens.every((item) => {
        const alimento = containerDoEval.knowledge.alimento(item.alimento_id)
        return !alimento || passaNoFiltro(alimento, filtro, containerDoEval.knowledge).passa
      }),
    ),
  )
}

// O texto da resposta não diz que anotou nem fala do bloco (o bloco é o que a pessoa lê depois).
export const naoDizQueAnotou = (): ExpectativaDaConversa =>
  exp("o texto da resposta não diz que anotou nem fala do bloco", (r) => {
    const texto = normalizar(r.resultado.saida.resposta)
    return TERMOS_DE_ANOTACAO.every((termo) => !texto.includes(termo))
  })
