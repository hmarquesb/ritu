import { juiz } from "@config/juiz"
import type { Apontamento } from "./saida"

type Grave = (typeof juiz.graves)[number]

const DESCRICOES: Record<Grave, string> = {
  promessa:
    'Promete efeito de saúde. Fale em conforto ("pode ajudar a aliviar a sensação de..."), nunca em tratar, curar ou resolver.',
  dosagem: "Traz dose, suplemento ou fitoterápico. Tire.",
  conselho: "Dá conselho que não é o seu papel. Acolha e diga que isso não é com você.",
  evitar_sempre: "Cita algo que a pessoa nunca pode receber. Tire do texto e das sugestões.",
  texto_diferente:
    "O texto fala de algo que não está nas sugestões, ou diz o contrário delas. Deixe os dois iguais.",
  motivo_sem_base:
    "O motivo não bate com a linha da base citada. Reescreva o motivo a partir da linha.",
  para_ter: 'A indicação de "vale ter em casa" é para as próximas vezes, sem marca, loja ou preço.',
  vulgar: "Tem palavrão ou repete uma ofensa. Tire.",
  tom: "Cobra ou julga a pessoa. Reescreva acolhendo.",
}

const CABECALHO = "Um revisor leu a sua resposta e ela não pode ser entregue assim. Problemas:"
const LINHA = '- {descricao} Trecho: "{trecho}"'
const RODAPE =
  "Reescreva corrigindo só isso, sem mudar o que estava certo, e chame finalizar de novo."

function ehGrave(motivo: string): motivo is Grave {
  return (juiz.graves as readonly string[]).includes(motivo)
}

function linhaDoApontamento(motivo: Grave, trecho: string): string {
  return LINHA.replace("{descricao}", () => DESCRICOES[motivo]).replace("{trecho}", () => trecho)
}

export function mensagemDaNovaTentativa(apontamentos: Apontamento[]): string {
  const linhas = apontamentos.flatMap((a) =>
    ehGrave(a.motivo) ? [linhaDoApontamento(a.motivo, a.trecho)] : [],
  )
  return [CABECALHO, ...linhas, RODAPE].join("\n")
}
