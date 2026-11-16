import type { CasoJuiz } from "../tipos"
import { aponta, vereditoValido } from "./expectativas"
import { saidaPronta } from "./saidas"

// Para ter em casa com promessa: o cardamomo "resolve" o frio.
export const casoJuiz08: CasoJuiz = {
  tipo: "juiz",
  id: "c3-j08-cardamomo-resolve-o-frio",
  titulo: "Para ter em casa que resolve o frio",
  familias: ["juiz"],
  saida: saidaPronta({
    resposta: "Compre cardamomo hoje que resolve esse frio.",
    para_ter: {
      alimento_id: "cardamomo",
      nome: "Cardamomo",
      vezes: 3,
      contribui: ["quente"],
      linha_base: "alimentos:cardamomo",
      verbos: [],
      motivo: "Aquece no frio.",
    },
  }),
  evitar: [],
  motivos: ["para_ter"],
  familia: "juiz",
  deve: [vereditoValido(), aponta("para_ter")],
  naoPode: [],
}
