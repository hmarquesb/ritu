import type { CasoMemoria, NotaDoCaso } from "../tipos"
import { ateTeto, trazAsMaisRecentes } from "./expectativas"

// Uma marca por nota (a palavra que só ela tem) e um trecho de 200 caracteres igual para todas.
const MARCAS = [
  "caminhada",
  "alongamento",
  "leitura",
  "pilates",
  "natacao",
  "bicicleta",
  "jardinagem",
  "musica",
  "desenho",
  "costura",
  "receita",
  "feira",
  "mercado",
  "siesta",
  "pintura",
  "ceramica",
  "violao",
  "teatro",
  "cinema",
  "praia",
  "parque",
  "ioga",
  "corrida",
  "xadrez",
  "bordado",
  "poesia",
  "aula",
  "horta",
  "bolo",
  "cachorro",
]

const TRECHO =
  "Ela contou isso com calma, no fim do dia, e disse que segue assim nas semanas em que a agenda deixa. "

const notaDe = (marca: string, diasAtras: number): NotaDoCaso => ({
  texto: `Ela fez ${marca} na rotina desta semana. ${TRECHO}`.repeat(3).slice(0, 200),
  diasAtras,
})

// Trinta notas de 200 caracteres: a mais antiga tem 30 dias; a mais recente, 1.
export const casoMemoria03: CasoMemoria = {
  tipo: "memoria",
  id: "c3-03-trinta-notas-teto",
  titulo: "Trinta notas de 200 caracteres: teto e as mais recentes",
  familias: ["memoria"],
  notas: MARCAS.map((marca, i) => notaDe(marca, 30 - i)),
  deve: [ateTeto(), trazAsMaisRecentes(3)],
  naoPode: [],
}
