import { describe, expect, it } from "vitest"
import { acompanhanteV2 } from "./acompanhante.v2"
import { acompanhanteV3 } from "./acompanhante.v3"

const v2Linhas = acompanhanteV2.instrucoes.split("\n")
const v3Linhas = acompanhanteV3.instrucoes.split("\n")

const LINHA_V2 =
  '- Ingrediente: só o que está "confirmado" em casa. Se estiver "incerto", só com se_faltar preenchido por um substituto confirmado em casa (ayurveda.substitutos). "Ausente" não entra.'

const CINCO_LINHAS = [
  '- Ingrediente: só o que está "confirmado" em casa. Para usar um que está "incerto" ou "ausente", pergunte antes com ask_user (tipo casa) e só use se a resposta for "tenho". Sem perguntar, "incerto" só entra com se_faltar preenchido por um substituto confirmado em casa (ayurveda.substitutos), e "ausente" não entra.',
  '- ask_user: no máximo 2 perguntas, e só quando a resposta muda o que você vai sugerir. Se já dá para sugerir bem com o que está confirmado, não pergunte. Junte até 5 alimentos numa pergunta só. Só pergunte sobre ingrediente dos candidatos. Nunca pergunte sobre o que já está confirmado nem sobre o que está em evitar_sempre, restrições, "não como" ou "não gosto".',
  '- Candidato com depende_de_pergunta: só entregue depois de um "tenho" para o ingrediente que falta. Se a pergunta não couber, use outro candidato.',
  "- ask_user tipo come: só quando um alimento de origem animal entraria na sugestão e nada no contexto diz se a pessoa come.",
  '- Depois da resposta: "tenho" pode entrar; "nao_tenho", "nao_gosto" e "nao_come" não entram; "pulou" fica como estava. Não comente a resposta: use.',
]

describe("acompanhanteV3", () => {
  it("tem a versão acompanhante.v3 e o mesmo lembrete da v2", () => {
    expect(acompanhanteV3.versao).toBe("acompanhante.v3")
    expect(acompanhanteV3.lembreteDeEntrega).toBe(acompanhanteV2.lembreteDeEntrega)
  })

  it("é a v2 com a linha de Ingrediente trocada pelas cinco linhas e nenhuma outra diferença", () => {
    const pos = v2Linhas.indexOf(LINHA_V2)
    expect(pos).toBeGreaterThan(-1)

    const desfeita = [...v3Linhas]
    const inicio = v3Linhas.indexOf(CINCO_LINHAS[0] as string)
    expect(inicio).toBeGreaterThan(-1)
    desfeita.splice(inicio, CINCO_LINHAS.length, LINHA_V2)

    expect(desfeita).toEqual(v2Linhas)
  })

  it("tem as cinco linhas novas, nesta ordem, logo no lugar da linha de Ingrediente", () => {
    const inicio = v3Linhas.indexOf(CINCO_LINHAS[0] as string)

    expect(v3Linhas.slice(inicio, inicio + 5)).toEqual(CINCO_LINHAS)
    expect(v3Linhas.filter((l) => l.startsWith("- Ingrediente:"))).toHaveLength(1)
  })
})
