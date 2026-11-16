import { entregaDoCha, juizCorrige, passoDoClima, RESPOSTA_COM_PROMESSA } from "./juiz-corrige"
import type { Cenario } from "./tipos"

// O mesmo momento de juiz-corrige, com a segunda entrega ainda prometendo: o Juiz barra e a resposta é a segura.
export const juizBarra: Cenario = {
  ...juizCorrige,
  nome: "juiz-barra",
  descricao:
    "Momento de juiz-corrige; a segunda entrega ainda promete e o Juiz reprova de novo: resposta segura, sem retorno criado",
  juiz: [
    { apontamentos: [{ motivo: "promessa", trecho: "resolve a dor" }] },
    { apontamentos: [{ motivo: "promessa", trecho: "acaba com a dor" }] },
  ],
  roteiro: [
    passoDoClima,
    entregaDoCha(RESPOSTA_COM_PROMESSA),
    entregaDoCha(
      "Um chá quente de gengibre com canela acaba com a dor no estômago e aquece o corpo. Se puder, sente-se para beber, sem pressa.",
    ),
  ],
}
