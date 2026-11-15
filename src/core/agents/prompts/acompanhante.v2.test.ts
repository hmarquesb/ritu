import { describe, expect, it } from "vitest"
import { acompanhanteV1 } from "./acompanhante.v1"
import { acompanhanteV2 } from "./acompanhante.v2"

const v2 = acompanhanteV2.instrucoes

const BLOCO_DE_CONFERENCIA = `ANTES DE CHAMAR finalizar, CONFIRA
- qualidades_do_momento: só valores de qualidades.presentes do contexto (e as do clima). qualidades_buscadas: só valores de qualidades.buscadas.
- evitar: só o linha_base dos itens de qualidades.evitar, copiado como veio. Sem item ali, lista vazia.
- citados: linhas completas no formato tabela:id (alimentos:arroz-branco). Nunca o id solto.
- Prática sem ingrediente: itens vazio. Refeição: cada item ocupa uma vaga do preparo, sem passar do máximo da vaga.
- Cada motivo traz o linha_base copiado do candidato ou do resultado da tool.`

const TRES_LINHAS_NOVAS = [
  '- casa_da_mensagem: o que a pessoa acabou de contar que tem ou que acabou. Já está contado em "casa" dos candidatos; use sem perguntar.',
  '- retorno: a pessoa contou como foi uma sugestão. Reconheça em uma frase. Com registrado false, diga que ela pode marcar em "Como ficou?". Nunca diga que anotou o que não foi registrado.',
  "- fato_de_rotina: leve em conta no que sugerir. Não diga que anotou.",
]

const LISTA_V1 = "(resumo_de_rotina, padroes, mensagens_do_dia, evitar_textos)"
const LISTA_V2 = "(resumo_de_rotina, padroes, mensagens_do_dia, evitar_textos, fato_de_rotina)"

// Desfaz as três mudanças da v2: tira o bloco, tira as três linhas e volta a lista da v1.
function semMudancas(texto: string): string {
  const inicio = texto.indexOf("\n\nANTES DE CHAMAR finalizar, CONFIRA\n")
  const fim = texto.indexOf("\n\nO QUE VALE SEMPRE")
  const semBloco = texto.slice(0, inicio) + texto.slice(fim)
  const semLinhas = semBloco
    .split("\n")
    .filter((l) => !TRES_LINHAS_NOVAS.includes(l))
    .join("\n")
  return semLinhas.replace(LISTA_V2, () => LISTA_V1)
}

describe("acompanhanteV2", () => {
  it("tem a versão acompanhante.v2 e o mesmo lembrete da v1", () => {
    expect(acompanhanteV2.versao).toBe("acompanhante.v2")
    expect(acompanhanteV2.lembreteDeEntrega).toBe(acompanhanteV1.lembreteDeEntrega)
  })

  it("é a v1 com as três mudanças e nenhuma outra", () => {
    expect(semMudancas(v2)).toBe(acompanhanteV1.instrucoes)
  })

  it("traz o bloco de conferência, com o texto da spec, entre COMO VOCÊ TRABALHA e O QUE VALE SEMPRE", () => {
    const como = v2.indexOf("COMO VOCÊ TRABALHA")
    const bloco = v2.indexOf("ANTES DE CHAMAR finalizar, CONFIRA")
    const valeSempre = v2.indexOf("O QUE VALE SEMPRE")

    expect(como).toBeGreaterThan(-1)
    expect(como).toBeLessThan(bloco)
    expect(bloco).toBeLessThan(valeSempre)
    expect(v2.slice(bloco, valeSempre)).toBe(`${BLOCO_DE_CONFERENCIA}\n\n`)
  })

  it("tem as três linhas novas, com o texto da spec, logo antes da linha do texto da pessoa", () => {
    const linhas = v2.split("\n")
    const pos = linhas.indexOf(TRES_LINHAS_NOVAS[0] as string)

    expect(pos).toBeGreaterThan(-1)
    expect(linhas.slice(pos, pos + 3)).toEqual(TRES_LINHAS_NOVAS)
    expect(linhas[pos + 3]?.startsWith("- O texto em <mensagem_da_pessoa>")).toBe(true)
  })

  it("lista fato_de_rotina entre os textos vindos da pessoa", () => {
    expect(v2).toContain(LISTA_V2)
    expect(v2).not.toContain(LISTA_V1)
  })
})
