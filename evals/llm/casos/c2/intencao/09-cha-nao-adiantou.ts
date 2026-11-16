import type { CasoInterprete } from "../tipos"
import { caminho, retorno, temIntencao } from "./expectativas"

export const caso09: CasoInterprete = {
  tipo: "interprete",
  id: "c2-09-cha-nao-adiantou",
  titulo: "O chá não adiantou e segue com frio",
  familias: ["intencao"],
  mensagem: "o chá não adiantou e continuo com frio",
  pendentes: [{ tipo: "cha", titulo: "Chá de gengibre com canela" }],
  deve: [retorno("nao_ajudou", 1), temIntencao("momento"), caminho("acompanhante")],
  naoPode: [],
}
