import type { Cenario } from "./tipos"

export const semModelo: Cenario = {
  nome: "sem-modelo",
  descricao: "Registro de uso esgotado para o papel decisao: resposta montada por código",
  agora: "2026-06-15T22:00:00.000Z",
  perfil: {
    prakriti: { vata: 0.45, pitta: 0.45, kapha: 0.1 },
    cidade: { nome: "Rio de Janeiro", lat: -22.91, lon: -43.21, fuso: "America/Sao_Paulo" },
  },
  casa: [{ alimento_id: "gengibre" }, { alimento_id: "canela" }],
  clima: { temperatura_aparente: 16, umidade: 88 },
  esgotado: "decisao",
  entrada: {
    texto: "Estou com frio e cansada.",
    intencoes: ["momento"],
    estados: ["com_frio"],
    evitar_da_mensagem: [],
  },
  roteiro: [],
}
